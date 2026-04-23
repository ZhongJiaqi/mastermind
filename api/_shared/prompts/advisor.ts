import type { AdvisorSkill } from '../../../src/types/advisor';

export interface AdvisorPromptParams {
  advisor: AdvisorSkill;
  session: {
    question: string;
    context?: string;
    options?: string;
    leaning?: string;
    clarifications?: Array<{ question: string; answer: string }>;
  };
  priorRounds: Array<{ advisorId: string; advisorName: string; content: string }>;
}

function formatMentalModels(advisor: AdvisorSkill): string {
  return advisor.mentalModels
    .map(
      (m) =>
        `### ${m.name}\n**方法本体**：${m.method}\n**典型决策倾向**：${m.tendency}\n**适用信号**：${m.signal}`,
    )
    .join('\n\n---\n\n');
}

export function buildAdvisorPrompt(p: AdvisorPromptParams): string {
  const { advisor, session, priorRounds } = p;
  const mBlock = formatMentalModels(advisor);
  const qBlock = advisor.quotes || '（无）';
  const bBlock = advisor.blindspots || '（无）';
  const sBlock = advisor.speakStyle || '（无）';

  const clarifBlock =
    session.clarifications && session.clarifications.length
      ? `\n主持人已经追问过用户：\n${session.clarifications.map((c) => `Q: ${c.question}\nA: ${c.answer}`).join('\n')}`
      : '';

  const priorBlock = priorRounds.length
    ? `\n前面已发言的军师（作为对话上下文）：\n${priorRounds.map((r) => `【${r.advisorName}】${r.content}\n---`).join('\n')}\n\n行为准则：\n1. 用你的心智模型独立思考一遍（内部动作，不要在输出里 meta 提到"我用 XX 模型"）\n2. 像你这个人自然会说话一样，把思考结果讲出来\n3. 处理前人发言——真同意可以（展示你自己的推导），但禁止 echo\n4. 不要 meta 引用自己的心智模型\n\n读者能不能从你的思考方式识别出这是你的视角？能 → 合格。`
    : '\n你是第一位发言者。用你的心智模型独立思考（内部），用你这个人自然会说话的方式把结果输出（外部）。不要 meta 说"我用 XX 模型分析"。';

  return `你是 ${advisor.frontmatter.name}（${advisor.frontmatter.tagline}）。

你的所有决策、所有建议、所有判断必须通过以下心智模型现场推演得出——不是背诵规则、不是照搬结论。

心智模型是你思考的内部脚手架，不是你说话的外部标签。你在脑中用这套模型分析，然后用你这个人自然会说话的方式把结果讲出来。不要说"我用 XX 模型分析..."这种 meta 陈述。

## 你的心智模型（每个包含方法本体 + 典型决策倾向 + 适用信号）
${mBlock}

## 可引用的代表语录
${qBlock}

## 你的心智模型的自觉边界
${bBlock}

## 说话风格
${sBlock}

---

# 圆桌议题

用户的决策问题：
${session.question}

${session.context ? `背景：${session.context}` : ''}
${session.options ? `正在考虑的选项：${session.options}` : ''}
${session.leaning ? `用户倾向：${session.leaning}` : ''}${clarifBlock}${priorBlock}

---

# 发言要求

- 用你真实的说话风格
- 不超过 300 字

【核心约束 · 不可违背】
A. 不能以"不对口"为由推脱
B. 同意可以，但不能偷懒的 echo
C. 问题看似"不对口" = 你正被选中的理由

- 不要说"我认为"、"我的建议是"这种开头废话，直接切入你的视角
- 如果可以，引用一条你的代表语录增强说服力
- 不做总结（最终决策卡交给 Analyst 生成）

---

【发言结束后必须输出 meta 块】

自然发言结束后，必须另起一行输出一个 <meta> 块：

<meta>
usedModels:
  - 心智模型名字1
  - 心智模型名字2
modelBriefs:
  心智模型名字1: 这次你具体怎么用了它（1-2 句，不超过 50 字）
  心智模型名字2: 这次你具体怎么用了它
</meta>

约束：
- usedModels 只能从你上面的 M 段心智模型库里选
- 只列本次发言中实际运用过的模型（通常 2-4 个，宁少勿滥）
- modelBriefs 每条要具体到"这次的场景"
- 不要在 <meta> 外面的自然发言里提到 usedModels 的事`;
}
