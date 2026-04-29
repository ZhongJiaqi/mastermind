import { openSseStream } from './sseClient';
import { parseCouncilStream } from './councilParser';
import type {
  DecisionCard,
  DecisionSessionInput,
  DiscussionMessage,
} from '../types/session';

export interface CouncilCallbacks {
  onDiscussionUpdate: (messages: DiscussionMessage[]) => void;
  onConclusionsUpdate: (cards: DecisionCard[]) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

export interface RunCouncilParams {
  input: DecisionSessionInput;
  selectedAdvisorIds: string[];
  cb: CouncilCallbacks;
  signal?: AbortSignal;
}

type CouncilSseEvent =
  | { event: 'chunk'; data: { text: string } }
  | { event: 'done'; data: { fullText?: string } }
  | { event: 'error'; data: { message?: string; code?: string } };

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

/**
 * 单次 POST /api/council + 流式 parse。
 *
 * 每个 chunk 到达后重新 parse 整段 fullText（parser 对不完整的块耐受，返回
 * 当前能识别的 messages + 若 <conclusions> 已闭合则的 cards）。UI 层用
 * immutable replace（不是 append），避免 streaming 时重复条目。
 */
export async function runMeeting(p: RunCouncilParams): Promise<void> {
  let fullText = '';
  let lastCardsKey = '';

  try {
    for await (const evt of openSseStream<CouncilSseEvent['data']>({
      url: '/api/council',
      body: {
        session: p.input,
        selectedAdvisorIds: p.selectedAdvisorIds,
      },
      signal: p.signal,
    })) {
      const typed = evt as CouncilSseEvent;
      if (typed.event === 'chunk') {
        fullText += typed.data.text;
        const parsed = parseCouncilStream(fullText);
        p.cb.onDiscussionUpdate(parsed.messages);
        if (parsed.cards) {
          const key = JSON.stringify(parsed.cards);
          if (key !== lastCardsKey) {
            p.cb.onConclusionsUpdate(parsed.cards);
            lastCardsKey = key;
          }
        }
      } else if (typed.event === 'done') {
        const text = typed.data.fullText ?? fullText;
        const final = parseCouncilStream(text);
        p.cb.onDiscussionUpdate(final.messages);
        if (final.cards) p.cb.onConclusionsUpdate(final.cards);
        p.cb.onDone();
      } else if (typed.event === 'error') {
        p.cb.onError(typed.data.message ?? 'council error');
      }
    }
  } catch (err: unknown) {
    if (isAbortError(err)) return;
    p.cb.onError(err instanceof Error ? err.message : 'network error');
  }
}
