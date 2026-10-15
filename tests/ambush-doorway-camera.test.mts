import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import * as THREE from 'three';
import { readFile } from 'node:fs/promises';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { AmbushSetRenderer } from '../packages/client/src/engine/AmbushSetRenderer.js';
import type { CharacterRig } from '../packages/client/src/agents/CharacterModel.js';
import { FILM_SETS, AMBUSH_CAT_DOORWAY, filmPosition, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { Engine } from '../packages/client/src/engine/Engine.js';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

function setup(t: TestContext) {
  class Target extends EventTarget { matches() { return false; } }
  const window = new Target(), canvas = new Target();
  const context = { createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {},
    fillRect() {}, strokeRect() {}, fillText() {}, createRadialGradient: () => ({ addColorStop() {} }) };
  const document = Object.assign(new Target(), { pointerLockElement: canvas, hidden: false, exitPointerLock() {},
    createElement: () => ({ width: 0, height: 0, getContext: () => context }) });
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key)); Object.assign(globalThis, { window, document });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!; neo.controller = 'camera-test'; neo.currentLocation = 'film_ambush_house'; neo.isInMatrix = neo.isAwakened = true;
  neo.position = filmPosition('film_ambush_house', 11, 31.8); neo.rotation = Math.PI / 2;
  const journey = { scene: 'm1_dejavu', actor: 'neo', step: 0, completed: [], ambush: { elapsed: 3.3 },
    ambushApproach: { ready: true, stairCat: true, doorwayCat: true, progress: {} } } as unknown as FilmJourney;
  const sandbox = { nodes: [], structures: [], threats: [], incidents: [], missions: {}, neoLife: { journey, missions: {} } } as unknown as SandboxState;
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000), group = new THREE.Group(); group.add(new THREE.Group());
  const controls = new PlayerControls(canvas as unknown as HTMLCanvasElement, camera, () => {}, () => {});
  controls.possess(neo);
  const engine = { playerControls: controls, running: false, sandboxRenderer: { sync() {} }, updateAtmosphere() {} } as unknown as Engine;
  const sync = () => Engine.prototype.setSandbox.call(engine, sandbox, Object.fromEntries(world.agents));
  const frame = (running = false, dt = .016, playerGroup = group) => { sync(); controls.update(dt, neo, playerGroup, running); camera.updateMatrixWorld(true); };
  const key = (code: string, down = true) => window.dispatchEvent(Object.assign(new Event(down ? 'keydown' : 'keyup'), { code, repeat: false }));
  const look = (movementX = 180, movementY = -20) => document.dispatchEvent(Object.assign(new Event('mousemove'), { movementX, movementY }));
  t.after(() => { controls.dispose(); ['window', 'document'].forEach((key, i) => {
    if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!); else Reflect.deleteProperty(globalThis, key);
  }); });
  return { world, neo, journey, sandbox, camera, group, controls, frame, key, look, sync };
}

async function actualModels(t: TestContext) {
  const pending: Promise<unknown>[] = [], assets = new Map<string, Promise<any>>();
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async url => {
    const name = String(url).split('/').pop()!;
    if (!assets.has(name)) assets.set(name, (async () => {
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

function visible(object: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = object; p; p = p.parent) if (!p.visible) return false;
  return true;
}

test('the Engine selects the level doorway observation only for its saved mode and controlled journey', t => {
  const h = setup(t); h.sync(); assert.equal(h.controls.ambushDoorway, true);
  delete h.journey.ambushApproach!.doorwayCat; h.sync();
  assert.equal(h.controls.ambushDoorway, false); assert.equal(h.controls.ambushObservation, 3.3, 'old stair saves retain their camera');
  Object.assign(h.journey.ambushApproach!, { doorwayCat: true });
  h.journey.visiting = 'm1_dejavu'; h.sync(); assert.equal(h.controls.ambushDoorway, false);
  delete h.journey.visiting; h.journey.actor = 'trinity'; h.sync(); assert.equal(h.controls.ambushDoorway, false);
  h.journey.actor = 'neo'; h.journey.step = 1; h.sync(); assert.equal(h.controls.ambushDoorway, false);
  h.controls.release(); assert.equal(h.controls.ambushDoorway, false);
});

test('the doorway initially faces east, preserves manual looking and V, and walking cancels its close view', t => {
  const h = setup(t), center = FILM_SETS.film_ambush_house.center, initial = { ...h.neo.position };
  for (const elapsed of [.8, 3.3, 7.6, 10.1]) {
    h.controls.possess(h.neo); h.journey.ambush!.elapsed = elapsed; h.frame();
    const forward = h.camera.getWorldDirection(new THREE.Vector3());
    assert.ok(forward.x > .65, `elapsed=${elapsed}: new doorway is east of Neo, not on the old west stairs`);
    assert.ok(Math.sin(h.group.children[0].rotation.y) > .65, 'Neo and the initial observation face the same actual doorway');
    assert.ok(h.camera.position.distanceTo(h.group.position) < 7, 'the default overview should stay close enough to read a one-unit cat');
    const path = AMBUSH_CAT_DOORWAY.path;
    const cat = new THREE.Vector3(center.x + path.x, center.y - 1 + .9, center.z + (path.fromZ + path.toZ) / 2).project(h.camera);
    assert.ok(Math.abs(cat.x) < .85 && Math.abs(cat.y) < .85 && cat.z > -1 && cat.z < 1, 'the door passage is in the initial frame');
    assert.deepEqual(h.neo.position, initial); assert.equal(h.controls.performing, false);
  }
  const before = h.camera.getWorldDirection(new THREE.Vector3()); h.look(); h.frame(false, .5);
  assert.ok(before.distanceTo(h.camera.getWorldDirection(new THREE.Vector3())) > .2, 'only the first observation directs looking');
  const manual = h.camera.getWorldDirection(new THREE.Vector3()); h.journey.ambush!.elapsed += .1; h.frame(false, .5);
  assert.ok(manual.distanceTo(h.camera.getWorldDirection(new THREE.Vector3())) < .001, 'after the orbit eases, the next saved cat frame must not aim the camera again');
  h.key('KeyV'); h.key('KeyV', false); h.frame();
  assert.ok(h.camera.position.distanceTo(new THREE.Vector3(initial.x, initial.y + 2.99, initial.z)) < .06, 'V belongs to Neo eyes');
  const fp = h.camera.getWorldDirection(new THREE.Vector3()); h.look(); h.frame();
  assert.ok(fp.distanceTo(h.camera.getWorldDirection(new THREE.Vector3())) > .2, 'V still permits manual look');
  h.key('KeyV'); h.key('KeyV', false); h.frame();
  h.controls.possess(h.neo); h.frame();
  const position = h.group.position.clone(); h.key('KeyW'); for (let i = 0; i < 4; i++) h.frame(true, .05); h.key('KeyW', false);
  assert.ok(h.group.position.distanceTo(position) > .15, 'observation cannot capture player movement');
  h.frame(false, .5); const cancelled = h.camera.position.clone(), cancelledLook = h.camera.quaternion.clone();
  delete h.journey.ambushApproach!.doorwayCat; h.frame(false, .5);
  assert.ok(h.camera.position.distanceTo(cancelled) < .002 && h.camera.quaternion.angleTo(cancelledLook) < .002,
    'after walking, the camera matches the ordinary follow view with the doorway mode removed');
  h.journey.ambushApproach!.doorwayCat = true; h.frame(false, .5);
  assert.ok(h.camera.position.distanceTo(cancelled) < .002, 'releasing movement and receiving another snapshot cannot reenter the close view');
  h.journey.step = 1; h.frame(); assert.equal(h.controls.ambushObservation, undefined);
});

test('manual looking leaves the close observation before its wide shoulder crosses the rear wall', t => {
  const h = setup(t), center = FILM_SETS.film_ambush_house.center, path = AMBUSH_CAT_DOORWAY.path;
  h.frame(); const initial = h.camera.position.clone(); h.look(0, 0); h.frame(false, .5);
  assert.ok(h.camera.position.distanceTo(initial) < 1e-8, 'a mousemove without actual input cannot cancel the initial view');
  const yaw = Math.atan2(path.x - 11, (path.fromZ + path.toZ) / 2 - 31.8);
  h.look((yaw + Math.PI / 2) / .0028, 0); h.frame(false, .5);
  assert.ok(h.camera.getWorldDirection(new THREE.Vector3()).x < -.5, 'the player can freely look west');
  assert.ok(h.camera.position.z < center.z + 33.65 - h.camera.near,
    `the observation orbit cannot cross the existing rear wall: ${h.camera.position.z - center.z}`);
  const manual = h.camera.position.clone(); delete h.journey.ambushApproach!.doorwayCat; h.frame(false, .5);
  assert.ok(h.camera.position.distanceTo(manual) < .002, 'manual look restores the ordinary following camera');
});

test('Neo removes his sunglasses in the ambush house for both controlled and autonomous rendering and restores them outside', async t => {
  const h = setup(t); h.frame(); assert.equal(h.controls.motion.glasses, false);
  const settle = await actualModels(t);
  const seen: boolean[] = [], original = CharacterModels.prototype.animate;
  t.mock.method(CharacterModels.prototype, 'animate', function(rig, delta, input, ...rest) { seen.push(input.glasses!); return original.call(this, rig, delta, input, ...rest); });
  const renderer = new AgentRenderer(new THREE.Scene()); t.after(() => renderer.dispose());
  renderer.updateAgent('neo', h.neo); await settle(); renderer.update(0, h.camera, 0, 1, h.journey);
  const rig = (renderer as unknown as { agents: Map<string, { rig: CharacterRig }> }).agents.get('neo')!.rig;
  assert.ok(rig.hero, 'check the shipped Neo GLB as well as the motion input');
  assert.equal(rig.hero.glasses.visible, false);
  assert.equal(seen.at(-1), false, 'the unpossessed Neo must use the same film wardrobe');
  h.neo.currentLocation = 'film_subway'; h.frame(); assert.equal(h.controls.motion.glasses, true);
  renderer.updateAgent('neo', h.neo); renderer.update(0, h.camera, 0, 1); assert.equal(seen.at(-1), true); assert.equal(rig.hero.glasses.visible, true);
});

function within(object: THREE.Object3D, parent: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = object; p; p = p.parent) if (p === parent) return true;
  return false;
}

test('actual doorway cat surfaces enter and leave behind masonry and remain readable beside the shipped Neo in both views', async t => {
  const h = setup(t), settle = await actualModels(t), scene = new THREE.Scene(), agents = new AgentRenderer(scene);
  const center = FILM_SETS.film_ambush_house.center, setRoot = new THREE.Group(); setRoot.position.set(center.x, center.y - 1, center.z);
  const set = new AmbushSetRenderer(setRoot); scene.add(setRoot); t.after(() => { set.dispose(); agents.dispose(); });
  agents.setPlayer('neo', false); agents.updateAgent('neo', h.neo); await settle();
  const group = agents.getAgent('neo')!, rig = (agents as unknown as { agents: Map<string, { rig: CharacterRig }> }).agents.get('neo')!.rig;
  assert.ok(rig.hero, 'use the delivered Neo body when checking third-person occlusion');
  const show = (elapsed: number) => {
    h.journey.ambush = { elapsed, paused: true }; h.frame(false, .016, group);
    agents.setPlayer('neo', h.controls.firstPerson); agents.setPlayerMotion(h.controls.motion); agents.update(.016, h.camera, 0, 1, h.journey);
    set.update(h.journey, [], elapsed); scene.updateMatrixWorld(true); h.camera.updateMatrixWorld(true);
  };
  const cat = setRoot.getObjectByName('ambush-doorway-cat')!;
  show(3.1); assert.equal(rig.hero.glasses.visible, false, 'the actual possessed Neo also removes his sunglasses');
  // Restrict the exact rendered triangles to the finite volume containing every
  // tested sightline. The large merged building otherwise repeats 70k triangles
  // per cat vertex; no intersecting triangle or endpoint is discarded.
  const envelope = new THREE.Box3(new THREE.Vector3(center.x + 6, center.y - 1, center.z + 24), new THREE.Vector3(center.x + 18, center.y + 9, center.z + 34));
  const solids: THREE.Mesh[] = [], vertices = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], box = new THREE.Box3();
  setRoot.traverseVisible(object => {
    if (!(object instanceof THREE.Mesh) || within(object, cat)) return;
    const positions: number[] = [], indices = object.geometry.index, count = indices?.count ?? object.geometry.attributes.position.count;
    for (let i = 0; i < count; i += 3) {
      for (let v = 0; v < 3; v++) { object.getVertexPosition(indices?.getX(i + v) ?? i + v, vertices[v]); object.localToWorld(vertices[v]); }
      box.setFromPoints(vertices); if (!box.intersectsBox(envelope)) continue;
      for (const point of vertices) positions.push(...point.toArray());
    }
    if (!positions.length) return;
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const mesh = new THREE.Mesh(geometry, object.material); mesh.userData.source = object; solids.push(mesh);
  });
  t.after(() => solids.forEach(mesh => mesh.geometry.dispose()));
  const ray = new THREE.Raycaster(), direction = new THREE.Vector3(), point = new THREE.Vector3();
  const architecture = (target: THREE.Vector3) => {
    assert.ok(envelope.containsPoint(h.camera.position) && envelope.containsPoint(target), 'every checked ray remains within the exact triangle selection');
    direction.copy(target).sub(h.camera.position); ray.set(h.camera.position, direction.clone().normalize()); ray.near = .001; ray.far = direction.length() - .001;
    return ray.intersectObjects(solids).filter(hit => visible(hit.object.userData.source));
  };
  for (const aspect of [.72, 16 / 9]) for (const firstPerson of [false, true]) {
    h.camera.aspect = aspect; h.controls.possess(h.neo); show(3.1);
    if (firstPerson) { h.key('KeyV'); h.key('KeyV', false); show(3.1); }
    else {
      const head = rig.hero.bones.get('head')!.getWorldPosition(new THREE.Vector3()).project(h.camera);
      assert.ok(Math.abs(head.x) < .95 && Math.abs(head.y) < .95, `third person must retain Neo's actual head at aspect=${aspect}: ${head.toArray()}`);
    }
    for (const elapsed of [.3, 6.299, 7.1, 13.099]) {
      show(elapsed); assert.ok(cat.visible, 'test the last still-rendered frame, not an already hidden object');
      let exposed = 0, total = 0;
      cat.traverseVisible(object => {
        if (!(object instanceof THREE.Mesh)) return;
        for (let i = 0; i < object.geometry.attributes.position.count; i++) {
          object.getVertexPosition(i, point); object.localToWorld(point); total++;
          if (!architecture(point).length) exposed++;
        }
      });
      assert.equal(exposed, 0, `aspect=${aspect}, firstPerson=${firstPerson}, elapsed=${elapsed}: ${exposed}/${total} rendered cat vertices pop in open view`);
    }
    for (const elapsed of [3.1, 9.9]) {
      show(elapsed); const anatomy = cat.getObjectByName('ambush-doorway-cat-anatomy')! as THREE.Mesh;
      // Freeze the actual skinned surfaces once per sampled frame instead of
      // reskinning Neo separately for each ray.
      const bodyMeshes: THREE.Mesh[] = [];
      agents.getAgentBody('neo')!.traverseVisible(object => {
        if (!(object instanceof THREE.Mesh)) return;
        const positions: number[] = [];
        for (let i = 0; i < object.geometry.attributes.position.count; i++) {
          object.getVertexPosition(i, point); object.localToWorld(point); positions.push(...point.toArray());
        }
        const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        if (object.geometry.index) geometry.setIndex(object.geometry.index.clone());
        bodyMeshes.push(new THREE.Mesh(geometry, object.material));
      });
      let head = 0, headVisible = 0, body = 0, bodyVisible = 0, wallBlocked = 0, neoBlocked = 0; const bounds = new THREE.Box2();
      for (let i = 0; i < anatomy.geometry.attributes.position.count; i++) {
        anatomy.getVertexPosition(i, point); const isHead = point.x > .45, isBody = point.x > -.4 && point.x < .3;
        if (!isHead && !isBody) continue;
        if (isHead) head++; else body++;
        anatomy.localToWorld(point); const screen = point.clone().project(h.camera); bounds.expandByPoint(new THREE.Vector2(screen.x, screen.y));
        if (Math.abs(screen.x) >= .97 || Math.abs(screen.y) >= .97 || screen.z <= -1 || screen.z >= 1) continue;
        if (architecture(point).length) { wallBlocked++; continue; }
        const hits = ray.intersectObjects(bodyMeshes);
        if (hits.length) { neoBlocked++; continue; }
        if (isHead) headVisible++; else bodyVisible++;
      }
      bodyMeshes.forEach(mesh => mesh.geometry.dispose());
      assert.ok(headVisible > head * .7 && bodyVisible > body * .7,
        `aspect=${aspect}, firstPerson=${firstPerson}: actual head ${headVisible}/${head} and torso ${bodyVisible}/${body} must be readable through both doors without Neo blocking them; wall=${wallBlocked}, Neo=${neoBlocked}, camera=${h.camera.position.clone().sub(new THREE.Vector3(center.x,center.y-1,center.z)).toArray()}`);
      const size = bounds.getSize(new THREE.Vector2()); assert.ok(size.x > .07 && size.y > .05, `cat silhouette is too small to read: ${size.toArray()}`);
    }
  }
});
