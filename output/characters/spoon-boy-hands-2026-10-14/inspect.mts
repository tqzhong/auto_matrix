import { readFile, writeFile, mkdir } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { WorldState } from '../../../packages/server/src/world/WorldState.js';
import { AgentManager } from '../../../packages/server/src/agents/AgentManager.js';
import { FILM_SETS, SPOON_LESSON, spoonLessonBend } from '@auto_matrix/shared';
const label=process.argv[2] ?? 'initial';
const { CharacterModels }=await import(label === 'before' ? './original/CharacterModel.mjs' : '../../../packages/client/src/agents/CharacterModel.js');
const folder=new URL(`./${label}/`,import.meta.url);await mkdir(folder,{recursive:true});
const assets=new Map();
for(const name of ['neo','neo-office','neo-tracking','oracle-park-hands']) {
 const raw=await readFile(new URL(`../../../packages/client/public/assets/characters/${name}.glb`,import.meta.url));
 const size=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+size).toString());
 for(const m of doc.materials) { delete m.pbrMetallicRoughness.baseColorTexture; delete m.normalTexture; }
 doc.images=[];doc.textures=[];
 const j=Buffer.from(JSON.stringify(doc)),padded=Buffer.alloc(Math.ceil(j.length/4)*4,32);j.copy(padded);
 const tail=raw.subarray(20+size),data=Buffer.alloc(20+padded.length+tail.length);
 data.writeUInt32LE(0x46546c67);data.writeUInt32LE(2,4);data.writeUInt32LE(data.length,8);data.writeUInt32LE(padded.length,12);data.writeUInt32LE(0x4e4f534a,16);padded.copy(data,20);tail.copy(data,20+padded.length);
 assets.set(name,await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),''));
}
GLTFLoader.prototype.loadAsync=async url=>{ const asset=assets.get(String(url).split('/').pop()!.replace('.glb',''));if(!asset) throw new Error(String(url));return {...asset,scene:clone(asset.scene)};};
THREE.TextureLoader.prototype.load=()=>new THREE.Texture();
globalThis.document={createElement:()=>({getContext:()=>({createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}})})} as unknown as Document;
const world=new WorldState();new AgentManager(world).initializeAllAgents();const models=new CharacterModels();
const boy=models.create(world.agents.get('spoon_boy')!),neo=models.create(world.agents.get('neo')!);
await new Promise(resolve=>setImmediate(resolve));const center=FILM_SETS.film_oracle_home.center;
for(const [body,place] of [[boy,SPOON_LESSON.boy],[neo,SPOON_LESSON.neo]] as const) {body.root.position.set(center.x+place.x,center.y-1,center.z+place.z);body.root.rotation.y=place.yaw;}
function draw(phase:string,elapsed:number) {
 for(const [body,role] of [[boy,'boy'],[neo,'neo']] as const) {
  const lesson={phase,elapsed} as any;models.animate(body,0,{speed:0,grounded:true,verticalVelocity:0,turn:0,spoon:spoonLessonBend(lesson,role,0),spoonLesson:{...lesson,role},seated:role==='boy',floorSeated:role==='boy'},4);body.root.updateMatrixWorld(true);
 }
}
function geometry(object:THREE.Object3D) {
 const vertices:number[][]=[],indices:number[]=[],colors:number[][]=[];
 object.traverseVisible(child=>{if(!(child instanceof THREE.Mesh))return;const mesh=child,position=mesh.geometry.attributes.position,index=mesh.geometry.index,start=vertices.length;
 if(mesh instanceof THREE.SkinnedMesh) mesh.skeleton.update();
 const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material]; const color=(materials[0] as THREE.MeshStandardMaterial).color??new THREE.Color(.7,.7,.7);
 for(let i=0;i<position.count;i++){vertices.push(mesh.localToWorld(mesh.getVertexPosition(i,new THREE.Vector3())).sub(new THREE.Vector3(center.x,center.y-1,center.z)).toArray());colors.push(color.toArray());}
 for(let i=0;i<(index?.count??position.count);i++)indices.push(start+(index?index.getX(i):i));});return{vertices,indices,colors};
}
try{
 for(const [phase,elapsed] of [['demonstrating',0],['demonstrating',2.5],['offered',0],['receiving',1.099],['receiving',1.42],['focus',0]] as const) {
  draw(phase,elapsed);const spoon=boy.spoon?.root.visible?boy.spoon.root:neo.spoon!.root;
  const contact=new THREE.Vector3(center.x+SPOON_LESSON.contact.x,center.y-1+SPOON_LESSON.contact.y,center.z+SPOON_LESSON.contact.z);
  const wrist=boy.root.getObjectByName('spoon-boy-wrist-R'),shoulder=boy.shoulders[0],elbow=boy.elbows[0];
  const positions=Object.fromEntries([['shoulder',shoulder],['elbow',elbow],['wrist',wrist??elbow]].map(([name,obj])=>[name,(obj as THREE.Object3D).getWorldPosition(new THREE.Vector3()).sub(new THREE.Vector3(center.x,center.y-1,center.z)).toArray()]));
  const violations:any[]=[];
  if (boy.spoonHands && boy.spoon?.root.visible) {
   const hand=boy.spoonHands[0],skin=hand.skin;skin.skeleton.update();
   const {skinIndex,skinWeight}=skin.geometry.attributes;
   const points=Array.from({length:skinIndex.count},(_,i)=>spoon.worldToLocal(skin.localToWorld(skin.getVertexPosition(i,new THREE.Vector3()))));
   for(let i=0;i<points.length;i++){
    const p=points[i];if(p.y<=.005||p.y>=.165||Math.abs(p.x)>.08||Math.abs(p.z)>.03)continue;
    const r=.045-.013*p.y/.65,m=Math.max(...Array.from({length:8},(_,k)=>{const a=(k+.5)*Math.PI/4;return Math.cos(a)*p.x/r+Math.sin(a)*p.z/(r*.24);}))-Math.cos(Math.PI/8);
    if(m<-.005){const weights=Array.from({length:4},(_,j)=>[skin.skeleton.bones[skinIndex.getComponent(i,j)].name,skinWeight.getComponent(i,j)]);violations.push({i,p:p.toArray(),margin:m,weights});}
   }
  }
  const report={phase,elapsed,violations,positions,contactGap:spoon.localToWorld(new THREE.Vector3(0,.08,0)).distanceTo(contact),wristDot:wrist?new THREE.Vector3(0,-1,0).transformDirection(wrist.matrixWorld).dot(wrist.getWorldPosition(new THREE.Vector3()).sub(elbow.getWorldPosition(new THREE.Vector3())).normalize()):null,motion:boy.motion};console.log(JSON.stringify(report));
  await writeFile(new URL(`${phase}-${elapsed}.json`,folder),JSON.stringify({arm:geometry(elbow),prop:geometry(spoon),body:geometry(boy.root),...report}));
 }
 draw('demonstrating',2.5);const a=boy.elbows[0].getWorldQuaternion(new THREE.Quaternion());
 models.animate(boy,.13,{speed:6,grounded:true,verticalVelocity:0,turn:.4},4);draw('demonstrating',2.5);
 console.log('resume',JSON.stringify({elbowAngle:a.angleTo(boy.elbows[0].getWorldQuaternion(new THREE.Quaternion())),motion:boy.motion}));
 const timings:any={};
 for(const [name,clock] of [['paused',false],['moving',true]] as const) {
  const measurements:number[]=[];
  for(let i=0;i<850;i++) {const begin=performance.now();draw('demonstrating',clock?2.4+Math.sin(i/40)*.15:2.4);if(i>=100)measurements.push(performance.now()-begin);}
  measurements.sort((a,b)=>a-b);timings[name]={samples:measurements.length,median:measurements[375],p95:measurements[Math.floor(measurements.length*.95)]};
 }
 await writeFile(new URL(`./cpu-${label}.json`,import.meta.url),JSON.stringify(timings,null,2));console.log('cpu',JSON.stringify(timings));
}finally{models.dispose();}
