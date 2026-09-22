import type { Vector3 } from '../types/agent.js';
import type { FilmJourney } from './film-story.js';

// The existing meeting room is on floor 13. Dimensions are a playable layout,
// not a claim that the film provides a complete architectural floor plan.
export const LAFAYETTE = { floors: 13, rise: 7, upper: 84, left: 35, right: 43, near: 20, far: -4, steps: 12,
  door: { x: 21, z: 0, width: .35, depth: 5.6, height: 7.4 },
  sideDoor: { x: 21, z: 14, width: .35, depth: 5.2, height: 7.4 }, doorSeconds: 2.4 } as const;
export type LafayetteWelcomePhase = 'approach' | 'ready' | 'handshake' | 'departing' | 'done';
export interface LafayetteWelcome { phase: LafayetteWelcomePhase; elapsed: number }
export type LafayetteWelcomeRole = 'neo' | 'morpheus' | 'trinity';
export type LafayetteWelcomeGesture = LafayetteWelcome & { role: LafayetteWelcomeRole };
export interface LafayetteKnockStart { x: number; z: number; yaw: number }
export interface HotelApproach { progress: number; knock?: number; knockFrom?: LafayetteKnockStart; door?: number; entered?: boolean; welcome?: LafayetteWelcome }
export interface HotelSurface { x: number; z: number; width: number; depth: number; y: number }
export const LAFAYETTE_WELCOME = { approach: 6.5, handshake: 3.2, departing: 5.4 } as const;
export const LAFAYETTE_KNOCK_SECONDS = 1.9;
const welcomeEase = (time: number, from: number, to: number): number => {
  const t = Math.max(0, Math.min(1, (time - from) / (to - from))); return t * t * (3 - 2 * t);
};
const mix = (from: number, to: number, amount: number): number => from + (to - from) * amount;
const turn = (from: number, to: number, amount: number): number => from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * amount;
const TRINITY_READY = { x: 5.5, z: 8 } as const;
const TRINITY_EXIT = [TRINITY_READY, { x: 5.5, z: 14 }, { x: 18.5, z: 14 }, { x: 23.5, z: 14 }] as const;
const TRINITY_EXIT_LENGTHS = TRINITY_EXIT.slice(1).map((point, i) => Math.hypot(point.x - TRINITY_EXIT[i].x, point.z - TRINITY_EXIT[i].z));
const TRINITY_EXIT_LENGTH = TRINITY_EXIT_LENGTHS.reduce((sum, length) => sum + length, 0);

function trinityExitPose(amount: number): { x: number; z: number; yaw: number } {
  let remaining = Math.max(0, Math.min(1, amount)) * TRINITY_EXIT_LENGTH;
  for (let i = 0; i < TRINITY_EXIT_LENGTHS.length; i++) {
    const length = TRINITY_EXIT_LENGTHS[i]; const a = TRINITY_EXIT[i]; const b = TRINITY_EXIT[i + 1];
    if (remaining > length && i < TRINITY_EXIT_LENGTHS.length - 1) { remaining -= length; continue; }
    const progress = Math.min(1, remaining / length);
    return { x: mix(a.x, b.x, progress), z: mix(a.z, b.z, progress), yaw: Math.atan2(b.x - a.x, b.z - a.z) };
  }
  return { ...TRINITY_EXIT[TRINITY_EXIT.length - 1], yaw: Math.PI / 2 };
}

export function lafayetteWelcomeLocked(journey: FilmJourney): boolean {
  return journey.scene === 'm1_pills' && !journey.visiting && journey.hotel?.welcome !== undefined && journey.hotel.welcome.phase !== 'done';
}

export function lafayetteKnocking(journey: FilmJourney): boolean {
  return journey.scene === 'm1_pills' && !journey.visiting && journey.hotel?.knock !== undefined && journey.hotel.door === undefined;
}

export function lafayetteKnockPose(elapsed: number) {
  const raised = welcomeEase(elapsed, .35, .78) * (1 - welcomeEase(elapsed, 1.5, 1.82));
  const beat = elapsed < .78 ? 0 : Math.max(0, Math.sin((elapsed - .78) * Math.PI * 6.65));
  return { approach: welcomeEase(elapsed, 0, .42), raised, strike: raised * beat };
}

export function lafayetteKnockRoot(hotel: HotelApproach): LafayetteKnockStart {
  const from = hotel.knockFrom ?? { x: 22.5, z: 0, yaw: -Math.PI / 2 };
  const amount = lafayetteKnockPose(hotel.knock ?? 0).approach;
  return { x: mix(from.x, 22.5, amount), z: mix(from.z, 0, amount), yaw: turn(from.yaw, -Math.PI / 2, amount) };
}

export function lafayetteWelcomePose(gesture: LafayetteWelcomeGesture) {
  const handshake = gesture.role === 'morpheus'
    ? gesture.phase === 'ready' ? 1 : gesture.phase === 'handshake' ? 1 - welcomeEase(gesture.elapsed, 2.15, 3.05) : 0
    : gesture.phase === 'handshake' ? welcomeEase(gesture.elapsed, .2, 1.05) * (1 - welcomeEase(gesture.elapsed, 2.15, 3.05)) : 0;
  const departing = gesture.phase === 'departing' ? welcomeEase(gesture.elapsed, 0, LAFAYETTE_WELCOME.departing) : gesture.phase === 'done' ? 1 : 0;
  return { handshake, seated: gesture.role === 'morpheus' ? welcomeEase(departing, .72, 1) : 0,
    nod: gesture.role === 'morpheus' && gesture.phase === 'approach' ? Math.sin(welcomeEase(gesture.elapsed, .7, 1.8) * Math.PI) : 0 };
}

export function lafayetteWelcomeRoot(encounter: LafayetteWelcome, role: LafayetteWelcomeRole): { x: number; z: number; yaw: number } {
  const approach = encounter.phase === 'approach' ? welcomeEase(encounter.elapsed, 0, LAFAYETTE_WELCOME.approach)
    : ['ready', 'handshake', 'departing', 'done'].includes(encounter.phase) ? 1 : 0;
  if (role === 'neo') return { x: mix(18, 2.65, approach), z: 0, yaw: -Math.PI / 2 };
  if (role === 'morpheus') {
    const departing = encounter.phase === 'departing' ? welcomeEase(encounter.elapsed, 0, LAFAYETTE_WELCOME.departing) : encounter.phase === 'done' ? 1 : 0;
    return { x: mix(mix(-17, .35, approach), -1.75, departing), z: mix(mix(1, 0, approach), -6, departing),
      yaw: turn(turn(-Math.PI / 2, Math.PI / 2, welcomeEase(approach, 0, .25)), Math.PI / 2, departing) };
  }
  const readyYaw = Math.atan2(.35 - TRINITY_READY.x, -TRINITY_READY.z);
  const startYaw = Math.atan2(TRINITY_READY.x - 18, TRINITY_READY.z - 2.5);
  if (encounter.phase !== 'departing' && encounter.phase !== 'done') return {
    x: mix(18, TRINITY_READY.x, approach), z: mix(2.5, TRINITY_READY.z, approach),
    yaw: turn(startYaw, readyYaw, welcomeEase(approach, .65, 1)),
  };
  const departing = encounter.phase === 'done' ? 1 : welcomeEase(encounter.elapsed, .2, LAFAYETTE_WELCOME.departing * .86);
  const exit = trinityExitPose(departing);
  return { ...exit, yaw: turn(readyYaw, exit.yaw, encounter.phase === 'done' ? 1 : welcomeEase(encounter.elapsed, 0, .35)) };
}

export function lafayetteSideDoor(encounter?: LafayetteWelcome): number {
  if (!encounter) return 0;
  if (encounter.phase === 'done') return 1;
  return encounter.phase === 'departing' ? welcomeEase(encounter.elapsed, .25, 1.45) : 0;
}
export const HOTEL_SURFACES: HotelSurface[] = [
  { x: 0, z: 28, width: 12, depth: 10, y: 0 },
  { x: 22, z: 24, width: 52, depth: 8, y: 0 },
  { x: 0, z: 0, width: 42, depth: 50, y: LAFAYETTE.upper },
  { x: 26, z: 0, width: 10, depth: 52, y: LAFAYETTE.upper },
];
for (let floor = 0; floor < LAFAYETTE.floors; floor++) {
  const y = floor * LAFAYETTE.rise;
  HOTEL_SURFACES.push({ x: 39, z: 23, width: 18, depth: 6, y });
  if (floor === LAFAYETTE.floors - 1) continue;
  HOTEL_SURFACES.push({ x: 39, z: -6, width: 18, depth: 4, y: y + 3.5 });
  for (let step = 0; step < LAFAYETTE.steps; step++) {
    HOTEL_SURFACES.push({ x: LAFAYETTE.left, z: 19 - step * 2, width: 6, depth: 2, y: y + (step + 1) * 3.5 / LAFAYETTE.steps });
    HOTEL_SURFACES.push({ x: LAFAYETTE.right, z: -3 + step * 2, width: 6, depth: 2, y: y + 3.5 + (step + 1) * 3.5 / LAFAYETTE.steps });
  }
}
export const HOTEL_WALLS = [
  { x: -4.4, z: 24, width: .8, depth: 8, y: 0, height: 7 },
  { x: 13, z: 19.6, width: 34, depth: .8, y: 0, height: 7 },
  { x: -3.5, z: 27.6, width: 2, depth: .8, y: 0, height: 7 },
  { x: 25.5, z: 27.6, width: 45, depth: .8, y: 0, height: 7 },
  { x: 48.4, z: 9, width: .8, depth: 38, y: 0, height: 98 },
  { x: 39, z: -8.4, width: 18, depth: .8, y: 0, height: 98 },
  { x: 39, z: 26.4, width: 18, depth: .8, y: 7, height: 91 },
  { x: 30.6, z: 5, width: .8, depth: 30, y: 0, height: 84 },
  { x: 30.6, z: 5, width: .8, depth: 30, y: 84, height: 14 },
  { x: 26, z: -26.4, width: 10, depth: .8, y: 84, height: 14 },
  { x: 26, z: 26.4, width: 10, depth: .8, y: 84, height: 14 },
  { x: 21, z: -14, width: .7, depth: 22.4, y: 84, height: 14 },
  { x: 21, z: 7.2, width: .7, depth: 8.8, y: 84, height: 14 },
  { x: 21, z: 21.2, width: .7, depth: 8, y: 84, height: 14 },
];
export function hotelContains(x: number, z: number): boolean { return x >= -23 && x <= 49 && z >= -27 && (z <= 28 || Math.abs(x) < 3 && z <= 32); }
export function hotelFloor(x: number, z: number, y: number): number | undefined {
  let floor: number | undefined;
  for (const surface of HOTEL_SURFACES) if (Math.abs(x - surface.x) <= surface.width / 2 + .001 && Math.abs(z - surface.z) <= surface.depth / 2 + .001 && surface.y <= y + .8) floor = Math.max(floor ?? -Infinity, surface.y);
  return floor;
}
export function hotelBlocked(x: number, z: number, y: number, radius: number): boolean {
  for (const [dx, dz] of [[radius, 0], [-radius, 0], [0, radius], [0, -radius]]) {
    const floor = hotelFloor(x + dx, z + dz, y);
    if (floor === undefined || floor < y - 4) return true;
  }
  return HOTEL_WALLS.some(wall => y + 3.6 > wall.y && y < wall.y + wall.height && Math.abs(x - wall.x) < wall.width / 2 + radius && Math.abs(z - wall.z) < wall.depth / 2 + radius);
}
// Trinity walks from the opposite rear door, around the parked car, into the
// service entrance and up both flights of each floor. No timed teleport.
export const HOTEL_ROUTE: Vector3[] = [
  { x: 16.65, y: 0, z: 42 }, { x: 29, y: 0, z: 42 }, { x: 29, y: 0, z: 31 },
  { x: 0, y: 0, z: 31 }, { x: 0, y: 0, z: 24 }, { x: 35, y: 0, z: 24 }, { x: 35, y: 0, z: 20 },
];
for (let floor = 0; floor < 12; floor++) {
  const y = floor * 7;
  HOTEL_ROUTE.push({ x: 35, y: y + 3.5, z: -6 }, { x: 43, y: y + 3.5, z: -6 }, { x: 43, y: y + 3.5, z: -4 },
    { x: 43, y: y + 7, z: 23 }, { x: 35, y: y + 7, z: 23 });
  if (floor < 11) HOTEL_ROUTE.push({ x: 35, y: y + 7, z: 20 });
}
HOTEL_ROUTE.push({ x: 26, y: 84, z: 23 }, { x: 26, y: 84, z: 0 }, { x: 24, y: 84, z: 0 });
const doorIndex = HOTEL_ROUTE.length - 1;
HOTEL_ROUTE.push({ x: 18, y: 84, z: 0 }, { x: 18, y: 84, z: 14 }, { x: 12, y: 84, z: 14 });
const lengths = HOTEL_ROUTE.slice(1).map((point, i) => Math.hypot(point.x - HOTEL_ROUTE[i].x, point.y - HOTEL_ROUTE[i].y, point.z - HOTEL_ROUTE[i].z));
export const HOTEL_DOOR_PROGRESS = lengths.slice(0, doorIndex).reduce((sum, n) => sum + n, 0);
export const HOTEL_ROUTE_LENGTH = lengths.reduce((sum, n) => sum + n, 0);
export function hotelRoutePose(progress: number): Vector3 & { yaw: number } {
  let remaining = Math.max(0, progress);
  for (let i = 0; i < lengths.length; i++) {
    if (remaining > lengths[i] && i < lengths.length - 1) { remaining -= lengths[i]; continue; }
    const a = HOTEL_ROUTE[i]; const b = HOTEL_ROUTE[i + 1]; const t = Math.min(1, remaining / lengths[i]);
    const x = a.x + (b.x - a.x) * t; const z = a.z + (b.z - a.z) * t; const y = a.y + (b.y - a.y) * t;
    return { x, y: hotelContains(x, z) ? hotelFloor(x, z, y) ?? y : y, z, yaw: Math.atan2(b.x - a.x, b.z - a.z) };
  }
  throw new Error('Hotel route is empty');
}
export function hotelRouteProgress(point: Vector3): number {
  let best = Infinity; let progress = 0; let along = 0;
  for (let i = 0; i < lengths.length; i++) {
    const a = HOTEL_ROUTE[i]; const b = HOTEL_ROUTE[i + 1]; const dx = b.x - a.x; const dy = b.y - a.y; const dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy + (point.z - a.z) * dz) / lengths[i] ** 2));
    const gap = (point.x - a.x - dx * t) ** 2 + (point.y - a.y - dy * t) ** 2 + (point.z - a.z - dz * t) ** 2;
    if (gap < best) { best = gap; progress = along + lengths[i] * t; } along += lengths[i];
  }
  return progress;
}
