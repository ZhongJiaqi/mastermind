import { describe, expect, it } from 'vitest';
import { toFriendly } from '../../src/components/ErrorBanner';

describe('toFriendly', () => {
  it('returns raw message as fallback when no friendly mapping matches', () => {
    expect(toFriendly('some unknown internal error')).toEqual({
      title: 'some unknown internal error',
    });
  });

  it('maps DASHSCOPE_API_KEY error to friendly title + hint', () => {
    const r = toFriendly('DASHSCOPE_API_KEY is not configured');
    expect(r.title).toBe('服务暂时不可用');
    expect(r.hint).toContain('请联系管理员');
  });

  it('maps "API key missing" generic phrasing too', () => {
    expect(toFriendly('API key not configured').title).toBe('服务暂时不可用');
  });

  it('maps quota exhausted error to friendly title', () => {
    expect(toFriendly('The free tier of the model has been exhausted').title).toBe(
      '模型额度已耗尽',
    );
    expect(toFriendly('额度已用完').title).toBe('模型额度已耗尽');
  });

  it('maps timeout error to friendly title with hint', () => {
    const r = toFriendly('Request timeout after 60s');
    expect(r.title).toBe('请求超时');
    expect(r.hint).toContain('简化问题或减少军师');
  });

  it('maps timed out variant', () => {
    expect(toFriendly('connection timed out').title).toBe('请求超时');
  });

  it('maps network errors', () => {
    expect(toFriendly('Failed to fetch').title).toBe('网络异常');
    expect(toFriendly('Network error').title).toBe('网络异常');
  });

  it('maps JSON parse errors', () => {
    expect(toFriendly('Invalid JSON in response').title).toBe('军师返回格式异常');
    expect(toFriendly('Failed to parse output').title).toBe('军师返回格式异常');
  });
});
