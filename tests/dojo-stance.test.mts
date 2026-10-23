import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { actor } from './helpers/fighting-hand-fixture.mjs';
import { advanceMotion, newMotion } from '../packages/client/src/agents/CharacterMotion.js';

for (const id of ['neo', 'morpheus'] as const) {
  test(`${id}: dojo guard has a planted staggered base and a closed lead fist`, async t => {
    const h = await actor(id); t.after(() => h.models.dispose());
    h.draw(1);
    const closed = ['R', 'L'].flatMap(side => Array.from({ length: 5 }, (_, digit) =>
      [1, 2, 3].map(joint => h.rig.bones.get(`finger${digit + 1}-${joint}_${side}`)!.quaternion.clone()))).flat();
    const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, dojoOutfit: id, dojoSparring: true }, motion = newMotion();
    h.models.animate(h.rig, advanceMotion(motion, input, 0), motion, input, 0); h.rig.root.updateMatrixWorld(true);
    const point = (name: string) => h.rig.root.worldToLocal(h.rig.bones.get(name)!.getWorldPosition(new THREE.Vector3()));
    const front = point('ankle_R'), rear = point('ankle_L');
    assert.ok(front.z - rear.z > .5, 'the lead foot must step ahead of the rear foot rather than stand with both ankles level');
    assert.ok(rear.x - front.x > .75, 'the supporting feet form a stable base wider than the hips');
    const lead = point('wrist_R'), support = point('wrist_L');
    assert.ok(lead.z - support.z > .16 && lead.y - support.y > .08, 'the lead hand and protecting hand must have distinct roles');
    assert.ok(lead.y > point('chest').y && support.y > point('chest').y - .1, 'guard hands protect the upper body');
    const sole = h.rig.dojoSoles!, skin = sole.mesh; skin.skeleton.update();
    for (const side of ['R', 'L']) {
      const indices = sole.indices.filter(i => side === 'R' ? skin.geometry.attributes.position.getX(i) < 0 : skin.geometry.attributes.position.getX(i) > 0);
      const lowest = Math.min(...indices.map(i => skin.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(skin.matrixWorld).applyMatrix4(h.rig.root.matrixWorld.clone().invert()).y));
      assert.ok(Math.abs(lowest) < .015, `${side}: the supporting bare foot floats or cuts into the mat: ${lowest}`);
      assert.ok(h.rig.bones.get('wrist_' + side)!.quaternion.angleTo(new THREE.Quaternion()) < .15, 'the guarded fist stays aligned with the forearm');
    }
    const fingers = ['R', 'L'].flatMap(side => Array.from({ length: 5 }, (_, digit) =>
      [1, 2, 3].map(joint => h.rig.bones.get(`finger${digit + 1}-${joint}_${side}`)!.quaternion))).flat();
    fingers.forEach((rotation, i) => assert.ok(rotation.angleTo(closed[i]) < 1e-6, 'the guard closes into the already validated fighting fist'));
  });
}

for (const id of ['neo', 'morpheus'] as const) {
  test(`${id}: guarded hands stay outside the gi through jab, cross, kick and recovery`, async t => {
    const { handSurface } = await import('./helpers/hand-surface.mjs');
    const { crossings } = await import('./helpers/hand-self-contact.mjs');
    const { MELEE_COMBO } = await import('@auto_matrix/shared');
    const h = await actor(id); t.after(() => h.models.dispose());
    h.rig.root.position.set(13, -2, 7); h.rig.root.rotation.y = .67;
    const hands = ['R', 'L'].map(side => {
      const surface = handSurface(h.rig, side), mesh = surface.group.skin;
      const inverse = mesh.skeleton.boneInverses[mesh.skeleton.bones.indexOf(h.rig.bones.get('wrist_' + side)!)];
      // The wrist is intentionally overlapped by the cuff. Check the complete
      // exposed palm and fingers beyond that shared clothing boundary.
      const exposed = new Set(surface.vertices.filter(vertex => new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, vertex).applyMatrix4(mesh.bindMatrix).applyMatrix4(inverse).y < -.14));
      return { surface, triangles: surface.triangles.filter(face => face.ids.every(id => exposed.has(id))) };
    });
    const jacket = h.rig.root.getObjectByName(id + '-dojo-jacket') as THREE.SkinnedMesh;
    const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, dojoOutfit: id, dojoSparring: true };
    const phases = [{ combo: 0, age: 10 }, ...MELEE_COMBO.flatMap((strike, combo) =>
      [...Array.from({ length: Math.ceil((strike.duration + .2) * 30) + 1 }, (_, frame) => frame / 30), strike.contact].map(age => ({ combo, age })))];
    for (const { combo, age } of phases) {
      const motion = newMotion(); motion.combo = combo; motion.attackAge = age;
      h.models.animate(h.rig, advanceMotion(motion, input, 0), motion, input, 0); h.rig.root.updateMatrixWorld(true); jacket.skeleton.update();
      const inverse = h.rig.root.matrixWorld.clone().invert();
      const positions = Array.from({ length: jacket.geometry.attributes.position.count }, (_, i) => jacket.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(jacket.matrixWorld).applyMatrix4(inverse));
      const index = jacket.geometry.index!;
      const cloth = Array.from({ length: index.count / 3 }, (_, face) => {
        const ids = [0, 1, 2].map(k => index.getX(face * 3 + k)), points = ids.map(id => positions[id]);
        return { face, ids, points, box: new THREE.Box3().setFromPoints(points) };
      });
      for (const { surface, triangles } of hands) {
        const skin = surface.group.skin; skin.skeleton.update();
        const points = new Map(surface.vertices.map(vertex => [vertex, skin.getVertexPosition(vertex, new THREE.Vector3()).applyMatrix4(skin.matrixWorld).applyMatrix4(inverse)]));
        const faces = triangles.map(face => { const p = face.ids.map(id => points.get(id)!); return { ...face, points: p, box: new THREE.Box3().setFromPoints(p) }; });
        assert.ok(faces.length > 9000, 'retain the full exposed hand rather than only landmark samples');
        const result = crossings(faces, cloth, false);
        assert.equal(result.count, 0, `${id} ${combo}/${age}: exposed hand enters the jacket: ${JSON.stringify(result)}`);
      }
    }
  });
}

test('dojo movement and a cold paused guard keep independent bone poses', async t => {
  const h = await actor('neo'), cold = await actor('neo'); t.after(() => { h.models.dispose(); cold.models.dispose(); });
  const ordinary = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 }, guarded = { ...ordinary, dojoOutfit: 'neo' as const, dojoSparring: true };
  const draw = (model: typeof h, input: typeof ordinary, state = newMotion()) => {
    model.models.animate(model.rig, advanceMotion(state, input, 0), state, input, 0); model.rig.root.updateMatrixWorld(true);
    return [...model.rig.bones].map(([name, bone]) => ({ name, position: bone.position.toArray(), rotation: bone.quaternion.toArray() }));
  };
  const saved = draw(h, guarded);
  for (const speed of [0, .4, 1, 2.2, 6]) {
    const state = newMotion(); state.speed = speed; draw(h, { ...guarded, speed }, state);
    for (const bone of h.rig.bones.values()) assert.ok(bone.matrixWorld.elements.every(Number.isFinite));
  }
  assert.deepEqual(draw(h, guarded), saved, 'returning from walking reproduces the full guard');
  assert.deepEqual(draw(cold, guarded), saved, 'cold loading does not depend on a previous stance');
  assert.deepEqual(draw(h, ordinary), draw(cold, ordinary), 'leaving releases every ordinary bone pose');
});

for (const id of ['neo', 'morpheus'] as const) {
  test(`${id}: entering and leaving stance IK does not snap the arm or leg joints`, async t => {
    const { MELEE_COMBO, COMBAT_SKILLS } = await import('@auto_matrix/shared');
    const h = await actor(id); t.after(() => h.models.dispose());
    const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, dojoOutfit: id, dojoSparring: true };
    const boundaries = [
      ...MELEE_COMBO.flatMap((strike, combo) => [.06, strike.duration].map(at => ({ name: `attack ${combo}/${at}`, at,
        state: (time: number) => Object.assign(newMotion(), { combo, attackAge: time }) }))),
      { name: 'walk', at: 2.2, state: (speed: number) => Object.assign(newMotion(), { speed }) },
      { name: 'dodge', at: .08, state: (skillAge: number) => Object.assign(newMotion(), { skill: 'dodge', skillAge }) },
      { name: 'dodge recovery', at: COMBAT_SKILLS.dodge.duration, state: (skillAge: number) => Object.assign(newMotion(), { skill: 'dodge', skillAge }) },
    ];
    const draw = (motion: ReturnType<typeof newMotion>) => {
      const moving = { ...input, speed: motion.speed };
      h.models.animate(h.rig, advanceMotion(motion, moving, 0), motion, moving, 0); h.rig.root.updateMatrixWorld(true);
      return [...h.rig.bones].map(([name, bone]) => ({ name, q: bone.quaternion.clone(), p: bone.getWorldPosition(new THREE.Vector3()) }));
    };
    for (const { name, at, state } of boundaries) {
      const before = draw(state(at - 1e-6)), after = draw(state(at + 1e-6));
      after.forEach((bone, i) => {
        assert.ok(bone.q.angleTo(before[i].q) < .001, `${name}: ${bone.name} snaps as the stance weight crosses zero`);
        assert.ok(bone.p.distanceTo(before[i].p) < .001, `${name}: ${bone.name} jumps at the transition`);
      });
    }
  });
}
