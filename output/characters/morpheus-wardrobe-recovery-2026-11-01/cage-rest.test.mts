import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { auditCage } from '../morpheus-ambush-doff-2026-10-17/cloth-rebuild/cage-contact.mjs';

const base = new URL('./', import.meta.url);
const json = async (file: string) => JSON.parse(await readFile(new URL(file, base), 'utf8'));
const data = await json('current-input/manifest.json');
const cage = await json('boundary-cage-fit-4.json');
const controls = await json('boundary-controls.json');

test('the current physical garment starts clear of all thirteen actual inner layers', () => {
  assert.equal(data.points.length, 13960);
  assert.equal(data.indices.length / 3, 26916);
  assert.equal(data.bodyInitial.length, 13);
  const result = auditCage({ vertices: cage.points, indices: cage.indices }, data.bodyInitial);
  assert.equal(result.selfCount, 0);
  assert.equal(result.bodyCount, 0);
});

test('both complete cuffs and the authored neckline retain their actual positions', () => {
  const expected = [...new Set([...controls.neck, ...controls.cuffs.flatMap((cuff: { ring: number[] }) => cuff.ring)])];
  assert.equal(controls.neck.length, 67);
  assert.deepEqual(controls.cuffs.map((cuff: { ring: number[] }) => cuff.ring.length), [61, 61]);
  assert.equal(expected.length, 189);
  assert.equal(Object.keys(cage.mappedControls).length, expected.length);
  for (const original of expected) {
    const mapped = cage.mappedControls[String(original)];
    assert.ok(Number.isInteger(mapped));
    const error = new THREE.Vector3(...data.points[original]).distanceTo(new THREE.Vector3(...cage.points[mapped])) * .4;
    assert.ok(error < .000001, `the physical control ${original} moved ${error} metres`);
  }
});

test('the actual bound full display retains a clear starting surface', async () => {
  const calibration = await json('sewn-cage-fall-normalized-material.json');
  for (const [file, expected] of Object.entries(calibration.sourceHashes)) {
    const source = await readFile(new URL(file, base));
    assert.equal(createHash('sha256').update(source).digest('hex'), expected, `rerun the native binding after changing ${file}`);
  }
  const bytes = await readFile(new URL('sewn-cage-bound-rest.bin', base));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), calibration.restSurfaceSha256);
  const points = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  assert.equal(points.length, data.points.length * 3);
  const vertices = Array.from({ length: data.points.length }, (_, i) => [points[i * 3] / .4, points[i * 3 + 2] / .4, -points[i * 3 + 1] / .4]);
  const result = auditCage({ vertices, indices: data.indices }, data.bodyInitial);
  assert.equal(result.selfCount, 0);
  assert.equal(result.bodyCount, 0);
});
