import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import * as THREE from 'three';
import { FILM_SETS, PRIMARY_DEMOLITION as P, primaryMountPoint, filmPosition, filmGroundHeight, playerBlocked, type PrimaryDemolition } from '@auto_matrix/shared';
import { PrimaryDemolitionRenderer } from '../packages/client/src/engine/PrimaryDemolitionRenderer.js';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';

test('the exit bridge and industrial floor use the same heights as actual player physics', () => {
  const set = FILM_SETS.film_power_station, root = new THREE.Group(); root.position.set(set.center.x, set.center.y - 1, set.center.z);
  const renderer = new PrimaryDemolitionRenderer(root); root.updateMatrixWorld(true);
  try {
    const floor = root.getObjectByName('primary-floor')!, bridge = root.getObjectByName('primary-exit-bridge')!;
    for (const z of [18, 29, 31, 34, 37, 38, 40, 43]) {
      const point = filmPosition(set.id, 0, z); point.y = filmGroundHeight(point, set);
      const hit = new THREE.Raycaster(new THREE.Vector3(point.x, point.y + 5, point.z), new THREE.Vector3(0, -1, 0)).intersectObjects([floor, bridge])[0];
      assert.ok(hit); assert.ok(Math.abs(hit.point.y - point.y + 1) < .005, `floor at z=${z}: visible=${hit.point.y}, walking soles=${point.y - 1}`);
      assert.equal(playerBlocked(point, true, 1.1), false);
    }
  } finally { renderer.dispose(); }
});

test('installation points are reachable and hands can reach the visible mounting plates without crossing a cabinet', () => {
  const set = FILM_SETS.film_power_station, root = new THREE.Group(); root.position.set(set.center.x, set.center.y - 1, set.center.z);
  const renderer = new PrimaryDemolitionRenderer(root); root.updateMatrixWorld(true);
  try {
    for (const site of P.sites) {
      const point = filmPosition(set.id, site.x, site.z); assert.equal(playerBlocked(point, true, 1.1), false);
      const target = new THREE.Vector3(set.center.x + site.contact.x, set.center.y - 1 + site.contact.y, set.center.z + site.contact.z);
      const origin = new THREE.Vector3(point.x, target.y, point.z), delta = target.clone().sub(origin);
      const ray = new THREE.Raycaster(origin, delta.clone().normalize(), 0, delta.length() + .1);
      const plate = root.getObjectByName(`primary-mount-${site.id}`)!;
      const visible: THREE.Mesh[] = []; root.traverseVisible(object => { if (object instanceof THREE.Mesh) visible.push(object); });
      const obstruction = ray.intersectObjects(visible, false)[0];
      assert.equal(obstruction?.object.name, plate.name, `mount ${site.id} must be on the near side of its transformer`);
    }
  } finally { renderer.dispose(); }
});

async function shipped(name: string) {
  const bytes = await readFile(new URL(`../packages/client/public/assets/characters/${name}.glb`, import.meta.url));
  const length = bytes.readUInt32LE(12), document = JSON.parse(bytes.subarray(20, 20 + length).toString());
  // Keep the delivered geometry, skin weights and UVs; browser QA checks pixels.
  for (const material of document.materials) delete material.pbrMetallicRoughness.baseColorTexture;
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const binary = bytes.subarray(20 + length), output = Buffer.alloc(20 + padded.length + binary.length);
  output.writeUInt32LE(0x46546c67, 0); output.writeUInt32LE(2, 4); output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(padded.length, 12); output.writeUInt32LE(0x4e4f534a, 16); padded.copy(output, 20); binary.copy(output, 20 + padded.length);
  const asset = await new GLTFLoader().parseAsync(output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength), '');
  if (name.endsWith('-head')) asset.scene.traverse(object => { if (object instanceof THREE.Mesh) (object.material as THREE.MeshStandardMaterial).map = new THREE.Texture(); });
  return asset;
}

test('the observation bridge permits an exterior camera without cropping the captain at the walkable map boundary', t => {
  class InputTarget extends EventTarget { matches() { return false; } }
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  const window = new InputTarget(), canvas = new InputTarget();
  Object.assign(globalThis, { window, document: Object.assign(new InputTarget(), { hidden: false, exitPointerLock() {} }) });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const actor = world.agents.get('niobe')!, camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000), group = new THREE.Group();
  const controls = new PlayerControls(canvas as unknown as HTMLCanvasElement, camera, () => {}, () => {});
  t.after(() => { controls.dispose(); ['window', 'document'].forEach((key, i) => {
    if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!); else Reflect.deleteProperty(globalThis, key);
  }); });
  for (const aspect of [16 / 9, .65]) for (const rotation of [0, Math.PI]) {
    Object.assign(actor, { position: { ...filmPosition('film_power_station', 0, 41), y: 4.2 }, rotation,
      currentLocation: 'film_power_station', isInMatrix: true, currentAction: null });
    group.position.copy(actor.position); camera.aspect = aspect; controls.possess(actor); controls.update(.1, actor, group, false);
    camera.updateWorldMatrix(true, true);
    assert.ok(camera.position.distanceTo(new THREE.Vector3(actor.position.x, actor.position.y + 2.1, actor.position.z)) > 7,
      'a walkable boundary is not a wall for the third person camera');
    for (const y of [-1, 3.7]) {
      const projected = new THREE.Vector3(actor.position.x, actor.position.y + y, actor.position.z).project(camera);
      assert.ok(Math.abs(projected.x) < .85 && Math.abs(projected.y) < .85 && projected.z > -1 && projected.z < 1,
        `captain must fit at aspect ${aspect}, direction ${rotation}: ${projected.toArray()}`);
    }
  }
});

test('the exterior has visible streets and city lights in the original default exit direction', () => {
  const center = FILM_SETS.film_power_station.center, root = new THREE.Group(), camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000);
  root.position.set(center.x, center.y - 1, center.z); const renderer = new PrimaryDemolitionRenderer(root);
  try {
    root.updateMatrixWorld(true); camera.position.set(center.x, center.y + 6.2, center.z + 30);
    camera.lookAt(center.x, center.y + 3, center.z + 170); camera.updateWorldMatrix(true, true);
    for (const name of ['primary-exterior-road', 'primary-skyline-5', 'primary-city-windows']) {
      const object = root.getObjectByName(name); assert.ok(object, name);
      const middle = new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3()).project(camera);
      assert.ok(Math.abs(middle.x) < 1 && Math.abs(middle.y) < 1 && middle.z > -1 && middle.z < 1, `${name} must be in view`);
    }
  } finally { renderer.dispose(); }
});

test('blast, darkness, emergency return and fallen roof reconstruct from the saved clock without frame-history dependence', () => {
  const first = new PrimaryDemolitionRenderer(new THREE.Group()), cold = new PrimaryDemolitionRenderer(new THREE.Group());
  const grid = { primary: 'off', emergency: 'online', vigilant: 'lost', trinity: 'connected', phase: 'emergency', remaining: 314, lastTick: 0, reroute: 0, attempts: 0 } as const;
  const state: PrimaryDemolition = { phase: 'done', installed: ['west', 'east', 'clock'], elapsed: 0, remaining: 25, attempts: 1, blast: { phase: 'blast', elapsed: 0 } };
  try {
    for (const time of [0, .2, 1.3, 2.4, 3, 5, 8]) {
      state.blast!.elapsed = time; first.update(state, grid); cold.update(JSON.parse(JSON.stringify(state)), grid);
      first.group.updateMatrixWorld(true); cold.group.updateMatrixWorld(true);
      const pose = (renderer: PrimaryDemolitionRenderer) => {
        const result: unknown[] = []; renderer.group.traverse(object => { if (object.name.startsWith('primary-flame-') || object.name === 'primary-roof-panel')
          result.push([object.name, object.position.toArray(), object.rotation.toArray(), object.scale.toArray()]); }); return result;
      };
      assert.deepEqual(pose(first), pose(cold)); assert.equal(first.group.userData.blastTime, time);
      assert.ok(time < P.emergencyReturnSeconds ? first.group.userData.cityLighting < .05 : first.group.userData.cityLighting >= .6);
      first.group.traverse(object => { if (object.name === 'primary-roof-panel') {
        const bounds = new THREE.Box3().setFromObject(object);
        assert.ok(bounds.min.y > -.025, `roof debris must remain above visible ground at ${time}: ${bounds.min.y}`);
        assert.ok(bounds.max.z < P.ramp.start, 'roof fragments must not pass through the safe observation bridge');
        if (time === 8) assert.ok(bounds.max.x < -32 || bounds.min.x > 32, 'settled debris stays outside the walkable hall');
      } });
    }
  } finally { first.dispose(); cold.dispose(); }
});

test('the explosion flash decays before the sustained fire and the destroyed grid cannot leave hall lamps powered', () => {
  const renderer = new PrimaryDemolitionRenderer(new THREE.Group());
  const state: PrimaryDemolition = { phase: 'done', installed: ['west', 'east', 'clock'], elapsed: 0, remaining: 25, attempts: 1,
    blast: { phase: 'blast', elapsed: .1 } };
  const grid = { primary: 'off', emergency: 'online', vigilant: 'lost', trinity: 'connected', phase: 'emergency', remaining: 314, lastTick: 0, reroute: 0, attempts: 0 } as const;
  try {
    const flash = renderer.group.children.find(object => object instanceof THREE.PointLight && object.distance === 210) as THREE.PointLight;
    renderer.update(state, grid); const peak = flash.intensity;
    state.blast!.elapsed = 1.2; renderer.update(state, grid);
    assert.ok(flash.intensity < peak * .05, 'the initial flash must not wash out the whole bridge throughout the fireball');
    const lamps = new Set<THREE.MeshStandardMaterial>();
    renderer.group.traverse(object => { if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial
      && object.material.emissive.getHex() === 0xa7c8cc) lamps.add(object.material); });
    assert.ok(lamps.size > 0);
    for (const lamp of lamps) assert.equal(lamp.emissiveIntensity, 0, 'primary-powered hall lamps must go dark while the emergency city feed returns');
  } finally { renderer.dispose(); }
});

test('V keeps the delivered installation hands and device in frame, then permits free look without changing the saved clock', async t => {
  const assets = new Map(await Promise.all(['trinity', 'niobe-head', 'niobe-body'].map(async name => [name, await shipped(name)] as const)));
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async url => assets.get(String(url).split('/').pop()!.replace('.glb', ''))!);
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  class InputTarget extends EventTarget { matches() { return false; } }
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  const window = new InputTarget(), canvas = new InputTarget(), document = Object.assign(new InputTarget(), {
    hidden: false, pointerLockElement: canvas, exitPointerLock() {}, createElement: () => ({ getContext: () => ({
      createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {}
    }) }) });
  Object.assign(globalThis, { window, document });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const actor = world.agents.get('niobe')!, center = FILM_SETS.film_power_station.center, scene = new THREE.Scene();
  const renderer = new AgentRenderer(scene), camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000);
  const controls = new PlayerControls(canvas as unknown as HTMLCanvasElement, camera, () => {}, () => {});
  t.after(() => { controls.dispose(); renderer.dispose(); ['window', 'document'].forEach((key, i) => {
    if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!); else Reflect.deleteProperty(globalThis, key);
  }); });
  const key = (type: string) => window.dispatchEvent(Object.assign(new Event(type), { code: 'KeyV' }));
  for (const aspect of [16 / 9, .65]) for (const [selected, site] of P.sites.entries()) {
    const state: PrimaryDemolition = { phase: 'mounting', installed: [], selected, elapsed: .9, remaining: 35, attempts: 0 };
    Object.assign(actor, { currentLocation: 'film_power_station', isInMatrix: true, position: filmPosition('film_power_station', site.x, site.z), rotation: site.yaw,
      currentAction: { type: 'idle', parameters: { primaryDemolition: state }, startedAt: 0, duration: 1e9, progress: 0 } });
    renderer.updateAgent(actor.id, actor); const group = renderer.getAgent(actor.id)!;
    group.position.copy(actor.position); renderer.getAgentBody(actor.id)!.rotation.y = site.yaw;
    controls.possess(actor); camera.aspect = aspect; controls.update(.1, actor, group, false);
    key('keydown'); key('keyup'); controls.update(.1, actor, group, false);
    renderer.setPlayer(actor.id, true); renderer.setPlayerMotion(controls.motion);
    await new Promise(resolve => setImmediate(resolve)); renderer.update(0, camera, 0);
    const body = renderer.getAgentBody(actor.id)!; assert.ok(body.visible, 'the player must see her own operating hands');
    controls.syncPrimaryDemolitionCamera(group); camera.updateMatrixWorld(true); body.updateWorldMatrix(true, true);
    const head = body.getObjectByName('head')!, eye = head.localToWorld((head.userData.cameraEye as THREE.Vector3).clone());
    assert.ok(camera.position.distanceTo(eye) < 1e-6, 'the first-person camera uses the actual delivered eye');
    const skin = body.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
    assert.ok(skin.visible, 'the delivered hands remain visible');
    for (const side of ['L', 'R'] as const) {
      const wrist = body.getObjectByName(`wrist_${side}`)!;
      const palm = wrist.localToWorld(new THREE.Vector3(side === 'L' ? -.13 : .13, -.18, .02)), projected = palm.project(camera);
      assert.ok(Math.abs(projected.x) < .9 && Math.abs(projected.y) < .65 && projected.z > -1 && projected.z < 1,
        `both palms remain above the lower HUD at ${aspect}/${site.id}: ${projected.toArray()}`);
    }
    const point = primaryMountPoint(state), target = new THREE.Vector3(center.x + point.x, center.y - 1 + point.y, center.z + point.z), device = target.clone().project(camera);
    assert.ok(Math.abs(device.x) < .9 && Math.abs(device.y) < .65 && device.z > -1 && device.z < 1, 'the device cannot remain below the view');
    const visible: THREE.Mesh[] = []; body.traverseVisible(object => { if (object instanceof THREE.Mesh) visible.push(object); });
    const direction = target.clone().sub(camera.position);
    const blocked = new THREE.Raycaster(camera.position, direction.clone().normalize(), .06, direction.length() - .03).intersectObjects(visible, false);
    assert.equal(blocked.length, 0, `the player's face, hair or glasses cannot cover the device: ${blocked.map(hit => hit.object.name).join(', ')}`);
    const before = camera.getWorldDirection(new THREE.Vector3());
    document.dispatchEvent(Object.assign(new Event('mousemove'), { movementX: 160, movementY: -80 }));
    controls.update(.1, actor, group, false); renderer.setPlayerMotion(controls.motion); renderer.update(0, camera, 0); controls.syncPrimaryDemolitionCamera(group);
    assert.ok(camera.getWorldDirection(new THREE.Vector3()).distanceTo(before) > .2, 'framing the installation once cannot override subsequent mouse look');
    assert.equal(controls.motion.primaryDemolition!.elapsed, .9);
  }
  for (const aspect of [16 / 9, .65]) {
    const state: PrimaryDemolition = { phase: 'done', installed: ['west', 'east', 'clock'], elapsed: 0, remaining: 25, attempts: 1, blast: { phase: 'countdown', elapsed: 2 } };
    Object.assign(actor, { currentLocation: 'film_power_station', isInMatrix: true, position: { ...filmPosition('film_power_station', 0, 41), y: 4.2 }, rotation: Math.PI,
      currentAction: { type: 'idle', parameters: { primaryDemolition: state }, startedAt: 0, duration: 1e9, progress: 0 } });
    renderer.updateAgent(actor.id, actor); const group = renderer.getAgent(actor.id)!;
    group.position.copy(actor.position); renderer.getAgentBody(actor.id)!.rotation.y = Math.PI;
    controls.possess(actor); camera.aspect = aspect; controls.update(.1, actor, group, false);
    controls.syncPrimaryDemolitionCamera(group); camera.updateMatrixWorld(true);
    for (const target of [new THREE.Vector3(center.x - 32, 18, center.z + 24), new THREE.Vector3(center.x + 32, 18, center.z + 24),
      new THREE.Vector3(center.x, 55, center.z), new THREE.Vector3(actor.position.x, actor.position.y - 1, actor.position.z)]) {
      const projected = target.project(camera);
      assert.ok(Math.abs(projected.x) < .99 && Math.abs(projected.y) < .99 && projected.z > -1 && projected.z < 1, `wide blast view ${aspect}: ${projected.toArray()}`);
    }
    key('keydown'); key('keyup'); controls.update(.1, actor, group, false);
    renderer.setPlayer(actor.id, true); renderer.setPlayerMotion(controls.motion); renderer.update(0, camera, 0);
    const body = renderer.getAgentBody(actor.id)!; assert.ok(body.visible, 'the actual watch arm stays visible in first person');
    controls.syncPrimaryDemolitionCamera(group); camera.updateMatrixWorld(true); body.updateWorldMatrix(true, true);
    const watch = body.getObjectByName('primary-watch')!; assert.ok(watch);
    const point = watch.getWorldPosition(new THREE.Vector3()), projected = point.clone().project(camera);
    assert.ok(Math.abs(projected.x) < .7 && Math.abs(projected.y) < .65 && projected.z > -1 && projected.z < 1, 'the wristwatch stays above the lower HUD');
    const visible: THREE.Mesh[] = []; body.traverseVisible(object => { if (object instanceof THREE.Mesh) visible.push(object); });
    const direction = point.clone().sub(camera.position);
    const blocked = new THREE.Raycaster(camera.position, direction.clone().normalize(), .06, direction.length() - .19).intersectObjects(visible, false);
    assert.equal(blocked.length, 0, `own face or jacket cannot cover the watch: ${blocked.map(hit => hit.object.name).join(', ')}`);
    const before = camera.getWorldDirection(new THREE.Vector3());
    document.dispatchEvent(Object.assign(new Event('mousemove'), { movementX: 120, movementY: -60 }));
    controls.update(.1, actor, group, false); renderer.setPlayerMotion(controls.motion); renderer.update(0, camera, 0); controls.syncPrimaryDemolitionCamera(group);
    assert.ok(camera.getWorldDirection(new THREE.Vector3()).distanceTo(before) > .15, 'watch framing leaves subsequent mouse look free');
    assert.equal(state.blast!.elapsed, 2);
  }
});

test('the delivered Niobe carries each device with two palms while her soles remain on the floor', async (t: TestContext) => {
  const assets = new Map(await Promise.all(['trinity', 'niobe-head', 'niobe-body'].map(async name => [name, await shipped(name)] as const)));
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async url => assets.get(String(url).split('/').pop()!.replace('.glb', ''))!);
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const actor = world.agents.get('niobe')!; actor.isInMatrix = true;
  const models = new CharacterModels(), rig = models.create(actor); globalThis.document = previous;
  t.after(() => { models.dispose(); globalThis.document = previous; });
  const center = FILM_SETS.film_power_station.center;
  const pose = (state: PrimaryDemolition) => {
    const site = P.sites[state.selected!]; rig.root.position.set(center.x + site.x, center.y - 1, center.z + site.z); rig.root.rotation.y = site.yaw;
    models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, primaryDemolition: state }, 0);
    rig.root.updateMatrixWorld(true); rig.root.traverseVisible(object => { if (object instanceof THREE.SkinnedMesh) object.skeleton.update(); });
  };
  pose({ phase: 'mounting', installed: [], selected: 0, elapsed: 0, remaining: 35, attempts: 0 }); await new Promise(resolve => setImmediate(resolve));
  pose({ phase: 'mounting', installed: [], selected: 0, elapsed: 0, remaining: 35, attempts: 0 });
  assert.ok(rig.hero, 'use the delivered Matrix costume and skeleton, not a failed asset fallback');
  for (const [selected, site] of P.sites.entries()) for (const elapsed of [0, .3, .7, 1.3, 2.1]) {
    const state: PrimaryDemolition = { phase: 'mounting', installed: [], selected, elapsed, remaining: 35, attempts: 0 }; pose(state);
    const point = primaryMountPoint(state);
    for (let i = 0; i < 2; i++) {
      const sign = i ? 1 : -1, target = new THREE.Vector3(center.x + point.x + Math.cos(site.yaw) * sign * .31 - Math.sin(site.yaw) * .12,
        center.y - 1 + point.y - .08, center.z + point.z - Math.sin(site.yaw) * sign * .31 - Math.cos(site.yaw) * .12);
      const palm = rig.hero!.bones.get(`wrist_${i ? 'L' : 'R'}`)!.localToWorld(new THREE.Vector3(i ? -.13 : .13, -.18, .02));
      assert.ok(palm.distanceTo(target) < .03, `site ${selected}, time ${elapsed}, palm ${i}: ${palm.distanceTo(target)}`);
      const skin = rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
      assert.ok(skin instanceof THREE.SkinnedMesh); let nearest = Infinity;
      for (let vertex = 0; vertex < skin.geometry.attributes.position.count; vertex++) nearest = Math.min(nearest, skin.localToWorld(skin.getVertexPosition(vertex, new THREE.Vector3())).distanceTo(target));
      assert.ok(nearest < .12, `actual skin/device edge separation ${nearest}`);
    }
    const boots = rig.root.getObjectByName('shoes01') as THREE.SkinnedMesh;
    assert.ok(boots instanceof THREE.SkinnedMesh);
    let low = Infinity; for (let i = 0; i < boots.geometry.attributes.position.count; i++) low = Math.min(low, boots.localToWorld(boots.getVertexPosition(i, new THREE.Vector3())).y);
    assert.ok(low - center.y + 1 > -.025 && low - center.y + 1 < .1, `soles at ${low - center.y + 1}`);
  }
});
