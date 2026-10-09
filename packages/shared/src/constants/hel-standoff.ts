export const HEL_TERRACE = { width: 23, front: -23.2, tread: 1.6, rise: .4, count: 4, back: -45.5 } as const;
export const HEL_DISARM = { seconds: 3.5, release: 1.35, fall: .5, pickup: 2.25 } as const;
export const HEL_TRIO = ['trinity', 'morpheus', 'seraph'] as const;
export type HelDisarmRole = typeof HEL_TRIO[number];
export interface HelDisarm {
  elapsed: number;
  starts: Record<HelDisarmRole, { x: number; y: number; z: number; yaw: number }>;
}
export type HelDisarmGesture = HelDisarm & { role: HelDisarmRole };
export const HEL_BREAKOUT = { kick: .55, recover: .95, flight: 2.8, catch: .65, slowMotion: .5 } as const;
export type HelGunPose = { x: number; y: number; z: number; pitch: number; yaw: number; roll: number };
export interface HelBreakout {
  starts: HelDisarm['starts'];
  source: HelGunPose;
  guard: HelDisarm['starts']['trinity'];
  caught?: HelGunPose;
  catchRoot?: HelDisarm['starts']['trinity'];
}
export type HelBreakoutGesture = { role: 'trinity' | 'seraph'; phase: 'airborne' | 'catching'; elapsed: number; breakout: HelBreakout };
const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };

export function helTerraceFloor(x: number, z: number): number {
  if (Math.abs(x) > HEL_TERRACE.width / 2 || z > HEL_TERRACE.front || z < HEL_TERRACE.back) return 0;
  return Math.min(HEL_TERRACE.count, 1 + Math.floor((HEL_TERRACE.front - z) / HEL_TERRACE.tread)) * HEL_TERRACE.rise;
}
export function helSoleFloor(x: number, z: number, yaw: number): number {
  return Math.max(...[-.2, .2].flatMap(side => [-.2, .6].map(forward =>
    helTerraceFloor(x + side * Math.cos(yaw) + forward * Math.sin(yaw), z - side * Math.sin(yaw) + forward * Math.cos(yaw)))));
}
export function helDisarmGun(state: HelDisarm, role: HelDisarmRole) {
  const start = state.starts[role], t = Math.max(0, state.elapsed - HEL_DISARM.release);
  const lift = smooth((state.elapsed - HEL_DISARM.pickup) / (HEL_DISARM.seconds - HEL_DISARM.pickup));
  const x = start.x - .55 * Math.cos(start.yaw) + .75 * Math.sin(start.yaw);
  const z = start.z + .55 * Math.sin(start.yaw) + .75 * Math.cos(start.yaw);
  const floor = Math.max(...[-.5, .5].flatMap(dx => [-.5, .5].map(dz => helTerraceFloor(x + dx, z + dz)))) + .085, released = start.y + 2.6;
  const fall = Math.min(1, t / Math.sqrt(Math.max(.001, 2 * (released - floor) / 9.81)));
  const collector = helDisarmCollector(state, role), side = role === 'morpheus' ? -1 : 1;
  return { x: x + lift * side * .6, y: Math.max(floor, released - 4.905 * t * t) + lift * 2.2,
    z, pitch: (1 - smooth(fall)) * 1.05,
    yaw: start.yaw + Math.atan2(Math.sin(collector.yaw - start.yaw), Math.cos(collector.yaw - start.yaw)) * lift,
    roll: Math.PI / 2 * smooth(fall) * (1 - lift) };
}
export function helDisarmCollector(state: HelDisarm, role: HelDisarmRole) {
  const start = state.starts[role], side = role === 'morpheus' ? -1 : 1;
  const x = start.x - .55 * Math.cos(start.yaw) + .75 * Math.sin(start.yaw) + side * 1.15;
  const z = start.z + .55 * Math.sin(start.yaw) + .75 * Math.cos(start.yaw) - .15;
  return { x, z, y: helTerraceFloor(x, z), yaw: Math.atan2(start.x - x, start.z - z) };
}
export function helDisarmText(elapsed: number): string {
  return elapsed < HEL_DISARM.release ? '慢慢放低枪口' : elapsed < HEL_DISARM.release + HEL_DISARM.fall
    ? '松手，让武器落地' : elapsed < HEL_DISARM.pickup ? '人群伸手收走武器' : '放开双手，等待对方的条件';
}

/** The same saved pistol travels from the collector's hand to Trinity's reach.
 * Film slow motion changes clock speed; the arc still uses gravity. */
export function helBreakoutGun(state: HelBreakout, elapsed: number): HelGunPose {
  if (elapsed <= HEL_BREAKOUT.kick) return { ...state.source };
  const start = state.source, actor = state.starts.trinity;
  const end = { x: actor.x - .5 * Math.cos(actor.yaw) + 1.05 * Math.sin(actor.yaw),
    y: actor.y + 3.6, z: actor.z + .5 * Math.sin(actor.yaw) + 1.05 * Math.cos(actor.yaw) };
  const p = Math.min(1, (elapsed - HEL_BREAKOUT.kick) / HEL_BREAKOUT.flight);
  const duration = HEL_BREAKOUT.flight * HEL_BREAKOUT.slowMotion, t = p * duration;
  const vy = (end.y - start.y + 4.905 * duration * duration) / duration;
  return { x: start.x + (end.x - start.x) * p, y: start.y + vy * t - 4.905 * t * t,
    z: start.z + (end.z - start.z) * p, pitch: start.pitch * (1 - p),
    yaw: start.yaw + Math.atan2(Math.sin(actor.yaw - start.yaw), Math.cos(actor.yaw - start.yaw)) * p,
    roll: start.roll * (1 - p) + Math.sin(p * Math.PI) * Math.PI * 2 };
}

export function helBreakoutGuard(start: HelDisarm['starts']['trinity'], elapsed = 0) {
  const recoil = smooth((elapsed - .3) / .5), x = start.x + .55 + recoil * .2, z = start.z - .85 - recoil * .45;
  return { x, y: helTerraceFloor(x, z), z, yaw: Math.atan2(start.x - x, start.z - z), recoil };
}
