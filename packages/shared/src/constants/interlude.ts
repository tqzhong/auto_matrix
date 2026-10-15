import type { FilmJourney } from './film-story.js';
import type { Philosophy } from '../types/neo-life.js';
import { STEAK_DINING, steakAge } from './steak.js';

export type InterludeKind = 'console' | 'steak' | 'meal';
export type InterludePhase = 'ready' | 'performing' | 'accept_ready' | 'accepting' | 'sip_ready' | 'sipping' | 'returning' | 'choice' | 'responding' | 'done';
export interface InterludeEncounter {
  kind: InterludeKind;
  phase: InterludePhase;
  elapsed: number;
  answer?: Philosophy;
  physicalConsole?: boolean;
  physicalPour?: boolean;
  physicalSteak?: boolean;
}
export type InterludeRole = 'neo' | 'cypher' | 'smith' | 'tank' | 'mouse' | 'dozer' | 'apoc' | 'switch';
export type InterludeGesture = InterludeEncounter & { role: InterludeRole };

export const INTERLUDE_TIMING = {
  console: 8.4,
  consoleResponse: 4.6,
  consoleIntro: 4.4,
  consoleServe: 9.6,
  consoleToast: 10.8,
  consoleTake: 2.2,
  consoleSip: 4.8,
  consoleReturn: 6.4,
  steak: 14.5,
  meal: 13.2,
} as const;

export const INTERLUDE_CAST: Record<InterludeKind, readonly InterludeRole[]> = {
  console: ['neo', 'cypher'],
  steak: ['smith', 'cypher'],
  meal: ['neo', 'tank', 'mouse', 'dozer', 'apoc', 'switch'],
};

export const INTERLUDE_ROOTS: Record<InterludeKind, Record<string, { x: number; z: number; yaw: number }>> = {
  console: {
    neo: { x: 3.4, z: 7.2, yaw: Math.PI / 2 },
    cypher: { x: 6.5, z: 6, yaw: -Math.PI / 2 },
  },
  steak: {
    smith: STEAK_DINING.smith,
    cypher: STEAK_DINING.cypher,
  },
  meal: {
    neo: { x: -1.5, z: 22, yaw: -Math.PI / 2 },
    tank: { x: -4.7, z: 18.7, yaw: 0 },
    mouse: { x: -8, z: 18.7, yaw: 0 },
    switch: { x: -11.2, z: 18.7, yaw: 0 },
    dozer: { x: -4.7, z: 25.3, yaw: Math.PI },
    apoc: { x: -8, z: 25.3, yaw: Math.PI },
  },
};

export function interludeKind(scene: string): InterludeKind | undefined {
  if (scene === 'm1_cypher_console') return 'console';
  if (scene === 'm1_steak') return 'steak';
  if (scene === 'm1_meal') return 'meal';
  return undefined;
}

export function interludeLocked(journey: FilmJourney): boolean {
  return Boolean(!journey.visiting && interludeKind(journey.scene) && journey.interlude
    && ['performing', 'responding', 'accept_ready', 'accepting', 'sip_ready', 'sipping', 'returning'].includes(journey.interlude.phase));
}

export function interludeWaiting(encounter: InterludeEncounter): boolean {
  return encounter.kind === 'console' && (encounter.phase === 'accept_ready' || encounter.phase === 'sip_ready');
}

export function interludeDuration(encounter: InterludeEncounter): number {
  if (encounter.kind === 'steak' && encounter.physicalSteak) return STEAK_DINING.duration;
  if (encounter.kind === 'console' && encounter.physicalConsole) {
    if (encounter.phase === 'performing') return encounter.physicalPour ? INTERLUDE_TIMING.consoleServe : INTERLUDE_TIMING.consoleIntro;
    if (encounter.phase === 'accepting') return INTERLUDE_TIMING.consoleTake;
    if (encounter.phase === 'sipping') return INTERLUDE_TIMING.consoleSip;
    if (encounter.phase === 'returning') return INTERLUDE_TIMING.consoleReturn;
  }
  if (encounter.phase === 'responding') return encounter.physicalPour ? INTERLUDE_TIMING.consoleToast : INTERLUDE_TIMING.consoleResponse;
  return INTERLUDE_TIMING[encounter.kind];
}

export const CONSOLE_DRINK = {
  shelf: { x: 5.8, z: 7.75, width: 2.5, depth: 1.3, height: 2.1 },
  cup: { x: 4.74, y: 2.34, z: 7.75, yaw: Math.PI / 2 },
  radius: .16, height: .48, transfer: .9, release: 2.4,
} as const;

export const CONSOLE_OPERATOR = {
  desk: { x: 8.7, z: 6, width: 2.8, depth: 4.8, height: 1.86 },
  keyboard: { x: 7.75, y: 1.99, z: 6, width: .72, depth: 2.5 },
} as const;

export const CONSOLE_SERVICE = {
  jug: { x: 5.92, y: CONSOLE_DRINK.shelf.height, z: 7.75, yaw: Math.PI / 2 },
  handle: { x: .57, y: .4, z: 0 }, neck: { x: -.23, radius: .085 }, spout: { x: -.315, y: 1.03, z: 0 },
  cup: { x: -.94, y: 2.42, z: 1, yaw: -Math.PI / 2 },
  grasp: 3.3, release: 8.6, flowStart: 5.2, flowEnd: 6.8,
} as const;

export function cypherCupRest(encounter: InterludeEncounter) {
  const chair = INTERLUDE_ROOTS.console.cypher, yaw = consoleOperatorPose(encounter).yaw, cup = CONSOLE_SERVICE.cup;
  return { x: chair.x + Math.cos(yaw) * cup.x + Math.sin(yaw) * cup.z, y: cup.y,
    z: chair.z - Math.sin(yaw) * cup.x + Math.cos(yaw) * cup.z, yaw: yaw + cup.yaw };
}

export function consoleOperatorPose(encounter: InterludeEncounter) {
  const t = encounter.phase === 'ready' ? 0 : encounter.phase === 'performing' ? encounter.elapsed : 4.4;
  return { yaw: Math.PI / 2 - Math.PI * ease(t, .9, 2.2), typing: 1 - ease(t, .2, .8),
    glance: Math.sin(Math.PI * ease(t, .1, 1.7)) };
}

export function interludeAge(encounter: InterludeEncounter): number {
  if (encounter.kind !== 'console') return encounter.elapsed;
  if (!encounter.physicalConsole) return encounter.phase === 'choice' ? INTERLUDE_TIMING.console
    : encounter.phase === 'responding' || encounter.phase === 'done' ? INTERLUDE_TIMING.console + encounter.elapsed : encounter.elapsed;
  const intro = encounter.physicalPour ? INTERLUDE_TIMING.consoleServe : INTERLUDE_TIMING.consoleIntro;
  const take = intro + INTERLUDE_TIMING.consoleTake, sip = take + INTERLUDE_TIMING.consoleSip;
  const end = sip + INTERLUDE_TIMING.consoleReturn;
  const offset = { ready: 0, performing: 0, accept_ready: intro, accepting: intro, sip_ready: take, sipping: take,
    returning: sip, choice: end, responding: end, done: end }[encounter.phase];
  return offset + encounter.elapsed;
}

const ease = (t: number, a: number, b: number) => { const x = Math.max(0, Math.min(1, (t - a) / (b - a))); return x * x * (3 - 2 * x); };
export function consolePourPose(encounter: InterludeEncounter) {
  const active = encounter.physicalPour && encounter.phase === 'performing', t = active ? encounter.elapsed : 0;
  return { reach: active ? ease(t, 2.3, CONSOLE_SERVICE.grasp) * (1 - ease(t, CONSOLE_SERVICE.release, 9.6)) : 0,
    carry: active ? ease(t, CONSOLE_SERVICE.grasp, 4.4) * (1 - ease(t, 7.6, 8.5)) : 0,
    pour: active ? ease(t, 4.4, CONSOLE_SERVICE.flowStart) * (1 - ease(t, CONSOLE_SERVICE.flowEnd, 7.6)) : 0,
    grip: active ? ease(t, 2.85, CONSOLE_SERVICE.grasp) * (1 - ease(t, 9, 9.5)) : 0,
    holding: Boolean(active && t >= CONSOLE_SERVICE.grasp && t < CONSOLE_SERVICE.release),
    flowing: Boolean(active && t >= CONSOLE_SERVICE.flowStart && t < CONSOLE_SERVICE.flowEnd),
    filled: !encounter.physicalPour ? 1 : active ? ease(t, CONSOLE_SERVICE.flowStart, CONSOLE_SERVICE.flowEnd) : encounter.phase === 'ready' ? 0 : 1 };
}

export function cypherDrinkPose(encounter: InterludeEncounter) {
  if (encounter.physicalPour && encounter.phase === 'done') return consoleDrinkPose({ ...encounter, phase: 'returning', elapsed: 3.8 });
  if (!encounter.physicalPour || encounter.phase !== 'responding') return consoleDrinkPose({ ...encounter, phase: 'ready' });
  const t = encounter.elapsed;
  return t < 2.2 ? consoleDrinkPose({ ...encounter, phase: 'accepting' })
    : t < 7 ? consoleDrinkPose({ ...encounter, phase: 'sipping', elapsed: t - 2.2 })
      : consoleDrinkPose({ ...encounter, phase: 'returning', elapsed: t - 7 });
}
export function consoleDrinkPose(encounter: InterludeEncounter): { reach: number; carry: number; lift: number; tilt: number; grip: number; holding: boolean; drunk: number } {
  const t = encounter.elapsed, phase = encounter.phase;
  if (!encounter.physicalConsole && phase === 'performing') {
    if (t >= 4.6 && t < 5.1) return consoleDrinkPose({ ...encounter, physicalConsole: true, phase: 'accepting', elapsed: (t - 4.6) * 4.4 });
    if (t >= 5.1 && t < 7.4) return consoleDrinkPose({ ...encounter, physicalConsole: true, phase: 'sipping', elapsed: (t - 5.1) / 2.3 * INTERLUDE_TIMING.consoleSip });
    if (t >= 7.4 && t < 8.15) return consoleDrinkPose({ ...encounter, physicalConsole: true, phase: 'returning', elapsed: (t - 7.4) / .75 * 3.8 });
  }
  const taking = phase === 'accepting', returning = phase === 'returning';
  const held = phase === 'sip_ready' || phase === 'sipping';
  const reach = taking ? ease(t, 0, CONSOLE_DRINK.transfer) : held ? 1 : returning ? 1 - ease(t, CONSOLE_DRINK.release, 3.8) : 0;
  return { reach, carry: taking ? ease(t, CONSOLE_DRINK.transfer, INTERLUDE_TIMING.consoleTake) : held ? 1 : returning ? 1 - ease(t, 0, 2.1) : 0,
    lift: phase === 'sipping' ? ease(t, 0, 1.4) * (1 - ease(t, 2.6, INTERLUDE_TIMING.consoleSip)) : 0,
    tilt: phase === 'sipping' ? ease(t, 0, 1.4) * (1 - ease(t, 2.6, INTERLUDE_TIMING.consoleSip)) : 0,
    grip: taking ? ease(t, .55, CONSOLE_DRINK.transfer) : held ? 1 : returning ? 1 - ease(t, CONSOLE_DRINK.release, 3.1) : 0,
    holding: taking ? t >= CONSOLE_DRINK.transfer : held || returning && t < CONSOLE_DRINK.release,
    drunk: phase === 'sipping' ? ease(t, 1.8, 2.6) : ['returning', 'choice', 'responding', 'done'].includes(phase) ? 1 : 0 };
}

export function interludeRoot(kind: InterludeKind, role: InterludeRole, encounter?: InterludeEncounter) {
  if (kind === 'console' && role === 'cypher' && encounter) return { ...INTERLUDE_ROOTS.console.cypher, yaw: consoleOperatorPose(encounter).yaw };
  return INTERLUDE_ROOTS[kind][role];
}

export function interludeSeated(gesture: InterludeGesture): boolean {
  if (gesture.kind === 'console') return gesture.role === 'cypher';
  if (gesture.kind === 'steak') return true;
  return gesture.role !== 'tank' || gesture.elapsed >= 2.2;
}

export function interludeText(encounter: InterludeEncounter): string {
  const { kind, phase, elapsed } = encounter;
  if (kind === 'console') {
    if (phase === 'accept_ready') return 'Cypher 把船上的烈酒放在台边。按 G 伸手接过金属杯；等待不会替 Neo 接杯。';
    if (phase === 'accepting') return 'Neo 靠近台面，握住金属杯身，把杯子收回身前。';
    if (phase === 'sip_ready') return '杯子已经握稳。按 G 品尝一口，再继续这次夜班谈话。';
    if (phase === 'sipping') return elapsed < 2.6 ? 'Neo 抬起杯子，尝了一口船上自制的烈酒。' : '烈酒让 Neo 停顿了一下。Cypher 说，这是 Dozer 在船上酿的。';
    if (phase === 'returning') return elapsed < 2.4 ? 'Neo 把杯子稳稳放回台面。' : 'Cypher 谈起曾相信预言却没有回来的同伴，提醒 Neo：遇见特工就逃。';
    if (phase === 'ready') return 'Cypher 独自在值班台前读代码。走近滚动屏幕，再决定是否打断他。';
    if (phase === 'choice') return '酒杯留在控制台边。打开手记，回应他对真相、后悔与同伴的试探。';
    if (phase === 'responding') return encounter.physicalPour ? 'Cypher 举起自己的杯子听完回答，喝了一口，再放回台面；他仍没有解释那段程序的用途。' : encounter.physicalConsole ? 'Cypher 听完你的回答，没有解释那段程序的用途。' : 'Cypher 听完你的回答，把杯子慢慢放回控制台。';
    if (phase === 'done') return '这次夜班谈话已经记下。Neo 察觉到 Cypher 的动摇，却不知道他随后会做什么。';
    if (elapsed < 1.3) return 'Cypher 被身后的脚步惊到，立刻遮住刚才正在编写的程序。';
    if (elapsed < 3.5) return '他重新调出城市代码，解释自己早已不再看见字符，只看见街道与人。';
    if (encounter.physicalPour) return elapsed < 7.6 ? 'Cypher 取过塑料酒壶，把 Dozer 酿的烈酒倒进 Neo 的金属杯。' : '他把酒壶放回台面，示意 Neo 接过杯子。';
    if (elapsed < 5.7) return encounter.physicalConsole ? 'Cypher 示意 Neo 看台边的烈酒，问 Morpheus 是否说明了被选中的代价。' : 'Cypher 倒出一小杯船上自制的烈酒，问 Morpheus 是否说明了被选中的代价。';
    if (elapsed < 7.2) return '他提到此前相信预言的人都没有回来，并提醒 Neo 看见特工就逃。';
    return 'Neo 放下酒杯。Cypher 的玩笑听起来更像一次没有说完的警告。';
  }
  if (kind === 'steak') {
    if (phase === 'ready') return 'Smith 已经抵达窗边餐桌。走近座位，以旁观视角进入这场既定交易。';
    if (phase === 'done') return '交易已经成立。Smith 留在座位上；按 G 继续 Neo 的故事。Neo 此时并不知道 Cypher 的选择。';
    const age = steakAge(encounter);
    if (age < 3.5) return '餐刀切开牛排。Cypher 用右手的叉子固定切下的一小块。';
    if (age < 8.6) return 'Cypher 承认味道是矩阵写给大脑的结果，却仍把这块牛排送到嘴边。';
    if (age < 13) return '他要求重新接入、抹去现实记忆，并得到一段富有而重要的人生。';
    if (age < 18) return 'Smith 接受这些条件，随后索要锡安主机的接入密码。';
    if (age < 23) return 'Cypher 举起酒杯，说自己拿不到密码，却能把知道密码的人交出来。';
    return '最后一个条件落在 Morpheus 身上。Smith 没有再追问。';
  }
  if (phase === 'ready') return 'Tank 端来一碗单细胞蛋白。走到餐桌边，亲手接下船上的这一餐。';
  if (phase === 'done') return '餐桌上的玩笑散去。走回核心连接区，准备接入矩阵去见先知。';
  if (elapsed < 2.3) return 'Tank 把碗滑到 Neo 面前。它并不好看，却包含身体继续工作所需的营养。';
  if (elapsed < 5.1) return 'Mouse 和 Apoc 用流质鸡蛋与鼻涕来形容口感，短暂的笑声填满了狭窄舱室。';
  if (elapsed < 8.6) return 'Mouse 追问机器如何知道旧世界食物的味道：所谓熟悉，也许只是系统给出的比较。';
  if (elapsed < 10.5) return 'Switch 打断了越说越远的推论。Neo 尝了一口，第一次参与船员的普通生活。';
  return '话题转向红衣女子训练和先知。Morpheus 要求飞船升到广播深度，下一次接入即将开始。';
}
