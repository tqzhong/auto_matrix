import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FILM_SCENE_BY_ID, FILM_SETS, OPENING_PHONE, filmEntry, filmPosition, openingHitPose,
  openingTruckPose, playerBlocked, stepPlayer, type OpeningPhoneHit, type WorldEvent,
} from '@auto_matrix/shared';
import { advanceMotion, newMotion } from '../packages/client/src/agents/CharacterMotion.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';

const scene = FILM_SCENE_BY_ID.m1_phone_escape;
const set = FILM_SETS[scene.set];
const at = (x: number, z: number, y = 0) => ({ ...filmPosition(scene.set, x, z), y: set.center.y + y });

function setup(x: number, z: number, remaining = 10) {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const conversations = { interrupt() {}, isAgentInConversation: () => false, startConversation: () => false } as unknown as ConversationEngine;
  const players = new PlayerController(world, conversations, { execute() {} } as unknown as ActionExecutor, dynamics, sandbox);
  players.possess('caller', 'neo', 0); sandbox.life.begin(world.agents.get('neo')!, 0); sandbox.state.neoLife!.chapter = 1;
  players.sandboxAction('caller', { kind: 'life', target: 'film:start' }, 0);
  players.release('caller', 0);
  Object.assign(sandbox.life.film.state!, {
    scene: scene.id, step: 1, actor: 'trinity', checkpoint: filmEntry(scene), completed: ['m1_room303', 'm1_roofs'],
    openingPhone: { phase: 'running', remaining, lastTick: 0, attempts: 0 },
  });
  const caller = world.agents.get('trinity')!;
  caller.currentLocation = scene.set; caller.isInMatrix = true; caller.position = at(x, z); caller.rotation = Math.PI;
  players.possess('caller', 'trinity', 0);
  const phone = () => sandbox.life.film.state!.openingPhone!;
  const frame = (count = 1, running = true) => { for (let i = 0; i < count; i++) players.step(.05, running, 0); };
  const retry = () => players.sandboxAction('caller', { kind: 'life', target: 'film:retry' }, 0);
  return { sandbox, players, caller, phone, frame, retry };
}

function walk(from: ReturnType<typeof at>, x: number, z: number, frames: number, sprint = false) {
  let position = from;
  for (let sequence = 0; sequence < frames; sequence++)
    position = stepPlayer(position, 0, { x, z, yaw: Math.atan2(x, z), sequence, sprint }, .05, true).position;
  return position;
}

test('Wells: glass, cabinet and the parked truck stop movement while the booth entrance stays open', () => {
  const side = walk(at(4, -30.08), -1, 0, 36, true);
  assert.ok(side.x > set.center.x + 1.8 && side.x < set.center.x + 3, `sprinting stops at the glass: ${side.x - set.center.x}`);
  const stand = walk(at(OPENING_PHONE.stand.x, OPENING_PHONE.stand.z + 2), 0, -1, 26);
  assert.ok(stand.z <= set.center.z + OPENING_PHONE.stand.z, 'the open booth admits the player to the receiver');
  assert.ok(stand.z > set.center.z - 29.68, 'the body stops in front of the cabinet');
  assert.equal(playerBlocked(at(15, 4), true), true, 'the truck is solid in a non-story visit');
  assert.equal(playerBlocked(at(12, 7.25), true), false, 'the street alongside the cab is open');
});

test('Wells: the sidewalk supports the body and a lamp blocks the direct route with room to go around', () => {
  const lamp = set.width * .34;
  const approach = walk(at(12, -16), 1, 0, 32);
  assert.ok(approach.x < set.center.x + lamp && approach.x > set.center.x + lamp - 1.1, 'a street lamp blocks the direct path');
  assert.ok(Math.abs(approach.y - set.center.y - .425) < 1e-8, 'feet stand on the actual sidewalk');
  const bypass = walk(walk(approach, 0, 1, 10), 1, 0, 16);
  assert.ok(bypass.x > set.center.x + lamp);
});

test('Wells: the moving truck strikes a free caller, saves the reaction and allows retry', () => {
  const h = setup(3.8, -8.4);
  const from = { ...h.caller.position };
  h.frame(25);
  assert.equal(h.phone().phase, 'running', 'the scene cannot fail before contact');
  for (let i = 0; i < 100 && !h.phone().hit; i++) h.frame();
  const phone = structuredClone(h.phone()), action = structuredClone(h.caller.currentAction), position = { ...h.caller.position };
  assert.equal(phone.phase, 'failed'); assert.ok(phone.hit && phone.remaining > 0 && !phone.answer);
  assert.deepEqual(phone.hit.origin, { x: from.x - set.center.x, y: 0, z: from.z - set.center.z });
  assert.deepEqual(action?.parameters.openingHit, phone.hit); assert.equal(action?.parameters.openingAnswer, undefined);
  const structures = structuredClone(h.sandbox.state.structures);
  h.frame(8, false); h.players.release('caller', 0);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); h.players.possess('caller', 'trinity', 0);
  assert.deepEqual(h.phone(), phone); assert.deepEqual(h.caller.currentAction, action); assert.deepEqual(h.caller.position, position);
  assert.deepEqual(h.sandbox.state.structures, structures);
  h.frame(30);
  assert.equal(h.phone().hit?.elapsed, OPENING_PHONE.hitSeconds);
  assert.ok(h.phone().remaining < phone.remaining, 'the vehicle continues along its saved approach');
  assert.ok(openingTruckPose(h.phone()).z < openingTruckPose(phone).z);
  assert.equal(h.sandbox.life.film.state!.completed.includes(scene.id), false);
  h.retry();
  assert.deepEqual(h.phone(), { phase: 'running', remaining: 15, lastTick: 0, attempts: 1 });
  assert.deepEqual(h.caller.position, filmEntry(scene)); assert.equal(h.caller.currentAction, null);
});

test('Wells: an old save inside the cabinet recovers a nearby standable position', () => {
  const h = setup(0, -30.08, 11);
  assert.ok(!playerBlocked(h.caller.position, true, 1.1, h.sandbox.state.structures));
  const gap = Math.hypot(h.caller.position.x - set.center.x, h.caller.position.z - set.center.z + 30.08);
  assert.ok(gap > .8 && gap < 3, 'recovery leaves the solid without restarting the scene');
  assert.equal(h.phone().remaining, 11); assert.equal(h.sandbox.life.film.state!.step, 1);
});

test('Wells: the truck can finish its approach without running over the fallen caller again', () => {
  const h = setup(3.8, -8.4);
  for (let i = 0; i < 250 && h.phone().impactElapsed !== 1.35; i++) {
    h.frame();
    if (h.phone().hit?.elapsed !== OPENING_PHONE.hitSeconds) continue;
    assert.equal(playerBlocked(h.caller.position, true, 1.1, h.sandbox.state.structures), false,
      `the fallen caller is obstructed with ${h.phone().remaining}s left and impact at ${h.phone().impactElapsed}s`);
  }
  assert.equal(h.phone().impactElapsed, 1.35); assert.equal(h.phone().phase, 'failed');
});

test('Wells: a free hit has a deterministic animation clock and lands from a jump', () => {
  const hit: OpeningPhoneHit = { elapsed: .45, at: 0, origin: { x: 0, y: 1.2, z: 0 }, yaw: Math.PI, direction: { x: -1, z: 0 }, landingY: 0 };
  const input = { openingHit: hit, speed: 8, grounded: false, verticalVelocity: 1, turn: .5 };
  const motion = newMotion();
  advanceMotion(motion, input, .016);
  assert.equal(motion.time, hit.elapsed); assert.equal(motion.speed, 0);
  assert.equal(openingHitPose({ ...hit, elapsed: OPENING_PHONE.hitSeconds }).y, 0);
});

test('Wells: older saved pickup reactions retain their original resting height', () => {
  const hit: OpeningPhoneHit = { elapsed: OPENING_PHONE.hitSeconds, at: .4, origin: { x: 0, y: .08, z: -28.85 }, yaw: Math.PI, direction: { x: -1, z: 0 } };
  assert.equal(openingHitPose(hit).y, hit.origin.y);
});
