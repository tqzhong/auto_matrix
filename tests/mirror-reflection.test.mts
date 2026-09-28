import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { showMirrorSubject } from '../packages/client/src/engine/FilmSetRenderer.js';
import { createMirrorSurface } from '../packages/client/src/engine/MirrorSurface.js';

test('the fractured glass fills the straight-sided mirror without overlapping pieces, holes or flipped faces', () => {
  const mirror = createMirrorSurface();
  try {
    const positions = mirror.geometry.getAttribute('position');
    const fractures = mirror.geometry.getAttribute('fracture');
    const edges = mirror.geometry.getAttribute('edgeDistance');
    let area = 0; const tilts = new Set<string>();
    for (let i = 0; i < positions.count; i += 3) {
      const a = new THREE.Vector3().fromBufferAttribute(positions, i), b = new THREE.Vector3().fromBufferAttribute(positions, i + 1), c = new THREE.Vector3().fromBufferAttribute(positions, i + 2);
      const triangle = b.sub(a).cross(c.sub(a)).z / 2;
      assert.ok(triangle > 0, 'all reflective faces point out of the frame'); area += triangle;
      assert.ok(edges.getX(i) > 0 && edges.getX(i + 1) === 0 && edges.getX(i + 2) === 0, 'only polygon edges form cracks, never the fan triangulation inside a shard');
      for (const vertex of [i + 1, i + 2]) assert.deepEqual([fractures.getX(vertex), fractures.getY(vertex), fractures.getZ(vertex)], [fractures.getX(i), fractures.getY(i), fractures.getZ(i)], 'one fragment keeps one optical offset');
      tilts.add(`${fractures.getX(i)},${fractures.getY(i)}`);
    }
    assert.ok(Math.abs(area - 4) < .003, 'the pieces cover the whole rectangular glass, including all four corners');
    assert.ok(tilts.size >= 6, 'the broken mirror contains separate reflected views');
    for (let x = -.9; x <= .9; x += .15) for (let y = -.9; y <= .9; y += .15) {
      assert.ok(new THREE.Raycaster(new THREE.Vector3(x, y, 1), new THREE.Vector3(0, 0, -1)).intersectObject(mirror).length,
        `no missing fragment at ${x}, ${y}`);
    }
  } finally { mirror.dispose(); mirror.geometry.dispose(); }
});

test('the first-person body appears only in the mirror render', () => {
  const mirror = new Reflector(new THREE.PlaneGeometry(1, 1));
  const body = new THREE.Group(); body.visible = false;
  const electrode = new THREE.Group(); electrode.visible = false;
  let visibleInReflection = false;
  mirror.onBeforeRender = () => { visibleInReflection = body.visible && electrode.visible; };
  showMirrorSubject(mirror, () => body, () => [electrode]);
  mirror.onBeforeRender({} as THREE.WebGLRenderer, new THREE.Scene(), new THREE.PerspectiveCamera(), mirror.geometry, mirror.material, null);
  assert.equal(visibleInReflection, true, 'Neo should be reflected in first person');
  assert.equal(body.visible, false, 'Neo should remain hidden from the direct first-person camera');
  assert.equal(electrode.visible, false, 'the electrode must not float in front of the camera after the arm is hidden');
  mirror.dispose(); mirror.geometry.dispose();
});

test('the mirror reuses its color reflection while the room normals are rendered for occlusion', () => {
  const mirror = new Reflector(new THREE.PlaneGeometry(1, 1));
  const body = new THREE.Group(); body.visible = false;
  const scene = new THREE.Scene(); const normals = new THREE.MeshNormalMaterial();
  let reflections = 0; mirror.onBeforeRender = () => { reflections++; };
  showMirrorSubject(mirror, () => body);
  try {
    scene.overrideMaterial = normals;
    mirror.onBeforeRender({} as THREE.WebGLRenderer, scene, new THREE.PerspectiveCamera(), mirror.geometry, normals, null);
    assert.equal(reflections, 0, 'the normals pass must not render the whole room into the mirror a second time');
    assert.equal(body.visible, false);
    scene.overrideMaterial = null;
    mirror.onBeforeRender({} as THREE.WebGLRenderer, scene, new THREE.PerspectiveCamera(), mirror.geometry, mirror.material, null);
    assert.equal(reflections, 1, 'normal color rendering still updates the live reflected world');
  } finally { normals.dispose(); mirror.dispose(); mirror.geometry.dispose(); }
});
