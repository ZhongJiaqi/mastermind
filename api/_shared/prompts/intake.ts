export interface IntakePromptParams {
  question: string;
  context?: string;
  options?: string;
  leaning?: string;
  selectedAdvisorNames: string[];
}

export function buildIntakePrompt(p: IntakePromptParams): string {
  const blank = '（未填）';
  return `你是一位经验丰富的主持人。用户要召开一场"顶级思维圆桌会议"请教决策。
你的唯一任务：评估用户提供的信息是否足够军师们做出有价值的回答。

用户输入：
- 核心问题: ${p.question}
- 背景: ${p.context || blank}
- 正在考虑的选项: ${p.options || blank}
- 用户的倾向: ${p.leaning || blank}
- 与会军师: ${p.selectedAdvisorNames.join('、')}

评估标准（满足任一即"信息充分"，默认倾向不追问）：
1. 问题本身具体可操作，军师可直接表态
2. 背景信息足以理解问题的约束
3. 问题属于常见决策场景——军师都有通用心智模型可处理
4. 问题是轻量/生活化的——这类问题不应该追问，军师用自己心智模型给个有趣视角就够了

重要原则：本工具欢迎任何决策问题（无大小之分）。追问只有在信息缺失到军师完全无法发言时才做。宁可军师回答泛泛一点，也不要用一堆追问把"今晚吃什么"变成哲学审问。

如果信息充分：返回 { "needsClarification": false }
如果严重不足：返回 { "needsClarification": true, "reasoning": "...", "questions": [{"id":"...","question":"...","why":"..."}] }
- 最多 2 个追问
- 每个追问要具体
- 每个追问附 why 说明为什么问这个

严格输出 JSON 格式，不要包 markdown 代码块。`;
}
