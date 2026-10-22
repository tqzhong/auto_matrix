import * as THREE from 'three';

export function intersection(first: THREE.Vector3[], second: THREE.Vector3[], cache: Map<THREE.Vector3[], THREE.Vector3>): number {
  const normal = (points: THREE.Vector3[]) => cache.get(points)!;
  const cut = (points: THREE.Vector3[], plane: THREE.Vector3[]) => {
    const n = normal(plane), base = plane[0], a = points[0], b = points[1], c = points[2];
    const d0 = (a.x - base.x) * n.x + (a.y - base.y) * n.y + (a.z - base.z) * n.z;
    const d1 = (b.x - base.x) * n.x + (b.y - base.y) * n.y + (b.z - base.z) * n.z;
    const d2 = (c.x - base.x) * n.x + (c.y - base.y) * n.y + (c.z - base.z) * n.z;
    if (d0 >= -1e-8 && d1 >= -1e-8 && d2 >= -1e-8 || d0 <= 1e-8 && d1 <= 1e-8 && d2 <= 1e-8) return [];
    const distances = [d0, d1, d2], hits: THREE.Vector3[] = [];
    const add = (point: THREE.Vector3) => { if (!hits.some(hit => hit.distanceTo(point) < 1e-9)) hits.push(point); };
    for (let i = 0; i < 3; i++) {
      const next = (i + 1) % 3;
      if (Math.abs(distances[i]) <= 1e-8) add(points[i].clone());
      if (distances[i] * distances[next] < 0) add(points[i].clone().lerp(points[next], distances[i] / (distances[i] - distances[next])));
    }
    return hits;
  };
  const a = cut(first, second); if (a.length < 2) return 0;
  const b = cut(second, first); if (b.length < 2) return 0;
  const axis = normal(first).clone().cross(normal(second)).normalize();
  const interval = (points: THREE.Vector3[]) => points.map(point => (point.x - first[0].x) * axis.x + (point.y - first[0].y) * axis.y + (point.z - first[0].z) * axis.z).sort((a, b) => a - b);
  const x = interval(a), y = interval(b);
  return Math.max(0, Math.min(x.at(-1)!, y.at(-1)!) - Math.max(x[0], y[0]));
}
interface Face { face: number; ids: number[]; points: THREE.Vector3[]; box: THREE.Box3 }
function cells(box: THREE.Box3): string[] {
  const result: string[] = [];
  for (let x = Math.floor(box.min.x / .01); x <= Math.floor(box.max.x / .01); x++)
    for (let y = Math.floor(box.min.y / .01); y <= Math.floor(box.max.y / .01); y++)
      for (let z = Math.floor(box.min.z / .01); z <= Math.floor(box.max.z / .01); z++) result.push(`${x},${y},${z}`);
  return result;
}
export function crossings(first: Face[], second: Face[], sameMesh = true) {
  const cache = new Map<THREE.Vector3[], THREE.Vector3>();
  for (const face of [...first, ...second]) if (!cache.has(face.points)) cache.set(face.points, new THREE.Triangle(...face.points as [THREE.Vector3, THREE.Vector3, THREE.Vector3]).getNormal(new THREE.Vector3()));
  const grid = new Map<string, number[]>();
  for (const [id, face] of second.entries()) for (const key of cells(face.box)) {
    let ids = grid.get(key); if (!ids) grid.set(key, ids = []); ids.push(id);
  }
  const contacts = []; let pairCandidates = 0;
  for (const face of first) for (const id of new Set(cells(face.box).flatMap(key => grid.get(key) ?? []))) {
    pairCandidates++; const other = second[id];
    if (!face.box.intersectsBox(other.box) || sameMesh && face.ids.filter(v => other.ids.includes(v)).length >= 2) continue;
    const line = intersection(face.points, other.points, cache);
    if (line > 1e-5) contacts.push({ first: face.face, second: other.face, line });
  }
  return { count: contacts.length, pairCandidates, examples: contacts };
}
