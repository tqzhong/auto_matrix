import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { LightingSystem } from '../packages/client/src/engine/LightingSystem.js';

test('an authored camera fill may be dimmed or disabled and resets when leaving its film set', () => {
  const scene = new THREE.Scene(), lighting = new LightingSystem(scene), camera = new THREE.PerspectiveCamera();
  const fill = scene.children.find(object => object instanceof THREE.DirectionalLight && object !== lighting.directionalLight) as THREE.DirectionalLight;
  try {
    lighting.update(0, camera, false, { ambient: .4, sun: 0, color: 0xffd4ad, fill: .2 });
    assert.equal(fill.intensity, .2);
    lighting.update(0, camera, false, { ambient: .4, sun: 0, color: 0xffd4ad, fill: 0 });
    assert.equal(fill.intensity, 0, 'zero must not fall back to the generic fill');
    lighting.update(0, camera, false, { ambient: .8, sun: 2.6, color: 0xffdba0 });
    assert.equal(fill.intensity, .75, 'a subsequent film set must restore the existing fill');
    lighting.update(0, camera); assert.equal(fill.intensity, .75);
    lighting.update(0); assert.equal(fill.visible, false);
  } finally { lighting.dispose(); }
});

test('a film set with its own sun must not redraw a zero-intensity global shadow, and leaving restores daylight shadows', () => {
  const scene = new THREE.Scene(), lighting = new LightingSystem(scene);
  const camera = new THREE.PerspectiveCamera(); camera.position.set(5000, 8, 5000);
  const parkSun = new THREE.DirectionalLight(0xffc186, 2.75); parkSun.castShadow = true; scene.add(parkSun);
  try {
    lighting.setTime(7000);
    lighting.update(0, camera, false, { ambient: .42, sun: 0, color: 0xffd4ad });
    assert.equal(lighting.directionalLight.intensity, 0, 'the authored set atmosphere applies after time-of-day lighting');
    assert.equal(lighting.directionalLight.castShadow, false, 'a dark global sun cannot add an invisible full shadow pass');
    assert.equal(lighting.ambientLight.intensity, .42);
    assert.equal(parkSun.intensity, 2.75); assert.equal(parkSun.castShadow, true, 'the real park sun must still cast contact shadows');
    lighting.setTime(12000); lighting.update(0, camera);
    assert.ok(lighting.directionalLight.intensity > 2); assert.equal(lighting.directionalLight.castShadow, true);
    lighting.update(0, camera, true, { ambient: .8, sun: 1.5, color: 0xf0e0ca });
    assert.equal(lighting.directionalLight.intensity, 1.5); assert.equal(lighting.directionalLight.castShadow, false, 'existing interior shadow suppression remains in force');
    lighting.update(0, camera, false, { ambient: 1, sun: 2.6, color: 0xffdba0 });
    assert.equal(lighting.directionalLight.castShadow, true, 'a later outdoor film set must restore its shadow');
    assert.equal(lighting.directionalLight.color.getHex(), 0xffdba0);
  } finally { lighting.dispose(); parkSun.dispose(); }
});
