import { performance } from 'node:perf_hooks';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { truthGround as baseline } from './baseline-release/tests/helpers/truth-ground.mjs';
import { truthGround as candidate } from './candidate-release/tests/helpers/truth-ground.mjs';

const hash=(data:Buffer)=>createHash('sha256').update(data).digest('hex');
const inputs=JSON.parse(await readFile(new URL('./validation-inputs.json',import.meta.url),'utf8'));
async function verifyInputs(){for(const [name,digest]of Object.entries(inputs))if(hash(await readFile(new URL('./candidate-release/'+name,import.meta.url)))!==digest)throw new Error('Frozen input changed: '+name);}
await verifyInputs();
const actors={baseline:await baseline(),candidate:await candidate()},results=[];
try{
 for(let i=0;i<80;i++)for(const actor of Object.values(actors))actor.at(11.815);
 for(const mode of ['baseline','candidate','candidate','baseline']as const){
  const samples=[];for(let i=0;i<240;i++){const start=performance.now();actors[mode].at(11.815);samples.push(performance.now()-start);}samples.sort((a,b)=>a-b);
  results.push({mode,samples:samples.length,meanMs:samples.reduce((a,b)=>a+b,0)/samples.length,medianMs:samples[120],p95Ms:samples[227]});
 }
}finally{Object.values(actors).forEach(actor=>actor.dispose());}
await verifyInputs();
const report={scope:'Offline Node CPU time for full HeroModel.animate plus actual root matrices, one delivered Neo at a fixed 11.815-second truth-return kneeling pose; A/B/B/A after warmup. No rendering, GPU, browser, recording or simulation measurement. Not an FPS or memory-requirement certification.',baselineRevision:'0a3f252f114560b80e8358ce46589981aa53f8da',results,frozenInputsUnchanged:true,browser60FpsClaim:false};
await writeFile(new URL('./animation-cpu.json',import.meta.url),JSON.stringify(report,null,2)+'\n');process.stdout.write(JSON.stringify(report,null,2)+'\n');
