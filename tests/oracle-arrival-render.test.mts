import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, ORACLE_ENTRANCE, oracleArrivalDoor, oracleArrivalHandle, oracleArrivalLength, oracleArrivalRoot, filmPosition, type OracleArrival, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';

test('the real Oracle doorway blocks sight when closed and opens onto a grounded hallway', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const document = globalThis.document;
  const context = { fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, fill() {}, ellipse() {} };
  globalThis.document = { createElement: () => ({ getContext: () => context }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!; neo.position = filmPosition('film_oracle_home', 0, 34); neo.isInMatrix = true;
  const arrival: OracleArrival = { phase: 'waiting', elapsed: 0, hostess: 0, morpheus: 9, seating: 0 };
  const journey = { scene: 'm1_spoon', actor: 'neo', step: 0, oracle: { arrival } } as FilmJourney;
  const sandbox = { neoLife: { journey } } as SandboxState;
  const renderer = new FilmSetRenderer(new THREE.Scene()), ray = new THREE.Raycaster();
  const blockers = (x: number, y: number, z: number, direction: THREE.Vector3, far: number) => {
    ray.set(renderer.root.localToWorld(new THREE.Vector3(x, y, z)), direction); ray.far = far;
    return ray.intersectObject(renderer.root, true).filter(hit => {
      const mesh = hit.object as THREE.Mesh;
      return mesh.castShadow && !Array.isArray(mesh.material) && !mesh.material.transparent;
    });
  };
  try {
    renderer.update(neo, sandbox, 0); renderer.root.updateMatrixWorld(true);
    assert.ok(blockers(0, 3, 32, new THREE.Vector3(0, 0, -1), 5).length > 0);
    arrival.phase = 'guiding'; arrival.morpheus = 0;
    renderer.update(neo, sandbox, 1); renderer.root.updateMatrixWorld(true);
    assert.equal(blockers(0, 3, 32, new THREE.Vector3(0, 0, -1), 5).length, 0, 'the entrance cannot remain a painted door on a solid wall');
    for (const x of [-8, 8]) assert.ok(blockers(x, 3, 31, new THREE.Vector3(0, 0, -1), 3).length > 0);
    assert.ok(blockers(-2.7, 3, 27.4, new THREE.Vector3(1, 0, 0), .6).length > 0, 'the opened leaf swings into the same physical footprint as its collision');
    assert.ok(blockers(0, 2, 44, new THREE.Vector3(0, -1, 0), 3).length > 0, 'the hall has a rendered floor rather than an invisible extension of physics');
    const door = renderer.root.getObjectByName('oracle-apartment-door')!;
    assert.ok(door); assert.equal(door.rotation.y, Math.PI / 2);
    renderer.update(neo, sandbox, 1); assert.equal(door.rotation.y, Math.PI / 2, 'a paused update preserves the door angle');
    renderer.update(undefined, undefined, 2); assert.equal(renderer.root.getObjectByName('oracle-apartment-door'), undefined, 'streaming releases the entrance with its room');
  } finally { renderer.dispose(); globalThis.document = document; }
});

test('a paused opening save restores the hostess facing the knob without waiting for animation time', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  const document = globalThis.document;
  const context = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ getContext: () => context }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const actor = world.agents.get('oracle_priestess')!;
  const arrival: OracleArrival = { phase: 'opening', elapsed: 1, hostess: 0, morpheus: 9, seating: 0 }, pose = oracleArrivalRoot(arrival, 'hostess');
  actor.position = filmPosition('film_oracle_home', pose.x, pose.z); actor.rotation = pose.yaw; actor.isInMatrix = true;
  actor.currentAction = { type: 'idle', parameters: { resolved: true, oracleArrival: { ...arrival, role: 'hostess' } }, startedAt: 0, duration: 1, progress: 0 };
  const renderer = new AgentRenderer(new THREE.Scene());
  try {
    renderer.updateAgent(actor.id, actor); renderer.update(0);
    assert.ok(Math.abs(renderer.getAgentBody(actor.id)!.rotation.y - pose.yaw) < .01, 'restoring a paused grasp must orient the body immediately, or its hand pose reaches from the wrong shoulder');
  } finally { renderer.dispose(); globalThis.document = document; }
});

test('the actual hostess hand reaches the turning knob and Morpheus settles with grounded shoes', async t => {
  const assets = new Map();
  for (const name of ['trinity', 'morpheus']) {
    const glb = await readFile(new URL(`../packages/client/public/assets/characters/${name}.glb`, import.meta.url));
    const length = glb.readUInt32LE(12), source = JSON.parse(glb.subarray(20, 20 + length).toString());
    for (const material of source.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
    source.images = []; source.textures = [];
    const json = Buffer.from(JSON.stringify(source)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
    const bin = glb.subarray(20 + length), buffer = Buffer.alloc(20 + padded.length + bin.length);
    buffer.writeUInt32LE(0x46546c67, 0); buffer.writeUInt32LE(2, 4); buffer.writeUInt32LE(buffer.length, 8);
    buffer.writeUInt32LE(padded.length, 12); buffer.writeUInt32LE(0x4e4f534a, 16); padded.copy(buffer, 20); bin.copy(buffer, 20 + padded.length);
    assets.set(name, await new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), ''));
  }
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async (url: string) => assets.get(url.includes('morpheus') ? 'morpheus' : 'trinity'));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const models = new CharacterModels(), hostess = models.create(world.agents.get('oracle_priestess')!), morpheus = models.create(world.agents.get('morpheus')!);
  const center = FILM_SETS.film_oracle_home.center, input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, glasses: false };
  try {
    await new Promise(resolve => setImmediate(resolve)); assert.ok(hostess.hero); assert.ok(morpheus.hero);
    for (const elapsed of [.4, .7, 1, 1.4, 1.6]) {
      const arrival: OracleArrival = { phase: 'opening', elapsed, hostess: 0, morpheus: 9, seating: 0 }, place = oracleArrivalRoot(arrival, 'hostess');
      hostess.root.position.set(center.x + place.x, center.y - 1, center.z + place.z); hostess.root.rotation.y = place.yaw;
      models.animate(hostess, 0, { ...input, oracleArrival: { ...arrival, role: 'hostess' } }, 4); hostess.root.updateWorldMatrix(true, true);
      const angle = oracleArrivalDoor(arrival), knob = oracleArrivalHandle(arrival);
      const contact = new THREE.Vector3(center.x + knob.x - .13 * Math.sin(angle), center.y - 1 + knob.y, center.z + knob.z - .13 * Math.cos(angle));
      const palm = hostess.hero.bones.get('wrist_R')!.localToWorld(new THREE.Vector3(0, -.19, .035));
      assert.ok(palm.distanceTo(contact) < .07, `the turning knob cannot float beyond the hostess palm at ${elapsed}: ${palm.distanceTo(contact)}`);
    }
    for (const seating of [.01, .4, 1.1, 1.8, 2.2]) {
      const arrival: OracleArrival = { phase: 'settling', elapsed: 0, hostess: 0, morpheus: oracleArrivalLength('morpheus'), seating }, place = oracleArrivalRoot(arrival, 'morpheus');
      morpheus.root.position.set(center.x + place.x, center.y - 1, center.z + place.z); morpheus.root.rotation.y = place.yaw;
      models.animate(morpheus, 0, { ...input, oracleArrival: { ...arrival, role: 'morpheus' } }, 4); morpheus.root.updateWorldMatrix(true, true);
      let sole = Infinity;
      for (const part of morpheus.hero.wardrobe) {
        const mesh = part.mesh; if (!mesh.visible || Array.isArray(mesh.material)) continue;
        const vertex = new THREE.Vector3();
        for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
          mesh.getVertexPosition(i, vertex); mesh.localToWorld(vertex); morpheus.root.worldToLocal(vertex);
          assert.ok(vertex.y >= -.025, `${mesh.name} penetrates the floor while sitting at ${seating}: ${vertex.y}`);
          if (mesh.material.name === 'Boot leather') sole = Math.min(sole, vertex.y);
        }
      }
      assert.ok(sole <= .16, `Morpheus shoes cannot float while he takes the sofa at ${seating}: ${sole}`);
    }
  } finally { models.dispose(); globalThis.document = document; }
});
