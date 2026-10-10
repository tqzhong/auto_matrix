import type { FilmJourney } from './film-story.js';
import type { Vector3 } from '../types/agent.js';
import { rayBox } from './lobby.js';

export const DIGGERS = {
  stations: [{ x: -40, z: 27 }, { x: -40, z: -16 }],
  scale: 1,
  knees: [{ x: 47, y: 8, z: -2 }, { x: 47, y: 8, z: -28 }],
  center: { x: 60, y: 22, z: -15 }, limit: 90, loading: 2.6, collapse: 5.5, speed: 62,
  footprint: { x: 55, z: -15, width: 72, depth: 38, height: 44 },
  bay: { left: -53.4, right: 110.4, back: -68.4, front: 68.4 },
  supports: Array.from({ length: 11 }, (_, i) => ({ x: 108.5, z: -65.7 + i * 12, width: 2.4, depth: 1.2, height: 56 })),
  walls: [
    { x: -48, z: 5.5, width: .7, depth: 60, height: 6 },
    { x: -35.8, z: 5.5, width: .8, depth: 34, height: 6 },
    { x: -35.8, z: 33, width: .8, depth: 3, height: 6 },
    { x: -35.8, z: -22, width: .8, depth: 3, height: 6 },
    { x: -41.9, z: 35.5, width: 13, depth: .7, height: 6 },
    { x: -41.9, z: -24.5, width: 13, depth: .7, height: 6 },
    ...[27, -16].map(z => ({ x: -35.8, z, width: .95, depth: 9, height: 1.6 })),
  ],
} as const;
export interface Diggers {
  phase: 'approach' | 'loading' | 'aiming' | 'rocket' | 'relocate' | 'collapsing' | 'done' | 'failed';
  station: 0 | 1; damage: number; load: number; rounds: number; remaining: number;
  elapsed: number; total: number; attempts: number; yaw: number; pitch: number;
  loader?: { x: number; z: number; yaw: number; elapsed: number };
  shot?: { at: number; from: Vector3; to: Vector3; flight: number; result: 'joint' | 'screened' | 'miss' };
}
export type DiggerGesture = Diggers & { role: 'charra' | 'zee' };
export function newDiggers(station: 0 | 1 = 0, attempts = 0): Diggers {
  const origin = DIGGERS.stations[station], knee = DIGGERS.knees[station];
  return { phase: 'approach', station, damage: station ? 1 : 0, load: 0, rounds: 6, remaining: DIGGERS.limit,
    elapsed: 0, total: 0, attempts, yaw: Math.atan2(knee.x - origin.x, knee.z - origin.z), pitch: -.05 };
}
export function diggersActive(journey?: FilmJourney): boolean {
  return Boolean(journey && !journey.visiting && journey.scene === 'm3_diggers' && !journey.completed.includes(journey.scene));
}
export function diggersLocked(state?: Diggers): boolean {
  return Boolean(state && !['approach', 'relocate', 'done'].includes(state.phase));
}
export function diggerLoaderPose(state: Diggers) {
  const setup = state.loader;
  if (!setup) return { x: 0, z: -1.95, yaw: 0, walk: false, brace: 1, ready: true };
  const side = Math.sign(setup.x) || 1;
  const points = [[setup.x, setup.z], [side * 2.15, -2.75], [0, -2.75], [0, -1.95]];
  let remaining = setup.elapsed, yaw = setup.yaw;
  for (let i = 1; i < points.length; i++) {
    const [x, z] = points[i - 1], [endX, endZ] = points[i], dx = endX - x, dz = endZ - z;
    const seconds = Math.hypot(dx, dz) / 2.8, heading = Math.atan2(dx, dz);
    if (remaining < seconds) {
      const t = remaining / seconds, turn = Math.min(1, remaining / .3);
      return { x: x + dx * t, z: z + dz * t,
        yaw: yaw + Math.atan2(Math.sin(heading - yaw), Math.cos(heading - yaw)) * turn,
        walk: true, brace: 0, ready: false };
    }
    remaining -= seconds; yaw = heading;
  }
  const turn = Math.min(1, remaining / .4), brace = Math.max(0, Math.min(1, (remaining - .4) / .45));
  return { x: 0, z: -1.95, yaw: yaw + Math.atan2(Math.sin(-yaw), Math.cos(-yaw)) * turn,
    walk: false, brace: brace * brace * (3 - 2 * brace), ready: brace === 1 };
}
export function diggerEye(state: Diggers): Vector3 {
  const p = DIGGERS.stations[state.station]; return { x: p.x + Math.sin(state.yaw) * .2, y: 4.01, z: p.z + Math.cos(state.yaw) * .2 };
}
export function diggerDirection(yaw: number, pitch: number): Vector3 {
  return { x: Math.sin(yaw) * Math.cos(pitch), y: -Math.sin(pitch), z: Math.cos(yaw) * Math.cos(pitch) };
}
// Coordinates relative to the character's feet; the renderer adds the set's floor offset once.
export function diggerLauncher(state: Diggers) {
  const recoil = state.phase === 'rocket' ? Math.max(0, 1 - state.elapsed / .25) * .14 : 0;
  return { x: -.52, y: 3.5, z: -.1 - recoil, pitch: state.pitch };
}
export function diggerMuzzle(state: Diggers): Vector3 {
  const p = DIGGERS.stations[state.station], gun = diggerLauncher(state), d = diggerDirection(state.yaw, state.pitch);
  return { x: p.x + Math.cos(state.yaw) * gun.x + Math.sin(state.yaw) * gun.z + d.x * 1.6,
    y: gun.y + d.y * 1.6, z: p.z - Math.sin(state.yaw) * gun.x + Math.cos(state.yaw) * gun.z + d.z * 1.6 };
}
export function diggerShield(state: Diggers, time = state.total) {
  const p = DIGGERS.stations[state.station], target = DIGGERS.knees[state.station];
  const dx = target.x - p.x, dz = target.z - p.z, length = Math.hypot(dx, dz);
  const offset = Math.sin((time - .38) * .8) * 8;
  return { x: p.x + dx * .55 + dz / length * offset, y: 5.8,
    z: p.z + dz * .55 - dx / length * offset, offset };
}
function hitSphere(origin: Vector3, direction: Vector3, point: Vector3, radius: number): number {
  const x = origin.x - point.x, y = origin.y - point.y, z = origin.z - point.z;
  const b = x * direction.x + y * direction.y + z * direction.z;
  const discriminant = b * b - (x * x + y * y + z * z - radius * radius);
  return discriminant >= 0 && -b - Math.sqrt(discriminant) > 0 ? -b - Math.sqrt(discriminant) : Infinity;
}
function coverDistance(from: Vector3, direction: Vector3): number {
  let distance = direction.y < 0 ? -from.y / direction.y : Infinity;
  const cover = [...DIGGERS.walls.map(wall => ({ ...wall, y: wall.height / 2 })),
    ...DIGGERS.stations.flatMap(point => [
      { x: -35.8, y: 1.6, z: point.z, width: .95, height: .3, depth: 9 },
      ...[-4.2, 4.2].map(offset => ({ x: -35.8, y: 2.6, z: point.z + offset, width: 1.05, height: 5.9, depth: .35 })),
    ])];
  for (const wall of cover) {
    const hit = rayBox(from, direction, { x: wall.x - wall.width / 2, y: wall.y - wall.height / 2, z: wall.z - wall.depth / 2 },
      { x: wall.x + wall.width / 2, y: wall.y + wall.height / 2, z: wall.z + wall.depth / 2 });
    if (hit !== undefined) distance = Math.min(distance, hit);
  }
  return distance;
}
export function fireDigger(state: Diggers, yaw: number, pitch: number): void {
  if (state.phase !== 'aiming' || !Number.isFinite(yaw) || !Number.isFinite(pitch) || state.rounds < 2) return;
  state.yaw = yaw; state.pitch = Math.max(-.65, Math.min(.5, pitch));
  const eye = diggerEye(state), direction = diggerDirection(state.yaw, state.pitch);
  const joint = hitSphere(eye, direction, DIGGERS.knees[state.station], 1.65 * DIGGERS.scale);
  const screen = hitSphere(eye, direction, diggerShield(state, state.total + .48), 2.3);
  const cover = coverDistance(eye, direction);
  let result: NonNullable<Diggers['shot']>['result'] = cover < Math.min(joint, screen) ? 'miss' : screen < joint && screen < 140 ? 'screened' : joint < Infinity ? 'joint' : 'miss';
  const length = Math.min(140, joint, screen, cover), to = { x: eye.x + direction.x * length, y: eye.y + direction.y * length, z: eye.z + direction.z * length };
  const from = diggerMuzzle(state);
  const range = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z), trajectory = { x: (to.x - from.x) / range, y: (to.y - from.y) / range, z: (to.z - from.z) / range };
  const obstruction = coverDistance(from, trajectory);
  if (obstruction < range - .001) { result = 'miss'; to.x = from.x + trajectory.x * obstruction; to.y = from.y + trajectory.y * obstruction; to.z = from.z + trajectory.z * obstruction; }
  state.shot = { from, to, at: state.total, flight: Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z) / DIGGERS.speed, result };
  state.rounds -= 2; state.phase = 'rocket'; state.elapsed = 0;
}
export function stepDiggers(state: Diggers, seconds: number, focus = false): void {
  if (['approach', 'done', 'failed'].includes(state.phase)) return;
  const dt = Math.max(0, Math.min(.1, seconds)); state.total += dt; state.elapsed += dt;
  if (['loading', 'aiming', 'relocate'].includes(state.phase)) {
    state.remaining = Math.max(0, state.remaining - dt);
    if (!state.remaining) { state.phase = 'failed'; return; }
  }
  if (state.phase === 'loading' && state.loader && !diggerLoaderPose(state).ready) {
    state.loader.elapsed += dt; return;
  }
  if (state.phase === 'loading' && focus) {
    state.load = Math.min(1, state.load + dt / DIGGERS.loading);
    if (state.load >= 1) { state.phase = 'aiming'; state.elapsed = 0; }
  } else if (state.phase === 'rocket' && state.shot && state.elapsed >= state.shot.flight + .4) {
    if (state.shot.result === 'joint') {
      state.damage |= 1 << state.station; state.phase = state.station ? 'collapsing' : 'relocate';
      state.remaining = DIGGERS.limit;
    } else { state.phase = state.rounds ? 'loading' : 'failed'; state.load = 0; }
    state.elapsed = 0;
  } else if (state.phase === 'collapsing' && state.elapsed >= DIGGERS.collapse) { state.phase = 'done'; state.elapsed = DIGGERS.collapse; }
}
export function diggersText(state?: Diggers): string {
  if (!state) return 'Charra 与 Zee 在船坞侧面的防御通道就位。走到第一处射击口，按 G 架起双管发射器。';
  switch (state.phase) {
    case 'approach': return '走到射击口，按 G 架起发射器；Zee 会在后方装弹。';
    case 'loading': return !diggerLoaderPose(state).ready ? 'Zee 正绕到发射器后方。等她站稳，Charra 抬起发射器后，按住 G 装弹。'
      : `按住 G 配合 Zee 装入两发火箭 · ${Math.round(state.load * 100)}%`;
    case 'aiming': return '鼠标瞄准钻机外侧裸露的支腿关节，左键 / T 发射。等哨兵横穿射线后再开火。';
    case 'rocket': return state.shot?.result === 'screened' ? '哨兵扑进火箭航迹！准备重新装弹。' : '火箭正在飞向钻机。';
    case 'relocate': return '第一条支腿已断，钻机仍在维持平衡。沿防御通道向北走到第二处射击口，按 G。';
    case 'collapsing': return '第二个关节被击毁，钻机失去支撑，机身正在倾覆。';
    case 'done': return '第一台钻机已倒下。按 G 接管 Zee，与 Charra 前往上层管线。';
    case 'failed': return state.rounds ? '这个阵位暴露太久。按 J 从当前射击口重试，已摧毁的支腿保留。' : '火箭耗尽。按 J 从当前射击口补给重试，已摧毁的支腿保留。';
  }
}
