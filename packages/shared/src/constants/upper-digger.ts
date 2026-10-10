import type { FilmJourney } from './film-story.js';

export const UPPER_DIGGER = {
  ladder: { x: -43, z: 28 }, height: 44, crawlStart: -41, crawlLength: 26,
  rungs: { x: -44, first: .4, spacing: .55, count: 85, radius: .065 }, climbSpeed: 1.65,
  edge: -11.2, pipes: [23.4, 32.6], machine: { x: 70, z: 39 },
  mount: 3.2, brace: 2.4, shot: 2.8, attack: 3.2, escapeLimit: 18,
} as const;
export interface UpperDigger {
  phase: 'approach' | 'climbing' | 'mounting' | 'crawl' | 'ready' | 'bracing' | 'shot' | 'retreat' | 'attack' | 'escape' | 'hatch' | 'dismounting' | 'descending' | 'done' | 'failed';
  climb: number; crawl: number; retreat: number; grip: number; slip: number;
  elapsed: number; total: number; remaining: number; attempts: number; charraDead: boolean;
}
export type UpperDiggerGesture = UpperDigger & { role: 'zee' | 'charra'; contacts?: { x: number; y: number; z: number }[] };
export const newUpperDigger = (): UpperDigger => ({ phase: 'approach', climb: 0, crawl: 0, retreat: 0, grip: 0,
  slip: 0, elapsed: 0, total: 0, remaining: UPPER_DIGGER.escapeLimit, attempts: 0, charraDead: false });
export function upperDiggerActive(journey?: FilmJourney): boolean {
  return Boolean(journey && !journey.visiting && journey.scene === 'm3_upper_digger' && !journey.completed.includes(journey.scene));
}
export function upperDiggerLocked(state?: UpperDigger): boolean { return Boolean(state && !['approach', 'done'].includes(state.phase)); }
export function upperDiggerHatch(state: UpperDigger, role: 'zee' | 'charra'): number | undefined {
  if (role === 'charra') return !state.charraDead && state.phase === 'climbing' && state.climb > UPPER_DIGGER.height - 7
    ? Math.min(1, (state.climb - UPPER_DIGGER.height + 7) / 3.8) : undefined;
  if (state.phase === 'mounting') return Math.min(1, state.elapsed / UPPER_DIGGER.mount);
  if (state.phase === 'dismounting') return 1 - Math.min(1, state.elapsed / UPPER_DIGGER.mount);
}
function smooth(value: number, start: number, end: number): number {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start))); return t * t * (3 - 2 * t);
}
export function upperDiggerFall(state: UpperDigger): number {
  return state.charraDead ? state.phase === 'attack' ? smooth(state.elapsed, 1.2, 2.6) : 1 : 0;
}
export function upperDiggerRoot(state: UpperDigger, role: 'zee' | 'charra') {
  const charra = role === 'charra', ladder = ['approach', 'climbing', 'descending', 'done'].includes(state.phase);
  if (charra && state.charraDead) return { x: UPPER_DIGGER.crawlStart + UPPER_DIGGER.crawlLength - 7 + 2.3, y: UPPER_DIGGER.height, z: 28, yaw: -Math.PI / 2 };
  if (state.phase === 'mounting' || state.phase === 'dismounting') {
    const t = upperDiggerHatch(state, 'zee')!;
    return { x: charra ? -36.8 : -43 + smooth(t, .2, 1) * 2, y: UPPER_DIGGER.height, z: 28,
      yaw: charra ? Math.PI / 2 : -Math.PI / 2 + (state.phase === 'mounting' ? smooth(t, 0, .4) * Math.PI : 0) };
  }
  if (charra && state.phase === 'climbing' && state.climb > UPPER_DIGGER.height - 7) {
    const t = upperDiggerHatch(state, role)!;
    return { x: -43 + smooth(t, .2, 1) * 2 + 4.2 * smooth(state.climb, 40.8, 44), y: UPPER_DIGGER.height, z: 28,
      yaw: -Math.PI / 2 + smooth(t, 0, .4) * Math.PI };
  }
  if (ladder) return { x: UPPER_DIGGER.ladder.x, y: charra ? Math.min(UPPER_DIGGER.height, state.climb + 7) : state.climb, z: 28, yaw: -Math.PI / 2 };
  const returning = state.retreat > 0 || ['retreat', 'attack', 'escape', 'hatch'].includes(state.phase);
  const turn = state.phase === 'retreat' ? Math.min(1, state.elapsed / .65) : returning ? 1 : 0;
  const clearance = charra ? 0 : 1.9 * Math.min(1, state.retreat / 2) * Math.min(1, (UPPER_DIGGER.crawlLength - state.retreat) / 3);
  const lead = charra && state.phase === 'crawl' ? 1.9 * (1 - smooth(state.crawl, 22, UPPER_DIGGER.crawlLength)) : 0;
  return { x: UPPER_DIGGER.crawlStart + state.crawl - state.retreat + (charra ? 2.3 + lead : -clearance), y: UPPER_DIGGER.height, z: 28,
    yaw: Math.PI / 2 + Math.PI * turn };
}
export function upperDiggerShot() {
  const from = { x: -12.7 + 1.1 + Math.cos(.12) * 1.56, y: UPPER_DIGGER.height + 1.8 - Math.sin(.12) * 1.56, z: 28.52 };
  const target = { x: UPPER_DIGGER.machine.x, y: 37, z: UPPER_DIGGER.machine.z };
  // Two Sentinels intercept the last pair in the released film; the second drill survives.
  const to = { x: from.x + (target.x - from.x) * .6, y: from.y + (target.y - from.y) * .6, z: from.z + (target.z - from.z) * .6 };
  return { from, to, target, flight: .85 };
}
export function stepUpperDigger(state: UpperDigger, seconds: number, input: { climb?: number; crouch?: boolean; focus?: boolean }): void {
  if (['approach', 'ready', 'hatch', 'done', 'failed'].includes(state.phase)) return;
  const dt = Math.max(0, Math.min(.1, seconds)), movement = Math.max(-1, Math.min(1, input.climb ?? 0));
  state.total += dt; state.elapsed += dt;
  const phase = (next: UpperDigger['phase']) => { state.phase = next; state.elapsed = 0; };
  if (state.phase === 'climbing') {
    state.climb = Math.max(0, Math.min(UPPER_DIGGER.height, state.climb + movement * dt * UPPER_DIGGER.climbSpeed));
    if (state.climb === UPPER_DIGGER.height) phase('mounting');
  } else if (state.phase === 'mounting' || state.phase === 'dismounting') {
    if (state.elapsed >= UPPER_DIGGER.mount) phase(state.phase === 'mounting' ? 'crawl' : 'descending');
  } else if (state.phase === 'crawl') {
    if (input.crouch) state.crawl = Math.max(0, Math.min(UPPER_DIGGER.crawlLength, state.crawl + movement * dt * 3));
    if (state.crawl === UPPER_DIGGER.crawlLength) phase('ready');
  } else if (state.phase === 'bracing') {
    state.grip = Math.max(0, Math.min(1, state.grip + dt * (input.focus ? 1 / UPPER_DIGGER.brace : -.65)));
    state.slip = input.focus ? Math.max(0, state.slip - dt) : state.slip + dt;
    if (state.slip >= 3) phase('failed');
    else if (state.grip === 1) phase('shot');
  } else if (state.phase === 'shot' && state.elapsed >= UPPER_DIGGER.shot) phase('retreat');
  else if (state.phase === 'retreat' || state.phase === 'escape') {
    state.remaining = Math.max(0, state.remaining - dt);
    if (input.crouch) state.retreat = Math.max(0, Math.min(UPPER_DIGGER.crawlLength, state.retreat + movement * dt * 3));
    if (!state.remaining) phase('failed');
    else if (!state.charraDead && state.retreat >= 7) { state.retreat = 7; phase('attack'); }
    else if (state.charraDead && state.retreat === UPPER_DIGGER.crawlLength) phase('hatch');
  } else if (state.phase === 'attack') {
    if (state.elapsed >= 1.2) state.charraDead = true;
    if (state.elapsed >= UPPER_DIGGER.attack) phase('escape');
  } else if (state.phase === 'descending') {
    state.climb = Math.max(0, Math.min(UPPER_DIGGER.height, state.climb - movement * dt * UPPER_DIGGER.climbSpeed));
    if (!state.climb) phase('done');
  }
}
export function upperDiggerText(state?: UpperDigger): string {
  switch (state?.phase ?? 'approach') {
    case 'approach': return '另一视角 · Zee。第一台钻机倒下后，另一台仍在钻进。走到侧壁维修梯，按 G 跟随 Charra 上行。';
    case 'climbing': return 'W 向上攀爬 · S 退回 · 松开停在横档。Charra 在前方进入上层管线。';
    case 'mounting': return 'Zee 跨过舱口边缘，进入管线之间的维修通道。';
    case 'dismounting': return 'Zee 转身抓住舱口下的梯子。';
    case 'crawl': return '按住 Z 压低身体，再用 W / S 沿两条大管之间前进 / 后退。Charra 正在寻找俯射角度。';
    case 'ready': return 'Charra 要探出管线边缘。按 G 抓住她的腰带。';
    case 'bracing': return (state?.grip ?? 0) < .42 ? '按住 G，依次伸手抓住腰带。抓稳后，Charra 才会抬枪探出。'
      : `继续按住 G 稳住腰带 · ${Math.round((state?.grip ?? 0) * 100)}%。松手会失去支撑。`;
    case 'shot': return '两枚火箭射向第二台钻机的上部驱动，却被哨兵截住。机器仍在钻进。';
    case 'retreat': return '哨兵发现了射击位置！按住 Z，W 沿管线撤回，S 退向危险一侧。';
    case 'attack': return 'Charra 被追来的触手击中。Zee 回头呼喊她，管线后方仍有退路。';
    case 'escape': return 'Charra 已经遇难。按住 Z 和 W，继续爬回圆形舱口；留在原地会被哨兵追上。';
    case 'hatch': return '已抵达维修舱口。按 G 抓住梯子，撤回下层通道。';
    case 'descending': return 'W 沿维修梯向下撤离 · S 向上 · 松手停留。Charra 的遇难不会因离开而重置。';
    case 'done': return 'Zee 已退回下层，第二台钻机仍在钻进。按 G 接管 Mifune，继续船坞防守。';
    case 'failed': return state?.charraDead ? '哨兵追上了 Zee。按 J 从撤退检查点重试；Charra 的遇难保留。' : '协作或撤退失败。按 J 回到上层射击检查点，第一台钻机的结果保留。';
  }
}
