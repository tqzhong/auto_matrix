import type { TestContext } from 'node:test';
import * as THREE from 'three';
import { actor } from './fighting-hand-fixture.mjs';
import { handSurface } from './hand-surface.mjs';
import { crossings } from './hand-self-contact.mjs';
import type { HeroRig } from '../../packages/client/src/agents/HeroModel.js';
import { newMotion, advanceMotion, type MotionInput } from '../../packages/client/src/agents/CharacterMotion.js';

export async function constructInspection(t?: TestContext) {
  const h=await actor('neo');t?.after(()=>h.models.dispose());
  const draw=(input:MotionInput)=>{const motion=newMotion();h.models.animate(h.rig,advanceMotion(motion,input,0),motion,input,0);h.rig.root.updateMatrixWorld(true);};
  return {...h,at(elapsed:number,firstPerson=false){draw({speed:0,grounded:true,verticalVelocity:0,turn:0,clubClothes:true,glasses:false,performance:'construct',firstPerson,construct:{role:'neo',phase:'image',elapsed}});},idle(){draw({speed:0,grounded:true,verticalVelocity:0,turn:0});}};
}

const palmarPatches=new WeakMap<HeroRig,Map<string,number[]>>();
const inspectionHands=new WeakMap<HeroRig,ReturnType<typeof handSurface>[]>();
function surfacesFor(rig:HeroRig){let hands=inspectionHands.get(rig);if(!hands)inspectionHands.set(rig,hands=['R','L'].map(side=>handSurface(rig,side)));return hands;}

export function inspectionPalm(rig:HeroRig,side:'R'|'L') {
  const skin=rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  const index=skin.skeleton.bones.indexOf(rig.bones.get(`wrist_${side}`)!),toWrist=skin.skeleton.boneInverses[index].clone().multiply(skin.bindMatrix),p=skin.geometry.attributes.position;
  const sign=side==='R'?1:-1;
  let patches=palmarPatches.get(rig);if(!patches)palmarPatches.set(rig,patches=new Map());
  let ids=patches.get(side);
  if(!ids){
  ids=[];const point=new THREE.Vector3(),normalMatrix=new THREE.Matrix3().getNormalMatrix(toWrist);
  for(const id of surfacesFor(rig)[side==='R'?0:1].vertices){
    point.fromBufferAttribute(p,id).applyMatrix4(toWrist);
    const normal=new THREE.Vector3().fromBufferAttribute(skin.geometry.attributes.normal,id).applyNormalMatrix(normalMatrix);
    if(sign*normal.x>.7&&point.y>-.22&&point.y<-.15&&Math.abs(point.z)<.04)ids.push(id);
  }
  if(!ids.length)throw new Error('The anatomical palmar patch is missing');
  patches.set(side,ids);
  }
  skin.skeleton.update();const world=ids.reduce((sum,id)=>sum.add(skin.localToWorld(skin.getVertexPosition(id,new THREE.Vector3()))),new THREE.Vector3()).divideScalar(ids.length);
  return {world,vertices:ids.length,normal:new THREE.Vector3(sign,0,0).transformDirection(rig.bones.get(`wrist_${side}`)!.matrixWorld)};
}

export function inspectionBodyCrossings(rig:HeroRig) {
  const surfaces=surfacesFor(rig),hands=new Set(surfaces.flatMap(s=>s.vertices)),failures:unknown[]=[];
  for(const [which,surface] of surfaces.entries()){
    const inverse=rig.bones.get(`wrist_${['R','L'][which]}`)!.matrixWorld.clone().invert(),draw=surface.draw(),box=new THREE.Box3().setFromPoints([...draw.points.values()]);
    for(const name of ['Anatomical_head_and_hands','Anatomical_wrist_skin','Tailored_coat_upper','Black_crew_neck','Close-cut_scalp_undercoat','Swept_individual_hair_strands']){
      const mesh=rig.root.getObjectByName(name) as THREE.SkinnedMesh;if(!mesh.visible)continue;mesh.skeleton.update();
      const p=mesh.geometry.attributes.position,index=mesh.geometry.index!,matrix=inverse.clone().multiply(mesh.matrixWorld),points=Array.from({length:p.count},(_,id)=>mesh.getVertexPosition(id,new THREE.Vector3()).applyMatrix4(matrix)),faces=[];
      for(let f=0;f<index.count;f+=3){const ids=[0,1,2].map(k=>index.getX(f+k));if(name==='Anatomical_head_and_hands'&&ids.some(id=>hands.has(id)))continue;
        const posed=ids.map(id=>points[id]),bounds=new THREE.Box3().setFromPoints(posed);if(box.intersectsBox(bounds))faces.push({face:f/3,ids,points:posed,box:bounds});}
      const result=crossings(draw.faces,faces,false);if(result.count)failures.push({side:['R','L'][which],name,...result});
    }
  }
  const right=surfaces[0].draw(),left=surfaces[1].draw(),matrix=rig.bones.get('wrist_R')!.matrixWorld.clone().invert().multiply(rig.bones.get('wrist_L')!.matrixWorld);
  const other=left.faces.map(face=>{const points=face.points.map(point=>point.clone().applyMatrix4(matrix));return {...face,points,box:new THREE.Box3().setFromPoints(points)};});
  const between=crossings(right.faces,other,false);if(between.count)failures.push({name:'opposite hand',...between});
  return failures;
}

export function inspectionContact(rig:HeroRig,side:'R'|'L') {
  const palm=inspectionPalm(rig,side),mesh=rig.root.getObjectByName(side==='R'?'Tailored_coat_upper':'Close-cut_scalp_undercoat') as THREE.SkinnedMesh;
  mesh.skeleton.update();mesh.computeBoundingSphere();
  const hits=new THREE.Raycaster(palm.world.clone().addScaledVector(palm.normal,-.3),palm.normal,0,.8).intersectObject(mesh,false);
  const hit=hits.find(hit=>[hit.face!.a,hit.face!.b,hit.face!.c].reduce((sum,id)=>sum+[0,1,2,3].reduce((value,k)=>{
    const bone=mesh.skeleton.bones[mesh.geometry.attributes.skinIndex.getComponent(id,k)].name,belongs=side==='L'?bone==='head':/_L(?:_|$)/.test(bone);
    return value+(belongs?mesh.geometry.attributes.skinWeight.getComponent(id,k):0);
  },0),0)>1.5);
  if(!hit)throw new Error(`The ${side} palmar patch faces away from its actual body contact`);
  return {gap:palm.world.distanceTo(hit.point),vertices:palm.vertices};
}
