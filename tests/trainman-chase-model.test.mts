import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, TRAINMAN_CHASE, newTrainmanChase, trainmanRouteProgress, trainmanVaultLift, trainmanVaultProgress, type TrainmanChaseGesture } from '@auto_matrix/shared';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
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
  const asset = await new GLTFLoader().parseAsync(output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength), '');
  if (name.endsWith('-head')) asset.scene.traverse(object => { if (object instanceof THREE.Mesh) (object.material as THREE.MeshStandardMaterial).map = new THREE.Texture(); });
  return asset;
}

test('the shipped Seraph plants his hand on the gate and his body clears the actual barrier during the saved vault', async t => {
  const assets = Object.fromEntries(await Promise.all(['seraph-head', 'seraph-body'].map(async name => [name, await geometry(name)])));
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async url => assets[String(url).split('/').pop()!.replace('.glb', '')]);
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels(), rig = models.create(world.agents.get('seraph')!);
  t.after(() => { models.dispose(); globalThis.document = previous; });
  models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 }, 0); await new Promise(resolve => setImmediate(resolve));
  const center = FILM_SETS[TRAINMAN_CHASE.set].center;
  assert.ok(rig.root.getObjectByName('seraph-detailed-body'));
  for (const from of [-3.2, -2.9, -4.9, -1.5]) for (const phase of [...new Set([...Array.from({ length: 41 }, (_, i) => i / 40), .22])].sort((a, b) => a - b)) {
    rig.root.position.set(center.x + from + (TRAINMAN_CHASE.gate.finishX - from) * trainmanVaultProgress(phase, from), center.y - 1 + TRAINMAN_CHASE.upper + trainmanVaultLift(phase), center.z - 21.5); rig.root.rotation.y = Math.PI / 2;
    const chase: TrainmanChaseGesture = { role: 'seraph', phase: 'vaulting', elapsed: phase * TRAINMAN_CHASE.vaultSeconds, age: phase, vault: phase };
    const input = { speed: 0, grounded: phase === 0 || phase === 1, verticalVelocity: 0, turn: 0, trainmanChase: chase };
    models.animate(rig, 0, input, 0); rig.root.updateWorldMatrix(true, true);
    const palm = rig.mobilWrists![0].localToWorld(new THREE.Vector3(0, -.14, .005)), target = new THREE.Vector3(center.x, center.y - 1 + 5.2 + 1.75, center.z - 21.5);
    if (phase === .22) assert.ok(palm.distanceTo(target) < .08, `the plant actually touches the gate: ${palm.distanceTo(target)}; palm ${palm.toArray()}; shoulder ${rig.shoulders[0].getWorldPosition(new THREE.Vector3()).toArray()}; elbow ${rig.elbows[0].getWorldPosition(new THREE.Vector3()).toArray()}; wrist ${rig.mobilWrists![0].getWorldPosition(new THREE.Vector3()).toArray()}`);
    const collisions: string[] = [];
    rig.root.traverseVisible(object => {
      if (!(object instanceof THREE.Mesh)) return;
      if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
      for (let vertex = 0; vertex < object.geometry.attributes.position.count; vertex++) {
        const point = object.localToWorld(object.getVertexPosition(vertex, new THREE.Vector3()));
        if (Math.abs(point.x - center.x) < .575 && Math.abs(point.z - center.z + 21.5) < 1.375 && point.y > center.y - 1 + 5.2 + .04 && point.y < center.y - 1 + 5.2 + 1.75 - .04)
          collisions.push(`${object.name}/${point.toArray()}/${object instanceof THREE.SkinnedMesh ? [object.geometry.attributes.skinIndex.getX(vertex), object.geometry.attributes.skinIndex.getY(vertex)].map(index => object.skeleton.bones[index].name).join(',') : ''}`);
      }
    });
    assert.deepEqual(collisions.slice(0, 4), [], `actual body/clothes through gate at ${phase}, starting at ${from}`);
    const saved = palm.clone(); models.animate(rig, 0, input, 0); rig.root.updateWorldMatrix(true, true);
    assert.ok(rig.mobilWrists![0].localToWorld(new THREE.Vector3(0, -.14, .005)).distanceTo(saved) < .001, 'a paused vault must reconstruct the same contact');
  }
});

test('the actual brake gesture grips the emergency handle and both companions reach physical carriage poles', async t => {
  const names = ['trainman-head', 'trainman-body', 'trinity', 'trinity-club', 'morpheus'];
  const assets = Object.fromEntries(await Promise.all(names.map(async name => [name, await geometry(name)])));
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async url => assets[String(url).split('/').pop()!.replace('.glb', '')]);
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  t.after(() => { models.dispose(); globalThis.document = previous; });
  const center = FILM_SETS[TRAINMAN_CHASE.set].center, state = newTrainmanChase();
  for (const role of ['trainman', 'trinity', 'morpheus'] as const) {
    const rig = models.create(world.agents.get(role)!);
    const z = role === 'trainman' ? 20 : 25 - state.crew[role];
    rig.root.position.set(center.x + (role === 'trainman' ? -26.6 : -30), center.y - 1, center.z + z);
    rig.root.rotation.y = role === 'trainman' ? Math.PI / 2 : Math.PI;
    const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0,
      trainmanChase: { role, phase: 'braking' as const, elapsed: 1.5, age: 7.5, bracing: true } };
    models.animate(rig, 0, input, 0); await new Promise(resolve => setImmediate(resolve)); models.animate(rig, 0, input, 0);
    const side = role === 'trainman' ? 1 : 0;
    const wrist = rig.hero?.bones.get(`wrist_${side ? 'L' : 'R'}`) ?? rig.mobilWrists![side];
    const palm = wrist.localToWorld(new THREE.Vector3(0, rig.hero ? -.19 : -.14, .005));
    const poleZ = [18, 23, 29, 35, 41, 45].reduce((a, b) => Math.abs(b - z) < Math.abs(a - z) ? b : a, 18);
    const target = role === 'trainman' ? new THREE.Vector3(center.x + TRAINMAN_CHASE.lever.x - .13, center.y - 1 + TRAINMAN_CHASE.lever.y, center.z + TRAINMAN_CHASE.lever.z)
      : new THREE.Vector3(center.x - 28.7, center.y - 1 + 3.65, center.z + poleZ);
    assert.ok(palm.distanceTo(target) < .08, `${role} must really reach its brake contact: ${palm.distanceTo(target)}; ${palm.toArray()}`);
  }
});

test('the shipped companions and Trainman clear the gate while their route velocity is nonzero', async t => {
  const names = ['trainman-head', 'trainman-body', 'trinity', 'trinity-club', 'morpheus'];
  const assets = Object.fromEntries(await Promise.all(names.map(async name => [name, await geometry(name)])));
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async url => assets[String(url).split('/').pop()!.replace('.glb', '')]);
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  t.after(() => { models.dispose(); globalThis.document = previous; });
  const center = FILM_SETS[TRAINMAN_CHASE.set].center, gate = TRAINMAN_CHASE.gate;
  const start = trainmanRouteProgress(gate.approachX, TRAINMAN_CHASE.upper, gate.z);
  for (const role of ['trainman', 'trinity', 'morpheus'] as const) {
    const actor = world.agents.get(role)!; actor.currentLocation = TRAINMAN_CHASE.set; actor.isInMatrix = true;
    const rig = models.create(actor); models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 }, 0);
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(role === 'trainman' ? rig.root.getObjectByName('trainman-detailed-body') : rig.hero, `${role} must use the shipped body`);
    for (const phase of [...new Set([...Array.from({ length: 41 }, (_, i) => i / 40), .22])].sort((a, b) => a - b)) {
      rig.root.position.set(center.x + gate.approachX + (gate.finishX - gate.approachX) * trainmanVaultProgress(phase),
        center.y - 1 + TRAINMAN_CHASE.upper + trainmanVaultLift(phase), center.z + gate.z); rig.root.rotation.y = Math.PI / 2;
      const input = { speed: 6.4, grounded: false, verticalVelocity: 0, turn: 0,
        trainmanChase: { role, phase: 'running' as const, age: 12 + phase, elapsed: 0, vault: phase, stride: start + phase * 6.4 } };
      models.animate(rig, 0, input, 0); rig.root.updateWorldMatrix(true, true);
      const collisions: string[] = [];
      rig.root.traverseVisible(object => {
        if (!(object instanceof THREE.Mesh)) return;
        if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
        for (let vertex = 0; vertex < object.geometry.attributes.position.count; vertex++) {
          const point = object.localToWorld(object.getVertexPosition(vertex, new THREE.Vector3()));
          if (Math.abs(point.x - center.x) < .575 && Math.abs(point.z - center.z - gate.z) < 1.375 && point.y > center.y - 1 + TRAINMAN_CHASE.upper + .04 && point.y < center.y - 1 + TRAINMAN_CHASE.upper + gate.height - .04)
            collisions.push(`${object.name}/${point.toArray()}`);
        }
      });
      assert.deepEqual(collisions.slice(0, 4), [], `${role} body/clothing through the gate at ${phase}, at live route speed`);
    }
  }
});
