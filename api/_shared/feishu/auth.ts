// ======================================================
// Feishu tenant_access_token — single in-process cache.
//
// Tokens expire after `expire` seconds returned by the API (typically
// 7200). Vercel edge function instances are warm for ~10min, so a
// cache hit on the second request inside the same instance saves ~80ms.
// On cold start we just re-fetch; no DB needed.
// ======================================================

const FEISHU_BASE_URL = 'https://open.feishu.cn/open-apis';
// Refresh slightly before expiry so concurrent calls don't race expiration.
const REFRESH_MARGIN_MS = 60_000;

interface CachedToken {
  token: string;
  expiresAt: number;
}

let cached: CachedToken | null = null;

function trimOrEmpty(value: string | undefined): string {
  return value?.trim() || '';
}

export class FeishuAuthError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'FeishuAuthError';
  }
}

export async function getTenantAccessToken(now: number = Date.now()): Promise<string> {
  if (cached && cached.expiresAt - REFRESH_MARGIN_MS > now) {
    return cached.token;
  }

  const appId = trimOrEmpty(process.env.FEISHU_APP_ID);
  const appSecret = trimOrEmpty(process.env.FEISHU_APP_SECRET);
  if (!appId || !appSecret) {
    throw new FeishuAuthError('FEISHU_APP_ID / FEISHU_APP_SECRET not configured');
  }

  const res = await fetch(`${FEISHU_BASE_URL}/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new FeishuAuthError(`tenant_access_token http ${res.status}: ${text.slice(0, 300)}`, res.status);
  }

  let payload: { code?: number; msg?: string; tenant_access_token?: string; expire?: number };
  try {
    payload = JSON.parse(text);
  } catch {
    throw new FeishuAuthError(`tenant_access_token returned non-JSON: ${text.slice(0, 200)}`);
  }

  if (payload.code !== 0 || !payload.tenant_access_token) {
    throw new FeishuAuthError(
      `tenant_access_token code=${payload.code} msg=${payload.msg ?? 'unknown'}`,
    );
  }

  const expireSec = typeof payload.expire === 'number' && payload.expire > 0 ? payload.expire : 7200;
  cached = {
    token: payload.tenant_access_token,
    expiresAt: now + expireSec * 1000,
  };
  return cached.token;
}

// Test-only — never called from request path.
export function _resetTokenCacheForTests(): void {
  cached = null;
}

export { FEISHU_BASE_URL };
