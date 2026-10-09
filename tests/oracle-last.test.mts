import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SCENE_BY_ID, filmPosition, filmReflections, newOracleLast, oracleLastLines, type WorldEvent } from '@auto_matrix/shared';
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
  players.possess('oracle-player', 'neo', 0); const actor = world.agents.get('neo')!;
  sandbox.life.begin(actor, 0); sandbox.state.neoLife!.chapter = 1; let tick = 0;
  const command = (target: string) => players.sandboxAction('oracle-player', { kind: 'life', target: `film:${target}` }, ++tick);
  command('continue'); const journey = () => sandbox.life.film.state!;
  Object.assign(journey(), { scene: 'm3_mobil_release', actor: 'neo', step: 2 });
  actor.health = 61; sandbox.state.profiles.neo.inventory.medkit = 0;
  command('next');
  const frame = (seconds: number, running = true) => { for (let i = 0; i < Math.ceil(seconds * 20); i++) players.step(.05, running, tick); };
  const kitchen = () => { actor.position = filmPosition('film_oracle_home', 0, -10); frame(.1); };
  const question = () => { const step = FILM_SCENE_BY_ID.m3_oracle_last.steps[journey().step]; actor.position = filmPosition('film_oracle_home', step.x, step.z); };
  return { world, sandbox, players, actor, journey, command, frame, kitchen, question, tick: () => tick };
}

test('Neo entering the kitchen begins a saved welcome instead of skipping Sati and the Oracle’s preparation', () => {
  const h = setup(); h.frame(10); assert.equal(h.journey().step, 0);
  h.kitchen(); h.frame(1);
  assert.equal(h.journey().step, 0, 'crossing the marker cannot finish the welcome');
  assert.equal(h.journey().oracleLast?.phase, 'greeting');
  assert.equal(h.journey().started, undefined);
  h.frame(30); assert.equal(h.journey().step, 1);
  assert.equal(h.journey().oracleLast?.phase, 'ready');
  const sati = h.world.agents.get('sati')!;
  assert.ok(sati.position.z > filmPosition('film_oracle_home', 0, 2).z, 'Sati physically leaves the kitchen');
  assert.equal(h.actor.health, 61); assert.equal(h.sandbox.state.profiles.neo.inventory.medkit, 0);
});

test('questions require G, run on player frames, and do not unlock a reflection while the answer is still being heard', () => {
  const h = setup(); h.kitchen(); h.frame(30); h.question(); h.frame(40);
  assert.equal(h.journey().step, 1); h.command('act'); h.frame(1);
  assert.equal(h.journey().oracleLast?.phase, 'answering');
  assert.equal(h.journey().started, undefined);
  for (let i = 0; i < 100; i++) h.sandbox.tick(i + 1 + h.tick());
  assert.equal(h.journey().step, 1, 'slow ticks cannot fast-forward the conversation');
  h.command('next'); h.command('reflect:care'); assert.equal(h.journey().step, 1);
  h.frame(40); assert.equal(h.journey().step, 2); h.frame(40); assert.equal(h.journey().step, 2);
  h.command('act'); h.frame(1); h.command('reflect:care'); assert.equal(h.journey().step, 2);
  h.frame(40); assert.equal(h.journey().step, 3);
});

test('pause, release, ownership and death freeze the exact physical meeting without taking or reviving a cast member', () => {
  const h = setup(); h.kitchen(); h.frame(9.6);
  const state = structuredClone(h.journey().oracleLast), oracle = h.world.agents.get('oracle')!;
  assert.ok(state, 'the kitchen needs a saved action, not just a timer');
  oracle.health = 47; const positions = ['neo', 'sati', 'oracle', 'seraph'].map(id => ({ ...h.world.agents.get(id)!.position }));
  h.frame(5, false); assert.deepEqual(h.journey().oracleLast, state);
  h.players.release('oracle-player', h.tick()); h.frame(5); assert.deepEqual(h.journey().oracleLast, state);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); h.players.possess('oracle-player', 'neo', h.tick());
  assert.deepEqual(JSON.parse(JSON.stringify(h.journey().oracleLast)), JSON.parse(JSON.stringify(state)));
  assert.deepEqual(['neo', 'sati', 'oracle', 'seraph'].map(id => h.world.agents.get(id)!.position), positions);
  oracle.controller = 'other-player'; h.frame(5);
  assert.equal(h.journey().oracleLast!.arrival, state!.arrival); assert.deepEqual(oracle.position, positions[2]);
  assert.equal(oracle.controller, 'other-player'); assert.equal(oracle.health, 47);
  oracle.controller = null; oracle.status = 'dead'; oracle.health = 0; h.frame(5);
  h.command('retry'); assert.equal(oracle.status, 'dead'); assert.equal(oracle.health, 0);
  assert.equal(h.journey().oracleLast!.arrival, state!.arrival); assert.equal(h.actor.health, 61);
});

test('the philosophical reply is spoken before departure, and repeated choices cannot duplicate the journal or rewards', () => {
  const h = setup(); h.kitchen(); h.frame(30); h.question(); h.command('act'); h.frame(40);
  h.command('act'); h.frame(40); const choice = filmReflections('m3_oracle_last')[0];
  const before = h.sandbox.state.neoLife!.philosophy[choice.id]; h.command(`reflect:${choice.id}`);
  assert.equal(h.journey().step, 3, 'choosing must not instantly send the player away');
  assert.equal(h.journey().oracleLast?.phase, 'responding');
  h.command(`reflect:${choice.id}`); assert.equal(h.sandbox.state.neoLife!.philosophy[choice.id], before + 1);
  h.frame(6); assert.equal(h.journey().step, 4);
  h.frame(20); assert.equal(h.journey().step, 4, 'Neo must physically leave');
  h.actor.position = filmPosition('film_oracle_home', 0, 18); h.frame(.1);
  assert.equal(h.journey().step, 5); assert.equal(h.journey().oracleLast?.phase, 'done');
  assert.ok(h.journey().completed.includes('m3_oracle_last'));
});

test('a dead Neo may explicitly retry his own saved meeting position, preserving answers, medicine and everybody else’s injuries', () => {
  const h = setup(); h.kitchen(); h.frame(30); h.question(); h.command('act'); h.frame(3);
  const saved = structuredClone(h.journey().oracleLast), position = { ...h.actor.position };
  const oracle = h.world.agents.get('oracle')!; oracle.health = 47;
  h.actor.status = 'dead'; h.actor.health = 0; h.frame(5); h.command('retry');
  assert.equal(h.actor.status, 'alive'); assert.equal(h.actor.health, 61);
  assert.deepEqual(h.actor.position, position); assert.equal(h.journey().oracleLast?.elapsed, saved?.elapsed);
  assert.equal(oracle.health, 47); assert.equal(h.sandbox.state.profiles.neo.inventory.medkit, 0);
});

test('the Oracle recalls only recorded choices, including the recent Mobil family reflection', () => {
  const missing = oracleLastLines(newOracleLast(1, 61), 1).join('\n');
  assert.doesNotMatch(missing, /你以前|你曾/, 'a partial real save cannot acquire invented philosophical memories');
  const h = setup(), life = h.sandbox.state.neoLife!;
  life.choices.oracle_first = 'rescue'; life.choices['m3_family:1'] = 'care'; delete h.journey().oracleLast;
  const choices = structuredClone(life.choices); h.frame(.1);
  assert.equal(h.journey().oracleLast?.first, 'rescue'); assert.equal(h.journey().oracleLast?.second, 'care');
  const remembered = oracleLastLines(h.journey().oracleLast!, 1).join('\n');
  assert.match(remembered, /救了他/); assert.match(remembered, /保护别人/);
  assert.deepEqual(life.choices, choices, 'reading a past choice cannot write new history');
});
