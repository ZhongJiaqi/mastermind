// ======================================================
// Feishu /im/v1/messages send — interactive card to a single user.
//
// Why open_id by default: DM events deliver the sender's open_id in
// `event.sender.sender_id.open_id` and that's the canonical addressing
// for replies. Other id types (user_id / union_id) need separate
// permissions.
// ======================================================

import { getTenantAccessToken, FEISHU_BASE_URL, FeishuAuthError } from './auth';

export type ReceiveIdType = 'open_id' | 'user_id' | 'union_id' | 'email' | 'chat_id';

export interface SendMessageResult {
  ok: boolean;
  status: number;
  body: string;
}

export async function sendInteractiveCard(
  receiveId: string,
  card: object,
  receiveIdType: ReceiveIdType = 'open_id',
): Promise<SendMessageResult> {
  const token = await getTenantAccessToken();
  const url = `${FEISHU_BASE_URL}/im/v1/messages?receive_id_type=${receiveIdType}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      receive_id: receiveId,
      msg_type: 'interactive',
      // Feishu requires `content` to be a JSON STRING, not an object.
      content: JSON.stringify(card),
    }),
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}

// Plain text send — used when the council is still cooking and we want to
// reply "正在召集 12 位军师……" to acknowledge the user.
export async function sendText(
  receiveId: string,
  text: string,
  receiveIdType: ReceiveIdType = 'open_id',
): Promise<SendMessageResult> {
  const token = await getTenantAccessToken();
  const url = `${FEISHU_BASE_URL}/im/v1/messages?receive_id_type=${receiveIdType}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      receive_id: receiveId,
      msg_type: 'text',
      content: JSON.stringify({ text }),
    }),
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}

export { FeishuAuthError };
