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

describe('buildCouncilCard', () => {
  it('produces an interactive card with header + decision cards + link button', () => {
    const card = buildCouncilCard({
      question: '我该不该全部仓位换比特币？',
      advisorNames: ['沃伦·巴菲特', '查理·芒格'],
      cards: [sampleCard],
      discussionMessages: [],
      shareUrl: 'https://example.com/?c=abcd1234',
      modelUsed: 'qwen3.6-max-preview',
    }) as {
      header: { template: string; title: { content: string } };
      elements: Array<{ tag: string; content?: string; actions?: Array<{ url: string }> }>;
    };

    expect(card.header.template).toBe('indigo');
    expect(card.header.title.content).toContain('决策圆桌');
    expect(card.header.title.content).toContain('全部仓位换比特币');

    const decisionText = card.elements.find(
      (e) => e.tag === 'markdown' && e.content?.startsWith('**📌'),
    );
    expect(decisionText?.content).toContain('能力圈');
    expect(decisionText?.content).toContain('不换');

    const action = card.elements.find((e) => e.tag === 'action');
    expect(action?.actions?.[0]?.url).toBe('https://example.com/?c=abcd1234');
  });

  it('truncates very long questions in the header', () => {
    const longQuestion = '问'.repeat(200);
    const card = buildCouncilCard({
      question: longQuestion,
      advisorNames: [],
      cards: [],
      discussionMessages: [],
      shareUrl: 'https://example.com/?c=abc',
    }) as { header: { title: { content: string } } };
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
    }) as { elements: Array<{ tag: string; content?: string }> };
    const warning = card.elements.find((e) => e.content?.includes('解析失败'));
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
    }) as { elements: Array<{ tag: string; content?: string }> };

    const joined = card.elements.map((e) => e.content || '').join('\n');
    expect(joined).not.toContain('<b>');
    expect(joined).not.toContain('`');
    expect(joined).not.toContain('<x>');
  });
});

describe('buildPendingCard', () => {
  it('produces a wathet-templated card with question + count', () => {
    const card = buildPendingCard('该不该裸辞', 12) as {
      header: { template: string; title: { content: string } };
      elements: Array<{ tag: string; content?: string }>;
    };
    expect(card.header.template).toBe('wathet');
    expect(card.elements[0].content).toContain('该不该裸辞');
    expect(card.elements[0].content).toContain('12 位');
  });
});
