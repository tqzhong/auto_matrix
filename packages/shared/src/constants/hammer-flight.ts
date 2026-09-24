import type { DriveInput } from './freeway.js';

export const HAMMER_ROUTE = {
  start: 175, finish: -175, limit: 29, shipRadius: 4.4,
  debris: [
    { x: 7.7, z: 102, radius: 1.5 },
    { x: -16.5, z: -38, radius: 1.5 },
    { x: 16, z: -116, radius: 1.7 },
  ],
} as const;

export interface HammerFlight {
  x: number; z: number; speed: number; lateral: number; elapsed: number;
  hull: number; pursuit: number; cooldown: number; hits: number; debris: number;
  antennaLost: boolean; phase: 'riding' | 'arrived' | 'wrecked';
}

const bends = [
  { z: 175, x: 0 }, { z: 105, x: 0 }, { z: 42, x: -10 },
  { z: -18, x: -10 }, { z: -91, x: 9 }, { z: -145, x: 9 }, { z: -175, x: 4 },
];

export function hammerCenter(z: number): number {
  for (let i = 1; i < bends.length; i++) {
    if (z > bends[i].z) {
      const t = Math.max(0, Math.min(1, (bends[i - 1].z - z) / (bends[i - 1].z - bends[i].z)));
      const smooth = t * t * (3 - 2 * t);
      return bends[i - 1].x + (bends[i].x - bends[i - 1].x) * smooth;
    }
  }
  return bends[bends.length - 1].x;
}

export function hammerHalfWidth(z: number): number {
  return z < 70 && z > 18 || z < -75 && z > -135 ? 9.8 : 13.2;
}

export function hammerHeight(z: number): number {
  return 10 + Math.sin((175 - z) / 52) * 1.7;
}

export function newHammerFlight(): HammerFlight {
  return { x: 0, z: HAMMER_ROUTE.start, speed: 0, lateral: 0, elapsed: 0,
    hull: 100, pursuit: 0, cooldown: 0, hits: 0, debris: 0, antennaLost: false, phase: 'riding' };
}

export function stepHammerFlight(flight: HammerFlight, input: DriveInput, delta: number): HammerFlight {
  if (flight.phase !== 'riding') return flight;
  const dt = Math.max(0, Math.min(.1, delta));
  const next = { ...flight, elapsed: flight.elapsed + dt, cooldown: Math.max(0, flight.cooldown - dt) };
  next.speed = Math.max(0, Math.min(38, flight.speed + (input.brake ? -32 : input.throttle > 0 ? 19 : -7) * dt));
  const steer = Math.max(-1, Math.min(1, input.steer));
  next.lateral += (steer * Math.min(13, next.speed * .48) - next.lateral) * (1 - Math.exp(-6 * dt));
  next.x += next.lateral * dt; next.z -= next.speed * dt;
  const center = hammerCenter(next.z);
  const clearance = hammerHalfWidth(next.z) - HAMMER_ROUTE.shipRadius;
  const wall = Math.abs(next.x - center) > clearance;
  next.x = Math.max(center - clearance, Math.min(center + clearance, next.x));
  let struck = wall && next.speed > 1;
  HAMMER_ROUTE.debris.forEach((pipe, index) => {
    const bit = 1 << index;
    if (next.debris & bit || flight.z < pipe.z - 3 || next.z > pipe.z + 3) return;
    if (Math.abs(next.x - pipe.x) < HAMMER_ROUTE.shipRadius + pipe.radius) { next.debris |= bit; struck = true; }
  });
  if (struck && !next.cooldown) {
    next.hull = Math.max(0, next.hull - 26); next.speed *= .54;
    next.lateral *= -.25; next.hits++; next.cooldown = .75;
  }
  next.pursuit = Math.max(0, Math.min(100, next.pursuit + (next.speed < 18 ? 2.6 + (18 - next.speed) * .075 : -5.5) * dt));
  if (next.pursuit >= 70 && flight.pursuit < 70) next.hull = Math.max(0, next.hull - 12);
  if (next.z <= 25) next.antennaLost = true;
  if (next.hull <= 0 || next.pursuit >= 100 || next.elapsed >= HAMMER_ROUTE.limit && next.z > HAMMER_ROUTE.finish) {
    next.phase = 'wrecked'; next.speed = 0; next.lateral = 0;
  } else if (next.z <= HAMMER_ROUTE.finish) {
    next.phase = 'arrived'; next.z = HAMMER_ROUTE.finish; next.speed = 0; next.lateral = 0;
  }
  return next;
}
