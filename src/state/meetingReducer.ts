import type {
  DecisionSession,
  DiscussionMessage,
  DecisionCard,
} from '../types/session';

export interface MeetingContainer {
  session: DecisionSession;
  error?: string;
}

function emptySession(): DecisionSession {
  return {
    id: '',
    startedAt: 0,
    input: { question: '' },
    selectedAdvisorIds: [],
    messages: [],
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
  | { type: 'MEETING_STARTED' }
  | { type: 'DISCUSSION_UPDATE'; messages: DiscussionMessage[] }
  | { type: 'CONCLUSIONS_UPDATE'; cards: DecisionCard[] }
  | { type: 'MEETING_DONE' }
  | { type: 'MEETING_ERROR'; error: string }
  | { type: 'RESET' };

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
      return {
        ...state,
        session: { ...s, input: { ...s.input, ...action.patch } },
      };

    case 'TOGGLE_ADVISOR': {
      const isSelected = s.selectedAdvisorIds.includes(action.id);
      const next = isSelected
        ? s.selectedAdvisorIds.filter((x) => x !== action.id)
        : [...s.selectedAdvisorIds, action.id];
      return { ...state, session: { ...s, selectedAdvisorIds: next } };
    }

    case 'RANDOMIZE_ADVISORS':
      return { ...state, session: { ...s, selectedAdvisorIds: action.ids } };

    case 'MEETING_STARTED':
      return {
        ...state,
        session: {
          ...s,
          state: { kind: 'meeting-running' },
          analysis: { status: 'streaming', cards: [] },
          messages: [],
        },
      };

    case 'DISCUSSION_UPDATE':
      return { ...state, session: { ...s, messages: action.messages } };

    case 'CONCLUSIONS_UPDATE':
      return {
        ...state,
        session: {
          ...s,
          analysis: { ...s.analysis, cards: action.cards },
        },
      };

    case 'MEETING_DONE':
      return {
        ...state,
        session: {
          ...s,
          state: { kind: 'meeting-done' },
          analysis: { ...s.analysis, status: 'done' },
          endedAt: Date.now(),
        },
      };

    case 'MEETING_ERROR':
      // 同步 state.kind 到 meeting-done，让 UI 的 isRunning 归位、按钮解锁。
      return {
        ...state,
        session: {
          ...s,
          state: { kind: 'meeting-done' },
          analysis: { ...s.analysis, status: 'error', error: action.error },
          endedAt: s.endedAt ?? Date.now(),
        },
      };

    case 'RESET':
      return initialMeeting;

    default:
      return state;
  }
}
