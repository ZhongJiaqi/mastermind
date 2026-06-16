import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  generateShareId,
  isKvConfigured,
  KvNotConfiguredError,
  kvGetJson,
  kvSetJson,
} from '../../api/_shared/kv';

describe('generateShareId', () => {
  it('returns base62 strings of the requested length', () => {
    for (let i = 0; i < 50; i++) {
      const id = generateShareId(8);
      expect(id).toMatch(/^[A-Za-z0-9]{8}$/);
    }
  });

  it('respects custom length', () => {
    expect(generateShareId(12)).toMatch(/^[A-Za-z0-9]{12}$/);
  });

  it('does not collide on a small sample (statistical sanity)', () => {
    const set = new Set<string>();
    for (let i = 0; i < 1000; i++) set.add(generateShareId(8));
    expect(set.size).toBe(1000);
  });
});

describe('isKvConfigured', () => {
  beforeEach(() => vi.unstubAllEnvs());

  it('false when both vars missing', () => {
    vi.stubEnv('KV_REST_API_URL', '');
    vi.stubEnv('KV_REST_API_TOKEN', '');
    expect(isKvConfigured()).toBe(false);
  });

  it('false when only one var set', () => {
    vi.stubEnv('KV_REST_API_URL', 'https://example.com');
    vi.stubEnv('KV_REST_API_TOKEN', '');
    expect(isKvConfigured()).toBe(false);
  });

  it('true when both vars set', () => {
    vi.stubEnv('KV_REST_API_URL', 'https://example.com');
    vi.stubEnv('KV_REST_API_TOKEN', 'tkn');
    expect(isKvConfigured()).toBe(true);
  });
});

describe('kvSetJson / kvGetJson', () => {
  beforeEach(() => vi.unstubAllEnvs());

  it('throws KvNotConfiguredError when env not set', async () => {
    vi.stubEnv('KV_REST_API_URL', '');
    vi.stubEnv('KV_REST_API_TOKEN', '');
    await expect(kvSetJson('k', { a: 1 })).rejects.toBeInstanceOf(KvNotConfiguredError);
    await expect(kvGetJson('k')).rejects.toBeInstanceOf(KvNotConfiguredError);
  });

  it('issues a SET command with TTL when configured', async () => {
    vi.stubEnv('KV_REST_API_URL', 'https://example.com');
    vi.stubEnv('KV_REST_API_TOKEN', 'tkn');
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ result: 'OK' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await kvSetJson('foo', { x: 1 }, 60);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body as string)).toEqual(['SET', 'foo', '{"x":1}', 'EX', 60]);
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tkn');
  });

  it('GET parses JSON-stored value', async () => {
    vi.stubEnv('KV_REST_API_URL', 'https://example.com');
    vi.stubEnv('KV_REST_API_TOKEN', 'tkn');
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ result: '{"x":42}' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const out = await kvGetJson<{ x: number }>('foo');
    expect(out).toEqual({ x: 42 });
  });

  it('GET returns null when key missing', async () => {
    vi.stubEnv('KV_REST_API_URL', 'https://example.com');
    vi.stubEnv('KV_REST_API_TOKEN', 'tkn');
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ result: null }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    expect(await kvGetJson('missing')).toBeNull();
  });
});
