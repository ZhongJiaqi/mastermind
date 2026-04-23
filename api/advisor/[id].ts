import { ADVISORS } from '../../src/generated/advisors';
import { createDashScope, getDashScopeModels } from '../_shared/dashscope';
import { errorResponse, normalizeError } from '../_shared/errors';
import { advisorRequestSchema } from '../_shared/schemas';
import { buildAdvisorPrompt } from '../_shared/prompts/advisor';
import { createStreamedResponse } from '../_shared/sse';
import { stripMetaBlock, parseMetaBlock } from '../../src/lib/meta';

export const config = { runtime: 'edge' };

export default async function handler(
  req: Request,
  ctx?: { params?: { id?: string } },
): Promise<Response> {
  if (req.method !== 'POST') return errorResponse('METHOD_NOT_ALLOWED', 'POST only', 405);

  // Vercel edge runtime 不自动注入 ctx.params——从 URL 解析 [id]。
  // 兼容本地 dev-api middleware（用 ctx 传 params）和 Vercel edge 两种运行环境。
  const idFromCtx = ctx?.params?.id;
  const idFromUrl = decodeURIComponent(
    new URL(req.url).pathname.split('/').filter(Boolean).pop() ?? '',
  );
  const id = idFromCtx ?? idFromUrl;
  if (!id) return errorResponse('BAD_REQUEST', 'Missing advisor id in URL', 400);

  const advisor = ADVISORS.find((a) => a.frontmatter.id === id);
  if (!advisor) return errorResponse('NOT_FOUND', `Unknown advisor: ${id}`, 404);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse('BAD_JSON', 'Invalid JSON', 400);
  }
  const parsed = advisorRequestSchema.safeParse(body);
  if (!parsed.success) return errorResponse('VALIDATION', parsed.error.message, 400);

  const prompt = buildAdvisorPrompt({
    advisor,
    session: parsed.data.session,
    priorRounds: parsed.data.priorRounds,
  });

  const models = getDashScopeModels();
  const client = createDashScope();

  return createStreamedResponse(async (write) => {
    let fullText = '';
    try {
      const stream = await client.chat.completions.create({
        model: models.advisor,
        messages: [
          { role: 'system', content: `你是${advisor.frontmatter.name}。` },
          { role: 'user', content: prompt },
        ],
        stream: true,
        temperature: 0.8,
      });
      for await (const chunk of stream as AsyncIterable<{ choices: Array<{ delta: { content?: string } }> }>) {
        const text = chunk.choices?.[0]?.delta?.content ?? '';
        if (text) {
          fullText += text;
          write('chunk', { text });
        }
      }
      write('done', {
        fullText,
        displayText: stripMetaBlock(fullText),
        meta: parseMetaBlock(fullText),
      });
    } catch (err) {
      const e = normalizeError(err);
      write('error', e);
    }
  });
}
