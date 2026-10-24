import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, filmBlocked, filmGroundHeight, filmPosition, type FilmJourney } from '@auto_matrix/shared';
import { TrainingSetRenderer } from '../packages/client/src/engine/TrainingSetRenderer.js';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { LightingSystem } from '../packages/client/src/engine/LightingSystem.js';

const set = FILM_SETS.film_kungfu_dojo;
function room(t: { after: (fn: () => void) => void }) {
  const root = new THREE.Group(); root.position.set(set.center.x, set.center.y - 1, set.center.z);
  const renderer = new TrainingSetRenderer(root, 'm1_dojo'); root.updateMatrixWorld(true); t.after(() => renderer.dispose());
  return { root, renderer };
}

test('dojo mats, seams and surrounding walkway all support the feet at the shared floor height', t => {
  const { root } = room(t), down = new THREE.Vector3(0, -1, 0);
  for (let x = -23; x <= 23; x += .5) for (let z = -29; z <= 29; z += .5) {
    const position = filmPosition(set.id, x, z);
    const hit = new THREE.Raycaster(new THREE.Vector3(position.x, position.y + 2, position.z), down, 0, 4).intersectObject(root, true)[0];
    assert.ok(hit, `missing visible support at ${x}, ${z}`);
    assert.ok(Math.abs(hit.point.y + 1 - filmGroundHeight(position, set)) < 1e-5, `${x}, ${z}: visual floor ${hit.point.y}, physical feet ${position.y - 1}`);
  }
});

test('dojo eye-level views and upward views terminate inside an enclosed two-storey hall', t => {
  const { root } = room(t);
  for (const y of [3.2, 6, 13.5, 15]) for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 24) {
    const origin = new THREE.Vector3(set.center.x, set.center.y - 1 + y, set.center.z);
    const ray = new THREE.Raycaster(origin, new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle)), 0, 48);
    assert.ok(ray.intersectObject(root, true).length, `open exterior at height ${y}, yaw ${angle}`);
  }
  for (const [x, z] of [[0, 0], [-18, -21], [18, 21], [-18, 21], [18, -21]]) {
    const origin = new THREE.Vector3(set.center.x + x, set.center.y + 3, set.center.z + z);
    assert.ok(new THREE.Raycaster(origin, new THREE.Vector3(0, 1, 0), 0, set.height).intersectObject(root, true).length, 'the hall has a visible ceiling');
  }
});

test('the visible lower walls coincide with the shared player boundary', t => {
  const { root } = room(t), radius = 1.1;
  for (const direction of [new THREE.Vector3(-1, 0, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, 1)]) {
    const start = new THREE.Vector3(set.center.x + (direction.z ? 12 : 0), set.center.y + 2, set.center.z + (direction.x ? 12 : 0));
    const hit = new THREE.Raycaster(start, direction, 0, 40).intersectObject(root, true)[0]; assert.ok(hit);
    const boundary = (direction.x ? set.width : set.depth) / 2 - .6;
    assert.ok(hit.distance >= boundary - 1e-5 && hit.distance <= boundary + .1, 'paper sits immediately behind the physical outer lattice face');
    const before = start.clone().addScaledVector(direction, boundary - radius - .02); before.y = set.center.y;
    const after = before.clone().addScaledVector(direction, .04);
    assert.equal(filmBlocked(before, set, radius), false, 'the player can approach the wall');
    assert.equal(filmBlocked(after, set, radius), true, 'the rendered wall must stop the player before the body enters it');
  }
});

test('paper is recessed behind its wooden lattice instead of sharing a flickering front surface', t => {
  const { root } = room(t);
  const origin = new THREE.Vector3(set.center.x, set.center.y - 1 + 3.71, set.center.z + 12);
  const hits = new THREE.Raycaster(origin, new THREE.Vector3(-1, 0, 0), 0, 26).intersectObject(root, true);
  const paper = hits.find(hit => (hit.object as THREE.Mesh).material instanceof THREE.MeshStandardMaterial && ((hit.object as THREE.Mesh).material as THREE.MeshStandardMaterial).emissive.getHex() !== 0);
  assert.ok(paper); assert.ok(paper.distance - hits[0].distance > .03 && paper.distance - hits[0].distance < .1, 'paper and lattice need separate depth');
});

test('gallery corners join without coplanar overlapping floor slabs', t => {
  const { root } = room(t);
  for (const x of [-23.1, 23.1]) for (const z of [-29.1, 29.1]) {
    const origin = new THREE.Vector3(set.center.x + x, set.center.y - 1 + 8.1, set.center.z + z);
    const hits = new THREE.Raycaster(origin, new THREE.Vector3(0, -1, 0), 0, 1).intersectObject(root, true);
    assert.ok(hits.length, 'the gallery corner is supported');
    const top = hits[0].point.y;
    assert.equal(new Set(hits.filter(hit => Math.abs(hit.point.y - top) < 1e-5).map(hit => hit.object)).size, 1, 'overlapping timber surfaces can flicker at the corner');
  }
});

test('dojo daylight stays fixed through pause, counterattack and completion and uses one shadow sun', t => {
  const { root, renderer } = room(t), scene = new THREE.Scene(); scene.background = new THREE.Color(); scene.fog = new THREE.FogExp2(); scene.add(root);
  const lights = new LightingSystem(scene); t.after(() => lights.dispose());
  const atmosphere = FilmSetRenderer.prototype.atmosphere.call({ current: set, scene, training: renderer } as unknown as FilmSetRenderer)!;
  lights.update(0, new THREE.PerspectiveCamera(), false, atmosphere);
  let shadows = 0; scene.traverse(object => { if (object instanceof THREE.Light && object.castShadow && object.intensity > 0) shadows++; });
  assert.equal(shadows, 1, 'one authored window sun, without a second world sun');
  const values = () => { const result: number[] = []; root.traverse(object => { if (object instanceof THREE.Light) result.push(object.intensity); }); return result; };
  const original = values();
  const journey: FilmJourney = { version: 1, scene: 'm1_dojo', step: 0, actor: 'neo', completed: [], enteredAt: 0, checkpoint: filmPosition(set.id), reflections: {}, lastText: '' };
  for (const complete of [false, true]) for (const elapsed of [0, .3, 1, 100]) {
    journey.dojo = { dodged: true, combo: 3, hits: 3, resets: 1, complete };
    renderer.update(journey, elapsed); assert.deepEqual(values(), original, 'architecture does not pulse with combat state or wall clock');
  }
});

test('fixed dojo joinery is batched and paper screens do not require a scene transmission pass', t => {
  const { root } = room(t); let meshes = 0, triangles = 0;
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return; meshes++;
    triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      assert.ok(!(material instanceof THREE.MeshPhysicalMaterial) || material.transmission === 0, 'opaque paper must not trigger scene refraction');
    }
  });
  assert.ok(meshes < 100, `fixed hall uses ${meshes} separate meshes`);
  assert.ok(triangles < 100000, `joinery uses ${triangles} triangles before shadow passes`);
});
