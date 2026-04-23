export interface SseEvent<T = unknown> { event: string; data: T; }

export interface SseRequest {
  url: string;
  body: unknown;
  signal?: AbortSignal;
}

export async function* openSseStream<T = unknown>(req: SseRequest): AsyncGenerator<SseEvent<T>> {
  const res = await fetch(req.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(req.body),
    signal: req.signal,
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new Error(`SSE request failed: ${res.status} ${text}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const frames = buf.split('\n\n');
    buf = frames.pop() ?? '';
    for (const frame of frames) {
      if (!frame.trim()) continue;
      const evtMatch = frame.match(/^event:\s*(\S+)/m);
      const dataMatch = frame.match(/^data:\s*([\s\S]*)$/m);
      if (!dataMatch) continue;
      try {
        yield { event: evtMatch?.[1] ?? 'message', data: JSON.parse(dataMatch[1]) };
      } catch {
        // ignore malformed frames
      }
    }
  }
}
