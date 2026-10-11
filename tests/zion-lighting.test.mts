import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import type { FilmJourney } from '@auto_matrix/shared';
import { ZionHomecomingRenderer } from '../packages/client/src/engine/ZionHomecomingRenderer.js';

test('identical dock lamp housings share materials and draws without removing glowing fixtures', () => {
  const renderer = new ZionHomecomingRenderer(new THREE.Group(), 'film_zion_hangar');
  const bulbs: THREE.Mesh[] = [];
  try {
    renderer.group.traverse(object => {
      if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial
        && object.material.emissive.getHex() === 0xff934a) bulbs.push(object);
    });
    const triangles = bulbs.reduce((sum, bulb) => sum + (bulb.geometry.index?.count ?? bulb.geometry.attributes.position.count) / 3, 0);
    assert.equal(triangles, 26 * 12, 'all 26 luminous boxes must retain every triangle');
    assert.equal(new Set(bulbs.map(bulb => bulb.material)).size, 1, 'identical fixtures should share one material');
    assert.equal(bulbs.length, 1, 'unchanged fixed bulb surfaces can share a single draw');
  } finally { renderer.dispose(); }
});

test('dock lamps keep their fixtures but only nearby lights enter the forward lighting pass', () => {
  const root = new THREE.Group(); root.position.set(5000, -100, 5000);
  const renderer = new ZionHomecomingRenderer(root, 'film_zion_hangar');
  const lamps: THREE.PointLight[] = [];
  root.traverse(object => {
    if (object instanceof THREE.PointLight && Math.abs(object.position.x) === 16 && object.distance === 23) lamps.push(object);
  });
  try {
    assert.equal(lamps.length, 26, 'retain every lamp location for local illumination');
    const origin = root.position;
    for (const [x, z] of [[-40, 27], [-40, -16], [0, -50], [0, 12], [0, 49], [95, 40]]) {
      const viewer = new THREE.Vector3(x, 4, z), worldViewer = viewer.clone().add(origin);
      renderer.update(undefined, 0, worldViewer);
      const visible = lamps.filter(lamp => lamp.visible);
      assert.equal(visible.length, 6, 'the 26 fixtures must not all add a per-pixel light loop');
      const nearest = [...lamps].sort((a, b) => a.position.distanceToSquared(viewer) - b.position.distanceToSquared(viewer)).slice(0, 6);
      assert.ok(nearest.every(lamp => visible.includes(lamp)), 'world-space camera movement selects the nearby lamps');
      assert.ok(visible.every(lamp => lamp.intensity === 80), 'selected lamps retain their authored brightness');
      assert.deepEqual(worldViewer, viewer.add(origin), 'lighting cannot move the caller’s camera');
    }
    const journey = { scene: 'm3_emp', completed: ['m3_emp'] } as unknown as FilmJourney;
    renderer.update(journey, 0, new THREE.Vector3(5000, -96, 5012));
    assert.ok(lamps.filter(lamp => lamp.visible).every(lamp => Math.abs(lamp.intensity - 6.4) < .001), 'EMP still dims the selected lamps');
  } finally { renderer.dispose(); }
});

test('dock lighting excludes only lights with no influence in the view and restores them when turning', () => {
  const root = new THREE.Group(); root.position.set(5000, -100, 5000);
  const renderer = new ZionHomecomingRenderer(root, 'film_zion_hangar');
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 300);
  const journey = { scene: 'm3_gate', actor: 'kid', step: 1, completed: [] } as unknown as FilmJourney;
  const near = new THREE.PointLight(0xffffff, 50, 20), far = new THREE.PointLight(0xffffff, 50, 4);
  const flash = new THREE.PointLight(0xffffff, 0, 20);
  near.position.set(0, 8, 33); far.position.set(0, 8, 43); flash.position.set(0, 8, 12);
  renderer.group.add(near, far, flash);
  const lights: THREE.PointLight[] = [];
  root.traverse(object => { if (object instanceof THREE.PointLight) lights.push(object); });
  try {
    for (const direction of [-1, 1, -1]) {
      camera.position.set(5000, -92, 5030); camera.lookAt(5000, -92, 5030 + direction * 30); camera.updateMatrixWorld(true);
      renderer.update(journey, 0, camera.position);
      const previouslyVisible: THREE.PointLight[] = [];
      root.traverseVisible(object => { if (object instanceof THREE.PointLight) previouslyVisible.push(object); });
      const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      const contributes = (light: THREE.PointLight) => light.intensity > 0 && (light.distance === 0
        || frustum.intersectsSphere(new THREE.Sphere(light.getWorldPosition(new THREE.Vector3()), light.distance)));
      const expected = previouslyVisible.filter(contributes);
      renderer.update(journey, 0, camera.position, camera);
      assert.deepEqual(previouslyVisible.filter(light => light.visible).map(light => light.id), expected.map(light => light.id), 'only zero-intensity or completely off-view influence volumes may be omitted');
      assert.ok(near.visible, 'a bulb behind the camera still illuminates visible ground within its range');
      assert.equal(far.visible, direction > 0, 'turning must restore a lamp whose influence enters the view');
      assert.equal(flash.visible, false, 'a dark flash must not occupy a shader light slot');
    }
    flash.intensity = 80;
    renderer.update(journey, 0, camera.position, camera);
    assert.ok(flash.visible, 'a new muzzle flash must immediately light the visible scene');
    renderer.update({ scene: 'm3_emp', completed: ['m3_emp'] } as unknown as FilmJourney, 0, camera.position, camera);
    assert.ok(lights.filter(light => light !== near && light !== far && light !== flash && light.visible)
      .every(light => light.intensity < 210), 'EMP dimming must still apply before visibility selection');
  } finally { renderer.dispose(); near.dispose(); far.dispose(); flash.dispose(); }
});

test('looking out of the temple excludes interior lamps, while turning back restores their illumination and all scenery stays present', () => {
  const root = new THREE.Group(); root.position.set(5000, -100, 5000);
  const renderer = new ZionHomecomingRenderer(root, 'film_zion_temple');
  const journey = { scene: 'm3_ceasefire', step: 1, completed: ['m3_temple_breach'] } as unknown as FilmJourney;
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000);
  const lights: THREE.PointLight[] = [], meshes: THREE.Mesh[] = [];
  renderer.update(journey, 0); root.updateMatrixWorld(true);
  root.traverseVisible(object => {
    if (object instanceof THREE.PointLight) lights.push(object);
    if (object instanceof THREE.Mesh) meshes.push(object);
  });
  const intensities = lights.map(light => light.intensity);
  const interior = lights.find(light => light.position.equals(new THREE.Vector3(31, 6, 20)))!;
  const entrance = lights.filter(light => Math.abs(light.position.x) === 8 && light.position.z === -43);
  const fill = lights.find(light => light.position.equals(new THREE.Vector3(0, 34, -30)))!;
  const flood = root.getObjectsByProperty('type', 'SpotLight')[0];
  try {
    assert.equal(lights.length, 22, 'all authored point lights remain available for the temple');
    assert.equal(entrance.length, 2);
    for (const aspect of [16 / 9, .65]) for (const outside of [true, false, true]) {
      camera.aspect = aspect; camera.updateProjectionMatrix();
      camera.position.set(5000, -95.6, 4949.13);
      camera.lookAt(5000, outside ? -88 : -92, outside ? 4895 : 5030); camera.updateMatrixWorld(true);
      renderer.update(journey, 0, camera.position, camera);
      if (outside) {
        assert.equal(lights.filter(light => light.visible).length, 3, 'nineteen interior lights cannot reach the exterior view');
        assert.equal(interior.visible, false, 'the rear column lamp adds no light outside the entrance');
      } else assert.ok(interior.visible, 'turning into the hall restores the actual column lighting immediately');
      assert.ok(entrance.every(light => light.visible), 'bulbs behind the viewer can still light the visible bridge');
      assert.ok(fill.visible && flood.visible, 'the large fill and exterior spotlight still illuminate the city');
      assert.deepEqual(lights.map(light => light.intensity), intensities, 'selection must not dim the authored lights');
      assert.ok(meshes.every(mesh => mesh.visible), 'optimization cannot remove residents, fixtures, architecture or shadow casters');
    }
    renderer.update(journey, 0, camera.position);
    assert.ok(lights.every(light => light.visible), 'a caller without a view must restore all local illumination');
  } finally { renderer.dispose(); }
});
