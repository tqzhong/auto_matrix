import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { auditCage } from '../morpheus-ambush-doff-2026-10-17/cloth-rebuild/cage-contact.mjs';

const base = new URL('./', import.meta.url), output = new URL('runtime-meshes/', base);
await mkdir(output, { recursive: true });
const input = process.argv[3] ?? 'release-input';
const data = JSON.parse(await readFile(new URL(`${input}/manifest.json`, base), 'utf8'));
const folder = process.argv[2] ?? 'release-self-05';
const folderLabel = process.argv[4] ?? folder.split('/').filter(Boolean).at(-1)!;
const values = async (name: string) => {
  const bytes = await readFile(new URL(`${folder}/${name}`, base));
  const a = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  return Array.from({ length: a.length / 3 }, (_, i) => [a[3*i] / .4, a[3*i+2] / .4, -a[3*i+1] / .4]);
};
const rows = [];
const frames = process.env.MORPHEUS_CLOTH_FULL ? [1, 10, 16, 25, 40, 55, 73] : [1, 10, 16, 25];
for (const frame of frames) {
  const vertices = await values(`cloth-${frame}.bin`), bodies = await values(`body-${frame}.bin`);
  let offset = 0;
  const surfaces = data.bodyInitial.map((part: { name: string; vertices: number[][] }) => {
    const actual = { ...part, vertices: bodies.slice(offset, offset + part.vertices.length),
      color: /Anatomical/.test(part.name) ? [.55,.33,.2] : [.05,.18,.36], side: 2 };
    offset += part.vertices.length; return actual;
  });
  const result = auditCage({ vertices, indices: data.indices }, surfaces);
  const contacts: Record<string, { count: number; x: number; y: number; z: number }> = {};
  for (const pair of result.body) {
    const key = pair.mesh ?? '(unnamed)', row = contacts[key] ??= { count: 0, x: 0, y: 0, z: 0 };
    row.count++;
    for (const id of data.indices.slice(pair.envelope * 3, pair.envelope * 3 + 3)) {
      row.x += vertices[id][0] / 3; row.y += vertices[id][1] / 3; row.z += vertices[id][2] / 3;
    }
  }
  for (const row of Object.values(contacts)) { row.x /= row.count; row.y /= row.count; row.z /= row.count; }
  rows.push({ frame, time: data.frames[frame - 1].time, self: result.selfCount, body: result.bodyCount, contacts });
  for (const [i, part] of data.parts.entries()) surfaces.push({ ...data.surfaces[i],
    vertices: part.vertices.map((id: number) => vertices[id]), color: [.19,.28,.11], side: 2 });
  const hitFaces = result.body.flatMap(pair => data.indices.slice(pair.envelope * 3, pair.envelope * 3 + 3));
  if (hitFaces.length) surfaces.push({ name: 'actual intersecting coat faces', vertices, indices: hitFaces,
    texcoords: vertices.map(() => [0,0]), color: [.65,.04,.025], side: 2, texture: null, face: null, vertexColors: null });
  for (const [view, eye] of [['front', [5,3.6,8]], ['rear', [-5,3.6,-8]]] as const) {
    const label = `sleeve-${folderLabel}-${frame}-${view}`;
    await writeFile(new URL(`${label}.json`, output), JSON.stringify({ width: 720, height: 900, eye,
      target: [0,process.env.MORPHEUS_CLOTH_FULL ? 2.2 : 2.7,0], fov: process.env.MORPHEUS_CLOTH_FULL ? 34 : 29,
      surfaces, renderSource: 'COMPLETE COAT + ACTUAL BODY / CONTACT DIAGNOSIS' }));
  }
}
await writeFile(new URL(`${folder}-contact-regions.json`, base), JSON.stringify(rows, null, 2));
console.log(JSON.stringify(rows));
