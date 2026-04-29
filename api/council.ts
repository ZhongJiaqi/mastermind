import { ADVISORS } from '../src/generated/advisors';
import { createDashScope, getDashScopeModels } from './_shared/dashscope';
import { errorResponse, normalizeError } from './_shared/errors';
import { councilRequestSchema } from './_shared/schemas';
import { buildCouncilPrompt } from './_shared/prompts/council';
import { createStreamedResponse } from './_shared/sse';

export const config = { runtime: 'edge' };

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
      // DashScope-specific 顶层参数 enable_thinking: false——关闭 Qwen3.x reasoning
      // 阶段。reasoning 会先吐 ~30s thinking 才输出 content，Vercel edge function
      // 60s maxDuration 会被 thinking 吃光，client 收不到任何 chunk。OpenAI SDK 类型
      // 不识别此参数，故用宽松类型组装 params。
      const params = {
        model: models.analyzer,
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
      const stream = await client.chat.completions.create(params);
      for await (const chunk of stream as AsyncIterable<{
        choices: Array<{ delta: { content?: string } }>;
      }>) {
        const text = chunk.choices?.[0]?.delta?.content ?? '';
        if (text) {
          fullText += text;
          write('chunk', { text });
        }
      }
      write('done', { fullText });
    } catch (err) {
      const e = normalizeError(err);
      write('error', e);
    }
  });
}
