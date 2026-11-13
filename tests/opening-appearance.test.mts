import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SCENE_BY_ID, FILM_SETS, OPENING_ESCAPE, OPENING_HOTEL, OPENING_ROOF_EXIT, filmEntry, filmPosition, openingHotelPickupPose, openingRoofLeapPose, openingRoofStairPose, type FilmJourney, type OpeningHotelPickupGesture, type SandboxState } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import type { CharacterRig } from '../packages/client/src/agents/CharacterModel.js';
import { HeroModels } from '../packages/client/src/agents/HeroModel.js';
import { advanceMotion, newMotion } from '../packages/client/src/agents/CharacterMotion.js';
import { poseOpeningRoofLanding } from '../packages/client/src/agents/OpeningRoofPerformance.js';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { actor } from './helpers/fighting-hand-fixture.mts';

test('Trinity covers the broken stairwell window with one pistol after the roll', async t => {
  const source = await actor('trinity'), asset = await source.models['load']('trinity');
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async () => asset);
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => ({ getContext: () => ({
    fillRect() {}, strokeRect() {}, fillText() {}, createRadialGradient: () => ({ addColorStop() {} }),
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {},
  }) }) } });
  const scene = new THREE.Scene(), renderer = new AgentRenderer(scene), world = new WorldState();
  t.after(() => { renderer.dispose(); source.models.dispose(); if (previous) Object.defineProperty(globalThis, 'document', previous); else Reflect.deleteProperty(globalThis, 'document'); });
  new AgentManager(world).initializeAllAgents();
  const trinity = world.agents.get('trinity')!, film = FILM_SCENE_BY_ID.m1_roofs, { center } = FILM_SETS[film.set];
  const camera = new THREE.PerspectiveCamera(); camera.position.set(center.x + 3, center.y + 3, center.z + OPENING_ROOF_EXIT.restZ);
  const origin = filmEntry(film), journey = { scene: film.id, actor: 'trinity', step: 2, completed: ['m1_room303'] } as FilmJourney;
  Object.assign(trinity, { currentLocation: film.set, isInMatrix: true, position: origin });
  renderer.updateAgent('trinity', trinity);
  for (let frame = 0; frame < 8; frame++) await new Promise(resolve => setImmediate(resolve));
  const body = renderer.getAgentBody('trinity')!, group = renderer.getAgent('trinity')!, hero = renderer.getAgentHero('trinity');
  assert.ok(hero, 'check the delivered Trinity model');
  const draw = (elapsed: number) => {
    const pose = openingRoofStairPose(elapsed);
    trinity.position = { x: center.x, y: center.y + pose.y, z: center.z + pose.z }; trinity.rotation = pose.yaw;
    trinity.currentAction = { type: 'move_to', parameters: { resolved: true, roofExit: { elapsed, origin, stairwell: true } }, startedAt: 7, duration: 1e9, progress: 0 };
    renderer.updateAgent('trinity', trinity);
    group.position.set(trinity.position.x, trinity.position.y, trinity.position.z); body.rotation.y = trinity.rotation;
    renderer.update(0, camera, 7, 0, journey); scene.updateMatrixWorld(true);
    const guns: THREE.Object3D[] = [];
    hero.traverseVisible(node => { if (node.getObjectByName('hel-pistol-grip')?.parent === node) guns.push(node); });
    return guns;
  };
  assert.equal(draw(OPENING_ROOF_EXIT.rollEnd - .35).length, 0, 'keep both hands clear while rolling');
  const guns = draw(OPENING_ROOF_EXIT.rollEnd + .7);
  assert.equal(guns.length, 1, 'Trinity must draw a single pistol for the look back');
  const pistol = guns[0], direction = new THREE.Vector3(0, 0, 1).applyQuaternion(pistol.getWorldQuaternion(new THREE.Quaternion()));
  const window = new THREE.Vector3(center.x, center.y - 1 + 4.1, center.z + OPENING_ROOF_EXIT.paneZ);
  const towardWindow = window.sub(pistol.getWorldPosition(new THREE.Vector3())).normalize();
  assert.ok(direction.dot(towardWindow) > .98, 'the pistol follows the actual window rather than the stair rail');
  const descent = draw(OPENING_ROOF_EXIT.walk + .4);
  assert.deepEqual(descent, [pistol], 'keep the same pistol while lowering the arm');
  const lowered = new THREE.Vector3(0, 0, 1).applyQuaternion(pistol.getWorldQuaternion(new THREE.Quaternion()));
  assert.ok(lowered.angleTo(direction) > .5, 'Trinity lowers the pistol as she leaves the landing');
  trinity.currentAction = null; renderer.updateAgent('trinity', trinity); renderer.update(0, camera, 7, 0, journey);
  assert.equal(pistol.visible, false, 'clear the stairwell performance when its saved action ends');
  assert.deepEqual(draw(OPENING_ROOF_EXIT.rollEnd + .7), [pistol], 'reuse the same prop on a replay');
});

test('Brown’s shoulder roll clears the rooftop and ends in a single-knee recovery', async t => {
  const source = await actor('smith'), asset = await source.models['load']('smith');
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async () => asset);
  t.after(() => { models.dispose(); source.models.dispose(); });
  const brown = (await models.create('smith', 'agent_brown'))!;
  const { center } = FILM_SETS.film_hotel_roofs, floor = center.y - 1;
  const body = new THREE.Group(), point = new THREE.Vector3(), motion = newMotion();
  body.add(brown.root);
  for (const progress of [.06, .18, .31, .42, .53, .65, .76, .9, .99]) {
    const { pursuerLeapSeconds, pursuerRollSeconds, pursuerRollDistance } = OPENING_ESCAPE;
    const root = openingRoofLeapPose({ fromX: -1, toX: 3, elapsed: pursuerLeapSeconds + progress * pursuerRollSeconds });
    body.position.set(center.x + root.x, floor + root.y, center.z + root.z);
    body.rotation.y = root.yaw;
    const input = { speed: pursuerRollDistance * 2 * (1 - progress) / pursuerRollSeconds,
      grounded: true, verticalVelocity: 0, turn: 0, openingRoofRoll: progress };
    models.animate(brown, advanceMotion(motion, input, 0), motion, input, 0);
    poseOpeningRoofLanding(brown, progress);
    body.updateMatrixWorld(true);
    let clearance = Infinity, nearest = '';
    brown.root.traverseVisible(mesh => {
      if (!(mesh instanceof THREE.SkinnedMesh)) return;
      mesh.skeleton.update();
      for (let vertex = 0; vertex < mesh.geometry.attributes.position.count; vertex++) {
        mesh.localToWorld(mesh.getVertexPosition(vertex, point));
        if (point.z > center.z + OPENING_ESCAPE.roofGapFar || point.y - floor >= clearance) continue;
        clearance = point.y - floor; nearest = mesh.name;
      }
    });
    assert.ok(clearance > -.09 && clearance < .36, `${progress}: ${nearest} is ${clearance} units from the roof`);
    if (progress === .76) {
      const left = brown.bones.get('knee_L')!.getWorldPosition(point).y;
      const right = brown.bones.get('knee_R')!.getWorldPosition(point).y;
      assert.ok(left - right > .3, 'one knee supports the rise while the other is raised');
    }
  }
});

test('Trinity visibly seats the 303 magazine with her left hand and returns to aim', async t => {
  const source = await actor('trinity'), asset = await source.models['load']('trinity');
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async () => asset);
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => ({ getContext: () => ({
    fillRect() {}, strokeRect() {}, fillText() {}, createRadialGradient: () => ({ addColorStop() {} }),
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {},
  }) }) } });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const trinity = world.agents.get('trinity')!, film = FILM_SCENE_BY_ID.m1_room303;
  Object.assign(trinity, { currentLocation: film.set, isInMatrix: true, position: filmEntry(film) });
  const renderer = new AgentRenderer(new THREE.Scene()), camera = new THREE.PerspectiveCamera();
  camera.position.copy(trinity.position).y += 4;
  t.after(() => { renderer.dispose(); source.models.dispose(); if (previous) Object.defineProperty(globalThis, 'document', previous); else Reflect.deleteProperty(globalThis, 'document'); });
  renderer.setPlayer('trinity', true);
  renderer.updateAgent('trinity', trinity);
  for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve));
  const body = renderer.getAgentBody('trinity')!;
  const hero = renderer.getAgentHero('trinity')!;
  assert.ok(hero, 'use the delivered model');
  const journey = { scene: film.id, actor: 'trinity', step: 1,
    openingHotel: { phase: 'combat', elapsed: 0, lastTick: 7, attempts: 0, disarmed: true, ammo: 4, shots: 4 } } as FilmJourney;
  const motion = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, firstPerson: true,
    armed: true, weaponStyle: 'hel_pistol' as const, aimPitch: 0 };
  const draw = (hotelReload?: number) => {
    renderer.setPlayerMotion({ ...motion, hotelReload });
    renderer.update(0, camera, 0, 7, journey); body.updateMatrixWorld(true);
    return body.getObjectByName('character-hel_pistol')!;
  };
  const gun = draw(), magazine = gun.getObjectByName('hel-pistol-magazine')!;
  const left = hero.getObjectByName('wrist_L')!, right = hero.getObjectByName('wrist_R')!;
  const chamber = magazine.position.clone(), pointing = gun.getWorldQuaternion(new THREE.Quaternion());
  const idleLeft = left.getWorldPosition(new THREE.Vector3());
  const grip = gun.position.clone();
  for (const phase of [.4, .53, .65]) {
    assert.equal(draw(phase), gun, 'keep the same pistol in the right hand');
    assert.equal(gun.parent, right);
    assert.ok(gun.position.distanceTo(grip) < 1e-7);
    assert.ok(chamber.y - magazine.position.y > .16, 'the magazine must leave the grip');
    const wrist = gun.worldToLocal(left.getWorldPosition(new THREE.Vector3()));
    assert.ok(wrist.distanceTo(magazine.position) < .47, 'the left hand moves to the magazine');
    assert.ok(left.getWorldPosition(new THREE.Vector3()).distanceTo(idleLeft) > .8);
    assert.ok(gun.getWorldQuaternion(new THREE.Quaternion()).angleTo(pointing) > .2, 'the pistol is lowered into reach');
  }
  draw(.53);
  const stopped = left.getWorldPosition(new THREE.Vector3());
  const detached = magazine.position.clone();
  draw(.24); draw(.53);
  assert.ok(stopped.distanceTo(left.getWorldPosition(new THREE.Vector3())) < 1e-6, 'the saved time determines the pose');
  assert.deepEqual(magazine.position.toArray(), detached.toArray());
  draw();
  assert.deepEqual(magazine.position.toArray(), chamber.toArray(), 'the magazine is flush when aiming resumes');
  assert.ok(gun.getWorldQuaternion(new THREE.Quaternion()).angleTo(pointing) < 1e-6);
  assert.ok(left.getWorldPosition(new THREE.Vector3()).distanceTo(idleLeft) < 1e-6);
});

test('Trinity lifts the same 303 pistol from the carpet without skipping hand contact', async t => {
  const source = await actor('trinity'), asset = await source.models['load']('trinity');
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async () => asset);
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => ({ getContext: () => ({
    fillRect() {}, strokeRect() {}, fillText() {}, createRadialGradient: () => ({ addColorStop() {} }),
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {},
  }) }) } });
  const scene = new THREE.Scene(), scenery = new FilmSetRenderer(scene), renderer = new AgentRenderer(scene);
  t.after(() => { scenery.dispose(); renderer.dispose(); source.models.dispose(); if (previous) Object.defineProperty(globalThis, 'document', previous); else Reflect.deleteProperty(globalThis, 'document'); });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const trinity = world.agents.get('trinity')!, film = FILM_SCENE_BY_ID.m1_room303;
  const floor = OPENING_HOTEL.roomCarpet.bottom + OPENING_HOTEL.roomCarpet.height;
  const fallen = filmPosition(film.set, -5.35, 10.3), yaw = Math.PI;
  const from = { position: { ...fallen, z: fallen.z + 2.3 }, yaw };
  const to = { position: { ...fallen, z: fallen.z + OPENING_HOTEL.pickup.stance }, yaw: yaw + .24 };
  const journey: FilmJourney = { version: 1, scene: film.id, actor: 'trinity', step: 1, completed: [], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: from.position,
    openingHotel: { phase: 'combat', elapsed: 0, lastTick: 0, attempts: 0, disarmed: false, ammo: 0, shots: 0, fallen } };
  const sandbox = { neoLife: { journey } } as SandboxState;
  const camera = new THREE.PerspectiveCamera(62, 16 / 9, .1, 1000);
  Object.assign(trinity, { currentLocation: film.set, isInMatrix: true, position: from.position });
  renderer.updateAgent('trinity', trinity);
  for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve));
  const body = renderer.getAgentBody('trinity')!, hero = renderer.getAgentHero('trinity')!;
  assert.ok(hero, 'use the delivered model');
  const approach = Math.hypot(to.position.x - from.position.x, to.position.z - from.position.z) * .2;
  const gesture: OpeningHotelPickupGesture = { phase: 'pickup', elapsed: 0, from, to, fallen };
  function draw(time: number, firstPerson: boolean) {
    gesture.elapsed = approach + time;
    const pose = openingHotelPickupPose(gesture);
    trinity.position = { x: pose.x, y: pose.y, z: pose.z }; trinity.rotation = pose.yaw;
    trinity.currentAction = { type: 'idle', parameters: { resolved: true, hotel303: gesture }, startedAt: 0, duration: 1, progress: 0 };
    renderer.updateAgent('trinity', trinity); renderer.getAgent('trinity')!.position.copy(trinity.position); body.rotation.y = pose.yaw;
    renderer.setPlayer('trinity', firstPerson);
    renderer.setPlayerMotion({ speed: 0, grounded: true, verticalVelocity: 0, turn: 0, firstPerson, hotel303: gesture, aimPitch: .1 });
    camera.position.copy(trinity.position).y += 4;
    renderer.update(0, camera, 0, 0, journey);
    scenery.update(trinity, sandbox, 0);
    scene.updateMatrixWorld(true);
    return { onFloor: scenery.root.getObjectByName('hotel-303-dropped-pistol')!, held: body.getObjectByName('character-hel_pistol')! };
  }
  const position = new THREE.Vector3(), rotation = new THREE.Quaternion();
  for (const first of [true, false]) {
    const reaching = draw(OPENING_HOTEL.pickup.grasp - .001, first);
    assert.ok(reaching.onFloor.visible && !reaching.held.visible);
    assert.ok(Math.abs(new THREE.Box3().setFromObject(reaching.onFloor).min.y - floor) < .006);
    const point = reaching.onFloor.getWorldPosition(position).clone();
    const flat = reaching.onFloor.getWorldQuaternion(rotation).clone();
    const palm = hero.getObjectByName('wrist_R')!.localToWorld(new THREE.Vector3(.11, -.22, .07));
    assert.ok(palm.distanceTo(point) < .13, 'the hand reaches the dropped pistol before it lifts');
    const grasp = draw(OPENING_HOTEL.pickup.grasp + .001, first);
    assert.ok(!grasp.onFloor.visible && grasp.held.visible);
    assert.ok(grasp.held.getWorldPosition(position).distanceTo(point) < .04);
    assert.ok(grasp.held.getWorldQuaternion(rotation).angleTo(flat) < .04);
    assert.equal(grasp.held.parent, hero.getObjectByName('wrist_R'));
    const lift = draw(OPENING_HOTEL.pickup.lift, first);
    assert.equal(lift.held, grasp.held);
    assert.ok(lift.held.getWorldPosition(position).y > point.y + 2);
    const target = lift.held.getWorldPosition(position).clone();
    draw(OPENING_HOTEL.pickup.grasp, first);
    assert.ok(draw(OPENING_HOTEL.pickup.lift, first).held.getWorldPosition(position).distanceTo(target) < 1e-8);
  }
});

test('cold hero rigs assemble on separate frames and disposal cancels a queued rig', async t => {
  const source = await actor('smith'), asset = await source.models['load']('smith');
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  const frames = new Map<number, FrameRequestCallback>();
  const previous = [globalThis.requestAnimationFrame, globalThis.cancelAnimationFrame];
  let nextFrame = 0;
  globalThis.requestAnimationFrame = callback => { frames.set(++nextFrame, callback); return nextFrame; };
  globalThis.cancelAnimationFrame = id => { frames.delete(id); };
  t.after(() => {
    models.dispose(); source.models.dispose();
    [globalThis.requestAnimationFrame, globalThis.cancelAnimationFrame] = previous;
  });
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async () => asset);
  const attached: string[] = [];
  const brown = models.create('smith', 'agent_brown', undefined, true).then(rig => { if (rig) attached.push('brown'); return rig; });
  const jones = models.create('smith', 'agent_jones', undefined, true).then(rig => { if (rig) attached.push('jones'); return rig; });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(attached, [], 'ready assets must yield before assembling');
  assert.equal(frames.size, 1);
  const [id, draw] = frames.entries().next().value!;
  frames.delete(id); draw(0);
  assert.ok(await brown);
  assert.deepEqual(attached, ['brown']);
  assert.equal(frames.size, 1, 'the second rig waits for another frame');
  models.dispose();
  assert.equal(await jones, undefined);
  assert.equal(frames.size, 0);
});

test('matching short hair maps share the texture while a different UV transform keeps its own sampler', async t => {
  const source = await actor('trinity');
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  t.after(() => { models.dispose(); source.models.dispose(); });
  const hairMaterial = (root: THREE.Group) => (root.getObjectByName('short04') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>).material;
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async url => {
    const name = String(url).split('/').pop()!.replace('.glb', '');
    assert(name === 'trinity' || name === 'smith' || name === 'choi' || name === 'trinity-club');
    const asset = await source.models['load'](name) as GLTF;
    if (name === 'trinity' || name === 'smith' || name === 'choi') {
      const map = new THREE.Texture({ width: 2048, height: 2048 });
      map.name = 'short04-hair.png'; map.colorSpace = THREE.SRGBColorSpace;
      map.wrapS = map.wrapT = THREE.RepeatWrapping; map.flipY = false;
      if (name === 'choi') map.repeat.x = 2;
      map.needsUpdate = true;
      hairMaterial(asset.scene).map = map;
      const { parser } = asset;
      parser.json.images = [{ uri: map.name }]; parser.json.textures = [{ source: 0 }];
      parser.associations.set(map, { textures: 0 });
    }
    return asset;
  });
  const [trinity, brown, choi] = await Promise.all([
    models.create('trinity'), models.create('smith', 'agent_brown'), models.create('smith', undefined, 'choi'),
  ]);
  const a = hairMaterial(trinity!.root), b = hairMaterial(brown!.root), c = hairMaterial(choi!.root);
  assert.equal(a.map, b.map);
  assert.equal(a.bumpMap, a.map); assert.equal(b.bumpMap, a.map);
  assert.notEqual(c.map, a.map);
  assert.equal(a.map!.repeat.x, 1); assert.equal(c.map!.repeat.x, 2);
  let sharedDisposals = 0, alternateDisposals = 0;
  a.map!.addEventListener('dispose', () => sharedDisposals++);
  c.map!.addEventListener('dispose', () => alternateDisposals++);
  models.dispose();
  assert.deepEqual([sharedDisposals, alternateDisposals], [1, 1]);
});

for (const controlled of [false, true]) test(`the ${controlled ? 'controlled' : 'autonomous'} Trinity keeps her opening bare eyes through cold scenes and restores her later sunglasses`, async t => {
  const source = await actor('trinity'), pending: Promise<unknown>[] = [];
  t.mock.method(GLTFLoader.prototype, 'loadAsync', url => {
    const name = String(url).split('/').pop()!.replace('.glb', '');
    const loading = source.models['load'](name); pending.push(loading); return loading;
  });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  class Target extends EventTarget { matches() { return false; } }
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  Object.assign(globalThis, { window: new Target(), document: Object.assign(new Target(), {
    pointerLockElement: null, hidden: false, exitPointerLock() {},
    createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {},
      createRadialGradient: () => ({ addColorStop() {} }),
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }),
  }) });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const trinity = world.agents.get('trinity')!; trinity.isInMatrix = true;
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000);
  const controls = new PlayerControls(new Target() as unknown as HTMLCanvasElement, camera, () => {}, () => {});
  const renderers: AgentRenderer[] = [];
  t.after(() => {
    controls.dispose(); renderers.forEach(renderer => renderer.dispose()); source.models.dispose();
    ['window', 'document'].forEach((key, i) => {
      if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!); else Reflect.deleteProperty(globalThis, key);
    });
  });
  for (const id of ['m1_room303', 'm1_roofs', 'm1_phone_escape']) {
    const film = FILM_SCENE_BY_ID[id]; trinity.position = filmEntry(film); trinity.currentLocation = film.set;
    trinity.rotation = Math.PI; trinity.currentAction = null;
    camera.position.set(trinity.position.x + 5, trinity.position.y + 3, trinity.position.z + 9);
    const journey = { version: 1, scene: id, actor: 'trinity', step: 0, completed: [], enteredAt: 0,
      reflections: {}, lastText: '', checkpoint: { ...trinity.position } } as FilmJourney;
    const renderer = new AgentRenderer(new THREE.Scene()); renderers.push(renderer);
    renderer.updateAgent('trinity', trinity);
    for (let frame = 0; frame < 6; frame++) { await Promise.all(pending); await new Promise(resolve => setImmediate(resolve)); }
    const rig = (renderer as unknown as { agents: Map<string, { rig: CharacterRig }> }).agents.get('trinity')!.rig;
    assert.ok(rig.hero, 'check the delivered Trinity model after a direct cold entry');
    for (const firstPerson of [false, true, false]) {
      if (controlled) {
        controls.possess(trinity); controls.firstPerson = firstPerson;
        controls.update(0, trinity, renderer.getAgent('trinity'), false);
        assert.equal(controls.motion.glasses, false, `${id}: possession must retain the film appearance`);
        renderer.setPlayer('trinity', firstPerson); renderer.setPlayerMotion(controls.motion);
      }
      renderer.update(0, camera, 0, 1, journey);
      assert.equal(rig.hero.glasses.visible, false, `${id}: ${firstPerson ? 'first' : 'third'} person must not add sunglasses`);
    }
    trinity.currentLocation = 'film_government_lobby'; renderer.updateAgent('trinity', trinity);
    if (controlled) {
      controls.update(0, trinity, renderer.getAgent('trinity'), false);
      assert.equal(controls.motion.glasses, true, 'the later Matrix costume keeps its sunglasses');
      renderer.setPlayerMotion(controls.motion);
    }
    renderer.update(0, camera, 0, 1);
    assert.equal(rig.hero.glasses.visible, true, 'the opening exception must clear when leaving the three opening sets');
  }
});
