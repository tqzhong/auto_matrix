import type { FilmJourney } from './film-story.js';

const machines = Array.from({ length: 60 }, (_, index) => ({
  x: (index % 2 ? 1 : -1) * (25 + Math.floor(index / 2) % 3 * 7), z: -48 + Math.floor(index / 6) * 10.5,
})).filter(point => !(point.x === -25 && point.z > -42 && point.z < -5) && !(point.x === 25 && point.z > -10));
export const DOCK_EMP = { seconds: 9, count: machines.length, source: { x: 12, y: 20, z: 14 }, waveSpeed: 92 } as const;
export interface DockEmp { firedAt: number; elapsed?: number }
export const EMP_OPERATOR = {
  entry: { x: -2.8, z: -16 }, seat: { x: 0, y: 1.27, z: -16, width: 1.55, depth: 1.05 },
  crank: { x: 1.06, y: 2.57, z: -16.55, radius: .23 },
  console: { x: 1.55, y: 1.3, z: -17.1, width: .72, height: 2.4, depth: .7 },
  seating: 3.6, reaching: .8, turning: 1.6, rising: 3.2,
} as const;
export interface EmpOperator {
  phase: 'seating' | 'ready' | 'turning' | 'fired' | 'rising' | 'done';
  elapsed: number;
  approach: { x: number; z: number };
}
const ease = (t: number, start: number, end: number) => { const p = Math.max(0, Math.min(1, (t - start) / (end - start))); return p * p * (3 - 2 * p); };
export function empOperatorPose(state: EmpOperator) {
  const t = state.elapsed, seating = state.phase === 'seating', rising = state.phase === 'rising';
  const seat = seating ? ease(t, 2.1, 3.6) : rising ? 1 - ease(t, 0, 1.4) : state.phase === 'done' ? 0 : 1;
  let x = 0, z: number = EMP_OPERATOR.seat.z;
  if (seating) {
    const first = ease(t, 0, .8), second = ease(t, .8, 1.5), back = ease(t, 2.1, 3.6);
    x = (state.approach.x + (EMP_OPERATOR.entry.x - state.approach.x) * first) * (1 - second);
    z = state.approach.z + (-18.6 - state.approach.z) * first + 1.2 * ease(t, 1.5, 2.1) + 1.4 * back;
  } else if (rising || state.phase === 'done') {
    z -= 1.4 * (1 - seat) + 1.2 * (state.phase === 'done' ? 1 : ease(t, 1.4, 2.1));
    x = EMP_OPERATOR.entry.x * (state.phase === 'done' ? 1 : ease(t, 2.1, 3.2));
  }
  const engaged = state.phase === 'turning' ? ease(t, 0, EMP_OPERATOR.reaching) : state.phase === 'fired' ? 1 : 0;
  const turn = state.phase === 'turning' ? ease(t, EMP_OPERATOR.reaching, EMP_OPERATOR.reaching + EMP_OPERATOR.turning) : state.phase === 'fired' || rising || state.phase === 'done' ? 1 : 0;
  return { x, z, seat, engaged, turn, lean: Math.sin(seat * Math.PI) * .3 };
}
export function empCrankPoint(state?: EmpOperator) {
  const angle = (state ? empOperatorPose(state).turn : 0) * Math.PI * 1.5;
  return { x: EMP_OPERATOR.crank.x + Math.cos(angle) * EMP_OPERATOR.crank.radius,
    y: EMP_OPERATOR.crank.y + .13, z: EMP_OPERATOR.crank.z + Math.sin(angle) * EMP_OPERATOR.crank.radius };
}
/** Alternating planted feet follow the same saved approach/exit, with a short swing above the deck. */
export function empOperatorFoot(state: EmpOperator, left: boolean) {
  const pose = empOperatorPose(state), side = left ? -.32 : .32;
  const at = (elapsed: number) => {
    const p = empOperatorPose({ ...state, elapsed }); return { x: p.x + side, z: p.z - 1.4 * p.seat, lift: 0 };
  };
  const times = state.phase === 'seating' && state.elapsed < 2.1 ? [0, .4, .8, 1.15, 1.5, 1.8, 2.1]
    : state.phase === 'rising' && state.elapsed > 1.4 ? [1.4, 1.75, 2.1, 2.65, 3.2] : undefined;
  if (!times) return { x: pose.x + side, z: pose.z - 1.4 * pose.seat, lift: 0 };
  const i = Math.min(times.length - 2, times.findIndex((time, index) => index > 0 && time >= state.elapsed) - 1);
  const swinging = (i % 2 === 1) === left;
  const end = Math.min(times.length - 1, i >= times.length - 3 ? times.length - 1 : i + 1);
  if (!swinging) return at(times[Math.max(0, i >= times.length - 2 ? times.length - 1 : i)]);
  const from = at(times[Math.max(0, i - 1)]), to = at(times[end]);
  const progress = Math.max(0, Math.min(1, (state.elapsed - times[i]) / (times[i + 1] - times[i]))), p = progress * progress * (3 - 2 * progress);
  return { x: from.x + (to.x - from.x) * p, z: from.z + (to.z - from.z) * p, lift: Math.sin(progress * Math.PI) * .2 };
}
export function empOperatorText(state: EmpOperator): string {
  if (state.phase === 'seating') return 'Link 绕到操作椅前，落座并握住 Zee 留给他的挂坠。';
  if (state.phase === 'ready') return 'Morpheus 的指令传来。按住 G 握住右侧起爆器并转动；松手停留。';
  if (state.phase === 'turning') return `按住 G 转动起爆器 · ${Math.round(empOperatorPose(state).turn * 100)}% · 松手停留`;
  if (state.phase === 'fired') return '白色脉冲席卷船坞。鼠标观察，V 切换船坞 / Link 视角。';
  if (state.phase === 'rising') return '船体终于停下。Link 松开起爆器，撑起身体离开操作椅。';
  return '船坞的机器与防御同时失电。走到金色标记，按 J 记录这次救援的代价。';
}
export function dockEmpLocked(journey?: FilmJourney): boolean {
  return Boolean(journey?.scene === 'm3_emp' && !journey.visiting && (journey.empOperator && journey.empOperator.phase !== 'done'
    || journey.emp?.elapsed !== undefined && journey.emp.elapsed < DOCK_EMP.seconds));
}
export function dockEmpFlash(emp?: DockEmp): number {
  return emp?.elapsed === undefined ? 0 : Math.max(0, 1 - emp.elapsed / .7);
}
export function dockEmpShip(elapsed: number) {
  const time = Math.max(0, elapsed), p = Math.min(1, time / 5), slide = 1 - (1 - p) ** 2;
  const bank = Math.min(1, time / 2.2), roll = 1.2 * bank * bank * (3 - 2 * bank);
  return { x: 12 + 8 * slide, y: Math.max(0, 20 - 4.9 * time * time), z: 14 + 24 * slide, roll };
}
/** Fixed lanes keep the dead machines clear of the APU, ship and central walkway. */
export function dockEmpSentinel(index: number, elapsed: number) {
  const { x, z } = machines[index], side = Math.sign(x), height = 19 + (index * 7 % 9) * 3.2;
  const hitAt = Math.hypot(x - DOCK_EMP.source.x, height - DOCK_EMP.source.y, z - DOCK_EMP.source.z) / DOCK_EMP.waveSpeed;
  const fall = Math.max(0, elapsed - hitAt), drop = 4.9 * fall * fall;
  return { x, y: Math.max(0, height - drop), z, hitAt, dead: elapsed >= hitAt,
    roll: Math.min(1, fall * .7) * (side * .72), pitch: Math.min(1, fall * .7) * 1.05,
    yaw: Math.sin(index * 2.39996323) * .12, fall };
}
