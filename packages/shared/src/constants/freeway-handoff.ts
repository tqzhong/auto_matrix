import { freewayRideRoot, stepFreeway, type DriveInput, type FreewayRide, type FreewayTraffic } from './freeway.js';
import { TRUCKS } from './trucks.js';
import type { FilmJourney } from './film-story.js';

export const FREEWAY_HANDOFF = { lane: 13.7, side: 4.4, reach: .65, lift: 2.4, exit: 2.5, speed: 24 } as const;
export type FreewayHandoffRole = 'trinity' | 'keymaker' | 'morpheus';
export interface FreewayHandoff {
  phase: 'approach' | 'reaching' | 'lifting' | 'departing' | 'done' | 'failed';
  bike: FreewayRide; truck: { x: number; z: number; speed: number };
  elapsed: number; total: number; attempt: number; startedAt?: number;
  checkpoint: FreewayRide; passengerStart?: { x: number; y: number; z: number; yaw: number };
  paused?: string; unavailable?: string; failure?: string;
}
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
export function freewayHandoffActive(journey: FilmJourney | undefined): boolean {
  return journey?.scene === 'm2_freeway' && journey.step === 2 && !journey.visiting && Boolean(journey.freewayHandoff);
}
export function newFreewayHandoff(ride: FreewayRide, attempt = 1): FreewayHandoff {
  const bike = { ...ride, phase: 'riding' as const, cooldown: 0, speed: Math.max(18, ride.speed), lateral: 0 };
  return { phase: 'approach', bike, truck: { x: FREEWAY_HANDOFF.lane, z: bike.z - 235, speed: FREEWAY_HANDOFF.speed },
    elapsed: 0, total: 0, attempt, checkpoint: { ...bike } };
}
export function freewayHandoffVehicle(state: FreewayHandoff): FreewayTraffic {
  return { id: 101, x: state.truck.x, z: state.truck.z - .2, speed: state.truck.speed, truck: true, color: 0x32433e, depth: 28.5 };
}
export function freewayHandoffReady(state: FreewayHandoff): boolean {
  const passenger = freewayRideRoot(state.bike, 'keymaker');
  return state.phase === 'approach' && !state.paused && !state.unavailable
    && Math.abs(passenger.x - state.truck.x - FREEWAY_HANDOFF.side) < .75
    && Math.abs(passenger.z - (state.truck.z - 3.5)) < 4.5
    && Math.abs(state.bike.bank ?? 0) < .1 && Math.abs(state.bike.lateral) < 2 && state.bike.speed >= 12;
}
export function freewayHandoffRoot(state: FreewayHandoff, role: FreewayHandoffRole) {
  if (role === 'trinity') return freewayRideRoot(state.bike, role);
  const leaning = state.phase === 'reaching' ? smooth(state.elapsed / FREEWAY_HANDOFF.reach)
    : state.phase === 'lifting' ? 1 - smooth((state.elapsed - 1.7) / .7) : 0;
  if (role === 'morpheus') return { x: state.truck.x + .3 + leaning * 1.55, y: TRUCKS.roof.height,
    z: state.truck.z - 3.5, yaw: Math.PI / 2 };
  const seat = freewayRideRoot(state.bike, 'keymaker');
  if (state.phase === 'approach' || state.phase === 'failed' && !state.passengerStart) return seat;
  if (state.phase === 'reaching') return { ...seat, y: seat.y + 1.55 * smooth(state.elapsed / FREEWAY_HANDOFF.reach) };
  const start = state.passengerStart ?? seat, lift = state.phase === 'lifting' ? smooth(state.elapsed / FREEWAY_HANDOFF.lift) : 1;
  // Lift outside the trailer first; only cross the edge after the boots clear its roof.
  const across = smooth((lift - .65) / .35);
  const side = state.truck.x + FREEWAY_HANDOFF.side;
  return { x: mix(mix(start.x, side, smooth(lift / .35)), state.truck.x + 1.15, across), y: mix(start.y, TRUCKS.roof.height + .4, smooth(lift / .7)) - .4 * across,
    z: state.truck.z - 3.5 + mix(start.z - (state.truck.z - 3.5), 0, lift)
      + (state.phase === 'departing' ? 2.9 * smooth(state.elapsed / FREEWAY_HANDOFF.exit) : state.phase === 'done' ? 2.9 : 0),
    yaw: mix(start.yaw, 0, across) };
}
export function stepFreewayHandoff(state: FreewayHandoff, input: DriveInput, delta: number): FreewayHandoff {
  if (delta <= 0 || state.paused || state.unavailable || ['done', 'failed'].includes(state.phase)) return state;
  const dt = Math.min(.1, delta), next = { ...state, bike: { ...state.bike }, truck: { ...state.truck }, total: state.total + dt };
  const slow = state.phase === 'approach' && Math.abs(state.bike.z - state.truck.z) < 65 ? .25 : ['reaching', 'lifting'].includes(state.phase) ? .08 : 1;
  const move = dt * slow;
  if (state.phase === 'approach') {
    next.truck.z += next.truck.speed * move;
    next.bike = stepFreeway({ ...state.bike, obstacles: [...(state.checkpoint.obstacles ?? []), freewayHandoffVehicle(next)] }, input, move, -1500);
    if (next.bike.phase === 'wrecked') { next.phase = 'failed'; next.failure = '摩托受损，接应失败。'; }
    else if (next.bike.z + 18 < next.truck.z) { next.phase = 'failed'; next.failure = '错过了卡车侧面的接人窗口，钥匙匠仍在后座。'; }
  } else {
    next.elapsed += dt; next.truck.z += state.truck.speed * move;
    next.bike.z -= state.bike.speed * move; next.bike.elapsed += move;
    if (state.phase === 'reaching' && next.elapsed >= FREEWAY_HANDOFF.reach) {
      next.passengerStart = freewayHandoffRoot({ ...next, elapsed: FREEWAY_HANDOFF.reach }, 'keymaker');
      next.phase = 'lifting'; next.elapsed = 0;
    } else if (state.phase === 'lifting' && next.elapsed >= FREEWAY_HANDOFF.lift) { next.phase = 'departing'; next.elapsed = 0; }
    else if (state.phase === 'departing' && next.elapsed >= FREEWAY_HANDOFF.exit) { next.phase = 'done'; next.elapsed = FREEWAY_HANDOFF.exit; }
  }
  return next;
}
export function freewayHandoffText(state: FreewayHandoff): string {
  if (state.paused) return `${state.paused} 正由另一位玩家控制，换乘进度已保留。`;
  if (state.unavailable) return `${state.unavailable} 无法参与换乘，当前进度已保留。`;
  if (state.phase === 'failed') return `${state.failure} 按 G 或 J 重试这次接应，前面的护送仍保留。`;
  if (state.phase === 'approach') return freewayHandoffReady(state) ? '现在按 G，让 Morpheus 接住钥匙匠！'
    : '迎面卡车上的 Morpheus 正在接应。靠近卡车右侧，稳住车身，经过他身旁时按 G。';
  if (state.phase === 'reaching') return '钥匙匠起身，Morpheus 探身抓住他。';
  if (state.phase === 'lifting') return 'Morpheus 将钥匙匠从后座拉到车顶，Trinity 继续驶离。';
  if (state.phase === 'departing') return '钥匙匠正在车顶站稳，Trinity 继续驶离。';
  return '钥匙匠已到车顶。按 G 确认接应完成，再从手记进入 Morpheus 的车顶战斗。';
}
