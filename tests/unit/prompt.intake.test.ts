import { describe, expect, it } from 'vitest';
import { buildIntakePrompt } from '../../api/_shared/prompts/intake';

describe('buildIntakePrompt', () => {
  it('includes all required fields', () => {
    const prompt = buildIntakePrompt({
      question: '我该不该跳槽',
      context: '大厂五年',
      options: '去创业公司 / 留守',
      leaning: '倾向跳',
      selectedAdvisorNames: ['芒格', '巴菲特'],
    });
    expect(prompt).toContain('你是一位经验丰富的主持人');
    expect(prompt).toContain('我该不该跳槽');
    expect(prompt).toContain('大厂五年');
    expect(prompt).toContain('倾向跳');
    expect(prompt).toContain('芒格、巴菲特');
    expect(prompt).toContain('needsClarification');
  });

  it('handles missing optional fields gracefully', () => {
    const prompt = buildIntakePrompt({
      question: '今晚吃什么',
      selectedAdvisorNames: ['芒格'],
    });
    expect(prompt).toContain('今晚吃什么');
    expect(prompt).toContain('（未填）');
  });
});
