# Mastermind 智囊团

> 顶级思维决策模拟器——把芒格、巴菲特、段永平、马斯克、乔布斯、西奥迪尼、卡尼曼、曹操、特朗普、甄嬛 10 位人物的心智模型注入到一场圆桌会议里，针对你的决策问题碰撞讨论，给出每位军师的最终决策卡。

**入口**：
- 网页：[mastermind-gamma-weld.vercel.app](https://mastermind-gamma-weld.vercel.app)
- 飞书 DM：加自建应用「决策圆桌」机器人，私聊发问题 → 勾军师 → 卡片流式输出讨论 + 决策（详见 [飞书集成](#飞书-dm-集成)）

## 设计取向

- **心智模型是本质，人物是包装**——每位军师是若干心智模型的人格化封装。决策时调用的不是"巴菲特怎么说"，是他背后的安全边际、能力圈、复利等思维工具。
- **结构化 vault**——每位军师在 `advisors/<id>/SKILL.md` 用 `M（心智模型）/Q（代表语录）/B（自觉边界）/S（说话风格）` 4 段刻画。`B` 段（自觉边界）让军师在自己思维不适用时主动警觉，避免单一视角的盲区。
- **单次 LLM 调用同时演多人**——相比 N 次独立调用，更贴近圆桌讨论的对话动态：互相 @、当面反驳、连续追加。一次响应给齐讨论 + 每人最终决策卡。

## 10 位军师

### 投资 / 战略

| ID | 名字 | 标签 |
|---|---|---|
| `buffett` | 沃伦·巴菲特 | 价值投资 / 长期主义 / 安全边际 |
| `munger` | 查理·芒格 | 多元思维 / 逆向思考 / 普世智慧 |
| `duanyongping` | 段永平 | 本分 / 做对的事情 / 把事情做对 |

### 创业 / 产品

| ID | 名字 | 标签 |
|---|---|---|
| `musk` | 埃隆·马斯克 | 第一性原理 / 物理学思维 / 极致野心 |
| `jobs` | 史蒂夫·乔布斯 | 极简偏执 / 交叉学科 / 现实扭曲力场 |

### 心理 / 影响力

| ID | 名字 | 标签 |
|---|---|---|
| `cialdini` | 罗伯特·西奥迪尼 | 互惠 / 承诺一致 / 社会认同 |
| `kahneman` | 丹尼尔·卡尼曼 | 系统 1/2 / 损失厌恶 / 反偏差 |

### 政治 / 谈判

| ID | 名字 | 标签 |
|---|---|---|
| `caocao` | 曹操 | 实用主义 / 杀伐果断 / 唯才是举 |
| `trump` | 特朗普 | 交易艺术 / 杠杆 / 打回去更重 |

### 文学 / 虚构

| ID | 名字 | 标签 |
|---|---|---|
| `zhenhuan` | 甄嬛 | 隐忍 / 借力打力 / 以退为进 |

每位 vault 含 6-7 个心智模型 + 5-7 句代表语录 + 5-6 条自觉边界 + 8-10 条说话风格。具体素材来源见末尾 [致谢](#致谢)。

## 技术栈

- **前端**：Vite + React 19 + TypeScript + Tailwind CSS 4 + Motion (Framer Motion 后继)
- **LLM**：阿里云百炼 DashScope（OpenAI 兼容端点）调 Qwen 3.x（默认 `qwen3.6-max-preview`） + 自愈兜底链（quota/timeout 时自动切下一个模型）
- **后端**：Vercel Edge Functions（runtime: 'edge'，maxDuration 60s），SSE 流式响应
- **Share view SSR**：`api/share-ssr.ts`（Edge runtime, hkg1 region）拦截 `/?c=<shareId>`，从 KV 取 share blob 服务端 SSR 到 `<div id="root">` + 注入 `window.__INITIAL_SHARE__`，HTML 落地即可见内容（首屏从 ~1s 空白降到 ~250ms）。`vercel.json` 用 `routes` 字段（priority over filesystem）把 `/?c=` 路由到这个 endpoint
- **飞书 DM**：`@larksuiteoapi/node-sdk` `WSClient` 长连接，selector 走 Card 2.0 `form` + `checker`（客户端 local state，toggle 零服务端往返），KV 持久化 share blob 供网页拉取
- **持久化**：Upstash Redis（KV REST），存 selector pending state + share blob
- **测试**：Vitest（17 文件 / 110 单元 + 集成测试）
- **E2E**：`scripts/smoke.mjs` curl-based council smoke 命令

## 本地开发

### 前置要求

- Node.js ≥ 20
- 阿里云百炼 API Key（[bailian.console.aliyun.com](https://bailian.console.aliyun.com/)）

### 启动

```bash
# 1. 安装依赖
npm install

# 2. 准备环境变量
cp .env.example .env.local
# 编辑 .env.local 填入 DASHSCOPE_API_KEY

# 3. 跑起来
npm run dev      # http://localhost:3000
```

### 命令清单

```bash
npm run dev          # 本地开发服务器（前后端一体，自动 mock edge function 路由）
npm run build        # 生产构建
npm run preview      # 预览构建产物
npm run lint         # 类型检查
npm run test         # 单元 + 集成测试
npm run test:watch   # watch 模式
npm run test:cov     # 覆盖率
npm run smoke [host] # E2E 测一次完整 council 调用（默认 localhost:3000）
npm run gen:advisors # 重新生成 vault（dev/build/test 时自动跑，通常无需手动）
```

## 环境变量

详见 [.env.example](.env.example)。核心三个：

```bash
DASHSCOPE_API_KEY=sk-xxxxxx
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
MODEL_SYNTHESIZER=qwen3.6-max-preview  # council 单次调用用此模型
```

## 部署到 Vercel

```bash
vercel link               # 关联到 Vercel 项目
vercel env add DASHSCOPE_API_KEY production
# ... 类似添加 DASHSCOPE_BASE_URL / MODEL_SYNTHESIZER / MODEL_ADVISOR / MODEL_HOST
vercel --prod
```

`vercel.json` 用 `routes` 字段把 `/?c=<id>` 路由到 `api/share-ssr`（必须用 `routes` 不能用 `rewrites`，否则静态 index.html 优先 serve，路由不生效）。`api/*` 目录下其他文件由 Vercel auto-detect 为 Edge Functions。

**KV（Upstash Redis）**：Vercel Dashboard → Storage → Marketplace 装 Upstash for Redis，会自动注入 `KV_REST_API_URL` + `KV_REST_API_TOKEN`。`api/share-ssr` SSR 注入 + 飞书 worker share blob 通道都依赖这两个变量。

## 飞书 DM 集成

「决策圆桌」机器人提供完整的飞书私聊体验：发问题 → 卡片勾军师 → 流式输出讨论 + 决策 → 一键跳网页看完整内容。

**关键设计**：

- **selector 用 Card 2.0 `form` + `checker`**：勾选/取消军师走客户端 local state，零服务端往返，秒响应。只有「🚀 开始讨论」按钮才走 worker
- **WSClient 长连接而非 webhook**：飞书 webhook 3 秒 ack 死线对 Vercel edge 冷启动太紧，且 China → Vercel sin1 延迟不稳。`scripts/feishu-worker.ts` 跑常驻进程，从 worker 向飞书开 WS，避开所有冷启动
- **流式 patch**：council SSE 流过来时，每 2s 把当前 parse 出的讨论 patch 到同一张卡片，给用户「逐字打字」的实时感
- **`?c=<shareId>` 跳网页**：worker 在 KV 存 share blob，「在网页上看完整讨论」按钮链接到 `/?c=<shareId>`，`api/share-ssr.ts` 服务端注入数据 + SSR 内容，HTML 一到就看到讨论 + 决策（不等 JS bundle）

**飞书后台配置**（一次性）：
1. 开发者后台创建企业自建应用，权限给 `im:message` + `im:message:send_as_bot`
2. 事件订阅模式选「使用长连接接收事件」
3. 卡片回传配置同上
4. 订阅 `im.message.receive_v1`（接收 DM）+ `card.action.trigger`（接收按钮点击）

**所需 env**（详见 [.env.example](.env.example)）：

```bash
# 飞书自建应用凭证（开发者后台 → 凭证与基础信息）
FEISHU_APP_ID=cli_xxxxxxxxxxxxx
FEISHU_APP_SECRET=xxxxxxxxxxxxx

# KV（worker 写 / 网页 middleware 读）
KV_REST_API_URL=https://xxx.upstash.io
KV_REST_API_TOKEN=xxx

# 「在网页上看完整讨论」按钮的 base URL
PUBLIC_BASE_URL=https://mastermind-gamma-weld.vercel.app
```

**运行 worker**：

worker 内置三层 WS watchdog（`wsConfig.pingTimeout: 60` SDK liveness + `handshakeTimeoutMs: 30000` + `setInterval` poll `reconnectAttempts >= 20` 触发 `process.exit(1)`），需要配进程级 supervisor 自动拉起。推荐 macOS launchd（KeepAlive=true），也支持手动 nohup。

```bash
# 方案 1（推荐）：launchd 管理
# 写 ~/Library/LaunchAgents/com.your.app.feishu-worker.plist (KeepAlive=true / ThrottleInterval=10 / RunAtLoad=true)
launchctl load ~/Library/LaunchAgents/com.your.app.feishu-worker.plist
launchctl list | grep feishu-worker    # state=0 表示正常

# 方案 2：手动 nohup（适合短期调试）
nohup node --env-file=.env.worker $(npm root)/.bin/tsx scripts/feishu-worker.ts \
  > /tmp/feishu-worker.log 2>&1 &
echo $! > /tmp/feishu-worker.pid
# 让 Mac 不睡眠（worker 是长连接，Mac 一睡就断）
nohup caffeinate -dimsu > /dev/null 2>&1 &

tail -F /tmp/feishu-worker.log    # 看到 "ws client ready" 就能用了
```

**部署到云端**（Railway / Fly.io / VPS）：`package.json` 已配好 `npm start`（`tsx scripts/feishu-worker.ts`），把 11 个 env 灌到平台即可。`.github/workflows/feishu-worker.yml` 提供 GitHub Actions cron-chain 兜底方案（公开仓库免费跑，但每 6h rollover 会撞飞书 WS slot 3-5min 空窗，体验差，默认 `disabled_manually`，需要时 `gh workflow enable "Feishu Worker"` 启用）。

## 添加新军师

1. 创建 `advisors/<id>/SKILL.md`，结构参考已有军师（如 `advisors/buffett/SKILL.md`）
2. 必填 frontmatter：`id` / `name` / `tagline` / `avatarColor` / `speakStyle` / `sources` / `version`
3. 必填正文 4 段：`## M`（心智模型，每个含方法本体 / 典型决策倾向 / 适用信号）/ `## Q`（代表引用）/ `## B`（自觉边界）/ `## S`（说话风格）
4. 跑 `npm run gen:advisors`——zod 校验 + 写入 `src/generated/advisors.ts`
5. 在 `src/constants.ts` 的 `ADVISOR_COLORS` 里加配色（可选）

## 项目结构

```
mastermind/
├── advisors/                       # 10 位军师 vault（每位一个 SKILL.md）
├── api/                            # Vercel Edge Functions
│   ├── council.ts                 # 单次 SSE 调用同时演多位军师
│   ├── intake-clarify.ts          # 主持人追问（暂未启用，预留接口）
│   ├── share.ts                   # GET /api/share?id=<shareId> 取 KV blob
│   ├── share-ssr.ts               # `/?c=<id>` 路由到这：SSR 注入 + window.__INITIAL_SHARE__
│   └── _shared/
│       ├── llm-chain.ts           # 自愈兜底链（quota 切下一模型）
│       ├── council-run.ts         # SSE 流共享给 worker 复用
│       ├── kv.ts                  # Upstash Redis REST 封装
│       └── feishu/card.ts         # 飞书 4 张卡片 builder（selector/streaming/council/pending），全 schema 2.0
├── src/
│   ├── components/                # ErrorBanner / CouncilOutput / ...
│   ├── hooks/useMeeting.ts        # 状态机入口
│   ├── lib/
│   │   ├── orchestrator.ts        # 客户端单次调用 + 流式 parse
│   │   ├── councilParser.ts       # SSE fullText → discussion + cards
│   │   └── sseClient.ts           # fetch + ReadableStream wrapper
│   ├── state/meetingReducer.ts    # 状态机
│   └── App.tsx                    # 同时承载编辑器 + /?c=<id> 分享视图
├── vite-plugins/
│   ├── advisors.ts                # 扫描 vault → src/generated/advisors.ts
│   └── dev-api.ts                 # dev 时模拟 edge function 路由
├── tests/                         # 17 files / 110 tests
├── scripts/
│   ├── gen-advisors.ts            # 一次性生成 vault
│   ├── feishu-worker.ts           # 飞书 WS 长连接 worker（常驻进程）
│   └── smoke.mjs                  # E2E smoke
├── middleware.ts                  # ⚠️ DEPRECATED 保留作历史警告：Vite 下 Vercel 不 auto-detect root middleware.ts，逻辑已迁到 api/share-ssr.ts
├── .github/workflows/
│   └── feishu-worker.yml          # GitHub Actions cron-chain 兜底（默认 disabled）
└── docs/superpowers/              # spec / plan / handoff（开发过程档案）
```

## 致谢

社区参考来源：

- `munger` / `musk` / `jobs` ← [alchaincyf/munger-skill](https://github.com/alchaincyf/munger-skill) + [alchaincyf/elon-musk-skill](https://github.com/alchaincyf/elon-musk-skill) + [alchaincyf/steve-jobs-skill](https://github.com/alchaincyf/steve-jobs-skill)
- `buffett` ← [josephway/humanstar](https://github.com/josephway/humanstar)
- `duanyongping` ← [zwbao/duan-yongping-skill](https://github.com/zwbao/duan-yongping-skill)
- `kahneman` ← [0xNyk/council-of-high-intelligence](https://github.com/0xNyk/council-of-high-intelligence) 的 council-kahneman.md
- `cialdini` ← Robert Cialdini 著《Influence》6+1 原理

## License

MIT
