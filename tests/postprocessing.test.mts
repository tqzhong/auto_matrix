import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { WorldOcclusionPass } from '../packages/client/src/engine/PostProcessing.js';

test('the occlusion pass skips hidden worlds and restores only the overlays it suppressed', t => {
  const scene = new THREE.Scene(); const hiddenWorld = new THREE.Group(); hiddenWorld.visible = false;
  const hiddenStreet = new THREE.Group(); hiddenStreet.add(new THREE.Sprite()); hiddenWorld.add(hiddenStreet); scene.add(hiddenWorld);
  const traverse = t.mock.method(hiddenStreet, 'traverse');
  const traverseVisible = t.mock.method(hiddenStreet, 'traverseVisible');
  const solid = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  const overlay = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial({ depthWrite: false }));
  const label = new THREE.Sprite(); const invisibleLabel = new THREE.Sprite(); invisibleLabel.visible = false;
  const line = new THREE.Line(); const points = new THREE.Points();
  scene.add(solid, overlay, label, invisibleLabel, line, points);
  const pass = new WorldOcclusionPass(scene, new THREE.PerspectiveCamera(), 64, 64);
  try {
    for (let frame = 0; frame < 2; frame++) {
      pass.overrideVisibility();
      assert.equal(solid.visible, true, 'solid geometry still contributes contact shadows');
      for (const object of [overlay, label, invisibleLabel, line, points]) assert.equal(object.visible, false);
      assert.equal(hiddenWorld.visible, false); assert.equal(hiddenStreet.children[0].visible, true);
      pass.restoreVisibility();
      for (const object of [solid, overlay, label, line, points]) assert.equal(object.visible, true);
      assert.equal(invisibleLabel.visible, false, 'a label hidden before the pass must stay hidden');
      assert.equal(hiddenWorld.visible, false);
    }
    assert.equal(traverse.mock.callCount() + traverseVisible.mock.callCount(), 0, 'a hidden city must not be walked for every occlusion pass');
    hiddenWorld.visible = true;
    pass.overrideVisibility(); assert.equal(hiddenStreet.children[0].visible, false, 'the same city participates after returning to it');
    pass.restoreVisibility(); assert.equal(hiddenStreet.children[0].visible, true);
  } finally {
    pass.dispose(); solid.geometry.dispose(); solid.material.dispose(); overlay.geometry.dispose(); overlay.material.dispose();
  }
});

test('the normals pass reuses this frame\'s matrices and shadows, then restores renderer settings', t => {
  const scene = new THREE.Scene(); const pass = new WorldOcclusionPass(scene, new THREE.PerspectiveCamera(), 64, 64);
  const renderer = { shadowMap: { autoUpdate: true, needsUpdate: true } } as THREE.WebGLRenderer;
  let fail = false;
  t.mock.method(GTAOPass.prototype, 'renderOverride', () => {
    assert.equal(scene.matrixWorldAutoUpdate, false, 'the preceding color pass already updated the same scene');
    assert.equal(renderer.shadowMap.autoUpdate, false, 'normals do not need a second shadow render');
    assert.equal(renderer.shadowMap.needsUpdate, false);
    if (fail) throw new Error('render failure');
  });
  try {
    pass.renderOverride(renderer, pass.normalMaterial, null);
    assert.equal(scene.matrixWorldAutoUpdate, true); assert.equal(renderer.shadowMap.autoUpdate, true); assert.equal(renderer.shadowMap.needsUpdate, true);
    fail = true; renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = false;
    assert.throws(() => pass.renderOverride(renderer, pass.normalMaterial, null), /render failure/);
    assert.equal(scene.matrixWorldAutoUpdate, true); assert.equal(renderer.shadowMap.autoUpdate, false); assert.equal(renderer.shadowMap.needsUpdate, false);
  } finally { pass.dispose(); }
});
