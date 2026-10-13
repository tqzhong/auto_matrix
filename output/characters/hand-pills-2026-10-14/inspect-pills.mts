import { readFile, mkdir, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HeroModels, type HeroRig } from '../../../packages/client/src/agents/HeroModel.js';
import { advanceMotion, newMotion } from '../../../packages/client/src/agents/CharacterMotion.js';
import { FILM_SETS, PILL_ROOM, pillRoot, type PillGesture } from '@auto_matrix/shared';
async function loadGeometry(id: string) {
  const glb = await readFile(new URL(`../../../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
  const length = glb.readUInt32LE(12), document = JSON.parse(glb.subarray(20, 20 + length).toString());
  for (const material of document.materials) {
    delete material.pbrMetallicRoughness.baseColorTexture;
    delete material.normalTexture;
  }
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = glb.subarray(20 + length), result = Buffer.alloc(20 + padded.length + bin.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16);
  padded.copy(result, 20); bin.copy(result, 20 + padded.length);
  return new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
}
const out=process.argv[2]; if(!out)throw new Error('Specify output directory'); await mkdir(out,{recursive:true});
for(const id of ['neo','morpheus'] as const) {
 const {scene}=await loadGeometry(id), bones=new Map<string,THREE.Bone>(),rest=new Map<string,THREE.Vector3>();
 scene.traverse(object=>{if(object instanceof THREE.Bone){bones.set(object.name,object);rest.set(object.name,object.position.clone());}}); scene.updateMatrixWorld(true);
 const models=new HeroModels(new THREE.Texture(),new THREE.Texture());
 const rig:HeroRig={root:scene,bones,rest,panels:[],footHeight:bones.get('ankle_L')!.getWorldPosition(new THREE.Vector3()).y,glasses:new THREE.Group(),silver:{value:0},wardrobe:[]};
 const skin=scene.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
 const {position,skinIndex,skinWeight}=skin.geometry.attributes;
 for(const choice of ['red','blue'] as const) for(const elapsed of (id==='neo'?[1.8,3.4,7.3]:[1.799])) {
  const gesture:PillGesture={phase:'taking',elapsed,choice,role:id};
  const center=FILM_SETS.film_lafayette.center, root=id==='neo'?pillRoot({...gesture,approach:{x:0,z:-4,yaw:Math.PI}}):{x:-PILL_ROOM.seat,z:PILL_ROOM.z,yaw:Math.PI/2};
  scene.position.set(center.x+root.x,center.y-1,center.z+root.z);scene.rotation.y=root.yaw;
  const motion=newMotion(),input={speed:0,grounded:true,verticalVelocity:0,turn:0,pills:gesture};
  models.animate(rig,advanceMotion(motion,input,0),motion,input,0);scene.updateMatrixWorld(true);skin.skeleton.update();
  const side=elapsed===7.3?'R':id==='neo'?(choice==='red'?'L':'R'):(choice==='red'?'R':'L');
  const wrist=bones.get('wrist_'+side)!,inverse=wrist.matrixWorld.clone().invert(),vertices:number[][]=[],indices:number[]=[],labels:string[]=[],lookup=new Map<number,number>();
  const pads=Array.from({length:5},()=>new THREE.Vector3()),counts=[0,0,0,0,0];
  for(let i=0;i<position.count;i++) {
   let hand=0,label='',best=0;
   for(let j=0;j<4;j++){const name=skin.skeleton.bones[skinIndex.getComponent(i,j)].name,w=skinWeight.getComponent(i,j); if(new RegExp('^(wrist|finger).*_'+side+'$').test(name))hand+=w;if(w>best){best=w;label=name;}}
   if(hand<.5)continue;
   const point=skin.localToWorld(skin.getVertexPosition(i,new THREE.Vector3())).applyMatrix4(inverse);lookup.set(i,vertices.length);vertices.push(point.toArray());labels.push(label);
   for(let j=0;j<4;j++){const match=new RegExp('^finger([1-5])-3_'+side+'$').exec(skin.skeleton.bones[skinIndex.getComponent(i,j)].name);if(match&&skinWeight.getComponent(i,j)>.95){pads[Number(match[1])-1].add(point);counts[Number(match[1])-1]++;}}
  }
  const source=skin.geometry.index!;for(let i=0;i<source.count;i+=3){const tri=[source.getX(i),source.getX(i+1),source.getX(i+2)];if(tri.every(v=>lookup.has(v)))indices.push(...tri.map(v=>lookup.get(v)!));}
  const object=scene.getObjectByName(elapsed===7.3?'pill-water-glass':`held-${choice}-pill`)!,prop:{vertices:number[][];indices:number[]}={vertices:[],indices:[]};
  object.traverseVisible(child=>{if(!(child instanceof THREE.Mesh))return; const start=prop.vertices.length,p=child.geometry.attributes.position,idx=child.geometry.index;for(let i=0;i<p.count;i++)prop.vertices.push(child.localToWorld(new THREE.Vector3().fromBufferAttribute(p,i)).applyMatrix4(inverse).toArray());for(let i=0;i<(idx?.count??p.count);i++)prop.indices.push(start+(idx?idx.getX(i):i));});
  const joints=Object.fromEntries([...bones].filter(([name])=>new RegExp('^(finger|wrist).*_'+side+'$').test(name)).map(([name,bone])=>[name,bone.getWorldPosition(new THREE.Vector3()).applyMatrix4(inverse).toArray()]));
  const report=pads.map((pad,i)=>({finger:i+1,center:pad.divideScalar(counts[i]).toArray()}));
  await writeFile(`${out}/${id}-${choice}-${elapsed}.json`,JSON.stringify({vertices,indices,labels,prop,joints,pads:report,propMatrix:object.matrix.toArray(),side}));console.log(id,choice,elapsed,JSON.stringify(report));
 }
 models.dispose();
}
