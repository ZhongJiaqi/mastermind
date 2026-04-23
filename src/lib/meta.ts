export function stripMetaBlock(text: string): string {
  return text.replace(/\n*<meta>[\s\S]*?<\/meta>\n*/g, '').trim();
}

/**
 * 流式场景下的 strip：对完整 <meta>...</meta> 块等同于 stripMetaBlock，
 * 但还能处理两种未完成态：
 *  1. `<meta>` 已出现但 `</meta>` 还没到 —— 截断 `<meta>` 及其后的所有内容
 *  2. 末尾出现 `<` / `<m` / `<me` / `<met` / `<meta` 这种 tag 前缀 —— 暂时截断，
 *     等下一个 chunk 确认这是 meta 标签的开头还是普通文本再决定
 *
 * 用于 Discussion 组件实时渲染 `round.content`，避免用户在 LLM 输出 meta 块
 * 时短暂看到它。
 */
export function stripMetaBlockStreaming(text: string): string {
  // 完整块先剥离
  const afterComplete = text.replace(/\n*<meta>[\s\S]*?<\/meta>\n*/g, '');
  // 出现 <meta> 但无 </meta> —— 截断
  const openIdx = afterComplete.indexOf('<meta>');
  if (openIdx >= 0) return afterComplete.slice(0, openIdx).trimEnd();
  // 末尾可能是部分 tag 前缀：<m, <me, <met, <meta
  const partial = afterComplete.match(/<m(?:e(?:t(?:a)?)?)?$/);
  if (partial) return afterComplete.slice(0, partial.index).trimEnd();
  return afterComplete;
}

export interface AdvisorMeta {
  usedModels: string[];
  modelBriefs: Record<string, string>;
}

export function parseMetaBlock(text: string): AdvisorMeta {
  const match = text.match(/<meta>([\s\S]*?)<\/meta>/);
  if (!match) return { usedModels: [], modelBriefs: {} };
  const body = match[1];
  const usedModels: string[] = [];
  const modelBriefs: Record<string, string> = {};

  const usedSection = body.match(/usedModels:\s*([\s\S]*?)(?=\nmodelBriefs:|\n?$)/);
  if (usedSection) {
    for (const line of usedSection[1].split('\n')) {
      const m = line.trim().match(/^-\s+(.+)$/);
      if (m) usedModels.push(m[1].trim());
    }
  }
  const briefSection = body.match(/modelBriefs\s*[:：]\s*\n([\s\S]*)$/);
  if (briefSection) {
    for (const line of briefSection[1].split('\n')) {
      const m = line.match(/^\s*([^:：\s][^:：]*)[:：]\s*(.+)$/);
      if (m) modelBriefs[m[1].trim()] = m[2].trim();
    }
  }
  return { usedModels, modelBriefs };
}
