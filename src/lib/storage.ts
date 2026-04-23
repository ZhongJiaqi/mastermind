import type { DecisionSession } from '../types/session';

const KEY = 'mastermind.sessions.v1';

export function saveSession(session: DecisionSession): void {
  if (typeof localStorage === 'undefined') return;
  const list = loadSessions();
  const updated = [session, ...list.filter((s) => s.id !== session.id)].slice(0, 50);
  localStorage.setItem(KEY, JSON.stringify(updated));
}

export function loadSessions(): DecisionSession[] {
  if (typeof localStorage === 'undefined') return [];
  const raw = localStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function clearSessions(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(KEY);
}

export interface Prefs {
  lastSelectedAdvisorIds?: string[];
}

const PREFS_KEY = 'mastermind.prefs.v1';

export function savePrefs(p: Prefs): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(PREFS_KEY, JSON.stringify(p));
}

export function loadPrefs(): Prefs {
  if (typeof localStorage === 'undefined') return {};
  const raw = localStorage.getItem(PREFS_KEY);
  if (!raw) return {};
  try { return JSON.parse(raw) as Prefs; } catch { return {}; }
}
