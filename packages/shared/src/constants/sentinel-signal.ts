import type { TunnelEncounter } from './film-story.js';

export const SENTINEL_SIGNAL = { stopSeconds: 1.6, collapseSeconds: 3.4, halfWidth: 14, halfLength: 73, height: 12 } as const;
export const SIGNAL_OBSTACLES = [
  ...[-1, 1].flatMap(side => [
    { x: side * 14.4, z: 0, width: .8, depth: 146, height: 12 },
    { x: side * 12.7, z: 0, width: 2.4, depth: 146, height: 4 },
  ]),
  { x: 0, z: 58, width: 24, depth: 20, height: 3.4 },
] as const;

export function signalLocked(tunnel: TunnelEncounter | undefined): boolean {
  return Boolean(tunnel && ['sensing', 'failed', 'stopping', 'collapsing', 'collapsed'].includes(tunnel.phase));
}

/** The renderer receives the saved clock, including pre-upgrade completed saves. */
export function signalSentinelPose(tunnel: TunnelEncounter, index: number) {
  const age = tunnel.age ?? Math.max(0, 14 - tunnel.remaining);
  const cut = tunnel.phase === 'stopping' ? tunnel.elapsed ?? 0
    : tunnel.phase === 'collapsing' || tunnel.phase === 'collapsed' ? SENTINEL_SIGNAL.stopSeconds : 0;
  const falling = Math.max(0, cut - index * .18);
  const disabled = cut > index * .18;
  const pursuit = tunnel.pursuit ?? (tunnel.phase === 'running' ? 0 : 68);
  return { x: (index - 1) * 5, z: 58 + index * 4 - pursuit - Math.max(0, 1 - tunnel.remaining / 14) * 18,
    y: disabled ? Math.max(.75, 6 - .5 * 9.8 * falling * falling) : 6 + Math.sin(age * 4 + index) * .3,
    roll: disabled ? Math.min(.7, falling * .7) * (index % 2 ? -1 : 1) : Math.sin(age * 2 + index) * .06,
    disabled, falling, age };
}
