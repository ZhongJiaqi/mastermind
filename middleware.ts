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
  const injection = `<script>window.__INITIAL_SHARE__=${safeJson};</script>`;
  const injected = html.replace('</head>', `${injection}</head>`);

  return new Response(injected, {
    status: upstream.status,
    headers: passthroughHtmlHeaders(upstream.headers),
  });
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
