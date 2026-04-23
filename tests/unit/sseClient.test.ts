import { describe, expect, it, vi, beforeEach } from 'vitest';
import { openSseStream } from '../../src/lib/sseClient';

function streamFromString(body: string): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(enc.encode(body));
      controller.close();
    },
  });
}

describe('openSseStream', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('yields parsed events', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      body: streamFromString(
        'event: chunk\ndata: {"text":"hi"}\n\n' +
        'event: done\ndata: {"fullText":"hi"}\n\n',
      ),
    }));
    const events: any[] = [];
    for await (const e of openSseStream({ url: '/x', body: {} })) events.push(e);
    expect(events).toEqual([
      { event: 'chunk', data: { text: 'hi' } },
      { event: 'done', data: { fullText: 'hi' } },
    ]);
  });

  it('throws when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'oops',
      body: null,
    }));
    await expect(async () => {
      for await (const _ of openSseStream({ url: '/x', body: {} })) { /* consume */ }
    }).rejects.toThrow(/500/);
  });

  it('ignores malformed frames', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      body: streamFromString('event: chunk\ndata: not json\n\nevent: chunk\ndata: {"t":1}\n\n'),
    }));
    const events: any[] = [];
    for await (const e of openSseStream({ url: '/x', body: {} })) events.push(e);
    expect(events).toEqual([{ event: 'chunk', data: { t: 1 } }]);
  });
});
