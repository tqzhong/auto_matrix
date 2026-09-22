import type { Vector3 } from '../types/agent.js';
import { rayBox } from './lobby.js';
import type { FilmJourney } from './film-story.js';

export const OFFICE_CONTACT = { x: 14, z: 6.7, parcelX: 14.5, parcelZ: 5.31, pickupSeconds: 2.2, answerSeconds: 11 };
export interface OfficePhone { phase: 'pickup' | 'ready' | 'answering' | 'connected'; elapsed: number }
export function phoneLocked(journey: FilmJourney): boolean {
  return !journey.visiting && journey.scene === 'm1_boss' && journey.step === 1 && Boolean(journey.phone && journey.phone.phase !== 'connected');
}
export function heldPhone(journey: FilmJourney): OfficePhone | undefined {
  if (journey.visiting || !journey.phone) return;
  if (journey.scene === 'm1_boss') return journey.phone;
  if (['m1_office_escape', 'm1_ledge'].includes(journey.scene) && !journey.office?.outcome && journey.office?.climbed === undefined) return journey.phone;
}

export const OFFICE_WINDOW = { x: -26.8, z: -27, top: 8.9, height: 6, width: 5.7, handleY: 3.65, approachX: -25.25, approachZ: -27.65, seconds: 3.2 };
export const OFFICE_LEDGE_OFFSET = -29.8;
export const OFFICE_CROSSING_SECONDS = 6.4;
export function windowCrossing(journey: FilmJourney): boolean {
  return !journey.visiting && journey.scene === 'm1_office_escape' && journey.step === 3 && journey.office?.crossing !== undefined && !journey.office.outcome;
}
// Contact positions use the office's floor coordinates, shared by the body and set.
const crossingKeys = [
  { time: 0, x: OFFICE_WINDOW.approachX, y: 0, z: OFFICE_WINDOW.approachZ, yaw: -Math.PI / 2, lean: 0, left: [-25.25, .18, -27.33], right: [-25.25, .18, -27.97] },
  { time: .8, x: -25, y: 0, z: -27.45, yaw: -Math.PI / 2, lean: .65, left: [-25, .18, -27.05], right: [-25, .18, -27.95] },
  { time: 1.3, x: -24.85, y: .35, z: -27.45, yaw: -Math.PI / 2, lean: 1.1, left: [-25.25, 3.3, -26.85], right: [-24.9, .5, -28] },
  { time: 1.7, x: -24.9, y: .35, z: -27.45, yaw: -Math.PI / 2, lean: 1.35, left: [-26.65, 3.16, -26.85], right: [-24.9, .5, -28] },
  { time: 2, x: -24.9, y: .85, z: -27.45, yaw: -Math.PI / 2, lean: 1.6, left: [-26.8, 3.16, -26.85], right: [-24.9, 3.3, -28] },
  { time: 2.2, x: -25.65, y: .85, z: -27.45, yaw: -Math.PI / 2, lean: 1.2, left: [-27.3, 3.16, -26.85], right: [-25.45, 3.3, -28] },
  { time: 2.7, x: -26.65, y: .9, z: -27.45, yaw: -Math.PI / 2, lean: 1.3, left: [-28.05, 2.1, -26.85], right: [-26.05, 3.16, -28] },
  { time: 3.5, x: -27.55, y: 1.1, z: -27.45, yaw: -Math.PI / 2, lean: .2, left: [-28.8, 1.7, -26.85], right: [-26.8, 3.16, -28] },
  { time: 3.9, x: -28, y: .65, z: -27.45, yaw: -Math.PI / 2, lean: .1, left: [-28.85, 1.2, -26.85], right: [-27.5, 3.3, -28] },
  { time: 4.5, x: -28.7, y: 0, z: -27.45, yaw: -Math.PI / 2, lean: -.12, left: [-28.9, .18, -26.85], right: [-28.2, 1.4, -28] },
  { time: 5.4, x: -29.5, y: 0, z: -27.45, yaw: -Math.PI / 2, lean: .12, left: [-29.7, .18, -26.95], right: [-29.15, .18, -27.95] },
  { time: OFFICE_CROSSING_SECONDS, x: OFFICE_LEDGE_OFFSET, y: 0, z: OFFICE_WINDOW.z, yaw: 0, lean: 0, left: [-29.48, .18, -27], right: [-30.12, .18, -27] },
];
export function officeCrossingPose(elapsed: number) {
  const index = crossingKeys.findIndex(key => key.time >= Math.max(0, elapsed));
  const b = crossingKeys[index < 0 ? crossingKeys.length - 1 : index]; const a = crossingKeys[Math.max(0, index < 0 ? crossingKeys.length - 2 : index - 1)];
  const smooth = (v: number) => { const t = Math.max(0, Math.min(1, v)); return t * t * (3 - 2 * t); };
  const t = a === b ? 0 : smooth((elapsed - a.time) / (b.time - a.time));
  const mix = (x: number, y: number) => x + (y - x) * t;
  const foot = (side: 'left' | 'right'): Vector3 => ({ x: mix(a[side][0], b[side][0]), y: mix(a[side][1], b[side][1]), z: mix(a[side][2], b[side][2]) });
  return { x: mix(a.x, b.x), y: mix(a.y, b.y), z: mix(a.z, b.z), yaw: mix(a.yaw, b.yaw), lean: mix(a.lean, b.lean),
    left: foot('left'), right: foot('right'), hand: { x: -26.05 - .8 * smooth((elapsed - 1.5) / 1.2), y: 2.83, z: -26.85 },
    grip: smooth(elapsed / .7) * (1 - smooth((elapsed - 2.7) / .65)),
    blend: smooth(elapsed / .7) * (1 - smooth((elapsed - 5.4) / 1)) };
}
export function windowOpening(journey: FilmJourney): boolean {
  return !journey.visiting && journey.scene === 'm1_office_escape' && journey.step === 2 && journey.office?.window !== undefined && journey.office.window < OFFICE_WINDOW.seconds && !journey.office.outcome;
}
export function officeWindowPose(elapsed: number): { angle: number; latch: number; handle: Vector3; reach: number } {
  const smooth = (v: number) => { const t = Math.max(0, Math.min(1, v)); return t * t * (3 - 2 * t); };
  const angle = -.66 * smooth((elapsed - 1.2) / 1.6);
  const latch = Math.PI / 2 * smooth((elapsed - .7) / .4);
  const y = OFFICE_WINDOW.handleY - OFFICE_WINDOW.top + .24 * Math.cos(latch);
  return { angle, latch,
    handle: { x: OFFICE_WINDOW.x + .25 * Math.cos(angle) - y * Math.sin(angle), y: OFFICE_WINDOW.top + .25 * Math.sin(angle) + y * Math.cos(angle), z: OFFICE_WINDOW.z + .24 * Math.sin(latch) },
    reach: smooth(elapsed / .65) * (1 - smooth((elapsed - 1.42) / .45)) };
}

// Desks, low partitions and file cabinets are shared by drawing, collision and sight.
export const OFFICE_DESKS = [-16, 16].flatMap(x => [-18, -6, 6, 18].map(z => ({ x, z })));
export const OFFICE_OBSTACLES = OFFICE_DESKS.flatMap(({ x, z }) => [
  { x, z: z - 4, width: 12, depth: .3, height: 3.45, kind: 'panel' as const },
  { x: x + Math.sign(x) * 6, z: z - 1, width: .3, depth: 6, height: 3.45, kind: 'panel' as const },
  { x, z: z - 2, width: 8, depth: 3, height: 2.5, kind: 'desk' as const },
]);
export const OFFICE_PATROLS = [
  [{ x: 0, z: -25 }, { x: OFFICE_CONTACT.x, z: OFFICE_CONTACT.z }],
  [{ x: 3, z: -28 }, { x: 24, z: 20 }],
  [{ x: -3, z: -28 }, { x: 0, z: 20 }],
];
export interface OfficeEncounter {
  alert: number;
  waypoints: number[];
  suspicion: number[];
  lastTick: number;
  searchAt?: number;
  patrolWait?: number[];
  searches?: (OfficeSearch | null)[];
  spotted?: boolean;
  guide: string;
  outcome?: 'escaped' | 'captured';
  bugged?: boolean;
  climbed?: number;
  window?: number;
  crossing?: number;
}
export interface OfficeSearch { position: Vector3; remaining: number; source: 'sight' | 'sound'; facing?: number }
export const OFFICE_LADDER = { x: -3.45, z: 26, depth: 32, speed: 4 };

export function officeOccluded(from: Vector3, to: Vector3, center: Vector3): boolean {
  const length = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
  if (length < .001) return false;
  const direction = { x: (to.x - from.x) / length, y: (to.y - from.y) / length, z: (to.z - from.z) / length };
  const start = { x: from.x - center.x, y: from.y - center.y + 1, z: from.z - center.z };
  return OFFICE_OBSTACLES.some(o => {
    const hit = rayBox(start, direction, { x: o.x - o.width / 2, y: 0, z: o.z - o.depth / 2 },
      { x: o.x + o.width / 2, y: o.height, z: o.z + o.depth / 2 });
    return hit !== undefined && hit < length;
  });
}
