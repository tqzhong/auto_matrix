import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { filmPosition, type FilmJourney } from '@auto_matrix/shared';
import { Engine } from '../packages/client/src/engine/Engine.js';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

test('predicted plaza walking stops at the rendered crowd, slides around it and preserves an overlapping paused save', t => {
  class Target extends EventTarget { matches() { return false; } }
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  const window = new Target();
  Object.assign(globalThis, { window, document: Object.assign(new Target(), { pointerLockElement: null, hidden: false, exitPointerLock() {} }) });
  let now = 100_000; t.mock.method(performance, 'now', () => now);
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const neo = world.agents.get('neo')!;
  Object.assign(neo, { currentLocation: 'film_red_dress_plaza', position: filmPosition('film_red_dress_plaza', .567114107902, 26),
    rotation: Math.PI, isInMatrix: true, isAwakened: true, currentAction: null });
  const sandbox = new SandboxSystem(world, { record() {} } as unknown as WorldDynamics, 42);
  sandbox.enter(neo); sandbox.life.begin(neo, 0);
  sandbox.state.neoLife!.journey = { version: 1, scene: 'm1_red_dress', actor: 'neo', step: 0, completed: [], enteredAt: 0,
    checkpoint: { ...neo.position }, reflections: {}, lastText: '' } as FilmJourney;
  const group = new THREE.Group(); group.add(new THREE.Group());
  const controls = new PlayerControls(new Target() as unknown as HTMLCanvasElement, new THREE.PerspectiveCamera(), () => {}, () => {});
  const engine = Object.assign(Object.create(Engine.prototype), { playerControls: controls, running: false, audio: {},
    sandboxRenderer: { sync() {} }, updateAtmosphere() {} });
  controls.possess(neo); engine.setSandbox(sandbox.state, { neo }); controls.update(0, neo, group, true);
  t.after(() => { controls.dispose(); ['window', 'document'].forEach((key, i) => {
    if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!); else Reflect.deleteProperty(globalThis, key);
  }); });
  const body = filmPosition('film_red_dress_plaza', 0, 23);
  const gap = () => Math.hypot(group.position.x - body.x, group.position.z - body.z);
  const walk = (code: string, frames: number, check = () => {}) => {
    window.dispatchEvent(Object.assign(new Event('keydown'), { code, repeat: false }));
    for (let i = 0; i < frames; i++) { now += 50; controls.update(.05, neo, group, true); check(); }
    window.dispatchEvent(Object.assign(new Event('keyup'), { code }));
  };
  walk('KeyW', 50, () => assert.ok(gap() >= 1.8, 'the local body cannot pass into a visible pedestrian'));
  walk('KeyD', 30); assert.ok(gap() > 3, 'sideways input must release the player from the contact');
  neo.position = filmPosition('film_red_dress_plaza', .567114107902, 23.158469572709);
  controls.possess(neo); controls.update(0, neo, group, false);
  assert.deepEqual(group.position.toArray(), [neo.position.x, neo.position.y, neo.position.z]);
  walk('KeyD', 30); assert.ok(gap() > 3, 'a saved overlap can be left without a teleport or a progress reset');
});
