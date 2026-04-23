import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/lib/sseClient', () => ({
  openSseStream: vi.fn(),
}));

const { openSseStream } = await import('../../src/lib/sseClient');
const { runMeeting } = await import('../../src/lib/orchestrator');

function asyncGen(events: any[]) {
  return (async function* () { for (const e of events) yield e; })();
}

describe('runMeeting', () => {
  it('calls advisors in order and then analyze', async () => {
    const calls: string[] = [];
    (openSseStream as any).mockImplementation((req: any) => {
      calls.push(req.url);
      if (req.url.startsWith('/api/advisor/')) {
        return asyncGen([
          { event: 'chunk', data: { text: 'reply' } },
          { event: 'done', data: { displayText: 'reply', fullText: 'reply', meta: { usedModels: [], modelBriefs: {} } } },
        ]);
      }
      return asyncGen([
        { event: 'card', data: { advisorId: 'munger', characterName: '芒格', conclusion: 'c', reasoning: 'r', mentalModels: [] } },
        { event: 'done', data: { cards: [] } },
      ]);
    });
    const cb = {
      onRoundStart: vi.fn(), onRoundChunk: vi.fn(), onRoundDone: vi.fn(), onRoundError: vi.fn(),
      onAnalysisStart: vi.fn(), onAnalysisCard: vi.fn(), onAnalysisDone: vi.fn(), onAnalysisError: vi.fn(),
    };
    await runMeeting({
      session: { input: { question: 'q' }, clarifications: [] },
      advisors: [{ id: 'munger', name: '芒格' }, { id: 'buffett', name: '巴菲特' }],
      cb,
    });
    expect(calls).toEqual(['/api/advisor/munger', '/api/advisor/buffett', '/api/analyze']);
    expect(cb.onRoundStart).toHaveBeenCalledTimes(2);
    expect(cb.onRoundDone).toHaveBeenCalledTimes(2);
    expect(cb.onAnalysisStart).toHaveBeenCalledTimes(1);
    expect(cb.onAnalysisCard).toHaveBeenCalledTimes(1);
    expect(cb.onAnalysisDone).toHaveBeenCalledTimes(1);
  });

  it('continues to analyze after an advisor errors', async () => {
    (openSseStream as any).mockImplementation((req: any) => {
      if (req.url === '/api/advisor/munger') return asyncGen([{ event: 'error', data: { message: 'oops' } }]);
      if (req.url.startsWith('/api/advisor/')) {
        return asyncGen([{ event: 'done', data: { displayText: 't', fullText: 't', meta: { usedModels: [], modelBriefs: {} } } }]);
      }
      return asyncGen([{ event: 'done', data: { cards: [] } }]);
    });
    const cb = {
      onRoundStart: vi.fn(), onRoundChunk: vi.fn(), onRoundDone: vi.fn(), onRoundError: vi.fn(),
      onAnalysisStart: vi.fn(), onAnalysisCard: vi.fn(), onAnalysisDone: vi.fn(), onAnalysisError: vi.fn(),
    };
    await runMeeting({
      session: { input: { question: 'q' }, clarifications: [] },
      advisors: [{ id: 'munger', name: '芒格' }, { id: 'buffett', name: '巴菲特' }],
      cb,
    });
    expect(cb.onRoundError).toHaveBeenCalledWith('munger', 'oops');
    expect(cb.onAnalysisStart).toHaveBeenCalled();
  });

  it('passes stripped prior rounds to subsequent advisor calls', async () => {
    const requests: any[] = [];
    (openSseStream as any).mockImplementation((req: any) => {
      requests.push(req);
      if (req.url.startsWith('/api/advisor/')) {
        return asyncGen([{ event: 'done', data: { displayText: 'clean-text', fullText: 'clean-text<meta>...</meta>', meta: { usedModels: [], modelBriefs: {} } } }]);
      }
      return asyncGen([{ event: 'done', data: { cards: [] } }]);
    });
    await runMeeting({
      session: { input: { question: 'q' }, clarifications: [] },
      advisors: [{ id: 'munger', name: '芒格' }, { id: 'buffett', name: '巴菲特' }],
      cb: {
        onRoundStart: vi.fn(), onRoundChunk: vi.fn(), onRoundDone: vi.fn(), onRoundError: vi.fn(),
        onAnalysisStart: vi.fn(), onAnalysisCard: vi.fn(), onAnalysisDone: vi.fn(), onAnalysisError: vi.fn(),
      },
    });
    const buffettReq = requests.find((r) => r.url === '/api/advisor/buffett');
    expect(buffettReq.body.priorRounds).toHaveLength(1);
    expect(buffettReq.body.priorRounds[0].content).toBe('clean-text');
    expect(buffettReq.body.priorRounds[0].content).not.toContain('<meta>');
  });
});
