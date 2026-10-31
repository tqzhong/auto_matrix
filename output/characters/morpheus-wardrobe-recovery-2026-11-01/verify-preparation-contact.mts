import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { makeModel, meshSurface } from '../morpheus-ambush-doff-2026-10-17/grip-fixture.mjs';
import { auditCage } from '../morpheus-ambush-doff-2026-10-17/cloth-rebuild/cage-contact.mjs';
import { FrontExitBody } from './FrontExitBody.mjs';

const base = new URL('./', import.meta.url), folder = new URL('preparation-full-physics-contact/', base);
const data = JSON.parse(await readFile(new URL('preparation-input/manifest.json', base), 'utf8'));
const metadata = JSON.parse(await readFile(new URL('metadata.json', folder), 'utf8'));
const controls = JSON.parse(await readFile(new URL('boundary-controls.json', base), 'utf8'));
const native = JSON.parse(await readFile(new URL(`${metadata.nativeGuide}/metadata.json`, base), 'utf8'));
const reportBytes = await readFile(new URL('report.json', folder));
const reports = JSON.parse(reportBytes.toString());
if (!process.argv.includes('--prefix')) assert.equal(reports.at(-1).frame, 49, 'An incomplete contact prefix cannot pass.');
for (const [file, hash] of Object.entries({ ...data.sourceHashes, ...native.sourceHashes, ...metadata.sourceHashes }))
  assert.equal(createHash('sha256').update(await readFile(new URL(file, base))).digest('hex'), hash, file);
const readPoints = async (url: URL) => {
  const bytes = await readFile(url);
  return new Float64Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
};
const readGuide = async (frame: number) => {
  const bytes = await readFile(new URL(`${metadata.nativeGuide}/cloth-${frame}.bin`, base));
  return new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
};
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
function inspect(points: Float64Array, time: number, frame: number, kind: string) {
  body.pose(time);
  const vertices: number[][] = [], indices: number[] = [];
  for (const [part, surface] of data.surfaces.entries()) {
    const offset = vertices.length;
    indices.push(...surface.indices.map((id: number) => id + offset));
    for (const id of data.parts[part].vertices)
      vertices.push(Array.from(new Float32Array([points[id * 3] / .4, points[id * 3 + 2] / .4, -points[id * 3 + 1] / .4])));
  }
  assert.equal(indices.length / 3, 26916);
  const audit = auditCage({ vertices, indices }, inner.map(mesh => meshSurface(mesh)));
  const row = { frame, time, kind, vertices: vertices.length, faces: indices.length / 3,
    self: audit.selfCount, body: audit.bodyCount, selfPairs: audit.self.slice(0, 5), bodyPairs: audit.body.slice(0, 5) };
  rows.push(row); console.log(JSON.stringify(row));
}
let previous = await readPoints(new URL('cloth-1.bin', folder)), previousTime = 0;
try {
  inspect(previous, 0, 1, 'initial');
  for (const record of reports) {
    const a = await readGuide(record.frame - 1), z = await readGuide(record.frame);
    for (const key of record.keys) {
      const current = await readPoints(new URL(key.file, folder));
      assert.equal(current.length, data.points.length * 3);
      assert.ok(current.every(Number.isFinite));
      for (const id of controls.protected) for (let axis = 0; axis < 3; axis++) {
        const k = id * 3 + axis, expected = a[k] + (z[k] - a[k]) * key.fraction;
        assert.ok(current[k] === expected, `boundary ${id} moved from its imposed guide`);
      }
      const time = data.frames[record.frame - 2].time + key.fraction / 60;
      inspect(Float64Array.from(current, (value, i) => (value + previous[i]) / 2), (time + previousTime) / 2, record.frame, 'midpoint');
      inspect(current, time, record.frame, 'key'); previous = current; previousTime = time;
    }
  }
  const result = { wholePreparationPresent: reports.at(-1).frame === 49, inspectedThroughFrame: reports.at(-1).frame,
    geometryPassed: rows.every(row => row.self === 0 && row.body === 0), samples: rows.length,
    originalBoundariesRetained: true, nativeGuideConverged: metadata.nativeGuideConverged, energyEquilibriumProven: false,
    acceptedForProduction: false, reportSha256: createHash('sha256').update(reportBytes).digest('hex'),
    verifierSha256: createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex'),
    sourceHashes: metadata.sourceHashes, inputHashes: data.sourceHashes,
    scope: 'Independent Float32 display expansion with all original UV vertices/faces, thirteen actual inner layers and actual bone-curve midpoints. This is a finite preparation geometry check; the rejected native guide is not accepted by it.', rows };
  await writeFile(new URL('preparation-contact-display-verification.json', base), JSON.stringify(result, null, 2));
  assert.ok(result.geometryPassed, 'The actual preparation display still intersects.');
} finally { h.models.dispose(); }
