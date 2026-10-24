import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { actor } from './helpers/fighting-hand-fixture.mjs';
import { advanceMotion, newMotion } from '../packages/client/src/agents/CharacterMotion.js';

for (const id of ['neo', 'morpheus'] as const) {
  test(`${id}: complete sole contact reuses each bone transform within a frame`, async t => {
    const h = await actor(id); t.after(() => h.models.dispose());
    const placement = new THREE.Group(); placement.add(h.rig.root);
    placement.position.set(6336, 1, 4416); placement.rotation.y = .63;
    const sole = h.rig.dojoSoles!, skeleton = sole.mesh.skeleton;
    const pairs = new Map(skeleton.bones.map((bone, i) => [bone.matrixWorld, skeleton.boneInverses[i]]));
    const multiply = THREE.Matrix4.prototype.multiplyMatrices; let count = 0;
    t.mock.method(THREE.Matrix4.prototype, 'multiplyMatrices', function(a: THREE.Matrix4, b: THREE.Matrix4) {
      if (pairs.get(a) === b) count++;
      return multiply.call(this, a, b);
    });
    assert.ok(sole.indices.length > 8000, 'keep every detailed foot vertex');
    for (const speed of [0, 3.4, 7.2]) {
      count = 0;
      const motion = Object.assign(newMotion(), { speed, phase: .3 });
      const input = { speed, grounded: true, verticalVelocity: 0, turn: .2, dojoOutfit: id, dojoSparring: true };
      h.models.animate(h.rig, advanceMotion(motion, input, 0), motion, input, 0);
      assert.ok(count <= skeleton.bones.length * 3, `${sole.indices.length} sole vertices recomputed the same bone matrices ${count} times`);
      placement.rotation.y += .4;
    }
  });
}
