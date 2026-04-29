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

---

## 2026-04-29（晚）· 收口：限制每人发言 1-2 次解决 60s 上限

**Commit**：`0e6502a` (perf: cap discussion at 1-2 rounds per person)
**线上**：同 `https://mastermind-gamma-weld.vercel.app`（已重新部署 alias）

### 问题

`c68c909` ship 后实测线上 council 单场约 70-90s——擦边 Vercel edge 60s maxDuration 上限。3 位军师场凑巧能跑通（streaming first-byte 计时宽松），但 4-5 位军师或长 question 会爆。

### 修复

prompt discussion 段说明从「谁说几次/节奏自然展开」改为「每位人物发言 1-2 次，短促有力胜过冗长」。1 行最小改动。

### 为什么这条不违背"按原项目来"

原项目极简 prompt 跑 qwen 实测就是 **6 messages / 2-2-2**（每人 2 次）—— 我们当前 vault 版加这行 hint 后 dev 端跑出 **6 messages / 2-2-2**，与原项目对齐。删掉这行反而比原项目更长（10 条 4-3-3）。所以这 hint 是**回归原项目**，不是引入新约束。

### 实测对比

| 指标 | `c68c909` baseline | `0e6502a`（本轮） |
|---|---|---|
| 用时 | 70-90s（擦边超 60s） | **46s 线上 / 42s dev** |
| Total messages | 10 | **8 线上 / 6 dev** |
| 分布 | 4-3-3 | **3-3-2 线上 / 2-2-2 dev** |
| Order | B-C-Z-B-C-Z-B-C-Z-B | **B-C-Z-B-C-Z-B-C**（曹操结尾抢话） |
| Cards | 3 | **3 valid** |
| Console error | 0 | **0** |

dev 端比线上更紧凑（2-2-2 vs 3-3-2）—— 可能 dev 模型实例 thread 资源更充足，跟得更紧 hint。无论如何，46s ≤ 60s 留足缓冲。

### 仍未解决

- **4+ 位军师场景**未实测，可能仍接近 60s 上限。Sprint 4/5 时跑多场配置矩阵验证。
- **Round-robin 顽固**：3-3-2 比 4-3-3 略不均，但 order 仍像 round-robin（"按原项目来"接受）。

### Vercel 计划讨论

- Hobby（免费）：edge 60s / serverless 10s——当前用
- Pro（$20/月 × 用户）：serverless 上限 300s（edge 仍 60s）
- 短期不升级。靠 prompt 优化把单场压到 ≤50s。

### 当前验证状态

```bash
cd /Users/jiaqizhong/mastermind/.worktrees/mastermind-v1
npm run lint    # 0 错
npm run test    # 48 tests 全绿
npm run build   # 147.7 kB gzipped JS
```

线上 deploy alias 已切到最新 commit `0e6502a`。

### 剩余任务（更新优先级）

🔴 **高优先级**
- DashScope 配额监控（2026-07-20 qwen3.6-max-preview 免费到期）

🟡 **中优先级**
- Sprint 4：错误态 UI / 移动端 responsive / Playwright E2E 基线
- Sprint 1.12：第 4 位 Claude-draft 军师 **甄嬛** 起草
- Sprint 5：军师质量回炉（5-10 场真实决策测试 → 调 vault）

🟢 **低优先级 / 清理**
- `.env.example` 默认 `qwen3-max` → `qwen3.6-max-preview`
- spec `qwen3-plus` / `qwen3-max` 引用更新
- main 分支同步（`0d9c928 chore: ignore .worktrees directory` 未 push）
- `feat/mastermind-v1` → main PR / 合并

⚪ **Plan §风险点 1 留白**
- Round-robin 完全破除（V5 风格档位 hint）—— 用户接受现状

---

**收口轮次完成。Council 链路从 70-90s 压到 46s（线上）/ 42s（dev），4 commit 一条命令链：`f85a3e9` → `c68c909` → `cd08709` → `0e6502a`。**

---

## 2026-04-29（夜）· Sprint 4 三档并行收口

**Commit chain**：`dca8e20` (ErrorBanner) → `8f47e7c` (mobile) → `93299d0` (parser fix + smoke E2E)
**线上**：`https://mastermind-gamma-weld.vercel.app`（已 deploy + smoke 验证）
**测试现状**：12 files / 57 tests 全绿（+9 tests vs 上轮）

### 第 1 档 · ErrorBanner 错误态 UI（`dca8e20`）

**新增** `src/components/ErrorBanner.tsx`（101 行）：
- 启发式映射：错误文本 → 友好标题 + 提示
  - DASHSCOPE_API_KEY missing → "服务暂时不可用"
  - quota exhausted → "模型额度已耗尽"
  - timeout → "请求超时"（提示简化问题）
  - network/fetch fail → "网络异常"
  - JSON parse → "军师返回格式异常"
  - fallback → 显示原始 message
- [重试] 按钮（仅服务端错误显示，前端校验错误隐藏）
- [关闭] 按钮 + 右上角 X icon
- role=alert + motion AnimatePresence 进出动画

**测试**：`tests/unit/ErrorBanner.test.tsx` 8 测覆盖每条启发式分支 + raw fallback。`vitest.config.ts` include 加 `.tsx` 支持。

**集成**：`src/App.tsx` 替换原 inline 红色文本块，retry 调 handleConsult，dismiss 调 reset。

### 第 2 档 · 移动端 responsive（`8f47e7c`）

最小响应式 tweak（375px 断点 pass），全部是给现有 Tailwind 类加 sm:/lg: prefix：

| 类 | 改动 |
|---|---|
| 主容器 padding | `px-6` → `px-4 sm:px-6` |
| main 上下 padding | `py-8` → `py-6 lg:py-8` |
| main grid gap | `gap-8` → `gap-6 lg:gap-8` |
| 左栏间距 | `space-y-8` → `space-y-6 lg:space-y-8` |
| 右栏卡片 | `rounded-3xl p-6 md:p-8 min-h-[600px]` → `rounded-2xl lg:rounded-3xl p-4 sm:p-6 md:p-8 min-h-[400px] lg:min-h-[600px]` |

### 第 3 档 · Parser fix + Smoke E2E（`93299d0`）

**Parser fix** `src/lib/councilParser.ts`：
- 实测 LLM（qwen3.6-max-preview）经常输出完 `]` 就停笔不写 `</conclusions>` 闭合 tag
- 原 parser 严格要求闭合 → cards 永远 null → UI 显示 0 cards 是真 UX 退化
- 修复：先匹配严格闭合 `<conclusions>...</conclusions>`，否则 fallback 到 `<conclusions>...$`（未闭合）。`parseConclusions` 的 JSON.parse 已 try/catch，流式中段还没写完 `]` 时 fallback 解析 fail 返 null——流式中无误判
- Plan §"风险监控点 1" 实测命中（"LLM 完全自由后某场可能偷懒"），用 parser 容忍而非加 prompt 约束的方式解决——保持"按原项目来"精神
- 新增 unit test 覆盖未闭合场景

**Smoke E2E** `scripts/smoke.mjs`：
- curl-based transport（Node 25 fetch 在 vercel.app 上偶发 connect timeout 60s+，curl happy-eyeballs 1s 就连得上）
- 跑 POST /api/council 跳槽场（B+C+Z），验证：
  - HTTP 200 / SSE done event 收到
  - discussion + conclusions 双块存在（容忍 conclusions 未闭合）
  - conclusions JSON 数组、长度 = 请求 advisor 数
  - 每张 card 有 advisorId/characterName/conclusion/reasoning/mentalModels
  - 请求的 advisorIds 全部出现在 cards
  - discussion 至少 1 条 message
- npm run smoke [host] 命令
- **线上跑：42.2s / 6 messages / 2-2-2 / 3 cards / closed=false / OK** ✅

### 实施踩坑

1. **Node 25 undici fetch 在 vercel.app 上 connect timeout 60s+**：尝试 setGlobalDispatcher、fetch with dispatcher、family=4 IPv4 强制——全部 60s+ timeout。curl happy-eyeballs 1s 就连得上。最终 smoke 用 spawn curl 做 transport。根因不明（DNS 解析 OK / TCP 443 OK / curl OK），疑似 Node 25 undici 与 vercel.app SNI/TLS handshake 兼容问题。
2. **`@testing-library/react` 没装、不动 lockfile**：ErrorBanner 单测改测 `toFriendly` 启发式映射纯函数（导出），UI render 留给手动 + smoke。
3. **vercel env rm 默认交互 prompt yes/no**：批量改用 `--yes` flag。
4. **OpenAI SDK 类型 strict**（上轮已踩）：`enable_thinking: false` 不能直接放 object literal——抽 `const params = {...} as Parameters<...>[0]` 绕过。

### 仍未 commit（等用户 review）

**`advisors/zhenhuan/SKILL.md`** 已写入磁盘 + zod 校验通过 + vault generator 已写入 9 advisors。等用户 review 4 段（M / Q / B / S）：
- M: 7 个心智模型（隐忍后发制人、借力打力反杀、察言观色读深层、以退为进、联盟即性命、风骨与务实并重、诗词隐喻）
- Q: 8 句代表语录（"宁可枝头抱香死"、"逆风如解意"等）
- B: 7 条自觉边界
- S: 10 条说话风格（半文言半白话、笑着说狠话、反问、对方话反给对方）

### 当前验证状态（命令可复现）

```bash
cd /Users/jiaqizhong/mastermind/.worktrees/mastermind-v1
npm run lint    # 0 错
npm run test    # 12 files / 57 tests 全绿
npm run build   # 153.45 kB gzipped JS
npm run smoke -- https://mastermind-gamma-weld.vercel.app  # 线上 E2E 42s 全 PASS
```

### 剩余任务

🟡 **中优先级**
- Sprint 1.12 甄嬛 commit（等用户 review）
- Sprint 5：军师质量回炉（5-10 场真实决策测试 → 调 vault）

🟢 **低优先级 / 清理**
- `.env.example` 默认 `qwen3-max` → `qwen3.6-max-preview`
- spec `qwen3-plus` / `qwen3-max` 引用更新
- main 分支同步（`0d9c928 chore: ignore .worktrees directory` 未 push）
- `feat/mastermind-v1` → main PR / 合并

⚪ **Plan §风险点留白**
- Round-robin 完全破除（V5 风格档位 hint）—— 用户接受现状
- DashScope 配额 2026-07-20 到期监控

---

**Sprint 4 三档完成 + prompt 链路收尾。线上稳定运行 42s，57 tests 全绿，smoke E2E 命令化。
完整 commit chain：`f85a3e9` → `c68c909` → `cd08709` → `0e6502a` → `84fc6c9` → `dca8e20` → `8f47e7c` → `93299d0`（共 8 commits）。**

---

## 2026-04-29（深夜）· Sprint 1.12 封闭：甄嬛入仓

**Commit**：`23c70e3` (feat: add 甄嬛 vault — Claude-draft 4/4)
**线上**：`https://mastermind-gamma-weld.vercel.app`（已 deploy + 实战验证）
**军师总数**：9 位（5 fork + 4 Claude-draft 全部完成）

### 入仓内容（用户参与 review + 调整）

frontmatter:
- `id: zhenhuan` / `tagline: 隐忍 / 借力打力 / 以退为进`
- `avatarColor: oklch(90% 0.06 340)`（粉色调）
- `speakStyle: 半文言半白话 · 善引诗词典故 · 表面温柔含蓄实则锋利 · 多反问与暗示`

**M（7 心智模型）**：
1. 隐忍为先 / 后发制人
2. 借力打力 / 用规则反杀
3. 极致察言观色 / 读深层动机
4. 以退为进 / 用低姿态换实质优势
5. 联盟即性命 / 选准盟友比击败敌人重要
6. 风骨与务实并重 / 守底线但不殉道
7. 长线投资 / 用时间换确定性 ⭐ 用户选定（替换初稿"诗词隐喻"——后者属于说话方式而非决策方法论，归 S 段）

**Q（6 句剧中甄嬛亲口台词）**：
- 嬛嬛一袅楚宫腰（初见雍正自报名字，引蔡伸《一剪梅》）
- 逆风如解意（倚梅园许愿，引崔道融《梅花》）
- 宁可枝头抱香死（多次自况，引朱淑真《黄花》）
- 愿得一心人（向皇上表达独占之爱，引卓文君《白头吟》）
- 终究是错付了（莞莞类卿真相后幻灭名句）
- 在这宫里有时候真心是很可笑的（情感本质领悟）

**用户 review 删除的不严谨引用**：
- ~~"颜色不齐人不齐"~~（出处不明确）
- ~~"皇上您害得世兰好苦啊"~~（**华妃**说的，年世兰 = 华妃）
- ~~"倚梅园那场雪夜"~~（观众概括，非剧中原话）

### 线上实测（"老婆闺蜜暗中举报抢晋升名额"场景）

35s 完成，6 messages，分布 2-2-2，3 cards JSON valid。**甄嬛 2 条都明显应用了 vault 的多个核心心智模型**：

第 1 条：M1（隐忍后发制人）+ M4（以退为进）
> 翻脸？那是下策。她既已暗中举报，便是撕破了脸皮...不如装作不知，静观其变...此时示弱，并非认输，而是为了看清她背后还有谁在撑腰。

第 2 条：M2（借力打力）+ M7（长线投资）+ 直接 @ 曹操和巴菲特
> 曹公说得痛快，但未免太过刚猛...与其主动出击，不如借 HR 之手，让她自食恶果...我们只需静静等待这把柄发酵，届时无需我们动手，局面自会反转。

speakStyle 验证：半文言（"便""既""不如""自有""无需"）/ 反问开场（"翻脸？那是下策"）/ 笑着说狠话（"自食恶果""局面自会反转"）/ 直接 @ 对方（"曹公""巴先生"）。**vault 在 LLM 上完全 fire**，不是 SKILL.md 文本被忽略。

### 已知 latent bugs（不在本轮 scope）

1. **单 advisor 时 LLM hallucinate advisorId**：跑 1 位 advisor (`buffett`) 时 LLM 输出 `advisorId: "warren_buffett"` 不是请求的 `"buffett"`。多位时（如 3 位）正常对齐。原因可能是 prompt 没明确要求 id 与请求一致。Sprint 5 候选修复点。

### 当前验证状态（命令可复现）

```bash
cd /Users/jiaqizhong/mastermind/.worktrees/mastermind-v1
npm run lint    # 0 错
npm run test    # 12 files / 57 tests 全绿
npm run build   # 153.69 kB gzipped JS（+ 甄嬛 SKILL ~3KB）
npm run smoke -- https://mastermind-gamma-weld.vercel.app  # 线上 E2E 全 PASS
```

### 剩余任务（更新优先级）

🟡 **中优先级**
- Sprint 5：军师质量回炉（5-10 场真实决策测试 → 调 vault；可与 advisorId hallucinate 修复并轨）

🟢 **低优先级 / 清理**
- `.env.example` 默认 `qwen3-max` → `qwen3.6-max-preview`
- spec `qwen3-plus` / `qwen3-max` 引用更新
- main 分支同步（`0d9c928 chore: ignore .worktrees directory` 未 push）
- `feat/mastermind-v1` → main PR / 合并

⚪ **Plan §风险点留白**
- Round-robin 完全破除（V5 风格档位 hint）—— 用户接受现状
- DashScope 配额 2026-07-20 到期监控

---

**Sprint 1（9 位军师）+ Sprint 4 三档全部封闭。
本轮总 commits：`23c70e3` (甄嬛入仓)。完整今日 chain：`f85a3e9` → `c68c909` → `cd08709` → `0e6502a` → `84fc6c9` → `dca8e20` → `8f47e7c` → `93299d0` → `731765c` → `23c70e3`（共 10 commits）。**

---

## 2026-04-29（深夜尾声）· UI sticky 左栏

**Commit**：`fc1c0d0` (feat: make left input panel sticky on lg screens)
**线上**：已 deploy + Playwright 验证

### 问题

讨论加 final cards 内容长时，桌面端右栏延续滚动，左栏保留为短表单——形成"右长左短"布局空洞，且用户读到底部想改问题/换军师必须滚回顶部。

### 修复

`src/App.tsx` 左栏 div 加 6 个 lg: 前缀类，移动端零影响：

```diff
- <div className="lg:col-span-5 space-y-6 lg:space-y-8">
+ <div className="lg:col-span-5 space-y-6 lg:space-y-8 lg:sticky lg:top-20
+                 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-2">
```

- `lg:sticky lg:top-20`：≥1024px 时左栏滚动吸附在 viewport top 80px 处（让出 header sticky bar 的 ~64px）
- `lg:self-start`：grid item 默认 stretch 满高度会破坏 sticky；self-start 让其自然高度
- `lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto`：左栏内容若超视口则内嵌滚动条，不会顶出
- `lg:pr-2`：给内嵌滚动条留缝

### Playwright 验证

scrollY 1713 / bodyHeight 2496（已滚到底）→ 左栏 viewport top 63.75px ✅

截图确认：
- 左栏（输入框 + 8 张军师卡片含高亮）保持在视口左侧不动
- 右栏 discussion 滚到第 5 条以下
- 甄嬛 "借力打力" + "以退为进" vault 完美 fire on 跳槽场

### 移动端零回归

`lg:` prefix 仅 ≥1024px 触发，移动端仍保持原单列流式（左栏在上 / 右栏在下），无 sticky / 无滚动嵌套。

---

**Sprint 1 + Sprint 4 + sticky UI 全部 ship。今日总 commits：11（含 sticky 这一档 `fc1c0d0`）。
完整 chain：`f85a3e9` → `c68c909` → `cd08709` → `0e6502a` → `84fc6c9` → `dca8e20` → `8f47e7c` → `93299d0` → `731765c` → `23c70e3` → `12267ed` → `fc1c0d0`。**

---

## 2026-04-29（凌晨）· Sprint 5 Round 1 · 军师质量回炉

**Commit**：`6da5ae8` (fix: prompt + vault — Sprint 5 round 1)
**线上**：`https://mastermind-gamma-weld.vercel.app`（已 deploy + audit 验证）

### 跑了什么

写了 `/tmp/audit-runner.mjs` 批量 6 场决策（跨投资 / 创业 / 情感 / 谈判 / 职业 / 日常 6 个领域），每场 27-42s 完成，dump 到 `/tmp/audit-results.json` 系统 review。

### Round 0 发现的 3 类问题

| 类 | 现象 | 严重度 |
|---|---|---|
| 1 | **advisorId hallucinate** — LLM 把 vault id `buffett` 输出成 `warren_buffett`、`caocao` 成 `cao_cao`、`zhenhuan` 成 `Zhen Huan`（首字母+空格）。客户端 cards 的 advisorId 跟 vault 不对齐 | latent bug，影响数据完整性 |
| 2 | **vault 教条化 / 模型名当口头禅** — 巴菲特 5/5 场必喊"安全边际"、芒格 4/5 场"反过来想"开场、甄嬛 4/5 场必引"宁可枝头抱香死"、马斯克 5/5 场"白痴指数" | 影响内容自然度 |
| 3 | **轻问题被过度严肃化** — "今晚吃日料还是火锅"被芒格分析"食物中毒概率"，张小龙说"不希望吃饭变成表演" | 影响日常 UX |

Bonus：**甄嬛"陛下…哦不，先生"穿越破戏**（场 5 出现）。

### Round 1 修复

**`api/_shared/prompts/council.ts`**（修类 1 + 类 2 + 类 3）：
- advisor 块标题加 `id: \`{id}\``，让 LLM 看到精确字符串
- conclusions schema `advisorId` 描述明确：使用上方 id 后字符串，不要变形为 `warren_buffett` / `cao_cao` / `Zhen Huan` 等
- 约束段加 3 条：
  - `advisorId` 严格使用 id: 后字符串区分大小写（修类 1）
  - 不要把同一模型名当口头禅反复念（修类 2）
  - 问题轻松时（日常吃喝）发言也要轻松短促，不要升级为人生哲学（修类 3）

**`advisors/zhenhuan/SKILL.md`** S 段加：
- 不要刻意搞"陛下…哦不，先生"穿越笑点；用"先生""这位""大人"替代"陛下"，"职场""家中"替代"宫里"

**`advisors/trump/SKILL.md`** 暂不动——他的 vault 已经写得很到位（极简大词、tremendous/huge、结论先行），LLM 输出已含 Tremendous/Think Big/BAD DEAL 等关键元素。

### Round 1 实测结果（同 6 场重跑）

| 指标 | Round 0 baseline | Round 1 修复后 |
|---|---|---|
| advisorId 匹配 | 5/6 场 hallucinate | **6/6 场全对齐** ✅ |
| 甄嬛穿越破戏 | 1 场出现 | **0 场** ✅ |
| 巴菲特 vault 关键词频率（场均） | 4-5 次 | 2-4 次 ↓ |
| 张小龙情感场关键词 | 多次"用户体验/同理心/克制" | **0 次** ✅ |
| 轻决策严肃度 | 芒格"食物中毒概率"+ 张小龙"吃饭变表演" | "问问大家""开心最重要""看天气和心情" ✅ |
| 单场用时 | 27-42s | 25-41s（持平） |

**Round 1 轻决策实例对比**：

Round 0:
> 芒格：日料的食材新鲜度是高风险变量，一旦不新鲜，整晚心情归零。火锅的食材经过高温煮沸，生物风险极低...
> 张小龙：我不希望吃饭变成一种表演或任务...

Round 1:
> 芒格：先别急着选。反过来想：怎么才能让这顿饭吃得最难受？如果朋友里有肠胃敏感的，火锅就是灾难。还有，看看激励机制——是谁提议的？
> 张小龙：那就看天气和心情吧。如果觉得累，想吃点不用动脑子的、热闹的，就火锅。如果想静静聊聊天，就日料。别让选择变成负担，**吃完就走，开心最重要**。

### 仍可优化（Round 2 候选，本次先 hold）

- **段永平在投资主场仍 7 次** vault 关键词——他是价值投资 archetype，可以理解；非主场场景已降到 4 次以下
- **巴菲特情感场仍 4 次** vault 关键词——他擅长把情感金融化，已比 round 0 减少
- **trump 中英夹杂仍偏少**：vault S 段已写"极简大词 tremendous/huge"，但 LLM 出于中文语境很少混入英文。可以试在 S 段加更显式约束"每段必带 1-2 个英文大词"
- **discussion 仍偏 round-robin**：按用户"按原项目来"指令保持现状

### 当前验证状态

```bash
cd /Users/jiaqizhong/mastermind/.worktrees/mastermind-v1
npm run lint    # 0 错
npm run test    # 12 files / 57 tests 全绿
npm run build   # 153.88 kB gzipped JS
npm run smoke -- https://mastermind-gamma-weld.vercel.app  # 持续 PASS
node /tmp/audit-runner.mjs  # 6 场审计 25-41s 全 PASS / advisorId 6/6 对齐
```

### Sprint 5 状态

🟢 Round 1 ship（latent bug + 教条化 + 轻问题 三档修完）
⚪ Round 2（深度打磨）—— 看用户后续是否需要

### 剩余任务（更新优先级）

🟢 **低优先级 / 清理**
- `.env.example` 默认 `qwen3-max` → `qwen3.6-max-preview`
- spec `qwen3-plus` / `qwen3-max` 引用更新
- main 分支同步（`0d9c928 chore: ignore .worktrees directory` 未 push）
- `feat/mastermind-v1` → main PR / 合并

⚪ **Plan §风险点留白**
- Round-robin 完全破除（V5 风格档位 hint）—— 用户接受现状
- DashScope 配额 2026-07-20 到期监控
- Sprint 5 Round 2（trump 中英夹杂强化 / 巴菲特情感场金融化压制）—— 看需要

---

**Sprint 5 Round 1 完成。本轮 commits：`6da5ae8`（prompt+vault 修复）+ handoff 追加。
今日累计 chain：`f85a3e9` → `c68c909` → `cd08709` → `0e6502a` → `84fc6c9` → `dca8e20` → `8f47e7c` → `93299d0` → `731765c` → `23c70e3` → `12267ed` → `fc1c0d0` → `e1c0618` → `6da5ae8`（共 14 commits）。**

---

## 2026-04-29（凌晨末）· 收尾杂项 + PR 创建

**Commit**：`e28e98e` (docs: env+spec to qwen3.6-max-preview)
**Main 同步**：`0d9c928 chore: ignore .worktrees directory` 已 push 到 origin/main
**PR**：https://github.com/ZhongJiaqi/mastermind/pull/1（OPEN，63 commits, +14460/-366 跨 62 files）

### 改动

**`.env.example`**：
- 默认值 `qwen3-max` → `qwen3.6-max-preview`
- 注释更新可用模型清单：`qwen3.6-max-preview` ⭐ / `qwen3.5-plus` / `deepseek-v4-pro`
- 提示 Qwen 3.x 默认开 reasoning，已通过 `enable_thinking: false` 关闭

**`docs/superpowers/specs/2026-04-22-mastermind-design.md`**：
- 11 处过时 `qwen3-max` 引用替换为 `qwen3.6-max-preview`
- v5.5 changelog 历史记述还原（被 sed 全局替换误改的部分）
- 追加 v5.6 changelog 记录本轮迁移（含 enable_thinking 修复）
- 仅剩 2 处 `qwen3-max` 在 changelog v5.5/v5.6 历史记述里（事实记录，保留）

**Main 分支同步**：本地 main 比 origin 多 1 个 commit `0d9c928 chore: ignore .worktrees directory` 之前未 push，本轮 push 同步。

### PR 状态

- **OPEN**（不直接 merge，等用户 review + 决定何时合）
- **63 commits** 跨 Sprint 0-3 架构迁移 / Sprint 1.x 9 位军师 / 单次 council 重构 / Sprint 4 UI 三档 / Sprint 5 Round 1
- **+14460 / -366 lines / 62 files**
- 自动跑了 PR base check（GitHub 端会触发 Vercel preview deployment）

### 合并建议（写在 PR body 里）

- 合并前推荐：用户在线上 manual 试 2-3 个问题确认满意
- 建议 squash 或 merge commit：63 commits 详细记录每一步演进，merge commit 保留历史更有教学价值；如喜欢干净 main 可 squash
- 不阻塞：feat 分支已自带 deploy 到 prod，main 合并后触发同 prod URL 的 main 分支 deploy

### 剩余任务

⚪ **完全 wrap-up**
- 用户 review PR 1 + merge / squash
- DashScope 配额 2026-07-20 到期监控（提前提醒续期或切付费）

⚪ **未来 Sprint 5 Round 2 候选（可选）**
- trump 中英夹杂强化（可在 S 段加"每段必带 1-2 个英文大词"）
- 巴菲特情感场金融化压制（情感场仍 4 次 vault 关键词偏多）
- Round-robin 完全破除（V5 风格档位 hint）—— 用户接受现状

---

**今日 Mastermind v1 完整 ship + PR 创建。
最终 chain（共 16 commits）：`f85a3e9` → `c68c909` → `cd08709` → `0e6502a` → `84fc6c9` → `dca8e20` → `8f47e7c` → `93299d0` → `731765c` → `23c70e3` → `12267ed` → `fc1c0d0` → `e1c0618` → `6da5ae8` → `fcfa254` → `e28e98e`。**

---

## 2026-04-29（深夜后）· PR #1 merged + README rewrite + Sprint 6（12 位军师）

会话尾段连续 ship 5 个 PR 把 main 同步到完整 v1 + 扩展到 12 位军师。

### PR #1 → merged（main 同步到 v1）

- `gh pr merge 1 --merge` → `daf14f8 Merge pull request #1`
- main 从原项目 Gemini 单次调用版（3 commits）跳跃到完整 Qwen v1（含 9 位军师 + sticky UI + Sprint 5 round 1）
- README 之前是 AI Studio 模板，会话尾**完整重写**：项目介绍 / 9 位军师 / 设计取向 / 技术栈 / 开发命令 / 部署步骤 / 添加新军师 4 步指南 / 项目结构图 / 致谢

### Sprint 6 Round 1 · 4 位新军师入仓（PR #2 merged）

- **`jobs`**（史蒂夫·乔布斯）：fork 自 [alchaincyf/steve-jobs-skill](https://github.com/alchaincyf/steve-jobs-skill) 重构为 M/Q/B/S 4 段
  - 6 心智模型：反市调 / 减法即设计 / 交叉学科 / 现实扭曲力场 / A 级人才 / 端到端整合
- **`cialdini`**（罗伯特·西奥迪尼，《影响力》作者）：基于书原创起草（无社区现成）
  - 7 心智模型：互惠 / 承诺一致 / 社会认同 / 喜好 / 权威 / 稀缺 / 联盟（Unity）
- **`kahneman`**（丹尼尔·卡尼曼）：参考 [0xNyk/council-of-high-intelligence](https://github.com/0xNyk/council-of-high-intelligence) council-kahneman.md 重构
  - 6 心智模型：系统 1/2 / 锚定 / 损失厌恶 / 可得性启发 / 计划谬误 / WYSIATI
- **`holmes`**（夏洛克·福尔摩斯）：参考 [NimritaKoul/sherlock-holmes-agent-skill](https://github.com/NimritaKoul/sherlock-holmes-agent-skill) 重构
  - 6 心智模型：排除不可能 / 数据先于理论 / 观察 vs 看见 / 演绎链 / 不轻信表象 / 知识专精

`src/constants.ts` 加 4 配色（zinc / yellow / cyan / indigo）。

实测线上（4 位同台跑"AI 写作工具创业"）：46s / 8 messages / 2-2-2-2 / 4 cards JSON valid / vault 完美 fire（jobs "Notion AI 是通用领域的诺基亚，臃肿、平庸、毫无灵魂" / cialdini 4 个原理具体应用 / kahneman 5 工具链 / holmes "排除显而易见即真相"）/ 互动 @ 多次。

### 删除 2 位（PR #3 merged · 用户决定）

按用户要求删 `zhangxiaolong` 和 `zhangyiming`：
- 删除 `advisors/zhangxiaolong/` `advisors/zhangyiming/` 整个目录
- `src/constants.ts` 移除两位的 ADVISOR_COLORS
- `README.md` 同步：13 → 11 位

总数：13 → 11。

### Sprint 6 Round 2 · Aurelius 入仓（PR #4 merged）

用户决定加 `aurelius`（马可·奥勒留）填补"内在修养型"维度——现 11 位都没法处理"焦虑、逆境、不可控"类问题。

- **`aurelius`**：参考 council-aurelius.md + 《沉思录》原文重构
  - 6 心智模型：控制圈三重区分 / 朝死而生 Memento Mori / Obstacle is the Way 逆境即素材 / 自省日记 / 同理心源于"我们都是人" / 理性是人独有资产
  - 6 句代表语录全部来自《沉思录》（"You have power over your mind not outside events" / "The impediment to action advances action" 等）
  - 6 条自觉边界（含"结构性不公面前可能变成自我安慰""'逆境即素材' 会被滥用为不作为借口"等真实警觉）
  - 9 条说话风格（简短有力 / 不空说鸡汤给具体动作 / 区分困难 vs 不可能 / 直击道德责任）
  - 配色：bg-stone-200（朴素灰，斯多葛克制气质）

实测精神困境场景（"父亲突发脑出血住院 ICU，焦虑得无法工作"，配 kahneman + zhenhuan）：38s / 6 messages / 2-2-2 / 3 cards JSON valid。Aurelius 完美 fire：
> "停下。你现在的焦虑，是在试图控制'父亲的预后'和'老板的评价'，这两者皆不在你手中..."（控制圈）
> "若这是最后一周，你会如何陪伴？若这是最后的机会，你会如何交代工作？"（朝死而生）
> "甄嬛说得有几分道理，但核心仍是德行..."（直接 @ + 道德责任）

### Smoke fix（PR #5 merged）

PR #3 删 zhangxiaolong 后 `scripts/smoke.mjs` payload 还在引用，server filter 后只剩 2 位 advisor，LLM 正确输出 2 cards 但 smoke 误报 'expected 3 got 2' 失败。改为 `zhenhuan`。

### 12 位最终阵容

```
🏛 哲学/修养    aurelius (马可·奥勒留)              ⭐ 最新

🏦 投资/战略    buffett / munger / duanyongping
🚀 创业/产品    musk / jobs
🧠 心理/影响力  cialdini / kahneman
⚔️ 政治/谈判    caocao / trump
🎭 文学/虚构    zhenhuan / holmes
```

来源：4 位 fork（munger / musk / buffett / duanyongping）+ 3 位 Claude-draft + 用户 review（trump / caocao / zhenhuan）+ 5 位参考社区资料 + Claude-draft（jobs / cialdini / kahneman / holmes / aurelius）。

### 5 个 PR 全部合并（main 同步完整）

| PR | 内容 | merge commit |
|---|---|---|
| #1 | Mastermind v1（63 commits 跨架构迁移 / 9 位军师 / Sprint 4 / Sprint 5 round 1） | `daf14f8` |
| #2 | 4 位新军师 + README 13 位 | `679758d` |
| #3 | 删 zhangxiaolong + zhangyiming | `0330076` |
| #4 | Aurelius 入仓 + README 12 位 | `cd77367` |
| #5 | smoke fix | `ba2a31b` |

main 现 = origin/main = feat/mastermind-v1 完全同步。

### 当前线上 / 命令

```bash
线上：https://mastermind-gamma-weld.vercel.app（12 位军师可用）

cd /Users/jiaqizhong/mastermind/.worktrees/mastermind-v1
npm run lint    # 0 错
npm run test    # 12 files / 57 tests 全绿
npm run build   # 168 kB gzipped JS（含 12 位 vault）
npm run smoke -- https://mastermind-gamma-weld.vercel.app  # PASS（38s / 3 cards）
```

### 已知未解决

🟡 **DashScope 配额监控**：`qwen3.6-max-preview` 100 万 token 免费配额 **2026-07-20 到期**。届时需切按量付费或换其他可用模型。

⚪ **Latent bugs（用户接受现状）**：
- 单 advisor 调用时 LLM 偶发 hallucinate advisorId（如 `warren_buffett` 不是 `buffett`）—— 多位调用时 prompt 改进后已对齐
- discussion 倾向 round-robin 节奏（实测跨模型 family 都这样，原项目同样）—— "按原项目来"接受
- LLM 偶发不闭合 `</conclusions>`tag —— parser 已加 fallback 容忍

### 下次会话起点

**所有功能层 ship + 测试覆盖 + 文档更新完毕。** 下次会话可选方向：

1. **Sprint 5 Round 2**（深度打磨）：trump 中英夹杂强化 / 巴菲特情感场金融化压制 / 已有 11 位的 vault 二轮回炉
2. **新增军师**：候选清单（Naval Ravikant / Linus Torvalds / Donella Meadows / 塔勒布 / 费曼 / 王阳明 / 苏格拉底 / 老子）
3. **功能扩展**：会议存档列表 UI / 分享链接 / multi-language vault / 导出 Markdown 决策报告
4. **运维**：DashScope 配额监控告警 / 切换备用模型预案 / 移到自有 LLM

无紧急 blocker。线上服务稳定运行。

### 起手指令建议（新会话）

```
读 /Users/jiaqizhong/mastermind/.worktrees/mastermind-v1/docs/superpowers/handoff.md
末尾"2026-04-29（深夜后）· PR #1 merged + README rewrite + Sprint 6（12 位军师）"段
确认现状，然后讨论下一步走哪条。
```

工作目录 clean、main 与 feat 同步、12 位军师线上可用、57 tests / lint / build / smoke 全绿，可以从任何方向起手。

---

**Sprint 6 完整结束。今夜累计 22 commits（PR #1-#5 全 merged）。Mastermind 12 位军师阵容稳定线上。**
