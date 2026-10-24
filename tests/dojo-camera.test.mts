import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, filmPosition, type AgentState, type PlayerInput } from '@auto_matrix/shared';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { TrainingSetRenderer } from '../packages/client/src/engine/TrainingSetRenderer.js';

const room = FILM_SETS.film_kungfu_dojo;
function setup(t: TestContext) {
  class InputTarget extends EventTarget { matches() { return false; } }
  const window = new InputTarget(), canvas = new InputTarget();
  const document = Object.assign(new InputTarget(), { pointerLockElement: null as unknown, hidden: false, exitPointerLock() {} });
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  Object.assign(globalThis, { window, document });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  let time = 2000; t.mock.method(performance, 'now', () => time);
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000);
  const group = new THREE.Group(); group.add(new THREE.Group());
  const sent: PlayerInput[] = [];
  const state: AgentState = { id: 'neo', name: 'Neo', faction: 'zion', status: 'alive',
    position: filmPosition(room.id, 9.821236878284, -29.240513462204), rotation: Math.PI * 1.5,
    velocity: { x: 0, y: 0, z: 0 }, targetPosition: null, currentPath: [], health: 100, maxHealth: 100,
    isAwakened: true, isInMatrix: true, currentLocation: room.id, currentGoal: '', currentAction: null,
    mood: '', alertness: 0, abilities: [], activeEffects: [],
    appearance: { bodyColor: '#fff', headColor: '#aaa', clothing: 'coat', accessories: [], isAgent: false } };
  const controls = new PlayerControls(canvas as unknown as HTMLCanvasElement, camera, input => sent.push(input), () => {});
  const hall = new THREE.Group(); hall.position.set(room.center.x, room.center.y - 1, room.center.z);
  const renderer = new TrainingSetRenderer(hall, 'm1_dojo'); hall.updateMatrixWorld(true);
  controls.possess(state);
  t.after(() => {
    controls.dispose(); renderer.dispose();
    ['window', 'document'].forEach((key, i) => {
      if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!); else Reflect.deleteProperty(globalThis, key);
    });
  });
  const event = (target: EventTarget, type: string, values = {}) => target.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), values));
  const key = (code: string, down = true) => event(window, down ? 'keydown' : 'keyup', { code, repeat: false });
  const step = (seconds: number, dt = 1 / 60, running = false) => {
    for (let i = 0; i < Math.round(seconds / dt); i++) { time += dt * 1000; controls.update(dt, state, group, running); }
    camera.updateMatrixWorld(true);
  };
  return { controls, camera, group, state, hall, sent, event, key, step, canvas, window, document };
}

function clearLens(game: ReturnType<typeof setup>, label: string) {
  const { camera, group, hall } = game;
  const body = new THREE.Box3(new THREE.Vector3(group.position.x - .65, group.position.y - 1, group.position.z - .65),
    new THREE.Vector3(group.position.x + .65, group.position.y + 3.4, group.position.z + .65));
  assert.ok(body.distanceToPoint(camera.position) > camera.near, `${label}: lens clips the body at ${camera.position.toArray()}`);
  const head = group.position.clone().add(new THREE.Vector3(0, 2.99, 0));
  for (const corner of [[0, 0], [-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    const center = corner[0] === 0 && corner[1] === 0;
    const origin = center ? head : camera.position;
    const lens = center ? camera.position.clone() : new THREE.Vector3(corner[0], corner[1], -1).unproject(camera);
    const sight = lens.sub(origin);
    const hit = new THREE.Raycaster(origin, sight.clone().normalize(), .01, sight.length() + .03).intersectObject(hall, true)[0];
    assert.ok(!hit, `${label}: wall crosses the lens at ${hit?.point.toArray()}, camera=${camera.position.toArray()}`);
  }
}

test('dojo third person stays outside the player and inside the visible walls on a cold perimeter load', t => {
  const game = setup(t);
  for (const aspect of [16 / 9, .65]) for (const [x, z] of [[9.821236878284, -29.240513462204], [23.25, 0], [-23.25, 0], [0, 29.25], [23.25, -29.25], [-23.25, 29.25]]) {
    for (const yaw of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      game.camera.aspect = aspect; game.camera.updateProjectionMatrix();
      Object.assign(game.state, { position: filmPosition(room.id, x, z), rotation: yaw });
      game.controls.possess(game.state); game.step(.4);
      clearLens(game, `${aspect}/${x}/${z}/${yaw}`);
    }
  }
});

test('dojo wall turning and V preserve a clear third-person lens and steerable first-person eyes', t => {
  const game = setup(t);
  for (const aspect of [16 / 9, .65]) {
    game.camera.aspect = aspect; game.camera.updateProjectionMatrix(); game.controls.possess(game.state); game.step(.4);
    game.key('KeyV'); game.key('KeyV', false); game.step(.1);
    assert.equal(game.controls.firstPerson, true);
    assert.ok(game.camera.position.distanceTo(game.group.position.clone().add(new THREE.Vector3(0, 2.99, 0))) < .05);
    const before = game.camera.getWorldDirection(new THREE.Vector3());
    game.event(game.canvas, 'mousedown', { button: 2 }); game.event(game.document, 'mousemove', { movementX: 80, movementY: 0 }); game.step(.1);
    assert.ok(game.camera.getWorldDirection(new THREE.Vector3()).distanceTo(before) > .1);
    game.key('KeyV'); game.key('KeyV', false);
    for (let frame = 0; frame < 120; frame++) {
      game.event(game.document, 'mousemove', { movementX: -Math.PI * 2 / (.0028 * 120), movementY: 0 }); game.step(1 / 60);
      clearLens(game, `${aspect}/turn/${frame}`);
    }
    game.event(game.window, 'mouseup');
  }
});

test('dojo wall sliding keeps the lens clear while the player moves and jumps', t => {
  const game = setup(t);
  for (const dt of [1 / 30, 1 / 60]) {
    game.controls.possess(game.state); game.step(.4, dt); game.key('KeyW'); game.key('Space');
    for (let frame = 0; frame < 60; frame++) {
      game.step(dt, dt, true); clearLens(game, `${dt}/walk/${frame}`);
      if (frame === 0) game.key('Space', false);
    }
    game.key('KeyW', false);
    assert.ok(game.group.position.x < game.state.position.x - 2, 'the camera correction must not stop walking');
    assert.ok(game.sent.some(input => input.jump), 'the normal jump must still reach the server');
  }
});
