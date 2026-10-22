import {writeFile} from 'node:fs/promises';
import {Session} from 'node:inspector';
import {performance} from 'node:perf_hooks';
import {actor} from './baseline-release/tests/helpers/fighting-hand-fixture.mjs';
import {FightingHands} from './baseline-release/packages/client/src/agents/FightingHands.js';
import {advanceMotion,newMotion} from './baseline-release/packages/client/src/agents/CharacterMotion.js';
const h=await actor('neo'),proto=FightingHands.prototype as any,original=proto.deform,previous=new Map(),rows=new Map<string,any>();let label='warm';
const draw=(choice:'red'|'blue',elapsed:number)=>{const input={speed:0,grounded:true,verticalVelocity:0,turn:0,mirror:0,pills:{role:'neo' as const,phase:'taking' as const,choice,elapsed}},motion=newMotion();h.models.animate(h.rig,advanceMotion(motion,input,0),motion,input,0);h.rig.root.updateMatrixWorld(true);};
for(let i=0;i<5;i++)draw('red',1.8);
proto.deform=function(hand:any){const q=hand.bones.flatMap((v:number[])=>v.flatMap(j=>this.skin.skeleton.bones[j].quaternion.toArray())).join(','),last=previous.get(hand.side),start=performance.now(),result=original.call(this,hand),row=rows.get(label)??{phase:label,calls:0,constantFingers:0,totalMS:0};row.calls++;row.constantFingers+=q===last?1:0;row.totalMS+=performance.now()-start;rows.set(label,row);previous.set(hand.side,q);return result;};
const session=new Session();session.connect();const post=(name:string)=>new Promise<any>((resolve,reject)=>session.post(name as any,(error,result)=>error?reject(error):resolve(result)));
try{await post('Profiler.enable');await post('Profiler.start');
for(let loop=0;loop<2;loop++)for(const choice of ['red','blue']as const)for(const[phase,a,b]of[['reach',.35,1.8],['mouth',2.15,3.45],['cup',4.1,5.3],['drink',5.55,6.6],['replace',7.7,9.2],['stand',9.6,11]]as const){label=phase;for(let i=0;i<20;i++)draw(choice,a+(b-a)*i/19);}
const{profile}=await post('Profiler.stop');await writeFile(new URL('hand-runtime.cpuprofile',import.meta.url),JSON.stringify(profile));
const nodes=new Map(profile.nodes.map((n:any)=>[n.id,n])),times=new Map<string,any>();profile.samples.forEach((id:number,i:number)=>{const n:any=nodes.get(id),key=n.callFrame.functionName+' '+n.callFrame.url+':'+n.callFrame.lineNumber,row=times.get(key)??{function:n.callFrame.functionName,url:n.callFrame.url,line:n.callFrame.lineNumber,selfMicroseconds:0};row.selfMicroseconds+=profile.timeDeltas[i];times.set(key,row);});
const report={instrumentedDeformations:[...rows.values()],hotFunctions:[...times.values()].sort((a,b)=>b.selfMicroseconds-a.selfMicroseconds).slice(0,30),note:'CPU self samples of warmed offline animation, includes instrumentation overhead. Not browser FPS.'};await writeFile(new URL('hand-runtime-profile.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{proto.deform=original;session.disconnect();h.models.dispose();}
