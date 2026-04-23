import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createDashScope, getDashScopeModels } from '../../api/_shared/dashscope';

describe('createDashScope', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns an OpenAI client pointed at DashScope base URL', () => {
    vi.stubEnv('DASHSCOPE_API_KEY', 'sk-test');
    vi.stubEnv('DASHSCOPE_BASE_URL', 'https://dashscope.aliyuncs.com/compatible-mode/v1');
    const client = createDashScope();
    expect(client).toBeDefined();
    expect((client as any).baseURL).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1');
  });

  it('throws when DASHSCOPE_API_KEY is not set', () => {
    vi.stubEnv('DASHSCOPE_API_KEY', '');
    expect(() => createDashScope()).toThrow(/DASHSCOPE_API_KEY/);
  });
});

describe('getDashScopeModels', () => {
  it('returns env-configured model ids with defaults', () => {
    vi.stubEnv('MODEL_ADVISOR', 'qwen3-plus');
    vi.stubEnv('MODEL_SYNTHESIZER', 'qwen3-max');
    vi.stubEnv('MODEL_HOST', 'qwen3-plus');
    const models = getDashScopeModels();
    expect(models.advisor).toBe('qwen3-plus');
    expect(models.analyzer).toBe('qwen3-max');
    expect(models.host).toBe('qwen3-plus');
  });

  it('falls back to defaults when env not set', () => {
    vi.unstubAllEnvs();
    const models = getDashScopeModels();
    expect(models.advisor).toBe('qwen3-plus');
    expect(models.analyzer).toBe('qwen3-max');
    expect(models.host).toBe('qwen3-plus');
  });
});
