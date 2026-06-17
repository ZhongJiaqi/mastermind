// ======================================================
// GET /api/share?id=<shareId>
//
// Reads the council blob written by the Feishu webhook flow and returns
// it as JSON. The web client uses this to render a read-only "看完整讨论"
// view when it loads with ?c=<shareId>.
//
// Query param is used (not a path segment like /api/share/[id]) because
// the project ships as a Vite SPA on Vercel, and adding path-segment
// API routes requires extra rewrite plumbing we don't need yet.
// ======================================================

import { errorResponse } from './_shared/errors';
import { isKvConfigured, kvGetJson, KvError } from './_shared/kv';

export const config = { runtime: 'edge' };

interface SharedCouncil {
  question: string;
  selectedAdvisorIds: string[];
  fullText: string;
  modelUsed?: string;
  source?: string;
  createdAt: number;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return errorResponse('METHOD_NOT_ALLOWED', 'GET only', 405);

  const url = new URL(req.url);
  const id = (url.searchParams.get('id') || '').trim();
  if (!id) return errorResponse('VALIDATION', 'missing id', 400);
  // Only allow base62 IDs of expected length to avoid Redis key smuggling.
  if (!/^[A-Za-z0-9]{4,32}$/.test(id)) {
    return errorResponse('VALIDATION', 'malformed id', 400);
  }

  if (!isKvConfigured()) {
    return errorResponse('KV_DISABLED', 'share store not configured', 503);
  }

  try {
    const blob = await kvGetJson<SharedCouncil>(`share:${id}`);
    if (!blob) return errorResponse('NOT_FOUND', 'share expired or never existed', 404);
    return new Response(JSON.stringify(blob), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        // Share blobs are immutable once written — let the browser cache.
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    });
  } catch (err) {
    const msg = err instanceof KvError ? err.message : String(err);
    console.error('[share] read failed', msg);
    return errorResponse('KV_ERROR', msg, 502);
  }
}
