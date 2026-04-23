import { openSseStream } from './sseClient';
import { stripMetaBlock, parseMetaBlock } from './meta';
import type { AdvisorRound, DecisionCard, DecisionSessionInput, Clarification } from '../types/session';

export interface OrchestratorCallbacks {
  onRoundStart: (advisorId: string) => void;
  onRoundChunk: (advisorId: string, text: string) => void;
  onRoundDone: (advisorId: string, payload: { displayText: string; fullText: string; meta: AdvisorRound['meta'] }) => void;
  onRoundError: (advisorId: string, error: string) => void;
  onAnalysisStart: () => void;
  onAnalysisCard: (card: DecisionCard) => void;
  onAnalysisDone: () => void;
  onAnalysisError: (error: string) => void;
}

export interface OrchestrateParams {
  session: { input: DecisionSessionInput; clarifications: Clarification[] };
  advisors: Array<{ id: string; name: string }>;
  cb: OrchestratorCallbacks;
  signal?: AbortSignal;
}

interface PriorRound {
  advisorId: string;
  advisorName: string;
  content: string;
  meta: AdvisorRound['meta'];
}

// SSE 事件 payload 的 discriminated union —— 避免在消费端到处 any。
type AdvisorSseEvent =
  | { event: 'chunk'; data: { text: string } }
  | { event: 'done'; data: { displayText?: string; fullText?: string; meta?: AdvisorRound['meta'] } }
  | { event: 'error'; data: { message?: string; code?: string } };

type AnalyzeSseEvent =
  | { event: 'card'; data: DecisionCard }
  | { event: 'done'; data: { cards: DecisionCard[] } }
  | { event: 'error'; data: { message?: string; code?: string } };

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

export async function runMeeting(p: OrchestrateParams): Promise<void> {
  const priorRounds: PriorRound[] = [];

  // 失败隔离（spec §3.2）：一位军师失败时记录错误并进入下一位，不中断整场。
  // 出错军师不进入 priorRounds，后续军师看不到其发言。这是有意设计。
  for (const advisor of p.advisors) {
    if (p.signal?.aborted) return;
    p.cb.onRoundStart(advisor.id);
    let accumulated = '';

    try {
      for await (const evt of openSseStream<AdvisorSseEvent['data']>({
        url: `/api/advisor/${advisor.id}`,
        body: {
          session: {
            ...p.session.input,
            clarifications: p.session.clarifications.map((c) => ({
              question: c.question,
              answer: c.answer,
            })),
          },
          // content 是 displayText（已 strip meta），下一位军师不该看到 meta 标签。
          priorRounds: priorRounds.map((r) => ({
            advisorId: r.advisorId,
            advisorName: r.advisorName,
            content: r.content,
          })),
        },
        signal: p.signal,
      })) {
        const typed = evt as AdvisorSseEvent;
        if (typed.event === 'chunk') {
          p.cb.onRoundChunk(advisor.id, typed.data.text);
          accumulated += typed.data.text;
        } else if (typed.event === 'done') {
          const displayText = typed.data.displayText ?? stripMetaBlock(accumulated);
          const fullText = typed.data.fullText ?? accumulated;
          const meta = typed.data.meta ?? parseMetaBlock(accumulated);
          p.cb.onRoundDone(advisor.id, { displayText, fullText, meta });
          priorRounds.push({ advisorId: advisor.id, advisorName: advisor.name, content: displayText, meta });
        } else if (typed.event === 'error') {
          p.cb.onRoundError(advisor.id, typed.data.message ?? 'stream error');
          break;
        }
      }
    } catch (err: unknown) {
      if (isAbortError(err)) return;
      p.cb.onRoundError(
        advisor.id,
        err instanceof Error ? err.message : 'network error',
      );
    }
  }

  if (p.signal?.aborted) return;

  // Analysis phase
  p.cb.onAnalysisStart();
  try {
    for await (const evt of openSseStream<AnalyzeSseEvent['data']>({
      url: '/api/analyze',
      body: {
        session: p.session.input,
        rounds: priorRounds.map((r) => ({
          advisorId: r.advisorId,
          advisorName: r.advisorName,
          content: r.content,
          meta: r.meta,
        })),
      },
      signal: p.signal,
    })) {
      const typed = evt as AnalyzeSseEvent;
      if (typed.event === 'card') {
        p.cb.onAnalysisCard(typed.data);
      } else if (typed.event === 'done') {
        p.cb.onAnalysisDone();
      } else if (typed.event === 'error') {
        p.cb.onAnalysisError(typed.data.message ?? 'analyze error');
      }
    }
  } catch (err: unknown) {
    if (isAbortError(err)) return;
    p.cb.onAnalysisError(err instanceof Error ? err.message : 'network error');
  }
}
