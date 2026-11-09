import type { FilmJourney } from './film-story.js';
import { ZION_BEDROOM_DOOR, ZION_CAST } from './zion-homecoming.js';

export const ZION_MESSAGE_ROLES = ['neo', 'trinity', 'ballard', 'malachi'] as const;
export type ZionMessageRole = typeof ZION_MESSAGE_ROLES[number];
export type ZionMessagePhase = 'waiting' | 'approaching' | 'unlatching' | 'opening' | 'entering' | 'presenting' | 'offer' | 'receiveApproach' | 'taking' | 'transfer' | 'stowing' | 'done';
export interface ZionMessageBody { x: number; z: number; yaw: number }
export interface ZionMessageEncounter {
  phase: ZionMessagePhase;
  elapsed: number;
  door: number;
  owner: 'ballard' | 'neo' | 'stowed';
  bodies: Record<ZionMessageRole, ZionMessageBody>;
  cursors: { ballard: number; malachi: number };
}
export type ZionMessageView = Pick<ZionMessageEncounter, 'phase' | 'elapsed' | 'door' | 'owner' | 'bodies'>;
export type ZionMessageGesture = ZionMessageView & { role: ZionMessageRole };
export const ZION_MESSAGE = {
  radius: 1.2, neo: { x: 0, z: 11.5, yaw: 0 }, trinitySpeed: 2.8, guestSpeed: 2.8, injuredSpeed: 1.8,
  unlatch: .8, opening: 3, presenting: .9, approach: .65, taking: .9, transfer: .65, release: .3, stowing: .9,
  handle: { x: 4.25, y: 3.3, z: -.25, radius: .06 }, diskRadius: .14,
  ballardRoute: [{ x: 1.1, z: 19 }, { x: 1.1, z: 16 }, { x: 1.5, z: 13.3 }],
  malachiRoute: [{ x: -1.1, z: 19.2 }, { x: -1.1, z: 17 }, { x: -.9, z: 15.8 }],
};
const smooth = (n: number) => { const t = Math.max(0, Math.min(1, n)); return t * t * (3 - 2 * t); };
export function zionMessageActive(journey?: FilmJourney): boolean { return journey?.scene === 'm2_oracle_message' && !journey.visiting; }
export function zionMessageLocked(state?: ZionMessageView): boolean { return Boolean(state && !['waiting', 'offer', 'done'].includes(state.phase)); }
export function zionMessageAngle(door: number): number { return door * ZION_BEDROOM_DOOR.openYaw; }
export function zionMessageTrinity(door: number): ZionMessageBody {
  const angle = zionMessageAngle(door), c = Math.cos(angle), s = Math.sin(angle);
  return { x: ZION_BEDROOM_DOOR.hingeX + 3.8 * c - 1.3 * s, z: ZION_BEDROOM_DOOR.z - 3.8 * s - 1.3 * c, yaw: angle };
}
export function zionMessageHandle(door: number) {
  const angle = zionMessageAngle(door), h = ZION_MESSAGE.handle, z = h.z - h.radius;
  return { x: ZION_BEDROOM_DOOR.hingeX + h.x * Math.cos(angle) + z * Math.sin(angle), y: h.y,
    z: ZION_BEDROOM_DOOR.z - h.x * Math.sin(angle) + z * Math.cos(angle) };
}
export function newZionMessage(step = 0): ZionMessageEncounter {
  const cast = ZION_CAST.m2_oracle_message, ballard = ZION_MESSAGE.ballardRoute.at(-1)!, malachi = ZION_MESSAGE.malachiRoute.at(-1)!;
  return { phase: step > 1 ? 'done' : step > 0 ? 'offer' : 'waiting', elapsed: 0, door: step > 0 ? 1 : 0, owner: step > 1 ? 'stowed' : 'ballard',
    bodies: { neo: { ...ZION_MESSAGE.neo }, trinity: step > 0 ? zionMessageTrinity(1) : { ...cast.trinity },
      ballard: step > 0 ? { ...ballard, yaw: Math.atan2(ZION_MESSAGE.neo.x - ballard.x, ZION_MESSAGE.neo.z - ballard.z) } : { ...cast.ballard },
      malachi: step > 0 ? { ...malachi, yaw: Math.atan2(ZION_MESSAGE.neo.x - malachi.x, ZION_MESSAGE.neo.z - malachi.z) } : { ...cast.malachi } }, cursors: { ballard: 0, malachi: 0 } };
}
export function zionMessageProgress(journey?: FilmJourney): ZionMessageEncounter {
  return zionMessageActive(journey) && journey?.zionMessage ? journey.zionMessage : newZionMessage(journey?.scene === 'm2_oracle_message' ? journey.step : 2);
}
function bodyPoint(body: ZionMessageBody, x: number, y: number, z: number) {
  return { x: body.x + x * Math.cos(body.yaw) + z * Math.sin(body.yaw), y, z: body.z - x * Math.sin(body.yaw) + z * Math.cos(body.yaw) };
}
function mix(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }, t: number) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}
export function zionMessageDisk(state: ZionMessageView) {
  const carry = bodyPoint(state.bodies.ballard, .45, 2.65, .18), offer = { x: (state.bodies.ballard.x + ZION_MESSAGE.neo.x) / 2, y: 2.95, z: (state.bodies.ballard.z + ZION_MESSAGE.neo.z) / 2 };
  if (['waiting', 'approaching', 'unlatching', 'opening', 'entering'].includes(state.phase)) return carry;
  if (state.phase === 'presenting') return mix(carry, offer, smooth(state.elapsed / ZION_MESSAGE.presenting));
  if (state.phase === 'stowing' || state.phase === 'done') return mix(offer, bodyPoint(state.bodies.neo, .32, 3.05, .18), state.phase === 'done' ? 1 : smooth(state.elapsed / ZION_MESSAGE.stowing));
  return offer;
}
export function zionMessagePalm(state: ZionMessageGesture) {
  if (state.role === 'trinity') {
    const weight = state.phase === 'unlatching' ? smooth(state.elapsed / ZION_MESSAGE.unlatch) : state.phase === 'opening' ? 1 : state.phase === 'entering' ? 1 - smooth(state.elapsed / .5) : 0;
    return { ...zionMessageHandle(state.door), weight };
  }
  const disk = zionMessageDisk(state), a = state.bodies.ballard, dx = a.x - ZION_MESSAGE.neo.x, dz = a.z - ZION_MESSAGE.neo.z, length = Math.hypot(dx, dz) || 1;
  const offered = ['offer', 'receiveApproach', 'taking', 'transfer', 'stowing', 'done'].includes(state.phase) ? 1 : state.phase === 'presenting' ? smooth(state.elapsed / ZION_MESSAGE.presenting) : 0;
  const edge = state.role === 'ballard' ? offered * .09 : -.09 * (state.phase === 'stowing' ? 1 - smooth(state.elapsed / ZION_MESSAGE.stowing) : 1);
  const weight = state.role === 'ballard' ? state.phase === 'stowing' || state.phase === 'done' ? 0 : state.phase === 'transfer' ? 1 - smooth((state.elapsed - ZION_MESSAGE.release) / (ZION_MESSAGE.transfer - ZION_MESSAGE.release)) : 1
    : state.role === 'neo' ? state.phase === 'taking' ? smooth(state.elapsed / ZION_MESSAGE.taking) : state.phase === 'transfer' || state.phase === 'stowing' ? 1 : 0 : 0;
  return { x: disk.x + dx / length * edge, y: disk.y - .035, z: disk.z + dz / length * edge, weight };
}
export function zionMessageText(state: ZionMessageView): string {
  if (state.phase === 'waiting') return '走到 Trinity 身旁，按 G 回应铁门外的敲击。';
  if (['approaching', 'unlatching', 'opening'].includes(state.phase)) return 'Trinity 正走向门把、拉开铁门。等 Ballard 和 Malachi 进屋。';
  if (state.phase === 'entering' || state.phase === 'presenting') return 'Ballard 和受伤的 Malachi 正穿过门道。Ballard 把带来的磁盘递向 Neo。';
  if (state.phase === 'offer') return '在 Ballard 递出的磁盘旁按 G，伸手接过先知的讯息。';
  if (state.phase === 'done') return 'Neo 已收好先知的磁盘；可以继续前往船坞。';
  return state.owner === 'neo' ? '磁盘已交到 Neo 手中，正在收好。' : 'Neo 正伸手接过磁盘，Ballard 保持托住，等他接稳。';
}
