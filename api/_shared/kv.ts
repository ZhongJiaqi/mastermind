// ======================================================
// Tiny KV client targeting Vercel KV / Upstash Redis REST API.
//
// Why no SDK: the REST surface is 3 calls. A direct fetch keeps the
// edge bundle small and avoids dragging in @upstash/redis just for
// SET/GET/EXPIRE.
//
// Vercel KV / Upstash exposes these env vars:
//   - KV_REST_API_URL    e.g. https://xxx.upstash.io
//   - KV_REST_API_TOKEN  Bearer token
//
// If both are unset, kv* helpers throw KvNotConfiguredError so the
// caller can degrade gracefully (e.g. webhook still replies with a
// card minus the "看完整讨论" button instead of failing the request).
// ======================================================

function trim(value: string | undefined): string {
  return value?.trim() || '';
}

export class KvNotConfiguredError extends Error {
  constructor() {
    super('KV_REST_API_URL / KV_REST_API_TOKEN not configured');
    this.name = 'KvNotConfiguredError';
  }
}

export class KvError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'KvError';
  }
}

interface KvConfig {
  url: string;
  token: string;
}

function readConfig(): KvConfig {
  const url = trim(process.env.KV_REST_API_URL);
  const token = trim(process.env.KV_REST_API_TOKEN);
  if (!url || !token) throw new KvNotConfiguredError();
  return { url: url.replace(/\/+$/, ''), token };
}

export function isKvConfigured(): boolean {
  return Boolean(trim(process.env.KV_REST_API_URL) && trim(process.env.KV_REST_API_TOKEN));
}

interface UpstashResult<T> {
  result?: T;
  error?: string;
}

async function call<T>(command: (string | number)[]): Promise<T | null> {
  const { url, token } = readConfig();
  // Upstash supports POST with body = command array (preferred for
  // arbitrary-length values + UTF-8 safety).
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(command),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new KvError(`Upstash ${res.status}: ${text.slice(0, 300)}`, res.status);
  }
  let payload: UpstashResult<T>;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new KvError(`Upstash returned non-JSON: ${text.slice(0, 200)}`);
  }
  if (payload.error) throw new KvError(`Upstash error: ${payload.error}`);
  return payload.result ?? null;
}

export async function kvSetJson<T>(
  key: string,
  value: T,
  ttlSeconds?: number,
): Promise<void> {
  const json = JSON.stringify(value);
  if (ttlSeconds && ttlSeconds > 0) {
    await call(['SET', key, json, 'EX', ttlSeconds]);
  } else {
    await call(['SET', key, json]);
  }
}

export async function kvDelete(key: string): Promise<void> {
  await call(['DEL', key]);
}

export async function kvGetJson<T>(key: string): Promise<T | null> {
  const raw = await call<string | null>(['GET', key]);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new KvError(`Stored value for ${key} is not valid JSON`);
  }
}

// 8-char base62 share ID; collision probability for our volume is
// negligible (62^8 ≈ 2.2e14 keyspace).
const BASE62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function generateShareId(length = 8): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) out += BASE62[bytes[i] % 62];
  return out;
}
