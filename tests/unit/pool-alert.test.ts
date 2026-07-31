import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/api/_shared/feishu/send', () => ({
  sendInteractiveCard: vi.fn(async () => ({ ok: true, status: 200, body: '{"code":0}' })),
}));
vi.mock('@/api/_shared/kv', () => ({
  kvGetJson: vi.fn(async () => null),
  kvSetJson: vi.fn(async () => undefined),
  KvError: class KvError extends Error {},
}));

import { sendInteractiveCard } from '@/api/_shared/feishu/send';
import { kvGetJson, kvSetJson } from '@/api/_shared/kv';
import {
  buildPoolExhaustedCard,
  notifyPoolExhausted,
  rememberOwnerOpenId,
} from '@/api/_shared/pool-alert';

const mockSend = vi.mocked(sendInteractiveCard);
const mockGet = vi.mocked(kvGetJson);
const mockSet = vi.mocked(kvSetJson);

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  mockGet.mockResolvedValue(null);
});

describe('buildPoolExhaustedCard', () => {
  it('is a red interactive card identifying Mastermind with recovery hints', () => {
    const card = buildPoolExhaustedCard() as any;
    expect(card.header.template).toBe('red');
    expect(card.header.title.content).toContain('Mastermind');
    expect(card.header.title.content).toContain('告警');
    const body = JSON.stringify(card.elements);
    expect(body).toContain('模型');
    expect(body).toContain('白名单');
  });
});

describe('notifyPoolExhausted', () => {
  it('sends the card to the context openId and writes the throttle key', async () => {
    await notifyPoolExhausted('ou_ctx123');
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0]).toBe('ou_ctx123');
    expect(mockSet).toHaveBeenCalledWith(
      'alert:pool-empty-notified',
      expect.anything(),
      expect.any(Number),
    );
  });

  it('skips sending when the throttle key exists', async () => {
    mockGet.mockImplementation(async (key: string) =>
      key === 'alert:pool-empty-notified' ? ({ at: 1 } as any) : null,
    );
    await notifyPoolExhausted('ou_ctx123');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('falls back to FEISHU_ALERT_OPEN_ID env when no context openId', async () => {
    vi.stubEnv('FEISHU_ALERT_OPEN_ID', 'ou_env456');
    await notifyPoolExhausted(undefined);
    expect(mockSend.mock.calls[0][0]).toBe('ou_env456');
  });

  it('falls back to the KV-remembered owner when no context and no env', async () => {
    mockGet.mockImplementation(async (key: string) =>
      key === 'alert:owner-open-id' ? ({ openId: 'ou_kv789' } as any) : null,
    );
    await notifyPoolExhausted(undefined);
    expect(mockSend.mock.calls[0][0]).toBe('ou_kv789');
  });

  it('does nothing (and does not throw) when no recipient can be resolved', async () => {
    await expect(notifyPoolExhausted(undefined)).resolves.toBeUndefined();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('never throws even when KV and send both fail', async () => {
    mockGet.mockRejectedValue(new Error('kv down'));
    mockSend.mockRejectedValue(new Error('feishu down'));
    await expect(notifyPoolExhausted('ou_ctx123')).resolves.toBeUndefined();
  });
});

describe('rememberOwnerOpenId', () => {
  it('persists the openId under the owner key, best-effort', async () => {
    await rememberOwnerOpenId('ou_owner1');
    expect(mockSet).toHaveBeenCalledWith(
      'alert:owner-open-id',
      { openId: 'ou_owner1' },
      expect.any(Number),
    );
  });

  it('swallows KV failures', async () => {
    mockSet.mockRejectedValue(new Error('kv down'));
    await expect(rememberOwnerOpenId('ou_owner1')).resolves.toBeUndefined();
  });
});
