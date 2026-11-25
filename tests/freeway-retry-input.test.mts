import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, filmPosition, newFreewayPickup, type PlayerInput } from '@auto_matrix/shared';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

for (const firstPerson of [false, true]) test(`a turned freeway retry restores forward bridge input in ${firstPerson ? 'first' : 'third'} person`, t => {
  class Target extends EventTarget { matches() { return false; } }
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  Object.assign(globalThis, { window: new Target(), document: Object.assign(new Target(), { pointerLockElement: null, hidden: false, exitPointerLock() {} }) });
  let now = 100; t.mock.method(performance, 'now', () => now);
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const trinity = world.agents.get('trinity')!;
  const failed = { ...newFreewayPickup(2), phase: 'failed' as const, heading: -.8788006400000006, total: 28.865, role: 'trinity' as const };
  Object.assign(trinity, { currentLocation: 'film_freeway_101', position: filmPosition('film_freeway_101', 2.34, 776.32),
    rotation: failed.heading, isInMatrix: true, health: 73,
    currentAction: { type: 'idle', parameters: { resolved: true, player: true, freewayPickup: failed }, startedAt: 304831, duration: 1e9, progress: 0 } });
  const sent: PlayerInput[] = [], camera = new THREE.PerspectiveCamera(64, 16 / 9, .06, 5000), group = new THREE.Group(); group.add(new THREE.Group());
  const controls = new PlayerControls(new Target() as unknown as HTMLCanvasElement, camera, input => sent.push(input), () => {});
  t.after(() => { controls.dispose(); ['window', 'document'].forEach((key, i) => {
    if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!); else Reflect.deleteProperty(globalThis, key);
  }); });
  controls.possess(trinity); controls.firstPerson = firstPerson; controls.update(0, trinity, group, false);
  const ready = { ...newFreewayPickup(3), role: 'trinity' as const };
  trinity.position = { ...filmPosition('film_freeway_101', 14, 403), y: FILM_SETS.film_freeway_101.center.y + 18 };
  trinity.rotation = 0; trinity.currentAction!.parameters.freewayPickup = ready;
  controls.update(0, trinity, group, false);
  const bridge = { ...ready, phase: 'bridge' as const }; trinity.currentAction!.parameters.freewayPickup = bridge;
  controls.update(0, trinity, group, true);
  window.dispatchEvent(Object.assign(new Event('keydown'), { code: 'KeyW', repeat: false }));
  now += 120; controls.update(.02, trinity, group, true);
  const input = sent.at(-1)!;
  assert.ok(Math.abs(input.x) < 1e-8 && input.z > .999, `the previous crash heading must not send W sideways: ${input.x}, ${input.z}`);
  assert.equal(controls.firstPerson, firstPerson); assert.equal(trinity.health, 73);
  assert.deepEqual(trinity.currentAction!.parameters.freewayPickup, bridge, 'view calibration cannot rewrite the saved retry or bridge clock');
});
