import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CharacterModels } from '../../../packages/client/src/agents/CharacterModel.js';
import { WorldState } from '../../../packages/server/src/world/WorldState.js';
import { AgentManager } from '../../../packages/server/src/agents/AgentManager.js';

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


import { mkdir, writeFile } from 'node:fs/promises';
const out=process.argv[2]; if (!out) throw new Error('Specify output directory');
await mkdir(out,{recursive:true});
const assets = new Map(await Promise.all(['neo','neo-office','neo-tracking'].map(async id => [id, await loadGeometry(id)] as const)));
GLTFLoader.prototype.loadAsync = async (url: string) => assets.get(url.split('/').at(-1)!.replace('.glb',''))!;
THREE.TextureLoader.prototype.load = () => new THREE.Texture();
globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {}, createImageData: (w:number,h:number) => ({ data: new Uint8ClampedArray(w*h*4) }), putImageData() {} }) }) } as unknown as Document;
const models = new CharacterModels();
const world = new WorldState(); new AgentManager(world).initializeAllAgents();
const rig = models.create(world.agents.get('neo')!);
await new Promise(resolve => setImmediate(resolve));
try {
  for (const phase of ['ready','connected'] as const) {
    models.animate(rig,0,{ speed:0,grounded:true,verticalVelocity:0,turn:0,officeShirt:true,phone:{phase,elapsed:2}},0);
    rig.root.updateMatrixWorld(true);
    const wrist=rig.hero!.bones.get('wrist_R')!, inverse=wrist.matrixWorld.clone().invert();
    const skin=rig.hero!.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh; skin.skeleton.update();
    const {position,skinIndex,skinWeight}=skin.geometry.attributes;
    const vertices:number[][]=[], indices:number[]=[], lookup=new Map<number,number>(), labels:string[]=[];
    const point=new THREE.Vector3();
    for(let i=0;i<position.count;i++) {
      let hand=0, label='', best=0;
      for(let j=0;j<4;j++) { const name=skin.skeleton.bones[skinIndex.getComponent(i,j)].name, weight=skinWeight.getComponent(i,j);
        if(/^(wrist|finger).*_R$/.test(name))hand+=weight;
        if(weight>best){best=weight;label=name;}
      }
      if(hand<.5)continue;
      lookup.set(i,vertices.length); labels.push(label);vertices.push(skin.localToWorld(skin.getVertexPosition(i,point)).applyMatrix4(inverse).toArray());
    }
    const source=skin.geometry.index!;
    for(let i=0;i<source.count;i+=3){const tri=[source.getX(i),source.getX(i+1),source.getX(i+2)];if(tri.every(v=>lookup.has(v)))indices.push(...tri.map(v=>lookup.get(v)!));}
    const phone:{vertices:number[][];indices:number[]}={vertices:[],indices:[]};
    rig.phone!.root.traverse(object=>{if(!(object instanceof THREE.Mesh))return;const start=phone.vertices.length, pos=object.geometry.attributes.position;
      for(let i=0;i<pos.count;i++)phone.vertices.push(object.localToWorld(new THREE.Vector3().fromBufferAttribute(pos,i)).applyMatrix4(inverse).toArray());
      const idx=object.geometry.index;for(let i=0;i<(idx?.count??pos.count);i++)phone.indices.push(start+(idx?idx.getX(i):i));
    });
    const report=[];
    for(let finger=1;finger<=5;finger++) {
      const points=vertices.filter((_,i)=>labels[i]===`finger${finger}-3_R`).map(v=>new THREE.Vector3(...v));
      const center=points.reduce((sum,p)=>sum.add(p),new THREE.Vector3()).divideScalar(points.length);
      let gap=Infinity;const tri=new THREE.Triangle(),nearest=new THREE.Vector3();
      for(let i=0;i<phone.indices.length;i+=3){tri.set(...phone.indices.slice(i,i+3).map(v=>new THREE.Vector3(...phone.vertices[v])) as [THREE.Vector3,THREE.Vector3,THREE.Vector3]);tri.closestPointToPoint(center,nearest);gap=Math.min(gap,nearest.distanceTo(center));}
      report.push({finger,pad:center.toArray(),gap});
    }
    const body:{vertices:number[][];indices:number[];materials:{end:number;name:string}[]}={vertices:[],indices:[],materials:[]};
    rig.root.traverseVisible(object=>{if(!(object instanceof THREE.Mesh))return;
      if(object instanceof THREE.SkinnedMesh)object.skeleton.update();
      const source=object.geometry.index,position=object.geometry.attributes.position;
      const start=body.vertices.length;
      for(let i=0;i<position.count;i++)body.vertices.push(object.localToWorld(object.getVertexPosition(i,new THREE.Vector3())).toArray());
      for(let i=0;i<(source?.count??position.count);i+=3){const tri=[0,1,2].map(j=>start+(source?source.getX(i+j):i+j));if(tri.every(index=>body.vertices[index][1]>2.5))body.indices.push(...tri);}
      body.materials.push({end:body.indices.length/3,name:(object.material as THREE.Material).name});
    });
    const joints=Object.fromEntries([...rig.hero!.bones].filter(([name])=>/^(finger|wrist).*_R$/.test(name)).map(([name,b])=>[name,b.getWorldPosition(new THREE.Vector3()).applyMatrix4(inverse).toArray()]));
    await writeFile(`${out}/${phase}.json`,JSON.stringify({vertices,indices,labels,phone,joints,body,phoneWorld:rig.phone!.root.getWorldPosition(new THREE.Vector3()).toArray(),wristRotation:wrist.rotation.toArray()}));
    console.log(phase,JSON.stringify(report));
  }
}finally{models.dispose();}
