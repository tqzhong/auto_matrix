import {readFile,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {FILM_SETS,PILL_ROOM,pillRoot,SPOON_LESSON,newOracleAbsorption,oracleAbsorptionRoot} from '@auto_matrix/shared';
import {CharacterModels} from '../../../packages/client/src/agents/CharacterModel.js';
import {contactOracleAbsorption} from '../../../packages/client/src/agents/OracleAbsorptionPerformance.js';
import {WorldState} from '../../../packages/server/src/world/WorldState.js';
import {AgentManager} from '../../../packages/server/src/agents/AgentManager.js';
const previousLoad=GLTFLoader.prototype.loadAsync,previousTexture=THREE.TextureLoader.prototype.load,previousDocument=globalThis.document;
const assets=new Map();
for(const id of ['neo','neo-office','neo-tracking','trinity','trinity-club','smith','morpheus']){
 const bytes=await readFile(new URL(`../../../packages/client/public/assets/characters/${id}.glb`,import.meta.url)),size=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+size).toString());
 for(const m of doc.materials){delete m.pbrMetallicRoughness.baseColorTexture;delete m.normalTexture;}doc.images=[];doc.textures=[];
 const json=Buffer.from(JSON.stringify(doc)),pad=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(pad);const binary=bytes.subarray(20+size),out=Buffer.alloc(20+pad.length+binary.length);
 out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(pad.length,12);out.writeUInt32LE(0x4e4f534a,16);pad.copy(out,20);binary.copy(out,20+pad.length);
 assets.set(id,await new GLTFLoader().parseAsync(out.buffer.slice(out.byteOffset,out.byteOffset+out.byteLength),''));
}
GLTFLoader.prototype.loadAsync=async url=>{const asset=assets.get(String(url).split('/').at(-1)!.replace('.glb',''));return asset?{...asset,scene:clone(asset.scene)}:new Promise(()=>{});};
THREE.TextureLoader.prototype.load=()=>new THREE.Texture();
globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},strokeRect(){},fillText(){},createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){},createRadialGradient:()=>({addColorStop(){}})})})} as unknown as Document;
const world=new WorldState();new AgentManager(world).initializeAllAgents();const models=new CharacterModels(),rigs=new Map(['neo','trinity','smith','morpheus','oracle'].map(id=>[id,models.create(world.agents.get(id)!)]));await new Promise(resolve=>setImmediate(resolve));
const idle={speed:0,grounded:true,verticalVelocity:0,turn:0},results=[];
const times=(end:number)=>Array.from({length:Math.round(end/.01)+1},(_,i)=>i/100);
function trace(name:string,id:string,frames:any[],pose:(rig:any,input:any)=>void=()=>{}){
 const rig=rigs.get(id)!,jumps=[],angles=[],old=new Map<string,{wrist:THREE.Quaternion;helper:THREE.Quaternion[];angle:number;raw:number;input:any}>();let wristMaximum=0,helperMaximum=0;
 for(const frame of frames){pose(rig,frame);models.animate(rig,0,{...idle,...frame},0);rig.root.updateWorldMatrix(true,true);
  if(frame.oracleAbsorption){const oracle=rigs.get('oracle')!,state=frame.oracleAbsorption;pose(oracle,{oracleAbsorption:{...state,role:'oracle'}});models.animate(oracle,0,{...idle,oracleAbsorption:{...state,role:'oracle'}},0);oracle.root.updateWorldMatrix(true,true);contactOracleAbsorption(oracle,rig,{...state,role:'oracle'});rig.root.updateWorldMatrix(true,true);}
  for(const side of ['R','L']){const w=rig.hero!.bones.get(`wrist_${side}`)!,q=w.quaternion,axis=w.position.clone().normalize(),projection=new THREE.Vector3(q.x,q.y,q.z).dot(axis),raw=2*Math.atan2(projection,q.w);let angle=raw;if(angle>Math.PI)angle-=Math.PI*2;if(angle<-Math.PI)angle+=Math.PI*2;
   const now={wrist:w.getWorldQuaternion(new THREE.Quaternion()),helper:[1,2,3].map(n=>rig.hero!.bones.get(`forearm_twist_${side}_${n}`)!.getWorldQuaternion(new THREE.Quaternion())),angle,raw,input:frame};const before=old.get(side);
   if(before){const wrist=now.wrist.angleTo(before.wrist),helper=Math.max(...now.helper.map((h,i)=>h.angleTo(before.helper[i])));wristMaximum=Math.max(wristMaximum,wrist);helperMaximum=Math.max(helperMaximum,helper);if(helper>.25&&wrist<.1)jumps.push({side,wristDelta:wrist,helperDelta:helper,angleBefore:before.angle,angleAfter:angle,rawBefore:before.raw,rawAfter:raw,before:before.input,after:frame,q:q.toArray()});}
   angles.push({side,raw,angle});old.set(side,now);
  }
 }
 results.push({name,id,frames:frames.length,wristMaximum,helperMaximum,jumps,trace:angles,minimumAngle:Math.min(...angles.map(a=>a.angle)),maximumAngle:Math.max(...angles.map(a=>a.angle))});
}
try{
 trace('office-phone-pickup','neo',times(2.2).map(elapsed=>({officeShirt:true,phone:{phase:'pickup',elapsed}})));
 trace('office-phone-answer','neo',times(1.8).map(elapsed=>({officeShirt:true,phone:{phase:'answering',elapsed}})));
 for(const choice of ['red','blue'])trace(`taking-${choice}`,'neo',times(9.3).map(elapsed=>({pills:{phase:'taking',elapsed,choice,role:'neo'}})),(rig,input)=>{const root=pillRoot({...input.pills,approach:{x:1.75,z:-6,yaw:-Math.PI/2}}),c=FILM_SETS.film_lafayette.center;rig.root.position.set(c.x+root.x,c.y-1,c.z+root.z);rig.root.rotation.y=root.yaw;});
 trace('morpheus-offer','morpheus',times(4).map(elapsed=>({pills:{phase:'offering',elapsed,role:'morpheus'}})),rig=>{const c=FILM_SETS.film_lafayette.center;rig.root.position.set(c.x-PILL_ROOM.seat,c.y-1,c.z+PILL_ROOM.z);rig.root.rotation.y=Math.PI/2;});
 for(const id of ['neo','trinity','smith','morpheus'])trace('pistol-aim',id,times(1.1).map(t=>({armed:true,weaponStyle:'hel_pistol',aimPitch:t-.55})));
 trace('spoon-receiving','neo',times(2.4).map(elapsed=>({spoon:0,spoonLesson:{phase:'receiving',elapsed,role:'neo'}})),rig=>{const c=FILM_SETS.film_oracle_home.center;rig.root.position.set(c.x+SPOON_LESSON.neo.x,c.y-1,c.z+SPOON_LESSON.neo.z);rig.root.rotation.y=SPOON_LESSON.neo.yaw;});
 for(const phase of ['contact','coating'])trace(`oracle-${phase}`,'smith',times(phase==='contact'?2.2:5).map(elapsed=>({oracleAbsorption:{...newOracleAbsorption(3,47),phase,elapsed,coating:phase==='coating'?elapsed/5:0,invasion:44,role:'smith'}})),(rig,input)=>{const state=input.oracleAbsorption,position=oracleAbsorptionRoot(state,state.role),c=FILM_SETS.film_oracle_home.center;rig.root.position.set(c.x+position.x,c.y-1,c.z+position.z);rig.root.rotation.y=position.yaw;});
 await writeFile(new URL(`./scan-${process.argv[2] ?? 'before'}.json`,import.meta.url),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}finally{models.dispose();GLTFLoader.prototype.loadAsync=previousLoad;THREE.TextureLoader.prototype.load=previousTexture;globalThis.document=previousDocument;}
