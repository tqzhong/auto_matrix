import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const folder = process.argv[2], label = process.argv[3];
const { actor } = await import(pathToFileURL(`${folder}/tests/helpers/fighting-hand-fixture.mts`).href);
const { advanceMotion, newMotion } = await import(pathToFileURL(`${folder}/packages/client/src/agents/CharacterMotion.ts`).href);
const h = await actor('neo');
const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, seated: true, realWorld: true, nebCrew: 'neo', nebCrewEarly: true,
  training: { kind: 'jump_return', role: 'neo', elapsed: 0 } };
const frame = (elapsed: number) => { input.training.elapsed = elapsed; const motion = newMotion(); h.models.animate(h.rig, advanceMotion(motion, input, 0), motion, input, 0); };
const construction = performance.now(); frame(0); const firstFrameMs = performance.now() - construction;
for (let i = 0; i < 120; i++) frame(i / 10);
const timings: number[] = [];
for (let cycle = 0; cycle < 3; cycle++) for (let i = 0; i < 720; i++) {
  const start = performance.now(); frame(i / 60); timings.push(performance.now() - start);
}
const sorted = [...timings].sort((a,b)=>a-b);
const report = { label, frames: timings.length, averageCpuMs: timings.reduce((a,b)=>a+b,0)/timings.length,
  p95CpuMs: sorted[Math.ceil(sorted.length*.95)-1], firstFrameMs,
  note: 'Offline single Neo animation over three 12-second return sequences. No browser, GPU, draw calls or FPS. Includes initial JumpPerformance creation only in firstFrameMs.' };
await writeFile(new URL(`./cpu-${label}.json`,import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report)); h.models.dispose();
