import type { AdvisorSkill } from '../../../src/types/advisor';

export interface CouncilPromptParams {
  advisors: AdvisorSkill[];
  session: {
    question: string;
    context?: string;
    options?: string;
    leaning?: string;
    clarifications?: Array<{ question: string; answer: string }>;
  };
}

function formatMentalModels(advisor: AdvisorSkill): string {
  return advisor.mentalModels
    .map(
      (m) =>
        `- ${m.name}\n  方法本体：${m.method}\n  典型决策倾向：${m.tendency}\n  适用信号：${m.signal}`,
    )
    .join('\n');
}

function formatAdvisorBlock(advisor: AdvisorSkill): string {
  return `## ${advisor.frontmatter.name}（${advisor.frontmatter.tagline}）

心智模型：
${formatMentalModels(advisor)}

代表语录：
${advisor.quotes || '（无）'}

自觉边界：
${advisor.blindspots || '（无）'}

说话风格：
${advisor.speakStyle || '（无）'}`;
}

export function buildCouncilPrompt(p: CouncilPromptParams): string {
  const advisorBlocks = p.advisors.map(formatAdvisorBlock).join('\n\n---\n\n');
  const { question, context, options, leaning, clarifications } = p.session;

  const contextBlock = context ? `\n\n背景：${context}` : '';
  const optionsBlock = options ? `\n\n正在考虑的选项：${options}` : '';
  const leaningBlock = leaning ? `\n\n用户倾向：${leaning}` : '';
  const clarifBlock =
    clarifications && clarifications.length
      ? `\n\n主持人追问记录：\n${clarifications.map((c) => `Q: ${c.question}\nA: ${c.answer}`).join('\n\n')}`
      : '';

  return `你是一场圆桌会议的主持 + 全体演员。请让以下人物根据自己的心智模型和性格，进行一轮相互讨论（碰撞不同的思维模型），然后再分别给出他们的最终决策建议。

# 人物列表

${advisorBlocks}

# 用户的问题

${question}${contextBlock}${optionsBlock}${leaningBlock}${clarifBlock}

# 输出格式（必须含 <discussion> 和 <conclusions> 双块）

<discussion>
人物名: 发言内容
人物名: 发言内容
（谁说几次/什么顺序/长短/节奏自然展开；同一人可多次出现；只能用上方人物名单里的名字，不要引入"主持人"或其他名单外角色）
</discussion>

<conclusions>
[
  {
    "advisorId": "人物 id",
    "characterName": "人物名",
    "conclusion": "≤40 字，明确立场",
    "reasoning": "80-150 字推理",
    "mentalModels": [
      { "name": "模型名（必须来自该人物上方「心智模型」清单）", "briefOfUsage": "这次怎么用了它，1-2 句" }
    ]
  }
]
</conclusions>

约束：
- 不要说"我用 XX 模型分析"这种 meta 陈述——心智模型是思考工具，不是口头禅。
- 必须先完整输出 \`<discussion>...</discussion>\` 块，再紧接着输出 \`<conclusions>...</conclusions>\` 块；两个块都必须闭合，缺一不可。
- conclusions 必须是严格 JSON 数组，不要用 markdown 代码块包裹，不要用自然语言列表代替。`;
}
