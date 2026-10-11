import type { Vector3 } from '../types/agent.js';
import { LOGOS_COCKPIT } from './logos-flight.js';

export const LOGOS_WRECK = {
  cabin: { x: -LOGOS_COCKPIT.roots.trinity.x, y: -LOGOS_COCKPIT.floor, z: -10.88 },
  entry: { x: 1.35, z: -6.2 },
} as const;
export const LOGOS_WRECK_WALLS = [
  ...[-1, 1].map(side => ({ x: LOGOS_WRECK.cabin.x + side * LOGOS_COCKPIT.frame.halfWidth,
    z: LOGOS_WRECK.cabin.z - 4.6, width: .18, depth: LOGOS_COCKPIT.frame.length, height: 1.1 })),
  ...[-1, 1].map(side => ({ x: LOGOS_WRECK.cabin.x + side * 2.475,
    z: LOGOS_WRECK.cabin.z + LOGOS_COCKPIT.frame.rear, width: 1.85, depth: .16, height: 4.35 })),
];

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
  approach?: { x: number; z: number; yaw: number };
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
  const approach = encounter.approach ?? FAREWELL.neo;
  const turn = Math.atan2(Math.sin(FAREWELL.neo.yaw - approach.yaw), Math.cos(FAREWELL.neo.yaw - approach.yaw));
  return {
    neo: {
      x: approach.x + (FAREWELL.neo.x - approach.x) * reaching,
      z: approach.z + (FAREWELL.neo.z - 1.45 - approach.z) * reaching - kiss * .18 * (1 - release),
      yaw: reaching === 1 ? FAREWELL.neo.yaw : approach.yaw + turn * reaching,
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
