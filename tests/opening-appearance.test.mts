import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SCENE_BY_ID, FILM_SETS, OPENING_ESCAPE, OPENING_ROOF_EXIT, filmEntry, openingRoofLeapPose, openingRoofStairPose, type FilmJourney } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
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
