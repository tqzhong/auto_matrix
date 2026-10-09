import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SCENE_BY_ID, filmPosition, type WorldEvent } from '@auto_matrix/shared';
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
  players.possess('family-player', 'neo', 0); const actor = world.agents.get('neo')!;
  sandbox.life.begin(actor, 0); sandbox.state.neoLife!.chapter = 1;
  let tick = 0;
  const command = (target: string) => players.sandboxAction('family-player', { kind: 'life', target: `film:${target}` }, ++tick);
  command('continue');
  const journey = sandbox.life.film.state!;
  Object.assign(journey, { scene: 'm3_mobil', actor: 'neo', step: FILM_SCENE_BY_ID.m3_mobil.steps.length,
    mobil: { phase: 'waiting', elapsed: 0, lastTick: tick, loops: 0 } });
  command('next');
  actor.position = filmPosition('film_mobil_station', -7, -8); sandbox.tick(++tick);
  const frame = (seconds: number, running = true) => { for (let i = 0; i < Math.ceil(seconds * 20); i++) players.step(.05, running, tick); };
  return { world, sandbox, players, actor, journey, command, frame, tick: () => tick };
}

test('Neo cannot skip the family conversation by recording a philosophy answer at the old reflection checkpoint', () => {
  const h = setup(); assert.equal(h.journey.scene, 'm3_family'); assert.equal(h.journey.step, 1);
  const care = h.sandbox.state.neoLife!.philosophy.care;
  h.command('reflect:care');
  assert.equal(h.journey.step, 1, 'identity, purpose, love and parting must be heard before the reflection');
  assert.equal(h.journey.reflections['m3_family:1'], undefined);
  assert.equal(h.sandbox.state.neoLife!.philosophy.care, care);
});

test('four deliberate questions precede the existing reflection, and repeating a heard topic does not award it twice', () => {
  const h = setup();
  for (const topic of ['identity', 'purpose', 'connection', 'parting']) {
    h.command(`family:ask:${topic}`);
    const family = h.journey.mobil!.family!;
    assert.ok(family, 'the family conversation requires saved state'); assert.equal(family.phase, 'hearing');
    h.command('reflect:trust'); assert.equal(h.journey.step, 1);
    h.frame(18);
    assert.ok(family.answered.includes(topic)); assert.equal(h.journey.step, 1);
  }
  const family = h.journey.mobil!.family!;
  assert.equal(family.phase, 'reflection'); assert.equal(family.answered.length, 4);
  h.command('family:ask:identity'); assert.equal(family.answered.length, 4); assert.equal(family.phase, 'reflection');
  h.command('reflect:care'); h.frame(.05, false);
  assert.equal(h.journey.step, 2); assert.equal(h.journey.reflections['m3_family:1'], 'care');
  h.command('next'); assert.equal(h.journey.scene, 'm3_trainman'); assert.equal(h.journey.mobil!.phase, 'waiting');
});

test('a question requires Neo to approach the family, and the saved reply freezes during pause, release and occupied cast', () => {
  const h = setup(); h.actor.position = filmPosition('film_mobil_station', 0, 20);
  h.command('family:ask:purpose');
  assert.notEqual(h.journey.mobil!.family!?.phase, 'hearing');
  h.actor.position = filmPosition('film_mobil_station', -7, -8); h.command('family:ask:purpose'); h.frame(1);
  const family = h.journey.mobil!.family!; assert.equal(family.phase, 'hearing');
  const age = family.elapsed;
  h.frame(2, false); assert.equal(family.elapsed, age);
  const rama = h.world.agents.get('rama_kandra')!, savedRama = structuredClone(rama.position);
  rama.controller = 'other-player'; h.frame(2);
  assert.equal(family.elapsed, age); assert.deepEqual(rama.position, savedRama);
  rama.controller = null; h.players.release('family-player', h.tick()); h.frame(2);
  assert.equal(family.elapsed, age);
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)); h.sandbox.restore(saved);
  h.players.possess('family-player', 'neo', h.tick());
  assert.equal(h.sandbox.life.film.state!.mobil!.family!.elapsed, age);
  h.frame(18); assert.deepEqual(h.sandbox.life.film.state!.mobil!.family!.answered, ['purpose']);
});

test('dead family members cannot be silently revived to finish their answers', () => {
  const h = setup(), kamala = h.world.agents.get('kamala')!;
  kamala.status = 'dead'; kamala.health = 0; const before = structuredClone(kamala);
  h.command('family:ask:identity'); h.frame(18); h.command('reflect:care');
  assert.deepEqual(kamala, before); assert.equal(h.journey.step, 1);
});
