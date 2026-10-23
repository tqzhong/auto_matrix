import type { TestContext } from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, truthRoot } from '@auto_matrix/shared';
import { actor } from './fighting-hand-fixture.mjs';
import { handSurface } from './hand-surface.mjs';
import { crossings } from './hand-self-contact.mjs';
import { inspectionPalm } from './construct-inspection.mjs';
import { advanceMotion, newMotion } from '../../packages/client/src/agents/CharacterMotion.js';

export async function truthGround(t?: TestContext) {
 const h=await actor('neo'),center=FILM_SETS.film_neb_deck.center,floor=center.y-1;
 const surfaces=['R','L'].map(side=>handSurface(h.rig,side));for(const side of ['R','L']as const)inspectionPalm(h.rig,side);
 const at=(elapsed:number,firstPerson=false,motion=newMotion(),delta=0)=>{
  const truth={phase:'unplug' as const,elapsed,role:'neo' as const},p=truthRoot(truth,'neo');
  h.rig.root.position.set(center.x+p.x,floor+p.y,center.z+p.z);h.rig.root.rotation.y=p.yaw;
  const input={speed:0,grounded:true,verticalVelocity:0,turn:0,realWorld:true,nebCrew:'neo' as const,nebCrewEarly:true,firstPerson,seated:p.seated>0,truth};
  h.models.animate(h.rig,advanceMotion(motion,input,delta),motion,input,delta);h.rig.root.updateMatrixWorld(true);
 };
 const hands=()=>surfaces.map((surface,i)=>{const side=['R','L'][i]as 'R'|'L',wrist=h.rig.bones.get(`wrist_${side}`)!,draw=surface.draw(),palm=inspectionPalm(h.rig,side);
  return {side,self:draw.self.count,palmGap:palm.world.y-floor,palmNormalY:palm.normal.y,minimum:Math.min(...[...draw.points.values()].map(p=>p.clone().applyMatrix4(wrist.matrixWorld).y-floor))};});
 const body=()=>{
  const failures:unknown[]=[],skin=surfaces[0].group.skin,handIds=new Set(surfaces.flatMap(s=>s.vertices)),visible:THREE.SkinnedMesh[]=[];
  h.rig.root.traverseVisible(o=>{if(o instanceof THREE.SkinnedMesh)visible.push(o);});
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
 const floorSurfaces=()=>{const result:{mesh:string;minimum:number}[]=[];h.rig.root.traverseVisible(o=>{if(!(o instanceof THREE.SkinnedMesh))return;o.skeleton.update();let minimum=Infinity;for(let id=0;id<o.geometry.attributes.position.count;id++)minimum=Math.min(minimum,o.getVertexPosition(id,new THREE.Vector3()).applyMatrix4(o.matrixWorld).y-floor);result.push({mesh:o.name,minimum});});return result;};
 const dispose=()=>h.models.dispose();t?.after(dispose);return {...h,at,hands,body,floorSurfaces,dispose};
}
