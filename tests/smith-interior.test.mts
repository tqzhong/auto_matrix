import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { SMITH_FINALE, newSmithFinale, retrySmithFinale, smithFinaleAction, smithFinaleLocked,
  smithFinalePose, stepSmithFinale, type SmithFinaleEncounter } from '@auto_matrix/shared';
import { SmithFinaleRenderer } from '../packages/client/src/engine/SmithFinaleRenderer.js';

const input = { focus: false, x: 0, z: 0 };

test('the building collision enters a playable interior instead of automatically skipping to the crater', () => {
  const impact = { ...newSmithFinale(), phase: 'building' as const, total: 30 };
  const room = stepSmithFinale(impact, input, SMITH_FINALE.building);
  assert.equal(room.phase, 'interior_warning');
  assert.equal(room.checkpoint, 'interior');
  assert.deepEqual(smithFinaleAction(room, 'attack'), room, 'early attack cannot skip the telegraph');
  const window = stepSmithFinale(room, input, SMITH_FINALE.interior.warning);
  const counter = smithFinaleAction(window, 'dodge');
  assert.equal(counter.phase, 'interior_counter');
  assert.equal(smithFinaleAction(counter, 'attack').phase, 'interior_kick');
  assert.equal(stepSmithFinale(counter, input, SMITH_FINALE.interior.counter).phase, 'failed', 'waiting cannot perform Neo’s kick');
});

test('an interior failure freezes the saved pose above the street and retries there without resetting other encounter results', () => {
  const window: SmithFinaleEncounter = { ...newSmithFinale(), phase: 'interior_dodge', total: 35,
    elapsed: SMITH_FINALE.interior.dodge - .01, checkpoint: 'interior', breachedAt: 30 };
  const failed = stepSmithFinale(window, input, .01);
  assert.equal(failed.phase, 'failed'); assert.equal(smithFinaleLocked(failed), true);
  assert.deepEqual(smithFinalePose(failed), smithFinalePose({ ...window, elapsed: SMITH_FINALE.interior.dodge, total: 35.01 }), 'failure cannot drop Neo to the road');
  const reloaded = JSON.parse(JSON.stringify(failed));
  assert.deepEqual(stepSmithFinale(reloaded, { ...input, focus: true, x: 1 }, 5), failed);
  const retry = retrySmithFinale(reloaded);
  assert.equal(retry.phase, 'interior_warning'); assert.equal(retry.attempts, 1);
  assert.equal(retry.breachedAt, 30); assert.ok(smithFinalePose(retry).neo.y >= 15);
});

test('the interior has a supporting floor and a genuinely open route through the broken window', () => {
  const root = new THREE.Group(), renderer = new SmithFinaleRenderer(root);
  try {
    const beat: SmithFinaleEncounter = { ...newSmithFinale(), phase: 'interior_counter', total: 36, checkpoint: 'interior', breachedAt: 30 };
    renderer.update(beat, false, { x: -32.5, z: -28 }); root.updateMatrixWorld(true);
    const surfaces: THREE.Mesh[] = [];
    root.traverseVisible(object => {
      if (!(object instanceof THREE.Mesh) || !/static-facade|interior|breached-facade/.test(object.name)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) material.side = THREE.DoubleSide;
      surfaces.push(object);
    });
    for (const role of ['neo', 'smith'] as const) {
      const pose = smithFinalePose(beat)[role];
      const ray = new THREE.Raycaster(new THREE.Vector3(pose.x, pose.y + 1, pose.z), new THREE.Vector3(0, -1, 0), 0, 3);
      const hits = ray.intersectObjects(surfaces, false), floor = hits[0];
      assert.ok(floor && Math.abs(floor.point.y - pose.y) < .04, `${role}: visible geometry must support the actor at ${pose.y}`);
      assert.ok(hits.filter(hit => Math.abs(hit.point.y - pose.y) < .01)
        .every(hit => hit.object.name === 'smith-finale-interior-floor'), `${role}: the facade cap cannot overlap the visible floor and cause depth stripes`);
    }
    for (const z of [-28, -23.6]) {
      const ray = new THREE.Raycaster(new THREE.Vector3(-35, 18, z), new THREE.Vector3(1, 0, 0), 0, 13);
      assert.equal(ray.intersectObjects(surfaces, false).length, 0, `window ${z}: a solid facade or pane still blocks the actor’s route`);
    }
    assert.ok(root.getObjectByName('smith-finale-interior-window-grid'), 'the film’s large industrial window grids must be visible');
  } finally { renderer.dispose(); }
});

test('the renewed flight requires a second player counter and saves its own checkpoint before the powered dive', () => {
  let beat: SmithFinaleEncounter = { ...newSmithFinale(), phase: 'interior_kick', total: 40, checkpoint: 'interior', breachedAt: 30 };
  beat = stepSmithFinale(beat, input, SMITH_FINALE.interior.kick);
  assert.equal(beat.phase, 'relaunch');
  beat = stepSmithFinale(beat, input, SMITH_FINALE.relaunch);
  assert.equal(beat.phase, 'sky_warning'); assert.equal(beat.checkpoint, 'sky');
  beat = stepSmithFinale(beat, input, SMITH_FINALE.air.warning);
  assert.equal(beat.phase, 'sky_dodge');
  const failed = stepSmithFinale(beat, input, SMITH_FINALE.air.dodge);
  assert.equal(failed.phase, 'failed'); assert.equal(retrySmithFinale(failed).phase, 'sky_warning');
  beat = smithFinaleAction(beat, 'dodge'); assert.equal(beat.phase, 'sky_counter');
  beat = smithFinaleAction(beat, 'attack'); assert.equal(beat.phase, 'sky_grapple');
  beat = stepSmithFinale(beat, input, SMITH_FINALE.grapple);
  assert.equal(beat.phase, 'descent'); assert.equal(beat.checkpoint, 'sky');
  assert.ok(smithFinalePose(beat).neo.y > 50, 'second descent begins above the towers, not from the old facade position');
  const landingFailure = stepSmithFinale(beat, input, SMITH_FINALE.descent.seconds);
  assert.equal(landingFailure.phase, 'failed'); assert.equal(retrySmithFinale(landingFailure).phase, 'sky_warning');
});

test('pre-interior saves can join the new route while existing descent and crater saves keep their old trajectory', () => {
  const legacy = { ...newSmithFinale(), roomFight: undefined, phase: 'building' as const, total: 30 };
  assert.equal(stepSmithFinale(legacy, input, SMITH_FINALE.building).phase, 'descent');
  const original = smithFinalePose({ ...legacy, phase: 'descent', elapsed: 0 });
  assert.equal(original.neo.x, -26); assert.equal(original.neo.y, 15);
});
