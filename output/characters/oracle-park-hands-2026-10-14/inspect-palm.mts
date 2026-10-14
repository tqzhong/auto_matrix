import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { OracleParkHands } from '../../../packages/client/src/agents/OracleParkHands.js';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { gardenPose, newTrilogyEpilogue } from '@auto_matrix/shared';
import { CharacterModels, type CharacterRig } from '../../../packages/client/src/agents/CharacterModel.js';
import { WorldState } from '../../../packages/server/src/world/WorldState.js';
import { AgentManager } from '../../../packages/server/src/agents/AgentManager.js';

  const assets = new Map();
  for (const name of ['oracle-revolutions-head', 'oracle-park-hands']) {
    const bytes = await readFile(new URL(`../../../packages/client/public/assets/characters/${name}.glb`, import.meta.url));
    const length = bytes.readUInt32LE(12), doc = JSON.parse(bytes.subarray(20, 20 + length).toString());
    for (const material of doc.materials) delete material.pbrMetallicRoughness.baseColorTexture;
    doc.images = []; doc.textures = [];
    const json = Buffer.from(JSON.stringify(doc)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
    const binary = bytes.subarray(20 + length), output = Buffer.alloc(20 + padded.length + binary.length);
    output.writeUInt32LE(0x46546c67, 0); output.writeUInt32LE(2, 4); output.writeUInt32LE(output.length, 8);
    output.writeUInt32LE(padded.length, 12); output.writeUInt32LE(0x4e4f534a, 16); padded.copy(output, 20); binary.copy(output, 20 + padded.length);
    const asset = await new GLTFLoader().parseAsync(output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength), '');
    if (name.endsWith('-head')) asset.scene.traverse(object => { if (object instanceof THREE.Mesh) (object.material as THREE.MeshStandardMaterial).map = new THREE.Texture(); });
    assets.set(name, asset);
  }
  GLTFLoader.prototype.loadAsync = async url => {
    const name = String(url).split('/').pop()!.replace('.glb', ''), asset = assets.get(name); assert.ok(asset, name);
    return { ...asset, scene: clone(asset.scene) };
  };
  THREE.TextureLoader.prototype.load = () => new THREE.Texture();
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();

if (process.argv[2] === 'before') OracleParkHands.prototype.update = () => {};
const rig = models.create(world.agents.get('oracle')!);
models.animate(rig,0,{speed:0,grounded:true,verticalVelocity:0,turn:0,parkOutfit:true},1);
await new Promise(resolve=>setImmediate(resolve));
const out = new URL(`./${process.argv[2] ?? 'after'}/`, import.meta.url); await mkdir(out,{recursive:true});
for (const elapsed of [0,.45,1.05,1.7,2.4]) {
 const epilogue={...newTrilogyEpilogue('dawn'),phase:'sitting' as const,elapsed,total:elapsed,role:'oracle' as const};
 const pose=gardenPose(epilogue,'oracle');rig.root.position.set(pose.x,0,pose.z);rig.root.rotation.y=pose.yaw;
 models.animate(rig,0,{speed:0,grounded:true,verticalVelocity:0,turn:0,parkOutfit:true,epilogue},1);rig.root.updateMatrixWorld(true);
 const bag=rig.root.getObjectByName('oracle-park-handbag')!;
 function surfaces(roots: THREE.Object3D[],space:THREE.Object3D) {
  const data={vertices:[] as number[][],indices:[] as number[],colors:[] as number[][]};
  for (const root of roots) root.traverseVisible(object=>{
   if(!(object instanceof THREE.Mesh))return;
   if(object instanceof THREE.SkinnedMesh)object.skeleton.update();
   const offset=data.vertices.length,position=object.geometry.attributes.position,index=object.geometry.index;
   for(let v=0;v<position.count;v++){data.vertices.push(space.worldToLocal(object.localToWorld(object.getVertexPosition(v,new THREE.Vector3()))).toArray());data.colors.push((object.material as THREE.MeshStandardMaterial).color.toArray());}
   for(let i=0;i<(index?.count??position.count);i++)data.indices.push(offset+(index?index.getX(i):i));
  });return data;
 }
 const hands=['R','L'].map(side=>rig.root.getObjectByName(`oracle-hand-${side}`)!);
 const report:any[]=[];
 for(const [side, hand] of (rig.parkHands??[]).entries()) {
  const skin=hand.skin;skin.skeleton.update();const {position,skinIndex,skinWeight}=skin.geometry.attributes;
  const path=(bag.getObjectByName(`oracle-handbag-handle-${process.argv[3]??'.11'}`.replace('-.11','-0.11')) as THREE.Mesh<THREE.TubeGeometry>).geometry.parameters.path;
  const segments=Array.from({length:192},(_,i)=>new THREE.Line3(path.getPoint(i/192),path.getPoint((i+1)/192)));
  for(let digit=0;digit<=5;digit++) {
   let minimum=Infinity,at:any;let outside=Infinity;
   for(let v=0;v<position.count;v++) {
    let w=0;for(let j=0;j<4;j++)if(skin.skeleton.bones[skinIndex.getComponent(v,j)].name.startsWith(`finger${digit}-`))w+=skinWeight.getComponent(v,j);
    if(digit && w<.7)continue;
    const point=bag.worldToLocal(skin.localToWorld(skin.getVertexPosition(v,new THREE.Vector3())));
    const distance=Math.min(...segments.map(seg=>seg.closestPointToPoint(point,true,new THREE.Vector3()).distanceTo(point)));
    if(distance<minimum){minimum=distance;at={point:point.toArray(),bind:Array.from({length:4},(_,j)=>[skin.skeleton.bones[skinIndex.getComponent(v,j)].name,skinWeight.getComponent(v,j)])};}
   }
   report.push({side,digit,gap:minimum-.023,at,joints:(hand.bones[digit-1]??[]).map(b=>bag.worldToLocal(b.getWorldPosition(new THREE.Vector3())).toArray())});
  }
 }
 console.log(elapsed,JSON.stringify(report));
 await writeFile(new URL(`${elapsed}.json`,out),JSON.stringify({hands:surfaces([...hands,bag],bag),body:surfaces([rig.detail],rig.root),report}));
}
models.dispose();globalThis.document=previous;
