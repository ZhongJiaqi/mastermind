import { describe, expect, it } from 'vitest';
import { requireContentStream, type ChatStream } from '../../api/_shared/council-run';

function streamOf(...contents: Array<string | undefined>): ChatStream {
  return {
    async *[Symbol.asyncIterator]() {
      for (const content of contents) {
        yield { choices: [{ delta: { content } }] };
      }
    },
  };
}

describe('requireContentStream', () => {
  it('rejects a completed HTTP 200 stream with no meaningful content', async () => {
    await expect(requireContentStream(streamOf(undefined, '', '   '))).rejects.toThrow(
      'LLM returned empty content',
    );
  });

  it('preserves buffered chunks once meaningful content arrives', async () => {
    const stream = await requireContentStream(streamOf(' ', '<discussion>', 'hello'));
    let fullText = '';
    for await (const chunk of stream) {
      fullText += chunk.choices[0]?.delta.content ?? '';
    }
    expect(fullText).toBe(' <discussion>hello');
  });
});
