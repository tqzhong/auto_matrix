import type { Vector3 } from '../types/agent.js';

export const OPENING_HOTEL = {
  computer: { x: -8, z: 12 },
  phone: { x: -11, z: 18 },
  doorZ: 1,
  window: { x: 0, z: -23 },
  ladderZ: -30,
  ladderHeight: 7,
  landing: { offsetZ: -3.5, stepOffsetZ: -2.12, width: 5.4, depth: 4.3, thickness: .24 },
  climbSpeed: 2.4,
  breachSeconds: 1.5,
  diveSeconds: 1.6,
  magazine: 8,
  police: [[0, -1.5], [-5, -5], [5, -6], [0, -10]] as [number, number][],
  walls: [
    { x: -10.25, z: 1, width: 13.5, depth: .65, height: 12 },
    { x: 10.25, z: 1, width: 13.5, depth: .65, height: 12 },
    { x: -11, z: 12, width: 3, depth: 2.2, height: 2.9 },
  ],
} as const;

export interface OpeningHotelEncounter {
  phase: 'trace' | 'breach' | 'combat' | 'phone' | 'corridor' | 'dive' | 'ladder_ready' | 'climbing' | 'done' | 'failed';
  elapsed: number; lastTick: number; attempts: number;
  disarmed: boolean; ammo: number; shots: number; fallen?: Vector3;
  reloadAt?: number; climbed?: number;
}

export function openingHotelGlassBroken(hotel?: OpeningHotelEncounter): boolean {
  return hotel?.phase === 'dive' ? hotel.elapsed > .35 : hotel?.phase === 'ladder_ready' || hotel?.phase === 'climbing' || hotel?.phase === 'done';
}

export function openingHotelClimbed(hotel?: OpeningHotelEncounter): number | undefined {
  if (hotel?.phase === 'done') return OPENING_HOTEL.ladderHeight;
  if (hotel?.phase === 'ladder_ready' || hotel?.phase === 'climbing') return hotel.climbed ?? 0;
}

export function openingHotelClimbPose(climbed: number) {
  const { ladderHeight, ladderZ, landing } = OPENING_HOTEL;
  const pullUp = 4, stepOntoDeck = 5.8;
  const ease = (from: number, to: number) => {
    const t = Math.max(0, Math.min(1, (climbed - from) / (to - from)));
    return t * t * (3 - 2 * t);
  };
  // Raise the feet above the plate before advancing into its footprint.
  const lift = ease(pullUp, stepOntoDeck), transfer = ease(stepOntoDeck, ladderHeight);
  const rung = Math.min(stepOntoDeck, Math.max(0, climbed)) - .35;
  const deck = ladderHeight + landing.thickness + .24 * (1 - transfer);
  return { y: rung * (1 - lift) + deck * lift, z: ladderZ + landing.stepOffsetZ * transfer, transfer };
}
