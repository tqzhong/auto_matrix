import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { actor } from './helpers/fighting-hand-fixture.mjs';
import { applySkinAlbedo } from '../packages/client/src/agents/SkinAlbedo.js';

test('a local reference pigment layer replaces painted lip colour after skin albedo and survives rig cloning', async t => {
  const texture = new THREE.Texture(); t.after(() => texture.dispose());
  const h = await actor('morpheus', scene => {
    const skin = scene.getObjectByName('Anatomical_head_and_hands') as THREE.Mesh;
    const count = skin.geometry.attributes.position.count;
    skin.geometry.setAttribute('_albedo_uv', new THREE.Float32BufferAttribute(new Float32Array(count * 2), 2));
    skin.geometry.setAttribute('_albedo_weight', new THREE.Float32BufferAttribute(new Float32Array(count), 1));
    skin.geometry.setAttribute('_face_pigment', new THREE.Float32BufferAttribute(new Float32Array(count * 4), 4));
    skin.geometry.setAttribute('_nail_detail', new THREE.Float32BufferAttribute(new Float32Array(count * 2), 2));
    applySkinAlbedo(skin.material as THREE.MeshStandardMaterial, texture);
  });
  t.after(() => h.models.dispose());
  const skin = h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.Mesh;
  const material = skin.material as THREE.MeshStandardMaterial;
  const shader = { uniforms: THREE.UniformsUtils.clone(THREE.ShaderLib.physical.uniforms), vertexShader: THREE.ShaderLib.physical.vertexShader, fragmentShader: THREE.ShaderLib.physical.fragmentShader };
  material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
  assert.match(shader.vertexShader, /attribute vec4 _face_pigment;/);
  assert.match(shader.fragmentShader, /diffuseColor\.rgb = mix\(diffuseColor\.rgb, vReferencePigment\.rgb \* diffuse, vReferencePigment\.a\);/);
  assert.ok(shader.fragmentShader.indexOf('texture2D(refinedSkinAlbedo') < shader.fragmentShader.indexOf('vReferencePigment.rgb * diffuse'));
  assert.match(shader.vertexShader, /attribute vec2 _nail_detail;/);
  assert.equal(shader.uniforms.refinedSkinAlbedo.value, texture);
  assert.match(material.customProgramCacheKey(), /reference-pigment-v1\|natural-nail-surface-v1$/);
});

test('an ordinary actor has no reference-pigment shader or extra vertex requirement', async t => {
  const h = await actor('morpheus'); t.after(() => h.models.dispose());
  const skin = h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.Mesh;
  const material = skin.material as THREE.MeshStandardMaterial;
  const shader = { uniforms: THREE.UniformsUtils.clone(THREE.ShaderLib.physical.uniforms), vertexShader: THREE.ShaderLib.physical.vertexShader, fragmentShader: THREE.ShaderLib.physical.fragmentShader };
  material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
  assert.doesNotMatch(shader.vertexShader, /_face_pigment|vReferencePigment/);
  assert.doesNotMatch(material.customProgramCacheKey(), /reference-pigment/);
});
