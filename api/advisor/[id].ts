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
  const { response, write, close } = createSseStream();

  (async () => {
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
