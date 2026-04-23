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

export async function runMeeting(p: OrchestrateParams): Promise<void> {
  const priorRounds: PriorRound[] = [];

  for (const advisor of p.advisors) {
    p.cb.onRoundStart(advisor.id);
    let accumulated = '';

    try {
      for await (const evt of openSseStream<any>({
        url: `/api/advisor/${advisor.id}`,
        body: {
          session: {
            ...p.session.input,
            clarifications: p.session.clarifications.map((c) => ({
              question: c.question,
              answer: c.answer,
            })),
          },
          priorRounds: priorRounds.map((r) => ({
            advisorId: r.advisorId,
            advisorName: r.advisorName,
            content: r.content,
          })),
        },
        signal: p.signal,
      })) {
        if (evt.event === 'chunk') {
          p.cb.onRoundChunk(advisor.id, evt.data.text);
          accumulated += evt.data.text;
        } else if (evt.event === 'done') {
          const displayText = evt.data.displayText ?? stripMetaBlock(accumulated);
          const fullText = evt.data.fullText ?? accumulated;
          const meta = evt.data.meta ?? parseMetaBlock(accumulated);
          p.cb.onRoundDone(advisor.id, { displayText, fullText, meta });
          priorRounds.push({ advisorId: advisor.id, advisorName: advisor.name, content: displayText, meta });
        } else if (evt.event === 'error') {
          p.cb.onRoundError(advisor.id, evt.data.message ?? 'stream error');
          break;
        }
      }
    } catch (err: unknown) {
      p.cb.onRoundError(
        advisor.id,
        err instanceof Error ? err.message : 'network error',
      );
    }
  }

  // Analysis phase
  p.cb.onAnalysisStart();
  try {
    for await (const evt of openSseStream<any>({
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
      if (evt.event === 'card') {
        p.cb.onAnalysisCard(evt.data);
      } else if (evt.event === 'done') {
        p.cb.onAnalysisDone();
      } else if (evt.event === 'error') {
        p.cb.onAnalysisError(evt.data.message ?? 'analyze error');
      }
    }
  } catch (err: unknown) {
    p.cb.onAnalysisError(err instanceof Error ? err.message : 'network error');
  }
}
