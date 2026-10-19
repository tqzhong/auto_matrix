import * as THREE from 'three';
import { intersection } from '../grip-fixture.mjs';

interface Surface { name?: string; vertices: number[][]; indices: number[] }
function cells(box: THREE.Box3) {
  const result: string[] = [];
  for (let x = Math.floor(box.min.x / .05); x <= Math.floor(box.max.x / .05); x++)
    for (let y = Math.floor(box.min.y / .05); y <= Math.floor(box.max.y / .05); y++)
      for (let z = Math.floor(box.min.z / .05); z <= Math.floor(box.max.z / .05); z++) result.push(`${x},${y},${z}`);
  return result;
}
export function auditCage(surface: Surface, bodies: Surface[]) {
  const points = surface.vertices.map(p => new THREE.Vector3().fromArray(p));
  const triangles: { face: number; ids: number[]; points: THREE.Vector3[]; box: THREE.Box3 }[] = [], grid = new Map<string, number[]>();
  let selfTested = 0, bodyTested = 0; const self = [], body = [];
  for (let face = 0; face < surface.indices.length / 3; face++) {
    const ids = [0, 1, 2].map(k => surface.indices[face * 3 + k]), triangle = ids.map(id => points[id]);
    const box = new THREE.Box3().setFromPoints(triangle), keys = cells(box);
    for (const id of new Set(keys.flatMap(key => grid.get(key) ?? []))) {
      const other = triangles[id]; if (ids.filter(id => other.ids.includes(id)).length >= 2 || !box.intersectsBox(other.box)) continue;
      selfTested++; const line = intersection(triangle, other.points); if (line > 1e-5) self.push({ face, other: other.face, line });
    }
    const id = triangles.length; triangles.push({ face, ids, points: triangle, box });
    for (const key of keys) { let list = grid.get(key); if (!list) grid.set(key, list = []); list.push(id); }
  }
  for (const source of bodies) {
    const actual = source.vertices.map(p => new THREE.Vector3().fromArray(p));
    for (let face = 0; face < source.indices.length / 3; face++) {
      const points = [0, 1, 2].map(k => actual[source.indices[face * 3 + k]]), box = new THREE.Box3().setFromPoints(points);
      for (const id of new Set(cells(box).flatMap(key => grid.get(key) ?? []))) {
        const other = triangles[id]; if (!box.intersectsBox(other.box)) continue;
        bodyTested++; const line = intersection(points, other.points); if (line > 1e-5) body.push({ mesh: source.name, bodyFace: face, envelope: other.face, line });
      }
    }
  }
  return { selfTested, bodyTested, selfCount: self.length, bodyCount: body.length, self, body };
}
