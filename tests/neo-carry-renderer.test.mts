import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, neoCarryPose, newTrilogyEpilogue, type FilmJourney, type SandboxState, type TrilogyEpilogueEncounter } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { TrilogyEpilogueRenderer } from '../packages/client/src/engine/TrilogyEpilogueRenderer.js';
import { MachineCoreRenderer } from '../packages/client/src/engine/MachineCoreRenderer.js';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

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
  const asset = await loadGeometry('neo');
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async () => asset);
  const document = globalThis.document;
  const context = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const renderers: AgentRenderer[] = [];
  t.after(() => { renderers.forEach(renderer => renderer.dispose()); globalThis.document = document; });
  const create = (player: boolean) => { const renderer = new AgentRenderer(new THREE.Scene()); renderer.setWorld(false); renderer.setPlayer(player ? 'neo' : null); renderers.push(renderer); return renderer; };
  const save = (renderer: AgentRenderer, beat: TrilogyEpilogueEncounter, delta = 0) => {
    const actor = structuredClone(world.agents.get('neo')!), center = FILM_SETS.film_machine_core.center, path = neoCarryPose(beat);
    actor.position = { x: center.x + path.x, y: center.y + path.y, z: center.z + path.z }; actor.rotation = Math.PI;
    actor.velocity = { x: 0, y: 0, z: 0 }; actor.currentLocation = 'film_machine_core'; actor.isInMatrix = false;
    actor.currentAction = { type: 'idle', parameters: { finaleComa: true, epilogue: { ...beat, role: 'neo' } }, startedAt: 0, duration: 1e9, progress: 0 };
    renderer.updateAgent('neo', actor); renderer.getAgent('neo')!.position.copy(actor.position);
    renderer.getAgentBody('neo')!.rotation.y = actor.rotation;
    renderer.setPlayerMotion({ speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, epilogue: { ...beat, role: 'neo' } });
    renderer.update(delta, undefined, 0);
  };
  return { create, save };
}
function bodyPose(renderer: AgentRenderer) {
  const body = renderer.getAgentBody('neo')!; body.parent!.parent!.updateMatrixWorld(true);
  assert.ok(body.getObjectByName('pelvis'));
  const result: Record<string, number[]> = {};
  body.traverse(o => { if (o instanceof THREE.Bone) result[o.name] = o.matrixWorld.elements.map(x => +x.toFixed(7)); });
  return result;
}
const beats: TrilogyEpilogueEncounter[] = [
  newTrilogyEpilogue('neo_carried'),
  { ...newTrilogyEpilogue('neo_carried'), phase: 'disconnecting', elapsed: 1.4, total: 1.4 },
  { ...newTrilogyEpilogue('neo_carried'), phase: 'lowering', elapsed: 1.5, total: 4.3 },
  { ...newTrilogyEpilogue('neo_carried'), phase: 'transfer', elapsed: 1.6, total: 7.5 },
  { ...newTrilogyEpilogue('neo_carried'), phase: 'departing', elapsed: 2.6, total: 11.7 },
  { ...newTrilogyEpilogue('neo_carried'), phase: 'done', total: 14.3 },
];

test('the actual carried body is identical for player, observer, cold load and paused frames', async t => {
  const h = await setup(t), warm = h.create(true), cold = h.create(false);
  for (const beat of beats) {
    h.save(warm, beat, .1); h.save(cold, beat); await new Promise(resolve => setImmediate(resolve));
    warm.update(.1); cold.update(0, undefined, 0);
    const saved = bodyPose(cold);
    assert.deepEqual(bodyPose(warm), saved, `${beat.phase}: no startup interpolation or wall-clock motion`);
    warm.update(.2); assert.deepEqual(bodyPose(warm), saved, `${beat.phase}: unchanged save keeps the body supported`);
  }
});

test('the carrier supports the delivered body and withdraws the existing uplink from its real ports', async t => {
  const h = await setup(t), actor = h.create(true), stage = new THREE.Group(), center = FILM_SETS.film_machine_core.center;
  stage.position.set(center.x, center.y - 1, center.z);
  const carrier = new TrilogyEpilogueRenderer(stage, 'neo_carried'), machine = new MachineCoreRenderer(stage);
  t.after(() => { carrier.dispose(); machine.dispose(); });
  for (const beat of beats) {
    h.save(actor, beat); await new Promise(resolve => setImmediate(resolve)); actor.update(0, undefined, 0);
    const body = actor.getAgentBody('neo')!; body.parent!.parent!.updateMatrixWorld(true);
    assert.ok(new THREE.Vector3(0, 0, 1).transformDirection(body.matrixWorld).y > .9, 'Neo must lie face up rather than face through the platform');
    carrier.update(beat, 100, body); machine.update(undefined, 100, false, { x: 0, z: neoCarryPose(beat).z }, body, beat);
    stage.updateMatrixWorld(true);
    const deck = stage.getObjectByName('neo-carry-deck'); assert.ok(deck, 'a full body support replaces the short capsule');
    const bounds = new THREE.Box3().setFromObject(deck);
    let lowest = Infinity, highestPenetration = 0, outside = 0;
    body.traverseVisible(object => {
      if (!(object instanceof THREE.SkinnedMesh)) return;
      object.skeleton.update();
      for (let i = 0; i < object.geometry.attributes.position.count; i++) {
        const p = object.localToWorld(object.getVertexPosition(i, new THREE.Vector3()));
        lowest = Math.min(lowest, p.y); highestPenetration = Math.max(highestPenetration, bounds.max.y - p.y);
        if (p.x < bounds.min.x || p.x > bounds.max.x || p.z < bounds.min.z || p.z > bounds.max.z) outside++;
      }
    });
    assert.equal(outside, 0, `${beat.phase}: head, hands and feet must fit over the carrier`);
    assert.ok(highestPenetration < .001, `${beat.phase}: body cuts through the deck by ${highestPenetration}`);
    assert.ok(lowest - bounds.max.y < .03, `${beat.phase}: body floats ${lowest - bounds.max.y} above support`);
    if (beat.phase === 'ready') {
      const socket = body.getObjectByName('cervical-interface')!, tip = stage.getObjectByName('machine-neck-tip')!;
      const point = tip.localToWorld(new THREE.Vector3(0, .14, 0));
      assert.ok(point.distanceTo(socket.getWorldPosition(new THREE.Vector3())) < .03, 'the old connection remains in the physical neck port');
      const skin: THREE.Mesh[] = [];
      // Freeze the already posed, delivered vertices once; each ray then tests
      // those exact triangles without re-running skinning for every segment.
      body.traverseVisible(object => {
        if (!(object instanceof THREE.SkinnedMesh)) return;
        const geometry = object.geometry.clone(), point = new THREE.Vector3();
        for (let i = 0; i < geometry.attributes.position.count; i++) {
          object.getVertexPosition(i, point); geometry.attributes.position.setXYZ(i, point.x, point.y, point.z);
        }
        geometry.computeBoundingBox(); geometry.computeBoundingSphere();
        const surface = new THREE.Mesh(geometry, object.material); surface.name = object.name;
        surface.matrixWorld.copy(object.matrixWorld); skin.push(surface); t.after(() => geometry.dispose());
      });
      for (let i = 0; i < 6; i++) {
        const feed = stage.getObjectByName(`machine-body-feed-${i}`) as THREE.Mesh<THREE.TubeGeometry>;
        const points = feed.geometry.parameters.path.getPoints(32).map(p => feed.localToWorld(p));
        for (let j = 1; j < points.length; j++) {
          const direction = points[j].clone().sub(points[j - 1]), length = direction.length(); direction.normalize();
          for (const offset of [new THREE.Vector3(), new THREE.Vector3(.035, 0, 0), new THREE.Vector3(-.035, 0, 0), new THREE.Vector3(0, .035, 0), new THREE.Vector3(0, -.035, 0)]) {
            const hit = new THREE.Raycaster(points[j - 1].clone().add(offset), direction, 0, length).intersectObjects(skin);
            assert.equal(hit.length, 0, `feed ${i} segment ${j} enters ${hit[0]?.object.name}: ${JSON.stringify(hit[0]?.point.toArray())}; path ${JSON.stringify(feed.geometry.parameters.path.getPoints(3).map(p => p.toArray()))}`);
          }
        }
      }
    }
    const tray = stage.getObjectByName('neo-body-transfer-tray')!, saved = tray.matrixWorld.elements.slice();
    carrier.update(beat, 999, body); stage.updateMatrixWorld(true);
    assert.deepEqual(tray.matrixWorld.elements, saved, 'the carrier cannot move with wall time while paused');
    if (beat.phase === 'done') assert.equal(stage.getObjectByName('machine-core-body-jacks')!.visible, false);
  }
});

test('the real carrier follows the current body across a phase boundary before the world snapshot arrives', async t => {
  const h = await setup(t), actor = h.create(true), scene = new THREE.Scene(), film = new FilmSetRenderer(scene);
  t.after(() => film.dispose());
  const journey: FilmJourney = { version: 1, scene: 'm3_neo_carried', actor: 'neo', step: 0, completed: [], enteredAt: 0,
    checkpoint: { ...FILM_SETS.film_machine_core.center }, reflections: {}, lastText: '', epilogue: newTrilogyEpilogue('neo_carried') };
  const sandbox = { neoLife: { journey } } as SandboxState;
  h.save(actor, journey.epilogue!); await new Promise(resolve => setImmediate(resolve)); actor.update(0, undefined, 0);
  film.setRecoverySubject(actor.getAgentBody('neo')!);
  film.update(actor.getAgentState('neo')!, sandbox, 0);
  for (const beat of beats.slice(1)) {
    h.save(actor, beat); film.update(actor.getAgentState('neo')!, sandbox, 100);
    scene.updateMatrixWorld(true);
    const tray = scene.getObjectByName('neo-body-transfer-tray')!, expected = neoCarryPose(beat);
    assert.ok(Math.abs(tray.position.y - (1.05 + expected.y)) < 1e-6,
      `${beat.phase}: stale ${journey.epilogue!.phase} world phase separates tray from the current body`);
    assert.ok(Math.abs(tray.position.z - expected.z) < 1e-6, `${beat.phase}: body and its support must travel together`);
    const before = tray.matrixWorld.elements.slice();
    film.update(actor.getAgentState('neo')!, sandbox, 999); scene.updateMatrixWorld(true);
    assert.deepEqual(tray.matrixWorld.elements, before, 'render time cannot advance the saved carrier');
  }
  journey.epilogue = beats.at(-1)!; h.save(actor, beats[1]);
  film.update(actor.getAgentState('neo')!, sandbox, 1);
  assert.equal(scene.getObjectByName('neo-body-transfer-tray')!.position.z, neoCarryPose(journey.epilogue).z,
    'an older actor packet cannot rewind the departed carrier');
  journey.visiting = journey.scene;
  film.update(actor.getAgentState('neo')!, sandbox, 1);
  assert.equal(scene.getObjectByName('neo-body-transfer-tray')!.position.z, neoCarryPose(newTrilogyEpilogue('neo_carried')).z,
    'visiting the set cannot replay a current transport packet');
});

test('the delivered body rests on an open mechanical lattice with support under its head, trunk and extremities', async t => {
  const h = await setup(t), actor = h.create(true), stage = new THREE.Group(), center = FILM_SETS.film_machine_core.center;
  stage.position.set(center.x, center.y - 1, center.z);
  const carrier = new TrilogyEpilogueRenderer(stage, 'neo_carried'); t.after(() => carrier.dispose());
  h.save(actor, beats[0]); await new Promise(resolve => setImmediate(resolve)); actor.update(0, undefined, 0);
  const body = actor.getAgentBody('neo')!; carrier.update(beats[0], 0, body); stage.updateMatrixWorld(true);
  const deck = stage.getObjectByName('neo-carry-deck')!, bounds = new THREE.Box3().setFromObject(deck);
  const size = bounds.getSize(new THREE.Vector3()), ray = new THREE.Raycaster(); let openings = 0, solid = 0;
  for (let column = 1; column < 20; column++) for (let row = 1; row < 20; row++) {
    ray.set(new THREE.Vector3(bounds.min.x + size.x * column / 20, bounds.max.y + 1, bounds.min.z + size.z * row / 20), new THREE.Vector3(0, -1, 0));
    if (ray.intersectObject(deck, false).length) solid++; else openings++;
  }
  assert.ok(openings > 65 && solid > 65, `the actual support is still a solid tabletop: ${openings} open, ${solid} solid`);
  for (let i = 0; i < 7; i++) {
    const pad = stage.getObjectByName(`neo-carry-support-${i}`)!; assert.equal(pad.visible, true);
    let gap = Infinity;
    body.traverseVisible(object => {
      if (!(object instanceof THREE.SkinnedMesh)) return;
      object.skeleton.update();
      for (let vertex = 0; vertex < object.geometry.attributes.position.count; vertex++) {
        const point = object.localToWorld(object.getVertexPosition(vertex, new THREE.Vector3()));
        ray.set(point.clone().add(new THREE.Vector3(0, .05, 0)), new THREE.Vector3(0, -1, 0));
        const hit = ray.intersectObject(pad, false)[0]; if (hit) gap = Math.min(gap, point.y - hit.point.y);
      }
    });
    assert.ok(gap >= -.002 && gap < .025, `support ${i}: visible body has penetration or floats ${gap} above its saddle`);
  }
});
