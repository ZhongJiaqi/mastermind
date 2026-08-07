// ======================================================
// Mastermind · LLM Fallback Chain (slim, no DB)
//
// Stateless self-healing for DashScope-compatible endpoints, ported from
// ai-news-radar's lib/llm/index.ts but stripped to:
//   - Env-baked chain (LLM_MODEL_CHAIN), no Supabase health table
//   - Per-process in-memory exhaustion cache (Map<modelId, untilTs>)
//   - 60s per-model timeout via AbortController
//   - 3x exponential retry on transient 5xx / 429
//   - Auto-fallback on quota exhaustion, open timeout, or empty content.
//     Other non-quota errors bubble immediately.
//
// Streaming-safe: the factory passed to tryWithChain receives an
// AbortSignal that only fires before the factory resolves. Once it
// resolves (e.g. stream handle returned), the timer is cleared so
// downstream stream consumption is not interrupted.
// ======================================================

export interface ChainContext {
  taskName: string;
  timeoutMs: number;
}

export interface ChainResult<T> {
  modelUsed: string;
  result: T;
}

const DEFAULT_PRIMARY = 'deepseek-v4-flash-0731';
const DEFAULT_FALLBACKS = ['qwen3.8-max'];
const DEFAULT_TIMEOUT_MS = 60_000;

function trimOrEmpty(value: string | undefined): string {
  return value?.trim() || '';
}

export function resolveChain(primaryFromCaller?: string): string[] {
  const primary = trimOrEmpty(primaryFromCaller) || DEFAULT_PRIMARY;
  const raw = trimOrEmpty(process.env.LLM_MODEL_CHAIN);
  const extras = raw
    ? raw.split(',').map((s) => s.trim()).filter(Boolean)
    : DEFAULT_FALLBACKS;

  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const m of [primary, ...extras]) {
    if (seen.has(m)) continue;
    seen.add(m);
    ordered.push(m);
  }
  return ordered;
}

// ----------------------- Error classification -----------------------

function toErrText(err: unknown): string {
  if (err && typeof err === 'object') {
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return String(err);
}

function errStatus(err: unknown): number | undefined {
  if (err && typeof err === 'object') {
    const status = (err as { status?: unknown }).status;
    if (typeof status === 'number') return status;
  }
  return undefined;
}

export function isQuotaExhaustionError(err: unknown): boolean {
  const status = errStatus(err);
  if (status === 429) return true;
  if (status !== 403) return false;
  const msg = toErrText(err).toLowerCase();
  return (
    msg.includes('freetieronly') ||
    msg.includes('free tier') ||
    msg.includes('allocationquota') ||
    msg.includes('exhausted') ||
    msg.includes('insufficient') ||
    msg.includes('quota')
  );
}

function isEmptyContentError(err: unknown): boolean {
  return toErrText(err).toLowerCase().includes('returned empty content');
}

function shouldRetry(err: unknown): boolean {
  // AbortError (per-call timeout) is not worth retrying — fallback to next model instead.
  if (err && typeof err === 'object' && (err as { name?: string }).name === 'AbortError') {
    return false;
  }
  // Quota errors (429 / 403 + free-tier signal) won't recover within a retry
  // window. Fall through to the next model immediately — interactive UX.
  if (isQuotaExhaustionError(err) || isEmptyContentError(err)) return false;
  const status = errStatus(err);
  if (typeof status !== 'number') return true; // network / unknown
  return status >= 500;
}

// ----------------------- In-process exhaustion cache -----------------------

// Module-scope Map persists across requests within the same Vercel
// function instance. On cold start it resets, which is fine — the chain
// will simply re-discover the exhausted model on the first call.
const exhaustedUntil = new Map<string, number>();

function nextUtcMidnightTs(now: number = Date.now()): number {
  const d = new Date(now);
  return Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate() + 1,
    0, 0, 0, 0,
  );
}

export function isExhaustedInProcess(modelId: string, now: number = Date.now()): boolean {
  const until = exhaustedUntil.get(modelId);
  if (until == null) return false;
  if (until <= now) {
    exhaustedUntil.delete(modelId);
    return false;
  }
  return true;
}

export function markExhaustedInProcess(modelId: string, untilTs?: number): void {
  exhaustedUntil.set(modelId, untilTs ?? nextUtcMidnightTs());
}

// Test-only — never called from request path.
export function _resetExhaustedForTests(): void {
  exhaustedUntil.clear();
}

// ----------------------- Retry + timeout wrapper -----------------------

async function callWithRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i === retries - 1 || !shouldRetry(err)) throw err;
      const delay = Math.pow(2, i) * 1000;
      console.warn(
        `[LLM] Retry ${i + 1}/${retries} after ${delay}ms: ${toErrText(err)}`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

// ----------------------- Public: tryWithChain -----------------------

export type ChainFactory<T> = (model: string, signal: AbortSignal) => Promise<T>;

export async function tryWithChain<T>(
  ctx: ChainContext,
  primary: string | undefined,
  factory: ChainFactory<T>,
): Promise<ChainResult<T>> {
  const chain = resolveChain(primary);
  const timeoutMs = ctx.timeoutMs > 0 ? ctx.timeoutMs : DEFAULT_TIMEOUT_MS;
  const errors: string[] = [];

  for (let i = 0; i < chain.length; i++) {
    const model = chain[i];

    if (isExhaustedInProcess(model)) {
      errors.push(`${model}: skipped (in-process cache: exhausted)`);
      continue;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const result = await callWithRetry(() => factory(model, controller.signal));
      clearTimeout(timer);
      if (i > 0) {
        console.warn(
          `[${ctx.taskName}] LLM fell through to ${model} after ${i} exhausted upstream(s)`,
        );
      }
      return { modelUsed: model, result };
    } catch (err) {
      clearTimeout(timer);
      errors.push(`${model}: ${toErrText(err)}`);

      // Per-model timeout looks like an AbortError — treat as exhausted-for-now
      // so we move to the next candidate instead of failing the whole request.
      const isTimeout =
        err && typeof err === 'object' && (err as { name?: string }).name === 'AbortError';

      if (isQuotaExhaustionError(err)) {
        markExhaustedInProcess(model);
        console.warn(
          `[${ctx.taskName}] LLM ${model} exhausted (status=${errStatus(err)}), trying next`,
        );
        continue;
      }

      if (isEmptyContentError(err)) {
        markExhaustedInProcess(model);
        console.warn(
          `[${ctx.taskName}] LLM ${model} returned empty content, trying next`,
        );
        continue;
      }

      if (isTimeout && i < chain.length - 1) {
        console.warn(
          `[${ctx.taskName}] LLM ${model} timed out after ${timeoutMs}ms, trying next`,
        );
        continue;
      }

      // Non-quota / non-timeout errors are caller-side (bad key, malformed
      // prompt, 4xx other than 403/429) — bubble up so the surface gets a
      // real error instead of silently retrying a doomed call N times.
      throw err;
    }
  }

  const e = new Error(
    `All LLM models exhausted in chain [${chain.join(', ')}]: ${errors.join(' | ')}`,
  ) as Error & { code?: string };
  e.code = 'LLM_CHAIN_EXHAUSTED';
  throw e;
}
