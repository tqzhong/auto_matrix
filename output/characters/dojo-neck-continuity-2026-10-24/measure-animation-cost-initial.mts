import { writeFile } from 'node:fs/promises';
import { actor as oldActor } from '../dojo-guard-contact-2026-10-24/candidate-release/tests/helpers/fighting-hand-fixture.mjs';
import { actor } from './candidate-release/tests/helpers/fighting-hand-fixture.mjs';
import { advanceMotion, newMotion } from './candidate-release/packages/client/src/agents/CharacterMotion.js';
const results=[];
for(const id of ['neo','morpheus'] as const){
 const before=await oldActor(id),after=await actor(id),input={speed:0,grounded:true,verticalVelocity:0,turn:0,dojoOutfit:id,dojoSparring:true},motion=newMotion(),pose=advanceMotion(motion,input,0);
 const frame=(h:typeof after)=>h.models.animate(h.rig,pose,motion,input,0);
 for(let i=0;i<60;i++){frame(before);frame(after);}
 const samples:{version:string;msPerAnimation:number}[]=[];
 for(let batch=0;batch<5;batch++)for(const version of ['before','after','after','before']){const h=version==='before'?before:after,start=performance.now();for(let i=0;i<250;i++)frame(h);samples.push({version,msPerAnimation:(performance.now()-start)/250});}
 const med=(version:string)=>{const values=samples.filter(s=>s.version===version).map(s=>s.msPerAnimation).sort((a,b)=>a-b);return(values[4]+values[5])/2;};
 results.push({id,beforeMedianMs:med('before'),afterMedianMs:med('after'),deltaMs:med('after')-med('before'),samples});before.models.dispose();after.models.dispose();
}
const report={scope:'Node CPU only: one full HeroModels.animate call, actual delivered geometry, stationary dojo guard; no renderer, scene, WebGL or browser FPS claim',warmup:60,samplesPerVersion:10,framesPerSample:250,order:'B/A/A/B repeated five times',results};await writeFile(new URL('./animation-cost.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
