import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { auditCage } from '../morpheus-ambush-doff-2026-10-17/cloth-rebuild/cage-contact.mjs';

const base = new URL('./', import.meta.url), work = new URL('front-standing-work/', base);
const name = process.argv[2] ?? 'boundary-cage-rest';
const json = async (file: string) => JSON.parse(await readFile(new URL(file, work), 'utf8'));
const data = await json('current-input/manifest.json'), cage = await json(`${name}.json`), controls = await json('boundary-controls.json');
assert.equal(data.frames[0].time, 0);
assert.equal(data.indices.length / 3, 26916);
assert.equal(data.bodyInitial.length, 13);
assert.equal(controls.protected.length, 189);
for (const source of controls.protected) {
  const id = cage.mappedControls[String(source)];
  assert.ok(Number.isInteger(id));
  const error = new THREE.Vector3(...cage.points[id]).distanceTo(new THREE.Vector3(...data.points[source])) * .4;
  assert.ok(error < 1e-6, `original complete boundary point moved ${error} metres`);
}
const audit = auditCage({ vertices: cage.points, indices: cage.indices }, data.bodyInitial);
await writeFile(new URL(`${name}-contacts.json`, work), JSON.stringify(audit));
const receipt = { name, vertices: cage.points.length, faces: cage.indices.length / 3,
  protectedBoundaryPoints: controls.protected.length, actualInnerLayers: data.bodyInitial.length,
  self: audit.selfCount, body: audit.bodyCount, acceptedForProduction: false,
  sourceHashes: Object.fromEntries(await Promise.all(['current-input/manifest.json', `${name}.json`, 'boundary-controls.json'].map(async file =>
    [file, createHash('sha256').update(await readFile(new URL(file, work))).digest('hex')]))),
  scope: 'Initial standing physical cage and thirteen actual visible inner layers; display binding, dynamics and removal remain unaccepted.' };
await writeFile(new URL(`front-standing-${name}-verification.json`, base), JSON.stringify(receipt, null, 2));
console.log(JSON.stringify(receipt));
assert.equal(audit.selfCount, 0); assert.equal(audit.bodyCount, 0);
