import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, SMITH_FINALE, newSmithFinale, smithFinalePose, smithFinaleLocked, stepSmithFinale, retrySmithFinale,
  groundHeight, stepPlayer, playerBlocked, type SmithFinaleEncounter, type WorldStructure } from '@auto_matrix/shared';
import { SmithFinaleRenderer } from '../packages/client/src/engine/SmithFinaleRenderer.js';

const held = { focus: true, x: 0, z: 0 };
const idle = { focus: false, x: 0, z: 0 };

test('bracing during the fall cannot skip the remaining descent or choose to stand', () => {
  let beat: SmithFinaleEncounter = { ...newSmithFinale(), phase: 'descent', total: 12 };
  beat = stepSmithFinale(beat, held, SMITH_FINALE.descent.braceSeconds);
  assert.equal(beat.phase, 'descent', 'charging G early must not teleport Neo to the crater');
  beat = stepSmithFinale(beat, held, SMITH_FINALE.descent.seconds - beat.elapsed);
  assert.equal(beat.phase, 'crater'); assert.equal(beat.focus, 0);
  beat = stepSmithFinale(beat, idle, 4); assert.equal(beat.phase, 'crater');
  const missed = stepSmithFinale({ ...newSmithFinale(), phase: 'descent' }, idle, SMITH_FINALE.descent.seconds);
  assert.equal(missed.phase, 'failed'); assert.equal(retrySmithFinale(missed).phase, 'air_warning');
});

test('building exit, falling and impact meet at the same saved body positions', () => {
  for (const lane of [-1, 0, .7]) {
    const building: SmithFinaleEncounter = { ...newSmithFinale(), roomFight: undefined, phase: 'building', elapsed: SMITH_FINALE.building - .00001, total: 18, lane };
    const fall = stepSmithFinale(building, idle, .00001);
    assert.equal(fall.phase, 'descent');
    const landing: SmithFinaleEncounter = { ...fall, elapsed: SMITH_FINALE.descent.seconds - .00001, total: 21.4, focus: SMITH_FINALE.descent.braceSeconds };
    const crater = stepSmithFinale(landing, held, .00001);
    assert.equal(crater.phase, 'crater');
    for (const [before, after] of [[building, fall], [landing, crater]]) for (const role of ['neo', 'smith'] as const) {
      const a = smithFinalePose(before)[role], b = smithFinalePose(after)[role];
      assert.ok(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < .003,
        `${role} jumps at ${before.phase} → ${after.phase}`);
      assert.ok(Math.abs(Math.sin(a.yaw - b.yaw)) < .003, `${role} snaps around at ${before.phase} → ${after.phase}`);
    }
  }
});

test('missing the brace holds the fallen bodies until an explicit retry', () => {
  const landing: SmithFinaleEncounter = { ...newSmithFinale(), phase: 'descent',
    elapsed: SMITH_FINALE.descent.seconds - .00001, total: 12, checkpoint: 'air' };
  const missed = stepSmithFinale(landing, idle, .00001);
  assert.equal(missed.phase, 'failed');
  for (const role of ['neo', 'smith'] as const) {
    const a = smithFinalePose(landing)[role], b = smithFinalePose(missed)[role];
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < .003, `${role} leaves the impact position on failure`);
  }
  assert.equal(smithFinalePose(missed).fallen, 1);
  assert.equal(smithFinaleLocked(missed), true);
  assert.deepEqual(stepSmithFinale(missed, held, 5), missed, 'waiting cannot play or reset a failed fall');
  const retried = retrySmithFinale(missed);
  assert.equal(retried.phase, 'air_warning'); assert.equal(retried.impactAt, undefined);
});

function surface(root: THREE.Group, x: number, z: number): number {
  root.updateMatrixWorld(true);
  const meshes: THREE.Object3D[] = [];
  root.traverseVisible(object => { if (object instanceof THREE.Mesh) meshes.push(object); });
  const ray = new THREE.Raycaster(new THREE.Vector3(x, 50, z), new THREE.Vector3(0, -1, 0));
  return ray.intersectObjects(meshes, false)[0]?.point.y ?? -Infinity;
}

test('impact cuts through asphalt, paint and reflected water, leaving a deep supported floor', () => {
  const root = new THREE.Group(), renderer = new SmithFinaleRenderer(root);
  try {
    const beat: SmithFinaleEncounter = { ...newSmithFinale(), phase: 'descent', elapsed: 1, total: 12 };
    renderer.update(beat, false, { x: 0, z: -38 });
    assert.ok(Math.abs(surface(root, 0, -38)) < .1, 'the avenue must remain intact before contact');
    renderer.update({ ...beat, phase: 'choice', elapsed: 0 }, false, { x: 0, z: -38 });
    for (const x of [0, -.22, .22, 3]) assert.ok(surface(root, x, -38) < -8,
      `unbroken road, paint or reflection still covers the pit at x=${x}`);
    assert.ok(Math.abs(surface(root, 19, -38)) < .1, 'the undamaged curbside road must keep its height');
    renderer.update(retrySmithFinale({ ...beat, phase: 'failed', checkpoint: 'air' }), false, { x: 0, z: -25 });
    assert.ok(Math.abs(surface(root, 0, -38)) < .1, 'retry must restore the surface before the next impact');
  } finally { renderer.dispose(); }
});

test('normal movement and collision follow the saved crater instead of snapping to street level', () => {
  const center = FILM_SETS.film_smith_avenue.center;
  const terrain: WorldStructure[] = [{ id: 'film:smith:crater', kind: 'crater', owner: 'matrix', matrix: true, health: 1,
    position: { ...center, z: center.z - 38 }, film: { scene: 'm3_rain', width: 38, depth: 38, height: 12 } }];
  const input = { x: .7, z: 0, yaw: 0, sprint: false, jump: false, sequence: 1 };
  let position = { ...center, y: center.y - 12 + .025, z: center.z - 38 };
  assert.ok(groundHeight(position, true, terrain) < center.y - 8);
  assert.equal(playerBlocked(position, true, 1.1, terrain), false);
  for (let i = 0; i < 30; i++) position = stepPlayer(position, 0, input, .05, true, terrain).position;
  assert.ok(position.x > center.x + 2, 'Neo must be able to walk across the pit bottom');
  assert.ok(position.y < center.y - 8, 'movement must not lift Neo onto the old invisible road');
  for (let i = 0; i < 300; i++) position = stepPlayer(position, 0, input, .05, true, terrain).position;
  assert.ok(position.x < center.x + SMITH_FINALE.crater.floorRadius, 'walking must stop at the collapsed bank instead of climbing through its rubble');
  assert.equal(groundHeight({ ...center, z: center.z - 38 }, true, []), center.y, 'undamaged scenes keep the original street');
});
