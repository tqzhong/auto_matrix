import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { RevolutionsPreludeRenderer } from '../packages/client/src/engine/RevolutionsPreludeRenderer.js';
import type { FilmJourney } from '@auto_matrix/shared';

const state = (scene: string, step: number) => ({ scene, step, visiting: undefined }) as FilmJourney;

test('Oracle corridor lighting dies in sequence and code intrusion appears only when Smith reaches the kitchen', () => {
  const root = new THREE.Group(); const renderer = new RevolutionsPreludeRenderer(root, 'm3_oracle_absorbed');
  const lamps = [0, 1, 2, 3].map(i => root.getObjectByName(`oracle-corridor-light-${i}`) as THREE.PointLight);
  const code = root.getObjectByName('oracle-code-intrusion')!;
  renderer.update(state('m3_oracle_absorbed', 0), 0);
  assert.ok(lamps.every(lamp => lamp.intensity > 0)); assert.equal(code.visible, false);
  renderer.update(state('m3_oracle_absorbed', 2), 1);
  assert.equal(lamps[0].intensity, 0); assert.ok(lamps[3].intensity > 0);
  renderer.update(state('m3_oracle_absorbed', 3), 2);
  assert.equal(code.visible, true); assert.ok(renderer.consumed);
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
