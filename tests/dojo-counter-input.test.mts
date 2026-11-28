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

test('keyboard dojo counters animate the saved next strike after a pause and clear on leaving the lesson', t => {
  class Target extends EventTarget { matches() { return false; } }
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  const window = new Target(), canvas = new Target();
  Object.assign(globalThis, { window, document: Object.assign(new Target(), { pointerLockElement: null, hidden: false, exitPointerLock() {} }) });
  let now = 100_000; t.mock.method(performance, 'now', () => now);
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const neo = world.agents.get('neo')!;
  Object.assign(neo, { currentLocation: 'film_kungfu_dojo', position: filmPosition('film_kungfu_dojo', 0, 3), isInMatrix: true, isAwakened: true });
  const sandbox = new SandboxSystem(world, { record() {} } as unknown as WorldDynamics, 42);
  sandbox.enter(neo); sandbox.life.begin(neo, 0);
  const journey: FilmJourney = { version: 1, scene: 'm1_dojo', actor: 'neo', step: 0, completed: [], enteredAt: 0,
    checkpoint: { ...neo.position }, reflections: {}, lastText: '', fighting: true, dojo: { dodged: true, hits: 0, combo: 0, counterUntil: 16 } };
  sandbox.state.neoLife!.journey = journey;
  const group = new THREE.Group(); group.add(new THREE.Group());
  const controls = new PlayerControls(canvas as unknown as HTMLCanvasElement, new THREE.PerspectiveCamera(), () => {}, () => {});
  controls.possess(neo);
  const engine = Object.assign(Object.create(Engine.prototype), { playerControls: controls, running: true, audio: {},
    sandboxRenderer: { sync() {} }, updateAtmosphere() {} });
  t.after(() => { controls.dispose(); ['window', 'document'].forEach((key, i) => {
    if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!); else Reflect.deleteProperty(globalThis, key);
  }); });
  const press = () => {
    controls.update(0, neo, group, false); now += 20_000; controls.update(0, neo, group, true);
    window.dispatchEvent(Object.assign(new Event('keydown'), { code: 'KeyF', repeat: false }));
    window.dispatchEvent(Object.assign(new Event('keyup'), { code: 'KeyF' }));
  };
  for (const combo of [0, 1, 2]) {
    journey.dojo!.combo = combo; engine.setSandbox(structuredClone(sandbox.state), { neo }); press();
    assert.equal(controls.motion.combo, combo, 'keyboard animation must match the saved counter shown by the HUD');
  }
  for (const inactive of [{ visiting: true }, { actor: 'morpheus' }, { scene: 'm2_seraph' }, { dojo: { dodged: false, hits: 0, combo: 2 } }]) {
    engine.setSandbox({ ...sandbox.state, neoLife: { ...sandbox.state.neoLife!, journey: { ...journey, ...inactive } as FilmJourney } }, { neo });
    press(); assert.equal(controls.motion.combo, 0, 'ordinary combat must keep its normal expired-combo behavior');
  }
});
