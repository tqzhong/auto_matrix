import type { FilmJourney } from './film-story.js';
import type { PlayerInput } from './city.js';
import { FREEWAY_BIKE, freewayTraffic, type FreewayTraffic } from './freeway.js';

export const FREEWAY_PICKUP = {
  bridge: { x: 14, z: 400, height: 18, edge: 407 },
  carrier: { x: 14, start: 350, speed: 18, width: 7.4, length: 26, deck: 5.8 },
  bike: { x: -1.75, z: 6, rider: FREEWAY_BIKE.rider },
  leap: { speed: 14, lift: 11.4, gravity: 18.5, clearRail: .4 },
  callSeconds: 1.3,
  handoffSeconds: 1.65,
  keyContact: .85,
  shotSeconds: 1.15,
  fireAt: .5,
  mountSeconds: 2.4,
  roadEnd: 1160,
  driver: { x: .9, y: .5, z: 6.2 },
  wheel: { x: .9, y: 3.1, z: 6.8 },
  pedals: { x: .9, y: 1.12, z: 7.2 },
  launchSeconds: (13.5 + 2.2 - 6) / 18 + (4.68 + Math.sqrt(4.68 ** 2 + 2 * 12.5 * 7.1)) / 12.5,
} as const;
export interface FreewayPickup {
  phase: 'ready' | 'bridge' | 'jumping' | 'deck' | 'key' | 'keyhandoff' | 'mounting' | 'mounted' | 'shooting' | 'launching' | 'merging' | 'done' | 'failed';
  elapsed: number; total: number; startedAt?: number; attempts: number; x: number; z: number; heading: number; speed: number;
  walking: number; stride: number; key: boolean; chain: boolean; start?: { x: number; z: number; yaw: number }; shotAt?: number;
  route?: 1;
  chase?: { phase: 'approach' | 'ramming' | 'crossing'; elapsed: number;
    truck: { x: number; z: number; speed: number; yaw: number }; shield: { x: number; z: number; speed: number }; impactAt?: number };
  failedRoots?: Record<'trinity' | 'keymaker', { x: number; y: number; z: number; yaw: number }>;
  failedBike?: { x: number; y: number; z: number; yaw: number; pitch: number };
  paused?: string; unavailable?: string; failure?: string;
}
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));
const smooth = (n: number) => { const t = clamp(n, 0, 1); return t * t * (3 - 2 * t); };
export function newFreewayPickup(attempts = 0): FreewayPickup {
  return { phase: 'ready', elapsed: 0, total: 0, attempts, x: 14, z: 403, heading: 0, speed: 0, walking: 0, stride: 0, key: false, chain: true, route: 1 };
}
export function freewayPickupActive(journey: FilmJourney | undefined): boolean {
  return journey?.scene === 'm2_freeway' && !journey.visiting && journey.step === 0 && Boolean(journey.freewayPickup && journey.freewayPickup.phase !== 'done');
}
export function freewayCarrierZ(state: FreewayPickup): number { return FREEWAY_PICKUP.carrier.start + state.total * FREEWAY_PICKUP.carrier.speed; }
export function freewayPickupBike(state: FreewayPickup): { x: number; y: number; z: number; yaw: number; pitch: number } {
  if (state.phase === 'failed' && state.failedBike) return state.failedBike;
  const c = FREEWAY_PICKUP.carrier, bike = FREEWAY_PICKUP.bike;
  const base: { x: number; y: number; z: number; yaw: number; pitch: number } = { x: c.x + bike.x, y: c.deck, z: freewayCarrierZ(state) + bike.z, yaw: 0, pitch: 0 };
  if (state.phase === 'launching') {
    const t = state.elapsed;
    const takeoff = (13.5 + 2.2 - bike.z) / 18;
    const travel = bike.z + 18 * t;
    base.z = freewayCarrierZ(state) + travel;
    if (t < takeoff) {
      const ramp = (z: number) => clamp((z - 8.5) / 5, 0, 1) * 1.3;
      const front = ramp(travel + 2.2), rear = ramp(travel - 2.2);
      base.pitch = Math.atan2(front - rear, 4.4);
      base.y += (front + rear) / 2 + .98 * (1 - Math.cos(base.pitch));
    } else {
      const air = t - takeoff;
      base.y = Math.max(0, 7.1 + 4.68 * air - .5 * 12.5 * air * air);
      base.pitch = .25 * (1 - smooth(air / 1.2));
    }
  } else if (['merging', 'done'].includes(state.phase)) return { x: state.x, y: 0, z: state.z, yaw: state.heading, pitch: 0 };

  return base;
}
export function freewayPickupRoot(state: FreewayPickup, role: 'trinity' | 'keymaker') {
  if (state.phase === 'failed' && state.failedRoots) return state.failedRoots[role];
  const c = FREEWAY_PICKUP.carrier, passenger = role === 'keymaker';
  let x = state.x, z = state.z, y: number = FREEWAY_PICKUP.bridge.height, yaw = state.heading;
  if (state.phase === 'jumping') {
    const t = state.elapsed;
    z = state.start!.z + FREEWAY_PICKUP.leap.speed * Math.max(0, t - FREEWAY_PICKUP.leap.clearRail);
    y += FREEWAY_PICKUP.leap.lift * t - .5 * FREEWAY_PICKUP.leap.gravity * t * t;
  } else if (['deck', 'key', 'keyhandoff'].includes(state.phase)) {
    z += freewayCarrierZ(state); y = c.deck;
    if (state.phase !== 'deck') yaw = passenger ? Math.atan2(-1.05, 1.8) : Math.atan2(1.05, -1.8);
  }
  else if (['mounting', 'mounted', 'shooting', 'launching', 'merging', 'done'].includes(state.phase)) {
    const bike = freewayPickupBike(state), seat = FREEWAY_PICKUP.bike.rider - (passenger ? 1.25 : 0);
    const seated = { x: bike.x + Math.sin(bike.yaw) * seat, y: bike.y + .9, z: bike.z + Math.cos(bike.yaw) * seat, yaw: bike.yaw };
    if (state.phase !== 'mounting') return seated;
    const t = smooth(state.elapsed / FREEWAY_PICKUP.mountSeconds);
    const start = state.start!;
    return { x: start.x + (passenger ? 1.05 : 0) + (seated.x - start.x - (passenger ? 1.05 : 0)) * t,
      z: freewayCarrierZ(state) + start.z - (passenger ? 1.8 : 0) + (seated.z - freewayCarrierZ(state) - start.z + (passenger ? 1.8 : 0)) * t,
      y: c.deck + .9 * t + Math.sin(t * Math.PI) * .75, yaw: start.yaw * (1 - t) };
  }
  if (passenger) { x += 1.05; z -= 1.8; }
  return { x, y, z, yaw };
}
export function freewayPickupText(state: FreewayPickup): string {
  if (state.paused) return `${state.paused} 正由另一位玩家控制，换乘时钟已暂停。`;
  if (state.unavailable) return `${state.unavailable} 无法同行，已保留当前进度。`;
  if (state.phase === 'merging' && state.chase) return state.chase.phase === 'approach'
    ? '先沿同向车流行驶。Jackson 正在前方卡车内盯着你；向中央护栏旁的窄路肩避开车尾。'
    : state.chase.phase === 'ramming' ? '卡车正向你挤来！沿中央路肩从灰色轿车旁通过，让它挡在你与卡车之间。'
      : '轿车挡住了卡车。S 降速，再 A / D 横穿车道转向；避开实体车辆后逆向脱离。';
  return ({ ready: '运车卡车正接近高架。G 开始观察；走到桥边，等车到桥下后按空格起跳。',
    bridge: 'W 走到桥边。看准下方运车卡车，空格跳下；错过落点会失手。', jumping: '正在跨越护栏落向载货平台，A / D 可以微调落点。',
    deck: '已落上卡车。WASD 沿中间通道走向前排左侧摩托；靠近后 G 检查点火锁。',
    key: state.elapsed < FREEWAY_PICKUP.callSeconds ? 'Trinity 正打电话请 Link 准备开锁程序，钥匙匠拿出钥匙。' : '钥匙匠已经准备好钥匙。G 接过，结束通话并登车。',
    keyhandoff: state.key ? 'Trinity 收回钥匙并准备跨上摩托。' : '钥匙匠递出钥匙，Trinity 伸手接过。',
    mounting: 'Trinity 跨上摩托，钥匙匠登上后座。',
    mounted: state.chain ? '摩托仍被固定链拴住。F 打断前侧固定链，再按 W 加速驶出。' : '固定链已断。W 加速，从前方货台驶出。',
    shooting: state.chain ? 'Trinity 拔出手枪，瞄准前侧固定链。' : '固定链被击断，Trinity 收枪并握回车把。',
    launching: '沿货台坡道飞出车头，落地后由你控制方向。', merging: '已进入车流。先 S 刹车降速，再 A / D 掉头，W 加速逆向护送钥匙匠。',
    done: '换乘完成。W 加速，S 刹车，A / D 躲避逆向车流。', failed: `${state.failure ?? '没有落到载货平台。'} G 从高架重试。` } as Record<FreewayPickup['phase'], string>)[state.phase];
}
export function freewayPursuitVehicles(state: FreewayPickup): FreewayTraffic[] {
  if (!state.chase) return [];
  return [{ id: 100, ...state.chase.truck, truck: true, color: 0x384747 },
    { id: 101, ...state.chase.shield, truck: false, color: 0x949b8c }];
}
export function freewayDriverRoot(state: FreewayPickup) {
  const truck = state.chase!.truck, seat = FREEWAY_PICKUP.driver, c = Math.cos(truck.yaw), s = Math.sin(truck.yaw);
  return { x: truck.x + seat.x * c + seat.z * s, y: seat.y, z: truck.z + seat.z * c - seat.x * s, yaw: truck.yaw };
}
export function freewayPickupTraffic(state: FreewayPickup): FreewayTraffic[] {
  return freewayTraffic(state.total, freewayPursuitVehicles(state)).map(car => {
    // The staged carrier and pursuit replace traffic occupying their exact space, in both physics and rendering.
    const occupied = Math.abs(car.x - FREEWAY_PICKUP.carrier.x) < 4 && Math.abs(car.z - freewayCarrierZ(state)) < 40;
    return occupied ? { ...car, z: car.z - 500 } : car;
  });
}
export function stepFreewayPickup(state: FreewayPickup, input: Partial<PlayerInput>, delta: number): FreewayPickup {
  if (delta <= 0 || state.paused || state.unavailable || ['ready', 'failed', 'done'].includes(state.phase)) return state;
  const dt = clamp(delta, 0, .1), next = { ...state, total: state.total + dt, elapsed: state.elapsed + dt };
  next.walking = 0;
  if (state.phase === 'bridge') {
    next.x = clamp(state.x + (input.x ?? 0) * 4 * dt, 11.7, 15.7);
    next.z = clamp(state.z + (input.z ?? 0) * 4 * dt, 396, FREEWAY_PICKUP.bridge.edge);
    if (input.jump && next.z >= 406) { next.phase = 'jumping'; next.elapsed = 0; next.start = { x: next.x, z: next.z, yaw: 0 }; }
    else if (freewayCarrierZ(next) > 430) { next.phase = 'failed'; next.failure = '卡车已驶过可用的起跳窗口。'; }
  } else if (state.phase === 'jumping') {
    next.x += (input.x ?? 0) * 3 * dt;
    const root = freewayPickupRoot(next, 'trinity');
    if (root.y <= FREEWAY_PICKUP.carrier.deck && next.elapsed > 1) {
      const relativeZ = root.z - freewayCarrierZ(next);
      if (Math.abs(next.x - 14) > 1.7 || relativeZ < -11 || relativeZ > -2) { next.phase = 'failed'; next.failure = '没有落到卡车后方的空载平台。'; }
      else { next.phase = 'deck'; next.z = relativeZ; next.elapsed = 0; }
    }
  } else if (state.phase === 'deck') {
    next.x = clamp(state.x + (input.x ?? 0) * 3 * dt, 11.4, 16.6);
    next.z = clamp(state.z + (input.z ?? 0) * 3 * dt, -11, 6.8);
    // The rear landing platform is open; cargo occupies both sides farther forward.
    if (state.z > -5) next.x = clamp(next.x, 13.85, 14.15);
    if (next.z > -5 && (next.x < 13.85 || next.x > 14.15)) next.z = Math.min(next.z, -5);
    next.heading = Math.hypot(input.x ?? 0, input.z ?? 0) > .1 ? Math.atan2(input.x ?? 0, input.z ?? 0) : state.heading;
  } else if (state.phase === 'keyhandoff') {
    if (next.elapsed >= FREEWAY_PICKUP.keyContact) next.key = true;
    if (next.elapsed >= FREEWAY_PICKUP.handoffSeconds) { next.phase = 'mounting'; next.elapsed = 0; next.start = { x: state.x, z: state.z, yaw: freewayPickupRoot(state, 'trinity').yaw }; }
  } else if (state.phase === 'mounting' && next.elapsed >= FREEWAY_PICKUP.mountSeconds) { next.phase = 'mounted'; next.elapsed = 0; }
  else if (state.phase === 'shooting') {
    if (state.chain && next.elapsed >= FREEWAY_PICKUP.fireAt) { next.chain = false; next.shotAt = state.total + FREEWAY_PICKUP.fireAt - state.elapsed; }
    if (next.elapsed >= FREEWAY_PICKUP.shotSeconds) { next.phase = 'mounted'; next.elapsed = 0; }
  }
  else if (state.phase === 'mounted' && !state.chain && (input.drive?.throttle ?? input.z ?? 0) > .1) { next.phase = 'launching'; next.elapsed = 0; }
  else if (state.phase === 'launching' && next.elapsed >= FREEWAY_PICKUP.launchSeconds) {
    const bike = freewayPickupBike({ ...next, elapsed: FREEWAY_PICKUP.launchSeconds });
    next.phase = 'merging'; next.elapsed = 0; next.x = bike.x; next.z = bike.z; next.heading = 0; next.speed = 36;
    if (state.route) next.chase = { phase: 'approach', elapsed: 0,
      truck: { x: 14, z: bike.z + 20, speed: 20, yaw: 0 }, shield: { x: 6, z: bike.z + 90, speed: 12 } };
  } else if (state.phase === 'merging') {
    const drive = input.drive;
    next.speed = clamp(state.speed + (drive?.brake ? -38 : (drive?.throttle ?? 0) > 0 ? 8 : -4) * dt, 0, 44);
    next.heading -= (drive?.steer ?? 0) * Math.min(state.chase?.phase === 'crossing' ? 2.8 : 1.8, next.speed * .32) * dt;
    next.x += Math.sin(next.heading) * next.speed * dt; next.z += Math.cos(next.heading) * next.speed * dt;
    if (state.chase) {
      const previous = state.chase, chase = next.chase = { ...previous, elapsed: previous.elapsed + dt,
        truck: { ...previous.truck }, shield: { ...previous.shield } };
      if (chase.phase === 'approach' && chase.elapsed >= 1.2) { chase.phase = 'ramming'; chase.elapsed = 0; }
      if (chase.impactAt === undefined) {
        chase.shield.z += chase.shield.speed * dt;
        const change = chase.phase === 'approach' ? 0 : clamp(8.5 - chase.truck.x, -3.6 * dt, 3.6 * dt);
        chase.truck.x += change; chase.truck.speed = chase.phase === 'approach' ? 20 : 28;
        chase.truck.yaw = Math.atan2(change / dt, chase.truck.speed); chase.truck.z += chase.truck.speed * dt;
        if (Math.abs(chase.truck.x - chase.shield.x) < 4.7 && chase.truck.z + 13.1 >= chase.shield.z) {
          chase.truck.z = chase.shield.z - 13.1; chase.truck.speed = chase.shield.speed = 0; chase.truck.yaw = 0; chase.impactAt = next.total;
        }
      }
      if (chase.impactAt !== undefined && next.z > chase.shield.z + 10 && next.x < 7 && chase.phase !== 'crossing') {
        chase.phase = 'crossing'; chase.elapsed = 0;
      }
      const vehicles = [...freewayPickupTraffic(next), ...freewayPursuitVehicles(next)];
      const collided = vehicles.some(car => {
        if (car.x < 0) return false;
        const before = state.z - (car.id >= 100 ? car.id === 100 ? previous.truck.z : previous.shield.z : car.z - car.speed * dt);
        const after = next.z - car.z;
        return Math.abs(next.x - car.x) < (car.truck ? 3.8 : 3.2)
          && Math.min(before, after) < (car.truck ? 11.3 : 7.7) && Math.max(before, after) > -(car.truck ? 11.3 : 7.7);
      });
      if (collided) { next.phase = 'failed'; next.failure = '摩托撞上实体车辆。沿窄路肩避开卡车和轿车，再从高架重试。'; }
      else if (next.x < 2.25 || next.x > 26.1 || Math.abs(next.z) > FREEWAY_PICKUP.roadEnd) { next.phase = 'failed'; next.failure = '摩托撞上护栏或错过了脱离车流的区域。'; }
      else if (chase.phase === 'crossing' && Math.cos(next.heading) < -.95 && next.speed > 2) next.phase = 'done';
      if (next.phase === 'failed') {
        next.x = state.x; next.z = state.z; next.heading = state.heading;
        next.chase = state.chase; next.total = state.total; next.elapsed = state.elapsed;
      }
    } else {
      if (next.x < 3.6 || next.x > 26.4 || next.z > 770) { next.phase = 'failed'; next.failure = '摩托撞上护栏，换乘失败。'; }
      else if (Math.cos(next.heading) < -.95 && next.speed > 2) next.phase = 'done';
    }
  }
  if (['bridge', 'deck'].includes(state.phase) && next.phase === state.phase && dt > 0) {
    const distance = Math.hypot(next.x - state.x, next.z - state.z);
    next.stride += distance; next.walking = distance / dt;
  }
  if (['deck', 'key', 'keyhandoff', 'mounting', 'mounted', 'shooting'].includes(next.phase) && freewayCarrierZ(next) > 705) { next.phase = 'failed'; next.failure = '错过了安全取车区。'; }
  if (next.phase === 'failed' && state.phase !== 'failed') {
    const beforeFailure = { ...next, phase: state.phase };
    next.failedRoots = { trinity: freewayPickupRoot(beforeFailure, 'trinity'), keymaker: freewayPickupRoot(beforeFailure, 'keymaker') };
    next.failedBike = freewayPickupBike(beforeFailure);
  }
  return next;
}
