import type { DecisionSession, Clarification, AdvisorRound, DecisionCard } from '../types/session';

export interface MeetingContainer {
  session: DecisionSession;
  error?: string;
}

function emptySession(): DecisionSession {
  return {
    id: '',
    startedAt: 0,
    input: { question: '' },
    clarifications: [],
    selectedAdvisorIds: [],
    rounds: [],
    analysis: { status: 'idle', cards: [] },
    state: { kind: 'idle' },
  };
}

export const initialMeeting: MeetingContainer = {
  session: emptySession(),
};

export type MeetingAction =
  | { type: 'INIT_SESSION'; input: DecisionSession['input']; selectedAdvisorIds: string[] }
  | { type: 'SET_INPUT'; patch: Partial<DecisionSession['input']> }
  | { type: 'TOGGLE_ADVISOR'; id: string }
  | { type: 'RANDOMIZE_ADVISORS'; ids: string[] }
  | { type: 'INTAKE_NEEDED'; questions: Clarification[] }
  | { type: 'INTAKE_PASSED' }
  | { type: 'SET_CLARIFICATION_ANSWER'; id: string; answer: string }
  | { type: 'SUBMIT_CLARIFICATIONS'; answers: Record<string, string> }
  | { type: 'ROUND_START'; advisorId: string }
  | { type: 'ROUND_APPEND'; advisorId: string; text: string }
  | { type: 'ROUND_DONE'; advisorId: string; displayText: string; fullText: string; meta: AdvisorRound['meta'] }
  | { type: 'ROUND_ERROR'; advisorId: string; error: string }
  | { type: 'ROUND_RETRY'; advisorId: string }
  | { type: 'ANALYSIS_START' }
  | { type: 'ANALYSIS_CARD'; card: DecisionCard }
  | { type: 'ANALYSIS_DONE' }
  | { type: 'ANALYSIS_ERROR'; error: string }
  | { type: 'RESET' };

function upsertRound(
  rounds: AdvisorRound[],
  advisorId: string,
  patch: Partial<AdvisorRound>,
): AdvisorRound[] {
  const idx = rounds.findIndex((r) => r.advisorId === advisorId);
  const base: AdvisorRound =
    idx >= 0
      ? rounds[idx]
      : {
          advisorId,
          advisorName: advisorId,
          content: '',
          fullText: '',
          status: 'pending',
          meta: { usedModels: [], modelBriefs: {} },
        };
  const next = { ...base, ...patch };
  if (idx >= 0) {
    return rounds.map((r, i) => (i === idx ? next : r));
  }
  return [...rounds, next];
}

export function meetingReducer(
  state: MeetingContainer,
  action: MeetingAction,
): MeetingContainer {
  const s = state.session;

  switch (action.type) {
    case 'INIT_SESSION':
      return {
        session: {
          ...emptySession(),
          id:
            globalThis.crypto?.randomUUID?.() ??
            `sess-${Date.now()}-${Math.random()}`,
          startedAt: Date.now(),
          input: action.input,
          selectedAdvisorIds: action.selectedAdvisorIds,
          state: { kind: 'idle' },
        },
      };

    case 'SET_INPUT':
      return { ...state, session: { ...s, input: { ...s.input, ...action.patch } } };

    case 'TOGGLE_ADVISOR': {
      const isSelected = s.selectedAdvisorIds.includes(action.id);
      const next = isSelected
        ? s.selectedAdvisorIds.filter((x) => x !== action.id)
        : [...s.selectedAdvisorIds, action.id];
      return { ...state, session: { ...s, selectedAdvisorIds: next } };
    }

    case 'RANDOMIZE_ADVISORS':
      return { ...state, session: { ...s, selectedAdvisorIds: action.ids } };

    case 'INTAKE_NEEDED':
      return {
        ...state,
        session: {
          ...s,
          clarifications: action.questions,
          state: { kind: 'clarify-pending', questions: action.questions },
        },
      };

    case 'INTAKE_PASSED':
      return { ...state, session: { ...s, state: { kind: 'meeting-running' } } };

    case 'SET_CLARIFICATION_ANSWER': {
      const updatedClarifications = s.clarifications.map((c) =>
        c.id === action.id ? { ...c, answer: action.answer } : c,
      );
      return {
        ...state,
        session: {
          ...s,
          clarifications: updatedClarifications,
          state:
            s.state.kind === 'clarify-pending'
              ? { kind: 'clarify-pending', questions: updatedClarifications }
              : s.state,
        },
      };
    }

    case 'SUBMIT_CLARIFICATIONS':
      return {
        ...state,
        session: {
          ...s,
          clarifications: s.clarifications.map((c) => ({
            ...c,
            answer: action.answers[c.id] ?? c.answer,
          })),
          state: { kind: 'meeting-running' },
        },
      };

    case 'ROUND_START':
      return {
        ...state,
        session: {
          ...s,
          rounds: upsertRound(s.rounds, action.advisorId, { status: 'streaming' }),
        },
      };

    case 'ROUND_APPEND': {
      const existing = s.rounds.find((r) => r.advisorId === action.advisorId);
      const content = (existing?.content ?? '') + action.text;
      return {
        ...state,
        session: {
          ...s,
          rounds: upsertRound(s.rounds, action.advisorId, { content, status: 'streaming' }),
        },
      };
    }

    case 'ROUND_DONE':
      return {
        ...state,
        session: {
          ...s,
          rounds: upsertRound(s.rounds, action.advisorId, {
            content: action.displayText,
            fullText: action.fullText,
            meta: action.meta,
            status: 'done',
          }),
        },
      };

    case 'ROUND_ERROR':
      return {
        ...state,
        session: {
          ...s,
          rounds: upsertRound(s.rounds, action.advisorId, {
            status: 'error',
            error: action.error,
          }),
        },
      };

    case 'ROUND_RETRY':
      return {
        ...state,
        session: {
          ...s,
          rounds: upsertRound(s.rounds, action.advisorId, {
            status: 'pending',
            error: undefined,
            content: '',
            fullText: '',
            meta: { usedModels: [], modelBriefs: {} },
          }),
        },
      };

    case 'ANALYSIS_START':
      return {
        ...state,
        session: { ...s, analysis: { status: 'streaming', cards: [] } },
      };

    case 'ANALYSIS_CARD':
      return {
        ...state,
        session: {
          ...s,
          analysis: { ...s.analysis, cards: [...s.analysis.cards, action.card] },
        },
      };

    case 'ANALYSIS_DONE':
      return {
        ...state,
        session: {
          ...s,
          analysis: { ...s.analysis, status: 'done' },
          state: { kind: 'meeting-done' },
          endedAt: Date.now(),
        },
      };

    case 'ANALYSIS_ERROR':
      return {
        ...state,
        session: {
          ...s,
          analysis: { ...s.analysis, status: 'error', error: action.error },
        },
      };

    case 'RESET':
      return initialMeeting;

    default:
      return state;
  }
}
