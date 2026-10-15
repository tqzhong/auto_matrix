import type { InterludeEncounter, InterludeGesture } from './interlude.js';

export const CREW_MEAL = {
  receive: 2.3, duration: 13.2,
  table: { x: -8, z: 22, height: 1.93, width: 3.2, depth: 8.4 },
  bowl: { radius: .32, height: .3, start: { x: -6.95, y: 1.93, z: 20.2 }, end: { x: -6.95, y: 1.93, z: 19.4 } },
  spoon: { x: -6.65, y: 1.9452, z: 18.8 },
  seats: {
    neo: { x: -5.55, z: 19.4, yaw: -Math.PI / 2 }, tank: { x: -5.55, z: 22, yaw: -Math.PI / 2 },
    apoc: { x: -5.55, z: 24.6, yaw: -Math.PI / 2 }, dozer: { x: -10.45, z: 19.4, yaw: Math.PI / 2 },
    mouse: { x: -10.45, z: 22, yaw: Math.PI / 2 }, switch: { x: -10.45, z: 24.6, yaw: Math.PI / 2 },
  },
} as const;

const ease = (t: number, a: number, b: number) => {
  const x = Math.max(0, Math.min(1, (t - a) / (b - a))); return x * x * (3 - 2 * x);
};

export function crewMealAge(encounter: InterludeEncounter): number {
  if (encounter.phase === 'ready') return 0;
  if (encounter.phase === 'done') return CREW_MEAL.duration;
  if (encounter.physicalMeal && encounter.phase === 'accept_ready') return CREW_MEAL.receive;
  return encounter.elapsed + (encounter.physicalMeal && encounter.phase === 'accepting' ? CREW_MEAL.receive : 0);
}

export function crewMealPose(encounter: InterludeEncounter) {
  const t = crewMealAge(encounter);
  return { t, slide: ease(t, .35, 2.1), tankApproach: ease(t, 1, 1.3), tankSeat: ease(t, 1.3, 2),
    tankTurn: ease(t, 1, 1.3) * (1 - ease(t, 2, 2.3)),
    bowlReach: ease(t, 2.3, 3.2) * (1 - ease(t, 10, 10.8)), bowlCarry: ease(t, 3.4, 4.2) * (1 - ease(t, 8.7, 10)),
    bowlHeld: t >= 3.2 && t < 10, spoonReach: ease(t, 2.3, 3.4) * (1 - ease(t, 8.2, 9)),
    spoonHeld: t >= 3.4 && t < 8.2, scoop: ease(t, 3.4, 4.2), mouth: ease(t, 4.2, 5.4) * (1 - ease(t, 5.7, 6.8)),
    eaten: ease(t, 5.4, 5.7), jawOpen: ease(t, 4.2, 5.1) * (1 - ease(t, 5.8, 6.6)),
    returnSpoon: ease(t, 6.8, 8.2), turn: ease(t, 11, 11.65), rise: ease(t, 11.65, 12.65), exitTurn: ease(t, 12.35, 12.65), exit: ease(t, 12.65, CREW_MEAL.duration) };
}

export function crewMealSeat(gesture: InterludeGesture): number {
  const pose = crewMealPose(gesture);
  return gesture.role === 'tank' ? pose.tankSeat : gesture.role === 'neo' ? 1 - pose.rise : 1;
}
