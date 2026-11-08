import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { WorldOcclusionPass } from '../packages/client/src/engine/PostProcessing.js';

function fixture() {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(), actor = new THREE.Group();
  scene.fog = new THREE.FogExp2(); scene.environment = new THREE.Texture();
  const light = new THREE.PointLight(); scene.add(light, actor);
  const geometry = new THREE.BoxGeometry(), headGeometry = geometry.clone(), material = new THREE.MeshStandardMaterial();
  headGeometry.setAttribute('uv1', headGeometry.getAttribute('uv').clone());
  const head = new THREE.SkinnedMesh(headGeometry, material), shirt = new THREE.SkinnedMesh(geometry, [material]);
  const hidden = new THREE.Mesh(geometry, material), street = new THREE.Mesh(geometry, material);
  head.name = 'head'; shirt.name = 'shirt'; hidden.name = 'hidden'; street.name = 'street';
  hidden.visible = false; actor.add(head, shirt, hidden); scene.add(street);
  const pass = new WorldOcclusionPass(scene, camera, 64, 64), previousTarget = new THREE.WebGLRenderTarget(8, 8);
  let target: THREE.WebGLRenderTarget | null = previousTarget, ready = false, fail = false, supported = true;
  const work: string[] = [], originals = new Map([head, shirt, hidden, street].map(mesh => [mesh, mesh.material]));
  const compiled = new Map<THREE.Object3D, { isReady(): boolean; getUniforms(): void }>();
  const renderer = {
    properties: {}, info: { programs: [] as { isReady(): boolean; getUniforms(): void }[] },
    extensions: { has: () => supported }, getRenderTarget: () => target,
    setRenderTarget: (value: THREE.WebGLRenderTarget | null) => { target = value; },
    compile(subject: THREE.Object3D, eye: THREE.Camera, view: THREE.Scene) {
      const batch: THREE.Mesh[] = []; subject.traverse(object => { if (object instanceof THREE.Mesh) batch.push(object); });
      assert.equal(batch.length, 1); assert.equal(eye, camera); assert.equal(view.fog, scene.fog);
      const lights: THREE.Light[] = []; view.traverseVisible(object => { if (object instanceof THREE.Light) lights.push(object); });
      assert.deepEqual(lights, []); assert.equal(batch[0].material, pass.normalMaterial);
      assert.match(pass.normalMaterial.customProgramCacheKey(), /actor-local-skin-v1$/);
      assert.equal(target, pass.normalRenderTarget);
      if (fail) throw new Error('compile failed');
      work.push('compile:' + batch[0].name);
      if (!compiled.has(batch[0])) {
        const program = { isReady: () => ready, getUniforms: () => { work.push('bindings:' + batch[0].name); } };
        compiled.set(batch[0], program); renderer.info.programs.push(program);
      }
    },
  };
  const prepare = () => (pass as WorldOcclusionPass & {
    prepareNormals?: (gpu: THREE.WebGLRenderer, root?: THREE.Group) => void;
  }).prepareNormals?.(renderer as unknown as THREE.WebGLRenderer, actor);
  const check = () => {
    assert.equal(target, previousTarget); assert.equal(pass.scene, scene); assert.equal(scene.overrideMaterial, null);
    assert.equal(light.visible, true); assert.equal(light.layers.mask, 1);
    for (const [mesh, original] of originals) assert.equal(mesh.material, original);
    assert.equal(head.parent, actor); assert.equal(street.parent, scene);
  };
  const frames = (count = 20) => { for (let i = 0; i < count; i++) { const before = work.length; prepare(); assert.ok(work.length - before <= 1); check(); } };
  return { actor, hidden, head, renderer, work, prepare, frames, check,
    ready: () => { ready = true; }, fail: (value: boolean) => { fail = value; }, supported: (value: boolean) => { supported = value; },
    replaceContext() { renderer.properties = {}; renderer.info.programs = []; compiled.clear(); },
    dispose() { pass.dispose(); previousTarget.dispose(); geometry.dispose(); headGeometry.dispose(); material.dispose(); scene.environment!.dispose(); } };
}

test('the next occlusion view prepares visible skin and static variants with one work step per frame', t => {
  const h = fixture(); t.after(() => h.dispose()); h.frames();
  assert.deepEqual(h.work, ['compile:head', 'compile:shirt', 'compile:street']);
  h.ready(); h.frames();
  assert.deepEqual(h.work.filter(value => value.startsWith('bindings:')), ['bindings:head', 'bindings:shirt', 'bindings:street']);
  h.frames(); assert.equal(h.work.length, 6, 'completed programs are not repeatedly queried');
  h.hidden.visible = true; h.frames(); assert.ok(h.work.includes('compile:hidden'), 'a newly visible surface must still receive preparation');
});

test('normal preparation waits for supported visible geometry and starts again after GPU replacement', t => {
  const h = fixture(); t.after(() => h.dispose());
  h.supported(false); h.frames(); h.supported(true); h.actor.visible = false; h.frames();
  assert.deepEqual(h.work, []);
  h.actor.visible = true; h.ready(); h.frames(); assert.equal(h.work.filter(value => value === 'compile:head').length, 1);
  h.replaceContext(); h.frames(); assert.equal(h.work.filter(value => value === 'compile:head').length, 2);
});

test('a failed normal preparation restores materials and targets and retries the same geometry', t => {
  const h = fixture(); t.after(() => h.dispose()); h.fail(true);
  assert.throws(h.prepare, /compile failed/); h.check();
  h.fail(false); h.ready(); h.frames();
  assert.ok(h.work.includes('compile:head')); assert.ok(h.work.includes('bindings:head'));
});
