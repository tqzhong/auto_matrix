import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { AMBUSH_DOFF } from '@auto_matrix/shared';
import { makeModel } from '../morpheus-ambush-doff-2026-10-17/grip-fixture.mjs';

const base = new URL('./', import.meta.url);
const folder = process.env.MORPHEUS_CAGE_RESULT ?? 'full-removal-physics';
const input = process.env.MORPHEUS_BODY_INPUT ?? 'full-removal-input';
const json = async (file: string) => JSON.parse(await readFile(new URL(file, base), 'utf8'));
const data = await json(`${input}/manifest.json`);
const metadata = await json(`${folder}/metadata.json`);
const last = data.frames.at(-1);
assert.equal(last.time, AMBUSH_DOFF.duration);
assert.equal(metadata.frames, data.frames.length);
assert.equal(metadata.displayVertices, data.points.length);
assert.equal(metadata.displayFaces, data.indices.length / 3);
assert.equal(metadata.sourceHashes[`${input}/manifest.json`], createHash('sha256').update(await readFile(new URL(`${input}/manifest.json`, base))).digest('hex'));
const floats = async (file: string) => {
  const bytes = await readFile(new URL(file, base));
  return new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
};
const coat = await floats(`${folder}/cloth-${last.frame}.bin`);
assert.equal(coat.length, data.points.length * 3);
assert.ok(coat.every(Number.isFinite));
const heights = Array.from({ length: coat.length / 3 }, (_, i) => coat[i * 3 + 2]);

test('the complete displayed coat reaches the floor by the end of removal', () => {
  const clearance = Math.min(...heights) - metadata.floorZ;
  assert.ok(clearance >= -1e-5, `the displayed coat crosses the floor by ${-clearance} metres`);
  assert.ok(clearance < .001, `the complete coat still hangs ${clearance} metres above the floor`);
});

test('the placed coat clears both recovered hands and the upper body', async t => {
  const h = await makeModel(); t.after(() => h.models.dispose());
  const skin = h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  const { skinIndex, skinWeight } = skin.geometry.attributes;
  const body = await floats(`${input}/body-${last.frame}.bin`);
  let offset = 0;
  for (const part of data.bodies) { if (part.name === skin.name) break; offset += part.count; }
  let lowestHand = Infinity;
  for (let i = 0; i < skinIndex.count; i++) {
    if ([0, 1, 2, 3].some(k => skinWeight.getComponent(i, k) > .01
      && /^(wrist|finger)/.test(skin.skeleton.bones[skinIndex.getComponent(i, k)].name)))
      lowestHand = Math.min(lowestHand, body[(offset + i) * 3 + 2]);
  }
  assert.ok(Number.isFinite(lowestHand));
  const highestCoat = Math.max(...heights);
  assert.ok(highestCoat < lowestHand, `the coat still reaches ${highestCoat} metres while the recovered hands begin at ${lowestHand}`);
});
