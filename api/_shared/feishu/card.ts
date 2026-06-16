// ======================================================
// Feishu interactive card builder for a council result.
//
// Card 1.0 schema — well-documented, mobile-stable. Layout:
//   - Header: "决策圆桌 · <truncated question>"
//   - Markdown line: 问题 + 参与军师
//   - Decision cards: 1 markdown div per advisor (📌 name · stance / reasoning / mental models)
//   - Action: link button to web page for the full discussion
//
// Discussion text is INTENTIONALLY omitted from the card — Feishu cards
// truncate long text on mobile, and the whole point of the "看完整讨论"
// button is to push that content to the web. The card stays focused on
// the high-density per-advisor decisions.
// ======================================================

import type { DecisionCard, DiscussionMessage } from '../../../src/types/session';

const HEADER_TITLE_MAX = 60;
const REASONING_PREVIEW_MAX = 140;

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

function escapeForLarkMd(s: string): string {
  // Strip backticks (corrupt markdown) and angle brackets (Feishu treats
  // some as tag markers in lark_md). Quotes etc. are fine.
  return s.replace(/[`<>]/g, '');
}

function formatDecisionMarkdown(card: DecisionCard): string {
  const stance = escapeForLarkMd(truncate(card.conclusion || '（无结论）', 40));
  const reasoning = escapeForLarkMd(truncate(card.reasoning || '', REASONING_PREVIEW_MAX));
  const models = card.mentalModels?.length
    ? card.mentalModels.map((m) => escapeForLarkMd(m.name)).join(' / ')
    : '（未标）';
  return `**📌 ${escapeForLarkMd(card.characterName)}** · ${stance}\n${reasoning}\n思维模型：${models}`;
}

export interface BuildCouncilCardParams {
  question: string;
  advisorNames: string[];
  cards: DecisionCard[];
  discussionMessages: DiscussionMessage[]; // currently unused in card body; kept for future use
  shareUrl: string;
  modelUsed?: string;
}

export function buildCouncilCard(p: BuildCouncilCardParams): object {
  const title = `决策圆桌 · ${truncate(p.question, HEADER_TITLE_MAX)}`;

  const headerLine = `**问题** · ${escapeForLarkMd(truncate(p.question, 200))}\n**军师** · ${p.advisorNames.map(escapeForLarkMd).join(' · ')}`;

  const decisionElements = p.cards.length
    ? p.cards.map((c) => ({ tag: 'markdown', content: formatDecisionMarkdown(c) }))
    : [{
        tag: 'markdown',
        content:
          '**⚠️ 解析失败** · LLM 输出可能没按要求结构化，点下方按钮看原始讨论。',
      }];

  const footerNote = p.modelUsed
    ? `<font color="grey">本场模型: ${escapeForLarkMd(p.modelUsed)} · ${p.discussionMessages.length} 段讨论</font>`
    : `<font color="grey">${p.discussionMessages.length} 段讨论</font>`;

  return {
    config: { wide_screen_mode: true, update_multi: true },
    header: {
      template: 'indigo',
      title: { tag: 'plain_text', content: title },
    },
    elements: [
      { tag: 'markdown', content: headerLine },
      { tag: 'hr' },
      { tag: 'markdown', content: '**⚖️ 决策建议**' },
      ...decisionElements,
      { tag: 'hr' },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '📖 在网页上看完整讨论' },
            type: 'primary',
            url: p.shareUrl,
          },
        ],
      },
      { tag: 'markdown', content: footerNote },
    ],
  };
}

// ----------------------- Per-question advisor selector -----------------------

export interface AdvisorOption {
  id: string;
  name: string;
  tagline: string;
}

export type SelectorAction = 'toggle' | 'all' | 'none' | 'start';

// Dedup duplicate dispatches of the SAME card-click. Feishu sometimes
// sends the same logical click twice (different event_id, same
// messageId+operator+value). event_id alone isn't a stable key — only
// the action identity is. Keep a sliding window; entries auto-evict
// when read past their TTL.
export class ActionDedup {
  private seen = new Map<string, number>();
  constructor(public readonly ttlMs: number = 5000) {}

  // Returns true the FIRST time this key is seen within the TTL window.
  // Subsequent calls within TTL return false. A key whose timestamp has
  // aged past TTL is treated as new.
  shouldProcess(key: string, now: number = Date.now()): boolean {
    const last = this.seen.get(key);
    if (last != null && now - last < this.ttlMs) return false;
    this.seen.set(key, now);
    // Best-effort cleanup so the map can't grow unbounded under heavy
    // traffic. Run only when crossing a soft cap.
    if (this.seen.size > 200) {
      for (const [k, t] of this.seen) {
        if (now - t > this.ttlMs * 2) this.seen.delete(k);
      }
    }
    return true;
  }
}

// Pure toggle math — extracted so tests can pin behavior without dragging
// in the SDK / KV / network layers. Returns the new selection ordered by
// the canonical advisor list so downstream consumers always see a stable
// ordering even after many toggles.
export function applySelectorAction(
  currentSelectedIds: string[],
  allIds: string[],
  action: SelectorAction,
  toggleId?: string,
): string[] {
  const selected = new Set(currentSelectedIds);
  if (action === 'toggle' && toggleId) {
    if (selected.has(toggleId)) selected.delete(toggleId);
    else selected.add(toggleId);
  } else if (action === 'all') {
    allIds.forEach((id) => selected.add(id));
  } else if (action === 'none') {
    selected.clear();
  }
  return allIds.filter((id) => selected.has(id));
}

export interface BuildSelectorCardParams {
  pendingId: string;
  question: string;
  allAdvisors: AdvisorOption[];
  selectedIds: string[];
}

// Chunk an array into rows so cards don't have rows that wrap awkwardly
// in mobile Feishu. 3 buttons per row keeps full names readable.
function chunkRows<T>(arr: T[], perRow: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += perRow) out.push(arr.slice(i, i + perRow));
  return out;
}

export function buildSelectorCard(p: BuildSelectorCardParams): object {
  const selected = new Set(p.selectedIds);
  const rows = chunkRows(p.allAdvisors, 3);

  const actionRows = rows.map((row) => ({
    tag: 'action',
    actions: row.map((a) => ({
      tag: 'button',
      text: {
        tag: 'plain_text',
        content: `${selected.has(a.id) ? '✅' : '⬜'} ${a.name}`,
      },
      type: selected.has(a.id) ? 'primary' : 'default',
      value: { action: 'toggle', id: a.id, pendingId: p.pendingId },
    })),
  }));

  return {
    config: { wide_screen_mode: true, update_multi: true },
    header: {
      template: 'turquoise',
      title: { tag: 'plain_text', content: '决策圆桌 · 请选军师' },
    },
    elements: [
      {
        tag: 'markdown',
        content: `📝 **问题** · ${escapeForLarkMd(truncate(p.question, 200))}\n\n请选择本次出席的军师（默认全部 ${p.allAdvisors.length} 位）：`,
      },
      ...actionRows,
      { tag: 'hr' },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '全选' },
            type: 'default',
            value: { action: 'all', pendingId: p.pendingId },
          },
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '全清' },
            type: 'default',
            value: { action: 'none', pendingId: p.pendingId },
          },
          {
            tag: 'button',
            text: {
              tag: 'plain_text',
              content: `🚀 开始讨论（已选 ${selected.size}/${p.allAdvisors.length}）`,
            },
            type: selected.size > 0 ? 'primary' : 'default',
            value: { action: 'start', pendingId: p.pendingId },
          },
        ],
      },
    ],
  };
}

// Compact card for "正在思考……" before the real council finishes.
// Sent immediately on receive so the user gets feedback within ~3s.
export function buildPendingCard(question: string, advisorCount: number): object {
  return {
    config: { wide_screen_mode: true, update_multi: true },
    header: {
      template: 'wathet',
      title: { tag: 'plain_text', content: `决策圆桌 · 思考中` },
    },
    elements: [
      {
        tag: 'markdown',
        content: `📝 **问题** · ${escapeForLarkMd(truncate(question, 200))}\n🧠 **${advisorCount} 位军师正在召开圆桌**……\n通常 30-60 秒，请稍候。`,
      },
    ],
  };
}

// Streaming intermediate card — sent once, then patched every ~2s as
// the LLM stream accumulates. Renders whatever discussion lines the
// parser has resolved so far so the user sees the council "type" out
// in real time. The final card (after stream ends) is built via
// buildCouncilCard for the decisions + share button layout.
export interface BuildStreamingCardParams {
  question: string;
  advisorCount: number;
  messages: DiscussionMessage[];
  done: boolean;
  modelUsed?: string;
  // After </discussion>, LLM spends 30-60s emitting <conclusions> JSON.
  // partialCardCount is the number of advisor cards parsed-so-far from
  // that section (counted by "advisorId" occurrences). Pass it through
  // so the card shows real progress during the conclusions phase
  // instead of freezing on the discussion-only count.
  partialCardCount?: number;
}

const STREAM_MESSAGE_TRUNCATE = 600;

export function buildStreamingCard(p: BuildStreamingCardParams): object {
  const partial = p.partialCardCount ?? 0;
  const title = p.messages.length === 0
    ? '决策圆桌 · 思考中'
    : partial > 0
      ? `决策圆桌 · 汇总决策中（${partial}/${p.advisorCount}）`
      : `决策圆桌 · 讨论中（${p.messages.length} 段）`;

  const elements: object[] = [
    {
      tag: 'markdown',
      content: `📝 **问题** · ${escapeForLarkMd(truncate(p.question, 200))}`,
    },
  ];

  if (p.messages.length === 0) {
    elements.push({
      tag: 'markdown',
      content: `🧠 **${p.advisorCount} 位军师正在召集**……\n_首段发言通常在 5-10 秒内出现_`,
    });
  } else {
    elements.push({ tag: 'hr' });
    // One markdown element per message — keeps Feishu's per-element
    // size limits comfortable and lets long discussions stay readable.
    for (const m of p.messages) {
      const text = escapeForLarkMd(truncate(m.text, STREAM_MESSAGE_TRUNCATE));
      elements.push({
        tag: 'markdown',
        content: `**${escapeForLarkMd(m.advisorName)}**\n${text}`,
      });
    }
    if (!p.done) {
      const tail = partial > 0
        ? `_…正在汇总决策（${partial}/${p.advisorCount} 已生成）_`
        : '_…正在生成更多讨论_';
      elements.push({ tag: 'markdown', content: tail });
    }
  }

  if (p.modelUsed) {
    elements.push({
      tag: 'markdown',
      content: `<font color="grey">本场模型: ${escapeForLarkMd(p.modelUsed)}</font>`,
    });
  }

  return {
    config: { wide_screen_mode: true, update_multi: true },
    header: {
      template: 'wathet',
      title: { tag: 'plain_text', content: title },
    },
    elements,
  };
}
