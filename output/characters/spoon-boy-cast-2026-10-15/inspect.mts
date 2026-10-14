import { readFile,writeFile,mkdir } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { CharacterModels } from '../../../packages/client/src/agents/CharacterModel.js';
import { WorldState } from '../../../packages/server/src/world/WorldState.js';
import { AgentManager } from '../../../packages/server/src/agents/AgentManager.js';
import { FILM_SETS,SPOON_LESSON,spoonLessonBend } from '@auto_matrix/shared';
const out=new URL('./poses/',import.meta.url);await mkdir(out,{recursive:true});const assets=new Map();
for(const name of ['oracle-park-hands','spoon_boy-head','spoon_boy-body']){
 const raw=await readFile(new URL(`../../../packages/client/public/assets/characters/${name}.glb`,import.meta.url));const size=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+size).toString());
 for(const m of doc.materials)delete m.pbrMetallicRoughness.baseColorTexture;doc.images=[];doc.textures=[];
 const json=Buffer.from(JSON.stringify(doc)),padded=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(padded);const bin=raw.subarray(20+size),data=Buffer.alloc(20+padded.length+bin.length);
 data.writeUInt32LE(0x46546c67);data.writeUInt32LE(2,4);data.writeUInt32LE(data.length,8);data.writeUInt32LE(padded.length,12);data.writeUInt32LE(0x4e4f534a,16);padded.copy(data,20);bin.copy(data,20+padded.length);
 const asset=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
 if(name.endsWith('-head'))asset.scene.traverse(o=>{if(o instanceof THREE.Mesh){const t=new THREE.Texture();t.name='/assets/characters/spoon_boy-face-reference.png';(o.material as THREE.MeshStandardMaterial).map=t;}});assets.set(name,asset);
}
GLTFLoader.prototype.loadAsync=async url=>{const a=assets.get(String(url).split('/').pop()!.replace('.glb',''));if(!a)throw new Error(String(url));return {...a,scene:clone(a.scene)};};
THREE.TextureLoader.prototype.load=url=>{const t=new THREE.Texture();t.name=String(url);return t;};
globalThis.document={createElement:()=>({getContext:()=>({createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}})})} as unknown as Document;
const world=new WorldState();new AgentManager(world).initializeAllAgents();const models=new CharacterModels(),boy=models.create(world.agents.get('spoon_boy')!);
models.animate(boy,0,{speed:0,grounded:true,verticalVelocity:0,turn:0},4);await new Promise(resolve=>setImmediate(resolve));
const c=FILM_SETS.film_oracle_home.center;boy.root.position.set(c.x+SPOON_LESSON.boy.x,c.y-1,c.z+SPOON_LESSON.boy.z);boy.root.rotation.y=SPOON_LESSON.boy.yaw;
try{
 for(const [phase,elapsed]of [['demonstrating',.8],['offered',0],['receiving',1.42],['focus',0]]as const){
  models.animate(boy,0,{speed:0,grounded:true,verticalVelocity:0,turn:0,seated:true,floorSeated:true,spoon:spoonLessonBend({phase,elapsed},'boy',0),spoonLesson:{phase,elapsed,role:'boy'}},4);boy.root.updateMatrixWorld(true);
  const surfaces:any[]=[];const inverse=boy.root.matrixWorld.clone().invert();
  boy.detail.traverseVisible(o=>{if(!(o instanceof THREE.Mesh))return;const p=o.geometry.attributes.position,uv=o.geometry.attributes.uv,index=o.geometry.index,material=(Array.isArray(o.material)?o.material[0]:o.material)as THREE.MeshStandardMaterial;
   if(o instanceof THREE.SkinnedMesh)o.skeleton.update();const map=material.map;map?.updateMatrix();
   const vertices=Array.from({length:p.count},(_,i)=>o.localToWorld(o.getVertexPosition(i,new THREE.Vector3())).applyMatrix4(inverse).toArray());
   const texcoords=Array.from({length:p.count},(_,i)=>uv?new THREE.Vector2(uv.getX(i),uv.getY(i)).applyMatrix3(map?.matrix??new THREE.Matrix3()).toArray():[0,0]);
   const head=o.name==='spoon_boy-anatomical-head';
   surfaces.push({name:o.name,vertices,texcoords,indices:Array.from({length:index?.count??p.count},(_,i)=>index?index.getX(i):i),color:material.color?.toArray()??[.7,.7,.7],texture:map?.name.includes('face-reference')?'spoon_boy-face-reference.png':null,
    head:head?assets.get('spoon_boy-head').parser.json.extras:null,rest:head?Array.from({length:p.count},(_,i)=>new THREE.Vector3().fromBufferAttribute(p,i).toArray()):null,
    normal:head?Array.from({length:p.count},(_,i)=>new THREE.Vector3().fromBufferAttribute(o.geometry.attributes.normal,i).toArray()):null,
    profile:head?Array.from({length:p.count},(_,i)=>[o.geometry.attributes.uv1.getX(i),o.geometry.attributes.uv1.getY(i)]):null,
    faceWeight:head?Array.from(o.geometry.attributes._face_weight.array):null});
  });
  await writeFile(new URL(`${phase}-${elapsed}.json`,out),JSON.stringify({phase,elapsed,surfaces}));
  console.log(phase,elapsed,surfaces.map(s=>[s.name,s.indices.length/3,Math.min(...s.vertices.map((v:number[])=>v[1]))]));
 }
}finally{models.dispose();}
