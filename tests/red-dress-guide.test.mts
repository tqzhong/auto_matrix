import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { redDressAttention, trainingRoot, type TrainingPerformance } from '@auto_matrix/shared';
import { advanceMotion, newMotion } from '../packages/client/src/agents/CharacterMotion.js';
import { actor, fingerGroups } from './helpers/fighting-hand-fixture.mjs';
import { handSurface } from './helpers/hand-surface.mjs';
import { crossings } from './helpers/hand-self-contact.mjs';
import { wristSwing } from './helpers/core-connector.mjs';

async function guide(t: test.TestContext) {
  const h = await actor('morpheus'); t.after(() => h.models.dispose());
  const fingers = fingerGroups(h.rig, 'R');
  function at(elapsed: number, phase: 'walking' | 'turning' | 'frozen' = 'walking', clock = elapsed) {
    const attention = { ...redDressAttention(elapsed), phase, clock };
    const training: TrainingPerformance = { kind: 'red_dress', started: true, elapsed, attention };
    const root = trainingRoot(training, 'morpheus');
    h.rig.root.position.set(root.x, root.y, root.z); h.rig.root.rotation.y = root.yaw;
    const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, training: { ...training, role: 'morpheus' as const } }, motion = newMotion();
    h.models.animate(h.rig, advanceMotion(motion, input, 0), motion, input, 0);
    h.rig.root.updateMatrixWorld(true); fingers.skin.skeleton.update();
  }
  return { ...h, fingers, at };
}

test('Morpheus brings the two extended fingers beside his actual temple during the minds explanation', async t => {
  const h = await guide(t); h.at(1.9);
  const head = h.rig.bones.get('head')!, space = head.matrixWorld.clone().invert().multiply(h.fingers.skin.matrixWorld);
  const tips = h.fingers.tips.slice(1, 3).map(ids => ids.reduce((sum, id) => sum.add(h.fingers.skin.getVertexPosition(id, new THREE.Vector3()).applyMatrix4(space)), new THREE.Vector3()).divideScalar(ids.length));
  t.diagnostic(JSON.stringify({ tips: tips.map(p => p.toArray()) }));
  for (const tip of tips) {
    assert.ok(tip.x < -.15 && tip.x > -.4, `fingers must lie beside the right temple: ${tip.x}`);
    assert.ok(tip.y > .04 && tip.y < .3, `the teaching gesture is missing at eye height: ${tip.y}`);
    assert.ok(tip.z > -.08 && tip.z < .22, `the fingers must not point behind the head: ${tip.z}`);
  }
});

test('the guide does not snap his arm when the player notices the woman and stops walking', async t => {
  const h = await guide(t), names = ['shoulder_R', 'elbow_R', 'wrist_R', 'finger2-3_R', 'head'];
  h.at(5.29); const previous = names.map(n => h.rig.bones.get(n)!.getWorldPosition(new THREE.Vector3()));
  h.at(5.3, 'turning');
  const jumps = names.map((n, i) => ({ joint: n, distance: h.rig.bones.get(n)!.getWorldPosition(new THREE.Vector3()).distanceTo(previous[i]) }));
  t.diagnostic(JSON.stringify(jumps));
  assert.ok(jumps.every(j => j.distance < .04), 'stopping must retain a continuous arm pose');
});

test('the complete teaching hand clears itself, the real face and every visible garment through lifting and lowering', async t => {
  const h = await guide(t), surface = handSurface(h.rig, 'R'), handIds = new Set(surface.vertices), failures: unknown[] = [];
  let maximumSwing = 0;
  for (const time of [0, .4, .55, .75, 1, 1.2, 1.35, 1.9, 2.6, 2.8, 3, 3.2, 3.4, 4.5, 5.3]) {
    h.at(time); const draw = surface.draw();
    if (draw.self.count) failures.push({ time, mesh: 'hand itself', ...draw.self });
    maximumSwing = Math.max(maximumSwing, wristSwing(h.rig.bones.get('wrist_R')!));
    const inverse = h.rig.bones.get('wrist_R')!.matrixWorld.clone().invert(), box = new THREE.Box3().setFromPoints([...draw.points.values()]);
    h.rig.root.traverseVisible(object => {
      if (!(object instanceof THREE.Mesh)) return;
      if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
      const index = object.geometry.index!, position = object.geometry.attributes.position, matrix = inverse.clone().multiply(object.matrixWorld);
      const points = Array.from({ length: position.count }, (_, id) => object.getVertexPosition(id, new THREE.Vector3()).applyMatrix4(matrix)), faces = [];
      for (let f = 0; f < index.count; f += 3) {
        const ids = [0, 1, 2].map(k => index.getX(f + k));
        if (object === h.fingers.skin && ids.some(id => handIds.has(id))) continue;
        const posed = ids.map(id => points[id]), bounds = new THREE.Box3().setFromPoints(posed);
        if (box.intersectsBox(bounds)) faces.push({ face: f / 3, ids, points: posed, box: bounds });
      }
      const contact = crossings(draw.faces, faces, false);
      if (contact.count) failures.push({ time, mesh: object.name, ...contact });
    });
  }
  t.diagnostic(JSON.stringify({ maximumSwing, failures }));
  assert.ok(maximumSwing <= 70, `the wrist bends ${maximumSwing} degrees`);
  assert.deepEqual(failures, []);
});

test('saved walking, freezing, retrying and leaving training reconstruct the same guide and preserve his bone lengths', async t => {
  const warm = await guide(t), cold = await guide(t);
  const snapshots = (h: typeof warm) => {
    const out: number[] = [];
    h.rig.root.traverseVisible(object => {
      if (!(object instanceof THREE.Mesh)) return;
      out.push(...object.matrixWorld.elements);
      if (object instanceof THREE.SkinnedMesh) {
        object.skeleton.update(); out.push(...object.skeleton.boneMatrices);
        for (const name of ['position', 'normal', 'skinIndex', 'skinWeight']) for (const value of object.geometry.attributes[name].array) out.push(value);
      }
    });
    return out;
  };
  for (const time of [0, .75, 1.9, 3.1, 5.3]) {
    warm.at(time); const expected = snapshots(warm);
    warm.at(5.3, 'frozen', 9); warm.at(time); assert.deepEqual(snapshots(warm), expected);
    cold.at(time); assert.deepEqual(snapshots(cold), expected);
  }
  warm.at(6.2, 'frozen', 8.4); const frozen = snapshots(warm);
  warm.at(12, 'frozen', 8.4); assert.deepEqual(snapshots(warm), frozen);
  const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 }, motion = newMotion();
  warm.models.animate(warm.rig, advanceMotion(motion, input, 0), motion, input, 0);
  warm.at(1.9); cold.at(1.9); assert.deepEqual(snapshots(warm), snapshots(cold));
  for (const [name, rest] of warm.rig.rest) if (/^(shoulder|elbow|wrist|finger)/.test(name))
    assert.ok(warm.rig.bones.get(name)!.position.distanceTo(rest) < 1e-9, `${name} must not stretch`);
});

test('the full guide arm motion is continuous at 10ms sampling intervals', async t => {
  const h = await guide(t), names = ['head', 'shoulder_R', 'elbow_R', 'wrist_R', 'finger2-3_R'];
  let previous: THREE.Vector3[] | undefined, maximumStep = 0, largestAt = 0, largestJoint = '';
  for (let frame = 0; frame <= 530; frame++) {
    h.at(frame / 100, frame < 530 ? 'walking' : 'turning');
    const points = names.map(n => h.rig.bones.get(n)!.getWorldPosition(new THREE.Vector3()));
    if (previous) for (let i = 0; i < points.length; i++) { const step = points[i].distanceTo(previous[i]); if (step > maximumStep) { maximumStep = step; largestAt = frame / 100; largestJoint = names[i]; } }
    previous = points;
  }
  t.diagnostic(JSON.stringify({ maximumStep, largestAt, largestJoint, samples: 531 }));
  assert.ok(maximumStep < .06, `arm displacement in 10ms: ${maximumStep}`);
});
