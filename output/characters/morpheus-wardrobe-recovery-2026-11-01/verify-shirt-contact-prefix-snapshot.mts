import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { makeModel, meshSurface } from '../morpheus-ambush-doff-2026-10-17/grip-fixture.mjs';
import { auditCage } from '../morpheus-ambush-doff-2026-10-17/cloth-rebuild/cage-contact.mjs';
import { FrontExitBody } from './FrontExitBody.mjs';

const base = new URL('./', import.meta.url), input = new URL('shirt-contact-input/', base), cache = new URL('shirt-contact-path/', base);
const manifest = JSON.parse(await readFile(new URL('manifest.json', input), 'utf8'));
const metadata = JSON.parse(await readFile(new URL('metadata.json', cache), 'utf8'));
const reportBytes = await readFile(new URL('report.json', cache));
const reports = JSON.parse(reportBytes.toString());
const mapping: number[] = JSON.parse(await readFile(new URL('source-to-weld.json', cache), 'utf8'));
const prefix = process.argv.includes('--prefix');
const requested = Number(process.argv.find(arg => arg.startsWith('--frame='))?.split('=')[1]);
if (!prefix && !requested) assert.equal(reports.at(-1).frame, manifest.frames.length, 'A partial cache cannot pass the complete eight-second gate.');
for (const [file, hash] of Object.entries({ ...manifest.sourceHashes, ...metadata.sourceHashes })) {
  assert.equal(createHash('sha256').update(await readFile(new URL(file, base))).digest('hex'), hash, file);
}
assert.equal(mapping.length, manifest.shirt.count);
assert.equal(metadata.shirtFaces, manifest.shirt.indices.length / 3);
assert.equal(metadata.otherLayers.length, 12);
const readPoints = async (url: URL) => {
  const bytes = await readFile(url);
  return new Float64Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
};
const first = await readPoints(new URL('cloth-1.bin', cache));
assert.equal(first.length, metadata.weldedShirtVertices * 3);
const h = await makeModel(), body = new FrontExitBody(h.rig, 'front-exit');
const shirt = h.rig.root.getObjectByName(manifest.shirt.name) as THREE.Mesh;
const outer = [h.rig.root.getObjectByName('morpheus-ambush-coat'), h.rig.root.getObjectByName('morpheus-ambush-lapels'), ...h.rig.panels.map(panel => panel.mesh)];
const others: THREE.Mesh[] = [];
h.rig.root.traverseVisible(object => { if (object instanceof THREE.Mesh && object !== shirt && !outer.includes(object)) others.push(object); });
assert.equal(others.length, 12);
for (const [i, mesh] of [shirt, ...others].entries()) {
  const original = i ? manifest.bodies[i - 1] : manifest.shirt;
  assert.equal(mesh.name, original.name);
  assert.equal(mesh.geometry.attributes.position.count, original.count);
  assert.deepEqual(Array.from(mesh.geometry.index!.array), original.indices);
}
const geometry = shirt.geometry.clone();
const displayed = new THREE.Mesh(geometry, shirt.material);
const rows = [];
let previous = first, previousTime = 0;
function inspect(points: Float64Array, time: number, frame: number, kind: string) {
  body.pose(time);
  const positions = geometry.attributes.position;
  for (let id = 0; id < positions.count; id++) {
    const offset = mapping[id] * 3;
    positions.setXYZ(id, points[offset] / .4, points[offset + 2] / .4, -points[offset + 1] / .4);
  }
  positions.needsUpdate = true;
  // Float32 display coordinates and the actual nonlinear bone pose are
  // checked independently of IPC's welded Float64, linearly moving colliders.
  const actual = meshSurface(displayed), raw = meshSurface(shirt), inner = others.map(mesh => meshSurface(mesh));
  const audit = auditCage(actual, inner);
  let maximumCorrection = 0;
  for (let id = 0; id < actual.vertices.length; id++) maximumCorrection = Math.max(maximumCorrection,
    Math.hypot(...actual.vertices[id].map((value, axis) => value - raw.vertices[id][axis])) * .4);
  const row = { frame, time, kind, self: audit.selfCount, body: audit.bodyCount, maximumCorrectionMetres: maximumCorrection,
    selfPairs: audit.self.slice(0, 5), bodyPairs: audit.body.slice(0, 5) };
  rows.push(row); console.log(JSON.stringify(row));
}
try {
  if (!requested) inspect(first, 0, 1, 'initial');
  for (const record of reports) {
    const beforeTime = manifest.frames[record.frame - 2].time;
    for (const key of record.keys) {
      const current = await readPoints(new URL(key.file, cache));
      assert.equal(current.length, first.length);
      assert.ok(current.every(Number.isFinite));
      const time = beforeTime + key.fraction / 60;
      if (!requested || requested === record.frame) {
        inspect(Float64Array.from(current, (value, i) => (value + previous[i]) / 2), (time + previousTime) / 2, record.frame, 'midpoint');
        inspect(current, time, record.frame, 'key');
      }
      previous = current; previousTime = time;
    }
  }
  assert.ok(rows.length > 0, 'Requested cache frame is missing.');
  const result = {
    reportSha256: createHash('sha256').update(reportBytes).digest('hex'),
    verifierSha256: createHash('sha256').update(await readFile(new URL('verify-shirt-contact.mts', base))).digest('hex'),
    inputSourceHashes: manifest.sourceHashes, cacheSourceHashes: metadata.sourceHashes,
    availableThroughFrame: reports.at(-1).frame, availableThroughSeconds: reports.at(-1).time,
    wholeEightSecondsPresent: reports.at(-1).frame === manifest.frames.length,
    completeDisplayedFaces: geometry.index!.count / 3, completeDisplayedVertices: geometry.attributes.position.count,
    otherLayers: others.length, samples: rows.length,
    passed: rows.every(row => row.self === 0 && row.body === 0), acceptedForProduction: false,
    scope: 'Independent Float32 full-shirt samples against all twelve actual posed inner layers, including cache-key midpoints. This does not prove all nonlinear runtime intervals or cloth-material quality.', rows,
  };
  await writeFile(new URL(requested ? `shirt-contact-frame-${requested}-verification.json` : 'shirt-contact-display-verification.json', base), JSON.stringify(result, null, 2));
  assert.ok(result.passed, 'The actual displayed shirt crosses itself or another actual inner layer.');
} finally { geometry.dispose(); h.models.dispose(); }
