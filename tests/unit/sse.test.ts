import { describe, expect, it } from 'vitest';
import { formatSseEvent, createStreamedResponse } from '../../api/_shared/sse';

describe('formatSseEvent', () => {
  it('formats a named event with JSON data', () => {
    expect(formatSseEvent('chunk', { text: 'hi' })).toBe('event: chunk\ndata: {"text":"hi"}\n\n');
  });
  it('defaults event name to "message"', () => {
    expect(formatSseEvent(null, { ok: true })).toBe('event: message\ndata: {"ok":true}\n\n');
  });
  it('escapes data that contains newlines', () => {
    const out = formatSseEvent('chunk', { text: 'a\nb' });
    expect(out).toContain('data: {"text":"a\\nb"}');
  });
});

describe('createStreamedResponse', () => {
  it('returns a Response with SSE headers and drives producer inside ReadableStream.start', async () => {
    const response = createStreamedResponse(async (write) => {
      write('chunk', { text: 'hello' });
      write('done', { ok: true });
    });
    expect(response.headers.get('Content-Type')).toBe('text/event-stream; charset=utf-8');
    expect(response.headers.get('Cache-Control')).toBe('no-cache, no-transform');
    const text = await response.text();
    expect(text).toContain('event: chunk');
    expect(text).toContain('data: {"text":"hello"}');
    expect(text).toContain('event: done');
  });

  it('emits a synthetic error event when the producer throws', async () => {
    const response = createStreamedResponse(async (write) => {
      write('chunk', { text: 'partial' });
      throw new Error('boom');
    });
    const text = await response.text();
    expect(text).toContain('event: chunk');
    expect(text).toContain('event: error');
    expect(text).toContain('"code":"STREAM_PRODUCER_THREW"');
    expect(text).toContain('"message":"boom"');
  });
});
