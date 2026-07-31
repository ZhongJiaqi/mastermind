// ======================================================
// Feishu event subscription endpoint.
//
// Flow per inbound DM:
//   1. Decrypt payload (AES-256-CBC via FEISHU_ENCRYPT_KEY).
//   2. Verify token matches FEISHU_VERIFICATION_TOKEN.
//   3. If url_verification → echo challenge synchronously.
//   4. If im.message.receive_v1 + chat_type=p2p + user-sent text →
//      enqueue council work via ctx.waitUntil, ack {} within 3s.
//      Background: send "thinking" text → run council → store in
//      KV → send result card with "看完整讨论" link button.
//   5. Anything else (bot messages, group, non-text) → just 200 {}.
//
// Cold-start budget: Feishu enforces a 3s ack timeout, and edge cold
// start time is ~proportional to imported module surface area. So
// EVERYTHING heavy (OpenAI SDK, ADVISORS vault, parser, KV client,
// feishu send) is dynamic-imported inside processCouncilDm — they get
// loaded after we've already ack'd. The hot path here only needs the
// Web Crypto AES helper (~zero overhead).
// ======================================================

import { decryptFeishuEvent } from '../_shared/feishu/crypto';

export const config = { runtime: 'edge' };

// 90 days TTL on share blobs — plenty for "click the link later" use cases.
const SHARE_TTL_SECONDS = 60 * 60 * 24 * 90;

const ACK_OK = new Response(JSON.stringify({}), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
});

interface VercelCtx {
  waitUntil?: (p: Promise<unknown>) => void;
}

interface DecryptedEnvelope {
  schema?: string;
  header?: {
    token?: string;
    event_type?: string;
    event_id?: string;
  };
  // url_verification body fields live at top level on v2 challenge:
  type?: string;
  token?: string;
  challenge?: string;
  // im.message.receive_v1 body lives under `event`:
  event?: {
    sender?: {
      sender_id?: {
        open_id?: string;
        user_id?: string;
        union_id?: string;
      };
      sender_type?: string;
    };
    message?: {
      message_id?: string;
      chat_id?: string;
      chat_type?: string;
      message_type?: string;
      content?: string;
    };
  };
}

function trim(v: string | undefined): string {
  return v?.trim() || '';
}

function publicBaseUrl(): string {
  const explicit = trim(process.env.PUBLIC_BASE_URL);
  if (explicit) return explicit.replace(/\/+$/, '');
  return 'https://mastermind-gamma-weld.vercel.app';
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

// Strip leading @bot mention pieces if any leak through in DM (shouldn't
// happen in p2p but cheap to defend).
function stripBotMention(text: string): string {
  return text.replace(/^@_user_\d+\s*/, '').replace(/^@[一-龥\w·]+\s*/, '').trim();
}

async function processCouncilDm(senderOpenId: string, rawQuestion: string): Promise<void> {
  const question = stripBotMention(rawQuestion);
  if (!question) return;

  // Heavy modules — loaded AFTER ack so they never contribute to the 3s
  // cold-start budget that Feishu measures.
  const [
    advisorsMod,
    parserMod,
    runnerMod,
    sendMod,
    cardMod,
    kvMod,
  ] = await Promise.all([
    import('../../src/generated/advisors'),
    import('../../src/lib/councilParser'),
    import('../_shared/council-run'),
    import('../_shared/feishu/send'),
    import('../_shared/feishu/card'),
    import('../_shared/kv'),
  ]);
  const { isChainExhaustedError, notifyPoolExhausted, rememberOwnerOpenId } = await import(
    '../_shared/pool-alert'
  );
  // Self-learn the owner's openId so web-triggered pool alerts can reach
  // the user even though the web surface has no Feishu context.
  void rememberOwnerOpenId(senderOpenId);
  const { ADVISORS } = advisorsMod;
  const { parseCouncilStream } = parserMod;
  const { runCouncilOnce } = runnerMod;
  const { sendInteractiveCard, sendText } = sendMod;
  const { buildCouncilCard } = cardMod;
  const { generateShareId, isKvConfigured, kvSetJson, KvError } = kvMod;

  const advisorIds = ADVISORS.map((a) => a.frontmatter.id);
  const advisorNames = ADVISORS.map((a) => a.frontmatter.name);

  try {
    await sendText(
      senderOpenId,
      `📝 收到：${question}\n🧠 ${ADVISORS.length} 位军师召集中，约 30-60 秒……`,
    );
  } catch (err) {
    console.error('[feishu] pending-ack send failed', err);
  }

  let fullText = '';
  let modelUsed = 'unknown';
  try {
    const out = await runCouncilOnce({
      advisors: ADVISORS as unknown as Parameters<typeof runCouncilOnce>[0]['advisors'],
      session: { question },
    });
    fullText = out.fullText;
    modelUsed = out.modelUsed;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[feishu] council run failed', msg);
    if (isChainExhaustedError(err)) {
      // Pool dead is not a transient failure — send the actionable alert
      // card (throttled) instead of the generic "retry later" text.
      await notifyPoolExhausted(senderOpenId);
      await sendText(
        senderOpenId,
        '❌ 所有免费模型额度已用完，智囊团暂时无法开会。恢复方法见上方告警卡片。',
      ).catch(() => undefined);
      return;
    }
    await sendText(
      senderOpenId,
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
      console.error('[feishu] KV write failed, dropping share button', msg);
    }
  }

  const card = buildCouncilCard({
    question,
    advisorNames,
    cards: parsed.cards ?? [],
    discussionMessages: parsed.messages,
    shareUrl: shareUrl || publicBaseUrl(),
    modelUsed,
  });

  const send = await sendInteractiveCard(senderOpenId, card);
  if (!send.ok) {
    console.error('[feishu] result card send failed', send.status, send.body.slice(0, 300));
    await sendText(
      senderOpenId,
      `⚠️ 卡片发送失败（${send.status}）。给你纯文本版结论：\n\n${(parsed.cards ?? [])
        .map((c) => `· ${c.characterName}：${c.conclusion}`)
        .join('\n') || '（解析失败，无法展示）'}`,
    ).catch(() => undefined);
  }
}

export default async function handler(
  req: Request,
  ctx?: VercelCtx,
): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('feishu webhook expects POST', { status: 405 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return new Response('bad json', { status: 400 });
  }

  const envelope = raw as { encrypt?: string } & DecryptedEnvelope;

  // Decrypt — Feishu wraps v2 events in {encrypt: base64}. If absent, treat
  // top-level body as plaintext (degraded but valid when Encrypt Key off).
  let inner: DecryptedEnvelope;
  if (typeof envelope.encrypt === 'string' && envelope.encrypt) {
    const encryptKey = trim(process.env.FEISHU_ENCRYPT_KEY);
    if (!encryptKey) {
      console.error('[feishu] received encrypted payload but FEISHU_ENCRYPT_KEY unset');
      return new Response('encrypt key missing', { status: 500 });
    }
    try {
      const decryptedJson = await decryptFeishuEvent(envelope.encrypt, encryptKey);
      inner = JSON.parse(decryptedJson) as DecryptedEnvelope;
    } catch (err) {
      console.error('[feishu] decrypt failed', err);
      return new Response('decrypt failed', { status: 400 });
    }
  } else {
    inner = envelope as DecryptedEnvelope;
  }

  // Verification token: present in either inner.header.token (event v2)
  // or inner.token (url_verification challenge).
  const expectedToken = trim(process.env.FEISHU_VERIFICATION_TOKEN);
  const receivedToken = inner.header?.token || inner.token || '';
  if (expectedToken && expectedToken !== receivedToken) {
    console.error('[feishu] verification token mismatch');
    return new Response('verification failed', { status: 401 });
  }

  // URL verification challenge — echo back synchronously.
  if (inner.type === 'url_verification' || inner.header?.event_type === 'url_verification') {
    return new Response(JSON.stringify({ challenge: inner.challenge || '' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // im.message.receive_v1 → DM text → enqueue council
  if (inner.header?.event_type === 'im.message.receive_v1') {
    const ev = inner.event;
    const senderType = ev?.sender?.sender_type;
    const chatType = ev?.message?.chat_type;
    const messageType = ev?.message?.message_type;
    const openId = ev?.sender?.sender_id?.open_id;
    const content = ev?.message?.content;

    // Filter: DM only, user-sent text only, has open_id.
    if (
      senderType === 'user' &&
      chatType === 'p2p' &&
      messageType === 'text' &&
      openId
    ) {
      const text = parseTextMessageContent(content);
      if (text) {
        const work = processCouncilDm(openId, text);
        if (ctx?.waitUntil) {
          ctx.waitUntil(work);
        } else {
          // Dev (vite middleware) has no waitUntil — await inline so the
          // background work actually runs before the dev process moves on.
          await work.catch((err) => {
            console.error('[feishu] background work failed (dev fallback)', err);
          });
        }
      }
    }
    // Always 200 within 3s regardless of filtering.
    return ACK_OK;
  }

  // Other event types: ack and ignore.
  return ACK_OK;
}
