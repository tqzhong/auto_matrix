import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SETS } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { LightCulling } from '../packages/client/src/engine/LightCulling.js';

test('the first Construct keeps the screen and objective slots through locked and walkable views', t => {
  const sets = Object.assign(Object.create(FilmSetRenderer.prototype), { current: FILM_SETS.film_white_construct, currentScene: 'm1_construct' }) as FilmSetRenderer;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(65, 16 / 9, .1, 100), subject = new THREE.Group();
  camera.position.set(7, 3, 5); camera.lookAt(0, 2, -13); camera.updateMatrixWorld();
  const screen = new THREE.PointLight(0xffffff, 18, 20), marker = new THREE.PointLight(0xffcc66, 0, 20); screen.position.set(0, 2, -12); marker.position.set(5, 2, -4); scene.add(screen, marker);
  const lighting = new LightCulling(scene), counts: number[] = []; t.after(() => lighting.dispose());
  const renderer = { compile: (_subject: THREE.Object3D, _camera: THREE.Camera, view: THREE.Scene) => {
    let count = 0; view.traverseVisible(object => { if (object instanceof THREE.PointLight) count++; }); counts.push(count);
  } } as unknown as THREE.WebGLRenderer;
  for (const shown of [false, true, false]) {
    lighting.stablePointSlots = sets.stablePointSlots; marker.visible = shown || sets.stablePointSlots; marker.intensity = shown ? 5 : 0;
    lighting.compileSubject(renderer, camera, subject); assert.equal(marker.intensity, shown ? 5 : 0); assert.equal(screen.intensity, 18);
  }
  assert.deepEqual(counts, [2, 2, 2], 'opening the objective cue must not change every colour program');
});
