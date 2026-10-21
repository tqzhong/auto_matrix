import {writeFile}from'node:fs/promises';
import{model,faces,crossings}from'./baseline/output/characters/morpheus-upper-coat-2026-10-18/mesh-fixture.mjs';
import{advanceMotion,newMotion}from'./baseline/packages/client/src/agents/CharacterMotion.js';
const h=await model(),state=newMotion(),input={speed:8.4,grounded:true,verticalVelocity:0,turn:0,ambushWardrobe:'coat' as const};
for(let frame=0;frame<11;frame++)h.models.animate(h.rig,advanceMotion(state,input,1/60),state,input,1/60);h.rig.root.updateMatrixWorld(true);
const coat=h.rig.root.getObjectByName('morpheus-ambush-coat')as any,cloth=faces(coat),result={state,self:crossings(cloth,cloth,true)};await writeFile('baseline-early-fold.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));h.models.dispose();
