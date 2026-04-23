import { useReducer, useRef, useCallback, useEffect } from 'react';
import type React from 'react';
import { meetingReducer, initialMeeting } from '../state/meetingReducer';
import type { MeetingAction } from '../state/meetingReducer';
import { runMeeting } from '../lib/orchestrator';
import { saveSession } from '../lib/storage';
import type { DecisionSessionInput } from '../types/session';

export function useMeeting() {
  const [state, dispatch] = useReducer(meetingReducer, initialMeeting);
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(
    async (input: DecisionSessionInput, selectedAdvisorIds: string[]) => {
      dispatch({ type: 'INIT_SESSION', input, selectedAdvisorIds });
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      dispatch({ type: 'MEETING_STARTED' });
      await runMeeting({
        input,
        selectedAdvisorIds,
        signal: abortRef.current.signal,
        cb: {
          onDiscussionUpdate: (messages) =>
            dispatch({ type: 'DISCUSSION_UPDATE', messages }),
          onConclusionsUpdate: (cards) =>
            dispatch({ type: 'CONCLUSIONS_UPDATE', cards }),
          onDone: () => dispatch({ type: 'MEETING_DONE' }),
          onError: (err) => dispatch({ type: 'MEETING_ERROR', error: err }),
        },
      });
    },
    [],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    dispatch({ type: 'RESET' });
  }, []);

  useEffect(() => {
    if (state.session.state.kind === 'meeting-done' && state.session.endedAt) {
      saveSession(state.session);
    }
  }, [state.session.state.kind, state.session.endedAt, state.session]);

  return {
    state,
    dispatch: dispatch as React.Dispatch<MeetingAction>,
    start,
    reset,
  };
}
