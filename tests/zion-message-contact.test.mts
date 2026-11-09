import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, ZION_MESSAGE, ZION_MESSAGE_ROLES, newZionMessage, zionMessageTrinity, filmPosition, type ZionMessageEncounter, type ZionMessageGesture } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { ZionHomecomingRenderer } from '../packages/client/src/engine/ZionHomecomingRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

async function geometry(id: string) {
  const bytes = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url)), length = bytes.readUInt32LE(12), document = JSON.parse(bytes.subarray(20, 20 + length).toString());
  for (const material of document.materials) { delete material.pbrMetallicRoughness?.baseColorTexture; delete material.normalTexture; }
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const binary = bytes.subarray(20 + length), buffer = Buffer.alloc(20 + padded.length + binary.length);
  buffer.writeUInt32LE(0x46546c67, 0); buffer.writeUInt32LE(2, 4); buffer.writeUInt32LE(buffer.length, 8); buffer.writeUInt32LE(padded.length, 12); buffer.writeUInt32LE(0x4e4f534a, 16); padded.copy(buffer, 20); binary.copy(buffer, 20 + padded.length);
  return new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '');
}
async function setup(t: test.TestContext) {
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking', 'trinity', 'trinity-club', 'morpheus'].map(async id => [id, await geometry(id)] as const)));
  t.mock.method(GLTFLoader.prototype, 'loadAsync', (url: string) => assets.has(url.split('/').at(-1)!.slice(0, -4)) ? Promise.resolve(assets.get(url.split('/').at(-1)!.slice(0, -4))) : new Promise(() => {}));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const old = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  const ctx = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, stroke() {}, ellipse() {}, fill() {}, createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} };
  Object.assign(globalThis, { window: new EventTarget(), document: { createElement: () => ({ getContext: () => ctx }) } });
  const scene = new THREE.Scene(), center = FILM_SETS.film_zion_bedroom.center, root = new THREE.Group(); root.position.set(center.x, center.y - 1, center.z); scene.add(root);
  const room = new ZionHomecomingRenderer(root, 'film_zion_bedroom'), renderer = new AgentRenderer(scene), world = new WorldState(); new AgentManager(world).initializeAllAgents(); renderer.setWorld(false);
  const pose = (state: ZionMessageEncounter, first = false, elapsed = 0) => {
    for (const role of ZION_MESSAGE_ROLES) {
      const actor = structuredClone(world.agents.get(role)!), point = state.bodies[role], gesture: ZionMessageGesture = { ...state, role };
      Object.assign(actor, { currentLocation: 'film_zion_bedroom', isInMatrix: false, position: filmPosition('film_zion_bedroom', point.x, point.z), rotation: point.yaw, velocity: { x: 0, y: 0, z: 0 },
        currentAction: { type: 'idle', parameters: { resolved: true, player: role === 'neo', zionMessage: gesture }, startedAt: 9400, duration: 1e9, progress: 0 } }); renderer.updateAgent(role, actor);
    }
    renderer.setPlayer('neo', first); const neo = renderer.getAgentState('neo')!; renderer.getAgent('neo')!.position.set(neo.position.x, neo.position.y, neo.position.z); renderer.getAgentBody('neo')!.rotation.y = neo.rotation;
    renderer.setPlayerMotion({ speed: 0, turn: 0, grounded: true, verticalVelocity: 0, realWorld: true, firstPerson: first, zionMessage: { ...state, role: 'neo' } });
    renderer.update(0); room.update({ scene: 'm2_oracle_message', step: state.phase === 'done' ? 2 : state.door === 1 ? 1 : 0, completed: [], zionMessage: state } as never, elapsed); scene.updateMatrixWorld(true);
  };
  pose(newZionMessage()); for (let frame = 0; frame < 12; frame++) { await new Promise(resolve => setImmediate(resolve)); renderer.update(0); }
  for (const id of ['neo', 'trinity', 'ballard']) assert.ok(renderer.getAgentHero(id), id + ': retain the delivered full character');
  t.after(() => { renderer.dispose(); room.dispose(); ['window', 'document'].forEach((key, i) => { if (old[i]) Object.defineProperty(globalThis, key, old[i]!); else Reflect.deleteProperty(globalThis, key); }); });
  const palm = (id: string) => renderer.getAgentHero(id)!.getObjectByName('wrist_R')!.localToWorld(new THREE.Vector3(0, -.19, .035));
  return { root, room, renderer, pose, palm };
}

test('Trinity reaches the physical door handle throughout its real swing in either camera view', async t => {
  const h = await setup(t), misses: unknown[] = [];
  for (const first of [false, true]) for (const door of [0, .2, .4, .6, .8, 1]) {
    const state = newZionMessage(); Object.assign(state, { phase: door ? 'opening' : 'unlatching', door, elapsed: door ? door * ZION_MESSAGE.opening : ZION_MESSAGE.unlatch }); state.bodies.trinity = zionMessageTrinity(door); h.pose(state, first);
    const handle = h.root.getObjectByName('zion-message-door-handle')!, target = handle.localToWorld(new THREE.Vector3(0, 0, -ZION_MESSAGE.handle.radius)), gap = h.palm('trinity').distanceTo(target);
    if (gap >= .08) misses.push({ first, door, gap });
  }
  assert.equal(misses.length, 0, JSON.stringify(misses));
});

test('moving and paused Trinity retain the saved door-facing pose instead of facing her walking velocity', async t => {
  const h = await setup(t), misses: unknown[] = [];
  for (const first of [false, true]) for (const door of [.205, .6]) for (const speed of [1, 0]) {
    const state = newZionMessage(); Object.assign(state, { phase: 'opening', door, elapsed: door * ZION_MESSAGE.opening }); state.bodies.trinity = zionMessageTrinity(door); h.pose(state, first);
    const before = zionMessageTrinity(door - .01), point = state.bodies.trinity;
    h.renderer.getAgentState('trinity')!.velocity = { x: (point.x - before.x) / .03, y: 0, z: (point.z - before.z) / .03 };
    for (let frame = 0; frame < 4; frame++) h.renderer.update(.03, undefined, speed);
    const handle = h.root.getObjectByName('zion-message-door-handle')!, gap = h.palm('trinity').distanceTo(handle.localToWorld(new THREE.Vector3(0, 0, -ZION_MESSAGE.handle.radius)));
    const yaw = h.renderer.getAgentBody('trinity')!.rotation.y, difference = Math.atan2(Math.sin(yaw - point.yaw), Math.cos(yaw - point.yaw));
    if (Math.abs(difference) > .001 || gap >= .08) misses.push({ first, door, speed, difference, gap });
  }
  assert.equal(misses.length, 0, JSON.stringify(misses));
});

test('the single disk stays under the actual holder palm while offered, received and stowed, independent of browser time', async t => {
  const h = await setup(t), misses: unknown[] = [];
  const cases = [['entering', .4, 'ballard'], ['presenting', .45, 'ballard'], ['offer', 0, 'ballard'], ['taking', .9, 'ballard'], ['transfer', .1, 'ballard'], ['transfer', .4, 'neo'], ['stowing', .3, 'neo'], ['stowing', .8, 'neo']] as const;
  for (const first of [false, true]) for (const [phase, elapsed, owner] of cases) {
    const state = newZionMessage(1); Object.assign(state, { phase, elapsed, owner }); state.bodies.neo.yaw = Math.atan2(state.bodies.ballard.x - state.bodies.neo.x, state.bodies.ballard.z - state.bodies.neo.z); h.pose(state, first);
    const disk = h.root.getObjectByName('oracle-message-disk')!; assert.equal(disk.visible, true); assert.equal(h.root.getObjectsByProperty('name', 'oracle-message-disk').length, 1);
    for (const role of phase === 'taking' || phase === 'transfer' && owner === 'ballard' ? ['ballard', 'neo'] : [owner]) {
      const point = disk.worldToLocal(h.palm(role)), horizontal = Math.hypot(point.x, point.z), vertical = Math.abs(point.y + .035);
      if (horizontal > ZION_MESSAGE.diskRadius + .05 || vertical >= .08) misses.push({ first, phase, elapsed, role, horizontal, vertical });
    }
    const before = disk.getWorldPosition(new THREE.Vector3()).toArray(); h.pose(structuredClone(state), first, 300); assert.deepEqual(disk.getWorldPosition(new THREE.Vector3()).toArray(), before);
  }
  const done = newZionMessage(2); h.pose(done); assert.equal(h.root.getObjectByName('oracle-message-disk')!.visible, false);
  assert.equal(misses.length, 0, JSON.stringify(misses.slice(0, 8)));
});
