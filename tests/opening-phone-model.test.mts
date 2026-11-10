import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { FILM_SETS, OPENING_PHONE, openingAnswerPose, type OpeningPhoneAnswer } from '@auto_matrix/shared';
import { HardlineHandset } from '../packages/client/src/agents/HardlineHandset.js';
import { poseOpeningPhone } from '../packages/client/src/agents/OpeningPhonePerformance.js';
import { advanceMotion, newMotion } from '../packages/client/src/agents/CharacterMotion.js';
import { actor } from './helpers/fighting-hand-fixture.mts';

const center = FILM_SETS.film_wells_phone.center;
const saved = (elapsed: number): OpeningPhoneAnswer => ({ elapsed, origin: { x: -.4, y: 0, z: -28.3 }, yaw: Math.PI - .4 });
const idle = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 };

function surface(root: THREE.Group) {
  root.updateMatrixWorld(true); const result: { name: string; vertices: string }[] = [], point = new THREE.Vector3();
  root.traverseVisible(object => {
    if (!(object instanceof THREE.Mesh)) return;
    if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
    const vertices = new Float64Array(object.geometry.attributes.position.count * 3);
    for (let i = 0; i < vertices.length / 3; i++) object.localToWorld(object.getVertexPosition(i, point)).toArray(vertices, i * 3);
    result.push({ name: object.name, vertices: createHash('sha256').update(new Uint8Array(vertices.buffer)).digest('hex') });
  });
  return result;
}

test('opening handset: the delivered Trinity body, clothing and receiver rebuild exactly from every saved pickup beat', async t => {
  const warm = await actor('trinity'), cold = await actor('trinity'), history = newMotion();
  const handsets = [new HardlineHandset(), new HardlineHandset()];
  [warm, cold].forEach((a, i) => a.rig.bones.get('wrist_R')!.add(handsets[i].root));
  t.after(() => { handsets.forEach(prop => prop.dispose()); warm.models.dispose(); cold.models.dispose(); });
  for (let i = 0; i < 30; i++) warm.models.animate(warm.rig, advanceMotion(history, { ...idle, speed: 8.4, turn: .8 }, .02), history, idle, .02);
  for (const elapsed of [.2, .55, .75, .95, 1.2, 1.45]) {
    const answer = saved(elapsed), root = openingAnswerPose(answer), input = { ...idle, openingAnswer: answer };
    for (const [i, a] of [warm, cold].entries()) {
      const motion = i ? newMotion() : history;
      a.rig.root.position.set(center.x + root.x, center.y - 1 + root.y, center.z + root.z); a.rig.root.rotation.y = root.yaw;
      a.models.animate(a.rig, advanceMotion(motion, input, 0), motion, input, 0);
      poseOpeningPhone({ root: a.rig.root, hero: a.rig, handset: handsets[i] }, answer);
    }
    assert.deepEqual(surface(warm.rig.root), surface(cold.rig.root), `${elapsed}: a cold join changed the visible pickup`);
  }
});

test('opening handset: the actual right palm reaches the cradle and retains the receiver until its upper cup meets the ear', async t => {
  const a = await actor('trinity'), handset = new HardlineHandset(); a.rig.bones.get('wrist_R')!.add(handset.root);
  t.after(() => { handset.dispose(); a.models.dispose(); });
  for (const elapsed of [.75, .9, 1.1, 1.45]) {
    const answer = saved(elapsed), root = openingAnswerPose(answer), input = { ...idle, openingAnswer: answer }, motion = newMotion();
    a.rig.root.position.set(center.x + root.x, center.y - 1, center.z + root.z); a.rig.root.rotation.y = root.yaw;
    a.models.animate(a.rig, advanceMotion(motion, input, 0), motion, input, 0);
    poseOpeningPhone({ root: a.rig.root, hero: a.rig, handset }, answer); a.rig.root.updateMatrixWorld(true);
    const palm = a.rig.bones.get('wrist_R')!.localToWorld(new THREE.Vector3(0, -.19, .035)), grip = handset.root.getWorldPosition(new THREE.Vector3());
    assert.ok(palm.distanceTo(grip) < .015, `${elapsed}: the hand floats ${palm.distanceTo(grip)} from the receiver`);
    if (elapsed === OPENING_PHONE.graspSeconds) {
      assert.ok(grip.distanceTo(new THREE.Vector3(center.x + OPENING_PHONE.receiver.x, center.y - 1 + OPENING_PHONE.receiver.y, center.z + OPENING_PHONE.receiver.z)) < 1e-9);
      assert.ok(handset.root.getWorldQuaternion(new THREE.Quaternion()).angleTo(new THREE.Quaternion()) < 1e-7, 'the receiver rotates only after leaving its cradle');
    }
    if (elapsed === OPENING_PHONE.liftSeconds) {
      const cup = handset.root.localToWorld(new THREE.Vector3(0, .31, .1425)), ear = a.rig.bones.get('head')!.localToWorld(new THREE.Vector3(-.23, -.08, .13));
      assert.ok(cup.distanceTo(ear) < 1e-9, 'the upper earpiece must arrive before the caller disappears');
    }
  }
});
