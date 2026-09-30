import { recoveryBodyPose } from './awakening.js';

export interface CabinEscort { progress: number }
export interface CabinGesture { kind: 'wake' | 'core'; elapsed: number; role: 'neo' | 'morpheus'; target?: { x: number; y: number; z: number } }
export const CABIN = {
  bed: { x: 12, z: -34, surface: 1.06 },
  morpheus: { x: 15.6, z: -30.5, yaw: -2.3 },
  chair: { x: 6.5, z: -5, yaw: -Math.PI / 2 },
  connector: { x: 8.7, z: -4.45, yaw: -Math.PI / 2 },
  approach: { x: 3.1, z: -5 },
  door: { x: 6, z: -29.5, width: 4.4 },
  locker: { x: 17.4, z: -38.4, width: .8, depth: 2.3, height: 4.1 },
} as const;
export const CABIN_WALLS = [
  { x: 12, z: -40, width: 12, depth: .3, height: 6.8 },
  { x: 12, z: -26, width: 12, depth: .3, height: 6.8 },
  { x: 18, z: -33, width: .3, depth: 14, height: 6.8 },
  { x: 6, z: -35.85, width: .3, depth: 8.3, height: 6.8 },
  { x: 6, z: -26.65, width: .3, depth: 1.3, height: 6.8 },
] as const;
export const CABIN_ROUTE = [CABIN.morpheus, { x: 15.6, z: -28.7 }, { x: 9, z: -28.7 },
  { x: 8.2, z: -29.5 }, { x: 3.8, z: -29.5 }, { x: 0, z: -24 }, { x: 0, z: -12 },
  { x: 9, z: -12 }, CABIN.connector] as const;
const lengths = CABIN_ROUTE.slice(1).map((point, i) => Math.hypot(point.x - CABIN_ROUTE[i].x, point.z - CABIN_ROUTE[i].z));
export const CABIN_ROUTE_LENGTH = lengths.reduce((sum, length) => sum + length, 0);
const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };

/** Reuse the verified bed-exit articulation, with a seated pause to feel the neck interface. */
export function cabinBodyPose(elapsed: number) {
  const clock = elapsed < 1 ? 0 : Math.min(10.5, 6 + elapsed) + Math.max(0, elapsed - 9.5) * 1.2 / 1.7;
  const body = recoveryBodyPose(clock);
  return { ...body, clock, y: body.y + .08 * Math.sin(Math.PI * body.sit), x: CABIN.bed.x + body.x + 7, z: CABIN.bed.z,
    inspect: smooth((elapsed - 4.8) / .8) * (1 - smooth((elapsed - 8) / .8)) };
}

export function cabinGuidePose(progress: number) {
  let remaining = Math.max(0, Math.min(CABIN_ROUTE_LENGTH, progress));
  for (let i = 0; i < lengths.length; i++) {
    if (remaining > lengths[i] && i < lengths.length - 1) { remaining -= lengths[i]; continue; }
    const a = CABIN_ROUTE[i], b = CABIN_ROUTE[i + 1], t = Math.min(1, remaining / lengths[i]);
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t,
      yaw: progress >= CABIN_ROUTE_LENGTH ? CABIN.connector.yaw : Math.atan2(b.x - a.x, b.z - a.z) };
  }
  return { ...CABIN.connector };
}

export function cabinPlugProgress(elapsed: number): number { return smooth((elapsed - 3) / 1.6); }
export function cabinSeat(elapsed: number): number { return smooth((elapsed - .9) / 1.2); }

export const MEDICAL_OPERATOR = { x: -10.4, z: -19.55, yaw: Math.PI,
  control: { x: -10.1, y: 2.45, z: -20.55 } } as const;

export function medicalControlBlend(elapsed: number): number {
  return smooth(elapsed / .7) * (1 - smooth((elapsed - 6.5) / .8));
}
