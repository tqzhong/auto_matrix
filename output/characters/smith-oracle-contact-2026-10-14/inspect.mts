import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, ORACLE_LAST, newOracleAbsorption, oracleAbsorptionRoot, oracleAbsorptionPlate, type OracleAbsorptionGesture } from '@auto_matrix/shared';
import { CharacterModels } from '../../../packages/client/src/agents/CharacterModel.js';
const { contactOracleAbsorption } = await import(process.argv[2] === 'before' ? './baseline-contact.mjs' : '../../../packages/client/src/agents/OracleAbsorptionPerformance.js');
import { OracleSmithAppearance } from '../../../packages/client/src/agents/OracleSmithAppearance.js';
import { OracleAbsorptionRenderer } from '../../../packages/client/src/engine/OracleAbsorptionRenderer.js';
import { WorldState } from '../../../packages/server/src/world/WorldState.js';
import { AgentManager } from '../../../packages/server/src/agents/AgentManager.js';

async function geometry(name = 'smith') {
  const glb = await readFile(new URL(`../../../packages/client/public/assets/characters/${name}.glb`, import.meta.url));
  const length = glb.readUInt32LE(12), document = JSON.parse(glb.subarray(20, 20 + length).toString());
  for (const material of document.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = glb.subarray(20 + length), result = Buffer.alloc(20 + padded.length + bin.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); bin.copy(result, 20 + padded.length);
  return new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
}

async function setup(t: TestContext) {
  const smith = await geometry(), oracle = await geometry('oracle-revolutions-head');
  oracle.scene.traverse(object => { if (object instanceof THREE.Mesh) (object.material as THREE.MeshStandardMaterial).map = new THREE.Texture(); });
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async (url: string) => url.endsWith('/smith.glb') ? smith : url.endsWith('/oracle-revolutions-head.glb') ? oracle : new Promise(() => {}));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {},
    createRadialGradient: () => ({ addColorStop() {} }) }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const models = new CharacterModels(), rigs = { oracle: models.create(world.agents.get('oracle')!), smith: models.create(world.agents.get('smith')!) };
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(rigs.smith.hero, 'pose the shipped skinned Smith body');
  const center = FILM_SETS.film_oracle_home.center, origin = new THREE.Vector3(center.x, center.y - 1, center.z);
  const frame = (state: ReturnType<typeof newOracleAbsorption>, delta = 0) => {
    for (const role of ['oracle', 'smith'] as const) {
      const rig = rigs[role], position = oracleAbsorptionRoot(state, role);
      rig.root.position.set(position.x, 0, position.z).add(origin); rig.root.rotation.y = position.yaw;
      models.animate(rig, delta, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, oracleRevolutions: role === 'oracle', oracleAbsorption: { ...state, role } }, 0);
      if (rig.hero) rig.hero.root.visible = true;
      rig.root.updateWorldMatrix(true, true);
    }
    contactOracleAbsorption(rigs.oracle, rigs.smith, { ...state, role: 'oracle' });
    for (const rig of Object.values(rigs)) { rig.root.updateMatrixWorld(true); rig.root.traverse(object => { if (object instanceof THREE.SkinnedMesh) object.skeleton.update(); }); }
  };
  t.after(() => { models.dispose(); globalThis.document = previous; });
  return { rigs, models, frame, origin };
}


const cleanups: (() => void)[] = [];
const context = { mock: { method(target: any, key: string, value: any) { target[key] = value; } }, after(fn: () => void) { cleanups.push(fn); } } as unknown as TestContext;
const h = await setup(context);
h.frame({ ...newOracleAbsorption(3,47),phase:'contact',invasion:44,elapsed:0 });
await new Promise(resolve => setImmediate(resolve));
const output: any[] = [];
for (const elapsed of [0,.05,.2,.4,.8,1.2,1.6,2.2]) {
 const state = { ...newOracleAbsorption(3,47), phase:'contact' as const, invasion:44,elapsed };
 h.frame(state);
 const wrist=h.rigs.smith.hero!.bones.get('wrist_R')!;
 const all={vertices:[] as number[][],indices:[] as number[],colors:[] as number[][]}, hand={vertices:[] as number[][],indices:[] as number[],colors:[] as number[][]};
 for(const rig of Object.values(h.rigs)) rig.root.traverseVisible(object=>{
  if(!(object instanceof THREE.Mesh))return;
  const {position,skinIndex,skinWeight}=object.geometry.attributes;
  const indices=object.geometry.index,offset=all.vertices.length,handVertices=new Map<number,number>();
  for(let i=0;i<position.count;i++){
   const point=object.localToWorld(object.getVertexPosition(i,new THREE.Vector3()));
   const color=(object.material as THREE.MeshStandardMaterial).color?.toArray()??[.6,.6,.6];
   all.vertices.push(point.clone().sub(h.origin).toArray());all.colors.push(color);
   if(rig!==h.rigs.smith||!(object instanceof THREE.SkinnedMesh)||(object.material as THREE.Material).name!=='Skin')continue;
   let weight=0;for(let k=0;k<4;k++)if(/^(wrist_R|finger[1-5]-[1-3]_R)$/.test(object.skeleton.bones[skinIndex.getComponent(i,k)].name))weight+=skinWeight.getComponent(i,k);
   if(weight<.65)continue;
   handVertices.set(i,hand.vertices.length);hand.vertices.push(point.clone().sub(h.origin).toArray());hand.colors.push(color);
  }
  for(let i=0;i<(indices?.count??position.count);i+=3){
   const triangle=[0,1,2].map(k=>indices?indices.getX(i+k):i+k);
   all.indices.push(...triangle.map(j=>offset+j));
   if(triangle.every(j=>handVertices.has(j)))hand.indices.push(...triangle.map(j=>handVertices.get(j)!));
  }
 });
 const entry={elapsed,all,hand,wrist:wrist.getWorldPosition(new THREE.Vector3()).sub(h.origin).toArray(),rotation:wrist.getWorldQuaternion(new THREE.Quaternion()).toArray()};output.push(entry);
 console.log(JSON.stringify({elapsed,wrist:entry.wrist,rotation:entry.rotation,handVertices:hand.vertices.length,wristBend:Math.acos(new THREE.Vector3(0,-1,0).applyQuaternion(wrist.quaternion).dot(wrist.position.clone().normalize()))}));
}
await writeFile(new URL(`./${process.argv[2]??'current'}-geometry.json`,import.meta.url),JSON.stringify(output));
cleanups.forEach(fn=>fn());
