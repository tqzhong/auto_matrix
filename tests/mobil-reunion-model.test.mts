import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mobilReunionRoot, type MobilReunion } from '@auto_matrix/shared';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { poseMobilReunionPair } from '../packages/client/src/agents/MobilReunionPerformance.js';
import { reunionBackContact } from '../packages/client/src/agents/DockReunionPerformance.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

async function geometry(name: string) {
  const bytes = await readFile(new URL(`../packages/client/public/assets/characters/${name}.glb`, import.meta.url));
  const length = bytes.readUInt32LE(12), source = JSON.parse(bytes.subarray(20, 20 + length).toString());
  for (const material of source.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
  source.images = []; source.textures = [];
  const json = Buffer.from(JSON.stringify(source)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const binary = bytes.subarray(20 + length), output = Buffer.alloc(20 + padded.length + binary.length);
  output.writeUInt32LE(0x46546c67, 0); output.writeUInt32LE(2, 4); output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(padded.length, 12); output.writeUInt32LE(0x4e4f534a, 16); padded.copy(output, 20); binary.copy(output, 20 + padded.length);
  return new GLTFLoader().parseAsync(output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength), '');
}

async function setup(t: test.TestContext) {
  const names = ['neo', 'trinity', 'neo-office', 'neo-tracking', 'trinity-club'];
  const assets = Object.fromEntries(await Promise.all(names.map(async name => [name, await geometry(name)])));
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async url => assets[String(url).split('/').pop()!.replace('.glb', '')]);
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  const rigs = { neo: models.create(world.agents.get('neo')!), trinity: models.create(world.agents.get('trinity')!) };
  for (const rig of Object.values(rigs)) models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 }, 0);
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(rigs.neo.hero && rigs.trinity.hero, 'tests must use the two shipped skinned characters');
  const reunion: MobilReunion = { phase: 'embracing', elapsed: 0, neo: { x: 0, z: -22, yaw: Math.PI / 2 }, trinity: { x: 2.2, z: -22, yaw: -Math.PI / 2 } };
  const pose = (elapsed: number, browserTime = 0) => {
    reunion.elapsed = elapsed;
    for (const role of ['neo', 'trinity'] as const) {
      const rig = rigs[role], root = mobilReunionRoot(reunion, role);
      rig.root.position.set(root.x, 0, root.z); rig.root.rotation.y = root.yaw;
      models.animate(rig, browserTime, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, glasses: false,
        mobilStation: true, mobilReunion: { role, reunion } }, 0);
    }
    poseMobilReunionPair(rigs.neo, rigs.trinity, { role: 'neo', reunion });
  };
  t.after(() => { models.dispose(); globalThis.document = previous; });
  return { rigs, pose };
}

test('the shipped reunion palms reach their partner clothing while boots and body transforms stay above the platform', async t => {
  const h = await setup(t);
  for (const elapsed of [0, .2, .55, .9, 1.8, 2.6, 3.25, 3.9, 4.5, 5.2, 5.8, 6.2]) {
    h.pose(elapsed);
    for (const role of ['neo', 'trinity'] as const) {
      const rig = h.rigs[role], other = h.rigs[role === 'neo' ? 'trinity' : 'neo'];
      for (const [i, side] of ['R', 'L'].entries()) {
        const ankle = rig.hero!.bones.get('ankle_' + side)!;
        assert.ok(ankle.getWorldPosition(new THREE.Vector3()).y >= rig.hero!.footHeight - .01, 'the planted ankle must stay on the platform');
        if (elapsed >= .9 && elapsed <= 5.2) {
          const wrist = rig.hero!.bones.get('wrist_' + side)!, rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
          const palm = wrist.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(i ? -.13 : .13, -.18, .02).applyQuaternion(rotation));
          const gap = palm.distanceTo(reunionBackContact(other, i === 1));
          t.diagnostic(JSON.stringify({ role, side, elapsed, gap }));
          assert.ok(gap < .18, 'an embrace must reach the actual delivered clothing');
        }
      }
      rig.root.traverse(object => assert.ok(object.matrixWorld.elements.every(Number.isFinite), object.name));
    }
  }
});

test('a saved embrace gives identical shipped bone transforms at different browser times', async t => {
  const h = await setup(t); h.pose(3.25, 0);
  const bones = () => Object.values(h.rigs).flatMap(rig => [...rig.hero!.bones.values()].map(bone => bone.matrixWorld.elements.slice()));
  const before = bones(); h.pose(3.25, 124);
  assert.deepEqual(bones(), before, 'a paused cold frame must not advance the arms or head');
});
