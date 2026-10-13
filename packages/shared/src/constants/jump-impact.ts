import { PLAYER_GRAVITY } from './gravity.js';
import type { Vector3 } from '../types/agent.js';

export interface JumpImpact { origin: Vector3; velocity: Vector3; yaw: number; hurt?: boolean }
export const JUMP_STREET = { base: -42, surface: .16 } as const;
export const jumpStreetHeight = JUMP_STREET.base + JUMP_STREET.surface;
export const JUMP_TOWERS = [{ z: 17, depth: 60 }, { z: -38.5, depth: 17 }] as const;
export const jumpStreetDisplacement = (x: number, z: number, depth: number) => depth * Math.exp(-.2 * (x * x + z * z));
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

export function jumpImpactTime(fall: JumpImpact): number {
  const speed = fall.velocity.y;
  return (speed + Math.sqrt(speed * speed + 2 * PLAYER_GRAVITY * Math.max(0, fall.origin.y - jumpStreetHeight))) / PLAYER_GRAVITY;
}

export function jumpImpactPose(fall: JumpImpact, elapsed: number) {
  const flight = jumpImpactTime(fall), t = Math.min(elapsed, flight), impact = Math.max(0, elapsed - flight);
  const depression = impact < .3 ? -.65 * Math.sin(impact / .3 * Math.PI) : 0;
  const rebound = impact > .3 && impact < 1.5 ? 1.4 * Math.sin((impact - .3) / 1.2 * Math.PI) : 0;
  const prone = clamp((elapsed - flight + .8) / .8, 0, 1);
  return { x: clamp(fall.origin.x + fall.velocity.x * t, -22, 22),
    y: elapsed < flight ? fall.origin.y + fall.velocity.y * t - .5 * PLAYER_GRAVITY * t * t : jumpStreetHeight + depression + rebound,
    z: clamp(fall.origin.z + fall.velocity.z * t, -27, -13.2 - prone * 2.8), yaw: fall.yaw,
    verticalVelocity: elapsed < flight ? fall.velocity.y - PLAYER_GRAVITY * t : 0,
    impact, depression, rebound, prone, landed: elapsed >= flight };
}
