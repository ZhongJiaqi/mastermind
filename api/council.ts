import { ADVISORS } from '../src/generated/advisors';
import { errorResponse, normalizeError } from './_shared/errors';
import { councilRequestSchema } from './_shared/schemas';
import { createStreamedResponse } from './_shared/sse';
import { openCouncilStream } from './_shared/council-run';

// 2026-07-24 实测翻案：hkg1 → DashScope 大陆端点连接挂起 >60s（拿不到
// response headers，meta 都发不出），而美西出口直连同端点 1s 返回首包。
// 香港→大陆跨境链路已不可靠；流式响应下跨洋只多一次连接 RTT，不影响
// 吞吐，故改钉 sfo1。（4 月钉 hkg1 的原注释见 git 历史 a5deb26。）
export const config = { runtime: 'edge', regions: ['sfo1'] };

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
