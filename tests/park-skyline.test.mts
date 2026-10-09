import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SunriseGardenRenderer } from '../packages/client/src/engine/SunriseGardenRenderer.js';

test('the waterfront skyline frames the sunrise with deep city blocks without obstructing its central sun or the playable park', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  const park = new SunriseGardenRenderer(new THREE.Group()); t.after(() => park.dispose()); park.group.updateMatrixWorld(true);
  const skyline = park.group.getObjectByName('park-city-skyline');
  assert.ok(skyline, 'the distant city needs an authored skyline instead of one randomly repeated office row');
  const bounds = new THREE.Box3().setFromObject(skyline);
  assert.ok(bounds.max.z < -155 && bounds.min.z < -320, 'the city needs separate foreground and distant layers across the water');
  assert.ok(bounds.max.y > 125, 'the outer towers should frame the lower central district');
  const camera = new THREE.Vector3(-7, 3.8, -20), sun = new THREE.Vector3(.1, .065, -1).normalize();
  assert.equal(new THREE.Raycaster(camera, sun, 0, 800).intersectObject(skyline, true).length, 0, 'the movie sunrise must remain visible between the tower clusters');
  for (const side of [-1, 1]) {
    const ray = new THREE.Raycaster(camera, new THREE.Vector3(side * 130, 60, -195).sub(camera).normalize(), 0, 800);
    assert.ok(ray.intersectObject(skyline, true).length, `the ${side} cluster must have a real tall silhouette`);
  }
  let meshes = 0, triangles = 0;
  skyline.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    meshes++; triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
    assert.equal(object.castShadow, false, 'the inaccessible skyline should not draw another shadow city');
  });
  assert.ok(meshes <= 8 && triangles < 18000, 'architectural detail must remain batched in both the color and reflection passes');
});
