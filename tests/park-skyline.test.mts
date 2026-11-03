import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SunriseGardenRenderer } from '../packages/client/src/engine/SunriseGardenRenderer.js';

test('foreground masonry has real reveal depth around rectangular and curved glazing', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  const park = new SunriseGardenRenderer(new THREE.Group()); t.after(() => park.dispose()); park.group.updateMatrixWorld(true);
  const skyline = park.group.getObjectByName('park-city-skyline')!;
  const angle = Math.PI / 40;
  for (const [label, window, pier, direction, pierDirection] of [
    ['front wall', [-128.54, 18.15, -150], [-127.44, 18.15, -150], [0, 0, -1], [0, 0, -1]],
    ['side wall', [-110, 18.15, -172.66], [-110, 18.15, -171.56], [-1, 0, 0], [-1, 0, 0]],
    ['opposite side wall', [-100, 18.15, -184.64], [-100, 18.15, -185.74], [1, 0, 0], [1, 0, 0]],
    ['round tower', [151 + Math.sin(angle) * 20, 18.15, -208 + Math.cos(angle) * 20], [151, 18.15, -188], [-Math.sin(angle), 0, -Math.cos(angle)], [0, 0, -1]],
  ] as const) {
    const hit = (origin: readonly number[], normal: readonly number[]) => new THREE.Raycaster(new THREE.Vector3().fromArray(origin), new THREE.Vector3().fromArray(normal), 0, 30).intersectObject(skyline, true)[0];
    const pane = hit(window, direction), frame = hit(pier, pierDirection);
    assert(pane && frame, `${label}: both the glazing and masonry must be actual surfaces`);
    const depth = pane.distance - frame.distance;
    assert(depth > .25 && depth < .65, `${label}: the actual glazing must retreat behind the masonry, received ${depth}`);
  }
});

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
