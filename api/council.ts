import { ADVISORS } from '../src/generated/advisors';
import { createDashScope, getDashScopeModels } from './_shared/dashscope';
import { errorResponse, normalizeError } from './_shared/errors';
import { councilRequestSchema } from './_shared/schemas';
import { buildCouncilPrompt } from './_shared/prompts/council';
import { createStreamedResponse } from './_shared/sse';
import { tryWithChain } from './_shared/llm-chain';

export const config = { runtime: 'edge' };

// Council streams 6-8 advisor speeches + JSON conclusions and legitimately
// takes 30-90s on Qwen. We bound only stream *establishment* at 60s —
// after the first chunk arrives the timer is cleared in tryWithChain.
const COUNCIL_TIMEOUT_MS = 60_000;

type ChatStream = AsyncIterable<{
  choices: Array<{ delta: { content?: string } }>;
}>;

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return errorResponse('METHOD_NOT_ALLOWED', 'POST only', 405);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse('BAD_JSON', 'Invalid JSON', 400);
  }
  const parsed = councilRequestSchema.safeParse(body);
  if (!parsed.success) return errorResponse('VALIDATION', parsed.error.message, 400);

  const selected = parsed.data.selectedAdvisorIds
    .map((id) => ADVISORS.find((a) => a.frontmatter.id === id))
    .filter((a): a is (typeof ADVISORS)[number] => Boolean(a));

  if (selected.length === 0) {
    return errorResponse('NOT_FOUND', 'No known advisors in selection', 404);
  }

  const prompt = buildCouncilPrompt({
    advisors: selected,
    session: parsed.data.session,
  });

  const models = getDashScopeModels();
  const client = createDashScope();

  return createStreamedResponse(async (write) => {
    let fullText = '';
    try {
      // Open the stream via the chain — any pre-stream quota error
      // (429 / 403 + free-tier signal) auto-falls through to the next
      // model in LLM_MODEL_CHAIN before we write anything to SSE.
      const { result: stream, modelUsed } = await tryWithChain<ChatStream>(
        { taskName: 'council', timeoutMs: COUNCIL_TIMEOUT_MS },
        models.analyzer,
        async (model, signal) => {
          // DashScope-specific 顶层参数 enable_thinking: false——关闭 Qwen3.x
          // reasoning 阶段（先吐 ~30s thinking 才输出 content，Vercel edge
          // 60s maxDuration 会被吃光）。OpenAI SDK 类型不识别，故宽松组装。
          const params = {
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

          return (await client.chat.completions.create(params, { signal })) as unknown as ChatStream;
        },
      );

      write('meta', { modelUsed });

      for await (const chunk of stream) {
        const text = chunk.choices?.[0]?.delta?.content ?? '';
        if (text) {
          fullText += text;
          write('chunk', { text });
        }
      }
      write('done', { fullText });
    } catch (err) {
      // Either chain fully exhausted (LLM_CHAIN_EXHAUSTED) or a non-quota
      // upstream error (auth / 4xx / mid-stream abort). Either way we've
      // written nothing meaningful yet — surface as an SSE error event so
      // the UI's ErrorBanner picks it up.
      const e = normalizeError(err);
      write('error', e);
    }
  });
}
