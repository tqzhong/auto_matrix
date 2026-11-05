import type { Vector3 } from '../types/agent.js';

export type ChateauWeapon = 'sword' | 'spear' | 'axe' | 'mace';

export interface ChateauEncounter {
  phase: 'ready' | 'duel' | 'landing' | 'cleared' | 'failed';
  wave: 1 | 2;
  weapon?: 'sword' | 'spear';
  parries: number;
  disarms: number;
  attempts: number;
  wounded: boolean;
  volleyAt?: number;
}

export const CHATEAU = {
  racks: { sword: { x: -29, z: 17 }, spear: { x: 29, z: 17 } },
  landing: { x: 0, z: -35, height: 10, depth: 12 },
  stairs: { count: 18, x: 14, z: -4, dx: .65, dz: 1.45, rise: .55, width: 10, depth: 1.6, tread: .25,
    rail: { offset: 4.6, radius: .14, y: 1.7, height: 2.7, cap: .22, capY: 3.1 } },
  waves: [
    [{ x: -9, z: -7, weapon: 'sword' }, { x: 9, z: -7, weapon: 'mace' }],
    [{ x: -8, z: -35, weapon: 'spear' }, { x: 8, z: -35, weapon: 'axe' }],
  ],
} as const;

const treads = Array.from({ length: CHATEAU.stairs.count }, (_, index) => {
  const stairs = CHATEAU.stairs;
  return { x: stairs.x + index * stairs.dx, y: index * stairs.rise, z: stairs.z - index * stairs.dz };
});

export function chateauStairTread(index: number): Readonly<Vector3> {
  return treads[index];
}

export function chateauStairTreadAt(z: number): Readonly<Vector3> {
  const stairs = CHATEAU.stairs;
  return chateauStairTread(Math.max(0, Math.min(stairs.count - 1, Math.round((stairs.z - z) / stairs.dz))));
}

export function chateauRailBlocked(x: number, y: number, z: number, radius: number): boolean {
  const { rise, rail } = CHATEAU.stairs;
  const reach = radius + rail.cap;
  if (z < treads[treads.length - 1].z - reach || z > treads[0].z + reach) return false;
  for (const tread of treads) {
    if (Math.abs(z - tread.z) >= reach) continue;
    const above = y - tread.y;
    if (above < -rise || above >= rail.capY + rail.cap) continue;
    const clearance = radius + (above >= rail.capY - rail.cap ? rail.cap : rail.radius);
    const railX = Math.abs(Math.abs(x) - tread.x) - rail.offset;
    if (Math.hypot(railX, z - tread.z) < clearance) return true;
  }
  return false;
}

export function chateauStairWaypoint(position: Vector3, center: Vector3): { position: Vector3; label: string } | undefined {
  const { stairs, landing } = CHATEAU;
  const x = position.x - center.x, y = position.y - center.y, z = position.z - center.z;
  const side = x > 0 ? 1 : -1;
  if (y >= landing.height - .25 && z <= landing.z + landing.depth / 2) return;
  const tread = chateauStairTreadAt(z);
  const climbing = y >= stairs.tread - .05 && z <= stairs.z + stairs.depth / 2
    && Math.abs(Math.abs(x) - tread.x) < stairs.width / 2;
  const top = chateauStairTread(stairs.count - 1);
  return climbing
    ? { position: { x: center.x + side * top.x, y: center.y + landing.height, z: center.z + landing.z + 2 }, label: '二层平台' }
    : { position: { x: center.x + side * stairs.x, y: center.y + stairs.tread, z: center.z + stairs.z }, label: '楼梯入口' };
}
