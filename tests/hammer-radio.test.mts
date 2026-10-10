import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { newHammerFlight, stepHammerFlight } from '@auto_matrix/shared';
import { HammerRouteRenderer } from '../packages/client/src/engine/HammerRouteRenderer.js';
import { hammerPilotInput } from './helpers/hammer-pilot.mts';

test('the radio is approached, cut and physically detached before communications are lost', () => {
  let flight = newHammerFlight(); const phases = new Set<string>();
  for (let i = 0; i < 500 && flight.phase === 'riding'; i++) {
    flight = stepHammerFlight(flight, hammerPilotInput(flight), .05);
    assert.ok(flight.radio, 'the antenna still disappears at a distance threshold without an attack');
    phases.add(flight.radio.phase);
    if (['intact', 'approach', 'cutting'].includes(flight.radio.phase)) assert.equal(flight.antennaLost, false);
    else assert.equal(flight.antennaLost, true);
    if (flight.radio.phase === 'falling') {
      assert.ok(flight.radio.detached);
      const saved = structuredClone(flight), input = hammerPilotInput(flight);
      assert.deepEqual(stepHammerFlight(saved, input, 0), saved);
      assert.deepEqual(stepHammerFlight(saved, input, .05), stepHammerFlight(flight, input, .05));
    }
  }
  assert.deepEqual([...phases], ['intact', 'approach', 'cutting', 'falling', 'lost']);
  assert.equal(flight.phase, 'arrived'); assert.equal(flight.hull, 100);
});

test('saved attack effects freeze and the broken radio moves independently of the turning ship', () => {
  const root = new THREE.Group(), renderer = new HammerRouteRenderer(root);
  try {
    let flight = newHammerFlight();
    for (let i = 0; i < 400 && flight.radio?.phase !== 'falling'; i++) flight = stepHammerFlight(flight, hammerPilotInput(flight), .05);
    assert.equal(flight.radio?.phase, 'falling');
    renderer.update(flight, 1); root.updateMatrixWorld(true);
    const radio = root.getObjectByName('hammer-radio')!;
    const before = radio.matrixWorld.elements.slice();
    renderer.update(structuredClone(flight), 99); root.updateMatrixWorld(true);
    assert.deepEqual(radio.matrixWorld.elements, before);
    const redirected = structuredClone(flight); redirected.x += 2; redirected.maneuver!.bank += .4;
    renderer.update(redirected, 99); root.updateMatrixWorld(true);
    assert.deepEqual(radio.matrixWorld.elements, before, 'a broken antenna still follows the ship transform');
    const advanced = structuredClone(flight); advanced.radio!.elapsed += .2;
    renderer.update(advanced, 99); root.updateMatrixWorld(true);
    assert.notDeepEqual(radio.matrixWorld.elements, before);
  } finally { renderer.dispose(); }
});

test('existing spatial saves keep their recorded radio outcome without inserting a new attack', () => {
  let flight = newHammerFlight(); delete flight.radio;
  for (let i = 0; i < 500 && flight.phase === 'riding'; i++) {
    flight = stepHammerFlight(flight, hammerPilotInput(flight), .05);
    assert.equal(flight.radio, undefined);
    assert.equal(flight.antennaLost, flight.z <= 25);
  }
  assert.equal(flight.phase, 'arrived');
});

test('the detached antenna and disabled sentinel clear the closed cabin before falling below its roof', () => {
  const root = new THREE.Group(), renderer = new HammerRouteRenderer(root);
  try {
    let flight = newHammerFlight();
    const cabin = root.getObjectByName('hammer-cockpit')!;
    const roof = root.getObjectByName('hammer-cabin-roof')!;
    for (let i = 0; i < 150 && flight.radio?.phase !== 'lost'; i++) {
      flight = stepHammerFlight(flight, hammerPilotInput(flight), .05);
      if (flight.radio?.phase !== 'falling') continue;
      renderer.update(flight, 0); root.updateMatrixWorld(true);
      const inverse = cabin.matrixWorld.clone().invert(), up = new THREE.Vector3(0, 1, 0).transformDirection(cabin.matrixWorld);
      for (const name of ['hammer-radio', 'hammer-radio-attacker']) root.getObjectByName(name)!.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        for (let vertex = 0; vertex < object.geometry.attributes.position.count; vertex++) {
          const point = object.localToWorld(object.getVertexPosition(vertex, new THREE.Vector3())).applyMatrix4(inverse);
          const origin = new THREE.Vector3(point.x, -2.35, point.z).applyMatrix4(cabin.matrixWorld);
          const hit = new THREE.Raycaster(origin, up).intersectObject(roof, false)[0];
          assert.ok(!hit || hit.point.clone().applyMatrix4(inverse).y <= point.y + .03, `${name} enters the crew cabin at ${flight.radio!.elapsed}: ${point.toArray()}`);
        }
      });
    }
    assert.equal(flight.radio?.phase, 'lost');
  } finally { renderer.dispose(); }
});
