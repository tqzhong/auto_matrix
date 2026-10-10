import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { HammerRouteRenderer } from '../packages/client/src/engine/HammerRouteRenderer.js';
import { FILM_SETS, hammerCrewRoot, hammerShipPose, newHammerFlight, newHammerGunnery, type AgentState } from '@auto_matrix/shared';
import { hammerNiobeInput, hammerProjectPoint, hammerTunnelSection, stepHammerFlight } from '@auto_matrix/shared';
import { hammerGunneryView } from '@auto_matrix/shared';

test('the gunner camera stays below the actual aft roof through full ship roll and allows full cannon elevation', t => {
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  const target = { addEventListener() {}, removeEventListener() {}, exitPointerLock() {} };
  ['window', 'document'].forEach(key => Object.defineProperty(globalThis, key, { configurable: true, value: target }));
  const camera = new THREE.PerspectiveCamera(48, 16 / 9, .5, 5000);
  const controls = new PlayerControls(target as unknown as HTMLCanvasElement, camera, () => {}, () => {});
  t.after(() => { controls.dispose(); ['window', 'document'].forEach((key, i) => previous[i] ? Object.defineProperty(globalThis, key, previous[i]!) : Reflect.deleteProperty(globalThis, key)); });
  for (const bank of [0, .7, Math.PI / 2, -Math.PI / 2]) {
    const flight = { ...newHammerFlight(), gunnery: newHammerGunnery() }; flight.z = -75; flight.maneuver!.bank = bank;
    const point = hammerCrewRoot(flight, 'ghost'), center = FILM_SETS.film_hammer_route.center, ship = hammerShipPose(flight);
    const state = { id: 'ghost', status: 'alive', health: 100, maxHealth: 100, isInMatrix: false, currentLocation: 'film_hammer_route', rotation: point.yaw,
      position: { x: center.x + point.x, y: center.y + point.y, z: center.z + point.z }, velocity: { x: 0, y: 0, z: 0 }, activeEffects: [],
      currentAction: { type: 'idle', parameters: { hammerPilot: { role: 'ghost', flight }, seated: true, riding: true }, startedAt: 1, duration: 1e9, progress: 0 } } as AgentState;
    const group = new THREE.Group(); group.position.set(state.position.x, state.position.y, state.position.z);
    controls.possess(state); controls.gunner = true; controls.performing = true; controls.update(.1, state, group, false);
    const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(ship.pitch, ship.yaw, ship.roll, 'YXZ'));
    const local = camera.position.clone().sub(new THREE.Vector3(center.x + ship.x, center.y + ship.y, center.z + ship.z)).applyQuaternion(rotation.invert());
    assert.ok(local.y < 1.89 && local.y > -2.2 && Math.abs(local.x) < 2 && local.z > 9.95 && local.z < 14.2, `camera leaves the cabin at ${bank}: ${local.toArray()}`);
  }
  Object.assign(target, { pointerLockElement: target });
  controls['mouseMove']({ movementX: 0, movementY: -1000 } as MouseEvent);
  assert.equal(controls.pitch, -.65, 'the walking camera limit restricts cannon elevation');
});

test('the physical stern turret remains inside the pipe while aiming through the full rolling route', () => {
  const root = new THREE.Group(), renderer = new HammerRouteRenderer(root);
  let flight = { ...newHammerFlight(), gunnery: newHammerGunnery() };
  try {
    for (let i = 0; i < 600 && flight.phase === 'riding'; i++) {
      flight = { ...stepHammerFlight(flight, hammerNiobeInput(flight), .05), gunnery: flight.gunnery };
      flight.gunnery.yaw = Math.sin(i * .2) * 1.05; flight.gunnery.pitch = Math.cos(i * .17) * .65;
      renderer.update(flight, 0); root.updateMatrixWorld(true);
      const wall = root.getObjectByName('hammer-gunnery-rear-wall')! as THREE.Mesh;
      const muzzle = hammerGunneryView(flight).eye, local = wall.worldToLocal(new THREE.Vector3(muzzle.x, muzzle.y + 1, muzzle.z));
      wall.geometry.computeBoundingBox();
      assert.ok(local.z > wall.geometry.boundingBox!.max.z, 'the cannon fires from inside the rear cabin wall');
      root.getObjectByName('hammer-stern-turret')!.traverseVisible(object => {
        if (!(object instanceof THREE.Mesh)) return;
        for (let v = 0; v < object.geometry.attributes.position.count; v++) {
          const point = object.localToWorld(object.getVertexPosition(v, new THREE.Vector3())); point.y -= 1;
          const station = hammerProjectPoint(point, 175 - flight.z), section = hammerTunnelSection(station.distance);
          const x = station.x / section.width, y = station.y / section.height, angle = (Math.floor(Math.atan2(y, x) / (Math.PI / 12)) + .5) * Math.PI / 12;
          assert.ok(x * Math.cos(angle) + y * Math.sin(angle) <= Math.cos(Math.PI / 24), `cannon penetrates the pipe at ${flight.elapsed}`);
        }
      });
    }
    assert.equal(flight.phase, 'arrived'); assert.equal(flight.hits, 0);
  } finally { renderer.dispose(); }
});

test('the saved gunner entry has an interior view and V or walking immediately restores Niobe view', t => {
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  const target = { addEventListener() {}, removeEventListener() {}, exitPointerLock() {} };
  ['window', 'document'].forEach(key => Object.defineProperty(globalThis, key, { configurable: true, value: target }));
  const camera = new THREE.PerspectiveCamera(48, 16 / 9, .5, 5000), controls = new PlayerControls(target as unknown as HTMLCanvasElement, camera, () => {}, () => {});
  t.after(() => { controls.dispose(); ['window', 'document'].forEach((key, i) => previous[i] ? Object.defineProperty(globalThis, key, previous[i]!) : Reflect.deleteProperty(globalThis, key)); });
  const center = FILM_SETS.film_hammer_route.center, flight = newHammerFlight(), point = hammerCrewRoot(flight, 'niobe'), ship = hammerShipPose(flight);
  const state = { id: 'niobe', status: 'alive', health: 100, maxHealth: 100, isInMatrix: false, currentLocation: 'film_hammer_route', rotation: Math.PI,
    position: { x: center.x + point.x, y: center.y + point.y, z: center.z + point.z + 1.5 }, velocity: { x: 0, y: 0, z: 0 }, activeEffects: [], currentAction: null } as AgentState;
  const group = new THREE.Group(); group.position.set(state.position.x, state.position.y, state.position.z); controls.possess(state);
  for (const aspect of [16 / 9, .7]) for (const elapsed of [11.4, 12.8, 14.3, 15.2, 16.8]) {
    camera.aspect = aspect; controls.hammerPreparation = { phase: elapsed === 16.8 ? 'ready' : 'moving', elapsed, station: true };
    controls.update(.1, state, group, false);
    const eye = camera.position.clone().sub(new THREE.Vector3(center.x + ship.x, center.y + ship.y, center.z + ship.z));
    assert.ok(Math.abs(eye.x) < 2.54 && eye.y < 1.87 && eye.y > -2.35 && eye.z > 9.9 && eye.z < 14.74, `entry camera leaves the compartment: ${eye.toArray()}`);
    const ghost = hammerCrewRoot(flight, 'ghost', controls.hammerPreparation);
    const focus = new THREE.Vector3(center.x + ghost.x, center.y + ghost.y + 1.3, center.z + ghost.z + .15);
    assert.ok(camera.getWorldDirection(new THREE.Vector3()).dot(focus.sub(camera.position).normalize()) > .999);
    const before = camera.matrixWorld.elements.slice(); controls.update(3, state, group, false);
    assert.deepEqual(camera.matrixWorld.elements, before, 'paused rendering moves the shot');
  }
  controls.firstPerson = true; controls.update(.1, state, group, false);
  assert.ok(camera.position.distanceTo(group.position) < 4, 'first person still watches Ghost');
  controls.firstPerson = false; controls['keys'].add('KeyW'); controls.update(.1, state, group, false);
  assert.ok(camera.position.z < center.z + 184.9, 'movement leaves the camera in the gunner room');
  controls.release(); assert.equal(controls.hammerPreparation, undefined);
});
