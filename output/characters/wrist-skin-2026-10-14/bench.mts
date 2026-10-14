import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { FILM_SETS, ORACLE_LAST, newOracleAbsorption, oracleAbsorptionRoot, oracleAbsorptionPlate, type OracleAbsorptionGesture } from '@auto_matrix/shared';
import { CharacterModels } from '../../../packages/client/src/agents/CharacterModel.js';
import { contactOracleAbsorption } from '../../../packages/client/src/agents/OracleAbsorptionPerformance.js';
import { OracleSmithAppearance } from '../../../packages/client/src/agents/OracleSmithAppearance.js';
import { OracleAbsorptionRenderer } from '../../../packages/client/src/engine/OracleAbsorptionRenderer.js';
import { WorldState } from '../../../packages/server/src/world/WorldState.js';
import { AgentManager } from '../../../packages/server/src/agents/AgentManager.js';

async function geometry() {
  const glb = await readFile(new URL('../../../packages/client/public/assets/characters/smith.glb', import.meta.url));
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
  const smith = await geometry();
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async (url: string) => url.endsWith('/smith.glb') ? { ...smith, scene: clone(smith.scene) } : new Promise(() => {}));
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
      models.animate(rig, delta, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, oracleAbsorption: { ...state, role } }, 0);
      if (rig.hero) rig.hero.root.visible = true;
      rig.root.updateWorldMatrix(true, true);
    }
    contactOracleAbsorption(rigs.oracle, rigs.smith, { ...state, role: 'oracle' });
    for (const rig of Object.values(rigs)) { rig.root.updateMatrixWorld(true); rig.root.traverse(object => { if (object instanceof THREE.SkinnedMesh) object.skeleton.update(); }); }
  };
  t.after(() => { models.dispose(); globalThis.document = previous; });
  return { rigs, models, frame, origin, smith: world.agents.get('smith')! };
}


const cleanups: (() => void)[] = [];
const context = { mock: { method(target: any, key: string, value: any) { target[key] = value; } }, after(fn: () => void) { cleanups.push(fn); } } as unknown as TestContext;
const h = await setup(context), results = [];
for (const mode of ['frozen','moving']) {
 const frame = (i:number) => h.frame({ ...newOracleAbsorption(3,47),phase:'contact',invasion:44,elapsed:mode==='frozen'?2.2:(i%100)/100*2.2 });
 for(let i=0;i<40;i++)frame(i);
 const samples=[];
 for(let i=0;i<300;i++){const start=performance.now();frame(i);samples.push(performance.now()-start);}
 samples.sort((a,b)=>a-b);results.push({mode,samples:samples.length,median:samples[150],p95:samples[285],mean:samples.reduce((a,b)=>a+b)/samples.length});
}
console.log(JSON.stringify({source:process.argv[2],measurement:'Node CPU milliseconds for both posed models and contact; not browser FPS',results},null,2));
cleanups.forEach(fn=>fn());
