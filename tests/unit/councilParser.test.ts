import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/generated/advisors', () => ({
  ADVISORS: [
    {
      frontmatter: { id: 'munger', name: '查理·芒格', tagline: 't', avatarColor: 'oklch(1 0 0)', speakStyle: 's', version: '0.1' },
      mentalModels: [{ name: '逆向思考', method: 'm', tendency: 't', signal: 's' }],
      quotes: '', blindspots: '', speakStyle: '',
    },
    {
      frontmatter: { id: 'buffett', name: '沃伦·巴菲特', tagline: 't', avatarColor: 'oklch(1 0 0)', speakStyle: 's', version: '0.1' },
      mentalModels: [{ name: '护城河', method: 'm', tendency: 't', signal: 's' }],
      quotes: '', blindspots: '', speakStyle: '',
    },
  ],
}));

const { parseCouncilStream, resolveAdvisor } = await import('../../src/lib/councilParser');

describe('resolveAdvisor', () => {
  it('matches exact full name', () => {
    expect(resolveAdvisor('查理·芒格')).toEqual({ id: 'munger', name: '查理·芒格' });
  });
  it('matches by id', () => {
    expect(resolveAdvisor('munger')).toEqual({ id: 'munger', name: '查理·芒格' });
  });
  it('matches short form "芒格" to "查理·芒格" (suffix fuzzy)', () => {
    expect(resolveAdvisor('芒格')).toEqual({ id: 'munger', name: '查理·芒格' });
  });
  it('returns null for unknown speaker', () => {
    expect(resolveAdvisor('不存在的人')).toBeNull();
  });
});

describe('parseCouncilStream', () => {
  it('parses complete discussion + conclusions', () => {
    const text = `<discussion>
查理·芒格: 反过来问这决策怎么失败？
沃伦·巴菲特: 我关心护城河。
查理·芒格: 补一句：期权是彩票。
</discussion>

<conclusions>
[
  {"advisorId":"munger","characterName":"查理·芒格","conclusion":"不换","reasoning":"略","mentalModels":[{"name":"逆向思考","briefOfUsage":"b"}]},
  {"advisorId":"buffett","characterName":"沃伦·巴菲特","conclusion":"先看护城河","reasoning":"略","mentalModels":[{"name":"护城河","briefOfUsage":"b"}]}
]
</conclusions>`;
    const r = parseCouncilStream(text);
    expect(r.messages).toHaveLength(3);
    expect(r.messages[0].advisorId).toBe('munger');
    expect(r.messages[1].advisorId).toBe('buffett');
    expect(r.messages[2].advisorId).toBe('munger');
    expect(r.cards).not.toBeNull();
    expect(r.cards).toHaveLength(2);
    expect(r.isComplete).toBe(true);
  });

  it('returns messages mid-stream even if <discussion> is not yet closed', () => {
    const text = `<discussion>
芒格: 反过来问`;
    const r = parseCouncilStream(text);
    expect(r.messages).toHaveLength(1);
    expect(r.messages[0].text).toBe('反过来问');
    expect(r.cards).toBeNull();
    expect(r.isComplete).toBe(false);
  });

  it('handles full-width colon "：" in discussion lines', () => {
    const text = `<discussion>
芒格：反过来想
</discussion>`;
    const r = parseCouncilStream(text);
    expect(r.messages).toHaveLength(1);
    expect(r.messages[0].text).toBe('反过来想');
  });

  it('tolerates conclusions wrapped in ```json fence', () => {
    const text = `<discussion>
芒格: 一句话
</discussion>

<conclusions>
\`\`\`json
[{"advisorId":"munger","characterName":"芒格","conclusion":"x","reasoning":"y","mentalModels":[]}]
\`\`\`
</conclusions>`;
    const r = parseCouncilStream(text);
    expect(r.cards).not.toBeNull();
    expect(r.cards).toHaveLength(1);
  });

  it('falls back gracefully when speaker is unknown (keeps original name)', () => {
    const text = `<discussion>
路人甲: 我是谁
</discussion>`;
    const r = parseCouncilStream(text);
    expect(r.messages).toHaveLength(1);
    expect(r.messages[0].advisorId).toBe('');
    expect(r.messages[0].advisorName).toBe('路人甲');
  });

  it('appends soft-wrapped continuation lines to the previous message', () => {
    const text = `<discussion>
芒格: 第一句
继续第二句没有人名前缀
沃伦·巴菲特: 我的回应
</discussion>`;
    const r = parseCouncilStream(text);
    expect(r.messages).toHaveLength(2);
    expect(r.messages[0].text).toBe('第一句\n继续第二句没有人名前缀');
    expect(r.messages[1].text).toBe('我的回应');
  });
});
