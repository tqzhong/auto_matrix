import { AMBUSH_STAIRS, AMBUSH_STOREYS, ambushFloor, type AmbushCompanion } from './ambush.js';
import type { Vector3 } from '../types/index.js';

export const AMBUSH_ESCAPE = {
  alarm: 6.2, shots: 2.8, mouse: 4.4, call: 5.5, speed: 4.1, tracedSpeed: 4.6,
  window: { x: -18, y: -AMBUSH_STAIRS.rise * AMBUSH_STOREYS, z: -16 },
  wetwall: { x: -18, y: -AMBUSH_STAIRS.rise * AMBUSH_STOREYS, z: -27 },
  staging: { x: -5.4, y: -AMBUSH_STAIRS.rise * AMBUSH_STOREYS, z: -13.2 },
} as const;
export type AmbushEscapePhase = 'alarm' | 'descending' | 'window' | 'phone' | 'call' | 'forming' | 'wetwall' | 'failed' | 'done';
export interface AmbushPursuer { progress: number; health: number; spawned?: true }
export interface AmbushEscape {
  phase: AmbushEscapePhase; elapsed: number; mouseDead: boolean; traced: boolean; caught: number; attempts: number; paused?: boolean;
  progress: Record<AmbushCompanion, number>; pursuers: AmbushPursuer[];
  checkpoint: { floor: number; phase: 'descending' | 'phone' | 'forming' | 'wetwall'; progress: Record<AmbushCompanion, number>; pursuers: AmbushPursuer[]; traced: boolean };
}
const lead: Record<AmbushCompanion, number> = { apoc: 8.4, switch: 4.2, morpheus: 0, trinity: -4.2, cypher: -8.4 };
const windowStops: Record<AmbushCompanion, number> = { apoc: 4.2, switch: 8.4, morpheus: 12.6, trinity: 16.8, cypher: 21 };
const roomStops: Record<AmbushCompanion, { x: number; z: number }> = {
  apoc: { x: -20.4, z: -29.5 }, switch: { x: -15.4, z: -29.5 }, morpheus: { x: -15.4, z: -25 },
  trinity: { x: -20.4, z: -22 }, cypher: { x: -15.4, z: -20.5 },
};
type Point = { x: number; y: number; z: number };
export const AMBUSH_RETREAT_ROUTE: Point[] = [{ x: 11, y: 0, z: 31.8 }, { x: 5.5, y: 0, z: 31.8 }];
export const AMBUSH_RETREAT_LANDINGS: { floor: number; progress: number; point: Point }[] = [];
const length = (route: Point[]) => route.slice(1).reduce((sum, point, i) => sum + Math.hypot(point.x - route[i].x, point.z - route[i].z), 0);
for (let floor = 0; floor < AMBUSH_STOREYS; floor++) {
  const y = -floor * AMBUSH_STAIRS.rise;
  AMBUSH_RETREAT_ROUTE.push({ x: 5.5, y, z: 29 }, { x: 5.5, y: y - 3.7, z: 17 }, { x: 5.5, y: y - 3.7, z: 14.5 },
    { x: -5.5, y: y - 3.7, z: 14.5 }, { x: -5.5, y: y - 3.7, z: 17 }, { x: -5.5, y: y - 7.4, z: 29 }, { x: -5.5, y: y - 7.4, z: 31.8 });
  AMBUSH_RETREAT_LANDINGS.push({ floor: 12 - floor, progress: length(AMBUSH_RETREAT_ROUTE), point: { ...AMBUSH_RETREAT_ROUTE.at(-1)! } });
  if (floor < AMBUSH_STOREYS - 1) AMBUSH_RETREAT_ROUTE.push({ x: 5.5, y: y - 7.4, z: 31.8 });
}
const bottom = AMBUSH_ESCAPE.window.y;
AMBUSH_RETREAT_ROUTE.push({ x: -11, y: bottom, z: 31.8 }, { x: -11, y: bottom, z: 8 }, { x: 0, y: bottom, z: 8 },
  { x: 0, y: bottom, z: -16 }, { ...AMBUSH_ESCAPE.window }, { ...AMBUSH_ESCAPE.wetwall });
export const AMBUSH_WINDOW_PROGRESS = length(AMBUSH_RETREAT_ROUTE.slice(0, -1));
const retreatRoute = (role?: AmbushCompanion): Point[] => {
  if (!role) return AMBUSH_RETREAT_ROUTE;
  const prefix = role === 'trinity' ? [{ x: -.8, y: 0, z: 32.5 }, { x: -.8, y: 0, z: 31.8 }]
    : role === 'cypher' ? [{ x: -5.5, y: 0, z: 30.25 }, { x: -5.5, y: 0, z: 31.8 }]
      : [{ x: 11, y: 0, z: role === 'morpheus' ? 20.8 : role === 'switch' ? 24.4 : 28 }, AMBUSH_RETREAT_ROUTE[0]];
  const stop = roomStops[role];
  return [...prefix, ...AMBUSH_RETREAT_ROUTE.slice(1, -1), { x: -18, y: bottom, z: stop.z }, { x: stop.x, y: bottom, z: stop.z }];
};
export function ambushRetreatLength(role?: AmbushCompanion): number { return length(retreatRoute(role)); }
export function ambushRetreatShift(role: AmbushCompanion): number { return length(retreatRoute(role).slice(0, 3)) - 5.5; }
export function ambushRetreatRoot(progress: number, role?: AmbushCompanion) {
  if (!role && progress < 0) return { x: 11, y: 0, z: 31.8 + progress, yaw: 0 };
  const route = retreatRoute(role); let remaining = Math.max(0, progress);
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i], b = route[i + 1], span = Math.hypot(b.x - a.x, b.z - a.z);
    if (remaining > span && i < route.length - 2) { remaining -= span; continue; }
    const t = Math.min(1, remaining / span), x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
    return { x, y: ambushFloor(x, z, a.y + (b.y - a.y) * t) ?? a.y, z, yaw: Math.atan2(b.x - a.x, b.z - a.z) };
  }
  return { ...route.at(-1)!, yaw: Math.PI };
}
export function ambushRetreatProgress(x: number, y: number, z: number): number {
  let offset = 0, best = Infinity, progress = 0;
  for (let i = 0; i < AMBUSH_RETREAT_ROUTE.length - 1; i++) {
    const a = AMBUSH_RETREAT_ROUTE[i], b = AMBUSH_RETREAT_ROUTE[i + 1], dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy + (z - a.z) * dz) / (dx * dx + dy * dy + dz * dz)));
    const gap = Math.hypot(x - a.x - dx * t, y - a.y - dy * t, z - a.z - dz * t), span = Math.hypot(dx, dz);
    if (gap < best) { best = gap; progress = offset + span * t; } offset += span;
  }
  return progress;
}
export function ambushRetreatGoal(role: AmbushCompanion, neo: number, phase: AmbushEscapePhase): number {
  const shift = ambushRetreatShift(role);
  const cap = ['forming', 'wetwall', 'done'].includes(phase) ? ambushRetreatLength(role) : shift + AMBUSH_WINDOW_PROGRESS - windowStops[role];
  return Math.max(0, Math.min(cap, shift + neo + lead[role]));
}
export function ambushEscapeTarget(escape: AmbushEscape, x?: number, y?: number, z?: number) {
  if (escape.phase === 'phone' || escape.phase === 'call') return { ...ambushRetreatRoot(escape.progress.morpheus, 'morpheus'), label: 'Morpheus · 手机' };
  if (escape.phase === 'forming') return { ...AMBUSH_ESCAPE.staging, label: '门口让行处 · 等队伍通过' };
  if (escape.phase === 'wetwall' || escape.phase === 'done') return { ...AMBUSH_ESCAPE.wetwall, label: '808 室 · 管线墙' };
  if (escape.phase === 'descending' && x !== undefined && y !== undefined && z !== undefined) {
    const progress = ambushRetreatProgress(x, y, z); let offset = 0;
    for (let i = 1; i < AMBUSH_RETREAT_ROUTE.length - 1; i++) {
      offset += Math.hypot(AMBUSH_RETREAT_ROUTE[i].x - AMBUSH_RETREAT_ROUTE[i - 1].x, AMBUSH_RETREAT_ROUTE[i].z - AMBUSH_RETREAT_ROUTE[i - 1].z);
      if (progress < offset - 1) return { ...AMBUSH_RETREAT_ROUTE[i], label: AMBUSH_RETREAT_ROUTE[i].y <= bottom ? '八楼 · 检查窗户' : '沿楼梯撤往八楼' };
    }
  }
  return { ...AMBUSH_ESCAPE.window, label: '八楼 · 被封死的窗户' };
}
export function newAmbushEscape(): AmbushEscape {
  const progress = { morpheus: 0, switch: 0, apoc: 0, trinity: 0, cypher: 0 }, pursuers = [{ progress: -29, health: 64 }, { progress: -35, health: 64 }];
  return { phase: 'alarm', elapsed: 0, mouseDead: false, traced: false, caught: 0, attempts: 0, progress, pursuers,
    checkpoint: { floor: 13, phase: 'descending', progress: { ...progress }, pursuers: pursuers.map(p => ({ ...p })), traced: false } };
}
export function ambushCompanyBlocked(before: Vector3, after: Vector3, company: Vector3[]): boolean {
  const dx = after.x - before.x, dz = after.z - before.z, span = dx * dx + dz * dz;
  if (span < .000001) return false;
  return company.some(actor => {
    const t = Math.max(0, Math.min(1, ((actor.x - before.x) * dx + (actor.z - before.z) * dz) / span));
    if (Math.abs(before.y + (after.y - before.y) * t - actor.y) >= 3.6) return false;
    const gap = Math.hypot(before.x + dx * t - actor.x, before.z + dz * t - actor.z);
    return gap < 2.25 && gap < Math.hypot(before.x - actor.x, before.z - actor.z) - .000001;
  });
}
export function ambushCompanyStep(before: Vector3, after: Vector3, company: Vector3[]): Vector3 {
  if (!ambushCompanyBlocked(before, after, company)) return after;
  const x = { x: after.x, y: before.y, z: before.z }, z = { x: before.x, y: before.y, z: after.z };
  const openX = !ambushCompanyBlocked(before, x, company), openZ = !ambushCompanyBlocked(before, z, company);
  if (openX && (!openZ || Math.abs(after.x - before.x) >= Math.abs(after.z - before.z))) return x;
  if (openZ) return z;
  return before;
}
export function ambushEscapeText(escape: AmbushEscape): string {
  if (escape.paused) return '同行者正由另一位玩家控制；撤退、追兵和通话停在当前进度。';
  if (escape.phase === 'alarm') return escape.elapsed < AMBUSH_ESCAPE.shots ? 'TANK · 硬线被切断了，是陷阱！Mouse 的电话失去接入信号。'
    : escape.elapsed < AMBUSH_ESCAPE.mouse ? '1313 室传出密集枪声。Mouse 的窗户也被封死，正在阻挡冲入房间的警察。'
      : 'Mouse 的信号消失了。Morpheus 示意退下楼梯；跟着队伍撤到八楼。';
  if (escape.phase === 'descending') return '硬线无法接出。沿右侧楼梯下行，在半层平台转向左侧楼梯；与五名同伴撤到八楼。追兵正在逼近。';
  if (escape.phase === 'window') return '八楼的窗户也被砖墙封死。走到窗前按 G 检查，再与 Morpheus 商量退路。';
  if (escape.phase === 'phone') return 'TRINITY · 手机会暴露我们的位置。没有硬线可用，靠近 Morpheus 按 G，决定冒险联系 Tank。';
  if (escape.phase === 'call') return escape.elapsed < 2 ? 'Morpheus 接通 Tank，请他寻找这栋楼的结构图。手机信号已经暴露楼层。'
    : 'TANK · 主排水管线墙在八楼左侧，去 808 室。Morpheus 保持通话，确认退路。';
  if (escape.phase === 'wetwall') return '特工已经获知八楼位置。带齐同伴穿过左侧开口，到 808 室的管线墙前；无需清空追兵。';
  if (escape.phase === 'forming') return 'Tank 找到了 808 室的管线墙。留出窗前转角，先让同伴通过门口并移到两侧，再进入房间。追兵仍在逼近。';
  if (escape.phase === 'failed') return '追兵封住了撤退路线。按 J 从最近的楼层检查点重试；Mouse 的死亡不会被改写。';
  return '队伍来到 808 室的管线墙。接下来仍须沿墙内管道向下撤离。';
}
