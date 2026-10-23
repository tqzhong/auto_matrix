import type { TestContext } from 'node:test';
import * as THREE from 'three';
import { actor, fingerGroups } from './fighting-hand-fixture.mjs';
import { handSurface } from './hand-surface.mjs';
import { crossings } from './hand-self-contact.mjs';
import { inspectionPalm } from './construct-inspection.mjs';
import { newMotion, advanceMotion } from '../../packages/client/src/agents/CharacterMotion.js';
import { createLoungeChair } from '../../packages/client/src/engine/LoungeChair.js';

function meshFaces(mesh:THREE.Mesh){
 if(mesh instanceof THREE.SkinnedMesh)mesh.skeleton.update();const p=mesh.geometry.attributes.position,index=mesh.geometry.index;
 const vertices=Array.from({length:p.count},(_,id)=>mesh.getVertexPosition(id,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld));
 return Array.from({length:(index?.count??p.count)/3},(_,face)=>{const ids=[0,1,2].map(k=>index?index.getX(face*3+k):face*3+k),points=ids.map(id=>vertices[id]);return {face,ids,points,box:new THREE.Box3().setFromPoints(points)};});
}

export async function desertGuide(t?: TestContext) {
 const h=await actor('morpheus'),chair=createLoungeChair(new THREE.MeshStandardMaterial());
 chair.rotation.y=Math.PI;chair.updateMatrixWorld(true);
 const surfaces=['R','L'].map(side=>handSurface(h.rig,side));for(const side of ['R','L'] as const)inspectionPalm(h.rig,side);
 const furniture:{face:number;ids:number[];points:THREE.Vector3[];box:THREE.Box3}[]=[];
 chair.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const p=o.geometry.attributes.position,index=o.geometry.index;
  for(let f=0;f<(index?.count??p.count);f+=3){const ids=[0,1,2].map(k=>index?index.getX(f+k):f+k),points=ids.map(id=>new THREE.Vector3().fromBufferAttribute(p,id).applyMatrix4(o.matrixWorld));furniture.push({face:f/3,ids,points,box:new THREE.Box3().setFromPoints(points)});}});
 const at=(elapsed:number,firstPerson=false,motion=newMotion(),delta=0)=>{
  h.rig.root.position.set(0,0,0);h.rig.root.rotation.y=Math.PI;
  const input={speed:0,grounded:true,verticalVelocity:0,turn:0,firstPerson,realWorld:false,performance:'desert' as const,reveal:{kind:'desert' as const,elapsed,role:'morpheus' as const,started:true}};
  h.models.animate(h.rig,advanceMotion(motion,input,delta),motion,input,delta);h.rig.root.updateMatrixWorld(true);
 };
 const hands=()=>surfaces.map((surface,i)=>{const draw=surface.draw(),wrist=h.rig.bones.get(`wrist_${['R','L'][i]}`)!,inverse=wrist.matrixWorld.clone().invert();
  const worldBox=new THREE.Box3().setFromPoints([...draw.points.values()].map(p=>p.clone().applyMatrix4(wrist.matrixWorld)));
  const faces=furniture.filter(f=>worldBox.intersectsBox(f.box)).map(f=>{const points=f.points.map(p=>p.clone().applyMatrix4(inverse));return {...f,points,box:new THREE.Box3().setFromPoints(points)};});
  const palm=inspectionPalm(h.rig,['R','L'][i] as 'R'|'L'),hit=new THREE.Raycaster(palm.world.clone().add(new THREE.Vector3(0,.3,0)),new THREE.Vector3(0,-1,0),0,3).intersectObject(chair,true)[0];
  return {side:['R','L'][i],self:draw.self.count,chair:crossings(draw.faces,faces,false).count,palmGap:hit?hit.distance-.3:Infinity,palmNormalY:palm.normal.y,palm:palm.world.toArray(),wrist:wrist.getWorldPosition(new THREE.Vector3()).toArray()};});
 const body=()=>{
  const failures:unknown[]=[],skin=surfaces[0].group.skin,handIds=new Set(surfaces.flatMap(s=>s.vertices));
  const visible:THREE.SkinnedMesh[]=[];h.rig.root.traverseVisible(o=>{if(o instanceof THREE.SkinnedMesh)visible.push(o);});
  for(const [which,surface]of surfaces.entries()){
   const inverse=h.rig.bones.get(`wrist_${['R','L'][which]}`)!.matrixWorld.clone().invert(),draw=surface.draw(),bounds=new THREE.Box3().setFromPoints([...draw.points.values()]);
   for(const mesh of visible){mesh.skeleton.update();const p=mesh.geometry.attributes.position,index=mesh.geometry.index!,matrix=inverse.clone().multiply(mesh.matrixWorld),points=Array.from({length:p.count},(_,id)=>mesh.getVertexPosition(id,new THREE.Vector3()).applyMatrix4(matrix)),faces=[];
    for(let f=0;f<index.count;f+=3){const ids=[0,1,2].map(k=>index.getX(f+k));if(mesh===skin&&ids.some(id=>handIds.has(id)))continue;const posed=ids.map(id=>points[id]),box=new THREE.Box3().setFromPoints(posed);if(bounds.intersectsBox(box))faces.push({face:f/3,ids,points:posed,box});}
    const result=crossings(draw.faces,faces,false);if(result.count)failures.push({side:['R','L'][which],mesh:mesh.name,...result});
   }
  }
  const right=surfaces[0].draw(),left=surfaces[1].draw(),matrix=h.rig.bones.get('wrist_R')!.matrixWorld.clone().invert().multiply(h.rig.bones.get('wrist_L')!.matrixWorld);
  const other=left.faces.map(face=>{const points=face.points.map(point=>point.clone().applyMatrix4(matrix));return {...face,points,box:new THREE.Box3().setFromPoints(points)};});const result=crossings(right.faces,other,false);if(result.count)failures.push({mesh:'opposite hand',...result});return failures;
 };
 const feet=()=>{
  const parts=['shoes01','Tailored_trousers'].map(name=>{const mesh=h.rig.root.getObjectByName(name)as THREE.SkinnedMesh;mesh.skeleton.update();const a=mesh.geometry.attributes,index=mesh.geometry.index!,points=Array.from({length:a.position.count},(_,id)=>mesh.localToWorld(mesh.getVertexPosition(id,new THREE.Vector3())));
   const sides=['R','L'].map(side=>new Set(points.flatMap((_,id)=>{let weight=0;for(let k=0;k<4;k++)if(new RegExp(`_${side}(?:_|$)`).test(mesh.skeleton.bones[a.skinIndex.getComponent(id,k)].name))weight+=a.skinWeight.getComponent(id,k);return weight>.5?[id]:[];})));
   const faces=sides.map(ids=>{const result=[];for(let f=0;f<index.count;f+=3){const triangle=[0,1,2].map(k=>index.getX(f+k));if(triangle.every(id=>ids.has(id))){const posed=triangle.map(id=>points[id]);result.push({face:f/3,ids:triangle,points:posed,box:new THREE.Box3().setFromPoints(posed)});}}return result;});
   return {points,sides,faces};});
  const [shoe,trousers]=parts;
  const mesh=h.rig.root.getObjectByName('Tailored_trousers')as THREE.SkinnedMesh,a=mesh.geometry.attributes,calf:number[]=[];
  for(const [id,p]of trousers.points.entries()){const local=h.rig.root.worldToLocal(p.clone());let weight=0;for(let k=0;k<4;k++)if(['knee_R','ankle_R'].includes(mesh.skeleton.bones[a.skinIndex.getComponent(id,k)].name))weight+=a.skinWeight.getComponent(id,k);if(weight>.8&&local.x>0&&local.x<.65&&local.y>1.2&&local.y<2.3&&local.z>.5&&local.z<1.3)calf.push(id);}
  let supportGap=Infinity;const closest=new THREE.Vector3(),triangle=new THREE.Triangle();
  for(const face of trousers.faces[1]){triangle.set(face.points[0],face.points[1],face.points[2]);for(const id of calf){triangle.closestPointToPoint(trousers.points[id],closest);supportGap=Math.min(supportGap,closest.distanceTo(trousers.points[id]));}}
  const chairContacts=parts.flatMap((part,index)=>part.faces.map((faces,side)=>{const box=faces.reduce((box,face)=>box.union(face.box),new THREE.Box3());return {mesh:['shoes01','Tailored_trousers'][index],side:['R','L'][side],...crossings(faces,furniture.filter(face=>box.intersectsBox(face.box)),false)};}));
  return {leftSole:Math.min(...[...shoe.sides[1]].map(id=>shoe.points[id].y)),supportGap,sampledCalfVertices:calf.length,chairContacts,boots:crossings(shoe.faces[0],shoe.faces[1],false),rightBootLeftLeg:crossings(shoe.faces[0],trousers.faces[1],false),leftBootRightLeg:crossings(shoe.faces[1],trousers.faces[0],false),legs:crossings(trousers.faces[0],trousers.faces[1])};
 };
 const remote=()=>{const prop=h.rig.root.getObjectByName('construct-held-remote')!,g=fingerGroups(h.rig,'R');g.skin.skeleton.update();prop.updateWorldMatrix(true,true);
  const casing=prop.children[0]as THREE.Mesh;casing.geometry.computeBoundingBox();const box=casing.geometry.boundingBox!,matrix=casing.matrixWorld.clone().invert().multiply(g.skin.matrixWorld),point=(id:number)=>g.skin.getVertexPosition(id,new THREE.Vector3()).applyMatrix4(matrix);
  const draw=surfaces[0].draw(),inverse=h.rig.bones.get('wrist_R')!.matrixWorld.clone().invert(),faces:{face:number;ids:number[];points:THREE.Vector3[];box:THREE.Box3}[]=[];
  prop.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const p=o.geometry.attributes.position,index=o.geometry.index!,toWrist=inverse.clone().multiply(o.matrixWorld);for(let f=0;f<index.count;f+=3){const ids=[0,1,2].map(k=>index.getX(f+k)),points=ids.map(id=>new THREE.Vector3().fromBufferAttribute(p,id).applyMatrix4(toWrist));faces.push({face:f/3,ids,points,box:new THREE.Box3().setFromPoints(points)});}});
  return {inside:g.hand.filter(id=>{const p=point(id);return p.x>box.min.x+.003&&p.x<box.max.x-.003&&p.y>box.min.y+.003&&p.y<box.max.y-.003&&p.z>box.min.z+.003&&p.z<box.max.z-.003;}).length,self:draw.self.count,propCrossings:crossings(draw.faces,faces,false).count,tipGaps:g.tips.map(ids=>Math.min(...ids.map(id=>box.distanceToPoint(point(id)))))};
 };
 const sleeves=()=>{
  const coat=h.rig.root.getObjectByName('Tailored_coat_upper')as THREE.SkinnedMesh,all=meshFaces(coat),inner=meshFaces(h.rig.root.getObjectByName('Black_crew_neck')as THREE.SkinnedMesh),a=coat.geometry.attributes;
  return ['R','L'].map(side=>{const ids=new Set<number>();for(let id=0;id<a.position.count;id++){let weight=0;for(let k=0;k<4;k++)if(new RegExp(`^(shoulder|elbow|wrist)_${side}(?:_|$)`).test(coat.skeleton.bones[a.skinIndex.getComponent(id,k)].name))weight+=a.skinWeight.getComponent(id,k);if(weight>.5)ids.add(id);}
   const arm=all.filter(face=>face.ids.some(id=>ids.has(id))),box=arm.reduce((box,face)=>box.union(face.box),new THREE.Box3());return {side,armFaces:arm.length,self:crossings(arm,all).count,shirt:crossings(arm,inner,false).count,chair:crossings(arm,furniture.filter(face=>box.intersectsBox(face.box)),false).count};});
 };
 const remoteBody=()=>{
  const prop=h.rig.root.getObjectByName('construct-held-remote')!,surfaces:ReturnType<typeof meshFaces>=[];prop.traverse(o=>{if(o instanceof THREE.Mesh)surfaces.push(...meshFaces(o));});
  const box=surfaces.reduce((box,face)=>box.union(face.box),new THREE.Box3()),contacts:{mesh:string;count:number}[]=[];
  h.rig.root.traverseVisible(o=>{if(o instanceof THREE.SkinnedMesh){const result=crossings(surfaces,meshFaces(o).filter(face=>box.intersectsBox(face.box)),false);if(result.count)contacts.push({mesh:o.name,count:result.count});}});
  const result=crossings(surfaces,furniture.filter(face=>box.intersectsBox(face.box)),false);if(result.count)contacts.push({mesh:'chair',count:result.count});return contacts;
 };
 const dispose=()=>{h.models.dispose();const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();chair.traverse(o=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);materials.add(o.material);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());};t?.after(dispose);
 return {...h,at,hands,body,feet,remote,sleeves,remoteBody,chair,dispose};
}
