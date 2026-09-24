import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { showMirrorSubject } from '../packages/client/src/engine/FilmSetRenderer.js';

test('the first-person body appears only in the mirror render', () => {
  const mirror = new Reflector(new THREE.PlaneGeometry(1, 1));
  const body = new THREE.Group(); body.visible = false;
  let visibleInReflection = false;
  mirror.onBeforeRender = () => { visibleInReflection = body.visible; };
  showMirrorSubject(mirror, () => body);
  mirror.onBeforeRender({} as THREE.WebGLRenderer, new THREE.Scene(), new THREE.PerspectiveCamera(), mirror.geometry, mirror.material, null);
  assert.equal(visibleInReflection, true, 'Neo should be reflected in first person');
  assert.equal(body.visible, false, 'Neo should remain hidden from the direct first-person camera');
  mirror.dispose(); mirror.geometry.dispose();
});
