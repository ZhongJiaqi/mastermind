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
