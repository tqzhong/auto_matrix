import type { Vector3 } from '../types/agent.js';
import type { FilmJourney } from './film-story.js';

export const BASEMENT_ROLES = ['neo', 'trinity', 'apoc', 'switch', 'cypher'] as const;
export type BasementRole = typeof BASEMENT_ROLES[number];
export type BasementPhase = 'ready' | 'descending' | 'landing' | 'searching' | 'lifting' | 'hatch_ready' | 'draining' | 'tunnel' | 'done' | 'failed';
export interface BasementEncounter {
  phase: BasementPhase; elapsed: number; attempts: number; air: number; gas: number; hatch: number; separated: boolean; paused?: boolean;
  starts: Record<BasementRole, Vector3 & { yaw: number }>;
  heights: Record<BasementRole, number>; landings: Partial<Record<BasementRole, number>>; company: Record<BasementRole, number>;
  drainStarts?: Record<BasementRole, Vector3 & { yaw: number }>; tunnel: number;
  checkpoint: 'shaft' | 'floor' | 'tunnel'; failure?: 'fall' | 'gas'; fallY?: number; fallSpeed?: number;
}
export interface BasementGesture {
  role: BasementRole; phase: BasementPhase; elapsed: number; hatch: number; crawling?: boolean; landing?: number; paused?: boolean; crouching?: boolean;
}
export const BASEMENT = {
  floor: -96.2, ceiling: 8.8, tunnelFloor: -102.2, tunnelHeight: 3.35, descentSpeed: 2.7, guideSpeed: 4.1, liftSeconds: 5.2,
  grate: { x: 9, z: 26, width: 3.4, depth: 3.4, hingeZ: 27.7, angle: 1.42 },
  approach: { x: 9, z: 22.5 },
  landing: { neo: { x: -15.5, z: -29 }, trinity: { x: -20.5, z: -29 }, apoc: { x: -20.5, z: -22 },
    switch: { x: -15.5, z: -25.5 }, cypher: { x: -18, z: -32.2 } },
  waiting: { neo: { x: 9, z: 22.5 }, trinity: { x: 6.8, z: 26.5 }, apoc: { x: 3, z: 29 }, switch: { x: 3, z: 25 }, cypher: { x: 0, z: 14 } },
} as const;
export const BASEMENT_BOILERS = [-10, 10].flatMap(x => [-12, 12].map(z => ({ x, z, width: 6, depth: 13, height: 6.2 })));
export const BASEMENT_GAS = [{ x: -17, z: -27, at: 2 }, { x: -1, z: 2, at: 14 }, { x: 11, z: 22, at: 28 }] as const;
export const BASEMENT_TUNNEL = [{ x: 9, z: 26 }, { x: 9, z: 30 }, { x: 0, z: 30 }, { x: 0, z: 32.2 }] as const;
export const BASEMENT_TUNNEL_FLOORS = [
  { x: 9, z: 28, width: 4.6, depth: 8.6 }, { x: 4.5, z: 30, width: 13.6, depth: 4.6 }, { x: 0, z: 31.1, width: 4.6, depth: 6.8 },
  { x: 0, z: 38.6, width: 4.6, depth: 16.8 },
] as const;
const smooth = (value: number): number => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
function pathRoot(points: readonly { x: number; z: number }[], progress: number) {
  let left = Math.max(0, progress);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], span = Math.hypot(b.x - a.x, b.z - a.z);
    if (left > span && i < points.length - 1) { left -= span; continue; }
    const t = span ? Math.min(1, left / span) : 1;
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, yaw: Math.atan2(b.x - a.x, b.z - a.z) };
  }
  return { ...points.at(-1)!, yaw: 0 };
}
const pathLength = (points: readonly { x: number; z: number }[]) => points.slice(1).reduce((sum, point, i) => sum + Math.hypot(point.x - points[i].x, point.z - points[i].z), 0);
export function basementRoute(role: BasementRole) {
  if (role === 'cypher') return [BASEMENT.landing.cypher, { x: -18, z: -29 }, { x: -20.5, z: -29 }, { x: -20.5, z: -32.2 }];
  const lane = ({ neo: -18, trinity: -20.5, apoc: -17.8, switch: -15.5 } as const)[role];
  const turn = ({ neo: 2, trinity: 2.8, apoc: -.2, switch: -3.2 } as const)[role];
  const aisle = ({ neo: 0, trinity: 0, apoc: 3.3, switch: -3.3 } as const)[role];
  return [BASEMENT.landing[role], { x: lane, z: BASEMENT.landing[role].z }, { x: lane, z: turn }, { x: aisle, z: turn }, { x: aisle, z: 24 }, BASEMENT.waiting[role]];
}
export function basementRouteLength(role: BasementRole): number { return pathLength(basementRoute(role)); }
export function basementRouteRoot(role: BasementRole, progress: number) { return { ...pathRoot(basementRoute(role), progress), y: BASEMENT.floor }; }
export const BASEMENT_TUNNEL_LENGTH = pathLength(BASEMENT_TUNNEL);
export function basementTunnelRoot(progress: number) {
  const root = pathRoot(BASEMENT_TUNNEL, progress);
  if (progress > BASEMENT_TUNNEL_LENGTH) root.z += progress - BASEMENT_TUNNEL_LENGTH;
  return { ...root, y: BASEMENT.tunnelFloor };
}
export function basementTunnelProgress(x: number, z: number): number {
  let offset = 0, best = Infinity, result = 0;
  for (let i = 1; i < BASEMENT_TUNNEL.length; i++) {
    const a = BASEMENT_TUNNEL[i - 1], b = BASEMENT_TUNNEL[i], dx = b.x - a.x, dz = b.z - a.z, span = Math.hypot(dx, dz);
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (span * span)));
    const gap = Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
    if (gap < best) { best = gap; result = offset + span * t; } offset += span;
  }
  return result;
}
export function basementLandingRoot(encounter: BasementEncounter, role: BasementRole) {
  const start = encounter.starts[role], age = encounter.landings[role];
  if (age === undefined) return { ...start, y: encounter.heights[role], hanging: true, landing: undefined };
  const fall = Math.max(0, BASEMENT.ceiling - 12 * age * age), landed = Math.sqrt(BASEMENT.ceiling / 12);
  const move = smooth((age - landed - .5) / 1.6), target = BASEMENT.landing[role];
  return { x: start.x + (target.x - start.x) * move, z: start.z + (target.z - start.z) * move,
    y: BASEMENT.floor + fall, yaw: move > 0 ? Math.atan2(target.x - start.x, target.z - start.z) : start.yaw,
    hanging: false, landing: Math.max(0, age - landed) };
}
export function basementHatchPoint(hatch: number, side = 0): Vector3 {
  const angle = hatch * BASEMENT.grate.angle;
  return { x: BASEMENT.grate.x - 1.25, y: BASEMENT.floor + .22 + (1.15 + side * .3) * Math.sin(angle),
    z: BASEMENT.grate.hingeZ - (1.15 + side * .3) * Math.cos(angle) };
}
export function basementLifterRoot(hatch: number) {
  const a = basementHatchPoint(hatch), b = basementHatchPoint(hatch, 1);
  return { ...BASEMENT.waiting.trinity, z: Math.max(BASEMENT.waiting.trinity.z, (a.z + b.z) / 2), y: BASEMENT.floor, yaw: Math.PI / 2 };
}
function drainRoute(encounter: BasementEncounter, role: BasementRole) {
  const start = encounter.drainStarts![role], approach = BASEMENT.approach;
  if (role === 'neo') return [{ x: 12.4, z: approach.z }, approach];
  if (role === 'apoc') return [start, { x: 0, z: start.z }, { x: 0, z: approach.z }, approach];
  return [start, { x: Math.min(6, start.x), z: approach.z }, approach];
}
export function basementDrainRoot(encounter: BasementEncounter, role: BasementRole) {
  const start = encounter.drainStarts![role];
  if (role === 'cypher') return { ...start, yaw: start.yaw, crawling: false, ended: true };
  let delay = 0;
  for (const previous of ['trinity', 'apoc', 'switch', 'neo'] as const) {
    if (previous === role) break;
    delay += pathLength(drainRoute(encounter, previous)) / 3.6 + 3.5 + 1.6;
  }
  const age = Math.max(0, encounter.elapsed - delay);
  if (role === 'neo' && encounter.elapsed < delay) {
    const move = smooth(encounter.elapsed / 1.1);
    return { ...start, x: start.x + (12.4 - start.x) * move, z: start.z + (BASEMENT.approach.z - start.z) * move,
      yaw: Math.PI / 2, crawling: false, ended: false };
  }
  const approach = BASEMENT.approach;
  const route = drainRoute(encounter, role);
  const toEdge = pathLength(route) / 3.6;
  let x = route[0].x, z = route[0].z, y = start.y, yaw = Math.atan2(approach.x - x, approach.z - z), crawling = false;
  if (age <= toEdge) { const root = pathRoot(route, age * 3.6); x = root.x; z = root.z; yaw = root.yaw; }
  else {
    const duck = smooth((age - toEdge) / 1.3); x = approach.x; z = approach.z + (BASEMENT.grate.z - approach.z) * duck; yaw = 0;
    const down = smooth((age - toEdge - 1.3) / 2.2); y = BASEMENT.floor - 6 * down; crawling = true;
    if (age > toEdge + 3.5) {
      const goal = ({ trinity: 11.1, apoc: 7.4, switch: 3.7, neo: 0, cypher: 0 } as const)[role];
      const root = basementTunnelRoot(Math.min(goal, (age - toEdge - 3.5) * 2.4)); x = root.x; y = root.y; z = root.z; yaw = root.yaw;
      return { x, y, z, yaw, crawling, ended: age >= toEdge + 3.5 + goal / 2.4 };
    }
  }
  return { x, y, z, yaw, crawling, ended: false };
}
export function basementGasDensity(x: number, z: number, time: number): number {
  return Math.min(1, BASEMENT_GAS.reduce((density, gas) => density + smooth((time - gas.at) / 12) * .75 * Math.exp(-Math.hypot(x - gas.x, z - gas.z) / 18), 0));
}
export function basementBlocked(x: number, y: number, z: number, radius: number): boolean {
  if (y > BASEMENT.floor + BASEMENT.ceiling - .8) return x < -22 + radius + .15 || x > -13 - radius - .15 || z < -34 + radius + .15 || z > -30.8 - radius - .15;
  if (y < BASEMENT.floor - 2) return !BASEMENT_TUNNEL_FLOORS.some(surface => Math.abs(x - surface.x) <= surface.width / 2 - radius && Math.abs(z - surface.z) <= surface.depth / 2 - radius);
  if (Math.abs(x) > 22 - radius - .3 || Math.abs(z) > 34 - radius - .3) return true;
  // The rim is a traversal boundary: G uses the opened ladder, walking cannot
  // put an upright body through a closed grate or unsupported floor aperture.
  if (Math.abs(x - BASEMENT.grate.x) < BASEMENT.grate.width / 2 + radius && Math.abs(z - BASEMENT.grate.z) < BASEMENT.grate.depth / 2 + radius) return true;
  return BASEMENT_BOILERS.some(boiler => Math.abs(x - boiler.x) < boiler.width / 2 + radius && Math.abs(z - boiler.z) < boiler.depth / 2 + radius);
}
export function basementLocked(journey: FilmJourney | undefined): boolean {
  return Boolean(journey?.scene === 'm1_basement' && !journey.visiting && journey.basement &&
    (journey.basement.paused || ['ready', 'descending', 'landing', 'draining', 'tunnel', 'done', 'failed'].includes(journey.basement.phase)));
}
export function basementText(encounter: BasementEncounter): string {
  if (encounter.paused) return '同行角色正在由另一位玩家控制。高度、烟雾、呼吸与格栅动作保留在当前进度。';
  if (encounter.phase === 'ready') return 'Morpheus 留在六楼。G 抓稳原来的立管，继续和 Trinity 向地下室撤退。';
  if (encounter.phase === 'descending') return 'W 沿管道下行，S 退回；松开按键会抓稳。下方是机械房，空格会提前失手。';
  if (encounter.phase === 'landing') return '薄木条在脚下断开。落地后跟上 Trinity，别停留在搜查灯下。';
  if (encounter.phase === 'searching') return `催泪烟雾正在扩散。跟着 Trinity 绕过锅炉寻找集水口；按住 Z 降低烟气暴露。呼吸余量 ${Math.ceil(encounter.air)}%。`;
  if (encounter.phase === 'lifting') return 'Trinity 抓住格栅侧把手，把沉重的铁盖撑起。留出洞口，让同伴靠过来。';
  if (encounter.phase === 'hatch_ready') return '格栅已经打开。Cypher 消失在烟里；先让 Apoc、Switch 靠近，再回到洞口前按 G 撤入排水道。';
  if (encounter.phase === 'draining') return 'Trinity 先进入排水道，Apoc 与 Switch 依次跟上。Neo 抓住扶手最后下去，Cypher 没有跟来。';
  if (encounter.phase === 'tunnel') return 'WASD 沿低矮排水道移动，转过两个弯抵达街边出口。身体保持低姿，V 可查看眼位。';
  if (encounter.phase === 'failed') return encounter.failure === 'fall' ? 'Neo 提前松开了立管。J 从原高度重试，Morpheus 被捕与 Mouse 的死亡仍保留。' : 'Neo 被浓烟呛倒。J 从机械房落地处重试；已经发生的死亡和被捕不会改写。';
  return '四人抵达通向街面的出口井。Trinity 联系 Tank；下一镜头前往 Franklin 与 Erie 的电视维修店，Cypher 已先取得出口。';
}

export type TvExitPhase = 'ready' | 'pickup' | 'line_dead' | 'calling' | 'done';
export interface TvExitEncounter { phase: TvExitPhase; elapsed: number; paused?: boolean; start?: Vector3 & { yaw: number } }
export interface TvExitGesture extends TvExitEncounter { role: 'neo' | 'trinity' }
export const TV_EXIT = { phone: { x: -7, y: 2.7, z: -20 }, approach: { x: -7, z: -18.5 }, pickupSeconds: 4.4, callSeconds: 6.8,
  cast: { trinity: { x: -3.5, z: -14, yaw: -Math.PI / 2 }, apoc: { x: 4.5, z: -11, yaw: Math.PI }, switch: { x: 8.5, z: -9, yaw: Math.PI } } } as const;
export const TV_EXIT_OBSTACLES = [
  { x: -13.5, z: -15, width: 3.4, depth: 20, height: 5.2 }, { x: 13.5, z: -15, width: 3.4, depth: 20, height: 5.2 },
  { x: 0, z: -25, width: 32, depth: 3, height: 3.1 }, { x: 0, z: 2, width: 32, depth: 2.2, height: 3.2 },
  { x: -13.5, z: 17, width: 3.4, depth: 18, height: 4.3 }, { x: 13.5, z: 17, width: 3.4, depth: 18, height: 4.3 },
  { x: -7, z: -20.25, width: 2.4, depth: .4, height: 10 },
  // The stockroom is reached through a real right-hand gap in the counter.
].map((obstacle, index) => index === 3 ? { ...obstacle, x: -4.5, width: 22 } : obstacle);
export function tvExitLocked(journey: FilmJourney | undefined): boolean { return Boolean(journey?.scene === 'm1_tv_exit' && !journey.visiting && journey.tvExit && (journey.tvExit.paused || ['pickup', 'line_dead', 'calling'].includes(journey.tvExit.phase))); }
export function tvExitRoot(encounter: TvExitEncounter) {
  const start = encounter.start ?? { ...TV_EXIT.approach, y: 0, yaw: Math.PI };
  const t = encounter.phase === 'pickup' ? smooth(encounter.elapsed / .8) : 1;
  return { x: start.x + (TV_EXIT.approach.x - start.x) * t, y: start.y, z: start.z + (TV_EXIT.approach.z - start.z) * t, yaw: start.yaw + Math.atan2(Math.sin(Math.PI - start.yaw), Math.cos(Math.PI - start.yaw)) * t };
}
export function tvExitText(encounter: TvExitEncounter): string {
  if (encounter.paused) return 'Trinity 或同行者正在由另一位玩家控制，电话动作停在保存的位置。';
  if (encounter.phase === 'ready') return 'Tank 确认 Morpheus 还活着。Trinity 让 Neo 先接出：穿过维修柜台右侧，走近后墙的硬线电话并按 G。';
  if (encounter.phase === 'pickup') return encounter.elapsed < 1.8 ? 'Neo 把听筒从托架取下，等待接线员确认出口。' : '听筒里的信号忽然消失。Neo 仍在矩阵中，不能从已经失效的线路接出。';
  if (encounter.phase === 'line_dead') return '硬线断了。G 请 Trinity 用手机联系船上，确认 Tank 为什么没有回应。';
  if (encounter.phase === 'calling') return encounter.elapsed < 3.2 ? 'Trinity 拨通飞船。接听的人不是 Tank。' : 'Cypher 承认自己选择了重新接入矩阵；他把其他人的身体留在了接线另一端。';
  return '维修店里四人仍被困在矩阵。G 明确切到 Tank 的现实视角，寻找船上的反击机会。';
}
