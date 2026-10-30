import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { newSmithFinale } from '@auto_matrix/shared';
import { actor } from './helpers/fighting-hand-fixture.mjs';
import { advanceMotion, newMotion } from '../packages/client/src/agents/CharacterMotion.js';
import { SmithFaceImpact } from '../packages/client/src/agents/SmithFaceImpact.js';

function addBrow(relative = true) {
  return (scene: THREE.Group) => {
    const skin = scene.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
    if (!skin) return;
    const position = skin.geometry.attributes.position;
    const target = relative ? new THREE.BufferAttribute(new Float32Array(position.count * 3), 3) : position.clone();
    for (let i = 0; i < position.count; i++) if (position.getY(i) > 4.12 && position.getZ(i) > .2)
      target.setY(i, target.getY(i) + .02);
    skin.geometry.morphAttributes.position = [target];
    skin.geometry.morphAttributes.normal = [relative ? new THREE.BufferAttribute(new Float32Array(position.count * 3), 3) : skin.geometry.attributes.normal.clone()];
    skin.geometry.morphTargetsRelative = relative; skin.updateMorphTargets();
    // GLTFLoader reads targetNames into the mesh dictionary; the underlying
    // position attributes do not necessarily carry those names.
    skin.morphTargetDictionary = { smithBrowRaise: 0 };
  };
}

function frame(h: Awaited<ReturnType<typeof actor>>, elapsed?: number) {
  const state = newMotion();
  const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0,
    interrogation: elapsed === undefined ? undefined : { phase: 'coercion' as const, elapsed, role: 'smith' as const } };
  h.models.animate(h.rig, advanceMotion(state, input, 0), state, input, 0);
  const skin = h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  return skin.morphTargetInfluences![skin.morphTargetDictionary!.smithBrowRaise];
}

test('Smith’s saved interrogation clock raises and releases the brow, including a paused cold load', async t => {
  const warm = await actor('smith', addBrow()), cold = await actor('smith', addBrow());
  t.after(() => { warm.models.dispose(); cold.models.dispose(); });
  assert.equal(frame(warm, 0), 0);
  for (let elapsed = 0; elapsed < 1.2; elapsed += 1 / 60) frame(warm, elapsed);
  assert.ok(frame(warm, 1.2) > .99, 'the questioning expression must reach its authored shape');
  assert.equal(frame(cold, JSON.parse(JSON.stringify({ elapsed: 1.2 })).elapsed), frame(warm, 1.2));
  frame(warm);
  assert.equal(frame(warm, 1.2), frame(cold, 1.2), 'returning from ordinary movement restores the saved expression');
  assert.equal(frame(warm, 4), 0);
  assert.equal(frame(warm), 0);
  const other = { ...warm, rig: (await warm.models.create('smith'))! };
  frame(warm, 1.2);
  assert.equal(frame(other, 0), 0);
  assert.equal((warm.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh).morphTargetInfluences![0], 1,
    'another Smith instance cannot change this actor’s expression');
});

for (const relative of [true, false]) test(`Smith’s private cheek impact preserves an existing ${relative ? 'relative' : 'absolute'} brow shape`, async t => {
  const h = await actor('smith', addBrow(relative)); t.after(() => h.models.dispose()); h.draw(0);
  const skin = h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  const original = skin.geometry, influences = skin.morphTargetInfluences!; influences[0] = .6;
  const p = original.attributes.position;
  const index = Array.from({ length: p.count }, (_, i) => i).find(i => p.getY(i) > 4.22 && p.getZ(i) > .2)!;
  skin.skeleton.update(); const before = skin.getVertexPosition(index, new THREE.Vector3());
  const impact = new SmithFaceImpact(h.rig);
  try {
    assert.equal(skin.morphTargetDictionary!.smithBrowRaise, 0);
    assert.equal(skin.morphTargetInfluences![0], .6);
    impact.update({ ...newSmithFinale(), phase: 'pit_punch', elapsed: .95, total: 70.95, checkpoint: 'pit', impactAt: 51, pitFight: true });
    assert.ok(before.distanceTo(skin.getVertexPosition(index, new THREE.Vector3())) < 1e-6, 'a cheek impact must preserve the raised forehead');
    assert.equal(original.morphAttributes.position.length, 1, 'the shared actor geometry remains unchanged');
  } finally { impact.dispose(); }
  assert.equal(skin.geometry, original); assert.equal(skin.morphTargetInfluences, influences);
  assert.ok(before.distanceTo(skin.getVertexPosition(index, new THREE.Vector3())) < 1e-6);
});
