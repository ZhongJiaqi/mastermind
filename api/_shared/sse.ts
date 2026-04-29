export function formatSseEvent(event: string | null, data: unknown): string {
  const name = event ?? 'message';
  const payload = JSON.stringify(data);
  return `event: ${name}\ndata: ${payload}\n\n`;
}

export type SseWriter = (event: string, data: unknown) => void;

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
};

/**
 * 把 async 流驱动包进 ReadableStream 的 start handler。
 *
 * 在 Vercel edge runtime 下，handler 返回 Response 后 async IIFE 会被 tear down，
 * 流中断；而 ReadableStream 的 start(controller) 由 stream lifecycle 保活，
 * 直到 controller.close() 才释放。Node 下两种写法都能跑，但 edge 必须用这个。
 */
export function createStreamedResponse(
  producer: (write: SseWriter) => Promise<void>,
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write: SseWriter = (event, data) => {
        controller.enqueue(encoder.encode(formatSseEvent(event, data)));
      };
      try {
        await producer(write);
      } catch (err) {
        try {
          write('error', {
            code: 'STREAM_PRODUCER_THREW',
            message: err instanceof Error ? err.message : String(err),
          });
        } catch {
          /* swallow — stream may already be closed */
        }
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });
  return new Response(stream, { headers: SSE_HEADERS });
}
