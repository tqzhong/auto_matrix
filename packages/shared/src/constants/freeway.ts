export const FREEWAY_START = 660;
export const FREEWAY_FINISH = -660;
export const FREEWAY_LANES = [-22, -14, -6, 6, 14, 22];
export const FREEWAY_BIKE = { rider: -.65, passenger: -1.9 } as const;
export interface DriveInput { throttle: number; steer: number; brake: boolean; lift?: number; roll?: number }
export interface FreewayRide {
  x: number; z: number; speed: number; lateral: number; elapsed: number;
  hull: number; passenger: number; cooldown: number; hits: number;
  phase: 'riding' | 'arrived' | 'wrecked';
  obstacles?: FreewayTraffic[];
  startedAt?: number; bank?: number; braking?: number;
}
export interface FreewayTraffic { id: number; x: number; z: number; speed: number; truck: boolean; color: number; depth?: number }
const colors = [0x949b8c, 0x24382d, 0xa6a49a, 0x45494a, 0x6a5550, 0xd3cabe];
export function freewayTraffic(elapsed: number, obstacles: FreewayTraffic[] = []): FreewayTraffic[] {
  return Array.from({ length: 30 }, (_, id) => {
    const lane = id % 6; const speed = lane < 3 ? -19 - id % 5 : 18 + id % 6;
    const initial = -690 + Math.floor(id / 6) * 282 + lane * 43;
    const x = FREEWAY_LANES[lane], z = ((initial + speed * elapsed + 800) % 1600 + 1600) % 1600 - 800;
    const occupied = obstacles.some(car => Math.abs(car.x - x) < 5 && Math.abs(car.z - z) < 28);
    return { id, x, z: occupied ? z - 500 : z, speed, truck: id % 7 === 0, color: colors[id % colors.length] };
  });
}
export function newFreewayRide(): FreewayRide {
  return { x: 14, z: FREEWAY_START, speed: 0, lateral: 0, elapsed: 0, hull: 100, passenger: 100, cooldown: 0, hits: 0, phase: 'riding' };
}
export function freewayRideBike(ride: FreewayRide) {
  const roll = ride.bank ?? ride.lateral * .025;
  return { x: ride.x, y: .31 * Math.abs(Math.sin(roll)), z: ride.z,
    yaw: Math.PI - Math.atan2(ride.lateral, Math.max(1, ride.speed)), pitch: 0, roll };
}
export function freewayRideRoot(ride: FreewayRide, role: 'trinity' | 'keymaker') {
  const bike = freewayRideBike(ride), seat = role === 'trinity' ? FREEWAY_BIKE.rider : FREEWAY_BIKE.passenger;
  const x = -.9 * Math.sin(bike.roll), y = .9 * Math.cos(bike.roll);
  return { x: bike.x + x * Math.cos(bike.yaw) + seat * Math.sin(bike.yaw), y: bike.y + y,
    z: bike.z - x * Math.sin(bike.yaw) + seat * Math.cos(bike.yaw), yaw: bike.yaw };
}
function bikeBounds(ride: FreewayRide) {
  const { yaw, roll } = freewayRideBike(ride), c = Math.abs(Math.cos(yaw)), s = Math.abs(Math.sin(yaw));
  const width = 1.25 * Math.cos(roll) + 4.3 * Math.abs(Math.sin(roll));
  return { x: width * c + 3.4 * s, z: 3.4 * c + width * s };
}
function sweptContact(x: number, z: number, dx: number, dz: number, width: number, length: number) {
  let enter = 0, exit = 1, axis: 'x' | 'z' = 'z', sign = z < 0 ? -1 : 1;
  for (const [name, at, move, extent] of [['x', x, dx, width], ['z', z, dz, length]] as const) {
    if (Math.abs(move) < 1e-8) { if (Math.abs(at) >= extent) return; continue; }
    const first = (-extent - at) / move, last = (extent - at) / move;
    const low = Math.min(first, last), high = Math.max(first, last);
    if (low > enter) { enter = low; axis = name; sign = move > 0 ? -1 : 1; }
    exit = Math.min(exit, high); if (enter > exit) return;
  }
  if (exit <= 0 || enter > 1) return;
  if (enter === 0 && Math.abs(x) < width && Math.abs(z) < length) {
    if (Math.abs(x) / width > Math.abs(z) / length) { axis = 'x'; sign = x < 0 ? -1 : 1; }
  }
  return { axis, sign };
}
export function stepFreeway(ride: FreewayRide, input: DriveInput, delta: number, finish = FREEWAY_FINISH): FreewayRide {
  if (ride.phase !== 'riding' || delta <= 0) return ride;
  const dt = Math.min(.1, Math.max(0, delta));
  const next = { ...ride, elapsed: ride.elapsed + dt, cooldown: Math.max(0, ride.cooldown - dt) };
  next.speed = Math.max(0, Math.min(44, ride.speed + (input.brake ? -38 : input.throttle > 0 ? 17 : -5) * dt));
  const steer = Math.max(-1, Math.min(1, input.steer));
  next.lateral += (steer * Math.min(11, next.speed * .52) - next.lateral) * (1 - Math.exp(-8 * dt));
  next.bank = (ride.bank ?? ride.lateral * .025) + (steer * Math.min(.36, next.speed * .012) - (ride.bank ?? ride.lateral * .025)) * (1 - Math.exp(-5 * dt));
  next.braking = (ride.braking ?? 0) + (Number(input.brake && next.speed > 1) - (ride.braking ?? 0)) * (1 - Math.exp(-7 * dt));
  next.x += next.lateral * dt; next.z -= next.speed * dt;
  const bounds = bikeBounds(next), beforeBounds = bikeBounds(ride);
  const left = Math.max(3.5, 1 + bounds.x + .1), right = Math.min(26.5, 28.1 - bounds.x - .1);
  let impactSpeed = next.x < left || next.x > right ? ride.speed : 0;
  next.x = Math.max(left, Math.min(right, next.x));
  for (const car of [...freewayTraffic(next.elapsed, ride.obstacles), ...(ride.obstacles ?? [])]) {
    if (car.x < 0) continue;
    const width = (car.truck ? 2.8 : 2.45) + Math.max(bounds.x, beforeBounds.x) + .1;
    const length = (car.depth ? car.depth / 2 : car.truck ? 8.75 : 4.65) + Math.max(bounds.z, beforeBounds.z) + .1;
    const x = ride.x - car.x, z = ride.z - (car.z - car.speed * dt);
    const hit = sweptContact(x, z, next.x - car.x - x, next.z - car.z - z, width, length);
    if (!hit) continue;
    impactSpeed = Math.max(impactSpeed, next.speed + car.speed);
    const side = car.x + hit.sign * (width + .02);
    if (hit.axis === 'x' && side >= left && side <= right) next.x = side;
    else next.z = car.z + (hit.axis === 'z' ? hit.sign : z < 0 ? -1 : 1) * (length + .02);
  }
  if (impactSpeed > 1 && !next.cooldown) {
    const damage = 10 + Math.min(44, impactSpeed) * .35;
    next.hull = Math.max(0, next.hull - damage); next.passenger = Math.max(0, next.passenger - damage * .5);
    next.speed *= .28; next.lateral *= .28; next.cooldown = 1.5; next.hits++;
  }
  if (next.hull <= 0 || next.passenger <= 0) { next.phase = 'wrecked'; next.speed = 0; next.lateral = 0; }
  else if (next.z <= finish) { next.phase = 'arrived'; next.z = finish; }
  return next;
}
