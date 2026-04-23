export function formatSseEvent(event: string | null, data: unknown): string {
  const name = event ?? 'message';
  const payload = JSON.stringify(data);
  return `event: ${name}\ndata: ${payload}\n\n`;
}

export interface SseStreamHandle {
  response: Response;
  write: (event: string, data: unknown) => void;
  close: () => void;
}

export function createSseStream(): SseStreamHandle {
  const encoder = new TextEncoder();
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;
    },
  });
  return {
    response: new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    }),
    write(event, data) {
      if (!controllerRef) throw new Error('stream not started');
      controllerRef.enqueue(encoder.encode(formatSseEvent(event, data)));
    },
    close() {
      controllerRef?.close();
    },
  };
}
