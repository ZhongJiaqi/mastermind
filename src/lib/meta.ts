export function stripMetaBlock(text: string): string {
  return text.replace(/\n*<meta>[\s\S]*?<\/meta>\n*/g, '').trim();
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
  const briefSection = body.match(/modelBriefs:\s*([\s\S]*)$/);
  if (briefSection) {
    for (const line of briefSection[1].split('\n')) {
      const m = line.match(/^\s+([^:]+):\s*(.+)$/);
      if (m) modelBriefs[m[1].trim()] = m[2].trim();
    }
  }
  return { usedModels, modelBriefs };
}
