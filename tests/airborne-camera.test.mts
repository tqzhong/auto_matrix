import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import * as THREE from 'three';
import { filmPosition, stepPlayer } from '@auto_matrix/shared';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

function fixture(t: TestContext, vy: number, y = 2.18) {
  class Target extends EventTarget { matches() { return false; } }
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  Object.assign(globalThis, { window: new Target(), document: Object.assign(new Target(), { pointerLockElement: null, hidden: false, exitPointerLock() {} }) });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const actor = world.agents.get('trinity')!;
  actor.isInMatrix = true; actor.currentLocation = 'film_hotel_roofs'; actor.position = { ...filmPosition('film_hotel_roofs', 7, -1.5), y };
  actor.rotation = Math.PI; actor.velocity = { x: 0, y: vy, z: -8.39 }; actor.currentAction = null;
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000), group = new THREE.Group(); group.add(new THREE.Group());
  const sent: { jump: boolean }[] = [];
  const controls = new PlayerControls(new Target() as unknown as HTMLCanvasElement, camera, input => sent.push(input), () => {});
  t.after(() => { controls.dispose(); ['window', 'document'].forEach((key, i) => {
    if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!); else Reflect.deleteProperty(globalThis, key);
  }); });
  return { actor, camera, group, controls, sent };
}

for (const [vy, y, phase] of [[6.94, 2.18, 'rising'], [-4.7, 2.18, 'falling'], [9.85, 1.049625, 'just-launched']] as const) test(`airborne motion: a cold camera starts with the saved ${phase} body and resumes its prediction`, t => {
  const h = fixture(t, vy, y); h.controls.possess(h.actor); h.controls.update(0, h.actor, h.group, false);
  assert.equal(h.controls.motion.verticalVelocity, vy);
  assert.deepEqual(h.controls.position, h.actor.position);
  const expected = stepPlayer(h.actor.position, vy, { x: 0, z: 0, yaw: Math.PI, sprint: false, jump: false, sequence: 0 }, .02, true, [], h.actor.velocity);
  h.controls.update(.02, h.actor, h.group, true);
  assert.deepEqual(h.controls.position, expected.position);
  assert.equal(h.controls.motion.verticalVelocity, expected.verticalVelocity);
  assert.ok(h.sent.every(input => !input.jump), 'joining cannot replay the old jump key');
});

test('airborne motion: a large authoritative camera correction restores velocity with the corrected body', t => {
  const h = fixture(t, 6.94); const initial = structuredClone(h.actor); initial.position = filmPosition('film_hotel_roofs', -10, 10); initial.velocity = { x: 0, y: 0, z: 0 };
  h.controls.possess(initial); h.controls.update(0, initial, h.group, false);
  h.controls.update(0, h.actor, h.group, false);
  assert.deepEqual(h.controls.position, h.actor.position); assert.equal(h.controls.motion.verticalVelocity, h.actor.velocity.y);
});
