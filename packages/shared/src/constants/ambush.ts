import type { FilmObstacle } from './film-sets.js';

export interface AmbushEncounter { elapsed: number }
export const AMBUSH_REWRITE = 8.3;
export const AMBUSH_SECONDS = 9.5;
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
