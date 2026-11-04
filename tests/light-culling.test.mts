import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { LightCulling } from '../packages/client/src/engine/LightCulling.js';

function view() {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(60, 1, .1, 100);
  const culling = new LightCulling(scene), renderer = {} as THREE.WebGLRenderer;
  const before = (eye: THREE.Camera = camera) => { scene.updateMatrixWorld(); eye.updateMatrixWorld(); scene.onBeforeRender(renderer, scene, eye, null); };
  const after = (eye: THREE.Camera = camera) => scene.onAfterRender(renderer, scene, eye);
  const light = (x: number, z: number, radius: number, intensity = 10) => {
    const value = new THREE.PointLight(0xffffff, intensity, radius); value.position.set(x, 0, z); scene.add(value); return value;
  };
  return { scene, camera, culling, before, after, light };
}

test('only lights whose finite influence misses the view lose energy, preserving possible contributors', () => {
  const h = view(), front = h.light(0, -10, 4), outside = h.light(60, -10, 4);
  const overlapping = h.light(8, -10, 6), behind = h.light(0, 3, 6), unlimited = h.light(300, 10, 0);
  const off = h.light(0, -10, 100, 0), hidden = h.light(0, -10, 4); hidden.visible = false;
  const withChild = h.light(300, -10, 2); withChild.add(new THREE.Mesh());
  const sun = new THREE.DirectionalLight(); h.scene.add(sun);
  try {
    h.before();
    for (const light of [front, overlapping, behind, unlimited, withChild, sun]) assert.equal(light.visible, true);
    assert.equal(outside.visible, true); assert.equal(outside.intensity, 0); assert.equal(off.visible, false); assert.equal(hidden.visible, false);
    h.after(); assert.equal(outside.intensity, 10); assert.equal(off.visible, true); assert.equal(hidden.visible, false);
    h.culling.enabled = false; h.before(); assert.equal(outside.intensity, 10); h.after();
  } finally { h.culling.dispose(); }
});

test('a nested reflection gets its own lights and restores the outer selection afterward', () => {
  const h = view(), front = h.light(0, -10, 3), rear = h.light(0, 10, 3);
  const mirror = new THREE.PerspectiveCamera(60, 1, .1, 100); mirror.rotation.y = Math.PI;
  try {
    h.before(); assert.equal(front.intensity, 10); assert.equal(rear.intensity, 0);
    h.before(mirror); assert.equal(front.intensity, 0); assert.equal(rear.intensity, 10);
    h.after(mirror); assert.equal(front.intensity, 10); assert.equal(rear.intensity, 0);
    h.after(); assert.equal(front.intensity, 10); assert.equal(rear.intensity, 10);
    h.camera.rotation.y = Math.PI; h.before(); assert.equal(rear.intensity, 10); assert.equal(front.intensity, 0); h.after();
  } finally { h.culling.dispose(); }
});

test('translated and scaled rooms use world-space distance and hidden rooms remain untouched', () => {
  const h = view(), room = new THREE.Group(), hidden = new THREE.Group(); hidden.visible = false;
  room.position.set(5000, -100, 5000); room.scale.setScalar(10); h.scene.add(room, hidden);
  h.camera.position.copy(room.position);
  const nearby = new THREE.PointLight(0xffffff, 20, 5); nearby.position.set(0, 0, -1); room.add(nearby);
  const far = new THREE.PointLight(0xffffff, 20, 5); far.position.set(6, 0, -1); room.add(far);
  const untouched = new THREE.PointLight(); hidden.add(untouched);
  try {
    h.before(); assert.equal(nearby.intensity, 20); assert.equal(far.intensity, 0); assert.equal(untouched.visible, true); h.after();
    room.position.x += 500; h.before(); assert.equal(nearby.intensity, 0); h.after();
  } finally { h.culling.dispose(); }
});

test('normal passes, array cameras and exceptional exits do not leave lighting hidden', () => {
  const h = view(), front = h.light(0, -10, 3), rear = h.light(0, 10, 3);
  const mirror = new THREE.PerspectiveCamera(60, 1, .1, 100); mirror.rotation.y = Math.PI;
  try {
    h.before(); h.before(mirror); h.culling.restore();
    assert.equal(front.visible, true); assert.equal(rear.visible, true);
    assert.equal(front.intensity, 10); assert.equal(rear.intensity, 10);
    h.scene.overrideMaterial = new THREE.MeshNormalMaterial(); h.before(); assert.equal(rear.intensity, 10); h.after();
    h.scene.overrideMaterial.dispose(); h.scene.overrideMaterial = null;
    h.before(new THREE.ArrayCamera()); assert.equal(rear.intensity, 10); h.after();
    h.before(); h.culling.dispose(); assert.equal(rear.visible, true);
    h.before(); assert.equal(rear.visible, true);
  } finally { h.culling.dispose(); }
});

test('sampling points across the actual camera volume never discards a light that can contribute there', () => {
  const h = view();
  for (let i = 0; i < 40; i++) h.light(Math.sin(i * 7.3) * 50, Math.cos(i * 2.9) * 80, 2 + i % 17);
  const point = new THREE.Vector3();
  try {
    for (const yaw of [0, .4, -1, Math.PI]) {
      h.camera.rotation.y = yaw; h.before();
      for (let x = -1; x <= 1; x += .2) for (let y = -1; y <= 1; y += .2) for (const z of [-1, 0, .8, .95, .99, 1]) {
        point.set(x, y, z).unproject(h.camera);
        for (const light of h.scene.children as THREE.PointLight[]) if (point.distanceTo(light.position) < light.distance) {
          assert.equal(light.visible, true, 'a potentially illuminated visible point lost its light');
          assert.equal(light.intensity, 10, 'a potentially illuminated visible point lost its energy');
        }
      }
      h.after();
    }
  } finally { h.culling.dispose(); }
});

test('turning through one room keeps non-shadow point-light shader slots stable without lighting offscreen pixels', () => {
  const h = view(), lights = [h.light(0, -10, 3), h.light(10, 0, 3), h.light(0, 10, 3), h.light(-10, 0, 3)];
  const off = h.light(0, -10, 3, 0), shadow = h.light(30000, -10, 3); shadow.castShadow = true;
  const children = h.scene.children.length;
  try {
    for (let frame = 0; frame < 32; frame++) {
      const facing = frame % 4; h.camera.rotation.y = -facing * Math.PI / 2; h.before();
      let slots = 0; h.scene.traverseVisible(object => { if (object instanceof THREE.PointLight) slots++; });
      assert.equal(slots, 4, 'camera-only changes must reuse the same lit-material shader variant');
      lights.forEach((light, index) => { assert.equal(light.visible, true); assert.equal(light.intensity, index === facing ? 10 : 0); });
      assert.equal(off.visible, false); assert.equal(shadow.visible, false, 'offscreen shadow maps still need visibility culling');
      assert.equal(h.scene.children.length, children, 'stability must not add lights to the scene');
      h.after(); lights.forEach(light => assert.equal(light.intensity, 10));
    }
  } finally { h.culling.dispose(); }
});

test('nested reflection and normal passes restore the exact point-light energy on return and exceptional exit', () => {
  const h = view(), front = h.light(0, -10, 3, 7.5), rear = h.light(0, 10, 3, 19);
  const distant = Array.from({ length: 10 }, (_, index) => h.light(30000 + index, -10, 3, 4 + index));
  const mirror = new THREE.PerspectiveCamera(60, 1, .1, 100); mirror.rotation.y = Math.PI;
  const normal = new THREE.MeshNormalMaterial();
  try {
    h.before(); assert.equal(front.intensity, 7.5); assert.equal(rear.intensity, 0);
    h.before(mirror); assert.equal(front.intensity, 0); assert.equal(rear.intensity, 19);
    h.scene.overrideMaterial = normal; h.before();
    assert.equal(front.intensity, 7.5); assert.equal(rear.intensity, 19);
    h.after(); h.scene.overrideMaterial = null;
    assert.equal(front.intensity, 0); assert.equal(rear.intensity, 19);
    h.after(mirror); assert.equal(front.intensity, 7.5); assert.equal(rear.intensity, 0);
    h.before(mirror); h.culling.restore();
    assert.equal(front.intensity, 7.5); assert.equal(rear.intensity, 19);
    h.before(); h.culling.dispose();
    assert.equal(front.intensity, 7.5); assert.equal(rear.intensity, 19);
    distant.forEach((light, index) => { assert.equal(light.visible, true); assert.equal(light.intensity, 4 + index); });
  } finally { normal.dispose(); h.culling.dispose(); }
});

test('many offscreen lights use bounded shader slots without losing any contributing light', () => {
  const h = view(), lights = Array.from({ length: 100 }, (_, index) => h.light(30000 + index, -10, 3));
  try {
    for (const contributing of [0, 1, 4, 5, 6, 7, 8, 9]) {
      lights.forEach((light, index) => { light.position.x = index < contributing ? (index - 4) * .1 : 30000 + index; });
      h.before(); let slots = 0;
      h.scene.traverseVisible(object => { if (object instanceof THREE.PointLight) slots++; });
      assert.equal(slots, contributing <= 4 ? 4 : contributing <= 8 ? 8 : 16);
      lights.forEach((light, index) => {
        if (index < contributing) { assert.equal(light.visible, true); assert.equal(light.intensity, 10); }
        else assert.ok(!light.visible || light.intensity === 0, 'a light beyond the view contributes no energy');
      });
      assert.equal(h.scene.children.length, 100);
      h.after(); lights.forEach(light => { assert.equal(light.visible, true); assert.equal(light.intensity, 10); });
    }
  } finally { h.culling.dispose(); }
});
