import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import type { CharacterRig } from '../packages/client/src/agents/CharacterModel.js';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { FILM_SETS, truckRescuePose, type TruckEncounter, type PlayerInput } from '@auto_matrix/shared';

async function loadGeometry(id = 'neo') {
  const glb = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
  const jsonLength = glb.readUInt32LE(12);
  const document = JSON.parse(glb.subarray(20, 20 + jsonLength).toString());
  // Decode the shipped geometry with the real loader, without a DOM/image
  // decoder. Material/texture appearance is checked in the browser.
  for (const material of document.materials) {
    delete material.pbrMetallicRoughness.baseColorTexture;
    delete material.normalTexture;
  }
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document));
  const padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = glb.subarray(20 + jsonLength);
  const result = Buffer.alloc(20 + padded.length + bin.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16);
  padded.copy(result, 20); bin.copy(result, 20 + padded.length);
  return new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
}


async function setup(t: TestContext) {
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking', 'morpheus'].map(async id => [id, await loadGeometry(id)] as const)));
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async (path: string) => assets.get(path.split('/').pop()!.replace(/\.glb.*$/, ''))!);
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  class InputTarget extends EventTarget { matches() { return false; } }
  const window = new InputTarget(), canvas = new InputTarget();
  const context = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} };
  const document = Object.assign(new InputTarget(), { pointerLockElement: null as unknown, hidden: false, exitPointerLock() {},
    createElement: () => ({ width: 0, height: 0, getContext: () => context }) });
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  Object.assign(globalThis, { window, document });
  let time = 2000; t.mock.method(performance, 'now', () => time);
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const actors = ['neo', 'morpheus', 'keymaker'].map(id => world.agents.get(id)!);
  const state = actors[1];
  for (const actor of actors) { actor.currentLocation = 'film_freeway_trucks'; actor.isInMatrix = true; }
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000), renderer = new AgentRenderer(new THREE.Scene());
  for (const actor of actors) renderer.updateAgent(actor.id, actor);
  await new Promise(resolve => setImmediate(resolve));
  const group = renderer.getAgent(state.id)!, head = group.getObjectByName('head');
  assert.ok(head instanceof THREE.Bone, 'the camera must follow the shipped GLB head, not a mock position');
  const sent: PlayerInput[] = [];
  const controls = new PlayerControls(canvas as unknown as HTMLCanvasElement, camera, input => sent.push(input), () => {});
  controls.possess(state); controls.firstPerson = true;
  const frame = (elapsed: number, running = false) => {
    const encounter: TruckEncounter = { phase: 'rescue', elapsed: 9.7, rescueElapsed: elapsed, lastTick: 0, attempt: 0 };
    const center = FILM_SETS.film_freeway_trucks.center;
    for (const actor of actors) {
      const role = actor.id as 'neo' | 'morpheus' | 'keymaker', pose = truckRescuePose(encounter, role);
      actor.position = { x: center.x + pose.x, y: center.y + pose.y, z: center.z + pose.z }; actor.rotation = pose.yaw;
      actor.currentAction = { type: 'move_to', parameters: { truckFlight: role === 'neo', truckPassenger: role !== 'neo',
        truckRescue: { ...encounter, role } }, startedAt: 0, duration: 1000, progress: 0 };
      renderer.updateAgent(actor.id, actor);
    }
    time += 20;
    // Engine solves input/camera first, then the actual body; the camera must be corrected before rendering.
    controls.update(.02, state, group, running); renderer.setPlayer(state.id, controls.firstPerson); renderer.setPlayerMotion(controls.motion);
    renderer.update(.02, camera, running ? 1 : 0);
    const inputCount = sent.length;
    controls.syncTruckRescueCamera(group);
    assert.equal(sent.length, inputCount, 'post-pose camera correction must not send player input again');
    return head!.localToWorld(new THREE.Vector3(0, .1, .32));
  };
  const look = () => { document.pointerLockElement = canvas; document.dispatchEvent(Object.assign(new Event('mousemove'), { movementX: 140, movementY: -50 })); };
  t.after(() => { controls.dispose(); renderer.dispose(); ['window', 'document'].forEach((key, i) => {
    if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!); else Reflect.deleteProperty(globalThis, key);
  }); });
  const crewPoints = () => {
    const entries = (renderer as unknown as { agents: Map<string, { rig: CharacterRig }> }).agents;
    return actors.flatMap(actor => {
      const rig = entries.get(actor.id)!.rig; rig.root.updateWorldMatrix(true, true);
      const head = rig.hero?.bones.get('head') ?? rig.head, chest = rig.hero?.bones.get('chest');
      return [{ role: actor.id, part: 'head', point: head.getWorldPosition(new THREE.Vector3()) },
        { role: actor.id, part: 'chest', point: chest ? chest.getWorldPosition(new THREE.Vector3()) : rig.torso.localToWorld(new THREE.Vector3(0, 1.25, 0)) }];
    });
  };
  return { controls, camera, group, frame, look, sent, crewPoints };
}

test('a cold-loaded truck first-person camera uses the current GLB pose in the first rendered frame', async t => {
  const h = await setup(t);
  for (const elapsed of [1.7, .1, .35, 2.8, 2.95]) {
    const eye = h.frame(elapsed);
    assert.ok(h.camera.position.distanceTo(eye) < .0001,
      `${elapsed}s camera uses the previous body frame: eye error ${h.camera.position.distanceTo(eye)}`);
  }
});

test('post-pose truck camera preserves pause, free look and the third-person camera', async t => {
  const h = await setup(t); h.frame(1.7);
  const paused = h.camera.position.clone(), beforeLook = h.camera.getWorldDirection(new THREE.Vector3());
  h.frame(1.7); assert.ok(h.camera.position.distanceTo(paused) < .0001, 'a paused rescue camera cannot creep toward an old skeleton pose');
  h.look(); const eye = h.frame(1.7);
  assert.ok(h.camera.position.distanceTo(eye) < .0001);
  assert.ok(h.camera.getWorldDirection(new THREE.Vector3()).distanceTo(beforeLook) > .1, 'the pose correction must preserve mouse yaw and pitch');
  h.controls.firstPerson = false; h.frame(1.7);
  const third = h.camera.position.clone(), direction = h.camera.getWorldDirection(new THREE.Vector3());
  h.controls.syncTruckRescueCamera(h.group);
  assert.deepEqual(h.camera.position, third); assert.deepEqual(h.camera.getWorldDirection(new THREE.Vector3()), direction);
});

for (const aspect of [16 / 9, 9 / 16]) test(`the airborne truck camera frames the real three-person heads and chests at aspect ${aspect}`, async t => {
  const h = await setup(t); h.controls.firstPerson = false; h.camera.aspect = aspect;
  for (const elapsed of [1.6, 1.7, 1.8]) {
    h.frame(elapsed); h.camera.updateMatrixWorld(true);
    for (const { role, part, point } of h.crewPoints()) {
      const screen = point.project(h.camera);
      assert.ok(Math.abs(screen.x) < .72 && Math.abs(screen.y) < .5 && screen.z > -1 && screen.z < 1,
        `${elapsed}s ${role} ${part} is outside the central frame: ${screen.toArray()}`);
    }
  }
});
