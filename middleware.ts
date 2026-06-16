// Vercel Edge Middleware: when the root path is hit with ?c=<shareId>,
// fetch the share blob from KV server-side and inline it as a <script>
// tag in the served HTML. The React app then reads window.__INITIAL_SHARE__
// instead of doing a client-side /api/share fetch — saving ~200-400ms of
// "blank page" perceived latency on the share view.
//
// For all OTHER requests (root without ?c, /api/*, /assets/*, etc.) the
// middleware passes through unchanged.

import { next } from '@vercel/edge';

export const config = {
  // Only run on the root path. Asset / API routes are unaffected.
  matcher: '/',
};

interface SharedCouncil {
  question: string;
  selectedAdvisorIds: string[];
  fullText: string;
  modelUsed?: string;
  source?: string;
  createdAt: number;
}

const SHARE_ID_RE = /^[A-Za-z0-9]{4,32}$/;

export default async function middleware(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const shareId = (url.searchParams.get('c') ?? '').trim();

  // No share id → pass through to the static index.html as usual.
  if (!shareId || !SHARE_ID_RE.test(shareId)) {
    return next();
  }

  // Fetch the static index.html via the standard pipeline so future Vite
  // changes (asset hash bumps, meta tag tweaks) flow through automatically.
  const upstream = await next();
  const contentType = upstream.headers.get('content-type') ?? '';
  if (!contentType.includes('text/html')) {
    // Not an HTML response — give up and pass through unchanged.
    return upstream;
  }

  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  const html = await upstream.text();

  // KV not configured → just return the HTML untouched; the client
  // will see the empty share and render its "could not load" state.
  if (!kvUrl || !kvToken) {
    return new Response(html, {
      status: upstream.status,
      headers: passthroughHtmlHeaders(upstream.headers),
    });
  }

  let blob: SharedCouncil | null = null;
  try {
    const kvRes = await fetch(`${kvUrl}/get/share:${shareId}`, {
      headers: { Authorization: `Bearer ${kvToken}` },
      // Don't wait forever — if KV is slow, fall back to client-side fetch.
      signal: AbortSignal.timeout(800),
    });
    if (kvRes.ok) {
      const wrapper = (await kvRes.json()) as { result?: string | null };
      if (wrapper.result) {
        blob = JSON.parse(wrapper.result) as SharedCouncil;
      }
    }
  } catch {
    // Swallow — the client will retry via /api/share, no regression.
  }

  if (!blob) {
    return new Response(html, {
      status: upstream.status,
      headers: passthroughHtmlHeaders(upstream.headers),
    });
  }

  // Inject right before </head> so it runs before main.tsx mounts.
  // Escape </script> sequences in the JSON to avoid breaking out of
  // the script tag if the council text contains literal "</script>".
  const safeJson = JSON.stringify(blob).replace(/</g, '\\u003c');
  const dataScript = `<script>window.__INITIAL_SHARE__=${safeJson};</script>`;
  // Server-side render the discussion + decision content as plain HTML
  // INSIDE <div id="root">. This way the user sees the actual data the
  // instant the HTML lands (~250ms), instead of staring at a blank page
  // for ~700ms-1s while the 161 KB JS bundle downloads. When React
  // finally mounts, it replaces the SSR content with the React-rendered
  // version — visually the same content, so flash is minimal.
  const ssrHtml = renderShareSsr(blob);
  let injected = html.replace('</head>', `${dataScript}</head>`);
  injected = injected.replace('<div id="root"></div>', `<div id="root">${ssrHtml}</div>`);

  return new Response(injected, {
    status: upstream.status,
    headers: passthroughHtmlHeaders(upstream.headers),
  });
}

// ---------------- SSR preview (no React, no Tailwind) ----------------

interface ParsedMessage {
  speaker: string;
  text: string;
}
interface ParsedCard {
  characterName: string;
  conclusion: string;
  reasoning: string;
  mentalModels: Array<{ name: string; briefOfUsage: string }>;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function extractMessages(fullText: string): ParsedMessage[] {
  const m = fullText.match(/<discussion>([\s\S]*?)<\/discussion>/);
  if (!m) return [];
  const block = m[1];
  // Look for `<speaker>: <text>` lines (the council prompt uses 「name：text」
  // and sometimes ASCII colon). Split on any blank line.
  const lines = block.split(/\n\s*\n/);
  const out: ParsedMessage[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const colonIdx = trimmed.search(/[:：]/);
    if (colonIdx <= 0 || colonIdx > 40) continue;
    out.push({
      speaker: trimmed.slice(0, colonIdx).trim(),
      text: trimmed.slice(colonIdx + 1).trim(),
    });
  }
  return out;
}

function extractCards(fullText: string): ParsedCard[] {
  const m = fullText.match(/<conclusions>([\s\S]*?)<\/conclusions>/);
  if (!m) return [];
  const raw = m[1].trim().replace(/^```json\s*/, '').replace(/```\s*$/, '');
  try {
    const data = JSON.parse(raw) as { cards?: ParsedCard[] };
    return data.cards ?? [];
  } catch {
    return [];
  }
}

function renderShareSsr(blob: SharedCouncil): string {
  const messages = extractMessages(blob.fullText);
  const cards = extractCards(blob.fullText);

  const messageHtml = messages.length
    ? messages
        .map(
          (m) => `
          <div style="margin-bottom:1rem">
            <div style="display:inline-block;font-size:0.75rem;font-weight:700;padding:2px 8px;border-radius:6px;background:#fef3c7;color:#92400e;border:1px solid #fcd34d">${escapeHtml(m.speaker)}</div>
            <p style="margin:4px 0 0;font-size:0.875rem;color:#44403c;line-height:1.6;white-space:pre-wrap">${escapeHtml(m.text)}</p>
          </div>`,
        )
        .join('')
    : '<p style="color:#a8a29e">（讨论内容加载中）</p>';

  const cardHtml = cards.length
    ? cards
        .map(
          (c) => `
        <div style="border:1px solid #e7e5e4;border-radius:1rem;overflow:hidden;margin-bottom:1rem;background:white">
          <div style="padding:12px 20px;border-bottom:1px solid #e7e5e4;background:#fef3c7;font-weight:700;font-size:1.125rem">${escapeHtml(c.characterName)}</div>
          <div style="padding:20px;display:flex;flex-direction:column;gap:1rem">
            <div>
              <div style="font-size:0.75rem;font-weight:600;color:#78716c;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px">结论</div>
              <p style="font-size:1.125rem;font-weight:500;color:#1c1917;margin:0">${escapeHtml(c.conclusion)}</p>
            </div>
            <div>
              <div style="font-size:0.75rem;font-weight:600;color:#78716c;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px">推理过程</div>
              <p style="font-size:0.875rem;color:#57534e;line-height:1.6;white-space:pre-wrap;margin:0">${escapeHtml(c.reasoning)}</p>
            </div>
            <div>
              <div style="font-size:0.75rem;font-weight:600;color:#78716c;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px">心智模型</div>
              <ul style="margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px">
                ${c.mentalModels
                  .map(
                    (mm) => `
                  <li style="font-size:0.875rem;display:flex;gap:8px"><span style="width:6px;height:6px;border-radius:50%;background:#a8a29e;margin-top:8px;flex-shrink:0"></span><div><strong style="color:#292524">${escapeHtml(mm.name)}</strong><span style="color:#78716c"> — ${escapeHtml(mm.briefOfUsage)}</span></div></li>`,
                  )
                  .join('')}
              </ul>
            </div>
          </div>
        </div>`,
        )
        .join('')
    : '';

  // Inline neutral styles + the same stone-50 / stone-200 vibe as the
  // React editor. Once React mounts it'll replace this; the content
  // stays identical so visual flash is minimal.
  return `
    <div data-ssr-share="${escapeHtml(blob.createdAt.toString())}" style="max-width:42rem;margin:0 auto;padding:1.5rem;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Segoe UI',sans-serif;color:#292524">
      <h1 style="font-size:1.5rem;font-weight:700;margin:0 0 1.5rem;line-height:1.4">${escapeHtml(blob.question)}</h1>
      <section style="margin-bottom:2rem">
        <h2 style="font-size:1.125rem;font-weight:700;margin:0 0 1rem;color:#1c1917">智囊团讨论</h2>
        <div style="background:#fafaf9;border:1px solid #e7e5e4;border-radius:1rem;padding:20px">
          ${messageHtml}
        </div>
      </section>
      ${
        cardHtml
          ? `<section><h2 style="font-size:1.125rem;font-weight:700;margin:0 0 1rem;color:#1c1917">最终决策建议</h2>${cardHtml}</section>`
          : ''
      }
    </div>`;
}

function passthroughHtmlHeaders(src: Headers): Headers {
  const out = new Headers();
  src.forEach((value, key) => {
    // Drop content-length since we mutated the body length.
    if (key.toLowerCase() === 'content-length') return;
    out.set(key, value);
  });
  out.set('content-type', 'text/html; charset=utf-8');
  // Each ?c=<id> response is bound to a single immutable share; let
  // browsers and Vercel edge cache aggressively.
  out.set('cache-control', 'public, max-age=300, s-maxage=300');
  return out;
}
