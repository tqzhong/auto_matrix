import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { AMBUSH_DOFF } from '@auto_matrix/shared';
import { makeModel, worldPoints } from '../morpheus-ambush-doff-2026-10-17/grip-fixture.mjs';

const base = new URL('./', import.meta.url);
const full = new URL('full-removal-input/', base);
const data = JSON.parse(await readFile(new URL('manifest.json', full), 'utf8'));
const partial = JSON.parse(await readFile(new URL('current-input/manifest.json', base), 'utf8'));

test('the body input covers sleeve withdrawal and recovery through the saved removal duration', async () => {
  assert.equal(data.frames.length, Math.round((AMBUSH_DOFF.duration - .8) * 30) + 1);
  assert.equal(data.frames[0].time, .8);
  assert.equal(data.frames.at(-1).time, AMBUSH_DOFF.duration);
  assert.equal(data.bodies.length, 13);
  const count = data.bodies.reduce((sum: number, body: { count: number }) => sum + body.count, 0);
  for (const [i, frame] of data.frames.entries()) {
    assert.equal(frame.frame, i + 1);
    assert.ok(Math.abs(frame.time - (.8 + i / 30)) < 1e-12);
    assert.equal(frame.reachErrors.length, 2);
    assert.ok(frame.reachErrors.every((error: { distance: number }) => Number.isFinite(error.distance) && error.distance < 1e-6));
    const bytes = await readFile(new URL(`body-${frame.frame}.bin`, full));
    const points = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    assert.equal(points.length, count * 3);
    assert.ok(points.every(Number.isFinite), `invalid body sample at ${frame.time}`);
  }
});

test('extending the input preserves every existing body and cuff sample through 3.2 seconds', async () => {
  for (const key of ['points', 'indices', 'parts', 'bodies', 'bodyInitial', 'wristBase']) assert.deepEqual(data[key], partial[key], key);
  assert.deepEqual(data.frames.slice(0, partial.frames.length), partial.frames);
  for (const frame of partial.frames) {
    const actual = await readFile(new URL(`body-${frame.frame}.bin`, full));
    const expected = await readFile(new URL(`current-input/body-${frame.frame}.bin`, base));
    assert.ok(actual.equals(expected), `the existing body frame ${frame.frame} changed`);
  }
});

test('the final exported inner layers restore the actual original standing surfaces', async t => {
  const h = await makeModel(); t.after(() => h.models.dispose());
  const outer = ['morpheus-ambush-coat', 'morpheus-ambush-lapels'].map(name => h.rig.root.getObjectByName(name));
  outer.push(...h.rig.panels.map(panel => panel.mesh));
  const bodies: THREE.Mesh[] = [];
  h.rig.root.traverseVisible(object => { if (object instanceof THREE.Mesh && !outer.includes(object)) bodies.push(object); });
  assert.deepEqual(bodies.map(mesh => mesh.name), data.bodies.map((body: { name: string }) => body.name));
  const expected = new Float32Array(bodies.flatMap(mesh => worldPoints(mesh).flatMap(point => [.4 * point.x, -.4 * point.z, .4 * point.y])));
  const bytes = await readFile(new URL(`body-${data.frames.at(-1).frame}.bin`, full));
  const actual = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  assert.equal(actual.length, expected.length);
  let maximum = 0;
  for (let i = 0; i < actual.length; i++) maximum = Math.max(maximum, Math.abs(actual[i] - expected[i]));
  assert.ok(maximum < 1e-6, `the final standing surface differs by ${maximum} metres`);
});
