import type { MobilEncounter } from './film-story.js';

// Dimensions are game units, fitted to the finished film's proportions.
export const MOBIL_STATION = {
  width: 34, depth: 110, height: 9.2, edge: 7.55, trackFloor: -1.35,
  bench: { x: -13, z: -8, width: 1.75, depth: 6.2, seat: 1.35, height: 2.95 },
  train: { x: 11.15, stop: -20, entry: -80, width: 6.6, length: 28, height: 6.4,
    floor: 0, doorX: -3.32, doorHalf: .87, doorSlide: 1.65, doorWidth: 1.7, doorHeight: 5.45 },
} as const;

const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => { const p = clamp(n); return p * p * (3 - 2 * p); };

export const MOBIL_LUGGAGE = { x: -11.7, z: -10, width: 1.35, height: 1.1, depth: .48, grip: 1.31,
  grasp: .55, lift: 1.9, walk: .7, return: 2.8 } as const;
export interface MobilLuggage {
  phase: 'ready' | 'lifting' | 'carried' | 'dropped' | 'retrieving' | 'returned'; elapsed: number;
  approach?: { x: number; z: number; yaw: number };
  drop?: { x: number; y: number; z: number; yaw: number };
  floor?: { x: number; z: number; yaw: number };
  parentFrom?: { x: number; z: number; yaw: number };
  walk?: number;
}
export interface MobilLuggageGesture { role: 'neo' | 'rama_kandra'; luggage: MobilLuggage; }
export function mobilLuggageParent(state: MobilLuggage) {
  const floor = state.floor!, standing = { x: floor.x - 1.25, z: floor.z, yaw: Math.PI / 2 };
  if (state.phase === 'retrieving') {
    const walk = state.walk ?? MOBIL_LUGGAGE.walk, from = state.parentFrom!, p = smooth(state.elapsed / walk);
    return { x: from.x + (standing.x - from.x) * p, y: 0, z: from.z + (standing.z - from.z) * p, yaw: standing.yaw,
      moving: state.elapsed < walk };
  }
  const p = clamp(state.elapsed / MOBIL_LUGGAGE.return), a = clamp(p / .35), b = clamp((p - .35) / .4), c = clamp((p - .75) / .25);
  return { x: standing.x + (6.45 - standing.x) * a + b * 4.4, y: 0, z: standing.z + (-20 - standing.z) * a - c * 2,
    yaw: a < 1 ? Math.atan2(6.45 - standing.x, -20 - standing.z) : Math.PI / 2, moving: p < 1 };
}
/** The suitcase rests on the platform until the saved grasp, then rises with the hand. */
export function mobilLuggagePose(state?: MobilLuggage, carrier?: { x: number; y?: number; z: number; yaw: number }) {
  const bag = MOBIL_LUGGAGE;
  let x: number = bag.x, y = 0, z: number = bag.z, yaw = -Math.PI / 2;
  if (state?.phase === 'dropped') {
    const drop = state.drop!, t = Math.min(state.elapsed, Math.sqrt(Math.max(0, drop.y) / 4.9));
    x = drop.x - .7 * t; y = Math.max(0, drop.y - 4.9 * t * t); z = drop.z; yaw = drop.yaw;
  } else if (state && state.phase !== 'ready') {
    const parent = state.phase === 'retrieving' || state.phase === 'returned';
    const root = carrier ?? (parent ? mobilLuggageParent(state) : { ...state.approach!, y: 0 });
    const side = parent ? -1.25 : -1.4, forward = .08;
    const held = { x: root.x + Math.cos(root.yaw) * side + Math.sin(root.yaw) * forward,
      y: (root.y ?? 0) + (parent ? 2.12 : 2.75) - bag.grip,
      z: root.z - Math.sin(root.yaw) * side + Math.cos(root.yaw) * forward };
    const lifting = state.phase === 'lifting' || state.phase === 'retrieving';
    const time = state.elapsed - (parent ? state.walk ?? bag.walk : 0);
    const p = lifting ? smooth((time - bag.grasp) / (bag.lift - bag.grasp)) : 1;
    const floor = parent ? state.floor! : { x: bag.x, z: bag.z, yaw: -Math.PI / 2 };
    x = floor.x + (held.x - floor.x) * p; y = held.y * p; z = floor.z + (held.z - floor.z) * p;
    if (lifting && !parent) {
      const clear = .35 * Math.sin(p * Math.PI);
      x += Math.sin(root.yaw) * clear; z += Math.cos(root.yaw) * clear;
    }
    yaw = floor.yaw + (root.yaw - floor.yaw) * p;
    if (parent && (!lifting || time >= 0)) {
      // Raise the case before sweeping it around the knees; its narrow edge then fits the doorway.
      const angle = -Math.PI / 2 * p, side = Math.sin(angle) * 1.25, forward = Math.cos(angle) * 1.25;
      x = root.x + Math.cos(root.yaw) * side + Math.sin(root.yaw) * forward;
      z = root.z - Math.sin(root.yaw) * side + Math.cos(root.yaw) * forward;
      y = held.y * smooth(p / .55);
      yaw = floor.yaw + (root.yaw - Math.PI / 2 - floor.yaw) * p;
    }
  }
  return { x, y, z, yaw, grip: { x, y: y + bag.grip, z } };
}
export function mobilLuggageText(state: MobilEncounter, step: number): string {
  if (state.phase === 'waiting' || state.phase === 'approaching') return 'Sati 听见隧道里的列车声。等车停稳、车门打开，再靠近长椅旁的箱子。';
  if (state.phase === 'stopped' && state.elapsed < .65) return '列车已经停下，车门正在打开。稍候再提起行李。';
  if (state.luggage?.phase === 'lifting') return 'Neo 正提起箱子。鼠标环顾；暂停和读档保留手中行李的进度。';
  if (state.phase === 'refusing') return state.luggage && ['dropped', 'retrieving', 'returned'].includes(state.luggage.phase)
    ? 'Neo 被击退，箱子落在站台上。Rama 取回行李，带着家人登车。' : 'Trainman 拦住了 Neo。他不允许你离开这座车站。';
  if (step === 0) return '列车已经停稳。走近长椅旁的箱子，G 提起；随后亲自跟家人走向车门。';
  if (step === 1) return '箱子握在 Neo 手中。WASD 提着行李走向车门，时间不会替你走完这段路。';
  return 'Trainman 守在车门旁。G 尝试登车，或走向门槛。';
}

export const MOBIL_REFUSAL = { punch: .55, wall: 1.4, fallen: 2.3, rise: 2.85, standing: 4.4, seconds: 4.8 } as const;

/** The forbidden-platform strike uses the saved clock, including its wall and floor contacts. */
export function mobilRefusalPose(elapsed: number, approach = { x: 6, z: -20, yaw: Math.PI / 2 }) {
  const time = Math.max(0, elapsed), flight = smooth((time - MOBIL_REFUSAL.punch) / (MOBIL_REFUSAL.wall - MOBIL_REFUSAL.punch));
  const fall = smooth((time - MOBIL_REFUSAL.wall) / (MOBIL_REFUSAL.fallen - MOBIL_REFUSAL.wall));
  const rise = smooth((time - MOBIL_REFUSAL.rise) / (MOBIL_REFUSAL.standing - MOBIL_REFUSAL.rise));
  const down = smooth((time - 1.55) / .75) * (1 - rise);
  const punch = smooth((time - .15) / .4) * (1 - smooth((time - .55) / .35));
  return { x: approach.x + (-14 - approach.x) * flight + rise * 1.1,
    y: 4.4 * flight * (1 - flight) + .7 * flight * (1 - fall), z: approach.z + .2 * flight,
    yaw: Math.PI / 2, flight, fall, rise, down, punch,
    tilt: -.92 * Math.sin(Math.PI * flight) * (1 - fall) - .32 * flight * (1 - fall) - Math.PI / 2 * down };
}

export function mobilTrainPose(encounter?: Pick<MobilEncounter, 'phase' | 'elapsed' | 'closeElapsed'>) {
  const train = MOBIL_STATION.train, phase = encounter?.phase ?? 'waiting', elapsed = encounter?.elapsed ?? 0;
  const z = phase === 'approaching' ? train.entry + (train.stop - train.entry) * smooth(elapsed / 4.5)
    : phase === 'departing' ? train.stop + (train.entry - train.stop) * smooth(elapsed / 3)
      : phase === 'stopped' || phase === 'refusing' ? train.stop : train.entry;
  const doors = phase === 'stopped' ? smooth(elapsed / .65)
    : phase === 'refusing' ? 1 - smooth((encounter?.closeElapsed ?? elapsed - 1.55) / .65) : 0;
  return { x: train.x, y: train.floor, z, doors, visible: phase !== 'waiting' && phase !== 'gone' };
}

export const MOBIL_REUNION = { exit: 1.25, speed: 4.6, gap: 2.2, seconds: 6.2 } as const;
export interface MobilReunionRoot { x: number; z: number; yaw: number; }
export interface MobilReunion {
  phase: 'exiting' | 'approaching' | 'ready' | 'embracing' | 'together';
  elapsed: number; trinity: MobilReunionRoot; neo?: MobilReunionRoot;
}
export interface MobilReunionGesture {
  role: 'neo' | 'trinity'; reunion: MobilReunion;
}
/** The two saved roots close the gap while keeping both feet on the platform. */
export function mobilReunionRoot(state: MobilReunion, role: 'neo' | 'trinity'): MobilReunionRoot {
  const start = role === 'neo' ? state.neo! : state.trinity;
  if (!state.neo || !['embracing', 'together'].includes(state.phase)) return { ...start };
  const dx = state.trinity.x - state.neo.x, dz = state.trinity.z - state.neo.z, gap = Math.hypot(dx, dz);
  const sign = role === 'neo' ? 1 : -1, close = Math.max(0, gap - 1.02) / 2 * smooth(state.elapsed / .85);
  return { x: start.x + dx / gap * close * sign, z: start.z + dz / gap * close * sign,
    yaw: Math.atan2(dx * sign, dz * sign) };
}
export function mobilReunionPose(state: MobilReunion) {
  const t = state.phase === 'together' ? MOBIL_REUNION.seconds : state.phase === 'embracing' ? state.elapsed : 0;
  return { embrace: smooth(t / .9) * (1 - smooth((t - 5.2) / 1)),
    kiss: smooth((t - 2.6) / .65) * (1 - smooth((t - 4.1) / .65)) };
}
export function mobilReunionText(encounter: MobilEncounter, step: number): string {
  const reunion = encounter.reunion;
  if (encounter.phase !== 'stopped') return '隧道里传来列车声。等列车停稳，Trinity 会从打开的车门下车。';
  if (!reunion || reunion.phase === 'exiting') return '车门正在打开。给 Trinity 留出下车的位置；她看见了你。';
  if (reunion.phase === 'approaching' || step === 0) return 'Trinity 正跑向你。走到站台中央与她会合，别留在铁轨上。';
  if (reunion.phase === 'ready') return '她终于回到你身边。靠近 Trinity，G 接住她的拥抱。';
  if (reunion.phase === 'embracing') {
    if (reunion.elapsed < 2.6) return 'Neo：告诉我，这不是梦。';
    if (reunion.elapsed < 4.8) return 'Trinity：这样，还像是在做梦吗？';
    return 'Trinity：你已经回来了。';
  }
  return '两人终于重逢。G 与 Trinity 离开 Mobil Ave，回到矩阵。';
}

export const MOBIL_FAMILY = [
  { id: 'rama_kandra', x: -11.8, z: -5.5, offset: -1 },
  { id: 'kamala', x: MOBIL_STATION.bench.x + .9, z: -8, offset: 0 },
  { id: 'sati', x: -10.9, z: -6.5, offset: 1 },
] as const;

// Original Chinese game dialogue follows the released film's four questions.
// The parents secure passage for Sati only; they cannot stay with her.
export const MOBIL_FAMILY_QUESTIONS = [
  { id: 'identity', label: '我在餐厅见过你。你们是什么程序？', beats: [
    { speaker: 'neo', seconds: 3, text: '我记得你在 Merovingian 的餐厅。你们也是程序？' },
    { speaker: 'rama_kandra', seconds: 5.5, text: '我是 Rama-Kandra，管理发电厂的回收系统。Kamala 编写交互软件，这是我们的女儿 Sati。' },
    { speaker: 'kamala', seconds: 4, text: '你不属于这里。这座车站连接人类的矩阵与机器世界，并不是普通城市里的地铁。' },
  ] },
  { id: 'purpose', label: '为什么必须把 Sati 送走？', beats: [
    { speaker: 'neo', seconds: 3, text: '你们来这里，是为了把她带进矩阵？' },
    { speaker: 'rama_kandra', seconds: 6, text: 'Sati 没有系统指定的功能。在我们的世界，这样的程序会被删除。我们与 Merovingian 交换了她离开的机会。' },
    { speaker: 'kamala', seconds: 4, text: '她是我们的孩子。我们希望她有机会生活，而不是等候系统决定她没有价值。' },
  ] },
  { id: 'connection', label: '程序也会爱？这意味着什么？', beats: [
    { speaker: 'neo', seconds: 3, text: '我以前没有想过，程序会像父母一样牵挂一个孩子。' },
    { speaker: 'rama_kandra', seconds: 5.5, text: '名字并不决定一段关系是否真实。我们珍惜她；你也有愿意守护的人。我们愿付出的代价，让这种联系变得具体。' },
    { speaker: 'neo', seconds: 3.5, text: '我也在寻找回到她身边的路。我明白你为什么要保护 Sati。' },
  ] },
  { id: 'parting', label: '到了矩阵，你们能和她一起生活吗？', beats: [
    { speaker: 'neo', seconds: 3, text: '如果她能离开，你们会留下陪她吗？' },
    { speaker: 'rama_kandra', seconds: 5.5, text: '协议只允许她留下。先知答应照看 Sati，我们必须回机器世界继续自己的职责。' },
    { speaker: 'rama_kandra', seconds: 4.5, text: '我把这种责任称为 karma。它没有取消我的选择；照顾家人，是我愿意承担这段生活的原因。' },
  ] },
] as const;
export type MobilFamilyTopic = typeof MOBIL_FAMILY_QUESTIONS[number]['id'];
export type MobilFamilyRole = 'neo' | typeof MOBIL_FAMILY[number]['id'];
export interface MobilFamilyConversation {
  phase: 'questions' | 'hearing' | 'reflection' | 'done';
  answered: MobilFamilyTopic[]; selected?: MobilFamilyTopic; elapsed: number;
  paused?: string; unavailable?: string;
}
export interface MobilFamilyGesture {
  role: MobilFamilyRole; phase: MobilFamilyConversation['phase']; elapsed: number;
  speaker?: MobilFamilyRole; look: { x: number; y: number; z: number };
}
export function mobilFamilyLine(state?: MobilFamilyConversation) {
  if (state?.phase !== 'hearing') return;
  const question = MOBIL_FAMILY_QUESTIONS.find(item => item.id === state.selected)!;
  let end = 0;
  for (const beat of question.beats) { end += beat.seconds; if (state.elapsed < end) return { ...beat, elapsed: state.elapsed - end + beat.seconds }; }
}
export function mobilFamilyDuration(state: MobilFamilyConversation): number {
  return MOBIL_FAMILY_QUESTIONS.find(item => item.id === state.selected)!.beats.reduce((sum, beat) => sum + beat.seconds, 0);
}
export function mobilFamilyText(state?: MobilFamilyConversation): string {
  if (state?.unavailable) return `${state.unavailable} 无法参与这段谈话，已听过的问题和回答进度保留。`;
  if (state?.paused) return `${state.paused} 正由另一位玩家控制，谈话暂停在当前回答。`;
  const line = mobilFamilyLine(state);
  if (line) {
    const speaker = line.speaker === 'neo' ? 'Neo' : line.speaker === 'rama_kandra' ? 'Rama-Kandra' : line.speaker === 'kamala' ? 'Kamala' : 'Sati';
    return `${speaker}：${line.text}`;
  }
  if (state?.phase === 'reflection') return '他们必须与 Sati 告别。J 记录你如何理解用途、爱与共同生活；选择不会替父母改写这次离别。';
  if (state?.phase === 'done') return '关于身份、用途、爱与告别的交流已记下。G 继续，陪这一家等候列车。';
  return '走近长椅，G 继续询问，或按 J 选择你想了解的问题。等候不会替你完成交流。';
}

/** All three people cross the same doorway, then separate inside the car. */
export function mobilPassengerPose(index: number, boarding: number, trainZ: number = MOBIL_STATION.train.stop) {
  const start = MOBIL_FAMILY[index], p = clamp((boarding - index * .14) / (1 - index * .14));
  const seated = index === 1 ? 1 - smooth(p / .18) : 0, route = index === 1 ? clamp((p - .18) / .82) : p;
  const approach = clamp(route / .6), crossing = clamp((route - .6) / .24), inside = clamp((route - .84) / .16);
  const stand = index === 1 ? .75 * (1 - seated) : 0;
  const x = start.x + stand + (6.45 - start.x - (index === 1 ? .75 : 0)) * approach + crossing * 4.4;
  const z = start.z + (MOBIL_STATION.train.stop - start.z) * approach + inside * start.offset * 2
    + (trainZ - MOBIL_STATION.train.stop) * inside;
  return { x, y: MOBIL_STATION.train.floor, z, yaw: route > 0 && route < .6 ? Math.atan2(6.45 - start.x, MOBIL_STATION.train.stop - start.z) : Math.PI / 2,
    seated, moving: route > 0 && route < 1 };
}

export function mobilTrainObstacles(encounter?: MobilEncounter) {
  const pose = mobilTrainPose(encounter), train = MOBIL_STATION.train;
  if (!pose.visible) return [];
  return [
    { id: 'right', x: pose.x + 3.25, z: pose.z, width: .18, depth: train.length, height: 6.3 },
    ...[-1, 1].map(side => ({ id: `left:${side}`, x: pose.x - 3.25, z: pose.z + side * 8.1, width: .18, depth: 11.8, height: 6.3 })),
    ...[-1, 1].map(side => ({ id: `end:${side}`, x: pose.x, z: pose.z + side * 13.9, width: train.width, depth: .22, height: 6.3 })),
    ...[-1, 1].map(side => ({ id: `door:${side}`, x: pose.x + train.doorX,
      z: pose.z + side * (train.doorHalf + train.doorSlide * pose.doors), width: .18, depth: train.doorWidth, height: train.doorHeight })),
  ];
}
