import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { DOJO_BODY_CLEARANCE, MELEE_COMBO } from '@auto_matrix/shared';
import { actor } from './helpers/fighting-hand-fixture.mjs';
import { crossings } from './helpers/hand-self-contact.mjs';
import { advanceMotion, newMotion } from '../packages/client/src/agents/CharacterMotion.js';

test('dojo body scan reproduces the recorded penetration and verifies three-meter clearance', async t => {
  const neo = await actor('neo'), morpheus = await actor('morpheus');
  t.after(() => { neo.models.dispose(); morpheus.models.dispose(); });
  const neoPosition = { x: 6336, y: 0, z: 4419.159979559291 };
  const input = (id: 'neo' | 'morpheus') => ({ speed: 0, grounded: true, verticalVelocity: 0, turn: 0, dojoOutfit: id, dojoSparring: true });
  const surfaces = (fighter: typeof neo) => {
    const faces: { face: number; ids: number[]; points: THREE.Vector3[]; box: THREE.Box3 }[] = [];
    let face = 0;
    fighter.rig.root.traverseVisible(object => {
      if (!(object instanceof THREE.SkinnedMesh)) return;
      object.skeleton.update();
      const index = object.geometry.index!;
      for (let i = 0; i < index.count; i += 3) {
        const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
        const points = ids.map(id => object.getVertexPosition(id, new THREE.Vector3()).applyMatrix4(object.matrixWorld));
        faces.push({ face: face++, ids, points, box: new THREE.Box3().setFromPoints(points) });
      }
    });
    return faces;
  };
  const results: { separation: number; combo: number; age: number; intersections: number }[] = [];
  for (const separation of [2.092899559291, DOJO_BODY_CLEARANCE]) for (let combo = 0; combo < MELEE_COMBO.length; combo++) {
    const contact = MELEE_COMBO[combo].contact;
    for (const age of [contact, contact + .05, contact + .1]) {
      neo.rig.root.position.set(neoPosition.x, neoPosition.y, neoPosition.z); neo.rig.root.rotation.y = Math.PI;
      morpheus.rig.root.position.set(neoPosition.x, 0, neoPosition.z - separation); morpheus.rig.root.rotation.y = 0;
      const motion = newMotion(); motion.combo = combo; motion.attackAge = age;
      const guard = newMotion(); guard.attackAge = 10;
      for (const [fighter, id, state] of [[neo, 'neo', motion], [morpheus, 'morpheus', guard]] as const) {
        const controls = input(id);
        fighter.models.animate(fighter.rig, advanceMotion(state, controls, 0), state, controls, 0);
        fighter.rig.root.updateMatrixWorld(true);
      }
      results.push({ separation, combo, age, intersections: crossings(surfaces(neo), surfaces(morpheus), false).count });
    }
  }
  const recordedDistance = results.filter(result => result.separation < DOJO_BODY_CLEARANCE);
  const clearDistance = results.filter(result => result.separation === DOJO_BODY_CLEARANCE);
  assert.ok(recordedDistance.every(result => result.intersections > 0), 'the former two-meter counter position must reproduce the penetration');
  assert.ok(clearDistance.every(result => result.intersections === 0), 'the enforced clearance must keep all counter poses outside Morpheus');
});
