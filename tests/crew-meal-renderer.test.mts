import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import type { FilmJourney } from '@auto_matrix/shared';
import { CrewMealRenderer } from '../packages/client/src/engine/CrewMealRenderer.js';

const journey = (): FilmJourney => ({ version: 1, scene: 'm1_meal', actor: 'neo', step: 0, completed: [], enteredAt: 0,
  checkpoint: { x: 0, y: 0, z: 0 }, reflections: {}, lastText: '',
  interlude: { kind: 'meal', phase: 'accept_ready', elapsed: 0, physicalMeal: true } });

test('the meal tableware rests on its actual metal support instead of hovering beside the bowls', t => {
  const root = new THREE.Group(); root.position.set(100, 20, -50);
  const renderer = new CrewMealRenderer(root); t.after(() => renderer.dispose()); renderer.update(journey()); root.updateMatrixWorld(true);
  const table = new THREE.Box3().setFromObject(root.getObjectByName('neb-meal-table-runner')!);
  const gaps: string[] = [];
  for (const role of ['neo', 'tank', 'apoc', 'dozer', 'mouse', 'switch']) for (const suffix of ['protein-bowl', 'spoon']) {
    const name = `neb-${role}-${suffix}`, prop = root.getObjectByName(name)!;
    const bounds = new THREE.Box3().setFromObject(prop);
    const gap = bounds.min.y - table.max.y;
    if (Math.abs(gap) > .003) gaps.push(`${name}: ${gap.toFixed(6)}`);
    assert.ok(bounds.min.x >= table.min.x && bounds.max.x <= table.max.x && bounds.min.z >= table.min.z && bounds.max.z <= table.max.z,
      `${name} must be supported within the actual tabletop footprint`);
  }
  assert.deepEqual(gaps, [], 'each bowl and spoon must touch the tabletop without a visible gap or penetration');
});

test('the shared protein pot has physical support from its serving tray', t => {
  const root = new THREE.Group(), renderer = new CrewMealRenderer(root); t.after(() => renderer.dispose()); renderer.update(journey()); root.updateMatrixWorld(true);
  const pot = new THREE.Box3().setFromObject(root.getObjectByName('neb-meal-communal-pot')!);
  const tray = new THREE.Box3().setFromObject(root.getObjectByName('neb-protein-serving-tray')!);
  assert.ok(Math.abs(pot.min.y - tray.max.y) < .003, `the serving pot floats ${pot.min.y - tray.max.y} above its tray`);
});

test('the serving tray has a continuous metal stand reaching the deck', t => {
  const root = new THREE.Group(), renderer = new CrewMealRenderer(root); t.after(() => renderer.dispose()); renderer.update(journey()); root.updateMatrixWorld(true);
  const tray = new THREE.Box3().setFromObject(root.getObjectByName('neb-protein-serving-tray')!);
  const legs: THREE.Mesh[] = []; root.traverse(object => { if (object instanceof THREE.Mesh && object.name.startsWith('neb-serving-stand-leg-')) legs.push(object); });
  assert.equal(legs.length, 4, 'the tray needs four real supporting legs, not a floating surface');
  for (const leg of legs) {
    const bounds = new THREE.Box3().setFromObject(leg);
    assert.ok(Math.abs(bounds.min.y) < .002 && Math.abs(bounds.max.y - tray.min.y) < .002, 'each leg must connect the tray underside to the deck');
    assert.ok(bounds.min.x >= tray.min.x && bounds.max.x <= tray.max.x && bounds.min.z >= tray.min.z && bounds.max.z <= tray.max.z, 'the stand stays underneath its tray');
    assert.ok(leg.visible, 'the stand must actually render');
  }
});

test('hiding either an actor or a detail ancestor restores the single visible world bowl and spoon', t => {
  const root = new THREE.Group(), renderer = new CrewMealRenderer(root); t.after(() => renderer.dispose());
  const actor = new THREE.Group(), body = new THREE.Group(), detail = new THREE.Group(); actor.add(body); body.add(detail);
  for (const name of ['meal-held-bowl', 'meal-held-spoon']) { const prop = new THREE.Group(); prop.name = name; detail.add(prop); }
  const state = journey(); state.interlude!.phase = 'accepting'; state.interlude!.elapsed = 3;
  const update = () => renderer.update(state, id => id === 'neo' ? body : undefined);
  const bowl = root.getObjectByName('neb-neo-protein-bowl')!, spoon = root.getObjectByName('neb-neo-spoon')!;
  update(); assert.equal(bowl.visible, false); assert.equal(spoon.visible, false);
  for (const hidden of [detail, body, actor]) {
    hidden.visible = false; update();
    assert.equal(bowl.visible, true, 'a locally visible held bowl beneath a hidden parent is not a rendered owner');
    assert.equal(spoon.visible, true, 'a hidden actor cannot consume the only visible spoon');
    hidden.visible = true; update(); assert.equal(bowl.visible, false); assert.equal(spoon.visible, false);
  }
});

test('Tank’s hidden serving hand cannot suppress the world bowl during a cold load', t => {
  const root = new THREE.Group(), renderer = new CrewMealRenderer(root); t.after(() => renderer.dispose());
  const tank = new THREE.Group(), detail = new THREE.Group(), serving = new THREE.Group();
  serving.name = 'meal-serving-bowl'; tank.add(detail); detail.add(serving);
  const state = journey(); state.interlude!.phase = 'performing'; state.interlude!.elapsed = .15;
  renderer.update(state, id => id === 'tank' ? tank : undefined); assert.equal(root.getObjectByName('neb-neo-protein-bowl')!.visible, false);
  detail.visible = false; renderer.update(state, id => id === 'tank' ? tank : undefined);
  assert.equal(root.getObjectByName('neb-neo-protein-bowl')!.visible, true, 'the world copy remains until the serving hand is actually visible');
});

test('disposing a meal scene releases the per-instance grain buffers as well as geometry and materials', () => {
  const root = new THREE.Group(), renderer = new CrewMealRenderer(root), instances: THREE.InstancedMesh[] = [];
  const disposed = new Set<THREE.InstancedMesh>();
  root.traverse(object => {
    if (!(object instanceof THREE.InstancedMesh)) return;
    instances.push(object); object.addEventListener('dispose', () => disposed.add(object));
  });
  assert.ok(instances.length >= 6, 'the test must exercise the actual instanced food meshes');
  renderer.dispose();
  assert.equal(disposed.size, instances.length, 'Three releases instanceMatrix GPU buffers only on the InstancedMesh dispose event');
  assert.equal(root.getObjectByName('neb-crew-meal-scene'), undefined);
});
