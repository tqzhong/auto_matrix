import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { METACORTEX, ARREST_CAR, ARREST_BIKE, arrestCarPoint, arrestBikePoint, type OfficeCustody } from '@auto_matrix/shared';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { CustodyStreetRenderer } from '../packages/client/src/engine/CustodyStreetRenderer.js';

test('the sedan opens a physical rear doorway, closes continuously and releases its real mirror target', () => {
  const root = new THREE.Group(); root.position.set(METACORTEX.center.x, 0, METACORTEX.center.z);
  const renderer = new CustodyStreetRenderer(root), custody = { phase: 'street', elapsed: 3.2, lift: { floor: 0, phase: 'idle', target: 0, elapsed: 0 }, watcher: {}, street: { phase: 'opening', elapsed: 0 } } as OfficeCustody;
  const mirror = root.getObjectByName('office-arrest-rearview') as Reflector;
  const target = mirror.getRenderTarget(); let released = false; target.addEventListener('dispose', () => { released = true; });
  const door = root.getObjectByName('office-arrest-door--1-rear')!;
  const from = arrestCarPoint(-6, 1.7), to = arrestCarPoint(ARREST_CAR.seats.neo.x, ARREST_CAR.seats.neo.z);
  const origin = new THREE.Vector3(from.x, 2.2, from.z), direction = new THREE.Vector3(to.x - from.x, 0, to.z - from.z).normalize();
  const intersects = () => { root.updateMatrixWorld(true); return new THREE.Raycaster(origin, direction, 0, 6).intersectObject(door, true); };
  try {
    renderer.update(custody); assert.ok(intersects().length, 'a closed rear door blocks the actual entry line'); assert.equal(mirror.visible, false);
    custody.street!.elapsed = 1.4; renderer.update(custody);
    assert.equal(intersects().length, 0, 'the hinged door must open outward and clear the rear-seat approach');
    custody.street = { phase: 'entering', elapsed: 3.2, observed: true }; renderer.update(custody); assert.equal(mirror.visible, true);
    const open = door.rotation.y; custody.street.elapsed = 6.5; renderer.update(custody);
    assert.ok(Math.abs(door.rotation.y) > 0 && Math.abs(door.rotation.y) < Math.abs(open), 'the first doors close only after the bodies clear their apertures'); assert.equal(mirror.visible, false);
    custody.street = { phase: 'done', elapsed: 0 }; renderer.update(custody); assert.ok(intersects().length);
  } finally { renderer.dispose(); }
  assert.ok(released); assert.equal(root.getObjectByName('office-street-arrest'), undefined);
});

test('the rearview aims at the displayed Neo and its frame fits both player viewports', () => {
  const root = new THREE.Group(); root.position.set(METACORTEX.center.x, 0, METACORTEX.center.z);
  const renderer = new CustodyStreetRenderer(root), custody = { phase: 'street', elapsed: 3.2, lift: {}, watcher: {}, street: { phase: 'entering', elapsed: 3.2 } } as OfficeCustody;
  const subject = new THREE.Group(), head = new THREE.Bone(); head.name = 'head'; subject.add(head);
  const neo = arrestCarPoint(-4, 1.7); subject.position.set(neo.x, 2.6, neo.z);
  try {
    renderer.update(custody, subject); root.updateMatrixWorld(true);
    const mirror = root.getObjectByName('office-arrest-rearview')!, center = mirror.getWorldPosition(new THREE.Vector3());
    const view = arrestBikePoint(ARREST_BIKE.view.x, ARREST_BIKE.view.z), origin = new THREE.Vector3(view.x, ARREST_BIKE.view.y, view.z);
    const sightline = center.clone().sub(origin);
    assert.equal(new THREE.Raycaster(origin, sightline.clone().normalize(), .01, sightline.length() - .001).intersectObject(root, true).length, 0,
      'the motorcycle mirror support must not block the optical surface');
    root.getObjectByName('office-arrest-motorcycle')!.traverse(mesh => {
      if (!(mesh instanceof THREE.Mesh) || !(mesh.material instanceof THREE.MeshStandardMaterial) || mesh.material.color.getHex() !== 0x8a9598) return;
      const positions = mesh.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const point = mirror.worldToLocal(mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(positions, i)));
        assert.ok(!(Math.abs(point.x) < .46 && Math.abs(point.y) < .25 && point.z > .002 && point.z < .06), 'the chrome support must not protrude through the mirror picture');
      }
    });
    const incident = center.clone().sub(origin).normalize(), normal = new THREE.Vector3(0, 0, 1).applyQuaternion(mirror.getWorldQuaternion(new THREE.Quaternion()));
    const reflected = incident.addScaledVector(normal, -2 * incident.dot(normal));
    const target = head.localToWorld(new THREE.Vector3(0, .2, .06)).sub(center).normalize();
    assert.ok(reflected.distanceTo(target) < .005, 'the mirror must track the actual ducking head, rather than the future seat');
    for (const aspect of [16 / 9, .75]) {
      const camera = new THREE.PerspectiveCamera(aspect < .85 ? 60 : 38, aspect, .06, 5000); camera.position.copy(origin); camera.lookAt(center); camera.updateMatrixWorld(true);
      for (const x of [-.54, .54]) for (const y of [-.33, .33]) {
        const point = mirror.parent!.localToWorld(new THREE.Vector3(x, y, 0)).project(camera);
        assert.ok(Math.abs(point.x) < .96 && Math.abs(point.y) < .96, `the motorcycle mirror frame must remain visible: ${aspect}/${point.toArray()}`);
      }
    }
  } finally { renderer.dispose(); }
});
