import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { auditCage } from '../morpheus-ambush-doff-2026-10-17/cloth-rebuild/cage-contact.mjs';

const base = new URL('./', import.meta.url);
const result = new URL(`${process.argv[2] ?? 'free-garment-physics'}/`, base);
const input = new URL(`${process.argv[3] ?? 'independent-cuff-input'}/`, base);
const data = JSON.parse(await readFile(new URL('manifest.json', input), 'utf8'));
const cage = JSON.parse(await readFile(new URL('../morpheus-shoulder-release-2026-10-20/cage-fit-4.json', base), 'utf8'));
const points = async (file: string) => {
  const bytes = await readFile(new URL(file, result));
  const values = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset+bytes.byteLength));
  return Array.from({ length: values.length/3 }, (_, i) => [values[3*i]/.4, values[3*i+2]/.4, -values[3*i+1]/.4]);
};
const names = ['coat','lapels','tail-1','tail-2'], rows = [];
for (const frame of [10,25,40,55,73]) {
  const body = await points(`body-${frame}.bin`); let offset = 0;
  const bodies = data.bodies.map((part: { name: string; count: number; indices: number[] }) => {
    const vertices = body.slice(offset,offset+part.count); offset += part.count;
    return { name: part.name, vertices, indices: part.indices };
  });
  assert.equal(offset, body.length); assert.equal(bodies.length, 13);
  for (const [name,source,count] of [['cage',cage,5534],['cloth',data,25796]] as const) {
    const vertices = await points(`${name}-${frame}.bin`);
    assert.equal(vertices.length, source.points.length);
    assert.equal(source.indices.length/3, count);
    const owner = new Map<number,number>();
    source.parts.forEach((part: { vertices: number[] }, index: number) => part.vertices.forEach(id => owner.set(id,index)));
    const part = (face: number) => names[owner.get(source.indices[face*3])!];
    const contacts = auditCage({ vertices, indices: source.indices }, bodies), pairs: Record<string,number> = {};
    for (const hit of contacts.self) {
      const key = [part(hit.face),part(hit.other)].sort().join('/'); pairs[key] = (pairs[key] ?? 0)+1;
    }
    rows.push({ frame, time: data.frames[frame-1].time, mesh: name, self: contacts.selfCount, body: contacts.bodyCount,
      pairs, maximumIntersectionSegmentMetres: Math.max(0,...contacts.self.map(hit => hit.line))*.4 });
  }
}
await writeFile(new URL('physical-display-contact.json', result), JSON.stringify(rows,null,2));
console.log(JSON.stringify(rows));
