// Tiny warm-up endpoint hit by Vercel cron every 5 minutes.
// Purpose: keep the api/feishu/webhook edge function instance hot so
// the cold-start parse + link time (~2.5s for the 128KB webhook bundle)
// doesn't blow Feishu's 3s ack deadline.
//
// This endpoint and the webhook share a deploy bundle on Vercel, so
// touching this also warms the webhook's chunk graph. We dynamic-import
// the webhook module to ensure its code is parsed too.

export const config = { runtime: 'edge' };

export default async function handler(): Promise<Response> {
  // Touch the webhook module so its bundle is parsed + linked here too.
  // No side effects — we just need V8 to keep the module hot.
  await import('./webhook');
  return new Response(JSON.stringify({ ok: true, ts: Date.now() }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
