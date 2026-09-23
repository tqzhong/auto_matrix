import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { newCatch, type FilmJourney } from '@auto_matrix/shared';
import { ReloadedCatchRenderer } from '../packages/client/src/engine/ReloadedCatchRenderer.js';

test('Trinity catch set shows the flyable city, saved fall, rooftop bullet and readable pulse', () => {
  const root = new THREE.Group(); const renderer = new ReloadedCatchRenderer(root);
  const state: FilmJourney = { version: 1, scene: 'm2_catch', actor: 'neo', step: 1, completed: [], enteredAt: 0,
    checkpoint: { x: 0, y: 0, z: 0 }, reflections: {}, lastText: '', catch: newCatch() };
  for (const name of ['catch-center-tower', 'catch-trinity-tower', 'catch-city-road', 'catch-rescue-roof', 'catch-heart-pulse', 'catch-extracted-bullet'])
    assert.ok(root.getObjectByName(name), name);
  const disposed: string[] = []; renderer.group.traverse(object => {
    if (object instanceof THREE.Mesh) object.geometry.addEventListener('dispose', () => disposed.push(object.uuid));
  });
  state.catch!.phase = 'flight'; state.catch!.elapsed = 2.3; renderer.update(state);
  const shards = renderer.group.children.find(child => child.children.some(mesh => mesh.name === 'catch-shard-0'))!;
  const before = shards.children[0].position.clone(); renderer.update(structuredClone(state));
  assert.ok(shards.children[0].position.equals(before), 'reloading the saved fall keeps the same glass positions');
  assert.equal(renderer.group.getObjectByName('catch-extracted-bullet')!.parent!.visible, false);
  state.catch!.phase = 'pulse'; state.catch!.elapsed = 1.1; state.catch!.focus = 2.4; renderer.update(state);
  assert.equal(renderer.group.getObjectByName('catch-heart-pulse')!.parent!.visible, true);
  assert.ok(renderer.group.getObjectByName('catch-heart-pulse')!.scale.x < 1);
  assert.ok(renderer.group.getObjectByName('catch-extracted-bullet')!.parent!.visible);
  renderer.dispose(); assert.equal(root.children.length, 0); assert.ok(disposed.length > 0);
});
