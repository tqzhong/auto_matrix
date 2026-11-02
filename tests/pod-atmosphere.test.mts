import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, filmPosition, type AgentState } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';

test('the enclosed pod set limits outdoor reflections and restores the next set atmosphere', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const scene = new THREE.Scene(); scene.background = new THREE.Color(); scene.fog = new THREE.FogExp2(0, .001);
  const sets = new FilmSetRenderer(scene); t.after(() => sets.dispose());
  const actor = { id: 'neo', isInMatrix: false, currentAction: { type: 'idle', parameters: {} } } as AgentState;
  const enter = (id: string) => {
    actor.position = filmPosition(id, 0, 0); sets.update(actor, undefined, 0, actor.position);
    assert.equal(sets.active?.id, id); return sets.atmosphere();
  };
  assert.deepEqual(enter('film_power_plant_pods'), { color: 0xb2cdd7, ambient: .4, sun: .35 });
  assert.equal(scene.environmentIntensity, .04, 'an enclosed industrial pool must not reflect the outdoor sky at daylight strength');
  assert.deepEqual(enter('film_real_desert'), { color: 0xb3c2d4, ambient: .58, sun: .3 });
  assert.equal(scene.environmentIntensity, .38, 'leaving the pod must restore the next set reflection exposure');
  enter(FILM_SETS.film_power_plant_pods.id); assert.equal(scene.environmentIntensity, .04);
});
