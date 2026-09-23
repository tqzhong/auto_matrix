export type CatchPhase = 'launch' | 'flight' | 'ascent' | 'extract_ready' | 'extracting' | 'pulse' | 'failed' | 'done';

export interface CatchEncounter {
  phase: CatchPhase; elapsed: number; attempt: number; x: number; z: number; yaw: number;
  focus: number; beats: number; misses: number; catchY?: number;
  checkpoint?: 'flight' | 'pulse';
}

export type CatchGesture = CatchEncounter & { role: 'neo' | 'trinity' | 'agent_johnson' };

export const CATCH = {
  start: { x: 0, z: 27, y: 16 },
  trinity: { x: -8.5, z: -24 },
  rooftop: { x: -.6, z: -18.2 },
  roadY: -75,
  impact: 7.7,
  catchFrom: 5.1,
  catchRadius: 4.5,
  speed: 21,
  lateral: 15,
  ascent: 2.8,
  extraction: 2.4,
  pulseAt: 1.1,
  pulseWindow: .42,
  pulsePeriod: 1.7,
} as const;

export function newCatch(attempt = 0): CatchEncounter {
  return { phase: 'launch', elapsed: 0, attempt, x: CATCH.start.x, z: CATCH.start.z, yaw: Math.PI,
    focus: 0, beats: 0, misses: 0, checkpoint: 'flight' };
}

export function catchLocked(state?: CatchEncounter): boolean {
  return Boolean(state && !['failed', 'done'].includes(state.phase));
}

export function catchFallY(elapsed: number): number {
  return -2 - 1.2 * Math.min(CATCH.impact, elapsed) ** 2;
}

export function catchRoot(state: CatchEncounter, role: CatchGesture['role']): { x: number; y: number; z: number; yaw: number } {
  if (role === 'agent_johnson') return ['ascent', 'extract_ready', 'extracting', 'pulse', 'done'].includes(state.phase) || state.phase === 'failed' && state.checkpoint === 'pulse'
    ? { x: 4, y: CATCH.roadY + 1, z: -29, yaw: .3 } : { x: 2.5, y: 2, z: -17, yaw: Math.PI };
  if (state.phase === 'launch' || state.phase === 'failed' && state.checkpoint === 'flight') {
    return role === 'neo' ? { ...CATCH.start, yaw: Math.PI }
      : { x: CATCH.trinity.x, y: -2, z: CATCH.trinity.z, yaw: 0 };
  }
  if (state.phase === 'flight') {
    if (role === 'trinity') return { ...CATCH.trinity, y: catchFallY(state.elapsed), yaw: 0 };
    const progress = Math.max(0, Math.min(1, (CATCH.start.z - state.z) / (CATCH.start.z - CATCH.trinity.z)));
    return { x: state.x, y: CATCH.start.y + (catchFallY(state.elapsed) + 1.3 - CATCH.start.y) * progress,
      z: state.z, yaw: state.yaw ?? Math.PI };
  }
  if (state.phase === 'ascent') {
    const progress = Math.max(0, Math.min(1, state.elapsed / CATCH.ascent));
    const eased = progress * progress * (3 - 2 * progress);
    const roof = role === 'neo' ? CATCH.rooftop : { x: -1.7, z: -17.3 };
    const startX = state.x - (role === 'neo' ? 0 : .8); const startZ = state.z - (role === 'neo' ? 0 : 1);
    const startY = (state.catchY ?? -52) + (role === 'neo' ? 0 : .4);
    return { x: startX + (roof.x - startX) * eased,
      y: startY + ((role === 'neo' ? 0 : .52) - startY) * eased,
      z: startZ + (roof.z - startZ) * eased, yaw: 0 };
  }
  return role === 'neo' ? { ...CATCH.rooftop, y: 0, yaw: Math.PI }
    : { x: -1.7, y: .52, z: -17.3, yaw: 0 };
}

export function catchText(state: CatchEncounter): string {
  switch (state.phase) {
    case 'launch': return '左门通向燃烧的大楼。按 G 冲出窗口；W 向 Trinity 飞去，A / D 绕开街谷中央的楼体。';
    case 'flight': return `Trinity 正在坠落。W 飞近，A / D 调整航线；靠近她后，在落地前按 G 接住。剩余 ${Math.max(0, CATCH.impact - state.elapsed).toFixed(1)} 秒。`;
    case 'ascent': return 'Neo 抱住 Trinity，带她飞上屋顶。她腹部仍有一枚子弹。';
    case 'extract_ready': return 'Trinity 就在身旁。按住 G 聚焦她体内的代码，取出子弹。';
    case 'extracting': return `按住 G 保持代码聚焦。子弹分离 ${Math.round(state.focus / CATCH.extraction * 100)}%。`;
    case 'pulse': return `心跳停止。光圈收拢时按 F；已对上 ${state.beats}/3 次，误按 ${state.misses}/3 次。`;
    case 'failed': return state.checkpoint === 'pulse' ? '累计三次误按，心跳复苏失败。按 J 从屋顶检查点重试。'
      : 'Neo 没能赶上这次坠落。按 J 从冲出大楼的检查点重试。';
    default: return 'Trinity 恢复了心跳。两人返回飞船；锡安的战争仍在逼近。';
  }
}
