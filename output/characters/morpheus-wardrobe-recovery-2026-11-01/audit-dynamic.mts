import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { auditCage } from '../morpheus-ambush-doff-2026-10-17/cloth-rebuild/cage-contact.mjs';

const base = new URL('./', import.meta.url);
const data = JSON.parse(await readFile(new URL('current-input/manifest.json', base), 'utf8'));
const metadata = JSON.parse(await readFile(new URL('sewn-cage-verified-physics/metadata.json', base), 'utf8'));
const points = async (file: string) => {
  const bytes = await readFile(new URL(file, base));
  const values = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  return Array.from({ length: values.length / 3 }, (_, i) => [values[i * 3] / .4, values[i * 3 + 2] / .4, -values[i * 3 + 1] / .4]);
};
const results = [];
for (const frame of [1, 10, 16, 25]) {
  const inner = await points(`current-input/body-${frame}.bin`);
  let offset = 0;
  const bodies = data.bodies.map((part: { name: string; count: number; indices: number[] }) => {
    const vertices = inner.slice(offset, offset + part.count); offset += part.count;
    return { name: part.name, indices: part.indices, vertices };
  });
  assert.equal(bodies.length, 13);
  const vertices = await points(`sewn-cage-verified-physics/cloth-${frame}.bin`);
  assert.equal(vertices.length, data.points.length);
  const audit = auditCage({ vertices, indices: data.indices }, bodies);
  const result = { frame, time: data.frames[frame - 1].time, self: audit.selfCount, body: audit.bodyCount,
    minimumFloorHeightMetres: Math.min(...vertices.map(point => point[1] * .4)) - metadata.floorZ,
    selfPairs: audit.self.sort((a, b) => b.line - a.line).slice(0, 12),
    bodyPairs: audit.body.sort((a, b) => b.line - a.line).slice(0, 12) };
  results.push(result); console.log(JSON.stringify(result));
}
await writeFile(new URL('dynamic-surface-audit.json', base), JSON.stringify(results, null, 2));
assert.ok(results.every(result => result.self === 0 && result.body === 0 && result.minimumFloorHeightMetres >= 0),
  'The complete displayed garment still intersects itself, its actual visible inner layers or the ground.');
