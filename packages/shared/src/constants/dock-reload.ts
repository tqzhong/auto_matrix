import type { FilmJourney } from './film-story.js';

export const DOCK_RELOAD = {
  entry: { x: -.95, z: 16.25 }, height: 1.8,
  body: { x: 0, z: 12.4, width: 5.2, depth: 5, height: 7 },
  box: { x: -.95, y: 4.1, z: 14.7, width: 1.6, height: 1.35, depth: 1.25 },
  seatedZ: 13.92, hoistSeconds: 3, climbSeconds: 3.2, kickSeconds: 1.15, contact: .42,
  braceSeconds: .65, limit: 28,
} as const;

export interface DockReload {
  phase: 'approach' | 'hoisting' | 'climbing' | 'jammed' | 'kicking' | 'descending' | 'failed' | 'done';
  lift: number; climb: number; brace: number; elapsed: number; remaining: number; misses: number; attempts: number;
}
export type DockReloadGesture = DockReload & { role: 'kid' };
export const newDockReload = (attempts = 0): DockReload => ({ phase: 'approach', lift: 0, climb: 0, brace: 0,
  elapsed: 0, remaining: DOCK_RELOAD.limit, misses: 0, attempts });
export function dockReloadActive(journey?: FilmJourney): boolean {
  return Boolean(journey && !journey.visiting && journey.scene === 'm3_dock_battle' && journey.step === 1
    && journey.dockGunnery?.phase === 'cleared' && !journey.completed.includes(journey.scene));
}
export function dockReloadLocked(encounter?: DockReload): boolean {
  return Boolean(encounter && !['approach', 'done'].includes(encounter.phase));
}
const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
export function dockReloadHeight(climb: number): number {
  return .9 * (smooth((climb - .25) / .25) + smooth((climb - .75) / .25));
}

// All loader travel and contacts use this saved state, including paused/cold views.
export function dockReloadBox(encounter?: DockReload) {
  const seated = encounter && ['kicking', 'descending', 'done'].includes(encounter.phase)
    ? encounter.phase === 'kicking' ? smooth((encounter.elapsed - DOCK_RELOAD.contact) / .28) : 1 : 0;
  const lift = smooth((encounter?.lift ?? 0) / .55), across = smooth(((encounter?.lift ?? 0) - .55) / .45);
  return { x: -5 + (DOCK_RELOAD.box.x + 5) * across, y: 1.95 + (DOCK_RELOAD.box.y - 1.95) * lift,
    z: 10.7 + (DOCK_RELOAD.box.z - 10.7) * lift + (DOCK_RELOAD.seatedZ - DOCK_RELOAD.box.z) * seated, seated };
}
export function dockReloadText(encounter?: DockReload): string {
  if (!encounter) return '弹药车已抵达。按 G 接管 Kid，完成 APU 后部装填。';
  switch (encounter.phase) {
    case 'approach': return '沿机甲左侧走到后方装填架，按 G 握住升降手柄。';
    case 'hoisting': return '按住 G 升起弹箱，松开停住。弹箱必须送入后背导轨。';
    case 'climbing': return '弹箱卡住了。按住 W 沿后架爬上去，松开抓稳；S 可以退回。';
    case 'jammed': return `按住 G 抓紧横杆蓄力，再按 F 把弹箱踢入导轨。支撑 ${Math.round(encounter.brace / DOCK_RELOAD.braceSeconds * 100)}%。`;
    case 'kicking': return '抓稳横杆，右脚正在把卡住的弹箱顶入装填口。';
    case 'descending': return '弹箱已锁紧。按住 S 爬回地面，再继续守门任务。';
    case 'failed': return '装填未能及时完成。按 J 从装填检查点重试，已完成的炮位掩护保留。';
    case 'done': return '弹箱已经入位，Kid 回到地面。按 G 继续船坞战。';
  }
}

export function stepDockReload(encounter: DockReload, input: { focus: boolean; climb: number }, seconds: number): void {
  const dt = Math.max(0, Math.min(.1, seconds));
  if (!dockReloadLocked(encounter) || encounter.phase === 'failed') return;
  if (!['kicking', 'descending'].includes(encounter.phase)) {
    encounter.remaining = Math.max(0, encounter.remaining - dt);
    if (!encounter.remaining) { encounter.phase = 'failed'; return; }
  }
  if (encounter.phase === 'hoisting' && input.focus) {
    encounter.lift = Math.min(1, encounter.lift + dt / DOCK_RELOAD.hoistSeconds);
    if (encounter.lift >= 1) encounter.phase = 'climbing';
  } else if (encounter.phase === 'climbing') {
    encounter.climb = Math.max(0, Math.min(1, encounter.climb + input.climb * dt / DOCK_RELOAD.climbSeconds));
    if (encounter.climb >= 1) encounter.phase = 'jammed';
  } else if (encounter.phase === 'jammed') {
    encounter.brace = Math.max(0, Math.min(DOCK_RELOAD.braceSeconds, encounter.brace + (input.focus ? dt : -2 * dt)));
  } else if (encounter.phase === 'kicking') {
    encounter.elapsed = Math.min(DOCK_RELOAD.kickSeconds, encounter.elapsed + dt);
    if (encounter.elapsed >= DOCK_RELOAD.kickSeconds) encounter.phase = 'descending';
  } else if (encounter.phase === 'descending' && input.climb < 0) {
    encounter.climb = Math.max(0, encounter.climb + input.climb * dt / DOCK_RELOAD.climbSeconds);
    if (!encounter.climb) encounter.phase = 'done';
  }
}

export function kickDockReload(encounter: DockReload): void {
  if (encounter.phase !== 'jammed') return;
  if (encounter.brace < DOCK_RELOAD.braceSeconds - .01) {
    encounter.misses++; encounter.brace = 0;
    if (encounter.misses >= 3) encounter.phase = 'failed';
  } else { encounter.phase = 'kicking'; encounter.elapsed = 0; }
}
