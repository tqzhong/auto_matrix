import { readFile, writeFile } from 'node:fs/promises';
import { auditCage } from '../morpheus-ambush-doff-2026-10-17/cloth-rebuild/cage-contact.mjs';

const base = new URL('./', import.meta.url);
const data = JSON.parse(await readFile(new URL('preparation-input/manifest.json', base), 'utf8'));
const cage = JSON.parse(await readFile(new URL('front-standing-work/boundary-cage-fit-4.json', base), 'utf8'));
async function points(name: string, frame: number) {
  const bytes = await readFile(new URL(`preparation-physics/${name}-${frame}.bin`, base));
  const array = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  return Array.from({ length: array.length / 3 }, (_, i) => [array[i * 3] / .4, array[i * 3 + 2] / .4, -array[i * 3 + 1] / .4]);
}
const rows = [];
for (const frame of [1, 2, 3, 4, 13, 49]) {
  const all = await points('body', frame); let offset = 0;
  const inner = data.bodies.map((part: { name: string; count: number; indices: number[] }) => {
    const surface = { name: part.name, vertices: all.slice(offset, offset + part.count), indices: part.indices };
    offset += part.count; return surface;
  });
  const physical = auditCage({ vertices: await points('cage', frame), indices: cage.indices }, inner);
  const display = auditCage({ vertices: await points('cloth', frame), indices: data.indices }, inner);
  const row = { frame, time: data.frames[frame - 1].time, physical: { self: physical.selfCount, body: physical.bodyCount },
    display: { self: display.selfCount, body: display.bodyCount },
    physicalPairs: physical.body.slice(0, 5), displayPairs: display.body.slice(0, 5) };
  rows.push(row); console.log(JSON.stringify(row));
}
await writeFile(new URL('preparation-cage-diagnosis.json', base), JSON.stringify(rows, null, 2));
