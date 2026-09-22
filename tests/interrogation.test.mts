import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SCENE_BY_ID, filmStepPosition, filmPosition, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

function setup() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (e: Omit<WorldEvent, 'id'>) => world.addWorldEvent(e) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const players = new PlayerController(world, { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine, {} as ActionExecutor, dynamics, sandbox);
  players.possess('player', 'neo', 0); const neo = world.agents.get('neo')!; sandbox.life.begin(neo, 0);
  const scene = FILM_SCENE_BY_ID.m1_interrogation;
  sandbox.state.neoLife!.journey = { version: 1, scene: scene.id, actor: 'neo', step: 0, completed: [], enteredAt: 0, reflections: {}, lastText: '', checkpoint: filmStepPosition(scene, scene.steps[0]),
    office: { alert: 100, suspicion: [], waypoints: [], lastTick: 0, guide: '', outcome: 'captured', bugged: false } };
  let tick = 0;
  const command = (target: string) => players.sandboxAction('player', { kind: 'life', target: `film:${target}` }, ++tick);
  const frames = (seconds: number, running = true) => { for (let i = 0; i < Math.round(seconds / .05); i++) { players.step(.05, running, tick); if (running && i % 10 === 0) sandbox.tick(++tick); } };
  command('retry');
  const review = () => { command('act'); frames(7); };
  return { world, sandbox, players, neo, command, frames, review, state: () => sandbox.life.film.state!, tick: () => tick };
}

test('reviewing the dossier is a seated encounter; waiting does not choose Neo’s response or implant the device', () => {
  const h = setup(); h.command('act');
  assert.ok(h.neo.currentAction?.parameters.interrogation, 'the first interaction must start the physical encounter');
  h.frames(7); assert.equal(h.state().step, 1);
  h.frames(20); assert.equal(h.state().step, 1); assert.equal(h.state().office?.bugged, false);
  h.command('act'); h.frames(3);
  assert.equal(h.state().step, 1); assert.equal(h.state().office?.bugged, false, 'the tracker only exists after it reaches Neo');
  h.command('act'); h.frames(24);
  assert.equal(h.state().step, 2); assert.equal(h.state().office?.bugged, true);
  assert.equal(h.state().completed.filter(id => id === 'm1_interrogation').length, 1);
  h.command('next'); assert.equal(h.state().scene, 'm1_wake_again');
  assert.equal(h.neo.currentAction?.parameters.interrogation, undefined);
  assert.equal(h.state().office?.bugged, true, 'leaving the room must not erase the implanted tracker');
});

test('all four interrogation poses survive pause, disconnection, save restore and retry', () => {
  const h = setup(); h.review(); h.command('act'); h.frames(9.25);
  const actors = () => ['neo', 'smith', 'agent_jones', 'agent_brown'].map(id => {
    const actor = h.world.agents.get(id)!;
    return { position: { ...actor.position }, rotation: actor.rotation, gesture: structuredClone(actor.currentAction?.parameters.interrogation) };
  });
  const before = actors(); assert.ok(before.every(actor => actor.gesture));
  h.frames(2, false); assert.deepEqual(actors(), before);
  h.players.release('player', h.tick()); h.frames(2); assert.deepEqual(actors(), before);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  h.players.possess('player', 'neo', h.tick()); assert.deepEqual(actors(), before);
  h.command('retry'); assert.deepEqual(actors(), before);
  h.frames(18); assert.equal(h.state().step, 2);
});

test('the encounter reserves its agents and rejects movement, attacks and remote activation', () => {
  const h = setup(); const start = { ...h.neo.position };
  h.neo.position = filmPosition('film_anderson_flat'); h.command('act');
  assert.equal(h.neo.currentAction?.parameters.interrogation, undefined);
  h.neo.position = start; h.neo.isInMatrix = false; h.command('act');
  assert.equal(h.neo.currentAction?.parameters.interrogation, undefined);
  h.neo.isInMatrix = true; h.review(); const position = { ...h.neo.position };
  for (const id of ['smith', 'agent_jones', 'agent_brown']) assert.match(h.players.possess('other', id, h.tick()).error!, /审讯/);
  h.players.receiveInput('player', { x: 1, z: 1, yaw: 0, jump: true, sprint: true, sequence: 1 });
  assert.match(h.players.act('player', 'attack', h.tick()), /演出/);
  h.frames(1); assert.deepEqual(h.neo.position, position);
});

test('an already occupied agent is never taken over to start the interrogation', () => {
  const h = setup(); h.players.possess('other', 'agent_jones', h.tick());
  const agent = h.world.agents.get('agent_jones')!; const position = { ...agent.position };
  assert.match(h.command('act'), /另一位玩家/);
  h.frames(10); assert.deepEqual(agent.position, position);
  assert.equal(h.neo.currentAction?.parameters.interrogation, undefined);
});
