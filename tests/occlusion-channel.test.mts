import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { WorldOcclusionPass } from '../packages/client/src/engine/PostProcessing.js';

test('occlusion stores one half-float channel without reducing normal precision or image dimensions', () => {
  const pass = new WorldOcclusionPass(new THREE.Scene(), new THREE.PerspectiveCamera(), 1920, 1080);
  try {
    for (const [width, height] of [[1920, 1080], [647, 1005], [960, 540]]) {
      pass.setSize(width, height);
      for (const target of [pass.gtaoRenderTarget, pass.pdRenderTarget]) {
        assert.equal(target.texture.format, THREE.RedFormat, 'the grayscale intermediates need one stored channel');
        assert.equal(target.texture.type, THREE.HalfFloatType, 'keep the original occlusion precision');
        assert.equal(target.width, width); assert.equal(target.height, height);
      }
      assert.equal(pass.normalTexture.format, THREE.RGBAFormat, 'normals must retain their distinct vector components');
      assert.equal(pass.normalTexture.type, THREE.HalfFloatType);
      assert.deepEqual(pass.gtaoMaterial.uniforms.resolution.value.toArray(), [width, height]);
      assert.deepEqual(pass.pdMaterial.uniforms.resolution.value.toArray(), [width, height]);
    }
  } finally { pass.dispose(); }
});

test('switching the diagnostic channel layout reallocates only the AO buffers and only when it changes', () => {
  const pass = new WorldOcclusionPass(new THREE.Scene(), new THREE.PerspectiveCamera(), 64, 64);
  let aoDisposals = 0, normalDisposals = 0;
  for (const target of [pass.gtaoRenderTarget, pass.pdRenderTarget]) target.addEventListener('dispose', () => aoDisposals++);
  pass.normalTexture.addEventListener('dispose', () => normalDisposals++);
  try {
    pass.singleChannel = false;
    assert.equal(aoDisposals, 2, 'existing framebuffer attachments must be replaced when their format changes');
    for (const target of [pass.gtaoRenderTarget, pass.pdRenderTarget]) assert.equal(target.texture.format, THREE.RGBAFormat);
    pass.singleChannel = false; assert.equal(aoDisposals, 2);
    pass.singleChannel = true; assert.equal(aoDisposals, 4);
    pass.singleChannel = true; assert.equal(aoDisposals, 4);
    assert.equal(normalDisposals, 0, 'channel comparison does not replace depth/normal input');
  } finally { pass.dispose(); }
});

test('AO debug outputs expand grayscale while diffuse and normal debug outputs preserve their colors', t => {
  const pass = new WorldOcclusionPass(new THREE.Scene(), new THREE.PerspectiveCamera(), 64, 64);
  const renderer = { shadowMap: { autoUpdate: true, needsUpdate: false } } as THREE.WebGLRenderer;
  const read = new THREE.WebGLRenderTarget(64, 64), write = read.clone();
  const copied: boolean[] = [];
  t.mock.method(GTAOPass.prototype, 'renderOverride', () => {});
  t.mock.method(GTAOPass.prototype, 'renderPass', (_renderer, material) => {
    if (material === pass.copyMaterial) copied.push(material.uniforms.singleChannel?.value);
  });
  try {
    for (const mode of [GTAOPass.OUTPUT.AO, GTAOPass.OUTPUT.Denoise, GTAOPass.OUTPUT.Diffuse, GTAOPass.OUTPUT.Normal]) {
      pass.output = mode; pass.render(renderer, write, read, 0, false);
    }
    assert.deepEqual(copied, [true, true, false, false]);
    copied.length = 0; pass.singleChannel = false; pass.output = GTAOPass.OUTPUT.AO;
    pass.render(renderer, write, read, 0, false); assert.deepEqual(copied, [false]);
  } finally { pass.dispose(); read.dispose(); write.dispose(); }
});
