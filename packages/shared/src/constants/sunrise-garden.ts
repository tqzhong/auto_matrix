import type { TrilogyEpilogueEncounter, TrilogyEpilogueGesture } from './trilogy-epilogue.js';

/** Local metres shared by the waterfront, its collision and the four performers. */
export const SUNRISE_GARDEN = {
  bench: { x: -7, z: -20, width: 7.4, depth: 1.65, surface: .86, height: 2.44 },
  approach: { x: -7, z: -23.1 },
  shore: -36,
  trees: [[-19, -15, 1.2], [16, -8, 1.4], [-31, 14, 1.5], [30, 21, 1.6], [-17, 38, 1.3], [10, 46, 1.5]],
} as const;

const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export function gardenPose(encounter: TrilogyEpilogueEncounter, role: TrilogyEpilogueGesture['role']) {
  const phase = encounter.phase, elapsed = encounter.elapsed;
  const bench = SUNRISE_GARDEN.bench;
  if (role === 'oracle') {
    const origin = encounter.parkApproach ?? { ...SUNRISE_GARDEN.approach, yaw: 0 };
    const moving = phase === 'sitting' ? smooth(elapsed / 1.65) : 1;
    const turn = phase === 'sitting' ? smooth(elapsed / .9) : 1;
    const yawDelta = Math.atan2(Math.sin(Math.PI - origin.yaw), Math.cos(Math.PI - origin.yaw));
    return { x: mix(origin.x, bench.x, moving), z: mix(origin.z, bench.z - .14, moving), yaw: origin.yaw + yawDelta * turn,
      seated: phase === 'ready' ? 0 : phase === 'sitting' ? smooth((elapsed - 1.05) / 1.35) : 1, walk: phase === 'sitting' && elapsed < 1.65 ? 1 : 0 };
  }
  if (role === 'architect') {
    const arriving = phase === 'architect' ? smooth(elapsed / 3.8) : ['ready', 'sitting', 'cat'].includes(phase) ? 0 : 1;
    const leaving = phase === 'leaving' ? smooth(elapsed / 4.8) : ['promise', 'sati', 'sunrise', 'belief', 'done'].includes(phase) ? 1 : 0;
    return { x: mix(mix(-25, -8.3, arriving), -30, leaving), z: mix(mix(-30, -25.5, arriving), -30, leaving),
      yaw: leaving > 0 ? -Math.PI / 2 : mix(1.3, 0, smooth((arriving - .8) / .2)), seated: 0,
      walk: phase === 'architect' && elapsed < 3.8 || phase === 'leaving' ? 1 : 0 };
  }
  const present = ['sunrise', 'belief', 'done'].includes(phase), arrival = present ? 1 : phase === 'sati' ? smooth(elapsed / 4.8) : 0;
  if (role === 'seraph') return { x: mix(14, -1.7, arrival), z: mix(-28, -18.4, arrival), yaw: mix(-1.1, Math.PI, arrival), seated: 0,
    walk: phase === 'sati' && elapsed < 4.8 ? 1 : 0 };
  const towardSky = encounter.phase === 'sunrise' ? smooth(elapsed / 6.2) : ['belief', 'done'].includes(phase) ? 1 : 0;
  return { x: mix(12, -4.6, arrival), z: mix(-29, -22, arrival),
    yaw: mix(-1.2, -Math.PI, towardSky), seated: 0,
    walk: phase === 'sati' && elapsed < 4.8 ? 1 : 0 };
}

export function gardenSunrise(encounter?: TrilogyEpilogueEncounter): number {
  return encounter?.phase === 'sunrise' ? smooth(encounter.elapsed / 6.2)
    : encounter && ['belief', 'done'].includes(encounter.phase) ? 1 : 0;
}
