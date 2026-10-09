import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SUNRISE_GARDEN, gardenPose, newTrilogyEpilogue } from '@auto_matrix/shared';
import { SunriseGardenRenderer } from '../packages/client/src/engine/SunriseGardenRenderer.js';

function park(t: TestContext) {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  const scene = new THREE.Scene(), root = new THREE.Group(); scene.add(root);
  const garden = new SunriseGardenRenderer(root); t.after(() => garden.dispose()); return { scene, garden };
}

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
