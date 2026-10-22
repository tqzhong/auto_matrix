import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { actor, bends, fingerGroups } from './helpers/fighting-hand-fixture.mjs';
import { handSurface } from './helpers/hand-surface.mjs';
import { advanceMotion, newMotion } from '../packages/client/src/agents/CharacterMotion.js';

for (const id of ['neo', 'trinity', 'smith', 'morpheus'] as const) {
  test(`${id}: the complete fighting hands stay closed surfaces throughout a full grip`, async t => {
    const h = await actor(id); t.after(() => h.models.dispose());
    const surfaces = ['R', 'L'].map(side => handSurface(h.rig, side));
    h.rig.root.position.set(-3, 2, 1); h.rig.root.rotation.y = .37;
    for (const grip of Array.from({ length: 21 }, (_, i) => i / 20)) {
      h.draw(grip);
      for (const [which, side] of ['R', 'L'].entries()) {
        const surface = surfaces[which], result = surface.draw(), skin = surface.group.skin, a = skin.geometry.attributes;
        assert.equal(surface.vertices.length, 6673, 'include the entire connected palm, thumb, fingers and webs');
        assert.equal(surface.triangles.length, 12472, 'keep every original hand triangle');
        assert.equal(result.self.count, 0, `${side}, grip ${grip}: ${JSON.stringify(result.self)}`);
        const twins = new Map<number, THREE.Vector3>();
        for (const vertex of surface.vertices) {
          const point = result.points.get(vertex)!;
          assert.ok(point.toArray().every(Number.isFinite));
          const twin = twins.get(surface.weld[vertex]);
          if (twin) assert.ok(twin.distanceTo(point) < 2e-6, `${side}/${grip}: UV seam opens at ${vertex}`);
          else twins.set(surface.weld[vertex], point);
          const normal = new THREE.Vector3().fromBufferAttribute(a.normal, vertex);
          assert.ok(normal.toArray().every(Number.isFinite) && normal.length() > .99 && normal.length() < 1.01);
          const weights = [0, 1, 2, 3].map(k => a.skinWeight.getComponent(vertex, k));
          assert.ok(weights.every(weight => weight >= 0) && Math.abs(weights.reduce((a, b) => a + b, 0) - 1) < 1e-6);
          assert.ok(skin.boundingBox!.containsPoint(skin.getVertexPosition(vertex, new THREE.Vector3())), 'deformation remains inside the actual culling bound');
        }
        if (grip === 1) for (const finger of bends(h.rig, side, fingerGroups(h.rig, side))) {
          assert.ok(finger.PIP <= (finger.digit === 1 ? 100 : 115) && finger.DIP <= 90, `${side}: digit ${finger.digit} exceeds the existing curl constraints`);
          if (finger.digit > 1) assert.ok(finger.curvature >= -.015, 'adjacent phalanges curl in the same direction');
        }
      }
    }
  });
}

test('a saved combat hand restores the same skin after unrelated movement and a release', async t => {
  const h = await actor('neo'), cold = await actor('neo'); t.after(() => { h.models.dispose(); cold.models.dispose(); });
  const skin = (rig: typeof h.rig) => rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  const snapshot = (rig: typeof h.rig) => Object.fromEntries(['position', 'normal', 'skinIndex', 'skinWeight'].map(name => [name, Array.from(skin(rig).geometry.attributes[name].array)]));
  for (const grip of [0, .65, 1]) {
    h.draw(1); h.draw(0); h.draw(grip); cold.draw(grip);
    assert.deepEqual(snapshot(h.rig), snapshot(cold.rig), `saved grip ${grip} carries no skin history`);
    const paused = snapshot(h.rig); h.draw(grip); assert.deepEqual(snapshot(h.rig), paused, 'a paused pose does not accumulate correction');
  }
});

test('a phone gesture restores the original right-hand binding after a fighting grip', async t => {
  const h = await actor('neo'); t.after(() => h.models.dispose());
  const surface = handSurface(h.rig, 'R'), skin = surface.group.skin;
  const original = Object.fromEntries(['position', 'normal', 'skinIndex', 'skinWeight'].map(name => [name, surface.vertices.flatMap(id => Array.from({ length: skin.geometry.attributes[name].itemSize }, (_, k) => skin.geometry.attributes[name].getComponent(id, k)))]));
  h.draw(1);
  const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, phone: { phase: 'connected' as const, elapsed: 1.8 } }, state = newMotion();
  h.models.animate(h.rig, advanceMotion(state, input, 0), state, input, 0); h.rig.root.updateMatrixWorld(true);
  for (const name of ['position', 'normal', 'skinIndex', 'skinWeight']) {
    const a = skin.geometry.attributes[name], actual = surface.vertices.flatMap(id => Array.from({ length: a.itemSize }, (_, k) => a.getComponent(id, k)));
    assert.deepEqual(actual, original[name], `${name}: the prop solver uses its authored right-hand skin`);
  }
  h.draw(1); assert.equal(surface.draw().self.count, 0, 'releasing the phone returns to the corrected fighting skin');
});

test('partially posed prop fingers match the original gesture without combat posing', async t => {
  const h = await actor('neo'), reference = await actor('neo');
  t.after(() => { h.models.dispose(); reference.models.dispose(); });
  // A reference with the optional combat component removed must keep the
  // same ordinary phone/mug/weapon calculations, including partial blends.
  const registry = (reference.models as unknown as { fightingHands: Map<typeof reference.rig, { dispose(): void }> }).fightingHands;
  registry.get(reference.rig)!.dispose(); registry.delete(reference.rig);
  const surface = handSurface(h.rig, 'R'), referenceSkin = reference.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  const contexts = [
    { phone: { phase: 'pickup' as const, elapsed: .8 } },
    { phone: { phase: 'connected' as const, elapsed: 1.8 } },
    ...[['accepting', .77], ['sipping', 1.8], ['returning', 2.68]].map(([phase, elapsed]) => ({ interlude: { kind: 'console' as const, role: 'neo' as const, phase: phase as 'accepting' | 'sipping' | 'returning', elapsed: elapsed as number, physicalConsole: true } })),
    { armed: true, weaponStyle: 'hel_pistol' as const },
  ];
  for (const context of contexts) {
    h.draw(1);
    for (const current of [h, reference]) {
      const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, ...context }, state = newMotion();
      current.models.animate(current.rig, advanceMotion(state, input, 0), state, input, 0); current.rig.root.updateMatrixWorld(true);
    }
    surface.group.skin.skeleton.update(); referenceSkin.skeleton.update();
    for (const vertex of surface.vertices) {
      const actual = surface.group.skin.getVertexPosition(vertex, new THREE.Vector3()).applyMatrix4(surface.group.skin.matrixWorld);
      const expected = referenceSkin.getVertexPosition(vertex, new THREE.Vector3()).applyMatrix4(referenceSkin.matrixWorld);
      assert.ok(actual.distanceTo(expected) < 1e-8, `${JSON.stringify(context)}: combat posing changes a held finger at ${vertex}`);
    }
  }
});

test('actors sharing one loaded asset keep independent hands across outfit and prop changes', async t => {
  for (const id of ['neo', 'trinity', 'smith', 'morpheus'] as const) {
    const h = await actor(id); t.after(() => h.models.dispose());
    const other = (await h.models.create(id))!;
    const skin = (rig: typeof h.rig) => rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
    const snapshot = (rig: typeof h.rig) => Object.fromEntries(['position', 'normal', 'skinIndex', 'skinWeight'].map(name => {
      const a = skin(rig).geometry.attributes[name].array;
      return [name, createHash('sha256').update(Buffer.from(a.buffer, a.byteOffset, a.byteLength)).digest('hex')];
    }));
    const draw = (rig: typeof h.rig, grip: number, context = {}) => {
      const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, ...context }, state = newMotion(), pose = advanceMotion(state, input, 0);
      pose.arms.forEach(arm => { arm.grip = grip; }); h.models.animate(rig, pose, state, input, 0); rig.root.updateMatrixWorld(true);
    };
    for (const context of [{}, { homeClothes: true }, { firstPerson: true, homeClothes: true }]) {
      draw(h.rig, 1, context); const closed = snapshot(h.rig);
      draw(other, 0, context); assert.deepEqual(snapshot(h.rig), closed, `${id}: another actor opens the first actor's hand`);
      const open = snapshot(other);
      draw(h.rig, .5, context); assert.deepEqual(snapshot(other), open, `${id}: another actor changes the open hand`);
      draw(h.rig, 1, context);
      draw(other, 0, { phone: { phase: 'connected', elapsed: 1.8 } });
      assert.deepEqual(snapshot(h.rig), closed, `${id}: a prop gesture restores another actor's skin`);
    }
  }
});

test('the zero mirror tint from player controls keeps ordinary fighting hands enabled', async t => {
  const h = await actor('neo'); t.after(() => h.models.dispose());
  const skin = h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  const snapshot = () => Object.fromEntries(['position', 'normal', 'skinIndex', 'skinWeight'].map(name => {
    const a = skin.geometry.attributes[name].array;
    return [name, createHash('sha256').update(Buffer.from(a.buffer, a.byteOffset, a.byteLength)).digest('hex')];
  }));
  const original = snapshot(); h.draw(1); const closed = snapshot();
  const draw = (context: { mirror?: number; mirrorBeat?: number }) => {
    const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, ...context }, state = newMotion(), pose = advanceMotion(state, input, 0);
    pose.arms.forEach(arm => { arm.grip = 1; }); h.models.animate(h.rig, pose, state, input, 0);
  };
  draw({ mirror: 0 }); assert.deepEqual(snapshot(), closed, 'the inactive silver tint must not opt out a controlled character');
  draw({ mirror: .4 }); assert.deepEqual(snapshot(), original, 'an active mirror effect keeps its authored binding');
  draw({ mirror: 0, mirrorBeat: 0 }); assert.deepEqual(snapshot(), original, 'the start of a timed story pose is still an explicit gesture');
});
