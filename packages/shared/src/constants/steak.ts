import type { InterludeEncounter, InterludeGesture } from './interlude.js';

export const STEAK_DINING = {
  table: { x: 0, z: -13, width: 3.8, depth: 2.6, height: 1.93 },
  cypher: { x: 0, z: -14.9, yaw: 0 }, smith: { x: 0, z: -11.1, yaw: Math.PI },
  plate: { x: 0, y: 1.9665, z: -13.78, radius: .43 },
  steak: { x: .04, radiusX: .28, radiusZ: .13, cutX: -.22, height: .07 },
  bite: { x: -.238, y: 2.024, z: -13.78 }, gripTilt: .45,
  fork: { x: -.65, y: 1.96, z: -13.95 }, knife: { x: .65, y: 1.96, z: -13.95 },
  wine: { x: .92, y: 1.93, z: -13.65 },
  duration: 26,
} as const;

const ease = (t: number, a: number, b: number) => { const x = Math.max(0, Math.min(1, (t - a) / (b - a))); return x * x * (3 - 2 * x); };

/** Old in-progress archives keep their clock; only their staging is migrated. */
export function steakAge(encounter: InterludeEncounter): number {
  return encounter.phase === 'ready' ? 0 : encounter.phase === 'done' ? STEAK_DINING.duration
    : encounter.elapsed * (encounter.physicalSteak ? 1 : STEAK_DINING.duration / 14.5);
}

export function steakPose(encounter: InterludeEncounter) {
  const t = steakAge(encounter);
  return { t, lift: ease(t, 3.5, 5.2) * (1 - ease(t, 8.7, 11.2)), mouth: ease(t, 6.8, 8) * (1 - ease(t, 8.7, 10)),
    jawOpen: Math.max(ease(t, 6.5, 7.4) * (1 - ease(t, 8.6, 9.3)),
      (.04 + .08 * Math.sin((t - 9.3) * Math.PI * 2.2) ** 2) * ease(t, 9.3, 9.5) * (1 - ease(t, 11.2, 11.8))),
    eaten: ease(t, 8.1, 8.6), forkReturn: ease(t, 9.5, 11.2), forkHeld: t < 11.2, forkReach: 1 - ease(t, 11.2, 12.3),
    knifeReturn: ease(t, 3.5, 4.8), knifeHeld: t < 4.8, knifeReach: 1 - ease(t, 4.8, 5.9),
    cut: Math.sin(t * Math.PI * 3) * .035 * ease(t, .4, .8) * (1 - ease(t, 3, 3.5)),
    wineReach: ease(t, 13, 14.5) * (1 - ease(t, 24.5, 26)), wineGrip: ease(t, 14, 14.5) * (1 - ease(t, 24.5, 25.2)),
    wineHeld: t >= 14.5 && t < 24.5, wineCarry: ease(t, 14.5, 15.8) * (1 - ease(t, 22.8, 24.5)),
    wineSip: ease(t, 18, 19.5) * (1 - ease(t, 20.8, 22.8)), drunk: ease(t, 20, 20.8) };
}

export function steakJawOpen(gesture?: InterludeGesture): number {
  return gesture?.kind === 'steak' && gesture.role === 'cypher' ? steakPose(gesture).jawOpen : 0;
}
