import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SCENE_BY_ID, filmStepPosition, filmPosition, playerBlocked, type WorldEvent } from '@auto_matrix/shared';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';
import { MemoryManager } from '../packages/server/src/memory/MemoryManager.js';
import { RelationshipGraph } from '../packages/server/src/agents/RelationshipGraph.js';

function setup(step = 3, health = 40) {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const conversations = { interrupt() {}, isAgentInConversation: () => false, startConversation: () => false } as unknown as ConversationEngine;
  const players = new PlayerController(world, conversations, { execute() {} } as unknown as ActionExecutor, dynamics, sandbox);
  players.possess('portal-player', 'neo', 0); sandbox.life.begin(world.agents.get('neo')!, 0); sandbox.state.neoLife!.chapter = 1;
  let tick = 0, sequence = 0;
  const command = (target: string) => players.sandboxAction('portal-player', { kind: 'life', target: `film:${target}` }, ++tick);
  command('continue'); const journey = sandbox.life.film.state!, scene = FILM_SCENE_BY_ID.m2_key_door;
  Object.assign(journey, { scene: scene.id, actor: 'neo', step, keyDoor: { portalOpened: step > 3, keyTaken: step > 4 },
    grid: { primary: 'off', emergency: 'off', vigilant: 'lost', trinity: 'connected', phase: 'window', remaining: 305.5, lastTick: tick, reroute: 0, attempts: 0 } });
  journey.reflections['m2_plan:1'] = 'care';
  for (const id of ['soren', 'axel']) { world.agents.get(id)!.status = 'dead'; world.agents.get(id)!.health = 0; }
  const actor = world.agents.get('neo')!; actor.currentLocation = scene.set; actor.isInMatrix = true;
  actor.position = filmStepPosition(scene, scene.steps[step], journey);
  for (const [id, x, z] of [['keymaker', 2, -37], ['morpheus', -2, -37], ['smith', 0, -29]] as const) {
    const a = world.agents.get(id)!; a.currentLocation = scene.set; a.isInMatrix = true; a.position = filmPosition(scene.set, x, z);
  }
  world.agents.get('keymaker')!.health = health;
  const frames = (seconds: number, running = true) => {
    for (let i = 0; i < seconds * 10; i++) {
      if (running) players.receiveInput('portal-player', { x: 0, z: 0, yaw: Math.PI, pitch: 0, jump: false, sequence: ++sequence, location: actor.currentLocation });
      if (running && i % 5 === 4) tick++;
      players.step(.1, running, tick);
      if (running && i % 5 === 4) sandbox.tick(tick);
    }
  };
  return { world, sandbox, players, journey, actor, scene, command, frames, tick: () => tick,
    performance: () => (sandbox.life.film.state!.keyDoor as any)?.performance };
}

test('the first door needs an explicit evacuation after opening, not a timed skip into the wounded scene', () => {
  const h = setup(); h.command('act'); h.frames(2.2);
  assert.equal(h.journey.step, 3); assert.equal(h.performance()?.phase, 'cover');
  assert.equal(h.world.agents.get('keymaker')!.health, 40);
  h.players.act('portal-player', 'attack', h.tick()); h.frames(5);
  assert.equal(h.journey.step, 4); assert.equal(h.performance()?.phase, 'wounded');
  assert.ok(h.world.agents.get('keymaker')!.health <= 18);
  assert.equal(playerBlocked(filmPosition(h.scene.set, 0, -39), true, 1.1, h.sandbox.state.structures), true, 'the door is shut behind the escape');
});

test('scripted gunfire never heals an already badly injured Keymaker', () => {
  const h = setup(3, 5); h.command('act'); h.frames(2.2); h.players.act('portal-player', 'attack', h.tick()); h.frames(5);
  assert.ok(h.world.agents.get('keymaker')!.health <= 5, 'bullet wounds cannot restore his prior injury');
});

test('the dying Keymaker speaks and offers the key before a separate player acceptance', () => {
  const h = setup(4, 18); h.command('act'); h.frames(8);
  assert.equal(h.journey.step, 4); assert.equal(h.journey.keyDoor!.keyTaken, false);
  assert.equal(h.performance()?.phase, 'key_ready');
  assert.equal(h.world.agents.get('keymaker')!.status, 'alive');
  h.command('act'); h.frames(2);
  assert.equal(h.journey.step, 5); assert.equal(h.journey.keyDoor!.keyTaken, true);
  assert.equal(h.world.agents.get('keymaker')!.status, 'dead');
  assert.equal(h.journey.reflections['m2_plan:1'], 'care');
  for (const id of ['soren', 'axel']) assert.equal(h.world.agents.get(id)!.status, 'dead');
});

test('a missed evacuation can retry locally without resurrecting any crew or resetting grid history', () => {
  const h = setup(); h.command('act'); h.frames(10);
  assert.equal(h.performance()?.phase, 'failed'); assert.equal(h.journey.step, 3);
  h.command('retry'); assert.equal(h.performance()?.phase, 'idle'); assert.equal(h.performance()?.attempts, 1);
  assert.equal(h.world.agents.get('keymaker')!.health, 40); assert.equal(h.journey.grid!.primary, 'off');
  for (const id of ['soren', 'axel']) assert.equal(h.world.agents.get(id)!.status, 'dead');
});

test('paused and released portal progress survives restore, and an occupied companion is never repositioned', () => {
  const h = setup(); h.command('act'); h.frames(.8);
  const before = structuredClone(h.performance()); h.frames(3, false); assert.deepEqual(h.performance(), before);
  h.players.release('portal-player', h.tick()); h.frames(2); assert.deepEqual(h.performance(), before);
  h.sandbox.restore(structuredClone(h.sandbox.state)); h.players.possess('portal-player', 'neo', h.tick());
  assert.deepEqual(h.performance(), before);
  const morpheus = h.world.agents.get('morpheus')!; morpheus.controller = 'other-player'; const position = { ...morpheus.position };
  h.frames(3); assert.equal(h.performance().elapsed, before.elapsed); assert.deepEqual(morpheus.position, position);
  assert.equal(morpheus.controller, 'other-player');
});

test('expiration after a successful first unlock keeps the actual escape and wound, while source entry commits its own window',()=>{
  const h=setup();h.command('act');h.frames(2.2);h.players.act('portal-player','attack',h.tick());
  h.journey.grid!.remaining=.1;h.frames(5);assert.equal(h.journey.step,4);assert.equal(h.performance().phase,'wounded');
  h.actor.position=filmStepPosition(h.scene,h.scene.steps[4],h.journey);h.command('act');h.frames(8);h.command('act');h.frames(2);assert.equal(h.journey.step,5);
  h.journey.grid!.phase='window';h.journey.grid!.remaining=.1;h.actor.position=filmStepPosition(h.scene,h.scene.steps[5],h.journey);
  assert.equal(playerBlocked(filmPosition(h.scene.set,0,-54.5),true,1.1,h.sandbox.state.structures),true);
  h.command('act');h.frames(3.5);assert.equal(h.journey.step,6);assert.equal(h.journey.grid!.phase,'opened');
});
test('a dead companion blocks entry without being revived by act or retry',()=>{
  const h=setup();const keymaker=h.world.agents.get('keymaker')!;keymaker.status='dead';keymaker.health=0;
  h.command('act');h.frames(4);h.command('retry');assert.equal(h.journey.step,3);assert.equal(h.performance().phase,'idle');
  assert.equal(keymaker.status,'dead');assert.equal(keymaker.health,0);
});

test('waiting for the offered key preserves the gunshot wound while ordinary idle recovery still works', () => {
  const h = setup(3, 5); h.command('act'); h.frames(2.2); h.players.act('portal-player', 'attack', h.tick()); h.frames(5);
  const keymaker = h.world.agents.get('keymaker')!, health = keymaker.health;
  h.actor.position = filmStepPosition(h.scene, h.scene.steps[4], h.journey); h.command('act'); h.frames(8);
  const other = h.world.agents.get('tank')!; other.health = 20; other.mind!.stress = 0;
  other.currentAction = { type: 'idle', parameters: { resolved: true }, startedAt: 0, duration: 1e9, progress: 0 };
  const dynamics = new WorldDynamics(h.world, new MemoryManager(), new RelationshipGraph(), () => {});
  dynamics.neoStory = true;
  for (let tick = 0; tick < 300; tick++) dynamics.tick(tick);
  assert.equal(keymaker.health, health, 'the fatal wound cannot turn into a healed idle companion');
  assert.equal(keymaker.status, 'alive'); assert.equal(h.journey.keyDoor!.keyTaken, false);
  assert.ok(other.health > 20, 'unrelated idle actors retain their ordinary recovery');
});
