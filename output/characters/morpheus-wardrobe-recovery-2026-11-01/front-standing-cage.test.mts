import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { auditCage } from '../morpheus-ambush-doff-2026-10-17/cloth-rebuild/cage-contact.mjs';

const base = new URL('./', import.meta.url), work = new URL('front-standing-work/', base);
const json = async (file: string) => JSON.parse(await readFile(new URL(file, work), 'utf8'));
const data = await json('current-input/manifest.json'), cage = await json('boundary-cage-fit-4.json'), controls = await json('boundary-controls.json');
const native = JSON.parse(await readFile(new URL('front-standing-native-verification.json', base), 'utf8'));

test('the standing physical garment retains complete cuff and collar controls and clears all thirteen inner layers', () => {
  assert.equal(data.frames[0].time, 0);
  assert.equal(data.indices.length / 3, 26916);
  assert.equal(data.bodyInitial.length, 13);
  assert.equal(controls.protected.length, 189);
  for (const source of controls.protected) {
    const id = cage.mappedControls[String(source)];
    assert.ok(Number.isInteger(id));
    assert.ok(new THREE.Vector3(...cage.points[id]).distanceTo(new THREE.Vector3(...data.points[source])) * .4 < 1e-6);
  }
  const audit = auditCage({ vertices: cage.points, indices: cage.indices }, data.bodyInitial);
  assert.equal(audit.selfCount, 0); assert.equal(audit.bodyCount, 0);
});

test('the native bound standing garment retains every displayed face without entering the actual inner layers', async () => {
  for (const [file, hash] of Object.entries(native.sourceHashes))
    assert.equal(createHash('sha256').update(await readFile(new URL(file, base))).digest('hex'), hash, file);
  const bytes = await readFile(new URL('sewn-cage-bound-rest.bin', work));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), native.restSurfaceSha256);
  const points = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  assert.equal(points.length, data.points.length * 3);
  assert.equal(native.faces, data.indices.length / 3);
  const vertices = data.points.map((_: number[], i: number) => [points[i * 3] / .4, points[i * 3 + 2] / .4, -points[i * 3 + 1] / .4]);
  const audit = auditCage({ vertices, indices: data.indices }, data.bodyInitial);
  assert.equal(audit.selfCount, 0); assert.equal(audit.bodyCount, 0);
});

test('the released whole standing garment falls with converged native solves instead of remaining suspended', () => {
  assert.equal(native.rows.length, 10);
  assert.equal(native.rows.at(-1).time, .3);
  assert.ok(native.rows[0].maximumDriftMetres < .00001);
  assert.ok(native.rows.at(-1).centreDropMetres > .2 && native.rows.at(-1).centreDropMetres < .5);
  assert.ok(native.rows.at(-1).maximumRelativeDriftMetres < .001);
  assert.ok(native.rows.slice(1).every((row: { solverStatus: string[] }) => row.solverStatus.length === 1 && row.solverStatus[0] === 'SUCCESS'));
  assert.equal(native.acceptedForProduction, false, 'a free-fall control cannot accept the removal');
});
