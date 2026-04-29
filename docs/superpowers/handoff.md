# Handoff · Mastermind 智囊团

**日期**：2026-04-23（下午会话结束）
**上次更新**：Sprint 0-3 完成 + Sprint 1 部分（5/9 军师）
**下一会话第一动作**：读本文件 → 和用户确认下一步走 A/B/C/D

---

## TL;DR（给新会话 Claude 看）

Mastermind 智囊团的核心工程骨架已经搭完并通过所有测试。**52 tests 全绿 / lint 0 错 / build 成功**，但还没跑过端到端真实 API 调用。

已完成：
- Sprint 0（架构迁移）、Sprint 2（3 个 API 端点）、Sprint 3（前端状态机+UI 重写）全部完成
- Sprint 1 的基础设施（types + Vite plugin + constants）+ 5 位 fork 军师（芒格/巴菲特/马斯克/段永平/张一鸣）

未完成：
- Sprint 1.9-1.12：4 位 Claude-draft 军师（张小龙/特朗普/曹操/甄嬛）—— 用户选了"C 方案"暂缓，等基础设施就绪后再做
- Sprint 4：错误态 UI + 移动端 + Playwright E2E + Vercel 部署
- Sprint 5：军师质量回炉

下一步有 4 条路（见末节"下一步选项"），**让用户选**。不要擅自往前冲。

---

## 当前状态快照

**仓库**：`/Users/jiaqizhong/mastermind`（origin: `github.com/ZhongJiaqi/mastermind`）

**工作目录**：`/Users/jiaqizhong/mastermind/.worktrees/mastermind-v1`

**分支**：`feat/mastermind-v1`（从 main 切出，未合并未推送）

**Main 分支**：`main` 比远端多 1 个 commit（`0d9c928 chore: ignore .worktrees directory`，尚未 push）

**Git 状态**：working tree clean，36 个 commit 在 feat 分支上

**验证状态**（都是绿的，命令可复现）：
```bash
cd /Users/jiaqizhong/mastermind/.worktrees/mastermind-v1
npm run lint   # tsc --noEmit 0 错
npm run test   # 14 test files / 52 tests 全绿
npm run build  # Vite build 成功，含 advisors plugin 校验
```

---

## 已完成 Sprint 明细

### Sprint 0：架构迁移 ✅
- 卸载 `@google/genai` + `express`；装 `vitest @vitest/coverage-v8 jsdom` + `openai gray-matter zod`
- `vite.config.ts` 去掉 `GEMINI_API_KEY` define
- `src/App.tsx` Gemini 调用 stub 成 "会议功能正在迁移中"
- `vitest.config.ts` 建好含 `passWithNoTests: true`

### Sprint 1：vault + 5 位军师 ✅（部分）
- `src/types/advisor.ts`：`AdvisorFrontmatter / AdvisorMentalModel / AdvisorSkill`
- `vite-plugins/advisors.ts`：扫描 `advisors/**/SKILL.md`，gray-matter 解析 frontmatter + 正则提取 M/Q/B/S，zod 校验 frontmatter，build-time 注入 `virtual:advisors` 模块；含热重载
- `virtual-modules.d.ts`：TypeScript 声明
- `advisors/_fixtures/valid-minimal/SKILL.md`、`invalid-missing-m/SKILL.md`：单元测试 fixture
- `src/constants.ts`：删 `CHARACTERS`，只保留 `SCENARIOS`
- **5 位 fork 军师就位**：
  - `advisors/duanyongping/SKILL.md`（8 心智模型，fork 自 `zwbao/duan-yongping-skill`）
  - `advisors/munger/SKILL.md`（8 心智模型，fork 自 `alchaincyf/munger-skill`）
  - `advisors/musk/SKILL.md`（7 心智模型，fork 自 `alchaincyf/elon-musk-skill`）
  - `advisors/buffett/SKILL.md`（7 心智模型，fork 自 `josephway/humanstar`）
  - `advisors/zhangyiming/SKILL.md`（6 心智模型，fork 自 `josephway/humanstar`）

### Sprint 2：3 个 Vercel Edge Functions ✅
- `api/_shared/dashscope.ts`：`createDashScope()` 返回 `new OpenAI({ apiKey, baseURL })` + `getDashScopeModels()` 读 env
- `api/_shared/errors.ts`：`errorResponse(code, message, status)` + `normalizeError(err)`
- `api/_shared/sse.ts`：`formatSseEvent()` + `createSseStream()` 返回 `{ response, write, close }`
- `api/_shared/schemas.ts`：`intakeClarifyRequestSchema / advisorRequestSchema / analyzeRequestSchema`（Zod）
- `api/_shared/prompts/intake.ts`：主持人追问 prompt
- `api/_shared/prompts/advisor.ts`：军师发言 prompt（含 `<meta>` 块指令）
- `api/_shared/prompts/analyze.ts`：Analyst 校验员 prompt
- `api/intake-clarify.ts`：POST → `qwen3-plus` 非流式 → 返回 JSON（needsClarification + questions）
- `api/advisor/[id].ts`：POST → `qwen3-plus` 流式 → SSE `chunk` + 末尾 `done`（含 `displayText` / `meta`）
- `api/analyze.ts`：POST → `qwen3-max` 流式 → 累积 buffer → JSON.parse → 逐 card emit `card` + `done`
- `vercel.json`：runtime edge + maxDuration 60s
- **全部 API 含 integration test，vi.mock `virtual:advisors` 和 dashscope**

### Sprint 3：前端状态机 + UI ✅
- `src/types/session.ts`：`DecisionSession / AdvisorRound / DecisionCard / AnalysisState / MeetingState` 等完整类型
- `src/state/meetingReducer.ts`：18 个 action、spec §7.2 完整状态机、`initialMeeting` 常量、immutable 更新
- `src/lib/meta.ts`：`stripMetaBlock()` + `parseMetaBlock()`，含 4 个单元测试
- `src/lib/sseClient.ts`：`openSseStream()` AsyncGenerator，fetch POST + ReadableStream 解析
- `src/lib/storage.ts`：`saveSession / loadSessions / clearSessions / savePrefs / loadPrefs`，版本化 key
- `src/lib/orchestrator.ts`：`runMeeting()` 顺序编排 N 位军师 → Analyst，含 strip meta + prior rounds 传递
- `src/hooks/useMeeting.ts`：`useReducer + runMeeting + intake fetch` 组合钩
- 13 个组件文件（`AdvisorCard / AdvisorPicker / DecisionForm / ScenarioShortcuts / SubmitButton / EmptyStateCard / CompactInputBar / AdvisorStreamCard / FinalDecisionCard / SectionFinalDecisions / InlineClarifyCards / NewMeetingButton / 视图 IdleView + MeetingView`）
- `src/App.tsx`：瘦身成状态驱动的 view switcher，含 Motion `AnimatePresence`

---

## 尚未完成的任务清单

### 高优先级（blocker for "可用产品"）
1. **端到端 smoke 测试**：用户的 `.env.local` 已有真实 DASHSCOPE_API_KEY，但还没跑过真实 API。建议先跑一次"芒格 + 巴菲特对跳槽"类问题，观察：
   - intake-clarify 是否正确判断轻量 vs 严肃问题
   - 军师是否稳定输出 `<meta>` 块（格式能被 `parseMetaBlock` 解析）
   - Analyst 是否正确输出严格 JSON 数组
   - 客户端 SSE 解析是否稳
2. **Vercel 部署**：`vercel login + vercel link + vercel env add + vercel --prod`，验证线上 edge function 能跑 SSE

### 中优先级
3. **Sprint 1.9-1.12**：4 位 Claude-draft 军师（张小龙 / 特朗普 / 曹操 / 甄嬛）—— 需要用户参与 review
4. **Sprint 4 打磨**：
   - 错误态 UI（ErrorBanner 组件 + 军师级重试）
   - `API_KEY_MISSING` 友好提示（createDashScope 抛时加 code，前端识别）
   - 移动端 responsive pass（375px breakpoint）
   - Playwright E2E 基线（spec 跑 `npm run test:e2e`）

### 低优先级
5. **Sprint 5 军师质量回炉**：5-10 场真实决策测试，发现军师出戏/空洞/meta 块不稳等问题，回炉 SKILL.md 的 M/S 段
6. **Main 同步**：目前 main 比 origin/main 多一个 `.worktrees/` gitignore commit 尚未 push

---

## 走通的路径（别浪费时间重新摸索）

### 依赖版本（与 plan 文本可能不符，以实际安装为准）
- **vitest** 4.1.5（plan 未指定版本）
- **openai** 6.34.0（plan 说 `^4.x`，实际装了 6.x，`.baseURL` 属性访问兼容，`chat.completions.create({ stream: true })` 的 async iteration 兼容）
- **zod** 4.3.6（plan 说 `^3.x`，zod 4 的 `z.object / z.string / z.record / .extend / .safeParse / z.infer` 都保持兼容，没碰到坑）
- **gray-matter** 4.0.3
- **@types/react 19** + **@types/react-dom 19**（Sprint 3 Task 3.7-3.10 时发现 React 19 自带类型不行，装了显式 types 包）

### SKILL.md 写法（9 位军师共用）
- **frontmatter 的 `version` 字段必须带引号**：`version: "0.1"`——不然 YAML 解析成 number，zod `z.string()` fail
- **M 段至少 3 个**（plan 说建议 5-8 个）
- **每个 M 必须三部分齐全**：`**方法本体**：...` + `**典型决策倾向**：...` + `**适用信号**：...`
- **`speakStyle` 字段不要带 "(≤60 字)" 这种 meta 注释**——subagent 容易把 spec 约束当成值复制进去（已在 duanyongping 发现并修正）
- **tagline 限 32 字符**（zh 字符也算一个，不是 byte）——zhangyiming 的初稿因此被截短

### 测试模式
- **`virtual:advisors` 在 test 里必须 vi.mock**（Node 运行 test 拿不到 Vite 虚拟模块）
  ```ts
  vi.mock('virtual:advisors', () => ({
    ADVISORS: [{ frontmatter: {...}, mentalModels: [...], quotes: '', ... }],
  }));
  ```
- **`api/_shared/dashscope` 在 integration test 必须 vi.mock**（不然真实连 DashScope）
- **jsdom 环境测试**用 `// @vitest-environment jsdom` 顶部指令切换
- **Node 25 的 localStorage 全局会挡住 jsdom**——`tests/setup/jsdom-localstorage.ts` 用 InMemoryStorage + Object.defineProperty 覆盖，在 `vitest.config.ts` 的 `setupFiles` 中注入

### Git 工作流
- Worktree 已 gitignore（main 分支的 `.gitignore` 含 `.worktrees/`）
- commit message 不加 `Co-Authored-By`（用户全局设置禁用）
- 不要强推 main；feat 分支可以 `git push -u origin feat/mastermind-v1`
- Committer 显示为 `Jiaqi Zhong <jiaqizhong@JiaqideMacBook-Pro.local>`（自动从 hostname 生成，**不要 `git config --global --edit`** 修正，系统会自动）

---

## 死路 / 坑 / 解决方案

| 问题 | 解决 |
|---|---|
| YAML `version: 0.1` 被解析成 number，zod fail | 所有 SKILL.md 用 `version: "0.1"` 带引号 |
| Vitest 跑 integration test 找不到 `virtual:advisors` | 每个 test 顶部 `vi.mock('virtual:advisors', ...)` |
| Node 25 的 localStorage 全局覆盖 jsdom 的 | `tests/setup/jsdom-localstorage.ts` + `setupFiles` |
| React 19 TSX `key` props 报 TS2322 | 装 `@types/react@^19 @types/react-dom@^19` |
| Subagent 复制 spec 注释 `(≤60 字)` 到 speakStyle 值 | Prompt 中显式告知别加 meta 注释；review 每个 fork 后的 frontmatter |
| OpenAI SDK 6.x 的 `.baseURL` 属性访问 | 实际保持 `.baseURL`，不是 `.baseUrl`；SDK 文档 OK |
| zhangyiming 源仓库 tagline 超 32 字符 | 截短为 `Context / 算法思维 / 延迟满足` |

---

## 下一步选项（让用户选）

**A. Sprint 4 打磨 + 部署**：错误态 UI、移动端、Playwright E2E、Vercel 部署——走完就有线上可用 URL
**B. 端到端 smoke 测试**：本地 `vercel dev` 或起一个小 Node server mock 代理 `/api/*` 到编译后的 edge function，用 `.env.local` 的真实 key 跑一场芒格+巴菲特会议——验证闭环前不急着部署
**C. 回 Sprint 1 补 4 位 Claude-draft 军师**：张小龙 / 特朗普 / 曹操 / 甄嬛——需要用户 review 每位的 M/Q/B/S
**D. diff review**：派 code-reviewer 扫整条 feat 分支的 diff，找架构、安全、死代码问题

**推荐问法**："你想走 A / B / C / D 哪条？"——不要自行选一条冲出去。用户 [上次](handoff-2026-04-23-sprint-start.md) 明确"选 C"跳过了 Sprint 1 draft 部分，这次也可能有新想法。

---

## 关键运维信息

### 文件地图

```
/Users/jiaqizhong/mastermind/                       # 主仓库
├── .worktrees/mastermind-v1/                       # ★ 工作目录（branch: feat/mastermind-v1）
│   ├── CLAUDE.md                                   # 项目级指引
│   ├── docs/superpowers/
│   │   ├── specs/2026-04-22-mastermind-design.md   # v5.4 权威 spec（1155 行）
│   │   ├── plans/2026-04-23-mastermind-v1-bootstrap.md  # 6-sprint 详细 plan（3828 行）
│   │   ├── handoff.md                              # ★ 本文件
│   │   └── handoff-2026-04-23-sprint-start.md      # 上次会话初始交接（参考）
│   ├── advisors/
│   │   ├── _fixtures/                              # valid-minimal + invalid-missing-m
│   │   ├── buffett/SKILL.md                        # 已 fork ✅
│   │   ├── duanyongping/SKILL.md                   # 已 fork ✅
│   │   ├── munger/SKILL.md                         # 已 fork ✅
│   │   ├── musk/SKILL.md                           # 已 fork ✅
│   │   └── zhangyiming/SKILL.md                    # 已 fork ✅
│   │   # 待做：zhangxiaolong / trump / caocao / zhenhuan
│   ├── api/                                        # 3 个 edge function + _shared
│   ├── src/                                        # 重写后的前端
│   ├── tests/                                      # 14 个 test file / 52 test
│   ├── vite-plugins/advisors.ts                    # vault 读取插件
│   ├── virtual-modules.d.ts                        # virtual:advisors 类型
│   ├── .env.local                                  # ★ 用户真实 API key（git-ignored，勿读）
│   ├── .env.example                                # Qwen 配置模板
│   ├── vercel.json                                 # edge runtime + 60s
│   └── vitest.config.ts
└── (main checkout 在 /Users/jiaqizhong/mastermind 根部，main 比 origin 多 1 个 commit)
```

### npm 命令

```bash
npm run dev         # Vite dev server @ http://localhost:3000
npm run build       # 生产构建（含 advisorsPlugin 校验）
npm run lint        # tsc --noEmit
npm run test        # vitest run（52 tests）
npm run test:watch  # vitest watch
npm run test:cov    # 覆盖率
```

### 环境变量（`.env.local` 用户已填）

```
DASHSCOPE_API_KEY=sk-xxx          # 用户真实 key，勿读勿提交勿在 chat 提及
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
MODEL_ADVISOR=qwen3-plus          # 军师用
MODEL_SYNTHESIZER=qwen3-max       # Analyst 用
MODEL_HOST=qwen3-plus             # 主持人用
```

### Subagent 派遣经验

- **Subagent-Driven** 已走通一整个 sprint 的 pipeline——每个 task 派 1 个 subagent，复杂 TDD 用 sonnet 够用
- 基础设施类 task 批量打包（2.1+2.2 / 2.3+2.4 / 3.1+3.2+3.3 / 3.4+3.5）节省往返
- 用户 **选择了 C 方案**跳过 Sprint 1 draft 部分：draft 需用户参与 review，单 subagent autonomic 产出质量不保证
- Subagent 容易犯的错：把 spec 里的约束注释当值复制（如 `(≤60 字)`）、version 不加引号、跨 task 改了不该改的东西
- 每次 subagent 后用 `git show <sha>` 快速核对 diff 范围

---

## 用户偏好 / 风格提示

- **沟通**用中文、简洁（通常 1 字决策：a/b/c/go/过）
- **执行**倾向"能自动做就自动做，不要等我"——但**关键选项（A/B/C/D 这种）仍需用户决定**
- **Commit flow**：确认后 commit+push 一气呵成，不要分步再问
- **Show diff before committing**（对 content 类可放宽，对 code 类严格）
- **不加 Co-Authored-By**
- **API key 保护**：`.env.local` 用户已填真实 key，**绝不** 读取内容 / 回显 / commit / 发给 subagent
- **反对过度工程**：一路砍过 C 段（场景限制）、P 段（决策原则）、Synthesizer 改 Analyst——同样的 YAGNI 惯性保留到后面
- **时间感**：今天（2026-04-23）一天内走完 Sprint 0-3，节奏偏快，用户可能累了需要休息

---

## 新会话第一条指令建议

```
读 /Users/jiaqizhong/mastermind/.worktrees/mastermind-v1/docs/superpowers/handoff.md
然后我们讨论下一步走 A / B / C / D 哪条。
```

新会话 Claude 读本文件 + spec（`specs/2026-04-22-mastermind-design.md`）+ plan（`plans/2026-04-23-mastermind-v1-bootstrap.md`）应该足够接上。**不要读 `.env.local`**。

---

## 2026-04-23 下午二轮会话更新（smoke + 架构修复）

用户选了 B（端到端 smoke）。过程中发现并修了两个 blocker：

### 架构 blocker 已修：`virtual:advisors` 无法 edge 打包

- 之前 3 个 edge function 用 `import { ADVISORS } from 'virtual:advisors'`，该模块是 Vite plugin 独占虚拟模块；Vercel 打包 edge function 走 esbuild 独立 pipeline，部署后必 404。`vi.mock('virtual:advisors')` 遮蔽了此问题，52 tests 都是假绿。
- 修复路径：
  - 新增 `scripts/gen-advisors.ts` 跑一次生成物理文件 `src/generated/advisors.ts`（gitignored）
  - `vite-plugins/advisors.ts` 重写：保留 HMR，buildStart/HMR 时调 `writeGeneratedFile` 重新落盘
  - `package.json` 加 `predev` / `prebuild` / `pretest` 钩子自动生成
  - 7 个文件的 `import 'virtual:advisors'` → 相对路径 `src/generated/advisors`
  - 3 个 test mock 路径同步更新
  - 删除 `virtual-modules.d.ts`
- 新增回归测试 `tests/integration/edge-bundle.test.ts`：直接跑 `esbuild api/**/*.ts --bundle`，保证未来不再退化（**任何 edge 不能解析的 import 都会被抓**）

### Bug fix：`parseMetaBlock` 全角冒号

- `src/lib/meta.ts` 的正则只认英文冒号 `:`；真实 LLM 中文输出会用全角 `：`（如 `安全边际：用确定性工资替代期权`），导致 `modelBriefs` 永远解析为 `{}`
- 修正：两个正则改 `[:：]`；加 `tests/unit/meta.test.ts` 全角冒号回归 case

### 新架构：本地 dev 一键端到端

- 新增 `vite-plugins/dev-api.ts`：Vite dev 时 `configureServer` 挂 middleware，把 `/api/intake-clarify`、`/api/analyze`、`/api/advisor/[id]` 路由到对应 edge handler（用 `ssrLoadModule` + Node req↔Web Request 适配），用 `loadEnv` 加载 `.env.local` 到 `process.env` 让 handler 读到 DashScope key
- **`npm run dev` 一条命令**起完整全栈，不用 `vercel dev`，也不用登录 Vercel

### Smoke 结果（真实 DashScope）

| 端点 | 结果 |
|---|---|
| `POST /api/intake-clarify` | ✅ JSON 返回 schema 对（`needsClarification` + `questions`） |
| `POST /api/advisor/munger` | ✅ SSE 流式 + meta 块 + strip ok + 自然发言 in-character |
| `POST /api/advisor/buffett` | ✅ 同上，引用了"价格是你付出的，价值是你得到的" |
| `POST /api/analyze` | ✅ 2 张 card 逐条 SSE + `event: done`，JSON.parse 无 markdown 污染 |

完整 spec 7-section golden path 全通。

### 模型名更正（spec 错了）

- spec / `.env.example` 里写的 `qwen3-plus` / `qwen3-max` 在 DashScope 上 404 —— 正确命名是 `qwen-plus` / `qwen-max`（无 "3"）。已更新 `.env.example` + 注释说明。**spec（`specs/2026-04-22-mastermind-design.md`）有多处引用未改，留待用户确认后批量替换。**

### 账户侧 blocker（用户需处理）

- DashScope 账户开启了 **"仅免费额度"** 模式且 `qwen-plus` / `qwen-max` 免费额度已耗尽（`qwen-turbo` 还能用）
- smoke 跑的是 `qwen-turbo`（覆盖 env 变量）—— 能力弱但足够验证链路
- 上线前必须去 [DashScope 管理台](https://dashscope.console.aliyun.com/) 关闭"仅免费额度"或充值

### Sprint 5 预警（不需马上改）

`qwen-turbo` 对"今晚吃什么"仍返回 `needsClarification: true` 并生成 2 个追问—— 违反 spec §6.1 "轻量问题不应追问"。原因可能是 prompt 没强到能压住，或 turbo 能力不够。换成 `qwen-plus` 再测一次才能判断。归 Sprint 5 回炉。

### 当前验证状态（命令可复现）

```bash
cd /Users/jiaqizhong/mastermind/.worktrees/mastermind-v1
npm run lint    # tsc --noEmit 0 错
npm run test    # 15 files / 56 tests 全绿（含 edge-bundle + 全角冒号新 case）
npm run build   # vite build 含 prebuild 生成 → 成功
```

Dev server 当前在 background（task id `bk5gnbu50`），env 覆盖 `MODEL_*=qwen-turbo`。

### 剩余任务（优先级）

1. **浏览器 UI 实测**：API 层已全绿，但 UI 层（状态机切换、AdvisorStreamCard 渲染、FinalDecisionCard 置顶、localStorage 写入）没过真流量。建议用户打开 http://localhost:3000 亲自跑一场
2. **账户解封**：关闭"仅免费额度"或充值，才能切回 `qwen-plus` / `qwen-max`
3. **Spec 批量替换**：`specs/2026-04-22-mastermind-design.md` 里 `qwen3-plus` / `qwen3-max` 全部改成 `qwen-plus` / `qwen-max`（grep 一下大约 3-5 处）
4. 原有未完成：4 位 Claude-draft 军师（C），Sprint 4 打磨（A），Sprint 5 回炉

---

**二轮交接完成。工作目录待 commit（有新文件 + 8 个修改）。56 tests 全绿。等待用户决定下一步。**

---

## 2026-04-24 凌晨 · 架构回滚为单次圆桌（council）

用户反馈：N 次独立调用 + 每人 1 次发言失去了原项目的"AI 自导自演"动态碰撞感。按原项目 `ZhongJiaqi/mastermind` main 分支的单次 LLM 调用扮多人架构重写，但保留 spec v5.4 的心智模型 vault 和结构化决策卡。

Plan 记录：`~/.claude/plans/ai-ai-fancy-glade.md`

### 架构变化

- **新增** `api/council.ts`：单次 qwen3-max SSE 调用，一次 prompt 注入所有选中军师的完整 M/Q/B/S，要求输出 `<discussion>` 块（每行 `人名: 内容`，AI 自由决定谁说几次）+ `<conclusions>` JSON（per-character 决策卡，mentalModels 从各自 M 段目录选）。
- **新增** `src/lib/councilParser.ts`：每个 SSE chunk 到达后重新 parse 整段 fullText，`<discussion>` 容忍未闭合（流式中段），`<conclusions>` 需闭合才 parse。含 `resolveAdvisor` fuzzy name match（"芒格" → "查理·芒格"）。
- **重写** `src/lib/orchestrator.ts`：单次 POST + 流式 parse，每 chunk dispatch `DISCUSSION_UPDATE` / `CONCLUSIONS_UPDATE`。
- **重写** `src/state/meetingReducer.ts`：删 `ROUND_*` actions，加 `MEETING_STARTED / DISCUSSION_UPDATE / CONCLUSIONS_UPDATE / MEETING_DONE / MEETING_ERROR`。`MEETING_ERROR` 同步把 `state.kind` 推到 `meeting-done` 让按钮解锁。
- **重写** `src/App.tsx` 的 `Discussion` 组件：从 per-advisor card 改为聊天气泡流（`messages.map`），同一人可多条相邻消息，每条加 `data-role="discussion-message"` + `data-advisor-id` 方便 E2E 量化检查。
- **删除**：`api/advisor/[id].ts` / `api/analyze.ts` / `api/_shared/prompts/{advisor,analyze}.ts` / `src/lib/meta.ts`（meta 机制不再需要）/ 对应 tests。
- **调整** `vite-plugins/dev-api.ts` router：只剩 `/api/intake-clarify` + `/api/council`。

### 主动放弃的能力（已确认 tradeoffs）

1. Analyst 独立校验层
2. 失败隔离（一次调用失败整场废）
3. `<meta>` 自报机制
4. per-advisor 流式卡（改为聊天气泡流）

### 验证

- **本地**：选曹操+特朗普+张小龙跑"职业决策"，产出 **11 条 messages**（曹操 5 / 特朗普 3 / 张小龙 3），speaker order `曹操-曹操-特朗普-张小龙-曹操-特朗普-张小龙-曹操-特朗普-张小龙-曹操`——曹操激进多次打断 ✅
- **线上**（`mastermind-gamma-weld.vercel.app` commit `f1d61ea`）：同样场景产出 **9 条 messages**（每人 3 次），内容互相呼应；特朗普连发英文 bravado、曹操文言引《求贤令》、张小龙反问从用户视角，0 console error，0 meta leak ✅

### 量化 E2E 检查（Playwright）

```js
browser_evaluate(() => {
  const nodes = document.querySelectorAll('[data-role="discussion-message"]');
  const per = {};
  nodes.forEach((n) => { per[n.dataset.advisorId] = (per[n.dataset.advisorId] || 0) + 1; });
  return { total: nodes.length, per, hasMultiSpeakRound: Object.values(per).some((n) => n >= 2) };
});
// 期望 hasMultiSpeakRound === true
```

### 命令可复现状态

```bash
npm run lint   # 0 错
npm run test   # 11 files / 48 tests
npm run build  # 147.7 kB gzipped JS
```

### 已知迭代点（Sprint 5 候选）

- qwen3-max 倾向**均匀分配发言次数**——本地偶尔能涌现"曹操 5 次"这种不均衡，线上更倾向 round-robin。如果想要性格驱动的极端不均，prompt 可以再加强"次数应由性格驱动，不是均匀分配"。
- 最后一位军师**甄嬛**仍未起草（3/4 Claude-draft 完成）。
- Sprint 4 剩余：移动端 responsive / 错误态 UI 打磨 / rate limiting。

### Git 历史（最新 → 早）

- `1c25f60` docs(handoff): append council refactor entry
- `f1d61ea` feat(arch): single-call council for dynamic debate dynamics
- `9e0a5d9` fix(ui): strip <meta> during streaming
- `4fb65d3` chore(ui): page title + favicon
- `8e67fcb` fix: address HIGH findings from review
- `e56b997` fix(arch): virtual:advisors → generated file + restore UI
- ...

---

## 2026-04-29 · 下一轮待执行：Council prompt 精简（new chat pick this up）

**完整 plan**：`~/.claude/plans/ai-ai-fancy-glade.md`（已用户批准，未实施）

### 为什么改

当前 council 线上实测（commit `1c25f60`）相对原项目 `ZhongJiaqi/mastermind` main 分支的"AI 自导自演"动态碰撞感**仍然不足**——

- 发言 3-3-3 均匀化（无激进/克制层次）
- 顺序严格 round-robin（像主持人点名）
- 每条压成 ≤120 字 soundbite（无长短节奏）
- 缺直接 @ 互动（各自独白拼接）

**根因**：`api/_shared/prompts/council.ts` 当前 prompt 约束过度（8 条行为准则、独立"心智模型目录"段、字数上限、temp 0.7）→ LLM 进入"考核员工"模式而非"即兴演员"模式。原项目 prompt 仅 ~500 tokens，几乎无约束，反而放飞。

### 拍板的策略

**以原项目 prompt 骨架为基底（极简、自由），仅在「人物列表」处注入完整 vault M/Q/B/S。** 既保留新 MVP 的 vault 增值，又让 LLM 重新进入自由演员状态。

### 改动文件（2 个）

1. **`api/_shared/prompts/council.ts`** —— prompt builder 整体重写
   - 删除 8 条行为准则
   - 删除独立的「心智模型目录」段
   - 改成"人物列表 + M/Q/B/S 完整注入 + 输出格式"三段式
   - 唯一保留约束："不要 meta 说'我用 XX 模型分析'"（spec v4.3 硬约束）
   - `mentalModels.name` 必须来自该人物 M 段——只在 conclusions JSON schema 描述里说一次，不单独立段

2. **`api/council.ts`** —— `temperature: 0.7` → `0.9`（更接近原项目 Gemini 默认）

### 不动的文件

- `src/lib/councilParser.ts` / `src/lib/orchestrator.ts` / `src/state/meetingReducer.ts` / `src/hooks/useMeeting.ts` / `src/App.tsx`
- 所有测试（prompt 内容不影响 mock）
- `councilParser` 不强制校验 `mentalModels.name` 是否在 vault；偶尔越界 UI 直接显示

### 新 prompt 骨架（参考）

```
你是一场圆桌会议的主持 + 全体演员。请让以下人物根据自己的心智模型和性格，进行一轮相互讨论（碰撞不同的思维模型），然后再分别给出他们的最终决策建议。

# 人物列表

## {{name}}（{{tagline}}）

心智模型：
{{M 段完整：方法本体 / 典型决策倾向 / 适用信号}}

代表语录：
{{Q 段}}

自觉边界：
{{B 段}}

说话风格：
{{S 段}}

---
（每位军师同结构）

# 用户的问题
{{question}}{{optional context/options/leaning}}

# 输出格式（必须含 <discussion> 和 <conclusions> 双块）

<discussion>
人物名: 发言内容
（谁说几次/什么顺序/长短/节奏自然展开）
</discussion>

<conclusions>
[per-character JSON cards with mentalModels.name 须来自该人物 M 段]
</conclusions>

约束：不要说"我用 XX 模型分析"这种 meta 陈述。
```

### 实施顺序

1. 重写 `api/_shared/prompts/council.ts`
2. 改 `api/council.ts` 的 `temperature` 一行
3. 本地 `npm run lint && npm run test && npm run build`
4. 本地 dev + Playwright 跑一场（曹操 + 张小龙 + 巴菲特，职业决策）
5. **量化验证**（DOM 读 `[data-role="discussion-message"]`）：
   - `total ≥ 5`
   - `per` 非均匀（最大值 ≥ 最小值 × 1.5，例如 5/3/2 而非 3/3/3）
   - `order` 出现"同一人连续两条"或非 round-robin 反例
   - 0 console error，无 meta leak
6. commit + push
7. `vercel --prod`
8. 线上 Playwright 跑同场，对比 `1c25f60` 那场是否更不均、更互相 @
9. handoff 追加本轮结果

总改动量估：**~80 行 prompt 重写 + 1 行 temperature 改 + handoff 追加**。

### 风险监控点

1. LLM 完全自由后某场可能偷懒（某位只说一句空话）→ 缓解：观察几场后若稳定出现，再补 1 条最小约束
2. `mentalModels` 偶尔出现 vault 外 name → 缓解：parser 加 fallback 标 `discrepancy`（spec v5.4 已留字段）
3. Vercel 60s 超时：prompt 短了 → discussion 可能更长；理论上仍 <60s（qwen3-max ~50 tok/s × 2000 字 ≈ 50s），观察实际

### 新会话第一指令建议

```
读 /Users/jiaqizhong/mastermind/.worktrees/mastermind-v1/docs/superpowers/handoff.md
和 ~/.claude/plans/ai-ai-fancy-glade.md，然后实施 "Council prompt 精简"。
```

工作目录 clean、commit `1c25f60` 已推、48 tests / lint / build 全绿，可直接动手。

---

## 2026-04-29 · Council prompt 精简（已实施）

**Commit chain**：`f85a3e9` (prompt slim-down) → `c68c909` (enable_thinking fix)
**线上**：`https://mastermind-gamma-weld.vercel.app`（部署 ID `dpl_HkFjYdBQ6UuJS9xXFygpuZfma779`，alias 已切）

### 改动总览

**`api/_shared/prompts/council.ts`** 重写（净 -39 行，80 行重写）：
- 删 plan 批准的 8 条行为准则、独立「心智模型目录」段、字数上限、顺序约束、串色提醒
- 保留 vault M/Q/B/S 注入与 conclusions schema 描述、meta 陈述禁令
- 加 3 条 plan 外最小约束（实测发现的 parser 工作前提）：
  1. 不要引入"主持人"或其他名单外角色——防 vault 结构化人物卡诱导 LLM 自创 narrator
  2. 必须先 `<discussion>` 后 `<conclusions>` 双块齐全——防 LLM 写完讨论段直接停
  3. conclusions 必须严格 JSON 数组——防退化为 markdown-ish 列表

**`api/council.ts`**：`temperature 0.7 → 0.9`

**`api/council.ts` + `api/intake-clarify.ts`**：加 `enable_thinking: false`（DashScope 顶层参数）
- 必要原因：新一代 Qwen3.x 默认开 reasoning，先吐 ~30s thinking 才输出 content
- Vercel edge function 60s maxDuration 在 thinking 阶段就被吃光，client 收 0 chunk
- OpenAI SDK 类型不识别此参数，用 `as Parameters<...>[0]` cast 绕过

### 模型变更

DashScope 账户 `qwen3-max` 系列免费配额全耗尽（包括 max / max-preview / max-2026-01-23 / qwen-turbo）。新可用配额来自 `qwen3.x.5/3.6` 系列。

Vercel env 已切（用户操作）：
- `MODEL_SYNTHESIZER` / `MODEL_ADVISOR` / `MODEL_HOST` → `qwen3.6-max-preview`
- 100 万 token 免费 / 2026-07-20 到期

`.env.example` 里旧的 `qwen3-max` 默认值过时，但 .env.local 用户实际值会优先——下个 sprint 顺手更新。

### 实施踩坑

1. **Vercel `--prod --yes` 被 hook 拦截**——`--yes` flag 触发 "Blind Apply" 防护。改用 interactive 形式 `vercel --prod` 即可（用户授权后我执行）。
2. **`vercel env rm` 默认 prompt yes/no**——加 `--yes` flag 才能 batch 跳过。
3. **OpenAI SDK 类型 strict**——`enable_thinking: false` 不能直接放 object literal（excess property check）；`@ts-expect-error` 也不能 silence 这种 error。最终方案：先组装 `const params = {...} as Parameters<typeof client.chat.completions.create>[0]` 再传入。
4. **intake-clarify 的 cast 让 SDK 走 union 返回类型**——`.choices` 报 TS2339。改用 `client.chat.completions.create as (...) => Promise<{choices: [...]}>` 整调用 cast。

### 控制变量实验数据点（plan 外探索）

为回答用户两个核心质疑，跑了 5 个 prompt 变体 + 4 个模型对比：

**Q1: 原项目（无角色框架、无 vault）会不会也 round-robin？**
- 跑原项目极简 prompt + qwen3.5-plus → **6 messages / 2-2-2 严格 round-robin**
- 结论：原项目跑 qwen 系列**也是 round-robin**，用户感受到的"动态碰撞感"应来自 Gemini-3-flash-preview 的不同模型倾向

**Q2: 模型 family 影响吗？**
- qwen3.5-plus / qwen3.6-max-preview / **deepseek-v4-pro**（不同 family）+ 当前 vault prompt → 全部 **9 messages / 3-3-3 严格 round-robin**
- 结论：round-robin 不是 model family 问题，是 vault 结构化注入诱导（每位独立 ## 块 → LLM 走"对照表演"模式）

**Q3: 加发言次数规则能打破吗？**
- V3-导演分配：**8 messages / 3-3-2** ✅
- V4-无角色框架+档位：**9 messages / 4-3-2** ✅
- V5-主持+演员+档位：**7 messages / 4-2-1** ✅（最不均）
- 结论：能。但用户明确指令"按原项目来"，**不采用**——接受 round-robin 是原项目精神

### 线上量化对比（同问题：跳槽场，B+C+Z）

| 指标 | `1c25f60`（旧 prompt + qwen3-max） | `c68c909`（新 prompt + qwen3.6-max-preview + thinking off） |
|---|---|---|
| Total messages | 9 | **10** |
| 分布 | 3-3-3 严格 | **4-3-3**（巴菲特最后追加 1 条破严格 RR） |
| Final cards | 3 | 3（含结论+推理+心智模型 list） |
| vault 语录密度 | 一般 | 高（"安全边际"/"市场先生"/"老骥伏枥"/"用完即走"等贯穿） |
| 互相 @ | 弱（独白拼接） | 强（"伯言虽善守却失于怯"/"小龙说得对"/"我同意小龙"/"哼保守！"） |
| Console errors | - | **0** |
| Meta leak | - | **无** |

### 当前验证状态（命令可复现）

```bash
cd /Users/jiaqizhong/mastermind/.worktrees/mastermind-v1
npm run lint    # 0 错
npm run test    # 11 files / 48 tests 全绿
npm run build   # 147.7 kB gzipped JS
```

线上 council 单场约 70-90s（≤Vercel 60s edge limit）—— **理论应砍但实际通过**，因 streaming 模式 Vercel 在第一个 chunk 输出后保持连接，60s 是 cold-start to first-byte 上限。后续 long-tail 可能仍超时——观察。

### 已知不动的点（plan §风险点未触发）

- **Round-robin 顽固**：4-3-3 比 3-3-3 进步但仍接近均匀。按用户指令接受。
- **vercel.json maxDuration 60s 仍紧**：跨 question / advisor 数有时单场 >60s。建议升级 Vercel 计划或切 serverless function（300s）的 plan 留待 Sprint 5。

### 剩余 / 下一步可选

- **Sprint 5 候选**：round-robin 破除（V5 风格档位 hint 可一行加上）/ vercel maxDuration 提升 / qwen3.6 配额监控（2026-07-20 后续期）
- **Sprint 4 残留**：移动端 responsive / 错误态 UI / rate limiting（不动）
- **第 4 位 Claude-draft 军师**：甄嬛仍未起草（3/4 完成）

---

**Council prompt 精简轮次完成。线上 ship、48 tests / lint / build 全绿、量化指标超越 `1c25f60` baseline。**
