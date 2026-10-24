import { writeFile } from 'node:fs/promises';
import { Session } from 'node:inspector/promises';
import * as THREE from 'three';
import { actor } from './candidate-release/tests/helpers/fighting-hand-fixture.mjs';
import { advanceMotion, newMotion } from './candidate-release/packages/client/src/agents/CharacterMotion.js';

const actors = await Promise.all(['neo', 'morpheus'].map(async id => {
  const h = await actor(id as 'neo' | 'morpheus');
  const placement = new THREE.Group(); placement.position.set(6336, 1, 4416); placement.rotation.y = .63; placement.add(h.rig.root);
  return { ...h, id, placement };
}));
function frame(number: number) {
  const period = number % 360, speed = period < 120 ? 0 : period < 240 ? 3.4 : 0;
  for (const h of actors) {
    const motion = Object.assign(newMotion(), { speed, phase: number / 60 });
    if (period >= 240 && period < 330) Object.assign(motion, { combo: Math.floor((period - 240) / 30), attackAge: (period % 30) / 60 });
    if (period >= 330) Object.assign(motion, { skill: 'dodge', skillAge: (period - 330) / 60 });
    const input = { speed, grounded: true, verticalVelocity: 0, turn: Math.sin(number / 60) * .3, dojoOutfit: h.id as 'neo' | 'morpheus', dojoSparring: true };
    h.models.animate(h.rig, advanceMotion(motion, input, 0), motion, input, 0);
  }
}
for (let i = 0; i < 60; i++) frame(i);
const session = new Session(); session.connect();
await session.post('Profiler.enable'); await session.post('Profiler.setSamplingInterval', { interval: 1000 }); await session.post('Profiler.start');
const times: number[] = [], start = performance.now(); let number = 0;
while (performance.now() - start < 8000) { const at = performance.now(); frame(number++); times.push(performance.now() - at); }
const { profile } = await session.post('Profiler.stop'); session.disconnect();
const output = process.argv[2] ?? 'baseline';
await writeFile(new URL(`./${output}.cpuprofile`, import.meta.url), JSON.stringify(profile));
const nodes = new Map(profile.nodes.map(node => [node.id, node])); const totals = new Map<string, number>();
(profile.samples ?? []).forEach((id, i) => {
  const node = nodes.get(id)!, f = node.callFrame, key = `${f.functionName || '(anonymous)'} ${f.url}:${f.lineNumber + 1}`;
  totals.set(key, (totals.get(key) ?? 0) + (profile.timeDeltas?.[i] ?? 0));
});
const sorted = [...times].sort((a,b)=>a-b), report = { iterations: number, actors: actors.length, averageCpuMs: times.reduce((a,b)=>a+b,0)/times.length, p95CpuMs: sorted[Math.ceil(sorted.length*.95)-1], note: 'Offline CPU animation including full sole, hand and skin updates. No browser, rendering, GPU or FPS measurement.', top: [...totals].sort((a,b)=>b[1]-a[1]).slice(0,30).map(([functionName,microseconds])=>({functionName,ms:microseconds/1000})) };
await writeFile(new URL(`./${output}.json`, import.meta.url), JSON.stringify(report,null,2)+'\n'); console.log(JSON.stringify(report,null,2));
actors.forEach(h=>h.models.dispose());
