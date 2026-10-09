import type { DriveInput } from './freeway.js';
import type { Vector3 } from '../types/agent.js';
import { APU_RIG } from './apu-rig.js';

export const APU_ROUTE = {
  entry: { x: -4.4, z: 12 },
  start: 12, finish: -50, limit: 32, halfWidth: 7.2,
  dives: [{ x: 0, z: -11 }, { x: -2.5, z: -17 }, { x: 2.5, z: -31 }, { x: 0, z: -43 }],
} as const;

export interface ApuRun {
  x: number; z: number; speed: number; lateral: number; hull: number;
  elapsed: number; hits: number; dives: number; phase: 'riding' | 'arrived' | 'wrecked';
  clearingCaptain?: boolean;
  gait?: { feet: [Vector3, Vector3]; foot: number; progress: number; first: boolean; from: Vector3; to: Vector3; settling?: boolean };
}

export function newApuRun(): ApuRun {
  return { x: 0, z: APU_ROUTE.start, speed: 0, lateral: 0, hull: 100,
    elapsed: 0, hits: 0, dives: 0, phase: 'riding', clearingCaptain: true };
}

export function stepApuRun(run: ApuRun, input: DriveInput, delta: number): ApuRun {
  if (run.phase !== 'riding') return run;
  const dt = Math.max(0, Math.min(.1, delta));
  const next = { ...run, elapsed: run.elapsed + dt };
  next.speed = run.z <= APU_ROUTE.finish ? 0 : Math.max(0, Math.min(5, run.speed + (input.brake ? -10 : input.throttle ? 5 : -4) * dt));
  next.lateral += (Math.max(-1, Math.min(1, input.steer)) * Math.min(2, next.speed * .4) - next.lateral) * (1 - Math.exp(-8 * dt));
  if (run.clearingCaptain) next.lateral = 0;
  if (next.speed === 0) next.lateral = 0;
  next.x = Math.max(-APU_ROUTE.halfWidth, Math.min(APU_ROUTE.halfWidth, next.x + next.lateral * dt));
  next.z = Math.max(APU_ROUTE.finish, next.z - next.speed * dt);
  next.gait = advanceFeet(run, next, dt);
  if (run.clearingCaptain && next.gait.feet.every(foot => foot.z + 1.15 < 4.5)) next.clearingCaptain = false;
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
  } else if (next.z <= APU_ROUTE.finish && next.gait.progress === 0) {
    next.phase = 'arrived'; next.z = APU_ROUTE.finish; next.speed = 0; next.lateral = 0;
  }
  return next;
}

/** Foot contacts live in the saved run, so stopping, steering and reconnecting never restart a walk cycle. */
function advanceFeet(run: ApuRun, next: ApuRun, dt: number): NonNullable<ApuRun['gait']> {
  const neutral = (side: number): Vector3 => ({ x: run.x + side * APU_RIG.footX, y: 0, z: run.z });
  const gait: NonNullable<ApuRun['gait']> = run.gait ? { ...run.gait, feet: run.gait.feet.map(foot => ({ ...foot })) as [Vector3, Vector3], from: { ...run.gait.from }, to: { ...run.gait.to } }
    : { feet: [neutral(-1), neutral(1)] as [Vector3, Vector3], foot: 0, progress: 0, first: true, from: neutral(-1), to: neutral(-1) };
  const dx = next.x - run.x, dz = next.z - run.z, distance = Math.hypot(dx, dz);
  const place = () => {
    const p = gait.progress, smooth = p * p * (3 - 2 * p);
    // Open the stance before the toes pass the fallen captain; his saved body stays in place.
    const sideProgress = run.clearingCaptain ? Math.min(1, p * 2) : p;
    const sideways = sideProgress * sideProgress * (3 - 2 * sideProgress);
    gait.feet[gait.foot] = { x: gait.from.x + (gait.to.x - gait.from.x) * sideways,
      y: gait.from.y * (1 - smooth) + (gait.settling ? 0 : .55 * Math.sin(Math.PI * p) ** 2), z: gait.from.z + (gait.to.z - gait.from.z) * smooth };
    if (p === 1) {
      gait.feet[gait.foot].y = 0; gait.foot = 1 - gait.foot; gait.progress = 0; gait.first = false; delete gait.settling;
      gait.from = { ...gait.feet[gait.foot] }; gait.to = { ...gait.from };
    }
  };
  if (distance < 1e-8) {
    if (dt > 0 && gait.progress > 0) {
      if (!gait.settling) {
        gait.from = { ...gait.feet[gait.foot] }; gait.to = neutral(gait.foot ? 1 : -1); gait.progress = 0; gait.settling = true;
        if (run.clearingCaptain) gait.to.x = (gait.foot ? 1 : -1) * 2.1;
      }
      gait.progress = Math.min(1, gait.progress + dt / .32); place();
    }
    return gait;
  }
  if (gait.settling) { gait.from = { ...gait.feet[gait.foot] }; gait.progress = 0; delete gait.settling; }
  let remaining = distance;
  while (remaining > 1e-8) {
    const stride = gait.first ? 1.1 : 2.2, advance = Math.min(remaining, (1 - gait.progress) * stride);
    remaining -= advance; gait.progress = Math.min(1, gait.progress + advance / stride);
    const fraction = (distance - remaining) / distance, ahead = (1 - gait.progress) * stride + 1.1;
    if (gait.progress < .85) {
      gait.to = { x: run.x + dx * fraction + dx / distance * ahead + (gait.foot ? 1 : -1) * APU_RIG.footX,
        y: 0, z: run.z + dz * fraction + dz / distance * ahead };
      if (run.clearingCaptain) gait.to.x = (gait.foot ? 1 : -1) * 2.1;
    }
    place();
  }
  return gait;
}
