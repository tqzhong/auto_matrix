import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import type { FilmJourney } from '@auto_matrix/shared';
import { PillReflection } from '../packages/client/src/engine/PillReflection.js';

function fixture(t: TestContext) {
  t.mock.method(THREE.PMREMGenerator.prototype, 'fromCubemap', (_source: THREE.CubeTexture, output?: THREE.WebGLRenderTarget) => {
    const target = output ?? new THREE.WebGLRenderTarget(16, 16); target.texture.mapping = THREE.CubeUVReflectionMapping; return target;
  });
  const scene = new THREE.Scene(), body = new THREE.Group(), subject = new THREE.Group(), glasses = new THREE.Group();
  scene.add(body, subject); body.add(glasses); subject.visible = false;
  const material = new THREE.MeshPhysicalMaterial({ color: '#060909', metalness: .08, roughness: .12, clearcoat: 1 });
  const lenses = [-1, 1].map(side => { const lens = new THREE.Mesh(new THREE.SphereGeometry(.064), material); lens.name = `morpheus-glasses-lens-${side}`; lens.position.x = side * .074; glasses.add(lens); return lens; });
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(.04, .01, .01)); bridge.name = 'morpheus-glasses-bridge'; glasses.add(bridge);
  const camera = new THREE.PerspectiveCamera(); camera.position.z = 4; scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
  const journey = { version: 1, scene: 'm1_pills', step: 0, actor: 'neo', completed: [], enteredAt: 0, reflections: {}, lastText: '', checkpoint: { x: 0, y: 0, z: 0 },
    pills: { phase: 'choice', elapsed: 0, approach: { x: 1.75, z: -6, yaw: -Math.PI / 2 } } } as FilmJourney;
  const target = new THREE.WebGLRenderTarget(8, 8), restored: unknown[][] = [];
  const renderer = { shadowMap: { autoUpdate: true, needsUpdate: true }, xr: { enabled: true }, getRenderTarget: () => target,
    getActiveCubeFace: () => 2, getActiveMipmapLevel: () => 1, compile() {}, setRenderTarget: (...args: unknown[]) => restored.push(args) } as unknown as THREE.WebGLRenderer;
  const reflection = new PillReflection(), draw = () => lenses[0].onBeforeRender(renderer, scene, camera, lenses[0].geometry, material, null as any);
  return { scene, body, subject, glasses, lenses, material, camera, journey, renderer, reflection, draw, target, restored };
}

test('the actual room capture sees the first-person body and restores visibility and renderer state', t => {
  const h = fixture(t), original = h.material.clone(); t.after(() => { h.reflection.dispose(); h.target.dispose(); original.dispose(); });
  let captures = 0;
  t.mock.method(THREE.CubeCamera.prototype, 'update', function(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
    captures++; assert.equal(scene, h.scene); assert.equal(h.subject.visible, true); assert.equal(h.glasses.visible, false);
    assert.equal(renderer.shadowMap.autoUpdate, false); assert.equal(renderer.shadowMap.needsUpdate, false);
    renderer.xr.enabled = false;
  });
  h.reflection.update(h.journey, h.body, h.subject); h.draw();
  assert.equal(captures, 1); assert.equal(h.material.envMap?.mapping, THREE.CubeUVReflectionMapping); assert.equal(h.subject.visible, false); assert.equal(h.glasses.visible, true);
  assert.deepEqual(h.renderer.shadowMap, { autoUpdate: true, needsUpdate: true }); assert.equal(h.renderer.xr.enabled, true);
  assert.deepEqual(h.restored.at(-1), [h.target, 2, 1]);
  h.draw(); h.draw(); assert.equal(captures, 1, 'a frozen room must reuse its completed capture');
  let released = false; h.material.envMap.addEventListener('dispose', () => released = true);
  h.reflection.update({ ...h.journey, scene: 'm1_mirror' }, h.body, h.subject);
  assert.equal(released, true); assert.equal(h.material.envMap, original.envMap); assert(h.material.color.equals(original.color));
  assert.equal(h.material.metalness, original.metalness); assert.equal(h.material.roughness, original.roughness);
  h.draw(); assert.equal(captures, 1, 'another scene must not retain a live reflection callback');
});

test('AO, distant views and inactive or visiting scenes never create a room capture', t => {
  const h = fixture(t); t.after(() => { h.reflection.dispose(); h.target.dispose(); });
  let captures = 0; t.mock.method(THREE.CubeCamera.prototype, 'update', () => { captures++; });
  for (const journey of [undefined, { ...h.journey, visiting: true }, { ...h.journey, scene: 'm1_mirror' }]) {
    h.reflection.update(journey, h.body, h.subject); h.draw();
  }
  h.reflection.update(h.journey, h.body, h.subject);
  h.scene.overrideMaterial = new THREE.MeshNormalMaterial(); h.draw(); h.scene.overrideMaterial.dispose(); h.scene.overrideMaterial = null;
  h.camera.position.z = 100; h.camera.updateMatrixWorld(); h.draw();
  assert.equal(captures, 0); assert.equal(h.material.envMap, null); assert.equal(h.subject.visible, false);
});

test('a failed nested capture restores the first-person body, shadow settings and active render target', t => {
  const h = fixture(t); t.after(() => { h.reflection.dispose(); h.target.dispose(); });
  t.mock.method(THREE.CubeCamera.prototype, 'update', (renderer: THREE.WebGLRenderer) => { renderer.xr.enabled = false; throw new Error('capture failed'); });
  h.reflection.update(h.journey, h.body, h.subject); assert.throws(h.draw, /capture failed/);
  assert.equal(h.subject.visible, false); assert.equal(h.glasses.visible, true); assert.equal(h.renderer.xr.enabled, true);
  assert.deepEqual(h.renderer.shadowMap, { autoUpdate: true, needsUpdate: true }); assert.deepEqual(h.restored.at(-1), [h.target, 2, 1]);
  assert.equal(h.material.envMap, null);
});

test('a cached capture reapplies its lens appearance after the normal wardrobe animation restores material values', t => {
  const h = fixture(t); t.after(() => { h.reflection.dispose(); h.target.dispose(); });
  let captures = 0; t.mock.method(THREE.CubeCamera.prototype, 'update', () => { captures++; });
  h.reflection.update(h.journey, h.body, h.subject); h.draw();
  const color = h.material.color.clone(), metalness = h.material.metalness, roughness = h.material.roughness;
  h.material.color.set('#060909'); h.material.metalness = .08; h.material.roughness = .12;
  h.draw(); assert.equal(captures, 1, 'a material reset must not force another six-view capture');
  assert(h.material.color.equals(color)); assert.equal(h.material.metalness, metalness); assert.equal(h.material.roughness, roughness);
});

test('the small lens capture uses one optical bounce and restores refractive materials and mirror callbacks', t => {
  const h = fixture(t), glass = new THREE.MeshPhysicalMaterial({ transmission: .92 }), cup = new THREE.Mesh(new THREE.SphereGeometry(.1), glass);
  const mirror = new Reflector(new THREE.PlaneGeometry(1, 1)), callback = mirror.onBeforeRender;
  h.scene.add(cup, mirror); t.after(() => { h.reflection.dispose(); h.target.dispose(); glass.dispose(); cup.geometry.dispose(); mirror.dispose(); mirror.geometry.dispose(); });
  t.mock.method(THREE.CubeCamera.prototype, 'update', () => {
    assert.equal(glass.transmission, 0, 'recursive glass refraction must not create six hidden camera render targets');
    assert.notEqual(mirror.onBeforeRender, callback, 'a mirror must reuse its existing image during the first reflection bounce');
  });
  h.reflection.update(h.journey, h.body, h.subject); h.draw();
  assert.equal(glass.transmission, .92); assert.equal(mirror.onBeforeRender, callback);
});
