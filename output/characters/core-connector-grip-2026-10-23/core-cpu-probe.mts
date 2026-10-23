import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const { coreConnector } = await import(pathToFileURL(resolve(process.argv[2] ?? '.', 'tests/helpers/core-connector.mts')).href);
const h = await coreConnector(), hands = h.morpheus.models.fightingHands.get(h.morpheus.rig);
const begin = hands.begin.bind(hands), update = hands.update.bind(hands); let both = false, values: number[] = [];
hands.begin = (input: unknown) => { begin(input); if (both) hands.connector = false; };
hands.update = () => { const start = performance.now(); update(); values.push(performance.now() - start); };
const stats = (a: number[]) => { a.sort((x,y)=>x-y); return { mean: a.reduce((sum,x)=>sum+x,0)/a.length, p95: a[Math.floor(a.length*.95)] }; };
const rows = [];
for (const originalBothHands of [true,false,false,true]) {
  both = originalBothHands; values = []; const all: number[] = [];
  for (let frame=0;frame<220;frame++) { const start=performance.now();h.at(2.02+4.76*(frame%200)/200);if(frame>=20)all.push(performance.now()-start); }
  rows.push({ originalBothHands, fullFixtureMs:stats(all),handSurfaceUpdateMs:stats(values.slice(20)) });
}
console.log(JSON.stringify({scope:'Same-model offline A/B/B/A; only the irrelevant left-hand deformation is toggled. No GPU or game FPS measurement.',rows},null,2));h.dispose();
