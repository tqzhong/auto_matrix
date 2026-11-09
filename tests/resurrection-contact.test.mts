import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, theOneRoot, type FilmJourney, type TheOneEncounter } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { NebDeckRenderer } from '../packages/client/src/engine/NebDeckRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

async function setup(t: test.TestContext) {
  const assets = new Map();
  for (const name of ['neo', 'trinity', 'neo-office', 'neo-tracking', 'trinity-club']) {
    const raw = await readFile(new URL(`../packages/client/public/assets/characters/${name}.glb`, import.meta.url));
    const length = raw.readUInt32LE(12), source = JSON.parse(raw.subarray(20, 20 + length).toString());
    for (const material of source.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
    source.images = []; source.textures = [];
    const json = Buffer.from(JSON.stringify(source)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
    const bin = raw.subarray(20 + length), bytes = Buffer.alloc(20 + padded.length + bin.length);
    bytes.writeUInt32LE(0x46546c67); bytes.writeUInt32LE(2, 4); bytes.writeUInt32LE(bytes.length, 8);
    bytes.writeUInt32LE(padded.length, 12); bytes.writeUInt32LE(0x4e4f534a, 16); padded.copy(bytes, 20); bin.copy(bytes, 20 + padded.length);
    assets.set(name, await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), ''));
  }
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async (url: string) => assets.get(url.split('/').pop()!.replace('.glb', '')));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const renderer = new AgentRenderer(new THREE.Scene()), center = FILM_SETS.film_neb_deck.center, floor = center.y - 1;
  const deck = new THREE.Group(); deck.position.set(center.x, floor, center.z);
  const interior = new NebDeckRenderer(deck); deck.updateWorldMatrix(true, true);
  const footrest = new THREE.Box3().setFromObject(deck.getObjectByName('neb-core-chair-neo-footrest')!);
  t.after(() => { interior.dispose(); renderer.dispose(); globalThis.document = previous; });
  renderer.setWorld(false);
  const encounter: TheOneEncounter = { kind: 'death', phase: 'flatline', elapsed: .5, attempt: 0, checkpoint: 'door', signal: 0,
    hits: 0, blocks: 0, deadline: 0, altitude: 0, flightX: 0, flightZ: 0, resolved: [] };
  const journey = { scene: 'm1_death', actor: 'neo', step: 1, theOne: encounter, completed: [] } as unknown as FilmJourney;
  const pose = (phase: TheOneEncounter['phase'], elapsed: number, delta = 0) => {
    Object.assign(encounter, { phase, elapsed });
    for (const role of ['neo', 'trinity'] as const) {
      const actor = world.agents.get(role)!, root = theOneRoot(encounter, role);
      actor.isInMatrix = false; actor.currentLocation = 'film_neb_deck'; actor.rotation = root.yaw;
      actor.position = { x: center.x + root.x, y: center.y, z: center.z + root.z };
      actor.currentAction = { type: 'idle', parameters: { theOne: { ...encounter, role } }, startedAt: 0, duration: 100000, progress: 0 };
      renderer.updateAgent(role, actor);
    }
    renderer.update(delta, undefined, 1, 0, journey);
    for (const role of ['neo', 'trinity']) {
      const hero = renderer.getAgentHero(role); hero?.updateWorldMatrix(true, true); hero?.updateMatrixWorld(true);
    }
  };
  pose('flatline', .5); await new Promise(resolve => setImmediate(resolve)); pose('flatline', .5);
  for (const role of ['neo', 'trinity']) assert.ok(renderer.getAgentHero(role), `load the delivered ${role} skeleton`);
  const point = (role: string, name: string) => renderer.getAgentHero(role)!.getObjectByName(name)!.getWorldPosition(new THREE.Vector3());
  return { renderer, center, floor, footrest, pose, point };
}

test('resurrection keeps Trinity’s planted shins out of Neo’s connection-chair footrest', async t => {
  const h = await setup(t);
  for (const elapsed of [.3, .6, .95, 1.2, 1.8, 2.3]) {
    h.pose('kiss', elapsed);
    for (const side of ['R', 'L']) {
      const ankle = h.point('trinity', `ankle_${side}`), knee = h.point('trinity', `knee_${side}`);
      const shin = new THREE.Box3().setFromPoints([ankle, knee]).expandByScalar(.12);
      assert.ok(!shin.intersectsBox(h.footrest), `${elapsed}/${side}: Trinity’s shin crosses the metal footrest`);
      assert.ok(ankle.y > h.floor + .1 && ankle.y < h.floor + .5, 'both ankles stay planted on the deck');
    }
  }
});

test('resurrection keeps the delivered clothing and shoes above the deck', async t => {
  const h = await setup(t), vertex = new THREE.Vector3();
  for (const [phase, elapsed] of [['flatline', .5], ['kiss', 1.2], ['kiss', 2.3]] as const) {
    h.pose(phase, elapsed);
    for (const role of ['neo', 'trinity']) {
      let minimum = Infinity, vertices = 0, lowest = '';
      h.renderer.getAgentHero(role)!.traverseVisible(object => {
        if (!(object instanceof THREE.SkinnedMesh)) return;
        object.skeleton.update();
        for (let i = 0; i < object.geometry.attributes.position.count; i++) {
          object.getVertexPosition(i, vertex); object.localToWorld(vertex);
          if (vertex.y - h.floor < minimum) { minimum = vertex.y - h.floor; lowest = `${object.name}/${(object.material as THREE.Material).name}/${i}`; }
          vertices++;
        }
      });
      assert.ok(vertices > 10000, 'measure the delivered clothing and skin');
      assert.ok(minimum >= -.025, `${phase}/${elapsed}/${role}: ${lowest} crosses the deck by ${-minimum}`);
    }
  }
});

test('Neo’s physical body rests on the cushion and both shoes stay on its footrest', async t => {
  const h = await setup(t);
  for (const [phase, elapsed] of [['flatline', .5], ['listening', 1.2], ['kiss', 1.8], ['revive', .5]] as const) {
    h.pose(phase, elapsed);
    const pelvis = h.point('neo', 'pelvis');
    assert.ok(pelvis.y - h.floor > 1.4 && pelvis.y - h.floor < 1.8, 'the pelvis stays on the cushion');
    for (const side of ['R', 'L']) {
      const ankle = h.point('neo', `ankle_${side}`);
      assert.ok(ankle.x > h.center.x + 4.55 && ankle.x < h.center.x + 5.55, `${phase}/${side}: the shoe misses the footrest`);
      assert.ok(ankle.y - h.floor > .3 && ankle.y - h.floor < .65, `${phase}/${side}: the shoe does not rest above the metal plate`);
    }
  }
});

test('a paused resurrection gives the same bone transforms after moving between earlier poses', async t => {
  const h = await setup(t);
  const bones = () => ['neo', 'trinity'].flatMap(role => {
    const result: number[][] = [];
    h.renderer.getAgentHero(role)!.traverse(object => { if (object instanceof THREE.Bone) result.push(object.matrixWorld.elements.slice()); });
    return result;
  });
  h.pose('kiss', 1.8); const saved = bones();
  h.pose('flatline', .5); h.pose('listening', 1.1); h.pose('kiss', 1.8);
  assert.deepEqual(bones(), saved, 'a saved frame cannot depend on its previous browser animation');
});
