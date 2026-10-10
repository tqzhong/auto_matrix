/** Support samples match the Hammer's cylindrical shell, pods and segmented hoverpads. */
const hullSupport: { x: number; y: number }[] = [];
for (let i = 0; i < 64; i++) hullSupport.push({ x: Math.sin(i * Math.PI / 32) * 4.4, y: Math.cos(i * Math.PI / 32) * 4.4 });
for (const side of [-1, 1]) {
  for (const x of [side * 5.7 - 1.5, side * 5.7 + 1.5]) for (const y of [-1.5, 1.5]) hullSupport.push({ x, y });
  for (let ring = 0; ring < 18; ring++) for (let tube = 0; tube < 8; tube++) hullSupport.push({
    x: side * 5.8 + (1.55 + .37 * Math.cos(tube * Math.PI / 4)) * Math.cos(ring * Math.PI / 9),
    y: -.4 - .37 * Math.sin(tube * Math.PI / 4),
  });
}
for (const [x, y, w, h] of [[0, 1.8, 7.2, 2.2], [-3.9, 2.7, .4, 1.1], [3.9, 2.7, .4, 1.1]])
  for (const dx of [-w / 2, w / 2]) for (const dy of [-h / 2, h / 2]) hullSupport.push({ x: x + dx, y: y + dy });
export function dockEmpHullBase(roll: number, floor: number): number {
  return floor + .035 - Math.min(...hullSupport.map(point => point.x * Math.sin(roll) + point.y * Math.cos(roll)));
}

export const DOCK_REUNION = {
  hatch: { x: 20, z: 55, radius: 4.1 },
  steps: 10, tread: .72, exitSeconds: 8,
  departure: { hatchSeconds: 2.2, prelude: 12.2, pairStart: 15.2, pairSeconds: 11, seconds: 26.2 },
  crew: ['morpheus', 'niobe', 'colt', 'roland'],
  rail: { halfWidth: 1.42, height: 1.4 },
  zee: { x: 7, z: 57 }, link: { x: 7, z: 58.18 },
  seconds: { approaching: 2.4, embrace: 5.6, kiss: 3.2, charm: 4.8, parting: 3.2 },
} as const;
export interface DockReunion {
  phase: 'ready' | 'disembarking' | 'exiting' | 'walking' | 'approaching' | 'embrace' | 'kiss' | 'promise' | 'charm' | 'parting' | 'done';
  elapsed: number;
  floor: number;
  /** Same arrival direction as the saved gate crossing; missing keeps the old dock layout. */
  forward?: boolean;
  /** Absent in older reunion saves, whose crew and door have already left. */
  departure?: number;
  approach?: { x: number; z: number; yaw: number };
}
export interface DockReunionGesture extends DockReunion { role: 'link' | 'zee' }
export type DockDepartureRole = typeof DOCK_REUNION.crew[number];
export interface DockDepartureGesture { role: DockDepartureRole; elapsed: number; floor: number; assisted: boolean; forward?: boolean }
const ease = (value: number, start: number, end: number) => { const p = Math.max(0, Math.min(1, (value - start) / (end - start))); return p * p * (3 - 2 * p); };
/** Rotate the authored rear-deck layout around the landed hull, without moving old saves. */
export function dockArrivalPoint(point: { x: number; y: number; z: number }, forward = false) {
  return forward ? { x: 40 - point.x, y: point.y, z: 76 - point.z } : { ...point };
}
export function dockReunionLocked(state?: DockReunion): boolean {
  return Boolean(state && state.phase !== 'walking' && state.phase !== 'done');
}
/** Emergency treads outside the damaged rear opening; the door lands beside them. */
export function dockReunionTread(index: number, floor: number) {
  const i = Math.max(0, Math.min(DOCK_REUNION.steps, index));
  const top = dockEmpHullBase(1.2, floor) - 2;
  return { x: DOCK_REUNION.hatch.x, y: top + (floor - top) * i / DOCK_REUNION.steps,
    z: DOCK_REUNION.hatch.z + .35 + i * DOCK_REUNION.tread };
}
/** A saved release/rotation and gravity fall, with support from the actual circular panel. */
export function dockHatchPose(elapsed: number, floor: number, forward = false) {
  const age = Math.max(0, elapsed - .55), pitch = ease(age, 0, 1.1) * Math.PI / 2;
  const support = DOCK_REUNION.hatch.radius * Math.abs(Math.cos(pitch)) + .16;
  return { ...dockArrivalPoint({ x: 20, y: Math.max(floor + support, dockEmpHullBase(1.2, floor) - 4.9 * age * age),
    z: 55.04 + ease(age, 0, 1.65) * 2.4 }, forward), pitch, roll: 1.2 };
}
function departureFoot(elapsed: number, seconds: number, floor: number, left: boolean, x: number, start: number, forward = false) {
  const inside = Math.ceil((55.35 - start) / DOCK_REUNION.tread), count = inside + DOCK_REUNION.steps;
  const at = (index: number) => index < inside ? { x, y: dockReunionTread(0, floor).y, z: start + (55.35 - start) * index / inside }
    : { ...dockReunionTread(index - inside, floor), x };
  const step = Math.min(count, Math.max(0, elapsed / seconds * count)), i = Math.min(count - 1, Math.floor(step));
  const swing = (i % 2 === 0) === left, from = at(Math.max(0, i - (swing ? 1 : 0))), to = at(i + 1);
  const p = step >= count ? 1 : ease(step - i, 0, 1), moving = swing || i === count - 1;
  return dockArrivalPoint({ x: x + (left ? .29 : -.29), y: from.y + (moving ? (to.y - from.y) * p + Math.sin(p * Math.PI) * .22 : 0),
    z: from.z + (moving ? (to.z - from.z) * p : 0) }, forward);
}
export function dockDepartureFoot(gesture: DockDepartureGesture, left: boolean) {
  const pair = gesture.role === 'colt' || gesture.role === 'roland';
  const start = pair ? DOCK_REUNION.departure.pairStart : gesture.role === 'morpheus' ? 2.2 : 4.2;
  if (!pair && gesture.elapsed > start + 8) {
    const last = dockReunionTread(DOCK_REUNION.steps, gesture.floor), goal = gesture.role === 'morpheus' ? { x: 18, z: 65.4 } : { x: 19.8, z: 67.6 };
    const step = Math.min(4, (gesture.elapsed - start - 8) / .5), i = Math.min(3, Math.floor(step)), swing = (i % 2 === 0) === left;
    const at = (index: number) => ({ x: last.x + (goal.x - last.x) * index / 4, z: last.z + (goal.z - last.z) * index / 4 });
    const from = at(Math.max(0, i - (swing ? 1 : 0))), to = at(i + 1), p = step >= 4 ? 1 : ease(step - i, 0, 1), moving = swing || i === 3;
    return dockArrivalPoint({ x: from.x + (left ? .29 : -.29) + (moving ? (to.x - from.x) * p : 0),
      y: gesture.floor + (moving ? Math.sin(p * Math.PI) * .14 : 0), z: from.z + (moving ? (to.z - from.z) * p : 0) }, gesture.forward);
  }
  return departureFoot(gesture.elapsed - start, pair ? DOCK_REUNION.departure.pairSeconds : 8, gesture.floor, left,
    gesture.role === 'colt' ? 22.15 : gesture.role === 'roland' ? 23.17 : 20, gesture.role === 'niobe' ? 52.45 : 53.95, gesture.forward);
}
export function dockDepartureRoot(gesture: DockDepartureGesture) {
  const left = dockDepartureFoot(gesture, true), right = dockDepartureFoot(gesture, false);
  const yaw = gesture.role === 'morpheus' ? Math.atan2(-2, 2.85) * ease(gesture.elapsed, 10.2, 10.9)
    : gesture.role === 'niobe' ? Math.atan2(-.2, 5.05) * ease(gesture.elapsed, 12.2, 12.9) : 0;
  return { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2, z: (left.z + right.z) / 2, yaw: yaw + (gesture.forward ? Math.PI : 0) };
}
export function dockDepartureFinished(elapsed: number, role: DockDepartureRole): boolean {
  return elapsed + 1e-6 >= (role === 'morpheus' ? 12.2 : role === 'niobe' ? 14.2 : DOCK_REUNION.departure.seconds);
}
export function dockReunionFoot(state: DockReunion, left: boolean): { x: number; y: number; z: number } {
  if (state.departure !== undefined && ['ready', 'disembarking', 'exiting'].includes(state.phase))
    return departureFoot(state.phase === 'exiting' ? state.elapsed : 0, DOCK_REUNION.exitSeconds, state.floor, left, 20, 51.15, state.forward);
  if (state.phase !== 'ready' && state.phase !== 'exiting') {
    const at = (elapsed: number) => {
      const root = dockReunionRoot({ ...state, elapsed }, 'link'), side = left ? .29 : -.29;
      return { x: root.x + Math.cos(root.yaw) * side, y: root.y, z: root.z - Math.sin(root.yaw) * side };
    };
    const step = Math.min(4, state.elapsed / .6), i = Math.min(3, Math.floor(step));
    const swing = (i % 2 === 0) === left;
    const from = state.phase === 'approaching' ? at(Math.max(0, i - (swing ? 1 : 0)) * .6) : at(state.elapsed);
    const to = at((i + 1) * .6), p = step >= 4 ? 1 : ease(step - i, 0, 1);
    return { x: from.x + (swing ? (to.x - from.x) * p : 0), y: from.y + (state.phase === 'approaching' && swing ? Math.sin(p * Math.PI) * .13 : 0),
      z: from.z + (state.phase === 'approaching' && swing ? (to.z - from.z) * p : 0) };
  }
  const time = state.phase === 'ready' ? 0 : state.phase === 'exiting' ? state.elapsed : DOCK_REUNION.exitSeconds;
  const step = Math.min(DOCK_REUNION.steps, time / DOCK_REUNION.exitSeconds * DOCK_REUNION.steps);
  const i = Math.min(DOCK_REUNION.steps - 1, Math.floor(step)), swing = (i % 2 === 0) === left;
  const from = dockReunionTread(Math.max(0, i - (swing ? 1 : 0)), state.floor), to = dockReunionTread(i + 1, state.floor);
  const p = step >= DOCK_REUNION.steps ? 1 : ease(step - i, 0, 1);
  const finish = i === DOCK_REUNION.steps - 1;
  return dockArrivalPoint({ x: from.x + (left ? .29 : -.29), y: swing || finish ? from.y + (to.y - from.y) * p + Math.sin(p * Math.PI) * .24 : from.y,
    z: swing || finish ? from.z + (to.z - from.z) * p : from.z }, state.forward);
}
export function dockReunionRoot(state: DockReunion, role: 'link' | 'zee'): { x: number; y: number; z: number; yaw: number } {
  if (role === 'link' && ['ready', 'disembarking', 'exiting'].includes(state.phase)) {
    const left = dockReunionFoot(state, true), right = dockReunionFoot(state, false);
    return { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2, z: (left.z + right.z) / 2, yaw: state.forward ? Math.PI : 0 };
  }
  const floor = state.forward ? state.floor : 0, yaw = state.forward ? 0 : Math.PI;
  if (role === 'zee') return { ...dockArrivalPoint({ ...DOCK_REUNION.zee, y: floor }, state.forward), yaw: state.forward ? Math.PI : 0 };
  const position = dockArrivalPoint({ ...DOCK_REUNION.link, y: floor }, state.forward), approach = state.approach ?? { ...position, yaw };
  const p = state.phase === 'approaching' ? ease(state.elapsed, 0, DOCK_REUNION.seconds.approaching) : 1;
  const gap = state.phase === 'parting' ? ease(state.elapsed, 0, DOCK_REUNION.seconds.parting) * .7 : state.phase === 'done' ? .7 : 0;
  const angle = Math.atan2(Math.sin(yaw - approach.yaw), Math.cos(yaw - approach.yaw));
  return { x: approach.x + (position.x - approach.x) * p, y: floor, z: approach.z + (position.z - approach.z) * p + gap * (state.forward ? -1 : 1), yaw: approach.yaw + angle * p };
}
export function dockReunionRail(state: DockReunion, left: boolean) {
  const root = dockArrivalPoint(dockReunionRoot(state, 'link'), state.forward);
  const tread = dockReunionTread((root.z - DOCK_REUNION.hatch.z - .35) / DOCK_REUNION.tread, state.floor);
  return dockArrivalPoint({ x: tread.x + (left ? 1 : -1) * DOCK_REUNION.rail.halfWidth, y: tread.y + DOCK_REUNION.rail.height + .045, z: tread.z }, state.forward);
}
export function dockReunionPose(state: DockReunion) {
  const hugged = ['embrace', 'kiss', 'promise', 'charm', 'parting'].includes(state.phase);
  const embrace = state.phase === 'embrace' ? ease(state.elapsed, 0, 1.4)
    : state.phase === 'parting' ? 1 - ease(state.elapsed, 0, 2.2) : hugged ? 1 : 0;
  const kiss = state.phase === 'kiss' ? ease(state.elapsed, 0, 1.15) * (1 - ease(state.elapsed, 2.2, 3.2)) : 0;
  const charm = state.phase === 'charm' ? ease(state.elapsed, 0, 1.2) * (1 - ease(state.elapsed, 3.4, 4.8)) : 0;
  return { embrace, kiss, charm };
}
export function dockReunionText(state: DockReunion): string {
  if (state.phase === 'ready') return state.departure === undefined ? 'G 开始出舱，再按住 G 扶稳舱口、逐级下到船坞；松手停住。'
    : '后舱门已经损坏。G 开始离船：先让门落下、船员出舱，再按住 G 让 Link 下到船坞。';
  if (state.phase === 'disembarking') return `船员出舱 · ${Math.round((state.departure ?? 0) / DOCK_REUNION.departure.prelude * 100)}% · Colt 扶着受伤的 Roland，Link 等待通道让开。`;
  if (state.phase === 'exiting') return `按住 G 扶稳下舱 · ${Math.round(state.elapsed / DOCK_REUNION.exitSeconds * 100)}% · 松手停住`;
  if (state.phase === 'walking') return 'Zee 在失电的船坞呼唤 Link。WASD 走近她，再按 G 回应。';
  if (state.phase === 'approaching') return '两人认出了彼此，走完最后几步。';
  if (state.phase === 'embrace') return 'Zee 紧紧抱住 Link。她一直相信他会回来。';
  if (state.phase === 'kiss') return '他们在毁坏的船坞里吻别了刚才的恐惧。';
  if (state.phase === 'promise') return 'Zee 看见胸前的挂坠。G 告诉她：你一直记着自己的承诺。';
  if (state.phase === 'charm') return 'Link 将挂坠托在掌心，让 Zee 看清它仍在身上。';
  if (state.phase === 'parting') return '失电的防线仍然危险。两人松开拥抱，准备随幸存者撤退。';
  return '重逢与承诺已经保存。G 继续撤退。';
}
