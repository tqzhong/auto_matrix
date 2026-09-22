import type { FilmJourney } from './film-story.js';

export interface PillEncounter {
  phase: 'offering' | 'choice' | 'taking' | 'done';
  elapsed: number;
  choice?: 'red' | 'blue';
  approach: { x: number; z: number; yaw: number };
}
export type PillGesture = Pick<PillEncounter, 'phase' | 'elapsed' | 'choice'> & { role: 'neo' | 'morpheus' };
export const PILL_ROOM = { seat: 1.75, z: -6, tableZ: -8.4, tableY: 1.65, cup: { x: 1.1, y: 2.03, z: -7.65 } } as const;
export const PILL_TIMING = { offer: 5, take: 13, transfer: 1.8, swallow: 3.65, liftCup: 5.3, replaceCup: 8.6 } as const;
export const pillEase = (time: number, from: number, to: number): number => {
  const t = Math.max(0, Math.min(1, (time - from) / (to - from))); return t * t * (3 - 2 * t);
};

export function pillLocked(journey: FilmJourney): boolean {
  return journey.scene === 'm1_pills' && !journey.visiting && !!journey.pills && journey.pills.phase !== 'done';
}

// One timeline drives bodies, hand props, the table glass and the saved outcome.
export function pillPose(gesture: PillGesture) {
  const t = gesture.elapsed; const taking = gesture.phase === 'taking'; const done = gesture.phase === 'done';
  const rise = done ? 1 : taking ? pillEase(t, 9.6, 11) : 0;
  const seat = gesture.role === 'morpheus' ? 1 : gesture.phase === 'offering' ? pillEase(t, .3, 1.8) : 1 - rise;
  const offer = gesture.phase === 'offering' ? pillEase(t, 2, 3.6) : done ? 0 : taking ? 1 - pillEase(t, 2.2, 3.5) : 1;
  const reach = taking ? pillEase(t, .35, PILL_TIMING.transfer) * (1 - pillEase(t, 2.15, 3.45)) : 0;
  const mouth = taking ? pillEase(t, 2.15, 3.45) * (1 - pillEase(t, 3.85, 4.35)) : 0;
  const cupReach = taking ? pillEase(t, 4.1, PILL_TIMING.liftCup) * (1 - pillEase(t, PILL_TIMING.replaceCup, 9.2)) : 0;
  const drink = taking ? pillEase(t, 5.55, 6.6) * (1 - pillEase(t, 7.7, 8.6)) : 0;
  const tilt = taking ? pillEase(t, 6.6, 7.15) * (1 - pillEase(t, 7.7, 8.35)) : 0;
  return { seat, offer, reach, mouth, cupReach, drink, tilt, rise,
    lean: gesture.role === 'morpheus' ? offer * .12 : reach * .68 + cupReach * (1 - drink) * .24 + Math.sin(rise * Math.PI) * .42,
    holdingPill: taking && t >= PILL_TIMING.transfer && t < PILL_TIMING.swallow,
    holdingCup: taking && t >= PILL_TIMING.liftCup && t < PILL_TIMING.replaceCup,
    cupUsed: done || taking && t >= PILL_TIMING.replaceCup,
  };
}

export function pillRoot(encounter: PillEncounter): { x: number; z: number; yaw: number } {
  const { seat, z } = PILL_ROOM;
  if (encounter.phase === 'offering') {
    const t = pillEase(encounter.elapsed, 0, 1.8);
    const turn = Math.atan2(Math.sin(-Math.PI / 2 - encounter.approach.yaw), Math.cos(-Math.PI / 2 - encounter.approach.yaw));
    return { x: encounter.approach.x + (seat - encounter.approach.x) * t, z: encounter.approach.z + (z - encounter.approach.z) * t, yaw: encounter.approach.yaw + turn * t };
  }
  const rise = encounter.phase === 'done' ? 1 : encounter.phase === 'taking' ? pillEase(encounter.elapsed, 9.6, 11) : 0;
  const exit = encounter.phase === 'done' ? 1 : encounter.phase === 'taking' ? pillEase(encounter.elapsed, 11, 13) : 0;
  return { x: seat * (1 - rise), z: z + 2.7 * exit, yaw: -Math.PI / 2 + Math.PI / 2 * pillEase(rise, .5, 1) };
}

export function pillContact(color: 'red' | 'blue') {
  return { x: -.35, y: 2.35, z: PILL_ROOM.z + (color === 'red' ? .54 : -.54) };
}
