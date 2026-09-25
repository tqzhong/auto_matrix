import type { Vector3 } from '../types/agent.js';

export const FAREWELL = {
  seconds: { reaching: 2.4, discovery: 3.4, promise: 4.6, goodbye: 5.2, kiss: 2.8 },
  minimumSeconds: 18.4,
  trinity: { x: 0, z: -15, yaw: 0 },
  neo: { x: 0, z: -12.95, yaw: Math.PI },
} as const;

export type FarewellPhase = 'ready' | 'reaching' | 'discovery' | 'promise' | 'goodbye' | 'kiss' | 'still';

export interface FarewellEncounter {
  phase: FarewellPhase;
  elapsed: number;
  total: number;
}

export interface FarewellGesture extends FarewellEncounter {
  role: 'neo' | 'trinity';
  target?: Vector3;
}

export interface FarewellPose {
  neo: { x: number; z: number; yaw: number; kneel: number; lean: number; hold: number; grief: number };
  trinity: { x: number; z: number; yaw: number; recline: number; reach: number; breath: number };
}

const smooth = (value: number): number => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

export function newFarewell(): FarewellEncounter {
  return { phase: 'ready', elapsed: 0, total: 0 };
}

export function farewellLocked(encounter?: FarewellEncounter): boolean {
  return Boolean(encounter && encounter.phase !== 'ready' && encounter.phase !== 'still');
}

export function stepFarewell(encounter: FarewellEncounter, delta: number): FarewellEncounter {
  if (!farewellLocked(encounter)) return encounter;
  const dt = Math.max(0, Math.min(.1, delta));
  const next = { ...encounter, elapsed: encounter.elapsed + dt, total: encounter.total + dt };
  const duration = FAREWELL.seconds[next.phase as keyof typeof FAREWELL.seconds];
  if (duration === undefined || next.elapsed + 1e-6 < duration) return next;
  const order: FarewellPhase[] = ['reaching', 'discovery', 'promise', 'goodbye', 'kiss', 'still'];
  next.phase = order[order.indexOf(next.phase) + 1] ?? 'still';
  next.elapsed = 0;
  return next;
}

export function farewellPose(encounter: FarewellEncounter): FarewellPose {
  const phase = encounter.phase;
  const reaching = phase === 'reaching' ? smooth(encounter.elapsed / FAREWELL.seconds.reaching)
    : phase === 'ready' ? 0 : 1;
  const holding = ['discovery', 'promise', 'goodbye', 'kiss', 'still'].includes(phase) ? 1 : reaching;
  const goodbye = phase === 'goodbye' ? smooth(encounter.elapsed / (FAREWELL.seconds.goodbye * .42))
    : ['kiss', 'still'].includes(phase) ? 1 : 0;
  const kiss = phase === 'kiss' ? smooth(encounter.elapsed / (FAREWELL.seconds.kiss * .58)) : 0;
  const release = phase === 'still' ? 1 : phase === 'kiss'
    ? smooth((encounter.elapsed - FAREWELL.seconds.kiss * .78) / (FAREWELL.seconds.kiss * .22)) : 0;
  return {
    neo: {
      x: FAREWELL.neo.x,
      z: FAREWELL.neo.z - reaching * 1.45 - kiss * .18,
      yaw: FAREWELL.neo.yaw,
      kneel: reaching,
      lean: holding * .22 + kiss * .62,
      hold: Math.max(reaching * .7, holding) * (1 - release * .35),
      grief: phase === 'still' ? 1 : 0,
    },
    trinity: {
      ...FAREWELL.trinity,
      recline: 1,
      reach: Math.max(holding * .34, goodbye) * (1 - release),
      breath: phase === 'still' ? 0 : Math.max(.12, 1 - encounter.total / FAREWELL.minimumSeconds * .72),
    },
  };
}
