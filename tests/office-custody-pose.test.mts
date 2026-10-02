import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OFFICE_AGENT_ROLES, type OfficeCustody } from '@auto_matrix/shared';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { OfficeCustodyPerformance } from '../packages/client/src/agents/OfficeCustodyPerformance.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

async function loadGeometry(id: string) {
  const glb = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
  const length = glb.readUInt32LE(12), document = JSON.parse(glb.subarray(20, 20 + length).toString());
  for (const material of document.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = glb.subarray(20 + length), result = Buffer.alloc(20 + padded.length + bin.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16);
  padded.copy(result, 20); bin.copy(result, 20 + padded.length);
  return new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
}

test('the shipped cuffed body keeps bone lengths, puts the palms behind the shirt and reaches the actual upper arm', async t => {
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking', 'smith'].map(async id => [id, await loadGeometry(id)] as const)));
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async (url: string) => assets.get(url.split('/').at(-1)!.replace('.glb', ''))!);
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {} }) }) } as unknown as Document;
  const models = new CharacterModels(), performance = new OfficeCustodyPerformance();
  try {
    const world = new WorldState(); new AgentManager(world).initializeAllAgents();
    const rigs = new Map(['neo', ...OFFICE_AGENT_ROLES].map(id => [id, models.create(world.agents.get(id)!)]));
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.ok([...rigs.values()].every(rig => rig.hero), 'use the actual four shipped skeletons');
    const neo = rigs.get('neo')!; neo.root.rotation.y = Math.PI;
    const custody: OfficeCustody = { phase: 'securing', elapsed: 0, catcher: 'smith', leader: 'agent_brown', bodies: {
      smith: { position: { x: 0, y: 0, z: -1.85 }, yaw: 0 }, agent_brown: { position: { x: 3, y: 0, z: -3 }, yaw: 0 }, agent_jones: { position: { x: -3, y: 0, z: -3 }, yaw: 0 } } };
    let vertices = 0, cuffVertices = 0;
    for (const catcher of OFFICE_AGENT_ROLES) for (const elapsed of [0, .25, .7, 1.4, 2.4, 2.8, 3.2]) {
      custody.catcher = catcher; custody.elapsed = elapsed;
      for (const [id, rig] of rigs) {
        rig.root.position.set(id === 'neo' ? 0 : id === catcher ? 1.9 : id === 'agent_brown' ? 4 : -4, -1, id === 'neo' || id === catcher ? 0 : -4);
        if (id !== 'neo') rig.root.rotation.y = id === catcher ? Math.PI : 0;
        models.animate(rig, .05, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, officeShirt: id === 'neo', officeCustody: { role: id as 'neo' | typeof catcher, phase: 'securing', elapsed } }, 0);
      }
      const bones = new Map([...rigs].map(([id, rig]) => [id, new Map([...rig.hero!.bones].map(([name, bone]) => [name, bone.position.clone()]))]));
      performance.update(neo.hero, rigs.get(catcher)!.hero, custody);
      const pelvis = neo.hero!.bones.get('pelvis')!;
      for (const side of ['R', 'L']) {
        const wrist = neo.hero!.bones.get(`wrist_${side}`)!, cuff = wrist.getObjectByName(`office-cuff-${side}`)!;
        assert.ok(cuff); assert.equal(cuff.visible, elapsed >= 2.4);
        if (elapsed >= 2.8) {
          const palm = wrist.localToWorld(new THREE.Vector3(side === 'R' ? .065 : -.065, -.17, .01));
          const target = pelvis.localToWorld(new THREE.Vector3(side === 'R' ? -.15 : .15, -.04, -.42));
          assert.ok(palm.distanceTo(target) < .04, `the cuffed hand must reach the rear target: ${side}, ${palm.distanceTo(target)}`);
          neo.hero!.root.traverse(mesh => {
            if (!(mesh instanceof THREE.SkinnedMesh) || !mesh.visible) return;
            mesh.skeleton.update();
            const indices = mesh.geometry.attributes.skinIndex, weights = mesh.geometry.attributes.skinWeight;
            for (let i = 0; i < indices.count; i++) {
              if (![0, 1, 2, 3].some(j => weights.getComponent(i, j) > .25 && mesh.skeleton.bones[indices.getComponent(i, j)].name === `wrist_${side}`)) continue;
              const point = cuff.worldToLocal(mesh.localToWorld(mesh.getVertexPosition(i, new THREE.Vector3()))); cuffVertices++;
              const tube = Math.hypot(Math.hypot(point.x, point.y) - .105, point.z);
              assert.ok(tube >= .01, `the cuff intersects the shipped wrist surface: ${side}, ${point.toArray()}, depth ${.012 - tube}`);
            }
          });
        }
      }
      for (const [id, rig] of rigs) {
        for (const [name, position] of bones.get(id)!) assert.ok(rig.hero!.bones.get(name)!.position.distanceTo(position) < 1e-7, 'grip animation cannot stretch a limb');
        rig.hero!.root.traverse(mesh => {
          if (!(mesh instanceof THREE.SkinnedMesh) || !mesh.visible) return;
          mesh.skeleton.update();
          for (let i = 0; i < mesh.geometry.attributes.position.count; i += 17) {
            const point = mesh.getVertexPosition(i, new THREE.Vector3()); vertices++;
            assert.ok(point.toArray().every(Number.isFinite), 'actual skin must remain finite through the IK transition');
          }
        });
      }
      if (elapsed >= 2.8) {
        const side = ['R', 'L'].sort((a, b) => neo.hero!.bones.get(`elbow_${a}`)!.getWorldPosition(new THREE.Vector3()).distanceToSquared(rigs.get(catcher)!.hero!.root.getWorldPosition(new THREE.Vector3()))
          - neo.hero!.bones.get(`elbow_${b}`)!.getWorldPosition(new THREE.Vector3()).distanceToSquared(rigs.get(catcher)!.hero!.root.getWorldPosition(new THREE.Vector3())))[0];
        const upper = neo.hero!.bones.get(`shoulder_${side}`)!.getWorldPosition(new THREE.Vector3()), elbow = neo.hero!.bones.get(`elbow_${side}`)!.getWorldPosition(new THREE.Vector3());
        const center = upper.clone().lerp(elbow, .65), axis = elbow.clone().sub(upper).normalize();
        const normal = rigs.get(catcher)!.hero!.root.getWorldPosition(new THREE.Vector3()).sub(center); normal.addScaledVector(axis, -normal.dot(axis)).normalize();
        const contact = center.addScaledVector(normal, .14);
        const gap = Math.min(...['R', 'L'].map(side => rigs.get(catcher)!.hero!.bones.get(`wrist_${side}`)!.localToWorld(new THREE.Vector3(side === 'R' ? .065 : -.065, -.17, .01)).distanceTo(contact)));
        assert.ok(gap < .15, `the nearest guard hand must actually reach Neo, rather than float: ${JSON.stringify({ catcher, gap, contact: contact.toArray(), side,
          hands: ['R', 'L'].map(hand => ({ hand, shoulder: rigs.get(catcher)!.hero!.bones.get(`shoulder_${hand}`)!.getWorldPosition(new THREE.Vector3()).toArray(),
            wrist: rigs.get(catcher)!.hero!.bones.get(`wrist_${hand}`)!.getWorldPosition(new THREE.Vector3()).toArray(),
            a: rigs.get(catcher)!.hero!.bones.get(`elbow_${hand}`)!.position.length(), b: rigs.get(catcher)!.hero!.bones.get(`wrist_${hand}`)!.position.length() })) })}`);
      }
    }
    assert.ok(vertices > 10000);
    assert.ok(cuffVertices > 1000, 'check actual wrist skin against both visible cuffs');
    performance.update(neo.hero, undefined, undefined);
    assert.equal(neo.hero!.bones.get('wrist_R')!.getObjectByName('office-cuff-R')!.visible, false);
    performance.dispose(); assert.equal(neo.hero!.root.getObjectByName('office-cuff-chain'), undefined);
  } finally { performance.dispose(); models.dispose(); globalThis.document = previous; }
});
