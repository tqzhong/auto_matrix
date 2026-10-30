import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { actor, fingerGroups } from './helpers/fighting-hand-fixture.mjs';
import { handSurface } from './helpers/hand-surface.mjs';

for (const id of ['neo', 'trinity', 'smith', 'morpheus'] as const) test(`${id}: a closed fighting grip brings the fingers back to the palm`, async t => {
  const h = await actor(id); t.after(() => h.models.dispose());
  const hands = ['R', 'L'].map(side => {
    const surface = handSurface(h.rig, side), group = fingerGroups(h.rig, side), a = group.skin.geometry.attributes;
    // The thumb mound is part of the palm; do not count the moving thumb's
    // proximal or distal phalanx as a fingertip-to-palm contact.
    const palmWeight = (id: number) => [0, 1, 2, 3].reduce((sum, k) => sum +
      ([`wrist_${side}`, `finger1-1_${side}`].includes(group.skin.skeleton.bones[a.skinIndex.getComponent(id, k)].name) ? a.skinWeight.getComponent(id, k) : 0), 0);
    const palm = surface.triangles.filter(triangle => triangle.ids.every(id => palmWeight(id) > .55));
    const wrist = h.rig.bones.get(`wrist_${side}`)!, middle = h.rig.bones.get(`finger3-1_${side}`)!;
    const palmLength = wrist.getWorldPosition(new THREE.Vector3()).distanceTo(middle.getWorldPosition(new THREE.Vector3()));
    assert.ok(palm.length > 100, 'measure the actual palm surface');
    return { side, surface, group, palm, palmLength };
  });
  h.draw(1);
  for (const { side, surface, group, palm, palmLength } of hands) {
    const points = surface.posePoints();
    for (const digit of [1, 2, 3, 4]) {
      let gap = Infinity;
      for (const id of group.tips[digit]) for (const face of palm) {
        const triangle = new THREE.Triangle(...face.ids.map(id => points.get(id)!) as [THREE.Vector3, THREE.Vector3, THREE.Vector3]);
        gap = Math.min(gap, triangle.closestPointToPoint(points.get(id)!, new THREE.Vector3()).distanceTo(points.get(id)!));
      }
      assert.ok(gap < palmLength * .04, `${side}: closed digit ${digit + 1} floats ${gap / palmLength} palm lengths away from the palm`);
    }
  }
});

test('a wrist scale preserves the closed palm shape in wrist space', async t => {
  const h = await actor('neo'); t.after(() => h.models.dispose());
  h.draw(.9);
  const surface = handSurface(h.rig, 'R'), expected = surface.posePoints();
  h.rig.bones.get('wrist_R')!.scale.set(1.03, .97, 1.02);
  h.models['fightingHands'].get(h.rig)!.update();
  h.rig.root.updateMatrixWorld(true);
  const actual = surface.posePoints();
  for (const id of surface.vertices) assert.ok(actual.get(id)!.distanceTo(expected.get(id)!) < 2e-6,
    `wrist scaling changes the local palm shape at ${id}`);
});
