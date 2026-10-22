import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { HeroModels, type HeroId, type HeroRig } from '../../packages/client/src/agents/HeroModel.js';
import { newMotion, advanceMotion } from '../../packages/client/src/agents/CharacterMotion.js';

export async function actor(id: HeroId, prepare?: (scene: THREE.Group) => void) {
  const models = new HeroModels(new THREE.Texture(),new THREE.Texture());
  const assets = new Map<string, Promise<GLTF>>();
  (models as any).load = (name: string) => {
    const cached = assets.get(name); if (cached) return cached;
    const loading = (async () => {
    const raw = await readFile(new URL(`../../packages/client/public/assets/characters/${name}.glb`,import.meta.url)), length = raw.readUInt32LE(12);
    const document = JSON.parse(raw.subarray(20,20+length).toString());
    for (const material of document.materials) {delete material.pbrMetallicRoughness.baseColorTexture;delete material.normalTexture;}
    document.images=[];document.textures=[];
    const json=Buffer.from(JSON.stringify(document)),padded=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(padded);
    const bin=raw.subarray(20+length),bytes=Buffer.alloc(20+padded.length+bin.length);
    bytes.writeUInt32LE(0x46546c67);bytes.writeUInt32LE(2,4);bytes.writeUInt32LE(bytes.length,8);bytes.writeUInt32LE(padded.length,12);bytes.writeUInt32LE(0x4e4f534a,16);padded.copy(bytes,20);bin.copy(bytes,20+padded.length);
      const asset=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');prepare?.(asset.scene);return asset;
    })();
    assets.set(name, loading); return loading;
  };
  const rig=(await models.create(id))!,state=newMotion(),input={speed:0,grounded:true,verticalVelocity:0,turn:0};
  return {models,rig,draw(grip:number){const pose=advanceMotion(state,input,0);pose.arms.forEach(arm=>{arm.grip=grip;});models.animate(rig,pose,state,input,0);rig.root.updateMatrixWorld(true);}};
}

export function fingerGroups(rig:HeroRig,side:string){
  const skin=rig.root.getObjectByName('Anatomical_head_and_hands')as THREE.SkinnedMesh,a=skin.geometry.attributes;
  const tips=Array.from({length:5},()=>[]as number[]),digits=new Int8Array(a.position.count).fill(-1),hand:number[]=[];
  for(let id=0;id<a.position.count;id++){
    const weights=[0,0,0,0,0,0];
    for(let k=0;k<4;k++){
      const name=skin.skeleton.bones[a.skinIndex.getComponent(id,k)].name,match=new RegExp(`^finger([1-5])-([1-3])_${side}$`).exec(name),weight=a.skinWeight.getComponent(id,k);
      if(name===`wrist_${side}`)weights[0]+=weight;
      if(match){weights[Number(match[1])]+=weight;if(match[2]==='3'&&weight>.95)tips[Number(match[1])-1].push(id);}
    }
    if(weights.reduce((sum,w)=>sum+w,0)>.5){hand.push(id);digits[id]=weights.indexOf(Math.max(...weights));}
  }
  return{skin,tips,digits,hand};
}

export function bends(rig:HeroRig,side:string,groups:ReturnType<typeof fingerGroups>){
  const {skin,tips}=groups;skin.skeleton.update();
  const inverse=rig.bones.get(`wrist_${side}`)!.matrixWorld.clone().invert().multiply(skin.matrixWorld);
  return Array.from({length:5},(_,index)=>{
    const points=[1,2,3].map(j=>rig.bones.get(`finger${index+1}-${j}_${side}`)!.getWorldPosition(new THREE.Vector3()).applyMatrix4(rig.bones.get(`wrist_${side}`)!.matrixWorld.clone().invert()));
    const pad=tips[index].reduce((sum,id)=>sum.add(skin.getVertexPosition(id,new THREE.Vector3()).applyMatrix4(inverse)),new THREE.Vector3()).divideScalar(tips[index].length);points.push(pad);
    const directions=[0,1,2].map(i=>points[i+1].clone().sub(points[i]).normalize());
    return{digit:index+1,points:points.map(p=>p.toArray()),PIP:THREE.MathUtils.radToDeg(directions[0].angleTo(directions[1])),DIP:THREE.MathUtils.radToDeg(directions[1].angleTo(directions[2])),curvature:new THREE.Vector3().crossVectors(directions[0],directions[1]).dot(new THREE.Vector3().crossVectors(directions[1],directions[2]))};
  });
}
