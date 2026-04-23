import { ADVISORS } from '../src/generated/advisors';
import { createDashScope, getDashScopeModels } from './_shared/dashscope';
import { errorResponse, normalizeError } from './_shared/errors';
import { analyzeRequestSchema } from './_shared/schemas';
import { buildAnalyzePrompt } from './_shared/prompts/analyze';
import { createSseStream } from './_shared/sse';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return errorResponse('METHOD_NOT_ALLOWED', 'POST only', 405);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse('BAD_JSON', 'Invalid JSON', 400);
  }

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
      for await (const chunk of stream as AsyncIterable<{ choices: Array<{ delta: { content?: string } }> }>) {
        const text = chunk.choices?.[0]?.delta?.content ?? '';
        buffer += text;
      }
      let cards: unknown[];
      try {
        cards = JSON.parse(buffer.trim()) as unknown[];
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
