import { performance } from 'node:perf_hooks';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { constructLesson as baselineLesson } from './baseline-release/tests/helpers/construct-lesson.mjs';
import { constructLesson as candidateLesson } from './candidate-release/tests/helpers/construct-lesson.mjs';

const hash = (data: Buffer) => createHash('sha256').update(data).digest('hex');
const inputs = JSON.parse(await readFile(new URL('./validation-inputs.json', import.meta.url), 'utf8'));
async function verifyInputs() {
  for (const [name, digest] of Object.entries(inputs)) {
    if (hash(await readFile(new URL('./candidate-release/' + name, import.meta.url))) !== digest) throw new Error(`Frozen input changed: ${name}`);
  }
}
await verifyInputs();
const results = [];
for (const role of ['neo', 'morpheus'] as const) {
  const actors = { baseline: await baselineLesson(role), candidate: await candidateLesson(role) };
  // Full HeroModel.animate resets the pose each time. Directly calling the
  // contact helper would accumulate thumb rotations and would be an invalid test.
  for (let i = 0; i < 80; i++) for (const actor of Object.values(actors)) actor.at(3.456);
  for (const mode of ['baseline', 'candidate', 'candidate', 'baseline'] as const) {
    const samples: number[] = [];
    for (let i = 0; i < 240; i++) { const start = performance.now(); actors[mode].at(3.456); samples.push(performance.now() - start); }
    samples.sort((a, b) => a - b);
    results.push({ role, mode, samples: samples.length, meanMs: samples.reduce((a, b) => a + b) / samples.length, medianMs: samples[120], p95Ms: samples[227] });
  }
  Object.values(actors).forEach(actor => actor.dispose());
}
await verifyInputs();
const report = { scope: 'Offline Node CPU time for full HeroModel.animate plus current root matrices, one delivered actor at a frozen 3.456-second lesson pose; A/B/B/A after warmup. No rendering, browser, recording, simulation or GPU measurement. Not an FPS or memory-requirement certification.', baselineRevision: 'f92a2eb0df1b7bd42841fc691b62fb7139021f9a', results, frozenInputsUnchanged: true, browser60FpsClaim: false };
await writeFile(new URL('./animation-cpu.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
