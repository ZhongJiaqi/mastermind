import { describe, expect, it } from 'vitest';
import { formatSseEvent, createSseStream } from '../../api/_shared/sse';

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

describe('createSseStream', () => {
  it('returns a Response with SSE headers and a ReadableStream body', async () => {
    const { response, write, close } = createSseStream();
    expect(response.headers.get('Content-Type')).toBe('text/event-stream; charset=utf-8');
    expect(response.headers.get('Cache-Control')).toBe('no-cache, no-transform');
    write('chunk', { text: 'hello' });
    close();
    const text = await response.text();
    expect(text).toContain('event: chunk');
    expect(text).toContain('data: {"text":"hello"}');
  });
});
