import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { actor } from './helpers/fighting-hand-fixture.mjs';
import { handSurface } from './helpers/hand-surface.mjs';

for (const id of ['neo', 'trinity', 'morpheus', 'smith'] as const) test(`${id}: adding the MCP span preserves an unchanged hand`, async t => {
  const h = await actor(id, scene => { const skin = scene.getObjectByName('Anatomical_head_and_hands'); if (skin) skin.userData.articulatedMcp = true; });
  t.after(() => h.models.dispose());
  const surfaces = ['R', 'L'].map(side => handSurface(h.rig, side));
  h.rig.root.updateMatrixWorld(true);
  const before = surfaces.map(surface => surface.posePoints());
  const component = h.models['fightingHands'].get(h.rig)!;
  component.begin({ speed: 0, grounded: true, verticalVelocity: 0, turn: 0 });
  component.pose('R', 0); component.pose('L', 0); component.update();
  for (const [i, surface] of surfaces.entries()) for (const [vertex, point] of surface.posePoints())
    assert.ok(point.distanceTo(before[i].get(vertex)!) < 2e-6, `MCP rest correction dents vertex ${vertex}`);
});

test('MCP hand skin stays stable through a wrist scale, a release and a repeated pose', async t => {
  const h = await actor('neo', scene => { const skin = scene.getObjectByName('Anatomical_head_and_hands'); if (skin) skin.userData.articulatedMcp = true; });
  t.after(() => h.models.dispose());
  const surface = handSurface(h.rig, 'R');
  h.draw(.75); const expected = surface.posePoints();
  h.rig.bones.get('wrist_R')!.scale.set(1.03, .97, 1.02);
  h.models['fightingHands'].get(h.rig)!.update(); h.rig.root.updateMatrixWorld(true);
  for (const [vertex, point] of surface.posePoints()) assert.ok(point.distanceTo(expected.get(vertex)!) < 2e-6);
  h.rig.bones.get('wrist_R')!.scale.set(1, 1, 1); h.draw(0); h.draw(.75);
  for (const [vertex, point] of surface.posePoints()) assert.ok(point.distanceTo(expected.get(vertex)!) < 2e-6);
  const skin = surface.group.skin, before = skin.geometry.attributes.position.array.slice();
  h.draw(.75); assert.deepEqual(skin.geometry.attributes.position.array, before);
});

test('Morpheus MCP palm keeps continuous volume during the authored chin fist', async t => {
  const h = await actor('morpheus', scene => { const skin = scene.getObjectByName('Anatomical_head_and_hands'); if (skin) skin.userData.articulatedMcp = true; });
  t.after(() => h.models.dispose());
  const surface = handSurface(h.rig, 'R');
  const { advanceMotion, newMotion } = await import('../packages/client/src/agents/CharacterMotion.js');
  const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, nebCrew: 'morpheus' as const,
    nebCrewEarly: true, training: { kind: 'download' as const, role: 'morpheus' as const, elapsed: 9.7 } }, state = newMotion();
  h.models.animate(h.rig, advanceMotion(state, input, 0), state, input, 0); h.rig.root.updateMatrixWorld(true);
  assert.equal(surface.draw().self.count, 0, 'the authored fist must not fold the MCP webs back through the hand');
});
