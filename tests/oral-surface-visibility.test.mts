import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { actor, fingerGroups } from './helpers/fighting-hand-fixture.mjs';
import { advanceMotion, newMotion } from '../packages/client/src/agents/CharacterMotion.js';

test('authored oral surfaces hide with the first-person head and restore without changing the hands', async t => {
  const h = await actor('neo', scene => scene.traverse(object => {
    if (object.name.startsWith('neo-teeth') || object.name === 'neo-tongue') {
      object.name = object.name.replace('neo-', 'cast-oral-');
      object.userData.oralSurface = true;
    }
  }));
  t.after(() => h.models.dispose());
  const oral = h.rig.wardrobe.filter(part => part.mesh.userData.oralSurface).map(part => part.mesh);
  assert.equal(oral.length, 3, 'exercise the actual upper/lower dentition and tongue');
  const skin = h.rig.trackingSkin!;
  const draw = (firstPerson: boolean) => {
    const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, firstPerson,
      training: { kind: 'download' as const, role: 'neo' as const, elapsed: 9.7 } };
    const state = newMotion(); h.models.animate(h.rig, advanceMotion(state, input, 0), state, input, 0);
    h.rig.root.updateMatrixWorld(true);
  };
  draw(false);
  const ids = fingerGroups(h.rig, 'R').hand.filter((_, i) => i % 97 === 0);
  const points = ids.map(id => skin.mesh.getVertexPosition(id, new THREE.Vector3()));
  assert.ok(oral.every(mesh => mesh.visible));
  draw(true);
  assert.equal(skin.mesh.geometry, skin.firstPerson, 'the head has actually been removed from the rendered skin');
  assert.ok(oral.every(mesh => !mesh.visible), 'new oral anatomy must not remain around the first-person camera');
  const rendered = new Set(skin.mesh.geometry.index!.array);
  assert.ok(ids.every(id => rendered.has(id)), 'the real hand surface remains rendered');
  draw(false);
  assert.equal(skin.mesh.geometry, skin.original);
  assert.ok(oral.every(mesh => mesh.visible), 'third person restores the same authored surfaces');
  ids.forEach((id, i) => assert.ok(skin.mesh.getVertexPosition(id, new THREE.Vector3()).distanceTo(points[i]) < 1e-6));
});
