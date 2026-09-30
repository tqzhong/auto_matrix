import type { FilmObstacle } from './film-sets.js';

export interface AmbushEncounter { elapsed: number }
export const AMBUSH_REWRITE = 8.3;
export const AMBUSH_SECONDS = 9.5;
// Two playable flights around a caged lift. The corridor stays at its old height
// so cat, wet-wall and bathroom checkpoints keep their coordinates.
export const AMBUSH_STAIRS = { rise: 7.4, steps: 12, left: -5.5, right: 5.5, entry: { x: -5.5, z: 32 } } as const;
export interface AmbushSurface { x: number; z: number; width: number; depth: number; y: number }
export const AMBUSH_FLOORS: AmbushSurface[] = [
  { x: 0, z: -11, width: 44, depth: 46, y: 0 },
  ...[-15.5, 15.5].map(x => ({ x, z: 20.5, width: 13, depth: 17, y: 0 })),
  { x: 0, z: 31.5, width: 44, depth: 5, y: 0 },
  { x: 0, z: 23, width: 18, depth: 22, y: -AMBUSH_STAIRS.rise },
  { x: 0, z: 14.5, width: 18, depth: 5, y: -AMBUSH_STAIRS.rise / 2 },
];
export const AMBUSH_TREADS: AmbushSurface[] = [];
for (let step = 0; step < AMBUSH_STAIRS.steps; step++) {
  AMBUSH_TREADS.push({ x: AMBUSH_STAIRS.left, z: 28.5 - step, width: 5, depth: 1, y: -AMBUSH_STAIRS.rise + (step + 1) * AMBUSH_STAIRS.rise / 24 },
    { x: AMBUSH_STAIRS.right, z: 17.5 + step, width: 5, depth: 1, y: -AMBUSH_STAIRS.rise / 2 + (step + 1) * AMBUSH_STAIRS.rise / 24 });
}
AMBUSH_FLOORS.push(...AMBUSH_TREADS);
export const AMBUSH_RAILS: (AmbushSurface & { height: number })[] = [
  ...[-9, 9].map(x => ({ x, z: 20.5, width: .18, depth: 17, y: 0, height: 3.1 })),
  { x: 0, z: 12, width: 18, depth: .18, y: 0, height: 3.1 },
  { x: -3, z: 29, width: 12, depth: .18, y: 0, height: 3.1 },
  { x: 0, z: 12, width: 18, depth: .18, y: -3.7, height: 3.1 },
  { x: 0, z: 17, width: 6, depth: .18, y: -3.7, height: 3.1 },
  ...[-9, 9].flatMap(x => [{ x, z: 14.5, width: .18, depth: 5, y: -3.7, height: 3.1 },
    { x, z: 31.5, width: .18, depth: 5, y: -7.4, height: 3.1 }]),
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
export function ambushCat(elapsed: number): { visible: boolean; x: number; z: number; phase: number } {
  const phase = elapsed >= 4.5 ? elapsed - 4.5 : elapsed;
  const age = Math.max(0, phase - .3);
  const x = age < 1.1 ? -5 + age * 4.6 : .06 + Math.max(0, age - 2.1) * 4.6;
  return { visible: elapsed < 8.1 && phase >= .3 && phase < 3.6, x, z: -23, phase: age };
}
