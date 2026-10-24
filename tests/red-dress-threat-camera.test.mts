import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, redDressAttention, trainingRoot, type TrainingPerformance, type PlayerInput } from '@auto_matrix/shared';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { HeroModels } from '../packages/client/src/agents/HeroModel.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { actor } from './helpers/fighting-hand-fixture.mjs';

async function setup(t: test.TestContext) {
  const source = await actor('neo');
  await source.models['load']('smith'); await source.models['load']('morpheus');
  t.mock.method(HeroModels.prototype, 'load', source.models['load'].bind(source.models));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  class Target extends EventTarget { matches() { return false; } }
  const window = new Target(), canvas = new Target(), document = Object.assign(new Target(), { pointerLockElement: canvas, hidden: false, exitPointerLock() {},
    createElement: () => ({ getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) });
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key)); Object.assign(globalThis, { window, document });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const models = new CharacterModels(), roles = ['neo', 'smith', 'morpheus'] as const;
  const rigs = Object.fromEntries(roles.map(role => [role, models.create(world.agents.get(role)!)])) as Record<typeof roles[number], ReturnType<CharacterModels['create']>>;
  await new Promise(resolve => setImmediate(resolve));
  for (const role of roles) assert.ok(rigs[role].hero, `load the delivered ${role} mesh`);
  const center = FILM_SETS.film_red_dress_plaza.center, scene = new THREE.Scene(), group = new THREE.Group();
  group.add(rigs.neo.root); scene.add(group, rigs.smith.root, rigs.morpheus.root); rigs.neo.root.position.y = -1;
  const attention = redDressAttention(6.2); attention.yaw = Math.atan2(2.6, 4); attention.clock = 6.2;
  const training: TrainingPerformance = { kind: 'red_dress', elapsed: 6.2, started: true, attention };
  const neo = world.agents.get('neo')!, root = trainingRoot(training, 'neo');
  Object.assign(neo, { currentLocation: 'film_red_dress_plaza', isInMatrix: true, rotation: root.yaw,
    position: { x: center.x + root.x, y: center.y, z: center.z + root.z },
    currentAction: { type: 'idle', parameters: { training: { ...training, role: 'neo' } }, startedAt: 0, duration: 1e9, progress: 0 } });
  group.position.copy(neo.position); rigs.neo.root.rotation.y = neo.rotation;
  for (const role of roles) {
    const position = trainingRoot(training, role);
    if (role !== 'neo') { rigs[role].root.position.set(center.x + position.x, center.y - 1, center.z + position.z); rigs[role].root.rotation.y = position.yaw; }
    models.animate(rigs[role], 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, armed: role === 'smith', weaponStyle: 'hel_pistol', training: { ...training, role } }, 0);
  }
  scene.updateMatrixWorld(true);
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000), sent: PlayerInput[] = [];
  const controls = new PlayerControls(canvas as unknown as HTMLCanvasElement, camera, input => sent.push(input), () => {});
  let time = 2000; t.mock.method(performance, 'now', () => time);
  const frame = () => { time += 1000 / 60; controls.update(1 / 60, neo, group, false); scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); };
  const key = (code: string) => { for (const type of ['keydown', 'keyup']) window.dispatchEvent(Object.assign(new Event(type), { code, repeat: false })); };
  const view = (aspect: number, pitch = 0) => {
    camera.aspect = aspect; controls.release(); controls.possess(neo);
    document.dispatchEvent(Object.assign(new Event('mousemove'), { movementX: 0, movementY: (pitch - .24) / .0028 }));
    for (let i = 0; i < 120; i++) frame();
  };
  t.after(() => { controls.dispose(); models.dispose(); source.models.dispose(); ['window', 'document'].forEach((key, i) => {
    if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!); else Reflect.deleteProperty(globalThis, key);
  }); });
  return { camera, controls, scene, rigs, attention, training, neo, view, frame, key, document, sent };
}

function meshes(root: THREE.Object3D) {
  const result: THREE.Mesh[] = [];
  root.traverseVisible(object => { if (object instanceof THREE.Mesh) {
    if (object instanceof THREE.SkinnedMesh) { object.skeleton.update(); object.computeBoundingSphere(); }
    result.push(object);
  } }); return result;
}
function belongsTo(object: THREE.Object3D, root: THREE.Object3D): boolean {
  for (let node: THREE.Object3D | null = object; node; node = node.parent) if (node === root) return true;
  return false;
}

test('the third-person red-dress reveal exposes Smith and his actual muzzle beside Neo in wide and narrow windows', async t => {
  const h = await setup(t), gun = h.rigs.smith.weapons![0], original = structuredClone(h.training);
  for (const aspect of [16 / 9, 431 / 670]) for (const pitch of [0, -.15, .24]) {
    h.view(aspect, pitch); const surfaces = meshes(h.scene);
    const subjects = [
      { name: 'Smith face', point: h.rigs.smith.hero!.bones.get('head')!.localToWorld(new THREE.Vector3(0, .12, .24)), root: h.rigs.smith.root },
      { name: 'pistol muzzle', point: gun.localToWorld(new THREE.Vector3(0, .065, .475)), root: gun },
      { name: 'pistol slide', point: gun.localToWorld(new THREE.Vector3(0, .135, .19)), root: gun },
    ];
    for (const subject of subjects) {
      const ndc = subject.point.clone().project(h.camera), direction = subject.point.clone().sub(h.camera.position);
      const hit = new THREE.Raycaster(h.camera.position, direction.clone().normalize(), h.camera.near, direction.length() + .02).intersectObjects(surfaces, false)[0];
      t.diagnostic(JSON.stringify({ aspect, pitch, subject: subject.name, ndc: ndc.toArray(), hit: hit?.object.name, neo: hit && belongsTo(hit.object, h.rigs.neo.root) }));
      assert.ok(Math.abs(ndc.x) < .94 && Math.abs(ndc.y) < .94 && ndc.z > -1 && ndc.z < 1, `${subject.name} leaves the frame at ${aspect}`);
      assert.ok(hit && belongsTo(hit.object, subject.root), `${subject.name} is hidden by ${hit?.object.name} at ${aspect}`);
    }
    const head = h.rigs.neo.hero!.bones.get('head')!.getWorldPosition(new THREE.Vector3()).project(h.camera);
    assert.ok(Math.abs(head.x) < .98 && Math.abs(head.y) < .98, 'Neo remains visible beside the threat');
    assert.deepEqual(h.training, original, 'camera composition cannot advance or replace the saved attention state');
  }
});

test('the red-dress shoulder view preserves real mouse attention and V keeps Neo actual eye', async t => {
  const h = await setup(t); h.view(431 / 670);
  for (const firstPerson of [false, true]) {
    if (firstPerson) { h.key('KeyV'); h.frame(); }
    const direction = h.camera.getWorldDirection(new THREE.Vector3());
    h.document.dispatchEvent(Object.assign(new Event('mousemove'), { movementX: 160, movementY: -25 }));
    for (let i = 0; i < 120; i++) h.frame();
    const after = h.camera.getWorldDirection(new THREE.Vector3()), input = h.sent.at(-1)!;
    assert.ok(after.distanceTo(direction) > .3, 'paused training still permits deliberate looking');
    assert.ok(Math.abs(Math.atan2(Math.sin(Math.atan2(after.x, after.z) - input.yaw), Math.cos(Math.atan2(after.x, after.z) - input.yaw))) < .03,
      'the visible look direction agrees with the attention sent to the server');
    if (firstPerson) {
      const head = h.rigs.neo.hero!.bones.get('head')!;
      const eye = head.localToWorld((head.userData.patientEye ?? head.userData.cameraEye).clone());
      assert.ok(h.camera.position.distanceTo(eye) < 1e-6, 'V uses the actual posed eye');
    }
    assert.equal(h.training.elapsed, 6.2); assert.equal(h.attention.clock, 6.2);
  }
});
