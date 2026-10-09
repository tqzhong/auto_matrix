import assert from 'node:assert/strict';
import test from 'node:test';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import { FILM_SCENE_BY_ID, FILM_SETS, PRIMARY_DEMOLITION as P, filmPosition, filmStepPosition, type WorldEvent } from '@auto_matrix/shared';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

function setup() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const conversations = { interrupt() {}, isAgentInConversation: () => false, startConversation: () => false } as unknown as ConversationEngine;
  const players = new PlayerController(world, conversations, { execute() {} } as unknown as ActionExecutor, dynamics, sandbox);
  players.possess('power-player', 'neo', 0); sandbox.life.begin(world.agents.get('neo')!, 0); sandbox.state.neoLife!.chapter = 1;
  let tick = 0;
  const command = (target: string) => players.sandboxAction('power-player', { kind: 'life', target: `film:${target}` }, ++tick);
  command('continue'); const journey = sandbox.life.film.state!, scene = FILM_SCENE_BY_ID.m2_power;
  Object.assign(journey, { scene: scene.id, actor: 'niobe', step: 1, grid: { primary: 'online', emergency: 'online', vigilant: 'active', trinity: 'waiting',
    phase: 'preparing', remaining: 314, lastTick: tick, reroute: 0, attempts: 0 } });
  players.possess('power-player', 'niobe', tick);
  const actor = players.getAgent('power-player')!; actor.currentLocation = scene.set; actor.isInMatrix = true;
  const ghost = world.agents.get('ghost')!; ghost.currentLocation = scene.set; ghost.isInMatrix = true; ghost.position = filmPosition(scene.set, 5, 15); ghost.health = 47;
  actor.position = filmPosition(scene.set, 0, 18); journey.checkpoint = { ...actor.position };
  let sequence = 0;
  const advance = (seconds: number, focus = false, running = true) => { for (let i = 0; i < seconds * 10; i++) {
    players.receiveInput('power-player', { x: 0, z: 0, yaw: actor.rotation, sequence: ++sequence, focus, location: scene.set });
    players.step(.1, running, tick); if (running && i % 5 === 4) sandbox.tick(++tick);
  } };
  return { world, sandbox, players, journey, scene, actor, command, advance, tick: () => tick };
}

test('the old single console countdown cannot arm the entire station without installing the charges', () => {
  const h = setup(); h.actor.position = filmPosition(h.scene.set, 0, -29);
  h.command('act'); h.advance(8);
  assert.equal(h.journey.grid?.primary, 'online', 'arming requires physical installation and synchronization');
  assert.equal(h.journey.step, 1);
});

function install(h: ReturnType<typeof setup>) {
  for (const site of P.sites) {
    h.actor.position = filmPosition(h.scene.set, site.x, site.z); h.command('act');
    assert.equal(h.journey.primaryDemolition?.phase, 'mounting'); h.advance(2.3, true);
    assert.ok(h.journey.primaryDemolition!.installed.includes(site.id));
  }
}
function arm(h: ReturnType<typeof setup>) {
  install(h); h.advance(1.3); h.command('act'); assert.equal(h.journey.primaryDemolition?.phase, 'retreat');
}

test('installing requires held fresh input; release, pause and a disconnected actor preserve a partial installation', () => {
  const h = setup(), site = P.sites[0]; h.actor.position = filmPosition(h.scene.set, site.x, site.z); h.command('act');
  h.advance(.7, true); const elapsed = h.journey.primaryDemolition!.elapsed; assert.ok(elapsed > .5 && elapsed < .8);
  h.advance(3); h.advance(3, true, false); assert.equal(h.journey.primaryDemolition!.elapsed, elapsed);
  h.players.release('power-player'); h.sandbox.life.film.primaryDemolition.frame(h.actor, .1, h.tick(), true);
  assert.equal(h.journey.primaryDemolition!.elapsed, elapsed);
  h.players.possess('power-player', 'niobe', h.tick()); h.advance(2, true); assert.deepEqual(h.journey.primaryDemolition!.installed, ['west']);
});

test('synchronization needs the actual green interval, and completion needs both characters outside', () => {
  const h = setup(); install(h); const state = h.journey.primaryDemolition!;
  assert.equal(state.phase, 'sync'); h.command('act'); assert.equal(state.phase, 'sync'); assert.equal(h.journey.grid?.primary, 'online');
  h.advance(1.3); h.command('act'); assert.equal(state.phase, 'retreat'); assert.equal(h.journey.grid?.primary, 'armed');
  h.actor.position = filmStepPosition(h.scene, h.scene.steps[1], h.journey); h.command('act'); assert.equal(state.phase, 'retreat', 'Ghost has not left yet');
  h.advance(2); h.actor.position = filmStepPosition(h.scene, h.scene.steps[1], h.journey); h.command('act');
  assert.equal(state.phase, 'done'); assert.equal(h.journey.step, 2); assert.equal(h.journey.grid?.primary, 'armed'); assert.equal(h.journey.grid?.emergency, 'online');
  assert.equal(h.world.agents.get('ghost')!.health, 47); assert.equal(h.world.agents.get('ghost')!.currentLocation, h.scene.set);
});

test('occupied or dead Ghost pauses preparation and cannot be moved, healed or revived by retry', () => {
  const h = setup(); arm(h); const state = h.journey.primaryDemolition!, ghost = h.world.agents.get('ghost')!;
  h.players.possess('ghost-owner', 'ghost', h.tick()); const position = { ...ghost.position }, remaining = state.remaining;
  h.advance(5); assert.equal(state.remaining, remaining); assert.deepEqual(ghost.position, position); h.command('retry'); assert.equal(state.attempts, 0);
  h.players.release('ghost-owner'); ghost.status = 'dead'; ghost.health = 0; h.advance(2); h.command('retry');
  assert.equal(state.remaining, remaining); assert.equal(ghost.status, 'dead'); assert.equal(ghost.health, 0);
});

test('missed evacuation fails locally and retry retains installations, injuries and earlier reflection choices', () => {
  const h = setup(); h.journey.reflections.m2_plan = 'care'; arm(h); h.advance(36);
  const state = h.journey.primaryDemolition!; assert.equal(state.phase, 'failed'); assert.equal(h.journey.grid?.primary, 'online');
  h.command('retry'); assert.equal(state.phase, 'retreat'); assert.equal(state.attempts, 1); assert.deepEqual(state.installed, ['west', 'east', 'clock']);
  assert.equal(h.world.agents.get('ghost')!.health, 47); assert.equal(h.journey.reflections.m2_plan, 'care'); assert.equal(state.remaining, P.retreatSeconds);
  h.command('retry'); assert.equal(state.attempts, 1, 'a second reconnect must not create a second failure');
});

test('being below the observation bridge cannot satisfy the exit interaction', () => {
  const h = setup(); arm(h); h.advance(2); h.actor.position = filmPosition(h.scene.set, P.observation.x, P.observation.z);
  h.command('act'); assert.equal(h.journey.primaryDemolition!.phase, 'retreat');
  assert.equal(h.actor.position.y, FILM_SETS[h.scene.set].center.y);
});

test('releasing and reconnecting the captain preserves the escaped companion position and injuries', () => {
  const h = setup(); arm(h); h.advance(2); h.actor.position = filmStepPosition(h.scene, h.scene.steps[1], h.journey); h.command('act');
  const ghost = h.world.agents.get('ghost')!, position = { ...ghost.position }; assert.equal(h.journey.primaryDemolition!.phase, 'done');
  h.players.release('power-player'); assert.deepEqual(ghost.position, position); assert.equal(ghost.health, 47);
  h.players.possess('power-player', 'niobe', h.tick()); assert.deepEqual(ghost.position, position); assert.equal(ghost.health, 47);
});

test('disconnecting while Ghost walks freezes his actual velocity as well as the saved countdown', () => {
  const h = setup(); arm(h); h.advance(.2); const ghost = h.world.agents.get('ghost')!, position = { ...ghost.position };
  assert.ok(Math.hypot(ghost.velocity.x, ghost.velocity.z) > 0);
  h.players.release('power-player'); assert.deepEqual(ghost.position, position); assert.deepEqual(ghost.velocity, { x: 0, y: 0, z: 0 });
});

function blackout() {
  const h = setup();
  Object.assign(h.journey, { scene: 'm2_blackout', step: 0, primaryDemolition: {
    phase: 'done', installed: ['west', 'east', 'clock'], elapsed: 0, remaining: 25, attempts: 1,
    blast: { phase: 'ready', elapsed: 0 }
  } });
  Object.assign(h.journey.grid!, { primary: 'armed', vigilant: 'lost', trinity: 'connected' });
  h.actor.position = { ...filmPosition(h.scene.set, 0, 41), y: 4.2 };
  const ghost = h.world.agents.get('ghost')!; ghost.position = { ...filmPosition(h.scene.set, 3, 40), y: 4.2 };
  return h;
}

test('midnight must actually pass before the main grid fails; the emergency grid survives the explosion', () => {
  const h = blackout(); h.command('act');
  assert.equal(h.journey.primaryDemolition?.blast?.phase, 'countdown');
  h.advance(5); assert.equal(h.journey.grid?.primary, 'armed'); assert.equal(h.journey.step, 0);
  h.advance(1.2); assert.equal(h.journey.grid?.primary, 'off'); assert.equal(h.journey.grid?.emergency, 'online');
  assert.equal(h.journey.primaryDemolition?.blast?.phase, 'blast'); assert.equal(h.journey.step, 0);
  h.advance(8); assert.equal(h.journey.primaryDemolition?.blast?.phase, 'done'); assert.equal(h.journey.step, 1);
  assert.equal(h.journey.grid?.phase, 'emergency'); assert.equal(h.journey.grid?.remaining, 314);
  assert.equal(h.world.agents.get('ghost')!.health, 47); h.command('act'); h.command('retry');
  assert.equal(h.journey.grid?.primary, 'off'); assert.equal(h.journey.primaryDemolition?.blast?.elapsed, P.blastSeconds);
});

test('midnight and destruction retain their exact saved clocks during pause, disconnect and companion occupation', () => {
  const h = blackout(); h.command('act'); h.advance(2);
  const state = h.journey.primaryDemolition!, elapsed = state.blast!.elapsed;
  h.advance(2, false, false); assert.equal(state.blast!.elapsed, elapsed);
  h.players.release('power-player'); h.advance(2); assert.equal(state.blast!.elapsed, elapsed);
  h.players.possess('power-player', 'niobe', h.tick()); h.players.possess('ghost-owner', 'ghost', h.tick());
  h.advance(2); assert.equal(state.blast!.elapsed, elapsed); h.players.release('ghost-owner'); h.advance(4.5);
  assert.equal(state.blast!.phase, 'blast'); const saved = JSON.parse(JSON.stringify(state));
  h.journey.primaryDemolition = saved; h.sandbox.life.film.primaryDemolition.frame(h.actor, 0, h.tick());
  assert.deepEqual(h.journey.primaryDemolition, saved); assert.equal(h.journey.grid?.primary, 'off');
  h.advance(1, false, false); assert.equal(saved.blast.elapsed, state.blast!.elapsed);
});

test('blackout cannot be acknowledged under the bridge, before installation, or with Ghost still in the blast area', () => {
  const h = blackout(), state = h.journey.primaryDemolition!;
  h.actor.position.y = 1; h.command('act'); assert.equal(state.blast!.phase, 'ready'); h.actor.position.y = 4.2;
  state.installed.pop(); h.command('act'); assert.equal(state.blast!.phase, 'ready'); state.installed.push('clock');
  h.world.agents.get('ghost')!.position.z -= 14; h.command('act'); assert.equal(state.blast!.phase, 'ready');
  assert.equal(h.journey.grid?.primary, 'armed');
});

test('Ghost turns toward the power hall after reaching the safe observation bridge', () => {
  const h = blackout(), ghost = h.world.agents.get('ghost')!, center = FILM_SETS.film_power_station.center;
  ghost.position = { ...filmPosition('film_power_station', 3, 40), y: 4.2 }; ghost.rotation = 0;
  h.command('act');
  const toward = { x: center.x - ghost.position.x, z: center.z - ghost.position.z };
  const alignment = (Math.sin(ghost.rotation) * toward.x + Math.cos(ghost.rotation) * toward.z) / Math.hypot(toward.x, toward.z);
  assert.ok(alignment > .99, 'a companion who has stopped must observe the blast instead of staring away from it');
  assert.deepEqual(ghost.velocity, { x: 0, y: 0, z: 0 });
  h.players.possess('ghost-owner', 'ghost', h.tick()); ghost.rotation = .7;
  h.sandbox.life.film.primaryDemolition.frame(h.actor, 0, h.tick());
  assert.equal(ghost.rotation, .7, 'cinematic heading cannot override another player');
});
