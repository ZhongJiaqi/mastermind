import { describe, expect, it } from 'vitest';
import { buildAdvisorPrompt } from '../../api/_shared/prompts/advisor';
import type { AdvisorSkill } from '../../src/types/advisor';

const munger: AdvisorSkill = {
  frontmatter: { id: 'munger', name: '芒格', tagline: '多元思维', avatarColor: 'oklch(1 0 0)', speakStyle: '严谨·格言', version: '0.1' },
  mentalModels: [
    { name: '逆向思考', method: '反过来想', tendency: '避愚蠢', signal: '选项太多时' },
    { name: '能力圈', method: '圈内判断', tendency: '不懂不碰', signal: '陌生领域' },
    { name: '误判心理学', method: '识别偏差', tendency: '怀疑直觉', signal: '情绪激动时' },
  ],
  quotes: '> Invert, always invert.',
  blindspots: '- lattice 不全时',
  speakStyle: '- 引用学科类比',
  raw: '',
};

describe('buildAdvisorPrompt', () => {
  it('injects advisor identity + M/Q/B/S into prompt', () => {
    const p = buildAdvisorPrompt({
      advisor: munger,
      session: { question: '我该不该跳槽' },
      priorRounds: [],
    });
    expect(p).toContain('你是 芒格');
    expect(p).toContain('多元思维');
    expect(p).toContain('逆向思考');
    expect(p).toContain('反过来想');
    expect(p).toContain('Invert');
    expect(p).toContain('我该不该跳槽');
  });

  it('includes <meta> block instruction', () => {
    const p = buildAdvisorPrompt({ advisor: munger, session: { question: 'q' }, priorRounds: [] });
    expect(p).toContain('<meta>');
    expect(p).toContain('usedModels');
    expect(p).toContain('modelBriefs');
  });

  it('adds first-speaker preamble when priorRounds is empty', () => {
    const p = buildAdvisorPrompt({ advisor: munger, session: { question: 'q' }, priorRounds: [] });
    expect(p).toContain('你是第一位发言者');
  });

  it('adds behavior rules when priorRounds has entries', () => {
    const p = buildAdvisorPrompt({
      advisor: munger,
      session: { question: 'q' },
      priorRounds: [{ advisorId: 'buffett', advisorName: '巴菲特', content: '我认为要稳健' }],
    });
    expect(p).toContain('前面已发言的军师');
    expect(p).toContain('巴菲特');
    expect(p).toContain('我认为要稳健');
    expect(p).toContain('禁止 echo');
  });

  it('inlines clarifications when present', () => {
    const p = buildAdvisorPrompt({
      advisor: munger,
      session: {
        question: 'q',
        clarifications: [{ question: '现金流如何', answer: '还行' }],
      },
      priorRounds: [],
    });
    expect(p).toContain('现金流如何');
    expect(p).toContain('还行');
  });
});
