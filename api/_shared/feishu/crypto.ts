// ======================================================
// Feishu event subscription v2 — AES-256-CBC payload decryption.
//
// Per Feishu docs:
//   - Server holds the Encrypt Key string (user-supplied).
//   - AES key = SHA-256(encryptKey) → 32-byte raw.
//   - Each event payload is `{"encrypt": "<base64>"}`.
//   - Decode base64 → first 16 bytes = IV, rest = ciphertext.
//   - Decrypt AES-256-CBC with PKCS#7 padding (Web Crypto handles padding).
//   - Result is the JSON event body that v1 used to send in clear text.
//
// Verification Token is then checked inside the decrypted body's
// `token` field (or `header.token` for v2 event format).
// ======================================================

function base64Decode(input: string): Uint8Array {
  const bin = atob(input);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function sha256(text: string): Promise<Uint8Array> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(digest);
}

export async function decryptFeishuEvent(
  encryptedBase64: string,
  encryptKey: string,
): Promise<string> {
  if (!encryptKey) {
    throw new Error('decryptFeishuEvent: encryptKey is empty');
  }
  if (!encryptedBase64) {
    throw new Error('decryptFeishuEvent: encrypted payload is empty');
  }

  const aesKeyRaw = await sha256(encryptKey);
  const data = base64Decode(encryptedBase64);
  if (data.length < 32) {
    throw new Error(`decryptFeishuEvent: payload too short (${data.length} bytes)`);
  }
  const iv = data.slice(0, 16);
  const ciphertext = data.slice(16);

  const aesKey = await crypto.subtle.importKey(
    'raw',
    aesKeyRaw,
    { name: 'AES-CBC' },
    false,
    ['decrypt'],
  );

  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, aesKey, ciphertext);
  } catch (err) {
    throw new Error(
      `decryptFeishuEvent: AES-CBC decrypt failed (${err instanceof Error ? err.message : String(err)})`,
    );
  }
  return new TextDecoder().decode(plain);
}
