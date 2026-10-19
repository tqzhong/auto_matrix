import assert from 'node:assert/strict';
import test from 'node:test';
import { writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { makeModel, meshSurface, worldPoints, jointAngles } from '../morpheus-ambush-doff-2026-10-17/grip-fixture.mjs';
import { auditCage } from '../morpheus-ambush-doff-2026-10-17/cloth-rebuild/cage-contact.mjs';
import { WithdrawalBody } from './WithdrawalBody.mjs';
import { WithdrawalCuffs } from './WithdrawalCuffs.mjs';

function cuffRings(mesh: THREE.Mesh): THREE.Vector3[][] {
  const surface = meshSurface(mesh), welded = new Map<string, number>(), points: THREE.Vector3[] = [];
  const ids = surface.vertices.map(point => {
    const key = point.map(value => value.toFixed(7)).join(','); let id = welded.get(key);
    if (id === undefined) { id = points.length; points.push(new THREE.Vector3().fromArray(point)); welded.set(key, id); }
    return id;
  });
  const edges = new Map<string, number>();
  for (let i = 0; i < surface.indices.length; i += 3) for (let k = 0; k < 3; k++) {
    const key = [ids[surface.indices[i+k]], ids[surface.indices[i+(k+1)%3]]].sort((a,b) => a-b).join(':');
    edges.set(key, (edges.get(key) ?? 0) + 1);
  }
  const graph = new Map<number, number[]>();
  for (const [key, count] of edges) if (count === 1) {
    const [a,b] = key.split(':').map(Number);
    graph.set(a, [...graph.get(a) ?? [], b]); graph.set(b, [...graph.get(b) ?? [], a]);
  }
  assert.ok([...graph.values()].every(row => row.length === 2));
  const remaining = new Set(graph.keys()), rings = [];
  while (remaining.size) {
    const start = remaining.values().next().value!, ring = [start]; remaining.delete(start);
    while (true) {
      const next = graph.get(ring.at(-1)!)!.find(id => remaining.has(id)); if (next === undefined) break;
      ring.push(next); remaining.delete(next);
    }
    assert.ok(graph.get(ring.at(-1)!)!.includes(start)); rings.push(ring.map(id => points[id]));
  }
  assert.deepEqual(rings.map(ring => ring.length).sort((a,b) => a-b).slice(0,2), [61,61]);
  return rings.sort((a,b) => a.length-b.length).slice(0,2);
}

function aperture(ring: THREE.Vector3[], points: THREE.Vector3[], indices: number[]) {
  const center = ring.reduce((sum,p) => sum.add(p), new THREE.Vector3()).divideScalar(ring.length);
  const normal = ring.reduce((sum,p,i) => sum.add(p.clone().sub(center).cross(ring[(i+1)%ring.length].clone().sub(center))), new THREE.Vector3()).normalize();
  const x = ring[0].clone().sub(center).addScaledVector(normal, -ring[0].clone().sub(center).dot(normal)).normalize();
  const y = normal.clone().cross(x), project = (p: THREE.Vector3) => new THREE.Vector2(p.clone().sub(center).dot(x), p.clone().sub(center).dot(y));
  const polygon = ring.map(project), distances = points.map(p => p.clone().sub(center).dot(normal));
  const cuts: THREE.Vector2[] = [];
  for (let i = 0; i < indices.length; i += 3) for (let j = 0; j < 3; j++) {
    const a = indices[i+j], b = indices[i+(j+1)%3];
    if (distances[a]*distances[b] >= 0) continue;
    const hit = points[a].clone().lerp(points[b], -distances[a]/(distances[b]-distances[a]));
    if (hit.distanceTo(center) < .375) cuts.push(project(hit));
  }
  let clearance = Infinity, worstPoint: THREE.Vector3 | undefined, closestPoint: THREE.Vector3 | undefined;
  for (const point of cuts) {
    let inside = false, minimum = Infinity, nearest = new THREE.Vector2();
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i+1)%polygon.length];
      if ((a.y>point.y) !== (b.y>point.y) && point.x < (b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x) inside = !inside;
      const edge = b.clone().sub(a), amount = THREE.MathUtils.clamp(point.clone().sub(a).dot(edge)/edge.lengthSq(),0,1);
      const edgePoint = a.clone().addScaledVector(edge, amount), distance = point.distanceTo(edgePoint);
      if (distance < minimum) { minimum = distance; nearest.copy(edgePoint); }
    }
    const signed = (inside ? 1 : -1)*minimum;
    if (signed < clearance) {
      clearance = signed;
      worstPoint = center.clone().addScaledVector(x,point.x).addScaledVector(y,point.y);
      closestPoint = center.clone().addScaledVector(x,nearest.x).addScaledVector(y,nearest.y);
    }
  }
  return { sectionPoints: cuts.length, clearance, worstPoint, closestPoint,
    section: cuts.map(p => center.clone().addScaledVector(x,p.x).addScaledVector(y,p.y)),
    nonPlanarity: Math.max(...ring.map(p => Math.abs(p.clone().sub(center).dot(normal)))) };
}

test('each complete cuff can slide past the actual hand without forcing skin through its opening', async t => {
  const h = await makeModel(); t.after(() => h.models.dispose());
  const body = new WithdrawalBody(h.rig); body.pose(.8);
  const cuffs = new WithdrawalCuffs(h.rig);
  const rings = cuffRings(h.rig.root.getObjectByName('morpheus-ambush-coat') as THREE.Mesh);
  const skin = h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  const indices = Array.from(skin.geometry.index!.array), rows = [];
  for (let frame = 0; frame <= 288; frame++) {
    const time = .8 + frame / 120; body.pose(time); const points = worldPoints(skin);
    for (const ring of rings) {
      const side = ring[0].x < 0 ? 'R' : 'L', matrix = cuffs.matrix(side, time);
      const actualRing = ring.map(p => p.clone().applyMatrix4(matrix));
      const { section, ...result } = aperture(actualRing, points, indices);
      if (frame === 54 && side === 'R') {
        const inverse = h.rig.bones.get(`wrist_${side}`)!.matrixWorld.clone().invert();
        await writeFile(new URL('cuff-section.json', import.meta.url), JSON.stringify({ time,
          ring: actualRing.map(p => p.clone().applyMatrix4(inverse).toArray()), section: section.map(p => p.applyMatrix4(inverse).toArray()) }));
      }
      result.worstPoint?.applyMatrix4(h.rig.bones.get(`wrist_${side}`)!.matrixWorld.clone().invert());
      result.closestPoint?.applyMatrix4(h.rig.bones.get(`wrist_${side}`)!.matrixWorld.clone().invert());
      rows.push({ time, side, ...result });
    }
  }
  await writeFile(new URL('cuff-passage-result.json', import.meta.url), JSON.stringify(rows, null, 2));
  const worst = rows.reduce((a,b) => a.clearance < b.clearance ? a : b);
  console.log(JSON.stringify({ worst, sampledSections: rows.filter(row => row.sectionPoints).length }));
  // Leave at least 1 mm after accounting for the measured non-planarity of
  // the actual rim; no enlarged opening or disabled hand geometry.
  assert.ok(rows.every(row => !row.sectionPoints || row.clearance-row.nonPlanarity >= .0025), `hand does not fit through cuff: ${JSON.stringify(worst)}`);
  assert.ok(rows.filter(row => row.time > 1.7).every(row => row.sectionPoints === 0), 'the full hand must have exited both cuffs');
});

test('gathering and relaxing the thumbs preserves anatomy and does not fold skin through the other fingers', async t => {
  const h = await makeModel(); t.after(() => h.models.dispose());
  const body = new WithdrawalBody(h.rig);
  const skin = h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  const { skinIndex, skinWeight } = skin.geometry.attributes, index = skin.geometry.index!;
  const ids = new Set<number>(), faces = [];
  for (let id = 0; id < skinIndex.count; id++) if ([0,1,2,3].some(k => skinWeight.getComponent(id,k) > .01 && /^(wrist|finger)/.test(skin.skeleton.bones[skinIndex.getComponent(id,k)].name))) ids.add(id);
  for (let face = 0; face < index.count / 3; face++) if ([0,1,2].every(k => ids.has(index.getX(face*3+k)))) faces.push(face);
  assert.ok(faces.length > 1000, 'check both actual hands');
  const rows = [];
  for (const time of [0, .3, .4, .5, .6, .7, .8, 1.15, 1.4, 1.7, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 8]) {
    body.pose(time);
    const result = auditCage(meshSurface(skin, faces), []);
    const thumbs = jointAngles(h.rig).filter(finger => finger.digit === 1);
    rows.push({ time, self: result.selfCount, maximumPIP: Math.max(...thumbs.map(thumb => thumb.pip)), maximumDIP: Math.max(...thumbs.map(thumb => thumb.dip)) });
  }
  console.log(JSON.stringify({ anatomy: rows }));
  assert.ok(rows.every(row => row.self === 0), `thumb crosses the actual hand: ${JSON.stringify(rows)}`);
  assert.ok(rows.every(row => row.maximumPIP < 100 && row.maximumDIP < 90), 'thumb joints must bend within the existing anatomy bounds');
});

test('the complete cuff path preserves the opening and restores the same saved position in another world placement', async t => {
  const h = await makeModel(), cold = await makeModel();
  t.after(() => { h.models.dispose(); cold.models.dispose(); });
  cold.rig.root.position.set(12,5,-3); cold.rig.root.rotation.y = 1.14; cold.rig.root.scale.setScalar(.4); cold.rig.root.updateMatrixWorld(true);
  const body = new WithdrawalBody(h.rig), coldBody = new WithdrawalBody(cold.rig);
  body.pose(.8); coldBody.pose(.8);
  const path = new WithdrawalCuffs(h.rig), restored = new WithdrawalCuffs(cold.rig);
  const rings = cuffRings(h.rig.root.getObjectByName('morpheus-ambush-coat') as THREE.Mesh);
  const localPoints = [new THREE.Vector3(.03,-.082,.015),new THREE.Vector3(-.08,-.082,0),new THREE.Vector3(.14,-.082,.1)];
  const warmStart = h.rig.bones.get('wrist_R')!.matrixWorld.clone(), coldStart = cold.rig.bones.get('wrist_R')!.matrixWorld.clone();
  const inverse = cold.rig.root.matrixWorld.clone().invert();
  let maximumStep = 0, sizeDifference = 0, coldDifference = 0;
  const pointsAt = (time: number) => {
    body.pose(time); return rings.map(ring => {
      const matrix = path.matrix(ring[0].x < 0 ? 'R' : 'L',time);
      return ring.map(point => point.clone().applyMatrix4(matrix));
    });
  };
  let previous = pointsAt(.8);
  for (let frame = 0; frame <= 288; frame++) {
    const time = .8 + frame/120, actual = pointsAt(time);
    actual.forEach((ring,i) => ring.forEach((point,j) => {
      maximumStep = Math.max(maximumStep, point.distanceTo(previous[i][j]));
      for (const k of [0,20,40]) sizeDifference = Math.max(sizeDifference, Math.abs(point.distanceTo(ring[k])-rings[i][j].distanceTo(rings[i][k])));
    }));
    previous = actual;
    coldBody.pose(time);
    for (const point of localPoints) {
      const warm = point.clone().applyMatrix4(warmStart).applyMatrix4(path.matrix('R',time));
      const placed = point.clone().applyMatrix4(coldStart).applyMatrix4(restored.matrix('R',time)).applyMatrix4(inverse);
      coldDifference = Math.max(coldDifference, warm.distanceTo(placed));
    }
  }
  const saved = pointsAt(1.25); pointsAt(3.2); const loaded = pointsAt(1.25);
  console.log(JSON.stringify({ maximumStep, sizeDifference, coldDifference }));
  assert.ok(sizeDifference < 1e-9, `opening was resized to fit the hand: ${sizeDifference}`);
  assert.ok(maximumStep < .04, `cuff jumps between 120Hz samples: ${maximumStep}`);
  assert.ok(coldDifference < 1e-9, `cuff path depends on scene placement: ${coldDifference}`);
  assert.ok(loaded.every((ring,i) => ring.every((point,j) => point.distanceTo(saved[i][j]) < 1e-9)), 'saved cuff position depends on playback history');
});
