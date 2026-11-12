import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { filmPosition, type BurlyEncounter } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';

async function character(id: string) {
  const bytes = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
  const length = bytes.readUInt32LE(12), gltf = JSON.parse(bytes.subarray(20, 20 + length).toString());
  for (const material of gltf.materials) { delete material.pbrMetallicRoughness?.baseColorTexture; delete material.normalTexture; }
  gltf.images = []; gltf.textures = [];
  const json = Buffer.from(JSON.stringify(gltf)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const binary = bytes.subarray(20 + length), buffer = Buffer.alloc(20 + padded.length + binary.length);
  buffer.writeUInt32LE(0x46546c67, 0); buffer.writeUInt32LE(2, 4); buffer.writeUInt32LE(buffer.length, 8);
  buffer.writeUInt32LE(padded.length, 12); buffer.writeUInt32LE(0x4e4f534a, 16); padded.copy(buffer, 20); binary.copy(buffer, 20 + padded.length);
  return new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '');
}

test('Neo sees the held courtyard staff in first person without his face covering the camera', async t => {
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking'].map(async id => [id, await character(id)] as const)));
  t.mock.method(GLTFLoader.prototype, 'loadAsync', (url: string) => Promise.resolve(assets.get(url.split('/').at(-1)!.slice(0, -4))));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const ctx = { createRadialGradient: () => ({ addColorStop() {} }), createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, stroke() {}, ellipse() {}, fill() {}, putImageData() {} };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => ({ getContext: () => ctx }) } });
  const scene = new THREE.Scene(), renderer = new AgentRenderer(scene), world = new WorldState();
  t.after(() => { renderer.dispose(); if (previous) Object.defineProperty(globalThis, 'document', previous); else Reflect.deleteProperty(globalThis, 'document'); });
  new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!, set = 'film_oracle_courtyard';
  Object.assign(neo, { currentLocation: set, isInMatrix: true, rotation: 0, position: filmPosition(set, 0, 0), velocity: { x: 0, y: 0, z: 0 } });
  renderer.setWorld(true); renderer.updateAgent('neo', neo);
  for (let frame = 0; frame < 8; frame++) { await new Promise(resolve => setImmediate(resolve)); renderer.update(0); }
  const hero = renderer.getAgentHero('neo'), body = renderer.getAgentBody('neo');
  assert.ok(hero && body, 'test the delivered body and the real player visibility');
  const skin = hero.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  assert.ok(skin?.isSkinnedMesh);
  const update = (phase: BurlyEncounter['phase'], firstPerson: boolean) => {
    const burly = { phase, role: 'neo' as const, elapsed: 0, attempt: 1, repelled: 2, staffSwings: 0, assimilation: 0, nextCopyAt: 9 };
    neo.currentAction = { type: 'idle', parameters: { player: true, resolved: true, burly }, startedAt: 8, duration: 1, progress: 0 };
    renderer.updateAgent('neo', neo); renderer.setPlayer('neo', firstPerson);
    renderer.getAgent('neo')!.position.set(neo.position.x, neo.position.y, neo.position.z); body.rotation.y = 0;
    renderer.setPlayerMotion({ speed: 0, turn: 0, grounded: true, verticalVelocity: 0, firstPerson, burly });
    renderer.update(0); scene.updateMatrixWorld(true);
  };
  update('staff', false);
  const staff = hero.getObjectByName('burly-fence-staff');
  assert.ok(staff?.visible && body.visible);
  const thirdPersonSkin = skin.geometry;
  const camera = new THREE.PerspectiveCamera(68, 16 / 9, .5, 100);
  camera.position.set(neo.position.x, neo.position.y + 2.99, neo.position.z);
  camera.lookAt(neo.position.x, camera.position.y - Math.sin(.1), neo.position.z + Math.cos(.1));
  camera.updateMatrixWorld(true);
  for (const phase of ['staff', 'flight_ready'] as const) {
    update(phase, true);
    assert.ok(body.visible && staff.visible, `${phase}: keep the held staff visible with the player camera`);
    assert.notEqual(skin.geometry, thirdPersonSkin, 'use the existing headless first-person skin');
    const grip = staff.getWorldPosition(new THREE.Vector3()).project(camera);
    assert.ok(Math.abs(grip.x) < 1 && Math.abs(grip.y) < 1 && Math.abs(grip.z) < 1, `${phase}: grip is outside the default first-person frame ${grip.toArray()}`);
    for (const side of ['R', 'L']) {
      const wrist = hero.getObjectByName(`wrist_${side}`)!;
      const palm = staff.worldToLocal(wrist.localToWorld(new THREE.Vector3(0, -.19, .035)));
      assert.ok(Math.hypot(palm.x, palm.z) < .1 && Math.abs(palm.y) < 2.85, `${phase}: ${side} palm misses the shaft ${palm.toArray()}`);
    }
  }
  update('flight', true);
  assert.equal(staff.visible, false);
  assert.equal(body.visible, false);
});
