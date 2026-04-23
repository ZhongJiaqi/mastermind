import { describe, expect, it } from 'vitest';
import { stripMetaBlock, parseMetaBlock } from '../../src/lib/meta';

describe('stripMetaBlock', () => {
  it('removes <meta>...</meta> block', () => {
    const input = 'hello world\n\n<meta>\nusedModels:\n  - x\n</meta>';
    expect(stripMetaBlock(input)).toBe('hello world');
  });
  it('returns input unchanged when no meta', () => {
    expect(stripMetaBlock('hello')).toBe('hello');
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
});
