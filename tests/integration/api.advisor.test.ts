import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/generated/advisors', () => ({
  ADVISORS: [{
    frontmatter: { id: 'munger', name: '芒格', tagline: 't', avatarColor: 'oklch(1 0 0)', speakStyle: 's', version: '0.1' },
    mentalModels: [
      { name: '逆向思考', method: 'm', tendency: 't', signal: 's' },
      { name: '能力圈', method: 'm', tendency: 't', signal: 's' },
      { name: '误判心理学', method: 'm', tendency: 't', signal: 's' },
    ],
    quotes: 'q', blindspots: 'b', speakStyle: 's', raw: '',
  }],
}));

vi.mock('../../api/_shared/dashscope', () => ({
  createDashScope: () => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          [Symbol.asyncIterator]: async function* () {
            yield { choices: [{ delta: { content: 'hello ' } }] };
            yield { choices: [{ delta: { content: 'world' } }] };
          },
        }),
      },
    },
  }),
  getDashScopeModels: () => ({ advisor: 'qwen3-plus', analyzer: 'qwen3-max', host: 'qwen3-plus' }),
}));

const handler = (await import('../../api/advisor/[id]')).default;

describe('POST /api/advisor/[id]', () => {
  it('returns 404 for unknown advisor', async () => {
    const req = new Request('http://test/api/advisor/unknown', {
      method: 'POST',
      body: JSON.stringify({ session: { question: 'q' }, priorRounds: [] }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await handler(req, { params: { id: 'unknown' } });
    expect(res.status).toBe(404);
  });

  it('streams chunks + done event', async () => {
    const req = new Request('http://test/api/advisor/munger', {
      method: 'POST',
      body: JSON.stringify({ session: { question: 'q' }, priorRounds: [] }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await handler(req, { params: { id: 'munger' } });
    expect(res.headers.get('Content-Type')).toContain('text/event-stream');
    const text = await res.text();
    expect(text).toContain('event: chunk');
    expect(text).toContain('event: done');
    expect(text).toContain('hello');
    expect(text).toContain('world');
  });
});
