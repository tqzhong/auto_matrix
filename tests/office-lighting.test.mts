import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS } from '@auto_matrix/shared';
import { OfficeSetRenderer } from '../packages/client/src/engine/OfficeSetRenderer.js';

test('office luminaires illuminate desks without scorching the ceiling above them', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  const original = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, fillText() {}, strokeRect() {} }) }) } as unknown as Document;
  const root = new THREE.Group();
  const renderer = new OfficeSetRenderer(root, FILM_SETS.film_metacortex_floor);
  const irradiance = (point: THREE.Vector3, normal: THREE.Vector3) => {
    let total = 0;
    root.updateMatrixWorld(true);
    root.traverse(object => {
      if (!(object instanceof THREE.PointLight || object instanceof THREE.SpotLight)) return;
      const position = object.getWorldPosition(new THREE.Vector3());
      const delta = point.clone().sub(position), distance = delta.length();
      const direction = delta.normalize();
      let cone = 1;
      if (object instanceof THREE.SpotLight) {
        const axis = object.target.getWorldPosition(new THREE.Vector3()).sub(position).normalize();
        cone = THREE.MathUtils.smoothstep(axis.dot(direction), Math.cos(object.angle), Math.cos(object.angle * (1 - object.penumbra)));
      }
      const cutoff = object.distance ? Math.pow(Math.max(0, 1 - Math.pow(distance / object.distance, 4)), 2) : 1;
      total += object.intensity * cone * cutoff * Math.max(0, -normal.dot(direction)) / Math.max(distance ** object.decay, .01);
    });
    return total;
  };
  try {
    const desk = irradiance(new THREE.Vector3(0, 2.5, 5), new THREE.Vector3(0, 1, 0));
    const ceiling = irradiance(new THREE.Vector3(0, 9.095, 5), new THREE.Vector3(0, -1, 0));
    assert.ok(desk > .2, 'the working plane must still receive local light');
    assert.ok(ceiling < desk * .2, `ceiling receives ${ceiling.toFixed(2)} versus desk ${desk.toFixed(2)}; nearby downlights must not emit upwards`);
    renderer.update(undefined, undefined, undefined, undefined, 0, 18000);
    const night = irradiance(new THREE.Vector3(-18, 2.5, 2), new THREE.Vector3(0, 1, 0));
    assert.ok(irradiance(new THREE.Vector3(0, 2.5, 5), new THREE.Vector3(0, 1, 0)) > .2, 'fluorescent fixtures remain usable after sunset');
    renderer.update(undefined, undefined, undefined, undefined, 0, 12000);
    const day = irradiance(new THREE.Vector3(-18, 2.5, 2), new THREE.Vector3(0, 1, 0));
    assert.ok(day > night * 1.5, 'window daylight follows the world clock');
  } finally { renderer.dispose(); globalThis.document = original; }
});
