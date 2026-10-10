import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MAGGIE_DISCOVERY, HAMMER_MEDICAL, FILM_SETS, filmPosition, maggieDiscoveryTarget, maggieDiscoveryRoot, newMaggieDiscovery, type FilmJourney, type MaggieDiscovery } from '@auto_matrix/shared';
import { MaggieDiscoveryRenderer } from '../packages/client/src/engine/MaggieDiscoveryRenderer.js';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

async function geometry(id: string) {
  const glb = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
  const length = glb.readUInt32LE(12), document = JSON.parse(glb.subarray(20, 20 + length).toString());
  for (const material of document.materials) { delete material.pbrMetallicRoughness?.baseColorTexture; delete material.normalTexture; }
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = glb.subarray(20 + length), result = Buffer.alloc(20 + padded.length + bin.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); bin.copy(result, 20 + padded.length);
  return new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
}
async function setup(t: test.TestContext) {
  const ids = ['maggie', 'colt', 'link', 'roland'].flatMap(role => [`${role}-head`, `${role}-body`]);
  ids.push('morpheus');
  const assets = new Map(await Promise.all(ids.map(async id => [`${id}.glb`, await geometry(id)] as const)));
  t.mock.method(GLTFLoader.prototype, 'loadAsync', (url: string) => assets.has(url.split('/').at(-1)!) ? Promise.resolve(assets.get(url.split('/').at(-1)!)) : new Promise(() => {}));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const old = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, stroke() {}, ellipse() {}, fill() {}, createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const center = FILM_SETS.film_hammer_deck.center;
  const scene = new THREE.Scene(), renderer = new AgentRenderer(scene); renderer.setWorld(false);
  const set = new THREE.Group(); set.position.set(center.x, center.y - 1, center.z); scene.add(set); const room = new MaggieDiscoveryRenderer(set);
  const pose = (state: MaggieDiscovery, delta = 0) => {
    const journey = { version: 1, scene: 'm3_maggie_discovery', actor: 'roland', step: 2, enteredAt: 9500, completed: [], reflections: {}, checkpoint: center, lastText: '', maggieDiscovery: state } as FilmJourney;
    for (const role of ['maggie', 'roland', 'colt', 'link'] as const) {
      const actor = structuredClone(world.agents.get(role)!);
      const point = role === 'maggie' ? MAGGIE_DISCOVERY.corpse : role === 'roland' ? maggieDiscoveryTarget(state) : MAGGIE_DISCOVERY.roots[role];
      Object.assign(actor, { status: role === 'maggie' ? 'dead' : 'alive', health: role === 'maggie' ? 0 : 47, currentLocation: 'film_hammer_deck', isInMatrix: false,
        position: filmPosition('film_hammer_deck', point.x, point.z), rotation: role === 'roland' ? -Math.PI / 2 : role === 'maggie' ? 0 : MAGGIE_DISCOVERY.roots[role].yaw,
        currentAction: { type: 'idle', parameters: { resolved: true, maggieDiscovery: { ...state, role } }, startedAt: 9500, duration: 1e9, progress: 0 } });
      renderer.updateAgent(role, actor);
    }
    renderer.update(delta, undefined, 0, 9510, journey); room.update(state); scene.updateMatrixWorld(true);
    scene.traverse(object => { if (object instanceof THREE.SkinnedMesh) object.skeleton.update(); });
    return scene;
  };
  t.after(() => { renderer.dispose(); room.dispose(); globalThis.document = old; });
  const state = { ...newMaggieDiscovery(2, 47), phase: 'covering', incident: true, cover: 1.7, elapsed: 1.7 } as MaggieDiscovery;
  pose(state); await new Promise(resolve => setImmediate(resolve)); pose(state); await new Promise(resolve => setImmediate(resolve)); pose(state);
  return { pose, renderer, room, set, center, state };
}
function vertices(body: THREE.Object3D) {
  const parts: Record<string, THREE.Vector3[]> = {};
  body.traverseVisible(object => {
    if (!(object instanceof THREE.Mesh)) return;
    if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
    parts[object.name] = Array.from({ length: object.geometry.attributes.position.count }, (_, i) => object.localToWorld(object.getVertexPosition(i, new THREE.Vector3())));
  });
  return parts;
}

test('the dedicated infirmary has two real berths, an open entry, a physical cover and no replacement prop corpse', () => {
  const root = new THREE.Group(), room = new MaggieDiscoveryRenderer(root);
  try {
    assert.ok(root.getObjectByName('maggie-medical-bed')); assert.ok(root.getObjectByName('bane-empty-medical-berth'));
    assert.equal(root.getObjectByName('maggie-covered-stretcher'), undefined); assert.equal(root.getObjectByName('maggie-body-sheet')!.visible, false);
    room.update({ ...newMaggieDiscovery(1, 100), incident: false });
    const ray = new THREE.Raycaster(new THREE.Vector3(0, 3, 15), new THREE.Vector3(0, 0, -1), 0, 22); root.updateMatrixWorld(true);
    assert.equal(ray.intersectObject(root, true).length, 0);
    const state = { ...newMaggieDiscovery(2, 47), incident: true, cover: 1.7 };
    room.update(state); const mesh = root.getObjectByName('maggie-body-sheet') as THREE.Mesh, before = mesh.geometry.attributes.position.array.slice();
    room.update(structuredClone(state)); assert.deepEqual(mesh.geometry.attributes.position.array, before, 'a paused cover must not drift');
  } finally { room.dispose(); assert.equal(root.children.length, 0); }
});

test('the delivered Maggie geometry lies on the actual mattress immediately and remains in its saved pose', async t => {
  const h = await setup(t), body = h.renderer.getAgentBody('maggie')!;
  const points = Object.values(vertices(body)).flat(), bounds = new THREE.Box3().setFromPoints(points);
  assert.ok(bounds.max.y - bounds.min.y < 1.55, `still standing: ${bounds.max.y - bounds.min.y}`);
  assert.ok(Math.abs(bounds.min.y - (h.center.y - 1 + HAMMER_MEDICAL.mattressTop)) < .035, `mattress gap: ${bounds.min.y - h.center.y}`);
  assert.ok(bounds.min.z >= h.center.z + MAGGIE_DISCOVERY.corpse.z - 2.75 && bounds.max.z <= h.center.z + MAGGIE_DISCOVERY.corpse.z + 2.75, `patient extends past the bed: ${JSON.stringify(bounds)}`);
  const before = points.map(p => p.toArray()); h.pose(structuredClone(h.state), 5);
  assert.deepEqual(Object.values(vertices(body)).flat().map(p => p.toArray()), before, 'paused patient geometry changed');
  assert.ok(body.getObjectByName('maggie-detailed-head')); assert.ok(body.getObjectByName('maggie-detailed-body'));
  const linkParts = Object.keys(vertices(h.renderer.getAgentBody('link')!));
  assert.ok(linkParts.includes('link-anatomical-head') && linkParts.includes('link-anatomical-body'), 'the late support hero load must not hide Link’s own real-world anatomy');
});

test('the bedside palm reaches the linen at the saved cover positions', async t => {
  const h = await setup(t), rig = (h.renderer as any).agents.get('roland').rig;
  const center = h.center;
  for (const cover of [0, .7, 1.7, 2.7, 3.6]) {
    const state = { ...h.state, cover, elapsed: cover }; h.pose(state);
    const wrist = rig.mobilWrists[0] as THREE.Object3D;
    const palm = wrist.localToWorld(new THREE.Vector3(0, -.75 - wrist.position.y, .005));
    const f = THREE.MathUtils.smoothstep(cover, 0, MAGGIE_DISCOVERY.coverSeconds), target = new THREE.Vector3(center.x - 8.65, center.y - 1 + 1.96, center.z - 23 + THREE.MathUtils.lerp(-.25, -2.75, f));
    assert.ok(palm.distanceTo(target) < .08, `cover ${cover}: palm floats ${palm.distanceTo(target)} from the linen; palm ${palm.toArray()}, target ${target.toArray()}, shoulder ${rig.shoulders[0].getWorldPosition(new THREE.Vector3()).toArray()}`);
  }
});

test('the moving cover stays above sampled delivered body surfaces throughout the saved pull', async t => {
  const h = await setup(t), center = h.center;
  const sheet = h.set.getObjectByName('maggie-body-sheet') as THREE.Mesh;
  const body = vertices(h.renderer.getAgentBody('maggie')!), mattress = center.y - 1 + HAMMER_MEDICAL.mattressTop;
  for (const cover of [0, .7, 1.7, 2.7, 3.6]) {
    h.pose({ ...h.state, cover });
    const front = center.z - 23 + THREE.MathUtils.lerp(-.25, -2.75, THREE.MathUtils.smoothstep(cover, 0, MAGGIE_DISCOVERY.coverSeconds));
    for (const [name, points] of Object.entries(body)) for (let i = 0; i < points.length; i += 137) {
    const point = points[i]; if (point.y < mattress + .02) continue;
    if (point.z < front + .05) continue;
    const hits = new THREE.Raycaster(new THREE.Vector3(point.x, mattress + 5, point.z), new THREE.Vector3(0, -1, 0), 0, 6).intersectObject(sheet);
    assert.ok(hits.length && hits[0].point.y >= point.y - .018, `${cover}: ${name} protrudes through the cover: ${point.toArray()}, linen ${hits[0]?.point.y}`);
    }
  }
});

test('the saved emergency call opens the real door and a paused opening stays fixed', () => {
  const root = new THREE.Group(), room = new MaggieDiscoveryRenderer(root);
  try {
    const state = newMaggieDiscovery(0, 100); room.update(state); root.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(new THREE.Vector3(0, 3, 15), new THREE.Vector3(0, 0, -1), 0, 22);
    assert.ok(ray.intersectObject(root, true).some(hit => hit.object.name === 'discovery-medical-door'));
    state.phase = 'calling'; state.incident = true; state.elapsed = .6; room.update(state);
    const doors: THREE.Object3D[] = []; root.traverse(object => { if (object.name === 'discovery-medical-door') doors.push(object); });
    const before = doors.map(door => door.position.toArray()); room.update(structuredClone(state));
    assert.deepEqual(doors.map(door => door.position.toArray()), before);
    state.elapsed = 1.3; room.update(state); root.updateMatrixWorld(true);
    assert.equal(ray.intersectObject(root, true).length, 0);
  } finally { room.dispose(); }
});

test('a cold first-person bedside camera uses Roland’s real eye, frames the pull and retains mouse look', async t => {
  const h = await setup(t), state = h.renderer.getAgentState('roland')!, group = h.renderer.getAgent('roland')!;
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  class InputTarget extends EventTarget { matches() { return false; } }
  const window = new InputTarget(), canvas = new InputTarget();
  const document = Object.assign(new InputTarget(), globalThis.document, { pointerLockElement: canvas, hidden: false, exitPointerLock() {} });
  Object.assign(globalThis, { window, document });
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000), controls = new PlayerControls(canvas as HTMLCanvasElement, camera, () => {}, () => {});
  try {
    for (const aspect of [16 / 9, .72]) {
      camera.aspect = aspect; controls.possess(state); controls.update(.1, state, group, false);
      window.dispatchEvent(Object.assign(new Event('keydown'), { code: 'KeyV', repeat: false }));
      window.dispatchEvent(Object.assign(new Event('keyup'), { code: 'KeyV' }));
      controls.update(.1, state, group, false); controls.syncTrainmanChaseCamera(group); camera.updateMatrixWorld(true);
      const head = group.getObjectByName('roland-head')!, eye = head.localToWorld((head.userData.cameraEye as THREE.Vector3 | undefined)?.clone() ?? new THREE.Vector3(0, .1, .32));
      assert.ok(camera.position.distanceTo(eye) < 1e-6, 'the eye cannot be moved outside the body to conceal clipping');
      const front = THREE.MathUtils.lerp(-.25, -2.75, THREE.MathUtils.smoothstep(h.state.cover, 0, MAGGIE_DISCOVERY.coverSeconds));
      const contact = new THREE.Vector3(h.center.x - 8.65, h.center.y - 1 + 1.96, h.center.z - 23 + front).project(camera);
      assert.ok(Math.abs(contact.x) < .95 && Math.abs(contact.y) < .95 && contact.z > -1 && contact.z < 1, `linen contact is outside the cold view at ${aspect}: ${contact.toArray()}`);
      const before = camera.getWorldDirection(new THREE.Vector3());
      document.dispatchEvent(Object.assign(new Event('mousemove'), { movementX: 90, movementY: -30 }));
      controls.update(.1, state, group, false); controls.syncTrainmanChaseCamera(group);
      const after = camera.getWorldDirection(new THREE.Vector3());
      const turn = Math.atan2(after.x, after.z) - Math.atan2(before.x, before.z);
      assert.ok(Math.abs(Math.atan2(Math.sin(turn), Math.cos(turn))) > .2 && after.distanceTo(before) > .02, 'mouse look must turn the actual view even when looking steeply down at the linen');
    }
  } finally {
    controls.dispose(); ['window', 'document'].forEach((key, i) => previous[i] ? Object.defineProperty(globalThis, key, previous[i]!) : Reflect.deleteProperty(globalThis, key));
  }
});


test('medical crew models restore the previously verified actors outside the discovery and return on re-entry', async t => {
  const h = await setup(t), world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const update = (discovery: boolean) => {
    for (const role of ['link', 'colt'] as const) {
      const actor = structuredClone(world.agents.get(role)!);
      Object.assign(actor, { isInMatrix: false, currentLocation: 'film_hammer_deck', position: filmPosition('film_hammer_deck', 0, 0),
        currentAction: discovery ? { type: 'idle', parameters: { maggieDiscovery: { ...h.state, role } }, startedAt: 9500, duration: 1e9, progress: 0 } : null });
      h.renderer.updateAgent(role, actor);
    }
    h.renderer.update(0, undefined, 0, 9510);
    h.renderer.getAgentBody('link')!.updateWorldMatrix(true, true); h.renderer.getAgentBody('colt')!.updateWorldMatrix(true, true);
  };
  update(false);
  const link = h.renderer.getAgentBody('link')!, colt = h.renderer.getAgentBody('colt')!;
  assert.ok(link.getObjectByName('link-detailed-body') && colt.getObjectByName('colt-detailed-body'), 'retain the loaded meshes for re-entry');
  assert.equal(link.getObjectByName('link-detailed-body')!.visible, false, 'the new body must not replace Link in older saved performances');
  assert.equal(link.getObjectByName('link-detailed-head')!.visible, false);
  assert.equal(colt.getObjectByName('colt-detailed-body')!.visible, false);
  assert.equal(colt.getObjectByName('colt-detailed-head')!.visible, false);
  const visibleLink = Object.keys(vertices(link));
  assert.ok(!visibleLink.includes('link-anatomical-body') && (h.renderer as any).agents.get('link').rig.hero?.root.visible, 'the previously shipped support actor is visible');
  assert.ok(Object.keys(vertices(colt)).length > 0, 'restore Colt’s procedural clothing and body');
  update(true);
  assert.ok(Object.keys(vertices(link)).includes('link-anatomical-body'));
  assert.ok(Object.keys(vertices(colt)).includes('colt-anatomical-body'));
});


test('a cold first-person report frames the arriving Colt and keeps the player free to look away', async t => {
  const h = await setup(t), visit = { ...h.state, phase: 'searching', elapsed: 0, arrival: 1.354 } as MaggieDiscovery;
  h.pose(visit);
  const state = h.renderer.getAgentState('roland')!, group = h.renderer.getAgent('roland')!;
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  class InputTarget extends EventTarget { matches() { return false; } }
  const window = new InputTarget(), canvas = new InputTarget();
  const document = Object.assign(new InputTarget(), globalThis.document, { pointerLockElement: canvas, hidden: false, exitPointerLock() {} });
  Object.assign(globalThis, { window, document });
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000), controls = new PlayerControls(canvas as HTMLCanvasElement, camera, () => {}, () => {});
  try {
    controls.possess(state); controls.update(.1, state, group, false);
    window.dispatchEvent(Object.assign(new Event('keydown'), { code: 'KeyV', repeat: false }));
    window.dispatchEvent(Object.assign(new Event('keyup'), { code: 'KeyV' }));
    controls.update(.1, state, group, false); controls.syncTrainmanChaseCamera(group); camera.updateMatrixWorld(true);
    const root = maggieDiscoveryRoot(visit, 'colt'), face = new THREE.Vector3(h.center.x + root.x, h.center.y - 1 + 3.2, h.center.z + root.z).project(camera);
    assert.ok(Math.abs(face.x) < .9 && Math.abs(face.y) < .9 && face.z > -1 && face.z < 1, `Colt is outside the restored report view: ${face.toArray()}`);
    const before = camera.getWorldDirection(new THREE.Vector3());
    document.dispatchEvent(Object.assign(new Event('mousemove'), { movementX: 90, movementY: 0 }));
    controls.update(.1, state, group, false); controls.syncTrainmanChaseCamera(group);
    assert.ok(camera.getWorldDirection(new THREE.Vector3()).distanceTo(before) > .2, 'the report must not force the camera back to its speaker every frame');
  } finally {
    controls.dispose(); ['window', 'document'].forEach((key, i) => previous[i] ? Object.defineProperty(globalThis, key, previous[i]!) : Reflect.deleteProperty(globalThis, key));
  }
});
