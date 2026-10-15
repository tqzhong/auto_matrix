import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import * as THREE from 'three';
import { FILM_SETS, AMBUSH_WINDOW_PROGRESS, AMBUSH_SEALS, ambushRetreatShift, ambushRetreatRoot, filmPosition, playerBlocked, newAmbushEscape, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { AmbushSetRenderer } from '../packages/client/src/engine/AmbushSetRenderer.js';
import type { CharacterRig } from '../packages/client/src/agents/CharacterModel.js';
import { Engine } from '../packages/client/src/engine/Engine.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

test('the new phone interaction initially faces the actual pair in both views, then preserves free look', t => {
  class Target extends EventTarget { matches() { return false; } }
  const window = new Target(), canvas = new Target(), document = Object.assign(new Target(), { pointerLockElement: canvas, hidden: false, exitPointerLock() {} });
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key)); Object.assign(globalThis, { window, document });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!, morpheus = world.agents.get('morpheus')!, trinity = world.agents.get('trinity')!;
  for (const [actor, x, z] of [[neo, -5.4, -13.2], [morpheus, -5.4, -16], [trinity, -1.2, -16]] as const) {
    actor.currentLocation = 'film_ambush_house'; actor.isInMatrix = true;
    actor.position = filmPosition('film_ambush_house', x, z); actor.position.y -= 37;
    actor.rotation = Math.PI / 2;
  }
  neo.controller = 'phone-view';
  const journey = { scene: 'm1_dejavu', actor: 'neo', step: 1, completed: [], ambushEscape: { ...newAmbushEscape(), phase: 'call' } } as FilmJourney;
  const sandbox = { nodes: [], structures: [], threats: [], incidents: [], missions: {}, neoLife: { journey, missions: {} } } as unknown as SandboxState;
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000), group = new THREE.Group(); group.add(new THREE.Group());
  const controls = new PlayerControls(canvas as unknown as HTMLCanvasElement, camera, () => {}, () => {});
  const engine = { playerControls: controls, running: false, sandboxRenderer: { sync() {} }, updateAtmosphere() {} } as unknown as Engine;
  const frame = () => { Engine.prototype.setSandbox.call(engine, sandbox, Object.fromEntries(world.agents)); controls.update(.016, { ...neo, position: { ...neo.position } }, group, false); camera.updateMatrixWorld(true); };
  const key = (code: string) => window.dispatchEvent(Object.assign(new Event('keydown'), { code, repeat: false }));
  t.after(() => { controls.dispose(); ['window', 'document'].forEach((key, i) => {
    if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!); else Reflect.deleteProperty(globalThis, key);
  }); });
  const origin = { ...neo.position };
  for (const firstPerson of [true, false]) {
    controls.release(); controls.possess(neo);
    if (controls.firstPerson !== firstPerson) key('KeyV');
    frame();
    const point = new THREE.Vector3((morpheus.position.x + trinity.position.x) / 2, morpheus.position.y + 2.8, morpheus.position.z);
    const screen = point.project(camera);
    assert.ok(Math.abs(screen.x) < .8 && Math.abs(screen.y) < .8 && screen.z > -1 && screen.z < 1,
      `the call must face its actors instead of Neo's previous eastward travel, firstPerson=${firstPerson}: ${screen.toArray()}`);
    assert.deepEqual(neo.position, origin); assert.equal(controls.performing, false);
    document.dispatchEvent(Object.assign(new Event('mousemove'), { movementX: 180, movementY: 50 }));
    for (let settle = 0; settle < 80; settle++) frame();
    const direction = camera.getWorldDirection(new THREE.Vector3());
    trinity.position.x -= .3; journey.ambushEscape!.elapsed += .5; frame();
    assert.ok(camera.getWorldDirection(new THREE.Vector3()).distanceTo(direction) < 1e-7, 'later network snapshots cannot overwrite player free look');
  }
  journey.ambushEscape!.phase = 'phone'; frame();
  assert.equal(controls.ambushCallTarget, undefined);
  journey.ambushEscape!.phase = 'call'; delete journey.ambushEscape!.callPerformance; frame();
  assert.equal(controls.ambushCallTarget, undefined, 'legacy calls retain their original camera');
  journey.ambushEscape!.callPerformance = true; journey.visiting = 'm1_dejavu'; frame();
  assert.equal(controls.ambushCallTarget, undefined, 'visits must not start the story camera');
  journey.visiting = undefined; neo.position.x += 14; controls.release(); controls.possess(neo); frame();
  assert.ok(camera.getWorldDirection(new THREE.Vector3()).x > .8, 'cold loading after walking away keeps the normal player direction');
  neo.position = { ...origin }; frame();
  assert.ok(camera.getWorldDirection(new THREE.Vector3()).x > .8, 'returning to the same call cannot reopen its cancelled initial view');
  journey.ambushEscape!.phase = 'phone'; frame(); journey.ambushEscape!.phase = 'call'; frame();
  const renewed = new THREE.Vector3().copy(controls.ambushCallTarget!).project(camera);
  assert.ok(Math.hypot(renewed.x, renewed.y) < 1e-7, 'a later call can establish a new local observation');
});

async function actualModels(t: TestContext) {
  const pending: Promise<unknown>[] = [], assets = new Map<string, Promise<any>>();
  const gate = Promise.resolve();
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async url => {
    const name = String(url).split('/').pop()!;
    if (!assets.has(name)) assets.set(name, (async () => {
      await gate;
      const raw = await readFile(new URL(`../packages/client/public/assets/characters/${name}`, import.meta.url)), size = raw.readUInt32LE(12);
      const doc = JSON.parse(raw.subarray(20, 20 + size).toString());
      for (const material of doc.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
      doc.images = []; doc.textures = [];
      const json = Buffer.from(JSON.stringify(doc)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
      const bin = raw.subarray(20 + size), data = Buffer.alloc(20 + padded.length + bin.length);
      data.writeUInt32LE(0x46546c67); data.writeUInt32LE(2, 4); data.writeUInt32LE(data.length, 8);
      data.writeUInt32LE(padded.length, 12); data.writeUInt32LE(0x4e4f534a, 16); padded.copy(data, 20); bin.copy(data, 20 + padded.length);
      return new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '');
    })());
    const promise = assets.get(name)!; pending.push(promise); const asset = await promise; return { ...asset, scene: clone(asset.scene) };
  });

  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  return async () => { await Promise.all(pending); await new Promise(resolve => setImmediate(resolve)); };
}


async function actualCall(t: TestContext) {
  class Target extends EventTarget { matches() { return false; } }
  const window = new Target(), canvas = new Target(), document = Object.assign(new Target(), { pointerLockElement: canvas, hidden: false, exitPointerLock() {},
    createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {}, fillRect() {}, strokeRect() {}, fillText() {}, createRadialGradient: () => ({ addColorStop() {} }) }) }) });
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key)); Object.assign(globalThis, { window, document });
  const settle = await actualModels(t), world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!, center = FILM_SETS.film_ambush_house.center;
  // The ordinary-protocol saved call position, not a re-staged display pose.
  Object.assign(neo, { currentLocation: 'film_ambush_house', isInMatrix: true, isAwakened: true, position: { x: center.x - 5.719980071202, y: center.y - 37, z: center.z - 13.19687606267 }, rotation: Math.PI / 2, currentAction: null });
  const journey = { scene: 'm1_dejavu', actor: 'neo', step: 1, completed: [], ambushEscape: { ...newAmbushEscape(), phase: 'call', elapsed: 4.232 } } as FilmJourney;
  const sandbox = { nodes: [], structures: [], threats: [], incidents: [], missions: {}, neoLife: { journey, missions: {} } } as unknown as SandboxState;
  sandbox.structures = AMBUSH_SEALS.map((wall, i) => ({ id: `film:ambush:seal:-37:${i}`, kind: 'barricade', owner: 'matrix', matrix: true, health: 1,
    position: { x: center.x + wall.x, y: center.y - 37, z: center.z + wall.z }, film: { scene: 'm1_dejavu', width: wall.width, depth: wall.depth, height: 7.4 } }));
  const scene = new THREE.Scene(), agents = new AgentRenderer(scene), setRoot = new THREE.Group(); setRoot.position.set(center.x, center.y - 1, center.z); scene.add(setRoot);
  const set = new AmbushSetRenderer(setRoot), camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000);
  const controls = new PlayerControls(canvas as unknown as HTMLCanvasElement, camera, () => {}, () => {});
  const engine = { playerControls: controls, running: false, sandboxRenderer: { sync() {} }, updateAtmosphere() {} } as unknown as Engine;
  agents.updateAgent('neo', neo);
  for (const role of ['morpheus', 'trinity'] as const) {
    const actor = world.agents.get(role)!, progress = AMBUSH_WINDOW_PROGRESS + ambushRetreatShift(role) - (role === 'morpheus' ? 12.6 : 16.8 - 1.65), root = ambushRetreatRoot(progress, role);
    Object.assign(actor, { currentLocation: 'film_ambush_house', isInMatrix: true, position: { x: center.x + root.x, y: center.y + root.y, z: center.z + root.z }, rotation: role === 'morpheus' ? Math.PI / 2 : -Math.PI / 2, velocity: { x: 0, y: 0, z: 0 },
      currentAction: { type: 'idle', parameters: { resolved: true, armed: false, ambushEscort: { role, progress, retreat: true, watching: true }, ambushCall: { role, elapsed: 2.632 } }, startedAt: 0, duration: 1, progress: 0 } });
    agents.updateAgent(role, actor);
  }
  await settle();
  const rig = (id: string) => (agents as unknown as { agents: Map<string, { rig: CharacterRig }> }).agents.get(id)!.rig;
  const frame = (running = false) => {
    Engine.prototype.setSandbox.call(engine, sandbox, Object.fromEntries(world.agents));
    controls.update(.016, neo, agents.getAgent('neo')!, running);
    agents.setPlayer('neo', controls.firstPerson); agents.setPlayerMotion(controls.motion); agents.update(.016, camera, running ? 1 : 0, 1, journey);
    set.update(journey, sandbox.structures, journey.ambushEscape!.elapsed); scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
  };
  const key = (code: string, down = true) => window.dispatchEvent(Object.assign(new Event(down ? 'keydown' : 'keyup'), { code, repeat: false }));
  const view = (first: boolean, aspect: number) => { controls.release(); controls.possess(neo); camera.aspect = aspect; if (first) key('KeyV'); frame(); };
  t.after(() => { controls.dispose(); agents.dispose(); set.dispose(); ['window', 'document'].forEach((key, i) => { if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!); else Reflect.deleteProperty(globalThis, key); }); });
  return { scene, setRoot, sandbox, agents, rig, controls, camera, neo, world, journey, frame, key, view, document };
}
function visibleMeshes(scene: THREE.Object3D) {
  const meshes: THREE.Mesh[] = []; scene.traverseVisible(object => { if (object instanceof THREE.Mesh && !(object.material as THREE.Material).transparent) { if (object instanceof THREE.SkinnedMesh) object.computeBoundingSphere(); meshes.push(object); } }); return meshes;
}
function belongsTo(object: THREE.Object3D, root: THREE.Object3D): boolean { for (let p: THREE.Object3D | null = object; p; p = p.parent) if (p === root) return true; return false; }

test('the actual third-person call clears Neo and the building from both delivered faces', async t => {
  const h = await actualCall(t), original = { ...h.neo.position };
  for (const aspect of [16 / 9, .72]) {
    h.view(false, aspect); const meshes = visibleMeshes(h.scene);
    for (const id of ['morpheus', 'trinity']) {
      const rig = h.rig(id), point = rig.hero!.bones.get('head')!.getWorldPosition(new THREE.Vector3()), ndc = point.clone().project(h.camera);
      assert.ok(Math.abs(ndc.x) < .85 && Math.abs(ndc.y) < .85 && ndc.z > -1 && ndc.z < 1, `${id} head leaves the player frame: ${ndc.toArray()}`);
      const hit = new THREE.Raycaster(h.camera.position, point.clone().sub(h.camera.position).normalize(), h.camera.near, point.distanceTo(h.camera.position) + .01).intersectObjects(meshes, false)[0];
      assert.ok(hit && belongsTo(hit.object, rig.root), `${id} head is hidden by ${hit?.object.name}, Neo=${hit && belongsTo(hit.object, h.rig('neo').root)}`);
    }
    assert.deepEqual(h.neo.position, original, 'viewing cannot move Neo');
  }
});

test('the actual narrow first-person call includes both entire skinned heads without moving the eyes', async t => {
  const h = await actualCall(t); h.view(true, .72);
  assert.ok(h.camera.position.distanceTo(new THREE.Vector3(h.neo.position.x, h.neo.position.y + 2.99, h.neo.position.z)) < 1e-7, 'first person remains at Neo');
  for (const id of ['morpheus', 'trinity']) {
    const rig = h.rig(id), skin = rig.hero!.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh, head = rig.hero!.bones.get('head')!;
    const { skinIndex, skinWeight, position } = skin.geometry.attributes;
    let count = 0, maximum = 0;
    for (let i = 0; i < position.count; i++) {
      if (![0, 1, 2, 3].some(j => skinWeight.getComponent(i, j) > .5 && skin.skeleton.bones[skinIndex.getComponent(i, j)] === head)) continue;
      const point = skin.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(skin.matrixWorld), ndc = point.project(h.camera);
      count++; maximum = Math.max(maximum, Math.abs(ndc.x), Math.abs(ndc.y));
    }
    assert.ok(count > 500, 'measure the delivered skinned head');
    assert.ok(maximum < .95, `${id} actual face/head is cropped: maximum NDC ${maximum}`);
  }
});

test('reachable call trigger positions keep the observation camera inside the room and both faces clear', async t => {
  const h = await actualCall(t), center = FILM_SETS.film_ambush_house.center, start = new THREE.Vector3().copy(h.neo.position);
  const positions = [[-8.6, -14.5], [-8.5, -15.2], [-8.6, -17.5], [-3, -13.2], [-5.4, -12.2]];
  for (const [x, z] of positions) {
    const end = new THREE.Vector3(center.x + x, start.y, center.z + z);
    assert.ok(end.distanceTo(new THREE.Vector3().copy(h.world.agents.get('morpheus')!.position)) <= 4, 'sample must be in the actual G interaction radius');
    const path = z < -17 ? [start, new THREE.Vector3(center.x - 8.6, start.y, center.z - 14.5), end] : [start, end];
    for (let segment = 1; segment < path.length; segment++) for (let i = 0; i <= 40; i++) {
      const point = path[segment - 1].clone().lerp(path[segment], i / 40);
      assert.equal(playerBlocked(point, true, 1.1, h.sandbox.structures), false, `sample is reachable on the shared floor: ${x},${z},${i}`);
      for (const id of ['morpheus', 'trinity']) assert.ok(point.distanceTo(new THREE.Vector3().copy(h.world.agents.get(id)!.position)) >= 2.2, 'the path cannot walk through an actor');
    }
    h.neo.position = { x: end.x, y: end.y, z: end.z }; h.agents.updateAgent('neo', h.neo);
    for (const aspect of [16 / 9, .72]) {
      h.view(false, aspect); const meshes = visibleMeshes(h.scene), architecture = visibleMeshes(h.setRoot);
      // playerBlocked takes a standing body's foot height, not an elevated camera eye.
      assert.equal(playerBlocked({ x: h.camera.position.x, y: start.y, z: h.camera.position.z }, true, .5, h.sandbox.structures), false,
        `the camera footprint crosses a shared wall: trigger=${x},${z}, camera=${h.camera.position.toArray()}`);
      for (const axis of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
        const hit = new THREE.Raycaster(h.camera.position, new THREE.Vector3(...axis), 0, h.camera.near + .12).intersectObjects(architecture, false)[0];
        assert.ok(!hit, `the near plane meets actual room geometry ${hit?.object.name} at ${hit?.distance} from trigger ${x},${z}`);
      }
      for (const id of ['morpheus', 'trinity']) {
        const rig = h.rig(id), point = rig.hero!.bones.get('head')!.getWorldPosition(new THREE.Vector3()), ndc = point.clone().project(h.camera);
        assert.ok(Math.max(Math.abs(ndc.x), Math.abs(ndc.y)) < .85 && ndc.z > -1 && ndc.z < 1, `${id} is cropped from trigger ${x},${z}`);
        const hit = new THREE.Raycaster(h.camera.position, point.clone().sub(h.camera.position).normalize(), h.camera.near, point.distanceTo(h.camera.position) + .01).intersectObjects(meshes, false)[0];
        assert.ok(hit && belongsTo(hit.object, rig.root), `${id} is obscured by ${hit?.object.name} from trigger ${x},${z}`);
      }
      assert.deepEqual(h.neo.position, { x: end.x, y: end.y, z: end.z }, 'view selection cannot reposition the player');
    }
  }
});

test('the initial wide and narrow player views can see the actual transferred phone through the room', async t => {
  const h = await actualCall(t);
  for (const id of ['morpheus', 'trinity']) {
    const actor = h.world.agents.get(id)!; (actor.currentAction!.parameters.ambushCall as { elapsed: number }).elapsed = 1.1;
    h.agents.updateAgent(id, actor);
  }
  for (const aspect of [16 / 9, .72]) for (const first of [false, true]) {
    h.view(first, aspect); const phone = h.rig('morpheus').phone!.root, meshes = visibleMeshes(h.scene);
    let seen = 0, checked = 0;
    phone.traverseVisible(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const positions = object.geometry.attributes.position;
      for (let i = 0; i < positions.count; i += Math.ceil(positions.count / 3)) {
        const point = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld), ndc = point.clone().project(h.camera);
        if (Math.abs(ndc.x) > 1 || Math.abs(ndc.y) > 1 || ndc.z < -1 || ndc.z > 1) continue;
        checked++;
        const hit = new THREE.Raycaster(h.camera.position, point.clone().sub(h.camera.position).normalize(), h.camera.near, point.distanceTo(h.camera.position) + .005).intersectObjects(meshes, false)[0];
        if (hit && belongsTo(hit.object, phone)) seen++;
      }
    });
    assert.ok(checked > 30 && seen > 2, `the actual handed-over phone is hidden: aspect=${aspect}, first=${first}, visible=${seen}/${checked}`);
  }
});

test('call observation cancels on deliberate look or movement, preserves V and never re-enters until a new call', async t => {
  const h = await actualCall(t); h.view(false, 16 / 9);
  const initial = h.camera.position.clone();
  h.document.dispatchEvent(Object.assign(new Event('mousemove'), { movementX: 0, movementY: 0 })); h.frame();
  assert.ok(h.camera.position.distanceTo(initial) < 1e-7, 'a zero mouse event cannot cancel the initial shoulder view');
  h.key('KeyV'); h.key('KeyV', false); h.frame();
  assert.equal(h.controls.firstPerson, true); assert.ok(h.camera.position.distanceTo(new THREE.Vector3(h.neo.position.x, h.neo.position.y + 2.99, h.neo.position.z)) < 1e-7);
  h.key('KeyV'); h.key('KeyV', false); h.frame();
  h.document.dispatchEvent(Object.assign(new Event('mousemove'), { movementX: 60, movementY: -20 }));
  for (let i = 0; i < 80; i++) h.frame();
  assert.ok(h.camera.position.distanceTo(initial) > 1, 'manual look releases the special shoulder position');
  const direction = h.camera.getWorldDirection(new THREE.Vector3()); h.world.agents.get('trinity')!.position.x += .2; h.frame();
  assert.ok(direction.distanceTo(h.camera.getWorldDirection(new THREE.Vector3())) < 1e-7, 'actor movement cannot resume the cancelled observation');
  h.view(false, .72); const position = { ...h.controls.position }; h.key('KeyS'); h.frame(true); h.key('KeyS', false);
  assert.ok(Math.hypot(h.controls.position.x - position.x, h.controls.position.z - position.z) > 0, 'Neo can walk during the call');
  for (let i = 0; i < 80; i++) h.frame();
  assert.ok(h.camera.fov < 58, 'movement restores the ordinary third-person lens');
  h.journey.ambushEscape!.phase = 'forming'; h.frame(); assert.equal(h.controls.ambushCallTarget, undefined);
  h.journey.ambushEscape!.phase = 'call'; h.frame(); assert.ok(h.camera.fov > 70, 'a later new call may establish its initial view');
  h.controls.release(); h.controls.possess(h.neo); h.key('KeyS'); h.frame(true); h.key('KeyS', false);
  assert.ok(h.camera.fov < 58, 'a held movement key before the first call frame must not start the observation');
});
