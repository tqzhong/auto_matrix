import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { TEMPLE_DEFENSE, type FilmJourney } from '@auto_matrix/shared';
import { TempleDefenseRenderer } from '../packages/client/src/engine/TempleDefenseRenderer.js';

test('the city has a physical ceiling before the drill breaks through and retains its breach on returning to Zion', t => {
  const root = new THREE.Group(), renderer = new TempleDefenseRenderer(root);
  t.after(() => renderer.dispose());
  const journey = { scene: 'm3_temple_breach', completed: [], templeBreach: { phase: 'ready', elapsed: 0 } } as FilmJourney;
  const ceiling = () => {
    root.updateMatrixWorld(true);
    return new THREE.Raycaster(new THREE.Vector3(1, 29, -104), new THREE.Vector3(0, 1, 0), 0, 8)
      .intersectObject(root.getObjectByName('temple-city-ceiling')!, true);
  };
  renderer.update(journey);
  assert.ok(root.getObjectByName('temple-city-ceiling'), 'the drill must break a physical ceiling rather than descend through empty air');
  assert.ok(ceiling().length > 0, 'the future hole is initially closed');
  journey.templeBreach = { phase: 'breach', elapsed: TEMPLE_DEFENSE.breach.drilling };
  renderer.update(journey);
  assert.equal(ceiling().length, 0, 'the opened roof cannot remain an invisible solid over the drill');
  const fragments = root.getObjectByName('temple-ceiling-fragments')!;
  assert.ok(fragments.children.length >= 8, 'real ceiling pieces must fall, not simply disappear');
  const transforms = fragments.children.map(part => part.matrixWorld.clone());
  journey.templeBreach = { phase: 'done', elapsed: 0 }; journey.completed.push('m3_temple_breach');
  renderer.update(journey); root.updateMatrixWorld(true);
  fragments.children.forEach((part, index) => assert.ok(part.matrixWorld.equals(transforms[index]), 'waiting must retain landed roof pieces'));
  journey.scene = 'm3_ceasefire'; renderer.update(journey); root.updateMatrixWorld(true);
  assert.equal(ceiling().length, 0, 'the city cannot repair its ceiling when Neo returns control to Zion');
  fragments.children.forEach((part, index) => assert.ok(part.matrixWorld.equals(transforms[index])));
});

test('paused and cold-loaded temple destruction render exactly the same physical frame', t => {
  const root = new THREE.Group(), renderer = new TempleDefenseRenderer(root);
  const coldRoot = new THREE.Group(), cold = new TempleDefenseRenderer(coldRoot);
  t.after(() => { renderer.dispose(); cold.dispose(); });
  const journey = { scene: 'm3_temple_breach', completed: [], templeBreach: { phase: 'breach', elapsed: 2.7 } } as FilmJourney;
  renderer.update(journey); root.updateMatrixWorld(true);
  const fragments = root.getObjectByName('temple-ceiling-fragments'); assert.ok(fragments);
  const matrices = fragments.children.map(part => part.matrixWorld.clone());
  renderer.update(journey); root.updateMatrixWorld(true);
  fragments.children.forEach((part, index) => assert.ok(part.matrixWorld.equals(matrices[index])));
  cold.update(structuredClone(journey)); coldRoot.updateMatrixWorld(true);
  coldRoot.getObjectByName('temple-ceiling-fragments')!.children.forEach((part, index) => assert.ok(part.matrixWorld.equals(matrices[index])));
});
