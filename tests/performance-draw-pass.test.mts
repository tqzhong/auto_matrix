import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { frameDrawPass } from '../packages/client/src/player/PerformancePanel.js';

test('the opaque transmission copy is separate from the main color draws using the same camera', () => {
  const camera = new THREE.PerspectiveCamera();
  const material = new THREE.MeshStandardMaterial();
  // These are the actual Three.js 0.170.0 renderTransmissionPass settings.
  const transmission = new THREE.WebGLRenderTarget(1920, 1080, {
    type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, samples: 4,
  });
  const color = new THREE.WebGLRenderTarget(1920, 1080, { type: THREE.HalfFloatType });
  try {
    assert.equal(frameDrawPass(camera, camera, material, transmission), 'transmission');
    assert.equal(frameDrawPass(camera, camera, material, color), 'scene');
    assert.equal(frameDrawPass(camera, camera, material, null), 'scene');
  } finally { material.dispose(); transmission.dispose(); color.dispose(); }
});

test('reflected glass copies have their own bucket and do not become main-camera transmission', () => {
  const camera = new THREE.PerspectiveCamera(), reflected = camera.clone();
  const material = new THREE.MeshStandardMaterial();
  const transmission = new THREE.WebGLRenderTarget(768, 1024, {
    generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, samples: 4,
  });
  const reflection = new THREE.WebGLRenderTarget(768, 1024);
  try {
    assert.equal(frameDrawPass(reflected, camera, material, transmission), 'reflectionTransmission');
    assert.equal(frameDrawPass(reflected, camera, material, reflection), 'reflectionOrPreview');
  } finally { material.dispose(); transmission.dispose(); reflection.dispose(); }
});

test('depth, normals and fullscreen work keep their existing buckets regardless of the render target', () => {
  const camera = new THREE.PerspectiveCamera(), fullscreen = new THREE.OrthographicCamera();
  const depth = new THREE.MeshDepthMaterial(), distance = new THREE.MeshDistanceMaterial();
  const normal = new THREE.MeshNormalMaterial(), color = new THREE.MeshBasicMaterial();
  const target = new THREE.WebGLRenderTarget(64, 64, { generateMipmaps: true, samples: 4 });
  try {
    assert.equal(frameDrawPass(camera, camera, depth, target), 'shadows');
    assert.equal(frameDrawPass(camera, camera, distance, target), 'shadows');
    assert.equal(frameDrawPass(camera, camera, normal, target), 'occlusion');
    assert.equal(frameDrawPass(fullscreen, camera, color, null), 'postprocessing');
  } finally { depth.dispose(); distance.dispose(); normal.dispose(); color.dispose(); target.dispose(); }
});

test('an ordinary multisampled color buffer does not become a glass-copy draw', () => {
  const camera = new THREE.PerspectiveCamera(), material = new THREE.MeshStandardMaterial();
  const target = new THREE.WebGLRenderTarget(64, 64, { samples: 4 });
  try { assert.equal(frameDrawPass(camera, camera, material, target), 'scene'); }
  finally { material.dispose(); target.dispose(); }
});

test('mipmapped environment targets without the transmission multisample buffer keep their normal stage', () => {
  const camera = new THREE.PerspectiveCamera(), material = new THREE.MeshStandardMaterial();
  const target = new THREE.WebGLRenderTarget(64, 64, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  try { assert.equal(frameDrawPass(camera, camera, material, target), 'scene'); }
  finally { material.dispose(); target.dispose(); }
});
