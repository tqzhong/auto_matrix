import type { Vector3 } from '../types/agent.js';
import type { FilmJourney } from './film-story.js';
import { WETWALL_SHAFT } from './ambush.js';

export const WETWALL_ROLES = ['neo', 'apoc', 'switch', 'trinity', 'cypher', 'morpheus'] as const;
export type WetwallRole = typeof WETWALL_ROLES[number];
export type WetwallPhase = 'sealed' | 'breaking' | 'queue' | 'climbing' | 'jammed' | 'rescuing' | 'falling' | 'failed' | 'done';
export interface WetwallEncounter {
  phase: WetwallPhase; elapsed: number; attempts: number; freed: boolean; paused?: boolean;
  starts: Record<WetwallRole, Vector3>; progress: Record<WetwallRole, number>;
  checkpoint: { progress: Record<WetwallRole, number>; freed: boolean };
  fallY?: number; fallSpeed?: number;
}
export interface WetwallGesture {
  role: WetwallRole; phase: WetwallPhase; elapsed: number; progress: number; entry: number; hanging: boolean; freed: boolean; start: Vector3;
  fallY?: number;
}
export const WETWALL = { breakSeconds: 2.6, impact: 1.25, rescueSeconds: 2.4, speed: 1.35, jam: 9.4, spacing: 5.4,
  approach: { x: -18, y: WETWALL_SHAFT.top, z: -28.4 },
  lanes: { neo: -15.5, apoc: -20.5, switch: -15.5, trinity: -20.5, cypher: -18, morpheus: -18 },
} as const;
export function wetwallPath(start: Vector3, role: WetwallRole): Vector3[] {
  const waiting = { x: -18, y: WETWALL_SHAFT.top, z: -24.2 };
  return [start, ...(role === 'neo' ? [{ ...WETWALL.approach }] : role === 'morpheus' ? [waiting,
    { x: -18, y: WETWALL_SHAFT.top, z: -29.5 }] : [
    { x: start.x, y: WETWALL_SHAFT.top, z: -29.5 }, { x: -18, y: WETWALL_SHAFT.top, z: -29.5 }]),
    { x: -18, y: WETWALL_SHAFT.top, z: WETWALL_SHAFT.bodyZ },
    { x: WETWALL.lanes[role], y: WETWALL_SHAFT.top, z: WETWALL_SHAFT.bodyZ }];
}
export function wetwallEntry(encounter: WetwallEncounter, role: WetwallRole): number {
  const points = wetwallPath(encounter.starts[role], role);
  return points.slice(1).reduce((length, point, i) => length + Math.hypot(point.x - points[i].x, point.y - points[i].y, point.z - points[i].z), 0);
}
export function wetwallRoot(encounter: WetwallEncounter, role: WetwallRole, progress = encounter.progress[role]) {
  return wetwallPose(encounter.starts[role], role, progress, encounter.phase, encounter.elapsed, encounter.fallY);
}
export function wetwallPose(start: Vector3, role: WetwallRole, progress: number, phase: WetwallPhase, elapsed: number, fallY?: number) {
  if (role === 'neo' && phase === 'breaking') {
    const impact = Math.min(1, elapsed / WETWALL.impact), withdraw = Math.max(0, Math.min(1, (elapsed - WETWALL.impact) / (WETWALL.breakSeconds - WETWALL.impact)));
    const z = elapsed < WETWALL.impact ? start.z - .8 * impact : start.z - .8 + (-26.9 - start.z + .8) * withdraw;
    return { x: start.x, y: start.y, z, yaw: Math.PI, hanging: false };
  }
  const points = wetwallPath(start, role); let remaining = Math.max(0, progress);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], length = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    if (remaining >= length - .000001) { remaining = Math.max(0, remaining - length); continue; }
    const t = length ? remaining / length : 1;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t,
      yaw: i === points.length - 1 ? Math.PI : Math.atan2(b.x - a.x, b.z - a.z),
      hanging: i === points.length - 1 || a.z + (b.z - a.z) * t < WETWALL_SHAFT.front - 1 };
  }
  const depth = Math.min(WETWALL_SHAFT.top - WETWALL_SHAFT.low, remaining);
  const rescue = phase === 'rescuing' ? Math.sin(Math.min(1, elapsed / WETWALL.rescueSeconds) * Math.PI) : 0;
  return { x: WETWALL.lanes[role] + (role === 'trinity' ? rescue * .25 : 0),
    y: role === 'neo' && fallY !== undefined ? fallY : WETWALL_SHAFT.top - depth + (role === 'cypher' ? rescue * .16 : 0),
    z: WETWALL_SHAFT.bodyZ, yaw: Math.PI, hanging: !(role === 'neo' && ['falling', 'failed'].includes(phase)) };
}
export function wetwallLocked(journey: FilmJourney | undefined): boolean {
  return Boolean(journey?.scene === 'm1_wetwall' && !journey.visiting && journey.wetwall?.phase !== 'sealed');
}
export function wetwallText(encounter: WetwallEncounter): string {
  if (encounter.paused) return '同行者正在由另一位玩家控制。墙内高度、队形与解救动作停在原处。';
  if (encounter.phase === 'sealed') return '808 室的排水立管藏在灰泥和木条后面。靠近墙前按 G，打开可供队伍进入的裂口。';
  if (encounter.phase === 'breaking') return 'Neo 击碎灰泥，折断背后的木条。洞口露出向下贯穿楼层的排水管；同伴收起武器。';
  if (encounter.phase === 'queue') return 'Apoc、Switch、Trinity 和 Cypher 依次钻进裂口。留出洞口，等他们在立管上抓稳；Morpheus 留在最后。';
  if (encounter.phase === 'jammed') return 'Cypher 的身体卡在供水管之间。队伍停住；按 G 示意 Trinity 拉他出来，不能把同伴留在这里。';
  if (encounter.phase === 'rescuing') return 'Trinity 抓住 Cypher 的手臂，沿着管线把他拉出。等待她完成解救，再继续下行。';
  if (encounter.phase === 'falling') return '你松开了立管，正在下坠。';
  if (encounter.phase === 'failed') return 'Neo 没能抓稳管道。J 从墙内检查点重试；Mouse 的死亡和已经完成的逃亡保留。';
  if (encounter.phase === 'done') return 'Neo 抵达六楼 608 室背后的管线夹层。Morpheus 仍在上方；G 或 J 转入他的掩护片段。';
  return 'W 沿立管向下，S 停下并向上退回；松开按键会抓稳等待。空格会松开管道，注意坠落。Morpheus 在身后，其他人沿管线前进。';
}
