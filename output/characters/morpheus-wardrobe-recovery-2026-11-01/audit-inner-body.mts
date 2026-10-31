import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { auditCage } from '../morpheus-ambush-doff-2026-10-17/cloth-rebuild/cage-contact.mjs';

const base = new URL('./', import.meta.url);
const input = process.env.MORPHEUS_BODY_INPUT ?? 'full-removal-input';
const data = JSON.parse(await readFile(new URL(`${input}/manifest.json`, base), 'utf8'));
const results = [];
const frames = process.argv.includes('--all-frames') ? data.frames.map((frame: { frame: number }) => frame.frame) : [1, 25, 73, 169, 217];
for (const frame of frames) {
  const bytes = await readFile(new URL(`${input}/body-${frame}.bin`, base));
  const values = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const points = Array.from({ length: values.length / 3 }, (_, i) => [values[i * 3] / .4, values[i * 3 + 2] / .4, -values[i * 3 + 1] / .4]);
  let offset = 0;
  const parts = data.bodies.map((part: { name: string; count: number; indices: number[] }) => {
    const vertices = points.slice(offset, offset + part.count); offset += part.count;
    return { name: part.name, vertices, indices: part.indices };
  });
  const shirt = parts.find((part: { name: string }) => part.name === 'morpheus-ambush-shirt');
  assert.ok(shirt);
  const audit = auditCage(shirt, parts.filter((part: object) => part !== shirt));
  const row = { frame, time: data.frames[frame - 1].time, self: audit.selfCount, others: audit.bodyCount,
    pairs: audit.body.sort((a, b) => b.line - a.line).slice(0, 20) };
  results.push(row); console.log(JSON.stringify(row));
}
const report = input === 'full-removal-input' ? 'inner-body-audit.json' : `${input}-inner-body-audit.json`;
await writeFile(new URL(report, base), JSON.stringify(results, null, 2));
assert.ok(results.every(row => row.self === 0 && row.others === 0), 'The exposed shirt still crosses itself or another visible inner layer.');
