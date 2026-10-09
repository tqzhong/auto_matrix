import { FILM_SETS, filmObstacles } from './film-sets.js';
import { rayBox } from './lobby.js';
import { HEL_COAT_COUNTERS } from './hel-room.js';
import type { Vector3 } from '../types/agent.js';

export const HEL_COATCHECK = {
  magazine: 12, damage: 24, reloadTicks: 4, fireInterval: .28,
  waves: [[[-12, 5], [0, 8], [12, 5]], [[-7, 2], [7, 2]]],
  allies: { morpheus: { x: -5, z: 18 }, seraph: { x: 5, z: 18 } },
  rescueSeconds: 4.2, approachSeconds: 1.6, lowerSeconds: 3.1,
} as const;

export interface HelCoatcheckEncounter {
  phase: 'ready' | 'combat' | 'cleared';
  ammo: number; reloadAt?: number; wave: number; nextWaveAt?: number;
  shots: number; kills: number; allyShotAt: number[]; coverHits: number[];
  rescueElapsed?: number; rescueLastTick?: number;
  rescuePhysical?: boolean; rescuePaused?: boolean;
  rescueStart?: { x: number; z: number; yaw: number };
  morpheusStart?: { x: number; z: number; yaw: number };
}

const smooth = (value: number, from: number, to: number): number => {
  const t = Math.max(0, Math.min(1, (value - from) / (to - from))); return t * t * (3 - 2 * t);
};

export function helAttendantPose(state?: HelCoatcheckEncounter): { x: number; z: number; yaw: number; crouch: number } {
  if (!state?.rescuePhysical) {
    const progress = Math.min(1, (state?.rescueElapsed ?? (state?.phase === 'ready' || !state ? 0 : 2)) / 2), around = Math.min(1, progress * 2);
    return { x: progress < .5 ? 8.5 + around * .5 : 9 + (progress - .5) * 10,
      z: progress < .5 ? 15 - around * 7 : 8, yaw: Math.PI + progress * .7, crouch: progress };
  }
  const t = state.rescueElapsed ?? 0, moving = smooth(t, HEL_COATCHECK.approachSeconds, 2.65);
  return { x: 8.5 + 5.1 * moving, z: 15 + .2 * moving, yaw: Math.PI,
    crouch: smooth(t, 2.25, HEL_COATCHECK.lowerSeconds) };
}

export function helCoatcheckAllyRoot(state: HelCoatcheckEncounter, role: 'morpheus' | 'seraph'): { x: number; z: number; yaw: number } {
  const end = HEL_COATCHECK.allies[role], start = role === 'seraph' ? state.rescueStart : state.morpheusStart;
  if (!state.rescuePhysical || !start) return { ...end, yaw: Math.PI };
  const t = state.rescueElapsed ?? 0;
  if (role === 'morpheus') {
    const progress = smooth(t, 0, HEL_COATCHECK.approachSeconds);
    return { x: start.x + (end.x - start.x) * progress, z: start.z + (end.z - start.z) * progress, yaw: Math.PI };
  }
  const girl = helAttendantPose(state), approach = smooth(t, 0, HEL_COATCHECK.approachSeconds), release = smooth(t, 3.25, HEL_COATCHECK.rescueSeconds);
  const x = start.x + (girl.x - 1.25 - start.x) * approach, z = start.z + (girl.z + .55 - start.z) * approach;
  return { x: x + (end.x - x) * release, z: z + (end.z - z) * release,
    yaw: start.yaw + Math.atan2(Math.sin(Math.PI / 2 - start.yaw), Math.cos(Math.PI / 2 - start.yaw)) * approach + Math.PI / 2 * release };
}

/** Coat counters are both solid room furniture and ballistic cover. */
export function helCoatcheckCover(from: Vector3, direction: Vector3, range = 85): { distance: number; counter?: number } {
  const center = FILM_SETS.film_club_hel.center;
  const point = { x: from.x - center.x, y: from.y - center.y + 1, z: from.z - center.z };
  let result: { distance: number; counter?: number } = { distance: range };
  filmObstacles(FILM_SETS.film_club_hel).filter(obstacle => obstacle.z > 0).forEach(counter => {
    const hit = rayBox(point, direction,
      { x: counter.x - counter.width / 2, y: 0, z: counter.z - counter.depth / 2 },
      { x: counter.x + counter.width / 2, y: counter.height, z: counter.z + counter.depth / 2 });
    if (hit !== undefined && hit < result.distance) {
      const counterIndex = HEL_COAT_COUNTERS.findIndex(item => item.x === counter.x && item.z === counter.z);
      result = { distance: hit, counter: counterIndex < 0 ? undefined : counterIndex };
    }
  });
  return result;
}
