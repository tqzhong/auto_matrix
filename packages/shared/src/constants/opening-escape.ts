export const OPENING_ESCAPE = {
  roofGapNear: -2,
  roofGapFar: -5.8,
  roofDrop: 38,
  pursuerSpeed: 6.4,
  phoneSeconds: 15,
  truckImpactSeconds: 1.35,
} as const;

export interface OpeningRoofEncounter {
  phase: 'running' | 'failed' | 'escaped'; lastTick: number; attempts: number;
}

export interface OpeningPhoneEncounter {
  phase: 'running' | 'failed' | 'connected' | 'done'; remaining: number; lastTick: number; attempts: number;
  impactElapsed?: number; impactFrom?: number;
}

export function openingTruckPose(phone: OpeningPhoneEncounter): { x: number; z: number; yaw: number } {
  const approach = 1 - Math.max(0, Math.min(1, phone.remaining / OPENING_ESCAPE.phoneSeconds));
  const impact = phone.phase === 'connected' || phone.phase === 'done'
    ? Math.max(0, Math.min(1, (phone.impactElapsed ?? 0) / OPENING_ESCAPE.truckImpactSeconds)) : 0;
  const progress = approach + (1 - approach) * impact;
  const turn = Math.pow(progress, 1.55);
  return { x: 15 * (1 - turn), z: 4 - 30 * turn, yaw: Math.PI / 2 * (1 - turn) };
}
