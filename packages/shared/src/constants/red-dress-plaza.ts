import type { Vector3 } from '../types/agent.js';
import type { TrainingPerformance } from './training.js';

/** The curved spillway, pool and street furniture share rendering/physics coordinates. */
export const RED_DRESS_PLAZA = {
  fountain: { halfWidth: 21, back: -40, lip: 5.7, pool: .55, floor: -.25, rim: 1.15, rimWidth: .5 },
  benches: [-1, 1].flatMap(side => [-13, 13].map(z => ({ x: side * 26, z, width: 1.2, depth: 4.4, height: 2.35, side }))),
  planters: [-1, 1].flatMap(side => [-29, 29].map(z => ({ x: side * 26, z, width: 3.9, depth: 3.9, height: 1.08 }))),
  crowd: { near: -26, far: 36 },
} as const;
export const RED_DRESS_CROWD = Array.from({ length: 20 }, (_, index) => ({
  x: [0, 16, -6, 22][index % 4], z: -25 + Math.floor(index / 2) * 6, scale: .86 + index % 3 * .06,
}));

export function redDressCrowdZ(base: number, index: number, clock: number, started: boolean): number {
  const { near, far } = RED_DRESS_PLAZA.crowd, length = far - near;
  const travel = started ? clock * 2 : 0, direction = index % 2 ? 1 : -1;
  return ((base + direction * travel - near) % length + length) % length + near;
}

export function redDressCrowdStep(before: Vector3, after: Vector3, center: Vector3, training?: TrainingPerformance): Vector3 {
  const clock = training?.attention?.clock ?? training?.elapsed ?? 0;
  const blocked = (candidate: Vector3) => {
    const dx = candidate.x - before.x, dz = candidate.z - before.z, span = dx * dx + dz * dz;
    if (span < 1e-12) return false;
    return RED_DRESS_CROWD.some((body, index) => {
      const x = center.x + body.x, z = center.z + redDressCrowdZ(body.z, index, clock, Boolean(training?.started));
      const t = Math.max(0, Math.min(1, ((x - before.x) * dx + (z - before.z) * dz) / span));
      if (Math.abs(before.y + (candidate.y - before.y) * t - center.y) >= 4) return false;
      const gap = Math.hypot(before.x + dx * t - x, before.z + dz * t - z);
      return gap < 1.1 + .8 * body.scale && gap < Math.hypot(before.x - x, before.z - z) - .000001;
    });
  };
  if (!blocked(after)) return after;
  const x = { ...after, z: before.z }, z = { ...after, x: before.x };
  const openX = !blocked(x), openZ = !blocked(z);
  if (openX && (!openZ || Math.abs(after.x - before.x) >= Math.abs(after.z - before.z))) return x;
  if (openZ) return z;
  return { ...after, x: before.x, z: before.z };
}

export type PlazaPoint = { x: number; z: number };
export const RED_DRESS_SPILLWAY: PlazaPoint[] = Array.from({ length: 65 }, (_, i) => {
  const x = -RED_DRESS_PLAZA.fountain.halfWidth + i * RED_DRESS_PLAZA.fountain.halfWidth / 32;
  return { x, z: -36 + 1.2 * Math.cos(x / 21 * Math.PI * 1.3) };
});
export const RED_DRESS_POOL_OUTLINE: PlazaPoint[] = [
  { x: -21.5, z: -40.5 }, { x: 21.5, z: -40.5 },
  ...[...RED_DRESS_SPILLWAY].reverse().map(p => ({ x: p.x * 21.5 / 21, z: p.z + 4 })),
];
export const RED_DRESS_POOL_INSIDE: PlazaPoint[] = [
  { x: -21, z: -40 }, { x: 21, z: -40 },
  ...[...RED_DRESS_SPILLWAY].reverse().map(p => ({ x: p.x, z: p.z + 3.5 })),
];
export const RED_DRESS_SPILLWAY_BODY: PlazaPoint[] = [
  { x: -21, z: -40 }, { x: 21, z: -40 }, ...[...RED_DRESS_SPILLWAY].reverse(),
];

function footprint(x: number, z: number, points: readonly PlazaPoint[]): { inside: boolean; distanceSq: number } {
  let inside = false, distanceSq = Infinity;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j], dx = b.x - a.x, dz = b.z - a.z;
    if ((a.z > z) !== (b.z > z) && x < (b.x - a.x) * (z - a.z) / (b.z - a.z) + a.x) inside = !inside;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)));
    distanceSq = Math.min(distanceSq, (x - a.x - t * dx) ** 2 + (z - a.z - t * dz) ** 2);
  }
  return { inside, distanceSq };
}

export function redDressFountainBlocked(x: number, height: number, z: number, radius: number): boolean {
  const f = RED_DRESS_PLAZA.fountain;
  if (Math.abs(x) > 21.5 + radius || z > -30.8 + radius || z < -40.5 - radius || height >= f.lip) return false;
  const body = footprint(x, z, RED_DRESS_SPILLWAY_BODY);
  if (body.inside || body.distanceSq < radius * radius) return true;
  if (height >= f.rim) return false;
  const outer = footprint(x, z, RED_DRESS_POOL_OUTLINE), inner = footprint(x, z, RED_DRESS_POOL_INSIDE);
  return (outer.inside || outer.distanceSq < radius * radius) && (!inner.inside || inner.distanceSq < radius * radius);
}

export function redDressFountainFloor(x: number, z: number): number {
  if (Math.abs(x) > 21.5 || z > -30.8 || z < -40.5) return 0;
  const body = footprint(x, z, RED_DRESS_SPILLWAY_BODY), outer = footprint(x, z, RED_DRESS_POOL_OUTLINE), inner = footprint(x, z, RED_DRESS_POOL_INSIDE);
  if (body.inside || body.distanceSq < 1e-12) return RED_DRESS_PLAZA.fountain.lip;
  if (!outer.inside && outer.distanceSq >= 1e-12) return 0;
  return inner.inside && inner.distanceSq >= 1e-12 ? RED_DRESS_PLAZA.fountain.floor : RED_DRESS_PLAZA.fountain.rim;
}
