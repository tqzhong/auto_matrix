import { writeFile } from 'node:fs/promises';
import { actor } from './candidate-release/tests/helpers/fighting-hand-fixture.mjs';
import { SkinContinuity } from './candidate-release/packages/client/src/agents/SkinContinuity.js';

const rows: unknown[] = [], original = SkinContinuity.prototype.update;
let samples: number[] = [];
SkinContinuity.prototype.update = function () {
  const start = performance.now(); original.call(this); samples.push(performance.now() - start);
};
try {
  for (const id of ['neo', 'trinity', 'smith', 'morpheus'] as const) {
    const h = await actor(id);
    try {
      h.draw(.6);
      for (const mode of ['paused', 'articulating'] as const) {
        samples = []; const frameCosts: number[] = [];
        for (let i = 0; i < 72; i++) {
          const before = samples.length; h.draw(mode === 'paused' ? .6 : .15 + .7 * i / 71);
          if (i >= 12) frameCosts.push(samples.slice(before).reduce((a, b) => a + b, 0));
        }
        frameCosts.sort((a, b) => a - b);
        rows.push({ id, mode, measuredFrames: frameCosts.length, componentMedianMs: frameCosts[30], componentP95Ms: frameCosts[57], maximumMs: frameCosts.at(-1), fpsBenchmark: false });
      }
    } finally { h.models.dispose(); }
  }
} finally { SkinContinuity.prototype.update = original; }
await writeFile(new URL('./skin-component-cost.json', import.meta.url), JSON.stringify({ scope: 'CPU time inside the new component only, real delivered rigs in an offline geometry fixture; excludes browser, GPU, loading and the rest of animation.', rows }, null, 2) + '\n');
console.log(JSON.stringify(rows));
