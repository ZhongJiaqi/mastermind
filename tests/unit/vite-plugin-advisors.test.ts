import { describe, expect, it } from 'vitest';
import path from 'path';
import { loadAdvisors, validateAdvisors } from '../../vite-plugins/advisors';

const FIXTURE_ROOT = path.resolve(__dirname, '../../advisors/_fixtures');

describe('loadAdvisors', () => {
  it('parses SKILL.md into AdvisorSkill objects', async () => {
    const advisors = await loadAdvisors(FIXTURE_ROOT);
    const minimal = advisors.find((a) => a.frontmatter.id === 'valid-minimal');
    expect(minimal).toBeDefined();
    expect(minimal!.frontmatter.name).toBe('测试军师');
    expect(minimal!.mentalModels).toHaveLength(3);
    expect(minimal!.mentalModels[0].name).toBe('模型 A');
    expect(minimal!.mentalModels[0].method).toContain('最简陈述');
  });
});

describe('validateAdvisors', () => {
  it('passes when advisor has >= 3 mental models', async () => {
    const advisors = await loadAdvisors(FIXTURE_ROOT);
    const minimal = advisors.filter((a) => a.frontmatter.id === 'valid-minimal');
    expect(() => validateAdvisors(minimal)).not.toThrow();
  });

  it('throws when advisor has < 3 mental models', async () => {
    const advisors = await loadAdvisors(FIXTURE_ROOT);
    const bad = advisors.filter((a) => a.frontmatter.id === 'invalid-missing-m');
    expect(() => validateAdvisors(bad)).toThrow(/at least 3 mental models/i);
  });

  it('throws when frontmatter is missing required fields', () => {
    const bad = [{
      frontmatter: { id: 'x', name: '', tagline: '', avatarColor: '', speakStyle: '', version: '0.1' },
      mentalModels: [{ name: 'a', method: 'x', tendency: 'x', signal: 'x' },
                     { name: 'b', method: 'x', tendency: 'x', signal: 'x' },
                     { name: 'c', method: 'x', tendency: 'x', signal: 'x' }],
      quotes: '',
      blindspots: '',
      speakStyle: '',
      raw: '',
    }] as any;
    expect(() => validateAdvisors(bad)).toThrow(/name/);
  });
});
