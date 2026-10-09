export type CatchPhase = 'launch' | 'departing' | 'flight' | 'catching' | 'ascent' | 'landing' | 'extract_ready' | 'extracting' | 'pulse' | 'reviving' | 'failed' | 'done';
type CatchRoot = { x: number; y: number; z: number; yaw: number };

export interface CatchEncounter {
  phase: CatchPhase; elapsed: number; attempt: number; x: number; z: number; yaw: number;
  focus: number; beats: number; misses: number; catchY?: number;
  checkpoint?: 'flight' | 'pulse'; layout?: 2;
  launch?: { x: number; z: number }; caught?: { neo: CatchRoot; trinity: CatchRoot; age: number };
  failure?: { neo: CatchRoot; trinity: CatchRoot; agent_thompson: CatchRoot };
  carImpact?: boolean;
}

export type CatchGesture = CatchEncounter & { role: 'neo' | 'trinity' | 'agent_thompson' };

export const CATCH = {
  start: { x: 0, z: 47, y: 16 },
  window: { x: 0, z: 44, width: 5.6, height: 7 },
  flightStart: { x: 0, z: 42, y: 16 },
  trinity: { x: -8.5, z: -24 },
  rooftop: { x: -.55, z: -18.35 },
  patient: { x: -1.7, z: -17.3 },
  roadY: -75,
  impact: 7.7,
  catchFrom: 5.1,
  catchRadius: 2.6,
  speed: 21,
  lateral: 15,
  departure: 1.1,
  catching: .8,
  ascent: 2.8,
  landing: 1.6,
  revival: 3.2,
  extraction: 2.4,
  extractionLift: .95,
  carRoof: { y: 1.65, height: .8 },
  agentImpact: 6.1,
  pulseAt: 1.1,
  pulseWindow: .42,
  pulsePeriod: 1.7,
} as const;

// Renderer and swept flight collision share every building, including the real exit aperture.
export const CATCH_BUILDINGS = [
  { x: 0, z: 2, width: 7, depth: 14, height: 110, name: 'catch-center-tower' },
  { x: 0, z: -12, width: 26, depth: 20, height: 75, name: 'catch-trinity-tower' },
  { x: 0, z: 52, width: 29, depth: 16, height: 115, name: 'catch-architect-exit-tower' },
  ...[[-36, 18, 21, 25, 95], [34, 10, 20, 28, 108], [-36, -37, 25, 22, 88], [36, -42, 27, 20, 98], [-64, 38, 25, 32, 72], [65, -18, 29, 28, 100]]
    .map(([x, z, width, depth, height]) => ({ x, z, width, depth, height, name: 'catch-skyline' })),
];
const ease = (t: number) => { const u = Math.max(0, Math.min(1, t)); return u * u * (3 - 2 * u); };
const blend = (a: CatchRoot, b: CatchRoot, t: number): CatchRoot => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t, yaw: a.yaw + Math.atan2(Math.sin(b.yaw - a.yaw), Math.cos(b.yaw - a.yaw)) * t });

export function newCatch(attempt = 0): CatchEncounter {
  return { phase: 'launch', elapsed: 0, attempt, x: CATCH.start.x, z: CATCH.start.z, yaw: Math.PI,
    focus: 0, beats: 0, misses: 0, checkpoint: 'flight', layout: 2 };
}
export function catchLocked(state?: CatchEncounter): boolean { return Boolean(state && state.phase !== 'done'); }
export function catchLaunchReady(state: CatchEncounter): boolean {
  return state.phase === 'launch' && Math.abs(state.x) < CATCH.window.width / 2 - .65 && state.z < CATCH.window.z + 1.3;
}
export function catchFallY(elapsed: number): number { return -2 - 1.2 * Math.min(CATCH.impact, elapsed) ** 2; }
export function catchFallClock(state: CatchEncounter): number {
  return state.phase === 'flight' || state.phase === 'failed' && state.checkpoint === 'flight' ? state.elapsed : state.caught ? state.caught.age + (state.phase === 'catching' ? state.elapsed
    : CATCH.catching + (state.phase === 'ascent' ? state.elapsed : CATCH.ascent)) : 0;
}
export function catchCarRoofScale(state: CatchEncounter): number { return state.carImpact ? .35 : 1 - .65 * ease((catchFallClock(state) - 5.6) / .5); }
export function catchRoot(state: CatchEncounter, role: CatchGesture['role']): CatchRoot {
  if (state.phase === 'failed' && state.failure) return state.failure[role];
  if (role === 'agent_thompson') {
    const age = catchFallClock(state);
    return { x: 4, y: Math.max(CATCH.roadY + CATCH.carRoof.y + CATCH.carRoof.height / 2 * catchCarRoofScale(state), -2 - 2.1 * (age + .3) ** 2), z: -29, yaw: .3 };
  }
  if (state.phase === 'launch' || state.phase === 'departing' || state.phase === 'failed' && state.checkpoint === 'flight') {
    if (role === 'trinity') return { ...CATCH.trinity, y: -2, yaw: 0 };
    const from = { x: state.launch?.x ?? state.x, z: state.launch?.z ?? state.z, y: CATCH.start.y, yaw: Math.PI };
    return state.phase === 'departing' ? blend(from, { ...CATCH.flightStart, yaw: Math.PI }, ease(state.elapsed / CATCH.departure))
      : { x: state.x, z: state.z, y: CATCH.start.y, yaw: state.yaw ?? Math.PI };
  }
  if (state.phase === 'flight') {
    if (role === 'trinity') return { ...CATCH.trinity, y: catchFallY(state.elapsed), yaw: 0 };
    const progress = Math.max(0, Math.min(1, (CATCH.flightStart.z - state.z) / (CATCH.flightStart.z - CATCH.trinity.z)));
    return { x: state.x, y: CATCH.start.y + (catchFallY(state.elapsed) + 1.3 - CATCH.start.y) * progress,
      z: state.z, yaw: state.yaw ?? Math.PI };
  }
  const carried = { x: CATCH.trinity.x, y: state.caught?.trinity.y ?? state.catchY ?? -52, z: CATCH.trinity.z + (role === 'neo' ? 1.55 : 0), yaw: role === 'neo' ? Math.PI : 0 };
  if (state.phase === 'catching') return blend(state.caught?.[role] ?? carried, carried, ease(state.elapsed / CATCH.catching));
  if (state.phase === 'ascent') {
    const t = state.elapsed / CATCH.ascent, lift = ease(t / .72), over = ease((t - .72) / .28);
    return { x: carried.x + (CATCH.rooftop.x - carried.x) * over, y: carried.y + (4 - carried.y) * lift - 2 * over,
      z: carried.z + (CATCH.rooftop.z - (role === 'neo' ? 0 : 1.55) - carried.z) * over, yaw: carried.yaw };
  }
  const roof = role === 'neo' ? { ...CATCH.rooftop, y: 0, yaw: -Math.PI / 2 } : { ...CATCH.patient, y: 0, yaw: 0 };
  if (state.phase === 'landing') return blend({ x: CATCH.rooftop.x, z: CATCH.rooftop.z - (role === 'neo' ? 0 : 1.55), y: 2, yaw: carried.yaw }, roof, ease(state.elapsed / CATCH.landing));
  return roof;
}
export function catchDistance(state: CatchEncounter): number {
  const neo = catchRoot(state, 'neo'), trinity = catchRoot(state, 'trinity');
  return Math.hypot(neo.x - trinity.x, neo.y - trinity.y, neo.z - trinity.z);
}
export function catchFlightBlocked(from: CatchRoot, to: CatchRoot): boolean {
  return CATCH_BUILDINGS.some(building => {
    if (building.name === 'catch-architect-exit-tower') return false; // The launch uses its shared aperture and floor bounds.
    let enter = 0, exit = 1;
    const bounds = [[building.x - building.width / 2 - .55, building.x + building.width / 2 + .55],
      [CATCH.roadY - .2, CATCH.roadY + building.height + .55], [building.z - building.depth / 2 - .55, building.z + building.depth / 2 + .55]];
    for (const [i, key] of (['x', 'y', 'z'] as const).entries()) {
      const delta = to[key] - from[key];
      if (Math.abs(delta) < 1e-8) { if (from[key] < bounds[i][0] || from[key] > bounds[i][1]) return false; }
      else { const a = (bounds[i][0] - from[key]) / delta, b = (bounds[i][1] - from[key]) / delta; enter = Math.max(enter, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b)); }
    }
    return enter <= exit;
  });
}
export function catchText(state: CatchEncounter): string {
  switch (state.phase) {
    case 'launch': return 'Neo 已回到矩阵。W 走到前方窗口，靠近后按 G 冲破玻璃；起飞后 W 飞行，A / D 绕开楼体。';
    case 'departing': return 'Neo 冲向窗口，越过窗沿后沿街谷飞向 Trinity。';
    case 'flight': return `Trinity 正在坠落。W 飞近，A / D 调整航线；靠近她后，在落地前按 G 接住。剩余 ${Math.max(0, CATCH.impact - state.elapsed).toFixed(1)} 秒。`;
    case 'catching': return 'Neo 伸手抓住 Trinity 的上身，稳住两人的坠势。';
    case 'ascent': return 'Neo 抱住 Trinity，先升到楼顶以上，再带她越过屋檐。';
    case 'landing': return 'Neo 落到屋顶，跪下把 Trinity 放平。';
    case 'extract_ready': return 'Trinity 胸口仍有一枚子弹。按住 G 聚焦她体内的代码，取出子弹。';
    case 'extracting': return `按住 G 保持代码聚焦。子弹分离 ${Math.round(state.focus / CATCH.extraction * 100)}%。`;
    case 'pulse': return `心跳停止。光圈收拢时按 F；已对上 ${state.beats}/3 次，误按 ${state.misses}/3 次。`;
    case 'reviving': return 'Neo 维持她心脏的代码，Trinity 开始恢复呼吸。';
    case 'failed': return state.checkpoint === 'pulse' ? '累计三次误按，心跳复苏失败。按 J 从屋顶检查点重试。'
      : 'Neo 没能赶上这次坠落。按 J 从窗口检查点重试。';
    default: return 'Trinity 恢复了心跳。两人返回飞船；锡安的战争仍在逼近。';
  }
}
