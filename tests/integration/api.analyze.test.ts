import { describe, expect, it, vi } from 'vitest';

vi.mock('virtual:advisors', () => ({
  ADVISORS: [{
    frontmatter: { id: 'munger', name: '芒格', tagline: 't', avatarColor: 'oklch(1 0 0)', speakStyle: 's', version: '0.1' },
    mentalModels: [
      { name: '逆向思考', method: 'm', tendency: 't', signal: 's' },
      { name: '能力圈', method: 'm', tendency: 't', signal: 's' },
      { name: '误判心理学', method: 'm', tendency: 't', signal: 's' },
    ],
    quotes: '', blindspots: '', speakStyle: '', raw: '',
  }],
}));

vi.mock('../../api/_shared/dashscope', () => ({
  createDashScope: () => ({
    chat: { completions: { create: vi.fn().mockResolvedValue({
      [Symbol.asyncIterator]: async function* () {
        yield { choices: [{ delta: { content: '[{"advisorId":"munger","characterName":"芒格","conclusion":"不跳","reasoning":"略","mentalModels":[]}]' } }] };
      },
    }) } },
  }),
  getDashScopeModels: () => ({ advisor: 'qwen3-plus', analyzer: 'qwen3-max', host: 'qwen3-plus' }),
}));

const handler = (await import('../../api/analyze')).default;

describe('POST /api/analyze', () => {
  it('returns 400 when rounds is empty', async () => {
    const req = new Request('http://test/api/analyze', {
      method: 'POST',
      body: JSON.stringify({ session: { question: 'q' }, rounds: [] }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await handler(req);
    expect(res.status).toBe(400);
  });

  it('streams card + done events from LLM JSON response', async () => {
    const req = new Request('http://test/api/analyze', {
      method: 'POST',
      body: JSON.stringify({
        session: { question: 'q' },
        rounds: [{
          advisorId: 'munger', advisorName: '芒格', content: 'x',
          meta: { usedModels: ['逆向思考'], modelBriefs: { '逆向思考': 'brief' } },
        }],
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await handler(req);
    expect(res.headers.get('Content-Type')).toContain('text/event-stream');
    const text = await res.text();
    expect(text).toContain('event: card');
    expect(text).toContain('event: done');
    expect(text).toContain('芒格');
    expect(text).toContain('不跳');
  });
});
