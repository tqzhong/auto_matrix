import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { auditCage } from '../morpheus-ambush-doff-2026-10-17/cloth-rebuild/cage-contact.mjs';

const base = new URL('./', import.meta.url);
const folder = new URL(`${process.argv[2] ?? 'ipc-newton-physics'}/`, base);
const data = JSON.parse(await readFile(new URL('input/manifest.json', base), 'utf8'));
const partial = process.argv.includes('--partial');
const frames = JSON.parse(await readFile(new URL(partial ? 'progress.json' : 'summary.json', folder), 'utf8'));
const points = async (file: string) => {
  const bytes = await readFile(new URL(file, folder));
  const a = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  return Array.from({ length: a.length/3 }, (_,i) => [a[3*i]/.4, a[3*i+2]/.4, -a[3*i+1]/.4]);
};
const rows = [];
for (const frame of frames) {
  const vertices = await points(`cloth-${frame.frame}.bin`), body = await points(`body-${frame.frame}.bin`);
  let offset = 0;
  const surfaces = data.bodies.map((part: { name: string; count: number; indices: number[] }) => {
    const vertices = body.slice(offset, offset+part.count); offset += part.count;
    return { name: part.name, vertices, indices: part.indices };
  });
  assert.equal(vertices.length, 13386); assert.equal(data.indices.length/3,25796); assert.equal(surfaces.length,13);
  const contact = auditCage({ vertices, indices: data.indices }, surfaces);
  const row = { frame: frame.frame, time: frame.time, self: contact.selfCount, body: contact.bodyCount,
    parts: Object.fromEntries([...new Set(contact.body.map(pair => pair.mesh))].map(name => [name, contact.body.filter(pair => pair.mesh === name).length])) };
  rows.push(row); console.log(JSON.stringify(row));
}
await writeFile(new URL(partial ? 'partial-contact-results.json' : 'contact-results.json', folder), JSON.stringify(rows,null,2));
assert.ok(rows.every(row => row.self === 0 && row.body === 0), 'complete display garment still intersects');
