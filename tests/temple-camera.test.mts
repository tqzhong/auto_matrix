import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, TEMPLE_DEFENSE, filmPosition, templeCastRoot, type PlayerInput, type TempleDefenseGesture } from '@auto_matrix/shared';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { ZionHomecomingRenderer } from '../packages/client/src/engine/ZionHomecomingRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';

function fixture(t: TestContext, role: 'zee' | 'lock') {
  class InputTarget extends EventTarget { matches() { return false; } }
  const window = new InputTarget(), canvas = new InputTarget();
  const document = Object.assign(new InputTarget(), { pointerLockElement: null as unknown, hidden: false, exitPointerLock() {},
    createElement: () => ({ getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {}, createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) });
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key)); Object.assign(globalThis, { window, document });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const state = world.agents.get(role)!;
  Object.assign(state, { currentLocation: 'film_zion_temple', isInMatrix: false, rotation: Math.PI,
    position: filmPosition('film_zion_temple', role === 'zee' ? -8 : TEMPLE_DEFENSE.breach.actor.x, role === 'zee' ? TEMPLE_DEFENSE.operatorZ : TEMPLE_DEFENSE.breach.actor.z) });
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000), group = new THREE.Group(); group.add(new THREE.Group());
  const head = new THREE.Bone(); head.name = `${role}-head`; head.position.set(0, 2.7, .05); head.userData.cameraEye = new THREE.Vector3(0, .1, .32); group.children[0].add(head);
  const sent: PlayerInput[] = [], controls = new PlayerControls(canvas as unknown as HTMLCanvasElement, camera, input => sent.push(input), () => {});
  let time = 2000; t.mock.method(performance, 'now', () => time);
  const step = (gesture: TempleDefenseGesture) => {
    state.currentAction = { type: 'idle', parameters: { templeDefense: gesture }, startedAt: 0, duration: 1e9, progress: 0 };
    time += 100; controls.update(.1, state, group, false); group.updateMatrixWorld(true); camera.updateMatrixWorld(true);
  };
  const toggle = () => window.dispatchEvent(Object.assign(new Event('keydown'), { code: 'KeyV', repeat: false }));
  controls.possess(state);
  t.after(() => { controls.dispose(); ['window', 'document'].forEach((key, i) => {
    if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!); else Reflect.deleteProperty(globalThis, key);
  }); });
  return { camera, controls, group, head, state, document, canvas, sent, step, toggle };
}

test('the temple wheel camera keeps both handles visible and V follows the posed eye while retaining free look', t => {
  const h = fixture(t, 'zee'), center = FILM_SETS.film_zion_temple.center;
  const gesture: TempleDefenseGesture = { role: 'zee', phase: 'mounting', elapsed: 4, mount: 0, turn: .45, grip: 1 };
  for (const aspect of [16 / 9, .65]) {
    h.camera.aspect = aspect; h.controls.possess(h.state); h.step(gesture); h.toggle(); h.step(gesture);
    const count = h.sent.length; h.controls.syncDockReunionCamera(h.group); assert.equal(h.sent.length, count);
    assert.ok(h.camera.position.distanceTo(h.head.localToWorld(h.head.userData.cameraEye.clone())) < 1e-7);
    h.camera.updateMatrixWorld(true);
    const target = new THREE.Vector3(center.x - 8, center.y - 1 + TEMPLE_DEFENSE.wheel.y, center.z + TEMPLE_DEFENSE.wheel.z);
    for (const sign of [-1, 1]) {
      const point = target.clone().add(new THREE.Vector3(sign * .52, 0, 0)).project(h.camera);
      assert.ok(Math.abs(point.x) < .95 && Math.abs(point.y) < .8 && point.z > -1 && point.z < 1, `wheel handle outside ${aspect} frame: ${point.toArray()}`);
    }
    const before = h.camera.getWorldDirection(new THREE.Vector3()); h.document.pointerLockElement = h.canvas;
    h.document.dispatchEvent(Object.assign(new Event('mousemove'), { movementX: 160, movementY: -40 })); h.step(gesture); h.controls.syncDockReunionCamera(h.group);
    assert.ok(before.distanceTo(h.camera.getWorldDirection(new THREE.Vector3())) > .2);
    assert.equal(h.controls.motion.templeDefense!.turn, .45);
  }
});

test('Zee’s performed arms remain visible from her eye while her head is hidden, including before detailed assets arrive', t => {
  const h = fixture(t, 'zee');
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  const renderer = new AgentRenderer(new THREE.Scene()); t.after(() => renderer.dispose()); renderer.setWorld(false);
  const gesture: TempleDefenseGesture = { role: 'zee', phase: 'mounting', elapsed: 4, mount: 0, turn: .45, grip: 1 };
  h.step(gesture); renderer.updateAgent('zee', h.state); renderer.setPlayer('zee', true); renderer.setPlayerMotion(h.controls.motion);
  renderer.update(0, h.camera, 0); const body = renderer.getAgent('zee')!.children[0];
  assert.equal(body.visible, true, 'first person cannot hide the whole body during a two-hand interaction');
  const head = body.getObjectByName('zee-head')!; assert.equal(head.visible, false, 'the camera cannot draw the inside of its own head');
  renderer.setPlayer('zee', false); renderer.update(0, h.camera, 0); assert.equal(head.visible, true, 'V restores the head in third person');
});

test('Lock’s saved city breach camera sees the drill through the entrance and both crouching companions in wide and portrait views', t => {
  const h = fixture(t, 'lock'), center = FILM_SETS.film_zion_temple.center, root = new THREE.Group();
  root.position.set(center.x, center.y - 1, center.z); const renderer = new ZionHomecomingRenderer(root, 'film_zion_temple'); t.after(() => renderer.dispose());
  renderer.update({ scene: 'm3_temple_breach', step: 1, completed: [], templeBreach: { phase: 'breach', elapsed: 3.8 } } as any, 0); root.updateMatrixWorld(true);
  for (const aspect of [16 / 9, .65]) for (const phase of ['breach', 'waiting'] as const) {
    h.camera.aspect = aspect; h.controls.possess(h.state); h.step({ role: 'lock', phase, elapsed: 3.8, turn: 1, grip: 0 });
    const drill = root.getObjectByName('temple-city-digger')!;
    const targets = phase === 'breach' ? [new THREE.Vector3(center.x, center.y + 23, center.z - 105), drill.localToWorld(new THREE.Vector3(0, 8.5, 0))]
      : ['link', 'zee'].map(role => { const at = templeCastRoot(role); return new THREE.Vector3(center.x + at.x, center.y + 1.65, center.z + at.z); });
    for (const target of targets) {
      const point = target.clone().project(h.camera); assert.ok(Math.abs(point.x) < .9 && Math.abs(point.y) < .85 && point.z > -1 && point.z < 1, `${aspect}/${phase}: subject outside frame ${point.toArray()}`);
      const ray = target.clone().sub(h.camera.position);
      const hits = new THREE.Raycaster(h.camera.position, ray.clone().normalize(), .06, ray.length() - .4).intersectObject(root, true).filter(hit => {
        for (let object: THREE.Object3D | null = hit.object; object; object = object.parent) if (!object.visible || phase === 'breach' && object === drill) return false;
        return !(hit.object.material as THREE.Material).transparent;
      });
      assert.equal(hits.length, 0, `${phase}: visible scenery blocks ${target.toArray()}: ${hits.map(hit => `${hit.object.name}/${hit.object.parent?.name} at ${hit.point.toArray()}`)}`);
    }
  }
});
