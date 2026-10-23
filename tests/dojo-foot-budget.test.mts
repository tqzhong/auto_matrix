import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { MELEE_COMBO } from '@auto_matrix/shared';
import { actor } from './helpers/fighting-hand-fixture.mjs';
import { advanceMotion, newMotion } from '../packages/client/src/agents/CharacterMotion.js';

for (const id of ['neo', 'morpheus'] as const) {
  test(`${id}: full sole contact does not recalculate the world hierarchy for every vertex`, async t => {
    const h = await actor(id); t.after(() => h.models.dispose());
    const world = new THREE.Group(), placement = new THREE.Group(); world.add(placement); placement.add(h.rig.root);
    placement.position.set(6336, 1, 4416); placement.rotation.y = .63;
    const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, dojoOutfit: id, dojoSparring: true };
    const draw = () => { const motion = newMotion(); h.models.animate(h.rig, advanceMotion(motion, input, 0), motion, input, 0); };
    draw();
    let updates = 0; const original = world.updateWorldMatrix;
    world.updateWorldMatrix = function(...args) { updates++; original.apply(this, args); };
    const vertices = h.rig.dojoSoles!.indices.length;
    assert.ok(vertices > 500, 'retain the complete detailed feet');
    draw();
    assert.ok(updates < 256, `unchanged ancestors updated ${updates} times for ${vertices} sole vertices`);
  });

  test(`${id}: every bare-foot vertex keeps its ground support through movement and combat`, async t => {
    const h = await actor(id); t.after(() => h.models.dispose());
    const parent = new THREE.Group(); parent.add(h.rig.root);
    parent.position.set(6336, 1, 4416); parent.rotation.y = -.43; parent.scale.set(1.1, .9, 1.05);
    const sole = h.rig.dojoSoles!, mesh = sole.mesh, index = mesh.geometry.index!, position = mesh.geometry.attributes.position;
    const complete = [...new Set(Array.from({ length: index.count }, (_, i) => index.getX(i)))].filter(i => position.getY(i) < .2);
    assert.deepEqual(sole.indices, complete, 'support must not use a reduced subset of the visible feet');
    const poses = [newMotion(), ...[.4, 3.4, 7.2].flatMap(speed => [0, .25, .5, .75].map(phase => Object.assign(newMotion(), { speed, phase }))),
      ...MELEE_COMBO.flatMap((strike, combo) => [0, strike.contact, strike.duration, strike.duration + .15].map(attackAge => Object.assign(newMotion(), { combo, attackAge }))),
      ...[0, .08, .2, .4, .65].map(skillAge => Object.assign(newMotion(), { skill: 'dodge', skillAge }))];
    const point = new THREE.Vector3();
    for (const yaw of [0, .72, -1.9]) for (const state of poses) {
      h.rig.root.rotation.y = yaw;
      const input = { speed: state.speed, grounded: true, verticalVelocity: 0, turn: .3, dojoOutfit: id, dojoSparring: true };
      const motion = { ...state };
      h.models.animate(h.rig, advanceMotion(motion, input, 0), motion, input, 0); parent.updateMatrixWorld(true); mesh.skeleton.update();
      const inverse = h.rig.root.matrixWorld.clone().invert();
      let lowest = Infinity;
      for (const vertex of complete) {
        mesh.getVertexPosition(vertex, point).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);
        assert.ok(Number.isFinite(point.y)); lowest = Math.min(lowest, point.y);
      }
      assert.ok(Math.abs(lowest) < 2e-6, `${yaw}/${state.speed}/${state.combo}/${state.attackAge}/${state.skillAge}: foot floats or enters the floor by ${lowest}`);
    }
  });
}
