import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { METACORTEX, ARREST_CAR, ARREST_BIKE, ARREST_DRIVE_SECONDS, arrestDriveSeconds, arrestCarBounds, arrestCarPoint, arrestBikePoint, playerBlocked, type OfficeCustody } from '@auto_matrix/shared';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { CustodyStreetRenderer } from '../packages/client/src/engine/CustodyStreetRenderer.js';

test('the custody sedan keeps the shared formed windshield and wheel arches', () => {
  const root = new THREE.Group();
  const renderer = new CustodyStreetRenderer(root), car = root.getObjectByName('office-arrest-sedan')!;
  const windshield = car.getObjectByName('office-arrest-windshield') as THREE.Mesh;
  const rearGlass = car.getObjectByName('office-arrest-rear-glass') as THREE.Mesh;
  const fenders = car.getObjectByName('office-arrest-fenders') as THREE.Group;
  try {
    car.visible = true; root.updateMatrixWorld(true);
    assert.ok(windshield?.material instanceof THREE.MeshPhysicalMaterial && windshield.material.transparent,
      'the windshield must close the sedan cabin with the same reflective glass as the bridge sedan');
    assert.ok(rearGlass?.material instanceof THREE.MeshPhysicalMaterial && rearGlass.material.transparent,
      'the rear glass must meet the cabin roof and trunk');
    const body = fenders.children.find(object => object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial) as THREE.Mesh;
    assert.ok(body, 'the shared arch surfaces must remain batched in the car');
    body.geometry.computeBoundingBox(); const bounds = body.geometry.boundingBox!;
    assert.ok(bounds.min.x >= -2.75 && bounds.max.x <= 2.75, 'formed arches must remain inside the saved car collider width');
    const ray = new THREE.Raycaster();
    const chassis = car.children.filter(object => !object.name.startsWith('office-arrest-wheel-') && !object.name.startsWith('office-arrest-door-'));
    for (const side of [-1, 1]) for (const wheel of [-4.9, 4.8]) {
      ray.set(car.localToWorld(new THREE.Vector3(side * 3, 1.55, wheel)), new THREE.Vector3(-side, 0, 0).transformDirection(car.matrixWorld));
      assert.equal(ray.intersectObject(body, false).length, 0, 'each formed arch leaves a real tire opening');
      const hullHits = ray.intersectObjects(chassis, true);
      assert.ok(hullHits.every(hit => side * car.worldToLocal(hit.point.clone()).x <= 2.32), 'the bonnet and trunk must stop inside the tire sidewall');
      const nearest = ray.intersectObjects(car.children, true)[0]; let owner = nearest?.object;
      while (owner && owner !== car && !owner.name.startsWith('office-arrest-wheel-')) owner = owner.parent;
      assert.equal(owner?.name, `office-arrest-wheel-${side}-${wheel < 0 ? 'front' : 'rear'}`, 'the tire face must be the visible surface inside its arch');
      ray.set(car.localToWorld(new THREE.Vector3(side * 3, 1.55, wheel + 1.05)), new THREE.Vector3(-side, 0, 0).transformDirection(car.matrixWorld));
      assert.ok(ray.intersectObject(body, false).length, 'the body remains continuous just past each wheel opening');
    }
  } finally { renderer.dispose(); }
});

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

test('the whole rendered sedan follows a clear street turn inside its moving collision bounds', () => {
  const root = new THREE.Group(); root.position.set(METACORTEX.center.x, 0, METACORTEX.center.z);
  const renderer = new CustodyStreetRenderer(root), custody = { phase: 'street', elapsed: 3.2, lift: {}, street: { phase: 'departing', elapsed: 0 } } as OfficeCustody;
  const car = root.getObjectByName('office-arrest-sedan')!, wheel = root.getObjectByName('office-arrest-wheel--1-front')!;
  let vertices = 0;
  try {
    for (let age = 0; age <= ARREST_DRIVE_SECONDS; age += .125) {
      custody.street!.elapsed = age; renderer.update(custody); root.updateMatrixWorld(true);
      const bounds = arrestCarBounds(custody.street);
      car.traverse(mesh => {
        if (!(mesh instanceof THREE.Mesh)) return;
        const positions = mesh.geometry.attributes.position;
        for (let i = 0; i < positions.count; i += 11) {
          const point = mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(positions, i)); vertices++;
          assert.ok(Math.abs(point.x - bounds.position.x) <= bounds.width / 2 + .003 && Math.abs(point.z - bounds.position.z) <= bounds.depth / 2 + .003,
            `rendered bumper/mirror/wheel leaves its collider: ${age}/${mesh.name}/${point.toArray()}/${JSON.stringify(bounds)}`);
          assert.equal(playerBlocked({ x: point.x, y: 1, z: point.z }, true, 0), false, `rendered car clips the static city: ${age}/${point.toArray()}`);
        }
      });
    }
    assert.ok(vertices > 20000, 'inspect actual sedan surfaces throughout the turn');
    custody.street!.elapsed = 6; renderer.update(custody);
    assert.ok(Math.abs(wheel.rotation.y) > .1, 'front tires steer through the corner');
    const stopped = wheel.children[0].rotation.x; renderer.update(custody); assert.equal(wheel.children[0].rotation.x, stopped, 'an unchanged saved time cannot roll a paused tire');
    custody.street!.elapsed = 7; renderer.update(custody); assert.ok(Math.abs(wheel.children[0].rotation.x - stopped) > 6, 'visible spokes roll with traveled distance');
  } finally { renderer.dispose(); }
});

test('alternate safe parking routes keep real sedan surfaces inside their colliders and end in the matching traffic lane', () => {
  const root = new THREE.Group(); root.position.set(METACORTEX.center.x, 0, METACORTEX.center.z);
  const renderer = new CustodyStreetRenderer(root), custody = { phase: 'street', elapsed: 3.2, lift: {}, street: { phase: 'departing', elapsed: 0 } } as OfficeCustody;
  const car = root.getObjectByName('office-arrest-sedan')!;
  try {
    for (const x of [13, 25, -40]) {
      custody.street!.parking = { x, z: 49 }; const seconds = arrestDriveSeconds(custody.street);
      for (let sample = 0; sample <= 16; sample++) {
        custody.street!.elapsed = seconds * sample / 16; renderer.update(custody); root.updateMatrixWorld(true);
        const bounds = arrestCarBounds(custody.street);
        car.traverse(mesh => {
          if (!(mesh instanceof THREE.Mesh)) return;
          const vertices = mesh.geometry.attributes.position;
          for (let i = 0; i < vertices.count; i += 23) {
            const point = mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(vertices, i));
            assert.ok(Math.abs(point.x - bounds.position.x) <= bounds.width / 2 + .003 && Math.abs(point.z - bounds.position.z) <= bounds.depth / 2 + .003);
            assert.equal(playerBlocked({ x: point.x, y: 1, z: point.z }, true, 0), false, `new route clips the city: ${x}/${sample}/${point.toArray()}`);
          }
        });
      }
      assert.ok(Math.abs(arrestCarPoint(0, 0, custody.street).x - 1204) < .001, 'new departures must join the +Z lane');
    }
  } finally { renderer.dispose(); }
});
