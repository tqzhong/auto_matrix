import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { filmPosition, newFreewayPickup, newFreewayRide, type PlayerInput } from '@auto_matrix/shared';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

function setup(t: test.TestContext, mode: 'pickup' | 'ride') {
  class Target extends EventTarget { matches() { return false; } }
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  const window = new Target(), canvas = new Target();
  Object.assign(globalThis, { window, document: Object.assign(new Target(), { pointerLockElement: null, hidden: false, exitPointerLock() {} }) });
  let now = 100; t.mock.method(performance, 'now', () => now);
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const actor = world.agents.get('trinity')!;
  Object.assign(actor, { currentLocation: 'film_freeway_101', position: filmPosition('film_freeway_101', 14, 700), isInMatrix: true,
    currentAction: { type: 'idle', parameters: { resolved: true, player: true, ...(mode === 'pickup'
      ? { freewayPickup: { ...newFreewayPickup(), phase: 'merging', speed: 5, role: 'trinity' } }
      : { riding: true, seated: true, freewayRide: { ...newFreewayRide(), role: 'trinity' } }) }, startedAt: 0, duration: 1e9, progress: 0 } });
  const sent: { at: number; input: PlayerInput }[] = [], group = new THREE.Group(); group.add(new THREE.Group());
  const controls = new PlayerControls(canvas as unknown as HTMLCanvasElement, new THREE.PerspectiveCamera(), input => sent.push({ at: now, input }), () => {});
  controls.possess(actor); if (mode === 'ride') controls.ride = newFreewayRide();
  controls.update(0, actor, group, true); sent.length = 0;
  t.after(() => { controls.dispose(); ['window', 'document'].forEach((key, i) => {
    if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!); else Reflect.deleteProperty(globalThis, key);
  }); });
  return { controls, actor, sent,
    key(code: string, down = true, repeat = false) { window.dispatchEvent(Object.assign(new Event(down ? 'keydown' : 'keyup'), { code, repeat })); },
    time(value: number) { now = value; }, step(running = true) { controls.update(.02, actor, group, running); } };
}

const keys = [
  ['KeyW', 'throttle', 1, 0], ['ArrowUp', 'throttle', 1, 0],
  ['KeyS', 'brake', true, false], ['ArrowDown', 'brake', true, false],
  ['KeyA', 'steer', -1, 0], ['ArrowLeft', 'steer', -1, 0],
  ['KeyD', 'steer', 1, 0], ['ArrowRight', 'steer', 1, 0],
] as const;

for (const mode of ['pickup', 'ride'] as const) for (const [code, field, active, neutral] of keys) {
  test(`${mode} sends ${code} before a short press can fall between render packets`, t => {
    const game = setup(t, mode); game.time(110); game.key(code);
    assert.equal(game.sent.at(-1)?.input.drive?.[field], active, 'a real press must reach the network without waiting for the render loop');
    game.time(143); game.step(); game.time(170); game.key(code, false);
    assert.equal(game.sent.at(-1)?.input.drive?.[field], neutral, 'release must arrive before the next43ms render frame');
  });
  test(`${mode} stops ${code} immediately after a previously sent held input`, t => {
    const game = setup(t, mode); game.time(150); game.key(code); game.step();
    assert.equal(game.sent.at(-1)?.input.drive?.[field], active); game.sent.length = 0;
    game.time(170); game.key(code, false);
    assert.equal(game.sent.at(-1)?.input.drive?.[field], neutral, 'the server cannot keep the old steering, throttle or brake until a later render packet');
  });
}

test('held freeway keys keep the periodic rate and repeated events do not flood packets', t => {
  const game = setup(t, 'pickup'); game.time(110); game.key('KeyA');
  assert.equal(game.sent.length, 1);
  game.time(120); game.key('KeyA', true, true); game.key('KeyA'); game.time(130); game.step();
  assert.equal(game.sent.length, 1);
  game.time(160); game.step(); assert.equal(game.sent.length, 2);
  game.time(170); game.key('KeyA', false); game.key('KeyA', false); assert.equal(game.sent.length, 3);
  assert.ok(game.sent.every((packet, index) => !index || packet.input.sequence > game.sent[index - 1].input.sequence));
});

test('paused freeway input changes do not send immediate driving commands', t => {
  const game = setup(t, 'pickup'); game.step(false); game.sent.length = 0;
  game.time(110); game.key('KeyD'); game.time(170); game.key('KeyD', false);
  assert.equal(game.sent.length, 0);
});

test('bridge walking retains the ordinary render-based input cadence', t => {
  const game = setup(t, 'pickup'); game.actor.currentAction!.parameters.freewayPickup = { ...newFreewayPickup(), phase: 'bridge', role: 'trinity' };
  game.step(); game.sent.length = 0; game.time(110); game.key('KeyW'); game.time(130); game.key('KeyW', false);
  assert.equal(game.sent.length, 0);
});
