import type { FilmJourney } from './film-story.js';

export type BetrayalKind = 'bathroom' | 'unplugged';
export type BetrayalPhase = 'ready' | 'defending' | 'sacrifice_ready' | 'sacrifice' | 'unplugging' | 'aiming' | 'window' | 'failed' | 'countering' | 'reconnect' | 'done';
export interface BetrayalEncounter {
  kind: BetrayalKind;
  phase: BetrayalPhase;
  elapsed: number;
  attempt: number;
  repels?: number;
  rescued?: number;
}
export type BetrayalRole = 'neo' | 'trinity' | 'morpheus' | 'smith' | 'switch' | 'apoc' | 'tank' | 'cypher' | 'dozer';
export type BetrayalGesture = BetrayalEncounter & { role: BetrayalRole };

export const BETRAYAL = {
  bathroom: { hold: 12, sacrifice: 6.8, requiredRepels: 3 },
  unplugged: { unplugging: 6.8, aiming: 2.2, window: 1.5, countering: 5.4 },
  bathroomRoots: {
    morpheus: { x: 0, z: 0, yaw: Math.PI },
    smith: { x: 0, z: -5.4, yaw: 0 },
  },
  deckRoots: {
    tank: { x: -7, z: -14, yaw: 0 },
    cypher: { x: -2.8, z: -8.2, yaw: Math.PI },
    dozer: { x: -9.2, z: -11.8, yaw: 1.2 },
    apoc: { x: -6.5, z: -5, yaw: Math.PI / 2 },
    neo: { x: 6.5, z: -5, yaw: -Math.PI / 2 },
    trinity: { x: -6.5, z: 6, yaw: Math.PI / 2 },
    switch: { x: 6.5, z: 6, yaw: -Math.PI / 2 },
  },
} as const;

const clamp = (value: number): number => Math.max(0, Math.min(1, value));
const smooth = (value: number): number => { const t = clamp(value); return t * t * (3 - 2 * t); };

export function betrayalLocked(journey: FilmJourney): boolean {
  const encounter = journey.betrayal;
  if (!encounter || journey.visiting) return false;
  if (encounter.kind === 'bathroom') return encounter.phase === 'sacrifice';
  return ['unplugging', 'aiming', 'window', 'countering', 'reconnect'].includes(encounter.phase);
}

export function betrayalDuration(encounter: BetrayalEncounter): number {
  if (encounter.kind === 'bathroom') return encounter.phase === 'defending' ? BETRAYAL.bathroom.hold : BETRAYAL.bathroom.sacrifice;
  if (encounter.phase === 'unplugging') return BETRAYAL.unplugged.unplugging;
  if (encounter.phase === 'aiming') return BETRAYAL.unplugged.aiming;
  if (encounter.phase === 'window') return BETRAYAL.unplugged.window;
  if (encounter.phase === 'countering') return BETRAYAL.unplugged.countering;
  return 0;
}

export function bathroomCrewRoot(role: 'neo' | 'trinity' | 'switch' | 'apoc', elapsed: number) {
  const index = ({ trinity: 0, neo: 1, switch: 2, apoc: 3 } as const)[role];
  const start = { x: -3 + index * 2, z: 5 + index * 1.4 };
  const corner = { x: -8.5 - index * .55, z: -11 - index * 1.2 };
  const exit = { x: -17, z: -24 - index * 1.15 };
  const first = smooth(elapsed / 5.4); const second = smooth((elapsed - 5.2) / 5.5);
  const x = start.x + (corner.x - start.x) * first + (exit.x - corner.x) * second;
  const z = start.z + (corner.z - start.z) * first + (exit.z - corner.z) * second;
  const target = second > .02 ? exit : corner;
  return { x, z, yaw: Math.atan2(target.x - x, target.z - z) };
}

export function betrayalRoot(encounter: BetrayalEncounter, role: BetrayalRole) {
  if (encounter.kind === 'bathroom') {
    if (['neo', 'trinity', 'switch', 'apoc'].includes(role)) return bathroomCrewRoot(role as 'neo' | 'trinity' | 'switch' | 'apoc', encounter.phase === 'defending' ? encounter.elapsed : BETRAYAL.bathroom.hold);
    const root = BETRAYAL.bathroomRoots[role as 'morpheus' | 'smith'] ?? BETRAYAL.bathroomRoots.morpheus;
    if (encounter.phase !== 'sacrifice' && encounter.phase !== 'done') return root;
    const charge = smooth(encounter.elapsed / 2.2); const crash = smooth((encounter.elapsed - 2.1) / 1.5);
    if (role === 'morpheus') return { x: root.x + charge * 1.9 + crash * 2.4, z: root.z - charge * 4.2 - crash * 1.7, yaw: Math.PI - charge * .55 };
    return { x: root.x + charge * 1.25 + crash * 3.05, z: root.z - charge * .9 - crash * 5, yaw: charge < .8 ? 0 : Math.PI };
  }
  const root = BETRAYAL.deckRoots[role as keyof typeof BETRAYAL.deckRoots] ?? BETRAYAL.deckRoots.tank;
  if (role === 'cypher' && encounter.phase === 'countering') {
    const impact = smooth((encounter.elapsed - 2.15) / .35);
    return { ...root, x: root.x + impact * 1.4, z: root.z + impact * .7, yaw: root.yaw - impact * .45 };
  }
  return root;
}

export function betrayalText(encounter: BetrayalEncounter): string {
  if (encounter.kind === 'bathroom') {
    if (encounter.phase === 'ready') return '同伴正在转入墙内通道。按 G 挡在浴室门线前，让他们先走。';
    if (encounter.phase === 'defending') {
      const left = Math.max(0, BETRAYAL.bathroom.requiredRepels - (encounter.repels ?? 0));
      return encounter.elapsed < BETRAYAL.bathroom.hold
        ? `Smith 正逼近撤离线。用 F 反击、X 闪避；还需撑住 ${Math.ceil(BETRAYAL.bathroom.hold - encounter.elapsed)} 秒并完成 ${left} 次有效击退。`
        : `撤离时间已经争取到；还需完成 ${left} 次有效击退，才能把 Smith 从通道前带开。`;
    }
    if (encounter.phase === 'sacrifice_ready') return '最后一名同伴已经进入墙内通道。按 G 撞向 Smith，把战斗带进浴室并封住追击线。';
    if (encounter.phase === 'sacrifice') return encounter.elapsed < 2.2 ? 'Morpheus 放弃退路，迎着 Smith 冲上去。' : encounter.elapsed < 4.2 ? '两人撞穿浴室隔墙；碎砖切断了同伴身后的视线。' : 'Smith 重新站起。Morpheus 已经无力离开，但撤离通道争取到了时间。';
    return 'Morpheus 被特工带走；Neo、Trinity、Switch 与 Apoc 已穿过墙内通道。';
  }
  if (encounter.phase === 'ready') return '备用控制台旁传来脚步。按 G 接通监视画面，确认是谁先回到了飞船。';
  if (encounter.phase === 'unplugging') return encounter.elapsed < 2.4 ? 'Cypher 跨过倒下的 Dozer，举起脉冲步枪。Apoc 与 Switch 仍在连接椅上。'
    : encounter.elapsed < 4.8 ? 'Cypher 拔掉 Apoc 的接线。矩阵中的身体没有伤口，现实中的信号却已经归零。'
    : 'Switch 的线路也被拔除。Neo 与 Trinity 的两路生命信号仍亮着。';
  if (encounter.phase === 'aiming') return 'Cypher 转向备用控制台。他以为 Tank 已经无法反击；等枪口偏离 Neo 与 Trinity。';
  if (encounter.phase === 'window') return '现在按 G 抓住地上的脉冲步枪并开火。窗口很短，错过会让最后两路信号一起熄灭。';
  if (encounter.phase === 'failed') return 'Cypher 先扣动扳机。Tank 倒下，Neo 与 Trinity 的连接无人接回；从备用控制台重试。';
  if (encounter.phase === 'countering') return encounter.elapsed < 2.2 ? 'Tank 忍住伤口，手掌沿甲板摸到脉冲步枪。' : encounter.elapsed < 3.2 ? '枪口抬起。一次短促的放电击中 Cypher。' : 'Cypher 倒在连接椅之间。两路仍存活的信号等待人工接回。';
  if (encounter.phase === 'reconnect') return (encounter.rescued ?? 0) === 0 ? '按 G 稳住 Neo 的接线并切回操作员通道。' : 'Neo 的信号已经稳定。再按 G 接回 Trinity，完成两路幸存者回收。';
  return 'Tank 接回 Neo 与 Trinity。Dozer、Apoc 与 Switch 已经无法回来，Cypher 的背叛也在这里结束。';
}

export function betrayalPose(gesture: BetrayalGesture) {
  const t = gesture.elapsed; const role = gesture.role;
  const defending = gesture.kind === 'bathroom' && gesture.phase === 'defending';
  const charge = gesture.kind === 'bathroom' && gesture.phase === 'sacrifice' ? smooth(t / 2.2) : 0;
  const fall = gesture.kind === 'bathroom' && gesture.phase === 'sacrifice' && role === 'morpheus' ? smooth((t - 4.2) / 1.3)
    : gesture.kind === 'unplugged' && ['unplugging', 'aiming', 'window'].includes(gesture.phase) && ['tank', 'dozer'].includes(role) ? 1
    : gesture.kind === 'unplugged' && gesture.phase === 'countering' && role === 'cypher' ? smooth((t - 2.2) / .45) : 0;
  const yank = gesture.kind === 'unplugged' && gesture.phase === 'unplugging' && role === 'cypher'
    ? Math.max(smooth((t - 1.4) / .5) * (1 - smooth((t - 2.5) / .45)), smooth((t - 3.7) / .5) * (1 - smooth((t - 4.8) / .45))) : 0;
  const aim = gesture.kind === 'unplugged' && role === 'cypher' && ['aiming', 'window'].includes(gesture.phase) ? 1 : 0;
  const counter = gesture.kind === 'unplugged' && role === 'tank' && gesture.phase === 'countering' ? smooth(t / 2.1) : 0;
  const reconnect = gesture.kind === 'unplugged' && role === 'tank' && gesture.phase === 'reconnect' ? 1 : 0;
  const connected = gesture.kind === 'unplugged' && ['neo', 'trinity', 'apoc', 'switch'].includes(role);
  const afterUnplugging = ['aiming', 'window', 'failed', 'countering', 'reconnect', 'done'].includes(gesture.phase);
  const unplugged = connected && (role === 'apoc' && (t >= 2.25 || afterUnplugging) || role === 'switch' && (t >= 4.55 || afterUnplugging));
  return { defending, charge, fall, yank, aim, counter, reconnect, connected, unplugged };
}
