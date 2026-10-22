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
