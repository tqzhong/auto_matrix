import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { newLogosFlight, stepLogosFlight, logosShipPose, type LogosFlight } from '@auto_matrix/shared';
import { LogosFlightRenderer } from '../packages/client/src/engine/LogosFlightRenderer.js';

const neutral = { throttle: 0, steer: 0, brake: false };
function falling() {
  let flight = newLogosFlight('sun');
  for (let i = 0; i < 600 && flight.stage !== 'stall'; i++)
    flight = stepLogosFlight(flight, { ...neutral, throttle: 1 }, .05);
  assert.equal(flight.stage, 'stall');
  assert.equal(flight.ignition?.phase, 'offline');
  return flight;
}
function hold(flight: LogosFlight, seconds: number, focus: boolean) {
  for (let i = 0; i < Math.round(seconds / .05); i++) flight = stepLogosFlight(flight, neutral, .05, focus);
  return flight;
}

test('the cloud discharge cuts propulsion before sunlight; momentum rises and falls without an altitude snap or powered hover', () => {
  let flight = newLogosFlight('sun');
  assert.equal(flight.ignition?.phase, 'powered');
  let cut = false, rising = false, falling = false, apex = 0;
  for (let i = 0; i < 800 && flight.phase === 'riding'; i++) {
    const before = flight;
    flight = stepLogosFlight(flight, { ...neutral, throttle: 1 }, .05);
    if (before.ignition?.phase === 'powered' && flight.ignition?.phase === 'offline') {
      cut = true; assert.ok(flight.altitude < flight.cloudTop!); assert.ok(flight.vertical > 0);
    }
    if (flight.stage === 'sun') {
      assert.notEqual(flight.ignition?.phase, 'powered'); rising ||= flight.vertical > 1;
      assert.ok(Math.abs(flight.altitude - before.altitude) < 2, 'crossing cloud top cannot teleport the ship');
    }
    if (before.stage === 'sun' && flight.stage === 'stall')
      assert.ok(Math.abs(logosShipPose(flight).pitch - logosShipPose(before).pitch) < .09, 'crossing the apex cannot snap the cockpit down');
    apex = Math.max(apex, flight.altitude); falling ||= flight.stage === 'stall' && flight.vertical < -1;
  }
  assert.ok(cut && rising && falling && apex > flight.cloudTop! + 10);
  assert.equal(flight.phase, 'wrecked', 'doing nothing during the fall must not complete the scene');
});

test('a short pump fails, a deliberate hold and release restarts propulsion, and saved input never advances while paused', () => {
  let flight = hold(falling(), .2, true);
  flight = hold(flight, .05, false);
  assert.equal(flight.ignition?.phase, 'offline'); assert.equal(flight.ignition?.attempts, 1);
  flight = hold(flight, .65, true);
  const saved = structuredClone(flight);
  for (let i = 0; i < 40; i++) assert.deepEqual(stepLogosFlight(flight, neutral, 0, false), saved);
  const direct = hold(flight, .65, true), restored = hold(JSON.parse(JSON.stringify(saved)), .65, true);
  assert.deepEqual(restored, direct); assert.equal(direct.ignition?.phase, 'ready');
  flight = hold(restored, .05, false);
  assert.equal(flight.ignition?.phase, 'running'); assert.equal(flight.ignition?.attempts, 2);
  const hull = flight.hull, neo = flight.neo;
  flight = hold(flight, 15, false);
  assert.equal(flight.phase, 'arrived'); assert.equal(flight.hull, hull); assert.equal(flight.neo, neo);
  assert.equal(flight.ignition?.attempts, 2);
});

test('holding G indefinitely cannot auto-retry or restart an overloaded igniter', () => {
  let flight = hold(falling(), 2.5, true);
  assert.equal(flight.ignition?.phase, 'offline'); assert.equal(flight.ignition?.attempts, 1);
  flight = hold(flight, .5, true);
  assert.equal(flight.ignition?.attempts, 1);
  assert.notEqual(flight.ignition?.phase, 'running');
});

test('insufficient climb momentum cannot skip the sunlight scene by restarting below the clouds', () => {
  let flight = { ...newLogosFlight('sun'), altitude: 57, vertical: 2 };
  const stages = new Set([flight.stage]);
  for (let i = 0; i < 600 && flight.phase === 'riding'; i++) {
    flight = stepLogosFlight(flight, { ...neutral, throttle: .1 }, .05, flight.stage === 'stall' && (flight.ignition?.pump ?? 0) < 1.3);
    stages.add(flight.stage);
  }
  assert.equal(stages.has('sun'), false); assert.equal(flight.phase, 'wrecked');
});

test('the physical engines and cockpit switch off during the cloud discharge and relight only after successful ignition', () => {
  const root = new THREE.Group(), renderer = new LogosFlightRenderer(root, 'sun');
  const propulsion = root.getObjectByName('logos-flight-ship')!.children.find(object => object instanceof THREE.PointLight) as THREE.PointLight;
  let flight = newLogosFlight('sun');
  for (let i = 0; i < 200 && flight.ignition?.phase === 'powered'; i++) flight = stepLogosFlight(flight, { ...neutral, throttle: 1 }, .05);
  renderer.update(flight, 0); assert.equal(propulsion.intensity, 0);
  flight = hold(hold(falling(), 1.3, true), .05, false);
  renderer.update(flight, 0); assert.ok(propulsion.intensity > 0);
  renderer.update(hold(flight, 15, false), 0); assert.equal(propulsion.intensity, 0);
  renderer.dispose();
});
