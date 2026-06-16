import { describe, expect, it } from 'vitest';
import { ActionDedup, applySelectorAction, buildSelectorCard } from '../../api/_shared/feishu/card';

const ALL = ['buffett', 'caocao', 'cialdini', 'duanyongping', 'jobs', 'kahneman', 'munger', 'musk', 'trump', 'zhenhuan'];

describe('applySelectorAction', () => {
  it('toggle removes a selected advisor', () => {
    const out = applySelectorAction(ALL, ALL, 'toggle', 'zhenhuan');
    expect(out).toEqual(ALL.filter((id) => id !== 'zhenhuan'));
    expect(out.length).toBe(9);
  });

  it('toggle adds an unselected advisor (preserving canonical order)', () => {
    const startingWith = ALL.filter((id) => id !== 'zhenhuan');
    const out = applySelectorAction(startingWith, ALL, 'toggle', 'zhenhuan');
    expect(out).toEqual(ALL);
    expect(out.length).toBe(10);
  });

  it('toggle is a no-op when toggleId is empty', () => {
    const out = applySelectorAction(ALL, ALL, 'toggle', undefined);
    expect(out).toEqual(ALL);
  });

  it('all selects every advisor', () => {
    const out = applySelectorAction([], ALL, 'all');
    expect(out).toEqual(ALL);
  });

  it('all is idempotent when everything already selected', () => {
    const out = applySelectorAction(ALL, ALL, 'all');
    expect(out).toEqual(ALL);
  });

  it('none clears every advisor', () => {
    const out = applySelectorAction(ALL, ALL, 'none');
    expect(out).toEqual([]);
  });

  it('two toggles on the same advisor return to original state', () => {
    const once = applySelectorAction(ALL, ALL, 'toggle', 'musk');
    expect(once.length).toBe(9);
    const twice = applySelectorAction(once, ALL, 'toggle', 'musk');
    expect(twice).toEqual(ALL);
  });

  it('canonical order is preserved across many toggles', () => {
    let state = ALL.slice();
    state = applySelectorAction(state, ALL, 'toggle', 'musk'); // remove
    state = applySelectorAction(state, ALL, 'toggle', 'buffett'); // remove
    state = applySelectorAction(state, ALL, 'toggle', 'musk'); // re-add
    expect(state).toEqual(ALL.filter((id) => id !== 'buffett'));
  });
});

describe('buildSelectorCard', () => {
  const SAMPLE = [
    { id: 'buffett', name: '巴菲特', tagline: '' },
    { id: 'munger', name: '芒格', tagline: '' },
  ];

  it('embeds the given pendingId in every button value', () => {
    const card = buildSelectorCard({
      pendingId: 'abc123XYZ',
      question: 'q',
      allAdvisors: SAMPLE,
      selectedIds: ['buffett'],
    }) as { elements: Array<{ tag: string; actions?: Array<{ value?: { pendingId?: string } }> }> };

    const allValues: Array<{ pendingId?: string }> = [];
    for (const e of card.elements) {
      if (e.tag === 'action' && e.actions) for (const a of e.actions) if (a.value) allValues.push(a.value);
    }
    expect(allValues.length).toBeGreaterThan(0);
    for (const v of allValues) expect(v.pendingId).toBe('abc123XYZ');
  });

  it('renders ✅ for selected and ⬜ for unselected', () => {
    const card = buildSelectorCard({
      pendingId: 'p',
      question: 'q',
      allAdvisors: SAMPLE,
      selectedIds: ['buffett'],
    }) as { elements: Array<{ tag: string; actions?: Array<{ text?: { content?: string }; value?: { id?: string } }> }> };

    const advisorButtons: Array<{ id: string; text: string }> = [];
    for (const e of card.elements) {
      if (e.tag !== 'action' || !e.actions) continue;
      for (const a of e.actions) {
        if (a.value?.id) advisorButtons.push({ id: a.value.id, text: a.text?.content ?? '' });
      }
    }
    const buffett = advisorButtons.find((b) => b.id === 'buffett');
    const munger = advisorButtons.find((b) => b.id === 'munger');
    expect(buffett?.text.startsWith('✅')).toBe(true);
    expect(munger?.text.startsWith('⬜')).toBe(true);
  });

  it('repro: SDK delivers same logical click twice with different event_ids', () => {
    // The bug we saw: zhenhuan was reported as having toggled 10→9 then 9→10
    // because Feishu dispatched the SAME click twice. event_id-based dedup
    // missed it (each delivery had a distinct event_id). With ActionDedup
    // on (cardMessageId, operator, value-json), the second delivery is
    // recognized and dropped.
    const dedup = new ActionDedup(5000);
    const cardMsg = 'om_xxx';
    const operator = 'ou_user_a';
    const value = { action: 'toggle', id: 'zhenhuan', pendingId: 'P1' };
    const key = `${cardMsg}:${operator}:${JSON.stringify(value)}`;

    expect(dedup.shouldProcess(key, 1000)).toBe(true);  // first delivery
    expect(dedup.shouldProcess(key, 1050)).toBe(false); // duplicate 50ms later
    expect(dedup.shouldProcess(key, 1500)).toBe(false); // still within TTL
    expect(dedup.shouldProcess(key, 6500)).toBe(true);  // after TTL — legit re-toggle later
  });

  it('different toggle ids hash independently — no false dedup', () => {
    const dedup = new ActionDedup(5000);
    const key1 = 'om:ou_a:' + JSON.stringify({ action: 'toggle', id: 'zhenhuan', pendingId: 'P' });
    const key2 = 'om:ou_a:' + JSON.stringify({ action: 'toggle', id: 'musk', pendingId: 'P' });
    expect(dedup.shouldProcess(key1, 1000)).toBe(true);
    expect(dedup.shouldProcess(key2, 1010)).toBe(true);
  });

  it('start button shows selected count', () => {
    const card = buildSelectorCard({
      pendingId: 'p',
      question: 'q',
      allAdvisors: SAMPLE,
      selectedIds: ['buffett'],
    }) as { elements: Array<{ tag: string; actions?: Array<{ text?: { content?: string }; value?: { action?: string } }> }> };

    let startText: string | undefined;
    for (const e of card.elements) {
      if (e.tag !== 'action' || !e.actions) continue;
      for (const a of e.actions) {
        if (a.value?.action === 'start') startText = a.text?.content;
      }
    }
    expect(startText).toMatch(/1\/2/);
  });
});
