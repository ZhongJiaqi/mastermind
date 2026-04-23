import { useReducer, useRef, useCallback } from 'react';
import type React from 'react';
import { ADVISORS } from '../generated/advisors';
import { meetingReducer, initialMeeting } from '../state/meetingReducer';
import type { MeetingAction } from '../state/meetingReducer';
import { runMeeting } from '../lib/orchestrator';
import { saveSession } from '../lib/storage';
import type { DecisionSessionInput, Clarification } from '../types/session';

export function useMeeting() {
  const [state, dispatch] = useReducer(meetingReducer, initialMeeting);
  const abortRef = useRef<AbortController | null>(null);

  const runRoundtable = useCallback(
    async (ids: string[], input: DecisionSessionInput, clarifications: Clarification[]) => {
      const advisors = ids.map((id) => {
        const a = ADVISORS.find((x) => x.frontmatter.id === id);
        return { id, name: a?.frontmatter.name ?? id };
      });
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      await runMeeting({
        session: { input, clarifications },
        advisors,
        signal: abortRef.current.signal,
        cb: {
          onRoundStart: (id) => dispatch({ type: 'ROUND_START', advisorId: id }),
          onRoundChunk: (id, text) => dispatch({ type: 'ROUND_APPEND', advisorId: id, text }),
          onRoundDone: (id, payload) => dispatch({ type: 'ROUND_DONE', advisorId: id, ...payload }),
          onRoundError: (id, err) => dispatch({ type: 'ROUND_ERROR', advisorId: id, error: err }),
          onAnalysisStart: () => dispatch({ type: 'ANALYSIS_START' }),
          onAnalysisCard: (card) => dispatch({ type: 'ANALYSIS_CARD', card }),
          onAnalysisDone: () => dispatch({ type: 'ANALYSIS_DONE' }),
          onAnalysisError: (err) => dispatch({ type: 'ANALYSIS_ERROR', error: err }),
        },
      });
    },
    [],
  );

  // 主持人追问已移除（UI 保持原项目一致）。如未来启用，可在此重新接入 /api/intake-clarify。
  const start = useCallback(
    async (input: DecisionSessionInput, selectedAdvisorIds: string[]) => {
      dispatch({ type: 'INIT_SESSION', input, selectedAdvisorIds });
      dispatch({ type: 'INTAKE_PASSED' });
      await runRoundtable(selectedAdvisorIds, input, []);
    },
    [runRoundtable],
  );

  const submitClarifications = useCallback(
    async (answers: Record<string, string>) => {
      const updated = state.session.clarifications.map((c) => ({
        ...c,
        answer: answers[c.id] ?? c.answer,
      }));
      dispatch({ type: 'SUBMIT_CLARIFICATIONS', answers });
      await runRoundtable(state.session.selectedAdvisorIds, state.session.input, updated);
    },
    [runRoundtable, state.session.clarifications, state.session.input, state.session.selectedAdvisorIds],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    dispatch({ type: 'RESET' });
  }, []);

  const retryAdvisor = useCallback((advisorId: string) => {
    dispatch({ type: 'ROUND_RETRY', advisorId });
    // Sprint 4 会加真正的重试实现；MVP 里 retry 只重置状态，用户需重启会议
  }, []);

  // save on meeting-done（storage 用 id 去重，容忍多次调用）
  if (state.session.state.kind === 'meeting-done' && state.session.endedAt) {
    saveSession(state.session);
  }

  return {
    state,
    dispatch: dispatch as React.Dispatch<MeetingAction>,
    start,
    submitClarifications,
    reset,
    retryAdvisor,
  };
}
