import type { Vector3 } from '@auto_matrix/shared';

const LERP_SPEED = 8;

export function lerpVector3(
  current: Vector3,
  target: Vector3,
  delta: number,
): Vector3 {
  const t = 1 - Math.exp(-LERP_SPEED * delta);
  return {
    x: current.x + (target.x - current.x) * t,
    y: current.y + (target.y - current.y) * t,
    z: current.z + (target.z - current.z) * t,
  };
}

export function lerpNumber(
  current: number,
  target: number,
  delta: number,
): number {
  const t = 1 - Math.exp(-LERP_SPEED * delta);
  return current + (target - current) * t;
}

export function lerpAngle(
  current: number,
  target: number,
  delta: number,
): number {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const t = 1 - Math.exp(-LERP_SPEED * delta);
  return current + diff * t;
}
