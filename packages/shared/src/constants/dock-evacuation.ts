import type { FilmJourney } from './film-story.js';

// Revolutions: unload the Hammer, withdraw the last lift, then demolish the shaft.
// The carrying task and its deadline are game extensions of those filmed events.
export const DOCK_EVACUATION = {
  entry: { x: -14, z: 30 }, pickup: { x: -14, z: 24.5 }, delivery: { x: -3, z: -12 },
  cargoRest: [{ x: -14, y: 1.525, z: 22.8 }, { x: -3, y: 1.525, z: -13.2 }],
  crate: { width: 1.9, height: 1.05, depth: 1.2, y: 2.4, z: 1.2 },
  lift: { x: 0, z: -30, width: 9, depth: 7, height: 7, drop: 13, seconds: 5.5, closing: 1.6 },
  boarding: { x: 0, z: -28.5 }, cargoSeconds: 1.8, retreatSeconds: 26, crewSeconds: 11,
  crew: 6, cast: ['kid', 'colt'] as const,
  walls: [
    { x: -23.8, z: 0, width: .8, depth: 82, height: 24 },
    { x: 23.8, z: 0, width: .8, depth: 82, height: 24 },
    { x: 0, z: 40.5, width: 48, depth: .8, height: 24 },
    ...[-1, 1].map(side => ({ x: side * 14.5, z: -40.5, width: 19, depth: .8, height: 24 })),
    ...[-1, 1].map(side => ({ x: side * 4.6, z: -30, width: .2, depth: 7, height: 24 })),
    { x: 0, z: -33.6, width: 9.4, depth: .2, height: 24 },
    ...[-1, 1].flatMap(side => [-18, 4, 25].map(z => ({ x: side * 20, z, width: 1.3, depth: 2, height: 24 }))),
    { x: -14, z: 22.5, width: 4.8, depth: 1.6, height: 1 },
    { x: -3, z: -14, width: 4.2, depth: 1.7, height: 1 },
  ],
} as const;
export interface DockEvacuation {
  phase: 'supplies' | 'lifting' | 'carrying' | 'depositing' | 'wind' | 'order' | 'running' | 'waiting' | 'closing' | 'lowering' | 'clear' | 'failed';
  elapsed: number; crewAge: number; remaining: number; attempts: number; delivered: boolean;
  approach?: { x: number; z: number; yaw: number }; paused?: string; unavailable?: string;
}
export type DockEvacuationGesture = DockEvacuation & { role: 'kid' | 'colt' };
export const SHAFT_SEAL = {
  entry: { x: -6, z: 10 }, operator: { x: 3.1, z: .1 },
  lever: { x: 3.1, y: 2.1, z: -1.25, length: .6, grip: 1.2 },
  reach: .9, throwing: 1.8, blast: 7.2, cast: ['citizen_15', 'citizen_16', 'lock'] as const,
  obstacles: [
    ...[-1, 1].map(side => ({ x: side * 17.7, z: 0, width: .6, depth: 38, height: 10 })),
    { x: 0, z: 18.7, width: 36, depth: .6, height: 10 },
    { x: 0, z: -18.7, width: 36, depth: .6, height: 10 },
    { x: 0, z: -6, width: 36, depth: .8, height: 10 },
    { x: 3.1, z: -2.25, width: 1.7, depth: 1.9, height: 2.2 },
    { x: -8, z: -2.5, width: 5, depth: 2.4, height: 2.7 },
  ],
} as const;
export interface ShaftSeal {
  phase: 'ready' | 'reaching' | 'armed' | 'throwing' | 'detonating' | 'done';
  elapsed: number; turn: number; firedAt?: number; paused?: string; unavailable?: string;
}
export type ShaftSealGesture = ShaftSeal & { role: 'citizen_15' | 'citizen_16' | 'lock' };
export function dockEvacuationActive(journey?: FilmJourney): boolean { return journey?.scene === 'm3_dock_evacuation' && !journey.visiting; }
export function shaftSealActive(journey?: FilmJourney): boolean { return journey?.scene === 'm3_shaft_seal' && !journey.visiting; }
export function dockEvacuationLocked(state?: DockEvacuation): boolean {
  return Boolean(state && (state.paused || state.unavailable || ['lifting', 'depositing', 'wind', 'order', 'waiting', 'closing', 'lowering', 'clear', 'failed'].includes(state.phase)));
}
export function shaftSealLocked(state?: ShaftSeal): boolean { return Boolean(state && (state.paused || state.unavailable || state.phase !== 'ready' && state.phase !== 'done')); }
const ease = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
export function dockEvacuationLift(state: DockEvacuation): number {
  return state.phase === 'clear' ? -DOCK_EVACUATION.lift.drop : state.phase === 'lowering' ? -DOCK_EVACUATION.lift.drop * ease(state.elapsed / DOCK_EVACUATION.lift.seconds) : 0;
}
export function dockEvacuationRoot(state: DockEvacuation, role: 'kid' | 'colt') {
  if (role === 'kid') return ['waiting', 'closing', 'lowering', 'clear'].includes(state.phase)
    ? { ...DOCK_EVACUATION.boarding, y: dockEvacuationLift(state), yaw: 0 }
    : { ...(state.approach ?? { ...DOCK_EVACUATION.entry, yaw: Math.PI }), y: 0 };
  const t = ease(state.crewAge / DOCK_EVACUATION.crewSeconds);
  return { x: 6 * (1 - t) - 3.1 * t, y: dockEvacuationLift(state), z: -9 * (1 - t) - 28.8 * t, yaw: t < 1 ? Math.atan2(-9.1, -19.4) : 0 };
}
export function dockEvacuationSoldier(state: DockEvacuation, index: number) {
  const lane = index % 3 - 1, row = Math.floor(index / 3), endZ = -31.8 + row * 1.5;
  const time = Math.max(0, state.crewAge - index * .4), progress = Math.min(1, time / (DOCK_EVACUATION.crewSeconds - index * .4));
  return { x: lane * 2.3, y: dockEvacuationLift(state), z: (12 + row * 5) * (1 - progress) + endZ * progress,
    yaw: progress < 1 ? Math.PI : 0, moving: progress > 0 && progress < 1 };
}
export function dockCargoPose(state: DockEvacuation) {
  const p = state.phase === 'lifting' ? ease(state.elapsed / DOCK_EVACUATION.cargoSeconds)
    : state.phase === 'depositing' ? 1 - ease(state.elapsed / DOCK_EVACUATION.cargoSeconds) : 1;
  const rest = DOCK_EVACUATION.cargoRest[state.phase === 'depositing' ? 1 : 0];
  const approach = state.approach ?? { ...(state.phase === 'depositing' ? DOCK_EVACUATION.delivery : DOCK_EVACUATION.pickup), yaw: Math.PI };
  const dx = rest.x - approach.x, dz = rest.z - approach.z;
  const x = (Math.cos(approach.yaw) * dx - Math.sin(approach.yaw) * dz) * (1 - p);
  const z = DOCK_EVACUATION.crate.z * p + (Math.sin(approach.yaw) * dx + Math.cos(approach.yaw) * dz) * (1 - p);
  return { x, y: rest.y + (DOCK_EVACUATION.crate.y - rest.y) * p, z, bend: 1 - p };
}
export function shaftSealLever(state?: ShaftSeal) {
  const angle = (state?.turn ?? 0) * 1.2;
  return { x: SHAFT_SEAL.lever.x, y: SHAFT_SEAL.lever.y + Math.cos(angle) * SHAFT_SEAL.lever.length,
    z: SHAFT_SEAL.lever.z + Math.sin(angle) * SHAFT_SEAL.lever.length, angle };
}
export function dockEvacuationText(state?: DockEvacuation): string {
  if (!state) return 'Hammer 的补给必须抢运到最后一班撤离升降梯。';
  if (state.paused || state.unavailable) return `${state.paused ?? state.unavailable} 的信号暂不可用，撤离已保留在当前时刻。`;
  return ({ supplies: '走到弹药架前，G 抬起补给箱。', lifting: 'Kid 屈膝握紧两侧把手，再抬起补给箱。', carrying: 'WASD 将补给搬到前方卸货车，走近后 G 放下。负重时不能冲刺或跳跃。',
    depositing: '把补给放到卸货车上，松开两侧把手。', wind: 'Kid 听见管道中的风声。Colt 转身望向破开的闸门。', order: '无线电：Lock 下令所有人后撤，准备封堵升降井。',
    running: `第二波哨兵正在涌入！绕过卸货车右侧，WASD / Shift 跑向最后一班升降梯 · ${Math.ceil(state.remaining)} 秒`,
    waiting: state.crewAge < DOCK_EVACUATION.crewSeconds ? '留在轿厢中，等待最后一批士兵上梯。' : '人员已上梯，G 关闭笼门并下降；还不能封井。',
    closing: '笼门正在关闭。Kid 与 Colt 随最后一批人撤离。', lowering: '升降梯降入井道，上方哨兵淹没了船坞。V 切换视角，鼠标观察。',
    clear: '最后一班升降梯已脱离爆破段。G 接管封井操作员。', failed: '没有赶上最后的撤离窗口。J 从来袭检查点重试；已经搬下的补给、EMP 与牺牲者保留。' } as const)[state.phase];
}
export function shaftSealText(state?: ShaftSeal): string {
  if (!state) return '最后一批人已经撤离，指挥所正在等待封井确认。';
  if (state.paused || state.unavailable) return `${state.paused ?? state.unavailable} 的信号暂不可用，起爆器保留当前位置。`;
  return ({ ready: '收到人员清空确认。走到右侧起爆器，G 握住手柄。', reaching: '操作员伸出双手，握住机械手柄。',
    armed: 'Lock 已授权封井。按住 G 拉下起爆杆；松手停留。', throwing: `按住 G 拉下起爆杆 · ${Math.round(state.turn * 100)}% · 松手停留`,
    detonating: '爆破沿井道依次发生，岩土封住船坞入口。爆破结束前不能离开或重放。', done: '井道已经封堵。机器仍在钻穿屏障，J 记录这段暂时换来的时间。' } as const)[state.phase];
}
