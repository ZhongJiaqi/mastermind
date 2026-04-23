import { describe, expect, it } from 'vitest';
import { meetingReducer, initialMeeting } from '../../src/state/meetingReducer';

describe('meetingReducer', () => {
  it('INIT_SESSION creates session from idle', () => {
    const next = meetingReducer(initialMeeting, {
      type: 'INIT_SESSION',
      input: { question: '该不该跳槽' },
      selectedAdvisorIds: ['munger'],
    });
    expect(next.session.state.kind).toBe('idle');
    expect(next.session.input.question).toBe('该不该跳槽');
    expect(next.session.selectedAdvisorIds).toEqual(['munger']);
    expect(next.session.id).toBeTruthy();
    expect(next.session.startedAt).toBeGreaterThan(0);
  });

  it('INTAKE_NEEDED moves to clarify-pending with questions', () => {
    const seeded = meetingReducer(initialMeeting, {
      type: 'INIT_SESSION', input: { question: 'q' }, selectedAdvisorIds: ['munger'],
    });
    const next = meetingReducer(seeded, {
      type: 'INTAKE_NEEDED',
      questions: [{ id: '1', question: '预算多少?', why: '影响方案', answer: '' }],
    });
    expect(next.session.state.kind).toBe('clarify-pending');
    if (next.session.state.kind === 'clarify-pending') {
      expect(next.session.state.questions).toHaveLength(1);
    }
  });

  it('INTAKE_PASSED moves directly to meeting-running', () => {
    const seeded = meetingReducer(initialMeeting, {
      type: 'INIT_SESSION', input: { question: 'q' }, selectedAdvisorIds: ['munger'],
    });
    const next = meetingReducer(seeded, { type: 'INTAKE_PASSED' });
    expect(next.session.state.kind).toBe('meeting-running');
  });

  it('ROUND_START sets advisor status to streaming', () => {
    const seeded = meetingReducer(initialMeeting, {
      type: 'INIT_SESSION', input: { question: 'q' }, selectedAdvisorIds: ['munger', 'buffett'],
    });
    const running = meetingReducer(seeded, { type: 'INTAKE_PASSED' });
    const next = meetingReducer(running, { type: 'ROUND_START', advisorId: 'munger' });
    const round = next.session.rounds.find((r) => r.advisorId === 'munger');
    expect(round?.status).toBe('streaming');
  });

  it('ROUND_APPEND accumulates chunks', () => {
    const after = [
      { type: 'INIT_SESSION' as const, input: { question: 'q' }, selectedAdvisorIds: ['munger'] },
      { type: 'INTAKE_PASSED' as const },
      { type: 'ROUND_START' as const, advisorId: 'munger' },
      { type: 'ROUND_APPEND' as const, advisorId: 'munger', text: 'hello ' },
      { type: 'ROUND_APPEND' as const, advisorId: 'munger', text: 'world' },
    ].reduce(meetingReducer, initialMeeting);
    expect(after.session.rounds[0].content).toBe('hello world');
  });

  it('ROUND_DONE captures meta and marks status done', () => {
    const after = [
      { type: 'INIT_SESSION' as const, input: { question: 'q' }, selectedAdvisorIds: ['munger'] },
      { type: 'INTAKE_PASSED' as const },
      { type: 'ROUND_START' as const, advisorId: 'munger' },
      { type: 'ROUND_DONE' as const, advisorId: 'munger', displayText: 'hi', fullText: 'hi<meta>...</meta>', meta: { usedModels: ['逆向思考'], modelBriefs: { '逆向思考': 'x' } } },
    ].reduce(meetingReducer, initialMeeting);
    const r = after.session.rounds[0];
    expect(r.status).toBe('done');
    expect(r.content).toBe('hi');
    expect(r.meta.usedModels).toEqual(['逆向思考']);
  });

  it('ANALYSIS_DONE moves state to meeting-done', () => {
    const next = [
      { type: 'INIT_SESSION' as const, input: { question: 'q' }, selectedAdvisorIds: ['munger'] },
      { type: 'INTAKE_PASSED' as const },
      { type: 'ANALYSIS_START' as const },
      { type: 'ANALYSIS_CARD' as const, card: { advisorId: 'munger', characterName: '芒格', conclusion: 'no', reasoning: 'r', mentalModels: [] } },
      { type: 'ANALYSIS_DONE' as const },
    ].reduce(meetingReducer, initialMeeting);
    expect(next.session.state.kind).toBe('meeting-done');
    expect(next.session.analysis.status).toBe('done');
    expect(next.session.analysis.cards).toHaveLength(1);
  });

  it('ANALYSIS_ERROR moves state to meeting-done so UI can re-enable submit', () => {
    const next = [
      { type: 'INIT_SESSION' as const, input: { question: 'q' }, selectedAdvisorIds: ['munger'] },
      { type: 'INTAKE_PASSED' as const },
      { type: 'ANALYSIS_START' as const },
      { type: 'ANALYSIS_ERROR' as const, error: 'LLM_BAD_JSON' },
    ].reduce(meetingReducer, initialMeeting);
    expect(next.session.state.kind).toBe('meeting-done');
    expect(next.session.analysis.status).toBe('error');
    expect(next.session.analysis.error).toBe('LLM_BAD_JSON');
    expect(next.session.endedAt).toBeGreaterThan(0);
  });

  it('RESET returns to idle', () => {
    const seeded = meetingReducer(initialMeeting, {
      type: 'INIT_SESSION', input: { question: 'q' }, selectedAdvisorIds: ['munger'],
    });
    const next = meetingReducer(seeded, { type: 'RESET' });
    expect(next).toEqual(initialMeeting);
  });
});
