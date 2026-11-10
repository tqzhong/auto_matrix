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

export interface OpeningRoofEncounter {
  phase: 'running' | 'failed' | 'escaped'; lastTick: number; attempts: number;
  leap?: { elapsed: number; fromX: number; toX: number };
  crossed?: boolean;
}

export interface OpeningPhoneEncounter {
  phase: 'running' | 'failed' | 'connected' | 'done'; remaining: number; lastTick: number; attempts: number;
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
