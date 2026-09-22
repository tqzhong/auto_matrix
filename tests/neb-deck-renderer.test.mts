import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, RECOVERY_BED, filmObstacles, filmPosition, playerBlocked, type FilmJourney } from '@auto_matrix/shared';
import { NebDeckRenderer } from '../packages/client/src/engine/NebDeckRenderer.js';

test('the Nebuchadnezzar recovery set has a solid medical bed, moving needle gantry and open route to the core', () => {
  const root = new THREE.Group(); const renderer = new NebDeckRenderer(root); root.updateMatrixWorld(true);
  try {
    const bed = root.getObjectByName('neb-medical-bed');
    const gantry = root.getObjectByName('neb-recovery-gantry');
    assert.ok(bed, 'the recovery sequence needs a visible bed');
    assert.ok(gantry, 'the needles need a physical support instead of a text prompt');
    assert.ok(root.getObjectByName('neb-core-chair-neo'));
    assert.ok(root.getObjectByName('neb-core-chair-morpheus'));
    const medicalLight = root.getObjectByName('neb-medical-task-light') as THREE.PointLight | undefined;
    assert.ok(medicalLight, 'the recovery bed needs dedicated task lighting');
    assert.ok(medicalLight.intensity >= 200, 'physical lighting must keep Neo and the needles readable');
    const ray = new THREE.Raycaster(new THREE.Vector3(RECOVERY_BED.x, 7, RECOVERY_BED.z), new THREE.Vector3(0, -1, 0), 0, 8);
    assert.ok(ray.intersectObject(bed!, true).length > 0, 'the body must lie on rendered geometry');
    const camera = new THREE.Vector3(RECOVERY_BED.x + 3, 5, RECOVERY_BED.z + 6);
    const focus = new THREE.Vector3(RECOVERY_BED.x, 2.45, RECOVERY_BED.z);
    const sight = new THREE.Raycaster(camera, focus.clone().sub(camera).normalize(), 0, camera.distanceTo(focus));
    assert.equal(sight.intersectObject(root, true).length, 0, 'the authored recovery camera cannot look through a gantry support');
    const journey = { version: 1, scene: 'm1_recovery', step: 0, actor: 'neo', completed: [], enteredAt: 0,
      checkpoint: filmPosition('film_neb_deck', RECOVERY_BED.x, RECOVERY_BED.z), reflections: {}, lastText: '',
      awakening: { kind: 'recovery', elapsed: 0, started: true } } satisfies FilmJourney;
    renderer.update(journey, 0); const raised = gantry!.position.y;
    journey.awakening.elapsed = 4; renderer.update(journey, 4);
    assert.ok(gantry!.position.y < raised - .5, 'the saved recovery clock lowers the needle rack toward Neo');
    const obstacles = filmObstacles(FILM_SETS.film_neb_deck);
    assert.ok(obstacles.some(item => Math.abs(item.x - RECOVERY_BED.x) < .1 && Math.abs(item.z - RECOVERY_BED.z) < .1));
    assert.equal(playerBlocked(filmPosition('film_neb_deck', RECOVERY_BED.standingX, RECOVERY_BED.z), false), false, 'Neo can stand beside the bed');
    for (const z of [-15, -8, 0]) assert.equal(playerBlocked(filmPosition('film_neb_deck', 0, z), false), false, `the central aisle stays open at ${z}`);
  } finally { renderer.dispose(); }
});
