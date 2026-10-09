import type { Vector3 } from '../types/index.js';
import { APU_RIG } from './apu-rig.js';

export const DOCK_GUNNERY = {
  apuZ: 12, kidStart: -30, kidFinish: 10, kidSpeed: 3.1,
  ammo: 96, limit: 45, sentinelSpeed: 1.4,
  eye: { x: APU_RIG.eye.x, y: APU_RIG.floor + APU_RIG.eye.y, z: 12 + APU_RIG.eye.z }, radius: 1.8,
  targets: [
    { x: -16, z: -30, spawnAt: 0 },
    { x: -9, z: -23, spawnAt: 0 },
    { x: 9, z: -42, spawnAt: 6 },
    { x: 16, z: -52, spawnAt: 12 },
    { x: -18, z: -38, spawnAt: 14, altitude: 17 },
    { x: 5, z: -38, spawnAt: 16, altitude: 21 },
    { x: -5, z: -36, spawnAt: 18, altitude: 14 },
    { x: 20, z: -43, spawnAt: 20, altitude: 18 },
    { x: -15, z: -40, spawnAt: 22, altitude: 23 },
    { x: 11, z: -39, spawnAt: 24, altitude: 13 },
    { x: -3, z: -36, spawnAt: 26, altitude: 19 },
    { x: 17, z: -45, spawnAt: 28, altitude: 24 },
  ],
} as const;

export interface DockGunnery {
  phase: 'ready' | 'firing' | 'cleared' | 'failed'; ammo: number; hull: number; kidHealth: number;
  kidZ: number; elapsed: number; lastTick: number; attempts: number; shots: number; kills: number; lastShotTick?: number;
  yaw?: number; pitch?: number; firstPerson?: boolean;
  lastShot?: Vector3 & { at: number; target?: number };
  targets: { x: number; z: number; spawnAt: number; health: number; struckKid: boolean; escaped: boolean;
    altitude?: number; downAt?: number; downFrom?: Vector3 }[];
}

export function newDockGunnery(tick: number, attempts = 0): DockGunnery {
  return { phase: 'ready', ammo: DOCK_GUNNERY.ammo, hull: 100, kidHealth: 100,
    kidZ: DOCK_GUNNERY.kidStart, elapsed: 0, lastTick: tick, attempts, shots: 0, kills: 0,
    yaw: Math.PI, pitch: -.16, firstPerson: false,
    targets: DOCK_GUNNERY.targets.map(target => ({ ...target, health: 3, struckKid: false, escaped: false })) };
}

export function dockGunneryAngles(yaw: number, pitch: number) {
  const turn = Math.atan2(Math.sin(yaw - Math.PI), Math.cos(yaw - Math.PI));
  return { yaw: Math.PI + Math.max(-1.05, Math.min(1.05, turn)), pitch: Math.max(-.85, Math.min(.4, pitch)) };
}

/** Both camera modes and authoritative hits use this exact ray, including shoulder parallax. */
export function dockGunneryView(yaw: number, pitch: number, firstPerson = true) {
  const aim = dockGunneryAngles(yaw, pitch), s = Math.sin(aim.yaw), c = Math.cos(aim.yaw);
  const direction = { x: s * Math.cos(aim.pitch), y: -Math.sin(aim.pitch), z: c * Math.cos(aim.pitch) };
  const eye = firstPerson ? { ...DOCK_GUNNERY.eye } : {
    x: -s * 10 - c * 6, y: DOCK_GUNNERY.eye.y + 4, z: DOCK_GUNNERY.eye.z - c * 10 + s * 6 };
  return { eye, direction };
}

export function dockGunneryTarget(encounter: DockGunnery, index: number): Vector3 {
  const target = encounter.targets[index];
  if (target.downFrom && target.downAt !== undefined) {
    const age = Math.max(0, encounter.elapsed - target.downAt);
    return { x: target.downFrom.x, y: Math.max(1.7, target.downFrom.y - 4.9 * age * age), z: target.downFrom.z + Math.min(2.5, age * 1.2) };
  }
  const approach = Math.max(0, Math.min(1, target.z / 10));
  return { x: target.x, y: (target.altitude ?? 11) * (1 - approach) + 4.3 * approach
    + Math.sin((encounter.elapsed - target.spawnAt) * 2 + index) * .7 * (1 - approach), z: target.z };
}

export function dockGunneryAim(encounter: DockGunnery, yaw = encounter.yaw ?? Math.PI, pitch = encounter.pitch ?? -.16, firstPerson = encounter.firstPerson ?? true) {
  const { eye, direction } = dockGunneryView(yaw, pitch, firstPerson);
  let distance = 100, target: number | undefined;
  encounter.targets.forEach((enemy, index) => {
    if (enemy.health <= 0 || enemy.spawnAt > encounter.elapsed) return;
    const point = dockGunneryTarget(encounter, index), x = point.x - eye.x, y = point.y - eye.y, z = point.z - eye.z;
    const projection = x * direction.x + y * direction.y + z * direction.z;
    const d = DOCK_GUNNERY.radius ** 2 - (x * x + y * y + z * z - projection * projection);
    const entry = d >= 0 ? projection - Math.sqrt(d) : -1;
    if (entry > 0 && entry < distance) { distance = entry; target = index; }
  });
  return { x: eye.x + direction.x * distance, y: eye.y + direction.y * distance, z: eye.z + direction.z * distance, target };
}

export function fireDockGunnery(encounter: DockGunnery, yaw: number, tick: number, pitch = 0, firstPerson = true): boolean {
  if (encounter.phase !== 'firing' || encounter.ammo <= 0 || !Number.isFinite(yaw) || !Number.isFinite(pitch)) return false;
  Object.assign(encounter, dockGunneryAngles(yaw, pitch), { firstPerson });
  encounter.ammo--; encounter.shots++; encounter.lastShotTick = tick;
  const aim = dockGunneryAim(encounter); encounter.lastShot = { ...aim, at: encounter.elapsed };
  const target = aim.target === undefined ? undefined : encounter.targets[aim.target];
  if (target && --target.health === 0) {
    target.downFrom = dockGunneryTarget(encounter, aim.target!); target.downAt = encounter.elapsed; encounter.kills++;
  }
  if (!encounter.ammo && encounter.kills < encounter.targets.length) encounter.phase = 'failed';
  return Boolean(target);
}

export function stepDockGunnery(encounter: DockGunnery, seconds: number): DockGunnery {
  if (encounter.phase !== 'firing') return encounter;
  const dt = Math.max(0, Math.min(1, seconds));
  encounter.elapsed += dt;
  encounter.kidZ = Math.min(DOCK_GUNNERY.kidFinish, encounter.kidZ + DOCK_GUNNERY.kidSpeed * dt);
  for (const target of encounter.targets) {
    if (target.health <= 0 || target.spawnAt > encounter.elapsed) continue;
    target.z += DOCK_GUNNERY.sentinelSpeed * dt;
    if (!target.struckKid && Math.abs(target.x + 5) < 5 && Math.abs(target.z - encounter.kidZ) < 3.5) {
      target.struckKid = true; encounter.kidHealth = Math.max(0, encounter.kidHealth - 35);
    }
    if (target.z >= DOCK_GUNNERY.apuZ - 2) {
      target.health = 0; target.escaped = true; encounter.hull = Math.max(0, encounter.hull - 36);
    }
  }
  if (encounter.kidHealth <= 0 || encounter.hull <= 0 || encounter.elapsed >= DOCK_GUNNERY.limit
    || encounter.targets.some(target => target.escaped)) encounter.phase = 'failed';
  else if (encounter.kills === encounter.targets.length && encounter.kidZ >= DOCK_GUNNERY.kidFinish
    && encounter.targets.every(target => target.downAt === undefined || encounter.elapsed - target.downAt >= 3)) encounter.phase = 'cleared';
  return encounter;
}
