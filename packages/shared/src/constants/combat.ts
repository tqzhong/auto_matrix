import type { Vector3 } from '../types/agent.js';
import type { WorldStructure } from '../types/sandbox.js';
import { playerBlocked } from './city.js';

// Animation and server damage share the same contact/recovery times (seconds).
export const MELEE_COMBO = [
  { name: '刺拳', contact: .14, duration: .42, reach: 3, damage: 18, push: .25 },
  { name: '直拳', contact: .18, duration: .48, reach: 3.3, damage: 23, push: .4 },
  { name: '正蹬', contact: .26, duration: .64, reach: 3.7, damage: 32, push: 1.2 },
] as const;
export const COMBO_WINDOW = 1.1;

// Direction selection adapted from Snaiel's DodgeComponent (MIT).
// See THIRD_PARTY_NOTICES.md. Ground collision remains server-authoritative.
export function dodgeDirection(x: number, z: number, yaw: number): Vector3 {
  const length = Math.hypot(x, z);
  return length > .05 ? { x: x / length, y: 0, z: z / length }
    : { x: -Math.sin(yaw), y: 0, z: -Math.cos(yaw) };
}

export function combatDisplace(position: Vector3, direction: Vector3, amount: number, matrix: boolean, structures: WorldStructure[] = []): Vector3 {
  let result = { ...position };
  const steps = Math.ceil(Math.abs(amount) / .2);
  for (let i = 0; i < steps; i++) {
    const next = { ...result, x: result.x + direction.x * amount / steps, z: result.z + direction.z * amount / steps };
    if (playerBlocked(next, matrix, 1.1, structures)) break;
    result = next;
  }
  return result;
}

export interface CombatImpact {
  source: string;
  target: string;
  position: Vector3;
  direction: Vector3;
  damage: number;
  combo: number;
  matrix: boolean;
  downed: boolean;
}

export function meleeReach(from: Vector3, yaw: number, to: Vector3, reach: number, matrix: boolean, structures: WorldStructure[] = []): boolean {
  const dx = to.x - from.x; const dz = to.z - from.z;
  const length = Math.hypot(dx, dz);
  if (length > reach || Math.abs(to.y - from.y) > 2.2) return false;
  if (length > .1 && (Math.sin(yaw) * dx + Math.cos(yaw) * dz) / length < .35) return false;
  for (let d = .3; d < length; d += .3) {
    const t = d / length;
    if (playerBlocked({ x: from.x + dx * t, y: from.y + 1, z: from.z + dz * t }, matrix, .15, structures)) return false;
  }
  return true;
}
