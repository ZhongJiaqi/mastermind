// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import { saveSession, loadSessions, clearSessions, savePrefs, loadPrefs } from '../../src/lib/storage';
import type { DecisionSession } from '../../src/types/session';

function makeSession(id: string): DecisionSession {
  return {
    id,
    startedAt: Date.now(),
    input: { question: 'q' },
    selectedAdvisorIds: ['munger'],
    messages: [],
    analysis: { status: 'idle', cards: [] },
    state: { kind: 'idle' },
  };
}

describe('storage', () => {
  beforeEach(() => { localStorage.clear(); });

  it('round-trips a session', () => {
    saveSession(makeSession('1'));
    const list = loadSessions();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('1');
  });

  it('prepends newer sessions', () => {
    saveSession(makeSession('1'));
    saveSession(makeSession('2'));
    const list = loadSessions();
    expect(list.map((s) => s.id)).toEqual(['2', '1']);
  });

  it('updates in place when same id saved again', () => {
    saveSession(makeSession('1'));
    const again = { ...makeSession('1'), input: { question: 'changed' } };
    saveSession(again);
    const list = loadSessions();
    expect(list).toHaveLength(1);
    expect(list[0].input.question).toBe('changed');
  });

  it('clearSessions removes everything', () => {
    saveSession(makeSession('1'));
    clearSessions();
    expect(loadSessions()).toEqual([]);
  });

  it('prefs round-trip', () => {
    savePrefs({ lastSelectedAdvisorIds: ['munger', 'buffett'] });
    expect(loadPrefs().lastSelectedAdvisorIds).toEqual(['munger', 'buffett']);
  });

  it('returns empty on corrupt JSON', () => {
    localStorage.setItem('mastermind.sessions.v1', 'not json');
    expect(loadSessions()).toEqual([]);
  });
});
