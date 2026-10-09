import type { ArchitectEncounter } from './film-story.js';

export const ARCHITECT_ROOM = {
  radius: 23, centerZ: -6, height: 15.5, entry: { x: 0, z: 13 },
  chair: { x: 0, z: -14, seat: 1.22, width: 2.25, depth: 1.85, back: 3.95, arm: 2.04 },
  doors: { matrix: { x: -8, z: -27.5 }, source: { x: 8, z: -27.5 } },
  doorWidth: 4.8, doorHeight: 7.9, openingSeconds: 1.8,
  screens: { columns: 48, rows: 8, width: 2.78, height: 1.58, pitchY: 1.73 },
} as const;
export interface ArchitectRoomState {
  elapsed: number; chairYaw: number;
  exit?: { elapsed: number; x: number; z: number };
}
export interface ArchitectGesture {
  role: 'architect' | 'neo'; phase: ArchitectEncounter['phase']; elapsed: number; chairYaw: number;
  opening?: number; start?: { x: number; z: number };
}
export function architectRoomContains(x: number, z: number, radius: number): boolean {
  if (Math.hypot(x, z - ARCHITECT_ROOM.centerZ) < ARCHITECT_ROOM.radius - radius - .25) return true;
  return Object.values(ARCHITECT_ROOM.doors).some(door => Math.abs(x - door.x) < ARCHITECT_ROOM.doorWidth / 2 - radius - .12
    && z > door.z - 3 + radius && z < door.z + 3);
}
export function architectDoorAngle(encounter?: ArchitectEncounter): number {
  if (encounter?.door === 'matrix') return Math.PI / 2;
  const age = encounter?.room?.exit?.elapsed ?? 0;
  const t = Math.max(0, Math.min(1, (age - .3) / 1.35));
  return Math.PI / 2 * t * t * (3 - 2 * t);
}
export function architectDoorLocked(encounter?: ArchitectEncounter): boolean {
  return Boolean(encounter?.room?.exit && encounter.room.exit.elapsed < ARCHITECT_ROOM.openingSeconds);
}
export function architectExitRoot(exit: NonNullable<ArchitectRoomState['exit']>): { x: number; z: number; yaw: number } {
  const t = Math.min(1, exit.elapsed / .45), blend = t * t * (3 - 2 * t), door = ARCHITECT_ROOM.doors.matrix;
  return { x: exit.x + (door.x + .95 - exit.x) * blend, z: exit.z + (door.z + 1.15 - exit.z) * blend, yaw: Math.PI };
}
