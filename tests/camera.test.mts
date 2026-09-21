import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import * as THREE from 'three';
import type { AgentState, PlayerInput } from '@auto_matrix/shared';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';

function setup(t: TestContext, rotation = 0) {
  class InputTarget extends EventTarget { matches() { return false; } }
  const window = new InputTarget(); const canvas = new InputTarget();
  const document = Object.assign(new InputTarget(), { pointerLockElement: null as unknown, hidden: false, exitPointerLock() {} });
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  Object.assign(globalThis, { window, document });
  let time = 2000;
  t.mock.method(performance, 'now', () => time);
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000);
  const group = new THREE.Group(); group.add(new THREE.Group());
  const sent: PlayerInput[] = [];
  const actions: string[] = [];
  const state: AgentState = { id: 'neo', name: 'Neo', faction: 'zion', status: 'alive',
    position: { x: 1120, y: 1, z: 960 }, rotation, velocity: { x: 0, y: 0, z: 0 }, targetPosition: null, currentPath: [],
    health: 100, maxHealth: 100, isAwakened: false, isInMatrix: true, currentLocation: 'downtown',
    currentGoal: '', currentAction: null, mood: '', alertness: 0, abilities: [], activeEffects: [],
    appearance: { bodyColor: '#000', headColor: '#aaa', clothing: 'coat', accessories: [], isAgent: false } };
  const controls = new PlayerControls(canvas as unknown as HTMLCanvasElement, camera, input => sent.push(input), action => actions.push(action));
  controls.possess(state);
  t.after(() => {
    controls.dispose();
    ['window', 'document'].forEach((key, i) => {
      if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!);
      else Reflect.deleteProperty(globalThis, key);
    });
  });
  const event = (target: EventTarget, type: string, values = {}) => target.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), values));
  const key = (code: string, down = true, repeat = false) => event(window, down ? 'keydown' : 'keyup', { code, repeat });
  const step = (seconds: number, dt = 1 / 60, running = true) => {
    for (let i = 0; i < Math.round(seconds / dt); i++) { time += dt * 1000; controls.update(dt, state, group, running); }
  };
  const yaw = () => { const direction = camera.getWorldDirection(new THREE.Vector3()); return Math.atan2(direction.x, direction.z); };
  step(.5);
  return { controls, camera, group, state, document, window, canvas, sent, actions, event, key, step, yaw };
}

const angle = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

for (const view of ['third-person', 'first-person']) for (const [key, heading] of [['KeyD', -Math.PI / 2], ['KeyA', Math.PI / 2], ['KeyS', Math.PI]] as const) {
  test(`${view} camera follows ${key} without steering a held direction into circles`, t => {
    const game = setup(t); if (view === 'first-person') game.key('KeyV'); game.key(key);
    game.step(.1);
    assert.ok(Math.abs(angle(game.yaw(), 0)) < Math.abs(heading) / 4, 'camera turns smoothly instead of snapping');
    game.step(1.9);
    assert.ok(Math.abs(angle(game.yaw(), heading)) < .08, 'camera aligns with the movement direction');
    for (const input of game.sent.filter(input => Math.hypot(input.x, input.z) > .1)) {
      assert.ok(Math.abs(angle(Math.atan2(input.x, input.z), heading)) < .001, 'automatic camera movement must not change the movement sent to the server');
    }
    game.key(key, true, true); game.step(.5);
    assert.ok(Math.abs(angle(game.yaw(), heading)) < .08, 'key repeat does not rebase movement');
    game.key(key, false); game.step(.5);
    game.key('KeyW'); game.step(.5);
    const input = game.sent.at(-1)!;
    assert.ok(Math.abs(angle(Math.atan2(input.x, input.z), heading)) < .08, 'the next movement starts relative to the new view');
  });
}

for (const view of ['third-person', 'first-person']) for (const dt of [1 / 30, 1 / 60]) {
  test(`${view} diagonal follow crosses the angle seam by the short route at ${Math.round(1 / dt)} fps`, t => {
    const game = setup(t, Math.PI - .1); if (view === 'first-person') game.key('KeyV'); game.key('KeyW'); game.key('KeyA');
    const heading = Math.PI - .1 + Math.PI / 4;
    let previous = game.yaw(); let totalTurn = 0;
    for (let i = 0; i < 2 / dt; i++) {
      game.step(dt, dt); const next = game.yaw(); totalTurn += Math.abs(angle(next, previous)); previous = next;
    }
    assert.ok(Math.abs(angle(game.yaw(), heading)) < .08);
    assert.ok(totalTurn < 1.1, 'no full spin at the -PI/PI boundary');
  });
}

for (const view of ['third-person', 'first-person']) test(`${view} manual look has priority, then follow resumes while walking and leaves an idle view alone`, t => {
  const game = setup(t); if (view === 'first-person') game.key('KeyV'); game.key('KeyD'); game.step(1);
  game.event(game.canvas, 'mousedown', { button: 2 });
  const beforeLook = game.yaw();
  game.event(game.document, 'mousemove', { movementX: 180, movementY: 0 });
  game.step(1.5);
  assert.ok(Math.abs(angle(game.yaw(), beforeLook - 180 * .0028)) < .08, 'holding right mouse prevents auto-centering');
  game.event(game.window, 'mouseup'); game.step(.5);
  assert.ok(Math.abs(angle(game.yaw(), beforeLook - 180 * .0028)) < .08, 'release leaves time to finish looking around');
  game.step(1);
  assert.ok(Math.abs(angle(game.yaw(), -Math.PI / 2)) < .08, 'follow resumes after releasing the view');
  game.key('KeyD', false); game.step(.5);
  game.document.pointerLockElement = game.canvas;
  game.event(game.document, 'mousemove', { movementX: -150, movementY: 0 });
  game.step(.5); const idleView = game.yaw(); game.step(2);
  assert.ok(Math.abs(angle(game.yaw(), idleView)) < .01, 'standing still preserves free look');
});

test('V switches perspective mid-turn without redirecting a held movement key', t => {
  const game = setup(t); game.key('KeyD'); game.step(.2);
  game.key('KeyV'); game.step(1.8);
  assert.ok(Math.abs(angle(game.yaw(), -Math.PI / 2)) < .08, 'first-person continues the same turn');
  game.key('KeyV'); game.step(2);
  assert.ok(Math.abs(angle(game.yaw(), -Math.PI / 2)) < .08, 'third-person retains the heading');
  for (const input of game.sent.filter(input => Math.hypot(input.x, input.z) > .1)) {
    assert.ok(Math.abs(angle(Math.atan2(input.x, input.z), -Math.PI / 2)) < .001, 'V must not change the path');
  }
});

test('first-person mouse steering turns the view and movement together after keyboard follow', t => {
  const game = setup(t); game.key('KeyV'); game.key('KeyD'); game.step(2);
  const beforeLook = game.yaw();
  game.document.pointerLockElement = game.canvas;
  game.event(game.document, 'mousemove', { movementX: 100, movementY: 0 }); game.step(.5);
  assert.ok(Math.abs(angle(game.yaw(), beforeLook - .28)) < .001, 'mouse look has immediate priority');
  const input = game.sent.at(-1)!;
  assert.ok(Math.abs(angle(Math.atan2(input.x, input.z), -.28 - Math.PI / 2)) < .001, 'only the manual turn redirects movement');
  game.step(2);
  assert.ok(Math.abs(angle(game.yaw(), -.28 - Math.PI / 2)) < .08);
});

test('a late attack press buffers one follow-up, while pauses cannot queue attacks or jumps', t => {
  const game = setup(t);
  game.key('KeyF'); game.step(.25); game.key('KeyF');
  assert.deepEqual(game.actions, ['attack']);
  game.step(.2); assert.deepEqual(game.actions, ['attack', 'attack']);
  assert.equal(game.controls.motion.combo, 1);
  game.step(.6); assert.equal(game.actions.length, 2, 'one press cannot loop attacks');
  game.step(.1, 1 / 60, false); game.key('KeyF'); game.key('Space');
  game.step(.1, 1 / 60, false); game.step(.3);
  assert.equal(game.actions.length, 2); assert.equal(game.group.position.y, 1);
});

test('awakening and speed abilities do not turn an ordinary space press into a super jump', t => {
  const game = setup(t); game.state.isAwakened = true;
  game.state.activeEffects = [{ abilityId: 'test-speed', visualEffect: 'speed_blur', remainingTicks: 10 }];
  game.key('Space'); let peak = 1;
  for (let i = 0; i < 60; i++) { game.step(1 / 60); peak = Math.max(peak, game.group.position.y); }
  assert.ok(peak > 2.3 && peak < 2.9); assert.equal(game.group.position.y, 1);
});
