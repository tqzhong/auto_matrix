import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { THE_ONE, type FilmJourney, type TheOneKind, type TheOnePhase } from '@auto_matrix/shared';
import { TheOneRenderer } from '../packages/client/src/engine/TheOneRenderer.js';

function journey(kind: TheOneKind, phase: TheOnePhase, elapsed = 0): FilmJourney {
  const scene = kind === 'death' ? 'm1_death' : kind === 'return' ? 'm1_return' : 'm1_final_call';
  return {
    version: 1, scene, actor: 'neo', step: kind === 'flight' ? 1 : 0, completed: [], enteredAt: 0,
    checkpoint: { x: 0, y: 1, z: 0 }, reflections: {}, lastText: '',
    theOne: { kind, phase, elapsed, attempt: 0, checkpoint: kind === 'death' ? 'door' : kind === 'return' ? 'bullets' : 'phone',
      signal: 0, hits: 0, blocks: 0, deadline: 0, altitude: 0, flightX: 0, flightZ: 0, resolved: [] },
  };
}

test('room 303 owns the door, exit phone, gunfire damage, stopped volley and code burst', () => {
  const root = new THREE.Group(); const renderer = new TheOneRenderer(root, 'film_heart_hotel');
  for (const name of ['one-hotel-corridor', 'one-room-303-door', 'one-exit-phone', 'one-gunfire-flashes',
    'one-bullet-field', 'one-code-shell', 'one-smith-burst']) assert.ok(root.getObjectByName(name), name);
  const state = journey('return', 'bullet_window', THE_ONE.return.bulletBeat);
  renderer.update(state, 2); const bullets = root.getObjectByName('one-bullet-field')!;
  assert.ok(Math.abs(root.getObjectByName('one-room-303-door')!.rotation.y) > .9, 'revived Neo must see the agents through the open 303 door');
  assert.equal(bullets.visible, true); const position = bullets.children[0].position.clone();
  renderer.update(state, 90); assert.deepEqual(bullets.children[0].position.toArray(), position.toArray(), 'global client time cannot advance the volley');
  state.theOne!.phase = 'bullet_stop'; state.theOne!.elapsed = 1.2; renderer.update(state, 3);
  assert.equal(root.getObjectByName('one-code-shell')!.visible, true); assert.equal(bullets.visible, true);
  state.theOne!.phase = 'burst'; state.theOne!.elapsed = 1.2; state.theOne!.smithBurst = true; renderer.update(state, 4);
  assert.equal(root.getObjectByName('one-smith-burst')!.visible, true);
  renderer.dispose(); assert.equal(root.children.length, 0);
});

test('Nebuchadnezzar overlay distinguishes flatline, hull breach and Morpheus EMP', () => {
  const root = new THREE.Group(); const renderer = new TheOneRenderer(root, 'film_neb_deck');
  for (const name of ['one-life-monitor', 'one-flatline-line', 'one-heart-pulse', 'one-sentinel-cutters', 'one-emp-switch', 'one-emp-flash']) {
    assert.ok(root.getObjectByName(name), name);
  }
  const death = journey('death', 'flatline', .9); renderer.update(death, 1);
  assert.equal(root.getObjectByName('one-flatline-line')!.visible, true); assert.equal(root.getObjectByName('one-heart-pulse')!.visible, false);
  death.theOne!.phase = 'kiss'; death.theOne!.elapsed = 1.7; renderer.update(death, 2);
  assert.equal(root.getObjectByName('one-heart-pulse')!.visible, true);
  const escape = journey('return', 'emp', 1.4); escape.theOne!.empFired = true; renderer.update(escape, 3);
  assert.equal(root.getObjectByName('one-sentinel-cutters')!.visible, true); assert.equal(root.getObjectByName('one-emp-flash')!.visible, true);
  renderer.dispose(); assert.equal(root.children.length, 0);
});

test('final daylight corner owns a phone booth, commuters, skyline and saved flight trail', () => {
  const root = new THREE.Group(); const renderer = new TheOneRenderer(root, 'film_final_phone');
  for (const name of ['one-final-street', 'one-final-phone-booth', 'one-final-commuters', 'one-final-skyline', 'one-flight-rings', 'one-flight-trail']) {
    assert.ok(root.getObjectByName(name), name);
  }
  const state = journey('flight', 'call', 2.4); renderer.update(state, 2);
  assert.equal(root.getObjectByName('one-final-phone-booth')!.visible, true);
  state.theOne!.phase = 'takeoff'; state.theOne!.elapsed = 3.6; state.theOne!.altitude = 17; state.theOne!.flightX = 4; state.theOne!.flightZ = -3;
  renderer.update(state, 5); const trail = root.getObjectByName('one-flight-trail')!;
  assert.equal(trail.visible, true); const saved = trail.position.clone(); renderer.update(state, 100);
  assert.deepEqual(trail.position.toArray(), saved.toArray(), 'flight effects derive from saved encounter state');
  renderer.dispose(); assert.equal(root.children.length, 0);
});
