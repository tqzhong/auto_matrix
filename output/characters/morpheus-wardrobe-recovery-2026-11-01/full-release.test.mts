import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { AMBUSH_DOFF } from '@auto_matrix/shared';

const base = new URL('./', import.meta.url);
const folder = process.env.MORPHEUS_CAGE_RESULT ?? 'full-removal-physics';
const input = process.env.MORPHEUS_BODY_INPUT ?? 'full-removal-input';
const json = async (file: string) => JSON.parse(await readFile(new URL(file, base), 'utf8'));
const data = await json(`${input}/manifest.json`);
const controls = await json('boundary-controls.json');
const metadata = await json(`${folder}/metadata.json`);
const summary = await json(`${folder}/summary.json`);

test('the complete cuffs release only after the measured hand passage and remain released through recovery', () => {
  assert.equal(metadata.frames, data.frames.length);
  assert.equal(data.frames.at(-1).time, AMBUSH_DOFF.duration);
  assert.equal(metadata.cuffReleaseFrame, 29);
  assert.equal(summary.length, data.frames.length);
  for (const row of summary) assert.deepEqual(row.pinWeights.cuffs, row.frame < 29 ? [1, 1] : [0, 0], `cuff weights at ${row.time}`);
});

test('the actual displayed cuff leaves the imposed hand path after release', async () => {
  const frame = metadata.frames;
  const bytes = await readFile(new URL(`${folder}/cloth-${frame}.bin`, base));
  const points = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  assert.equal(points.length, data.points.length * 3);
  let maximum = 0;
  for (const cuff of controls.cuffs) {
    const path = data.frames[frame - 1].cuffs.find((value: { side: string }) => value.side === cuff.side);
    const matrix = new THREE.Matrix4().fromArray(path.matrix);
    for (const id of cuff.ring) {
      const expected = new THREE.Vector3(...data.points[id]).applyMatrix4(matrix);
      const actual = new THREE.Vector3(points[id * 3] / .4, points[id * 3 + 2] / .4, -points[id * 3 + 1] / .4);
      maximum = Math.max(maximum, actual.distanceTo(expected) * .4);
    }
  }
  assert.ok(maximum > .001, `the displayed cuff still follows the imposed path within ${maximum} metres`);
});
