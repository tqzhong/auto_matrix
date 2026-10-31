import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { makeModel, meshSurface } from '../morpheus-ambush-doff-2026-10-17/grip-fixture.mjs';
import { auditCage } from '../morpheus-ambush-doff-2026-10-17/cloth-rebuild/cage-contact.mjs';
import { FrontExitBody } from './FrontExitBody.mjs';

const base = new URL('./', import.meta.url);
const cacheName = process.argv.find(arg => arg.startsWith('--cache='))?.slice(8) ?? 'preparation-physics';
const folder = new URL(`${cacheName}/`, base), label = cacheName === 'preparation-physics' ? 'preparation' : cacheName;
const data = JSON.parse(await readFile(new URL('preparation-input/manifest.json', base), 'utf8'));
const metadata = JSON.parse(await readFile(new URL('metadata.json', folder), 'utf8'));
const summary = JSON.parse(await readFile(new URL('summary.json', folder), 'utf8'));
if (!process.argv.includes('--prefix')) assert.equal(summary.length, 49, 'Require the whole preparation prefix.');
for (const [file, hash] of Object.entries({ ...data.sourceHashes, ...metadata.sourceHashes }))
  assert.equal(createHash('sha256').update(await readFile(new URL(file, base))).digest('hex'), hash, file);
const h = await makeModel(), body = new FrontExitBody(h.rig, 'front-exit');
const outer = ['morpheus-ambush-coat', 'morpheus-ambush-lapels'].map(name => h.rig.root.getObjectByName(name));
outer.push(...h.rig.panels.map(panel => panel.mesh));
const inner: THREE.Mesh[] = [];
h.rig.root.traverseVisible(object => { if (object instanceof THREE.Mesh && !outer.includes(object)) inner.push(object); });
assert.equal(inner.length, 13);
for (const [i, mesh] of inner.entries()) {
  assert.equal(mesh.name, data.bodies[i].name);
  assert.equal(mesh.geometry.attributes.position.count, data.bodies[i].count);
  assert.deepEqual(Array.from(mesh.geometry.index!.array), data.bodies[i].indices);
}
const rows = [];
function inspect(points: Float32Array, time: number, frame: number, kind: string) {
  body.pose(time);
  const vertices: number[][] = [], indices: number[] = [];
  for (const [part, surface] of data.surfaces.entries()) {
    const offset = vertices.length;
    indices.push(...surface.indices.map((id: number) => id + offset));
    for (const id of data.parts[part].vertices) {
      const point = new Float32Array([points[id * 3] / .4, points[id * 3 + 2] / .4, -points[id * 3 + 1] / .4]);
      vertices.push(Array.from(point));
    }
  }
  assert.equal(indices.length / 3, 26916);
  const audit = auditCage({ vertices, indices }, inner.map(mesh => meshSurface(mesh)));
  const row = { frame, time, kind, vertices: vertices.length, faces: indices.length / 3, self: audit.selfCount,
    body: audit.bodyCount, selfPairs: audit.self.slice(0, 5), bodyPairs: audit.body.slice(0, 5) };
  rows.push(row); console.log(JSON.stringify(row));
}
let previous: Float32Array | undefined;
try {
  for (const row of summary) {
    const bytes = await readFile(new URL(`cloth-${row.frame}.bin`, folder));
    const current = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    assert.equal(current.length, data.points.length * 3);
    assert.ok(current.every(Number.isFinite));
    if (previous) inspect(Float32Array.from(current, (value, i) => (value + previous![i]) / 2), row.time - 1/120, row.frame, 'midpoint');
    inspect(current, row.time, row.frame, 'key'); previous = current;
  }
  const result = { allFramesPresent: summary.length === 49, inspectedThroughFrame: summary.at(-1).frame,
    geometryPassed: rows.every(row => row.self === 0 && row.body === 0),
    nativeConverged: summary.slice(1).every((row: { solverStatus: string[] }) => row.solverStatus.length === 1 && row.solverStatus[0] === 'SUCCESS'),
    boundariesRetained: summary.every((row: { boundaryErrorMetres: number }) => row.boundaryErrorMetres < .0001),
    acceptedForProduction: false, sourceHashes: metadata.sourceHashes, inputHashes: data.sourceHashes, cacheDirectory: cacheName,
    verifierSha256: createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex'),
    scope: 'Every original visible garment face, expanded through original part/UV indices, checked at native keys and actual bone-curve midpoints. This finite preparation prefix does not prove all intervals or the eight-second removal.', rows };
  await writeFile(new URL(`${label}-display-verification.json`, base), JSON.stringify(result, null, 2));
  assert.ok(result.geometryPassed && result.nativeConverged && result.boundariesRetained, 'The preparation garment is rejected.');
} finally { h.models.dispose(); }
