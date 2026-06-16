import { ADVISORS } from '../src/generated/advisors';
import { errorResponse, normalizeError } from './_shared/errors';
import { councilRequestSchema } from './_shared/schemas';
import { createStreamedResponse } from './_shared/sse';
import { openCouncilStream } from './_shared/council-run';

// hkg1（香港）距 DashScope（阿里云中国）只有 ~50ms RTT。默认让 Vercel 全球
// 路由的话，美国 / 欧洲 user 的请求会从 sfo1/cdg1 等 POP 调中国 API，跨洋
// RTT × 流式响应几十秒 = 必撞 edge function 30s 硬墙超时。
export const config = { runtime: 'edge', regions: ['hkg1'] };

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

  return createStreamedResponse(async (write) => {
    let fullText = '';
    try {
      const { stream, modelUsed } = await openCouncilStream({
        advisors: selected,
        session: parsed.data.session,
      });
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
      const e = normalizeError(err);
      write('error', e);
    }
  });
}
