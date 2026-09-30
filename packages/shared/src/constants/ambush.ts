import type { FilmObstacle } from './film-sets.js';

export interface AmbushEncounter { elapsed: number; paused?: boolean }
export const AMBUSH_REWRITE = 8.3;
export const AMBUSH_SECONDS = 9.5;
export const AMBUSH_CAT_STAIRS = { repeat: 6.8, rewrite: 13.4, seconds: 14.8, observation: { x: 11, y: 0, z: 31.8 } } as const;
// The top corridor keeps its saved height. Five pairs of flights connect room
// 1313 to the eighth-floor hall; the original entry is one floor below the cat.
export const AMBUSH_STAIRS = { rise: 7.4, steps: 12, left: -5.5, right: 5.5, entry: { x: -5.5, z: 32 } } as const;
export const AMBUSH_STOREYS = 5;
export const AMBUSH_COMPANY = {
  morpheus: { offset: 12.6, x: -8.5, z: -17 }, switch: { offset: 8.4, x: -7.5, z: -12 }, apoc: { offset: 4.2, x: -10, z: -7.5 },
  trinity: { offset: -4.2, x: -6, z: -3 }, cypher: { offset: -8.4, x: -10, z: 1.5 },
} as const;
export type AmbushCompanion = keyof typeof AMBUSH_COMPANY;
export interface AmbushApproach { ready: boolean; progress: Record<AmbushCompanion, number>; stairCat?: true }
export interface AmbushEscort { role: AmbushCompanion; progress: number; watching: boolean; stairCat?: true; retreat?: true }
export const AMBUSH_ROUTE = [
  { x: 5.5, y: -7.4, z: 32 }, { x: -5.5, y: -7.4, z: 32 },
  { x: -5.5, y: -7.4, z: 29 }, { x: -5.5, y: -3.7, z: 17 },
  { x: -5.5, y: -3.7, z: 14.5 }, { x: 5.5, y: -3.7, z: 14.5 },
  { x: 5.5, y: -3.7, z: 17 }, { x: 5.5, y: 0, z: 29 },
  { x: 5.5, y: 0, z: 31.8 }, { x: 11, y: 0, z: 31.8 }, { x: 11, y: 0, z: 8 },
] as const;
// Keep the original corridor route for saved journeys from before the stair cat.
const companyRoute = (role?: AmbushCompanion, stairCat = false) => stairCat ? role === 'trinity'
  ? [...AMBUSH_ROUTE.slice(0, 9), { x: -.8, y: 0, z: 31.8 }, { x: -.8, y: 0, z: 32.5 }]
  : role === 'cypher' ? [...AMBUSH_ROUTE.slice(0, 9), { x: 5.5, y: 0, z: 30.25 }, { x: -5.5, y: 0, z: 30.25 }]
    : [...AMBUSH_ROUTE.slice(0, 10), ...(role ? [{ x: 11, y: 0, z: role === 'morpheus' ? 20.8 : role === 'switch' ? 24.4 : 28 }] : [])]
  : [...AMBUSH_ROUTE, ...(role ? [
  { x: AMBUSH_COMPANY[role].x, y: 0, z: 8 }, { x: AMBUSH_COMPANY[role].x, y: 0, z: AMBUSH_COMPANY[role].z },
] : [{ x: 0, y: 0, z: 8 }, { x: 0, y: 0, z: -8 }])];
export function ambushRouteLength(role?: AmbushCompanion, stairCat = false): number {
  const route = companyRoute(role, stairCat); return route.slice(1).reduce((length, point, i) => length + Math.hypot(point.x - route[i].x, point.z - route[i].z), 0);
}
export function ambushRouteRoot(progress: number, role?: AmbushCompanion, stairCat = false) {
  const route = companyRoute(role, stairCat); let remaining = Math.max(0, progress);
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i], b = route[i + 1], length = Math.hypot(b.x - a.x, b.z - a.z);
    if (remaining > length && i < route.length - 2) { remaining -= length; continue; }
    const t = Math.min(1, remaining / length), x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
    const y = ambushFloor(x, z, a.y + (b.y - a.y) * t) ?? a.y;
    return { x, y, z, yaw: Math.atan2(b.x - a.x, b.z - a.z) };
  }
  return { ...route.at(-1)!, yaw: Math.PI };
}
/** Use height as well as the plan view: the two landings share the same x/z. */
export function ambushRouteProgress(x: number, y: number, z: number, stairCat = false): number {
  const route = companyRoute(undefined, stairCat); let offset = 0, best = Infinity, progress = 0;
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i], b = route[i + 1], dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy + (z - a.z) * dz) / (dx * dx + dy * dy + dz * dz)));
    const gap = Math.hypot(x - a.x - dx * t, y - a.y - dy * t, z - a.z - dz * t), length = Math.hypot(dx, dz);
    if (gap < best) { best = gap; progress = offset + length * t; } offset += length;
  }
  return progress;
}
export function ambushApproachTarget(x: number, y: number, z: number, stairCat = false) {
  const progress = ambushRouteProgress(x, y, z, stairCat), route = companyRoute(undefined, stairCat); let offset = 0;
  for (let i = 1; i < route.length; i++) {
    offset += Math.hypot(route[i].x - route[i - 1].x, route[i].z - route[i - 1].z);
    if (progress < offset - 1 || i === route.length - 1) return { ...route[i],
      label: stairCat && i === route.length - 1 ? '楼梯观察处' : i <= 3 ? '左侧木楼梯' : i <= 6 ? '换层平台' : i <= 8 ? '右侧木楼梯' : i <= 10 ? '上层护栏外侧' : '走廊观察处' };
  }
  return { ...route.at(-1)!, label: '走廊观察处' };
}
export function newAmbushApproach(): AmbushApproach {
  return { ready: false, stairCat: true, progress: Object.fromEntries(Object.entries(AMBUSH_COMPANY).map(([id, role]) => [id, 11 + role.offset])) as AmbushApproach['progress'] };
}
export interface AmbushSurface { x: number; z: number; width: number; depth: number; y: number }
export const AMBUSH_FLOORS: AmbushSurface[] = Array.from({ length: AMBUSH_STOREYS + 1 }, (_, storey) => {
  const y = -storey * AMBUSH_STAIRS.rise;
  return [{ x: 0, z: -11, width: 44, depth: 46, y },
    ...[-15.5, 15.5].map(x => ({ x, z: 20.5, width: 13, depth: 17, y })),
    { x: 0, z: 31.5, width: 44, depth: 5, y }];
}).flat();
AMBUSH_FLOORS.push({ x: 0, z: 23, width: 18, depth: 22, y: -AMBUSH_STAIRS.rise * AMBUSH_STOREYS });
export const AMBUSH_TREADS: AmbushSurface[] = [];
for (let storey = 0; storey < AMBUSH_STOREYS; storey++) {
  const y = -storey * AMBUSH_STAIRS.rise;
  AMBUSH_FLOORS.push({ x: 0, z: 14.5, width: 18, depth: 5, y: y - AMBUSH_STAIRS.rise / 2 });
  for (let step = 0; step < AMBUSH_STAIRS.steps; step++) {
    AMBUSH_TREADS.push({ x: AMBUSH_STAIRS.left, z: 28.5 - step, width: 5, depth: 1, y: y - AMBUSH_STAIRS.rise + (step + 1) * AMBUSH_STAIRS.rise / 24 },
      { x: AMBUSH_STAIRS.right, z: 17.5 + step, width: 5, depth: 1, y: y - AMBUSH_STAIRS.rise / 2 + (step + 1) * AMBUSH_STAIRS.rise / 24 });
  }
}
AMBUSH_FLOORS.push(...AMBUSH_TREADS);
export const AMBUSH_RAILS: (AmbushSurface & { height: number })[] = [
  ...Array.from({ length: AMBUSH_STOREYS + 1 }, (_, storey) => {
    const y = -storey * AMBUSH_STAIRS.rise;
    return [...[-9, 9].map(x => ({ x, z: 20.5, width: .18, depth: 17, y, height: 3.1 })),
      { x: 0, z: 12, width: 18, depth: .18, y, height: 3.1 }];
  }).flat(),
  { x: -3, z: 29, width: 12, depth: .18, y: 0, height: 3.1 },
  ...Array.from({ length: AMBUSH_STOREYS }, (_, storey) => {
    const y = -storey * AMBUSH_STAIRS.rise - AMBUSH_STAIRS.rise / 2;
    return [{ x: 0, z: 12, width: 18, depth: .18, y, height: 3.1 },
      { x: 0, z: 17, width: 6, depth: .18, y, height: 3.1 },
      ...[-9, 9].map(x => ({ x, z: 14.5, width: .18, depth: 5, y, height: 3.1 }))];
  }).flat(),
  ...AMBUSH_TREADS.flatMap(tread => [-1, 1].map(side => ({ x: tread.x + side * tread.width / 2, z: tread.z, width: .16, depth: tread.depth, y: tread.y, height: 3.1 }))),
];
export function ambushFloor(x: number, z: number, y: number): number | undefined {
  let floor: number | undefined;
  for (const surface of AMBUSH_FLOORS) if (Math.abs(x - surface.x) <= surface.width / 2 + .001 && Math.abs(z - surface.z) <= surface.depth / 2 + .001 && surface.y <= y + .8)
    floor = Math.max(floor ?? -Infinity, surface.y);
  return floor;
}
export function ambushStairsBlocked(x: number, z: number, y: number, radius: number): boolean {
  if (Math.abs(x) < 2.5 + radius && Math.abs(z - 23) < 5 + radius) return true;
  if (AMBUSH_FLOORS.some(surface => surface.y > y + .8 && surface.y < y + 3.96 && Math.abs(x - surface.x) < surface.width / 2 && Math.abs(z - surface.z) < surface.depth / 2)) return true;
  for (const [dx, dz] of [[radius, 0], [-radius, 0], [0, radius], [0, -radius]]) {
    const floor = ambushFloor(x + dx, z + dz, y);
    if (floor === undefined || floor < y - 4) return true;
  }
  return AMBUSH_RAILS.some(rail => y + 3.6 > rail.y && y < rail.y + rail.height && Math.abs(x - rail.x) < rail.width / 2 + radius && Math.abs(z - rail.z) < rail.depth / 2 + radius);
}
export const AMBUSH_WALLS: FilmObstacle[] = [
  { x: -13, z: 9, width: .6, depth: 42, height: 9 },
  { x: -13, z: -27, width: .6, depth: 14, height: 9 },
  { x: 13, z: -2, width: .6, depth: 60, height: 9 },
  { x: -8, z: -21, width: 10, depth: .6, height: 9 },
  { x: 8, z: -21, width: 10, depth: .6, height: 9 },
];
export const AMBUSH_SEALS: FilmObstacle[] = [
  { x: 0, z: -21, width: 6, depth: .65, height: 9 },
  { x: -21.55, z: -15, width: .65, depth: 9, height: 9 },
];

// Both appearances use the exact same path and gait, separated by a brief gap.
export function ambushCat(elapsed: number, stairs = false): { visible: boolean; x: number; y: number; z: number; phase: number; yaw: number } {
  if (stairs) {
    // Subtracting the repeat offset must not select a different gait at a boundary.
    const phase = Math.round((elapsed >= AMBUSH_CAT_STAIRS.repeat ? elapsed - AMBUSH_CAT_STAIRS.repeat : elapsed) * 1e8) / 1e8;
    const age = Math.max(0, phase - .3), landing = Math.min(1, age / 1.1), descent = Math.min(1, Math.max(0, age - 2.1) / 3.9);
    const x = 6.8 - landing * 1.3, z = 32.6 - landing - descent * 13.8;
    const y = ambushFloor(x, z, Math.min(0, (z - 29) * 3.7 / 12)) ?? 0;
    const turn = Math.min(1, Math.max(0, (age - .8) / .3));
    return { visible: phase >= .3 && phase < 6.3 && elapsed < 13.1, x, y, z, phase: age,
      yaw: (Math.PI - Math.atan2(1, 1.3)) * (1 - turn) + Math.PI / 2 * turn };
  }
  const phase = elapsed >= 4.5 ? elapsed - 4.5 : elapsed;
  const age = Math.max(0, phase - .3);
  const x = age < 1.1 ? -5 + age * 4.6 : .06 + Math.max(0, age - 2.1) * 4.6;
  return { visible: elapsed < 8.1 && phase >= .3 && phase < 3.6, x, y: 0, z: -23, phase: age, yaw: 0 };
}
