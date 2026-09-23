import type { DriveInput } from './freeway.js';

export const GARAGE = {
  start: { x: 0, z: 14 }, finish: -40, limit: 13.5,
  twins: [{ x: 0, z: -9 }, { x: 2.5, z: -23 }],
} as const;

export interface GarageEscape {
  x: number; z: number; speed: number; lateral: number; elapsed: number;
  hull: number; passenger: number; cooldown: number; hits: number;
  twins: number; ghostUntil: [number, number];
  phase: 'riding' | 'arrived' | 'wrecked';
}

export function newGarageEscape(): GarageEscape {
  return { ...GARAGE.start, speed: 0, lateral: 0, elapsed: 0, hull: 100, passenger: 100,
    cooldown: 0, hits: 0, twins: 0, ghostUntil: [0, 0], phase: 'riding' };
}

export function stepGarageEscape(escape: GarageEscape, input: DriveInput, delta: number): GarageEscape {
  if (escape.phase !== 'riding') return escape;
  const dt = Math.max(0, Math.min(.1, delta));
  const next: GarageEscape = { ...escape, ghostUntil: [...escape.ghostUntil], elapsed: escape.elapsed + dt, cooldown: Math.max(0, escape.cooldown - dt) };
  next.speed = Math.max(0, Math.min(35, escape.speed + (input.brake ? -38 : input.throttle > 0 ? 22 : -6) * dt));
  next.lateral += (Math.max(-1, Math.min(1, input.steer)) * Math.min(10, next.speed * .4) - next.lateral) * (1 - Math.exp(-7 * dt));
  next.x += next.lateral * dt; next.z -= next.speed * dt;
  const wall = next.x < -8 || next.x > 8;
  next.x = Math.max(-8, Math.min(8, next.x));
  if (wall && !next.cooldown) {
    next.hull = Math.max(0, next.hull - 22); next.passenger = Math.max(0, next.passenger - 7);
    next.speed *= .36; next.lateral *= -.4; next.hits++; next.cooldown = .9;
  }
  GARAGE.twins.forEach((twin, index) => {
    const bit = 1 << index;
    if (next.twins & bit || escape.z < twin.z || next.z > twin.z || Math.abs(next.x - twin.x) > 3.6) return;
    next.twins |= bit;
    if (next.speed >= 15) next.ghostUntil[index] = next.elapsed + .85;
    else {
      next.hull = Math.max(0, next.hull - 25); next.passenger = Math.max(0, next.passenger - 18);
      next.speed *= .3; next.hits++; next.cooldown = .8;
    }
  });
  if (next.hull <= 0 || next.passenger <= 0 || next.elapsed >= GARAGE.limit && next.z > GARAGE.finish) {
    next.phase = 'wrecked'; next.speed = 0; next.lateral = 0;
  } else if (next.z <= GARAGE.finish) {
    next.phase = 'arrived'; next.z = GARAGE.finish; next.speed = 0; next.lateral = 0;
  }
  return next;
}
