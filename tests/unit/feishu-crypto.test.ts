import { describe, expect, it } from 'vitest';
import { decryptFeishuEvent } from '../../api/_shared/feishu/crypto';

// Reference implementation matching Feishu's docs: AES-256-CBC with
// key = SHA-256(encryptKey), IV = random 16 bytes, output = IV || ciphertext
// then base64. We use Node 22+ Web Crypto (available in the test env)
// to produce fixtures rather than committing binary blobs.

async function encryptForTest(plaintext: string, encryptKey: string): Promise<string> {
  const enc = new TextEncoder();
  const keyDigest = await crypto.subtle.digest('SHA-256', enc.encode(encryptKey));
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    'raw',
    keyDigest,
    { name: 'AES-CBC' },
    false,
    ['encrypt'],
  );
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, key, enc.encode(plaintext)),
  );
  const combined = new Uint8Array(iv.length + ciphertext.length);
  combined.set(iv, 0);
  combined.set(ciphertext, iv.length);
  let bin = '';
  for (let i = 0; i < combined.length; i++) bin += String.fromCharCode(combined[i]);
  return btoa(bin);
}

describe('decryptFeishuEvent', () => {
  const key = 'Y0Yn8fxqPL41d5LvHc1yBdcQspv8QuQ4';

  it('round-trips short JSON payload', async () => {
    const original = JSON.stringify({ type: 'url_verification', challenge: 'abc123', token: 't' });
    const encrypted = await encryptForTest(original, key);
    const decrypted = await decryptFeishuEvent(encrypted, key);
    expect(decrypted).toBe(original);
  });

  it('round-trips longer event-style payload', async () => {
    const event = {
      schema: '2.0',
      header: { event_type: 'im.message.receive_v1', token: 't' },
      event: {
        sender: { sender_type: 'user', sender_id: { open_id: 'ou_xxx' } },
        message: { chat_type: 'p2p', message_type: 'text', content: '{"text":"hello"}' },
      },
    };
    const original = JSON.stringify(event);
    const encrypted = await encryptForTest(original, key);
    const decrypted = await decryptFeishuEvent(encrypted, key);
    expect(JSON.parse(decrypted)).toEqual(event);
  });

  it('fails on wrong key', async () => {
    const encrypted = await encryptForTest('hello', key);
    await expect(decryptFeishuEvent(encrypted, 'wrong-key-32-bytes-padding-12345')).rejects.toThrow();
  });

  it('rejects empty inputs', async () => {
    await expect(decryptFeishuEvent('', key)).rejects.toThrow(/empty/);
    await expect(decryptFeishuEvent('aGVsbG8=', '')).rejects.toThrow(/empty/);
  });

  it('rejects too-short payload', async () => {
    await expect(decryptFeishuEvent('aGk=', key)).rejects.toThrow(/too short/);
  });
});
