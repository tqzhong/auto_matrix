import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { HammerRouteRenderer } from '../packages/client/src/engine/HammerRouteRenderer.js';
import { FILM_SETS, hammerCrewRoot, hammerShipPose, newHammerFlight, newHammerGunnery, type AgentState } from '@auto_matrix/shared';
import { hammerNiobeInput, hammerProjectPoint, hammerTunnelSection, stepHammerFlight } from '@auto_matrix/shared';

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
