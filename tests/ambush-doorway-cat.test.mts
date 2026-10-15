import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, filmPosition, type FilmJourney } from '@auto_matrix/shared';
import { AmbushSetRenderer } from '../packages/client/src/engine/AmbushSetRenderer.js';

function journey(elapsed: number): FilmJourney {
  return { version: 1, scene: 'm1_dejavu', actor: 'neo', step: 0, completed: [], enteredAt: 0, reflections: {}, lastText: '',
    checkpoint: filmPosition('film_ambush_house', 11, 31.8), ambush: { elapsed },
    ambushApproach: { ready: true, stairCat: true, doorwayCat: true, progress: { morpheus: 0, switch: 0, apoc: 0, trinity: 0, cypher: 0 } } };
}

function fixture(t: TestContext) {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const root = new THREE.Group(), center = FILM_SETS.film_ambush_house.center;
  root.position.set(center.x, center.y - 1, center.z);
  const solids: { bounds: THREE.Box3; inverse: THREE.Matrix4; half: THREE.Vector3 }[] = [];
  const prototype = AmbushSetRenderer.prototype as unknown as { batch(): void }, batch = prototype.batch;
  t.mock.method(prototype, 'batch', function(this: { root: THREE.Group }) {
    this.root.updateWorldMatrix(true, true);
    this.root.traverse(object => {
      if (!(object instanceof THREE.Mesh) || !(object.geometry instanceof THREE.BoxGeometry)) return;
      const size = object.geometry.parameters, half = new THREE.Vector3(size.width / 2, size.height / 2, size.depth / 2);
      solids.push({ half, inverse: object.matrixWorld.clone().invert(), bounds: new THREE.Box3(half.clone().negate(), half).applyMatrix4(object.matrixWorld) });
    });
    return batch.call(this);
  });
  const renderer = new AmbushSetRenderer(root); t.after(() => renderer.dispose());
  const update = (time: number, state = journey(time)) => { renderer.update(state, [], time); root.updateMatrixWorld(true); };
  update(.5);
  const cat = root.getObjectByName('ambush-doorway-cat');
  assert.ok(cat, 'new film doorway saves must use a separately authored cat, while legacy stair-cat geometry stays available');
  const paws: THREE.Mesh[] = [];
  cat.traverse(object => { if (object instanceof THREE.Mesh && object.name === 'ambush-doorway-cat-paw') paws.push(object); });
  assert.equal(paws.length, 4, 'inspect all four visible foot surfaces');
  const carpet = root.getObjectByName('ambush-cat-red-carpet') as THREE.Mesh;
  assert.ok(carpet, 'the cat walks behind the threshold on the red-brown carpet visible in the film');
  const floor = carpet.getWorldPosition(new THREE.Vector3()).y;
  const sole = (paw: THREE.Mesh) => {
    let y = Infinity; const point = new THREE.Vector3();
    for (let i = 0; i < paw.geometry.attributes.position.count; i++) y = Math.min(y, paw.localToWorld(paw.getVertexPosition(i, point)).y);
    return { y, position: paw.getWorldPosition(new THREE.Vector3()) };
  };
  return { root, renderer, cat, paws, carpet, floor, sole, solids, update };
}

test('the film doorway cat walks right to left on a level carpet with an anatomically continuous silhouette', t => {
  const h = fixture(t), first = h.cat.position.clone();
  assert.ok(h.cat.visible); assert.equal(h.root.getObjectByName('ambush-black-cat')!.visible, false);
  h.update(5.8); const last = h.cat.position.clone();
  assert.ok(last.z < first.z - 4 && last.x === first.x && last.y === first.y, 'the cat crosses the flat room behind the door instead of descending the staircase');
  const forward = new THREE.Vector3(1, 0, 0).applyQuaternion(h.cat.quaternion);
  assert.ok(forward.z < -.99, 'the actual authored muzzle points along the screen-right to screen-left travel');
  const anatomy = h.cat.getObjectByName('ambush-doorway-cat-anatomy') as THREE.Mesh;
  assert.ok(anatomy && !(anatomy.geometry instanceof THREE.SphereGeometry), 'the chest, tucked abdomen, neck and muzzle must form a continuous authored surface');
  const bounds = new THREE.Box3().setFromObject(h.cat);
  assert.ok(bounds.max.y - h.floor >= .85 && bounds.max.y - h.floor <= 1.15, 'a house cat cannot be half the height of the human cast');
});

test('all four real paws remain above the carpet, with continuous support and planted stance feet', t => {
  const h = fixture(t), ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);
  for (let frame = 0; frame < 235; frame++) {
    const time = .35 + frame * .025; h.update(time);
    const before = h.paws.map(h.sole);
    assert.ok(before.every(paw => paw.y >= h.floor - .003), `a sole penetrates the carpet at ${time}: ${before.map(paw => paw.y - h.floor)}`);
    assert.ok(before.filter(paw => paw.y < h.floor + .004).length >= 2, `fewer than two real soles support the body at ${time}`);
    for (const paw of before) {
      ray.set(paw.position.clone().setY(h.floor + .5), down);
      assert.ok(ray.intersectObject(h.carpet).length, 'each foot must remain over the actual carpet mesh, not just a nominal floor height');
    }
    h.update(time + .01); const after = h.paws.map(h.sole);
    for (let i = 0; i < 4; i++) if (before[i].y < h.floor + .004 && after[i].y < h.floor + .004)
      assert.ok(before[i].position.distanceTo(after[i].position) < .003,
        `planted paw ${i} slides with the body at ${time}: ${before[i].position.distanceTo(after[i].position)}`);
  }
});

test('the repeat, paused cold load and version changes preserve the complete delivered cat pose', t => {
  const h = fixture(t), other = fixture(t);
  const matrices = (cat: THREE.Object3D) => { const result: number[][] = []; cat.traverse(object => result.push(object.matrixWorld.toArray())); return result; };
  for (const time of [.3, .82, 1.51, 2.44, 3.92, 5.87, 6.299]) {
    h.update(time); const first = matrices(h.cat);
    h.update(time + 6.8); assert.deepEqual(matrices(h.cat), first, 'the second pass repeats every joint and visible surface');
    const saved = journey(time); saved.ambush!.paused = true;
    other.update(time, saved); assert.deepEqual(matrices(other.cat), first, 'cold loading does not replay a gait transition');
    for (const age of [100, 101, 102]) { other.update(age, saved); assert.deepEqual(matrices(other.cat), first, 'paused snapshots cannot predict another footfall'); }
  }
  const legacy = journey(4); delete legacy.ambushApproach!.doorwayCat;
  h.update(4, legacy); assert.equal(h.cat.visible, false); assert.equal(h.root.getObjectByName('ambush-black-cat')!.visible, true);
  h.update(4); assert.equal(h.cat.visible, true); assert.equal(h.root.getObjectByName('ambush-black-cat')!.visible, false);
});

test('starting observation after waiting in the room does not inherit inactive cat prediction', t => {
  const warm = fixture(t), cold = fixture(t), waiting = journey(0);
  delete waiting.ambush;
  warm.update(10, waiting); warm.update(10.6, waiting);
  const start = journey(0);
  warm.update(10.61, start); cold.update(10.61, start);
  assert.equal(warm.cat.visible, false, 'waiting in the room cannot advance the first appearance');
  assert.deepEqual(warm.cat.position.toArray(), cold.cat.position.toArray(), 'warm and cold saved elapsed=0 use the same route origin');
  const walking = journey(.4);
  warm.update(10.7, walking); const reported = warm.cat.position.z;
  warm.update(10.8, walking);
  assert.ok(warm.cat.visible && warm.cat.position.z < reported, 'an active snapshot still predicts between server reports');
  warm.update(20, waiting); warm.update(20.5, waiting); warm.update(20.51, start);
  assert.equal(warm.cat.visible, false, 'leaving and restarting also clears the old prediction');
  assert.deepEqual(warm.cat.position.toArray(), cold.cat.position.toArray());
});

test('every real cat mesh clears the doorway walls and the tail stays in front of the actual back wall', t => {
  const h = fixture(t), center = FILM_SETS.film_ambush_house.center;
  const back = h.solids.find(solid => solid.bounds.min.z > center.z + 33 && solid.bounds.max.z > center.z + 34
    && solid.bounds.min.x < center.x + 16 && solid.bounds.max.x > center.x + 16)!;
  assert.ok(back, 'measure the actual visible back wall captured before static geometry batching');
  const parts: THREE.Mesh[] = []; h.cat.traverse(object => { if (object instanceof THREE.Mesh) parts.push(object); });
  let clearance = Infinity;
  for (let frame = 0; frame <= 240; frame++) {
    h.update(.3 + Math.min(5.999, frame * .025));
    for (const mesh of parts) {
      const geometry = mesh.geometry, indices = geometry.index?.array ?? Array.from({ length: geometry.attributes.position.count }, (_, i) => i);
      const vertices = Array.from({ length: geometry.attributes.position.count }, (_, i) => mesh.localToWorld(mesh.getVertexPosition(i, new THREE.Vector3())));
      for (const point of vertices) { clearance = Math.min(clearance, back.bounds.min.z - point.z); assert.ok(point.y >= h.floor - .003, 'body, lower limbs and tail stay above the real carpet'); }
      const bounds = new THREE.Box3().setFromPoints(vertices);
      for (const solid of h.solids.filter(solid => solid.bounds.intersectsBox(bounds))) {
        const local = vertices.map(vertex => vertex.clone().applyMatrix4(solid.inverse));
        const inner = solid.half.clone().addScalar(-.002), box = new THREE.Box3(inner.clone().negate(), inner);
        for (let index = 0; index < indices.length; index += 3)
          assert.equal(box.intersectsTriangle(new THREE.Triangle(local[indices[index]], local[indices[index + 1]], local[indices[index + 2]])), false,
            `actual cat triangle intersects a delivered wall or floor at ${frame / 40}s: ${mesh.name}`);
      }
    }
  }
  t.diagnostic(`Minimum actual mesh clearance to back-wall face: ${clearance}`);
  assert.ok(clearance > .025, 'the complete tail must fit inside the room, including the first appearance');
});

test('the actual doorway remains open above the tiled threshold and cat resources dispose once', t => {
  const h = fixture(t), door = h.root.getObjectByName('ambush-cat-doorway');
  assert.ok(door, 'the film doorway has visible dimensional framing');
  assert.ok(door.getObjectByName('ambush-cat-checker-floor'));
  const center = FILM_SETS.film_ambush_house.center;
  const ray = new THREE.Raycaster(new THREE.Vector3(center.x + 10, center.y + 2, center.z + 29.7), new THREE.Vector3(1, 0, 0), 0, 6);
  assert.equal(ray.intersectObject(door, true).length, 0, 'decorative frame geometry must not fill the open line of sight');
  const resources = new Set<THREE.BufferGeometry | THREE.Material>();
  for (const group of [h.cat, door]) group.traverse(object => { if (object instanceof THREE.Mesh) {
    resources.add(object.geometry); (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => resources.add(material));
  } });
  const disposed = new Map<object, number>();
  for (const resource of resources) resource.addEventListener('dispose', () => disposed.set(resource, (disposed.get(resource) ?? 0) + 1));
  h.renderer.dispose();
  for (const resource of resources) assert.equal(disposed.get(resource), 1, 'new visible geometry and materials are released exactly once');
  // The fixture cleanup has no remaining attached scene to dispose.
  t.mock.method(h.renderer, 'dispose', () => {});
});
