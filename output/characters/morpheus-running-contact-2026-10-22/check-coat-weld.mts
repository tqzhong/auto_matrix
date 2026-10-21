import{writeFile}from'node:fs/promises';
import{model}from'./release/output/characters/morpheus-upper-coat-2026-10-18/mesh-fixture.mjs';
import{advanceMotion,newMotion}from'./release/packages/client/src/agents/CharacterMotion.js';
const h=await model(),coat=h.rig.root.getObjectByName('morpheus-ambush-coat')as any,a=coat.geometry.attributes,groups=new Map<string,number[]>();
for(let id=0;id<a.position.count;id++){
 const key=[a.position.getX(id),a.position.getY(id),a.position.getZ(id),...coat.geometry.morphAttributes.position.flatMap((p:any)=>[p.getX(id),p.getY(id),p.getZ(id)]),...[0,1,2,3].map(k=>a.skinIndex.getComponent(id,k)),...[0,1,2,3].map(k=>a.skinWeight.getComponent(id,k))].join(',');let group=groups.get(key);if(!group)groups.set(key,group=[]);group.push(id);
}
const duplicates=[...groups.values()].filter(ids=>ids.length>1),state=newMotion(),input={speed:8.4,grounded:true,verticalVelocity:0,turn:0,ambushWardrobe:'coat' as const};let maximum=0,example:any;
for(let frame=0;frame<120;frame++){
 h.models.animate(h.rig,advanceMotion(state,input,1/60),state,input,1/60);
 for(const ids of duplicates)for(const id of ids.slice(1)){
  const gap=Math.hypot(...[0,1,2].map(axis=>a.position.getComponent(id,axis)-a.position.getComponent(ids[0],axis)));
  if(gap>maximum){maximum=gap;example={frame,ids:[ids[0],id],gap};}
 }
}
const result={duplicateGroups:duplicates.length,maximum,example};await writeFile('running-weld-check.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));h.models.dispose();
