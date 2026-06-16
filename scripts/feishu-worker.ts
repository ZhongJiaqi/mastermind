#!/usr/bin/env -S node --experimental-strip-types
// ======================================================
// Feishu long-connection worker
//
// Replaces the Vercel webhook for receiving messages — opens a
// persistent WebSocket from THIS process to Feishu Cloud and waits for
// im.message.receive_v1 events. Outbound (sending result cards) still
// uses the same HTTP API via the SDK's bundled client.
//
// Runs as a long-lived process. Designed for Railway / Fly.io / etc.
// 7×24 hosts where Mac sleep / cold start isn't a concern.
//
// Reuses the council + card + KV code that the Vercel webhook used —
// only the entry point changes, not the business logic.
//
// Run locally:
//   DASHSCOPE_API_KEY=… FEISHU_APP_ID=… FEISHU_APP_SECRET=… \
//   KV_REST_API_URL=… KV_REST_API_TOKEN=… \
//   npx tsx scripts/feishu-worker.ts
// ======================================================

import * as Lark from '@larksuiteoapi/node-sdk';

import { ADVISORS } from '../src/generated/advisors';
import { parseCouncilStream } from '../src/lib/councilParser';
import { openCouncilStream } from '../api/_shared/council-run';
import {
  ActionDedup,
  applySelectorAction,
  buildCouncilCard,
  buildSelectorCard,
  buildStreamingCard,
  type AdvisorOption,
} from '../api/_shared/feishu/card';
import {
  generateShareId,
  isKvConfigured,
  kvDelete,
  kvGetJson,
  kvSetJson,
  KvError,
} from '../api/_shared/kv';

const SHARE_TTL_SECONDS = 60 * 60 * 24 * 90;
// Pending selection blob lives for an hour — long enough for a user to
// pick advisors at their own pace, short enough to keep KV tidy.
const PENDING_TTL_SECONDS = 60 * 60;

const ADVISOR_OPTIONS: AdvisorOption[] = ADVISORS.map((a) => ({
  id: a.frontmatter.id,
  name: a.frontmatter.name,
  tagline: a.frontmatter.tagline,
}));
const ALL_ADVISOR_IDS = ADVISOR_OPTIONS.map((a) => a.id);

interface PendingSelection {
  openId: string;
  question: string;
  selectedIds: string[];
  createdAt: number;
}

function trim(v: string | undefined): string {
  return v?.trim() || '';
}

function publicBaseUrl(): string {
  const explicit = trim(process.env.PUBLIC_BASE_URL);
  if (explicit) return explicit.replace(/\/+$/, '');
  return 'https://mastermind-gamma-weld.vercel.app';
}

function requireEnv(name: string): string {
  const v = trim(process.env[name]);
  if (!v) {
    console.error(`[feishu-worker] missing env ${name}`);
    process.exit(1);
  }
  return v;
}

const APP_ID = requireEnv('FEISHU_APP_ID');
const APP_SECRET = requireEnv('FEISHU_APP_SECRET');
// DashScope API key is the other hard requirement — council needs LLM.
requireEnv('DASHSCOPE_API_KEY');

const client = new Lark.Client({
  appId: APP_ID,
  appSecret: APP_SECRET,
  // 中国版飞书走默认 domain；Lark 国际版用 Lark.Domain.Lark
  // 自动检测：APP_ID 以 cli_ 开头都是飞书/Lark 通用，默认即可
});

const wsClient = new Lark.WSClient({
  appId: APP_ID,
  appSecret: APP_SECRET,
  loggerLevel: Lark.LoggerLevel.info,
});

function stripBotMention(text: string): string {
  return text.replace(/^@_user_\d+\s*/, '').replace(/^@[一-龥\w·]+\s*/, '').trim();
}

function parseTextMessageContent(raw: string | undefined): string {
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw) as { text?: string };
    return (parsed.text || '').trim();
  } catch {
    return '';
  }
}

async function sendText(openId: string, text: string): Promise<void> {
  await client.im.v1.message.create({
    params: { receive_id_type: 'open_id' },
    data: {
      receive_id: openId,
      msg_type: 'text',
      content: JSON.stringify({ text }),
    },
  });
}

interface CreateMessageResponse {
  data?: { message_id?: string };
}

async function sendCard(openId: string, card: object): Promise<string | undefined> {
  const resp = (await client.im.v1.message.create({
    params: { receive_id_type: 'open_id' },
    data: {
      receive_id: openId,
      msg_type: 'interactive',
      content: JSON.stringify(card),
    },
  })) as CreateMessageResponse;
  return resp.data?.message_id;
}

async function patchCard(messageId: string, card: object): Promise<void> {
  // Feishu SDK API: PATCH /im/v1/messages/:message_id — replaces the
  // entire card content (interactive msg_type only). The SDK does NOT
  // throw on Feishu API errors (it returns { code, msg } with HTTP 200);
  // we have to inspect and surface ourselves or the failure is silent.
  const resp = (await client.im.v1.message.patch({
    path: { message_id: messageId },
    data: { content: JSON.stringify(card) },
  })) as { code?: number; msg?: string; data?: unknown };
  if (resp && typeof resp.code === 'number' && resp.code !== 0) {
    console.warn(`[patchCard] feishu non-zero code=${resp.code} msg=${resp.msg ?? '?'}`);
    throw new Error(`patchCard failed: code=${resp.code} msg=${resp.msg ?? '?'}`);
  }
}

// Throttle interval between patches — short enough for the discussion
// to feel live, long enough to leave headroom under Feishu's per-message
// patch rate limits.
const PATCH_INTERVAL_MS = 2000;

// Entry called on each fresh DM. Pre-generates a 12-char pendingId so
// the FIRST card we send already has correct values baked in — no
// patch-with-real-pendingId step needed. Earlier, we sent a placeholder
// card with pendingId='pending' literal then patched. If a user clicked
// before patch landed, the click's pendingId was the literal 'pending'
// string with no matching KV entry, triggering the "选择已过期" flash.
async function sendSelectorOnDm(openId: string, rawQuestion: string): Promise<void> {
  const question = stripBotMention(rawQuestion);
  if (!question) return;

  // Skip selector entirely when KV isn't configured — without persistent
  // state we can't honor any user toggling.
  if (!isKvConfigured()) {
    console.warn('[selector] KV off, skipping selector → running with all 10');
    await processCouncilDm(openId, question, ALL_ADVISOR_IDS);
    return;
  }

  const pendingId = generateShareId(12);

  // Write KV FIRST so even the fastest possible click race finds state.
  try {
    await kvSetJson<PendingSelection>(
      `pending:${pendingId}`,
      { openId, question, selectedIds: ALL_ADVISOR_IDS, createdAt: Date.now() },
      PENDING_TTL_SECONDS,
    );
  } catch (err) {
    console.error('[selector] KV write failed, falling back to all-10 council', err);
    await processCouncilDm(openId, question, ALL_ADVISOR_IDS);
    return;
  }

  // Now send the card; buttons carry the real pendingId from the start.
  let messageId: string | undefined;
  try {
    messageId = await sendCard(
      openId,
      buildSelectorCard({
        pendingId,
        question,
        allAdvisors: ADVISOR_OPTIONS,
        selectedIds: ALL_ADVISOR_IDS,
      }),
    );
  } catch (err) {
    console.error('[selector] card send failed', err);
    await kvDelete(`pending:${pendingId}`).catch(() => undefined);
    await sendText(openId, `❌ 发送选军师卡片失败：${err instanceof Error ? err.message : String(err)}`).catch(() => undefined);
    return;
  }

  console.log(
    `[selector] sent selector card pendingId=${pendingId} messageId=${messageId ?? '(unknown)'} from=${openId.slice(-6)}`,
  );
}

async function processCouncilDm(
  openId: string,
  rawQuestion: string,
  selectedAdvisorIds: string[],
  reuseMessageId?: string,
): Promise<void> {
  const question = stripBotMention(rawQuestion);
  if (!question) return;
  const t0 = Date.now();
  const log = (msg: string) => console.log(`[council ${openId.slice(-6)}] +${Date.now() - t0}ms ${msg}`);

  const selected = ADVISORS.filter((a) => selectedAdvisorIds.includes(a.frontmatter.id));
  if (selected.length === 0) {
    await sendText(openId, '⚠️ 至少选一位军师才能开议').catch(() => undefined);
    return;
  }
  const advisorIds = selected.map((a) => a.frontmatter.id);
  const advisorNames = selected.map((a) => a.frontmatter.name);
  log(`start question="${question.slice(0, 50)}…" advisors=${advisorIds.length}`);

  // If the selector flow handed us its message_id, patch it in-place so
  // the user sees the selector morph into a "thinking" card. Otherwise
  // send a fresh card (selector-skipped fallback path).
  let messageId: string | undefined = reuseMessageId;
  const initialThinkingCard = buildStreamingCard({
    question,
    advisorCount: selected.length,
    messages: [],
    done: false,
  });
  try {
    if (messageId) {
      await patchCard(messageId, initialThinkingCard);
      log(`reused selector card message_id=${messageId}`);
    } else {
      messageId = await sendCard(openId, initialThinkingCard);
      log(`initial card sent message_id=${messageId}`);
    }
  } catch (err) {
    console.error('[feishu-worker] initial card send/patch failed', err);
    await sendText(openId, `📝 收到：${question}\n🧠 召集中……`).catch(() => undefined);
  }

  // Open the LLM stream and drain it while throttle-patching the card.
  // Patches are serialized through patchChain — patchChain.then(next) ensures
  // a slow patch can't be overtaken by a newer one and overwrite it back to
  // a stale state. Without this, fire-and-forget patches race and the user
  // sees the card "go backwards" or freeze on an intermediate state.
  let fullText = '';
  let modelUsed = 'unknown';
  let lastPatchAt = 0;
  let lastPatchedStateKey = '';
  let patchChain: Promise<void> = Promise.resolve();
  let patchesAttempted = 0;

  // Count partial advisor cards inside the streaming <conclusions> block.
  // After </discussion> closes, the LLM spends 30-60s emitting JSON cards;
  // we use "advisorId" occurrences in that segment as a proxy for how many
  // decisions have been generated so far. Without this signal the card UI
  // would freeze on the discussion-only count for the entire conclusions
  // phase (the visible "stuck after 10 段" symptom).
  const countPartialCards = (text: string): number => {
    const idx = text.indexOf('<conclusions>');
    if (idx < 0) return 0;
    return (text.slice(idx).match(/"advisorId"/g) || []).length;
  };

  try {
    const { stream, modelUsed: m } = await openCouncilStream({
      advisors: selected as unknown as Parameters<typeof openCouncilStream>[0]['advisors'],
      session: { question },
    });
    modelUsed = m;
    log(`LLM stream opened model=${modelUsed}`);

    for await (const chunk of stream) {
      const text = chunk.choices?.[0]?.delta?.content ?? '';
      if (!text) continue;
      fullText += text;

      if (!messageId) continue;
      const now = Date.now();
      if (now - lastPatchAt < PATCH_INTERVAL_MS) continue;

      const parsed = parseCouncilStream(fullText);
      const partialCards = countPartialCards(fullText);
      const stateKey = `${parsed.messages.length}|${partialCards}`;
      if (stateKey === lastPatchedStateKey) continue;
      lastPatchedStateKey = stateKey;
      lastPatchAt = now;
      patchesAttempted++;

      const intermediateCard = buildStreamingCard({
        question,
        advisorCount: selected.length,
        messages: parsed.messages,
        done: false,
        modelUsed,
        partialCardCount: partialCards,
      });
      const seqMessages = parsed.messages.length;
      // Serialize on patchChain — the new patch waits for the previous
      // patch to finish before starting. Stream consumption continues
      // independently so chunk accumulation isn't blocked.
      patchChain = patchChain.then(() =>
        patchCard(messageId!, intermediateCard)
          .then(() => log(`patched (msgs=${seqMessages}, cards=${partialCards}, fullText=${fullText.length}b)`))
          .catch((err) => console.warn(`[council] intermediate patch failed`, err)),
      );
    }
    log(`stream ended fullText=${fullText.length}b patches=${patchesAttempted}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[feishu-worker] council stream failed', msg);
    if (messageId) {
      const errorCard = buildStreamingCard({
        question,
        advisorCount: ADVISORS.length,
        messages: parseCouncilStream(fullText).messages,
        done: true,
        modelUsed,
      });
      await patchCard(messageId, errorCard).catch(() => undefined);
    }
    await sendText(
      openId,
      `❌ 对不起，军师们正在路上……\n${msg.slice(0, 200)}\n（稍后重试一下）`,
    ).catch(() => undefined);
    return;
  }

  const parsed = parseCouncilStream(fullText);
  log(`parse done messages=${parsed.messages.length} cards=${parsed.cards?.length ?? 'null'}`);

  let shareUrl = '';
  if (isKvConfigured()) {
    try {
      const shareId = generateShareId();
      await kvSetJson(
        `share:${shareId}`,
        {
          question,
          selectedAdvisorIds: advisorIds,
          fullText,
          modelUsed,
          source: 'feishu',
          createdAt: Date.now(),
        },
        SHARE_TTL_SECONDS,
      );
      shareUrl = `${publicBaseUrl()}/?c=${shareId}`;
      log(`KV stored shareId=${shareId}`);
    } catch (err) {
      const msg = err instanceof KvError ? err.message : String(err);
      console.error('[feishu-worker] KV write failed, dropping share button', msg);
    }
  }

  const finalCard = buildCouncilCard({
    question,
    advisorNames,
    cards: parsed.cards ?? [],
    discussionMessages: parsed.messages,
    shareUrl: shareUrl || publicBaseUrl(),
    modelUsed,
  });

  // Wait for the in-flight intermediate-patch chain to drain BEFORE
  // submitting the final patch. Otherwise a stale intermediate landing
  // late would overwrite the final card with discussion-only content.
  await patchChain.catch(() => undefined);

  if (messageId) {
    try {
      await patchCard(messageId, finalCard);
      log(`final card patched in (total ${Date.now() - t0}ms)`);
      return;
    } catch (err) {
      console.error('[feishu-worker] final patch failed, falling back to new message', err);
    }
  }
  // No messageId or final patch failed — send a brand-new card so the
  // user still gets the result.
  try {
    await sendCard(openId, finalCard);
  } catch (err) {
    console.error('[feishu-worker] final card send failed', err);
    await sendText(
      openId,
      `⚠️ 卡片发送失败。给你纯文本版结论：\n\n${(parsed.cards ?? [])
        .map((c) => `· ${c.characterName}：${c.conclusion}`)
        .join('\n') || '（解析失败，无法展示）'}`,
    ).catch(() => undefined);
  }
}

// Track in-flight messages so SDK retries (same message_id) don't run
// council twice — every council is ~30s of LLM time, dedupe matters.
const inflight = new Set<string>();

// ----------------------- Card click handler -----------------------

interface SelectorActionValue {
  action?: 'toggle' | 'all' | 'none' | 'start';
  id?: string;
  pendingId?: string;
}

// For card click responses, Feishu requires the handler to RETURN the
// new card object — WSClient passes the return value back through the
// websocket as the click response, and Feishu uses that to refresh the
// clicker's view synchronously. REST patchCard (im.v1.message.patch)
// succeeds at the API but does NOT refresh a user who is actively
// viewing the card. So: return the card primarily, and also patch via
// REST as belt-and-suspenders for any other viewers / cached states.
async function handleSelectorClick(payload: {
  pendingId: string;
  action: SelectorActionValue['action'];
  toggleId?: string;
  cardMessageId: string;
  clickerOpenId: string;
}): Promise<object | undefined> {
  const { pendingId, action, toggleId, cardMessageId, clickerOpenId } = payload;
  let pending: PendingSelection | null = null;
  try {
    pending = await kvGetJson<PendingSelection>(`pending:${pendingId}`);
  } catch (err) {
    console.error('[selector] KV read failed', err);
  }
  if (!pending) {
    console.warn(`[selector] no pending blob for ${pendingId} (expired or never written)`);
    const expiredCard = {
      config: { wide_screen_mode: true, update_multi: true },
      header: { template: 'red', title: { tag: 'plain_text', content: '决策圆桌 · 选择已过期' } },
      elements: [
        {
          tag: 'markdown',
          content: '⚠️ 这张选军师卡片已过期（>1 小时）或被清除。请重新发送你的问题。',
        },
      ],
    };
    patchCard(cardMessageId, expiredCard).catch((err) => console.warn('[selector] expired card patch failed', err));
    return expiredCard;
  }

  const newSelectedIds = applySelectorAction(
    pending.selectedIds,
    ALL_ADVISOR_IDS,
    (action ?? 'toggle') as Parameters<typeof applySelectorAction>[2],
    toggleId,
  );

  if (action === 'start') {
    if (newSelectedIds.length === 0) {
      console.log(`[selector] start clicked with 0 selected — refusing`);
      const sameCard = buildSelectorCard({
        pendingId,
        question: pending.question,
        allAdvisors: ADVISOR_OPTIONS,
        selectedIds: newSelectedIds,
      });
      patchCard(cardMessageId, sameCard).catch(() => undefined);
      return sameCard;
    }
    console.log(`[selector] start clicked — running council with ${newSelectedIds.length} advisors`);
    await kvDelete(`pending:${pendingId}`).catch(() => undefined);
    // Kick off council asynchronously — it'll patch the card via REST as
    // streaming proceeds. Return a "thinking" card NOW so feishu replaces
    // the selector on the clicker's view immediately.
    const thinkingCard = buildStreamingCard({
      question: pending.question,
      advisorCount: newSelectedIds.length,
      messages: [],
      done: false,
    });
    void processCouncilDm(pending.openId, pending.question, newSelectedIds, cardMessageId).catch((err) => {
      console.error('[selector] background council threw', err);
    });
    return thinkingCard;
  }

  // toggle / all / none → persist + return new card (sync UI refresh)
  // and ALSO patch via REST (covers external viewers + cache invalidation)
  try {
    await kvSetJson<PendingSelection>(
      `pending:${pendingId}`,
      { ...pending, selectedIds: newSelectedIds },
      PENDING_TTL_SECONDS,
    );
  } catch (err) {
    console.error('[selector] KV update failed', err);
  }
  const newCard = buildSelectorCard({
    pendingId,
    question: pending.question,
    allAdvisors: ADVISOR_OPTIONS,
    selectedIds: newSelectedIds,
  });
  // No REST patchCard fallback here — return-card via WS response is the
  // canonical Feishu path and refreshes the clicker's view synchronously.
  // The earlier REST patch was redundant and added ~300ms of perceived
  // latency on every toggle.
  console.log(
    `[selector] action=${action}${toggleId ? ` id=${toggleId}` : ''} → ${newSelectedIds.length}/${ADVISOR_OPTIONS.length} (clicker=${clickerOpenId.slice(-6)}) ✅ returning new card`,
  );
  return newCard;
}

wsClient.start({
  eventDispatcher: new Lark.EventDispatcher({}).register({
    'im.message.receive_v1': async (data: unknown) => {
      const d = data as {
        sender?: { sender_id?: { open_id?: string }; sender_type?: string };
        message?: {
          message_id?: string;
          chat_type?: string;
          message_type?: string;
          content?: string;
        };
      };
      const openId = d.sender?.sender_id?.open_id;
      const messageId = d.message?.message_id;
      if (
        d.sender?.sender_type !== 'user' ||
        d.message?.chat_type !== 'p2p' ||
        d.message?.message_type !== 'text' ||
        !openId ||
        !messageId
      ) {
        console.log(
          `[feishu-worker] event filtered out type=${d.message?.message_type} chat=${d.message?.chat_type}`,
        );
        return;
      }
      if (inflight.has(messageId)) {
        console.log(`[feishu-worker] dedupe ${messageId} (already in-flight)`);
        return;
      }
      inflight.add(messageId);
      console.log(`[feishu-worker] event received message_id=${messageId} from=${openId.slice(-6)}`);
      try {
        const text = parseTextMessageContent(d.message.content);
        if (text) {
          await sendSelectorOnDm(openId, text);
        } else {
          console.log(`[feishu-worker] empty text content message_id=${messageId}`);
        }
      } catch (err) {
        console.error(`[feishu-worker] sendSelectorOnDm threw for ${messageId}`, err);
      } finally {
        // Hold the dedupe entry for 5 minutes — long enough that SDK
        // retries can't double-fire, short enough that Set can't grow
        // unbounded over the worker's uptime.
        setTimeout(() => inflight.delete(messageId), 5 * 60 * 1000);
      }
    },
    // Register every plausible card-action event name; Feishu has historically
    // emitted any of these depending on SDK version + console settings.
    'card.action.trigger': cardClickHandler,
    'card.action.trigger_v1': cardClickHandler,
    'im.card.action.trigger': cardClickHandler,
    'card.action': cardClickHandler,
  }),
});

// Dedup duplicate card clicks. Feishu sometimes pushes the same logical
// click twice with DIFFERENT event_ids — so event_id-based dedup misses
// them. Identity is (cardMessageId, operator, action.value-serialized);
// two unique button presses always differ on action.value (toggle id,
// or action='all'/'none'/'start'), so this never blocks legit clicks.
// 5s window is long enough to catch network retries, short enough that
// a deliberate re-toggle later still works.
const clickDedup = new ActionDedup(5000);

async function cardClickHandler(data: unknown): Promise<object | undefined> {
  const d = data as {
    event_id?: string;
    action?: { value?: SelectorActionValue };
    operator?: { open_id?: string };
    context?: { open_message_id?: string };
  };

  const value = d.action?.value;
  const cardMessageId = d.context?.open_message_id;
  const clickerOpenId = d.operator?.open_id;
  if (!value?.action || !value.pendingId || !cardMessageId || !clickerOpenId) {
    console.warn('[feishu-worker] card click missing required fields', JSON.stringify(d).slice(0, 300));
    return undefined;
  }

  const actionKey = `${cardMessageId}:${clickerOpenId}:${JSON.stringify(value)}`;
  if (!clickDedup.shouldProcess(actionKey)) {
    console.log(
      `[feishu-worker] dedupe duplicate click action=${value.action} id=${value.id ?? ''} event_id=${d.event_id ?? '?'}`,
    );
    return undefined;
  }

  try {
    return await handleSelectorClick({
      pendingId: value.pendingId,
      action: value.action,
      toggleId: value.id,
      cardMessageId,
      clickerOpenId,
    });
  } catch (err) {
    console.error('[feishu-worker] selector click handler threw', err);
    return undefined;
  }
}

console.log(
  `[feishu-worker] started — appId=${APP_ID} advisors=${ADVISORS.length} kv=${isKvConfigured() ? 'on' : 'off'}`,
);

// Keep the process alive — WSClient already does this via its socket,
// but adding an explicit SIGTERM trap makes Railway / Fly.io stops clean.
process.on('SIGTERM', () => {
  console.log('[feishu-worker] SIGTERM — shutting down');
  process.exit(0);
});
process.on('SIGINT', () => {
  console.log('[feishu-worker] SIGINT — shutting down');
  process.exit(0);
});
