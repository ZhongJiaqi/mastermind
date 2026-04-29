# Mastermind 智囊团

> 顶级思维决策模拟器——把芒格、巴菲特、马斯克、乔布斯、卡尼曼、奥勒留、福尔摩斯等人物的心智模型注入到一场圆桌会议里，针对你的决策问题碰撞讨论，给出每位军师的最终决策卡。

**线上**：[mastermind-gamma-weld.vercel.app](https://mastermind-gamma-weld.vercel.app)

## 设计取向

- **心智模型是本质，人物是包装**——每位军师是若干心智模型的人格化封装。决策时调用的不是"巴菲特怎么说"，是他背后的安全边际、能力圈、复利等思维工具。
- **结构化 vault**——每位军师在 `advisors/<id>/SKILL.md` 用 `M（心智模型）/Q（代表语录）/B（自觉边界）/S（说话风格）` 4 段刻画。`B` 段（自觉边界）让军师在自己思维不适用时主动警觉，避免单一视角的盲区。
- **单次 LLM 调用同时演多人**——相比 N 次独立调用，更贴近圆桌讨论的对话动态：互相 @、当面反驳、连续追加。一次响应给齐讨论 + 每人最终决策卡。

## 12 位军师

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

### 哲学 / 修养

| ID | 名字 | 标签 |
|---|---|---|
| `aurelius` | 马可·奥勒留 | 控制圈 / 朝死而生 / 逆境即素材 |

### 文学 / 虚构

| ID | 名字 | 标签 |
|---|---|---|
| `zhenhuan` | 甄嬛 | 隐忍 / 借力打力 / 以退为进 |
| `holmes` | 夏洛克·福尔摩斯 | 演绎推理 / 排除法 / 观察细节 |

4 位 fork 自社区 nuwa skills（munger / musk / buffett / duanyongping）；3 位 Claude-draft + 用户 review（trump / caocao / zhenhuan）；5 位参考社区资料 + Claude-draft（jobs / cialdini / kahneman / holmes / aurelius）。

## 技术栈

- **前端**：Vite + React 19 + TypeScript + Tailwind CSS 4 + Motion (Framer Motion 后继)
- **LLM**：阿里云百炼 DashScope（OpenAI 兼容端点）调 Qwen 3.x（默认 `qwen3.6-max-preview`）
- **后端**：Vercel Edge Functions（runtime: 'edge'，maxDuration 60s），SSE 流式响应
- **测试**：Vitest（57 单元 + 集成测试）
- **E2E**：`scripts/smoke.mjs` curl-based smoke 命令

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
npm run dev          # Vite dev server（含 dev-api plugin 模拟 Vercel edge function）
npm run build        # 生产构建
npm run preview      # 预览构建产物
npm run lint         # tsc --noEmit 类型检查
npm run test         # vitest run（57 tests）
npm run test:watch   # vitest watch
npm run test:cov     # 覆盖率
npm run smoke [host] # E2E smoke 测一场跳槽决策（默认 localhost:3000）
npm run gen:advisors # 手动重新生成 vault（pre-dev/build/test 自动跑）
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

`vercel.json` 已配置 edge runtime + 60s maxDuration。

## 添加新军师

1. 创建 `advisors/<id>/SKILL.md`，结构参考已有军师（如 `advisors/buffett/SKILL.md`）
2. 必填 frontmatter：`id` / `name` / `tagline` / `avatarColor` / `speakStyle` / `sources` / `version`
3. 必填正文 4 段：`## M`（心智模型，每个含方法本体 / 典型决策倾向 / 适用信号）/ `## Q`（代表引用）/ `## B`（自觉边界）/ `## S`（说话风格）
4. 跑 `npm run gen:advisors`——zod 校验 + 写入 `src/generated/advisors.ts`
5. 在 `src/constants.ts` 的 `ADVISOR_COLORS` 里加配色（可选）

## 项目结构

```
mastermind/
├── advisors/                 # 9 位军师 vault（每位一个 SKILL.md）
├── api/                      # Vercel Edge Functions
│   ├── council.ts           # 单次 SSE 调用同时演多位军师
│   ├── intake-clarify.ts    # 主持人追问（MVP 已 bypass）
│   └── _shared/             # SSE / 错误响应 / Zod schemas / prompts
├── src/
│   ├── components/          # ErrorBanner / ...
│   ├── hooks/useMeeting.ts  # 状态机入口
│   ├── lib/
│   │   ├── orchestrator.ts  # 客户端单次调用 + 流式 parse
│   │   ├── councilParser.ts # SSE fullText → discussion + cards
│   │   └── sseClient.ts     # fetch + ReadableStream wrapper
│   ├── state/meetingReducer.ts  # 状态机
│   └── App.tsx
├── vite-plugins/
│   ├── advisors.ts          # 扫描 vault → src/generated/advisors.ts
│   └── dev-api.ts           # dev 时模拟 edge function 路由
├── tests/                   # 12 files / 57 tests
├── scripts/
│   ├── gen-advisors.ts      # 一次性生成 vault
│   └── smoke.mjs            # E2E smoke
└── docs/superpowers/        # spec / plan / handoff（开发过程档案）
```

## 致谢

社区参考来源：

- `munger` / `musk` / `jobs` ← [alchaincyf/munger-skill](https://github.com/alchaincyf/munger-skill) + [alchaincyf/elon-musk-skill](https://github.com/alchaincyf/elon-musk-skill) + [alchaincyf/steve-jobs-skill](https://github.com/alchaincyf/steve-jobs-skill)
- `buffett` ← [josephway/humanstar](https://github.com/josephway/humanstar)
- `duanyongping` ← [zwbao/duan-yongping-skill](https://github.com/zwbao/duan-yongping-skill)
- `kahneman` / `aurelius` ← [0xNyk/council-of-high-intelligence](https://github.com/0xNyk/council-of-high-intelligence) 的 council-kahneman.md / council-aurelius.md
- `holmes` ← [NimritaKoul/sherlock-holmes-agent-skill](https://github.com/NimritaKoul/sherlock-holmes-agent-skill)
- `cialdini` ← Robert Cialdini 著《Influence》6+1 原理（无现成 vault，原创起草）

原项目脚手架：[ZhongJiaqi/mastermind](https://github.com/ZhongJiaqi/mastermind)（Google AI Studio 生成的 Gemini 单次调用版）

## License

MIT
