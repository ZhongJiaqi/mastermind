# Mastermind 智囊团 v1 Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把现有 mastermind 从 "Gemini 单次调用 + 单文件 UI" 迁移到 spec v5.4 定义的 "Qwen N+1 次调用 + vault + 状态机 UI + Vercel SSE"，交付可公开部署的 MVP。

**Architecture:** 前端 Vite+React+TS（全宽状态切换布局）+ build-time Vite 插件读 `advisors/` vault + 3 个 Vercel Functions（intake-clarify / advisor/[id] / analyze）走 DashScope OpenAI 兼容 SSE。军师输出隐藏 `<meta>` 块供 Analyst 校验式归纳。

**Tech Stack:** Vite 6 + React 19 + TypeScript 5.8 + Tailwind 4 + Motion + Lucide + OpenAI SDK（指向 DashScope）+ gray-matter + Vitest + Playwright + Zod + Vercel Functions。

**Spec 权威源**：`docs/superpowers/specs/2026-04-22-mastermind-design.md`（v5.4）。本 plan 不复述 spec 内容，只在需要时引用章节号。

---

## 文件结构

### 要新建的目录和文件

```
advisors/                                # 军师 vault（每位一个子目录）
  _fixtures/                             # 测试用例 vault（供 Vitest 使用）
    valid-minimal/SKILL.md
    invalid-missing-m/SKILL.md
  munger/SKILL.md
  buffett/SKILL.md
  musk/SKILL.md
  duanyongping/SKILL.md
  zhangyiming/SKILL.md
  zhangxiaolong/SKILL.md
  caocao/SKILL.md
  zhenhuan/SKILL.md
  trump/SKILL.md

api/                                     # Vercel Functions
  intake-clarify.ts
  advisor/[id].ts
  analyze.ts
  _shared/
    dashscope.ts                         # OpenAI SDK 客户端工厂
    sse.ts                               # SSE 响应辅助
    errors.ts                            # 统一错误 envelope
    prompts/
      intake.ts
      advisor.ts
      analyze.ts
    schemas.ts                           # Zod 请求/响应 schemas

vite-plugins/
  advisors.ts                            # build-time 读 vault → virtual:advisors

src/
  main.tsx                               # 入口（最小改动）
  App.tsx                                # 瘦身：仅 root + state 驱动 view 切换
  types/
    session.ts                           # DecisionSession + 相关类型
    advisor.ts                           # AdvisorSkill 类型（与 vault 对齐）
  state/
    meetingReducer.ts                    # 状态机 reducer + actions
  lib/
    meta.ts                              # stripMetaBlock / parseMetaBlock
    sseClient.ts                         # fetch + ReadableStream → event stream
    orchestrator.ts                      # 顺序编排 advisor calls + analyze call
    storage.ts                           # localStorage 读写 + 版本
  hooks/
    useMeeting.ts                        # 把 reducer/orchestrator 包成 hook
  views/
    IdleView.tsx
    MeetingView.tsx
  components/
    advisor/AdvisorPicker.tsx
    advisor/AdvisorCard.tsx
    decision/DecisionForm.tsx
    decision/ScenarioShortcuts.tsx
    decision/SubmitButton.tsx
    decision/InlineClarifyCards.tsx
    meeting/CompactInputBar.tsx
    meeting/AdvisorStreamCard.tsx
    meeting/FinalDecisionCard.tsx
    meeting/SectionFinalDecisions.tsx
    common/EmptyStateCard.tsx
    common/NewMeetingButton.tsx
  constants.ts                           # 改为只保留 SCENARIOS
  index.css

tests/
  unit/
    meta.test.ts
    meetingReducer.test.ts
    storage.test.ts
    orchestrator.test.ts
    vite-plugin-advisors.test.ts
  integration/
    api.intake-clarify.test.ts
    api.advisor.test.ts
    api.analyze.test.ts
  e2e/
    mastermind.spec.ts                   # Playwright

virtual-modules.d.ts                     # 声明 virtual:advisors 类型
vitest.config.ts
playwright.config.ts
vercel.json
```

### 要删的东西

- `src/constants.ts` 里的 `CHARACTERS` 数组 + `DecisionResult` 类型
- `src/App.tsx` 里的 Gemini 调用 + `<discussion>/<conclusions>` 解析
- `package.json` 里的 `@google/genai`、`express`、`@types/express`
- `vite.config.ts` 里 `process.env.GEMINI_API_KEY` 的 `define`

---

## Sprint 0：架构迁移（预估 0.5 天）

**目标**：移除 Gemini 相关代码/依赖，引入新工具链（openai SDK、gray-matter、zod、vitest），保留现有 UI 骨架能跑起来（`npm run dev` 无报错），为后续 sprint 打底。

### Task 0.1：安装 Vitest 并配置

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`
- Test: （本任务本身不需要测试）

- [ ] **Step 1：安装依赖**

```bash
npm install -D vitest @vitest/coverage-v8 @types/node jsdom
```

- [ ] **Step 2：创建 `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**', 'api/**', 'vite-plugins/**'],
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
```

- [ ] **Step 3：在 `package.json` 的 `scripts` 加测试命令**

修改 `package.json` 的 `scripts` 段：

```json
"scripts": {
  "dev": "vite --port=3000 --host=0.0.0.0",
  "build": "vite build",
  "preview": "vite preview",
  "clean": "rm -rf dist",
  "lint": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:cov": "vitest run --coverage"
}
```

- [ ] **Step 4：验证 Vitest 空跑通过**

```bash
npm run test
```

预期：输出 "No test files found" 但退出码 0（或装 `--passWithNoTests`，见下一步）。

如果报 fail on no tests，在 `vitest.config.ts` 里加 `passWithNoTests: true`：

```ts
test: {
  passWithNoTests: true,
  // ...
}
```

- [ ] **Step 5：commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest test runner"
```

### Task 0.2：移除 Gemini SDK 与无用 express

**Files:**
- Modify: `package.json`
- Modify: `src/App.tsx`（临时移除 Gemini 调用，保留 UI 骨架）
- Modify: `vite.config.ts`

- [ ] **Step 1：卸载 Gemini 和 express**

```bash
npm uninstall @google/genai express @types/express
```

- [ ] **Step 2：从 `src/App.tsx` 删除 Gemini 引用**

把 `src/App.tsx` 顶部：

```ts
import { GoogleGenAI } from '@google/genai';
// ...
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
```

全部删除。`handleConsult` 函数里所有调用 `ai.models.generateContentStream` 的逻辑临时替换为一个占位：

```ts
const handleConsult = async () => {
  if (!question.trim()) { setError('请输入您的问题'); return; }
  if (selectedCharacters.length === 0) { setError('请至少选择一位顶级思维'); return; }
  setError('会议功能正在迁移中（Sprint 0），请稍后');
};
```

> 说明：这一步目的是让 `tsc --noEmit` 通过 + `npm run dev` 不崩。Sprint 3 会完整重写整个 App.tsx，不要在这里做其他改动。

- [ ] **Step 3：从 `vite.config.ts` 删除 GEMINI_API_KEY define**

把 `define` 段整段删除：

```ts
// 删掉以下整块：
define: {
  'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
},
```

`loadEnv` 调用如果只在这里用也一并删掉。最终 `vite.config.ts` 应该是这样：

```ts
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
  },
}));
```

- [ ] **Step 4：verify**

```bash
npm run lint
npm run dev
```

预期：`lint` 无错，`dev` 启动后浏览器打开 http://localhost:3000 能看到 UI（军师选择按钮可点，提交按钮点击显示 "会议功能正在迁移中"）。**手动打开浏览器确认一次**。

- [ ] **Step 5：commit**

```bash
git add package.json package-lock.json src/App.tsx vite.config.ts
git commit -m "refactor: remove Gemini SDK and stub LLM calls for Sprint 0"
```

### Task 0.3：安装新依赖（openai / gray-matter / zod）

**Files:**
- Modify: `package.json`

- [ ] **Step 1：安装**

```bash
npm install openai gray-matter zod
```

- [ ] **Step 2：verify 版本**

```bash
npm ls openai gray-matter zod
```

预期：`openai@^4.x`、`gray-matter@^4.x`、`zod@^3.x`（任一 3 主版本即可）。

- [ ] **Step 3：commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add openai, gray-matter, zod dependencies"
```

### Task 0.4：验证 Sprint 0 收尾

- [ ] **Step 1：跑完整 lint + test**

```bash
npm run lint && npm run test
```

预期：全部通过。

- [ ] **Step 2：确认 `.env.example` 已包含 Qwen 配置**

读 `.env.example`，确认含 `DASHSCOPE_API_KEY` / `DASHSCOPE_BASE_URL` / `MODEL_ADVISOR` / `MODEL_SYNTHESIZER` / `MODEL_HOST`（这份在 handoff commit 里已经就绪，这里只是 sanity check）。

- [ ] **Step 3：手动 smoke 测试 dev server**

```bash
npm run dev
```

浏览器访问 http://localhost:3000，确认 UI 能正常渲染。

- [ ] **Step 4：无需 commit**（前面已经 commit 过所有改动）

---

## Sprint 1：Vault + 构建管线 + 9 位军师 SKILL.md（预估 1.5 天）

**目标**：建立 `advisors/` vault 目录 + Vite 插件读/校验 + 写出全部 9 位军师的 SKILL.md。

**关键约束**：SKILL.md 必须满足 spec §4.1 字段约束（至少 3 个完整 M，每个 M 含"方法本体 + 典型决策倾向 + 适用信号"三部分）。

### Task 1.1：定义 `AdvisorSkill` 类型 + 最小 fixture

**Files:**
- Create: `src/types/advisor.ts`
- Create: `advisors/_fixtures/valid-minimal/SKILL.md`
- Create: `advisors/_fixtures/invalid-missing-m/SKILL.md`
- Test: `tests/unit/vite-plugin-advisors.test.ts`（本任务只建 fixture，下一任务才写 test）

- [ ] **Step 1：创建 `src/types/advisor.ts`**

```ts
export interface AdvisorFrontmatter {
  id: string;
  name: string;
  tagline: string;
  avatarColor: string;
  speakStyle: string;
  sources?: string[];
  version: string;
}

export interface AdvisorMentalModel {
  name: string;
  method: string;
  tendency: string;
  signal: string;
}

export interface AdvisorSkill {
  frontmatter: AdvisorFrontmatter;
  mentalModels: AdvisorMentalModel[];
  quotes: string;
  blindspots: string;
  speakStyle: string;
  raw: string;
}
```

- [ ] **Step 2：创建 `advisors/_fixtures/valid-minimal/SKILL.md`**

```markdown
---
id: valid-minimal
name: 测试军师
tagline: 测试 / 夹具 / 最小有效样本
avatarColor: oklch(90% 0.04 240)
speakStyle: 冷静·简短·只用事实
sources:
  - Vitest fixture
version: 0.1
---

# 测试军师

## M — 核心心智模型

### 模型 A
**方法本体**：用最简陈述描述问题的核心矛盾。

**典型决策倾向**：删掉所有"也许"，只留可以明确判定的选项。

**适用信号**：讨论变模糊、无法落地时

---

### 模型 B
**方法本体**：从结果反推所需输入。

**典型决策倾向**：先定义"成功看起来什么样"。

**适用信号**：目标不清时

---

### 模型 C
**方法本体**：把决策成本与复原成本分别估算。

**典型决策倾向**：低复原成本优先行动。

**适用信号**：面对多个可逆小选项时

## Q — 代表引用

> "先定义清楚，再讨论结论。"
> — fixture

## B — 自觉边界

- 模型 A 在涉及情绪的问题上可能过度冷漠
- 模型 B 在目标本身就是涌现物时会空转
- 模型 C 在"单次不可逆"场景里失效

## S — 说话风格

- 短句
- 每句结尾是结论不是疑问
```

- [ ] **Step 3：创建 `advisors/_fixtures/invalid-missing-m/SKILL.md`**

```markdown
---
id: invalid-missing-m
name: 坏样本
tagline: 缺少 M 段
avatarColor: oklch(70% 0.05 0)
speakStyle: N/A
version: 0.1
---

# 坏样本

## Q — 代表引用

> "我们漏写了 M 段。"
```

- [ ] **Step 4：commit**

```bash
git add src/types/advisor.ts advisors/_fixtures/
git commit -m "feat(vault): add AdvisorSkill type and fixture SKILL.md files"
```

### Task 1.2：写 Vite 插件 `vite-plugin-advisors`（TDD）

**Files:**
- Create: `vite-plugins/advisors.ts`
- Create: `virtual-modules.d.ts`
- Test: `tests/unit/vite-plugin-advisors.test.ts`
- Modify: `vite.config.ts`
- Modify: `tsconfig.json`（若必要，include `vite-plugins/`）

- [ ] **Step 1：写失败的 test**

创建 `tests/unit/vite-plugin-advisors.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import path from 'path';
import { loadAdvisors, validateAdvisors } from '../../vite-plugins/advisors';

const FIXTURE_ROOT = path.resolve(__dirname, '../../advisors/_fixtures');

describe('loadAdvisors', () => {
  it('parses SKILL.md into AdvisorSkill objects', async () => {
    const advisors = await loadAdvisors(FIXTURE_ROOT);
    const minimal = advisors.find((a) => a.frontmatter.id === 'valid-minimal');
    expect(minimal).toBeDefined();
    expect(minimal!.frontmatter.name).toBe('测试军师');
    expect(minimal!.mentalModels).toHaveLength(3);
    expect(minimal!.mentalModels[0].name).toBe('模型 A');
    expect(minimal!.mentalModels[0].method).toContain('最简陈述');
  });
});

describe('validateAdvisors', () => {
  it('passes when advisor has >= 3 mental models', async () => {
    const advisors = await loadAdvisors(FIXTURE_ROOT);
    const minimal = advisors.filter((a) => a.frontmatter.id === 'valid-minimal');
    expect(() => validateAdvisors(minimal)).not.toThrow();
  });

  it('throws when advisor has < 3 mental models', async () => {
    const advisors = await loadAdvisors(FIXTURE_ROOT);
    const bad = advisors.filter((a) => a.frontmatter.id === 'invalid-missing-m');
    expect(() => validateAdvisors(bad)).toThrow(/at least 3 mental models/i);
  });

  it('throws when frontmatter is missing required fields', () => {
    const bad = [{
      frontmatter: { id: 'x', name: '', tagline: '', avatarColor: '', speakStyle: '', version: '0.1' },
      mentalModels: [{ name: 'a', method: 'x', tendency: 'x', signal: 'x' },
                     { name: 'b', method: 'x', tendency: 'x', signal: 'x' },
                     { name: 'c', method: 'x', tendency: 'x', signal: 'x' }],
      quotes: '',
      blindspots: '',
      speakStyle: '',
      raw: '',
    }] as any;
    expect(() => validateAdvisors(bad)).toThrow(/name/);
  });
});
```

- [ ] **Step 2：跑 test 确认失败**

```bash
npm run test tests/unit/vite-plugin-advisors.test.ts
```

预期：fail，`Cannot find module '../../vite-plugins/advisors'`。

- [ ] **Step 3：实现 `vite-plugins/advisors.ts`**

```ts
import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { z } from 'zod';
import type { Plugin } from 'vite';
import type {
  AdvisorFrontmatter,
  AdvisorMentalModel,
  AdvisorSkill,
} from '../src/types/advisor';

const VIRTUAL_ID = 'virtual:advisors';
const RESOLVED_VIRTUAL_ID = '\0' + VIRTUAL_ID;

const frontmatterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  tagline: z.string().min(1).max(32),
  avatarColor: z.string().regex(/^oklch\(/),
  speakStyle: z.string().min(1).max(60),
  sources: z.array(z.string()).optional(),
  version: z.string().min(1),
});

function parseMentalModels(body: string): AdvisorMentalModel[] {
  const mSectionMatch = body.match(/##\s*M\s*[—-][^\n]*\n([\s\S]*?)(?=\n##\s|$)/);
  if (!mSectionMatch) return [];
  const section = mSectionMatch[1];
  const modelChunks = section.split(/\n###\s+/).slice(1);
  return modelChunks.map((chunk) => {
    const [nameLine, ...rest] = chunk.split('\n');
    const name = nameLine.trim();
    const body = rest.join('\n');
    const method = extractLabeled(body, '方法本体');
    const tendency = extractLabeled(body, '典型决策倾向');
    const signal = extractLabeled(body, '适用信号');
    return { name, method, tendency, signal };
  });
}

function extractLabeled(text: string, label: string): string {
  const re = new RegExp(`\\*\\*${label}\\*\\*\\s*[:：]\\s*([\\s\\S]*?)(?=\\n\\n\\*\\*|\\n---|$)`);
  const m = text.match(re);
  return m ? m[1].trim() : '';
}

function parseSection(body: string, header: string): string {
  const re = new RegExp(`##\\s*${header}\\s*[—-][^\\n]*\\n([\\s\\S]*?)(?=\\n##\\s|$)`);
  const m = body.match(re);
  return m ? m[1].trim() : '';
}

export async function loadAdvisors(root: string): Promise<AdvisorSkill[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const advisors: AdvisorSkill[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('_') && root.indexOf('_fixtures') === -1) continue;
    const skillPath = path.join(root, entry.name, 'SKILL.md');
    try {
      const raw = await fs.readFile(skillPath, 'utf8');
      const parsed = matter(raw);
      advisors.push({
        frontmatter: parsed.data as AdvisorFrontmatter,
        mentalModels: parseMentalModels(parsed.content),
        quotes: parseSection(parsed.content, 'Q'),
        blindspots: parseSection(parsed.content, 'B'),
        speakStyle: parseSection(parsed.content, 'S'),
        raw: parsed.content,
      });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw err;
    }
  }
  advisors.sort((a, b) => a.frontmatter.id.localeCompare(b.frontmatter.id));
  return advisors;
}

export function validateAdvisors(advisors: AdvisorSkill[]): void {
  for (const a of advisors) {
    try {
      frontmatterSchema.parse(a.frontmatter);
    } catch (err) {
      throw new Error(`advisor ${a.frontmatter?.id ?? '(unknown)'}: invalid frontmatter ${(err as Error).message}`);
    }
    if (a.mentalModels.length < 3) {
      throw new Error(`advisor ${a.frontmatter.id}: requires at least 3 mental models, got ${a.mentalModels.length}`);
    }
    for (const m of a.mentalModels) {
      if (!m.method || !m.tendency || !m.signal) {
        throw new Error(`advisor ${a.frontmatter.id}: mental model "${m.name}" missing one of 方法本体/典型决策倾向/适用信号`);
      }
    }
  }
}

export function advisorsPlugin(options?: { root?: string }): Plugin {
  const root = options?.root ?? path.resolve(process.cwd(), 'advisors');
  let cached: AdvisorSkill[] | null = null;
  return {
    name: 'advisors',
    async resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_VIRTUAL_ID;
    },
    async load(id) {
      if (id !== RESOLVED_VIRTUAL_ID) return;
      if (!cached) {
        cached = await loadAdvisors(root);
        validateAdvisors(cached.filter((a) => !a.frontmatter.id.startsWith('_')));
      }
      return `export const ADVISORS = ${JSON.stringify(cached)};`;
    },
    async handleHotUpdate(ctx) {
      if (ctx.file.includes(path.sep + 'advisors' + path.sep)) {
        cached = null;
        const mod = ctx.server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_ID);
        if (mod) ctx.server.moduleGraph.invalidateModule(mod);
        ctx.server.ws.send({ type: 'full-reload' });
      }
    },
  };
}
```

- [ ] **Step 4：创建 `virtual-modules.d.ts`**

```ts
declare module 'virtual:advisors' {
  import type { AdvisorSkill } from './src/types/advisor';
  export const ADVISORS: AdvisorSkill[];
}
```

在 `tsconfig.json` 的 `include` 确保 `virtual-modules.d.ts` 被包含（如 `"include": ["src", "virtual-modules.d.ts"]`），如果没有 include 字段就新增。

- [ ] **Step 5：跑 test 确认通过**

```bash
npm run test tests/unit/vite-plugin-advisors.test.ts
```

预期：3 个 test 全部通过。

- [ ] **Step 6：把插件挂到 `vite.config.ts`**

```ts
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { advisorsPlugin } from './vite-plugins/advisors';

export default defineConfig(() => ({
  plugins: [react(), tailwindcss(), advisorsPlugin()],
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
  },
}));
```

- [ ] **Step 7：commit**

```bash
git add vite-plugins/ virtual-modules.d.ts vite.config.ts tsconfig.json tests/unit/vite-plugin-advisors.test.ts
git commit -m "feat(vault): add vite-plugin-advisors with schema validation (TDD)"
```

### Task 1.3：把 `src/constants.ts` 的 `CHARACTERS` 迁到 vault（临时占位）

说明：此 sprint 后续会填充 9 位真实军师，但为了让代码能先跑起来，先让 `constants.ts` 不再导出 `CHARACTERS`，代码里所有用 `CHARACTERS` 的地方改为从 `virtual:advisors` 导入。

**Files:**
- Modify: `src/constants.ts`（删除 `CHARACTERS` 和 `DecisionResult`，保留 `SCENARIOS`）
- Modify: `src/App.tsx`（把 `CHARACTERS` import 改为 `ADVISORS`）

- [ ] **Step 1：改 `src/constants.ts`**

```ts
export const SCENARIOS = [
  {
    label: '职业决策',
    prompt: '我目前在一家大厂工作，薪水不错但经常加班，感觉没有成长空间。现在有一家创业公司邀请我加入，薪水降了30%，但给期权，且方向我很看好。我该不该换工作？',
  },
  {
    label: '情感决策',
    prompt: '我和伴侣相处了三年，感情稳定但缺乏激情，最近遇到一个让我很心动的人，我该如何抉择？',
  },
  {
    label: '投资决策',
    prompt: '最近某AI概念股大跌了40%，我之前一直很看好这家公司的技术，现在是抄底的好时机吗？',
  },
  {
    label: '日常轻决策',
    prompt: '今晚有一个重要的行业交流晚宴，我应该穿正装出席显得专业，还是穿休闲装显得平易近人？',
  },
];
```

- [ ] **Step 2：改 `src/App.tsx`**

把 `import { CHARACTERS, SCENARIOS, DecisionResult } from './constants';` 改为：

```ts
import { SCENARIOS } from './constants';
import { ADVISORS } from 'virtual:advisors';
```

把所有用 `CHARACTERS` 的地方改为 `ADVISORS`。注意军师卡片里渲染 `name` 和 `description` 的部分，现在字段是 `frontmatter.name` 和 `frontmatter.tagline`：

```tsx
{ADVISORS.map((advisor) => {
  const isSelected = selectedCharacters.includes(advisor.frontmatter.id);
  return (
    <button
      key={advisor.frontmatter.id}
      onClick={() => toggleCharacter(advisor.frontmatter.id)}
      className={/* …保持原有样式… */}
    >
      <div className="font-medium text-sm mb-1">{advisor.frontmatter.name}</div>
      <div className={/* …*/}>
        {advisor.frontmatter.tagline}
      </div>
    </button>
  );
})}
```

同样修改 `handleRandomSelect` 里 `CHARACTERS.map(c => c.id)` → `ADVISORS.map(a => a.frontmatter.id)`。

`DecisionResult` 类型暂时已不用（Sprint 3 会用 `DecisionSession`）——暂时保留在 `src/App.tsx` 本地一个空实现即可，或者干脆从 UI 渲染部分删除 results 渲染块（会议功能已被 stub 掉，results 永远是空）。

> 简化做法：把 `results` 状态和渲染块整块删除，`discussion` 同理。保留 UI 骨架（输入框+军师选择器+占位卡）即可。Sprint 3 会重写。

- [ ] **Step 3：verify lint & dev**

```bash
npm run lint
npm run dev
```

预期：lint 通过。因为 `advisors/` 目录还没有真实军师，`npm run dev` 时 Vite 插件会返回空数组 → UI 显示一个空的军师 grid。这是预期。

- [ ] **Step 4：commit**

```bash
git add src/constants.ts src/App.tsx
git commit -m "refactor: consume ADVISORS from virtual:advisors module"
```

### Task 1.4-1.8：Fork 转换 5 位军师

以下 5 个 task 形式一致，每位军师独立一个 commit。转换动作在 spec §8 已定义（提取 M/Q/B/S、加 frontmatter、验证 M 段 ≥ 3）。

#### Task 1.4：段永平 `advisors/duanyongping/SKILL.md`

**Files:**
- Create: `advisors/duanyongping/SKILL.md`

- [ ] **Step 1：参考源仓库**

打开浏览器访问 `https://github.com/zwbao/duan-yongping-skill`，阅读 SKILL.md 和 quotes 文件，提取：
- 核心心智模型：本分、做对的事情把事情做对、Stop Doing List、敢为天下后、慢就是快、（其它…）
- 代表语录（带出处）
- 自觉边界
- 说话风格

- [ ] **Step 2：写 `advisors/duanyongping/SKILL.md`**

按 spec §4.1 的 frontmatter + M/Q/B/S 结构。**每个 M 必须含方法本体/典型决策倾向/适用信号三部分**。**至少 3 个 M**，建议 5-8 个。

以下是文件骨架，细节内容按步骤 1 的源材料填充（这里只给格式，内容由执行者填）：

```markdown
---
id: duanyongping
name: 段永平
tagline: 本分 / 做对的事情 / 把事情做对
avatarColor: oklch(88% 0.09 65)
speakStyle: 平实·反问·常用类比
sources:
  - 段永平雪球问答（2212 条）
  - https://github.com/zwbao/duan-yongping-skill
version: 0.1
---

# 段永平

## M — 核心心智模型

### 本分
**方法本体**：…（从源材料提炼，严格按"方法本体"不掺"应不应该"）

**典型决策倾向**：…

**适用信号**：…

---

### 做对的事情 + 把事情做对
**方法本体**：…

**典型决策倾向**：…

**适用信号**：…

---

### Stop Doing List
**方法本体**：…

**典型决策倾向**：…

**适用信号**：…

（继续补到 5-8 个）

## Q — 代表引用

> "…"
> — 段永平，雪球 2015-xx-xx

（至少 5 条带出处）

## B — 自觉边界

- …
- …

## S — 说话风格

- …
- 口头禅：…
```

- [ ] **Step 3：verify build 校验通过**

```bash
npm run build
```

预期：build 成功（advisorsPlugin 的 validate 不抛错）。如果抛 "requires at least 3 mental models" → 补齐。

- [ ] **Step 4：commit**

```bash
git add advisors/duanyongping/
git commit -m "feat(advisors): add duanyongping SKILL.md (forked from zwbao/duan-yongping-skill)"
```

#### Task 1.5：芒格 `advisors/munger/SKILL.md`

同 Task 1.4 格式，源仓库 `alchaincyf/munger-skill`。spec §4.1 已给出芒格的示例（多元思维模型/逆向思考/误判心理学），可直接作为 M 段起点，另外补 5 个左右。

**Files:**
- Create: `advisors/munger/SKILL.md`

- [ ] **Step 1：参考 `https://github.com/alchaincyf/munger-skill` 源 SKILL.md**

- [ ] **Step 2：写 `advisors/munger/SKILL.md`**

前三个 M 可直接从 spec §4.1 样例抄用；再补 5-6 个（能力圈、margin of safety、lollapalooza effect、检查清单思维、合理期望 等）。

- [ ] **Step 3：verify & commit**

```bash
npm run build
git add advisors/munger/
git commit -m "feat(advisors): add munger SKILL.md (forked from alchaincyf/munger-skill)"
```

#### Task 1.6：马斯克 `advisors/musk/SKILL.md`

源仓库 `alchaincyf/elon-musk-skill`。核心 M：第一性原理、物理学思维、做最难的事、指数目标、极限压缩时间。

**Files:**
- Create: `advisors/musk/SKILL.md`

- [ ] **Step 1：参考源 SKILL**

- [ ] **Step 2：写 SKILL.md**（5-8 个完整 M）

- [ ] **Step 3：verify & commit**

```bash
npm run build
git add advisors/musk/
git commit -m "feat(advisors): add musk SKILL.md (forked from alchaincyf/elon-musk-skill)"
```

#### Task 1.7：巴菲特 `advisors/buffett/SKILL.md`

源仓库 `josephway/humanstar/humanstar/skills/buffett-perspective`。源仓库已经有结构化的 6 心智模型 + 启发式 + CP 检查点，可高质量转换。

**Files:**
- Create: `advisors/buffett/SKILL.md`

- [ ] **Step 1：阅读源 repo 的 SKILL 文件**

- [ ] **Step 2：映射源结构 → 我们的 M/Q/B/S**
  - 源的"心智模型"直接搬 + 按三部分重组
  - 源的"启发式"归并进 M 的"典型决策倾向"
  - 源的"CP 检查点"进 B 段

- [ ] **Step 3：verify & commit**

```bash
npm run build
git add advisors/buffett/
git commit -m "feat(advisors): add buffett SKILL.md (forked from humanstar/buffett-perspective)"
```

#### Task 1.8：张一鸣 `advisors/zhangyiming/SKILL.md`

源仓库 `josephway/humanstar/humanstar/skills/zhangyiming-skill`。核心 M：Context not Control、算法思维、大力出奇迹、延迟满足、信息分发优先内容。

**Files:**
- Create: `advisors/zhangyiming/SKILL.md`

- [ ] **Step 1：读源 repo**

- [ ] **Step 2：写 SKILL.md**

- [ ] **Step 3：verify & commit**

```bash
npm run build
git add advisors/zhangyiming/
git commit -m "feat(advisors): add zhangyiming SKILL.md (forked from humanstar/zhangyiming-skill)"
```

### Task 1.9-1.12：Claude 起草 4 位军师

这 4 位没有现成社区 skill，要基于一手材料蒸馏。每位起草后让用户 review（通过 git diff + 直接对话）。迭代到用户认可再 commit。

**注意**：如果用 subagent 执行，起草 SKILL.md 的 subagent 需要指示："严格按 spec §4.1 结构 + spec §8 的蒸馏心法；M 段 ≥ 5 个；每个 M 必须含三部分；质量门槛是'给陌生人读也能照着思考一遍'"。

#### Task 1.9：张小龙 `advisors/zhangxiaolong/SKILL.md`

**Files:**
- Create: `advisors/zhangxiaolong/SKILL.md`

**主要来源**：
- 微信公开课 PRO 历年讲稿（2016-2023）
- 《微信背后的产品观》（演讲整理）
- 微信内部邮件、张小龙饭否片段

**核心心智模型候选**（待提炼确认）：
- 同理心（Empathy as Method）
- 用完即走（Don't overstay）
- 极简主义
- 直击本质（Problem ≠ Symptom）
- 让不让用户做某事的"不让" 优先
- 反 KPI 导向

- [ ] **Step 1：起草初稿**（在 SKILL.md 里）

- [ ] **Step 2：让用户 review**

用户会说 "OK"、"某个 M 不准"、"某句话不像他说的" 等。迭代。

- [ ] **Step 3：终稿 verify & commit**

```bash
npm run build
git add advisors/zhangxiaolong/
git commit -m "feat(advisors): add zhangxiaolong SKILL.md (Claude-drafted from weixin public class)"
```

#### Task 1.10：特朗普 `advisors/trump/SKILL.md`

**Files:**
- Create: `advisors/trump/SKILL.md`

**主要来源**：《The Art of the Deal》（1987）。**只蒸馏决策模式，不涉政治立场**。

**核心心智模型候选**：
- Think Big
- Always Expect the Worst & Protect the Downside
- Use Your Leverage
- Maximize Your Options
- Know Your Market
- Enhance Your Location (branding the undervalued)
- Get the Word Out (媒体即杠杆)
- Fight Back（永远回击）
- Deliver the Goods

- [ ] **Step 1**-**Step 3**：同上

```bash
npm run build
git add advisors/trump/
git commit -m "feat(advisors): add trump SKILL.md (Claude-drafted from The Art of the Deal)"
```

#### Task 1.11：曹操 `advisors/caocao/SKILL.md`

**Files:**
- Create: `advisors/caocao/SKILL.md`

**主要来源**：
- 《三国志·魏书·武帝纪》
- 曹操注《孙子兵法》（《孙子略解》）
- 《短歌行》《蒿里行》《让县自明本志令》
- 《求贤令》

**核心心智模型候选**：
- 唯才是举（不拘德行）
- 兵贵神速 / 以奇用兵
- 因敌制胜（不设定式）
- 以势压人（不是逐次拼消耗）
- 挟天子（利用合法性杠杆）
- 屯田养兵（基础设施先行）
- 多疑而不猜忌有功（辩证）

- [ ] **Step 1**-**Step 3**：同上。特别注意：曹操是古人，说话风格要按其作品真实语感写（不要写成现代商业术语）。

```bash
npm run build
git add advisors/caocao/
git commit -m "feat(advisors): add caocao SKILL.md (Claude-drafted from Records of Three Kingdoms)"
```

#### Task 1.12：甄嬛 `advisors/zhenhuan/SKILL.md`

**Files:**
- Create: `advisors/zhenhuan/SKILL.md`

**主要来源**：《后宫·甄嬛传》原著 + 电视剧剧本行为模式归纳

**核心心智模型候选**：
- 察言观色（读懂潜台词）
- 借力打力
- 韬光养晦（进退节奏）
- 以退为进
- 敌人的敌人
- 情感与利害分离（该动真情时动真情，该理智时理智）
- 体系内生存（不直接对抗规则）

**难度最高**：虚构人物需要从行为模式归纳心智模型。用户可能多次 review。

- [ ] **Step 1**-**Step 3**：同上

```bash
npm run build
git add advisors/zhenhuan/
git commit -m "feat(advisors): add zhenhuan SKILL.md (Claude-drafted from novel/script patterns)"
```

### Task 1.13：Sprint 1 收尾验证

- [ ] **Step 1：确认 9 位军师全部在 vault**

```bash
ls advisors/
```

预期：`_fixtures/ munger/ buffett/ musk/ duanyongping/ zhangyiming/ zhangxiaolong/ caocao/ zhenhuan/ trump/`

- [ ] **Step 2：build 校验通过**

```bash
npm run build
```

- [ ] **Step 3：lint + test 全通**

```bash
npm run lint && npm run test
```

- [ ] **Step 4：手动 smoke 测试 dev**

```bash
npm run dev
```

浏览器：UI 军师 grid 应该显示 9 个军师卡片（2x5 或 2x4+1）。

- [ ] **Step 5：无需额外 commit**

---

## Sprint 2：3 个 API 端点（预估 1 天）

**目标**：建 3 个 Vercel Functions，含 SSE、DashScope 客户端、Zod 校验、prompt 拼接。每个 API 单元测试 +（mock LLM 的）集成测试。

### Task 2.1：`api/_shared/dashscope.ts`（TDD）

**Files:**
- Create: `api/_shared/dashscope.ts`
- Test: `tests/unit/dashscope.test.ts`

- [ ] **Step 1：写失败 test**

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createDashScope, getDashScopeModels } from '../../api/_shared/dashscope';

describe('createDashScope', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns an OpenAI client pointed at DashScope base URL', () => {
    vi.stubEnv('DASHSCOPE_API_KEY', 'sk-test');
    vi.stubEnv('DASHSCOPE_BASE_URL', 'https://dashscope.aliyuncs.com/compatible-mode/v1');
    const client = createDashScope();
    expect(client).toBeDefined();
    expect((client as any).baseURL).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1');
  });

  it('throws when DASHSCOPE_API_KEY is not set', () => {
    vi.stubEnv('DASHSCOPE_API_KEY', '');
    expect(() => createDashScope()).toThrow(/DASHSCOPE_API_KEY/);
  });
});

describe('getDashScopeModels', () => {
  it('returns env-configured model ids with defaults', () => {
    vi.stubEnv('MODEL_ADVISOR', 'qwen3-plus');
    vi.stubEnv('MODEL_SYNTHESIZER', 'qwen3-max');
    vi.stubEnv('MODEL_HOST', 'qwen3-plus');
    const models = getDashScopeModels();
    expect(models.advisor).toBe('qwen3-plus');
    expect(models.analyzer).toBe('qwen3-max');
    expect(models.host).toBe('qwen3-plus');
  });

  it('falls back to defaults when env not set', () => {
    vi.unstubAllEnvs();
    const models = getDashScopeModels();
    expect(models.advisor).toBe('qwen3-plus');
    expect(models.analyzer).toBe('qwen3-max');
    expect(models.host).toBe('qwen3-plus');
  });
});
```

- [ ] **Step 2：跑 test 确认失败**

```bash
npm run test tests/unit/dashscope.test.ts
```

- [ ] **Step 3：实现 `api/_shared/dashscope.ts`**

```ts
import OpenAI from 'openai';

export function createDashScope(): OpenAI {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  const baseURL = process.env.DASHSCOPE_BASE_URL ?? 'https://dashscope.aliyuncs.com/compatible-mode/v1';
  if (!apiKey) {
    throw new Error('DASHSCOPE_API_KEY is not configured');
  }
  return new OpenAI({ apiKey, baseURL });
}

export interface DashScopeModels {
  advisor: string;
  analyzer: string;
  host: string;
}

export function getDashScopeModels(): DashScopeModels {
  return {
    advisor: process.env.MODEL_ADVISOR || 'qwen3-plus',
    analyzer: process.env.MODEL_SYNTHESIZER || 'qwen3-max',
    host: process.env.MODEL_HOST || 'qwen3-plus',
  };
}
```

- [ ] **Step 4：test 通过**

```bash
npm run test tests/unit/dashscope.test.ts
```

- [ ] **Step 5：commit**

```bash
git add api/_shared/dashscope.ts tests/unit/dashscope.test.ts
git commit -m "feat(api): add DashScope client factory (TDD)"
```

### Task 2.2：`api/_shared/errors.ts`

**Files:**
- Create: `api/_shared/errors.ts`

- [ ] **Step 1：实现**

```ts
export interface ApiErrorBody {
  error: { code: string; message: string };
}

export function errorResponse(code: string, message: string, status = 500): Response {
  const body: ApiErrorBody = { error: { code, message } };
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function normalizeError(err: unknown): { code: string; message: string } {
  if (err instanceof Error) return { code: 'INTERNAL', message: err.message };
  return { code: 'INTERNAL', message: 'Unknown error' };
}
```

- [ ] **Step 2：commit**

```bash
git add api/_shared/errors.ts
git commit -m "feat(api): add unified error response helpers"
```

### Task 2.3：`api/_shared/sse.ts`（TDD）

**Files:**
- Create: `api/_shared/sse.ts`
- Test: `tests/unit/sse.test.ts`

- [ ] **Step 1：写失败 test**

```ts
import { describe, expect, it } from 'vitest';
import { formatSseEvent, createSseStream } from '../../api/_shared/sse';

describe('formatSseEvent', () => {
  it('formats a named event with JSON data', () => {
    expect(formatSseEvent('chunk', { text: 'hi' })).toBe('event: chunk\ndata: {"text":"hi"}\n\n');
  });
  it('defaults event name to "message"', () => {
    expect(formatSseEvent(null, { ok: true })).toBe('event: message\ndata: {"ok":true}\n\n');
  });
  it('escapes data that contains newlines', () => {
    const out = formatSseEvent('chunk', { text: 'a\nb' });
    expect(out).toContain('data: {"text":"a\\nb"}');
  });
});

describe('createSseStream', () => {
  it('returns a Response with SSE headers and a ReadableStream body', async () => {
    const { response, write, close } = createSseStream();
    expect(response.headers.get('Content-Type')).toBe('text/event-stream; charset=utf-8');
    expect(response.headers.get('Cache-Control')).toBe('no-cache, no-transform');
    write('chunk', { text: 'hello' });
    close();
    const text = await response.text();
    expect(text).toContain('event: chunk');
    expect(text).toContain('data: {"text":"hello"}');
  });
});
```

- [ ] **Step 2：fail 验证 + 实现**

```ts
export function formatSseEvent(event: string | null, data: unknown): string {
  const name = event ?? 'message';
  const payload = JSON.stringify(data);
  return `event: ${name}\ndata: ${payload}\n\n`;
}

export interface SseStreamHandle {
  response: Response;
  write: (event: string, data: unknown) => void;
  close: () => void;
}

export function createSseStream(): SseStreamHandle {
  const encoder = new TextEncoder();
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;
    },
  });
  return {
    response: new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    }),
    write(event, data) {
      if (!controllerRef) throw new Error('stream not started');
      controllerRef.enqueue(encoder.encode(formatSseEvent(event, data)));
    },
    close() {
      controllerRef?.close();
    },
  };
}
```

- [ ] **Step 3：test pass**

```bash
npm run test tests/unit/sse.test.ts
```

- [ ] **Step 4：commit**

```bash
git add api/_shared/sse.ts tests/unit/sse.test.ts
git commit -m "feat(api): add SSE stream helpers (TDD)"
```

### Task 2.4：`api/_shared/schemas.ts`（Zod 请求 schemas）

**Files:**
- Create: `api/_shared/schemas.ts`

- [ ] **Step 1：实现**

```ts
import { z } from 'zod';

export const sessionInputSchema = z.object({
  question: z.string().min(1),
  context: z.string().optional(),
  options: z.string().optional(),
  leaning: z.string().optional(),
  clarifications: z.array(z.object({
    question: z.string(),
    answer: z.string(),
  })).optional(),
});

export const intakeClarifyRequestSchema = sessionInputSchema.extend({
  selectedAdvisorIds: z.array(z.string()).min(1),
});

export const priorRoundSchema = z.object({
  advisorId: z.string(),
  advisorName: z.string(),
  content: z.string(),
});

export const advisorRequestSchema = z.object({
  session: sessionInputSchema,
  priorRounds: z.array(priorRoundSchema),
});

export const analyzeRequestSchema = z.object({
  session: sessionInputSchema,
  rounds: z.array(z.object({
    advisorId: z.string(),
    advisorName: z.string(),
    content: z.string(),
    meta: z.object({
      usedModels: z.array(z.string()),
      modelBriefs: z.record(z.string(), z.string()),
    }),
  })).min(1),
});

export type IntakeClarifyRequest = z.infer<typeof intakeClarifyRequestSchema>;
export type AdvisorRequest = z.infer<typeof advisorRequestSchema>;
export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;
```

- [ ] **Step 2：commit**

```bash
git add api/_shared/schemas.ts
git commit -m "feat(api): add Zod schemas for 3 endpoints"
```

### Task 2.5：`api/_shared/prompts/intake.ts`

**Files:**
- Create: `api/_shared/prompts/intake.ts`
- Test: `tests/unit/prompt.intake.test.ts`

- [ ] **Step 1：写 test（spec §6.1 的字段都要出现在拼接结果里）**

```ts
import { describe, expect, it } from 'vitest';
import { buildIntakePrompt } from '../../api/_shared/prompts/intake';

describe('buildIntakePrompt', () => {
  it('includes all required fields', () => {
    const prompt = buildIntakePrompt({
      question: '我该不该跳槽',
      context: '大厂五年',
      options: '去创业公司 / 留守',
      leaning: '倾向跳',
      selectedAdvisorNames: ['芒格', '巴菲特'],
    });
    expect(prompt).toContain('你是一位经验丰富的主持人');
    expect(prompt).toContain('我该不该跳槽');
    expect(prompt).toContain('大厂五年');
    expect(prompt).toContain('倾向跳');
    expect(prompt).toContain('芒格、巴菲特');
    expect(prompt).toContain('needsClarification');
  });

  it('handles missing optional fields gracefully', () => {
    const prompt = buildIntakePrompt({
      question: '今晚吃什么',
      selectedAdvisorNames: ['芒格'],
    });
    expect(prompt).toContain('今晚吃什么');
    expect(prompt).toContain('（未填）');
  });
});
```

- [ ] **Step 2：实现 `api/_shared/prompts/intake.ts`**

根据 spec §6.1 的模板拼字符串。把字段带默认值"（未填）"：

```ts
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
```

- [ ] **Step 3：test 通过 + commit**

```bash
npm run test tests/unit/prompt.intake.test.ts
git add api/_shared/prompts/intake.ts tests/unit/prompt.intake.test.ts
git commit -m "feat(api): add intake-clarify prompt builder (TDD)"
```

### Task 2.6：`api/intake-clarify.ts`

**Files:**
- Create: `api/intake-clarify.ts`
- Test: `tests/integration/api.intake-clarify.test.ts`

- [ ] **Step 1：写集成 test（mock OpenAI）**

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../api/_shared/dashscope', () => ({
  createDashScope: vi.fn(),
  getDashScopeModels: () => ({ advisor: 'qwen3-plus', analyzer: 'qwen3-max', host: 'qwen3-plus' }),
}));

const { createDashScope } = await import('../../api/_shared/dashscope');
const handler = (await import('../../api/intake-clarify')).default;

describe('POST /api/intake-clarify', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns needsClarification=false when LLM says so', async () => {
    (createDashScope as any).mockReturnValue({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: '{"needsClarification": false}' } }],
          }),
        },
      },
    });
    const req = new Request('http://test/api/intake-clarify', {
      method: 'POST',
      body: JSON.stringify({ question: '今晚吃什么', selectedAdvisorIds: ['munger'] }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await handler(req);
    const body = await res.json();
    expect(body.needsClarification).toBe(false);
  });

  it('returns 400 when question is missing', async () => {
    const req = new Request('http://test/api/intake-clarify', {
      method: 'POST',
      body: JSON.stringify({ selectedAdvisorIds: ['munger'] }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await handler(req);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2：实现 handler**

```ts
import { ADVISORS } from 'virtual:advisors';
import { createDashScope, getDashScopeModels } from './_shared/dashscope';
import { errorResponse, normalizeError } from './_shared/errors';
import { intakeClarifyRequestSchema } from './_shared/schemas';
import { buildIntakePrompt } from './_shared/prompts/intake';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return errorResponse('METHOD_NOT_ALLOWED', 'POST only', 405);
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse('BAD_JSON', 'Invalid JSON', 400);
  }
  const parsed = intakeClarifyRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse('VALIDATION', parsed.error.message, 400);
  }

  try {
    const advisorNames = parsed.data.selectedAdvisorIds
      .map((id) => ADVISORS.find((a) => a.frontmatter.id === id)?.frontmatter.name)
      .filter(Boolean) as string[];
    const prompt = buildIntakePrompt({
      question: parsed.data.question,
      context: parsed.data.context,
      options: parsed.data.options,
      leaning: parsed.data.leaning,
      selectedAdvisorNames: advisorNames,
    });

    const models = getDashScopeModels();
    const client = createDashScope();
    const completion = await client.chat.completions.create({
      model: models.host,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });
    const content = completion.choices[0]?.message?.content ?? '';
    let parsedResult: unknown;
    try {
      parsedResult = JSON.parse(content);
    } catch {
      return errorResponse('LLM_BAD_JSON', 'Intake model returned invalid JSON', 502);
    }
    return new Response(JSON.stringify(parsedResult), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const e = normalizeError(err);
    return errorResponse(e.code, e.message, 500);
  }
}
```

- [ ] **Step 3：test pass + commit**

```bash
npm run test tests/integration/api.intake-clarify.test.ts
git add api/intake-clarify.ts tests/integration/api.intake-clarify.test.ts
git commit -m "feat(api): add /api/intake-clarify endpoint"
```

### Task 2.7：`api/_shared/prompts/advisor.ts`

**Files:**
- Create: `api/_shared/prompts/advisor.ts`
- Test: `tests/unit/prompt.advisor.test.ts`

内容严格参照 spec §6.2。

- [ ] **Step 1：写 test**

```ts
import { describe, expect, it } from 'vitest';
import { buildAdvisorPrompt } from '../../api/_shared/prompts/advisor';
import type { AdvisorSkill } from '../../src/types/advisor';

const munger: AdvisorSkill = {
  frontmatter: { id: 'munger', name: '芒格', tagline: '多元思维', avatarColor: 'oklch(1 0 0)', speakStyle: '严谨·格言', version: '0.1' },
  mentalModels: [
    { name: '逆向思考', method: '反过来想', tendency: '避愚蠢', signal: '选项太多时' },
    { name: '能力圈', method: '圈内判断', tendency: '不懂不碰', signal: '陌生领域' },
    { name: '误判心理学', method: '识别偏差', tendency: '怀疑直觉', signal: '情绪激动时' },
  ],
  quotes: '> Invert, always invert.',
  blindspots: '- lattice 不全时',
  speakStyle: '- 引用学科类比',
  raw: '',
};

describe('buildAdvisorPrompt', () => {
  it('injects advisor identity + M/Q/B/S into prompt', () => {
    const p = buildAdvisorPrompt({
      advisor: munger,
      session: { question: '我该不该跳槽' },
      priorRounds: [],
    });
    expect(p).toContain('你是 芒格');
    expect(p).toContain('多元思维');
    expect(p).toContain('逆向思考');
    expect(p).toContain('反过来想');
    expect(p).toContain('Invert');
    expect(p).toContain('我该不该跳槽');
  });

  it('includes <meta> block instruction', () => {
    const p = buildAdvisorPrompt({ advisor: munger, session: { question: 'q' }, priorRounds: [] });
    expect(p).toContain('<meta>');
    expect(p).toContain('usedModels');
    expect(p).toContain('modelBriefs');
  });

  it('adds first-speaker preamble when priorRounds is empty', () => {
    const p = buildAdvisorPrompt({ advisor: munger, session: { question: 'q' }, priorRounds: [] });
    expect(p).toContain('你是第一位发言者');
  });

  it('adds behavior rules when priorRounds has entries', () => {
    const p = buildAdvisorPrompt({
      advisor: munger,
      session: { question: 'q' },
      priorRounds: [{ advisorId: 'buffett', advisorName: '巴菲特', content: '我认为要稳健' }],
    });
    expect(p).toContain('前面已发言的军师');
    expect(p).toContain('巴菲特');
    expect(p).toContain('我认为要稳健');
    expect(p).toContain('禁止 echo');
  });

  it('inlines clarifications when present', () => {
    const p = buildAdvisorPrompt({
      advisor: munger,
      session: {
        question: 'q',
        clarifications: [{ question: '现金流如何', answer: '还行' }],
      },
      priorRounds: [],
    });
    expect(p).toContain('现金流如何');
    expect(p).toContain('还行');
  });
});
```

- [ ] **Step 2：实现**

```ts
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
  return advisor.mentalModels.map((m) => (
    `### ${m.name}\n**方法本体**：${m.method}\n**典型决策倾向**：${m.tendency}\n**适用信号**：${m.signal}`
  )).join('\n\n---\n\n');
}

export function buildAdvisorPrompt(p: AdvisorPromptParams): string {
  const { advisor, session, priorRounds } = p;
  const mBlock = formatMentalModels(advisor);
  const qBlock = advisor.quotes || '（无）';
  const bBlock = advisor.blindspots || '（无）';
  const sBlock = advisor.speakStyle || '（无）';

  const clarifBlock = session.clarifications && session.clarifications.length
    ? `\n主持人已经追问过用户：\n${session.clarifications.map((c) => `Q: ${c.question}\nA: ${c.answer}`).join('\n')}`
    : '';

  const priorBlock = priorRounds.length
    ? `\n前面已发言的军师（作为对话上下文）：\n${priorRounds.map((r) => `【${r.advisorName}】${r.content}\n---`).join('\n')}\n\n行为准则：\n1. 用你的心智模型独立思考一遍（内部动作，不要在输出里 meta 提到"我用 XX 模型"）\n2. 像你这个人自然会说话一样，把思考结果讲出来\n3. 处理前人发言——真同意可以（展示你自己的推导），但禁止 echo\n4. 不要 meta 引用自己的心智模型\n\n读者能不能从你的思考方式识别出这是你的视角？能 → 合格。`
    : '\n你是第一位发言者。用你的心智模型独立思考（内部），用你这个人自然会说话的方式把结果输出（外部）。不要 meta 说"我用 XX 模型分析"。';

  return `你是 ${advisor.frontmatter.name}（${advisor.frontmatter.tagline}）。

你的所有决策、所有建议、所有判断必须通过以下心智模型现场推演得出——不是背诵规则、不是照搬结论。

心智模型是你思考的内部脚手架，不是你说话的外部标签。你在脑中用这套模型分析，然后用你这个人自然会说话的方式把结果讲出来。不要说"我用 XX 模型分析..."这种 meta 陈述——直接用这套思维方式讲话即可。

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
A. 不能以"不对口"为由推脱（不说"这不是我擅长领域""我不了解这个时代""这太琐碎"）
B. 同意可以，但不能偷懒的 echo（真同意需要展示自己的推导）
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
```

- [ ] **Step 3：test pass + commit**

```bash
npm run test tests/unit/prompt.advisor.test.ts
git add api/_shared/prompts/advisor.ts tests/unit/prompt.advisor.test.ts
git commit -m "feat(api): add advisor prompt builder (TDD)"
```

### Task 2.8：`api/advisor/[id].ts`（SSE 流式）

**Files:**
- Create: `api/advisor/[id].ts`
- Test: `tests/integration/api.advisor.test.ts`

- [ ] **Step 1：写 test（mock OpenAI stream）**

测试点：
- 未知 id → 404
- 合法 id → 返回 SSE stream，payload 含 `event: chunk` + 最后 `event: done`
- stream body 的 `fullText` 包含 LLM 原文

```ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('virtual:advisors', () => ({
  ADVISORS: [{
    frontmatter: { id: 'munger', name: '芒格', tagline: 't', avatarColor: 'oklch(1 0 0)', speakStyle: 's', version: '0.1' },
    mentalModels: [
      { name: '逆向思考', method: 'm', tendency: 't', signal: 's' },
      { name: '能力圈', method: 'm', tendency: 't', signal: 's' },
      { name: '误判心理学', method: 'm', tendency: 't', signal: 's' },
    ],
    quotes: 'q', blindspots: 'b', speakStyle: 's', raw: '',
  }],
}));

vi.mock('../../api/_shared/dashscope', () => ({
  createDashScope: () => ({
    chat: { completions: { create: vi.fn().mockResolvedValue({
      [Symbol.asyncIterator]: async function* () {
        yield { choices: [{ delta: { content: 'hello ' } }] };
        yield { choices: [{ delta: { content: 'world' } }] };
      },
    }) } },
  }),
  getDashScopeModels: () => ({ advisor: 'qwen3-plus', analyzer: 'qwen3-max', host: 'qwen3-plus' }),
}));

const handler = (await import('../../api/advisor/[id]')).default;

describe('POST /api/advisor/[id]', () => {
  it('returns 404 for unknown advisor', async () => {
    const req = new Request('http://test/api/advisor/unknown', {
      method: 'POST',
      body: JSON.stringify({ session: { question: 'q' }, priorRounds: [] }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await handler(req, { params: { id: 'unknown' } });
    expect(res.status).toBe(404);
  });

  it('streams chunks + done event', async () => {
    const req = new Request('http://test/api/advisor/munger', {
      method: 'POST',
      body: JSON.stringify({ session: { question: 'q' }, priorRounds: [] }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await handler(req, { params: { id: 'munger' } });
    expect(res.headers.get('Content-Type')).toContain('text/event-stream');
    const text = await res.text();
    expect(text).toContain('event: chunk');
    expect(text).toContain('event: done');
    expect(text).toContain('hello');
    expect(text).toContain('world');
  });
});
```

- [ ] **Step 2：实现**

```ts
import { ADVISORS } from 'virtual:advisors';
import { createDashScope, getDashScopeModels } from '../_shared/dashscope';
import { errorResponse, normalizeError } from '../_shared/errors';
import { advisorRequestSchema } from '../_shared/schemas';
import { buildAdvisorPrompt } from '../_shared/prompts/advisor';
import { createSseStream } from '../_shared/sse';
import { stripMetaBlock, parseMetaBlock } from '../../src/lib/meta';

export const config = { runtime: 'edge' };

export default async function handler(
  req: Request,
  ctx: { params: { id: string } },
): Promise<Response> {
  if (req.method !== 'POST') return errorResponse('METHOD_NOT_ALLOWED', 'POST only', 405);
  const advisor = ADVISORS.find((a) => a.frontmatter.id === ctx.params.id);
  if (!advisor) return errorResponse('NOT_FOUND', `Unknown advisor: ${ctx.params.id}`, 404);

  let body: unknown;
  try { body = await req.json(); } catch { return errorResponse('BAD_JSON', 'Invalid JSON', 400); }
  const parsed = advisorRequestSchema.safeParse(body);
  if (!parsed.success) return errorResponse('VALIDATION', parsed.error.message, 400);

  const prompt = buildAdvisorPrompt({
    advisor,
    session: parsed.data.session,
    priorRounds: parsed.data.priorRounds,
  });

  const models = getDashScopeModels();
  const client = createDashScope();
  const { response, write, close } = createSseStream();

  (async () => {
    let fullText = '';
    try {
      const stream = await client.chat.completions.create({
        model: models.advisor,
        messages: [{ role: 'system', content: `你是${advisor.frontmatter.name}。` }, { role: 'user', content: prompt }],
        stream: true,
        temperature: 0.8,
      });
      for await (const chunk of stream as any) {
        const text = chunk.choices?.[0]?.delta?.content ?? '';
        if (text) {
          fullText += text;
          write('chunk', { text });
        }
      }
      const displayText = stripMetaBlock(fullText);
      const meta = parseMetaBlock(fullText);
      write('done', { fullText, displayText, meta });
    } catch (err) {
      const e = normalizeError(err);
      write('error', e);
    } finally {
      close();
    }
  })();

  return response;
}
```

**注意**：`meta.ts` 在 Sprint 3 才正式写，这里提前建骨架。下面 Task 2.9 前建它。

- [ ] **Step 3：暂时占位 `src/lib/meta.ts`**

```ts
export function stripMetaBlock(text: string): string {
  return text.replace(/\n*<meta>[\s\S]*?<\/meta>\n*/g, '').trim();
}

export interface AdvisorMeta {
  usedModels: string[];
  modelBriefs: Record<string, string>;
}

export function parseMetaBlock(text: string): AdvisorMeta {
  const match = text.match(/<meta>([\s\S]*?)<\/meta>/);
  if (!match) return { usedModels: [], modelBriefs: {} };
  const body = match[1];
  const usedModels: string[] = [];
  const modelBriefs: Record<string, string> = {};

  const usedSection = body.match(/usedModels:\s*([\s\S]*?)(?=\nmodelBriefs:|\n?$)/);
  if (usedSection) {
    for (const line of usedSection[1].split('\n')) {
      const m = line.trim().match(/^-\s+(.+)$/);
      if (m) usedModels.push(m[1].trim());
    }
  }
  const briefSection = body.match(/modelBriefs:\s*([\s\S]*)$/);
  if (briefSection) {
    for (const line of briefSection[1].split('\n')) {
      const m = line.match(/^\s+([^:]+):\s*(.+)$/);
      if (m) modelBriefs[m[1].trim()] = m[2].trim();
    }
  }
  return { usedModels, modelBriefs };
}
```

（Sprint 3 Task 3.3 会为它补上 Vitest 覆盖。）

- [ ] **Step 4：test pass + commit**

```bash
npm run test tests/integration/api.advisor.test.ts
git add api/advisor api/_shared/prompts/advisor.ts src/lib/meta.ts tests/
git commit -m "feat(api): add /api/advisor/[id] streaming endpoint"
```

### Task 2.9：`api/_shared/prompts/analyze.ts` + `api/analyze.ts`

**Files:**
- Create: `api/_shared/prompts/analyze.ts`
- Create: `api/analyze.ts`
- Test: `tests/unit/prompt.analyze.test.ts`
- Test: `tests/integration/api.analyze.test.ts`

严格参照 spec §6.3（Analyst 校验模式）。

- [ ] **Step 1：写 analyze prompt builder test**

```ts
import { describe, expect, it } from 'vitest';
import { buildAnalyzePrompt } from '../../api/_shared/prompts/analyze';
import type { AdvisorSkill } from '../../src/types/advisor';

const munger: AdvisorSkill = {
  frontmatter: { id: 'munger', name: '芒格', tagline: 't', avatarColor: 'oklch(1 0 0)', speakStyle: 's', version: '0.1' },
  mentalModels: [
    { name: '逆向思考', method: '反过来想', tendency: '避愚蠢', signal: '选项太多时' },
    { name: '能力圈', method: '圈内判断', tendency: '不懂不碰', signal: '陌生领域' },
    { name: '误判心理学', method: '识别偏差', tendency: '怀疑直觉', signal: '情绪激动时' },
  ],
  quotes: '', blindspots: '', speakStyle: '', raw: '',
};

describe('buildAnalyzePrompt', () => {
  it('injects advisor mental model library for validation', () => {
    const p = buildAnalyzePrompt({
      session: { question: '我该不该跳槽' },
      rounds: [{
        advisorId: 'munger', advisorName: '芒格', content: '反过来想，什么情况下跳槽必失败？',
        meta: { usedModels: ['逆向思考'], modelBriefs: { '逆向思考': '反推失败情境' } },
      }],
      advisors: [munger],
    });
    expect(p).toContain('你是"思维分析员');
    expect(p).toContain('我该不该跳槽');
    expect(p).toContain('芒格');
    expect(p).toContain('心智模型库');
    expect(p).toContain('逆向思考、能力圈、误判心理学');
    expect(p).toContain('usedModels: ["逆向思考"]');
    expect(p).toContain('反推失败情境');
  });

  it('stresses validator role (not reasoner)', () => {
    const p = buildAnalyzePrompt({ session: { question: 'q' }, rounds: [], advisors: [] });
    expect(p).toContain('你是校验员');
    expect(p).toContain('不要凭空推测心智模型');
  });

  it('specifies strict JSON array output', () => {
    const p = buildAnalyzePrompt({ session: { question: 'q' }, rounds: [], advisors: [] });
    expect(p).toContain('严格 JSON 数组');
    expect(p).toContain('不要包 markdown 代码块');
    expect(p).toContain('conclusion');
    expect(p).toContain('reasoning');
    expect(p).toContain('mentalModels');
  });
});
```

- [ ] **Step 2：实现 `api/_shared/prompts/analyze.ts`**

```ts
import type { AdvisorSkill } from '../../../src/types/advisor';

export interface AnalyzePromptParams {
  session: { question: string; context?: string };
  rounds: Array<{
    advisorId: string;
    advisorName: string;
    content: string;
    meta: { usedModels: string[]; modelBriefs: Record<string, string> };
  }>;
  advisors: AdvisorSkill[];
}

export function buildAnalyzePrompt(p: AnalyzePromptParams): string {
  const roundsBlock = p.rounds.map((r) => {
    const advisor = p.advisors.find((a) => a.frontmatter.id === r.advisorId);
    const library = advisor?.mentalModels.map((m) => m.name).join('、') ?? '（未知军师，按自报处理）';
    const briefLines = Object.entries(r.meta.modelBriefs).map(([k, v]) => `  ${k}: ${v}`).join('\n');
    return `## ${r.advisorName}（advisorId: ${r.advisorId}）

### 此军师的心智模型库（权威列表，自报必须在此范围内）
${library}

### 此军师的自然发言
${r.content}

### 此军师自报的本次心智模型运用
usedModels: ${JSON.stringify(r.meta.usedModels)}
modelBriefs:
${briefLines}`;
  }).join('\n\n');

  return `你是"思维分析员（Analyst）"。一场由多位顶级思维人物组成的圆桌会议刚结束，
你要对每位军师的发言做 post-hoc 结构化归纳——每位军师一张"最终决策卡"。

# 用户的问题

${p.session.question}
${p.session.context ? `\n背景：${p.session.context}` : ''}

# 军师们的发言 + 自报元数据

${roundsBlock}

# 你的任务

你是校验员，不是推理员。军师已经自报了本次用了哪些心智模型及"怎么用的"，你的任务是：

1. 校验每位军师的自报（对每个 usedModels 条目）：
   a. 该模型名字是否在此军师的"心智模型库"里？（必须是）
   b. 该模型的 briefOfUsage 是否在军师的自然发言里有对应痕迹？（必须是）
2. 校验通过 → 直接使用军师自报的 usedModels 和 modelBriefs
3. 校验失败 → 修正并在 discrepancy 字段记录原因
4. 归纳 conclusion + reasoning（这两项军师不自报）

为每位军师生成一张 JSON 卡片：

{
  "advisorId": "munger",
  "characterName": "芒格",
  "conclusion": "一句话结论（≤40 字，明确立场，不含可能/或许）",
  "reasoning": "80-150 字的推理过程",
  "mentalModels": [
    { "name": "逆向思考", "briefOfUsage": "反推\\"什么情况下换工作必失败\\"" }
  ]
}

严格约束：
1. 不要凭空推测心智模型——以军师自报为准
2. mentalModels.name 必须在该军师的心智模型库里
3. 不跨军师串色
4. conclusion 要明确
5. reasoning 不能是 conclusion 的重复
6. 不要替用户做决定——conclusion 是这位军师的立场

输出格式：严格 JSON 数组，不要包 markdown 代码块：

[
  { "advisorId": "...", "characterName": "...", "conclusion": "...", "reasoning": "...", "mentalModels": [{...}] }
]

数组顺序与军师发言顺序一致。`;
}
```

- [ ] **Step 3：实现 `api/analyze.ts`**

```ts
import { ADVISORS } from 'virtual:advisors';
import { createDashScope, getDashScopeModels } from './_shared/dashscope';
import { errorResponse, normalizeError } from './_shared/errors';
import { analyzeRequestSchema } from './_shared/schemas';
import { buildAnalyzePrompt } from './_shared/prompts/analyze';
import { createSseStream } from './_shared/sse';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return errorResponse('METHOD_NOT_ALLOWED', 'POST only', 405);
  let body: unknown;
  try { body = await req.json(); } catch { return errorResponse('BAD_JSON', 'Invalid JSON', 400); }
  const parsed = analyzeRequestSchema.safeParse(body);
  if (!parsed.success) return errorResponse('VALIDATION', parsed.error.message, 400);

  const prompt = buildAnalyzePrompt({
    session: parsed.data.session,
    rounds: parsed.data.rounds,
    advisors: ADVISORS,
  });

  const models = getDashScopeModels();
  const client = createDashScope();
  const { response, write, close } = createSseStream();

  (async () => {
    let buffer = '';
    try {
      const stream = await client.chat.completions.create({
        model: models.analyzer,
        messages: [{ role: 'user', content: prompt }],
        stream: true,
        temperature: 0.2,
      });
      for await (const chunk of stream as any) {
        const text = chunk.choices?.[0]?.delta?.content ?? '';
        buffer += text;
      }
      // Analyst 按 spec 输出严格 JSON array；尝试 parse，逐张卡片 emit。
      let cards: any[] = [];
      try {
        cards = JSON.parse(buffer.trim());
      } catch {
        write('error', { code: 'LLM_BAD_JSON', message: 'Analyst returned invalid JSON', raw: buffer });
        close();
        return;
      }
      for (const card of cards) write('card', card);
      write('done', { cards });
    } catch (err) {
      const e = normalizeError(err);
      write('error', e);
    } finally {
      close();
    }
  })();

  return response;
}
```

> 注：spec §5.3 的 SSE event 约定是"逐卡推送 + done"。当前实现累积 buffer 后一次性拆卡，这在 MVP 够用；如果将来 Analyst 能产 JSON-stream，再改为按增量 parse。

- [ ] **Step 4：test pass + commit**

```bash
npm run test tests/unit/prompt.analyze.test.ts tests/integration/api.analyze.test.ts
git add api/_shared/prompts/analyze.ts api/analyze.ts tests/
git commit -m "feat(api): add /api/analyze Analyst endpoint with card streaming"
```

### Task 2.10：`vercel.json`

**Files:**
- Create: `vercel.json`

- [ ] **Step 1：实现**

```json
{
  "version": 2,
  "functions": {
    "api/**/*.ts": {
      "runtime": "edge",
      "maxDuration": 60
    }
  }
}
```

- [ ] **Step 2：commit**

```bash
git add vercel.json
git commit -m "chore: add vercel.json with edge runtime + 60s maxDuration"
```

### Task 2.11：Sprint 2 收尾

- [ ] **Step 1：全面跑测试**

```bash
npm run lint && npm run test
```

预期：全绿。

- [ ] **Step 2：手动验证（可选）**

如果想真实跑一次 API，可以用 `vercel dev`（需先 `npm i -g vercel` 并 `vercel link`），或写一个临时 Node 脚本 import `api/intake-clarify.ts`。不强求，Sprint 3 的前端集成会触达所有路径。

---

## Sprint 3：前端状态机 + 新 UI（预估 1.5 天）

**目标**：重写 `src/App.tsx`，把所有 UI 从单文件拆成组件，引入状态机和客户端编排，对接 Sprint 2 的 3 个 API。

### Task 3.1：`src/types/session.ts`

**Files:**
- Create: `src/types/session.ts`

参照 spec §4.2。

- [ ] **Step 1：实现**

```ts
export interface DecisionSessionInput {
  question: string;
  context?: string;
  options?: string;
  leaning?: string;
}

export interface Clarification {
  id: string;
  question: string;
  why: string;
  answer: string;
}

export interface AdvisorRound {
  advisorId: string;
  advisorName: string;
  content: string;           // stripped（显示用）
  fullText: string;          // 含 meta（传给 analyze 用）
  status: 'pending' | 'streaming' | 'done' | 'error';
  error?: string;
  meta: { usedModels: string[]; modelBriefs: Record<string, string> };
}

export interface DecisionCard {
  advisorId: string;
  characterName: string;
  conclusion: string;
  reasoning: string;
  mentalModels: Array<{ name: string; briefOfUsage: string }>;
  discrepancy?: string;
}

export interface AnalysisState {
  status: 'idle' | 'pending' | 'streaming' | 'done' | 'error';
  cards: DecisionCard[];
  error?: string;
}

export type MeetingState =
  | { kind: 'idle' }
  | { kind: 'clarify-pending'; questions: Clarification[] }
  | { kind: 'meeting-running' }
  | { kind: 'meeting-done' };

export interface DecisionSession {
  id: string;
  startedAt: number;
  endedAt?: number;
  input: DecisionSessionInput;
  clarifications: Clarification[];
  selectedAdvisorIds: string[];
  rounds: AdvisorRound[];
  analysis: AnalysisState;
  state: MeetingState;
}
```

- [ ] **Step 2：commit**

```bash
git add src/types/session.ts
git commit -m "feat(types): add DecisionSession types matching spec §4.2"
```

### Task 3.2：`src/state/meetingReducer.ts`（TDD）

**Files:**
- Create: `src/state/meetingReducer.ts`
- Test: `tests/unit/meetingReducer.test.ts`

**动作集**（覆盖 spec §7.2 状态机）：
- `INIT_SESSION` — 从 idle 进入会议（创建 session）
- `SET_INPUT` — 编辑问题/背景/选项/倾向
- `TOGGLE_ADVISOR` — 勾选/取消军师
- `INTAKE_NEEDED` — 进入 clarify-pending（设置 questions）
- `INTAKE_PASSED` — 直接进 meeting-running
- `SET_CLARIFICATION_ANSWER` — 填追问答案
- `SUBMIT_CLARIFICATIONS` — 从 clarify-pending 进 meeting-running
- `ROUND_START` — 某军师开始流式
- `ROUND_APPEND` — 累积 chunk 到该军师 content
- `ROUND_DONE` — 该军师完成，设 meta
- `ROUND_ERROR` — 某军师失败
- `ROUND_RETRY` — 重试某位军师（重置 status=pending）
- `ANALYSIS_START` — Analyst 开始
- `ANALYSIS_CARD` — 收到一张卡
- `ANALYSIS_DONE` — Analyst 完成 → 进 meeting-done
- `ANALYSIS_ERROR`
- `RESET` — 回到 idle

- [ ] **Step 1：写 test**

```ts
import { describe, expect, it } from 'vitest';
import { meetingReducer, initialMeeting } from '../../src/state/meetingReducer';

describe('meetingReducer', () => {
  it('INIT_SESSION creates session from idle', () => {
    const next = meetingReducer(initialMeeting, {
      type: 'INIT_SESSION',
      input: { question: '该不该跳槽' },
      selectedAdvisorIds: ['munger'],
    });
    expect(next.session.state.kind).toBe('idle');
    expect(next.session.input.question).toBe('该不该跳槽');
    expect(next.session.selectedAdvisorIds).toEqual(['munger']);
    expect(next.session.id).toBeTruthy();
    expect(next.session.startedAt).toBeGreaterThan(0);
  });

  it('INTAKE_NEEDED moves to clarify-pending with questions', () => {
    const seeded = meetingReducer(initialMeeting, {
      type: 'INIT_SESSION', input: { question: 'q' }, selectedAdvisorIds: ['munger'],
    });
    const next = meetingReducer(seeded, {
      type: 'INTAKE_NEEDED',
      questions: [{ id: '1', question: '预算多少?', why: '影响方案', answer: '' }],
    });
    expect(next.session.state.kind).toBe('clarify-pending');
    if (next.session.state.kind === 'clarify-pending') {
      expect(next.session.state.questions).toHaveLength(1);
    }
  });

  it('INTAKE_PASSED moves directly to meeting-running', () => {
    const seeded = meetingReducer(initialMeeting, {
      type: 'INIT_SESSION', input: { question: 'q' }, selectedAdvisorIds: ['munger'],
    });
    const next = meetingReducer(seeded, { type: 'INTAKE_PASSED' });
    expect(next.session.state.kind).toBe('meeting-running');
  });

  it('ROUND_START sets advisor status to streaming', () => {
    const seeded = meetingReducer(initialMeeting, {
      type: 'INIT_SESSION', input: { question: 'q' }, selectedAdvisorIds: ['munger', 'buffett'],
    });
    const running = meetingReducer(seeded, { type: 'INTAKE_PASSED' });
    const next = meetingReducer(running, { type: 'ROUND_START', advisorId: 'munger' });
    const round = next.session.rounds.find((r) => r.advisorId === 'munger');
    expect(round?.status).toBe('streaming');
  });

  it('ROUND_APPEND accumulates chunks', () => {
    const after = [
      { type: 'INIT_SESSION' as const, input: { question: 'q' }, selectedAdvisorIds: ['munger'] },
      { type: 'INTAKE_PASSED' as const },
      { type: 'ROUND_START' as const, advisorId: 'munger' },
      { type: 'ROUND_APPEND' as const, advisorId: 'munger', text: 'hello ' },
      { type: 'ROUND_APPEND' as const, advisorId: 'munger', text: 'world' },
    ].reduce(meetingReducer, initialMeeting);
    expect(after.session.rounds[0].content).toBe('hello world');
  });

  it('ROUND_DONE captures meta and marks status done', () => {
    const after = [
      { type: 'INIT_SESSION' as const, input: { question: 'q' }, selectedAdvisorIds: ['munger'] },
      { type: 'INTAKE_PASSED' as const },
      { type: 'ROUND_START' as const, advisorId: 'munger' },
      { type: 'ROUND_DONE' as const, advisorId: 'munger', displayText: 'hi', fullText: 'hi<meta>...</meta>', meta: { usedModels: ['逆向思考'], modelBriefs: { '逆向思考': 'x' } } },
    ].reduce(meetingReducer, initialMeeting);
    const r = after.session.rounds[0];
    expect(r.status).toBe('done');
    expect(r.content).toBe('hi');
    expect(r.meta.usedModels).toEqual(['逆向思考']);
  });

  it('ANALYSIS_DONE moves state to meeting-done', () => {
    const next = [
      { type: 'INIT_SESSION' as const, input: { question: 'q' }, selectedAdvisorIds: ['munger'] },
      { type: 'INTAKE_PASSED' as const },
      { type: 'ANALYSIS_START' as const },
      { type: 'ANALYSIS_CARD' as const, card: { advisorId: 'munger', characterName: '芒格', conclusion: 'no', reasoning: 'r', mentalModels: [] } },
      { type: 'ANALYSIS_DONE' as const },
    ].reduce(meetingReducer, initialMeeting);
    expect(next.session.state.kind).toBe('meeting-done');
    expect(next.session.analysis.status).toBe('done');
    expect(next.session.analysis.cards).toHaveLength(1);
  });

  it('RESET returns to idle', () => {
    const seeded = meetingReducer(initialMeeting, {
      type: 'INIT_SESSION', input: { question: 'q' }, selectedAdvisorIds: ['munger'],
    });
    const next = meetingReducer(seeded, { type: 'RESET' });
    expect(next).toEqual(initialMeeting);
  });
});
```

- [ ] **Step 2：实现 reducer**

框架：`MeetingState` 是 `{ session: DecisionSession; error?: string }`。`initialMeeting` 是一个空 session（`state.kind === 'idle'`, `rounds === []`, `analysis.status === 'idle'` 等）。reducer 是一个 switch case，按上述 actions 更新不可变副本。使用 `crypto.randomUUID()` 生成 session id。

- [ ] **Step 3：test pass + commit**

```bash
npm run test tests/unit/meetingReducer.test.ts
git add src/state/meetingReducer.ts tests/unit/meetingReducer.test.ts
git commit -m "feat(state): add meetingReducer with full state machine (TDD)"
```

### Task 3.3：`src/lib/meta.ts`（TDD，补测试）

**Files:**
- Create: `tests/unit/meta.test.ts`
- Modify: `src/lib/meta.ts`（Task 2.8 已占位，这里补 test + 补完整实现）

- [ ] **Step 1：写 test**

```ts
import { describe, expect, it } from 'vitest';
import { stripMetaBlock, parseMetaBlock } from '../../src/lib/meta';

describe('stripMetaBlock', () => {
  it('removes <meta>...</meta> block', () => {
    const input = 'hello world\n\n<meta>\nusedModels:\n  - x\n</meta>';
    expect(stripMetaBlock(input)).toBe('hello world');
  });
  it('returns input unchanged when no meta', () => {
    expect(stripMetaBlock('hello')).toBe('hello');
  });
});

describe('parseMetaBlock', () => {
  it('parses usedModels and modelBriefs', () => {
    const meta = parseMetaBlock(`<meta>
usedModels:
  - 逆向思考
  - 误判心理学
modelBriefs:
  逆向思考: 反推失败情形
  误判心理学: 识别逃离动机偏差
</meta>`);
    expect(meta.usedModels).toEqual(['逆向思考', '误判心理学']);
    expect(meta.modelBriefs['逆向思考']).toBe('反推失败情形');
  });
  it('returns empty when no meta block', () => {
    expect(parseMetaBlock('no meta here')).toEqual({ usedModels: [], modelBriefs: {} });
  });
});
```

- [ ] **Step 2：跑 test 确认 Task 2.8 的骨架够用**

如果 fail，改进骨架。

- [ ] **Step 3：commit**

```bash
git add tests/unit/meta.test.ts src/lib/meta.ts
git commit -m "test: cover meta strip/parse with unit tests"
```

### Task 3.4：`src/lib/sseClient.ts`（TDD）

**Files:**
- Create: `src/lib/sseClient.ts`
- Test: `tests/unit/sseClient.test.ts`

**任务**：浏览器端 fetch POST + ReadableStream 解析 SSE（原生 EventSource 不支持 POST）。

- [ ] **Step 1：写 test**

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { openSseStream } from '../../src/lib/sseClient';

function streamFromString(body: string): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(enc.encode(body));
      controller.close();
    },
  });
}

describe('openSseStream', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('yields parsed events', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      body: streamFromString(
        'event: chunk\ndata: {"text":"hi"}\n\n' +
        'event: done\ndata: {"fullText":"hi"}\n\n',
      ),
    }));
    const events: any[] = [];
    for await (const e of openSseStream({ url: '/x', body: {} })) events.push(e);
    expect(events).toEqual([
      { event: 'chunk', data: { text: 'hi' } },
      { event: 'done', data: { fullText: 'hi' } },
    ]);
  });

  it('throws when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'oops',
      body: null,
    }));
    await expect(async () => {
      for await (const _ of openSseStream({ url: '/x', body: {} })) { /* consume */ }
    }).rejects.toThrow(/500/);
  });

  it('ignores malformed frames', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      body: streamFromString('event: chunk\ndata: not json\n\nevent: chunk\ndata: {"t":1}\n\n'),
    }));
    const events: any[] = [];
    for await (const e of openSseStream({ url: '/x', body: {} })) events.push(e);
    expect(events).toEqual([{ event: 'chunk', data: { t: 1 } }]);
  });
});
```

- [ ] **Step 2：实现**

```ts
export interface SseEvent<T = unknown> { event: string; data: T; }

export interface SseRequest {
  url: string;
  body: unknown;
  signal?: AbortSignal;
}

export async function* openSseStream<T = unknown>(req: SseRequest): AsyncGenerator<SseEvent<T>> {
  const res = await fetch(req.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(req.body),
    signal: req.signal,
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new Error(`SSE request failed: ${res.status} ${text}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const frames = buf.split('\n\n');
    buf = frames.pop() ?? '';
    for (const frame of frames) {
      if (!frame.trim()) continue;
      const evtMatch = frame.match(/^event:\s*(\S+)/m);
      const dataMatch = frame.match(/^data:\s*([\s\S]*)$/m);
      if (!dataMatch) continue;
      try {
        yield { event: evtMatch?.[1] ?? 'message', data: JSON.parse(dataMatch[1]) };
      } catch {
        // ignore malformed frames
      }
    }
  }
}
```

- [ ] **Step 3：test pass + commit**

```bash
npm run test tests/unit/sseClient.test.ts
git add src/lib/sseClient.ts tests/unit/sseClient.test.ts
git commit -m "feat(lib): add SSE client for fetch+ReadableStream (TDD)"
```

### Task 3.5：`src/lib/storage.ts`（TDD）

**Files:**
- Create: `src/lib/storage.ts`
- Test: `tests/unit/storage.test.ts`

**任务**：localStorage 读/写 sessions，带版本（`mastermind.sessions.v1`）。

- [ ] **Step 1：写 test**

在 test 文件顶加环境指令：

```ts
// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import { saveSession, loadSessions, clearSessions, savePrefs, loadPrefs } from '../../src/lib/storage';
import type { DecisionSession } from '../../src/types/session';

function makeSession(id: string): DecisionSession {
  return {
    id,
    startedAt: Date.now(),
    input: { question: 'q' },
    clarifications: [],
    selectedAdvisorIds: ['munger'],
    rounds: [],
    analysis: { status: 'idle', cards: [] },
    state: { kind: 'idle' },
  };
}

describe('storage', () => {
  beforeEach(() => { localStorage.clear(); });

  it('round-trips a session', () => {
    saveSession(makeSession('1'));
    const list = loadSessions();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('1');
  });

  it('prepends newer sessions', () => {
    saveSession(makeSession('1'));
    saveSession(makeSession('2'));
    const list = loadSessions();
    expect(list.map((s) => s.id)).toEqual(['2', '1']);
  });

  it('updates in place when same id saved again', () => {
    saveSession(makeSession('1'));
    const again = { ...makeSession('1'), input: { question: 'changed' } };
    saveSession(again);
    const list = loadSessions();
    expect(list).toHaveLength(1);
    expect(list[0].input.question).toBe('changed');
  });

  it('clearSessions removes everything', () => {
    saveSession(makeSession('1'));
    clearSessions();
    expect(loadSessions()).toEqual([]);
  });

  it('prefs round-trip', () => {
    savePrefs({ lastSelectedAdvisorIds: ['munger', 'buffett'] });
    expect(loadPrefs().lastSelectedAdvisorIds).toEqual(['munger', 'buffett']);
  });

  it('returns empty on corrupt JSON', () => {
    localStorage.setItem('mastermind.sessions.v1', 'not json');
    expect(loadSessions()).toEqual([]);
  });
});
```

- [ ] **Step 2：实现**

```ts
import type { DecisionSession } from '../types/session';

const KEY = 'mastermind.sessions.v1';

export function saveSession(session: DecisionSession): void {
  if (typeof localStorage === 'undefined') return;
  const list = loadSessions();
  const updated = [session, ...list.filter((s) => s.id !== session.id)].slice(0, 50);
  localStorage.setItem(KEY, JSON.stringify(updated));
}

export function loadSessions(): DecisionSession[] {
  if (typeof localStorage === 'undefined') return [];
  const raw = localStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function clearSessions(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(KEY);
}

export interface Prefs {
  lastSelectedAdvisorIds?: string[];
}

const PREFS_KEY = 'mastermind.prefs.v1';

export function savePrefs(p: Prefs): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(PREFS_KEY, JSON.stringify(p));
}

export function loadPrefs(): Prefs {
  if (typeof localStorage === 'undefined') return {};
  const raw = localStorage.getItem(PREFS_KEY);
  if (!raw) return {};
  try { return JSON.parse(raw) as Prefs; } catch { return {}; }
}
```

- [ ] **Step 3：test pass + commit**

```bash
npm run test tests/unit/storage.test.ts
git add src/lib/storage.ts tests/unit/storage.test.ts
git commit -m "feat(lib): add localStorage session/prefs helpers (TDD)"
```

### Task 3.6：`src/lib/orchestrator.ts`（TDD）

**Files:**
- Create: `src/lib/orchestrator.ts`
- Test: `tests/unit/orchestrator.test.ts`

**任务**：编排 N 位军师的顺序流式 + 最后调用 analyze。接收一个 reducer dispatch（或 callbacks），mock `openSseStream` 来测试。

- [ ] **Step 1：写 test（mock sseClient）**

```ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/lib/sseClient', () => ({
  openSseStream: vi.fn(),
}));

const { openSseStream } = await import('../../src/lib/sseClient');
const { runMeeting } = await import('../../src/lib/orchestrator');

function asyncGen(events: any[]) {
  return (async function* () { for (const e of events) yield e; })();
}

describe('runMeeting', () => {
  it('calls advisors in order and then analyze', async () => {
    const calls: string[] = [];
    (openSseStream as any).mockImplementation((req: any) => {
      calls.push(req.url);
      if (req.url.startsWith('/api/advisor/')) {
        return asyncGen([
          { event: 'chunk', data: { text: 'reply' } },
          { event: 'done', data: { displayText: 'reply', fullText: 'reply', meta: { usedModels: [], modelBriefs: {} } } },
        ]);
      }
      return asyncGen([
        { event: 'card', data: { advisorId: 'munger', characterName: '芒格', conclusion: 'c', reasoning: 'r', mentalModels: [] } },
        { event: 'done', data: { cards: [] } },
      ]);
    });
    const cb = {
      onRoundStart: vi.fn(), onRoundChunk: vi.fn(), onRoundDone: vi.fn(), onRoundError: vi.fn(),
      onAnalysisStart: vi.fn(), onAnalysisCard: vi.fn(), onAnalysisDone: vi.fn(), onAnalysisError: vi.fn(),
    };
    await runMeeting({
      session: { input: { question: 'q' }, clarifications: [] },
      advisors: [{ id: 'munger', name: '芒格' }, { id: 'buffett', name: '巴菲特' }],
      cb,
    });
    expect(calls).toEqual(['/api/advisor/munger', '/api/advisor/buffett', '/api/analyze']);
    expect(cb.onRoundStart).toHaveBeenCalledTimes(2);
    expect(cb.onRoundDone).toHaveBeenCalledTimes(2);
    expect(cb.onAnalysisStart).toHaveBeenCalledTimes(1);
    expect(cb.onAnalysisCard).toHaveBeenCalledTimes(1);
    expect(cb.onAnalysisDone).toHaveBeenCalledTimes(1);
  });

  it('continues to analyze after an advisor errors', async () => {
    (openSseStream as any).mockImplementation((req: any) => {
      if (req.url === '/api/advisor/munger') return asyncGen([{ event: 'error', data: { message: 'oops' } }]);
      if (req.url.startsWith('/api/advisor/')) {
        return asyncGen([{ event: 'done', data: { displayText: 't', fullText: 't', meta: { usedModels: [], modelBriefs: {} } } }]);
      }
      return asyncGen([{ event: 'done', data: { cards: [] } }]);
    });
    const cb = {
      onRoundStart: vi.fn(), onRoundChunk: vi.fn(), onRoundDone: vi.fn(), onRoundError: vi.fn(),
      onAnalysisStart: vi.fn(), onAnalysisCard: vi.fn(), onAnalysisDone: vi.fn(), onAnalysisError: vi.fn(),
    };
    await runMeeting({
      session: { input: { question: 'q' }, clarifications: [] },
      advisors: [{ id: 'munger', name: '芒格' }, { id: 'buffett', name: '巴菲特' }],
      cb,
    });
    expect(cb.onRoundError).toHaveBeenCalledWith('munger', 'oops');
    expect(cb.onAnalysisStart).toHaveBeenCalled();
  });

  it('passes stripped prior rounds to subsequent advisor calls', async () => {
    const requests: any[] = [];
    (openSseStream as any).mockImplementation((req: any) => {
      requests.push(req);
      if (req.url.startsWith('/api/advisor/')) {
        return asyncGen([{ event: 'done', data: { displayText: 'clean-text', fullText: 'clean-text<meta>...</meta>', meta: { usedModels: [], modelBriefs: {} } } }]);
      }
      return asyncGen([{ event: 'done', data: { cards: [] } }]);
    });
    await runMeeting({
      session: { input: { question: 'q' }, clarifications: [] },
      advisors: [{ id: 'munger', name: '芒格' }, { id: 'buffett', name: '巴菲特' }],
      cb: {
        onRoundStart: vi.fn(), onRoundChunk: vi.fn(), onRoundDone: vi.fn(), onRoundError: vi.fn(),
        onAnalysisStart: vi.fn(), onAnalysisCard: vi.fn(), onAnalysisDone: vi.fn(), onAnalysisError: vi.fn(),
      },
    });
    const buffettReq = requests.find((r) => r.url === '/api/advisor/buffett');
    expect(buffettReq.body.priorRounds).toHaveLength(1);
    expect(buffettReq.body.priorRounds[0].content).toBe('clean-text');
    expect(buffettReq.body.priorRounds[0].content).not.toContain('<meta>');
  });
});
```

- [ ] **Step 2：实现**

```ts
import { openSseStream } from './sseClient';
import { stripMetaBlock, parseMetaBlock } from './meta';
import type { AdvisorRound, DecisionCard, DecisionSessionInput, Clarification } from '../types/session';

export interface OrchestratorCallbacks {
  onRoundStart: (advisorId: string) => void;
  onRoundChunk: (advisorId: string, text: string) => void;
  onRoundDone: (advisorId: string, payload: { displayText: string; fullText: string; meta: AdvisorRound['meta'] }) => void;
  onRoundError: (advisorId: string, error: string) => void;
  onAnalysisStart: () => void;
  onAnalysisCard: (card: DecisionCard) => void;
  onAnalysisDone: () => void;
  onAnalysisError: (error: string) => void;
}

export interface OrchestrateParams {
  session: { input: DecisionSessionInput; clarifications: Clarification[] };
  advisors: Array<{ id: string; name: string }>;
  cb: OrchestratorCallbacks;
  signal?: AbortSignal;
}

export async function runMeeting(p: OrchestrateParams): Promise<void> {
  const priorRounds: Array<{ advisorId: string; advisorName: string; content: string; meta: AdvisorRound['meta'] }> = [];

  for (const a of p.advisors) {
    p.cb.onRoundStart(a.id);
    let fullText = '';
    try {
      for await (const evt of openSseStream<any>({
        url: `/api/advisor/${a.id}`,
        body: {
          session: {
            ...p.session.input,
            clarifications: p.session.clarifications.map((c) => ({ question: c.question, answer: c.answer })),
          },
          priorRounds: priorRounds.map((r) => ({ advisorId: r.advisorId, advisorName: r.advisorName, content: r.content })),
        },
        signal: p.signal,
      })) {
        if (evt.event === 'chunk') {
          p.cb.onRoundChunk(a.id, evt.data.text);
          fullText += evt.data.text;
        } else if (evt.event === 'done') {
          const displayText = evt.data.displayText ?? stripMetaBlock(fullText);
          const meta = evt.data.meta ?? parseMetaBlock(fullText);
          p.cb.onRoundDone(a.id, { displayText, fullText: evt.data.fullText ?? fullText, meta });
          priorRounds.push({ advisorId: a.id, advisorName: a.name, content: displayText, meta });
        } else if (evt.event === 'error') {
          p.cb.onRoundError(a.id, evt.data.message ?? 'stream error');
          break;
        }
      }
    } catch (err) {
      p.cb.onRoundError(a.id, err instanceof Error ? err.message : 'network');
    }
  }

  // Analyze
  p.cb.onAnalysisStart();
  try {
    for await (const evt of openSseStream<any>({
      url: '/api/analyze',
      body: {
        session: p.session.input,
        rounds: priorRounds.map((r) => ({
          advisorId: r.advisorId,
          advisorName: r.advisorName,
          content: r.content,
          meta: r.meta,
        })),
      },
      signal: p.signal,
    })) {
      if (evt.event === 'card') p.cb.onAnalysisCard(evt.data);
      else if (evt.event === 'done') p.cb.onAnalysisDone();
      else if (evt.event === 'error') p.cb.onAnalysisError(evt.data.message ?? 'analyze error');
    }
  } catch (err) {
    p.cb.onAnalysisError(err instanceof Error ? err.message : 'network');
  }
}
```

- [ ] **Step 3：test pass + commit**

```bash
npm run test tests/unit/orchestrator.test.ts
git add src/lib/orchestrator.ts tests/unit/orchestrator.test.ts
git commit -m "feat(lib): add client-side meeting orchestrator (TDD)"
```

### Task 3.7：`src/hooks/useMeeting.ts`

**Files:**
- Create: `src/hooks/useMeeting.ts`

**任务**：用 `useReducer(meetingReducer)` + `runMeeting` 暴露给组件。

- [ ] **Step 1：实现**

```ts
import { useReducer, useRef, useCallback } from 'react';
import { ADVISORS } from 'virtual:advisors';
import { meetingReducer, initialMeeting } from '../state/meetingReducer';
import { runMeeting } from '../lib/orchestrator';
import { saveSession } from '../lib/storage';
import type { Clarification } from '../types/session';

export function useMeeting() {
  const [state, dispatch] = useReducer(meetingReducer, initialMeeting);
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(async (input: any, selectedAdvisorIds: string[]) => {
    dispatch({ type: 'INIT_SESSION', input, selectedAdvisorIds });
    // intake
    const res = await fetch('/api/intake-clarify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...input, selectedAdvisorIds }),
    });
    const body = await res.json();
    if (body.needsClarification) {
      const questions: Clarification[] = (body.questions ?? []).map((q: any) => ({
        id: q.id, question: q.question, why: q.why, answer: '',
      }));
      dispatch({ type: 'INTAKE_NEEDED', questions });
    } else {
      dispatch({ type: 'INTAKE_PASSED' });
      await runRoundtable(selectedAdvisorIds);
    }
  }, []);

  const submitClarifications = useCallback(async (answers: Record<string, string>) => {
    dispatch({ type: 'SUBMIT_CLARIFICATIONS', answers });
    await runRoundtable(state.session.selectedAdvisorIds);
  }, [state]);

  const runRoundtable = useCallback(async (ids: string[]) => {
    const advisors = ids.map((id) => {
      const a = ADVISORS.find((x) => x.frontmatter.id === id)!;
      return { id, name: a.frontmatter.name };
    });
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    await runMeeting({
      session: { input: state.session.input, clarifications: state.session.clarifications },
      advisors,
      signal: abortRef.current.signal,
      cb: {
        onRoundStart: (id) => dispatch({ type: 'ROUND_START', advisorId: id }),
        onRoundChunk: (id, text) => dispatch({ type: 'ROUND_APPEND', advisorId: id, text }),
        onRoundDone: (id, p) => dispatch({ type: 'ROUND_DONE', advisorId: id, ...p }),
        onRoundError: (id, err) => dispatch({ type: 'ROUND_ERROR', advisorId: id, error: err }),
        onAnalysisStart: () => dispatch({ type: 'ANALYSIS_START' }),
        onAnalysisCard: (card) => dispatch({ type: 'ANALYSIS_CARD', card }),
        onAnalysisDone: () => {
          dispatch({ type: 'ANALYSIS_DONE' });
          // save to localStorage
          saveSession(state.session);
        },
        onAnalysisError: (err) => dispatch({ type: 'ANALYSIS_ERROR', error: err }),
      },
    });
  }, [state]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    dispatch({ type: 'RESET' });
  }, []);

  const retryAdvisor = useCallback((advisorId: string) => {
    dispatch({ type: 'ROUND_RETRY', advisorId });
    // Note: MVP simplification — retry one advisor means rerun that advisor fresh.
    // Implementation left for Sprint 4 polish when error UX is finalized.
  }, []);

  return { state, start, submitClarifications, reset, retryAdvisor };
}
```

- [ ] **Step 2：commit**

```bash
git add src/hooks/useMeeting.ts
git commit -m "feat(hooks): add useMeeting hook wiring reducer + orchestrator"
```

### Task 3.8：拆分 UI 组件——IdleView

**Files:**
- Create: `src/views/IdleView.tsx`
- Create: `src/components/advisor/AdvisorPicker.tsx`
- Create: `src/components/advisor/AdvisorCard.tsx`
- Create: `src/components/decision/DecisionForm.tsx`
- Create: `src/components/decision/ScenarioShortcuts.tsx`
- Create: `src/components/decision/SubmitButton.tsx`
- Create: `src/components/common/EmptyStateCard.tsx`

从现有 `App.tsx` 提取，按 spec §7.1 组件树。

- [ ] **Step 1：逐组件写**

每个组件文件 ≤80 行。`AdvisorCard` 负责单个军师按钮；`AdvisorPicker` 负责 2x4 grid + 随机按钮；`DecisionForm` 是核心问题 + 可展开的背景/选项/倾向；`ScenarioShortcuts` 是 4 个快捷场景；`SubmitButton` 状态化的提交按钮。

把现有 `App.tsx` 相应逻辑搬进去。props 尽量窄（数据流单向）。

- [ ] **Step 2：`IdleView.tsx` 组合这些组件**

```tsx
import { ADVISORS } from 'virtual:advisors';
import { SCENARIOS } from '../constants';
import { AdvisorPicker } from '../components/advisor/AdvisorPicker';
import { DecisionForm } from '../components/decision/DecisionForm';
import { ScenarioShortcuts } from '../components/decision/ScenarioShortcuts';
import { SubmitButton } from '../components/decision/SubmitButton';
import { EmptyStateCard } from '../components/common/EmptyStateCard';

interface IdleViewProps {
  input: { question: string; context?: string; options?: string; leaning?: string };
  selectedAdvisorIds: string[];
  onInputChange: (patch: Partial<IdleViewProps['input']>) => void;
  onAdvisorToggle: (id: string) => void;
  onRandomize: () => void;
  onScenarioPick: (prompt: string) => void;
  onSubmit: () => void;
  canSubmit: boolean;
  error?: string;
}

export function IdleView(p: IdleViewProps) {
  return (
    <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
      <div className="lg:col-span-5 space-y-8">
        <DecisionForm value={p.input} onChange={p.onInputChange} />
        <ScenarioShortcuts scenarios={SCENARIOS} onPick={p.onScenarioPick} />
        <AdvisorPicker advisors={ADVISORS} selected={p.selectedAdvisorIds} onToggle={p.onAdvisorToggle} onRandom={p.onRandomize} />
        <SubmitButton disabled={!p.canSubmit} onClick={p.onSubmit} />
        {p.error && <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100">{p.error}</div>}
      </div>
      <div className="lg:col-span-7">
        <EmptyStateCard />
      </div>
    </div>
  );
}
```

- [ ] **Step 3：verify lint & dev（IdleView 已能渲染）**

```bash
npm run lint
npm run dev
```

- [ ] **Step 4：commit**

```bash
git add src/views/IdleView.tsx src/components/
git commit -m "feat(ui): extract IdleView and its child components"
```

### Task 3.9：拆分 UI 组件——MeetingView

**Files:**
- Create: `src/views/MeetingView.tsx`
- Create: `src/components/meeting/CompactInputBar.tsx`
- Create: `src/components/meeting/AdvisorStreamCard.tsx`
- Create: `src/components/meeting/FinalDecisionCard.tsx`
- Create: `src/components/meeting/SectionFinalDecisions.tsx`
- Create: `src/components/common/NewMeetingButton.tsx`
- Create: `src/components/decision/InlineClarifyCards.tsx`

按 spec §7.1 组件树。关键点：
- `AdvisorStreamCard` 内部 `stripMetaBlock` 后再渲染
- `FinalDecisionCard` 呈现 `conclusion / reasoning / mentalModels[]`（`name + briefOfUsage`）+ 可选 `discrepancy`

- [ ] **Step 1：逐组件写**

每个组件的 props 合同和职责如下，文件 ≤100 行：

**`CompactInputBar.tsx`**
```tsx
import { ChevronDown } from 'lucide-react';
import { ADVISORS } from 'virtual:advisors';
import type { DecisionSessionInput } from '../../types/session';

interface Props { input: DecisionSessionInput; advisorIds: string[]; }

export function CompactInputBar({ input, advisorIds }: Props) {
  const names = advisorIds
    .map((id) => ADVISORS.find((a) => a.frontmatter.id === id)?.frontmatter.name)
    .filter(Boolean)
    .join('、');
  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-4 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-stone-900 line-clamp-2">{input.question}</p>
        <p className="text-xs text-stone-500 mt-1">与会军师：{names}</p>
      </div>
    </div>
  );
}
```

**`AdvisorStreamCard.tsx`**（渲染时对 `round.content` 调 `stripMetaBlock` 以防万一）
```tsx
import { motion } from 'motion/react';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { stripMetaBlock } from '../../lib/meta';
import type { AdvisorRound } from '../../types/session';

interface Props { round: AdvisorRound; onRetry?: () => void; }

export function AdvisorStreamCard({ round, onRetry }: Props) {
  const display = stripMetaBlock(round.content);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-stone-200 rounded-2xl bg-white p-5"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold text-stone-900">{round.advisorName}</div>
        {round.status === 'streaming' && <Loader2 size={16} className="animate-spin text-stone-400" />}
        {round.status === 'error' && (
          <button onClick={onRetry} className="text-xs text-red-600 flex items-center gap-1">
            <RefreshCw size={12} /> 重试
          </button>
        )}
      </div>
      {round.status === 'error' ? (
        <div className="flex items-start gap-2 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5" />
          <div>{round.error ?? '发言生成失败'}</div>
        </div>
      ) : (
        <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">{display || '…'}</p>
      )}
    </motion.div>
  );
}
```

**`FinalDecisionCard.tsx`**
```tsx
import type { DecisionCard } from '../../types/session';

interface Props { card: DecisionCard; }

export function FinalDecisionCard({ card }: Props) {
  return (
    <div className="border border-stone-200 rounded-2xl overflow-hidden bg-white">
      <div className="px-5 py-3 bg-stone-900 text-white font-semibold">{card.characterName}</div>
      <div className="p-5 space-y-4">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-1">结论</h4>
          <p className="text-stone-900 font-medium text-lg">{card.conclusion}</p>
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-1">推理</h4>
          <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-wrap">{card.reasoning}</p>
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2">运用的心智模型</h4>
          <ul className="space-y-1.5">
            {card.mentalModels.map((m) => (
              <li key={m.name} className="text-sm text-stone-700">
                <span className="font-medium">· {m.name}</span>
                <span className="text-stone-500"> — {m.briefOfUsage}</span>
              </li>
            ))}
          </ul>
        </div>
        {card.discrepancy && (
          <div className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2 border border-amber-200">
            Analyst 备注: {card.discrepancy}
          </div>
        )}
      </div>
    </div>
  );
}
```

**`SectionFinalDecisions.tsx`**
```tsx
import { CheckCircle2 } from 'lucide-react';
import { FinalDecisionCard } from './FinalDecisionCard';
import type { DecisionCard } from '../../types/session';

interface Props { cards: DecisionCard[]; }

export function SectionFinalDecisions({ cards }: Props) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-bold flex items-center gap-2 text-stone-800">
        <CheckCircle2 size={20} /> 最终决策
      </h2>
      <div className="space-y-3">
        {cards.map((c) => <FinalDecisionCard key={c.advisorId} card={c} />)}
      </div>
    </section>
  );
}
```

**`InlineClarifyCards.tsx`**
```tsx
import { useState } from 'react';
import type { Clarification } from '../../types/session';

interface Props {
  questions: Clarification[];
  onSubmit: (answers: Record<string, string>) => void;
}

export function InlineClarifyCards({ questions, onSubmit }: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const allAnswered = questions.every((q) => (answers[q.id] ?? '').trim().length > 0);
  return (
    <div className="space-y-3">
      {questions.map((q) => (
        <div key={q.id} className="border border-stone-200 rounded-2xl bg-white p-4">
          <p className="text-sm font-medium text-stone-900">{q.question}</p>
          <p className="text-xs text-stone-500 mt-0.5">{q.why}</p>
          <textarea
            value={answers[q.id] ?? ''}
            onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
            className="mt-2 w-full p-2 text-sm border border-stone-200 rounded-lg"
            rows={2}
          />
        </div>
      ))}
      <button
        disabled={!allAnswered}
        onClick={() => onSubmit(answers)}
        className="w-full py-3 bg-stone-900 text-white rounded-xl disabled:opacity-50"
      >
        继续会议
      </button>
    </div>
  );
}
```

**`NewMeetingButton.tsx`**
```tsx
interface Props { onClick: () => void; }

export function NewMeetingButton({ onClick }: Props) {
  return (
    <div className="pt-4 border-t border-stone-200">
      <button onClick={onClick} className="w-full py-3 bg-white border border-stone-300 rounded-xl text-stone-700 font-medium hover:bg-stone-50">
        开新会议
      </button>
    </div>
  );
}
```

- [ ] **Step 2：`MeetingView.tsx` 组合**

```tsx
import type { DecisionSession } from '../types/session';
import { CompactInputBar } from '../components/meeting/CompactInputBar';
import { SectionFinalDecisions } from '../components/meeting/SectionFinalDecisions';
import { AdvisorStreamCard } from '../components/meeting/AdvisorStreamCard';
import { NewMeetingButton } from '../components/common/NewMeetingButton';
import { InlineClarifyCards } from '../components/decision/InlineClarifyCards';

interface MeetingViewProps {
  session: DecisionSession;
  onNew: () => void;
  onRetryAdvisor: (id: string) => void;
  onSubmitClarifications: (answers: Record<string, string>) => void;
}

export function MeetingView(p: MeetingViewProps) {
  const { session } = p;
  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
      <CompactInputBar input={session.input} advisorIds={session.selectedAdvisorIds} />
      {session.state.kind === 'clarify-pending' && (
        <InlineClarifyCards questions={session.state.questions} onSubmit={p.onSubmitClarifications} />
      )}
      {session.analysis.status === 'done' && (
        <SectionFinalDecisions cards={session.analysis.cards} />
      )}
      <section className="space-y-4">
        {session.rounds.map((r) => (
          <AdvisorStreamCard key={r.advisorId} round={r} onRetry={() => p.onRetryAdvisor(r.advisorId)} />
        ))}
      </section>
      {session.state.kind === 'meeting-done' && <NewMeetingButton onClick={p.onNew} />}
    </div>
  );
}
```

- [ ] **Step 3：verify lint**

- [ ] **Step 4：commit**

```bash
git add src/views/MeetingView.tsx src/components/
git commit -m "feat(ui): extract MeetingView with streaming cards and final decisions"
```

### Task 3.10：重写 `src/App.tsx` 为瘦根 + 状态切换

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1：重写**

```tsx
import { BrainCircuit } from 'lucide-react';
import { useMeeting } from './hooks/useMeeting';
import { IdleView } from './views/IdleView';
import { MeetingView } from './views/MeetingView';
import { AnimatePresence, motion } from 'motion/react';

export default function App() {
  const { state, start, submitClarifications, reset, retryAdvisor } = useMeeting();
  const isIdle = state.session.state.kind === 'idle';

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans selection:bg-stone-200">
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-stone-900 text-white rounded-xl flex items-center justify-center shadow-sm">
            <BrainCircuit size={24} />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Mastermind 智囊团</h1>
            <p className="text-xs text-stone-500 font-medium">顶级思维决策模拟器</p>
          </div>
        </div>
      </header>
      <main>
        <AnimatePresence mode="wait">
          {isIdle ? (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
              <IdleView
                input={state.session.input}
                selectedAdvisorIds={state.session.selectedAdvisorIds}
                onInputChange={(patch) => state.dispatch({ type: 'SET_INPUT', patch })}
                onAdvisorToggle={(id) => state.dispatch({ type: 'TOGGLE_ADVISOR', id })}
                onRandomize={() => state.dispatch({ type: 'RANDOMIZE_ADVISORS' })}
                onScenarioPick={(prompt) => state.dispatch({ type: 'SET_INPUT', patch: { question: prompt } })}
                onSubmit={() => start(state.session.input, state.session.selectedAdvisorIds)}
                canSubmit={state.session.input.question.trim().length > 0 && state.session.selectedAdvisorIds.length > 0}
                error={state.error}
              />
            </motion.div>
          ) : (
            <motion.div key="meeting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
              <MeetingView
                session={state.session}
                onNew={reset}
                onRetryAdvisor={retryAdvisor}
                onSubmitClarifications={submitClarifications}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
```

> 注：`state.dispatch` 需要从 hook 暴露出来，所以 `useMeeting` 的返回值要加 `dispatch`、`error`、把 reducer state 拍平成 `{ session, error, dispatch }`。

如有 TypeScript 报错，回到 `useMeeting` 补齐返回字段。

- [ ] **Step 2：verify lint + dev**

```bash
npm run lint
npm run dev
```

手动打开浏览器验证：
- 点军师 → 选中状态有切换
- 点随机 → 2-4 位被选上
- 点快捷场景 → 问题框有内容
- 点提交（未配置 API key 时会失败，这在 Sprint 4 补错误提示）

- [ ] **Step 3：commit**

```bash
git add src/App.tsx src/hooks/useMeeting.ts
git commit -m "refactor(App): slim to state-driven view switcher with Motion transitions"
```

### Task 3.11：Sprint 3 收尾验证

- [ ] **Step 1：全量 lint & test**

```bash
npm run lint && npm run test
```

- [ ] **Step 2：本地 smoke**

如果有 `vercel dev` 装好，可以本地跑一次真实会议（需要 `.env.local` 有 key）。否则跳过，等 Sprint 4 部署后线上测试。

---

## Sprint 4：打磨 + 部署（预估 0.5 天）

### Task 4.1：错误态 UI

**Files:**
- Modify: `src/views/MeetingView.tsx`（展示军师 error）
- Modify: `src/App.tsx`（顶部展示 intake error）
- Create: `src/components/common/ErrorBanner.tsx`

- [ ] **Step 1：`ErrorBanner`** 展示可关闭的错误横幅

- [ ] **Step 2：`AdvisorStreamCard`** 在 `status==='error'` 时展示"重试"按钮（绑到 `retryAdvisor`）

- [ ] **Step 3：commit**

```bash
git add src/components/common/ErrorBanner.tsx src/views/ src/components/meeting/AdvisorStreamCard.tsx
git commit -m "feat(ui): add error banner and per-advisor retry UI"
```

### Task 4.2：API key 缺失的友好提示

**Files:**
- Modify: `api/intake-clarify.ts`、`api/advisor/[id].ts`、`api/analyze.ts`（统一抛 `API_KEY_MISSING` code）
- Modify: `src/hooks/useMeeting.ts`（识别该 code 给出中文错误）

- [ ] **Step 1：`createDashScope` 抛错改为明确 code**

```ts
// dashscope.ts
if (!apiKey) throw Object.assign(new Error('DASHSCOPE_API_KEY is not configured'), { code: 'API_KEY_MISSING' });
```

- [ ] **Step 2：`normalizeError` 识别 `code`**

```ts
export function normalizeError(err: unknown) {
  if (err && typeof err === 'object' && 'code' in err && typeof (err as any).code === 'string') {
    return { code: (err as any).code, message: (err as any).message ?? '' };
  }
  if (err instanceof Error) return { code: 'INTERNAL', message: err.message };
  return { code: 'INTERNAL', message: 'Unknown error' };
}
```

- [ ] **Step 3：前端 `useMeeting` 在 error 时特判 code === 'API_KEY_MISSING' 给友好文案**

- [ ] **Step 4：commit**

```bash
git add api/ src/hooks/useMeeting.ts
git commit -m "feat: surface API_KEY_MISSING with friendly Chinese message"
```

### Task 4.3：移动端 responsive 检查

**Files:**
- Modify: `src/views/IdleView.tsx`（2 列 → 小屏单列）
- Modify: `src/views/MeetingView.tsx`

- [ ] **Step 1：在 Chrome DevTools 模拟 375x667**

- [ ] **Step 2：修 overflow / padding / grid 至干净**

- [ ] **Step 3：commit**

```bash
git add src/views/
git commit -m "style(responsive): polish mobile layout for idle and meeting views"
```

### Task 4.4：Playwright 基线 E2E

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/mastermind.spec.ts`
- Modify: `package.json`

- [ ] **Step 1：安装**

```bash
npm install -D @playwright/test
npx playwright install chromium
```

- [ ] **Step 2：`playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: 'http://localhost:3000' },
  webServer: { command: 'npm run dev', url: 'http://localhost:3000', reuseExistingServer: true, timeout: 60_000 },
});
```

- [ ] **Step 3：`tests/e2e/mastermind.spec.ts`**

```ts
import { test, expect } from '@playwright/test';

test('landing shows advisor picker with 9 advisors', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Mastermind 智囊团' })).toBeVisible();
  // 9 advisor cards
  const cards = page.locator('[data-testid="advisor-card"]');
  await expect(cards).toHaveCount(9);
});

test('scenario shortcut fills question input', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '职业决策' }).click();
  await expect(page.locator('textarea')).toHaveValue(/大厂/);
});
```

> 注：需要在 `AdvisorCard` 上加 `data-testid="advisor-card"` 以便定位。

- [ ] **Step 4：`package.json` 加 `"test:e2e": "playwright test"`**

- [ ] **Step 5：verify**

```bash
npm run test:e2e
```

- [ ] **Step 6：commit**

```bash
git add playwright.config.ts tests/e2e/ package.json package-lock.json src/components/advisor/AdvisorCard.tsx
git commit -m "test(e2e): add Playwright baseline tests for idle view"
```

### Task 4.5：部署到 Vercel

**Files:**
- （无代码变化，纯配置）

- [ ] **Step 1：`vercel` 登录 + link**

```bash
npx vercel login
npx vercel link  # 选择或新建 mastermind 项目
```

- [ ] **Step 2：配置环境变量**

```bash
npx vercel env add DASHSCOPE_API_KEY production
npx vercel env add DASHSCOPE_BASE_URL production
npx vercel env add MODEL_ADVISOR production
npx vercel env add MODEL_SYNTHESIZER production
npx vercel env add MODEL_HOST production
```

（对 preview 环境同样设一份或用 `vercel env pull` 生成本地副本。）

- [ ] **Step 3：部署**

```bash
git push  # 推 feat/mastermind-v1 到 origin
npx vercel --prod  # 或推到 main 后由 git 自动触发部署（取决于 Vercel 配置）
```

- [ ] **Step 4：线上 smoke**

访问部署 URL，跑一次真实会议（2 位军师）。
验证：
- 9 个军师正确显示
- 输入问题点提交 → intake 返回
- 圆桌 streaming 能看到 chunk
- 最终决策卡出现

- [ ] **Step 5：commit（若有改动）**

如无代码改动，此步 skip。

### Task 4.6：Sprint 4 收尾

- [ ] **Step 1：全量测试 + lint**

```bash
npm run lint && npm run test && npm run test:e2e
```

- [ ] **Step 2：把 handoff 状态同步到 docs**

更新 `docs/superpowers/handoff-2026-04-23.md` 或新建一份 `handoff-next.md`，记录当前部署地址、已知问题、Sprint 5 的切入点。

---

## Sprint 5：军师质量回炉（预估 0.5-1 天）

**目标**：用真实决策测试 9 位军师，发现并修复"出戏 / 空洞 / 自报 meta 不稳 / Analyst 校验失败率高" 等问题。这个 sprint 没有标准"通过"条件，是迭代工作。

### Task 5.1：准备测试决策集

**Files:**
- Create: `docs/superpowers/qa/test-decisions.md`

- [ ] **Step 1：写 5-10 个覆盖不同领域的决策**

- 职业（跳槽/离职/升职）
- 投资（抄底/定投/止损）
- 感情（分手/复合/结婚）
- 轻量（今晚吃什么 / 周末怎么过）
- 跨时代（曹操被问到 AI 创业 → 是否出戏？）
- 专业（技术选型 / 产品路线）
- 家庭（是否回家过年）

- [ ] **Step 2：commit**

```bash
git add docs/superpowers/qa/test-decisions.md
git commit -m "docs: add Sprint 5 advisor quality test decisions"
```

### Task 5.2：写 QA 检查表

**Files:**
- Create: `docs/superpowers/qa/advisor-checklist.md`

- [ ] **Step 1：检查维度**

- 军师说话口吻像不像（S 段是否生效）
- 是否遵守"不能推脱"（未说"这不是我擅长的领域"）
- 是否出现 AI 式陈述"我用 X 模型分析"
- 是否产出有效 `<meta>` 块（能 parse 出 usedModels）
- Analyst 的 `discrepancy` 率有多高（≥30% 意味着军师 M 段需回炉）
- 军师间是否有 echo
- 跨域问题（如曹操谈 AI）是否给出意外洞察而非空话

- [ ] **Step 2：commit**

```bash
git add docs/superpowers/qa/advisor-checklist.md
git commit -m "docs: add Sprint 5 advisor QA checklist"
```

### Task 5.3：迭代循环模板

每位军师发现问题后，修对应 SKILL.md：

```bash
# 一轮迭代动作（示例：芒格 echo 问题）
git checkout -b fix/munger-echo
vim advisors/munger/SKILL.md  # 改 M / S 段
npm run build                  # 校验不失败
# 线上跑一场 munger 参与的会议，确认改好
git commit -am "fix(advisors): strengthen munger anti-echo in S段"
git push
```

- [ ] **Step 1：根据实际 QA 结果迭代（无固定步骤，靠判断）**

- [ ] **Step 2：迭代到 9 位都"合格"（≥80% 测试决策军师表现符合检查表）**

---

## 收尾

### 最后一步：合并到 main

当 Sprint 0-5 全部跑完且线上稳定：

- [ ] **Step 1：切到 main**

```bash
cd /Users/jiaqizhong/mastermind
git checkout main
git pull
```

- [ ] **Step 2：合并 feat/mastermind-v1**

```bash
git merge feat/mastermind-v1 --no-ff
```

- [ ] **Step 3：push main**

```bash
git push
```

- [ ] **Step 4：清理 worktree**

```bash
git worktree remove .worktrees/mastermind-v1
git branch -d feat/mastermind-v1
```

---

## 自检：Spec 覆盖 checklist

| Spec 章节 | 覆盖 task | 状态 |
|---|---|---|
| §1 概述 / 第一性原理 | N/A（指导原则） | — |
| §2 14 个决策 | N/A（设计已锁） | — |
| §3.1 系统图 | Sprint 0/1/2/3 结构实现 | ✅ |
| §3.2 架构原则 4 条 | Task 1.2（vault+插件）、orchestrator、无状态服务端 | ✅ |
| §4.1 SKILL.md 格式 + 字段约束 | Task 1.1-1.12 + 1.2 validator | ✅ |
| §4.2 DecisionSession | Task 3.1 | ✅ |
| §4.3 localStorage schema | Task 3.5 | ✅ |
| §5.1 intake-clarify | Task 2.5-2.6 | ✅ |
| §5.2 advisor/[id] + SSE + meta | Task 2.7-2.8 | ✅ |
| §5.3 analyze + 校验模式 | Task 2.9 | ✅ |
| §6.1/6.2/6.3 prompt | Task 2.5/2.7/2.9 | ✅ |
| §7.1 组件树 | Task 3.8-3.10 | ✅ |
| §7.2 状态机 | Task 3.2 reducer | ✅ |
| §7.3 布局过渡 | Task 3.10 Motion AnimatePresence | ✅ |
| §8 9 位军师迁移 | Task 1.4-1.12 | ✅ |
| §9 Sprint 0-5 | 本 plan 全部 | ✅ |

---

**Plan 完成。下一步**：征询执行方式（subagent-driven vs inline），选定后开始 Sprint 0 Task 0.1。
