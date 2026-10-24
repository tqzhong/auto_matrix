import { PLAYER_RUN_SPEED, PLAYER_WALK_SPEED } from '@auto_matrix/shared';
import { advanceMotion, newMotion } from './candidate-release/packages/client/src/agents/CharacterMotion.js';
import { actor } from './candidate-release/tests/helpers/fighting-hand-fixture.mjs';
const h = await actor('neo'), timings: number[] = [], stages: Record<string, number[]> = { walk: [], sprint: [], slowing: [], stop: [] };
for (let round = 0; round < 7; round++) {
  const motion = newMotion();
  for (let frame = 0; frame < 318; frame++) {
    const stage = frame < 60 ? 'walk' : frame < 180 ? 'sprint' : frame < 240 ? 'slowing' : 'stop';
    const speed = stage === 'sprint' ? PLAYER_RUN_SPEED : stage === 'stop' ? 0 : PLAYER_WALK_SPEED;
    const input = { speed, grounded: true, verticalVelocity: 0, turn: Math.sin(frame / 60) }, pose = advanceMotion(motion, input, 1 / 60);
    const start = performance.now(); h.models.animate(h.rig, pose, motion, input, 1 / 60);
    if (round > 1) { const duration = performance.now() - start; timings.push(duration); stages[stage].push(duration); }
  }
}
const summarize = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); return { samples: values.length, mean: values.reduce((a, b) => a + b, 0) / values.length, p95: sorted[Math.floor(sorted.length * .95)] }; };
console.log(JSON.stringify({ animation: summarize(timings), stages: Object.fromEntries(Object.entries(stages).map(([name, values]) => [name, summarize(values)])) }));
h.models.dispose();
