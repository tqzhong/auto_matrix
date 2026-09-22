import type { Vector3 } from '../types/agent.js';
import type { RescueLoadout } from './rescue.js';

// Shared footprints: the renderer, movement and ballistic cover use the same columns.
export const LOBBY_COLUMNS = [-26, -12, 2, 16, 30].flatMap(z => [-1, 1].map(side => ({ x: side * 10.2, z, width: 2.6, depth: 3.2, height: 16 })));
export const LOBBY_MAGAZINE = 16;
export const LOBBY_FIRE_INTERVAL = .24;
export type LobbyPhase = 'ready' | 'checkpoint' | 'combat' | 'cleared';
export type LobbyRole = 'neo' | 'trinity' | 'guard';
export interface LobbyGesture { phase: 'checkpoint' | 'down'; elapsed: number; role: LobbyRole }
export const LOBBY_ENTRY = {
  duration: 7.2,
  alarmAt: 1.8,
  drawAt: 3.1,
  roots: {
    neo: { x: 1.4, z: 25.5, yaw: Math.PI },
    trinity: { x: -2.6, z: 27.2, yaw: Math.PI },
    guard: { x: 0, z: 20.8, yaw: 0 },
  },
} as const;
export interface LobbyEncounter {
  phase?: LobbyPhase;
  elapsed?: number;
  loadout?: RescueLoadout;
  ammo: number;
  reloadAt?: number;
  wave: number;
  nextWaveAt?: number;
  columns: number[];
  allyShotAt: number;
  shots: number;
  kills: number;
}

export function lobbyLocked(journey: { scene: string; visiting?: unknown; lobby?: LobbyEncounter } | undefined): boolean {
  return Boolean(journey?.scene === 'm1_lobby' && !journey.visiting && journey.lobby?.phase === 'checkpoint');
}

export function lobbyPose(gesture: LobbyGesture): { alarm: number; draw: number; aim: number; fall: number } {
  if (gesture.phase === 'down') return { alarm: 1, draw: 0, aim: 0, fall: 1 };
  const smooth = (value: number, from: number, to: number) => {
    const t = Math.max(0, Math.min(1, (value - from) / (to - from)));
    return t * t * (3 - 2 * t);
  };
  const alarm = smooth(gesture.elapsed, LOBBY_ENTRY.alarmAt, LOBBY_ENTRY.alarmAt + .7);
  const draw = gesture.role === 'guard' ? 0 : smooth(gesture.elapsed, LOBBY_ENTRY.drawAt, LOBBY_ENTRY.drawAt + 1.15);
  return { alarm, draw, aim: smooth(gesture.elapsed, LOBBY_ENTRY.drawAt + .8, LOBBY_ENTRY.drawAt + 2),
    fall: gesture.role === 'guard' ? smooth(gesture.elapsed, LOBBY_ENTRY.drawAt + .2, LOBBY_ENTRY.drawAt + 1.15) : 0 };
}

/** Distance along a unit ray to a box; supports shots starting inside a volume. */
export function rayBox(from: Vector3, direction: Vector3, min: Vector3, max: Vector3): number | undefined {
  let near = 0; let far = Infinity;
  for (const axis of ['x', 'y', 'z'] as const) {
    if (Math.abs(direction[axis]) < .000001) {
      if (from[axis] < min[axis] || from[axis] > max[axis]) return;
    } else {
      const a = (min[axis] - from[axis]) / direction[axis]; const b = (max[axis] - from[axis]) / direction[axis];
      near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b));
      if (near > far) return;
    }
  }
  return near;
}

export function lobbyCover(from: Vector3, direction: Vector3, center: Vector3, range = 100): { distance: number; column?: number } {
  const p = { x: from.x - center.x, y: from.y - center.y + 1, z: from.z - center.z };
  let result: { distance: number; column?: number } = { distance: range };
  LOBBY_COLUMNS.forEach((c, column) => {
    const hit = rayBox(p, direction, { x: c.x - c.width / 2, y: 0, z: c.z - c.depth / 2 }, { x: c.x + c.width / 2, y: c.height, z: c.z + c.depth / 2 });
    if (hit !== undefined && hit < result.distance) result = { distance: hit, column };
  });
  for (const [axis, boundary] of [['x', 19], ['z', 41], ['y', 16]] as const) {
    if (Math.abs(direction[axis]) < .000001) continue;
    const edge = axis === 'y' ? direction.y > 0 ? 16 : 0 : Math.sign(direction[axis]) * boundary;
    const hit = (edge - p[axis]) / direction[axis];
    if (hit >= 0 && hit < result.distance) result = { distance: hit };
  }
  return result;
}
