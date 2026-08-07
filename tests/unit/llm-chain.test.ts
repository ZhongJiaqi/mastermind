import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  resolveChain,
  isQuotaExhaustionError,
  tryWithChain,
  isExhaustedInProcess,
  markExhaustedInProcess,
  _resetExhaustedForTests,
} from '../../api/_shared/llm-chain';

interface HttpishError extends Error {
  status?: number;
}

function httpError(status: number, message: string): HttpishError {
  const e = new Error(message) as HttpishError;
  e.status = status;
  return e;
}

describe('resolveChain', () => {
  beforeEach(() => vi.unstubAllEnvs());

  it('uses the built-in fallback when LLM_MODEL_CHAIN is unset', () => {
    vi.stubEnv('LLM_MODEL_CHAIN', '');
    expect(resolveChain('deepseek-v4-flash-0731')).toEqual([
      'deepseek-v4-flash-0731',
      'qwen3.8-max',
    ]);
  });

  it('puts primary first, dedupes, preserves env order', () => {
    vi.stubEnv('LLM_MODEL_CHAIN', 'deepseek-v4-pro, qwen3.6-max-preview, qwen3.5-plus');
    expect(resolveChain('qwen3.6-max-preview')).toEqual([
      'qwen3.6-max-preview',
      'deepseek-v4-pro',
      'qwen3.5-plus',
    ]);
  });

  it('uses default primary when caller passes empty string', () => {
    vi.stubEnv('LLM_MODEL_CHAIN', 'qwen3.8-max');
    expect(resolveChain('')).toEqual(['deepseek-v4-flash-0731', 'qwen3.8-max']);
  });

  it('trims and drops blank chain entries', () => {
    vi.stubEnv('LLM_MODEL_CHAIN', '  deepseek-v4-pro  ,  ,  qwen3.5-plus  ');
    expect(resolveChain('qwen3.6-max-preview')).toEqual([
      'qwen3.6-max-preview',
      'deepseek-v4-pro',
      'qwen3.5-plus',
    ]);
  });
});

describe('isQuotaExhaustionError', () => {
  it('flags 429', () => {
    expect(isQuotaExhaustionError(httpError(429, 'too many requests'))).toBe(true);
  });

  it('flags 403 + FreeTierOnly', () => {
    expect(isQuotaExhaustionError(httpError(403, 'FreeTierOnly: out of quota'))).toBe(true);
  });

  it('flags 403 + AllocationQuota', () => {
    expect(isQuotaExhaustionError(httpError(403, 'AllocationQuota exhausted'))).toBe(true);
  });

  it('does NOT flag plain 403 (bad key)', () => {
    expect(isQuotaExhaustionError(httpError(403, 'Forbidden'))).toBe(false);
  });

  it('does NOT flag 500', () => {
    expect(isQuotaExhaustionError(httpError(500, 'server error'))).toBe(false);
  });

  it('does NOT flag non-error inputs', () => {
    expect(isQuotaExhaustionError(null)).toBe(false);
    expect(isQuotaExhaustionError('boom')).toBe(false);
  });
});

describe('in-process exhaustion cache', () => {
  beforeEach(() => _resetExhaustedForTests());

  it('marks model exhausted until next UTC midnight by default', () => {
    markExhaustedInProcess('qwen3.6-max-preview');
    expect(isExhaustedInProcess('qwen3.6-max-preview')).toBe(true);
  });

  it('clears entry once the until-timestamp has passed', () => {
    markExhaustedInProcess('m', Date.now() - 1);
    expect(isExhaustedInProcess('m')).toBe(false);
  });

  it('does not poison unrelated models', () => {
    markExhaustedInProcess('qwen3.6-max-preview');
    expect(isExhaustedInProcess('deepseek-v4-pro')).toBe(false);
  });
});

describe('tryWithChain', () => {
  beforeEach(() => {
    _resetExhaustedForTests();
    vi.unstubAllEnvs();
  });
  afterEach(() => vi.useRealTimers());

  it('returns the first model on success without calling later ones', async () => {
    vi.stubEnv('LLM_MODEL_CHAIN', 'deepseek-v4-pro');
    const factory = vi.fn(async (model: string) => `ok:${model}`);
    const out = await tryWithChain(
      { taskName: 't', timeoutMs: 1000 },
      'qwen3.6-max-preview',
      factory,
    );
    expect(out).toEqual({ modelUsed: 'qwen3.6-max-preview', result: 'ok:qwen3.6-max-preview' });
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('falls through to next model on quota error and marks exhausted', async () => {
    vi.stubEnv('LLM_MODEL_CHAIN', 'deepseek-v4-pro');
    const factory = vi.fn(async (model: string) => {
      if (model === 'qwen3.6-max-preview') {
        throw httpError(403, 'FreeTierOnly quota exhausted');
      }
      return `ok:${model}`;
    });
    const out = await tryWithChain(
      { taskName: 't', timeoutMs: 1000 },
      'qwen3.6-max-preview',
      factory,
    );
    expect(out.modelUsed).toBe('deepseek-v4-pro');
    expect(out.result).toBe('ok:deepseek-v4-pro');
    expect(isExhaustedInProcess('qwen3.6-max-preview')).toBe(true);
  });

  it('falls through when a model returns an empty body and marks it exhausted', async () => {
    vi.stubEnv('LLM_MODEL_CHAIN', 'qwen3.8-max');
    const factory = vi.fn(async (model: string) => {
      if (model === 'deepseek-v4-flash-0731') {
        throw new Error('LLM returned empty content');
      }
      return `ok:${model}`;
    });
    const out = await tryWithChain(
      { taskName: 't', timeoutMs: 1000 },
      'deepseek-v4-flash-0731',
      factory,
    );
    expect(out).toEqual({ modelUsed: 'qwen3.8-max', result: 'ok:qwen3.8-max' });
    expect(isExhaustedInProcess('deepseek-v4-flash-0731')).toBe(true);
  });

  it('skips models already marked exhausted in-process', async () => {
    vi.stubEnv('LLM_MODEL_CHAIN', 'deepseek-v4-pro');
    markExhaustedInProcess('qwen3.6-max-preview');
    const factory = vi.fn(async (model: string) => `ok:${model}`);
    const out = await tryWithChain(
      { taskName: 't', timeoutMs: 1000 },
      'qwen3.6-max-preview',
      factory,
    );
    expect(out.modelUsed).toBe('deepseek-v4-pro');
    expect(factory).toHaveBeenCalledTimes(1);
    expect(factory).toHaveBeenCalledWith('deepseek-v4-pro', expect.any(AbortSignal));
  });

  it('bubbles non-quota errors immediately (does NOT fall through)', async () => {
    vi.stubEnv('LLM_MODEL_CHAIN', 'deepseek-v4-pro');
    const factory = vi.fn(async () => {
      throw httpError(401, 'Unauthorized');
    });
    await expect(
      tryWithChain({ taskName: 't', timeoutMs: 1000 }, 'qwen3.6-max-preview', factory),
    ).rejects.toMatchObject({ status: 401 });
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('throws LLM_CHAIN_EXHAUSTED when every model is out of quota', async () => {
    vi.stubEnv('LLM_MODEL_CHAIN', 'deepseek-v4-pro');
    const factory = vi.fn(async () => {
      throw httpError(429, 'too many requests');
    });
    await expect(
      tryWithChain({ taskName: 't', timeoutMs: 1000 }, 'qwen3.6-max-preview', factory),
    ).rejects.toMatchObject({ code: 'LLM_CHAIN_EXHAUSTED' });
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('falls through to next model on per-call timeout (AbortError)', async () => {
    vi.stubEnv('LLM_MODEL_CHAIN', 'deepseek-v4-pro');
    const factory = vi.fn(async (model: string, signal: AbortSignal) => {
      if (model === 'qwen3.6-max-preview') {
        // Simulate fetch never returning before signal aborts.
        await new Promise<void>((_, reject) => {
          signal.addEventListener('abort', () => {
            const e = new Error('aborted') as Error & { name: string };
            e.name = 'AbortError';
            reject(e);
          });
        });
        throw new Error('unreachable');
      }
      return `ok:${model}`;
    });
    const out = await tryWithChain(
      { taskName: 't', timeoutMs: 20 },
      'qwen3.6-max-preview',
      factory,
    );
    expect(out.modelUsed).toBe('deepseek-v4-pro');
  });

  it('retries transient 5xx within a single model before falling through', async () => {
    vi.stubEnv('LLM_MODEL_CHAIN', 'deepseek-v4-pro');
    let calls = 0;
    const factory = vi.fn(async (model: string) => {
      if (model === 'qwen3.6-max-preview') {
        calls++;
        if (calls < 2) throw httpError(503, 'unavailable');
        return 'ok:qwen3.6-max-preview';
      }
      return `ok:${model}`;
    });
    const out = await tryWithChain(
      { taskName: 't', timeoutMs: 5000 },
      'qwen3.6-max-preview',
      factory,
    );
    expect(out.modelUsed).toBe('qwen3.6-max-preview');
    expect(calls).toBe(2);
  }, 10_000);
});
