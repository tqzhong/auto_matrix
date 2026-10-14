// Actual posed geometry and albedo, exported for offline inspection, not a game capture.
import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HeroModels } from '../../../packages/client/src/agents/HeroModel.js';
import { FILM_SETS, PILL_ROOM, pillRoot } from '@auto_matrix/shared';
import { PillPerformance as OriginalPills } from './original/PillPerformance.mjs';
import { advanceMotion, newMotion } from '../../../packages/client/src/agents/CharacterMotion.js';

const label = process.argv[2], models = new HeroModels(new THREE.Texture(), new THREE.Texture());
models['load'] = async id => {
  const path = `../../../packages/client/public/assets/characters/${id}.glb`;
  const bytes = await readFile(new URL(path, import.meta.url));
  const length = bytes.readUInt32LE(12), doc = JSON.parse(bytes.subarray(20, 20 + length).toString()), textures = new Map();
  for (const material of doc.materials) {
    const texture = material.pbrMetallicRoughness.baseColorTexture?.index;
    if (texture !== undefined) textures.set(material.name, doc.images[doc.textures[texture].source].uri);
    delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture;
  }
  doc.images = []; doc.textures = [];
  const json = Buffer.from(JSON.stringify(doc)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const binary = bytes.subarray(20 + length), result = Buffer.alloc(20 + padded.length + binary.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); binary.copy(result, 20 + padded.length);
  const asset = await new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
  asset.scene.traverse(mesh => { if (mesh instanceof THREE.Mesh) mesh.userData.inspectionTexture = textures.get((mesh.material as THREE.Material).name); });
  return asset;
};
const records = [];
try {
 for (const choice of ['red','blue'] as const) {
  const rig = (await models.create('neo'))!, motion = newMotion(), side = choice === 'red' ? 'L' : 'R';
  if (label === 'before') models['pills'].set(rig, new OriginalPills(rig) as any);
  const skin = rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh, head = rig.bones.get('head')!;
  rig.root.updateMatrixWorld(true);skin.skeleton.update();
  const {position,skinIndex,skinWeight} = skin.geometry.attributes, index = skin.geometry.index!;
  const skull = Array.from({length:position.count},(_,i)=>[0,1,2,3].some(j=>skinWeight.getComponent(i,j) > .999 && skin.skeleton.bones[skinIndex.getComponent(i,j)].name === 'head'));
  const heads:number[][] = [],indices:number[] = [],lookup = new Map<number,number>();
  for(let i=0;i<index.count;i+=3){const tri=[index.getX(i),index.getX(i+1),index.getX(i+2)];if(!tri.every(v=>skull[v]))continue;
   for(const v of tri){if(!lookup.has(v)){lookup.set(v,heads.length);heads.push(head.worldToLocal(skin.localToWorld(skin.getVertexPosition(v,new THREE.Vector3()))).toArray());}indices.push(lookup.get(v)!);}
  }
  const hands = Array.from({length:position.count},(_,i)=>i).filter(i=>i%3===0&&[0,1,2,3].reduce((sum,j)=>sum+(/^(wrist|finger).*_/.test(skin.skeleton.bones[skinIndex.getComponent(i,j)].name)&&skin.skeleton.bones[skinIndex.getComponent(i,j)].name.endsWith('_'+side)?skinWeight.getComponent(i,j):0),0)>.8);
  const frames=[];
  for(const elapsed of [2,2.15,2.3,2.5,2.7,2.85,3,3.2,3.4,3.5,3.65,3.9,4.1]){
   const pills={phase:'taking' as const,elapsed,choice,role:'neo' as const},root=pillRoot({...pills,approach:{x:1.75,z:-6,yaw:-Math.PI/2}}),c=FILM_SETS.film_lafayette.center;
   rig.root.position.set(c.x+root.x,c.y-1,c.z+root.z);rig.root.rotation.y=root.yaw;
   const input={speed:0,grounded:true,verticalVelocity:0,turn:0,pills};models.animate(rig,advanceMotion(motion,input,0),motion,input,0);rig.root.updateMatrixWorld(true);skin.skeleton.update();
   frames.push({elapsed,points:hands.map(v=>head.worldToLocal(skin.localToWorld(skin.getVertexPosition(v,new THREE.Vector3()))).toArray())});
  }
  records.push({choice,head:{vertices:heads,indices},handVertices:hands.length,frames});
 }
 await writeFile(new URL(`./${label}-head-contact.json`,import.meta.url),JSON.stringify(records));
}finally{models.dispose();}
