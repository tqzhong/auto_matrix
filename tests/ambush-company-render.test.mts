import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, ambushFloor, ambushRouteRoot, ambushRetreatRoot, AMBUSH_RETREAT_LANDINGS, filmPosition, newAmbushApproach, type AmbushEscort, type SandboxState } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { newMotion } from '../packages/client/src/agents/CharacterMotion.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { SandboxRenderer } from '../packages/client/src/engine/SandboxRenderer.js';

function setup(t: test.TestContext) {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  const document = globalThis.document;
  const context = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const actor = world.agents.get('morpheus')!, renderer = new AgentRenderer(new THREE.Scene());
  actor.currentLocation = 'film_ambush_house'; actor.isInMatrix = true;
  const snapshot = (progress: number, watching = false, retreat = false) => {
    const pose = retreat ? ambushRetreatRoot(progress, 'morpheus') : ambushRouteRoot(progress, 'morpheus'), position = filmPosition('film_ambush_house', pose.x, pose.z); position.y += pose.y;
    actor.position = position; actor.rotation = watching ? -1.2 : pose.yaw;
    actor.currentAction = { type: 'idle', parameters: { resolved: true, ambushEscort: { role: 'morpheus', progress, watching, retreat: retreat ? true : undefined } satisfies AmbushEscort }, startedAt: 0, duration: 1, progress: 0 };
    renderer.updateAgent(actor.id, actor);
  };
  t.after(() => { renderer.dispose(); globalThis.document = document; });
  return { actor, renderer, snapshot, world };
}

test('companion snapshots follow the exact stair route through a landing turn instead of cutting diagonally', t => {
  const h = setup(t); h.snapshot(27.7); h.renderer.update(0);
  h.snapshot(29.8);
  for (let frame = 1; frame <= 5; frame++) {
    h.renderer.update(.1);
    const pose = ambushRouteRoot(27.7 + frame * .42, 'morpheus'), target = filmPosition('film_ambush_house', pose.x, pose.z); target.y += pose.y;
    assert.ok(h.renderer.getAgent('morpheus')!.position.distanceTo(new THREE.Vector3(target.x, target.y, target.z)) < .001,
      `frame ${frame} must stay on the rendered treads / landing, including height`);
  }
  const paused = h.renderer.getAgent('morpheus')!.position.clone(); h.snapshot(31.9); h.renderer.update(.2, undefined, 0);
  assert.ok(h.renderer.getAgent('morpheus')!.position.distanceTo(paused) < .001, 'pause freezes a companion even between network snapshots');
  h.renderer.update(.5); for (let i = 0; i < 10; i++) h.renderer.update(.1);
  const entry = (h.renderer as unknown as { agents: Map<string, { rig: { motion: { speed: number } } }> }).agents.get('morpheus')!;
  assert.ok(entry.rig.motion.speed < .3, 'a waiting companion stops walking in place');
});

test('retreat interpolation uses the lower-floor route after ascent and freezes between descent snapshots', t => {
  const h = setup(t); h.snapshot(125, true); h.renderer.update(0);
  h.snapshot(57, false, true); h.renderer.update(0);
  h.snapshot(59.1, false, true);
  for (let frame = 1; frame <= 5; frame++) {
    h.renderer.update(.1);
    const pose = ambushRetreatRoot(57 + frame * .42, 'morpheus'), target = filmPosition('film_ambush_house', pose.x, pose.z); target.y += pose.y;
    assert.ok(h.renderer.getAgent('morpheus')!.position.distanceTo(new THREE.Vector3(target.x, target.y, target.z)) < .001,
      'the retreat cannot reuse the old ascent path or cut through the lift');
  }
  const paused = h.renderer.getAgent('morpheus')!.position.clone();
  h.snapshot(61.2, false, true); h.renderer.update(.3, undefined, 0);
  assert.deepEqual(h.renderer.getAgent('morpheus')!.position.toArray(), paused.toArray());
});

test('a paused pursuer load restores its route orientation as well as its supported lower-floor position', t => {
  const h = setup(t), scene = new THREE.Scene(), renderer = new SandboxRenderer(scene);
  const root = ambushRetreatRoot(53), center = FILM_SETS.film_ambush_house.center;
  const position = { x: center.x + root.x, y: center.y + root.y, z: center.z + root.z };
  const state = { nodes: [], structures: [], incidents: [], missions: {}, threats: [{ id: 'pursuer', kind: 'agent', scene: 'm1_dejavu',
    position, health: 64, maxHealth: 64, matrix: true, patrol: true, yaw: root.yaw, ambushPursuit: 53, target: 'neo', lastStrike: -100, stunUntil: 0 }] } as SandboxState;
  try {
    renderer.sync(state, Object.fromEntries(h.world.agents)); renderer.update(0, new THREE.PerspectiveCamera(), true, 0, false);
    const enemy = (renderer as unknown as { enemies: Map<string, { group: THREE.Group; rig: { root: THREE.Group } }> }).enemies.get('pursuer')!;
    assert.deepEqual(enemy.group.position.toArray(), [position.x, position.y, position.z]);
    assert.ok(Math.abs(Math.atan2(Math.sin(enemy.rig.root.rotation.y - root.yaw), Math.cos(enemy.rig.root.rotation.y - root.yaw))) < .001,
      'a paused first snapshot cannot leave the pursuer facing the default set entrance');
  } finally { renderer.dispose(); }
});

test('a paused cat-repeat save faces the listener toward Neo immediately instead of toward the stairs', t => {
  const h = setup(t); h.snapshot(125, true); h.renderer.update(0);
  assert.ok(Math.abs(h.renderer.getAgentBody('morpheus')!.rotation.y + 1.2) < .001, 'loading a paused conversation must restore its actual body orientation');
});

test('the rendered ascent marker stays on the next physical landing rather than above the shaft', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const actor = world.agents.get('neo')!;
  actor.isInMatrix = true; actor.position = filmPosition('film_ambush_house', -5.5, 32); actor.position.y -= 7.4;
  const sandbox = { structures: [], neoLife: { journey: { scene: 'm1_dejavu', actor: 'neo', step: 0, completed: [], ambushApproach: newAmbushApproach() } } } as SandboxState;
  const renderer = new FilmSetRenderer(new THREE.Scene()), center = FILM_SETS.film_ambush_house.center;
  try {
    renderer.update(actor, sandbox, 0);
    const marker = (renderer as unknown as { marker: THREE.Mesh }).marker;
    assert.equal(marker.position.x, center.x - 5.5); assert.equal(marker.position.z, center.z + 29);
    assert.ok(Math.abs(marker.position.y - (center.y - 7.4 - .82)) < .001);
    actor.position = { x: center.x, y: center.y - 3.7, z: center.z + 14.5 }; renderer.update(actor, sandbox, 1);
    assert.equal(marker.position.x, center.x + 5.5); assert.equal(marker.position.z, center.z + 14.5);
    assert.ok(Math.abs(marker.position.y - (center.y - 3.7 - .82)) < .001);
  } finally { renderer.dispose(); globalThis.document = document; }
});

test('all six actual character models keep shoes and coat hems above ambush treads while walking and loading paused', async t => {
  const assets = new Map();
  for (const name of ['neo', 'morpheus', 'trinity']) {
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
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async (url: string) => assets.get(url.includes('morpheus') ? 'morpheus' : url.includes('trinity') ? 'trinity' : 'neo'));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  const center = FILM_SETS.film_ambush_house.center, vertex = new THREE.Vector3();
  const samples = [17.95, 20.95, 24.95, 45.95, 48.95, 52.95].map(progress => ambushRouteRoot(progress, 'morpheus'));
  for (const landing of AMBUSH_RETREAT_LANDINGS) for (const offset of [-35.8, -35.75, -31.8, -31.75, -9.8, -9.75, -5.8, -5.75]) samples.push(ambushRetreatRoot(landing.progress + offset));
  try {
    for (const id of ['neo', 'morpheus', 'trinity', 'switch', 'apoc', 'cypher']) {
      const rig = models.create(world.agents.get(id)!); await new Promise(resolve => setImmediate(resolve));
      if (id !== 'cypher') assert.ok(rig.hero);
      for (const root of samples) for (const speed of [0, 4.2, 8.4]) {
        const moving = speed > 0;
        const progress = `${root.x},${root.y},${root.z}`;
        rig.root.position.set(center.x + root.x, center.y - 1 + root.y, center.z + root.z); rig.root.rotation.y = root.yaw;
        const input = { speed, grounded: true, verticalVelocity: 0, turn: 0 };
        rig.motion = newMotion();
        models.animate(rig, 0, input, 4); if (moving) for (let i = 0; i < 7; i++) models.animate(rig, .1, input, 4);
        rig.root.updateMatrixWorld(true);
        const shoes: THREE.Mesh[] = rig.hero ? [rig.hero.root.getObjectByName('shoes01') as THREE.SkinnedMesh] : [];
        if (!rig.hero) for (const ankle of rig.ankles) ankle.traverse(object => { if (object instanceof THREE.Mesh) shoes.push(object); });
        let smallest = Infinity;
        for (const shoe of shoes) for (let i = 0; i < shoe.geometry.attributes.position.count; i++) {
          shoe.getVertexPosition(i, vertex); shoe.localToWorld(vertex);
          const floor = ambushFloor(vertex.x - center.x, vertex.z - center.z, root.y);
          if (floor !== undefined) smallest = Math.min(smallest, vertex.y - (center.y - 1 + floor));
        }
        assert.ok(smallest >= -.025, `${id} shoes clip an ambush tread at ${progress}, moving=${moving}: ${smallest}`);
        assert.ok(Number.isFinite(smallest) && (moving || smallest < .16), `${id} shoe contact must actually sample the stair surface at ${progress}: ${smallest}, firstVertex=${vertex.toArray()}`);
        for (const panel of rig.hero?.panels ?? rig.cloth) {
          if (!panel.mesh.visible) continue;
          for (let i = 0; i < panel.mesh.geometry.attributes.position.count; i++) {
            panel.mesh.getVertexPosition(i, vertex); panel.mesh.localToWorld(vertex);
            const floor = ambushFloor(vertex.x - center.x, vertex.z - center.z, root.y);
            if (floor !== undefined) assert.ok(vertex.y >= center.y - 1 + floor - .025,
              `${id} coat clips a tread at ${progress}, moving=${moving}: ${vertex.y - (center.y - 1 + floor)}`);
          }
        }
      }
      if (id !== 'neo') {
        rig.motion = newMotion();
        models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, armed: true,
          ambushEscort: { role: id as AmbushEscort['role'], progress: 400, watching: true, retreat: true } }, 4);
        rig.root.updateMatrixWorld(true);
        for (const gun of rig.weapons!) {
          const barrel = new THREE.Vector3(0, -1, 0).applyQuaternion(gun.getWorldQuaternion(new THREE.Quaternion()));
          assert.ok(barrel.y < -.45, `${id} points a loaded gun at the listening group instead of carrying it toward the floor: ${barrel.toArray()}`);
        }
      }
    }
  } finally { models.dispose(); globalThis.document = document; }
});
