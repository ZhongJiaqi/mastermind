// ======================================================
// Council runner — shared by api/council.ts (SSE streaming)
// and api/feishu/webhook.ts (one-shot, full fullText returned).
//
// The two callers need different consumption modes from the same
// underlying LLM call:
//   - SSE: pipe each chunk to the browser as it arrives
//   - Feishu webhook: wait for the whole stream, then build a card
//
// runCouncilStream() returns the OpenAI stream directly so the SSE
// caller can pipe verbatim; runCouncilOnce() drains the stream and
// returns { fullText, modelUsed }.
//
// Both paths go through tryWithChain so quota fallback (qwen3.6-max
// → deepseek-v4-pro) works identically.
// ======================================================

import type { AdvisorSkill } from '../../src/types/advisor';
import { createDashScope, getDashScopeModels } from './dashscope';
import { buildCouncilPrompt } from './prompts/council';
import { tryWithChain } from './llm-chain';

// council legitimately streams 30-90s on qwen — we bound only the *open*
// of the upstream stream at 60s; consumption is not timed.
const COUNCIL_TIMEOUT_MS = 60_000;

export type ChatStream = AsyncIterable<{
  choices: Array<{ delta: { content?: string } }>;
}>;

export interface CouncilParams {
  advisors: AdvisorSkill[];
  session: {
    question: string;
    context?: string;
    options?: string;
    leaning?: string;
    clarifications?: Array<{ question: string; answer: string }>;
  };
}

export interface CouncilStreamHandle {
  stream: ChatStream;
  modelUsed: string;
}

export interface CouncilOnceResult {
  fullText: string;
  modelUsed: string;
}

export async function openCouncilStream(
  params: CouncilParams,
): Promise<CouncilStreamHandle> {
  const prompt = buildCouncilPrompt(params);
  const models = getDashScopeModels();
  const client = createDashScope();

  const { result, modelUsed } = await tryWithChain<ChatStream>(
    { taskName: 'council', timeoutMs: COUNCIL_TIMEOUT_MS },
    models.analyzer,
    async (model, signal) => {
      // enable_thinking: false — close Qwen3.x reasoning to keep within
      // edge 60s maxDuration. SDK types don't surface it; loose cast.
      const reqParams = {
        model,
        messages: [
          {
            role: 'system',
            content:
              '你是圆桌会议的主持 + 全体演员。严格按要求输出 <discussion> 和 <conclusions> 两个块。',
          },
          { role: 'user', content: prompt },
        ],
        stream: true,
        temperature: 0.9,
        enable_thinking: false,
      } as Parameters<typeof client.chat.completions.create>[0];

      return (await client.chat.completions.create(reqParams, {
        signal,
      })) as unknown as ChatStream;
    },
  );

  return { stream: result, modelUsed };
}

// Drain the whole stream into a single string. Used by non-streaming
// callers (Feishu webhook) that need to build a card after the LLM
// has finished — partial chunks are useless to them.
export async function runCouncilOnce(params: CouncilParams): Promise<CouncilOnceResult> {
  const { stream, modelUsed } = await openCouncilStream(params);
  let fullText = '';
  for await (const chunk of stream) {
    const text = chunk.choices?.[0]?.delta?.content ?? '';
    if (text) fullText += text;
  }
  return { fullText, modelUsed };
}
