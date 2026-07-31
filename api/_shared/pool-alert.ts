// ======================================================
// Mastermind · pool-exhausted Lark DM alert
//
// When the whole LLM chain is quota-dead (LLM_CHAIN_EXHAUSTED from
// tryWithChain), the user wants a proactive Feishu DM — not just an
// error banner they might miss on the web surface.
//
// Recipient resolution, in order:
//   1. context openId  — DM paths (worker / webhook) already know the
//      sender; the alert doubles as the error reply's sibling
//   2. FEISHU_ALERT_OPEN_ID env — explicit override
//   3. KV 'alert:owner-open-id' — self-learned: every DM writes the
//      sender's openId via rememberOwnerOpenId, so web-triggered alerts
//      can reach the user once they've DM'd the bot at least once
//
// Throttle: at most one alert per 24h via a KV key with TTL. Everything
// is best-effort — an alert failure must never break the user request.
// ======================================================

import { sendInteractiveCard } from './feishu/send';
import { kvGetJson, kvSetJson } from './kv';

const THROTTLE_KEY = 'alert:pool-empty-notified';
const OWNER_KEY = 'alert:owner-open-id';
const THROTTLE_TTL_SECONDS = 24 * 3600;
const OWNER_TTL_SECONDS = 365 * 24 * 3600;

export function buildPoolExhaustedCard(): object {
  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: '🚨 Mastermind 告警 · LLM 模型池已耗尽' },
      template: 'red',
    },
    elements: [
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: [
            '**所有免费模型额度用完，智囊团暂时无法开会**',
            '',
            '- 恢复方法 1：阿里云控制台 → 模型广场 查看还有免费额度的模型，把模型名告诉 Claude 更新白名单和模型链',
            '- 恢复方法 2：换厂商或对现有模型充值',
            '- 更新位置：Vercel env `MODEL_ADVISOR` / `MODEL_SYNTHESIZER` / `MODEL_HOST` / `LLM_MODEL_CHAIN`',
            '- 本告警每天最多发送一次',
          ].join('\n'),
        },
      },
    ],
  };
}

async function resolveRecipient(contextOpenId?: string): Promise<string | null> {
  if (contextOpenId?.trim()) return contextOpenId.trim();
  const fromEnv = process.env.FEISHU_ALERT_OPEN_ID?.trim();
  if (fromEnv) return fromEnv;
  try {
    const owner = await kvGetJson<{ openId?: string }>(OWNER_KEY);
    if (owner?.openId) return owner.openId;
  } catch {
    // KV unreachable — fall through to null
  }
  return null;
}

export async function notifyPoolExhausted(contextOpenId?: string): Promise<void> {
  try {
    try {
      const throttled = await kvGetJson<{ at: number }>(THROTTLE_KEY);
      if (throttled) return;
    } catch {
      // KV unreachable — send anyway rather than risk a silent outage
    }

    const recipient = await resolveRecipient(contextOpenId);
    if (!recipient) {
      console.warn('[pool-alert] no recipient resolvable (no context/env/KV openId), skipping');
      return;
    }

    const result = await sendInteractiveCard(recipient, buildPoolExhaustedCard());
    if (!result.ok) {
      console.error('[pool-alert] send failed', result.status, result.body.slice(0, 200));
      return;
    }
    console.log('[pool-alert] pool-exhausted alert sent');

    await kvSetJson(THROTTLE_KEY, { at: Date.now() }, THROTTLE_TTL_SECONDS).catch(() => undefined);
  } catch (err) {
    console.error('[pool-alert] alert path failed', err instanceof Error ? err.message : err);
  }
}

// Called on every DM so web-triggered alerts know who to reach.
export async function rememberOwnerOpenId(openId: string): Promise<void> {
  if (!openId?.trim()) return;
  try {
    await kvSetJson(OWNER_KEY, { openId: openId.trim() }, OWNER_TTL_SECONDS);
  } catch {
    // best-effort
  }
}

// Shared predicate for callers deciding whether an error is "pool dead".
export function isChainExhaustedError(err: unknown): boolean {
  return Boolean(
    err &&
      typeof err === 'object' &&
      (err as { code?: string }).code === 'LLM_CHAIN_EXHAUSTED',
  );
}
