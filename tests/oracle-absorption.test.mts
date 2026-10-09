import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SCENE_BY_ID, filmPosition, filmStepPosition, filmReflections, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

function setup() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const conversations = { interrupt() {}, isAgentInConversation: () => false, startConversation: () => false } as unknown as ConversationEngine;
  const players = new PlayerController(world, conversations, { execute() {} } as unknown as ActionExecutor, dynamics, sandbox);
  players.possess('oracle-player', 'neo', 0); const neo = world.agents.get('neo')!;
  sandbox.life.begin(neo, 0); sandbox.state.neoLife!.chapter = 1; let tick = 0;
  const command = (target: string) => players.sandboxAction('oracle-player', { kind: 'life', target: `film:${target}` }, ++tick);
  command('continue'); const journey = () => sandbox.life.film.state!;
  Object.assign(journey(), { scene: 'm3_oracle_last', actor: 'neo', step: 5 });
  neo.currentLocation = 'film_oracle_home'; neo.isInMatrix = true; neo.position = filmPosition('film_oracle_home', 0, 18); neo.health = 63;
  for (const id of ['oracle', 'sati', 'seraph', 'smith']) {
    world.agents.get(id)!.health = 47;
    sandbox.state.profiles[id] ??= structuredClone(sandbox.state.profiles.neo);
    sandbox.state.profiles[id].inventory.medkit = 0;
  }
  command('next'); const actor = () => world.agents.get(journey().actor)!;
  const frame = (seconds: number, running = true, focus = false) => {
    for (let i = 0; i < Math.ceil(seconds * 20); i++) {
      players.receiveInput('oracle-player', { x: 0, z: 0, yaw: actor().rotation, jump: false, sprint: false, focus, sequence: ++tick });
      players.step(.05, running, tick);
    }
  };
  const local = () => { actor().position = filmStepPosition(FILM_SCENE_BY_ID.m3_oracle_absorbed, FILM_SCENE_BY_ID.m3_oracle_absorbed.steps[journey().step]); };
  return { world, sandbox, players, journey, actor, command, frame, local, tick: () => tick };
}

test('the Oracle perspective preserves incoming injuries and medicine, with a saved physical farewell', () => {
  const h = setup();
  assert.equal(h.world.agents.get('neo')!.currentLocation, 'film_hammer_deck', 'the departed Neo cannot remain visible behind the Oracle farewell');
  assert.equal(h.world.agents.get('neo')!.isInMatrix, false); assert.equal(h.world.agents.get('neo')!.health, 63);
  for (const id of ['oracle', 'sati', 'seraph', 'smith']) {
    assert.equal(h.world.agents.get(id)!.health, 47, `${id} must not be healed on a film cut`);
    assert.equal(h.sandbox.state.profiles[id].inventory.medkit, 0);
  }
  h.local(); h.command('act'); h.frame(2);
  assert.equal(h.journey().step, 0, 'farewell cannot be replaced by the old 1.5-second marker');
  assert.equal(h.journey().oracleAbsorption?.phase, 'farewell');
  assert.equal(h.journey().started, undefined);
  h.frame(15); assert.equal(h.journey().step, 1);
});

test('the farewell clock stops on pause, release, occupied cast and restore without moving or healing the occupied character', () => {
  const h = setup(); h.local(); h.command('act'); h.frame(3);
  const saved = JSON.parse(JSON.stringify(h.journey().oracleAbsorption));
  assert.ok(saved, 'there must be a saved action clock');
  h.frame(4, false); assert.deepEqual(JSON.parse(JSON.stringify(h.journey().oracleAbsorption)), saved);
  h.players.release('oracle-player', h.tick()); h.frame(4);
  assert.deepEqual(JSON.parse(JSON.stringify(h.journey().oracleAbsorption)), saved);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); h.players.possess('oracle-player', 'oracle', h.tick());
  assert.deepEqual(JSON.parse(JSON.stringify(h.journey().oracleAbsorption)), saved);
  const sati = h.world.agents.get('sati')!; sati.controller = 'other'; const position = { ...sati.position };
  h.frame(4); assert.equal(h.journey().oracleAbsorption!.elapsed, saved.elapsed);
  assert.deepEqual(sati.position, position); assert.equal(sati.health, 47); assert.equal(sati.controller, 'other');
  sati.controller = null; sati.status = 'dead'; sati.health = 0; h.frame(4); h.command('retry');
  assert.equal(sati.status, 'dead'); assert.equal(sati.health, 0); assert.equal(h.journey().oracleAbsorption!.elapsed, saved.elapsed);
});

test('reflection cannot skip the retreat, and the kitchen invasion requires an explicit sustained choice before assimilation', () => {
  const h = setup(); h.local(); h.command('reflect:care'); assert.equal(h.journey().step, 0);
  h.command('act'); h.frame(16); h.local(); h.command('act'); h.frame(3);
  h.command('reflect:care'); assert.equal(h.journey().step, 1);
  h.frame(40); assert.equal(h.journey().step, 2);
  const choice = filmReflections('m3_oracle_absorbed')[0], before = h.sandbox.state.neoLife!.philosophy[choice.id];
  h.local(); h.command(`reflect:${choice.id}`); h.command(`reflect:${choice.id}`);
  assert.equal(h.sandbox.state.neoLife!.philosophy[choice.id], before + 1);
  assert.equal(h.journey().step, 3); h.command('act'); h.frame(50);
  assert.equal(h.journey().oracleAbsorption?.phase, 'consent');
  assert.equal(h.journey().step, 3); assert.equal(h.actor().status, 'alive');
  h.frame(.7, true, true); const held = h.journey().oracleAbsorption!.held;
  h.frame(2); assert.equal(h.journey().oracleAbsorption!.held, held, 'released input preserves the explicit choice');
  h.frame(2, true, true); h.frame(15);
  assert.equal(h.journey().step, 4); assert.equal(h.journey().oracleAbsorption?.phase, 'done');
  assert.ok(h.journey().completed.includes('m3_oracle_absorbed'));
  for (const id of ['oracle', 'sati', 'seraph']) assert.equal(h.world.agents.get(id)!.status, 'disconnected', id);
  assert.equal(h.journey().reflections['m3_oracle_absorbed:2'], choice.id);
  assert.match(h.sandbox.state.neoLife!.journal[0].text, /不是 Neo/);
  h.players.release('oracle-player', h.tick());
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  assert.equal(h.players.possess('oracle-player', 'oracle', h.tick()).agentId, 'oracle');
  assert.equal(h.actor().status, 'disconnected', 'cold reconnect cannot resurrect the assimilated viewpoint');
  assert.equal(h.actor().health, 0);
  h.command('next'); assert.equal(h.journey().scene, 'm3_bane_questions');
  assert.equal(h.world.agents.get('oracle')!.status, 'disconnected');
});
