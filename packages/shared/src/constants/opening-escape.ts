import type { Vector3 } from '../types/agent.js';

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
} as const;

export interface OpeningPhoneAnswer {
  elapsed: number; origin: Vector3; yaw: number;
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
}

export interface OpeningPhoneEncounter {
  phase: 'running' | 'answering' | 'failed' | 'connected' | 'done'; remaining: number; lastTick: number; attempts: number;
  answer?: OpeningPhoneAnswer;
  impactElapsed?: number; impactFrom?: number;
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
