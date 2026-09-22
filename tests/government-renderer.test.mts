import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { GOVERNMENT_RESCUE, type FilmJourney } from '@auto_matrix/shared';
import { GovernmentSetRenderer } from '../packages/client/src/engine/GovernmentSetRenderer.js';

const journey = (scene: 'm1_smith_question' | 'm1_bullet_dodge'): FilmJourney => ({
  version: 1, scene, actor: scene === 'm1_smith_question' ? 'morpheus' : 'neo', step: 0, completed: [], enteredAt: 0,
  checkpoint: { x: 0, y: 1, z: 0 }, reflections: {}, lastText: '',
  government: scene === 'm1_smith_question'
    ? { kind: 'questioning', phase: 'ready', elapsed: 0, attempt: 0, resolve: 1 }
    : { kind: 'rooftop', phase: 'ready', elapsed: 0, attempt: 0, dodges: 0, wounds: 0, resolved: [] },
});

test('executive interrogation set contains physical restraints, drug feed, glass wall and saved alarm effects', () => {
  const root = new THREE.Group(); const renderer = new GovernmentSetRenderer(root, 'film_government_office');
  for (const name of ['government-glass-wall', 'government-restraint-chair', 'government-serum-bag', 'government-sprinklers', 'government-fire-alarm']) {
    assert.ok(root.getObjectByName(name), name);
  }
  const state = journey('m1_smith_question'); renderer.update(state, 2);
  assert.equal(root.getObjectByName('government-sprinklers')!.visible, false);
  state.government!.phase = 'alarm'; state.government!.elapsed = 3.2; renderer.update(state, 8);
  assert.equal(root.getObjectByName('government-sprinklers')!.visible, true);
  assert.ok((root.getObjectByName('government-fire-alarm') as THREE.PointLight).intensity > 20);
  assert.ok(root.getObjectByName('government-serum-bag')!.scale.y > .9);
  const towers = root.children[0].children.filter(child => child.name === 'government-city-tower');
  assert.equal(towers.length, 13); assert.ok(towers.every(tower => tower.position.z < -32), 'the skyline must remain outside the glass wall');
  root.updateMatrixWorld(true); const chair = root.getObjectByName('government-restraint-chair')!;
  const chairBack = root.getObjectByName('government-chair-back'); assert.ok(chairBack);
  assert.ok(chairBack!.getWorldPosition(new THREE.Vector3()).z > chair.getWorldPosition(new THREE.Vector3()).z, 'the backrest belongs behind seated Morpheus');
  renderer.dispose(); assert.equal(root.children.length, 0);
});

test('rooftop set exposes a complete B-212 silhouette and renders each bullet-time firing line', () => {
  const root = new THREE.Group(); const renderer = new GovernmentSetRenderer(root, 'film_government_roof');
  for (const name of ['government-helipad', 'government-helicopter', 'government-main-rotor', 'government-tail-rotor', 'government-skids', 'government-cockpit', 'government-bullet-lines']) {
    assert.ok(root.getObjectByName(name), name);
  }
  const hull = root.getObjectByName('government-helicopter-hull') as THREE.Mesh | undefined; assert.ok(hull);
  assert.ok((hull!.material as THREE.MeshStandardMaterial).color.getHex() > 0x171717, 'the aircraft silhouette retains readable green-grey paint in daylight');
  const state = journey('m1_bullet_dodge'); state.government!.phase = 'bullet_time';
  state.government!.elapsed = GOVERNMENT_RESCUE.rooftop.beats[1]; renderer.update(state, 4);
  const lines = root.getObjectByName('government-bullet-lines')!;
  assert.equal(lines.visible, true); assert.ok(lines.children.some(child => child.visible));
  const rotor = root.getObjectByName('government-main-rotor')!; const before = rotor.rotation.y;
  state.government!.phase = 'downloading'; state.government!.elapsed = 4; renderer.update(state, 7);
  assert.notEqual(rotor.rotation.y, before); assert.equal(lines.visible, false);
  assert.ok((root.getObjectByName('government-cockpit-glow') as THREE.PointLight).intensity > 0);
  renderer.dispose(); assert.equal(root.children.length, 0);
});
