export interface MountainFlight {
  phase: 'ground' | 'ready' | 'takeoff' | 'flying' | 'failed' | 'arrived';
  elapsed: number;
  x: number;
  z: number;
  altitude: number;
  attempt: number;
}

export const MOUNTAIN = {
  door: { x: 0, z: 333 },
  lookout: { x: 0, z: 270 },
  launch: { x: 0, z: 245 },
  destinationZ: -310,
  ascent: 2.4,
  altitude: 48,
  speed: 57,
  deadline: 24,
} as const;

export function mountainFloor(x: number, z: number): number {
  if (z >= 230 && Math.abs(x) < 21) return 1;
  const descent = Math.max(0, 230 - z) * .035;
  const side = Math.max(0, Math.abs(x) - 18) * .18;
  const rough = (Math.sin(x * .045 + z * .019) + Math.cos(x * .032 - z * .043)) * .65;
  return 1 - descent + side + rough;
}
