import type { Philosophy } from '../types/neo-life.js';
import type { FilmJourney } from './film-story.js';

export type OracleVisitPhase = 'waiting' | 'examining' | 'question' | 'responding' | 'done';
export interface OracleVisitEncounter {
  phase: OracleVisitPhase;
  elapsed: number;
  answer?: Philosophy;
  approach?: { x: number; z: number; yaw: number };
}
export type OracleVisitRole = 'neo' | 'oracle';
export type OracleVisitGesture = OracleVisitEncounter & { role: OracleVisitRole };

export const ORACLE_VISIT = {
  neo: { x: -4.35, z: -22, yaw: -Math.PI / 2 },
  oracle: { x: -7.1, z: -22, yaw: Math.PI / 2 },
  examination: 10.8,
  response: 4.2,
} as const;

export const ORACLE_COOKIE = { contact: { x: -5.6, y: 3.25, z: -22.05 }, transfer: 9.2 } as const;
export function oracleCookieOwner(encounter: OracleVisitEncounter): OracleVisitRole | undefined {
  if (encounter.phase === 'waiting' || encounter.phase === 'examining' && encounter.elapsed < 7.35) return undefined;
  return encounter.phase === 'examining' && encounter.elapsed < ORACLE_COOKIE.transfer ? 'oracle' : 'neo';
}

const smooth = (value: number): number => {
  const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t);
};

export function oracleVisitLocked(journey: FilmJourney): boolean {
  const phase = journey.oracle?.consultation?.phase;
  return journey.scene === 'm1_oracle' && !journey.visiting && Boolean(phase && !['waiting', 'done'].includes(phase));
}

export function oracleVisitDuration(encounter: OracleVisitEncounter): number {
  return encounter.phase === 'responding' ? ORACLE_VISIT.response : ORACLE_VISIT.examination;
}

export function oracleVisitRoot(encounter: OracleVisitEncounter, role: OracleVisitRole) {
  const target = ORACLE_VISIT[role];
  if (role === 'oracle' || encounter.phase === 'waiting') return target;
  const origin = encounter.approach ?? target;
  const blend = encounter.phase === 'examining' ? smooth(encounter.elapsed / 1.4) : 1;
  const turn = Math.atan2(Math.sin(target.yaw - origin.yaw), Math.cos(target.yaw - origin.yaw));
  return { x: origin.x + (target.x - origin.x) * blend, z: origin.z + (target.z - origin.z) * blend, yaw: origin.yaw + turn * blend };
}

export function oracleVisitPose(gesture: OracleVisitGesture) {
  const t = gesture.elapsed;
  const inspect = gesture.phase === 'examining' ? smooth((t - 1.5) / 1.2) * (1 - smooth((t - 4.6) / .8)) : 0;
  const listen = gesture.phase === 'examining' ? smooth((t - 4.2) / 1.1) : gesture.phase === 'question' || gesture.phase === 'responding' ? 1 : 0;
  const offer = gesture.phase === 'examining' ? smooth((t - 7.2) / 1.1) : gesture.phase === 'question' || gesture.phase === 'responding' ? 1 : 0;
  const receive = gesture.phase === 'examining' ? smooth((t - 8.25) / .9) : gesture.phase === 'question' || gesture.phase === 'responding' ? 1 : 0;
  return { inspect, listen, offer, receive };
}

export function oracleVisitText(encounter: OracleVisitEncounter): string {
  if (encounter.phase === 'waiting') return '花瓶碎片留在地上。走到厨房操作台旁，亲自接受先知的检查与谈话。';
  if (encounter.phase === 'question') return '先知没有用称号替你作决定。打开手记，回答你会怎样面对 Morpheus、预言与接下来的选择。';
  if (encounter.phase === 'responding') {
    if (encounter.answer === 'care') return '先知把关心从抽象的救世主拉回到一个具体的人：如果 Morpheus 陷入危险，你仍要自己决定是否去救他。';
    if (encounter.answer === 'agency') return '先知接受你的怀疑。预言不会替你判断；你需要在行动里检验信息，并承担自己的决定。';
    return '先知让你保留疑问和有限的信任。不能预先知道结局，并不等于无法与别人共同准备。';
  }
  if (encounter.phase === 'done') return '检查与谈话已经记下。饼干仍有余温，关于 Morpheus 的选择会在之后重新出现。';
  if (encounter.elapsed < 1.5) return '先知关上烤箱，擦净双手，示意你走近一些。';
  if (encounter.elapsed < 4.5) return '她检查你的眼睛、呼吸和掌心，又让你抬头看清门楣上“认识你自己”的字样。';
  if (encounter.elapsed < 7.2) return '她问你是否已经相信自己是救世主。你的迟疑比一个预先准备的答案更诚实。';
  if (encounter.elapsed < 9.2) return '先知没有颁发称号。她提醒你：Morpheus 的信念会把他带进真实的危险。';
  return '她从烤盘拿起一块饼干递给你，并把选择留在你手里。';
}

export function oracleLegacyChoice(answer: Philosophy): 'doubt' | 'rescue' | 'observe' {
  return answer === 'agency' ? 'doubt' : answer === 'care' ? 'rescue' : 'observe';
}

export interface OracleDeparture {
  phase: 'waiting' | 'guiding' | 'ready' | 'talking' | 'bite_ready' | 'biting' | 'leaving' | 'done';
  elapsed: number;
  rise: number;
  approach?: { x: number; z: number; yaw: number };
}
export type OracleDepartureGesture = OracleDeparture & { role: 'neo' | 'morpheus'; target?: { x: number; y: number; z: number } };
export const ORACLE_DEPARTURE = {
  neo: { x: -6.8, z: 10.8, yaw: -Math.PI / 2 },
  morpheus: { x: -8.2, z: 10.8, yaw: Math.PI / 2 },
  exit: { x: 0, z: 27 }, talking: 6.2, biting: 2.8,
} as const;
export function oracleDepartureLocked(departure?: OracleDeparture): boolean {
  return departure?.phase === 'talking' || departure?.phase === 'biting';
}
export function oracleDepartureRoot(departure: OracleDeparture, role: 'neo' | 'morpheus') {
  const target = ORACLE_DEPARTURE[role];
  if (role === 'morpheus') {
    const origin = ORACLE_WAITING_CAST.morpheus;
    const rise = smooth(departure.rise / 2.2), approach = smooth((departure.rise - 2.2) / 1.6);
    return { x: origin.x + (target.x - origin.x) * rise, z: origin.z + (target.z - origin.z) * approach, yaw: target.yaw };
  }
  const origin = departure.approach ?? target, amount = departure.phase === 'talking' ? smooth(departure.elapsed / 1.2) : 1;
  if (departure.phase === 'biting') return origin;
  const turn = Math.atan2(Math.sin(target.yaw - origin.yaw), Math.cos(target.yaw - origin.yaw));
  return { x: origin.x + (target.x - origin.x) * amount, z: origin.z + (target.z - origin.z) * amount, yaw: origin.yaw + turn * amount };
}
export function oracleDepartureText(departure: OracleDeparture): string {
  if (departure.phase === 'waiting') return '饼干仍在手中。走到厨房门内的白衣接待者旁，按 G 请她带你回客厅。';
  if (departure.phase === 'guiding') return '自由跟随接待者回到客厅。她会等落后的你；Morpheus 正从沙发起身。';
  if (departure.phase === 'ready') return 'Morpheus 留出了两人说话的空间。走到他面前，按 G 听他说完。';
  if (departure.phase === 'talking') return 'Morpheus 把手放在你的肩上：先知说过什么，属于你自己。你不必向任何人交代。';
  if (departure.phase === 'bite_ready') return '他没有追问你的预言。按 G 点头，亲自尝一口仍温热的饼干。';
  if (departure.phase === 'biting') return '你点头，把饼干送到嘴边。谈话留下的压力慢慢松开，问题仍由你带走。';
  if (departure.phase === 'leaving') return '饼干上留下一个缺口。走到公寓出口，按 G 确认离开，再继续返回路线。';
  return '会面与离场已经记下。先知的回答不会替你决定下一步。';
}

export function oracleDepartureTarget(departure: OracleDeparture, reception: OracleReception) {
  if (departure.phase === 'waiting' || departure.phase === 'guiding') return oracleReceptionRoot(reception);
  return departure.phase === 'leaving' || departure.phase === 'done' ? ORACLE_DEPARTURE.exit : ORACLE_DEPARTURE.neo;
}

export interface SpoonLesson {
  phase: 'waiting' | 'sitting' | 'demonstrating' | 'offered' | 'receiving' | 'focus' | 'understood' | 'rising' | 'done';
  elapsed: number;
  approach?: { x: number; z: number; yaw: number };
}
export type SpoonGesture = SpoonLesson & { role: 'neo' | 'boy' };
export const SPOON_LESSON = {
  neo: { x: -7.4, z: 9.6, yaw: -Math.PI * .75 },
  boy: { x: -9, z: 8, yaw: Math.PI * .25 },
  contact: { x: -8.32, y: 1.25, z: 8.76 },
  sitting: 4, demonstrating: 3.2, receiving: 2.4, transfer: 1.1, rising: 2.6,
} as const;

export function spoonLessonLocked(lesson?: SpoonLesson): boolean {
  return Boolean(lesson && !['waiting', 'done'].includes(lesson.phase));
}

export function spoonLessonSeat(lesson: SpoonLesson): number {
  return lesson.phase === 'sitting' ? smooth((lesson.elapsed - 1.1) / 2.8)
    : lesson.phase === 'rising' ? 1 - smooth(lesson.elapsed / SPOON_LESSON.rising)
      : ['waiting', 'done'].includes(lesson.phase) ? 0 : 1;
}

export function spoonLessonRoot(lesson: SpoonLesson, role: SpoonGesture['role']) {
  const target = SPOON_LESSON[role], origin = lesson.approach ?? target;
  if (role === 'boy' || lesson.phase !== 'sitting') return target;
  const amount = smooth(lesson.elapsed / 1.1), turn = Math.atan2(Math.sin(target.yaw - origin.yaw), Math.cos(target.yaw - origin.yaw));
  return { x: origin.x + (target.x - origin.x) * amount, z: origin.z + (target.z - origin.z) * amount, yaw: origin.yaw + turn * amount };
}

export function spoonLessonBend(lesson: SpoonLesson, role: SpoonGesture['role'], bend: number): number | undefined {
  const transferred = ['focus', 'understood', 'rising', 'done'].includes(lesson.phase) || lesson.phase === 'receiving' && lesson.elapsed >= SPOON_LESSON.transfer;
  if (role === 'neo') return transferred ? bend : undefined;
  if (transferred) return undefined;
  return lesson.phase === 'demonstrating' ? smooth(lesson.elapsed / 1.1) * (1 - smooth((lesson.elapsed - 1.8) / 1.2)) : 0;
}

export function spoonLessonText(lesson: SpoonLesson): string {
  if (lesson.phase === 'waiting') return '走到孩子面前的地毯上，按 G 坐下，看看他手里的勺子。';
  if (lesson.phase === 'sitting') return '你在孩子面前坐下。他把勺子举到两人都看得清的位置。';
  if (lesson.phase === 'demonstrating') return '孩子没有用双手折它。金属轻轻弯曲，又在递出之前恢复笔直。';
  if (lesson.phase === 'offered') return '孩子向你递出勺子。按 G 亲手接过，试着重新理解眼前的规则。';
  if (lesson.phase === 'receiving') return '你伸出右手捏住勺柄。孩子等你接稳，才松手退回。';
  if (lesson.phase === 'focus') return '按住 G 注视勺子，松开时它会恢复。试着改变自己对规则的理解。';
  if (lesson.phase === 'understood') return '勺子保留了弯曲的形状。按 G 起身，把这个疑问带进先知的厨房。';
  if (lesson.phase === 'rising') return '你带着弯曲的勺子慢慢站起，准备走向厨房。';
  return '勺子已经弯曲。走到厨房门口，亲自与先知会面。';
}

export interface OracleReception {
  phase: 'waiting' | 'approaching' | 'inviting' | 'guiding' | 'ready' | 'returning' | 'returned';
  progress: number;
  elapsed: number;
}
export type OracleReceptionGesture = OracleReception & { target?: { x: number; y: number; z: number }; seated?: boolean; rising?: number };
export const ORACLE_WAITING_CAST = {
  morpheus: { x: -10.4, z: 12, yaw: Math.PI / 2, kind: 'watching' },
  oracle_attendant: { x: -10.4, z: 16, yaw: Math.PI / 2, kind: 'watching' },
  potential_blocks: { x: 7.2, z: 4.8, yaw: Math.PI, kind: 'blocks' },
  potential_1: { x: 5.8, z: 14.5, yaw: -Math.PI / 2, kind: 'meditating' },
  potential_2: { x: 7.8, z: 20.4, yaw: Math.PI, kind: 'playing' },
  potential_3: { x: -5.8, z: 23, yaw: Math.PI / 2, kind: 'meditating' },
  potential_4: { x: 4.1, z: 24.3, yaw: Math.PI, kind: 'playing' },
} as const;
export type OracleWaitingGesture = { kind: typeof ORACLE_WAITING_CAST[keyof typeof ORACLE_WAITING_CAST]['kind']; elapsed: number };
export const ORACLE_RECEPTION_CAST = ['oracle_priestess', ...Object.keys(ORACLE_WAITING_CAST)] as const;
export const ORACLE_RECEPTION = {
  approach: [{ x: -2, z: -5.5 }, { x: -2, z: 10.8 }, { x: -6.8, z: 10.3 }],
  guide: [{ x: -6.8, z: 10.3 }, { x: -2, z: 10.8 }, { x: -2, z: -9.6 }, { x: -4.6, z: -10.2 }],
  returning: [{ x: -4.6, z: -10.2 }, { x: -2, z: -9.6 }, { x: -2, z: 10.8 }, { x: -5.5, z: 10.8 }, { x: -5.5, z: 14.4 }],
  speed: 2.6, invitation: 2.2,
} as const;
export function oracleReceptionLength(phase: 'approaching' | 'guiding' | 'returning'): number {
  const route = phase === 'approaching' ? ORACLE_RECEPTION.approach : phase === 'returning' ? ORACLE_RECEPTION.returning : ORACLE_RECEPTION.guide;
  return route.slice(1).reduce((length, point, i) => length + Math.hypot(point.x - route[i].x, point.z - route[i].z), 0);
}
export function oracleReceptionRoot(reception: OracleReception) {
  if (reception.phase === 'waiting') return { ...ORACLE_RECEPTION.approach[0], yaw: 0 };
  if (reception.phase === 'inviting') return { ...ORACLE_RECEPTION.approach[2], yaw: -Math.PI * .75 };
  if (reception.phase === 'ready') return { ...ORACLE_RECEPTION.guide.at(-1)!, yaw: Math.PI / 2 };
  if (reception.phase === 'returned') return { ...ORACLE_RECEPTION.returning.at(-1)!, yaw: Math.PI / 2 };
  const route = reception.phase === 'approaching' ? ORACLE_RECEPTION.approach : reception.phase === 'returning' ? ORACLE_RECEPTION.returning : ORACLE_RECEPTION.guide;
  let remaining = Math.max(0, reception.progress);
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1], b = route[i], length = Math.hypot(b.x - a.x, b.z - a.z);
    if (remaining > length && i < route.length - 1) { remaining -= length; continue; }
    const t = Math.min(1, remaining / length);
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, yaw: Math.atan2(b.x - a.x, b.z - a.z) };
  }
  return { ...ORACLE_RECEPTION.guide.at(-1)!, yaw: Math.PI / 2 };
}

export function oracleReceptionText(reception: OracleReception): string {
  if (reception.phase === 'approaching') return '勺子保持弯曲。接待者从厨房走来，孩子安静地等在你面前。';
  if (reception.phase === 'inviting') return reception.elapsed < ORACLE_RECEPTION.invitation
    ? '接待者轻触你的肩膀，告诉你先知现在愿意见你。'
    : '先知正在厨房等你。按 G 起身，再跟随接待者穿过房门。';
  if (reception.phase === 'guiding') return '跟随白衣接待者走向厨房。她会等你，可以自由停留和观察孩子们。';
  if (reception.phase === 'ready') return '接待者在厨房门内等你。亲自穿过门口，先知正在烤箱旁。';
  return '';
}

export interface OracleArrival {
  phase: 'hallway' | 'waiting' | 'opening' | 'welcome' | 'guiding' | 'settling' | 'done';
  elapsed: number;
  hostess: number;
  morpheus: number;
  seating: number;
}
export type OracleArrivalGesture = OracleArrival & { role: 'hostess' | 'morpheus' };
export const ORACLE_ENTRANCE = {
  entry: { x: 0, z: 47 }, door: { x: -2.4, z: 29.8, width: 4.8, height: 6.6, depth: .18 },
  threshold: { x: .5, z: 32.3 }, opening: 1.8, welcome: 3, speed: 3,
  hall: [{ x: -1.5, z: 43 }, { x: -1.5, z: 34 }],
  welcomeRoute: [{ x: -4, z: 25.62 }, { x: -4, z: 23.5 }, { x: 0, z: 23.5 }],
  guide: [{ x: 0, z: 23.5 }, { x: 0, z: 18 }],
  return: [{ x: 0, z: 18 }, { x: -2, z: 18 }, { x: -2, z: -5.5 }],
  morpheus: [{ x: -1.5, z: 34 }, { x: 0, z: 34 }, { x: 0, z: 23 }, { x: -8.2, z: 23 }, { x: -8.2, z: 12 }],
} as const;
export function oracleArrivalPending(arrival?: OracleArrival): boolean {
  return Boolean(arrival && !['settling', 'done'].includes(arrival.phase));
}
export function oracleArrivalDoor(arrival?: OracleArrival): number {
  return !arrival || ['welcome', 'guiding', 'settling', 'done'].includes(arrival.phase) ? Math.PI / 2
    : arrival.phase === 'opening' ? smooth((arrival.elapsed - .35) / 1.25) * Math.PI / 2 : 0;
}
export function oracleArrivalHandle(arrival?: OracleArrival) {
  const angle = oracleArrivalDoor(arrival), door = ORACLE_ENTRANCE.door;
  return { x: door.x + 4.18 * Math.cos(angle) - .2 * Math.sin(angle), y: 3.1, z: door.z - 4.18 * Math.sin(angle) - .2 * Math.cos(angle) };
}
type ArrivalRoute = keyof Pick<typeof ORACLE_ENTRANCE, 'hall' | 'welcomeRoute' | 'guide' | 'return' | 'morpheus'>;
export function oracleArrivalLength(route: ArrivalRoute): number {
  const points = ORACLE_ENTRANCE[route];
  return points.slice(1).reduce((length, point, i) => length + Math.hypot(point.x - points[i].x, point.z - points[i].z), 0);
}
function arrivalPath(route: ArrivalRoute, progress: number) {
  const points = ORACLE_ENTRANCE[route]; let remaining = Math.max(0, progress);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], length = Math.hypot(b.x - a.x, b.z - a.z);
    if (remaining > length && i < points.length - 1) { remaining -= length; continue; }
    const t = Math.min(1, remaining / length);
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, yaw: Math.atan2(b.x - a.x, b.z - a.z) };
  }
  return { ...points.at(-1)!, yaw: Math.PI };
}
export function oracleArrivalRoot(arrival: OracleArrival, role: OracleArrivalGesture['role']) {
  if (role === 'morpheus') {
    if (arrival.phase === 'hallway') return arrivalPath('hall', arrival.morpheus);
    if (['waiting', 'opening', 'welcome'].includes(arrival.phase)) return { ...ORACLE_ENTRANCE.hall.at(-1)!, yaw: Math.PI };
    const point = arrivalPath('morpheus', arrival.morpheus), seat = smooth(arrival.seating / 2.2);
    return { ...point, x: point.x + (ORACLE_WAITING_CAST.morpheus.x - point.x) * seat, yaw: arrival.seating > 0 ? Math.PI / 2 : point.yaw };
  }
  if (['hallway', 'waiting', 'opening'].includes(arrival.phase)) {
    const angle = oracleArrivalDoor(arrival), hand = oracleArrivalHandle(arrival);
    return { x: hand.x - 1.4 * Math.sin(angle), z: hand.z - 1.4 * Math.cos(angle), yaw: angle };
  }
  if (arrival.phase === 'welcome') return arrivalPath('welcomeRoute', oracleArrivalLength('welcomeRoute') * smooth(arrival.elapsed / ORACLE_ENTRANCE.welcome));
  return arrivalPath(arrival.phase === 'guiding' ? 'guide' : 'return', arrival.hostess);
}
export function oracleArrivalTarget(arrival: OracleArrival) {
  return arrival.phase === 'hallway' ? oracleArrivalRoot(arrival, 'morpheus')
    : ['waiting', 'opening', 'welcome'].includes(arrival.phase) ? ORACLE_ENTRANCE.threshold : oracleArrivalRoot(arrival, 'hostess');
}
export function oracleArrivalText(arrival: OracleArrival): string {
  if (arrival.phase === 'hallway') return '电梯停在旧公寓楼层。跟随 Morpheus 走过楼道；你落后时他会等你。';
  if (arrival.phase === 'waiting') return 'Morpheus 在门旁停下：他可以带你找到门，是否走进去仍由你决定。靠近门前，按 G 准备进入。';
  if (arrival.phase === 'opening') return '你还没有碰到门把手，门已从里面打开。白衣接待者走到门边迎接你。';
  if (arrival.phase === 'welcome') return '接待者认出了 Neo，示意 Morpheus 随意坐下。等她让开门口，再亲自走进去。';
  if (arrival.phase === 'guiding') return '走过门槛，跟随白衣接待者进入客厅。孩子们仍在练习，Morpheus 走向沙发。';
  return '接待者让你在客厅等候，随后返回厨房。你可以自由观察，再坐到拿勺子的孩子面前。';
}
