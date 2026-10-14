import { readFile,writeFile,mkdir } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
const label=process.argv[2]??'final';
const {CharacterModels}=await import(label==='before'?'./original/CharacterModel.mts':'../../../packages/client/src/agents/CharacterModel.js');
import { WorldState } from '../../../packages/server/src/world/WorldState.js';
import { AgentManager } from '../../../packages/server/src/agents/AgentManager.js';
import { FILM_SETS,SPOON_LESSON,spoonLessonBend } from '@auto_matrix/shared';
const assets=new Map();
for(const name of ['neo','neo-office','neo-tracking','oracle-park-hands','spoon_boy-head','spoon_boy-body']){
 const raw=await readFile(new URL(`../../../packages/client/public/assets/characters/${name}.glb`,import.meta.url));const size=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+size).toString());
 for(const m of doc.materials){delete m.pbrMetallicRoughness.baseColorTexture;delete m.normalTexture;}doc.images=[];doc.textures=[];
 const json=Buffer.from(JSON.stringify(doc)),padded=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(padded);const bin=raw.subarray(20+size),data=Buffer.alloc(20+padded.length+bin.length);
 data.writeUInt32LE(0x46546c67);data.writeUInt32LE(2,4);data.writeUInt32LE(data.length,8);data.writeUInt32LE(padded.length,12);data.writeUInt32LE(0x4e4f534a,16);padded.copy(data,20);bin.copy(data,20+padded.length);
 const asset=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
 if(name.endsWith('-head'))asset.scene.traverse(o=>{if(o instanceof THREE.Mesh){const t=new THREE.Texture();t.name='/assets/characters/spoon_boy-face-reference.png';(o.material as THREE.MeshStandardMaterial).map=t;}});assets.set(name,asset);
}
GLTFLoader.prototype.loadAsync=async url=>{const a=assets.get(String(url).split('/').pop()!.replace('.glb',''));if(!a)throw new Error(String(url));return {...a,scene:clone(a.scene)};};
THREE.TextureLoader.prototype.load=url=>{const t=new THREE.Texture();t.name=String(url);return t;};
globalThis.document={createElement:()=>({getContext:()=>({createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}})})} as unknown as Document;
const world=new WorldState();new AgentManager(world).initializeAllAgents();const models=new CharacterModels(),boy=models.create(world.agents.get('spoon_boy')!),neo=models.create(world.agents.get('neo')!);
for(const rig of [boy,neo])models.animate(rig,0,{speed:0,grounded:true,verticalVelocity:0,turn:0},4);await new Promise(resolve=>setImmediate(resolve));
const c=FILM_SETS.film_oracle_home.center;
for(const [rig,place]of [[boy,SPOON_LESSON.boy],[neo,SPOON_LESSON.neo]]as const){rig.root.position.set(c.x+place.x,c.y-1,c.z+place.z);rig.root.rotation.y=place.yaw;}
const draw=(elapsed:number)=>{
 const phase='demonstrating' as const;
 for(const [rig,role]of [[boy,'boy'],[neo,'neo']]as const){models.animate(rig,0,{speed:0,grounded:true,verticalVelocity:0,turn:0,seated:role==='boy',floorSeated:role==='boy',spoon:spoonLessonBend({phase,elapsed},role,0),spoonLesson:{phase,elapsed,role}},4);rig.root.updateMatrixWorld(true);}
};
try{
 const timings:any={};
 for(const [name,moving]of [['paused',false],['moving',true]]as const){
  const samples:number[]=[];
  for(let i=0;i<850;i++){const begin=performance.now();draw(moving?2.4+Math.sin(i/40)*.15:2.4);if(i>=100)samples.push(performance.now()-begin);}
  samples.sort((a,b)=>a-b);timings[name]={samples:samples.length,median:samples[375],p95:samples[Math.floor(samples.length*.95)]};
 }
 await writeFile(new URL(`./cpu-${label}.json`,import.meta.url),JSON.stringify(timings,null,2));console.log(JSON.stringify(timings));
}finally{models.dispose();}
