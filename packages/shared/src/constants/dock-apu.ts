import type { DriveInput } from './freeway.js';

export const APU_ROUTE = {
  start: 12, finish: -50, limit: 18, halfWidth: 7.2,
  dives: [{ x: 0, z: -3 }, { x: -2.5, z: -17 }, { x: 2.5, z: -31 }, { x: 0, z: -43 }],
} as const;

export interface ApuRun {
  x: number; z: number; speed: number; lateral: number; hull: number;
  elapsed: number; hits: number; dives: number; phase: 'riding' | 'arrived' | 'wrecked';
}

export function newApuRun(): ApuRun {
  return { x: 0, z: APU_ROUTE.start, speed: 0, lateral: 0, hull: 100,
    elapsed: 0, hits: 0, dives: 0, phase: 'riding' };
}

export function stepApuRun(run: ApuRun, input: DriveInput, delta: number): ApuRun {
  if (run.phase !== 'riding') return run;
  const dt = Math.max(0, Math.min(.1, delta));
  const next = { ...run, elapsed: run.elapsed + dt };
  next.speed = Math.max(0, Math.min(12, run.speed + (input.brake ? -18 : input.throttle ? 8 : -4) * dt));
  next.lateral += (Math.max(-1, Math.min(1, input.steer)) * Math.min(5.5, next.speed * .75) - next.lateral) * (1 - Math.exp(-8 * dt));
  next.x = Math.max(-APU_ROUTE.halfWidth, Math.min(APU_ROUTE.halfWidth, next.x + next.lateral * dt));
  next.z -= next.speed * dt;
  APU_ROUTE.dives.forEach((dive, index) => {
    const bit = 1 << index;
    if (next.dives & bit || run.z < dive.z - 2 || next.z > dive.z + 2) return;
    next.dives |= bit;
    if (Math.abs(next.x - dive.x) < 3.8) {
      next.hull = Math.max(0, next.hull - 30); next.speed *= .58; next.hits++;
    }
  });
  if (next.hull <= 0 || next.elapsed >= APU_ROUTE.limit && next.z > APU_ROUTE.finish) {
    next.phase = 'wrecked'; next.speed = 0; next.lateral = 0;
  } else if (next.z <= APU_ROUTE.finish) {
    next.phase = 'arrived'; next.z = APU_ROUTE.finish; next.speed = 0; next.lateral = 0;
  }
  return next;
}
