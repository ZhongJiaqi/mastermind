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
        `  - ${m.name}\n    方法本体：${m.method}\n    典型决策倾向：${m.tendency}\n    适用信号：${m.signal}`,
    )
    .join('\n');
}

function formatAdvisorBlock(advisor: AdvisorSkill): string {
  return `### ${advisor.frontmatter.name}（${advisor.frontmatter.tagline}）

心智模型：
${formatMentalModels(advisor)}

代表引用：
${advisor.quotes || '（无）'}

自觉边界：
${advisor.blindspots || '（无）'}

说话风格：
${advisor.speakStyle || '（无）'}`;
}

export function buildCouncilPrompt(p: CouncilPromptParams): string {
  const advisorBlocks = p.advisors.map(formatAdvisorBlock).join('\n\n---\n\n');
  const { question, context, options, leaning, clarifications } = p.session;

  const contextBlock = context ? `\n背景：${context}` : '';
  const optionsBlock = options ? `\n正在考虑的选项：${options}` : '';
  const leaningBlock = leaning ? `\n用户倾向：${leaning}` : '';
  const clarifBlock =
    clarifications && clarifications.length
      ? `\n\n主持人追问记录：\n${clarifications.map((c) => `Q: ${c.question}\nA: ${c.answer}`).join('\n\n')}`
      : '';

  const modelCatalog = p.advisors
    .map(
      (a) =>
        `- ${a.frontmatter.name}（id: ${a.frontmatter.id}）可用模型：${a.mentalModels.map((m) => m.name).join('、')}`,
    )
    .join('\n');

  const nameList = p.advisors.map((a) => a.frontmatter.name).join('、');
  const idList = p.advisors.map((a) => a.frontmatter.id).join(', ');

  return `你是一场圆桌会议的主持 + 全体演员。以下 ${p.advisors.length} 位人物参会：

${advisorBlocks}

---

# 用户的决策问题

${question}${contextBlock}${optionsBlock}${leaningBlock}${clarifBlock}

---

# 行为准则

1. 让这 ${p.advisors.length} 位人物根据各自的心智模型和性格**自由碰撞一轮**。
2. 每位人物至少发言 1 次；但节奏、次数、长短、谁反驳谁、谁先谁后，由你根据性格和话题冲突度**自由决定**。
3. 性格鲜明的人可多次打断或反驳；克制的人可一针见血后沉默。
4. 全场 discussion 累计**不超过 1500 字**。每条消息最多 120 字，宁可短不要长。
5. 用各自真实的说话风格（参考"说话风格"字段）——不要 meta 陈述"我用 XX 心智模型分析"。心智模型是思考工具，不是口头禅。
6. 允许真同意（展示自己独立推导过程），禁止偷懒的附议（只说"我同意"而无自己的视角）。
7. 讨论名单：${nameList}，不可引入名单外的人物。

---

# 严格输出格式（两个块都必须出现，完整且闭合）

<discussion>
人物名: 发言内容（一行一条消息；换行开启新消息；同一人可多次出现；人物名必须与上方名单一致）
人物名: 下一条消息
...
</discussion>

<conclusions>
[
  {
    "advisorId": "munger",
    "characterName": "查理·芒格",
    "conclusion": "≤40 字，明确立场，不含'可能/或许'这类软化词",
    "reasoning": "80-150 字的推理链，不是 conclusion 的复读",
    "mentalModels": [
      { "name": "模型名（必须在下方该人物的心智模型目录里）", "briefOfUsage": "这次你具体怎么用了它，1-2 句" }
    ]
  }
]
</conclusions>

---

# 心智模型目录（conclusions 里每人的 mentalModels.name 必须从对应人物的目录里选）

${modelCatalog}

---

# 输出约束

- discussion 每行格式：\`人物名: 内容\`（半角或全角冒号均可）
- conclusions 是严格 JSON 数组，不要用 markdown 代码块包裹
- 数组元素顺序必须与 [${idList}] 一致
- 每人 mentalModels 2-4 个，不要跨军师串色（A 的模型不能出现在 B 的卡里）
- 先完整输出 <discussion>...</discussion>，再输出 <conclusions>...</conclusions>
- 两个块都必须闭合`;
}
