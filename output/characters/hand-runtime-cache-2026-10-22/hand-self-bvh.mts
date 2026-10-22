import * as THREE from 'three';
import { intersection } from './all-hand-crossings-fine.mjs';
interface Face { face: number; ids: number[]; points: THREE.Vector3[]; box: THREE.Box3 }
interface Node { box: THREE.Box3; count: number; faces?: Face[]; left?: Node; right?: Node }
function tree(faces: Face[]): Node {
  const box = new THREE.Box3(); for (const face of faces) box.union(face.box);
  if (faces.length <= 8) return { box, count: faces.length, faces };
  const size = box.getSize(new THREE.Vector3()), axis = size.y >= size.x && size.y >= size.z ? 'y' : size.z >= size.x ? 'z' : 'x';
  const sorted = faces.slice().sort((a, b) => a.box.min[axis] + a.box.max[axis] - b.box.min[axis] - b.box.max[axis] || a.face - b.face), middle = sorted.length >> 1;
  return { box, count: faces.length, left: tree(sorted.slice(0, middle)), right: tree(sorted.slice(middle)) };
}
/** Only the conservative broad phase changes; both directed predicates,
 * shared-edge exclusion and the 1e-5 intersection-line gate stay identical. */
export function selfIntersections(faces: Face[]) {
  const cache = new Map<THREE.Vector3[], THREE.Vector3>(), examples: { first: number; second: number; line: number }[] = []; let pairCandidates = 0;
  for (const face of faces) cache.set(face.points, new THREE.Triangle(...face.points as [THREE.Vector3, THREE.Vector3, THREE.Vector3]).getNormal(new THREE.Vector3()));
  const pair = (a: Face, b: Face) => {
    pairCandidates += 2;
    if (!a.box.intersectsBox(b.box)) return;
    let shared = 0; for (const id of a.ids) if (b.ids.includes(id)) shared++;
    if (shared >= 2) return;
    const forward = intersection(a.points, b.points, cache), reverse = intersection(b.points, a.points, cache);
    if (forward > 1e-5) examples.push({ first: a.face, second: b.face, line: forward });
    if (reverse > 1e-5) examples.push({ first: b.face, second: a.face, line: reverse });
  };
  const between = (a: Node, b: Node): void => {
    if (!a.box.intersectsBox(b.box)) return;
    if (a.faces && b.faces) { for (const first of a.faces) for (const second of b.faces) pair(first, second); return; }
    if (!a.faces && (b.faces || a.count >= b.count)) { between(a.left!, b); between(a.right!, b); }
    else { between(a, b.left!); between(a, b.right!); }
  };
  const within = (node: Node): void => {
    if (node.faces) { for (let i = 0; i < node.faces.length; i++) for (let j = i + 1; j < node.faces.length; j++) pair(node.faces[i], node.faces[j]); return; }
    within(node.left!); within(node.right!); between(node.left!, node.right!);
  };
  within(tree(faces)); return { count: examples.length, pairCandidates, examples };
}
