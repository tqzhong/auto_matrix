import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { actor, bends, fingerGroups } from './helpers/fighting-hand-fixture.mjs';
import { handSurface } from './helpers/hand-surface.mjs';
import { crossings } from './helpers/hand-self-contact.mjs';
import { advanceMotion, newMotion } from '../packages/client/src/agents/CharacterMotion.js';

const inputAt = (elapsed: number) => ({ speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true,
  nebCrew: 'morpheus' as const, nebCrewEarly: true,
  training: { kind: 'download' as const, elapsed, role: 'morpheus' as const } });
const draw = (h: Awaited<ReturnType<typeof actor>>, elapsed: number) => {
  const input = inputAt(elapsed), state = newMotion();
  h.models.animate(h.rig, advanceMotion(state, input, 0), state, input, 0);
  h.rig.root.updateMatrixWorld(true);
};

test('Morpheus supports his chin with a loose fist and an opposing thumb, without splayed claw fingers', async t => {
  const h = await actor('morpheus'); t.after(() => h.models.dispose());
  const groups = fingerGroups(h.rig, 'R');
  for (const elapsed of [9.7, 10]) {
    draw(h, elapsed);
    for (const finger of bends(h.rig, 'R', groups).slice(1)) {
      assert.ok(finger.PIP > 60 && finger.PIP < 110, `${elapsed}: digit ${finger.digit} is not loosely closed: PIP ${finger.PIP}`);
      assert.ok(finger.DIP < 85 && finger.curvature >= -.015, `${elapsed}: digit ${finger.digit} curls backward`);
    }
    groups.skin.skeleton.update();
    const thumb = groups.tips[0].reduce((sum, id) => sum.add(groups.skin.getVertexPosition(id, new THREE.Vector3())), new THREE.Vector3()).divideScalar(groups.tips[0].length);
    const nearby = groups.hand.filter(id => groups.digits[id] === 2 || groups.digits[id] === 3);
    const gap = Math.min(...nearby.map(id => thumb.distanceTo(groups.skin.getVertexPosition(id, new THREE.Vector3()))));
    assert.ok(gap < .08, `${elapsed}: thumb pad extends ${gap} away from the curled fingers`);
  }
});

test('Morpheus retains a closed continuous hand surface throughout the chin gesture', async t => {
  const h = await actor('morpheus'); t.after(() => h.models.dispose());
  const surface = handSurface(h.rig, 'R');
  for (const elapsed of [9.1, 9.25, 9.4, 9.55, 9.7, 10]) {
    draw(h, elapsed);
    const result = surface.draw();
    assert.equal(result.self.count, 0, `${elapsed}: actual hand intersects itself: ${JSON.stringify(result.self)}`);
    const twins = new Map<number, THREE.Vector3>();
    for (const vertex of surface.vertices) {
      const point = result.points.get(vertex)!; assert.ok(point.toArray().every(Number.isFinite));
      const twin = twins.get(surface.weld[vertex]);
      if (twin) assert.ok(twin.distanceTo(point) < 2e-6, `${elapsed}: UV seam opens at ${vertex}`);
      else twins.set(surface.weld[vertex], point);
    }
  }
});

test('the chin-support thumb rests alongside the curled index finger', async t => {
  const h = await actor('morpheus'); t.after(() => h.models.dispose());
  const surface = handSurface(h.rig, 'R'), group = surface.group;
  const indexFaces = surface.triangles.filter(face => face.ids.every(id => group.digits[id] === 2));
  assert.ok(indexFaces.length > 100, 'measure the actual index finger surface');
  for (const elapsed of [9.7, 10]) {
    draw(h, elapsed);
    const points = surface.posePoints();
    const pad = group.tips[0].reduce((sum, id) => sum.add(points.get(id)!), new THREE.Vector3()).divideScalar(group.tips[0].length);
    let gap = Infinity;
    for (const face of indexFaces) {
      const triangle = new THREE.Triangle(...face.ids.map(id => points.get(id)!) as [THREE.Vector3, THREE.Vector3, THREE.Vector3]);
      gap = Math.min(gap, triangle.closestPointToPoint(pad, new THREE.Vector3()).distanceTo(pad));
    }
    const wrist = h.rig.bones.get('wrist_R')!, middle = h.rig.bones.get('finger3-1_R')!;
    const palmLength = wrist.worldToLocal(middle.getWorldPosition(new THREE.Vector3())).length();
    assert.ok(gap < palmLength * .15, `${elapsed}: thumb is separated from the index finger by ${gap / palmLength} palm lengths`);
  }
});

test('the supporting fist points upward beneath the chin instead of across the lower face', async t => {
  const h = await actor('morpheus'); t.after(() => h.models.dispose());
  for (const elapsed of [9.7, 10]) {
    draw(h, elapsed);
    const head = h.rig.bones.get('head')!, wrist = h.rig.bones.get('wrist_R')!, knuckle = h.rig.bones.get('finger3-2_R')!;
    const a = head.worldToLocal(wrist.getWorldPosition(new THREE.Vector3()));
    const b = head.worldToLocal(knuckle.getWorldPosition(new THREE.Vector3()));
    assert.ok(b.y - a.y > .2, `${elapsed}: fist is sideways, knuckle elevation ${b.y - a.y}`);
    assert.ok(a.y < -.45, `${elapsed}: wrist obscures the lower face at ${a.y}`);
  }
});

test('the invitation hand stays below the chin with the gap visible in the film', async t => {
  const h = await actor('morpheus'); t.after(() => h.models.dispose());
  const surface = handSurface(h.rig, 'R'), skin = surface.group.skin, a = skin.geometry.attributes, index = skin.geometry.index!;
  const head = h.rig.bones.get('head')!, headIndex = skin.skeleton.bones.indexOf(head), headIds: { face: number; ids: number[] }[] = [];
  for (let face = 0; face < index.count; face += 3) {
    const ids = [0, 1, 2].map(k => index.getX(face + k));
    if (ids.every(v => [0, 1, 2, 3].some(k => a.skinIndex.getComponent(v, k) === headIndex && a.skinWeight.getComponent(v, k) > .5))) headIds.push({ face: face / 3, ids });
  }
  for (const elapsed of [9.1, 9.25, 9.4, 9.55, 9.7, 10]) {
    draw(h, elapsed); skin.skeleton.update();
    const hand = surface.draw(), inverse = h.rig.bones.get('wrist_R')!.matrixWorld.clone().invert();
    const matrix = inverse.clone().multiply(skin.matrixWorld);
    const points = new Map([...new Set(headIds.flatMap(t => t.ids))].map(v => [v, skin.getVertexPosition(v, new THREE.Vector3()).applyMatrix4(matrix)]));
    const faces = headIds.map(t => { const p = t.ids.map(v => points.get(v)!); return { ...t, points: p, box: new THREE.Box3().setFromPoints(p) }; });
    const intersections = crossings(hand.faces, faces, false);
    assert.equal(intersections.count, 0, `${elapsed}: hand penetrates the head: ${JSON.stringify(intersections)}`);
    if (elapsed < 9.7) continue;
    const eye = head.userData.cameraEye as THREE.Vector3;
    const ray = new THREE.Ray(head.localToWorld(new THREE.Vector3(0, -.6, eye.z)).applyMatrix4(inverse),
      new THREE.Vector3(0, 1, 0).transformDirection(head.matrixWorld).transformDirection(inverse));
    const hits = faces.flatMap(face => { const hit = ray.intersectTriangle(face.points[0], face.points[1], face.points[2], false, new THREE.Vector3()); return hit ? [hit] : []; });
    const chin = hits.sort((a, b) => a.distanceToSquared(ray.origin) - b.distanceToSquared(ray.origin))[0];
    assert.ok(chin, 'sample the delivered chin, not a guessed face plane');
    const gap = Math.min(...Array.from(hand.points.values()).map(point => point.distanceTo(chin)));
    // The Show me close-up leaves a visible gap below the chin. Keep the
    // hand nearby without treating a forced chin contact as film fidelity.
    const palmLength = h.rig.bones.get('wrist_R')!.worldToLocal(h.rig.bones.get('finger3-1_R')!.getWorldPosition(new THREE.Vector3())).length();
    assert.ok(gap > palmLength * .08 && gap < palmLength * .5, `${elapsed}: film hand gap is ${gap / palmLength} palm lengths`);
  }
});

test('the saved chin gesture restores the same skin and releases without carrying over a fist', async t => {
  const warm = await actor('morpheus'), cold = await actor('morpheus');
  t.after(() => { warm.models.dispose(); cold.models.dispose(); });
  const snapshot = (h: typeof warm) => {
    const skin = h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
    return Object.fromEntries(['position', 'normal', 'skinIndex', 'skinWeight'].map(name => [name, Array.from(skin.geometry.attributes[name].array)]));
  };
  warm.draw(0); cold.draw(0); const relaxed = snapshot(warm);
  for (const elapsed of [9.25, 9.55, 9.7, 10]) {
    warm.draw(1); draw(warm, 10); draw(warm, elapsed); draw(cold, elapsed);
    assert.deepEqual(snapshot(warm), snapshot(cold), `${elapsed}: loading a chin gesture depends on its history`);
    const paused = snapshot(warm); draw(warm, elapsed); assert.deepEqual(snapshot(warm), paused);
  }
  warm.draw(0); assert.deepEqual(snapshot(warm), relaxed, 'leaving the story restores the relaxed hand');
});
