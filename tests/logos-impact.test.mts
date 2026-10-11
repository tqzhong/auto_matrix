import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { newLogosFlight, stepLogosFlight, logosShipPose, logosPowered, type LogosFlight } from '@auto_matrix/shared';
import { LogosFlightRenderer } from '../packages/client/src/engine/LogosFlightRenderer.js';

const neutral = { throttle: 0, steer: 0, brake: false };
function approach() {
  let flight = newLogosFlight('sun');
  for (let i = 0; i < 800 && !flight.crash && flight.phase === 'riding'; i++) flight = stepLogosFlight(flight,
    { ...neutral, throttle: flight.stage === 'clouds' ? 1 : 0 }, .05,
    flight.stage === 'stall' && (flight.ignition?.pump ?? 0) < 1.3);
  assert.ok(flight.crash, 'successful ignition needs a saved tower approach before completion');
  assert.equal(flight.phase, 'riding'); return flight;
}

test('the Logos reaches a physical impact before settling; it never completes while still falling', () => {
  let flight = approach(); const start = structuredClone(flight), crash = flight.crash!;
  let impacted = false;
  for (let i = 0; i < 180 && flight.phase === 'riding'; i++) {
    const before = logosShipPose(flight), ignitionTime = flight.ignition!.elapsed;
    flight = stepLogosFlight(flight, neutral, .05);
    assert.ok(flight.ignition!.elapsed > ignitionTime, 'the returning igniter hand must not freeze when the crash begins');
    const pose = logosShipPose(flight);
    assert.ok(Math.hypot(pose.x - before.x, pose.y - before.y, pose.z - before.z) < 1.7, 'impact cannot teleport the ship');
    if (flight.crash!.elapsed < crash.approach) assert.equal(flight.phase, 'riding');
    else { impacted = true; assert.equal(logosPowered(flight), false, 'the collision cuts propulsion again'); }
  }
  assert.ok(impacted); assert.equal(flight.phase, 'arrived');
  assert.ok(flight.crash!.elapsed >= crash.approach + 2.6);
  assert.equal(flight.speed, 0); assert.equal(flight.vertical, 0);
  assert.equal(flight.hull, start.hull); assert.equal(flight.neo, start.neo);
});

test('impact progress and ship attitude resume exactly from a paused saved collision', () => {
  let flight = approach();
  while (flight.crash!.elapsed < flight.crash!.approach + .25) flight = stepLogosFlight(flight, neutral, .05);
  const saved = structuredClone(flight), restored: LogosFlight = JSON.parse(JSON.stringify(saved));
  for (let i = 0; i < 20; i++) assert.deepEqual(stepLogosFlight(flight, { throttle: 1, steer: 1, brake: true }, 0, true), saved);
  assert.deepEqual(stepLogosFlight(restored, neutral, .05), stepLogosFlight(flight, neutral, .05));
  assert.deepEqual(logosShipPose(restored), logosShipPose(flight));
});

test('the tower stays in world space while the windscreen breaks once and debris freezes with the saved collision', () => {
  const root = new THREE.Group(), renderer = new LogosFlightRenderer(root, 'sun');
  try {
    let flight = approach(); renderer.update(flight, 0);
    const tower = root.getObjectByName('logos-impact-tower'); assert.ok(tower);
    root.updateMatrixWorld(true); const place = tower.matrixWorld.toArray();
    const pane = root.getObjectByName('logos-impact-windscreen'); assert.ok(pane); assert.equal(pane.visible, true);
    while (flight.crash!.elapsed < flight.crash!.approach + .35) flight = stepLogosFlight(flight, neutral, .05);
    renderer.update(flight, 10); root.updateMatrixWorld(true);
    assert.deepEqual(tower.matrixWorld.toArray(), place, 'the tower cannot chase the ship');
    assert.equal(pane.visible, false);
    const shards = root.getObjectByName('logos-impact-glass'); assert.ok(shards?.visible);
    const snapshot = () => { root.updateMatrixWorld(true); return shards!.children.map(item => ({ matrix: item.matrixWorld.toArray(), visible: item.visible,
      instances: item instanceof THREE.InstancedMesh ? Array.from(item.instanceMatrix.array) : undefined })); };
    const before = snapshot(); renderer.update(flight, 1000); assert.deepEqual(snapshot(), before);
    renderer.update(newLogosFlight('sun'), 1001);
    assert.equal(tower.visible, false); assert.equal(pane.visible, true); assert.equal(shards!.visible, false);
    assert.equal(root.getObjectByName('logos-lower-nose')!.scale.y, .48, 'retry must restore the uncrushed ship');
  } finally { renderer.dispose(); }
  assert.equal(root.children.length, 0);
});
