import { FILM_SETS } from './film-sets.js';
import { BETRAYAL } from './betrayal.js';
import { TV_EXIT } from './basement-escape.js';
import type { FilmJourney } from './film-story.js';
import type { Vector3 } from '../types/agent.js';

export const CROSSCUT_ROLES = ['neo', 'trinity', 'apoc', 'switch', 'tank', 'dozer', 'cypher'] as const;
export const CONNECTED_ROLES = ['neo', 'trinity', 'apoc', 'switch'] as const;
export type CrosscutRole = typeof CROSSCUT_ROLES[number];
export type CrosscutPhase = 'phone' | 'assault' | 'call' | 'counter_ready' | 'aiming' | 'window' | 'failed' | 'countering' | 'return' | 'trinity_ready' | 'trinity_exit' | 'neo_ready' | 'neo_exit' | 'done';
export interface CypherCrosscut {
  phase: CrosscutPhase; elapsed: number; view: 'matrix' | 'ship'; attempts: number; tankHealth: number;
  tankHit: boolean; dozerDead: boolean; apocDead: boolean; switchDead: boolean; cypherDead: boolean; trinityOut: boolean; neoOut: boolean;
  trinityStart?: Vector3 & { yaw: number };
}
export interface CrosscutGesture extends CypherCrosscut {
  role: CrosscutRole; body?: boolean; fall?: number; contact?: Vector3;
}
export const CROSSCUT = { pickup: 1.8, assault: 8.4, tankShot: 2.6, dozerShot: 5.2, apocPull: 8.6, switchPull: 17.6, call: 24, exit: 5.2 } as const;
const smooth = (v: number) => { const t = Math.max(0, Math.min(1, v)); return t * t * (3 - 2 * t); };

export function crosscutActive(journey: FilmJourney | undefined): boolean {
  return Boolean(journey && !journey.visiting && ['m1_tv_exit', 'm1_unplugged'].includes(journey.scene) && journey.tvExit?.crosscut);
}
export function crosscutLocked(journey: FilmJourney | undefined): boolean {
  if (!crosscutActive(journey)) return false;
  const cut = journey!.tvExit!.crosscut!;
  return Boolean(journey!.tvExit!.paused || !['phone', 'trinity_ready', 'neo_ready'].includes(cut.phase)
    || cut.phase === 'phone' && journey!.tvExit!.phase !== 'ready');
}
export function crosscutView(cut: CypherCrosscut): 'matrix' | 'ship' {
  if (cut.phase === 'assault' || ['counter_ready', 'aiming', 'window', 'failed', 'countering', 'return', 'done'].includes(cut.phase)) return 'ship';
  if (cut.phase === 'call' && (cut.elapsed >= 5 && cut.elapsed < CROSSCUT.apocPull || cut.elapsed >= 14 && cut.elapsed < CROSSCUT.switchPull)) return 'ship';
  return 'matrix';
}
export function crosscutDeckRoot(cut: CypherCrosscut, role: CrosscutRole) {
  const root = BETRAYAL.deckRoots[role];
  if (role === 'dozer' && (cut.phase === 'assault' || cut.dozerDead)) {
    const t = cut.phase === 'assault' ? smooth((cut.elapsed - 2.7) / 1.8) : 1;
    return { x: root.x + t * 3.7, z: root.z + t * 1.2, yaw: Math.atan2(3.7, 1.2) };
  }
  if (role !== 'cypher') return root;
  const behind = (p: typeof root) => ({ x: p.x - Math.sin(p.yaw) * 1.8, z: p.z - Math.cos(p.yaw) * 1.8 });
  const target = cut.phase === 'call' ? cut.elapsed < 14 ? BETRAYAL.deckRoots.apoc : cut.elapsed < 18 ? BETRAYAL.deckRoots.switch : BETRAYAL.deckRoots.neo : BETRAYAL.deckRoots.neo;
  const from = cut.phase === 'call' && cut.elapsed >= 18 ? behind(BETRAYAL.deckRoots.switch) : cut.phase === 'call' && cut.elapsed >= 14 ? behind(BETRAYAL.deckRoots.apoc) : root;
  const start = cut.phase === 'call' ? cut.elapsed >= 18 ? 18 : cut.elapsed >= 14 ? 14 : 5 : 0;
  const t = cut.phase === 'assault' || cut.phase === 'phone' ? 0 : cut.phase === 'call' ? smooth((cut.elapsed - start) / 2.1) : 1;
  // Approach the headrest from behind; the player and the gun remain clear of the chair aisle.
  const x = target.x - Math.sin(target.yaw) * 1.8, z = target.z - Math.cos(target.yaw) * 1.8;
  return { x: from.x + (x - from.x) * t, z: from.z + (z - from.z) * t,
    yaw: t > .99 ? target.yaw : Math.atan2(x - from.x, z - from.z) };
}
export function crosscutPhoneRole(cut: CypherCrosscut): 'neo' | 'trinity' | undefined {
  if (cut.phase === 'trinity_exit') return 'trinity';
  if (['phone', 'assault', 'neo_exit'].includes(cut.phase)) return 'neo';
  return cut.phase === 'call' && cut.elapsed < 6.6 ? 'neo' : undefined;
}
export function crosscutAction(journey: FilmJourney, position: Vector3): { target: 'act' | 'next' | 'retry'; label: string } | undefined {
  if (!crosscutActive(journey) || journey.tvExit!.paused) return;
  const tv = journey.tvExit!, cut = tv.crosscut!;
  // The renderer and both interfaces use the same gates as the saved encounter.
  const center = FILM_SETS.film_tv_repair.center;
  const gap = Math.hypot(position.x - center.x - TV_EXIT.approach.x, position.z - center.z - TV_EXIT.approach.z);
  if (cut.phase === 'failed') return { target: 'retry', label: '从负伤的反击检查点重试' };
  if (cut.phase === 'done') return { target: 'next', label: '回到飞船，决定营救 Morpheus' };
  if (cut.phase === 'call' && tv.phase === 'done') return { target: 'next', label: '明确接管受伤的 Tank' };
  if (cut.phase === 'phone' && tv.phase === 'ready' && journey.step === 1 && gap < 1.2) return { target: 'act', label: '取下硬线听筒' };
  if (cut.phase === 'call' && tv.phase === 'line_dead') return { target: 'act', label: '请 Trinity 联系飞船' };
  if (cut.phase === 'counter_ready') return { target: 'act', label: '忍住伤口，准备反击' };
  if (cut.phase === 'window') return { target: 'act', label: '抓住脉冲枪反击' };
  if (cut.phase === 'return') return { target: 'act', label: '返回 Neo，让 Trinity 先走' };
  if (cut.phase === 'trinity_ready' && gap >= 2) return { target: 'act', label: '让 Trinity 先接出' };
  if (cut.phase === 'neo_ready' && gap < 1.2) return { target: 'act', label: '接出 Neo' };
}
export function crosscutTrinityRoot(cut: CypherCrosscut) {
  const start = cut.trinityStart ?? { ...TV_EXIT.cast.trinity, y: 0 }, t = smooth(cut.elapsed / 2);
  return { x: start.x + (TV_EXIT.approach.x - start.x) * t, y: start.y, z: start.z + (TV_EXIT.approach.z - start.z) * t,
    yaw: start.yaw + Math.atan2(Math.sin(Math.PI - start.yaw), Math.cos(Math.PI - start.yaw)) * t };
}
export function crosscutText(journey: FilmJourney): string {
  const tv = journey.tvExit!, cut = tv.crosscut!, t = cut.elapsed;
  if (tv.paused) return '参与背叛或撤离的角色正由另一位玩家控制。两边的位置、伤势与接线时钟停在存档处。';
  if (cut.phase === 'phone') return tv.phase === 'ready' ? 'Trinity 让 Neo 先接出。走近后墙电话，G 亲手取下听筒。' : 'Neo 拿起硬线听筒，等待 Tank 确认出口。';
  if (cut.phase === 'assault') return t < CROSSCUT.tankShot ? '现实飞船：Cypher 趁 Tank 转身，抬起脉冲枪。矩阵里的 Neo 仍在等接线。' : t < CROSSCUT.dozerShot ? 'Tank 中枪倒下。Dozer 离开控制台，冲向 Cypher。' : 'Dozer 也被击倒。没有接线员回应，矩阵的硬线出口随之失效。';
  if (cut.phase === 'call') {
    if (tv.phase === 'line_dead') return '硬线突然失效。G 请 Trinity 用手机联系飞船。';
    return t < 5 ? 'Trinity 联系上 Cypher。他把摆脱战争与重新沉睡当成自由；Trinity 追问，遗忘是否能让背叛不曾发生。'
      : t < CROSSCUT.apocPull ? '现实飞船：Cypher 走向 Apoc 的头枕，抓住颈后的接线。'
        : t < 14 ? '接线被拔下。矩阵里的 Apoc 没有中弹，却突然失去支撑。'
          : t < CROSSCUT.switchPull ? '现实飞船：Cypher 转向 Switch，手掌再次伸向接口。Trinity 请求他停下。'
            : t < CROSSCUT.call ? 'Switch 也倒下了。Cypher 威胁 Neo 的接线，Trinity 仍选择相信眼前的人。' : 'Neo 与 Trinity 仍在矩阵。G 明确接管受伤的 Tank，阻止 Cypher 拔下最后的接线。';
  }
  if (cut.phase === 'counter_ready') return 'Tank 尚有意识，Apoc 与 Switch 已无法回来。G 忍住伤口，等待地上脉冲枪的反击机会。';
  if (cut.phase === 'aiming') return 'Cypher 站在 Neo 的接线后，误以为 Tank 已死。等他的注意力离开枪口。';
  if (cut.phase === 'window') return '现在按 G 抓枪反击，保住 Neo 与 Trinity。';
  if (cut.phase === 'failed') return 'Tank 反击太迟。点击「从剧情检查点重试」继续；原伤势以及 Dozer、Apoc、Switch 的死亡保留。';
  if (cut.phase === 'countering') return t < 2.2 ? 'Tank 从甲板摸到脉冲枪，带着伤口抬起枪口。' : '脉冲击中 Cypher。他倒下，两条幸存接线仍然连着。';
  if (cut.phase === 'return') return 'Tank 回到操作员通道。G 返回 Neo 的矩阵视角，先让 Trinity 接出。';
  if (cut.phase === 'trinity_ready') return '硬线恢复了。Neo 离开电话前至少两米，再按 G 让 Trinity 先接出。';
  if (cut.phase === 'trinity_exit') return 'Trinity 走到电话前，取下听筒。Tank 在另一端安全释放她的连接。';
  if (cut.phase === 'neo_ready') return 'Trinity 已回到飞船。Neo 亲自走回硬线电话，按 G 接出。';
  if (cut.phase === 'neo_exit') return 'Neo 接通出口；Tank 解开最后一条幸存连接。';
  return 'Neo 与 Trinity 回到飞船。Tank 仍负伤，三名同伴不会因换场或重试复活；接下来决定如何救回 Morpheus。';
}
