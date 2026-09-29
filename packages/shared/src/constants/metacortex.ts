import type { Vector3 } from '../types/agent.js';

export const METACORTEX = {
  center: { x: 1140, y: 1, z: 827 }, width: 54, depth: 66, upper: 65,
  liftZ: -29, doorZ: -25.8, doorSeconds: 1.4, travelSeconds: 9,
} as const;
export interface MetacortexLift {
  floor: 0 | 1; target: 0 | 1; phase: 'idle' | 'closing' | 'travel' | 'opening'; elapsed: number;
  passenger?: { x: number; z: number };
}
export const METACORTEX_SHAFT = [
  ...[-1, 1].map(side => ({ x: side * 3.2, z: -29, width: .4, depth: 6.8, height: 8 })),
  { x: 0, z: -32.4, width: 6.8, depth: .4, height: 8 },
];
export const METACORTEX_LOBBY = [
  ...METACORTEX_SHAFT,
  { x: -13, z: 13, width: 12, depth: 3.6, height: 3 },
  ...[-1, 1].map(side => ({ x: side * 20, z: -6, width: 3, depth: 14, height: 2.7 })),
];
export function metacortexPosition(x = 0, z = 0, floor = 0): Vector3 {
  return { x: METACORTEX.center.x + x, y: 1 + floor * METACORTEX.upper, z: METACORTEX.center.z + z };
}
export function metacortexFloor(position: Vector3): 0 | 1 | undefined {
  if (Math.abs(position.x - METACORTEX.center.x) > 26 || Math.abs(position.z - METACORTEX.center.z) > 34) return;
  if (Math.abs(position.y - 1) < 2) return 0;
  if (Math.abs(position.y - 66) < 2) return 1;
}
export function nearMetacortexLift(position: Vector3): boolean {
  return metacortexFloor(position) !== undefined && Math.abs(position.x - METACORTEX.center.x) < 5 && Math.abs(position.z - METACORTEX.center.z - METACORTEX.liftZ) < 9;
}
export function metacortexLiftPose(lift?: MetacortexLift): { height: number; door: number } {
  if (!lift) return { height: 0, door: 1 };
  const t = Math.min(1, lift.elapsed / METACORTEX.travelSeconds);
  const eased = t * t * (3 - 2 * t);
  const floor = lift.phase === 'travel' ? lift.floor + (lift.target - lift.floor) * eased : lift.phase === 'opening' ? lift.target : lift.floor;
  return { height: floor * METACORTEX.upper, door: lift.phase === 'idle' ? 1 : lift.phase === 'closing' ? Math.max(0, 1 - lift.elapsed / METACORTEX.doorSeconds) : lift.phase === 'opening' ? Math.min(1, lift.elapsed / METACORTEX.doorSeconds) : 0 };
}
export function metacortexLiftLocked(lift?: MetacortexLift): boolean { return Boolean(lift?.passenger && lift.phase !== 'idle'); }
