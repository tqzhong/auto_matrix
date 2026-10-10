import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { newHammerFlight, stepHammerFlight, hammerShipPose, hammerShipPoint, hammerCrewRoot, FILM_SETS, filmSetAt } from '@auto_matrix/shared';
import { HammerRouteRenderer } from '../packages/client/src/engine/HammerRouteRenderer.js';
import { hammerPilotInput as pilot } from './helpers/hammer-pilot.mts';

test('Hammer manual lift and roll move the actual hull; the saved attitude survives a pause', () => {
  let flight = newHammerFlight(); const before = hammerShipPose(flight);
  for (let i = 0; i < 20; i++) flight = stepHammerFlight(flight, { throttle: 1, steer: 0, brake: false, lift: 1, roll: 1 }, .05);
  const pose = hammerShipPose(flight);
  assert.ok(pose.y > before.y + 1, 'vertical thrusters do not change ship altitude');
  assert.ok(pose.roll > .5, 'the pilot cannot roll the hull');
  const saved = JSON.parse(JSON.stringify(flight));
  assert.deepEqual(hammerShipPoint(saved, { x: -1.65, y: -.2, z: -4.1 }), hammerShipPoint(flight, { x: -1.65, y: -.2, z: -4.1 }));
  assert.deepEqual(stepHammerFlight(saved, { throttle: 1, steer: 1, brake: false, lift: -1, roll: -1 }, 0), saved);
});

test('a new flight turns ninety degrees and climbs through a spatial pipe; manual maneuvers are necessary', () => {
  let flight = newHammerFlight(), maxPitch = 0, maxBank = 0;
  for (let i = 0; i < 900 && flight.phase === 'riding'; i++) {
    flight = stepHammerFlight(flight, pilot(flight), .05);
    const pose = hammerShipPose(flight); maxPitch = Math.max(maxPitch, pose.pitch); maxBank = Math.max(maxBank, pose.roll);
  }
  assert.equal(flight.phase, 'arrived', JSON.stringify(flight)); assert.equal(flight.hits, 0); assert.equal(flight.hull, 100);
  const end = hammerShipPose(flight);
  assert.ok(end.x > 200 && end.y > 35, 'the pipe remains a flat, fixed-forward course');
  assert.ok(Math.abs(end.yaw + Math.PI / 2) < .01 && maxPitch > .5 && maxBank > 1.4);
  let straight = newHammerFlight();
  for (let i = 0; i < 900 && straight.phase === 'riding'; i++) straight = stepHammerFlight(straight, { throttle: 1, steer: 0, brake: false }, .05);
  assert.equal(straight.phase, 'wrecked'); assert.ok(straight.hits >= 4);
});

test('ship and cockpit vertices stay inside the rendered spatial tunnel through maneuvers and collision', () => {
  const root = new THREE.Group(), renderer = new HammerRouteRenderer(root);
  try {
    let flight = newHammerFlight(); renderer.update(flight, 0); root.updateMatrixWorld(true);
    const tunnel = root.getObjectByName('hammer-spatial-tunnel'); assert.ok(tunnel, 'no three-dimensional tunnel is rendered');
    const ray = new THREE.Raycaster(), unique = new Map<string, THREE.Vector3>();
    const inverse = root.getObjectByName('hammer-airframe')!.matrixWorld.clone().invert();
    for (const name of ['hammer-airframe', 'hammer-cockpit']) root.getObjectByName(name)!.traverse(object => {
      if (!(object instanceof THREE.Mesh) || object.parent?.name === 'hammer-radio') return;
      for (let i = 0; i < object.geometry.attributes.position.count; i++) {
        const point = object.localToWorld(object.getVertexPosition(i, new THREE.Vector3())).applyMatrix4(inverse);
        unique.set(point.toArray().map(value => value.toFixed(5)).join(','), point);
      }
    });
    const samples = [...unique.values()], geometry = (tunnel as THREE.Mesh).geometry;
    const walls = [tunnel]; root.traverse(object => { if (object.name === 'hammer-spatial-beam') walls.push(object); });
    for (const scrape of [false, true]) {
      flight = newHammerFlight();
      for (let frame = 0; frame < 900 && flight.phase === 'riding'; frame++) {
        flight = stepHammerFlight(flight, scrape ? { throttle: 1, steer: 1, lift: 1, roll: 1, brake: false } : pilot(flight), .05);
        if (frame % 20) continue;
        renderer.update(flight, 100); root.updateMatrixWorld(true);
        // Every hull point is within 17 m of its origin; only nearby pipe triangles can intersect these rays.
        const row = Math.max(0, Math.floor((175 - flight.z - 30 + 24) / (398 / 200)));
        geometry.setDrawRange(row * 24 * 6, 32 * 24 * 6);
        const pose = hammerShipPose(flight), origin = new THREE.Vector3(pose.x, pose.y + 1, pose.z);
        for (const sample of samples) {
          const point = hammerShipPoint(flight, sample), delta = new THREE.Vector3(point.x, point.y + 1, point.z).sub(origin);
          const length = delta.length(); if (length < .001) continue;
          ray.set(origin, delta.multiplyScalar(1 / length)); ray.far = length - .02;
          assert.equal(ray.intersectObjects(walls, false).length, 0, `hull penetrates actual tunnel triangles at ${175 - flight.z}/${sample.toArray()}`);
        }
      }
      assert.equal(flight.phase, scrape ? 'wrecked' : 'arrived');
    }
  } finally { renderer.dispose(); }
});

test('the spatial flight keeps its scene loaded for every crew member from entry to arrival', () => {
  let flight = newHammerFlight(); const center = FILM_SETS.film_hammer_route.center;
  for (let frame = 0; frame < 900 && flight.phase === 'riding'; frame++) {
    flight = stepHammerFlight(flight, pilot(flight), .05);
    for (const role of ['niobe', 'morpheus', 'roland'] as const) {
      const point = hammerCrewRoot(flight, role);
      const set = filmSetAt({ x: center.x + point.x, y: center.y + point.y, z: center.z + point.z }, false);
      assert.equal(set?.id, 'film_hammer_route', `scene unloads at distance ${175 - flight.z} for ${role}`);
    }
  }
  assert.equal(flight.phase, 'arrived');
});

test('after a beam contact the pilot can still lower and level the ship instead of having every correction rolled back', () => {
  let flight = { ...newHammerFlight(), x: -.13487014084153665, z: -138.28947600000004, speed: 23, hull: 74, hits: 1, cooldown: .75, antennaLost: true,
    maneuver: { lift: -1.9820815394563709, vertical: 0, bank: .3338658662289449, bankVelocity: 0 } };
  for (let i = 0; i < 60 && flight.phase === 'riding'; i++) flight = stepHammerFlight(flight, { throttle: 1, steer: .081, lift: -.311, roll: -.668, brake: false }, .017);
  assert.equal(flight.phase, 'riding');
  assert.ok(flight.maneuver!.lift < -2.2 && flight.maneuver!.bank < .2, `controls lock up on contact: ${JSON.stringify(flight)}`);
  assert.ok(flight.z < -140, 'correcting the attitude should let the hull pass the overhead beam');
});

test('flight controls remain usable with player commands arriving at an ordinary network cadence', () => {
  let flight = newHammerFlight(), input = pilot(flight);
  for (let frame = 0; frame < 1800 && flight.phase === 'riding'; frame++) {
    if (frame % 5 === 0) input = pilot(flight);
    flight = stepHammerFlight(flight, input, .017);
  }
  assert.equal(flight.phase, 'arrived', JSON.stringify(flight));
  assert.ok(flight.hull >= 74, 'small timing differences should not trap the ship against the last beam');
});
