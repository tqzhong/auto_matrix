import assert from 'node:assert/strict';
import test from 'node:test';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import { FILM_SCENE_BY_ID, FILM_SCENES, TRINITY_RELAY, filmEntry, filmStepPosition, type WorldEvent } from '@auto_matrix/shared';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

function setup() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const conversations = { interrupt() {}, isAgentInConversation: () => false, startConversation: () => false } as unknown as ConversationEngine;
  const players = new PlayerController(world, conversations, { execute() {} } as unknown as ActionExecutor, dynamics, sandbox);
  players.possess('relay-player', 'neo', 0); sandbox.life.begin(world.agents.get('neo')!, 0); sandbox.state.neoLife!.chapter = 1;
  let tick = 0;
  const command = (target: string) => players.sandboxAction('relay-player', { kind: 'life', target: `film:${target}` }, ++tick);
  command('continue'); const journey = sandbox.life.film.state!;
  Object.assign(journey, { scene: 'm2_blackout', actor: 'niobe', step: 1,
    primaryDemolition: { phase: 'done', installed: ['west', 'east', 'clock'], elapsed: 0, remaining: 20, attempts: 1, blast: { phase: 'done', elapsed: 8 } },
    grid: { primary: 'off', emergency: 'online', vigilant: 'lost', trinity: 'waiting', phase: 'emergency', remaining: 314, lastTick: tick, reroute: 0, attempts: 0 } });
  players.possess('relay-player', 'niobe', tick); const actor = players.getAgent('relay-player')!;
  actor.position = filmEntry(FILM_SCENE_BY_ID.m2_blackout); actor.currentLocation = 'film_power_station'; actor.isInMatrix = true;
  const ghost = world.agents.get('ghost')!; ghost.currentLocation = actor.currentLocation; ghost.isInMatrix = true; ghost.position = { ...actor.position, x: actor.position.x + 3, z: actor.position.z - 1 };
  for (const id of ['soren', 'axel']) { const member = world.agents.get(id)!; member.status = 'dead'; member.health = 0; }
  return { world, sandbox, players, journey, command, tick: () => tick, actor: () => players.getAgent('relay-player')! };
}

test('Vigilant monitoring happens aboard the Nebuchadnezzar and cannot jack Trinity in before the blackout', () => {
  const scene = FILM_SCENE_BY_ID.m2_vigilant;
  assert.equal(scene.set, 'film_neb_deck');
  assert.doesNotMatch(scene.steps[1].label, /接入/);
  const ids = FILM_SCENES.map(scene => scene.id);
  assert.ok(ids.indexOf('m2_relay') > ids.indexOf('m2_blackout'));
  assert.ok(ids.indexOf('m2_relay') < ids.indexOf('m2_backup'));
});

test('the finished blackout hands Trinity back to the real ship before the Matrix intrusion', () => {
  const h = setup(); h.world.agents.get('keymaker')!.health = 40;
  h.journey.reflections['m2_plan:1'] = 'care'; h.command('next');
  assert.equal(h.journey.scene, 'm2_relay');
  assert.equal(h.actor().id, 'trinity'); assert.equal(h.actor().isInMatrix, false);
  assert.equal(h.actor().currentLocation, 'film_neb_deck');
  assert.equal(h.journey.grid!.trinity, 'waiting');
  assert.equal(h.journey.grid!.emergency, 'online'); assert.equal(h.journey.grid!.remaining, 314);
  assert.equal(h.world.agents.get('keymaker')!.health, 40);
  assert.equal(h.journey.reflections['m2_plan:1'], 'care');
  h.command('next'); assert.equal(h.journey.scene, 'm2_relay', 'entering the ship cannot automatically skip the decision or chair');
});

function decide(h: ReturnType<typeof setup>) {
  h.command('next'); const scene = FILM_SCENE_BY_ID.m2_relay;
  h.actor().position = filmStepPosition(scene, scene.steps[0], h.journey); h.command('act');
  for (let frame = 0; frame < 75; frame++) h.players.step(.1, true, h.tick());
  assert.equal(h.journey.trinityRelay!.phase, 'decision');
  assert.equal(h.journey.step, 0, 'listening cannot make the decision on behalf of the player');
  h.command('act'); assert.equal(h.journey.step, 1);
}

test('Trinity must review the restored emergency supply, choose to intervene and walk to the real chair before connecting', () => {
  const h = setup(); decide(h); const scene = FILM_SCENE_BY_ID.m2_relay;
  assert.match(h.command('act'), /先亲自走到/);
  assert.equal(h.journey.trinityRelay!.phase, 'walking');
  h.actor().position = filmStepPosition(scene, scene.steps[1], h.journey); h.command('act');
  for (let frame = 0; frame < 100; frame++) h.players.step(.1, true, h.tick());
  assert.equal(h.journey.grid!.trinity, 'waiting'); assert.equal(h.actor().isInMatrix, false);
  const link = h.world.agents.get('link')!;
  assert.equal(link.currentLocation, 'film_neb_deck'); assert.equal(link.isInMatrix, false);
  assert.ok(link.position.x < h.actor().position.x, 'Link approaches behind her without a jump straight from the terminal');
  for (let frame = 0; frame < 70; frame++) h.players.step(.1, true, h.tick());
  assert.equal(h.journey.trinityRelay!.phase, 'connected'); assert.equal(h.journey.step, 2);
  assert.equal(h.journey.grid!.trinity, 'connected'); assert.equal(h.journey.grid!.emergency, 'online');
  h.command('next'); assert.equal(h.journey.scene, 'm2_backup'); assert.equal(h.actor().isInMatrix, true);
  for (const id of ['soren', 'axel']) assert.equal(h.world.agents.get(id)!.status, 'dead');
});

test('connecting freezes on pause, role release and occupied Link; restore resumes once without erasing the ship casualties', () => {
  const h = setup(); decide(h); const scene = FILM_SCENE_BY_ID.m2_relay;
  h.actor().position = filmStepPosition(scene, scene.steps[1], h.journey); h.command('act');
  for (let frame = 0; frame < 25; frame++) h.players.step(.1, true, h.tick());
  const age = h.journey.trinityRelay!.elapsed, link = h.world.agents.get('link')!;
  for (let frame = 0; frame < 30; frame++) h.players.step(.1, false, h.tick());
  assert.equal(h.journey.trinityRelay!.elapsed, age);
  link.controller = 'other-player'; const beforeLink = structuredClone(link);
  for (let frame = 0; frame < 30; frame++) h.players.step(.1, true, h.tick());
  assert.equal(h.journey.trinityRelay!.elapsed, age); assert.deepEqual(link, beforeLink);
  link.controller = null; h.players.release('relay-player', h.tick());
  for (let frame = 0; frame < 30; frame++) h.players.step(.1, true, h.tick());
  assert.equal(h.journey.trinityRelay!.elapsed, age);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); h.players.possess('relay-player', 'trinity', h.tick());
  for (let frame = 0; frame < 160; frame++) h.players.step(.1, true, h.tick());
  const restored = h.sandbox.life.film.state!;
  assert.equal(restored.trinityRelay!.phase, 'connected'); assert.equal(restored.step, 2);
  assert.equal(restored.trinityRelay!.elapsed, TRINITY_RELAY.connectSeconds);
  for (let frame = 0; frame < 50; frame++) h.players.step(.1, true, h.tick());
  assert.equal(restored.step, 2); for (const id of ['soren', 'axel']) assert.equal(h.world.agents.get(id)!.status, 'dead');
});

test('a legacy early connected flag is corrected on the ship; retry cannot resurrect an unavailable Link', () => {
  const h = setup(); h.journey.grid!.trinity = 'connected'; h.command('next');
  assert.equal(h.journey.grid!.trinity, 'waiting');
  const link = h.world.agents.get('link')!; link.status = 'dead'; link.health = 0;
  const before = structuredClone(link); h.command('retry');
  for (let frame = 0; frame < 100; frame++) h.players.step(.1, true, h.tick());
  assert.deepEqual(link, before); assert.equal(h.journey.step, 0);
  assert.match(h.journey.lastText, /不能用重试抹去队友伤亡/);
});
