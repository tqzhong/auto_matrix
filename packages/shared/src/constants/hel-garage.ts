import type { FilmJourney } from './film-story.js';

// The entrance exchange and three simultaneous fights follow the released
// scene. Dodge/counter windows and a manual door are game adaptations.
export const HEL_GARAGE = {
  set: 'film_hel_garage', cast: ['trinity', 'morpheus', 'seraph'] as const,
  question: { x: 4.7, z: -12.4 }, door: { x: 0, z: -30, width: 7.2, height: 6.3, thickness: .25 },
  handle: { x: 2.7, y: 3, z: -29.75 }, exit: { x: 0, z: -33.6 },
  talking: 6.4, drawing: .8, evadeWindow: 2.2, counterWindow: 2.6,
  disarming: 1.3, strike: .85, falling: 1.5, doorSeconds: 1.7,
  pairs: [
    { role: 'seraph', x: 0, z: -18.8 },
    { role: 'morpheus', x: -5.3, z: -18.8 },
    { role: 'trinity', x: 5.3, z: -18.8 },
  ] as const,
  cars: [-18, 18].flatMap(x => [-17, 9, 24].map(z => ({ x, z, width: 8.5, depth: 13, height: 5 }))),
  columns: [-10.8, 10.8].flatMap(x => [-26, -8, 10, 28].map(z => ({ x, z, width: 1.2, depth: 1.2, height: 8.7 }))),
  walls: [
    ...[-1, 1].map(side => ({ x: side * 15.55, z: -30, width: 23.9, depth: .5, height: 8.7 })),
    ...[-1, 1].map(side => ({ x: side * 4.5, z: -34.1, width: .5, depth: 8.2, height: 8.7 })),
    { x: 0, z: -38.3, width: 9, depth: .5, height: 8.7 },
  ],
} as const;

export interface HelGarageEncounter {
  phase: 'ready' | 'talking' | 'drawing' | 'evade' | 'counter' | 'disarming' | 'combo' | 'striking' | 'falling' | 'cleared' | 'opening' | 'exit' | 'done' | 'failed';
  elapsed: number; age: number; hits: number; attempts: number; door: number;
  approach?: { x: number; z: number; yaw: number };
  paused?: string; unavailable?: string;
}
export interface HelGarageGesture {
  phase: HelGarageEncounter['phase']; elapsed: number; age: number; hits: number;
  role: 'trinity' | 'morpheus' | 'seraph' | 'guard'; pair: number; door: number;
  paused?: string; unavailable?: string;
}
export function newHelGarage(attempts = 0): HelGarageEncounter {
  return { phase: 'ready', elapsed: 0, age: 0, hits: 0, attempts, door: 0 };
}
export function helGarageActive(journey?: FilmJourney): boolean { return journey?.scene === 'm3_hel_garage' && !journey.visiting; }
export function helGarageLocked(state?: Pick<HelGarageEncounter, 'phase' | 'paused' | 'unavailable'>): boolean {
  return Boolean(state && (state.paused || state.unavailable || !['ready', 'cleared', 'exit', 'done'].includes(state.phase)));
}
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };
export function helGarageFall(state?: Pick<HelGarageEncounter, 'phase' | 'elapsed'>): number {
  return !state ? 0 : state.phase === 'falling' ? smooth(state.elapsed / HEL_GARAGE.falling)
    : ['cleared', 'opening', 'exit', 'done'].includes(state.phase) ? 1 : 0;
}
export function helGarageHandle(door: number) {
  const angle = door * Math.PI / 2, along = HEL_GARAGE.handle.x + HEL_GARAGE.door.width / 2;
  return { x: -HEL_GARAGE.door.width / 2 + Math.cos(angle) * along + Math.sin(angle) * .25, y: HEL_GARAGE.handle.y,
    z: HEL_GARAGE.door.z - Math.sin(angle) * along + Math.cos(angle) * .25 };
}
export function helGarageRoot(state: HelGarageEncounter, role: HelGarageGesture['role'], pair: number) {
  const spot = HEL_GARAGE.pairs[pair], attack = state.phase === 'striking' ? Math.sin(Math.PI * clamp(state.elapsed / HEL_GARAGE.strike)) : 0;
  if (role === 'guard') return { x: spot.x, y: 0, z: spot.z - .32 * attack, yaw: 0 };
  if (['cleared', 'exit', 'done'].includes(state.phase)) return;
  if (state.phase === 'ready') return role === 'trinity' ? undefined : { x: role === 'seraph' ? 0 : -4, y: 0, z: -12.4, yaw: Math.PI };
  if (state.phase === 'opening') {
    if (role !== 'trinity') return { x: role === 'seraph' ? -2 : -4, y: 0, z: -26.4, yaw: Math.PI };
    const door = Math.min(.23, state.door), angle = door * Math.PI / 2, hand = helGarageHandle(door);
    return { x: Math.min(HEL_GARAGE.door.width / 2 - 1.25, hand.x + Math.sin(angle) * .95), y: 0,
      z: hand.z + Math.cos(angle) * .95, yaw: Math.PI + angle };
  }
  let x: number = spot.x, z = spot.z + 2.45;
  if (state.phase === 'talking') {
    const t = smooth(state.elapsed / 2.2);
    const start = role === 'trinity' ? state.approach ?? HEL_GARAGE.question : { x: role === 'seraph' ? 0 : -4, z: -12.4 };
    x = start.x + (x - start.x) * t; z = start.z + (z - start.z) * t;
  }
  const closing = state.phase === 'counter' ? smooth(state.elapsed / .28) : ['disarming', 'combo', 'striking', 'falling'].includes(state.phase) ? 1 : 0;
  return { x: x + closing * .38, y: 0, z: z - closing * .45 - attack * .75, yaw: Math.PI };
}
export function helGarageGun(state?: HelGarageEncounter) {
  const dropped = state && (state.phase === 'disarming' && state.elapsed >= .45 || ['combo', 'striking', 'falling', 'cleared', 'opening', 'exit', 'done'].includes(state.phase));
  const age = !state ? 0 : state.phase === 'disarming' ? Math.max(0, state.elapsed - .45) : 1.2;
  return { dropped: Boolean(dropped), progress: dropped ? Math.min(1, age / .8) : 0, y: Math.max(.16, 3.05 + age * .7 - 9.8 * age * age / 2) };
}
export function helGarageTarget(state?: HelGarageEncounter) {
  if (!state || !['cleared', 'opening', 'exit', 'done'].includes(state.phase)) return HEL_GARAGE.question;
  return state.phase === 'exit' || state.phase === 'done' ? HEL_GARAGE.exit : { x: 2.7, z: -28.55 };
}
export function helGarageText(state?: HelGarageEncounter): string {
  if (state?.paused) return `${state.paused} 正由另一位玩家控制。守卫、动作窗口与门停在保存的进度。`;
  if (state?.unavailable) return `${state.unavailable} 无法参与行动，伤亡与当前进度保留。`;
  switch (state?.phase) {
    case 'talking': return state.elapsed < 2.3 ? '守卫认出了 Seraph 曾经的身份，挡住入口。' : state.elapsed < 4.5 ? 'Seraph 要求见 Merovingian。守卫拒绝放行，右手移向枪套。' : 'Seraph 示意准备突破。观察守卫右手；等枪口抬起后按 X。';
    case 'drawing': return '守卫正在拔枪。等枪口抬起再按 X，不能抢先出拳。';
    case 'evade': return '现在按 X 侧身避开枪口！Morpheus 与 Seraph 同时接近另外两名守卫。';
    case 'counter': return '枪口已偏离。立即按 F 扣住持枪手腕，把武器打落。';
    case 'disarming': return 'Trinity 控制持枪手腕；三把枪落向地面。保持近身，不给守卫重新瞄准的机会。';
    case 'combo': return `按 F 接上第 ${state.hits + 1} 次近身反击。同行者各自挡住一名守卫。`;
    case 'striking': return '拳击命中后守卫失去平衡。等动作结束，再按 F 接上下一击。';
    case 'falling': return '三名守卫倒地。等同行者收手后，走到红色拱门右侧的门把。';
    case 'cleared': return '入口已清出。走近门把按 G 开门，再亲自跨过门槛进入铁笼电梯。';
    case 'opening': return 'Trinity 推开钢门。门板与入口碰撞同步打开，等门让出通道。';
    case 'exit': return 'WASD 跨过红色拱门，进入门后的铁笼电梯。';
    case 'done': return '三人进入电梯。准备下行到 Club Hel 的衣帽间。';
    case 'failed': return '守卫重新控制了枪口。J 打开手记重试当前入口；此前经历与伤势保留。';
    default: return '沿停车通道走到 Seraph 身后，按 G 回应守卫。Morpheus 留在左侧。';
  }
}
