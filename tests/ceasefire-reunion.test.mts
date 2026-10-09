import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test, { type TestContext } from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, FILM_SCENE_BY_ID, newTrilogyEpilogue, type FilmJourney, type TrilogyEpilogueEncounter, type WorldEvent } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import type { CharacterRig } from '../packages/client/src/agents/CharacterModel.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

const roles = ['morpheus', 'niobe', 'link', 'zee'] as const;
const pairs = [['morpheus', 'niobe'], ['link', 'zee']] as const;

function game() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const players = new PlayerController(world, { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine,
    { execute() {} } as unknown as ActionExecutor, dynamics, sandbox);
  players.possess('p', 'neo', 0); sandbox.life.begin(world.agents.get('neo')!, 0); sandbox.state.neoLife!.chapter = 1;
  players.sandboxAction('p', { kind: 'life', target: 'film:start' }, 1);
  const journey = sandbox.life.film.state!;
  Object.assign(journey, { scene: FILM_SCENE_BY_ID.m3_ceasefire.id, actor: 'kid', step: 2,
    epilogue: { ...newTrilogyEpilogue('ceasefire'), phase: 'announcement', elapsed: 3.1 } });
  players.possess('p', 'kid', 1);
  let tick = 1, sequence = 0;
  const frame = (running = true) => {
    tick += .05; players.receiveInput('p', { x: 0, z: 0, yaw: 0, sequence: ++sequence });
    players.step(.05, running, tick); sandbox.tick(tick);
  };
  return { world, sandbox, players, journey, frame };
}

test('survivors approach continuously when the announcement becomes a reunion', () => {
  const h = game(); h.frame();
  const previous = new Map(roles.map(role => [role, structuredClone(h.world.agents.get(role)!.position)]));
  h.frame(); assert.equal(h.journey.epilogue!.phase, 'embrace');
  for (let i = 0; i < 85; i++) {
    for (const role of roles) {
      const a = previous.get(role)!, b = h.world.agents.get(role)!.position;
      assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < .14, `${role}: reunion cannot teleport from the announcement`);
      previous.set(role, structuredClone(b));
    }
    h.frame();
  }
});

test('a saved reunion waits when occupied and preserves a dead survivor’s body', () => {
  const h = game(); h.frame(); h.frame(); for (let i = 0; i < 20; i++) h.frame();
  const snapshot = structuredClone(h.journey.epilogue);
  const niobe = h.world.agents.get('niobe')!; niobe.controller = 'other';
  const occupied = structuredClone(niobe.position); h.frame();
  assert.deepEqual(h.journey.epilogue, snapshot); assert.deepEqual(niobe.position, occupied);
  niobe.controller = undefined; niobe.status = 'dead'; niobe.health = 0;
  niobe.position.x += 3; const dead = structuredClone(niobe.position); h.frame();
  assert.deepEqual(niobe.position, dead, 'the reunion cannot reposition a dead participant'); assert.equal(niobe.health, 0);
  const paused = structuredClone(h.journey.epilogue); h.frame(false); assert.deepEqual(h.journey.epilogue, paused);
});

async function shipped(name: string) {
  const bytes = await readFile(new URL(`../packages/client/public/assets/characters/${name}.glb`, import.meta.url));
  const length = bytes.readUInt32LE(12), document = JSON.parse(bytes.subarray(20, 20 + length).toString());
  for (const material of document.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const binary = bytes.subarray(20 + length), output = Buffer.alloc(20 + padded.length + binary.length);
  output.writeUInt32LE(0x46546c67, 0); output.writeUInt32LE(2, 4); output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(padded.length, 12); output.writeUInt32LE(0x4e4f534a, 16); padded.copy(output, 20); binary.copy(output, 20 + padded.length);
  const asset = await new GLTFLoader().parseAsync(output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength), '');
  if (name.endsWith('-head')) asset.scene.traverse(object => { if (object instanceof THREE.Mesh) (object.material as THREE.MeshStandardMaterial).map = new THREE.Texture(); });
  return asset;
}

async function fixture(t: TestContext) {
  const assets = Object.fromEntries(await Promise.all(['morpheus', 'trinity', 'zee-head', 'zee-body', 'niobe-head', 'niobe-body'].map(async name => [name, await shipped(name)])));
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async url => assets[String(url).split('/').pop()!.replace('.glb', '')]);
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const originalDocument = globalThis.document;
  const context = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ getContext: () => context }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const scene = new THREE.Scene(), renderer = new AgentRenderer(scene); renderer.setWorld(false);
  t.after(() => { renderer.dispose(); globalThis.document = originalDocument; });
  const center = FILM_SETS.film_zion_temple.center;
  const pose = (encounter: TrilogyEpilogueEncounter, delta = 0) => {
    for (const role of roles) {
      const station = role === 'morpheus' ? [-6, 17] : role === 'niobe' ? [-2.2, 17] : role === 'link' ? [3, 19] : [6.5, 19];
      const close = encounter.phase === 'embrace' || encounter.phase === 'done';
      const x = close ? role === 'morpheus' ? -4.35 : role === 'niobe' ? -3.75 : role === 'link' ? 4.35 : 4.95 : station[0];
      const actor = world.agents.get(role)!;
      Object.assign(actor, { position: { x: center.x + x, y: center.y, z: center.z + station[1] },
        rotation: role === 'morpheus' || role === 'link' ? Math.PI / 2 : -Math.PI / 2, isInMatrix: false,
        currentAction: { type: 'idle', parameters: { epilogue: { ...encounter, role } }, startedAt: 0, duration: 1, progress: 0 } });
      renderer.updateAgent(role, actor);
    }
    renderer.update(delta, undefined, 0, 0, { scene: 'm3_ceasefire', actor: 'kid', completed: [], epilogue: encounter } as FilmJourney);
    scene.updateMatrixWorld(true);
  };
  pose(newTrilogyEpilogue('ceasefire')); await new Promise(resolve => setImmediate(resolve)); pose(newTrilogyEpilogue('ceasefire'));
  const entries = (renderer as unknown as { agents: Map<string, { rig: CharacterRig }> }).agents;
  const rigs = Object.fromEntries(roles.map(role => [role, entries.get(role)!.rig])) as Record<typeof roles[number], CharacterRig>;
  assert.ok(rigs.morpheus.hero && rigs.link.hero); assert.ok(rigs.zee.detail.getObjectByName('zee-detailed-body'));
  assert.ok(rigs.niobe.detail.getObjectByName('niobe-detailed-body'));
  return { world, renderer, rigs, pose, center };
}

function faceBounds(rig: CharacterRig) {
  const points: THREE.Vector3[] = [];
  rig.detail.traverseVisible(object => {
    if (!(object instanceof THREE.Mesh)) return;
    if (object instanceof THREE.SkinnedMesh) {
      if ((object.material as THREE.Material).name !== 'Skin') return;
      object.skeleton.update(); const position = object.geometry.attributes.position, weights = object.geometry.attributes.skinWeight, ids = object.geometry.attributes.skinIndex;
      for (let i = 0; i < position.count; i++) if (position.getZ(i) > .1 && [0, 1, 2, 3].some(k => weights.getComponent(i, k) > .7 && /^(head|neck)$/.test(object.skeleton.bones[ids.getComponent(i, k)].name)))
        points.push(object.localToWorld(object.getVertexPosition(i, new THREE.Vector3())));
    } else if (object.name.endsWith('-anatomical-head')) {
      const position = object.geometry.attributes.position;
      for (let i = 0; i < position.count; i++) if (position.getZ(i) > .1) points.push(object.localToWorld(object.getVertexPosition(i, new THREE.Vector3())));
    }
  });
  assert.ok(points.length); return new THREE.Box3().setFromPoints(points);
}

function handPoints(rig: CharacterRig, left: boolean) {
  const points: THREE.Vector3[] = [];
  rig.detail.traverseVisible(object => {
    if (!(object instanceof THREE.SkinnedMesh)) return;
    object.skeleton.update(); const position = object.geometry.attributes.position, ids = object.geometry.attributes.skinIndex, weights = object.geometry.attributes.skinWeight;
    for (let i = 0; i < position.count; i++) {
      const hand = rig.hero ? (object.material as THREE.Material).name === 'Skin' && [0, 1, 2, 3].some(k => weights.getComponent(i, k) > .5 && new RegExp(`wrist_${left ? 'L' : 'R'}|finger.*_${left ? 'L' : 'R'}`).test(object.skeleton.bones[ids.getComponent(i, k)].name))
        : object.name.endsWith('-anatomical-body') && position.getY(i) <= 1.79 && position.getY(i) > 1.45 && Math.sign(position.getX(i)) === (left ? 1 : -1);
      if (hand) points.push(object.localToWorld(object.getVertexPosition(i, new THREE.Vector3())));
    }
  });
  assert.ok(points.length); return points;
}

test('both delivered face surfaces stay apart throughout the reunion', async t => {
  const h = await fixture(t);
  for (const elapsed of [0, .4, .8, 1.4, 2.107, 3.1, 4.4]) {
    h.pose({ kind: 'ceasefire', phase: 'embrace', elapsed, total: 8.47 + elapsed });
    for (const [a, b] of pairs) assert.equal(faceBounds(h.rigs[a]).intersectsBox(faceBounds(h.rigs[b])), false,
      `${elapsed}/${a}: the actual face cannot be pushed through its partner`);
  }
});

test('the actual palms rest on the partner’s clothing rather than hanging behind it', async t => {
  const h = await fixture(t); h.pose({ kind: 'ceasefire', phase: 'embrace', elapsed: 3.4, total: 11.87 });
  for (const [a, b] of [...pairs, ...pairs.map(([a, b]) => [b, a] as const)]) for (const left of [false, true]) {
    const partner = h.rigs[b], origin = partner.root.localToWorld(new THREE.Vector3(left ? -.34 : .34, left ? 2.95 : 2.65, -1.5));
    const direction = new THREE.Vector3(0, 0, 1).applyQuaternion(partner.root.getWorldQuaternion(new THREE.Quaternion())), meshes: THREE.Mesh[] = [];
    partner.detail.traverseVisible(object => { if (object instanceof THREE.Mesh && /cloth|work-top|crew.neck|coat|shirt|tunic|leather/i.test(object.name + (object.material as THREE.Material).name)) { if (object instanceof THREE.SkinnedMesh) object.skeleton.update(); meshes.push(object); } });
    const hit = new THREE.Raycaster(origin, direction, 0, 2.7).intersectObjects(meshes, false)[0];
    assert.ok(hit, `${b}: inspect the real back of the delivered clothing`);
    const gap = Math.min(...handPoints(h.rigs[a], left).map(point => point.distanceTo(hit.point)));
    assert.ok(gap < .12, `${a}/${left}: rendered palm misses the partner's cloth by ${gap}`);
  }
});

test('paused reunion hands do not drift with render time', async t => {
  const h = await fixture(t), encounter: TrilogyEpilogueEncounter = { kind: 'ceasefire', phase: 'embrace', elapsed: 2.107, total: 10.579 };
  h.pose(encounter); const snapshot = roles.map(role => handPoints(h.rigs[role], true));
  h.pose(encounter, .4);
  for (const [index, role] of roles.entries()) assert.ok(handPoints(h.rigs[role], true).every((point, i) => point.distanceTo(snapshot[index][i]) < 1e-7), `${role}: saved hands drift with render time`);
});

test('the current Kid frame drives the reunion across an older world phase', async t => {
  const h = await fixture(t), saved: TrilogyEpilogueEncounter = { kind: 'ceasefire', phase: 'announcement', elapsed: 3.1, total: 8.3 };
  h.pose(saved); const before = h.renderer.getAgent('morpheus')!.position.clone();
  h.renderer.setPlayer('kid');
  h.renderer.setPlayerMotion({ speed: 0, turn: 0, grounded: true, verticalVelocity: 0,
    epilogue: { kind: 'ceasefire', phase: 'embrace', elapsed: 1.8, total: 10.2, role: 'kid' } });
  h.renderer.update(0, undefined, 0, 0, { scene: 'm3_ceasefire', actor: 'kid', completed: [], epilogue: saved } as FilmJourney);
  assert.ok(h.renderer.getAgent('morpheus')!.position.distanceTo(before) > .5, 'survivors cannot wait for the next slow world snapshot and then jump');
  const current = h.renderer.getAgent('morpheus')!.position.clone();
  h.renderer.update(.3, undefined, 0, 0, { scene: 'm3_ceasefire', actor: 'kid', completed: [], epilogue: saved } as FilmJourney);
  assert.ok(h.renderer.getAgent('morpheus')!.position.equals(current), 'render time cannot advance the received saved clock');
});

test('the delivered boots retain a support sole during approach and both soles during the embrace', async t => {
  const h = await fixture(t);
  for (const elapsed of [0, .3, .7, 1.1, 1.5, 2.107, 3.4, 4.4]) {
    h.pose({ kind: 'ceasefire', phase: 'embrace', elapsed, total: 8.47 + elapsed });
    for (const role of roles) {
      const rig = h.rigs[role], soles = ['L', 'R'].map(side => {
        let low = Infinity;
        rig.detail.traverseVisible(object => {
          if (!(object instanceof THREE.SkinnedMesh) || (object.material as THREE.Material).name !== 'Boot leather' && !object.name.endsWith('-work-boots')) return;
          object.skeleton.update(); const ids = object.geometry.attributes.skinIndex, weights = object.geometry.attributes.skinWeight;
          for (let i = 0; i < ids.count; i++) if ([0, 1, 2, 3].some(k => weights.getComponent(i, k) > .5 && object.skeleton.bones[ids.getComponent(i, k)].name === `ankle_${side}`))
            low = Math.min(low, object.localToWorld(object.getVertexPosition(i, new THREE.Vector3())).y);
        });
        assert.ok(Number.isFinite(low)); return low - (h.center.y - 1);
      });
      assert.ok(soles.every(height => height >= -.015), `${role}/${elapsed}: boots cross the shared floor: ${soles}`);
      assert.ok(Math.min(...soles) < .04, `${role}/${elapsed}: both feet lose support: ${soles}`);
      if (elapsed >= 3.4) assert.ok(soles.every(height => height < .04), `${role}: holding the embrace must plant both boots`);
    }
  }
});
