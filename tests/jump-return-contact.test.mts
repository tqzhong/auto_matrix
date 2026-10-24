import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { actor } from './helpers/fighting-hand-fixture.mjs';
import { handSurface } from './helpers/hand-surface.mjs';
import { crossings } from './helpers/hand-self-contact.mjs';
import { advanceMotion, newMotion } from '../packages/client/src/agents/CharacterMotion.js';

async function setup(t: test.TestContext) {
  const h = await actor('neo'); t.after(() => h.models.dispose());
  const hand = handSurface(h.rig, 'R'), skin = hand.group.skin, a = skin.geometry.attributes, index = skin.geometry.index!;
  const headJoint = skin.skeleton.bones.indexOf(h.rig.bones.get('head')!);
  const headIds = new Set(Array.from({ length: a.position.count }, (_, i) => i).filter(i => [0, 1, 2, 3].some(k => a.skinIndex.getComponent(i, k) === headJoint && a.skinWeight.getComponent(i, k) > .5)));
  const headFaces: { face: number; ids: number[] }[] = [];
  for (let f = 0; f < index.count; f += 3) { const ids = [0, 1, 2].map(k => index.getX(f + k)); if (ids.every(i => headIds.has(i))) headFaces.push({ face: f / 3, ids }); }
  const draw = (elapsed: number) => {
    const motion = newMotion(), input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, seated: true, realWorld: true, nebCrew: 'neo', nebCrewEarly: true,
      training: { kind: 'jump_return' as const, role: 'neo' as const, elapsed } };
    h.models.animate(h.rig, advanceMotion(motion, input, 0), motion, input, 0); h.rig.root.updateMatrixWorld(true); skin.skeleton.update();
    const inverse = h.rig.bones.get('head')!.matrixWorld.clone().invert().multiply(skin.matrixWorld);
    const points = new Map([...headIds, ...hand.vertices].map(i => [i, skin.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(inverse)]));
    const faces = (list: typeof headFaces) => list.map(f => { const p = f.ids.map(i => points.get(i)!); return { ...f, points: p, box: new THREE.Box3().setFromPoints(p) }; });
    const head = faces(headFaces), hands = faces(hand.triangles);
    const distance = (point: THREE.Vector3) => Math.min(...head.map(f => new THREE.Triangle(...f.points as [THREE.Vector3, THREE.Vector3, THREE.Vector3]).closestPointToPoint(point, new THREE.Vector3()).distanceTo(point)));
    return { head, hands, points, distance };
  };
  return { ...h, hand, skin, draw };
}

test('Neo wipes with the actual thumb surface instead of an empty joint in front of his chin', async t => {
  const h = await setup(t);
  for (const elapsed of [4.1, 4.5, 5.1]) {
    const { distance, points } = h.draw(elapsed);
    const gap = Math.min(...h.hand.group.tips[0].map(i => distance(points.get(i)!)));
    assert.ok(gap < .012, `the wiping thumb floats ${gap} from the actual skin at ${elapsed}s`);
    const blood = h.rig.bones.get('head')!.worldToLocal(h.rig.root.getObjectByName('jump-mouth-blood')!.getWorldPosition(new THREE.Vector3()));
    assert.ok(distance(blood) < .008, 'the blood belongs on the delivered face surface');
  }
});

test('the complete wiping hand stays out of itself and the head through its reach and withdrawal', async t => {
  const h = await setup(t); assert.ok(h.hand.triangles.length > 12000);
  for (const elapsed of [0, 2.9, ...Array.from({ length: 23 }, (_, i) => 3 + i * .25), 8.4, 9, 12]) {
    const { head, hands } = h.draw(elapsed);
    assert.equal(h.hand.draw().self.count, 0, `fingers fold through one another at ${elapsed}s`);
    assert.equal(crossings(hands, head, false).count, 0, `the actual hand cuts into the head at ${elapsed}s`);
  }
});

test('cold loading after the wipe preserves the same visible thumb stain', async t => {
  const warm = await setup(t), cold = await setup(t);
  const stain = (h: typeof warm) => h.rig.root.getObjectByName('jump-thumb-blood')!;
  for (const elapsed of [7, 9]) {
    warm.draw(4.5); warm.draw(elapsed); cold.draw(elapsed);
    assert.ok(stain(warm).getWorldPosition(new THREE.Vector3()).distanceTo(stain(cold).getWorldPosition(new THREE.Vector3())) < 1e-6,
      'the stain cannot remember an earlier frame that a cold load never played');
  }
});

test('Neo keeps the bloodied thumb in front of his eyes briefly before lowering the hand', async t => {
  const h = await setup(t);
  for (const elapsed of [6.2, 6.6, 7]) {
    h.draw(elapsed);
    const thumb = h.rig.bones.get('head')!.worldToLocal(h.rig.root.getObjectByName('jump-thumb-blood')!.getWorldPosition(new THREE.Vector3()));
    assert.ok(thumb.y > -.55 && thumb.y < -.15 && thumb.z > .5 && thumb.z < 1,
      `the visible blood returns to the lap instead of being inspected at ${elapsed}s: ${thumb.toArray()}`);
  }
});


test('reaching and lowering preserve continuous skin, then release the authored hand for ordinary play', async t => {
  const h = await setup(t), cold = await setup(t);
  const fingerprint = (skin: THREE.SkinnedMesh) => ['position', 'normal', 'skinIndex', 'skinWeight'].map(name => {
    const a = skin.geometry.attributes[name].array;
    return createHash('sha256').update(Buffer.from(a.buffer, a.byteOffset, a.byteLength)).digest('hex');
  });
  cold.draw(0); const untouched = fingerprint(cold.skin);
  for (const time of [2.9, 4.1, 5.1, 5.8, 7.2, 8.4]) {
    const before = h.draw(time - .0001).points, after = h.draw(time + .0001).points;
    for (const id of h.hand.vertices) assert.ok(before.get(id)!.distanceTo(after.get(id)!) < .002, `skin snaps at ${time}s / vertex ${id}`);
  }
  assert.deepEqual(fingerprint(cold.skin), untouched, 'another character does not inherit the authored hand');
  for (const current of [h, cold]) {
    const motion = newMotion(), input = { speed: 2.5, grounded: true, verticalVelocity: 0, turn: .3 };
    current.models.animate(current.rig, advanceMotion(motion, input, 0), motion, input, 0);
    assert.equal(current.rig.root.getObjectByName('jump-mouth-blood')!.visible, false);
    assert.equal(current.rig.root.getObjectByName('jump-thumb-blood')!.visible, false);
  }
  assert.deepEqual(fingerprint(h.skin), fingerprint(cold.skin), 'leaving the return restores ordinary hand deformation');
});
