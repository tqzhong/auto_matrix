import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { DOCK_GATE, newDockGate, newApuRun, dockGateEye, fireDockGate, type FilmJourney } from '@auto_matrix/shared';
import { ZionHomecomingRenderer } from '../packages/client/src/engine/ZionHomecomingRenderer.js';

function setup() {
  const root = new THREE.Group(), renderer = new ZionHomecomingRenderer(root, 'film_zion_hangar');
  const journey = { scene: 'm3_gate', actor: 'kid', step: 2, completed: [],
    apu: { ...newApuRun(), x: 5, z: -50, phase: 'arrived' }, dockGate: newDockGate(5, -50) } as FilmJourney;
  journey.dockGate!.phase = 'aiming';
  return { root, renderer, journey };
}

test('steering the APU around sentinel dives leaves its actual feet clear of the dock rails', t => {
  const { root, renderer, journey } = setup(); t.after(() => renderer.dispose());
  journey.step = 1; delete journey.dockGate; journey.apu!.phase = 'riding'; journey.apu!.z = -40;
  const apu = root.getObjectByName('zion-kid-apu')!;
  const staticSet = root.getObjectByName('zion-homecoming-set')!.children[0];
  for (const side of [-1, 1]) {
    journey.apu!.x = side * 6.6; renderer.update(journey, 0); root.updateMatrixWorld(true);
    const foot = apu.getObjectByName(`apu-foot-${side}`)!;
    const origin = foot.localToWorld(new THREE.Vector3(-side * 1.15, 0, 0));
    const hit = new THREE.Raycaster(origin, new THREE.Vector3(side, 0, 0), 0, 2.3).intersectObject(staticSet, true)[0];
    assert.ok(!hit, `the ${side} foot cuts through a rendered dock obstacle at ${hit?.point.toArray()}`);
  }
});

test('the aimed cannon emits its tracer from the actual rotated muzzle', t => {
  const { root, renderer, journey } = setup(); t.after(() => renderer.dispose()); const gate = journey.dockGate!;
  const eye = dockGateEye(gate), yaw = Math.atan2(31 - eye.x, -61 - eye.z), pitch = -Math.atan2(32 - eye.y, Math.hypot(31 - eye.x, -61 - eye.z));
  assert.equal(fireDockGate(gate, yaw, pitch), true); renderer.update(journey, 1); root.updateMatrixWorld(true);
  const muzzle = root.getObjectByName('apu-muzzle-1')!.getWorldPosition(new THREE.Vector3());
  const tracer = root.getObjectByName('gate-apu-tracer')!;
  const start = tracer.localToWorld(new THREE.Vector3(0, -.5, 0));
  assert.ok(start.distanceTo(muzzle) < .02, `tracer starts at ${start.toArray()}, actual muzzle is ${muzzle.toArray()}`);
  const end = tracer.localToWorld(new THREE.Vector3(0, .5, 0));
  assert.ok(end.distanceTo(new THREE.Vector3(gate.lastShot!.x, gate.lastShot!.y, gate.lastShot!.z)) < .001);
});

test('saved opening keeps the weight above the floor and Hammer inside the open half of the gate', t => {
  const { root, renderer, journey } = setup(); t.after(() => renderer.dispose()); const gate = journey.dockGate!;
  const weight = root.getObjectByName('gate-three-counterweight')!, leaf = root.getObjectByName('zion-gate-three')!, ship = root.getObjectByName('gate-three-hammer')!;
  gate.phase = 'opening'; gate.hits = DOCK_GATE.hits;
  for (let elapsed = 0; elapsed <= DOCK_GATE.opening; elapsed += .1) {
    gate.elapsed = elapsed; renderer.update(journey, 500); root.updateMatrixWorld(true);
    assert.equal(leaf.position.y, 0); assert.ok(leaf.position.x >= 0 && leaf.position.x <= DOCK_GATE.travel);
    assert.ok(new THREE.Box3().setFromObject(weight).min.y > 0, 'no counterweight or cage rail sinks into the floor');
  }
  gate.phase = 'entering'; let samples = 0;
  for (let elapsed = 0; elapsed <= DOCK_GATE.entering; elapsed += .025) {
    gate.elapsed = elapsed; renderer.update(journey, elapsed); root.updateMatrixWorld(true);
    ship.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const vertices = object.geometry.getAttribute('position');
      for (let i = 0; i < vertices.count; i++) {
        const p = new THREE.Vector3().fromBufferAttribute(vertices, i).applyMatrix4(object.matrixWorld);
        if (Math.abs(p.z - DOCK_GATE.z) > 1.5) continue;
        samples++; assert.ok(p.x > .15 && Math.hypot(p.x, p.y - DOCK_GATE.centerY) < 24.6,
          `ship intersects closed leaf/ring at ${elapsed}: ${p.toArray()}`);
      }
    });
  }
  assert.ok(samples > 100, 'inspect geometry during the crossing, not just its final position');
  gate.phase = 'opening'; gate.elapsed = 2.37; renderer.update(journey, 1);
  const saved = structuredClone(journey), position = leaf.position.clone(), weightPosition = weight.position.clone();
  renderer.update(journey, 900); assert.deepEqual(leaf.position, position); assert.deepEqual(weight.position, weightPosition);
  const resumed = setup(); t.after(() => resumed.renderer.dispose()); resumed.renderer.update(saved, 0);
  assert.deepEqual(resumed.root.getObjectByName('zion-gate-three')!.position, position);
  assert.deepEqual(resumed.root.getObjectByName('gate-three-counterweight')!.position, weightPosition);
});
