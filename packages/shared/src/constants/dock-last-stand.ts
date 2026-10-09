import type { FilmJourney } from './film-story.js';
import { APU_RIG } from './apu-rig.js';

export const DOCK_LAST_STAND = {
  mifune: { x: 0, z: 9 }, kid: { x: -1.55, z: 6.3, yaw: Math.PI / 2 },
  attack: 5.2, kneel: 1.2, orders: 5.5, answer: 3.2, dying: 2.4, rise: 1.6,
} as const;
export interface DockLastStand {
  phase: 'ready' | 'attack' | 'wounded' | 'kneeling' | 'orders' | 'response' | 'answer' | 'dying' | 'rise' | 'done';
  elapsed: number; total: number;
  approach?: { x: number; z: number; yaw: number };
}
export type DockLastStandGesture = DockLastStand & { role: 'kid' | 'mifune' };
export const newDockLastStand = (): DockLastStand => ({ phase: 'ready', elapsed: 0, total: 0 });
export function dockLastStandActive(journey?: FilmJourney): boolean {
  return Boolean(journey && !journey.visiting && journey.scene === 'm3_dock_battle' && journey.step === 2
    && !journey.completed.includes(journey.scene));
}
export function dockLastStandLocked(encounter?: DockLastStand): boolean {
  return Boolean(encounter && !['ready', 'wounded', 'done'].includes(encounter.phase));
}
const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
export function dockLastStandPose(encounter: DockLastStand) {
  const phase = encounter.phase, t = encounter.elapsed;
  const fallen = phase === 'ready' ? 0 : phase === 'attack' ? smooth((t - 2.4) / 2.8) : 1;
  const kneel = ['ready', 'attack', 'wounded', 'done'].includes(phase) ? 0
    : phase === 'kneeling' ? smooth(t / DOCK_LAST_STAND.kneel) : phase === 'rise' ? 1 - smooth(t / DOCK_LAST_STAND.rise) : 1;
  const dead = phase === 'dying' ? smooth(t / DOCK_LAST_STAND.dying) : phase === 'rise' || phase === 'done' ? 1 : 0;
  return { fallen, kneel, dead, injured: phase !== 'ready' && (phase !== 'attack' || t >= 1.45),
    mifune: { x: 0, y: (APU_RIG.floor + APU_RIG.pilot.y) * (1 - fallen), z: 12 - 3 * fallen, yaw: Math.PI * (1 - fallen) } };
}
export function dockLastStandText(encounter?: DockLastStand): string {
  switch (encounter?.phase ?? 'ready') {
    case 'ready': return '弹箱已经锁紧。按 G 接续 Mifune 的最后防线。';
    case 'attack': return '哨兵扑向敞开的驾驶舱。Mifune 仍在开火，机甲的上部支架被撕开。';
    case 'wounded': return 'Mifune 倒在机甲前方。绕到他身旁，按 G 蹲下听他讲话。';
    case 'kneeling': return 'Kid 蹲到队长身旁，Mifune 用最后的力气抬头。';
    case 'orders': return 'Mifune 告诉你 Hammer 正在赶来：接管 APU，打断三号闸门的配重，让援军进入船坞。时间不多了。';
    case 'response': return 'Kid 还没完成 APU 训练。按 G 把自己的顾虑告诉队长。';
    case 'answer': return 'Mifune 承认自己也没有完成训练，但闸门不能再等。他把任务交给 Kid。';
    case 'dying': return 'Mifune 的手慢慢松开。炮声仍在远处响着，Kid 留在他身旁。';
    case 'rise': return 'Kid 起身，准备接管受损的 APU。';
    case 'done': return 'Mifune 已经牺牲。开闸任务交给了 Kid；按 G 继续三号闸门。';
  }
}
export function stepDockLastStand(encounter: DockLastStand, seconds: number): void {
  if (!dockLastStandLocked(encounter) || encounter.phase === 'response') return;
  const dt = Math.max(0, Math.min(.1, seconds)); encounter.elapsed += dt; encounter.total += dt;
  const next = { attack: ['wounded', DOCK_LAST_STAND.attack], kneeling: ['orders', DOCK_LAST_STAND.kneel],
    orders: ['response', DOCK_LAST_STAND.orders], answer: ['dying', DOCK_LAST_STAND.answer],
    dying: ['rise', DOCK_LAST_STAND.dying], rise: ['done', DOCK_LAST_STAND.rise] } as const;
  const beat = next[encounter.phase as keyof typeof next];
  if (beat && encounter.elapsed >= beat[1] - 1e-6) { encounter.phase = beat[0]; encounter.elapsed = 0; }
}
