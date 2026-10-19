import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { auditCage } from '../morpheus-ambush-doff-2026-10-17/cloth-rebuild/cage-contact.mjs';

const base = new URL('./', import.meta.url);
const result = process.env.MORPHEUS_CAGE_RESULT ?? 'cage-fitted-physics';
const json = async (file: string) => JSON.parse(await readFile(new URL(file, base), 'utf8'));
const data = await json('../morpheus-withdrawal-path-2026-10-20/clearance-input/manifest.json');
const cage = await json('cage-fit-4.json'), guide = await json('collar-guide.json');
const { cuffs } = await json('shoulder-physics/metadata.json');
const points = async (file: string) => {
  const bytes = await readFile(new URL(file, base));
  const a = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  return Array.from({ length: a.length / 3 }, (_, i) => new THREE.Vector3(a[3*i] / .4, a[3*i+2] / .4, -a[3*i+1] / .4));
};

test('the fitted physical surface clears every actual body layer and retains all original controls', () => {
  const result = auditCage({ vertices: cage.points, indices: cage.indices }, data.bodyInitial);
  assert.equal(data.bodyInitial.length, 13);
  assert.equal(result.bodyCount, 0);
  assert.equal(result.selfCount, 0);
  assert.equal(Object.keys(cage.mappedControls).length, 189);
  for (const [source, target] of Object.entries(cage.mappedControls)) {
    const distance = new THREE.Vector3(...data.points[Number(source)]).distanceTo(new THREE.Vector3(...cage.points[target as number]));
    assert.ok(distance * .4 < 1e-6, `moved original boundary point ${source}: ${distance * .4} m`);
  }
});

test('the detailed cloth binding keeps both complete cuffs and the neckline on their validated paths', async () => {
  let maximumCuff = 0, maximumCollar = 0;
  for (let frame = 1; frame <= 25; frame++) {
    const displayed = await points(`${result}/cloth-${frame}.bin`);
    assert.equal(displayed.length, data.points.length);
    for (const cuff of cuffs) {
      assert.equal(cuff.ring.length, 61);
      const path = data.frames[frame-1].cuffs.find((item: { side: string }) => item.side === cuff.side);
      const matrix = new THREE.Matrix4().fromArray(path.matrix);
      for (const id of cuff.ring) {
        const expected = new THREE.Vector3(...data.points[id]).applyMatrix4(matrix);
        maximumCuff = Math.max(maximumCuff, expected.distanceTo(displayed[id]) * .4);
      }
    }
    for (let i = 0; i < guide.ids.length; i++) {
      const expected = new THREE.Vector3(...guide.frames[frame-1].points[i]);
      maximumCollar = Math.max(maximumCollar, expected.distanceTo(displayed[guide.ids[i]]) * .4);
    }
  }
  console.log(JSON.stringify({ maximumCuffMetres: maximumCuff, maximumCollarMetres: maximumCollar }));
  assert.ok(maximumCuff < .0001, `display binding changed the validated cuff route by ${maximumCuff} m`);
  assert.ok(maximumCollar < .0001, `display binding changed the neckline route by ${maximumCollar} m`);
});
