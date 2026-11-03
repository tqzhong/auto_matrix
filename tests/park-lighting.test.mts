import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { SUNRISE_GARDEN, gardenPose, newTrilogyEpilogue } from '@auto_matrix/shared';
import { SunriseGardenRenderer } from '../packages/client/src/engine/SunriseGardenRenderer.js';
import { LightingSystem } from '../packages/client/src/engine/LightingSystem.js';

function park(t: TestContext) {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  const scene = new THREE.Scene(), root = new THREE.Group(); scene.add(root);
  const garden = new SunriseGardenRenderer(root); t.after(() => garden.dispose()); return { scene, garden };
}

test('the saved park sunrise reduces the real camera fill while preserving the authored sun', t => {
  const { scene, garden } = park(t), lighting = new LightingSystem(scene), camera = new THREE.PerspectiveCamera();
  t.after(() => lighting.dispose());
  const fill = scene.children.find(object => object instanceof THREE.DirectionalLight && object !== lighting.directionalLight) as THREE.DirectionalLight;
  let previous = Infinity;
  for (const [phase, elapsed] of [['choice', 0], ['sunrise', 3.1], ['done', 0]] as const) {
    const state = { ...newTrilogyEpilogue('dawn'), phase, elapsed };
    garden.update(state); lighting.update(0, camera, false, garden.atmosphere());
    assert(fill.intensity > 0 && fill.intensity < .3, 'camera fill must retain readable actors without overpowering the sunrise');
    assert(fill.intensity < previous, 'front fill reduces as the saved sunrise grows'); previous = fill.intensity;
    garden.update(structuredClone(state)); lighting.update(0, camera, false, garden.atmosphere());
    assert.equal(fill.intensity, previous, 'pause and cold reads retain the same fill');
    assert.equal(lighting.directionalLight.intensity, 0, 'the park retains its own shadow sun');
  }
});

test('the park light casts shadows away from the visible low sunrise', t => {
  const { scene, garden } = park(t);
  const sun = garden.group.children.find(object => object instanceof THREE.DirectionalLight) as THREE.DirectionalLight;
  // This is the visible disk's direction in the existing waterfront sky.
  const visibleSun = new THREE.Vector3(.1, .065, -1).normalize();
  for (const [x, z] of [[0, 0], [4096, 6336]]) {
    garden.group.parent!.position.set(x, 0, z); scene.updateMatrixWorld(true);
    const direction = sun.getWorldPosition(new THREE.Vector3()).sub(sun.target.getWorldPosition(new THREE.Vector3())).normalize();
    assert(direction.angleTo(visibleSun) < 1e-7, `the actual shadow sun differs from the visible disk by ${direction.angleTo(visibleSun)} radians`);
  }
});

test('the cloud panorama loads once when visible and releases a load that finishes after leaving the park', async t => {
  let deliver!: (texture: THREE.DataTexture) => void, loads = 0, disposed = 0;
  t.mock.method(RGBELoader.prototype, 'loadAsync', () => { loads++; return new Promise<THREE.DataTexture>(resolve => { deliver = resolve; }); });
  const { scene, garden } = park(t), dome = garden.group.getObjectByName('sati-sunrise') as THREE.Mesh;
  const camera = new THREE.PerspectiveCamera();
  assert.equal(loads, 0, 'an unused park must not download its HDRI');
  for (let frame = 0; frame < 3; frame++) dome.onBeforeRender({} as THREE.WebGLRenderer, scene, camera, dome.geometry, dome.material as THREE.Material, null);
  assert.equal(loads, 1, 'color, reflection and repeated frames must share one panorama request');
  garden.dispose(); const texture = new THREE.DataTexture(); texture.addEventListener('dispose', () => disposed++);
  deliver(texture); await garden.skyReady;
  assert.equal(disposed, 1, 'the imported texture must not survive a completed park disposal');
  assert.equal((dome.material as THREE.ShaderMaterial).uniforms.panoramaReady.value, 0);
});

test('the shipped panorama sun aligns with the light that casts the park shadows', async t => {
  const raw = await readFile(new URL('../packages/client/public/assets/park/sunset-clouds-4k.hdr', import.meta.url));
  const image = new RGBELoader().setDataType(THREE.FloatType).parse(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
  let brightest = -Infinity, column = 0, row = 0;
  for (let y = 0; y < image.height / 2; y++) for (let x = 0; x < image.width; x++) {
    const index = (y * image.width + x) * 4;
    const luminance = image.data[index] * .2126 + image.data[index + 1] * .7152 + image.data[index + 2] * .0722;
    if (luminance > brightest) { brightest = luminance; column = x; row = y; }
  }
  const { scene, garden } = park(t), sky = (garden.group.getObjectByName('sati-sunrise') as THREE.Mesh).material as THREE.ShaderMaterial;
  const rotation = sky.uniforms.panoramaRotation?.value;
  assert(rotation instanceof THREE.Matrix3, 'the actual panorama requires a rotation into the visible sunrise direction');
  const longitude = ((column + .5) / image.width - .5) * Math.PI * 2, latitude = (.5 - (row + .5) / image.height) * Math.PI;
  const photographedSun = new THREE.Vector3(Math.sin(longitude) * Math.cos(latitude), Math.sin(latitude), -Math.cos(longitude) * Math.cos(latitude))
    .applyMatrix3(rotation.clone().invert()).normalize();
  scene.updateMatrixWorld(true);
  const sun = garden.group.children.find(object => object instanceof THREE.DirectionalLight) as THREE.DirectionalLight;
  const shadowSun = sun.getWorldPosition(new THREE.Vector3()).sub(sun.target.getWorldPosition(new THREE.Vector3())).normalize();
  assert(photographedSun.angleTo(shadowSun) < Math.PI / image.width, 'the photographed sun must agree within one horizontal pixel');
});

test('park water updates its live color reflection but never redraws the world for the normals pass', t => {
  const { scene, garden } = park(t), water = garden.group.getObjectByName('park-reflecting-water') as Reflector;
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000); camera.position.set(0, 10, -20); camera.lookAt(0, 0, -80);
  camera.updateMatrixWorld(true); scene.updateMatrixWorld(true);
  let reflections = 0;
  const renderer = { xr: { enabled: true }, shadowMap: { autoUpdate: true }, autoClear: true,
    getRenderTarget: () => null, setRenderTarget() {}, state: { buffers: { depth: { setMask() {} } } },
    render() { reflections++; } } as unknown as THREE.WebGLRenderer;
  const normals = new THREE.MeshNormalMaterial(); t.after(() => normals.dispose());
  scene.overrideMaterial = normals;
  water.onBeforeRender(renderer, scene, camera, water.geometry, normals, null);
  assert.equal(reflections, 0, 'the normal material does not sample the reflected color texture');
  for (let frame = 0; frame < 2; frame++) {
    scene.overrideMaterial = null;
    water.onBeforeRender(renderer, scene, camera, water.geometry, water.material, null);
    assert.equal(reflections, frame + 1, 'the next color frame must still refresh the reflection');
    assert.equal(renderer.xr.enabled, true); assert.equal(renderer.shadowMap.autoUpdate, true); assert.equal(water.visible, true);
    scene.overrideMaterial = normals;
    water.onBeforeRender(renderer, scene, camera, water.geometry, normals, null);
    assert.equal(reflections, frame + 1);
  }
});

test('the actual park shadow projection covers the seated cast and nearby stems throughout the saved sunrise', t => {
  const { scene, garden } = park(t);
  let sun!: THREE.DirectionalLight; garden.group.traverse(object => { if (object instanceof THREE.DirectionalLight && object.castShadow) sun = object; });
  for (const [phase, elapsed] of [['sati', 3.328], ['sunrise', 0], ['sunrise', 3.1], ['sunrise', 6.2], ['belief', 1.3]] as const) {
    const state = { ...newTrilogyEpilogue('dawn'), phase, elapsed, total: 16 + elapsed };
    garden.update(state); scene.updateMatrixWorld(true); sun.shadow.updateMatrices(sun);
    const points = SUNRISE_GARDEN.trees.slice(0, 2).map(([x, z]) => new THREE.Vector3(x, 1, z));
    for (const role of ['oracle', 'sati', 'seraph'] as const) { const pose = gardenPose(state, role); points.push(new THREE.Vector3(pose.x, 2.2, pose.z)); }
    for (const point of points) {
      const screen = point.clone().project(sun.shadow.camera);
      assert.ok(Math.abs(screen.x) < 1 && Math.abs(screen.y) < 1 && Math.abs(screen.z) < 1,
        `${phase}/${elapsed}: cast or nearby stem outside the actual shadow projection ${screen.toArray()}`);
    }
    const intensity = sun.intensity, color = sun.color.getHex(); garden.update(structuredClone(state));
    assert.equal(sun.intensity, intensity); assert.equal(sun.color.getHex(), color, 'pause/cold reads use the same saved sunrise light');
    assert.equal(garden.atmosphere().sun, 0); assert.equal(sun.castShadow, true, 'only the unused global sun is disabled');
  }
});
