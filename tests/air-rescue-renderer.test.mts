import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import type { FilmJourney } from '@auto_matrix/shared';
import { GovernmentSetRenderer } from '../packages/client/src/engine/GovernmentSetRenderer.js';

const journey = (scene: 'm1_helicopter' | 'm1_rooftop_rescue'): FilmJourney => ({
  version: 1, scene, actor: 'neo', step: 0, completed: [], enteredAt: 0,
  checkpoint: { x: 0, y: 1, z: 0 }, reflections: {}, lastText: '',
  airRescue: scene === 'm1_helicopter'
    ? { kind: 'office', phase: 'ready', elapsed: 0, attempt: 0, suppression: 0, bursts: 0 }
    : { kind: 'roof', phase: 'ready', elapsed: 0, attempt: 0, grip: 1, braces: 0, misses: 0, resolved: [] },
});

test('office air rescue renders the B-212, minigun fire, deterministic broken glass and catch rope', () => {
  const root = new THREE.Group(); const renderer = new GovernmentSetRenderer(root, 'film_government_office');
  for (const name of ['government-helicopter', 'government-helicopter-doorway', 'government-helicopter-door', 'air-rescue-minigun', 'air-rescue-fire-lines', 'air-rescue-glass-shards', 'air-rescue-rope']) {
    assert.ok(root.getObjectByName(name), name);
  }
  const skyline = root.children[0].children.filter(child => child.name === 'government-city-tower');
  assert.ok(skyline.every(tower => tower.position.z < -58), 'the skyline must leave an unobstructed flight and camera corridor outside the glass wall');
  const state = journey('m1_helicopter'); const rescue = state.airRescue!;
  renderer.update(state, 1); assert.equal(root.getObjectByName('government-helicopter')!.visible, true);
  rescue.phase = 'firing'; rescue.elapsed = 2; rescue.suppression = .72; renderer.update(state, 4);
  assert.equal(root.getObjectByName('air-rescue-fire-lines')!.visible, true);
  assert.equal(root.getObjectByName('air-rescue-glass-shards')!.visible, true);
  assert.ok((root.getObjectByName('air-rescue-minigun-flash') as THREE.PointLight).intensity > 20);
  root.updateMatrixWorld(true);
  const gun = root.getObjectByName('air-rescue-minigun')!.getWorldPosition(new THREE.Vector3());
  const muzzle = root.getObjectByName('air-rescue-minigun-flash')!.getWorldPosition(new THREE.Vector3());
  assert.ok(muzzle.z > gun.z + 3.5 && Math.abs(muzzle.x - gun.x) < .25,
    'the side-door minigun barrel and muzzle flash must point toward the office instead of across the helicopter');
  const panes = Array.from({ length: 9 }, (_, index) => root.getObjectByName(`government-glass-pane-${index}`)).filter(Boolean);
  assert.equal(panes.length, 9); assert.ok(panes.some(pane => !pane!.visible) && panes.some(pane => pane!.visible));
  const shard = root.getObjectByName('air-rescue-glass-shards')!.children[17]; const first = shard.position.clone();
  renderer.update(state, 4); assert.deepEqual(shard.position.toArray(), first.toArray(), 'saved frames must reproduce the same shard transform');
  rescue.phase = 'catching'; rescue.elapsed = 2.3; renderer.update(state, 6);
  const rope = root.getObjectByName('air-rescue-rope')!; assert.equal(rope.visible, true); assert.ok(rope.scale.y > 4);
  renderer.dispose(); assert.equal(root.children.length, 0);
});

test('roof air rescue renders the suspended rope, facade ripple and burning helicopter impact', () => {
  const root = new THREE.Group(); const renderer = new GovernmentSetRenderer(root, 'film_government_roof');
  for (const name of ['air-rescue-impact-facade', 'air-rescue-impact-ripples', 'air-rescue-crash-fire', 'air-rescue-rope']) {
    assert.ok(root.getObjectByName(name), name);
  }
  assert.ok(root.getObjectByName('air-rescue-impact-ripples')!.position.z > -47.5,
    'the glass ripple must sit in front of the facade instead of disappearing inside it');
  const state = journey('m1_rooftop_rescue'); const rescue = state.airRescue!;
  rescue.phase = 'bracing'; rescue.elapsed = 3.35; rescue.grip = .76; renderer.update(state, 5);
  assert.equal(root.getObjectByName('air-rescue-rope')!.visible, true);
  const aircraft = root.getObjectByName('government-helicopter')!; const before = aircraft.position.clone();
  rescue.phase = 'pulling'; rescue.elapsed = 3.4; rescue.ropeCut = true; rescue.crash = true; renderer.update(state, 8);
  assert.ok(aircraft.position.distanceTo(before) > 4);
  assert.equal(root.getObjectByName('air-rescue-impact-ripples')!.visible, true);
  assert.equal(root.getObjectByName('air-rescue-crash-fire')!.visible, true);
  assert.ok((root.getObjectByName('air-rescue-crash-light') as THREE.PointLight).intensity > 40);
  renderer.dispose(); assert.equal(root.children.length, 0);
});
