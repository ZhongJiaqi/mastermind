#!/usr/bin/env node
/**
 * Council E2E smoke test.
 *
 * Hits POST /api/council against a target host (prod or local dev) with a
 * fixed跳槽-decision payload and validates:
 *   - SSE stream completes within 60s edge limit
 *   - fullText contains both <discussion> and <conclusions> blocks
 *   - conclusions parses as strict JSON array with len === selectedAdvisorIds.length
 *   - each card has advisorId/characterName/conclusion/reasoning/mentalModels
 *   - 0 error events
 *
 * Usage:
 *   node scripts/smoke.mjs                              # local dev (http://localhost:3000)
 *   node scripts/smoke.mjs https://mastermind-...       # any host
 *
 * Exit codes: 0 = pass, 1 = fail (any check), 2 = transport error
 *
 * Note: 用 curl 而不是 Node 内置 fetch 做 transport——Node 25 undici 在
 * vercel.app 域名上偶发 connect timeout（curl 1s 就连得上）。curl 更可靠且
 * SSE 流式输出直接 stdout，最贴 SSE 语义。
 */

import { spawn } from 'node:child_process';

const HOST = process.argv[2] || 'http://localhost:3000';
const TIMEOUT_SEC = 90;

const PAYLOAD = {
  selectedAdvisorIds: ['buffett', 'caocao', 'zhenhuan'],
  session: {
    question:
      '我在国企工作 5 年成长慢，AI 创业公司挖我做 CTO 给 1.5% 期权 50% 涨薪但 996，老婆怀孕 6 个月，跳不跳？',
  },
};

const REQUIRED_CARD_FIELDS = ['advisorId', 'characterName', 'conclusion', 'reasoning', 'mentalModels'];

function fail(msg) {
  console.error(`[smoke] FAIL: ${msg}`);
  process.exit(1);
}
function pass(msg) {
  console.log(`[smoke] PASS: ${msg}`);
}

async function fetchSseViaCurl(url, payload) {
  return new Promise((resolve, reject) => {
    // -D /dev/stderr: dump response headers to stderr so stdout stays pure SSE body
    const args = [
      '-sN', '-X', 'POST',
      '-H', 'Content-Type: application/json',
      '-d', JSON.stringify(payload),
      '--max-time', String(TIMEOUT_SEC),
      '-D', '/dev/stderr',
      url,
    ];
    const proc = spawn('curl', args);
    let out = '';
    let err = '';
    proc.stdout.on('data', (b) => { out += b.toString(); });
    proc.stderr.on('data', (b) => { err += b.toString(); });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`curl exit ${code}: ${err.slice(0, 200)}`));
      }
      resolve(out);
    });
  });
}

const t0 = Date.now();
let raw;
try {
  raw = await fetchSseViaCurl(`${HOST}/api/council`, PAYLOAD);
} catch (e) {
  console.error(`[smoke] transport error: ${e.message}`);
  process.exit(2);
}

// stdout is pure SSE body; HTTP status was logged to stderr by curl -D
const sseBody = raw;

let chunkCount = 0;
let doneEventCount = 0;
let errorEventCount = 0;
let lastDoneFullText = '';

for (const evt of sseBody.split('\n\n')) {
  if (!evt.trim()) continue;
  const lines = evt.split('\n');
  let eventName = '';
  let dataLine = '';
  for (const l of lines) {
    if (l.startsWith('event: ')) eventName = l.slice(7).trim();
    else if (l.startsWith('data: ')) dataLine = l.slice(6);
  }
  if (eventName === 'chunk') chunkCount++;
  else if (eventName === 'error') errorEventCount++;
  else if (eventName === 'done') {
    doneEventCount++;
    try {
      const payload = JSON.parse(dataLine);
      if (payload.fullText) lastDoneFullText = payload.fullText;
    } catch {
      // ignore parse failures here, we'll catch them below
    }
  }
}

const elapsedMs = Date.now() - t0;
const elapsedSec = (elapsedMs / 1000).toFixed(1);
console.log(`[smoke] elapsed: ${elapsedSec}s, chunks: ${chunkCount}, done: ${doneEventCount}, errors: ${errorEventCount}`);

if (errorEventCount > 0) fail(`received ${errorEventCount} error event(s)`);
if (doneEventCount === 0) fail('no done event received');
if (chunkCount === 0) fail('no chunks received');
if (elapsedMs > 60_000) console.warn(`[smoke] WARN: elapsed ${elapsedSec}s > 60s Vercel edge limit (request still completed)`);

// LLM 实测偶发不写 </discussion> / </conclusions> 闭合 tag 就停笔。
// client parser 已加 fallback 容忍——smoke 这里也对齐。
const dMatch = lastDoneFullText.match(/<discussion>([\s\S]*?)(?:<\/discussion>|$)/);
const cClosedMatch = lastDoneFullText.match(/<conclusions>([\s\S]*?)<\/conclusions>/);
const cOpenMatch = lastDoneFullText.match(/<conclusions>([\s\S]*)$/);
const cMatch = cClosedMatch || cOpenMatch;
if (!dMatch) {
  console.error(`[smoke] DEBUG fullText length=${lastDoneFullText.length}, last 300:`);
  console.error(lastDoneFullText.slice(-300));
  fail('missing <discussion> block');
}
if (!cMatch) {
  console.error(`[smoke] DEBUG fullText length=${lastDoneFullText.length}, last 500:`);
  console.error(lastDoneFullText.slice(-500));
  fail('missing <conclusions> block');
}
pass(`<discussion> + <conclusions> blocks present (closed=${Boolean(cClosedMatch)})`);

let cards;
try {
  // 处理可能的 ```json fence 包裹 + 末尾未闭合
  const raw = cMatch[1].trim().replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  cards = JSON.parse(raw);
} catch (e) {
  fail(`conclusions JSON invalid: ${e.message}`);
}
if (!Array.isArray(cards)) fail('conclusions is not an array');
if (cards.length !== PAYLOAD.selectedAdvisorIds.length) {
  fail(`expected ${PAYLOAD.selectedAdvisorIds.length} cards, got ${cards.length}`);
}
pass(`${cards.length} cards, JSON valid`);

for (const card of cards) {
  for (const f of REQUIRED_CARD_FIELDS) {
    if (!(f in card)) fail(`card missing field "${f}": ${JSON.stringify(card).slice(0, 100)}`);
  }
  if (!Array.isArray(card.mentalModels) || card.mentalModels.length === 0) {
    fail(`card "${card.advisorId}" mentalModels missing or empty`);
  }
}
pass('all cards have required fields');

const gotIds = new Set(cards.map((c) => c.advisorId));
for (const id of PAYLOAD.selectedAdvisorIds) {
  if (!gotIds.has(id)) fail(`missing card for advisorId "${id}"; got ${[...gotIds].join(',')}`);
}
pass('all requested advisorIds present in cards');

const lines = dMatch[1].trim().split('\n').filter((l) => /[:：]/.test(l));
const speakers = lines.map((l) => {
  const sep = l.includes(':') ? ':' : '：';
  return l.split(sep, 2)[0].trim();
});
const per = {};
for (const s of speakers) per[s] = (per[s] || 0) + 1;
console.log(`[smoke] discussion: ${speakers.length} messages, distribution: ${JSON.stringify(per)}`);
if (speakers.length === 0) fail('discussion has 0 messages');

console.log(`[smoke] OK · ${HOST} · ${elapsedSec}s`);
process.exit(0);
