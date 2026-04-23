import type { AdvisorSkill } from '../../../src/types/advisor';

export interface AnalyzePromptParams {
  session: { question: string; context?: string };
  rounds: Array<{
    advisorId: string;
    advisorName: string;
    content: string;
    meta: { usedModels: string[]; modelBriefs: Record<string, string> };
  }>;
  advisors: AdvisorSkill[];
}

export function buildAnalyzePrompt(p: AnalyzePromptParams): string {
  const roundsBlock = p.rounds
    .map((r) => {
      const advisor = p.advisors.find((a) => a.frontmatter.id === r.advisorId);
      const library =
        advisor?.mentalModels.map((m) => m.name).join('、') ??
        '（未知军师，按自报处理）';
      const briefLines = Object.entries(r.meta.modelBriefs)
        .map(([k, v]) => `  ${k}: ${v}`)
        .join('\n');
      return `## ${r.advisorName}（advisorId: ${r.advisorId}）

### 此军师的心智模型库（权威列表，自报必须在此范围内）
${library}

### 此军师的自然发言
${r.content}

### 此军师自报的本次心智模型运用
usedModels: ${JSON.stringify(r.meta.usedModels)}
modelBriefs:
${briefLines}`;
    })
    .join('\n\n');

  return `你是"思维分析员（Analyst）"。一场由多位顶级思维人物组成的圆桌会议刚结束，
你要对每位军师的发言做 post-hoc 结构化归纳——每位军师一张"最终决策卡"。

# 用户的问题

${p.session.question}
${p.session.context ? `\n背景：${p.session.context}` : ''}

# 军师们的发言 + 自报元数据

${roundsBlock}

# 你的任务

你是校验员，不是推理员。军师已经自报了本次用了哪些心智模型及"怎么用的"，你的任务是：

1. 校验每位军师的自报（对每个 usedModels 条目）：
   a. 该模型名字是否在此军师的"心智模型库"里？（必须是）
   b. 该模型的 briefOfUsage 是否在军师的自然发言里有对应痕迹？（必须是）
2. 校验通过 → 直接使用军师自报的 usedModels 和 modelBriefs
3. 校验失败 → 修正并在 discrepancy 字段记录原因
4. 归纳 conclusion + reasoning（这两项军师不自报）

为每位军师生成一张 JSON 卡片：

{
  "advisorId": "munger",
  "characterName": "芒格",
  "conclusion": "一句话结论（≤40 字，明确立场，不含可能/或许）",
  "reasoning": "80-150 字的推理过程",
  "mentalModels": [
    { "name": "逆向思考", "briefOfUsage": "反推\\"什么情况下换工作必失败\\"" }
  ]
}

严格约束：
1. 不要凭空推测心智模型——以军师自报为准
2. mentalModels.name 必须在该军师的心智模型库里
3. 不跨军师串色
4. conclusion 要明确
5. reasoning 不能是 conclusion 的重复
6. 不要替用户做决定——conclusion 是这位军师的立场

输出格式：严格 JSON 数组，不要包 markdown 代码块：

[
  { "advisorId": "...", "characterName": "...", "conclusion": "...", "reasoning": "...", "mentalModels": [{...}] }
]

数组顺序与军师发言顺序一致。`;
}
