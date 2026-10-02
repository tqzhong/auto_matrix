import type { Vector3 } from '../types/agent.js';
import type { OfficeCustody, OfficeCustodyRole } from './office-custody.js';
import { metacortexPosition } from './metacortex.js';

export const ARREST_CAR = { x: 13, z: 49, yaw: -Math.PI / 2, width: 5.8, depth: 14, roof: 4.1,
  approach: { x: -5.8, z: 1.7 }, catcher: { x: -6.45, z: -.1 },
  driver: { x: -6.6, z: -2.15 }, front: { x: 6.6, z: -2.15 }, rear: { x: 6.6, z: 1.7 },
  seats: { neo: { x: -1.3, z: 1.7 }, driver: { x: -1.3, z: -1.6 }, front: { x: 1.3, z: -1.6 }, rear: { x: 1.3, z: 1.7 } },
} as const;
export const ARREST_BIKE = { x: -5, z: 39, yaw: 0, handleZ: -.95, mirror: { x: 1.65, y: 3.6, z: -1.6 }, view: { x: 2.6, y: 3.9, z: -.25 } } as const;
export interface OfficeArrest {
  phase: 'approaching' | 'opening' | 'ready' | 'entering' | 'rear_approach' | 'rear_entering' | 'closing' | 'done';
  elapsed: number;
  from?: Record<string, { position: Vector3; yaw: number }>;
  observed?: boolean;
}
export const ARREST_TIMING = { opening: 1.4, entering: 7, rear_entering: 6, closing: 1.4 } as const;
const ease = (time: number, from: number, to: number) => { const t = Math.max(0, Math.min(1, (time - from) / (to - from))); return t * t * (3 - 2 * t); };
export function arrestCarPoint(x: number, z: number): Vector3 {
  return metacortexPosition(ARREST_CAR.x + Math.cos(ARREST_CAR.yaw) * x + Math.sin(ARREST_CAR.yaw) * z,
    ARREST_CAR.z - Math.sin(ARREST_CAR.yaw) * x + Math.cos(ARREST_CAR.yaw) * z);
}
export function arrestBikePoint(x = 0, z = 0): Vector3 {
  return metacortexPosition(ARREST_BIKE.x + Math.cos(ARREST_BIKE.yaw) * x + Math.sin(ARREST_BIKE.yaw) * z,
    ARREST_BIKE.z - Math.sin(ARREST_BIKE.yaw) * x + Math.cos(ARREST_BIKE.yaw) * z);
}
export const ARREST_OBSTACLE = { x: ARREST_CAR.x, z: ARREST_CAR.z, width: ARREST_CAR.depth, depth: ARREST_CAR.width, height: ARREST_CAR.roof };
export function arrestSeat(custody: OfficeCustody, role: 'neo' | OfficeCustodyRole) {
  return ARREST_CAR.seats[role === 'neo' ? 'neo' : role === custody.leader ? 'driver' : role === custody.catcher ? 'rear' : 'front'];
}
/** The same saved entry motion drives the actor roots, skin and camera. */
export function arrestPose(custody: OfficeCustody, role: 'neo' | OfficeCustodyRole) {
  const street = custody.street;
  if (!street || ['approaching', 'opening', 'ready'].includes(street.phase) || role === custody.catcher && ['entering', 'rear_approach'].includes(street.phase)) return;
  const entering = street.phase === 'entering' && role !== custody.catcher || street.phase === 'rear_entering' && role === custody.catcher;
  const age = entering ? street.elapsed : 7;
  const from = street.from![role], slot = arrestSeat(custody, role), target = arrestCarPoint(slot.x, slot.z);
  const moving = ease(age, 1.4, 4.6), seated = ease(age, 3.1, 6), duck = ease(age, .1, 1.2) * (1 - ease(age, 4.6, 6));
  const yaw = ARREST_CAR.yaw + Math.PI;
  const arc = slot.z < 0 ? 0 : Math.sin(moving * Math.PI) * .95;
  return { position: { x: from.position.x + (target.x - from.position.x) * moving + Math.sin(ARREST_CAR.yaw) * arc, y: 1,
    z: from.position.z + (target.z - from.position.z) * moving + Math.cos(ARREST_CAR.yaw) * arc },
    yaw: from.yaw + Math.atan2(Math.sin(yaw - from.yaw), Math.cos(yaw - from.yaw)) * ease(age, 0, 1.3), seated, duck };
}
export function arrestDoor(street: OfficeArrest | undefined, side: number, rear: boolean): number {
  if (!street) return 0;
  if (street.phase === 'opening') return side < 0 || !rear ? ease(street.elapsed, .1, ARREST_TIMING.opening) : 0;
  if (street.phase === 'ready') return side < 0 || !rear ? 1 : 0;
  if (street.phase === 'entering') return side < 0 || !rear ? 1 - ease(street.elapsed, 6, ARREST_TIMING.entering) : 0;
  if (street.phase === 'rear_entering') return rear && side > 0 ? ease(street.elapsed, .1, 1.2) : 0;
  if (street.phase === 'closing') return rear && side > 0 ? 1 - ease(street.elapsed, 0, ARREST_TIMING.closing) : 0;
  return 0;
}
export function arrestMirrorShot(street?: OfficeArrest): boolean {
  return Boolean(street?.phase === 'entering' && street.elapsed >= 2.5 && street.elapsed <= 5.2);
}
