import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { gardenPose, newTrilogyEpilogue } from '@auto_matrix/shared';
const { CharacterModels } = await import(process.argv[2] === 'baseline' ? './baseline-source/packages/client/src/agents/CharacterModel.js' : '../../../packages/client/src/agents/CharacterModel.js');
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


const rig = models.create(world.agents.get('oracle')!);
models.animate(rig,0,{speed:0,grounded:true,verticalVelocity:0,turn:0,parkOutfit:true},1);
await new Promise(resolve=>setImmediate(resolve));

const results=[];
function step(elapsed) {
 const epilogue={...newTrilogyEpilogue('dawn'),phase:'sitting' as const,elapsed,total:elapsed,role:'oracle' as const};
 const pose=gardenPose(epilogue,'oracle');rig.root.position.set(pose.x,0,pose.z);rig.root.rotation.y=pose.yaw;
 models.animate(rig,0,{speed:0,grounded:true,verticalVelocity:0,turn:0,parkOutfit:true,epilogue},1);
}
for (const mode of ['frozen','moving']) {
 for(let i=0;i<40;i++)step(mode==='frozen'?2.4:i/40*2.4);
 const times=[];
 for(let i=0;i<300;i++){const start=performance.now();step(mode==='frozen'?2.4:(i%100)/100*2.4);times.push(performance.now()-start);}
 times.sort((a,b)=>a-b);results.push({mode,samples:times.length,mean:times.reduce((a,b)=>a+b)/times.length,median:times[150],p95:times[285]});
}
console.log(JSON.stringify({source:process.argv[2],measurement:'Node model CPU milliseconds, not browser FPS',results},null,2));
models.dispose();globalThis.document=previous;
