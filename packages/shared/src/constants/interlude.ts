import type { FilmJourney } from './film-story.js';
import type { Philosophy } from '../types/neo-life.js';

export type InterludeKind = 'console' | 'steak' | 'meal';
export type InterludePhase = 'ready' | 'performing' | 'choice' | 'responding' | 'done';
export interface InterludeEncounter {
  kind: InterludeKind;
  phase: InterludePhase;
  elapsed: number;
  answer?: Philosophy;
}
export type InterludeRole = 'neo' | 'cypher' | 'smith' | 'tank' | 'mouse' | 'dozer' | 'apoc' | 'switch';
export type InterludeGesture = InterludeEncounter & { role: InterludeRole };

export const INTERLUDE_TIMING = {
  console: 8.4,
  consoleResponse: 4.6,
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
    smith: { x: 0, z: -8.7, yaw: Math.PI },
    cypher: { x: 0, z: -17.3, yaw: 0 },
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
    && (journey.interlude.phase === 'performing' || journey.interlude.phase === 'responding'));
}

export function interludeDuration(encounter: InterludeEncounter): number {
  if (encounter.phase === 'responding') return INTERLUDE_TIMING.consoleResponse;
  return INTERLUDE_TIMING[encounter.kind];
}

export function interludeRoot(kind: InterludeKind, role: InterludeRole) {
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
    if (phase === 'ready') return 'Cypher 独自在值班台前读代码。走近滚动屏幕，再决定是否打断他。';
    if (phase === 'choice') return '酒杯留在控制台边。打开手记，回应他对真相、后悔与同伴的试探。';
    if (phase === 'responding') return 'Cypher 听完你的回答，把杯子慢慢放回控制台。';
    if (phase === 'done') return '这次夜班谈话已经记下。Neo 察觉到 Cypher 的动摇，却不知道他随后会做什么。';
    if (elapsed < 1.3) return 'Cypher 被身后的脚步惊到，立刻遮住刚才正在编写的程序。';
    if (elapsed < 3.5) return '他重新调出城市代码，解释自己早已不再看见字符，只看见街道与人。';
    if (elapsed < 5.7) return 'Cypher 倒出一小杯船上自制的烈酒，问 Morpheus 是否说明了被选中的代价。';
    if (elapsed < 7.2) return '他提到此前相信预言的人都没有回来，并提醒 Neo 看见特工就逃。';
    return 'Neo 放下酒杯。Cypher 的玩笑听起来更像一次没有说完的警告。';
  }
  if (kind === 'steak') {
    if (phase === 'ready') return 'Smith 已经抵达窗边餐桌。走近座位，以旁观视角进入这场既定交易。';
    if (phase === 'done') return '交易已经成立。此段属于 Smith 的旁观视角，Neo 此时并不知道 Cypher 的选择。';
    if (elapsed < 2.5) return '锯齿餐刀切开牛排。Cypher 先品尝这份只存在于感官信号中的奢侈。';
    if (elapsed < 5.2) return 'Cypher 承认味道是矩阵写给大脑的结果，却仍把舒适当成值得交换的东西。';
    if (elapsed < 7.6) return '他要求重新接入、抹去现实记忆，并得到一段富有而重要的人生。';
    if (elapsed < 10.8) return 'Smith 接受这些条件，随后索要锡安主机的接入密码。';
    if (elapsed < 12.8) return 'Cypher 说自己拿不到密码，却能把知道密码的人交出来。';
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
