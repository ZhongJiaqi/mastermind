import { ADVISORS } from '../generated/advisors';
import type { DecisionCard, DiscussionMessage } from '../types/session';

export interface CouncilParseResult {
  messages: DiscussionMessage[];
  cards: DecisionCard[] | null;
  isComplete: boolean;
}

/**
 * Fuzzy match 发言人名到 vault 里的 advisor。
 *
 * 规则（强到弱）：
 *   1. 完全等于 frontmatter.name 或 frontmatter.id
 *   2. speaker 是 name 的严格后缀/前缀（例如 "芒格" 匹配 "查理·芒格"）
 *   3. name 是 speaker 的严格后缀/前缀
 *
 * 找不到返回 null（UI 层会 fallback 显示原 speaker）。
 */
export function resolveAdvisor(
  speaker: string,
): { id: string; name: string } | null {
  const s = speaker.trim();
  if (!s) return null;

  for (const a of ADVISORS) {
    if (s === a.frontmatter.name || s === a.frontmatter.id) {
      return { id: a.frontmatter.id, name: a.frontmatter.name };
    }
  }

  let best: { score: number; id: string; name: string } | null = null;
  for (const a of ADVISORS) {
    const name = a.frontmatter.name;
    let score = 0;
    if (s.length >= 2 && name.includes(s)) score = s.length;
    else if (name.length >= 2 && s.includes(name)) score = name.length;
    if (score > 0 && (!best || score > best.score)) {
      best = { score, id: a.frontmatter.id, name };
    }
  }
  return best ? { id: best.id, name: best.name } : null;
}

function parseDiscussion(block: string): DiscussionMessage[] {
  const lines = block.split('\n').map((l) => l.trim());
  const messages: DiscussionMessage[] = [];
  let idx = 0;

  for (const line of lines) {
    if (!line) continue;
    const m = line.match(/^([^:：]{1,30})[:：]\s*([\s\S]*)$/);
    if (!m) {
      // 没有速查标识 → 视作上一条的延续（软换行）
      if (messages.length > 0) {
        messages[messages.length - 1] = {
          ...messages[messages.length - 1],
          text: messages[messages.length - 1].text + '\n' + line,
        };
      }
      continue;
    }
    const speaker = m[1].trim();
    const text = m[2].trim();
    if (!text) continue;
    const resolved = resolveAdvisor(speaker);
    messages.push({
      id: `msg-${idx++}-${resolved?.id ?? 'unknown'}`,
      advisorId: resolved?.id ?? '',
      advisorName: resolved?.name ?? speaker,
      text,
    });
  }
  return messages;
}

/**
 * 修复 LLM（实测 glm-5.2）在 JSON 字符串值内部输出未转义英文双引号的坏 JSON：
 * `"reasoning": "先列出"什么会逼我亏钱"，再逐条堵死。"` → JSON.parse 直接炸。
 * 判定规则：字符串内遇到 `"` 时向后看第一个非空白字符——是 `,` `}` `]` `:` 或
 * 已到结尾则视为闭合引号，否则视为值内容里的引号，转义之。
 */
function escapeInnerQuotes(raw: string): string {
  let out = '';
  let inString = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (!inString) {
      if (ch === '"') inString = true;
      out += ch;
      continue;
    }
    if (ch === '\\') {
      out += ch + (raw[i + 1] ?? '');
      i++;
      continue;
    }
    if (ch !== '"') {
      out += ch;
      continue;
    }
    let j = i + 1;
    while (j < raw.length && /\s/.test(raw[j])) j++;
    const next = raw[j];
    if (next === undefined || next === ',' || next === '}' || next === ']' || next === ':') {
      inString = false;
      out += ch;
    } else {
      out += '\\"';
    }
  }
  return out;
}

function parseConclusions(block: string): DecisionCard[] | null {
  const stripped = block
    .trim()
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();
  if (!stripped) return null;
  for (const candidate of [stripped, escapeInnerQuotes(stripped)]) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (!Array.isArray(parsed)) return null;
      // 弱校验：每个元素至少得有 advisorId / characterName / conclusion
      const cards = parsed.filter((c): c is DecisionCard => {
        if (typeof c !== 'object' || c === null) return false;
        const card = c as Record<string, unknown>;
        return (
          typeof card.advisorId === 'string' &&
          typeof card.characterName === 'string' &&
          typeof card.conclusion === 'string' &&
          typeof card.reasoning === 'string' &&
          Array.isArray(card.mentalModels)
        );
      });
      return cards.length > 0 ? cards : null;
    } catch {
      // 原文 parse 失败 → 尝试引号修复版；两版都失败 → null（流式中段属正常）
    }
  }
  return null;
}

/**
 * 输入：LLM 累积到目前为止的 fullText。可以未闭合（流式中段）。
 * 输出：解析出的 messages 和 cards（cards 在 <conclusions> 后能 parse 出有效 JSON 数组时非 null）。
 *
 * <conclusions> 的闭合宽容：LLM 实测偶发不写 </conclusions> 闭合 tag，直接以 `]` 结尾。
 * 严格 regex 会让 cards 永远为 null → UI 0 cards。改为先匹配严格闭合，否则 fallback 到
 * "<conclusions> 后到结尾"。parseConclusions 的 JSON.parse 已 try/catch，流式中段
 * 还没写完 `]` 时 fallback 解析失败返 null——保持流式中无误判。
 */
export function parseCouncilStream(fullText: string): CouncilParseResult {
  const discussionMatch = fullText.match(/<discussion>([\s\S]*?)(?:<\/discussion>|$)/);
  let conclusionsBody: string | null = null;
  const closedMatch = fullText.match(/<conclusions>([\s\S]*?)<\/conclusions>/);
  if (closedMatch) {
    conclusionsBody = closedMatch[1];
  } else {
    const openMatch = fullText.match(/<conclusions>([\s\S]*)$/);
    if (openMatch) conclusionsBody = openMatch[1];
  }

  const messages = discussionMatch ? parseDiscussion(discussionMatch[1]) : [];
  const cards = conclusionsBody !== null ? parseConclusions(conclusionsBody) : null;
  const isComplete = Boolean(cards);

  return { messages, cards, isComplete };
}
