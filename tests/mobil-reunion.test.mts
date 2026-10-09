import assert from 'node:assert/strict';
import test from 'node:test';
import { filmPosition, type WorldEvent } from '@auto_matrix/shared';
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
  players.possess('reunion-player', 'neo', 0); const actor = world.agents.get('neo')!;
  sandbox.life.begin(actor, 0); sandbox.state.neoLife!.chapter = 1; let tick = 0;
  const command = (target: string) => { world.simulationTick = ++tick; return players.sandboxAction('reunion-player', { kind: 'life', target: `film:${target}` }, tick); };
  command('continue'); const journey = sandbox.life.film.state!;
  Object.assign(journey, { scene: 'm3_mobil_release', actor: 'neo', step: 0,
    mobil: { phase: 'approaching', elapsed: 0, lastTick: tick, loops: 0 } });
  actor.position = filmPosition('film_mobil_station', 0, -22); actor.currentLocation = 'film_mobil_station';
  actor.health = 61; world.agents.get('trinity')!.health = 43;
  sandbox.life.film.reconcileCast();
  const frame = (seconds: number, running = true) => { for (let i = 0; i < Math.ceil(seconds * 20); i++) players.step(.05, running, tick); };
  const advance = () => { world.simulationTick = ++tick; sandbox.tick(tick); };
  return { world, sandbox, players, actor, journey, command, frame, advance, tick: () => tick };
}

test('the rescue train moves between slow ticks and cannot skip Trinity crossing the open doorway', () => {
  const h = setup(); h.frame(.25);
  assert.ok(h.journey.mobil!.elapsed >= .24, 'the arriving rescue needs the continuous saved clock');
  h.frame(4.3); h.advance();
  assert.equal(h.journey.mobil!.phase, 'stopped');
  assert.equal(h.journey.step, 0, 'a stopped train is not a reunion while Trinity is still inside');
  assert.equal(h.journey.started, undefined);
  const trinity = h.world.agents.get('trinity')!;
  assert.ok(trinity.position.x > filmPosition('film_mobil_station', 7.55, 0).x);
  h.command('act');
  assert.equal(h.journey.step, 0, 'G cannot replace the doorway and approach');
});

test('Trinity physically reaches Neo before an explicit reunion, and waiting does not complete the embrace', () => {
  const h = setup(); h.frame(9); h.advance();
  const trinity = h.world.agents.get('trinity')!;
  assert.ok(Math.hypot(trinity.position.x - h.actor.position.x, trinity.position.z - h.actor.position.z) < 2.8);
  assert.equal(h.journey.step, 1);
  assert.equal(h.journey.mobil!.reunion?.phase, 'ready');
  h.frame(8); h.advance();
  assert.equal(h.journey.mobil!.reunion?.phase, 'ready');
  assert.equal(h.journey.step, 1, 'waiting must not invent the player accepting her embrace');
  h.command('act'); h.frame(.4);
  assert.equal(h.journey.mobil!.reunion?.phase, 'embracing');
  assert.equal(h.journey.started, undefined, 'the actual saved action replaces the generic subtitle timer');
});

test('Trinity can reunite with Neo at his actual platform position instead of a hidden fixed waypoint', () => {
  const h = setup(); h.actor.position = filmPosition('film_mobil_station', 0, 20);
  const position = { ...h.actor.position }; h.frame(20); h.advance();
  assert.equal(h.journey.mobil!.reunion?.phase, 'ready');
  assert.equal(h.journey.step, 1, 'the arriving partner, not the old -22 marker, unlocks the greeting');
  assert.deepEqual(h.actor.position, position, 'waiting does not teleport Neo down the platform');
  h.command('act'); assert.equal(h.journey.mobil!.reunion?.phase, 'embracing');
});

test('a reunion freezes on pause, release, occupation or a missing partner without healing or reviving', () => {
  const h = setup(); h.frame(9); h.advance(); h.command('act'); h.frame(.4);
  const saved = structuredClone(h.journey.mobil), trinity = h.world.agents.get('trinity')!;
  h.frame(1, false); assert.deepEqual(h.journey.mobil, saved);
  h.players.release('reunion-player', h.tick()); h.frame(1); assert.deepEqual(h.journey.mobil, saved);
  h.players.possess('reunion-player', 'neo', h.tick());
  trinity.controller = 'other-player'; const position = { ...trinity.position }; h.frame(1);
  assert.deepEqual(trinity.position, position); assert.equal(h.journey.mobil!.reunion?.elapsed, saved!.reunion!.elapsed);
  trinity.controller = null; trinity.status = 'dead'; trinity.health = 0; h.frame(1); h.command('act');
  assert.equal(trinity.status, 'dead'); assert.equal(trinity.health, 0);
  assert.equal(h.journey.step, 1); assert.equal(h.journey.mobil!.reunion?.elapsed, saved!.reunion!.elapsed);
  assert.equal(h.actor.health, 61);
});

test('a saved embrace resumes its contact roots and only the subsequent player action leaves the station', () => {
  const h = setup(); h.frame(9); h.advance(); h.command('act'); h.frame(1.1);
  const saved = structuredClone(h.journey.mobil), neo = { ...h.actor.position }, trinity = { ...h.world.agents.get('trinity')!.position };
  h.players.release('reunion-player', h.tick()); h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  assert.deepEqual(h.actor.currentAction?.parameters.mobilReunion, { role: 'neo', reunion: saved!.reunion },
    'the paused observer and cold save must retain Neo embracing before possession');
  assert.deepEqual(h.world.agents.get('trinity')!.currentAction?.parameters.mobilReunion,
    { role: 'trinity', reunion: saved!.reunion });
  h.players.possess('reunion-player', 'neo', h.tick());
  const current = h.sandbox.life.film.state!;
  assert.deepEqual(current.mobil, saved); assert.deepEqual(h.actor.position, neo);
  assert.deepEqual(h.world.agents.get('trinity')!.position, trinity);
  h.frame(9); h.advance();
  assert.equal(current.mobil!.reunion?.phase, 'together'); assert.equal(current.step, 1);
  assert.equal(h.actor.health, 61); assert.equal(h.world.agents.get('trinity')!.health, 43);
  h.command('act'); assert.equal(current.step, 2);
});

test('returning from Mobil to the Oracle preserves Neo health and depleted medical supplies', () => {
  const h = setup(); h.frame(9); h.advance(); h.command('act'); h.frame(7); h.command('act');
  h.sandbox.state.profiles.neo.inventory.medkit = 0;
  h.command('next');
  assert.equal(h.journey.scene, 'm3_oracle_last');
  assert.equal(h.actor.health, 61, 'the cut back to the Matrix is not medical treatment');
  assert.equal(h.sandbox.state.profiles.neo.inventory.medkit, 0, 'a new set must not award replacement medicine');
  assert.equal(h.world.agents.get('trinity')!.health, 43);
});

test('the next Oracle visit waits for a living, unoccupied cast instead of silently rebuilding them', () => {
  for (const blocked of ['dead', 'owned']) {
    const h = setup(); h.frame(9); h.advance(); h.command('act'); h.frame(7); h.command('act');
    const oracle = h.world.agents.get('oracle')!;
    if (blocked === 'dead') { oracle.status = 'dead'; oracle.health = 0; }
    else oracle.controller = 'other-player';
    const position = { ...oracle.position }; h.command('next');
    assert.equal(h.journey.scene, 'm3_mobil_release', blocked);
    assert.deepEqual(oracle.position, position); assert.equal(h.actor.health, 61);
    assert.equal(oracle.status, blocked === 'dead' ? 'dead' : 'alive');
  }
});
