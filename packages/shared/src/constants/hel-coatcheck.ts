import { FILM_SETS, filmObstacles } from './film-sets.js';
import { rayBox } from './lobby.js';
import type { Vector3 } from '../types/agent.js';

export const HEL_COATCHECK = {
  magazine: 12, damage: 24, reloadTicks: 4, fireInterval: .28,
  waves: [[[-12, 5], [0, 8], [12, 5]], [[-7, 2], [7, 2]]],
  allies: { morpheus: { x: -5, z: 18 }, seraph: { x: 5, z: 18 } },
} as const;

export interface HelCoatcheckEncounter {
  phase: 'ready' | 'combat' | 'cleared';
  ammo: number; reloadAt?: number; wave: number; nextWaveAt?: number;
  shots: number; kills: number; allyShotAt: number[]; coverHits: number[];
}

/** Coat counters are both solid room furniture and ballistic cover. */
export function helCoatcheckCover(from: Vector3, direction: Vector3, range = 85): { distance: number; counter?: number } {
  const center = FILM_SETS.film_club_hel.center;
  const point = { x: from.x - center.x, y: from.y - center.y + 1, z: from.z - center.z };
  let result: { distance: number; counter?: number } = { distance: range };
  filmObstacles(FILM_SETS.film_club_hel).filter(obstacle => obstacle.z > 0).forEach((counter, index) => {
    const hit = rayBox(point, direction,
      { x: counter.x - counter.width / 2, y: 0, z: counter.z - counter.depth / 2 },
      { x: counter.x + counter.width / 2, y: counter.height, z: counter.z + counter.depth / 2 });
    if (hit !== undefined && hit < result.distance) result = { distance: hit, counter: index };
  });
  return result;
}
