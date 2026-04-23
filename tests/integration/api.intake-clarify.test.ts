import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('virtual:advisors', () => ({
  ADVISORS: [
    {
      frontmatter: {
        id: 'munger',
        name: '芒格',
        tagline: 't',
        avatarColor: 'oklch(1 0 0)',
        speakStyle: 's',
        version: '0.1',
      },
      mentalModels: [
        { name: 'a', method: 'x', tendency: 'x', signal: 'x' },
        { name: 'b', method: 'x', tendency: 'x', signal: 'x' },
        { name: 'c', method: 'x', tendency: 'x', signal: 'x' },
      ],
      quotes: '',
      blindspots: '',
      speakStyle: '',
      raw: '',
    },
  ],
}));

vi.mock('../../api/_shared/dashscope', () => ({
  createDashScope: vi.fn(),
  getDashScopeModels: () => ({ advisor: 'qwen3-plus', analyzer: 'qwen3-max', host: 'qwen3-plus' }),
}));

const { createDashScope } = await import('../../api/_shared/dashscope');
const handler = (await import('../../api/intake-clarify')).default;

describe('POST /api/intake-clarify', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns needsClarification=false when LLM says so', async () => {
    (createDashScope as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: '{"needsClarification": false}' } }],
          }),
        },
      },
    });
    const req = new Request('http://test/api/intake-clarify', {
      method: 'POST',
      body: JSON.stringify({ question: '今晚吃什么', selectedAdvisorIds: ['munger'] }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await handler(req);
    const body = await res.json();
    expect(body.needsClarification).toBe(false);
  });

  it('returns 400 when question is missing', async () => {
    const req = new Request('http://test/api/intake-clarify', {
      method: 'POST',
      body: JSON.stringify({ selectedAdvisorIds: ['munger'] }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await handler(req);
    expect(res.status).toBe(400);
  });
});
