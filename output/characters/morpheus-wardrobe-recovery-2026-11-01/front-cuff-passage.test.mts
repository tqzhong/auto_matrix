import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { makeModel, worldPoints } from '../morpheus-ambush-doff-2026-10-17/grip-fixture.mjs';
import { FrontExitBody } from './FrontExitBody.mjs';
import { FrontExitCuffs } from './FrontExitCuffs.mjs';

const base = new URL('./', import.meta.url);
const data = JSON.parse(await readFile(new URL('corrected-body-input/manifest.json', base), 'utf8'));
const controls = JSON.parse(await readFile(new URL('boundary-controls.json', base), 'utf8'));
const boundaryEdges = new Map<string, number>();
const edgeKey = (a: number, b: number) => a < b ? `${a}:${b}` : `${b}:${a}`;
for (let i = 0; i < data.indices.length; i += 3) for (let k = 0; k < 3; k++) {
  const key = edgeKey(data.indices[i + k], data.indices[i + (k + 1) % 3]);
  boundaryEdges.set(key, (boundaryEdges.get(key) ?? 0) + 1);
}
const cuffs = controls.cuffs.map((cuff: { side: string; ring: number[] }) => {
  const allowed = new Set(cuff.ring), graph = new Map<number, number[]>();
  for (const [key, count] of boundaryEdges) {
    const [a, b] = key.split(':').map(Number);
    if (count !== 1 || !allowed.has(a) || !allowed.has(b)) continue;
    graph.set(a, [...graph.get(a) ?? [], b]); graph.set(b, [...graph.get(b) ?? [], a]);
  }
  assert.equal(graph.size, 61);
  assert.ok([...graph.values()].every(neighbours => neighbours.length === 2));
  const ring: number[] = []; let current = cuff.ring[0], previous = -1;
  do {
    ring.push(current);
    const next = graph.get(current)!.find(id => id !== previous)!;
    previous = current; current = next;
  } while (current !== ring[0] && ring.length <= cuff.ring.length);
  assert.equal(ring.length, cuff.ring.length);
  assert.deepEqual(new Set(ring), allowed);
  return { ...cuff, ring };
});

function aperture(ring: THREE.Vector3[], points: THREE.Vector3[], indices: number[]) {
  const center = ring.reduce((sum, p) => sum.add(p), new THREE.Vector3()).divideScalar(ring.length);
  const normal = ring.reduce((sum, p, i) => sum.add(p.clone().sub(center).cross(ring[(i + 1) % ring.length].clone().sub(center))), new THREE.Vector3()).normalize();
  const x = ring[0].clone().sub(center).addScaledVector(normal, -ring[0].clone().sub(center).dot(normal)).normalize();
  const y = normal.clone().cross(x);
  const project = (p: THREE.Vector3) => new THREE.Vector2(p.clone().sub(center).dot(x), p.clone().sub(center).dot(y));
  const polygon = ring.map(project), distances = points.map(p => p.clone().sub(center).dot(normal));
  const cuts: THREE.Vector2[] = [];
  for (let i = 0; i < indices.length; i += 3) for (let j = 0; j < 3; j++) {
    const a = indices[i + j], b = indices[i + (j + 1) % 3];
    if (distances[a] * distances[b] >= 0) continue;
    const hit = points[a].clone().lerp(points[b], -distances[a] / (distances[b] - distances[a]));
    if (hit.distanceTo(center) < .375) cuts.push(project(hit));
  }
  let clearance = Infinity;
  for (const point of cuts) {
    let inside = false, minimum = Infinity;
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length];
      if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
      const edge = b.clone().sub(a), amount = THREE.MathUtils.clamp(point.clone().sub(a).dot(edge) / edge.lengthSq(), 0, 1);
      minimum = Math.min(minimum, point.distanceTo(a.clone().addScaledVector(edge, amount)));
    }
    clearance = Math.min(clearance, (inside ? 1 : -1) * minimum);
  }
  return { sectionPoints: cuts.length, clearance, nonPlanarity: Math.max(...ring.map(p => Math.abs(p.clone().sub(center).dot(normal)))) };
}

test('the hinged body clears both complete standing-coat cuffs before releasing their controls', async t => {
  for (const cuff of cuffs) for (const [i, id] of cuff.ring.entries())
    assert.equal(boundaryEdges.get(edgeKey(id, cuff.ring[(i + 1) % cuff.ring.length])), 1, 'A cuff polygon segment must be an actual mesh boundary edge.');
  const h = await makeModel(); t.after(() => h.models.dispose());
  const body = new FrontExitBody(h.rig, 'front-exit'), path = new FrontExitCuffs(h.rig, body);
  const skin = h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  const indices = Array.from(skin.geometry.index!.array), rows = [];
  for (let frame = 0; frame <= 108; frame++) {
    const time = .8 + frame / 120; body.pose(time);
    const points = worldPoints(skin);
    for (const cuff of cuffs) {
      assert.equal(cuff.ring.length, 61);
      const matrix = path.matrix(cuff.side, time);
      const ring = cuff.ring.map((id: number) => new THREE.Vector3().fromArray(data.points[id]).applyMatrix4(matrix));
      rows.push({ time, side: cuff.side, ...aperture(ring, points, indices) });
    }
  }
  const worst = rows.reduce((a, b) => a.clearance - a.nonPlanarity < b.clearance - b.nonPlanarity ? a : b);
  const sourceHashes: Record<string, string> = {};
  for (const file of ['front-cuff-passage.test.mts', 'FrontExitBody.mts', 'FrontExitCuffs.mts', 'boundary-controls.json', 'corrected-body-input/manifest.json',
    '../morpheus-withdrawal-path-2026-10-20/WithdrawalCuffs.mts'])
    sourceHashes[file] = createHash('sha256').update(await readFile(new URL(file, base))).digest('hex');
  await writeFile(new URL('front-cuff-passage-verification.json', base), JSON.stringify({ sourceHashes, worst, cuffs,
    geometryPassed: rows.every(row => !row.sectionPoints || row.clearance - row.nonPlanarity >= .0025),
    handPassageBeforeRelease: rows.slice(-2).every(row => row.sectionPoints === 0),
    minimumRequiredClearanceModelUnits: .0025, acceptedForProduction: false, rows }, null, 2));
  console.log(JSON.stringify({ worst, last: rows.slice(-2) }));
  assert.ok(rows.every(row => !row.sectionPoints || row.clearance - row.nonPlanarity >= .0025), 'The actual hand cannot pass the complete cuff with the existing 1 mm clearance.');
  assert.ok(rows.slice(-2).every(row => row.sectionPoints === 0), 'The hand has not exited before cuff control release.');
});

test('standing-cuff controls preserve their size and are independent of playback history and placement', async t => {
  const h = await makeModel(), cold = await makeModel();
  t.after(() => { h.models.dispose(); cold.models.dispose(); });
  cold.rig.root.position.set(12, 5, -3); cold.rig.root.rotation.y = 1.14; cold.rig.root.scale.setScalar(.4); cold.rig.root.updateMatrixWorld(true);
  const body = new FrontExitBody(h.rig, 'front-exit'), restored = new FrontExitBody(cold.rig, 'front-exit');
  const warm = new FrontExitCuffs(h.rig, body), placed = new FrontExitCuffs(cold.rig, restored);
  const placement = cold.rig.root.matrixWorld.clone(), inverse = placement.clone().invert();
  let maximumStep = 0, maximumSizeError = 0, maximumColdError = 0;
  const at = (time: number) => {
    body.pose(time); restored.pose(time);
    return cuffs.map((cuff: { side: string; ring: number[] }) => {
      const a = warm.matrix(cuff.side, time), b = placed.matrix(cuff.side, time);
      return cuff.ring.map(id => {
        const point = new THREE.Vector3().fromArray(data.points[id]), expected = point.clone().applyMatrix4(a);
        maximumColdError = Math.max(maximumColdError, expected.distanceTo(point.applyMatrix4(placement).applyMatrix4(b).applyMatrix4(inverse)));
        return expected;
      });
    });
  };
  let previous = at(0);
  for (let frame = 0; frame <= 204; frame++) {
    const actual = at(frame / 120);
    actual.forEach((ring: THREE.Vector3[], i: number) => ring.forEach((point, j) => {
      maximumStep = Math.max(maximumStep, point.distanceTo(previous[i][j]));
      for (const k of [0, 20, 40]) maximumSizeError = Math.max(maximumSizeError,
        Math.abs(point.distanceTo(ring[k]) - new THREE.Vector3().fromArray(data.points[cuffs[i].ring[j]]).distanceTo(new THREE.Vector3().fromArray(data.points[cuffs[i].ring[k]]))));
    }));
    previous = actual;
  }
  const first = at(1.25); at(1.7); const repeated = at(1.25);
  assert.ok(repeated.every((ring: THREE.Vector3[], i: number) => ring.every((p, j) => p.distanceTo(first[i][j]) < 1e-9)));
  console.log(JSON.stringify({ maximumStep, maximumSizeError, maximumColdError }));
  assert.ok(maximumStep < .04);
  assert.ok(maximumSizeError < 1e-9);
  assert.ok(maximumColdError < 1e-9);
});
