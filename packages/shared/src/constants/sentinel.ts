import type { FilmJourney } from './film-story.js';

export type SentinelPhase = 'ready' | 'shutdown' | 'briefing' | 'sweep' | 'detected' | 'failed' | 'clear' | 'verify' | 'confirming' | 'done';
export interface SentinelEncounter {
  phase: SentinelPhase;
  elapsed: number;
  noise: number;
  attempt: number;
  caughtAt?: { x: number; z: number; yaw: number };
  empBriefed?: boolean;
  startHealth?: number;
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
export const SENTINEL_TIMING = { shutdown: 5.5, sweep: 12, detected: 3.2, clear: 3.8, confirming: 3.5 } as const;
export const SENTINEL_POWER = {
  main: { x: -9.55, y: 2.6, z: -34.05 },
  arm: { x: -9.55, y: 2.6, z: -34.85 },
  emp: { x: 3, y: 2.9, z: -40.65, width: 1.5, depth: .9, height: .4 },
  inspect: { x: .5, z: -41, radius: 1.3 },
  panel: { x: -9.65, y: 2.48, z: -34.45, width: .3, depth: 1.5, height: .52 },
} as const;

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
  return sentinelActive(journey) && !['ready', 'briefing', 'sweep', 'verify'].includes(journey.sentinel!.phase);
}

export function sentinelPowerPose(encounter?: SentinelEncounter) {
  const t = !encounter || encounter.phase === 'ready' ? 0 : encounter.phase === 'shutdown' ? encounter.elapsed : SENTINEL_TIMING.shutdown;
  const restoring = encounter?.phase === 'confirming' ? ease(encounter.elapsed, .9, 2.1) : encounter?.phase === 'done' ? 1 : 0;
  const main = ease(t, .95, 1.8) * (1 - restoring), arm = ease(t, 2.85, 3.7);
  const right = encounter?.phase === 'shutdown' ? ease(t, 0, .9) * (1 - ease(t, 1.9, 2.9))
    : encounter?.phase === 'confirming' ? ease(encounter.elapsed, 0, .85) * (1 - ease(encounter.elapsed, 2.25, 3.25)) : 0;
  const left = encounter?.phase === 'shutdown' ? ease(t, 1.5, 2.8) * (1 - ease(t, 3.8, 5.4)) : 0;
  const guard = !encounter || encounter.phase === 'ready' ? 0 : encounter.phase === 'shutdown' ? ease(t, .55, 3.75)
    : encounter.phase === 'confirming' ? 1 - ease(encounter.elapsed, .2, 3.2) : encounter.phase === 'done' ? 0 : 1;
  return { main, arm, right, left, guard, power: 1 - main * .95 };
}

export function sentinelSwitchPoint(encounter: SentinelEncounter, side: 'main' | 'arm') {
  const pose = sentinelPowerPose(encounter), at = SENTINEL_POWER[side], angle = pose[side] * Math.PI / 2;
  return { x: at.x + .24 * Math.sin(angle), y: at.y + .24 * Math.cos(angle), z: at.z };
}

export function sentinelDanger(seconds: number): number {
  const approach = ease(seconds, 1.2, 3.4);
  const depart = 1 - ease(seconds, 9.1, SENTINEL_TIMING.sweep);
  const pulse = .72 + Math.sin(seconds * 2.6) * .18 + Math.sin(seconds * 5.3) * .1;
  return Math.max(.12, Math.min(1, approach * depart * pulse));
}

export function sentinelMachinePose(encounter?: SentinelEncounter) {
  if (!encounter || encounter.phase === 'ready' || encounter.phase === 'shutdown') return { x: -26, y: 6.4, z: -63, yaw: .55, scan: 0 };
  const phase = encounter.phase; const t = encounter.elapsed;
  if (phase === 'sweep') {
    const travel = ease(t, .4, SENTINEL_TIMING.sweep - .5);
    return { x: mix(-25, 23, travel), y: 5.8 + Math.sin(t * .85) * .58, z: -61 + Math.sin(t * .52) * 2.3,
      yaw: mix(.75, -.72, travel), scan: sentinelDanger(t) };
  }
  if (phase === 'detected' || phase === 'failed') {
    const strike = phase === 'failed' ? 1 : ease(t, 0, SENTINEL_TIMING.detected);
    return { x: mix(0, 2, strike), y: mix(5.8, 4.9, strike), z: mix(-61, -52.4, strike), yaw: Math.PI, scan: 1 };
  }
  if (phase === 'clear' || phase === 'verify' || phase === 'confirming' || phase === 'done') {
    const depart = phase === 'clear' ? ease(t, 0, SENTINEL_TIMING.clear) : 1;
    return { x: mix(22, 34, depart), y: mix(6.1, 10, depart), z: mix(-61, -70, depart), yaw: -.8, scan: Math.max(0, 1 - depart * 1.5) };
  }
  return { x: -26, y: 6.4, z: -63, yaw: .55, scan: 0 };
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
  if (encounter.phase === 'briefing') return '主电源已关闭，EMP 已待命。走近 Morpheus 手旁的控制台，按 G 听 Trinity 说明：它会使范围内的所有电气系统失效，也包括我们自己的飞船。';
  if (encounter.phase === 'sweep') return encounter.noise > .72 ? '噪声已经接近暴露阈值。立刻停下，连脚步也会传过船壳。'
    : encounter.noise > .3 ? '哨兵的扫描转向船体。停住，不要奔跑或跳跃。' : '哨兵贴着船壳滑过。保持静止，等待扫描离开。';
  if (encounter.phase === 'detected') return '红色扫描锁定了驾驶舱。哨兵正在扑向舷窗。';
  if (encounter.phase === 'failed') return '这次静默失败。按 G 从停机检查点重试；失败不会抹去此前剧情。';
  if (encounter.phase === 'clear') return 'Morpheus 仍然示意所有人别动。哨兵正从船体上方离开。';
  if (encounter.phase === 'verify') return '扫描声已经远去。走到前窗与 EMP 控制台旁，亲自确认航道。';
  if (encounter.phase === 'confirming') return 'Tank 保持 EMP 待命。Neo 从结霜的舷窗确认哨兵已经远离。';
  return '航道恢复安静。飞船重新接通必要系统，继续驶向先知的接入点。';
}
