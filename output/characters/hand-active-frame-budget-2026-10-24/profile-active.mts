import { Session } from 'node:inspector/promises';
import { writeFileSync } from 'node:fs';
import { PLAYER_RUN_SPEED, PLAYER_WALK_SPEED } from '@auto_matrix/shared';
import { advanceMotion, newMotion } from './candidate-release/packages/client/src/agents/CharacterMotion.js';
import { actor } from './candidate-release/tests/helpers/fighting-hand-fixture.mjs';
const h = await actor('neo'), session = new Session(); session.connect();
await session.post('Profiler.enable');
const timings: number[] = [], updates: number[] = [];
const hands = h.models['fightingHands'].get(h.rig)!, update = hands.update.bind(hands);
let measured = false;
hands.update = () => { const start = performance.now(); update(); if (measured) updates.push(performance.now() - start); };
for (let round = 0; round < 7; round++) {
  const motion = newMotion();
  if (round === 2) { measured = true; await session.post('Profiler.start'); }
  for (let frame = 0; frame < 318; frame++) {
    const speed = frame < 60 ? PLAYER_WALK_SPEED : frame < 180 ? PLAYER_RUN_SPEED : frame < 240 ? PLAYER_WALK_SPEED : 0;
    const input = { speed, grounded: true, verticalVelocity: 0, turn: Math.sin(frame / 60) }, pose = advanceMotion(motion, input, 1 / 60);
    const start = performance.now(); h.models.animate(h.rig, pose, motion, input, 1 / 60);
    if (measured) timings.push(performance.now() - start);
  }
}
const { profile } = await session.post('Profiler.stop'); session.disconnect();
writeFileSync(new URL('./baseline.cpuprofile', import.meta.url), JSON.stringify(profile));
const summarize = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); return { samples: values.length, mean: values.reduce((a, b) => a + b, 0) / values.length, p95: sorted[Math.floor(sorted.length * .95)] }; };
console.log(JSON.stringify({ animation: summarize(timings), hands: summarize(updates) }));
h.models.dispose();
