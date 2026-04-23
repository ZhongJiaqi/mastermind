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

function parseConclusions(block: string): DecisionCard[] | null {
  const stripped = block
    .trim()
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();
  if (!stripped) return null;
  try {
    const parsed = JSON.parse(stripped) as unknown;
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
    return null;
  }
}

/**
 * 输入：LLM 累积到目前为止的 fullText。可以未闭合（流式中段）。
 * 输出：解析出的 messages 和 cards（cards 只在 <conclusions>...</conclusions> 完全闭合且 JSON 可解析时非 null）。
 */
export function parseCouncilStream(fullText: string): CouncilParseResult {
  const discussionMatch = fullText.match(/<discussion>([\s\S]*?)(?:<\/discussion>|$)/);
  const conclusionsMatch = fullText.match(/<conclusions>([\s\S]*?)<\/conclusions>/);

  const messages = discussionMatch ? parseDiscussion(discussionMatch[1]) : [];
  const cards = conclusionsMatch ? parseConclusions(conclusionsMatch[1]) : null;
  const isComplete = Boolean(conclusionsMatch && cards);

  return { messages, cards, isComplete };
}
