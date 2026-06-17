import { describe, expect, it } from 'vitest';
import { buildCouncilCard, buildPendingCard } from '../../api/_shared/feishu/card';
import type { DecisionCard, DiscussionMessage } from '../../src/types/session';

const sampleCard: DecisionCard = {
  advisorId: 'buffett',
  characterName: '沃伦·巴菲特',
  conclusion: '不换',
  reasoning: '比特币不在能力圈内，缺乏现金流和护城河。',
  mentalModels: [
    { name: '能力圈', briefOfUsage: '排除不懂的资产' },
    { name: '安全边际', briefOfUsage: '价格远低于价值' },
  ],
};

// Schema 2.0 cards put elements under body.elements (not at the top level
// like 1.0). Tests walk through body.elements throughout.
interface CardElement {
  tag: string;
  content?: string;
  behaviors?: Array<{ type?: string; default_url?: string }>;
}
interface CardV2 {
  schema: string;
  header: { template: string; title: { content: string } };
  body: { elements: CardElement[] };
}

describe('buildCouncilCard', () => {
  it('produces a schema 2.0 card with header + decision cards + link button', () => {
    const card = buildCouncilCard({
      question: '我该不该全部仓位换比特币？',
      advisorNames: ['沃伦·巴菲特', '查理·芒格'],
      cards: [sampleCard],
      discussionMessages: [],
      shareUrl: 'https://example.com/?c=abcd1234',
      modelUsed: 'qwen3.6-max-preview',
    }) as CardV2;

    expect(card.schema).toBe('2.0');
    expect(card.header.template).toBe('indigo');
    expect(card.header.title.content).toContain('决策圆桌');
    expect(card.header.title.content).toContain('全部仓位换比特币');

    const decisionText = card.body.elements.find(
      (e) => e.tag === 'markdown' && e.content?.startsWith('**📌'),
    );
    expect(decisionText?.content).toContain('能力圈');
    expect(decisionText?.content).toContain('不换');

    const linkButton = card.body.elements.find((e) => e.tag === 'button');
    expect(linkButton?.behaviors?.[0]?.type).toBe('open_url');
    expect(linkButton?.behaviors?.[0]?.default_url).toBe('https://example.com/?c=abcd1234');
  });

  it('truncates very long questions in the header', () => {
    const longQuestion = '问'.repeat(200);
    const card = buildCouncilCard({
      question: longQuestion,
      advisorNames: [],
      cards: [],
      discussionMessages: [],
      shareUrl: 'https://example.com/?c=abc',
    }) as CardV2;
    expect(card.header.title.content.length).toBeLessThanOrEqual(80);
    expect(card.header.title.content.endsWith('…')).toBe(true);
  });

  it('falls back to a parse-failure note when cards is empty', () => {
    const card = buildCouncilCard({
      question: 'q',
      advisorNames: [],
      cards: [],
      discussionMessages: [],
      shareUrl: 'https://example.com/?c=abc',
    }) as CardV2;
    const warning = card.body.elements.find((e) => e.content?.includes('解析失败'));
    expect(warning).toBeDefined();
  });

  it('strips backticks and angle brackets from advisor input', () => {
    const card = buildCouncilCard({
      question: '<b>q</b>',
      advisorNames: ['<x>'],
      cards: [
        {
          ...sampleCard,
          characterName: '`name`',
          conclusion: '<conclusion>',
          reasoning: '<reasoning>',
          mentalModels: [{ name: '<model>', briefOfUsage: '<brief>' }],
        },
      ],
      discussionMessages: [] as DiscussionMessage[],
      shareUrl: 'https://example.com/?c=abc',
    }) as CardV2;

    const joined = card.body.elements.map((e) => e.content || '').join('\n');
    expect(joined).not.toContain('<b>');
    expect(joined).not.toContain('`');
    expect(joined).not.toContain('<x>');
  });
});

describe('buildPendingCard', () => {
  it('produces a schema 2.0 wathet-templated card with question + count', () => {
    const card = buildPendingCard('该不该裸辞', 12) as CardV2;
    expect(card.schema).toBe('2.0');
    expect(card.header.template).toBe('wathet');
    expect(card.body.elements[0].content).toContain('该不该裸辞');
    expect(card.body.elements[0].content).toContain('12 位');
  });
});
