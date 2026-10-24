import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { actor } from './candidate-release/tests/helpers/fighting-hand-fixture.mjs';
import { advanceMotion, newMotion } from './candidate-release/packages/client/src/agents/CharacterMotion.js';
const report: unknown[] = [];
for (const id of ['neo','morpheus'] as const) {
  const h=await actor(id), placement=new THREE.Group();placement.add(h.rig.root);
  for (let n=0;n<36;n++) {
    placement.position.set(6336+n*.11,1,4416-n*.23);placement.rotation.y=.63+n*.21;
    placement.scale.set(n%2 ? 1.1 : 1,n%2 ? .9 : 1,n%2 ? 1.05 : 1);
    const speed=n<12 ? 0 : n<24 ? 3.4 : 0, motion=Object.assign(newMotion(),{speed,phase:n/7});
    if(n>=24&&n<33)Object.assign(motion,{combo:Math.floor((n-24)/3),attackAge:(n%3)*.2});
    if(n>=33)Object.assign(motion,{skill:'dodge',skillAge:(n-33)*.2});
    const input={speed,grounded:true,verticalVelocity:0,turn:Math.sin(n)*.3,dojoOutfit:id,dojoSparring:true};
    h.models.animate(h.rig,advanceMotion(motion,input,0),motion,input,0);placement.updateMatrixWorld(true);
    const hash=createHash('sha256');let vertices=0,meshes=0; const transforms: unknown[] = [];
    h.rig.root.traverseVisible(object=>{
      if(!(object instanceof THREE.Mesh))return;meshes++;
      transforms.push([object.name,object.matrixWorld.elements.slice()]);
      for(const name of ['position','normal','skinWeight','skinIndex']){
        const a=object.geometry.getAttribute(name);if(!a||!('array' in a))continue;
        hash.update(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength));
        if(name==='position')vertices+=a.count;
      }
      if(object instanceof THREE.SkinnedMesh)transforms.push([object.name,object.bindMatrix.elements.slice(),object.bindMatrixInverse.elements.slice(),object.skeleton.bones.map(bone=>bone.matrixWorld.elements.slice())]);
    });
    report.push({id,pose:n,meshes,vertices,sha256:hash.digest('hex'),transforms});
  }
  h.models.dispose();
}
await writeFile(new URL(`./${process.argv[2]??'before'}-poses.json`,import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({poses:report.length}));
