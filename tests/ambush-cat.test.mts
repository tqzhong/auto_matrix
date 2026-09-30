import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, ambushCat, ambushFloor, filmPosition, playerBlocked, type FilmJourney } from '@auto_matrix/shared';
import { AmbushSetRenderer } from '../packages/client/src/engine/AmbushSetRenderer.js';

test('the repeated black cat actually descends the shared stairs, with the same path on its second pass', () => {
  const top = ambushCat(.8, true), bottom = ambushCat(6, true);
  assert.ok(top.visible && bottom.visible);
  assert.ok(top.z > 29 && bottom.z < 20, 'the cat must pass the company and go down the flight');
  assert.ok(top.y - bottom.y > 2.7, 'a flat doorway walk cannot stand in for descending the stairs');
  for (let i = 4; i < 62; i++) {
    const first = ambushCat(i / 10, true), repeated = ambushCat(i / 10 + 6.8, true);
    for (const key of ['x', 'y', 'z', 'phase', 'yaw'] as const) assert.ok(Math.abs(first[key] - repeated[key]) < .00001, key);
    assert.equal(first.visible, repeated.visible);
    assert.equal(first.y, ambushFloor(first.x, first.z, first.y));
  }
});

function journey(elapsed: number): FilmJourney {
  return { version: 1, scene: 'm1_dejavu', actor: 'neo', step: 0, completed: [], enteredAt: 0, reflections: {}, lastText: '',
    checkpoint: filmPosition('film_ambush_house', 11, 31.8), ambush: { elapsed },
    ambushApproach: { ready: true, stairCat: true, progress: { morpheus: 0, switch: 0, apoc: 0, trinity: 0, cypher: 0 } } };
}

test('the upper landing uses the visible back wall instead of an extra invisible perimeter strip', () => {
  assert.equal(playerBlocked(filmPosition('film_ambush_house', -.8, 32.5), true, 1.1), false,
    'the body ends at 33.6, short of the rendered wall face at 33.65');
  assert.equal(playerBlocked(filmPosition('film_ambush_house', -.8, 32.6), true, 1.1), true);
});

test('a saved stair-cat pose loads at its actual height and stays unchanged while the world is paused', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const parent = new THREE.Group(), renderer = new AmbushSetRenderer(parent);
  const cat = (renderer as unknown as { cat: THREE.Group }).cat;
  try {
    renderer.update(journey(4.2), [], 0); parent.updateMatrixWorld(true);
    assert.ok(cat.visible && cat.position.y < -.3, 'restoring a descending cat cannot put it on the old flat floor');
    const matrix = cat.matrixWorld.clone();
    renderer.update(journey(4.2), [], 0); parent.updateMatrixWorld(true);
    assert.deepEqual(cat.matrixWorld.elements, matrix.elements);
  } finally { renderer.dispose(); }
});

test('the actual four paw meshes do not penetrate the wooden treads throughout either descent', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const parent = new THREE.Group(), renderer = new AmbushSetRenderer(parent);
  const cat = (renderer as unknown as { cat: THREE.Group }).cat;
  const paws: THREE.Mesh[] = []; cat.traverse(object => { if (object instanceof THREE.Mesh && object.name === 'ambush-cat-paw') paws.push(object); });
  assert.equal(paws.length, 4, 'measure all four actual paws, not a root marker');
  const point = new THREE.Vector3();
  try {
    for (let frame = 4; frame < 63; frame++) {
      const time = frame / 10; renderer.update(journey(time), [], time); parent.updateMatrixWorld(true);
      let contact = Infinity;
      for (const paw of paws) for (let i = 0; i < paw.geometry.attributes.position.count; i++) {
        paw.getVertexPosition(i, point); paw.localToWorld(point);
        const floor = ambushFloor(point.x, point.z, cat.position.y + .8);
        assert.notEqual(floor, undefined, 'a paw must remain above the physical flight or landing');
        const gap = point.y - floor!; contact = Math.min(contact, gap);
        assert.ok(gap >= -.008, `paw clips at ${time}: ${gap}`);
      }
      assert.ok(contact < .06, `all four paws are floating at ${time}: ${contact}`);
      const first = paws.map(paw => paw.matrixWorld.elements.slice());
      renderer.update(journey(time + 6.8), [], time + 6.8); parent.updateMatrixWorld(true);
      paws.forEach((paw, i) => paw.matrixWorld.elements.forEach((value, j) => assert.ok(Math.abs(value - first[i][j]) < .00001, `the repeat must restore the same paw gait at ${time}, paw ${i}, matrix ${j}: ${value} / ${first[i][j]}`)));
      renderer.update(journey(time + 6.8), [], time + 6.8); parent.updateMatrixWorld(true);
      paws.forEach((paw, i) => paw.matrixWorld.elements.forEach((value, j) => assert.ok(Math.abs(value - first[i][j]) < .00001, 'a paused reload cannot advance the paws')));
    }
  } finally { renderer.dispose(); }
});

test('the cat keeps its body and leg meshes above the treads at the actual translated film location', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const parent = new THREE.Group(), center = FILM_SETS.film_ambush_house.center;
  parent.position.set(center.x, center.y - 1, center.z);
  const renderer = new AmbushSetRenderer(parent), cat = parent.getObjectByName('ambush-black-cat')!;
  const meshes: THREE.Mesh[] = []; cat.traverse(object => { if (object instanceof THREE.Mesh) meshes.push(object); });
  const point = new THREE.Vector3();
  try {
    for (let frame = 4; frame < 63; frame++) {
      const time = frame / 10; renderer.update(journey(time), [], time); parent.updateMatrixWorld(true);
      for (const mesh of meshes) for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
        mesh.getVertexPosition(i, point); mesh.localToWorld(point); point.sub(parent.position);
        const floor = ambushFloor(point.x, point.z, cat.position.y + .8);
        if (floor !== undefined) assert.ok(point.y - floor >= -.008, `${mesh.name || mesh.type} clips at ${time}: ${point.y - floor}`);
      }
    }
  } finally { renderer.dispose(); }
});

test('stair-cat motion advances between network snapshots and stops when the observation is suspended', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const parent = new THREE.Group(), renderer = new AmbushSetRenderer(parent), cat = parent.getObjectByName('ambush-black-cat')!;
  try {
    const state = journey(3.5); renderer.update(state, [], 10);
    const first = cat.position.clone(); renderer.update(state, [], 10.1);
    assert.ok(cat.position.z < first.z - .25, 'the cat cannot freeze between authoritative broadcasts');
    renderer.update(state, [], 10.1);
    assert.deepEqual(cat.position, first, 'a stopped world clock must anchor to the saved pose, not retain a predicted future position');
    state.ambush!.paused = true; renderer.update(state, [], 10.2); parent.updateMatrixWorld(true);
    const paused = cat.matrixWorld.clone();
    for (let frame = 0; frame < 20; frame++) {
      renderer.update(state, [], 10.3 + frame / 60); parent.updateMatrixWorld(true);
      assert.deepEqual(cat.matrixWorld.elements, paused.elements, 'occupation or leaving the observation point must stop prediction');
    }
  } finally { renderer.dispose(); }
});
