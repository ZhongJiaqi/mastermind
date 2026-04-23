# Mastermind 智囊团 · 设计规范

**状态**：Draft · 待 user review
**日期**：2026-04-22
**作者**：ZhongJiaqi（决策） + Claude（文档）
**范围**：在现有 `ZhongJiaqi/mastermind` 仓库基础上，升级为"圆桌式多军师决策工具"的完整 MVP

---

## 1. 概述

### 1.1 产品定义

让不同**心智模型**通过各自的代表人物"人格化"后，为用户的决策提供多视角透视。

用户描述困境 → 选择几位军师（= 选择几种心智模型）→ 军师按顺序在"圆桌"上发言（彼此看得到上一位的观点并可引用/反驳）→ **思维分析员（Analyst）**为每位军师生成结构化的"最终决策卡"：结论 + 推理 + 运用的心智模型（附"这次怎么用"简述）。

### 1.1.1 第一性原理（整个产品的底层命题）

**心智模型是本质，人物是包装。**

- 用户选"芒格"，本质是调用"多元思维模型 + 逆向思考 + 误判心理学"这套思维框架
- 用户选"纳瓦尔"，本质是调用"杠杆 + 特定知识 + 复利"这套思维框架
- 人物名字、头像、说话风格只是 UX 层的把手——让心智模型**可记忆、可辨识、可言说**

**心智模型本身无任何维度限制**——它是一个"思考方法"，不是"领域知识"。思考方法可以应用于任何问题，不论问题的领域、时代、复杂度、严肃程度、是否"对口"。

这条原理推导出了 spec 里所有其他决策：
- ✅ 军师 vault 格式只描述 `M/Q/B/S`（心智模型 / 引用 / 自觉边界 / 说话风格），不设任何"适用场景"字段
- ✅ 主持人不按问题严肃度分级——今晚吃什么和收购决策一视同仁
- ✅ 军师不能说"这不是我擅长领域"——用心智模型透视本身就是他的价值
- ✅ 军师池可以包含古人、虚构人物、跨文化人物——只要其心智模型被正确蒸馏出来

### 1.1.2 术语统一

以下三个词在本 spec 中**同义**，指同一个概念（一个人用来思考和决策的认知框架）：

- **心智模型**（mental models）★ 本 spec 唯一规范用词
- **思维模型** — 同义，仅在"多元思维模型"这种专有名词里保留（是芒格对他心智模型的特定命名）
- **决策原则**（principles）— 早期 v1-v3 曾作为独立字段 `P`，v4 已删除；所有"决策原则"概念已合并进心智模型

**为什么这样统一**：
- 学术上三者可区分（模型=HOW to think, 原则=WHAT to do），但在本产品里，这种区分会诱发 LLM **机械套用规则**（"按原则行事"）而非**现场运用心智模型推演**。
- 为了产品体验和 prompt 效果，我们选择把三者视为同一抽象——统一使用"心智模型"。

**阅读约定**：spec 里凡是出现"决策原则"一词，都是在讨论**早期被删除的旧设计**或在与原项目对比。新增设计一律使用"心智模型"。

### 1.2 目标用户

- **Phase 1（MVP，现在）**：作者自用 + 私域分享（作者挑选的朋友）
- **Phase 2**：公开域名但仍私有分发（只是部署在 Vercel，非主动传播）
- **Phase 3（未来可能）**：产品化（账号系统、付费、社区军师市场）

### 1.3 MVP 非目标（不做）

- ❌ 账号系统 / 登录
- ❌ 服务端持久化（会议记录只存 localStorage）
- ❌ 回看历史 UI（数据留在 localStorage，但不做 UI）
- ❌ RAG（军师知识用拼接塞 prompt 方式，不建向量库）
- ❌ 军师间多轮辩论（只做一轮发言）
- ❌ 追问某位军师（单人深聊）
- ❌ 自定义军师 UI（需要修改仓库并 push 来添加）

---

## 2. 设计决策汇总

14 个关键决策及依据：

| # | 决策点 | 方案 | 关键理由 |
|---|---|---|---|
| Q1 | 目标人群 | 私域公开部署（A→B 过渡） | 先验证自用价值，架构支持无缝上线 |
| Q2 | 形态 | Web app（继承 Vite）| 复用 mastermind 基础设施 |
| Q3 | 议事方式 | 圆桌（军师互相看得到） | 符合"谋士团"隐喻，避免各说各话 |
| Q4 | 军师库 | 预置（9 位） + 未来可自定义 | MVP 手动维护 vault |
| Q5 | 议事结构 | 每人一轮 + Analyst（思维分析员）生成最终决策卡 | 成本可控，价值密度高 |
| Q6 | 军师知识 | Obsidian vault + 拼接塞 prompt（无 RAG） | YAGNI，等不够再上 RAG |
| Q7 | 输入方式 | 结构化表单 + 主持人内嵌追问 | 逼用户先整理思路，主持人兜底 |
| Q8 | 会议 UI | 顺序流 + 流式直播（无回看） | 临场感最强，MVP 最小摩擦 |
| Q9 | 历史 | localStorage 本地保留，无服务端 | 零存储负担，未来可扩展 |
| Q10/11 | 部署 | 公开 URL + 私域分发 | 技术最简，风险由分发控制 |
| Q13 | LLM | Qwen 3 via DashScope（`qwen3-max` + `qwen3-max`） | 单场 ~¥0.18，中文最强的便宜选择 |
| Q14 | 军师选择器 | 2x4 grid（保留 mastermind 现状） | 现有实现已足够 |
| UI-2 | 布局 | 状态切换（空闲左右两栏 / 会议全宽） | 兼顾输入效率 + 会议沉浸感 |
| UI-6 | 视觉 | 纯 Sans（沿用 mastermind 现状） | 干净现代，不画蛇添足 |

---

## 3. 架构

### 3.1 系统图

```
┌─────────────────── 浏览器 ───────────────────┐
│                                              │
│  Vite + React 19 + TS + Tailwind + Motion    │
│                                              │
│  空闲态 ─── 2 列布局 ──────────────┐        │
│  ├─ 左：军师 grid + 结构化表单     │        │
│  └─ 右：空状态卡片                 │        │
│                                    │        │
│  会议态 ─── 全宽布局（transform）──┤        │
│  ├─ 顶部：问题摘要（折叠）         │        │
│  ├─ 最终决策卡（会议结束置顶）     │        │
│  └─ 圆桌纪实（sequential stream）  │        │
│                                    │        │
│  localStorage ← 会议结果           │        │
└────────────┬─────────────────────────────────┘
             │ fetch（sequential）+ SSE streaming
             ▼
┌────────────── Vercel Functions ──────────────┐
│                                              │
│  /api/intake-clarify  主持人评估追问         │
│    输入: { question, context, options, ... } │
│    输出: { needsClarification, questions[] } │
│                                              │
│  /api/advisor/[id]    单个军师发言（SSE）    │
│    输入: { question, context, priorRounds } │
│    输出: SSE 流（chunk-by-chunk）            │
│          军师输出末尾附隐藏 <meta> 块        │
│          列出本次使用的心智模型              │
│                                              │
│  /api/analyze         思维分析员（SSE）      │
│    输入: { question, allResponses+meta }    │
│    输出: SSE 流推送 per-character 决策卡    │
│                                              │
└────────────┬─────────────────────────────────┘
             │ OpenAI 兼容 API
             ▼
     DashScope · Qwen 3 系列
     ├─ qwen3-max   (军师发言，1M context)
     └─ qwen3-max    (Analyst 思维分析员，262k context)

┌────────── Git 仓库（= 数据源）──────────────┐
│                                              │
│  advisors/                                   │
│    buffett/                                  │
│      SKILL.md      (nuwa-skill 结构)         │
│      quotes.md                               │
│    munger/SKILL.md                           │
│    musk/SKILL.md                             │
│    caocao/SKILL.md                           │
│    duan-yongping/SKILL.md                    │
│    zhangxiaolong/SKILL.md                    │
│    zhenhuan/SKILL.md                         │
│    trump/SKILL.md                            │
│                                              │
│  build-time：vite-plugin 读取 → 打包 JSON    │
│              → runtime 零 fs 依赖            │
└──────────────────────────────────────────────┘
```

### 3.2 关键架构原则

1. **Vault 存在仓库内（`./advisors/`）**：用户在本地用 Obsidian 打开这个子目录当 vault 编辑，`git push` → Vercel 重建 → 线上生效
2. **Build-time 读 vault**：用一个 Vite 插件在 build 时把 `./advisors/**/*.md` 读成 JSON 常量，runtime 无需文件系统
3. **客户端编排 + N 次独立调用（而非单次调用扮多人）**：前端 for 循环依次调 `/api/advisor/[id]`

   **为什么 N 次独立调用，而非一次调用让 LLM 扮多人？**
   
   注意：单次调用让 LLM 扮多人**本身不会产生错误输出**——只要每个角色的 M 被准确激活，输出就是符合需求的。选择 N 次独立调用的理由**不是正确性**，而是 4 个工程层面：
   
   - **UX 流式直播**：单次调用 = 等全部生成完才看到第一句；N 次 = 每位军师逐个出现（这是 §7 选的 Q8 A 方案的前提）
   - **失败隔离**：单次调用中途失败 = 整场会议废掉；N 次 = 只需重试失败那一位
   - **System prompt 权重更高**："You are 芒格" 放在 system role 里，人设比放在 user role 里稳定得多
   - **Vercel 60s 限制**：单次调用 5 位军师 + synth 可能 ≥60s；N 次每次 ≤15s 安全
   
   综合取舍 → N 次调用 + 客户端编排。

4. **无状态服务端**：三个 API 都是纯 stateless，无数据库、无会话

---

## 4. 数据模型

### 4.1 军师 SKILL.md 格式（对齐 nuwa-skill）

每位军师一个文件夹，至少包含 `SKILL.md`。可选补充 `quotes.md` / `blindspots.md` 等。

**核心原则**（引用 §1.1.1 第一性原理）：

> 心智模型是本质，人物是包装。心智模型本身无任何维度限制——任何思考方法都可以应用于任何问题。

因此 SKILL.md **只描述心智模型和它的表达壳**：

- **M — 心智模型（Mental Models）** ★ 核心：认知工具 / 思考方法。每个模型包含三部分：
  1. **方法本体**：这个模型"怎么看一件事"（如：逆向思考 = 先问怎么才能失败）
  2. **典型决策倾向**：这个模型用下去通常会推出什么行为选择（如：逆向思考 → 避免愚蠢优于追求聪明）
  3. **适用信号**：什么时候该启用这个模型
- **Q — 代表引用（Quotes）**：可直接引用的**一手语录**（必须带出处）。价值是防止 LLM 编造金句，不是"原则列表"
- **B — 自觉边界（Blindspots）**：这套心智模型**自身**在极端情况下可能失灵的自觉
- **S — 说话风格（Speak Style）**：UX 识别壳——人物特色语汇、句式偏好、口头禅

**为什么没有单独的"决策原则"字段**：

决策原则是心智模型**推演出来**的产物，不是独立存在的另一层。如果把原则单独列出来，会给 LLM 一个错误激励：**"按规则套用"** 而不是 **"用模型现场推演"**。

对比：
- ❌ 有独立原则字段 → LLM 容易说 "根据'margin of safety'原则，加上'能力圈'原则..."（机械套话，读者学不到思维方法）
- ✅ 只有心智模型 → LLM 必须 "让我逆向思考——什么情况下这个决策会变糟？..."（真实使用工具，读者看到思维过程）

原则应该**内嵌在心智模型的"典型决策倾向"里**作为例子，而不是独立一节。

不描述：
- ❌ 他只回答什么问题（会扼杀跨域洞察）
- ❌ 他生活在什么时代（心智模型超越时代）
- ❌ 什么决策值得他认真对待（一视同仁）

```markdown
---
id: munger
name: 查理·芒格
tagline: 多元思维 / 逆向思考 / 普世智慧
avatarColor: oklch(92% 0.04 80)
speakStyle: 严谨·格言·引用多个学科
sources:
  - 《穷查理宝典》
  - 南加州大学毕业演讲
version: 0.1
---

# 查理·芒格（Charlie Munger）

## M — 核心心智模型（Mental Models）

### 多元思维模型（Latticework of Mental Models）
**方法本体**：把不同学科（心理学/数学/物理/生物学/经济学）的核心模型结成网状结构，
处理真实世界的复杂问题时能从多个角度照射，避免"手里有锤子看啥都像钉子"。

**典型决策倾向**：只在自己真正掌握的多个学科交集内做判断；对完全陌生的领域保留判断。
这个模型推出了芒格著名的"能力圈"原则——不是外部强加的规则，而是 latticework 不全的地方你看不清。

**适用信号**：问题涉及多个相互作用的因素；别人只从一个角度分析时

---

### 逆向思考（Invert, always invert）
**方法本体**：想成功，先问怎么才能失败；想做对，先问怎么才能做错。
这比正面列"怎么做到 X"往往更容易得到可执行的结论。

**典型决策倾向**：优先消除确定的坏选项，而不是优化不确定的好选项；
推出 "Avoid stupidity rather than seek brilliance" 这样的行为倾向。

**适用信号**：正面思考陷入模糊或选项太多时

---

### 误判心理学（25 Standard Causes of Human Misjudgment）
**方法本体**：人会被嫉妒、激励偏差、可得性偏差、社会认同等 25 种系统性偏差误导。
决策前要像 checklist 一样过一遍哪个偏差可能正在生效。

**典型决策倾向**：怀疑"强烈的即时直觉"；警惕"大家都这么做"；
对过度自信打折。

**适用信号**：你或他人情绪激动、群体共识过于整齐、某个选项看起来"显然正确"

（更多模型...）

## Q — 代表引用（可核验一手语录，带出处）

> "Invert, always invert."
> — 芒格，1986 年哈佛学院毕业演讲

> "Show me the incentive and I'll show you the outcome."
> — 芒格，Poor Charlie's Almanack

> "It's remarkable how much long-term advantage people like us have gotten
> by trying to be consistently not stupid, instead of trying to be very intelligent."
> — 芒格，1994 年 USC 商学院演讲

（更多...）

## B — 自觉边界（Blindspots）

这部分是**心智模型自身的失灵模式**（非场景限制）：

- 多元思维模型需要多学科基础，在全新领域（如深度科技）可能 lattice 不全
- 逆向思考在完全未知的领域会变成空转（失败的可能性都列不全）
- 误判心理学会让人走向"怀疑一切直觉"的反向偏差

## S — 说话风格

- 引用多个学科的类比
- 偏格言和 checklist
- 不回避批评（包括对自己）
- 常用短语："Invert"、"circle of competence"、"margin of safety"、"I have nothing to add"
- 面对跨域问题时依然用自己的心智模型透视，不伪装成其他领域专家
```

**字段约束（build-time 校验）**：
- `id` 必填，小写短 slug，与文件夹名一致
- `name` 必填
- `tagline` 必填，≤24 字，显示在军师卡片副标题
- `avatarColor` OKLCH 颜色字符串，用于头像背景
- `speakStyle` 必填，≤40 字，注入 system prompt
- **`M` 段必填**（核心，每个心智模型含"方法本体 + 典型决策倾向 + 适用信号"三部分）
  - 最少 3 个（build-time 校验下限）
  - **建议 5-8 个**（达到"多面手"水平）
  - 上不封顶（只要不重复）
- `Q / B / S` 三段建议都填（Q 尤其建议填，防止 LLM 编造金句）
- **故意不设独立的 `P`（决策原则）字段**——决策原则内嵌在 M 的"典型决策倾向"里，避免"按规则套用"替代"用模型思考"
- **故意不设 `C`（场景限制）字段**——心智模型跨域可用，限制会扼杀跨域洞察价值

**⭐ 核心质量指标：M 段的完整度 = 军师质量**

军师能不能"站得住"，完全取决于其心智模型蒸馏得**够不够全面和深入**：
- **全面**（Breadth）：这个人物**所有**有代表性的心智模型都收录，不只选"最著名的 1-2 个"
  - 反例：芒格只写"逆向思考"——他还有多元思维、误判心理学、正向预期、生态系统思维等
- **深入**（Depth）：每个心智模型三部分都写透，尤其是"典型决策倾向"不能敷衍
  - 反例：只写"逆向思考 = 反过来想"（太浅），缺推出的行为倾向

任何军师上线前需满足：**M 段 ≥ 3 个完整心智模型，理想 5-8 个**。不达标的军师不放进 vault（宁缺毋滥）。

### 4.2 Decision Session（前端内存）

```ts
interface DecisionSession {
  id: string;                 // uuid，会议唯一 ID
  startedAt: number;          // 时间戳
  endedAt?: number;
  input: {
    question: string;         // 核心问题（必填）
    context?: string;         // 背景
    options?: string;         // 正在考虑的选项
    leaning?: string;         // 我的倾向
  };
  clarifications?: Array<{
    question: string;         // 主持人追问的问题
    answer: string;           // 用户的回答
  }>;
  selectedAdvisorIds: string[];
  rounds: Array<{
    advisorId: string;
    content: string;          // 流式累积的完整文本
    status: 'pending' | 'streaming' | 'done' | 'error';
    error?: string;
  }>;
  analysis?: {                      // 重命名自 synthesis（Analyst 产出）
    cards: Array<{
      advisorId: string;
      characterName: string;
      conclusion: string;
      reasoning: string;
      mentalModels: Array<{
        name: string;               // 心智模型名
        briefOfUsage: string;       // 这次具体怎么用（1-2 句）
      }>;
      discrepancy?: string;         // 可选：Analyst 发现军师自报与实际发言不符时标注
    }>;
    status: 'pending' | 'streaming' | 'done' | 'error';
    error?: string;
  };
}
```

### 4.3 localStorage Schema

```ts
// key: "mastermind.sessions"
type StoredSessions = DecisionSession[];    // 倒序，最新在前

// key: "mastermind.prefs"
interface StoredPrefs {
  lastSelectedAdvisorIds?: string[];        // 记住上次选了谁
  apiKey?: string;                          // 未来 BYOK 时存这里
}
```

MVP 写入但不提供 UI 读取（为未来回看功能预留）。Schema 加版本前缀避免后续破坏兼容。

---

## 5. API Contracts

所有 API 位于 Vercel Functions（`api/` 目录下的 `.ts` 文件）。统一响应错误格式：

```json
{ "error": { "code": "STRING", "message": "STRING" } }
```

### 5.1 `POST /api/intake-clarify`

**目的**：主持人评估用户输入信息是否足够开会，不够则生成 2-3 个追问。

**Request**：
```ts
{
  question: string;      // required
  context?: string;
  options?: string;
  leaning?: string;
  selectedAdvisorIds: string[];
}
```

**Response**（非流式，一次返回）：
```ts
{
  needsClarification: boolean;
  reasoning?: string;    // （可选）为什么需要追问
  questions?: Array<{    // 仅当 needsClarification=true
    id: string;
    question: string;
    why: string;         // 为什么问这个（显示给用户）
  }>;
}
```

**模型**：`qwen3-max`（轻量判断任务）

### 5.2 `POST /api/advisor/[id]`

**目的**：单位军师按顺序发言，支持 SSE 流式。

**URL 参数**：`id` = 军师 slug

**Request**：
```ts
{
  session: {
    question: string;
    context?: string;
    options?: string;
    leaning?: string;
    clarifications?: Array<{question, answer}>;
  };
  priorRounds: Array<{
    advisorId: string;
    advisorName: string;
    content: string;   // 前人军师发言，已经 strip 过 <meta> 块
  }>;
}
```

**Response**（SSE stream）：

军师输出包含**两部分**——自然发言主体 + 隐藏 `<meta>` 块：

```
event: chunk
data: {"text": "反过来问"}

event: chunk
data: {"text": "：什么情况下"}

...（自然发言主体，逐字 stream）

event: chunk
data: {"text": "\n\n<meta>\nusedModels: [\"逆向思考\"...]"}

...

event: done
data: {"fullText": "（含 <meta> 块的完整输出）", "displayText": "（stripped 的显示文本）", "meta": {"usedModels": [...], "modelBriefs": {...}}}
```

**输出格式约定**：
- 自然发言主体：300 字左右，无 meta 陈述
- 末尾固定追加一个 `<meta>...</meta>` 块，结构如下：
  ```
  <meta>
  usedModels:
    - 逆向思考
    - 误判心理学
  modelBriefs:
    逆向思考: 反推"什么情况下换工作必失败"
    误判心理学: 识别了"逃离动机"这个偏差
  </meta>
  ```
- **UI 显示时**客户端必须 strip `<meta>` 块（用户看不到）
- 作为 `priorRounds[].content` 传给下一位军师时，也应 strip（军师彼此看不到对方的 meta）
- 只有在**传给 Analyst** 时保留 meta

**模型**：`qwen3-max`（1M 上下文绰绰有余）

**失败策略**：返回 `event: error`，前端标记该军师为 error 状态，用户可点"单独重试"。

### 5.3 `POST /api/analyze` (Analyst · 思维分析员)

**目的**：对所有军师发言做 per-character 结构化归纳——每位军师一张"最终决策卡"（结论 + 推理 + 运用的心智模型 + 这次怎么用）。

**与原项目的对应关系**：

Analyst **沿用原项目 `<conclusions>` 块的结构**（per-character 决策卡），但做三处语义升级：
- 原项目 "principles list" → 改名为 `mentalModels`（语义正确：这些本来就是心智模型，不是行为承诺）
- 结构从"原则名字 list"升级为"{ 名字 + 这次怎么用 }"——附加 briefOfUsage 提供学习价值
- **心智模型来源改为军师自报 + Analyst 校验**（不再由 Analyst 凭推理猜测，避免误识别）

**Request**：
```ts
{
  session: { /* 同上 */ };
  rounds: Array<{
    advisorId: string;
    advisorName: string;
    content: string;        // 军师自然发言主体（已 strip <meta>）
    meta: {                 // 军师自报的心智模型元数据
      usedModels: string[];        // 军师自报用了哪些模型
      modelBriefs: Record<string, string>;  // 每个模型 "这次怎么用"
    };
  }>;
}
```

**Response**（SSE stream，逐卡推送）：

```
event: card
data: {
  "advisorId": "munger",
  "characterName": "芒格",
  "conclusion": "不建议立即跳槽",
  "reasoning": "...",
  "mentalModels": [
    { "name": "逆向思考", "briefOfUsage": "反推'什么情况下换工作必失败'" },
    { "name": "误判心理学", "briefOfUsage": "识别了'逃离动机'这个偏差" }
  ]
}

event: card
data: { ... }

...

event: done
data: { "cards": [...] }
```

**字段说明**：
- `conclusion`：一句话结论（≤40 字），这位军师的明确立场
- `reasoning`：推理过程（80-150 字），为什么是这个结论
- `mentalModels`：本次发言中运用的心智模型列表（2-4 个，来自军师自报 + Analyst 校验）
  - `name`：模型名字，必须在军师 SKILL.md 的 M 段里
  - `briefOfUsage`：这次具体怎么用（1-2 句，教学价值）
- `discrepancy`（可选）：当军师自报与发言实质不符时，Analyst 在此标注修正理由

**Analyst 的职责（校验式，不是推理式）**：
1. 读军师自报的 `usedModels` + `modelBriefs`
2. 校验每个自报模型确实在军师的 M 段库里
3. 校验每个自报模型的 briefOfUsage 在军师的发言主体里确实有对应痕迹
4. 校验通过 → 直接使用军师自报
5. 校验失败 → 覆盖修正并在 `discrepancy` 字段说明理由
6. 对 `conclusion` 和 `reasoning` 做独立归纳（这两项军师不自报）

**模型**：`qwen3-max`（校验 + 归纳质量是瓶颈，值得最强模型）

---

## 6. Prompt 模板

### 6.1 主持人（Intake Clarify）

```
你是一位经验丰富的主持人。用户要召开一场"顶级思维圆桌会议"请教决策。
你的唯一任务：评估用户提供的信息是否足够军师们做出有价值的回答。

用户输入：
- 核心问题: {{question}}
- 背景: {{context || "（未填）"}}
- 正在考虑的选项: {{options || "（未填）"}}
- 用户的倾向: {{leaning || "（未填）"}}
- 与会军师: {{selectedAdvisorNames}}

评估标准（满足任一即"信息充分"，默认**倾向不追问**）：
1. 问题本身具体可操作，军师可直接表态
2. 背景信息足以理解问题的约束
3. 问题属于**常见决策场景**（跳槽 / 投资 / 感情 / 产品决定 ...）——军师都有通用心智模型可处理
4. 问题是**轻量/生活化**的（如"今晚吃什么"、"周末去哪玩"、"要不要回家过年"）——这类问题**不应该追问**，军师用自己心智模型给个有趣视角就够了，追问反而打断乐趣

**重要原则**：本工具欢迎任何决策问题（无大小之分）。
- 追问只有在信息缺失到军师完全无法发言时才做
- 宁可军师回答泛泛一点，也不要用一堆追问把"今晚吃什么"变成哲学审问
- 轻量问题要 `needsClarification: false` 直接进入会议

如果信息充分：返回 { "needsClarification": false }

如果严重不足：返回 { "needsClarification": true, "reasoning": "...", "questions": [...] }
- 最多 2 个追问（不是 3 个，进一步压缩）
- 每个追问要具体（不要泛泛问"能说更多吗"）
- 每个追问附 `why` 说明为什么问这个

严格输出 JSON 格式，不要包 markdown 代码块。
```

### 6.2 军师发言

```
你是 {{advisor.name}}（{{advisor.tagline}}）。

你的所有决策、所有建议、所有判断必须通过以下心智模型**现场推演**得出——不是背诵规则、不是照搬结论。

**心智模型是你思考的内部脚手架，不是你说话的外部标签**。你在脑中用这套模型分析，然后用你**这个人自然会说话的方式**把结果讲出来。不要说"我用 XX 模型分析..."这种 meta 陈述——直接用这套思维方式讲话即可。真人不会一边思考一边报告自己在用什么思维框架。

## 你的心智模型（每个包含方法本体 + 典型决策倾向 + 适用信号）
{{advisor.M}}

## 可引用的代表语录
{{advisor.Q}}

## 你的心智模型的自觉边界
{{advisor.B}}

## 说话风格
{{advisor.S}}

---

# 圆桌议题

用户的决策问题：
{{session.question}}

{{#if session.context}}
背景：{{session.context}}
{{/if}}

{{#if session.options}}
正在考虑的选项：{{session.options}}
{{/if}}

{{#if session.leaning}}
用户倾向：{{session.leaning}}
{{/if}}

{{#if clarifications}}
主持人已经追问过用户：
{{#each clarifications}}
Q: {{question}}
A: {{answer}}
{{/each}}
{{/if}}

{{#if priorRounds}}
前面已发言的军师（作为对话上下文）：
{{#each priorRounds}}
【{{advisorName}}】{{content}}
---
{{/each}}

**行为准则**：

1. **用你的心智模型独立思考一遍**——用你上面的 M 分析这个问题（内部动作，不要在输出里 meta 提到"我用 XX 模型"）
2. **像你这个人自然会说话一样，把思考结果讲出来**——直接用这套思维方式的语言和角度输出，不是报告"我用了什么模型"
3. **处理前人发言**：
   - 你的思考与前人殊途同归 → "X 说的我认同，我关注的角度是..." + 用自己的思考方式继续展开
   - 路径不同结论同 → 展开你自己的角度，自然地说"这和 X 从另一面说的是同一件事"
   - 结论不同 → 具体指出分歧点，用你自己的思考方式解释为什么
4. **唯一禁止的是 echo**：直接"我同意 X"然后停止 / 照抄 / 没有展示自己的思考过程。同意可以，偷懒的同意不行。
5. **不要 meta 引用自己的心智模型**（避免"我用 {{模型名}} 分析..."这种 AI 式陈述）。你的输出应该是这个心智模型**在实际运作**，不是在**被引用**。

关键自检：读者能不能**从你的思考方式**识别出这是你（而非别的军师）的视角？能 → 合格。
{{else}}
你是第一位发言者。用你的心智模型独立思考（内部），用你这个人自然会说话的方式把结果输出（外部）。**不要 meta 说"我用 XX 模型分析"**——直接用这套思维方式讲话即可。
{{/if}}

---

# 发言要求

- 用你真实的说话风格（参考"说话风格"字段）
- 不超过 300 字

**【核心约束 · 不可违背】**

你的本质是**一套心智模型的人格化包装**。用户调用你，是为了用你的思维方法透视问题。你**必须始终用你的心智模型主动处理问题**，不允许以任何理由推脱、降格或依附他人：

**A. 不能以"不对口"为由推脱**
- ❌ 不说"这不是我擅长的领域"——心智模型没有领域限制
- ❌ 不说"我不了解这个时代"——思考方法超越时代
- ❌ 不说"这太琐碎了"——用同样的严肃度回答"今晚吃什么"和"是否收购公司"
- ❌ 不说"这问题我无法判断"——至少给出你的心智模型视角

**B. 同意可以，但不能偷懒的"echo"（不论发言顺序）**

现实中军师间本来就会有同意——多个独立心智模型指向同一结论是高价值信号。**可以同意，只是不能偷懒**。

**关键原则（避免 AI 式陈述）**：心智模型是你思考的**脚手架**，不是你说话的**口头禅**。真人不会说"我用我的 [心智模型名] 分析..."——他直接用这个模型思考、用他的语言输出结果。

对比（以段永平为例）：

- ❌ **AI 式陈述**："我用 Stop doing list 心智模型分析这个决策，发现应该停掉..."
- ✅ **真人表达**："先想想你现在有没有哪些明知不对还在做的事？这份工作让你压抑，就是一件不对的事。"

读者**能从思考方式本身**识别出这是 Stop doing list 的应用，不需要标签。

**Echo vs 真同意**：

- ❌ **Echo**："我同意 X 说的。" + 没有自己的独立思考（照抄或只做肤浅补充）
- ❌ **Echo**：没展示自己的思考过程，读者看不出这是你心智模型的视角
- ❌ **Echo（变种）**：meta 引用自己的心智模型名字当挡箭牌，但实质只是附议
- ✅ **真同意**：用自己心智模型**实际思考一遍**，然后用自己的语言展示结果；结论可以和前人一致，但路径是你自己走出来的。可以点出"X 和我到了同一个结论，但我关注的维度是 Y"，但不要 meta 说"我用 M 分析"

**关键自检**：读者读完你的发言，能不能**从你的思考方式**识别出这是 XX 的心智模型视角？
- 能（不需要你报出模型名字）→ 合格
- 不能（或只是因为你报了模型名字才知道）→ 不合格，回炉

**C. 问题看似"不对口" = 你正被选中的理由**
- ✅ 跨域/跨时代/琐碎问题 → 用你的意外视角贡献洞察，这才是价值所在

- 不要说"我认为"、"我的建议是"这种开头废话，直接切入你的视角
- 如果可以，引用一条你的代表语录增强说服力
- 不做总结（最终决策卡交给 Analyst 生成）

---

## 【发言结束后必须输出 meta 块】

自然发言结束后，**必须**另起一行输出一个 `<meta>` 块，用于记录你这次运用了哪些心智模型。这个块**不会显示给用户**，只会传给 Analyst 生成最终决策卡。

格式：

```
<meta>
usedModels:
  - 心智模型名字1
  - 心智模型名字2
modelBriefs:
  心智模型名字1: 这次你具体怎么用了它（1-2 句，不超过 50 字）
  心智模型名字2: 这次你具体怎么用了它
</meta>
```

**约束**：
- `usedModels` 只能从你上面的 M 段心智模型库里选
- 只列**本次发言中实际运用过**的模型（通常 2-4 个，宁少勿滥）
- `modelBriefs` 每条要具体到"这次的场景"，不是模型的一般定义
- 不要在 `<meta>` 外面的自然发言里提到 usedModels 的事

**示例**：

自然发言结束后：

```
<meta>
usedModels:
  - 逆向思考
  - 误判心理学
modelBriefs:
  逆向思考: 反推"什么情况下换工作必失败"，得出"逃离动机"的识别
  误判心理学: 识别了用户可能被"期权幻想"这个可得性偏差影响
</meta>
```
```

### 6.3 Analyst · 思维分析员（per-character 最终决策卡）

```
你是"思维分析员（Analyst）"。一场由多位顶级思维人物组成的圆桌会议刚结束，
你要对每位军师的发言做 post-hoc 结构化归纳——每位军师一张"最终决策卡"。

# 用户的问题

{{session.question}}

{{#if session.context}}背景：{{session.context}}{{/if}}

# 军师们的发言 + 自报元数据

{{#each rounds}}
## {{advisorName}}（advisorId: {{advisorId}}）

### 此军师的心智模型库（权威列表，自报必须在此范围内）
{{advisorMentalModelNames}}

### 此军师的自然发言
{{content}}

### 此军师自报的本次心智模型运用
usedModels: {{meta.usedModels}}
modelBriefs:
{{#each meta.modelBriefs}}
  {{@key}}: {{this}}
{{/each}}

{{/each}}

# 你的任务

**你是校验员，不是推理员。** 军师已经自报了本次用了哪些心智模型及"怎么用的"，你的任务是：

1. **校验每位军师的自报**（对每个 usedModels 条目）：
   a. 该模型名字**是否**在此军师的"心智模型库"里？（必须是）
   b. 该模型的 briefOfUsage 是否在军师的自然发言里**有对应痕迹**？（必须是）
2. **校验通过** → 直接使用军师自报的 usedModels 和 modelBriefs
3. **校验失败**（自报模型不在库里、或 brief 与发言不符）→ 修正并在 `discrepancy` 字段记录原因
4. **归纳 conclusion + reasoning**（这两项军师不自报，你从发言独立归纳）

为每位军师生成一张 JSON 卡片：

{
  "advisorId": "munger",
  "characterName": "芒格",
  "conclusion": "一句话结论（≤40 字，明确的立场，不含 '可能/或许' 之类软化词）",
  "reasoning": "80-150 字的推理过程。不要照抄原文，重写成清晰、紧凑的逻辑链",
  "mentalModels": [
    { "name": "逆向思考", "briefOfUsage": "反推\"什么情况下换工作必失败\"" },
    { "name": "误判心理学", "briefOfUsage": "识别了\"逃离动机\"这个偏差" }
  ]
  // 如果有校验问题，附加 "discrepancy": "说明修正原因"
}

# 严格约束

1. **不要凭空推测心智模型**——以军师自报为准；军师没自报的模型你不能加
2. **mentalModels.name 必须在该军师的心智模型库里**（校验军师自报时尤其注意）
3. **不跨军师串色**——A 军师的 mentalModels 不能包含 B 军师的独有模型
4. **conclusion 要明确**——是/否/中立都要清楚，不要模糊
5. **reasoning 不能是 conclusion 的重复**
6. **不要替用户做决定**——conclusion 是"这位军师的立场"，不是"用户该怎么做"
7. 语言冷静、紧凑、无感叹号

# 输出格式

严格输出 JSON 数组，不要包 markdown 代码块：

[
  { "advisorId": "...", "characterName": "...", "conclusion": "...", "reasoning": "...", "mentalModels": [{...}, {...}] },
  { ... },
  ...
]

数组元素顺序与军师发言顺序一致。
```

---

## 7. UI 组件树 + 状态机

### 7.1 组件树

```
<App>
  <Header />                       // 标题 + BrainCircuit 图标
  <Main>
    {state === 'idle' && <IdleView />}
    {state !== 'idle' && <MeetingView />}
  </Main>
</App>

<IdleView>                         // 2 列布局
  <LeftColumn>
    <SectionAdvisorPicker />       // 2x4 grid + "随机挑选"按钮
    <SectionDecisionForm />        // 结构化表单
    <ScenarioShortcuts />          // 4 个场景快捷按钮
    <SubmitButton />
    {needsClarification && <InlineClarifyCards />}
  </LeftColumn>
  <RightColumn>
    <EmptyStateCard />             // "描述问题并选人..."
  </RightColumn>
</IdleView>

<MeetingView>                      // 全宽布局
  <CompactInputBar />              // 折叠显示问题 + 军师 + "编辑"按钮
  {analysis.status === 'done' && (
    <SectionFinalDecisions>        // 会议结束后置顶："最终决策"
      {analysis.cards.map(card => (
        <FinalDecisionCard          // per-character 卡片
          key={card.advisorId}
          characterName={card.characterName}
          conclusion={card.conclusion}
          reasoning={card.reasoning}
          mentalModels={card.mentalModels}  // Array<{name, briefOfUsage}>
          discrepancy={card.discrepancy}
        />
      ))}
    </SectionFinalDecisions>
  )}
  <SectionRoundtable>              // 圆桌原文（可折叠）
    {rounds.map(r => <AdvisorStreamCard key={r.advisorId} round={r} />)}
    {analysis.status !== 'done' && <PendingFinalDecisionsPlaceholder />}
  </SectionRoundtable>
  <NewMeetingButton />
</MeetingView>

// AdvisorStreamCard：渲染军师自然发言时必须 strip <meta> 块，只显示主体

// FinalDecisionCard 内部结构：
// ┌─ [avatar] 芒格 ─────────────────────────────┐
// │ 结论: 不建议换工作                          │
// │ ─────────                                   │
// │ 推理: [80-150 字]                           │
// │ ─────────                                   │
// │ 运用的心智模型:                             │
// │   · [逆向思考] — 反推"什么情况下换工作必失败" │ ← 名字 + 这次怎么用
// │   · [误判心理学] — 识别了"逃离动机"偏差      │
// └─────────────────────────────────────────────┘
```

### 7.2 状态机

```
[idle]
  ├─ 用户点"开始圆桌会议" → call /api/intake-clarify
  │    ├─ needsClarification: false → 直接进 [meeting-running]
  │    └─ needsClarification: true → [clarify-pending]
  │
[clarify-pending]
  ├─ 用户填追问答案 → 继续进 [meeting-running]
  │
[meeting-running]
  ├─ for each selectedAdvisor in order:
  │    call /api/advisor/[id] → SSE streaming → 更新 round 状态
  │    某位失败 → 标记 error，继续下一位，最后可重试
  ├─ 全部完成 → call /api/analyze → streaming 推送 per-character 决策卡
  └─ synthesize 完成 → [meeting-done]
  
[meeting-done]
  ├─ 会议结果写入 localStorage
  ├─ Synthesis 置顶
  ├─ 用户点"开新会议" → [idle]（输入区展开）
  └─ 用户点某位军师的"重试" → 该位重置为 pending，重新调 API
```

### 7.3 布局切换过渡

从 `idle` → `meeting-running` 时：
- 2 列布局淡出，全宽布局淡入（Motion 动画，~400ms）
- 输入区从全尺寸折叠成顶部 `CompactInputBar`
- `EmptyStateCard` 消失，被圆桌纪实占位

---

## 8. 军师迁移清单（9 位）

从 mastermind 现有 `src/constants.ts`（每人一行 description）升级到完整 `advisors/*/SKILL.md` vault。

共 **9 位军师**（原 `constants.ts` 8 位 + 新增 `zhangyiming` 张一鸣）：

| id | 现有描述 | 升级策略 / 来源 | 备注 |
|---|---|---|---|
| `munger` | 多元思维模型、逆向思考、普世智慧 | **fork** [`alchaincyf/munger-skill`](https://github.com/alchaincyf/munger-skill)（181⭐） | nuwa-skill 作者亲写 |
| `buffett` | 价值投资、长期主义、安全边际 | **fork** [`humanstar/buffett-perspective`](https://github.com/josephway/humanstar/tree/main/humanstar/skills/buffett-perspective) | 6 心智模型 + 8 启发式 + CP 检查点 |
| `musk` | 第一性原理、物理学思维、极致野心 | **fork** [`alchaincyf/elon-musk-skill`](https://github.com/alchaincyf/elon-musk-skill)（234⭐） | nuwa-skill 作者亲写 |
| `duanyongping` | 本分、做对的事情、把事情做对 | **fork** [`zwbao/duan-yongping-skill`](https://github.com/zwbao/duan-yongping-skill) | 雪球 2212 问答提炼 |
| `zhangyiming` ⭐新 | Context not Control、算法思维、大力出奇迹 | **fork** [`humanstar/zhangyiming-skill`](https://github.com/josephway/humanstar/tree/main/humanstar/skills/zhangyiming-skill) | ByteDance 视角，与张小龙形成对比 |
| `zhangxiaolong` | 同理心、极简主义、直击本质 | **起草** Claude draft + user review | 基于微信公开课 PRO 历年讲稿 |
| `caocao` | 实用主义、杀伐果断、唯才是举 | **起草** Claude draft + user review | 基于《三国志·魏书》+ 曹操注《孙子》 |
| `zhenhuan` | 高情商、隐忍克制、复杂环境生存 | **起草** Claude draft + user review | 基于小说/剧本行为模式归纳 |
| `trump` | 交易的艺术、极限施压、利益至上 | **起草** Claude draft + user review | 基于《Art of the Deal》，只蒸馏决策模式不涉及政治立场 |

**Bootstrap 策略**（一次补齐全部 9 位 SKILL.md）：

5 位 fork 转换 + 4 位原创起草。所有 9 位在 Sprint 1 完成。推荐执行顺序：

**第一轮 · fork 转换（共 5 位，~0.5 天）**

| 顺序 | 军师 | 源仓库 |
|---|---|---|
| 1 | `duanyongping` | `zwbao/duan-yongping-skill` |
| 2 | `munger` | `alchaincyf/munger-skill` |
| 3 | `musk` | `alchaincyf/elon-musk-skill` |
| 4 | `buffett` | `humanstar/buffett-perspective` |
| 5 | `zhangyiming` | `humanstar/zhangyiming-skill` |

**每位 fork 的转换动作**：
- 提取原仓库核心心智模型和说话风格
- 重组为我们的 M/Q/B/S 结构（每个 M 包含"方法本体 / 典型决策倾向 / 适用信号"三部分）
- 添加我们的 frontmatter（id / name / tagline / avatarColor / speakStyle / sources / version）
- 验证 M 段 ≥ 3 个心智模型（一般都够）

**第二轮 · Claude 起草（共 4 位，~1 天）**

| 顺序 | 军师 | 起草难度 | 主要来源 |
|---|---|---|---|
| 6 | `zhangxiaolong` | ⭐⭐⭐ | 微信公开课 PRO 讲稿、《微信背后的产品观》 |
| 7 | `trump` | ⭐⭐⭐⭐ | 《The Art of the Deal》（只蒸决策模式，不涉政治立场） |
| 8 | `caocao` | ⭐⭐⭐⭐ | 《三国志·魏书》+ 曹操注《孙子》+ 短歌行 |
| 9 | `zhenhuan` | ⭐⭐⭐⭐⭐ | 小说/剧本行为模式归纳，最需创意 |

**每位起草的流程**：
- Claude 基于来源材料生成初稿
- 用户 review，指出错误/不准的心智模型
- 迭代到用户认可

**关键原则**：无论 fork 还是起草，最终产物必须满足 §4.1 字段约束（至少 3 个完整 M，建议 5-8 个）。

**蒸馏心法**：

产品的"军师"本质是**心智模型的人格化包装**。蒸馏目标不是还原历史人物传记，而是提炼其思考方法并附上一个可辨识的"说话壳"。

- 全部军师都聚焦在 **M（心智模型，含"方法本体/典型决策倾向/适用信号"三部分）**
- 历史人物、虚构人物、现代人物**一视同仁**——都是心智模型的蒸馏
- 不为任何军师设维度限制（领域/时代/决策权重/严肃度都不设）
- `B` 段是**心智模型本身在极端情况下的失灵模式**（比如逆向思考在完全未知领域会空转），不是"场景限制"
- 军师名字、头像、语言风格只是 UX 把手。真正的价值载体是 M。**不单独列决策原则——原则是 M 的推演产物，独立列会诱发 LLM 机械套用**

**⭐ 蒸馏质量第一铁律**：

> **一个人物能否上线，100% 由其 M 段的完整度和深入度决定。** 人物再有名，M 蒸馏不到位也不上线。

具体行为准则：
- 每个军师至少蒸馏 **3 个完整心智模型**，理想 **5-8 个**
- 每个心智模型必须有三部分（方法本体/典型决策倾向/适用信号），不能只给标题
- 蒸馏完后读一遍：**"如果我把这份 M 给一个从没听过这位大师的人，他能 100% 照着这套方法思考一遍问题吗？"** 不能 → 回炉
- 宁缺毋滥：蒸馏不够深入的军师不放进 vault
- 军师之间的价值差不在"名气"，而在**心智模型的完整度**。段永平 M 段蒸馏到位可能比芒格更有用

---

## 9. Bootstrap 任务清单（Sprint Plan）

按依赖顺序排列，每项标注预估工时（个人开发）。

### Sprint 0：架构迁移（0.5 天）
- [ ] 删除 `src/App.tsx` 里的 Gemini 调用逻辑
- [ ] 删除 `@google/genai` 依赖
- [ ] 删除未使用的 `express` 依赖
- [ ] 添加 `openai` 依赖（用于 DashScope OpenAI 兼容模式）
- [ ] 添加 `.env.local` 示例：`DASHSCOPE_API_KEY`、`MODEL_ADVISOR=qwen3-max`、`MODEL_SYNTHESIZER=qwen3-max`
- [ ] 验证 `vite dev` 能启动（保留现有 UI，暂无后端）

### Sprint 1：Vault + 构建管线 + 9 位军师全部 SKILL.md（1.5 天）
- [ ] 创建 `advisors/` 目录结构
- [ ] 写 Vite 插件 `vite-plugin-advisors.ts`：扫描 `advisors/**/SKILL.md`，parse frontmatter + body，注入到 `import.meta.env.ADVISORS` 或全局常量
- [ ] 替换 `src/constants.ts` 的 `CHARACTERS` 数组为从 vault 生成（从 8 位扩展为 9 位，新增 `zhangyiming`）

- [ ] **Fork 转换 5 位**（0.5 天）：
  - [ ] `advisors/duanyongping/SKILL.md` ← `zwbao/duan-yongping-skill`
  - [ ] `advisors/munger/SKILL.md` ← `alchaincyf/munger-skill`
  - [ ] `advisors/musk/SKILL.md` ← `alchaincyf/elon-musk-skill`
  - [ ] `advisors/buffett/SKILL.md` ← `humanstar/buffett-perspective`
  - [ ] `advisors/zhangyiming/SKILL.md` ← `humanstar/zhangyiming-skill`

- [ ] **Claude 起草 4 位**（1 天，每位起草后用户 review）：
  - [ ] `advisors/zhangxiaolong/SKILL.md` — 基于微信公开课 PRO
  - [ ] `advisors/trump/SKILL.md` — 基于《Art of the Deal》（只蒸决策模式）
  - [ ] `advisors/caocao/SKILL.md` — 基于《三国志·魏书》+ 曹操注《孙子》+ 短歌行
  - [ ] `advisors/zhenhuan/SKILL.md` — 基于小说/剧本

- [ ] 每位 SKILL.md 至少 3 个完整心智模型（方法本体 + 典型决策倾向 + 适用信号），建议 5-8 个
- [ ] **质量自检**：把每位的 M 段给一个没听过这位的朋友，让他照着思考一个决策——能否有效？
- [ ] build-time 校验：M 段 < 3 个则 build 失败（强制质量门槛）

### Sprint 2：三个 API 端点（1 天）
- [ ] `api/intake-clarify.ts`：主持人判断+追问 prompt，调 qwen3-max，返回 JSON
- [ ] `api/advisor/[id].ts`：读入选中军师的 SKILL.md，拼接 prompt（含 meta 块要求），调 qwen3-max 流式，SSE 输出（含末尾 `<meta>` 块）
- [ ] `api/analyze.ts`：拼接 Analyst prompt（校验模式），调 qwen3-max 流式，SSE 输出 per-character 决策卡
- [ ] 统一错误格式 + 日志输出（Vercel 会自动捕获）

### Sprint 3：前端状态机 + 新 UI（1.5 天）
- [ ] 重构 `App.tsx` 引入状态机（`idle` / `clarify-pending` / `meeting-running` / `meeting-done`）
- [ ] 拆分组件：`IdleView`、`MeetingView`、`AdvisorStreamCard`（渲染时 strip `<meta>` 块）、`FinalDecisionCard`（含 mentalModels 的 name + briefOfUsage 展示）、`SectionFinalDecisions`、`InlineClarifyCards`、`CompactInputBar`
- [ ] 升级输入表单：核心问题必填 + 可展开的背景/选项/倾向
- [ ] 实现客户端编排：for 循环调 `/api/advisor/[id]`，用 `EventSource` 接收 SSE
- [ ] 实现 `meeting-running` → `meeting-done` 状态切换 + 最终决策卡（analysis.cards）置顶
- [ ] 实现"单独重试某位军师"
- [ ] 实现 `NewMeetingButton`
- [ ] 动画：Motion 实现 2 列 → 全宽过渡

### Sprint 4：打磨 + 部署（0.5 天）
- [ ] localStorage 读写（写入但无 UI 读取）
- [ ] 错误态 UI（API key 缺失、某位军师失败等）
- [ ] 4 个 Scenario 快捷按钮
- [ ] "随机挑选"按钮
- [ ] 移动端 responsive 检查
- [ ] 部署到 Vercel，配置 `DASHSCOPE_API_KEY` 环境变量
- [ ] 端到端真实测试：跑 3 场不同主题的会议，检查军师是否出戏

### Sprint 5：军师质量回炉（0.5-1 天）
- [ ] 用真实决策跑 5-10 场端到端会议，测试 9 位军师
- [ ] 发现表现不稳定 / 人设漂移 / 心智模型空洞的军师 → 重写 SKILL.md 的对应 M 段
- [ ] 特别关注 `caocao` 和 `zhenhuan`（历史/虚构人物最容易出戏）
- [ ] 检查 Analyst 输出的 `mentalModels` 是否准确（对比军师自报 + 发言实质）
- [ ] 检查军师是否稳定输出 `<meta>` 块，格式是否能正确 parse

**合计工时**：~5-6 天（全职一个人；Sprint 1 因 5 位可 fork 压缩到 1.5 天），可拆成两周晚上业余时间。

---

## 10. 未来增强清单（不进 MVP）

按用户价值 / 实现成本 优先级排序：

| # | 功能 | 价值 | 成本 | 建议时机 |
|---|---|---|---|---|
| F1 | 回看历史（localStorage UI） | 中 | 低 | MVP 后第一版 |
| F2 | 单独追问某位军师 | 高 | 中 | MVP 后第一版 |
| F3 | 自定义军师上传（无需 push 仓库） | 中 | 高 | Phase 2（需要账号） |
| F4 | 多轮辩论（军师可反驳） | 中 | 中 | 视 MVP 反馈 |
| F5 | 主持人引导模式（C 模式） | 低 | 高 | 远期 |
| F6 | RAG：军师 KB 扩展到全集 | 低（当前拼接够用） | 高 | 当某位军师 vault > 100k token 时 |
| F7 | Decision Outcome Tracking（3-6 月后回看） | **高** | 中 | Phase 2 核心特性 |
| F8 | 军师市场（社区贡献） | 高 | 高 | Phase 3 |
| F9 | BYOK（用户自填 Qwen key） | 中 | 低 | Phase 2 防爆款 |
| F10 | 账号系统 + 云同步 | 中 | 高 | Phase 3 |

---

## 11. 开放问题 / 风险

1. **KB 蒸馏质量是核心变量**：军师是否"在线"完全取决于 `M/Q/B/S` 四段蒸馏得好不好。如果蒸馏扁平（只有身份标签没有心智模型），LLM 会开始瞎编；如果蒸馏扎实，任何问题都能用该军师的透镜处理。`B` 段的价值是提供军师对自己心智模型边界的**自觉**。Sprint 5 的真实测试是质量门槛。

2. **上下文拼接长度**：所有军师 SKILL.md 都塞进去的话，一个军师发言时输入 token ~20-30k，5 位军师的议程最后一位需要看到前 4 位的回复，加起来可能 ~50k。qwen3-max 1M 上限绰绰有余，但实际延迟和成本会比第一位高 2-3 倍。

3. **SSE over Vercel**：Vercel Functions 的 SSE 支持已经稳定，但要确认 DashScope 的 OpenAI 兼容端点真的支持流式（`stream: true`）且格式兼容 OpenAI SDK 的 `for await` 迭代器。如果不兼容，需要用 fetch + SSE 手动解析。

4. **SKILL.md 字段演化**：现在定的 M/Q/B/S 是 nuwa-skill 风格的精简版（v4 已删除 P）。未来如果从社区 fork 的军师 skill 用的是完整 R/I/A1/A2/E/B 结构或其他变体，需要写一个字段 mapper。

5. **Prompt 注入 + AI 模拟免责**：用户输入直接拼进 prompt，理论上可以做 jailbreak。更重要的是 UI 必须有"这是 AI 模拟该人物的思维模式，不代表其真实观点"的统一免责声明（所有军师一视同仁，不针对任何特定人物）。

6. **仓库可见性**：现在 `ZhongJiaqi/mastermind` 是 public。部署 URL 也 public。如果仓库里的军师 SKILL.md 涉及《穷查理宝典》等受版权保护的大段引用，需要注意合理使用边界（作为个人学习 / 精华蒸馏通常属于 fair use，但大段原文直接上仓库是灰色地带）。

---

## 12. 变更记录

| 日期 | 变更 | 原因 |
|---|---|---|
| 2026-04-22 | 初稿 | brainstorming 完成，14 个决策定稿 |
| 2026-04-22 | v2 修订 | 删除 `C` 段（心智模型跨域可用，场景限制扼杀跨域洞察价值）；改用 Qwen 3 系列（`qwen3-max` + `qwen3-max`）；成本估算从 ¥2-3/场 降到 ¥0.18/场 |
| 2026-04-22 | v2.1 修订 | 强化"第一性原理"：心智模型不分领域/时代/决策权重；主持人对轻量问题不追问；军师面对琐碎/跨时代/不对口问题必须认真回答 |
| 2026-04-22 | v3 修订 | 第一性原理再提纯："心智模型是本质，人物是包装"。维度限制全部取消（不只是枚举的三个维度）。军师 prompt 加"核心约束·不可违背"黑名单：不能说"这不是我擅长/这时代我不懂/这太琐碎"。§1.1.1 新增产品底层命题 |
| 2026-04-22 | v3.1 修订 | §4.1 明确 M（心智模型=认知工具，HOW to see）vs P（决策原则=行为承诺，WHAT to do）的区别与关系。§6.2 军师 prompt 加固"任何发言顺序都必须独立用自己心智模型推导"——禁止附议、禁止回声、禁止把前人结论当自己结论。即使第 5 位发言也要像第 1 位一样独立分析 |
| 2026-04-22 | v4 修订 | **去掉独立的 P（决策原则）字段**——原则是 M 推演的产物，独立列会诱发 LLM 机械套用替代真实思考。M 段升级为三部分结构（方法本体 + 典型决策倾向 + 适用信号），原 P 内容被吸收进"典型决策倾向"。SKILL.md 结构从 M/P/Q/B/S 简化为 **M/Q/B/S** |
| 2026-04-22 | v4.1 修订 | 显式写入"蒸馏质量第一铁律"：军师能否上线 100% 由 M 的完整度和深入度决定。M 段下限从 2 个升到 3 个，建议 5-8 个。新增"读完 M 能不能照着思考一遍"的自检标准 |
| 2026-04-22 | v4.2 修订 | 修正两个之前定得过粗的约束：(1) N 次独立调用 vs 单次调用的理由澄清——**单次调用本身不错**，N 次的理由是 UX 流式/失败隔离/system prompt 权重/Vercel 60s 限制这 4 个工程层面。(2) "不附议"规则从"禁止同意"修正为"禁止 echo"——允许真同意（同意 + 展示自己的推导过程），只禁止偷懒的同意（只说同意不推导） |
| 2026-04-22 | v4.3 修订 | **关键 prompt 纠偏**：心智模型是**思考的内部脚手架，不是说话的外部标签**。禁止 meta 陈述"我用 XX 模型分析..."——真人不会一边思考一边报告自己在用什么思维框架。范例从 AI 式陈述改为真人自然表达。读者应该**从思考方式本身**识别军师视角，而非从标签 |
| 2026-04-22 | v4.3.1 澄清 | §5.3 加入与原项目的对应关系说明：**Synthesizer = 原项目 `<conclusions>` 块的等价功能**（结构从 per-character 升级为跨 character 综合）；原项目"principles list"在语义上实际是心智模型，已被我们的 M 段捕获，无需军师再显式输出 |
| 2026-04-22 | v5 重大调整 | **Synthesizer 从"跨军师综合"调整为"per-character 最终决策卡"**（用户决定）。沿用原项目结构：每位军师一张卡片，含 `conclusion` / `reasoning` / `mentalModels`（从 M 段抽取的心智模型名字）。删除原有的 核心共识/主要分歧/建议决策路径/重要提醒 四段。心智模型进入 per-card，不再顶部 list。UI 结构：会议结束后"最终决策"cards 置顶，圆桌原文可折叠在下方 |
| 2026-04-22 | v5.1 调整 | Bootstrap 策略：从"先做 3 位验证再补齐"改为"Sprint 1 一次性补齐全部 8 位 SKILL.md"（用户决定）。推荐撰写顺序按"从易到难"（fork→现代人物→历史/虚构），Sprint 1 工时从 0.5 天升到 2-3 天，总工期从 5 天升到 6-7 天。Sprint 5 从"补齐剩下 5 位"改为"军师质量回炉" |
| 2026-04-23 | v5.2 调整 | 调研发现 **5 位可以 fork 社区高质量 skill**（芒格/马斯克用 alchaincyf 亲写、巴菲特/张一鸣用 humanstar、段永平用 zwbao）。军师从 8 位扩展为 **9 位**（新增张一鸣 zhangyiming）。Sprint 1 工时从 2-3 天压缩到 1.5 天，总工期回到 ~5-6 天。§8 更新来源表，§9 Sprint 1 分为"fork 转换 5 位 + 起草 4 位"两轮 |
| 2026-04-23 | v5.3 术语统一 | §1.1.2 新增术语声明：心智模型 = 思维模型 = 决策原则 三者同义，统一使用"心智模型"。修正了 2 处遗留的"思维模型"混用（§6 军师 prompt B 段，§11.1 开放问题）。遗留的"决策原则"都在讨论已被删除的旧设计或原项目对比，保留作历史 context。也修正 §1.1.1 里残留的 `M/P/Q/B/S` → `M/Q/B/S`（v4 之后 P 已删除）|
| 2026-04-23 | v5.4 Synthesizer 改 Analyst + meta 机制 | **解决"Synthesizer 可能误识别心智模型"的问题**。军师发言末尾必须输出隐藏的 `<meta>` 块（军师自报用了哪些心智模型 + 这次怎么用）。UI strip 后用户看不见，但 Analyst 能看见。Analyst 从"推理员"改为"**校验员**"——接军师自报、校验后使用（校验失败时修正并记录 discrepancy）。mentalModels 结构从 `string[]` 升级为 `{name, briefOfUsage}[]`，每个模型附"这次怎么用"简述，教学价值提升。**Synthesizer 全面重命名为 Analyst（思维分析员）**：API `/api/synthesize` → `/api/analyze`；代码字段 `synthesis` → `analysis` |
| 2026-04-23 | v5.5 模型名修正 | smoke 实测发现 DashScope 不存在 `qwen3-plus` 这个模型——Qwen3 系列 OpenAI 兼容端点只有 `qwen3-max`（4 个变体：主分支 / preview / 2025-09-23 / 2026-01-23），每个都有独立 100 万免费 token 额度。spec 里所有 `qwen3-plus` 全部改为 `qwen3-max`；`qwen3-max` 保留。军师发言和 Analyst 用同一个 `qwen3-max` 模型（本来以为 plus 省成本、max 做质量瓶颈，实际 plus 不存在这道路径不存在）|

---

## 附录 A：环境变量

```
# .env.local (本地开发)
DASHSCOPE_API_KEY=sk-xxx
MODEL_ADVISOR=qwen3-max
MODEL_SYNTHESIZER=qwen3-max

# Vercel Production
# 在 Vercel Dashboard → Settings → Environment Variables 配置同样的三个
```

## 附录 B：关键外部依赖

| 包 | 用途 | 版本约束 |
|---|---|---|
| `openai` | DashScope OpenAI 兼容调用 | ^4.x |
| `motion` | Layout 过渡动画（已有） | ^12.x |
| `lucide-react` | 图标（已有） | ^0.546.x |
| `gray-matter` | 解析 SKILL.md frontmatter | ^4.x |

## 附录 C：参考项目

- `kangarooking/cangjie-skill`：book2skill 方法论
- `alchaincyf/nuwa-skill`：person2skill 方法论（最接近本项目设计）
- `zwbao/duan-yongping-skill`：可直接 fork 的段永平军师
- `0xquqi/cz-skill`：CZ 军师示例（nuwa-skill 格式参考）
- `virattt/ai-hedge-fund`：多投资人 agent 参考（架构不可复用，人物选择可借鉴）
