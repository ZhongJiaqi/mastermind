# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Context

**Mastermind 智囊团** is an AI decision-aid tool that simulates top thinkers (投资者 / 企业家 / 历史人物 / 虚构人物) to help with decision-making. User inputs a decision problem, selects advisors, advisors speak in a roundtable (each using their distinct mental models), and a final per-advisor decision card is generated.

The project was bootstrapped from Google AI Studio and is mid-migration to a Qwen-based multi-call architecture. **Before non-trivial changes, read the authoritative design spec**:

```
docs/superpowers/specs/2026-04-22-mastermind-design.md
```

The spec (v5.4) is the single source of truth — it defines 14+ locked design decisions, 3 API contracts, prompt templates, UI state machine, 9-advisor migration plan, and the 6-sprint bootstrap plan. Anything in this CLAUDE.md that conflicts with the spec should defer to the spec.

## Commands

```bash
npm install           # Install dependencies
npm run dev           # Vite dev server at http://localhost:3000 (host 0.0.0.0)
npm run build         # Production build to dist/
npm run preview       # Preview built app
npm run lint          # Type check (tsc --noEmit) — project has no separate linter
npm run clean         # rm -rf dist/
```

No test framework is wired up yet. Spec plans Playwright for E2E in a later sprint.

## Architecture

### Current baseline (fresh clone state)

- Entry: `index.html` → `src/main.tsx` → `src/App.tsx`
- `src/App.tsx` (~17 KB) is a single-file UI holding the 2-column layout, state, and LLM integration
- `src/constants.ts` exports `CHARACTERS` (8 preset advisors, one-line descriptions) and `SCENARIOS` (4 decision shortcuts)
- LLM calls go directly from the browser via `@google/genai` with `GEMINI_API_KEY` injected compile-time through `vite.config.ts` (`process.env.GEMINI_API_KEY` define)
- Single LLM call returns `<discussion>...<conclusions>[JSON]` and is parsed with regex on the client
- Styling: Tailwind CSS 4 via `@tailwindcss/vite`; palette is stone gray + accent chips per character
- Animation / icons: `motion` (Framer Motion successor) + `lucide-react`

### Target architecture (per spec)

- Gemini → **Qwen** via Aliyun DashScope (OpenAI-compatible endpoint)
- Single browser call → **N advisor calls + 1 Analyst call** (client-orchestrated, each ≤ 15 s to stay within Vercel 60 s function limit)
- Inline `CHARACTERS` array → **markdown vault** at `advisors/<id>/SKILL.md` with structured frontmatter + `M / Q / B / S` sections (心智模型 / 代表引用 / 自觉边界 / 说话风格). A Vite plugin reads the vault at build time and injects it as a constant — no runtime FS.
- Advisors append a hidden `<meta>` block (usedModels + modelBriefs) after their natural speech; UI strips it from display; Analyst reads it to generate per-character decision cards with verified mental model attribution.
- Three Vercel Functions under `api/`: `intake-clarify`, `advisor/[id]`, `analyze`.

### Locked design principles (from spec)

- **心智模型是本质，人物是包装** — each advisor is a personified wrapper around mental models.
- **No dimension limits** — any mental model applies to any decision; do not add scenario / era / weight gating anywhere.
- **Mental models are internal scaffolding, not external labels** — advisors must speak naturally and never say "I used X model". Meta attribution lives in the hidden `<meta>` block only.
- **No standalone `P` (决策原则) field** — principles are derivatives of mental models; listing them separately encourages mechanical rule-application and is explicitly rejected.
- **9 preset advisors** (munger, buffett, musk, duanyongping, zhangyiming, zhangxiaolong, caocao, zhenhuan, trump) — 5 will be forked from community nuwa-skill repos, 4 Claude-drafted.

## Environment Variables

Current `.env.local` / `.env.example` use Qwen config (the migration target):

- `DASHSCOPE_API_KEY` — Aliyun DashScope key (sk-...)
- `DASHSCOPE_BASE_URL` — `https://dashscope.aliyuncs.com/compatible-mode/v1`
- `MODEL_ADVISOR` — default `qwen3-plus`
- `MODEL_SYNTHESIZER` — default `qwen3-max` (used by the Analyst endpoint)
- `MODEL_HOST` — default `qwen3-plus`

Legacy `GEMINI_API_KEY` still appears in `vite.config.ts` define and will be removed in Sprint 0.

## Path Aliases

- `@/*` → repo root (configured in both `tsconfig.json` and `vite.config.ts`)

## Language Convention

Docs, specs, UI copy are Chinese. Code identifiers, API field names, file paths, and commit messages are English.

## Vite HMR Note

`vite.config.ts` honors `DISABLE_HMR=true` — an AI Studio artifact. Safe to keep; only matters if running inside AI Studio.
