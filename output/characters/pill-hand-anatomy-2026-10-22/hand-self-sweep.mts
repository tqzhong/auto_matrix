import * as THREE from 'three';
import { intersection } from './all-hand-crossings-fine.mjs';
interface Face { face: number; ids: number[]; points: THREE.Vector3[]; box: THREE.Box3 }

/** The same directed triangle predicate, with a sweep over complete face bounds. */
export function selfIntersections(faces: Face[]) {
  const cache = new Map<THREE.Vector3[], THREE.Vector3>();
  for (const face of faces) cache.set(face.points, new THREE.Triangle(...face.points as [THREE.Vector3, THREE.Vector3, THREE.Vector3]).getNormal(new THREE.Vector3()));
  const ordered = faces.slice().sort((a, b) => a.box.min.x - b.box.min.x || a.face - b.face), active: Face[] = [], examples = [];
  let pairCandidates = 0;
  for (const face of ordered) {
    let kept = 0;
    for (const other of active) {
      if (other.box.max.x < face.box.min.x) continue;
      active[kept++] = other; pairCandidates += 2;
      if (!face.box.intersectsBox(other.box)) continue;
      let shared = 0; for (const id of face.ids) if (other.ids.includes(id)) shared++;
      if (shared >= 2) continue;
      const forward = intersection(face.points, other.points, cache), reverse = intersection(other.points, face.points, cache);
      if (forward > 1e-5) examples.push({ first: face.face, second: other.face, line: forward });
      if (reverse > 1e-5) examples.push({ first: other.face, second: face.face, line: reverse });
    }
    active.length = kept; active.push(face);
  }
  return { count: examples.length, pairCandidates, examples };
}
