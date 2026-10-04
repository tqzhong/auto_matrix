import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DEUS_PACT, FILM_SETS, deusPactPose, newDeusPact, type DeusPactEncounter } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import type { MotionInput } from '../packages/client/src/agents/CharacterMotion.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { MachineCoreRenderer } from '../packages/client/src/engine/MachineCoreRenderer.js';
import { MachineUplinkContacts } from '../packages/client/src/engine/MachineUplinkContacts.js';

async function loadGeometry(id: string) {
  const glb = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
  const length = glb.readUInt32LE(12), document = JSON.parse(glb.subarray(20, 20 + length).toString());
  // Retain the delivered geometry and skinning; Node skips texture decoding.
  for (const material of document.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = glb.subarray(20 + length), result = Buffer.alloc(20 + padded.length + bin.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); bin.copy(result, 20 + padded.length);
  return new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
}

async function setup(t: test.TestContext) {
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking'].map(async id => [id, await loadGeometry(id)] as const)));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async (path: string) => assets.get(path.split('/').pop()!.replace(/\.glb.*$/, ''))!);
  const document = globalThis.document;
  const context = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const renderers: AgentRenderer[] = [];
  t.after(() => { renderers.forEach(renderer => renderer.dispose()); globalThis.document = document; });
  const create = (player: boolean) => { const renderer = new AgentRenderer(new THREE.Scene()); renderer.setWorld(false); renderer.setPlayer(player ? 'neo' : null); renderers.push(renderer); return renderer; };
  const save = (renderer: AgentRenderer, beat?: DeusPactEncounter, motion?: Partial<MotionInput>) => {
    const actor = structuredClone(world.agents.get('neo')!), center = FILM_SETS.film_machine_core.center;
    actor.position = { x: center.x, y: center.y, z: center.z + DEUS_PACT.platform.z }; actor.rotation = Math.PI;
    actor.velocity = { x: 0, y: 0, z: 0 }; actor.currentLocation = 'film_machine_core'; actor.isInMatrix = false;
    actor.currentAction = beat ? { type: 'idle', parameters: { seated: deusPactPose(beat).seated > .48, deusPact: { ...beat, role: 'neo' } }, startedAt: 0, duration: 1e9, progress: 0 } : undefined;
    renderer.updateAgent('neo', actor);
    // PlayerControls owns the player's transform. Supply the same saved root
    // to both renderers; the test isolates actual pose dispatch and restoration.
    renderer.getAgent('neo')!.position.copy(actor.position); renderer.getAgentBody('neo')!.rotation.y = actor.rotation;
    renderer.setPlayerMotion({ speed: 0, grounded: true, verticalVelocity: 0, turn: 0,
      seated: beat && deusPactPose(beat).seated > .48, deusPact: beat ? { ...beat, role: 'neo' } : undefined, ...motion });
  };
  return { create, save };
}

function pose(renderer: AgentRenderer) {
  const body = renderer.getAgentBody('neo')!; body.parent!.parent!.updateMatrixWorld(true);
  assert.ok(body.getObjectByName('pelvis'), 'use the delivered Neo GLB');
  const joints: Record<string, number[]> = {};
  body.traverse(object => {
    if (object instanceof THREE.Bone || object.name === 'cervical-interface') joints[object.name] = object.matrixWorld.elements.map(value => +value.toFixed(8));
  });
  return joints;
}

const beats: DeusPactEncounter[] = [
  { ...newDeusPact(), phase: 'swarm', elapsed: 2, total: 2, resolve: 2 },
  { ...newDeusPact(), phase: 'warning', elapsed: 1.1, total: 6.2 },
  { ...newDeusPact(), phase: 'seating', elapsed: 1.2, total: 9.4 },
  { ...newDeusPact(), phase: 'cabling', elapsed: 1.4, total: 12 },
  { ...newDeusPact(), phase: 'consent', elapsed: .9, total: 14.3, consent: .9 },
  { ...newDeusPact(), phase: 'connecting', elapsed: .8, total: 16 },
  { ...newDeusPact(), phase: 'connected', total: 16.8 },
];

test('the saved machine-core Neo has the same actual body and neck port for the player and observers', async t => {
  const h = await setup(t), player = h.create(true), observer = h.create(false);
  for (const beat of beats) {
    h.save(player, beat); h.save(observer, beat); await new Promise(resolve => setImmediate(resolve));
    player.update(0, undefined, 0); observer.update(0, undefined, 0);
    assert.deepEqual(pose(observer), pose(player), `${beat.phase}: spectators must see the saved Deus gesture, including its physical neck port`);
  }
});

test('locked machine-core bodies restore from the saved clock regardless of warm-up and prior combat', async t => {
  const h = await setup(t), warm = h.create(true), cold = h.create(true);
  for (const beat of beats) {
    h.save(warm, undefined, { speed: 5, attack: 1, combo: 2, hit: 1 });
    await new Promise(resolve => setImmediate(resolve)); warm.update(.1);
    h.save(warm, beat); h.save(cold, beat); await new Promise(resolve => setImmediate(resolve));
    cold.update(0, undefined, 0); warm.update(0, undefined, 0);
    const saved = pose(cold);
    assert.deepEqual(pose(warm), saved, `${beat.phase}: cold restoration cannot inherit walking, combat or render time`);
    for (let i = 0; i < 5; i++) warm.update(.016);
    assert.deepEqual(pose(warm), saved, `${beat.phase}: unchanged saved clock cannot advance the supported body`);
    warm.update(.2, undefined, 0);
    assert.deepEqual(pose(warm), saved, `${beat.phase}: paused body and port cannot drift`);
  }
});

test('the final neck probe meets the actual cervical port after waiting outside it for consent', async t => {
  const h = await setup(t), renderer = h.create(true), stage = new THREE.Group(), center = FILM_SETS.film_machine_core.center;
  stage.position.set(center.x, center.y - 1, center.z);
  const machine = new MachineCoreRenderer(stage); t.after(() => machine.dispose());
  for (const beat of [{ ...newDeusPact(), phase: 'consent', total: 13.4 }, { ...newDeusPact(), phase: 'connected', total: 16.8 }] as DeusPactEncounter[]) {
    h.save(renderer, beat); await new Promise(resolve => setImmediate(resolve)); renderer.update(0, undefined, 0);
    const body = renderer.getAgentBody('neo')!; body.parent!.parent!.updateMatrixWorld(true);
    machine.update(beat, 90, false, { x: 0, z: -25 }, body); stage.updateMatrixWorld(true);
    const port = body.getObjectByName('cervical-interface')!, probe = stage.getObjectByName('machine-core-neck-probe')!;
    let tip: THREE.Vector3 | undefined;
    probe.traverse(object => {
      if (object instanceof THREE.Mesh && object.geometry.type === 'ConeGeometry') tip = object.localToWorld(new THREE.Vector3(0, (object.geometry as THREE.ConeGeometry).parameters.height / 2, 0));
    });
    assert.ok(tip, 'measure the visible probe tip, not its group origin');
    const delta = tip.clone().sub(port.getWorldPosition(new THREE.Vector3()));
    const normal = new THREE.Vector3(0, 0, 1).transformDirection(port.matrixWorld);
    if (beat.phase === 'consent') assert.ok(delta.dot(normal) > .12, 'the tip must wait outside the actual port before consent');
    else assert.ok(delta.length() < .065, `connected probe misses the actual cervical port by ${delta.length()}`);
  }
});

test('the machine support carries Neo without engulfing the delivered shoes, legs or hands', async t => {
  const h = await setup(t), renderer = h.create(true), stage = new THREE.Group(), center = FILM_SETS.film_machine_core.center;
  stage.position.set(center.x, center.y - 1, center.z);
  const machine = new MachineCoreRenderer(stage); t.after(() => machine.dispose());
  for (const beat of [...[.3, .6, .9, 1.2, 1.5, 1.8, 2.1, 2.4].map(elapsed => ({ ...newDeusPact(), phase: 'seating', elapsed, total: 8.2 + elapsed })),
    ...[0, .4, .8, 1.2, 1.6].map(elapsed => ({ ...newDeusPact(), phase: 'connecting', elapsed, total: 15.2 + elapsed })),
    { ...newDeusPact(), phase: 'connected', total: 16.8 }] as DeusPactEncounter[]) {
    h.save(renderer, beat); await new Promise(resolve => setImmediate(resolve)); renderer.update(0, undefined, 0);
    const body = renderer.getAgentBody('neo')!; body.parent!.parent!.updateMatrixWorld(true);
    machine.update(beat, 90, false, { x: 0, z: -25 }, body); stage.updateMatrixWorld(true);
    const seat = stage.getObjectByName('machine-core-seat')!, obstacles: THREE.Mesh[] = [];
    for (const child of seat.children) {
      if (['machine-core-body-jacks', 'machine-core-neck-probe'].includes(child.name)) continue;
      child.traverseVisible(object => { if (object instanceof THREE.Mesh) obstacles.push(object); });
    }
    const inverses = obstacles.map(mesh => mesh.matrixWorld.clone().invert()), scales = obstacles.map(mesh => mesh.getWorldScale(new THREE.Vector3()));
    let deepest = 0, worst = '', sole = Infinity;
    body.traverseVisible(object => {
      if (!(object instanceof THREE.SkinnedMesh) || !/Trousers|Boot leather|Skin|Coat wool/.test((object.material as THREE.Material).name)) return;
      object.skeleton.update();
      for (let i = 0; i < object.geometry.attributes.position.count; i++) {
        const point = object.localToWorld(object.getVertexPosition(i, new THREE.Vector3()));
        if ((object.material as THREE.Material).name === 'Boot leather') sole = Math.min(sole, point.y - (center.y - 1 + .025));
        obstacles.forEach((mesh, index) => {
          const local = point.clone().applyMatrix4(inverses[index]), scale = scales[index];
          const parameters = (mesh.geometry as THREE.BoxGeometry | THREE.SphereGeometry | THREE.CylinderGeometry).parameters;
          let depth = -Infinity;
          if (mesh.geometry.type === 'BoxGeometry') {
            const p = parameters as THREE.BoxGeometry['parameters'];
            depth = Math.min((p.width / 2 - Math.abs(local.x)) * scale.x, (p.height / 2 - Math.abs(local.y)) * scale.y, (p.depth / 2 - Math.abs(local.z)) * scale.z);
          } else if (mesh.geometry.type === 'CylinderGeometry') {
            const p = parameters as THREE.CylinderGeometry['parameters'];
            const radius = THREE.MathUtils.lerp(p.radiusBottom, p.radiusTop, (local.y + p.height / 2) / p.height);
            depth = Math.min((radius * Math.cos(Math.PI / p.radialSegments) - Math.hypot(local.x, local.z)) * Math.min(scale.x, scale.z), (p.height / 2 - Math.abs(local.y)) * scale.y);
          } else if (mesh.geometry.type === 'SphereGeometry') {
            depth = ((parameters as THREE.SphereGeometry['parameters']).radius - local.length()) * Math.min(scale.x, scale.y, scale.z);
          }
          if (depth > deepest) { deepest = depth; worst = `${object.name} vertex ${i} inside ${mesh.name || mesh.geometry.type}`; }
        });
      }
    });
    assert.ok(deepest < .025, `${beat.phase}: support penetrates the actual visible body ${deepest}: ${worst}`);
    assert.ok(sole >= -.005, `${beat.phase}: actual shoe sole is ${sole} below the physical deck`);
  }
});

test('all body feeds meet actual clothing surfaces and the support leaves room for their ports', async t => {
  const h = await setup(t), renderer = h.create(true), stage = new THREE.Group(), center = FILM_SETS.film_machine_core.center;
  stage.position.set(center.x, center.y - 1, center.z);
  const machine = new MachineCoreRenderer(stage); t.after(() => machine.dispose());
  for (const beat of [{ ...newDeusPact(), phase: 'cabling', elapsed: 2.8, total: 13.4 },
    { ...newDeusPact(), phase: 'connecting', elapsed: .8, total: 16 }, { ...newDeusPact(), phase: 'connected', total: 16.8 }] as DeusPactEncounter[]) {
    h.save(renderer, beat); await new Promise(resolve => setImmediate(resolve)); renderer.update(0, undefined, 0);
    const body = renderer.getAgentBody('neo')!; body.parent!.parent!.updateMatrixWorld(true);
    machine.update(beat, 90, false, { x: 0, z: -25 }, body); stage.updateMatrixWorld(true);
    const upper = body.getObjectByName('Tailored_coat_upper') as THREE.SkinnedMesh;
    upper.skeleton.update(); upper.computeBoundingBox(); upper.computeBoundingSphere();
    const pads = Array.from({ length: 4 }, (_, i) => stage.getObjectByName(`machine-support-pad-${i}`) as THREE.Mesh);
    for (let i = 0; i < 6; i++) {
      const port = stage.getObjectByName(`machine-body-port-${i}`) as THREE.Mesh, plug = stage.getObjectByName(`machine-body-plug-${i}`) as THREE.Mesh;
      assert.ok(port?.visible && plug?.visible, `body feed ${i} must have physical mating surfaces`);
      const point = port.getWorldPosition(new THREE.Vector3()), normal = new THREE.Vector3(0, 0, 1).transformDirection(port.matrixWorld);
      const hit = new THREE.Raycaster(point.clone().addScaledVector(normal, .1), normal.clone().negate()).intersectObject(upper)[0];
      assert.ok(hit && Math.abs(hit.distance - .118) < .008, `body port ${i} must sit .018 above the actual knit surface, not in air or inside it: ${hit?.distance}`);
      const tip = plug.localToWorld(new THREE.Vector3(0, .09, 0));
      assert.ok(tip.distanceTo(point) < .002, `${i}: plug tip must meet its port`);
      for (const pad of pads) for (let v = 0; v < port.geometry.attributes.position.count; v++) {
        const vertex = port.localToWorld(new THREE.Vector3().fromBufferAttribute(port.geometry.attributes.position, v));
        const local = pad.worldToLocal(vertex);
        assert.ok(local.length() > .98, `${beat.phase}: port ${i} penetrates ${pad.name}`);
      }
    }
    for (const pad of pads) {
      assert.ok(pad.visible, `${pad.name} must provide a real visible support`);
      let closest = Infinity;
      for (const object of [upper, body.getObjectByName('Tailored_trousers') as THREE.SkinnedMesh]) {
        object.skeleton.update();
        for (let i = 0; i < object.geometry.attributes.position.count; i++) {
          const point = object.localToWorld(object.getVertexPosition(i, new THREE.Vector3())), local = pad.worldToLocal(point.clone());
          const surface = pad.localToWorld(local.normalize()); closest = Math.min(closest, point.distanceTo(surface));
        }
      }
      assert.ok(closest < .055, `${pad.name} floats ${closest} from the actual clothing`);
    }
  }
});

test('uplink contacts work before the first WebGL draw and reuse paused surface samples', async t => {
  const h = await setup(t), renderer = h.create(true), contacts = new MachineUplinkContacts();
  const beat = { ...newDeusPact(), phase: 'cabling' as const, elapsed: 1.4, total: 12 };
  h.save(renderer, beat); await new Promise(resolve => setImmediate(resolve)); renderer.update(0, undefined, 0);
  const body = renderer.getAgentBody('neo')!, chest = body.getObjectByName('chest')!;
  // Deliberately no manual updateMatrixWorld: Engine poses actors, then runs
  // the film set before WebGLRenderer has updated skinned bind inverses.
  const sampled = contacts.sample(body)!;
  assert.equal(sampled.ports.length, 6);
  const torso = chest.getWorldPosition(new THREE.Vector3());
  for (const port of sampled.ports) assert.ok(port.point.distanceTo(torso) < .9, 'a cold port must remain on the actual body, not inherit a stale skinned bind inverse');
  const upper = body.getObjectByName('Tailored_coat_upper') as THREE.SkinnedMesh, trousers = body.getObjectByName('Tailored_trousers') as THREE.SkinnedMesh;
  let vertexCalls = 0;
  for (const mesh of [upper, trousers]) {
    const original = mesh.getVertexPosition.bind(mesh);
    t.mock.method(mesh, 'getVertexPosition', (index: number, target: THREE.Vector3) => { vertexCalls++; return original(index, target); });
  }
  assert.equal(contacts.sample(body), sampled); assert.equal(vertexCalls, 0, 'paused contacts must reuse the saved cloth surfaces');
  body.getObjectByName('head')!.rotation.y += .02;
  assert.equal(contacts.sample(body), sampled, 'looking around without moving the supporting clothing must not rescan the underside');
  assert.equal(vertexCalls, 0);
  h.save(renderer, { ...beat, phase: 'connecting', elapsed: .8, total: 16 }); renderer.update(0, undefined, 0);
  const active = contacts.sample(body)!;
  assert.notEqual(active, sampled, 'active body motion must refresh the support');
  assert.ok(vertexCalls <= 1100, `one active surface solve must remain below 1100 skinned vertex evaluations: ${vertexCalls}`);
  const old = upper.geometry, replacement = old.clone(); upper.geometry = replacement;
  t.after(() => { upper.geometry = old; replacement.dispose(); });
  vertexCalls = 0;
  const upgraded = contacts.sample(body)!;
  assert.notEqual(upgraded, active, 'an upgraded costume must invalidate the cached triangles even when the pose is unchanged');
  assert.ok(vertexCalls > 0 && vertexCalls <= 1100);
});
