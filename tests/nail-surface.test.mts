import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { actor } from './helpers/fighting-hand-fixture.mjs';
import { applySkinAlbedo } from '../packages/client/src/agents/SkinAlbedo.js';

test('authored nail detail reaches the actual hand material alongside skin albedo and liquid mirror', async t => {
  const texture = new THREE.Texture(); t.after(() => texture.dispose());
  const h = await actor('neo', scene => {
    const skin = scene.getObjectByName('Anatomical_head_and_hands') as THREE.Mesh;
    if (!skin) return;
    const detail = new Float32Array(skin.geometry.attributes.position.count * 2);
    detail[100] = .8; detail[101] = .2;
    skin.geometry.setAttribute('_nail_detail', new THREE.BufferAttribute(detail, 2));
    const material = skin.material as THREE.MeshStandardMaterial;
    material.customProgramCacheKey = () => 'authored-skin';
    applySkinAlbedo(material, texture);
  });
  t.after(() => h.models.dispose());
  const skin = h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.Mesh;
  const material = skin.material as THREE.MeshStandardMaterial;
  const roughness = material.roughness, opacity = material.opacity, map = material.map;
  const shader = { uniforms: THREE.UniformsUtils.clone(THREE.ShaderLib.physical.uniforms), vertexShader: THREE.ShaderLib.physical.vertexShader, fragmentShader: THREE.ShaderLib.physical.fragmentShader };
  material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
  assert.match(shader.vertexShader, /attribute vec2 _nail_detail;/);
  assert.match(shader.fragmentShader, /varying vec2 vNailDetail;/);
  assert.ok(shader.fragmentShader.indexOf('roughnessFactor = mix(roughnessFactor, 0.34, nailMask)') < shader.fragmentShader.indexOf('roughnessFactor = mix(roughnessFactor, 0.08'));
  assert.equal(shader.uniforms.refinedSkinAlbedo.value, texture);
  assert.equal(shader.uniforms.matrixSilver, h.rig.silver);
  assert.equal(material.map, map); assert.equal(material.opacity, opacity); assert.equal(material.roughness, roughness);
  assert.match(material.customProgramCacheKey(), /authored-skin\|painted-skin-albedo-v1-liquid-mirror-v4\|natural-nail-surface-v1$/);
  h.draw(.5);
  assert.equal(skin.geometry.attributes._nail_detail.getX(50), Math.fround(.8));
});

test('an ordinary hand without an authored nail field keeps its existing shader', async t => {
  const h = await actor('trinity'); t.after(() => h.models.dispose());
  const skin = h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.Mesh;
  const material = skin.material as THREE.MeshStandardMaterial;
  const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.physical.vertexShader, fragmentShader: THREE.ShaderLib.physical.fragmentShader };
  material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
  assert.ok(!shader.vertexShader.includes('_nail_detail'));
  assert.ok(!material.customProgramCacheKey().includes('natural-nail-surface'));
});
