import * as THREE from 'three';
type Triangle = [THREE.Vector3, THREE.Vector3, THREE.Vector3];

export function capsuleTriangleGap(points: Triangle, radius: number, length: number): number {
  const start = new THREE.Vector3(0, -length / 2, 0), end = new THREE.Vector3(0, length / 2, 0);
  const ray = new THREE.Ray(start, new THREE.Vector3(0, 1, 0)), hit = new THREE.Vector3(), triangle = new THREE.Triangle(...points);
  if (ray.intersectTriangle(...points, false, hit) && hit.distanceToSquared(start) <= length * length) return -radius;
  let squared = Math.min(triangle.closestPointToPoint(start, hit).distanceToSquared(start), triangle.closestPointToPoint(end, hit).distanceToSquared(end));
  for (let i = 0; i < 3; i++) {
    const distance = ray.distanceSqToSegment(points[i], points[(i + 1) % 3], hit);
    if (hit.distanceToSquared(start) <= length * length) squared = Math.min(squared, distance);
  }
  return Math.sqrt(Math.max(0, squared)) - radius;
}

function radialMinimum(p: Triangle): number {
  const cross = (a: THREE.Vector3, b: THREE.Vector3) => a.x * b.z - a.z * b.x;
  const area = (p[1].x - p[0].x) * (p[2].z - p[0].z) - (p[1].z - p[0].z) * (p[2].x - p[0].x);
  const signs = [cross(p[0], p[1]), cross(p[1], p[2]), cross(p[2], p[0])];
  if (area !== 0 && (signs.every(s => s >= 0) || signs.every(s => s <= 0))) return 0;
  return Math.min(...p.map((a, i) => {
    const b = p[(i + 1) % 3], x = b.x - a.x, z = b.z - a.z, denominator = x * x + z * z;
    const t = denominator === 0 ? 0 : THREE.MathUtils.clamp(-(a.x * x + a.z * z) / denominator, 0, 1);
    return Math.hypot(a.x + t * x, a.z + t * z);
  }));
}
function clip(points: THREE.Vector3[], y: number, above: boolean): THREE.Vector3[] {
  const result: THREE.Vector3[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length], da = a.y - y, db = b.y - y;
    const first = above ? da >= 0 : da <= 0, second = above ? db >= 0 : db <= 0;
    if (first) result.push(a);
    if (first !== second) result.push(a.clone().lerp(b, da / (da - db)));
  }
  return result;
}

/** Bound every point of the actual triangle against the outer glass profile.
 * The existing 4mm contact margin is unchanged. Ambiguity is never a pass. */
export function cupTriangleProof(points: Triangle, bottom: THREE.Vector2, top: THREE.Vector2) {
  let minimumLowerBound = Infinity, subdivisions = 0;
  if (Math.max(...points.map(p => p.y)) < bottom.y || Math.min(...points.map(p => p.y)) > top.y)
    return { safe: true, minimumLowerBound, subdivisions, unresolved: false };
  const polygon = clip(clip(points, bottom.y, true), top.y, false);
  const pending: { points: Triangle; depth: number }[] = [];
  for (let i = 1; i + 1 < polygon.length; i++) pending.push({ points: [polygon[0], polygon[i], polygon[i + 1]], depth: 0 });
  const radius = (y: number) => bottom.x + (top.x - bottom.x) * (y - bottom.y) / (top.y - bottom.y);
  while (pending.length) {
    const { points: p, depth } = pending.pop()!;
    const lower = radialMinimum(p) - radius(Math.max(...p.map(v => v.y)));
    if (lower >= -.004) { minimumLowerBound = Math.min(minimumLowerBound, lower); continue; }
    const worst = Math.min(...p.map(v => Math.hypot(v.x, v.z) - radius(v.y)));
    if (worst < -.004) return { safe: false, minimumLowerBound: worst, subdivisions, unresolved: false };
    if (depth === 20) return { safe: false, minimumLowerBound: lower, subdivisions, unresolved: true };
    const lengths = p.map((v, i) => v.distanceToSquared(p[(i + 1) % 3])), side = lengths.indexOf(Math.max(...lengths));
    const a = p[side], b = p[(side + 1) % 3], c = p[(side + 2) % 3], middle = a.clone().lerp(b, .5);
    pending.push({ points: [a, middle, c], depth: depth + 1 }, { points: [middle, b, c], depth: depth + 1 }); subdivisions++;
  }
  return { safe: true, minimumLowerBound, subdivisions, unresolved: false };
}
