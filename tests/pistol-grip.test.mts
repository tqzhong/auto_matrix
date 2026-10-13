import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

async function geometry(id: string) {
  const bytes = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
  const length = bytes.readUInt32LE(12), source = JSON.parse(bytes.subarray(20, 20 + length).toString());
  for (const material of source.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
  source.images = []; source.textures = [];
  const json = Buffer.from(JSON.stringify(source)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const binary = bytes.subarray(20 + length), result = Buffer.alloc(20 + padded.length + binary.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); binary.copy(result, 20 + padded.length);
  return new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
}

for (const id of ['neo', 'trinity', 'smith', 'morpheus']) test(`${id}: the actual pistol hand wraps the handle and places its index finger on the trigger when firing`, async t => {
  const names = [id, ...(id === 'neo' ? ['neo-office', 'neo-tracking'] : id === 'trinity' ? ['trinity-club'] : [])];
  const assets = new Map(await Promise.all(names.map(async name => [name, await geometry(name)] as const)));
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async (url: string) => assets.get(url.split('/').at(-1)!.replace('.glb', ''))!);
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const models = new CharacterModels(); t.after(() => { models.dispose(); globalThis.document = previous; });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const rig = models.create(world.agents.get(id)!);
  await new Promise<void>(resolve => setImmediate(resolve)); assert.ok(rig.hero);
  const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, armed: true, weaponStyle: 'hel_pistol' as const };
  const skin = rig.hero.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  const { position, skinIndex, skinWeight } = skin.geometry.attributes;
  let raisedIndex: THREE.Vector3 | undefined;
  for (const [pitch, age] of [[-.55, 10], [0, 10], [0, 0], [0, .08], [.55, .08], [0, .3], ...Array.from({ length: 21 }, (_, i) => [0, i / 100])]) {
    rig.motion.shotAge = age;
    models.animate(rig, 0, { ...input, aimPitch: pitch }, 0); rig.root.updateMatrixWorld(true); skin.skeleton.update();
    const gun = rig.weapons![0], wrist = rig.hero.bones.get('wrist_R')!;
    assert.ok(new THREE.Vector3(0, 0, 1).transformDirection(gun.matrixWorld)
      .dot(new THREE.Vector3(0, -Math.sin(pitch), Math.cos(pitch))) > .999, 'changing the hand grip cannot rotate the firing direction');
    if (pitch === 0) {
      const forearm = wrist.getWorldPosition(new THREE.Vector3()).sub(rig.hero.bones.get('elbow_R')!.getWorldPosition(new THREE.Vector3())).normalize();
      assert.ok(forearm.dot(new THREE.Vector3(0, 0, 1)) > .7, `neutral aim must not fold the wrist sharply across the forearm: ${forearm.toArray()}`);
    }
    const across = rig.hero.bones.get('finger3-1_R')!.getWorldPosition(new THREE.Vector3())
      .sub(rig.hero.bones.get('finger5-1_R')!.getWorldPosition(new THREE.Vector3())).normalize();
    assert.ok(new THREE.Vector3(0, 1, 0).transformDirection(gun.matrixWorld).dot(across) > .9, 'the three lower fingers must stack down the grip, not across the barrel');
    const solids = ['hel-pistol-grip', 'hel-pistol-slide', 'hel-pistol-magazine', 'hel-pistol-trigger'].map(name => gun.getObjectByName(name)! as THREE.Mesh);
    const guard = gun.children.find(object => object instanceof THREE.Mesh && object.geometry.type === 'TorusGeometry') as THREE.Mesh<THREE.TorusGeometry>;
    assert.ok(guard);
    const pads = Array.from({ length: 5 }, () => new THREE.Vector3()), counts = [0, 0, 0, 0, 0];
    let penetration = 0, deepest = '';
    for (let vertex = 0; vertex < position.count; vertex++) {
      let hand = 0;
      for (let part = 0; part < 4; part++) if (/^(wrist|finger).*_R$/.test(skin.skeleton.bones[skinIndex.getComponent(vertex, part)].name)) hand += skinWeight.getComponent(vertex, part);
      if (hand < .7) continue;
      const point = skin.localToWorld(skin.getVertexPosition(vertex, new THREE.Vector3()));
      for (const solid of solids) {
        const p = solid.worldToLocal(point.clone()), scale = solid.getWorldScale(new THREE.Vector3());
        const depth = Math.min((.5 - Math.abs(p.x)) * scale.x, (.5 - Math.abs(p.y)) * scale.y, (.5 - Math.abs(p.z)) * scale.z);
        if (depth > penetration) { penetration = depth; deepest = `${solid.name} at ${wrist.worldToLocal(point.clone()).toArray()}, ${[0, 1, 2, 3].map(part => `${skin.skeleton.bones[skinIndex.getComponent(vertex, part)].name}:${skinWeight.getComponent(vertex, part)}`).join(' ')}`; }
      }
      const ring = guard.worldToLocal(point.clone()), parameters = guard.geometry.parameters;
      const scale = guard.getWorldScale(new THREE.Vector3());
      const depth = (parameters.tube - Math.hypot(Math.hypot(ring.x, ring.y) - parameters.radius, ring.z)) * Math.min(scale.x, scale.y, scale.z);
      if (depth > penetration) { penetration = depth; deepest = `trigger guard at ${wrist.worldToLocal(point.clone()).toArray()}`; }
      for (let part = 0; part < 4; part++) {
        const match = /^finger([1-5])-3_R$/.exec(skin.skeleton.bones[skinIndex.getComponent(vertex, part)].name);
        if (match && skinWeight.getComponent(vertex, part) > .95) { pads[Number(match[1]) - 1].add(point); counts[Number(match[1]) - 1]++; }
      }
    }
    assert.ok(penetration < .003, `${id} ${pitch}/${age}: skin penetrates ${deepest} by ${penetration}`);
    pads.forEach((pad, i) => { assert.ok(counts[i] > 50); pad.divideScalar(counts[i]); });
    const gap = (point: THREE.Vector3, solid: THREE.Mesh) => {
      const p = solid.worldToLocal(point.clone()), scale = solid.getWorldScale(new THREE.Vector3());
      return new THREE.Vector3(Math.max(0, Math.abs(p.x) - .5) * scale.x, Math.max(0, Math.abs(p.y) - .5) * scale.y, Math.max(0, Math.abs(p.z) - .5) * scale.z).length();
    };
    for (const digit of [0, 2, 3, 4]) assert.ok(gap(pads[digit], solids[0]) < .04, `finger ${digit + 1} floats off the grip: ${gap(pads[digit], solids[0])}`);
    if (age === 0 || age === .08) assert.ok(gap(pads[1], solids[3]) < .025, `the firing index misses the actual trigger by ${gap(pads[1], solids[3])}`);
    if (pitch === 0 && age === 10) raisedIndex = wrist.worldToLocal(pads[1].clone());
    if (pitch === 0 && age === .08) assert.ok(raisedIndex!.distanceTo(wrist.worldToLocal(pads[1].clone())) > .025, 'firing must actually bend the index finger');
    for (const [name, rest] of rig.hero.rest) if (/^finger\d-\d_R$/.test(name)) assert.ok(rig.hero.bones.get(name)!.position.distanceTo(rest) < 1e-7, 'gripping cannot move or stretch the joints');
  }
  const cold = models.create(world.agents.get(id)!);
  await new Promise<void>(resolve => setImmediate(resolve)); assert.ok(cold.hero);
  const hand = [...rig.hero.bones].filter(([name]) => /^(wrist|finger).*_R$/.test(name));
  for (const age of [10, .08, .12]) {
    rig.motion.shotAge = cold.motion.shotAge = age;
    models.animate(rig, 0, input, 0);
    const frozen = new Map(hand.map(([name, bone]) => [name, bone.quaternion.clone()]));
    models.animate(rig, 0, input, 0); models.animate(cold, 0, input, 0);
    for (const [name, bone] of hand) {
      assert.ok(bone.quaternion.angleTo(frozen.get(name)!) < 1e-7, 'a frozen grip must not accumulate rotations');
      assert.ok(bone.quaternion.angleTo(cold.hero.bones.get(name)!.quaternion) < 1e-7, 'rebuilding the same pose must not depend on earlier shots');
    }
    models.animate(rig, 0, { ...input, weaponStyle: 'rifle' }, 0);
    models.animate(rig, 0, input, 0);
    for (const [name, bone] of hand) assert.ok(bone.quaternion.angleTo(frozen.get(name)!) < 1e-7, 're-equipping the pistol must restore its hand pose');
  }
  const relaxed = models.create(world.agents.get(id)!);
  await new Promise<void>(resolve => setImmediate(resolve)); assert.ok(relaxed.hero);
  models.animate(rig, 0, { ...input, armed: false }, 0);
  models.animate(relaxed, 0, { ...input, armed: false }, 0);
  assert.equal(rig.weapons![0].visible, false);
  for (const [name, bone] of hand) assert.ok(bone.quaternion.angleTo(relaxed.hero.bones.get(name)!.quaternion) < 1e-7, 'putting the pistol away must restore the ordinary hand');
});
