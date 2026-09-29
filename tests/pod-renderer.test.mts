import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { PodSetRenderer } from '../packages/client/src/engine/PodSetRenderer.js';

test('the rescue bay has an open passage for the body and closes below it after boarding', () => {
  const root = new THREE.Group(); const set = new PodSetRenderer(root);
  try {
    const journey = (elapsed: number) => ({ scene: 'm1_pod', awakening: { kind: 'rescue', elapsed } }) as Parameters<PodSetRenderer['update']>[0];
    set.update(journey(5), 5); root.updateMatrixWorld(true);
    const bay = root.getObjectByName('pod-rescue-bay'); assert.ok(bay, 'the cable must lead into a visible ship');
    for (const x of [-1.5, 0, 1.5]) {
      const hits = new THREE.Raycaster(new THREE.Vector3(x, -2, 12), new THREE.Vector3(0, 1, 0), 0, 3).intersectObject(bay, true);
      assert.equal(hits.length, 0, 'hull and hatch must leave a physical opening for the claw and Neo');
    }
    set.update(journey(8), 8); root.updateMatrixWorld(true);
    const floor = new THREE.Raycaster(new THREE.Vector3(.5, 1, 12), new THREE.Vector3(0, -1, 0), 0, 2).intersectObject(bay, true)[0];
    assert.ok(floor && Math.abs(floor.point.y) < .04, 'the closed hatch forms the receiving deck');
    for (const direction of [new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)]) {
      assert.ok(new THREE.Raycaster(new THREE.Vector3(0, 8.25, 12), direction, 0, 12).intersectObject(bay, true).length,
        'the walls must meet the roof instead of revealing the cultivation towers through a gap');
    }
  } finally { set.dispose(); }
});

test('nearby pods have an open upper basin instead of a closed ellipsoid over the occupant', () => {
  const root = new THREE.Group(); const set = new PodSetRenderer(root);
  root.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(new THREE.Vector3(-16, 16, -29.6), new THREE.Vector3(0, -1, 0), 0, 4);
  const surface = ray.intersectObject(root, true)[0];
  assert.ok(surface, 'the neighboring pod must have a visible interior below its opening');
  assert.ok(surface.point.y <= 14.04, `the upper half must be open, but a solid surface covers it at ${surface.point.y}`);
  assert.ok(surface.point.y >= 12.7, 'the basin floor must remain above its support');
  set.dispose();
});

test('the default pod shot has a readable near bank behind Neo, not only distant dots', () => {
  const root = new THREE.Group(); const set = new PodSetRenderer(root);
  const camera = new THREE.PerspectiveCamera(65, 449 / 680, .1, 300);
  camera.position.set(5.8, 8.2, -6.5); camera.lookAt(0, 4.9, -12.5); camera.updateMatrixWorld();
  const point = new THREE.Vector3(); const matrix = new THREE.Matrix4(); let visible = 0;
  root.traverse(object => {
    if (!(object instanceof THREE.InstancedMesh) || !(object.geometry instanceof THREE.SphereGeometry)) return;
    for (let i = 0; i < object.count; i++) {
      object.getMatrixAt(i, matrix); point.setFromMatrixPosition(matrix);
      if (Math.abs(point.x) > 20 || point.z < -43 || point.z > -24 || point.y < 2 || point.y > 32) continue;
      const screen = point.clone().project(camera);
      if (Math.abs(screen.x) < .95 && Math.abs(screen.y) < .95 && screen.z > -1 && screen.z < 1) visible++;
    }
  });
  assert.ok(visible >= 6, `the opening shot should reveal a nearby human-scale pod bank; saw ${visible} pod centers`);
  set.dispose();
});

test('the maintenance machine leaves room for the immersed first-person view', () => {
  const root = new THREE.Group(); const set = new PodSetRenderer(root);
  const robot = root.children[0].children.find(object => object instanceof THREE.Group && object.position.y === 10 && object.position.z === -14);
  assert.ok(robot);
  const housing = robot.children.find(object => object instanceof THREE.Mesh && object.position.length() < .01);
  assert.ok(housing);
  const bounds = new THREE.Box3().setFromObject(housing);
  assert.ok(bounds.max.y - bounds.min.y <= .9, 'a tall unbroken orb covers Neo’s upward view');
  set.dispose();
});

test('the floating first-person view sees a nearby pod bank beyond the rescue claw', () => {
  const root = new THREE.Group(); const set = new PodSetRenderer(root);
  const camera = new THREE.PerspectiveCamera(68, 449 / 680, .1, 300);
  camera.position.set(-.85, -15.5, 11.5); camera.lookAt(28, 21, 11.5); camera.updateMatrixWorld();
  const point = new THREE.Vector3(); const matrix = new THREE.Matrix4(); let visible = 0;
  root.updateMatrixWorld(true);
  root.traverse(object => {
    if (!(object instanceof THREE.InstancedMesh) || !(object.geometry instanceof THREE.SphereGeometry)) return;
    if (object.geometry.parameters.widthSegments < 16) return;
    for (let i = 0; i < object.count; i++) {
      // The open basins are viewed from below: test their projecting front lip.
      object.getMatrixAt(i, matrix); point.set(0, 0, .8).applyMatrix4(matrix).applyMatrix4(object.matrixWorld);
      if (point.x < 24 || point.x > 29 || point.z < -3 || point.z > 26 || point.y < 12 || point.y > 34) continue;
      const screen = point.clone().project(camera);
      if (Math.abs(screen.x) < .95 && Math.abs(screen.y) < .95 && screen.z > -1 && screen.z < 1) visible++;
    }
  });
  assert.ok(visible >= 4, `the rescue view should reveal nearby human-scale pods; saw ${visible} pod centers`);
  set.dispose();
});

test('the rescue claw approaches from overhead instead of covering the floating camera', () => {
  const root = new THREE.Group(); const set = new PodSetRenderer(root);
  const journey = { awakening: { kind: 'disconnect', elapsed: 9 } } as Parameters<PodSetRenderer['update']>[0];
  set.update(journey, 9, true);
  const claw = root.getObjectByName('pod-rescue-claw');
  assert.ok(claw);
  const eye = new THREE.Vector3(-.85, -15.5, 11.5);
  assert.ok(claw.position.distanceTo(eye) > 6, 'the idle claw should be visible overhead without blocking most of the view');
  set.update({ awakening: { kind: 'rescue', elapsed: 1 } } as Parameters<PodSetRenderer['update']>[0], 10, true);
  assert.ok(claw.position.y < -9, 'the claw should descend toward Neo when the player requests rescue');
  const housing = claw.children.find(object => object instanceof THREE.Mesh && object.geometry instanceof THREE.CylinderGeometry);
  assert.ok(housing);
  const bounds = new THREE.Box3().setFromObject(housing);
  assert.ok(bounds.max.x - bounds.min.x <= 1.2, 'the overhead housing must not turn into a black ceiling during the lift');
  assert.equal(housing.visible, false, 'Neo’s eye camera should see past the housing while being lifted');
  set.update({ awakening: { kind: 'rescue', elapsed: 1 } } as Parameters<PodSetRenderer['update']>[0], 10, false);
  assert.equal(housing.visible, true, 'third-person view still needs the complete rescue machine');
  set.dispose();
});
