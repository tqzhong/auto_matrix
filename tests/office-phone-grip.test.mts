import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { officeCrossingPose } from '@auto_matrix/shared';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import type { MotionInput } from '../packages/client/src/agents/CharacterMotion.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

async function loadGeometry(id: string) {
  const glb = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
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

test('the shipped office hand clears the handset casing while lifting, listening, crouching and crossing the window', async t => {
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking'].map(async id => [id, await loadGeometry(id)] as const)));
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async (url: string) => assets.get(url.split('/').at(-1)!.replace('.glb', ''))!);
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {} }) }) } as unknown as Document;
  const models = new CharacterModels();
  try {
    const world = new WorldState(); new AgentManager(world).initializeAllAgents();
    const rig = models.create(world.agents.get('neo')!);
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.ok(rig.hero, 'the normal character factory must finish loading the shipped skinned body');
    const input: MotionInput = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, officeShirt: true };
    const poses: Partial<MotionInput>[] = [
      ...[.65, 1.1, 1.7, 2.2].map(elapsed => ({ phone: { phase: 'pickup' as const, elapsed } })),
      { phone: { phase: 'ready', elapsed: 0 } },
      ...[.35, .7, 1.3, 2, 8].map(elapsed => ({ phone: { phase: 'answering' as const, elapsed } })),
      { phone: { phase: 'connected', elapsed: 11 } },
      { speed: 1.6, turn: .6, crouching: true, phone: { phase: 'connected', elapsed: 11 } },
      ...[.8, 1.7, 2.7, 3.5, 5.4].map(crossing => ({ crossing, phone: { phase: 'connected' as const, elapsed: 11 } })),
    ];
    const point = new THREE.Vector3(); let checked = 0;
    for (const pose of poses) {
      const crossing = pose.crossing === undefined ? undefined : officeCrossingPose(pose.crossing);
      rig.root.position.set(crossing?.x ?? 0, crossing?.y ?? 0, crossing?.z ?? 0); rig.root.rotation.y = crossing?.yaw ?? 0;
      models.animate(rig, .05, { ...input, ...pose }, 0); rig.root.updateMatrixWorld(true);
      assert.ok(rig.phone?.root.visible, 'the normal renderer must attach and show the handset');
      rig.hero.root.traverse(mesh => {
        if (!(mesh instanceof THREE.SkinnedMesh) || !mesh.visible) return;
        mesh.skeleton.update();
        const indices = mesh.geometry.attributes.skinIndex, weights = mesh.geometry.attributes.skinWeight;
        for (let i = 0; i < indices.count; i++) {
          const finger = [0, 1, 2, 3].some(j => weights.getComponent(i, j) > .25 && /^finger\d-\d_R$/.test(mesh.skeleton.bones[indices.getComponent(i, j)].name));
          if (!finger) continue;
          checked++;
          mesh.getVertexPosition(i, point); mesh.localToWorld(point); rig.phone!.root.worldToLocal(point);
          // A conservative interior of the actual curved casing, excluding its rounded corners.
          const curve = point.y * point.y * .23;
          const depth = Math.min(.061 - Math.abs(point.x), .18 - Math.abs(point.y), point.z - curve + .023, .024 + curve - point.z);
          assert.ok(depth <= .001, `${mesh.name} finger enters the solid handset by ${depth}: ${point.toArray()}, pose ${JSON.stringify(pose)}`);
        }
      });
      for (const [name, rest] of rig.hero.rest) if (/^finger\d-\d_R$/.test(name)) {
        assert.ok(rig.hero.bones.get(name)!.position.distanceTo(rest) < 1e-7, 'holding the phone cannot stretch or relocate a finger joint');
      }
    }
    assert.ok(checked > 10000, 'check the actual finger surfaces rather than wrist positions alone');
    models.animate(rig, .05, input, 0);
    assert.equal(rig.phone!.root.visible, false, 'putting the phone away restores ordinary hand animation');
  } finally { models.dispose(); globalThis.document = document; }
});
