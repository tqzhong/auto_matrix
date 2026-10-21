import{writeFile}from'node:fs/promises';
const units=[{name:'before',fixture:await import('./baseline/output/characters/morpheus-upper-coat-2026-10-18/mesh-fixture.mjs'),motion:await import('./baseline/packages/client/src/agents/CharacterMotion.js')},{name:'after',fixture:await import('./release/output/characters/morpheus-upper-coat-2026-10-18/mesh-fixture.mjs'),motion:await import('./release/packages/client/src/agents/CharacterMotion.js')}];
const actors=await Promise.all(units.map(async unit=>({...unit,h:await unit.fixture.model(),state:unit.motion.newMotion(),values:[] as number[]})));
const input={speed:8.4,grounded:true,verticalVelocity:0,turn:0,ambushWardrobe:'coat' as const};
for(let frame=0;frame<120;frame++)for(const actor of frame%2?actors.slice().reverse():actors){
 const start=process.cpuUsage();actor.h.models.animate(actor.h.rig,actor.motion.advanceMotion(actor.state,input,1/60),actor.state,input,1/60);const cpu=process.cpuUsage(start);
 if(frame>=30)actor.values.push((cpu.user+cpu.system)/1000);
}
const result=actors.map(actor=>{actor.values.sort((a,b)=>a-b);const fitter=(actor.h.models as any).ambushWardrobes.get(actor.h.rig).hipClearance;return{name:actor.name,samples:actor.values.length,median:actor.values[Math.floor(actor.values.length/2)],p95:actor.values[Math.floor(actor.values.length*.95)],fitter:fitter?{vertices:fitter.vertices.length,attachments:fitter.attachments.length,normalVertices:fitter.normalVertices.length}:null};});
await writeFile('running-cpu-comparison.json',JSON.stringify({scope:'paired synchronous model animation CPU in one Node process; not browser FPS; concurrent validation load',result},null,2));console.log(JSON.stringify(result,null,2));for(const actor of actors)actor.h.models.dispose();
