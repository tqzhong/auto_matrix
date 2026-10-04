export const TRUCKS = {
  roof: { x: 14, z: 28.5, width: 5.6, depth: 20, height: 6.6 },
  morpheus: { x: 14, z: 25 },
  johnson: { x: 14, z: 21 },
  keymaker: { x: 12.5, z: 32.5 },
  rescueApproach: { x: 14.6, z: 32.5 },
  niobe: { x: 7, z: 34 },
  oncomingStart: -95,
  oncomingEnd: -3,
  collisionSeconds: 10,
  rescueSeconds: 3,
  catchSeconds: .9,
  liftSeconds: 1.3,
} as const;

export type TruckRescueRole = 'morpheus' | 'keymaker' | 'neo';
export interface TruckRoot { x: number; y: number; z: number; yaw: number }

export interface TruckEncounter {
  phase: 'duel' | 'collision' | 'rescue' | 'rescued' | 'failed';
  elapsed: number;
  lastTick: number;
  attempt: number;
  rescueElapsed?: number;
  origin?: { x: number; z: number };
  starts?: Record<TruckRescueRole, TruckRoot>;
  // Old mid-flight saves acquire roots at their saved clock, without rewinding.
  startElapsed?: number;
}

const smooth = (time: number, start: number, end: number) => {
  const t = Math.max(0, Math.min(1, (time - start) / (end - start)));
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const angle = (a: number, b: number, t: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

export function truckApproachPose(elapsed: number): TruckRoot {
  const progress = Math.max(0, Math.min(1, (elapsed - 5.5) / (TRUCKS.collisionSeconds - 5.5)));
  return { x: TRUCKS.roof.x, y: 23 - progress * 12, z: -58 + progress * 91, yaw: 0 };
}

export function truckRescuePose(encounter: TruckEncounter, role: TruckRescueRole): TruckRoot & {
  approach: number; hold: number; flight: number; landing: number; airborne: number; tumble: number;
} {
  const elapsed = Math.max(0, Math.min(TRUCKS.rescueSeconds, encounter.rescueElapsed ?? 0));
  if (encounter.starts && (encounter.startElapsed ?? 0) > 0) {
    const restoredAt = encounter.startElapsed!;
    const path = { ...encounter, starts: undefined, startElapsed: undefined };
    const pose = truckRescuePose(path, role);
    const saved = encounter.starts[role];
    if (elapsed <= restoredAt) return { ...pose, ...saved };
    const anchor = truckRescuePose({ ...path, rescueElapsed: restoredAt }, role);
    // Preserve the saved phase and root. Late saves retain some horizontal
    // offset at landing instead of crossing several metres in their final frame.
    const residual = 1 - smooth(elapsed, restoredAt, restoredAt + .6);
    const vertical = 1 - smooth(elapsed, restoredAt, Math.min(TRUCKS.rescueSeconds, restoredAt + .6));
    return { ...pose, x: pose.x + (saved.x - anchor.x) * residual, y: pose.y + (saved.y - anchor.y) * vertical,
      z: pose.z + (saved.z - anchor.z) * residual,
      yaw: angle(pose.yaw, pose.yaw + saved.yaw - anchor.yaw, residual) };
  }
  const origin = encounter.origin ?? TRUCKS.rescueApproach;
  const starts = encounter.starts ?? {
    morpheus: { ...origin, y: TRUCKS.roof.height, yaw: 0 },
    keymaker: { ...TRUCKS.keymaker, y: TRUCKS.roof.height, yaw: 0 },
    neo: truckApproachPose(encounter.elapsed),
  };
  const clock = elapsed;
  const approach = smooth(clock, 0, TRUCKS.catchSeconds);
  const flight = smooth(clock, TRUCKS.liftSeconds, TRUCKS.rescueSeconds);
  const landing = smooth(clock, 2.6, TRUCKS.rescueSeconds);
  const hold = smooth(clock, TRUCKS.catchSeconds, TRUCKS.liftSeconds) * (1 - landing);
  const center = { x: (starts.morpheus.x + starts.keymaker.x) / 2, z: (starts.morpheus.z + starts.keymaker.z) / 2 };
  const dx = role === 'morpheus' ? 1.65 : role === 'keymaker' ? -1.65 : 0;
  const start = starts[role];
  // Both passengers jump clear of the colliding roof; Neo catches their
  // shoulders in mid-air. The final shoulder landing is a playable transition.
  const tossed = Math.max(0, Math.min(TRUCKS.liftSeconds, clock));
  const tossHeight = 5.8 * tossed - 3 * tossed * tossed;
  const spread = smooth(clock, 0, TRUCKS.liftSeconds);
  const catchRoot = { x: center.x + dx, y: (starts.morpheus.y + starts.keymaker.y) / 2 + tossHeight + .98,
    z: center.z + 3.5 * tossed - .4 };
  const takeoff = role === 'neo' ? {
    x: mix(start.x, catchRoot.x, approach), y: mix(start.y, catchRoot.y, approach), z: mix(start.z, catchRoot.z, approach),
  } : { x: mix(start.x, center.x + dx, spread), y: start.y + tossHeight, z: start.z + 3.5 * tossed };
  const x = mix(takeoff.x, 18.35 + dx, flight);
  const z = mix(takeoff.z, role === 'neo' ? 45.6 : 46, flight) + (role === 'neo' ? 3.4 * landing : 0);
  const y = flight >= 1 ? 0 : (takeoff.y - (role === 'neo' ? .98 : 0)) * (1 - flight)
    + 11 * Math.sin(Math.PI * flight) + (role === 'neo' ? .98 * (1 - landing) : 0);
  const airborne = (role === 'neo' ? 1 : smooth(clock, 0, .35)) * (1 - landing);
  const tumble = role === 'neo' ? 0 : Math.sin(Math.PI * 2 * Math.min(1, Math.max(0, clock) / TRUCKS.catchSeconds)) * .8 * (1 - hold);
  return { x, y, z, yaw: angle(start.yaw, 0, approach), approach, hold, flight, landing, airborne, tumble };
}
