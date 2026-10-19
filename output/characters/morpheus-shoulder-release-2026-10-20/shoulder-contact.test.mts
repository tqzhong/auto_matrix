import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import test from 'node:test';
import { auditCage } from '../morpheus-ambush-doff-2026-10-17/cloth-rebuild/cage-contact.mjs';

const input = new URL('../morpheus-withdrawal-path-2026-10-20/clearance-input/', import.meta.url);
const result = new URL(process.env.MORPHEUS_CLOTH_RESULT ?? '../morpheus-withdrawal-path-2026-10-20/clearance-physics/', import.meta.url);
const data = JSON.parse(await readFile(new URL('manifest.json', input), 'utf8'));
const rows: object[] = [];
const points = async (name: string) => {
  const bytes = await readFile(new URL(name, result));
  const a = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  return Array.from({ length: a.length / 3 }, (_, i) => [a[i*3] / .4, a[i*3+2] / .4, -a[i*3+1] / .4]);
};
for (const frame of [1, 10, 16, 25]) test(`the whole garment clears all visible body layers at ${data.frames[frame-1].time} seconds`, async () => {
  const vertices = await points(`cloth-${frame}.bin`), body = await points(`body-${frame}.bin`);
  let offset = 0;
  const bodies = data.bodies.map((part: { name: string; count: number; indices: number[] }) => {
    const vertices = body.slice(offset, offset+part.count); offset += part.count;
    return { name: part.name, vertices, indices: part.indices };
  });
  assert.equal(data.indices.length / 3, 25796); assert.equal(bodies.length, 13);
  assert.equal(vertices.length, data.points.length);
  const contact = auditCage({ vertices, indices: data.indices }, bodies);
  const row = { frame, time: data.frames[frame-1].time, self: contact.selfCount, body: contact.bodyCount,
    parts: Object.fromEntries([...new Set(contact.body.map(pair => pair.mesh))].map(name => [name,contact.body.filter(pair => pair.mesh === name).length])) };
  rows.push(row);
  await writeFile(new URL('contact-results.json', result), JSON.stringify(rows, null, 2));
  console.log(JSON.stringify(row));
  assert.equal(contact.bodyCount, 0, `displayed cloth enters the actual body: ${JSON.stringify(row)}`);
  assert.equal(contact.selfCount, 0, `displayed garment crosses itself: ${JSON.stringify(row)}`);
});
