import { describe, expect, it } from 'vitest';
import { buildAnalyzePrompt } from '../../api/_shared/prompts/analyze';
import type { AdvisorSkill } from '../../src/types/advisor';

const munger: AdvisorSkill = {
  frontmatter: { id: 'munger', name: '芒格', tagline: 't', avatarColor: 'oklch(1 0 0)', speakStyle: 's', version: '0.1' },
  mentalModels: [
    { name: '逆向思考', method: '反过来想', tendency: '避愚蠢', signal: '选项太多时' },
    { name: '能力圈', method: '圈内判断', tendency: '不懂不碰', signal: '陌生领域' },
    { name: '误判心理学', method: '识别偏差', tendency: '怀疑直觉', signal: '情绪激动时' },
  ],
  quotes: '', blindspots: '', speakStyle: '', raw: '',
};

describe('buildAnalyzePrompt', () => {
  it('injects advisor mental model library for validation', () => {
    const p = buildAnalyzePrompt({
      session: { question: '我该不该跳槽' },
      rounds: [{
        advisorId: 'munger', advisorName: '芒格', content: '反过来想，什么情况下跳槽必失败？',
        meta: { usedModels: ['逆向思考'], modelBriefs: { '逆向思考': '反推失败情境' } },
      }],
      advisors: [munger],
    });
    expect(p).toContain('思维分析员');
    expect(p).toContain('我该不该跳槽');
    expect(p).toContain('芒格');
    expect(p).toContain('心智模型库');
    expect(p).toContain('逆向思考、能力圈、误判心理学');
    expect(p).toContain('usedModels: ["逆向思考"]');
    expect(p).toContain('反推失败情境');
  });

  it('stresses validator role (not reasoner)', () => {
    const p = buildAnalyzePrompt({ session: { question: 'q' }, rounds: [], advisors: [] });
    expect(p).toContain('你是校验员');
    expect(p).toContain('不要凭空推测心智模型');
  });

  it('specifies strict JSON array output', () => {
    const p = buildAnalyzePrompt({ session: { question: 'q' }, rounds: [], advisors: [] });
    expect(p).toContain('严格 JSON 数组');
    expect(p).toContain('不要包 markdown 代码块');
    expect(p).toContain('conclusion');
    expect(p).toContain('reasoning');
    expect(p).toContain('mentalModels');
  });
});
