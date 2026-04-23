# Handoff · Mastermind 智囊团

**日期**：2026-04-23
**前一会话产出**：brainstorming 完成 + spec v5.4 锁定
**下一会话第一动作**：调用 `superpowers:using-git-worktrees` 创建隔离 worktree

---

## TL;DR（给新会话 Claude 看）

用户和上一会话完成了 Mastermind 智囊团的 brainstorming 和 spec 撰写，现在要继续工作流：

```
[已完成] brainstorming → spec v5.4 写完并过审
[下一步] using-git-worktrees → writing-plans → executing-plans
```

用户下一句话会说"go"或类似指令，你应该立即：

1. 调用 `superpowers:using-git-worktrees` skill，在 `/Users/jiaqizhong/mastermind` 下创建隔离 worktree
2. 成功后在 worktree 里调用 `superpowers:writing-plans` skill，读 spec 产出详细实施 plan
3. plan 产出后等用户确认，再调用 `superpowers:executing-plans` 开工

**核心权威源**：

```
docs/superpowers/specs/2026-04-22-mastermind-design.md  (v5.4)
CLAUDE.md                                                (repo 根部)
```

所有设计决策以 spec 为准。CLAUDE.md 已明确"conflicts with spec should defer to spec"。

---

## 项目一句话定义

**Mastermind 智囊团**：让不同顶级思维（芒格/巴菲特/马斯克/段永平/张一鸣/张小龙/曹操/甄嬛/特朗普，共 9 位）按各自心智模型为用户决策提供多视角透视的 AI 工具。

产品本质：**心智模型是本质，人物是包装**。用户面临真实决策时拿不定主意，通过让多位顶级思维分别发言 + 事后结构化归纳（最终决策卡）帮助决策 + 学习。

---

## 当前仓库状态

**路径**：`/Users/jiaqizhong/mastermind`（已从 github.com/ZhongJiaqi/mastermind clone）

**分支**：`main`

**Git 状态**（截至 handoff 时）：

- 已有 2 次上游 commits（"Initial commit" + "feat: Implement Mastermind Decision AI core functionality"）
- **Uncommitted 修改**：
  - `docs/superpowers/specs/2026-04-22-mastermind-design.md` (untracked, v5.4 spec)
  - `docs/superpowers/handoff-2026-04-23.md` (this file)
  - `CLAUDE.md` (untracked)
  - `.env.example` (modified — 从 Gemini 改为 Qwen 配置)
  - `.env.local` (untracked, 包含用户的真实 DASHSCOPE_API_KEY)

**⚠️ 之前的 commit 尝试被系统拦截**（原因：刚 clone 的外部仓库 + 旧 commit 消息含 Co-Authored-By，违反用户全局规则）。新会话在创建 worktree 后应该**在 worktree 里**重新提交这些文件（去掉 Co-Authored-By）。

**用户的 `.env.local` 已经填入真实 API key**，不要泄露或提交（`.gitignore` 已排除 `.env*`）。

---

## 核心设计决策清单（14+ 条，以 spec 为准）

简要索引（细节看 spec 对应章节）：

| # | 决策 | 最终方案 |
|---|---|---|
| 1 | 目标人群 | 私域公开部署（先 A 个人，架构留 B/C 空间）|
| 2 | 形态 | Web app（保留 mastermind 的 Vite + React，不迁 Next.js）|
| 3 | 议事方式 | 圆桌辩论（军师彼此看得到前人发言）|
| 4 | 军师库 | 9 位预置 + 未来可自定义 |
| 5 | 议事结构 | 每人一轮 + Analyst 生成 per-character 决策卡 |
| 6 | 军师知识 | Obsidian 管理的 markdown vault，拼接塞 prompt（无 RAG）|
| 7 | 输入 | 结构化表单 + 主持人内嵌追问 |
| 8 | 会议 UI | A（顺序流 + 流式直播）+ Q8-D 状态切换布局 |
| 9 | 历史 | 无服务端存，localStorage 静默保存 |
| 10 | 部署 | Vercel 公开 URL + 私域分发 |
| 11 | 费用 | 用户自付，Qwen 便宜 |
| 12 | UI 布局 | 空闲 2 列 / 会议全宽（Q8-D 状态切换）|
| 13 | LLM | Qwen 3 · qwen3-plus（军师）+ qwen3-max（Analyst）|
| 14 | 军师选择器 | 2x4 grid（保留 mastermind 现状）|
| UI-5 | 视觉 | 纯 Sans（保留 mastermind 现状，stone 灰）|
| 内容决策 | 9 位军师来源 | 5 fork（munger/buffett/musk/duanyongping/zhangyiming）+ 4 Claude draft（zhangxiaolong/caocao/zhenhuan/trump）|

### 四条第一性原理（反复迭代后锁定）

1. **心智模型是本质，人物是包装**（§1.1.1）
2. **心智模型无维度限制**，一切决策都从它出发——不分领域/时代/决策权重/严肃度
3. **M 段完整度 = 军师质量**，蒸馏不到位不上线（宁缺毋滥）
4. **心智模型是思考的内部脚手架，不是说话的外部标签**——军师自然发言，元数据放隐藏 `<meta>` 块

### 关键技术架构决策

- **N+1 次独立 LLM 调用**（非单次扮多人）：N 位军师各一次 + 1 次 Analyst。理由不是正确性，而是 UX 流式 / 失败隔离 / system prompt 权重 / Vercel 60s 限制这 4 个工程层面。
- **军师输出隐藏 `<meta>` 块**（v5.4 新增）：`usedModels + modelBriefs`，UI strip 掉用户看不见，传给 Analyst 做校验式归纳（不再凭推理瞎猜）。
- **Analyst 是校验员不是推理员**（v5.4）：军师自报 → Analyst 校验 → 通过则用 / 不通过则修正并记 discrepancy。
- **mentalModels 结构**：`Array<{name, briefOfUsage}>`（升级自 `string[]`），每个模型附"这次怎么用"教学用简述。

---

## Sprint 计划（~5-6 天全职，拆成两周晚上）

| Sprint | 内容 | 工时 |
|---|---|---|
| 0 | 架构迁移（删 Gemini，装 openai SDK，更新 env vars）| 0.5 天 |
| **1** | **Vault + Vite 插件 + 9 位 SKILL.md**（5 fork + 4 draft）| **1.5 天** |
| 2 | 3 个 API 端点（intake-clarify / advisor/[id] / analyze）| 1 天 |
| 3 | 前端状态机 + 新 UI（空闲↔会议 + per-advisor streaming + FinalDecisionCard）| 1.5 天 |
| 4 | 打磨 + 部署（localStorage + 错误态 + Vercel）| 0.5 天 |
| 5 | 军师质量回炉（真实会议测试，发现出戏/空洞的重写）| 0.5-1 天 |

详见 spec §9。

---

## 用户偏好与风格（来自 CLAUDE.md + 对话历史）

**沟通风格**：
- 使用**中文**（非中英混杂）
- 喜欢**简洁直接**，不要长篇铺垫
- 做决定时**快速决断**（通常 1 个字：a/b/过/go）
- 但在关键设计点上会**深度追问**（见 spec 的 5 轮迭代）

**设计偏好**：
- **第一性原理思考**：反复挑战设计，不满意会问"为什么不是 X"
- **反对过度工程**：删掉的东西包括 C（场景限制字段）、P（决策原则字段）、Synthesizer 改为 Analyst、跨军师综合改为 per-character 卡
- **反对 AI 式陈述**：军师不能说"我用 XX 模型"这种 meta 语言
- 看到方案更喜欢**图/表/demo** 而不是纯文字描述（之前做过 3 个 HTML demo 让用户选 UI 方案）

**工作流偏好**（来自 CLAUDE.md 全局规则）：
- `能自动执行的都直接做，不要让用户来`
- `Commit flow: 确认后 commit+push 一气呵成，不要分步再问`
- `Show diff before committing`
- 不要用 `Co-Authored-By`（全局设置禁用）
- Skills 放在 `~/.agents/skills/`（不是 `~/.claude/skills/`）

**安全要求**：
- API key 只存本地 `.env.local`，不要让 Claude 看到（用户主动填的）
- 任何调用不要泄露 key 到 chat / log / commit

---

## 关键文件地图

```
/Users/jiaqizhong/mastermind/
├── CLAUDE.md                                                  # 项目 level 指引（新会话必读）
├── docs/superpowers/
│   ├── specs/2026-04-22-mastermind-design.md                  # v5.4 权威 spec
│   └── handoff-2026-04-23.md                                  # 本文件
├── .env.local                                                 # 用户已填真实 API key（git-ignored）
├── .env.example                                               # Qwen 配置模板
├── package.json                                               # Vite + React 19 + TS + Tailwind 4
├── src/
│   ├── App.tsx                                                # 17KB 单文件 UI，Gemini 单次调用架构（待重写）
│   ├── constants.ts                                           # CHARACTERS 和 SCENARIOS 常量（待改为从 vault 读）
│   ├── main.tsx                                               # React 入口
│   └── index.css
├── vite.config.ts                                             # Vite 配置，含 @/ alias 和 DISABLE_HMR
└── tsconfig.json                                              # TS 配置

工作目录以外（参考资源）：
/Users/jiaqizhong/council-demo-q8.html                         # UI 布局 demo（已过期但有参考价值）
/Users/jiaqizhong/council-demo-q14.html                        # 军师选择器 demo
/Users/jiaqizhong/council-demo-visual.html                     # 视觉风格对比 demo
```

---

## 即将 fork 的 5 位军师源

| 军师 | 来源 repo |
|---|---|
| munger | https://github.com/alchaincyf/munger-skill |
| buffett | https://github.com/josephway/humanstar/tree/main/humanstar/skills/buffett-perspective |
| musk | https://github.com/alchaincyf/elon-musk-skill |
| duanyongping | https://github.com/zwbao/duan-yongping-skill |
| zhangyiming | https://github.com/josephway/humanstar/tree/main/humanstar/skills/zhangyiming-skill |

需要 Claude 起草的 4 位（没有现成社区 skill）：

- zhangxiaolong（基于微信公开课 PRO）
- caocao（基于《三国志·魏书》+ 曹操注《孙子》+ 短歌行）
- zhenhuan（基于小说/剧本行为模式归纳）
- trump（基于《Art of the Deal》，只蒸馏决策模式不涉政治立场）

---

## 新会话第一条指令（建议用户复制这段说）

```
我在继续 Mastermind 项目。上一会话完成了 brainstorming + spec v5.4 锁定。
请按照 /Users/jiaqizhong/mastermind/docs/superpowers/handoff-2026-04-23.md 
的指引，调用 using-git-worktrees skill 创建隔离 worktree，
然后在 worktree 里调用 writing-plans skill 生成详细实施 plan。
```

或者更简短：

```
读 /Users/jiaqizhong/mastermind/docs/superpowers/handoff-2026-04-23.md 然后 go
```

---

## 新会话第一步具体动作

1. **读 handoff + spec + CLAUDE.md**（~10 秒）
2. **调用 `superpowers:using-git-worktrees`** skill
3. 在 worktree 创建好后，**第一件事是提交 spec + CLAUDE.md + 本 handoff + .env.example 修改**（别忘了去掉 Co-Authored-By）
4. **调用 `superpowers:writing-plans`** 把 Sprint 0-5 展开成详细 task list
5. 等用户确认 plan 后，**调用 `superpowers:executing-plans`** 开工

---

## 可能被新会话 Claude 问的问题 + 答案

**Q: Sprint 1 的 "Claude 起草 4 位" 指由我起草吗？**
A: 是。用户明确决定"方案 B + 我可以在网上搜索现成参考"。起草完让用户 review。

**Q: 段永平的 fork 要 git submodule 还是直接复制格式转换？**
A: 直接复制内容 + 转换到我们的 M/Q/B/S + `<meta>` 输出约定格式。不要 submodule（版本不稳定）。

**Q: 现有 src/App.tsx 是推倒重写还是逐步改造？**
A: 见 spec §9 Sprint 0-3。Sprint 0 先删 Gemini 代码但保留 UI 骨架；Sprint 3 再拆分组件。不是一次推倒。

**Q: .env.local 里已经有 API key，测试时能不能真的跑？**
A: 能。但 Sprint 1 不需要 key（纯 vault + 构建管线），Sprint 2 才会真实调用 API。

---

## 失败/回滚指南（如果出问题）

- **worktree 创建失败**：检查 `.worktrees/` 是否被 gitignore（目前 `.gitignore` 里已有 `.env*` 但没有 `.worktrees`），需要先加。
- **spec 里发现新矛盾**：更新 spec + 写 v5.5 changelog 行，再继续。
- **用户改主意了**：尊重用户决定，更新 spec，不要倔强。
- **commit 被系统拦截**：检查是否因 Co-Authored-By 或外部 repo 规则——去掉然后重试。

---

**以上就是全部交接。新会话 Claude 读完这份 handoff + 那份 spec + CLAUDE.md，应该能无缝接上。祝顺利。**
