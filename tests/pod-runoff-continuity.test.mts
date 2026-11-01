import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { POD_RUNOFF, podRunoffHeight } from '@auto_matrix/shared';
import { podPatient } from './helpers/pod-patient.mts';

test('the released patient leaves the pipe without jumping when the final skin vertex loses support', async t => {
  const h = await podPatient(t), names = ['pelvis', 'head', 'wrist_R', 'wrist_L', 'ankle_R', 'ankle_L'];
  let previous: THREE.Vector3[] | undefined, maximumStep = 0;
  for (let tick = 6800; tick <= 7000; tick++) {
    const elapsed = tick / 1000;
    h.at(elapsed, 100, false, { kind: 'disconnect', elapsed, emerged: true, breatherRemoved: true });
    const points = names.map(name => h.rig.bones.get(name)!.getWorldPosition(new THREE.Vector3()));
    if (previous) points.forEach((point, i) => { maximumStep = Math.max(maximumStep, point.distanceTo(previous![i])); });
    previous = points;
  }
  t.diagnostic(`Maximum 1 ms body step: ${maximumStep} game units`);
  assert.ok(maximumStep < .08, `Losing runoff support moves the body by ${maximumStep} game units in 1 ms`);
});

test('outlet support reconstructs the same pose after pause, reverse sampling and a cold load', async t => {
  const h = await podPatient(t);
  const snapshot = (elapsed: number, wallTime: number) => {
    h.at(elapsed, wallTime, false, { kind: 'disconnect', elapsed, emerged: true, breatherRemoved: true });
    return [...h.rig.bones.values()].map(bone => bone.matrixWorld.toArray());
  };
  for (const elapsed of [6.85, 6.92, 6.951]) {
    const expected = snapshot(elapsed, 100); snapshot(8.6, 200);
    assert.deepEqual(snapshot(elapsed, 1200), expected);
    await t.test(`cold outlet at ${elapsed}s`, async t => {
      const cold = await podPatient(t);
      cold.at(elapsed, 4000, false, { kind: 'disconnect', elapsed, emerged: true, breatherRemoved: true });
      assert.deepEqual([...cold.rig.bones.values()].map(bone => bone.matrixWorld.toArray()), expected);
    });
  }
});

test('the complete visible patient clears the round outlet while runoff support releases', async t => {
  const h = await podPatient(t), radius = POD_RUNOFF.halfWidth;
  const centerY = podRunoffHeight(0, POD_RUNOFF.endZ)! + radius;
  let checked = 0;
  for (let tick = 6800; tick <= 7000; tick += 5) {
    const elapsed = tick / 1000;
    const body = h.at(elapsed, 100, false, { kind: 'disconnect', elapsed, emerged: true, breatherRemoved: true });
    body.traverseVisible(object => {
      if (!(object instanceof THREE.SkinnedMesh) || !object.userData.patientBody && (object.material as THREE.Material).name !== 'Skin') return;
      object.updateMatrixWorld(true); object.skeleton.update();
      const point = new THREE.Vector3();
      for (let i = 0; i < object.geometry.attributes.position.count; i++) {
        object.getVertexPosition(i, point); object.localToWorld(point); h.root.worldToLocal(point);
        if (point.z < POD_RUNOFF.endZ - .2 || point.z > POD_RUNOFF.endZ + POD_RUNOFF.outletDepth + POD_RUNOFF.lipRadius) continue;
        let clearance = point.z <= POD_RUNOFF.endZ + POD_RUNOFF.outletDepth ? radius : Infinity;
        for (const z of [POD_RUNOFF.endZ - .2, POD_RUNOFF.endZ + POD_RUNOFF.outletDepth]) {
          const distance = Math.abs(point.z - z);
          if (distance < POD_RUNOFF.lipRadius) clearance = Math.min(clearance,
            radius + POD_RUNOFF.lipRadius - Math.sqrt(POD_RUNOFF.lipRadius ** 2 - distance ** 2));
        }
        checked++;
        assert.ok(Math.hypot(point.x, point.y - centerY) < clearance - .015,
          `${object.name} crosses the outlet at ${elapsed}s: ${point.toArray()}`);
      }
    });
  }
  assert.ok(checked > 1000, 'check the actual visible skin at the outlet');
});
