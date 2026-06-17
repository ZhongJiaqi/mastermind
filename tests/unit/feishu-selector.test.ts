import { describe, expect, it } from 'vitest';
import {
  ActionDedup,
  advisorCheckerName,
  advisorIdFromCheckerName,
  applySelectorAction,
  buildSelectorCard,
} from '../../api/_shared/feishu/card';

const ALL = ['buffett', 'caocao', 'cialdini', 'duanyongping', 'jobs', 'kahneman', 'munger', 'musk', 'trump', 'zhenhuan'];

describe('applySelectorAction (legacy helper, kept for tests)', () => {
  // Still exported for any future schema-1.0 reuse; not on the form-mode hot path.
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

  it('none clears every advisor', () => {
    const out = applySelectorAction(ALL, ALL, 'none');
    expect(out).toEqual([]);
  });

  it('canonical order is preserved across many toggles', () => {
    let state = ALL.slice();
    state = applySelectorAction(state, ALL, 'toggle', 'musk');
    state = applySelectorAction(state, ALL, 'toggle', 'buffett');
    state = applySelectorAction(state, ALL, 'toggle', 'musk');
    expect(state).toEqual(ALL.filter((id) => id !== 'buffett'));
  });
});

describe('checker name helpers', () => {
  it('round-trips advisor id through checker name', () => {
    expect(advisorCheckerName('buffett')).toBe('adv_buffett');
    expect(advisorIdFromCheckerName('adv_buffett')).toBe('buffett');
  });

  it('returns null for non-advisor field names', () => {
    expect(advisorIdFromCheckerName('submit_btn')).toBeNull();
    expect(advisorIdFromCheckerName('selector_form')).toBeNull();
  });
});

interface SelectorCard {
  schema: string;
  body: { elements: Array<CardElement> };
}
interface CardElement {
  tag: string;
  name?: string;
  elements?: Array<CardElement>;
  columns?: Array<{ elements?: Array<CardElement> }>;
  text?: { content?: string };
  checked?: boolean;
  type?: string;
  form_action_type?: string;
  behaviors?: Array<{ value?: { action?: string; pendingId?: string } }>;
}

function walkCardElements(card: SelectorCard): CardElement[] {
  const out: CardElement[] = [];
  function visit(el: CardElement): void {
    out.push(el);
    if (el.elements) for (const child of el.elements) visit(child);
    if (el.columns) {
      for (const col of el.columns) {
        if (col.elements) for (const child of col.elements) visit(child);
      }
    }
  }
  for (const el of card.body.elements) visit(el);
  return out;
}

describe('buildSelectorCard (schema 2.0 form + checkers)', () => {
  const SAMPLE = [
    { id: 'buffett', name: '巴菲特', tagline: '' },
    { id: 'munger', name: '芒格', tagline: '' },
  ];

  it('uses card schema 2.0 with a form container', () => {
    const card = buildSelectorCard({
      pendingId: 'p',
      question: 'q',
      allAdvisors: SAMPLE,
      selectedIds: ['buffett'],
    }) as SelectorCard;

    expect(card.schema).toBe('2.0');
    const form = card.body.elements.find((e) => e.tag === 'form');
    expect(form).toBeDefined();
    expect(form?.name).toBe('selector_form');
  });

  it('renders one checker per advisor with bare names and initial checked state', () => {
    const card = buildSelectorCard({
      pendingId: 'p',
      question: 'q',
      allAdvisors: SAMPLE,
      selectedIds: ['buffett'],
    }) as SelectorCard;

    const checkers = walkCardElements(card).filter((e) => e.tag === 'checker');
    expect(checkers).toHaveLength(2);

    const buffett = checkers.find((c) => c.name === 'adv_buffett');
    const munger = checkers.find((c) => c.name === 'adv_munger');
    expect(buffett?.text?.content).toBe('巴菲特');
    expect(munger?.text?.content).toBe('芒格');
    expect(buffett?.checked).toBe(true);
    expect(munger?.checked).toBe(false);
  });

  it('has a single submit button carrying start_council action and pendingId', () => {
    const card = buildSelectorCard({
      pendingId: 'abc123XYZ',
      question: 'q',
      allAdvisors: SAMPLE,
      selectedIds: ['buffett'],
    }) as SelectorCard;

    const buttons = walkCardElements(card).filter((e) => e.tag === 'button');
    expect(buttons).toHaveLength(1);

    const submit = buttons[0];
    expect(submit.form_action_type).toBe('submit');
    const cbValue = submit.behaviors?.[0]?.value;
    expect(cbValue?.action).toBe('start_council');
    expect(cbValue?.pendingId).toBe('abc123XYZ');
  });
});

describe('ActionDedup', () => {
  it('repro: SDK delivers same logical click twice with different event_ids', () => {
    const dedup = new ActionDedup(5000);
    const cardMsg = 'om_xxx';
    const operator = 'ou_user_a';
    const value = { action: 'start_council', pendingId: 'P1' };
    const key = `${cardMsg}:${operator}:${JSON.stringify(value)}`;

    expect(dedup.shouldProcess(key, 1000)).toBe(true);
    expect(dedup.shouldProcess(key, 1050)).toBe(false);
    expect(dedup.shouldProcess(key, 1500)).toBe(false);
    expect(dedup.shouldProcess(key, 6500)).toBe(true);
  });

  it('different keys hash independently — no false dedup', () => {
    const dedup = new ActionDedup(5000);
    const key1 = 'om:ou_a:' + JSON.stringify({ action: 'start_council', pendingId: 'P1' });
    const key2 = 'om:ou_b:' + JSON.stringify({ action: 'start_council', pendingId: 'P1' });
    expect(dedup.shouldProcess(key1, 1000)).toBe(true);
    expect(dedup.shouldProcess(key2, 1010)).toBe(true);
  });
});
