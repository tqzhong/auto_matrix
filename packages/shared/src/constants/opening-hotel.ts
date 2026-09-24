import type { Vector3 } from '../types/agent.js';

export const OPENING_HOTEL = {
  computer: { x: -8, z: 12 },
  phone: { x: -11, z: 18 },
  doorZ: 1,
  window: { x: 0, z: -23 },
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
  phase: 'trace' | 'breach' | 'combat' | 'phone' | 'corridor' | 'dive' | 'done' | 'failed';
  elapsed: number; lastTick: number; attempts: number;
  disarmed: boolean; ammo: number; shots: number; fallen?: Vector3;
  reloadAt?: number;
}
