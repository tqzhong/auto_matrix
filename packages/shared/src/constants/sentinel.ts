import type { FilmJourney } from './film-story.js';

export type SentinelPhase = 'ready' | 'shutdown' | 'sweep' | 'detected' | 'failed' | 'clear' | 'verify' | 'confirming' | 'done';
export interface SentinelEncounter {
  phase: SentinelPhase;
  elapsed: number;
  noise: number;
  attempt: number;
  caughtAt?: { x: number; z: number; yaw: number };
}
export type SentinelRole = 'neo' | 'morpheus' | 'trinity' | 'tank' | 'dozer';
export type SentinelGesture = SentinelEncounter & { role: SentinelRole };

export const SENTINEL_CAST = ['morpheus', 'trinity', 'tank', 'dozer'] as const;
export const SENTINEL_STATION = {
  approach: { x: 0, z: -38, yaw: Math.PI },
  window: { x: 0, z: -43, yaw: Math.PI },
  morpheus: { x: 3.2, z: -39.2, yaw: -2.55 },
  trinity: { x: -3.1, z: -40.2, yaw: 2.55 },
  tank: { x: -8.2, z: -34.5, yaw: -Math.PI / 2 },
  dozer: { x: 8.2, z: -35.2, yaw: Math.PI / 2 },
} as const;
export const SENTINEL_TIMING = { shutdown: 4.5, sweep: 12, detected: 3.2, clear: 3.8, confirming: 3.5 } as const;

const smooth = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};
const ease = (time: number, from: number, to: number) => smooth((time - from) / (to - from));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export function sentinelActive(journey: FilmJourney): boolean {
  return journey.scene === 'm1_sentinels' && !journey.visiting && !!journey.sentinel && journey.sentinel.phase !== 'done';
}

export function sentinelLocked(journey: FilmJourney): boolean {
  return sentinelActive(journey) && !['ready', 'sweep', 'verify'].includes(journey.sentinel!.phase);
}

export function sentinelDanger(seconds: number): number {
  const approach = ease(seconds, 1.2, 3.4);
  const depart = 1 - ease(seconds, 9.1, SENTINEL_TIMING.sweep);
  const pulse = .72 + Math.sin(seconds * 2.6) * .18 + Math.sin(seconds * 5.3) * .1;
  return Math.max(.12, Math.min(1, approach * depart * pulse));
}

export function sentinelMachinePose(encounter?: SentinelEncounter) {
  if (!encounter || encounter.phase === 'ready' || encounter.phase === 'shutdown') return { x: -26, y: 10.5, z: -63, yaw: .55, scan: 0 };
  const phase = encounter.phase; const t = encounter.elapsed;
  if (phase === 'sweep') {
    const travel = ease(t, .4, SENTINEL_TIMING.sweep - .5);
    return { x: mix(-25, 23, travel), y: 9.2 + Math.sin(t * .85) * 1.1, z: -61 + Math.sin(t * .52) * 2.3,
      yaw: mix(.75, -.72, travel), scan: sentinelDanger(t) };
  }
  if (phase === 'detected' || phase === 'failed') {
    const strike = phase === 'failed' ? 1 : ease(t, 0, SENTINEL_TIMING.detected);
    return { x: mix(0, 2, strike), y: mix(9.2, 5.1, strike), z: mix(-61, -52.4, strike), yaw: Math.PI, scan: 1 };
  }
  if (phase === 'clear' || phase === 'verify' || phase === 'confirming' || phase === 'done') {
    const depart = phase === 'clear' ? ease(t, 0, SENTINEL_TIMING.clear) : 1;
    return { x: mix(22, 34, depart), y: mix(9.4, 14, depart), z: mix(-61, -70, depart), yaw: -.8, scan: Math.max(0, 1 - depart * 1.5) };
  }
  return { x: -26, y: 10.5, z: -63, yaw: .55, scan: 0 };
}

export function sentinelRoot(encounter: SentinelEncounter, role: SentinelRole) {
  if (role === 'neo') {
    if ((encounter.phase === 'detected' || encounter.phase === 'failed') && encounter.caughtAt) return encounter.caughtAt;
    return encounter.phase === 'confirming' || encounter.phase === 'done'
      ? SENTINEL_STATION.window : SENTINEL_STATION.approach;
  }
  return SENTINEL_STATION[role];
}

export function sentinelText(encounter: SentinelEncounter): string {
  if (encounter.phase === 'ready') return '警报从驾驶舱传来。走到前舱，听取 Tank 的静默停机指令。';
  if (encounter.phase === 'shutdown') return 'Tank 正在切断非必要供电。照明熄灭后，不要发出声音。';
  if (encounter.phase === 'sweep') return encounter.noise > .72 ? '噪声已经接近暴露阈值。立刻停下，连脚步也会传过船壳。'
    : encounter.noise > .3 ? '哨兵的扫描转向船体。停住，不要奔跑或跳跃。' : '哨兵贴着船壳滑过。保持静止，等待扫描离开。';
  if (encounter.phase === 'detected') return '红色扫描锁定了驾驶舱。哨兵正在扑向舷窗。';
  if (encounter.phase === 'failed') return '这次静默失败。按 G 从停机检查点重试；失败不会抹去此前剧情。';
  if (encounter.phase === 'clear') return 'Morpheus 仍然示意所有人别动。哨兵正从船体上方离开。';
  if (encounter.phase === 'verify') return '扫描声已经远去。走到前窗与 EMP 控制台旁，亲自确认航道。';
  if (encounter.phase === 'confirming') return 'Tank 保持 EMP 待命。Neo 从结霜的舷窗确认哨兵已经远离。';
  return '航道恢复安静。飞船重新接通必要系统，继续驶向先知的接入点。';
}
