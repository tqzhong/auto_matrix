import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { auditCage } from '../morpheus-ambush-doff-2026-10-17/cloth-rebuild/cage-contact.mjs';

const base = new URL('./', import.meta.url);
const result = process.env.MORPHEUS_CAGE_RESULT ?? 'cage-fitted-physics';
const json = async (file: string) => JSON.parse(await readFile(new URL(file, base), 'utf8'));
const input = new URL(process.env.MORPHEUS_CLOTH_INPUT ?? '../morpheus-withdrawal-path-2026-10-20/clearance-input/', base);
const data = await json(new URL('manifest.json', input).href);
const cage = await json(process.env.MORPHEUS_CAGE_INPUT ?? 'cage-fit-4.json'), guide = await json(process.env.MORPHEUS_COLLAR_GUIDE ?? 'collar-guide.json');
const { cuffs } = await json('boundary-controls.json');
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

test('the detailed cloth follows every physical boundary and preserves the active hand and neckline constraints', async () => {
  let maximumCuff = 0, maximumCollar = 0, physicalCuff = 0, physicalCollar = 0, cuffBinding = 0, collarBinding = 0, freedCuffMotion = 0;
  const { frames, cuffReleaseFrame, collarReleaseFrame } = await json(`${result}/metadata.json`);
  assert.ok(frames >= 25);
  for (let frame = 1; frame <= frames; frame++) {
    const displayed = await points(`${result}/cloth-${frame}.bin`);
    const simulated = await points(`${result}/cage-${frame}.bin`);
    assert.equal(displayed.length, data.points.length);
    for (const cuff of cuffs) {
      assert.equal(cuff.ring.length, 61);
      const path = data.frames[frame-1].cuffs.find((item: { side: string }) => item.side === cuff.side);
      const matrix = new THREE.Matrix4().fromArray(path.matrix);
      for (const id of cuff.ring) {
        const expected = new THREE.Vector3(...data.points[id]).applyMatrix4(matrix);
        cuffBinding = Math.max(cuffBinding, displayed[id].distanceTo(simulated[cage.mappedControls[id]]) * .4);
        if (!cuffReleaseFrame || frame < cuffReleaseFrame) {
          maximumCuff = Math.max(maximumCuff, expected.distanceTo(displayed[id]) * .4);
          physicalCuff = Math.max(physicalCuff, expected.distanceTo(simulated[cage.mappedControls[id]]) * .4);
        } else freedCuffMotion = Math.max(freedCuffMotion, expected.distanceTo(displayed[id]) * .4);
      }
    }
    for (let i = 0; i < guide.ids.length; i++) {
      const expected = new THREE.Vector3(...guide.frames[frame-1].points[i]);
      collarBinding = Math.max(collarBinding, displayed[guide.ids[i]].distanceTo(simulated[cage.mappedControls[guide.ids[i]]]) * .4);
      if (!collarReleaseFrame || frame < collarReleaseFrame) {
        maximumCollar = Math.max(maximumCollar, expected.distanceTo(displayed[guide.ids[i]]) * .4);
        physicalCollar = Math.max(physicalCollar, expected.distanceTo(simulated[cage.mappedControls[guide.ids[i]]]) * .4);
      }
    }
  }
  console.log(JSON.stringify({ maximumCuffMetres: maximumCuff, maximumCollarMetres: maximumCollar,
    physicalCuffMetres: physicalCuff, physicalCollarMetres: physicalCollar, cuffBindingMetres: cuffBinding, collarBindingMetres: collarBinding, freedCuffMotionMetres: freedCuffMotion }));
  assert.ok(cuffBinding < .0001, `displayed cuff leaves the actual simulated rim by ${cuffBinding} m`);
  assert.ok(collarBinding < .0001, `displayed neckline leaves its physical edge by ${collarBinding} m`);
  assert.ok(maximumCuff < .0001, `display binding changed the validated cuff route by ${maximumCuff} m`);
  assert.ok(maximumCollar < .0001, `display binding changed the neckline route by ${maximumCollar} m`);
  if (cuffReleaseFrame && frames >= cuffReleaseFrame) {
    assert.equal(cuffReleaseFrame, 29, 'only release after the complete hand clears at 1.7 seconds');
    if (collarReleaseFrame) assert.equal(collarReleaseFrame, 29);
    const simulation = await json(`${result}/summary.json`);
    assert.equal(simulation.length, frames);
    for (const row of simulation) {
      assert.deepEqual(row.pinWeights.cuffs, row.frame < cuffReleaseFrame ? [1,1] : [0,0]);
      assert.deepEqual(row.pinWeights.collar, collarReleaseFrame && row.frame >= collarReleaseFrame ? [0,0] : [1,1]);
    }
    assert.ok(freedCuffMotion > .001, 'the released sleeve still follows the imposed cuff trajectory');
  }
});
