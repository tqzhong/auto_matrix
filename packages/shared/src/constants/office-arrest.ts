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
  phase: 'approaching' | 'opening' | 'ready' | 'entering' | 'rear_approach' | 'rear_entering' | 'closing' | 'done' | 'departing' | 'departed';
  elapsed: number;
  from?: Record<string, { position: Vector3; yaw: number }>;
  observed?: boolean;
  blocked?: boolean;
}
export const ARREST_TIMING = { opening: 1.4, entering: 7, rear_entering: 6, closing: 1.4 } as const;
export const ARREST_DRIVE_SECONDS = 5 + Math.PI * 10 / 7 + 6;
export const ARREST_WHEEL = { x: -1.3, y: 2.74, z: -2.52, radius: .49, tilt: -.3 } as const;
const ease = (time: number, from: number, to: number) => { const t = Math.max(0, Math.min(1, (time - from) / (to - from))); return t * t * (3 - 2 * t); };
/** A short game bridge: the screenplay cuts directly from the parked sedan to interrogation. */
export function arrestCarPose(street?: OfficeArrest) {
  if (!street || !['departing', 'departed'].includes(street.phase)) return { x: ARREST_CAR.x as number, z: ARREST_CAR.z as number, yaw: ARREST_CAR.yaw, distance: 0, speed: 0, steering: 0, fade: 0 };
  const age = Math.min(ARREST_DRIVE_SECONDS, street.phase === 'departed' ? ARREST_DRIVE_SECONDS : street.elapsed), turnEnd = ARREST_DRIVE_SECONDS - 6;
  let x: number, z: number, yaw: number, distance: number, speed: number;
  if (age < 5) {
    const t = age / 5; distance = -11 * t ** 3 + 34 * t ** 2; speed = (-33 * t * t + 68 * t) / 5;
    x = ARREST_CAR.x + distance; z = ARREST_CAR.z; yaw = ARREST_CAR.yaw;
  } else if (age < turnEnd) {
    const angle = -Math.PI / 2 + (age - 5) * 7 / 20;
    x = 36 + 20 * Math.cos(angle); z = 69 + 20 * Math.sin(angle); yaw = -angle - Math.PI;
    distance = 23 + (age - 5) * 7; speed = 7;
  } else {
    const t = (age - turnEnd) / 6, travel = -22 * t ** 3 + 12 * t * t + 42 * t;
    x = 56; z = 69 + travel; yaw = -Math.PI; distance = 23 + Math.PI * 10 + travel;
    speed = (-66 * t * t + 24 * t + 42) / 6;
  }
  return { x, z, yaw, distance, speed: street.blocked ? 0 : speed,
    steering: -Math.atan(9.7 / 20) * ease(age, 4.6, 5.1) * (1 - ease(age, turnEnd - .2, turnEnd + .4)),
    fade: ease(age, ARREST_DRIVE_SECONDS - .6, ARREST_DRIVE_SECONDS) };
}
export function arrestCarPoint(x: number, z: number, street?: OfficeArrest): Vector3 {
  const car = arrestCarPose(street);
  return metacortexPosition(car.x + Math.cos(car.yaw) * x + Math.sin(car.yaw) * z,
    car.z - Math.sin(car.yaw) * x + Math.cos(car.yaw) * z);
}
export function arrestCarBounds(street?: OfficeArrest) {
  const car = arrestCarPose(street), c = Math.abs(Math.cos(car.yaw)), s = Math.abs(Math.sin(car.yaw));
  return { position: arrestCarPoint(0, 0, street), width: c * (ARREST_CAR.width + .7) + s * (ARREST_CAR.depth + .2),
    depth: s * (ARREST_CAR.width + .7) + c * (ARREST_CAR.depth + .2), height: ARREST_CAR.roof };
}
export function arrestWheelPoint(street: OfficeArrest | undefined, side: 'R' | 'L'): Vector3 {
  const angle = (side === 'R' ? Math.PI / 6 : Math.PI * 5 / 6) + arrestCarPose(street).steering;
  const height = ARREST_WHEEL.radius * Math.sin(angle);
  // Place the palm outside the rubber tube, leaving room for the shipped fingers.
  return { ...arrestCarPoint(ARREST_WHEEL.x + ARREST_WHEEL.radius * Math.cos(angle), ARREST_WHEEL.z + height * Math.sin(ARREST_WHEEL.tilt) + .18 * Math.cos(ARREST_WHEEL.tilt), street),
    y: ARREST_WHEEL.y + height * Math.cos(ARREST_WHEEL.tilt) - .18 * Math.sin(ARREST_WHEEL.tilt) };
}
export function arrestBikePoint(x = 0, z = 0): Vector3 {
  return metacortexPosition(ARREST_BIKE.x + Math.cos(ARREST_BIKE.yaw) * x + Math.sin(ARREST_BIKE.yaw) * z,
    ARREST_BIKE.z - Math.sin(ARREST_BIKE.yaw) * x + Math.cos(ARREST_BIKE.yaw) * z);
}
export const ARREST_OBSTACLE = { x: ARREST_CAR.x, z: ARREST_CAR.z, width: ARREST_CAR.depth + .2, depth: ARREST_CAR.width + .7, height: ARREST_CAR.roof };
export function arrestSeat(custody: OfficeCustody, role: 'neo' | OfficeCustodyRole) {
  return ARREST_CAR.seats[role === 'neo' ? 'neo' : role === custody.leader ? 'driver' : role === custody.catcher ? 'rear' : 'front'];
}
/** The same saved entry motion drives the actor roots, skin and camera. */
export function arrestPose(custody: OfficeCustody, role: 'neo' | OfficeCustodyRole) {
  const street = custody.street;
  if (!street || ['approaching', 'opening', 'ready'].includes(street.phase) || role === custody.catcher && ['entering', 'rear_approach'].includes(street.phase)) return;
  if (street.phase === 'departing' || street.phase === 'departed') {
    const slot = arrestSeat(custody, role);
    return { position: arrestCarPoint(slot.x, slot.z, street), yaw: arrestCarPose(street).yaw + Math.PI, seated: 1, duck: 0 };
  }
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
