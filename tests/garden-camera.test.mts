import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, filmPosition, gardenPose, gardenGroundHeight, newTrilogyEpilogue, stepTrilogyEpilogue, type TrilogyEpilogueEncounter } from '@auto_matrix/shared';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { SunriseGardenRenderer } from '../packages/client/src/engine/SunriseGardenRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { parkLeafMask } from './helpers/park-leaf-mask.mjs';

const leafAlpha = await parkLeafMask();

async function shipped(name: string) {
  const folder = name === 'waterfront-tree' ? 'park' : 'characters';
  const bytes = await readFile(new URL(`../packages/client/public/assets/${folder}/${name}.glb`, import.meta.url));
  const length = bytes.readUInt32LE(12), document = JSON.parse(bytes.subarray(20, 20 + length).toString());
  // Node checks the shipped surfaces and joints; native screenshots check PNGs and shaders.
  for (const material of document.materials) {
    delete material.pbrMetallicRoughness.baseColorTexture; delete material.pbrMetallicRoughness.metallicRoughnessTexture;
    delete material.normalTexture; delete material.occlusionTexture;
  }
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
  const roles = ['oracle', 'architect', 'sati', 'seraph'] as const;
  const assets = Object.fromEntries(await Promise.all(['oracle-revolutions-head', 'sati-head', 'architect-head', 'architect-body', 'seraph-head', 'seraph-body', 'waterfront-tree']
    .map(async name => [name, await shipped(name)])));
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async url => {
    const name = String(url).split('/').pop()!.replace('.glb', ''); assert.ok(assets[name], name); return assets[name];
  });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  class InputTarget extends EventTarget { matches() { return false; } }
  const window = new InputTarget(), canvas = new InputTarget();
  const document = Object.assign(new InputTarget(), { pointerLockElement: null as unknown, hidden: false, exitPointerLock() {},
    createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) });
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key)); Object.assign(globalThis, { window, document });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const state = world.agents.get('oracle')!;
  const models = new CharacterModels(), center = FILM_SETS.film_sunrise_garden.center;
  const rigs = Object.fromEntries(roles.map(role => [role, models.create(world.agents.get(role)!)])) as Record<typeof roles[number], ReturnType<CharacterModels['create']>>;
  const groups = Object.fromEntries(roles.map(role => {
    const group = new THREE.Group(); rigs[role].root.position.y = -1; group.add(rigs[role].root); return [role, group];
  })) as Record<typeof roles[number], THREE.Group>;
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000);
  const controls = new PlayerControls(canvas as unknown as HTMLCanvasElement, camera, () => {}, () => {});
  const root = new THREE.Group(); root.position.set(center.x, center.y - 1, center.z);
  const scenery = new SunriseGardenRenderer(root);
  await scenery.treesReady;
  let time = 2000; t.mock.method(performance, 'now', () => time);
  let saved: TrilogyEpilogueEncounter;
  const step = (phase: TrilogyEpilogueEncounter['phase'], elapsed: number, cold = false, encounter?: TrilogyEpilogueEncounter) => {
    saved = encounter ?? { ...newTrilogyEpilogue('dawn'), phase, elapsed, total: 12.71 + elapsed };
    for (const role of roles) {
      const pose = gardenPose(saved, role); groups[role].position.copy(filmPosition('film_sunrise_garden', pose.x, pose.z)); rigs[role].root.rotation.y = pose.yaw;
      models.animate(rigs[role], 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, performance: true,
        parkOutfit: true, epilogue: { ...saved, role } }, 1);
      groups[role].updateMatrixWorld(true);
    }
    const oracle = gardenPose(saved, 'oracle');
    Object.assign(state, { currentLocation: 'film_sunrise_garden', position: filmPosition('film_sunrise_garden', oracle.x, oracle.z), rotation: oracle.yaw,
      currentAction: { type: 'idle', parameters: { epilogue: { ...saved, role: 'oracle' } }, startedAt: 0, duration: 1e9, progress: 0 } });
    if (cold) controls.possess(state);
    time += 100; controls.update(.1, state, groups.oracle, false); camera.updateWorldMatrix(true, true); scenery.update(saved); root.updateWorldMatrix(true, true);
  };
  const event = (target: EventTarget, type: string, values = {}) => target.dispatchEvent(Object.assign(new Event(type), values));
  const toggle = () => event(window, 'keydown', { code: 'KeyV', repeat: false });
  t.after(() => { controls.dispose(); scenery.dispose(); models.dispose(); ['window', 'document'].forEach((key, i) => {
    if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!); else Reflect.deleteProperty(globalThis, key);
  }); });
  step('sati', 3.328, true); await new Promise(resolve => setImmediate(resolve)); step('sati', 3.328);
  return { camera, controls, state, groups, rigs, models, document, canvas, root, scenery, step, event, toggle };
}

function vertices(root: THREE.Object3D) {
  const result: THREE.Vector3[] = []; root.updateMatrixWorld(true);
  root.traverseVisible(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.updateMatrixWorld(true);
    if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
    for (let i = 0; i < object.geometry.attributes.position.count; i++) result.push(object.localToWorld(object.getVertexPosition(i, new THREE.Vector3())));
  });
  return result;
}

test('the saved Sati arrival keeps the real Oracle, Sati and Seraph bodies above the lower HUD in both window shapes', async t => {
  const h = await fixture(t);
  for (const aspect of [16 / 9, .65]) {
    h.camera.aspect = aspect; h.step('sati', 3.328, true);
    for (const role of ['oracle', 'sati', 'seraph'] as const) {
      const outside = vertices(h.rigs[role].root).map(point => point.project(h.camera))
        .filter(point => Math.abs(point.x) > .92 || Math.abs(point.y) > .63 || point.z < -1 || point.z > 1);
      assert.equal(outside.length, 0, `${aspect}: ${role} is cropped or behind the HUD: ${outside[0]?.toArray()}`);
    }
  }
});

test('the shipped Sati and Seraph bodies stay supported on the rolling lawn throughout finite saved walking samples', async t => {
  const h = await fixture(t), center = FILM_SETS.film_sunrise_garden.center;
  for (const elapsed of [0, .4, 1.2, 2.6, 4.4, 6, 8, 10.3, 12]) {
    h.step('sati', elapsed, true);
    for (const role of ['sati', 'seraph'] as const) {
      const gaps = vertices(h.rigs[role].root).map(point => point.y - (center.y - 1 + gardenGroundHeight(point.x - center.x, point.z - center.z)));
      const lowest = Math.min(...gaps);
      assert.ok(lowest >= -.012, `${role}/${elapsed}: a shipped visible surface penetrates the slope by ${-lowest}`);
      assert.ok(lowest < .075, `${role}/${elapsed}: the performer floats above the lawn by ${lowest}`);
    }
  }
});

test('the shipped Architect turns, walks to the promenade and continues off camera with supported shoes and an exact cold pose', async t => {
  const h = await fixture(t), center = FILM_SETS.film_sunrise_garden.center;
  let encounter: TrilogyEpilogueEncounter = { ...newTrilogyEpilogue('dawn'), phase: 'leaving', total: 7.8 };
  const samples = new Set([1, 4, 6, 9, 12, 16, 23, 26, 29, 32, 34, 38, 48, 60, 100, 160, 230, 260]);
  for (let frame = 1; frame <= 260; frame++) {
    encounter = stepTrilogyEpilogue(encounter, .1);
    if (!samples.has(frame)) continue;
    h.step(encounter.phase, encounter.elapsed, true, encounter);
    const body = vertices(h.rigs.architect.root), pose = gardenPose(encounter, 'architect');
    const gaps = body.map(point => point.y - (center.y - 1 + gardenGroundHeight(point.x - center.x, point.z - center.z)));
    const lowest = gaps.reduce((low, gap) => Math.min(low, gap), Infinity);
    assert.ok(lowest >= -.012, `${frame / 10}: the visible shoe or suit penetrates the ground by ${-lowest}`);
    assert.ok(lowest < .075, `${frame / 10}: the Architect floats above the promenade by ${lowest}`);
    if (frame === 12) assert.ok(Math.cos(pose.yaw) < -.99, 'the first steps must face away from the seated Oracle');
    if (encounter.phase === 'leaving') for (const aspect of [16 / 9, .65]) {
      h.camera.aspect = aspect; h.step(encounter.phase, encounter.elapsed, true, encounter);
      for (const role of ['oracle', 'architect'] as const) assert.ok(vertices(h.rigs[role].root).every(point => {
        point.project(h.camera); return Math.abs(point.x) <= .92 && Math.abs(point.y) <= .63 && point.z >= -1 && point.z <= 1;
      }), `${frame / 10}/${aspect}/${role}: the departing pair leaves the safe picture`);
    }
    const saved = JSON.parse(JSON.stringify(encounter));
    h.step(saved.phase, saved.elapsed, true, saved); const cold = vertices(h.rigs.architect.root);
    h.step(saved.phase, saved.elapsed, false, saved);
    assert.ok(vertices(h.rigs.architect.root).every((point, i) => point.distanceTo(cold[i]) < 1e-7), 'paused animation cannot drift');
    assert.ok(body.every((point, i) => point.distanceTo(cold[i]) < 1e-7), 'cold loading cannot alter the visible saved pose');
  }
  assert.equal(encounter.phase, 'promise'); assert.ok(gardenPose(encounter, 'architect').x < -90);
  for (let frame = 260; frame < 400; frame++) encounter = stepTrilogyEpilogue(encounter, .1);
  encounter = { ...encounter, phase: 'done', elapsed: 0 };
  for (const aspect of [16 / 9, .65]) {
    h.camera.aspect = aspect; h.step('done', 0, true, encounter);
    assert.ok(vertices(h.rigs.architect.root).every(point => point.project(h.camera).x < -1), 'the Architect must finish beyond the complete final shot, not stand at its visible edge');
  }
  for (const x of [-100, -120, gardenPose(encounter, 'architect').x]) {
    const hit = new THREE.Raycaster(new THREE.Vector3(center.x + x, center.y + 4, center.z - 31), new THREE.Vector3(0, -1, 0), 0, 10)
      .intersectObject(h.scenery.group, true)[0];
    assert.ok(hit && Math.abs(hit.point.y - (center.y - 1)) < .015, `${x}: the departure needs a real paved surface, not only a mathematical floor`);
  }
});

test('the controllable Oracle can walk the hill with her actual shoes supported even before the seated performance starts', async t => {
  const h = await fixture(t), center = FILM_SETS.film_sunrise_garden.center;
  for (const z of [2, 10, 20, 27, 44]) for (const yaw of [0, Math.PI]) {
    h.groups.oracle.position.copy(filmPosition('film_sunrise_garden', 0, z)); h.rigs.oracle.root.rotation.y = yaw;
    for (let frame = 0; frame < 12; frame++) {
      h.models.animate(h.rigs.oracle, .05, { speed: 3.4, grounded: true, verticalVelocity: 0, turn: 0, parkOutfit: true }, 1);
      h.groups.oracle.updateWorldMatrix(true, true);
      const gaps = vertices(h.rigs.oracle.root).map(point => point.y - (center.y - 1 + gardenGroundHeight(point.x - center.x, point.z - center.z)));
      const lowest = Math.min(...gaps);
      if (lowest < -.025) h.rigs.oracle.root.traverseVisible(object => {
        if (!(object instanceof THREE.Mesh)) return;
        if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
        let gap = Infinity;
        for (let index = 0; index < object.geometry.attributes.position.count; index++) {
          const point = object.localToWorld(object.getVertexPosition(index, new THREE.Vector3()));
          gap = Math.min(gap, point.y - (center.y - 1 + gardenGroundHeight(point.x - center.x, point.z - center.z)));
        }
        if (gap < -.025) t.diagnostic(`${object.name || object.uuid}: ground gap ${gap}`);
      });
      assert.ok(lowest >= -.025, `Oracle walk ${z}/${yaw}/${frame}: a visible garment or shoe penetrates the hill by ${-lowest}`);
      assert.ok(lowest < .1, `Oracle walk ${z}/${yaw}/${frame}: both shoes float above the hill by ${lowest}`);
    }
  }
});

test('paused park third person responds to mouse orbit and retains it without changing the saved event or body', async t => {
  const h = await fixture(t), before = h.camera.matrixWorld.clone(), saved = structuredClone(h.state.currentAction);
  const body = vertices(h.rigs.seraph.root);
  h.document.pointerLockElement = h.canvas;
  h.event(h.document, 'mousemove', { movementX: 160, movementY: 30 }); h.step('sati', 3.328);
  assert.ok(!h.camera.matrixWorld.equals(before), 'the fixed epilogue shot must not ignore third-person mouse input');
  const orbit = h.camera.matrixWorld.clone(); h.step('sati', 3.328);
  assert.ok(h.camera.matrixWorld.equals(orbit), 'a paused shot must not drift back toward its default angle');
  assert.deepEqual(h.state.currentAction, saved);
  assert.ok(vertices(h.rigs.seraph.root).every((point, i) => point.distanceTo(body[i]) < 1e-6), 'looking cannot advance the frozen performance');
  h.toggle(); h.step('sati', 3.328); h.controls.syncNeoCarryCamera(h.groups.oracle);
  const eye = h.rigs.oracle.head.localToWorld(new THREE.Vector3(0, 0, .27));
  assert.ok(h.camera.position.distanceTo(eye) < 1e-7, 'V still uses the actual seated head');
  const direction = h.camera.getWorldDirection(new THREE.Vector3());
  h.event(h.document, 'mousemove', { movementX: 160, movementY: -40 }); h.step('sati', 3.328); h.controls.syncNeoCarryCamera(h.groups.oracle);
  assert.ok(h.camera.getWorldDirection(new THREE.Vector3()).distanceTo(direction) > .1);
  h.toggle(); h.step('sati', 3.328);
  assert.ok(h.camera.matrixWorld.equals(orbit), 'returning from first person restores the third-person orbit');
});

test('park shots frame the arriving and departing speakers, then the reunited group and sunrise, without hiding heads behind the set', async t => {
  const h = await fixture(t);
  const samples: [TrilogyEpilogueEncounter['phase'], number, ('oracle' | 'architect' | 'sati' | 'seraph')[]][] = [
    ['sitting', 1.479, ['oracle']], ['architect', 0, ['oracle', 'architect']], ['architect', 1.6, ['oracle', 'architect']],
    ['architect', 3.8, ['oracle', 'architect']], ['choice', 0, ['oracle', 'architect']], ['leaving', 2.2, ['oracle', 'architect']],
    ['leaving', 4.8, ['oracle', 'architect']], ['promise', 0, ['oracle', 'sati', 'seraph']],
    ...[0, 1.6, 3.328, 4.8, 6, 8, 9.2, 10.3, 12].map(elapsed => ['sati', elapsed, ['oracle', 'sati', 'seraph']] as typeof samples[number]),
    ...[0, 3.1, 6.2].map(elapsed => ['sunrise', elapsed, ['oracle', 'sati', 'seraph']] as typeof samples[number]),
    ['belief', 1.2, ['oracle', 'sati', 'seraph']], ['done', 0, ['oracle', 'sati', 'seraph']],
  ];
  for (const [phase, elapsed, roles] of samples) for (const aspect of [16 / 9, .65]) {
    h.camera.aspect = aspect; h.step(phase, elapsed, true);
    for (const role of roles) {
      const outside = vertices(h.rigs[role].root).map(point => point.project(h.camera))
        .filter(point => Math.abs(point.x) > .92 || Math.abs(point.y) > .63 || point.z < -1 || point.z > 1);
      assert.equal(outside.length, 0, `${phase}/${elapsed}/${aspect}/${role}: silhouette outside safe picture ${outside[0]?.toArray()}`);
      const head = h.rigs[role].head.getWorldPosition(new THREE.Vector3()), direction = head.clone().sub(h.camera.position);
      const hits = new THREE.Raycaster(h.camera.position, direction.clone().normalize(), .06, direction.length() - .12)
        .intersectObject(h.scenery.group, true).filter(hit => {
          for (let object: THREE.Object3D | null = hit.object; object; object = object.parent) if (!object.visible) return false;
          const material = hit.object.material as THREE.MeshStandardMaterial;
          if (material.name.endsWith('_leaves')) {
            assert.ok(hit.uv, 'leaf intersections must retain the shipped cutout coordinates');
            if (leafAlpha(hit.uv) < material.alphaTest) return false;
          }
          return !material.transparent;
        });
      assert.equal(hits.length, 0, `${phase}/${elapsed}/${aspect}/${role}: set blocks the speaker's head: ${hits[0]?.object.name}/${hits[0]?.instanceId}, uv=${hits[0]?.uv?.toArray()}`);
    }
    const matrix = h.camera.matrixWorld.clone(); h.step(phase, elapsed);
    assert.ok(h.camera.matrixWorld.equals(matrix), `${phase}: paused framing drifts`);
    h.step(phase, elapsed, true); assert.ok(h.camera.matrixWorld.equals(matrix), `${phase}: reconnect changes the canonical saved shot`);
  }
});
