import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { RevolutionsPreludeRenderer } from '../packages/client/src/engine/RevolutionsPreludeRenderer.js';
import { newOracleAbsorption, type FilmJourney } from '@auto_matrix/shared';

const state = (scene: string, step: number) => ({ scene, step, visiting: undefined }) as FilmJourney;

test('Oracle corridor lighting follows the saved escape clock through pause without a particle halo', () => {
  const root = new THREE.Group(); const renderer = new RevolutionsPreludeRenderer(root, 'm3_oracle_absorbed');
  const lamps = [0, 1, 2, 3].map(i => root.getObjectByName(`oracle-corridor-light-${i}`) as THREE.PointLight);
  const journey = state('m3_oracle_absorbed', 1); journey.oracleAbsorption = { ...newOracleAbsorption(1, 63), phase: 'escaping', escape: 0 };
  renderer.update(journey, 0);
  assert.ok(lamps.every(lamp => lamp.intensity > 0)); assert.equal(root.getObjectByName('oracle-code-intrusion'), undefined);
  journey.oracleAbsorption.escape = 17; renderer.update(journey, 1);
  assert.equal(lamps[0].intensity, 0); assert.ok(lamps[3].intensity > 0);
  const intensities = lamps.map(lamp => lamp.intensity); renderer.update(journey, 42); assert.deepEqual(lamps.map(lamp => lamp.intensity), intensities);
  journey.oracleAbsorption.escape = 23; renderer.update(journey, 43);
  assert.ok(lamps.every(lamp => lamp.intensity === 0)); assert.ok(renderer.consumed);
  renderer.dispose(); assert.equal(root.children.length, 0);
});

test('Bane evidence, split routes and Maggie discovery each have scene-specific visual state', () => {
  for (const scene of ['m3_bane_questions', 'm3_logos_plan', 'm3_maggie_discovery'] as const) {
    const root = new THREE.Group(); const renderer = new RevolutionsPreludeRenderer(root, scene);
    renderer.update(state(scene, 0), 0);
    assert.ok(root.getObjectByName(scene === 'm3_bane_questions' ? 'bane-neural-monitor' : scene === 'm3_logos_plan' ? 'hammer-two-routes' : 'maggie-covered-stretcher'));
    renderer.update(state(scene, 3), 2);
    renderer.dispose(); assert.equal(root.children.length, 0);
  }
});
