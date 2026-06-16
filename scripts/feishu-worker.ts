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
import { buildCouncilCard, buildStreamingCard } from '../api/_shared/feishu/card';
import {
  generateShareId,
  isKvConfigured,
  kvSetJson,
  KvError,
} from '../api/_shared/kv';

const SHARE_TTL_SECONDS = 60 * 60 * 24 * 90;

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
  // entire card content (interactive msg_type only). Rate-limited per
  // message, but our 2s throttle puts us well under any documented cap.
  await client.im.v1.message.patch({
    path: { message_id: messageId },
    data: { content: JSON.stringify(card) },
  });
}

// Throttle interval between patches — short enough for the discussion
// to feel live, long enough to leave headroom under Feishu's per-message
// patch rate limits.
const PATCH_INTERVAL_MS = 2000;

async function processCouncilDm(openId: string, rawQuestion: string): Promise<void> {
  const question = stripBotMention(rawQuestion);
  if (!question) return;

  const advisorIds = ADVISORS.map((a) => a.frontmatter.id);
  const advisorNames = ADVISORS.map((a) => a.frontmatter.name);

  // Send a "thinking" card and capture its message_id so we can patch it.
  let messageId: string | undefined;
  try {
    messageId = await sendCard(
      openId,
      buildStreamingCard({
        question,
        advisorCount: ADVISORS.length,
        messages: [],
        done: false,
      }),
    );
  } catch (err) {
    console.error('[feishu-worker] initial card send failed', err);
    // Fall back to plain text so the user at least sees we received the message.
    await sendText(openId, `📝 收到：${question}\n🧠 召集中……`).catch(() => undefined);
  }

  // Open the LLM stream and drain it while throttle-patching the card.
  let fullText = '';
  let modelUsed = 'unknown';
  let lastPatchAt = 0;
  let lastPatchedMessageCount = -1;

  try {
    const { stream, modelUsed: m } = await openCouncilStream({
      advisors: ADVISORS as unknown as Parameters<typeof openCouncilStream>[0]['advisors'],
      session: { question },
    });
    modelUsed = m;

    for await (const chunk of stream) {
      const text = chunk.choices?.[0]?.delta?.content ?? '';
      if (!text) continue;
      fullText += text;

      if (!messageId) continue;
      const now = Date.now();
      if (now - lastPatchAt < PATCH_INTERVAL_MS) continue;

      const parsed = parseCouncilStream(fullText);
      if (parsed.messages.length === lastPatchedMessageCount) continue;
      lastPatchedMessageCount = parsed.messages.length;
      lastPatchAt = now;

      const intermediateCard = buildStreamingCard({
        question,
        advisorCount: ADVISORS.length,
        messages: parsed.messages,
        done: false,
        modelUsed,
      });
      // Fire-and-forget so a slow patch doesn't stall stream consumption —
      // any one failed patch is harmless; the next interval retries with
      // the latest text.
      patchCard(messageId, intermediateCard).catch((err) => {
        console.warn('[feishu-worker] intermediate patch failed', err);
      });
    }
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

  if (messageId) {
    try {
      await patchCard(messageId, finalCard);
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
        return;
      }
      if (inflight.has(messageId)) {
        console.log(`[feishu-worker] dedupe ${messageId} (already in-flight)`);
        return;
      }
      inflight.add(messageId);
      try {
        const text = parseTextMessageContent(d.message.content);
        if (text) await processCouncilDm(openId, text);
      } finally {
        // Hold the dedupe entry for 5 minutes — long enough that SDK
        // retries can't double-fire, short enough that Set can't grow
        // unbounded over the worker's uptime.
        setTimeout(() => inflight.delete(messageId), 5 * 60 * 1000);
      }
    },
  }),
});

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
