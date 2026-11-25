import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SCENE_BY_ID, filmPosition, filmStepPosition, garageCarPose, garageRiderPose, newGarageEscape, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';
import { rideForPlayer } from '../packages/client/src/engine/Engine.js';

function setup() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const conversations = { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine;
  const players = new PlayerController(world, conversations, { execute() {} } as unknown as ActionExecutor, dynamics, sandbox);
  let tick = 1, sequence = 0;
  players.possess('p', 'neo', tick); sandbox.life.begin(world.agents.get('neo')!, tick); sandbox.state.neoLife!.chapter = 1;
  players.sandboxAction('p', { kind: 'life', target: 'film:start' }, tick);
  const scene = FILM_SCENE_BY_ID.m2_garage, state = sandbox.life.film.state!;
  Object.assign(state, { scene: scene.id, actor: scene.actor, step: 1 });
  const actor = world.agents.get('trinity')!;
  actor.position = filmStepPosition(scene, scene.steps[1]); actor.currentLocation = scene.set; actor.isInMatrix = true; state.checkpoint = { ...actor.position };
  world.agents.get('keymaker')!.health = 40;
  players.possess('p', 'trinity', tick);
  const command = (target: string) => players.sandboxAction('p', { kind: 'life', target: `film:${target}` }, ++tick);
  command('act'); Object.assign(state.garage!, { z: -39.8, speed: 20, elapsed: 4, twins: 3 });
  const frames = (seconds: number, running = true) => {
    for (let i = 0; i < Math.ceil(seconds / .05); i++) {
      players.receiveInput('p', { x: 0, z: -1, yaw: Math.PI, sequence: ++sequence, location: scene.set, drive: { throttle: 1, steer: 1, brake: false } });
      players.step(.05, running, ++tick); if (running) sandbox.tick(tick);
    }
  };
  return { world, sandbox, players, actor, scene, state, frames, command, tick: () => tick };
}

test('garage arrival keeps the driver and companions seated despite held movement until explicit handoff', () => {
  const h = setup(); h.frames(.05);
  assert.equal(h.state.garage?.phase, 'arrived'); assert.equal(h.state.step, 2);
  const arrived = structuredClone(h.state.garage);
  h.frames(1);
  assert.deepEqual(h.state.garage, arrived, 'holding W/D at the exit cannot move or damage the car or advance its clock');
  for (const role of ['trinity', 'morpheus', 'keymaker'] as const) {
    const member = h.world.agents.get(role)!, seat = garageRiderPose(garageCarPose(arrived!), role);
    assert.deepEqual(member.position, filmPosition(h.scene.set, seat.x, seat.z), `${role} cannot walk inside the car`);
    assert.equal(member.rotation, seat.yaw); assert.equal(member.currentAction?.parameters.seated, true);
    assert.equal(Math.hypot(member.velocity.x, member.velocity.y, member.velocity.z), 0);
  }
  assert.equal(h.world.agents.get('keymaker')!.health, 40);
  h.command('next'); assert.equal(h.state.scene, 'm2_freeway'); assert.equal(h.state.garage, undefined);
});

test('the client retains the garage car at arrival, with no ride after failure or for an unrelated player', () => {
  const h = setup(); h.frames(.05);
  assert.equal(rideForPlayer(h.state, 'trinity'), h.state.garage);
  assert.equal(rideForPlayer(h.state, 'neo'), undefined);
  assert.equal(rideForPlayer({ ...h.state, visiting: 'm2_garage' }, 'trinity'), undefined);
  assert.equal(rideForPlayer({ ...h.state, garage: { ...newGarageEscape(), phase: 'wrecked' } }, 'trinity'), undefined);
});

test('a legacy arrived foot pose returns to its saved driver seat without replaying the escape or healing the passenger', () => {
  const h = setup(); h.frames(.05);
  const escape = structuredClone(h.state.garage), beforeStep = h.state.step, completed = [...h.state.completed];
  const seat = garageRiderPose(garageCarPose(escape!), 'trinity');
  h.actor.position = filmPosition(h.scene.set, seat.x, seat.z - 1.6);
  h.actor.currentAction = { type: 'idle', parameters: { player: true, resolved: true }, startedAt: h.tick(), duration: 1, progress: 0 };
  const actionTick = h.actor.currentAction.startedAt;
  assert.equal(h.sandbox.life.film.restoreGaragePose(h.actor, h.tick()), true);
  assert.deepEqual(h.actor.position, filmPosition(h.scene.set, seat.x, seat.z));
  assert.equal(h.actor.currentAction?.parameters.seated, true); assert.equal(h.actor.currentAction?.startedAt, actionTick);
  assert.deepEqual(h.state.garage, escape); assert.equal(h.state.step, beforeStep); assert.deepEqual(h.state.completed, completed);
  const saved = structuredClone(h.sandbox.state);
  h.players.setRunning(false); h.players.release('p', h.tick()); h.sandbox.restore(saved); h.players.possess('p', 'trinity', h.tick());
  h.frames(1, false); assert.deepEqual(h.sandbox.life.film.state!.garage, escape);
  h.frames(1); assert.deepEqual(h.actor.position, filmPosition(h.scene.set, seat.x, seat.z));
  assert.equal(h.world.agents.get('keymaker')!.health, 40);
});
