import type { FilmJourney } from './film-story.js';

// Revolutions 697: the personnel gate, not the earlier council chamber.
export const DOCK_BRIEFING = {
  lift: { x: 0, z: 13, width: 8.4, depth: 6.4, height: 6.6, gateZ: 9.8, drop: 12, seconds: 4.2, opening: 1.8 },
  meeting: { x: 0, z: 0 },
  exit: { x: -6, z: -14 },
  escortSeconds: 5.6,
  cast: ['niobe', 'morpheus', 'roland', 'lock'] as const,
  walls: [
    { x: -10.7, z: 0, width: .6, depth: 38, height: 9 },
    { x: 10.7, z: 0, width: .6, depth: 38, height: 9 },
    { x: 0, z: 18.7, width: 22, depth: .6, height: 9 },
    { x: 4.4, z: -18.7, width: 12.6, depth: .6, height: 9 },
    { x: -9.4, z: -18.7, width: 2.6, depth: .6, height: 9 },
    ...[-1, 1].map(side => ({ x: side * 4.2, z: 13, width: .25, depth: 6.4, height: 40 })),
    { x: 0, z: 16.2, width: 8.4, depth: .25, height: 40 },
    ...[-1, 1].map(side => ({ x: side * 9.25, z: -1, width: 1.3, depth: 28, height: 9 })),
  ],
} as const;
export type DockBriefingRole = typeof DOCK_BRIEFING.cast[number];
export interface DockBriefing {
  phase: 'ready' | 'lowering' | 'gate' | 'walking' | 'greeting' | 'reply' | 'answer' | 'council' | 'roland' | 'warning' | 'reflection' | 'return' | 'done';
  elapsed: number; escort: number; paused?: string; unavailable?: string;
  approach?: { x: number; z: number; yaw: number };
}
export type DockBriefingGesture = DockBriefing & { role: DockBriefingRole };
export function dockBriefingActive(journey?: FilmJourney): boolean { return journey?.scene === 'm3_dock_briefing' && !journey.visiting; }
export function dockBriefingLocked(state?: DockBriefing): boolean {
  return Boolean(state && (state.paused || state.unavailable || ['ready', 'lowering', 'gate', 'greeting', 'answer', 'council', 'roland', 'warning'].includes(state.phase)));
}
const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
export function dockBriefingLift(state: DockBriefing): number {
  return state.phase === 'ready' ? DOCK_BRIEFING.lift.drop : state.phase === 'lowering'
    ? DOCK_BRIEFING.lift.drop * (1 - smooth(state.elapsed / DOCK_BRIEFING.lift.seconds)) : 0;
}
export function dockBriefingGate(state: DockBriefing): number {
  return state.phase === 'ready' || state.phase === 'lowering' ? 0 : state.phase === 'gate' ? smooth(state.elapsed / DOCK_BRIEFING.lift.opening) : 1;
}
export function dockBriefingRoot(state: DockBriefing, role: DockBriefingRole) {
  if (role === 'lock') return { x: 0, y: 0, z: -4, yaw: 0 };
  const side = role === 'morpheus' ? -1 : role === 'roland' ? 1 : 0;
  if (role === 'niobe' && state.approach && ['greeting', 'reply', 'answer', 'council', 'roland', 'warning', 'reflection'].includes(state.phase))
    return { ...state.approach, y: 0 };
  const t = Math.min(1, state.escort / DOCK_BRIEFING.escortSeconds);
  return { x: side * (2 + 1.1 * t), y: dockBriefingLift(state), z: (side ? 14.2 : 13) * (1 - t) + .8 * t,
    yaw: side && t < 1 ? Math.atan2(side * 1.1, .8 - 14.2) : Math.PI + side * .28 };
}
export function dockBriefingText(state?: DockBriefing): string {
  if (!state) return '三位船长到达指挥层人员闸口。';
  if (state.unavailable) return `${state.unavailable} 的信号无法参与简报。进度已保留；明确重建该角色信号后再继续。`;
  if (state.paused) return `${state.paused} 正由另一位玩家控制，简报与升降梯停在当前进度。`;
  const lines: Record<DockBriefing['phase'], string> = {
    ready: 'G 让升降梯下降到指挥层。V 切换视角，鼠标观察。',
    lowering: '升降梯正在下降。三位船长与同一轿厢一起到达指挥层。',
    gate: '人员闸口正在打开。等待门叶完全升起，再走出升降梯。',
    walking: 'WASD 走出升降梯，走近前方等待的 Lock；同行船长会跟上。',
    greeting: 'Lock 迎上来，质问三位船长为何只带回一艘船，其余舰船是否白白损失。',
    reply: '轮到 Niobe 回应。走近 Lock，按 G 接下这次质问。',
    answer: 'Niobe 叫出 Jason 的名字，带着讽意回应这场冷淡的迎接。',
    council: 'Lock 要三位船长向议会报告，自己留下重整防线。他仍认为这次行动让局势更加危险。',
    roland: 'Roland：我们刚刚救下船坞，为什么仍被当成失败？',
    warning: 'Lock：EMP 烧毁了大部分设备和所有 APU。机器若立刻投入下一波，船坞已经没有自动防御。',
    reflection: 'J 记录你如何理解这次救援的代价；一次成功并没有免除后续责任。',
    return: 'WASD 走向左前方的议会通道。Lock 留在指挥层准备撤退，船坞仍要卸载补给。',
    done: '三位船长已听清防线的代价。G 继续后续路线。',
  };
  return lines[state.phase];
}
