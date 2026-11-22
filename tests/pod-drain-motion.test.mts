import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import type { AwakeningBeat } from '@auto_matrix/shared';
import { podPatient } from './helpers/pod-patient.mts';
import { crossings } from './helpers/hand-self-contact.mjs';

test('the released body flinches then closes its forearms above the head instead of holding an open overhead pose through the pipe', async t => {
  const h = await podPatient(t);
  const sample = (elapsed: number) => {
    h.at(elapsed, 100, false, { kind: 'disconnect', elapsed, emerged: true, breatherRemoved: true });
    const chest = h.rig.bones.get('chest')!, head = chest.worldToLocal(h.rig.bones.get('head')!.getWorldPosition(new THREE.Vector3()));
    return { head, wrists: ['R', 'L'].map(side => chest.worldToLocal(h.rig.bones.get(`wrist_${side}`)!.getWorldPosition(new THREE.Vector3()))) };
  };
  const flinch = sample(4.65), guard = sample(5.65), leaving = sample(6.25);
  t.diagnostic(JSON.stringify({ flinch, guard, leaving }));
  for (let side = 0; side < 2; side++) {
    assert.ok(flinch.wrists[side].distanceTo(guard.wrists[side]) > .15,
      `${side}: the hand must react to the flow rather than remain fixed relative to the chest`);
    assert.ok(Math.abs(guard.wrists[side].x) < Math.abs(flinch.wrists[side].x) * .65,
      `${side}: the forearm must close over the crown instead of staying spread beside the head`);
    assert.ok(guard.wrists[side].y > guard.head.y,
      `${side}: the protective arm must stay above the head during the enclosed slide`);
  }
});

test('drain reactions restore from the saved clock and remain continuous at support and water transitions', async t => {
  const h = await podPatient(t), names = ['pelvis', 'spine', 'chest', 'head', 'shoulder_R', 'shoulder_L', 'elbow_R', 'elbow_L', 'wrist_R', 'wrist_L'];
  const beat = (elapsed: number): AwakeningBeat => ({ kind: 'disconnect', elapsed, emerged: true, breatherRemoved: true });
  const snapshot = (elapsed: number, wallTime = 100) => {
    h.at(elapsed, wallTime, false, beat(elapsed));
    return names.map(name => h.rig.bones.get(name)!.matrixWorld.toArray());
  };
  const expected = snapshot(5.37); snapshot(8.6);
  assert.deepEqual(snapshot(5.37, 900), expected, 'resuming a paused drain must not accumulate render-time motion');
  await t.test('a fresh model reconstructs the same mid-slide reaction', async t => {
    const cold = await podPatient(t); cold.at(5.37, 1200, false, beat(5.37));
    assert.deepEqual(names.map(name => cold.rig.bones.get(name)!.matrixWorld.toArray()), expected);
  });
  for (const elapsed of [3.8, 4, 4.5, 4.6, 5.2, 5.8, 6.3, 6.55, 7, 7.4, 8.6]) {
    const before = snapshot(elapsed - .001), after = snapshot(elapsed + .001);
    before.forEach((matrix, i) => assert.ok(new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().fromArray(matrix))
      .distanceTo(new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().fromArray(after[i]))) < .08,
    `${names[i]} jumps across ${elapsed}s`));
  }
});

test('the arms and hands clear the head, opposite arm and torso beyond the blended shoulder joints', async t => {
  const h = await podPatient(t), failures: { elapsed: number; first: string; second: string; count: number }[] = [];
  let minimumFaces = Infinity;
  for (const elapsed of [4.6, 4.8, 5, 5.2, 5.35, 5.65, 6.35, 6.6, 6.85, 7.1, 7.35]) {
    const body = h.at(elapsed, 100, false, { kind: 'disconnect', elapsed, emerged: true, breatherRemoved: true });
    type Face = { face: number; ids: number[]; points: THREE.Vector3[]; box: THREE.Box3; mesh: string };
    const groups: Record<string, Face[]> = { R: [], L: [], head: [], torso: [] };
    let offset = 0;
    body.traverseVisible(object => {
      if (!(object instanceof THREE.SkinnedMesh) || !object.userData.patientBody && (object.material as THREE.Material).name !== 'Skin') return;
      object.skeleton.update(); const a = object.geometry.attributes, index = object.geometry.index!;
      const matrix = h.rig.root.matrixWorld.clone().invert().multiply(object.matrixWorld);
      const points = Array.from({ length: a.position.count }, (_, vertex) => {
        const point = object.getVertexPosition(vertex, new THREE.Vector3());
        point.set(Math.fround(point.x), Math.fround(point.y), Math.fround(point.z)); return point.applyMatrix4(matrix);
      });
      const parts = Array.from({ length: a.position.count }, (_, vertex) => {
        const result = new Set<string>();
        for (let k = 0; k < 4; k++) {
          if (a.skinWeight.getComponent(vertex, k) <= .2) continue;
          const name = object.skeleton.bones[a.skinIndex.getComponent(vertex, k)].name;
          const arm = /^(?:shoulder|elbow|wrist|finger[1-5]-[1-3])_([RL])$/.exec(name);
          if (arm) result.add(arm[1]);
          else if (name === 'head') result.add('head');
          else if (/^(?:pelvis|spine|chest|neck)$/.test(name)) result.add('torso');
        }
        return result;
      });
      for (let face = 0; face < index.count; face += 3) {
        const vertices = [0, 1, 2].map(k => index.getX(face + k)), triangle = vertices.map(vertex => points[vertex]);
        const entry = { face: offset + face / 3, ids: vertices.map(vertex => offset + vertex), points: triangle, box: new THREE.Box3().setFromPoints(triangle), mesh: object.name };
        for (const part of Object.keys(groups)) if (vertices.some(vertex => parts[vertex].has(part))) groups[part].push(entry);
      }
      offset += Math.max(a.position.count, index.count / 3);
    });
    minimumFaces = Math.min(minimumFaces, groups.R.length, groups.L.length, groups.head.length);
    for (const [first, second] of [['R', 'head'], ['L', 'head'], ['R', 'L'], ['R', 'torso'], ['L', 'torso']]) {
      const arm = groups[first];
      // The shared skinned shoulder shell belongs to both shoulder and chest; only test arm faces that extend past its joint envelope.
      const shoulder = second === 'torso' ? h.rig.bones.get(`shoulder_${first}`)!.getWorldPosition(new THREE.Vector3())
        .applyMatrix4(h.rig.root.matrixWorld.clone().invert()) : undefined;
      const testedArm = shoulder ? arm.filter(face => face.points.every(point => point.distanceTo(shoulder) > .2)) : arm;
      const result = crossings(testedArm, groups[second]);
      if (result.count) failures.push({ elapsed, first, second, count: result.count });
    }
  }
  t.diagnostic(JSON.stringify({ samples: 11, minimumFacesPerArmOrHead: minimumFaces, failures }));
  assert.ok(minimumFaces > 1000, 'check all the delivered forearm, hand and head triangles');
  assert.deepEqual(failures, [], 'a protective pose cannot hide head, torso or opposite-arm penetration');
});
