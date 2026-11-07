import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, type PlayerInput } from '@auto_matrix/shared';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { OfficeSetRenderer } from '../packages/client/src/engine/OfficeSetRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

function setup(t: TestContext) {
  class InputTarget extends EventTarget { matches() { return false; } }
  const window = new InputTarget(), canvas = new InputTarget();
  const document = Object.assign(new InputTarget(), { pointerLockElement: canvas, hidden: false, exitPointerLock() {},
    createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }) }) });
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  Object.assign(globalThis, { window, document });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  let time = 2000; t.mock.method(performance, 'now', () => time);
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000), group = new THREE.Group(); group.add(new THREE.Group());
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const state = world.agents.get('neo')!;
  // The actual escort checkpoint beside the west window, before walking to the lift.
  state.currentLocation = 'film_metacortex_floor';
  state.position = { x: 1114.9430939990814, y: 66, z: 799.379974530624 }; state.rotation = 1.4167926535897928;
  state.currentAction = { type: 'move_to', parameters: { officeCustody: { role: 'neo', phase: 'escorting', elapsed: 3.2 }, crouching: false }, startedAt: 0, duration: 1, progress: .27 };
  const inputs: PlayerInput[] = [];
  const controls = new PlayerControls(canvas as unknown as HTMLCanvasElement, camera, input => inputs.push(input), () => {});
  const office = new OfficeSetRenderer(undefined, FILM_SETS.film_metacortex_floor);
  while (!office.prepareStep()) { /* Build the real walls and window geometry. */ }
  office.root.updateWorldMatrix(true, true); controls.possess(state);
  t.after(() => {
    controls.dispose(); office.dispose();
    ['window', 'document'].forEach((key, i) => {
      if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!); else Reflect.deleteProperty(globalThis, key);
    });
  });
  const event = (target: EventTarget, type: string, values: object) => target.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), values));
  const key = (code: string, down = true) => event(window, down ? 'keydown' : 'keyup', { code, repeat: false });
  const step = (frames = 1, running = false) => {
    for (let i = 0; i < frames; i++) { time += 1000 / 60; controls.update(1 / 60, state, group, running); }
    camera.updateMatrixWorld(true);
  };
  return { controls, camera, group, state, office, inputs, document, event, key, step };
}

function clearLens(game: ReturnType<typeof setup>, label: string) {
  const { camera, group, office } = game;
  const body = new THREE.Box3(group.position.clone().add(new THREE.Vector3(-1.4, -1.14, -1.4)),
    group.position.clone().add(new THREE.Vector3(1.4, 3.67, 1.4)));
  const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const lens = camera.near * Math.hypot(1, tangent, tangent * camera.aspect);
  assert.ok(body.distanceToPoint(camera.position) > lens, `${label}: the lens cuts into Neo at ${camera.position.toArray()}`);
  for (const [x, y] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    const corner = new THREE.Vector3(x, y, -1).unproject(camera), direction = corner.sub(camera.position);
    const hit = new THREE.Raycaster(camera.position, direction.clone().normalize(), .001, direction.length() + .03).intersectObject(office.root, true)[0];
    assert.ok(!hit, `${label}: architecture crosses the near plane at ${hit?.point.toArray()}`);
  }
}

test('a cold paused escort beside the window keeps Neo readable outside the near plane', t => {
  const game = setup(t), before = structuredClone(game.state);
  for (const aspect of [16 / 9, .65]) {
    game.camera.aspect = aspect; game.controls.possess(game.state); game.step(); clearLens(game, `cold/${aspect}`);
    for (const height of [1.5, 2.5, 3.2]) {
      const subject = game.group.position.clone().add(new THREE.Vector3(0, height, 0)).project(game.camera);
      assert.ok(Math.abs(subject.x) < .85 && Math.abs(subject.y) < .85 && subject.z > -1 && subject.z < 1,
        `Neo's upper body leaves the frame at height ${height}: ${subject.toArray()}`);
    }
  }
  assert.deepEqual(game.state, before, 'camera recovery must not change the paused actor or action');
});

test('escort wall turning and V keep the lens clear while paused', t => {
  const game = setup(t); game.step(60);
  for (const aspect of [16 / 9, .65]) {
    game.camera.aspect = aspect;
    game.key('KeyV'); game.key('KeyV', false); game.step();
    assert.equal(game.controls.firstPerson, true);
    const eyes = game.group.position.clone().add(new THREE.Vector3(0, 2.99, 0));
    assert.ok(game.camera.position.distanceTo(eyes) < .05);
    const direction = game.camera.getWorldDirection(new THREE.Vector3());
    game.event(game.document, 'mousemove', { movementX: 120, movementY: 0 }); game.step(10);
    assert.ok(game.camera.getWorldDirection(new THREE.Vector3()).distanceTo(direction) > .2);
    game.key('KeyV'); game.key('KeyV', false);
    for (let frame = 0; frame < 120; frame++) {
      game.event(game.document, 'mousemove', { movementX: -Math.PI * 2 / (.0028 * 120), movementY: 0 });
      game.step(); clearLens(game, `${aspect}/turn/${frame}`);
    }
    for (const movementY of [-500, 500, 500, -500]) {
      game.event(game.document, 'mousemove', { movementX: 0, movementY });
      for (let frame = 0; frame < 30; frame++) { game.step(); clearLens(game, `${aspect}/tilt/${movementY}/${frame}`); }
    }
  }
});

test('the near-wall escort view still allows the restrained walk', t => {
  const game = setup(t); game.step(60); const start = game.group.position.clone();
  game.key('KeyW');
  for (let frame = 0; frame < 45; frame++) { game.step(1, true); clearLens(game, `walking/${frame}`); }
  game.key('KeyW', false);
  assert.ok(game.group.position.distanceTo(start) > .5 && game.group.position.distanceTo(start) < 1.6);
  assert.ok(game.inputs.some(input => input.z !== 0 || input.x !== 0), 'normal movement input must still reach the server');
});

test('ordinary paused crouching at the office window survives re-entry and V without cutting into the body', t => {
  const game = setup(t);
  for (const type of ['idle', 'move_to'] as const) for (const aspect of [16 / 9, .65]) {
    game.state.currentAction = { type, parameters: { player: true, resolved: true, crouching: true, phone: { phase: 'connected', elapsed: 11 } }, startedAt: 4, duration: 1, progress: .27 };
    game.controls.phone = { phase: 'connected', elapsed: 11 }; game.camera.aspect = aspect;
    game.controls.possess(game.state); const before = structuredClone(game.state); game.step();
    assert.equal(game.controls.motion.crouching, true, 'a paused restored crouch must not require a held key');
    clearLens(game, `ordinary/${type}/${aspect}`);
    game.key('KeyV'); game.key('KeyV', false); game.step();
    assert.equal(game.controls.firstPerson, true); assert.equal(game.controls.motion.crouching, true);
    assert.ok(game.camera.position.distanceTo(game.group.position.clone().add(new THREE.Vector3(0, 1.89, 0))) < .05);
    game.key('KeyV'); game.key('KeyV', false); game.step(); clearLens(game, `ordinary-return/${type}/${aspect}`);
    assert.deepEqual(game.state, before);
  }
});

test('resuming a restored crouch follows fresh crouch input without replaying saved movement', t => {
  const game = setup(t);
  game.state.currentAction = { type: 'move_to', parameters: { player: true, resolved: true, crouching: true }, startedAt: 4, duration: 1, progress: .27 };
  game.controls.possess(game.state); game.step(); assert.equal(game.controls.motion.crouching, true);
  const start = game.group.position.clone(); game.step(30, true);
  assert.equal(game.controls.motion.crouching, false); assert.ok(game.group.position.distanceTo(start) < .01);
  game.key('KeyZ'); game.step(30, true); assert.equal(game.controls.motion.crouching, true);
  game.key('KeyZ', false); game.step(30, true); assert.equal(game.controls.motion.crouching, false);
});
