export const DOCK_GUNNERY = {
  apuZ: 12, kidStart: -30, kidFinish: 10, kidSpeed: 3.1,
  ammo: 20, limit: 45, sentinelSpeed: 1.4,
  targets: [
    { x: -16, z: -30, spawnAt: 0 },
    { x: -9, z: -23, spawnAt: 0 },
    { x: 9, z: -42, spawnAt: 6 },
    { x: 16, z: -52, spawnAt: 12 },
  ],
} as const;

export interface DockGunnery {
  phase: 'ready' | 'firing' | 'cleared' | 'failed'; ammo: number; hull: number; kidHealth: number;
  kidZ: number; elapsed: number; lastTick: number; attempts: number; shots: number; kills: number; lastShotTick?: number;
  targets: { x: number; z: number; spawnAt: number; health: number; struckKid: boolean; escaped: boolean }[];
}

export function newDockGunnery(tick: number, attempts = 0): DockGunnery {
  return { phase: 'ready', ammo: DOCK_GUNNERY.ammo, hull: 100, kidHealth: 100,
    kidZ: DOCK_GUNNERY.kidStart, elapsed: 0, lastTick: tick, attempts, shots: 0, kills: 0,
    targets: DOCK_GUNNERY.targets.map(target => ({ ...target, health: 2, struckKid: false, escaped: false })) };
}

export function fireDockGunnery(encounter: DockGunnery, yaw: number, tick: number): boolean {
  if (encounter.phase !== 'firing' || encounter.ammo <= 0 || !Number.isFinite(yaw)) return false;
  encounter.ammo--; encounter.shots++; encounter.lastShotTick = tick;
  const target = encounter.targets.filter(enemy => enemy.health > 0 && enemy.spawnAt <= encounter.elapsed)
    .map(enemy => {
      const angle = Math.atan2(enemy.x, enemy.z - DOCK_GUNNERY.apuZ);
      return { enemy, gap: Math.abs(Math.atan2(Math.sin(yaw - angle), Math.cos(yaw - angle))) };
    })
    .filter(({ gap }) => gap < .18)
    .sort((a, b) => a.gap - b.gap || b.enemy.z - a.enemy.z)[0]?.enemy;
  if (target && --target.health === 0) encounter.kills++;
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
  else if (encounter.kills === encounter.targets.length && encounter.kidZ >= DOCK_GUNNERY.kidFinish) encounter.phase = 'cleared';
  return encounter;
}
