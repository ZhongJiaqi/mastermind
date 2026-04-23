import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/generated/advisors', () => ({
  ADVISORS: [
    {
      frontmatter: { id: 'munger', name: '查理·芒格', tagline: 't', avatarColor: 'oklch(1 0 0)', speakStyle: 's', version: '0.1' },
      mentalModels: [{ name: '逆向思考', method: 'm', tendency: 't', signal: 's' }],
      quotes: '', blindspots: '', speakStyle: '',
    },
  ],
}));

vi.mock('../../api/_shared/dashscope', () => ({
  createDashScope: () => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          [Symbol.asyncIterator]: async function* () {
            yield { choices: [{ delta: { content: '<discussion>\n查理·芒格: 反过来想\n</discussion>\n\n<conclusions>\n[{"advisorId":"munger","characterName":"查理·芒格","conclusion":"不换","reasoning":"r","mentalModels":[{"name":"逆向思考","briefOfUsage":"b"}]}]\n</conclusions>' } }] };
          },
        }),
      },
    },
  }),
  getDashScopeModels: () => ({ advisor: 'qwen3-max', analyzer: 'qwen3-max', host: 'qwen3-max' }),
}));

const handler = (await import('../../api/council')).default;

describe('POST /api/council', () => {
  it('returns 400 when selectedAdvisorIds missing', async () => {
    const req = new Request('http://test/api/council', {
      method: 'POST',
      body: JSON.stringify({ session: { question: 'q' } }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await handler(req);
    expect(res.status).toBe(400);
  });

  it('returns 404 when no known advisors in selection', async () => {
    const req = new Request('http://test/api/council', {
      method: 'POST',
      body: JSON.stringify({
        session: { question: 'q' },
        selectedAdvisorIds: ['nonexistent-advisor'],
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await handler(req);
    expect(res.status).toBe(404);
  });

  it('streams chunk + done events with full LLM text', async () => {
    const req = new Request('http://test/api/council', {
      method: 'POST',
      body: JSON.stringify({
        session: { question: '该不该换工作' },
        selectedAdvisorIds: ['munger'],
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await handler(req);
    expect(res.headers.get('Content-Type')).toContain('text/event-stream');
    const text = await res.text();
    expect(text).toContain('event: chunk');
    expect(text).toContain('event: done');
    expect(text).toContain('<discussion>');
    expect(text).toContain('<conclusions>');
    expect(text).toContain('查理·芒格');
  });
});
