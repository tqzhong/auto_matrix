export const FREEWAY_START = 660;
export const FREEWAY_FINISH = -660;
export const FREEWAY_LANES = [-22, -14, -6, 6, 14, 22];
export interface DriveInput { throttle: number; steer: number; brake: boolean }
export interface FreewayRide {
  x: number; z: number; speed: number; lateral: number; elapsed: number;
  hull: number; passenger: number; cooldown: number; hits: number;
  phase: 'riding' | 'arrived' | 'wrecked';
}
export interface FreewayTraffic { id: number; x: number; z: number; speed: number; truck: boolean; color: number }
const colors = [0x949b8c, 0x24382d, 0xa6a49a, 0x45494a, 0x6a5550, 0xd3cabe];
export function freewayTraffic(elapsed: number): FreewayTraffic[] {
  return Array.from({ length: 30 }, (_, id) => {
    const lane = id % 6; const speed = lane < 3 ? -19 - id % 5 : 18 + id % 6;
    const initial = -690 + Math.floor(id / 6) * 282 + lane * 43;
    return { id, x: FREEWAY_LANES[lane], z: ((initial + speed * elapsed + 800) % 1600 + 1600) % 1600 - 800,
      speed, truck: id % 7 === 0, color: colors[id % colors.length] };
  });
}
export function newFreewayRide(): FreewayRide {
  return { x: 14, z: FREEWAY_START, speed: 0, lateral: 0, elapsed: 0, hull: 100, passenger: 100, cooldown: 0, hits: 0, phase: 'riding' };
}
export function stepFreeway(ride: FreewayRide, input: DriveInput, delta: number): FreewayRide {
  if (ride.phase !== 'riding') return ride;
  const dt = Math.min(.1, Math.max(0, delta));
  const next = { ...ride, elapsed: ride.elapsed + dt, cooldown: Math.max(0, ride.cooldown - dt) };
  next.speed = Math.max(0, Math.min(44, ride.speed + (input.brake ? -38 : input.throttle > 0 ? 17 : -5) * dt));
  const steer = Math.max(-1, Math.min(1, input.steer));
  next.lateral += (steer * Math.min(11, next.speed * .52) - next.lateral) * (1 - Math.exp(-8 * dt));
  next.x += next.lateral * dt; next.z -= next.speed * dt;
  let impactSpeed = next.x < 3.5 || next.x > 26.5 ? ride.speed : 0;
  next.x = Math.max(3.5, Math.min(26.5, next.x));
  for (const car of freewayTraffic(next.elapsed)) {
    if (car.x < 0) continue;
    const halfLength = car.truck ? 10 : 5.2;
    // Swept longitudinal bounds keep collisions reliable at lower frame rates.
    const relativeBefore = ride.z - (car.z - car.speed * dt);
    const relativeAfter = next.z - car.z;
    if (Math.abs(next.x - car.x) < (car.truck ? 3.8 : 3.2)
      && Math.min(relativeBefore, relativeAfter) < halfLength + 2.5 && Math.max(relativeBefore, relativeAfter) > -halfLength - 2.5) impactSpeed = Math.max(impactSpeed, next.speed + car.speed);
  }
  if (impactSpeed > 1 && !next.cooldown) {
    const damage = 10 + Math.min(44, impactSpeed) * .35;
    next.hull = Math.max(0, next.hull - damage); next.passenger = Math.max(0, next.passenger - damage * .5);
    next.speed *= .28; next.lateral *= -.3; next.cooldown = 1.5; next.hits++;
  }
  if (next.hull <= 0 || next.passenger <= 0) { next.phase = 'wrecked'; next.speed = 0; next.lateral = 0; }
  else if (next.z <= FREEWAY_FINISH) { next.phase = 'arrived'; next.z = FREEWAY_FINISH; next.speed = 0; next.lateral = 0; }
  return next;
}
