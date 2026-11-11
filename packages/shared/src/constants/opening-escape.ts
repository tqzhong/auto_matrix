import type { Vector3 } from '../types/agent.js';
import type { WellsAftermath } from './wells-aftermath.js';
import type { OpeningPursuitCast } from './opening-hotel.js';

export const OPENING_ESCAPE = {
  roofGapNear: -2,
  roofGapFar: -5.8,
  roofDrop: 38,
  pursuerSpeed: 6.4,
  pursuerLeapSeconds: 1.1,
  pursuerLeapHeight: 3.2,
  phoneSeconds: 15,
  truckImpactSeconds: 1.35,
} as const;

export const OPENING_PHONE = {
  boothZ: -30.08,
  stand: { x: -.55, z: -28.85 },
  receiver: { x: -.75, y: 4, z: -29.53 },
  radius: .65,
  alignSeconds: .35,
  graspSeconds: .75,
  liftSeconds: 1.45,
  answerSeconds: 1.6,
  hitSeconds: 1.35,
  hitAirSeconds: .8,
  hitSpeed: 8,
} as const;

export interface OpeningPhoneAnswer {
  elapsed: number; origin: Vector3; yaw: number;
}

export interface OpeningPhoneHit {
  elapsed: number; at: number; origin: Vector3; yaw: number; direction: { x: number; z: number }; landingY?: number;
}

/** A failed caller stays at the receiver until the moving truck reaches the body. */
export function openingPhoneContact(phone: OpeningPhoneEncounter): OpeningPhoneHit | undefined {
  if (phone.phase !== 'failed' || !phone.answer || phone.impactElapsed === undefined) return;
  const root = openingAnswerPose(phone.answer);
  const contact = (elapsed: number) => {
    const truck = openingTruckPose({ ...phone, impactElapsed: elapsed });
    const dx = root.x - truck.x, dz = root.z - truck.z;
    const relative = root.yaw - truck.yaw, cos = Math.cos(relative), sin = Math.sin(relative);
    const back = Math.hypot(.4 * cos, .75 * sin), side = Math.hypot(.75 * cos, .4 * sin);
    return Math.abs(Math.cos(truck.yaw) * dx - Math.sin(truck.yaw) * dz) <= 2.1 + side
      && Math.sin(truck.yaw) * dx + Math.cos(truck.yaw) * dz + back >= -7.5;
  };
  if (!contact(phone.impactElapsed)) return;
  let before = 0, after = phone.impactElapsed;
  for (let i = 0; i < 32; i++) { const middle = (before + after) / 2; if (contact(middle)) after = middle; else before = middle; }
  const truck = openingTruckPose({ ...phone, impactElapsed: after }), sin = Math.sin(truck.yaw), cos = Math.cos(truck.yaw);
  const side = Math.sign(cos * (root.x - truck.x) - sin * (root.z - truck.z));
  const x = -sin + side * .75 * cos, z = -cos - side * .75 * sin, length = Math.hypot(x, z);
  return { elapsed: Math.min(OPENING_PHONE.hitSeconds, phone.impactElapsed - after), at: after,
    origin: { x: root.x, y: root.y, z: root.z }, yaw: root.yaw, direction: { x: x / length, z: z / length } };
}

export function openingHitPose(hit: OpeningPhoneHit) {
  const t = Math.min(OPENING_PHONE.hitSeconds, Math.max(0, hit.elapsed)), air = OPENING_PHONE.hitAirSeconds;
  const slideSeconds = OPENING_PHONE.hitSeconds - air, slide = Math.max(0, t - air);
  const travel = OPENING_PHONE.hitSpeed * (Math.min(t, air) + slide - slide * slide / (2 * slideSeconds));
  const flight = Math.min(1, t / air), height = 4 * flight * (1 - flight);
  const landingY = hit.landingY ?? hit.origin.y, fall = hit.origin.y - landingY;
  const turn = Math.atan2(Math.sin(Math.atan2(hit.direction.x, hit.direction.z) - hit.yaw), Math.cos(Math.atan2(hit.direction.x, hit.direction.z) - hit.yaw));
  const u = Math.min(1, t / .65), blend = u * u * (3 - 2 * u), speed = OPENING_PHONE.hitSpeed * (1 - slide / slideSeconds);
  const vertical = hit.landingY === undefined ? 4 / air * (1 - 2 * flight) : (4 * (1 - 2 * flight) - fall) / air;
  return { x: hit.origin.x + hit.direction.x * travel, y: landingY + fall * (1 - flight) + height, z: hit.origin.z + hit.direction.z * travel,
    yaw: hit.yaw + turn * blend, velocity: { x: speed * hit.direction.x, y: t < air ? vertical : 0, z: speed * hit.direction.z } };
}

/** Local roots and gait share the saved pickup clock, including a cold first frame. */
export function openingAnswerPose(answer: OpeningPhoneAnswer) {
  const t = Math.max(0, Math.min(1, answer.elapsed / OPENING_PHONE.alignSeconds)), blend = t * t * (3 - 2 * t);
  const dx = OPENING_PHONE.stand.x - answer.origin.x, dz = OPENING_PHONE.stand.z - answer.origin.z;
  const travel = Math.hypot(dx, dz), turn = Math.atan2(Math.sin(Math.PI - answer.yaw), Math.cos(Math.PI - answer.yaw));
  return { x: answer.origin.x + dx * blend, y: answer.origin.y, z: answer.origin.z + dz * blend,
    yaw: answer.yaw + turn * blend, travel: travel * blend, speed: travel * 6 * t * (1 - t) / OPENING_PHONE.alignSeconds };
}

export interface OpeningRoofEncounter {
  phase: 'running' | 'failed' | 'escaped'; lastTick: number; attempts: number;
  leap?: { elapsed: number; fromX: number; toX: number };
  crossed?: boolean;
  pursuit?: OpeningPursuitCast;
}

export function openingRoofGlassBroken(roof?: OpeningRoofEncounter, exitElapsed = 0): boolean {
  return exitElapsed >= 1.68 || roof?.phase === 'escaped';
}

export interface OpeningPhoneEncounter {
  phase: 'running' | 'answering' | 'failed' | 'connected' | 'done'; remaining: number; lastTick: number; attempts: number;
  answer?: OpeningPhoneAnswer;
  hit?: OpeningPhoneHit;
  impactElapsed?: number; impactFrom?: number;
  aftermath?: WellsAftermath;
}

export function openingTruckPose(phone: OpeningPhoneEncounter): { x: number; z: number; yaw: number } {
  // The countdown ends just short of contact; the saved impact then crosses the booth.
  const approach = .86 * (1 - Math.max(0, Math.min(1, phone.remaining / OPENING_ESCAPE.phoneSeconds)));
  const impact = phone.phase === 'done' || phone.phase === 'failed' && phone.impactElapsed === undefined ? 1
    : phone.phase === 'connected' || phone.phase === 'failed'
    ? Math.max(0, Math.min(1, (phone.impactElapsed ?? 0) / OPENING_ESCAPE.truckImpactSeconds)) : 0;
  const progress = approach + (1 - approach) * impact;
  const turn = Math.pow(progress, 1.55);
  return { x: 15 * (1 - turn), z: 4 - 30 * turn, yaw: Math.PI / 2 * (1 - turn) };
}
