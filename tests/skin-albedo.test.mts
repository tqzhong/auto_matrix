import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { HeroModels } from '../packages/client/src/agents/HeroModel.js';
import { actor } from './helpers/fighting-hand-fixture.mjs';
import { applySkinAlbedo } from '../packages/client/src/agents/SkinAlbedo.js';

function fixture(getTexture: () => Promise<THREE.Texture>, painted = true) {
  const material = new THREE.MeshStandardMaterial({ map: new THREE.Texture(), roughness: .8, opacity: .6 }); material.name = 'Skin';
  const geometry = new THREE.BufferGeometry(), mesh = new THREE.Mesh(geometry, material), scene = new THREE.Group(); mesh.name = 'paintedSkin'; scene.add(mesh);
  const asset = { scene, parser: { json: { extras: { skinBaked: true, ...(painted ? { skinAlbedoOverride: { mesh: mesh.name, texture: 3 } } : {}) } },
    getDependency: async (kind: string, index: number) => { assert.equal(kind, 'texture'); assert.equal(index, 3); return getTexture(); } } } as unknown as GLTF;
  return { asset, material };
}

for (const id of ['neo', 'morpheus'] as const) test(`${id}: painted skin composes with existing shaders and keeps original PBR maps and alpha`, async t => {
  const texture = new THREE.Texture(), h = fixture(async () => texture), prior = { value: .35 };
  h.material.onBeforeCompile = shader => { shader.uniforms.priorSkin = prior; shader.fragmentShader += '\n// retained authoring'; };
  h.material.customProgramCacheKey = () => 'authored-skin';
  const map = h.material.map, models = new HeroModels(new THREE.Texture(), new THREE.Texture()); t.after(() => models.dispose());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async () => h.asset);
  await models['load'](id);
  const shader = { uniforms: THREE.UniformsUtils.clone(THREE.ShaderLib.physical.uniforms), vertexShader: THREE.ShaderLib.physical.vertexShader, fragmentShader: THREE.ShaderLib.physical.fragmentShader };
  h.material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
  assert.equal(shader.uniforms.priorSkin, prior);
  assert.equal(shader.uniforms.refinedSkinAlbedo.value, texture);
  assert.match(shader.fragmentShader, /\/\/ retained authoring/);
  assert.match(shader.fragmentShader, /sampledDiffuseColor\.rgb = mix\(sampledDiffuseColor\.rgb,/);
  assert.ok(shader.fragmentShader.includes('diffuseColor *= sampledDiffuseColor;'));
  assert.equal(h.material.map, map); assert.equal(h.material.roughness, .8); assert.equal(h.material.opacity, .6);
  assert.equal(texture.colorSpace, THREE.SRGBColorSpace);
  assert.equal(h.material.customProgramCacheKey(), 'authored-skin|painted-skin-albedo-v1');
});

test('attached eyelid tissue uses the same optional skin layer without changing unrelated eyes', async t => {
  let requests = 0; const texture = new THREE.Texture(), h = fixture(async () => { requests++; return texture; });
  const lining = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ map: new THREE.Texture(), roughness: .35 })); lining.name = 'lidSurface';
  const eye = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial()); eye.name = 'eye';
  h.asset.scene.add(lining, eye); h.asset.parser.json.extras.skinAlbedoOverride.attachments = [lining.name];
  const eyeCompile = eye.material.onBeforeCompile, map = lining.material.map;
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture()); t.after(() => models.dispose());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async () => h.asset); await models['load']('morpheus');
  const shader = { uniforms: THREE.UniformsUtils.clone(THREE.ShaderLib.physical.uniforms), vertexShader: THREE.ShaderLib.physical.vertexShader, fragmentShader: THREE.ShaderLib.physical.fragmentShader };
  lining.material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
  assert.equal(shader.uniforms.refinedSkinAlbedo?.value, texture);
  assert.match(shader.vertexShader, /vAlbedoUv = _albedo_uv/);
  assert.equal(lining.material.map, map); assert.equal(lining.material.roughness, .35);
  assert.equal(eye.material.onBeforeCompile, eyeCompile); assert.equal(requests, 1);
});

test('Morpheus keeps the optional skin layer through actual rig material cloning and nail shading', async t => {
  const texture = new THREE.Texture(); t.after(() => texture.dispose());
  const h = await actor('morpheus', scene => {
    const skin = scene.getObjectByName('Anatomical_head_and_hands') as THREE.Mesh;
    if (!skin) return;
    const count = skin.geometry.attributes.position.count;
    skin.geometry.setAttribute('_albedo_uv', new THREE.Float32BufferAttribute(new Float32Array(count * 2), 2));
    skin.geometry.setAttribute('_albedo_weight', new THREE.Float32BufferAttribute(new Float32Array(count), 1));
    skin.geometry.setAttribute('_nail_detail', new THREE.Float32BufferAttribute(new Float32Array(count * 2), 2));
    applySkinAlbedo(skin.material as THREE.MeshStandardMaterial, texture);
  });
  t.after(() => h.models.dispose());
  const skin = h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.Mesh;
  const material = skin.material as THREE.MeshStandardMaterial;
  const shader = { uniforms: THREE.UniformsUtils.clone(THREE.ShaderLib.physical.uniforms), vertexShader: THREE.ShaderLib.physical.vertexShader, fragmentShader: THREE.ShaderLib.physical.fragmentShader };
  material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
  assert.equal(shader.uniforms.refinedSkinAlbedo?.value, texture);
  assert.match(shader.vertexShader, /attribute vec2 _nail_detail;/);
  assert.match(material.customProgramCacheKey(), /painted-skin-albedo-v1\|natural-nail-surface-v1$/);
});

for (const id of ['neo', 'morpheus'] as const) test(`${id}: a late optional skin texture is released when its model was disposed while loading`, async t => {
  let complete!: (texture: THREE.Texture) => void, requested!: () => void;
  const arrived = new Promise<void>(resolve => { requested = resolve; });
  const pending = new Promise<THREE.Texture>(resolve => { complete = resolve; });
  const h = fixture(() => { requested(); return pending; }), texture = new THREE.Texture(); let released = 0;
  texture.addEventListener('dispose', () => released++);
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture()); t.after(() => models.dispose());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async () => h.asset);
  const loading = models['load'](id); await arrived; models.dispose(); complete(texture); await loading;
  assert.equal(released, 1, 'the optional bitmap must not remain allocated after a late load');
});

test('ordinary assets keep their authored shader and do not request the optional bitmap', async t => {
  let requests = 0; const h = fixture(async () => { requests++; return new THREE.Texture(); }, false);
  const compile = h.material.onBeforeCompile, key = h.material.customProgramCacheKey();
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture()); t.after(() => models.dispose());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async () => h.asset); await models['load']('neo');
  assert.equal(requests, 0); assert.equal(h.material.onBeforeCompile, compile); assert.equal(h.material.customProgramCacheKey(), key);
});
