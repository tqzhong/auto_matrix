import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, PILL_ROOM, PILL_TIMING, pillRoot, type PillGesture } from '@auto_matrix/shared';
import { actor, bends, fingerGroups } from './helpers/fighting-hand-fixture.mjs';
import { handSurface } from './helpers/hand-surface.mjs';
import { capsuleTriangleGap } from './helpers/pill-prop-contact.mjs';
import { advanceMotion, newMotion } from '../packages/client/src/agents/CharacterMotion.js';
import type { HeroModels, HeroRig } from '../packages/client/src/agents/HeroModel.js';

function draw(h: { models: HeroModels; rig: HeroRig }, pills: PillGesture, firstPerson = false) {
  const point = pills.role === 'neo' ? pillRoot({ ...pills, approach: { x: PILL_ROOM.seat, z: PILL_ROOM.z, yaw: -Math.PI / 2 } })
    : { x: -PILL_ROOM.seat, z: PILL_ROOM.z, yaw: Math.PI / 2 }, center = FILM_SETS.film_lafayette.center;
  h.rig.root.position.set(center.x + point.x, center.y - 1, center.z + point.z); h.rig.root.rotation.y = point.yaw;
  const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, pills, firstPerson, mirror: 0, seated: pills.role === 'morpheus' }, motion = newMotion();
  h.models.animate(h.rig, advanceMotion(motion, input, 0), motion, input, 0); h.rig.root.updateMatrixWorld(true);
}

for (const choice of ['red', 'blue'] as const) {
  test(`${choice}: taking and swallowing the capsule keeps the complete hand surface free of self intersections`, async t => {
    const h = await actor('neo'); t.after(() => h.models.dispose());
    const side = choice === 'red' ? 'L' : 'R', surface = handSurface(h.rig, side);
    assert.equal(surface.vertices.length, 6673); assert.equal(surface.triangles.length, 12472);
    for (const elapsed of [1.1, 1.8, 2.5, 3.6, 3.95, 4.35]) {
      const pills: PillGesture = { role: 'neo', phase: 'taking', elapsed, choice };
      draw(h, pills);
      const result = surface.draw();
      assert.equal(result.self.count, 0, `${choice}/${elapsed}: ${JSON.stringify(result.self)}`);
      const twins = new Map<number, THREE.Vector3>(), a = surface.group.skin.geometry.attributes;
      for (const vertex of surface.vertices) {
        const point = result.points.get(vertex)!; assert.ok(point.toArray().every(Number.isFinite));
        const twin = twins.get(surface.weld[vertex]);
        if (twin) assert.ok(twin.distanceTo(point) < 2e-6, 'the UV split cannot open a seam through the posed finger');
        else twins.set(surface.weld[vertex], point);
        const normal = new THREE.Vector3().fromBufferAttribute(a.normal, vertex);
        assert.ok(normal.toArray().every(Number.isFinite) && normal.length() > .99 && normal.length() < 1.01);
        const weights = [0, 1, 2, 3].map(k => a.skinWeight.getComponent(vertex, k));
        assert.ok(weights.every(w => w >= 0) && Math.abs(weights.reduce((sum, w) => sum + w, 0) - 1) < 1e-6);
      }
      for (const finger of bends(h.rig, side, fingerGroups(h.rig, side)))
        assert.ok(finger.PIP <= (finger.digit === 1 ? 100 : 115) && finger.DIP <= 90, `digit ${finger.digit} exceeds the existing curl limits`);
    }
  });
}

test('capsule ownership changes hands at a continuous world position', async t => {
  const neo = await actor('neo'), morpheus = await actor('morpheus'); t.after(() => { neo.models.dispose(); morpheus.models.dispose(); });
  for (const choice of ['red', 'blue'] as const) {
    draw(morpheus, { role: 'morpheus', choice, phase: 'taking', elapsed: PILL_TIMING.transfer - .0001 });
    const offered = morpheus.rig.root.getObjectByName(`held-${choice}-pill`)!;
    assert.ok(offered.visible); const before = offered.getWorldPosition(new THREE.Vector3());
    draw(neo, { role: 'neo', choice, phase: 'taking', elapsed: PILL_TIMING.transfer });
    const received = neo.rig.root.getObjectByName(`held-${choice}-pill`)!; assert.ok(received.visible);
    const gap = before.distanceTo(received.getWorldPosition(new THREE.Vector3()));
    assert.ok(gap < .002, `${choice}: switching the visible capsule between actors jumps ${gap} world units`);
    draw(morpheus, { role: 'morpheus', choice, phase: 'taking', elapsed: PILL_TIMING.transfer });
    assert.equal(offered.visible, false, 'the capsule cannot remain in both actors hands');
  }
});

test('saved pill skin restores after phone, other colors and camera changes', async t => {
  const h = await actor('neo'); t.after(() => h.models.dispose());
  const warm = Object.fromEntries(['R', 'L'].map(side => [side, handSurface(h.rig, side)]));
  for (const [choice, elapsed] of [['red', 1.1], ['red', 1.8], ['red', 2.5], ['blue', 1.8], ['blue', 4.05], ['red', 5.3], ['red', 7.3], ['blue', 8.9]] as const) {
    const saved: PillGesture = { role: 'neo', choice, elapsed, phase: 'taking' };
    draw(h, saved);
    const expected = Object.fromEntries(['R', 'L'].map(side => [side, warm[side].posePoints()]));
    draw(h, { ...saved, choice: choice === 'red' ? 'blue' : 'red', elapsed: elapsed < 4 ? 7.3 : 1.8 });
    const phone = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, phone: { phase: 'connected' as const, elapsed: 8 } }, motion = newMotion();
    h.models.animate(h.rig, advanceMotion(motion, phone, 0), motion, phone, 0);
    draw(h, JSON.parse(JSON.stringify(saved)), true);
    const fresh = { models: h.models, rig: (await h.models.create('neo'))! }; draw(fresh, saved, true);
    for (const side of ['R', 'L']) for (const surface of [warm[side], handSurface(fresh.rig, side)]) {
      const actual = surface.posePoints();
      for (const [id, point] of expected[side]) assert.ok(point.distanceTo(actual.get(id)!) < 2e-6, `${choice}/${elapsed}/${side}: restored vertex ${id} retains another gesture`);
    }
  }
});

test('the actual skin stays continuous at pill grip and seat transition boundaries', async t => {
  const h = await actor('neo'); t.after(() => h.models.dispose());
  const surfaces = Object.fromEntries(['R', 'L'].map(side => [side, handSurface(h.rig, side)]));
  for (const choice of ['red', 'blue'] as const) for (const at of [.35, 1.8, 3.65, 3.75, 4.1, 4.35, 5.3, 8.6, 9.2, 9.6, 11]) {
    draw(h, { role: 'neo', phase: 'taking', choice, elapsed: at - .0001 });
    const before = Object.fromEntries(['R', 'L'].map(side => [side, surfaces[side].posePoints()]));
    draw(h, { role: 'neo', phase: 'taking', choice, elapsed: at + .0001 });
    for (const side of ['R', 'L']) {
      const points = surfaces[side].posePoints();
      const maximum = Math.max(...surfaces[side].vertices.map(id => points.get(id)!.distanceTo(before[side].get(id)!)));
      assert.ok(maximum < .002, `${choice}/${at}/${side}: the hand skin jumps ${maximum} in 0.2ms`);
    }
  }
});

test('leaving a pill performance restores the ordinary hands without a cached prop pose', async t => {
  for (const id of ['neo', 'morpheus'] as const) {
    const h = await actor(id), reference = await actor(id);
    t.after(() => { h.models.dispose(); reference.models.dispose(); });
    const skin = (rig: HeroRig) => rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
    for (const grip of [0, .5, 1]) {
      draw(h, { role: id, choice: 'red', phase: 'taking', elapsed: 1.8 });
      reference.rig.root.position.copy(h.rig.root.position); reference.rig.root.quaternion.copy(h.rig.root.quaternion);
      h.draw(grip); reference.draw(grip);
      for (const name of ['position', 'normal', 'skinIndex', 'skinWeight'])
        assert.deepEqual(skin(h.rig).geometry.attributes[name].array, skin(reference.rig).geometry.attributes[name].array, `${id}/${grip}/${name}: a pill pose survives release`);
    }
  }
});

test('Morpheus keeps the original offering skin while the capsule and Neo use their own bindings', async t => {
  const h = await actor('morpheus'); t.after(() => h.models.dispose());
  const skin = h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  // His original open palm already passes the complete surface check. Keep
  // that binding rather than pay for Neo's pinch correction on both actors.
  const idle = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, seated: true }, motion = newMotion();
  h.models.animate(h.rig, advanceMotion(motion, idle, 0), motion, idle, 0);
  const original = Object.fromEntries(['position', 'normal', 'skinIndex', 'skinWeight'].map(name => [name, Array.from(skin.geometry.attributes[name].array)]));
  for (const elapsed of [0, 1.1, 1.8, 2.8, 4.4]) {
    draw(h, { role: 'morpheus', choice: 'red', phase: 'taking', elapsed });
    for (const name of ['position', 'normal', 'skinIndex', 'skinWeight'])
      assert.deepEqual(Array.from(skin.geometry.attributes[name].array), original[name], `${elapsed}/${name}: the open palm acquires the pinch binding`);
  }
});

test('both offered capsules stay outside the complete palm surface while Morpheus opens his hands', async t => {
  const h = await actor('morpheus'); t.after(() => h.models.dispose());
  const surfaces = Object.fromEntries(['R', 'L'].map(side => [side, handSurface(h.rig, side)]));
  for (const elapsed of [2.2, 2.3, 2.4, 2.5, 2.8, 3.6, 5]) {
    draw(h, { role: 'morpheus', choice: 'red', phase: 'offering', elapsed });
    for (const [side, color] of [['R', 'red'], ['L', 'blue']]) {
      const prop = h.rig.root.getObjectByName(`held-${color}-pill`) as THREE.Mesh<THREE.CapsuleGeometry>;
      if (!prop.visible) continue;
      const surface = surfaces[side], transform = prop.matrixWorld.clone().invert().multiply(h.rig.bones.get('wrist_' + side)!.matrixWorld);
      const points = new Map([...surface.posePoints()].map(([id, point]) => [id, point.applyMatrix4(transform)]));
      const { radius, length } = prop.geometry.parameters;
      const bounds = new THREE.Box3(new THREE.Vector3(-radius, -length / 2 - radius, -radius), new THREE.Vector3(radius, length / 2 + radius, radius));
      for (const face of surface.triangles) {
        const triangle = face.ids.map(id => points.get(id)!) as [THREE.Vector3, THREE.Vector3, THREE.Vector3];
        if (!new THREE.Box3().setFromPoints(triangle).intersectsBox(bounds)) continue;
        const gap = capsuleTriangleGap(triangle, radius, length);
        assert.ok(gap >= -.003, `${elapsed}/${color}: face ${face.face} enters the capsule by ${-gap}`);
      }
    }
  }
});
