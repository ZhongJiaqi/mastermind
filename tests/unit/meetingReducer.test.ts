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
    expect(next.session.messages).toEqual([]);
    expect(next.session.analysis.cards).toEqual([]);
  });

  it('MEETING_STARTED flips state to meeting-running and resets messages', () => {
    const seeded = [
      { type: 'INIT_SESSION' as const, input: { question: 'q' }, selectedAdvisorIds: ['munger'] },
      {
        type: 'DISCUSSION_UPDATE' as const,
        messages: [{ id: 'old', advisorId: 'munger', advisorName: '芒格', text: 'stale' }],
      },
    ].reduce(meetingReducer, initialMeeting);
    const next = meetingReducer(seeded, { type: 'MEETING_STARTED' });
    expect(next.session.state.kind).toBe('meeting-running');
    expect(next.session.analysis.status).toBe('streaming');
    expect(next.session.messages).toEqual([]);
  });

  it('DISCUSSION_UPDATE replaces the full messages array (not append)', () => {
    const seeded = meetingReducer(initialMeeting, {
      type: 'INIT_SESSION',
      input: { question: 'q' },
      selectedAdvisorIds: ['munger', 'buffett'],
    });
    const m1 = meetingReducer(seeded, {
      type: 'DISCUSSION_UPDATE',
      messages: [{ id: '1', advisorId: 'munger', advisorName: '芒格', text: 'a' }],
    });
    const m2 = meetingReducer(m1, {
      type: 'DISCUSSION_UPDATE',
      messages: [
        { id: '1', advisorId: 'munger', advisorName: '芒格', text: 'a' },
        { id: '2', advisorId: 'buffett', advisorName: '巴菲特', text: 'b' },
      ],
    });
    expect(m2.session.messages).toHaveLength(2);
    expect(m2.session.messages[1].text).toBe('b');
  });

  it('CONCLUSIONS_UPDATE sets analysis.cards without touching state.kind', () => {
    const seeded = [
      { type: 'INIT_SESSION' as const, input: { question: 'q' }, selectedAdvisorIds: ['munger'] },
      { type: 'MEETING_STARTED' as const },
    ].reduce(meetingReducer, initialMeeting);
    const next = meetingReducer(seeded, {
      type: 'CONCLUSIONS_UPDATE',
      cards: [
        {
          advisorId: 'munger',
          characterName: '芒格',
          conclusion: '不换',
          reasoning: 'r',
          mentalModels: [{ name: '逆向思考', briefOfUsage: 'b' }],
        },
      ],
    });
    expect(next.session.state.kind).toBe('meeting-running');
    expect(next.session.analysis.cards).toHaveLength(1);
    expect(next.session.analysis.status).toBe('streaming');
  });

  it('MEETING_DONE transitions to meeting-done with analysis=done', () => {
    const next = [
      { type: 'INIT_SESSION' as const, input: { question: 'q' }, selectedAdvisorIds: ['munger'] },
      { type: 'MEETING_STARTED' as const },
      {
        type: 'CONCLUSIONS_UPDATE' as const,
        cards: [
          {
            advisorId: 'munger',
            characterName: '芒格',
            conclusion: 'x',
            reasoning: 'r',
            mentalModels: [],
          },
        ],
      },
      { type: 'MEETING_DONE' as const },
    ].reduce(meetingReducer, initialMeeting);
    expect(next.session.state.kind).toBe('meeting-done');
    expect(next.session.analysis.status).toBe('done');
    expect(next.session.endedAt).toBeGreaterThan(0);
  });

  it('MEETING_ERROR transitions to meeting-done so submit can re-enable', () => {
    const next = [
      { type: 'INIT_SESSION' as const, input: { question: 'q' }, selectedAdvisorIds: ['munger'] },
      { type: 'MEETING_STARTED' as const },
      { type: 'MEETING_ERROR' as const, error: 'LLM_BAD_JSON' },
    ].reduce(meetingReducer, initialMeeting);
    expect(next.session.state.kind).toBe('meeting-done');
    expect(next.session.analysis.status).toBe('error');
    expect(next.session.analysis.error).toBe('LLM_BAD_JSON');
    expect(next.session.endedAt).toBeGreaterThan(0);
  });

  it('RESET returns to idle', () => {
    const seeded = meetingReducer(initialMeeting, {
      type: 'INIT_SESSION',
      input: { question: 'q' },
      selectedAdvisorIds: ['munger'],
    });
    const next = meetingReducer(seeded, { type: 'RESET' });
    expect(next).toEqual(initialMeeting);
  });
});
