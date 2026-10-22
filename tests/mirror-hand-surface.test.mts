import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { MIRROR_SEAT, MIRROR_TIMING, PILL_ROOM, MIRROR_FACE } from '@auto_matrix/shared';
import { newMotion, advanceMotion } from '../packages/client/src/agents/CharacterMotion.js';
import { actor, bends, fingerGroups } from './helpers/fighting-hand-fixture.mjs';
import { handSurface } from './helpers/hand-surface.mjs';

test('Neo mirror sitting, reaching and silver inspection preserve both complete hand surfaces', async t => {
  const h = await actor('neo'); t.after(() => h.models.dispose());
  h.rig.root.position.set(MIRROR_SEAT.x, -1, MIRROR_SEAT.z); h.rig.root.rotation.y = Math.PI;
  const hands = Object.fromEntries(['R', 'L'].map(side => [side, handSurface(h.rig, side)]));
  for (const hand of Object.values(hands)) { assert.equal(hand.vertices.length, 6673); assert.equal(hand.triangles.length, 12472); }
  for (const mirrorBeat of [0, .65, 1.35, 2.203, MIRROR_TIMING.wired, 3.1, MIRROR_TIMING.touch, 3.8, 4.2, 4.8, 5.8, 6.3, 7.2]) {
    const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, seated: mirrorBeat >= MIRROR_TIMING.sit,
      performance: 'touch' as const, mirrorBeat };
    const motion = newMotion(); h.models.animate(h.rig, advanceMotion(motion, input, 0), motion, input, 0); h.rig.root.updateMatrixWorld(true);
    for (const side of ['R', 'L']) {
      const result = hands[side].draw();
      assert.equal(result.self.count, 0, `${side}/${mirrorBeat}: ${JSON.stringify(result.self)}`);
      const twins = new Map<number, THREE.Vector3>(), attributes = hands[side].group.skin.geometry.attributes;
      for (const [id, point] of result.points) {
        assert.ok(point.toArray().every(Number.isFinite));
        const twin = twins.get(hands[side].weld[id]);
        if (twin) assert.ok(twin.distanceTo(point) < 2e-6, 'the posed skin cannot split at a UV seam');
        else twins.set(hands[side].weld[id], point);
        const normal = new THREE.Vector3().fromBufferAttribute(attributes.normal, id);
        assert.ok(normal.toArray().every(Number.isFinite) && normal.length() > .99 && normal.length() < 1.01);
        const weights = [0, 1, 2, 3].map(k => attributes.skinWeight.getComponent(id, k));
        assert.ok(weights.every(w => w >= 0) && Math.abs(weights.reduce((a, b) => a + b, 0) - 1) < 1e-6);
      }
      for (const finger of bends(h.rig, side, fingerGroups(h.rig, side)))
        assert.ok(finger.PIP <= (finger.digit === 1 ? 100 : 115) && finger.DIP <= 90,
          `${side}/${mirrorBeat}: digit ${finger.digit} exceeds the existing curl limits`);
    }
  }
});

test('the actual mirror hand skin touches the glass without passing behind its surface', async t => {
  const h = await actor('neo'); t.after(() => h.models.dispose());
  h.rig.root.position.set(MIRROR_SEAT.x, -1, MIRROR_SEAT.z); h.rig.root.rotation.y = Math.PI;
  const hand = handSurface(h.rig, 'R'), wrist = h.rig.bones.get('wrist_R')!;
  for (const mirrorBeat of [2.75, 3.1, 3.3, 3.44, MIRROR_TIMING.touch, 3.6, 3.8, 4.2]) {
    const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, seated: true, performance: 'touch' as const, mirrorBeat };
    const motion = newMotion(); h.models.animate(h.rig, advanceMotion(motion, input, 0), motion, input, 0); h.rig.root.updateMatrixWorld(true);
    let nearest = Infinity;
    const digits = new Map<number, number>();
    for (const [id, point] of hand.posePoints()) {
      point.applyMatrix4(wrist.matrixWorld);
      if (Math.abs(point.x - PILL_ROOM.mirror.x) > MIRROR_FACE.radiusX || Math.abs(point.y - MIRROR_FACE.y) > MIRROR_FACE.radiusY) continue;
      nearest = Math.min(nearest, point.z - PILL_ROOM.mirror.z);
      const digit = hand.group.digits[id]; digits.set(digit, Math.min(digits.get(digit) ?? Infinity, point.z - PILL_ROOM.mirror.z));
    }
    assert.ok(nearest > -.015, `actual finger skin penetrates the glass by ${-nearest} at ${mirrorBeat}s`);
    if (mirrorBeat === MIRROR_TIMING.touch) {
      const index = digits.get(2)!;
      assert.ok(index >= 0 && index < .03, `actual index skin floats ${index} in front of the glass`);
      for (const digit of [3, 4, 5]) assert.ok(digits.get(digit)! > index + .005,
        `digit ${digit} touches before the authored index pad: ${digits.get(digit)} / ${index}`);
    }
  }
});

test('mirror skin remains continuous across finger curl, contact and inspection release', async t => {
  const h = await actor('neo'); t.after(() => h.models.dispose());
  h.rig.root.position.set(MIRROR_SEAT.x, -1, MIRROR_SEAT.z); h.rig.root.rotation.y = Math.PI;
  const surfaces = Object.fromEntries(['R', 'L'].map(side => [side, handSurface(h.rig, side)]));
  const draw = (mirrorBeat: number) => {
    const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, seated: true, performance: 'touch' as const, mirrorBeat };
    const motion = newMotion(); h.models.animate(h.rig, advanceMotion(motion, input, 0), motion, input, 0); h.rig.root.updateMatrixWorld(true);
    return Object.fromEntries(['R', 'L'].map(side => [side, new Map([...surfaces[side].posePoints()].map(([id, point]) =>
      [id, point.applyMatrix4(h.rig.bones.get(`wrist_${side}`)!.matrixWorld)]))]));
  };
  for (const at of [2.6, MIRROR_TIMING.wired, MIRROR_TIMING.touch, MIRROR_TIMING.touch + .35, 4.65, 5.1]) {
    const before = draw(at - .0001), after = draw(at + .0001);
    for (const side of ['R', 'L']) {
      const maximum = Math.max(...surfaces[side].vertices.map(id => before[side].get(id)!.distanceTo(after[side].get(id)!)));
      assert.ok(maximum < .002, `${side}/${at}: actual world skin jumps ${maximum} over 0.2ms`);
    }
  }
});

test('cold mirror saves restore the same hand skin and preserve the shipped arm lengths', async t => {
  const h = await actor('neo'); t.after(() => h.models.dispose());
  h.rig.root.position.set(MIRROR_SEAT.x, -1, MIRROR_SEAT.z); h.rig.root.rotation.y = Math.PI;
  for (const mirrorBeat of [2.75, 3.1, MIRROR_TIMING.touch, 4.2, 5.1]) {
    const fresh = (await h.models.create('neo'))!; fresh.root.position.copy(h.rig.root.position); fresh.root.rotation.copy(h.rig.root.rotation);
    const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, seated: true, performance: 'touch' as const, mirrorBeat };
    for (const rig of [h.rig, fresh]) {
      const motion = newMotion(); h.models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); rig.root.updateMatrixWorld(true);
      for (const [parent, child] of [['shoulder_R', 'elbow_R'], ['elbow_R', 'wrist_R']]) {
        const a = rig.bones.get(parent)!, b = rig.bones.get(child)!;
        const actual = a.getWorldPosition(new THREE.Vector3()).distanceTo(b.getWorldPosition(new THREE.Vector3()));
        const expected = b.position.length() * a.getWorldScale(new THREE.Vector3()).x;
        assert.ok(Math.abs(actual - expected) < 1e-6, 'touching the glass cannot stretch the upper arm or forearm');
      }
    }
    for (const side of ['R', 'L']) {
      const before = handSurface(h.rig, side).posePoints(), after = handSurface(fresh, side).posePoints();
      for (const [id, point] of before) assert.ok(point.distanceTo(after.get(id)!) < 2e-6,
        `${side}/${mirrorBeat}: cold vertex ${id} retains a previous gesture`);
    }
    h.draw(1);
  }
});
