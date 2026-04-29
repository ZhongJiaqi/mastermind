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
      const stream = await client.chat.completions.create({
        // Analyst 模型（qwen3-max）——需要在一次调用里同时演多人 + 输出结构化 JSON，质量优先。
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
      });
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
