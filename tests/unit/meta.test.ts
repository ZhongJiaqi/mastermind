import { describe, expect, it } from 'vitest';
import { stripMetaBlock, stripMetaBlockStreaming, parseMetaBlock } from '../../src/lib/meta';

describe('stripMetaBlock', () => {
  it('removes <meta>...</meta> block', () => {
    const input = 'hello world\n\n<meta>\nusedModels:\n  - x\n</meta>';
    expect(stripMetaBlock(input)).toBe('hello world');
  });
  it('returns input unchanged when no meta', () => {
    expect(stripMetaBlock('hello')).toBe('hello');
  });
});

describe('stripMetaBlockStreaming', () => {
  it('behaves like stripMetaBlock for complete blocks', () => {
    const input = 'hello world\n\n<meta>\nusedModels:\n  - x\n</meta>';
    expect(stripMetaBlockStreaming(input)).toBe('hello world');
  });
  it('truncates at unclosed <meta> open tag (streaming mid-block)', () => {
    const input = 'visible speech\n\n<meta>\nusedModels:\n  - 安全';
    expect(stripMetaBlockStreaming(input)).toBe('visible speech');
  });
  it('truncates partial "<m" / "<me" / "<met" / "<meta" tail prefixes', () => {
    expect(stripMetaBlockStreaming('hello <m')).toBe('hello');
    expect(stripMetaBlockStreaming('hello <me')).toBe('hello');
    expect(stripMetaBlockStreaming('hello <met')).toBe('hello');
    expect(stripMetaBlockStreaming('hello <meta')).toBe('hello');
  });
  it('keeps a lone "<" since it might be normal text', () => {
    // 单独一个 '<' 不切掉——可能是真实内容（如数学表达）
    expect(stripMetaBlockStreaming('x < 5 is')).toBe('x < 5 is');
  });
  it('returns input unchanged when no meta fragment anywhere', () => {
    expect(stripMetaBlockStreaming('完整自然发言，没有任何 meta 标签。')).toBe('完整自然发言，没有任何 meta 标签。');
  });
});

describe('parseMetaBlock', () => {
  it('parses usedModels and modelBriefs', () => {
    const meta = parseMetaBlock(`<meta>
usedModels:
  - 逆向思考
  - 误判心理学
modelBriefs:
  逆向思考: 反推失败情形
  误判心理学: 识别逃离动机偏差
</meta>`);
    expect(meta.usedModels).toEqual(['逆向思考', '误判心理学']);
    expect(meta.modelBriefs['逆向思考']).toBe('反推失败情形');
  });
  it('returns empty when no meta block', () => {
    expect(parseMetaBlock('no meta here')).toEqual({ usedModels: [], modelBriefs: {} });
  });
  it('accepts full-width colon "：" in modelBriefs (Chinese output)', () => {
    const meta = parseMetaBlock(`<meta>
usedModels:
  - 安全边际
  - 能力圈
modelBriefs:
  安全边际：用确定性工资替代期权
  能力圈：对创业公司未来判断力不足
</meta>`);
    expect(meta.modelBriefs['安全边际']).toBe('用确定性工资替代期权');
    expect(meta.modelBriefs['能力圈']).toBe('对创业公司未来判断力不足');
  });
});
