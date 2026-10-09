import assert from 'node:assert/strict';
import test from 'node:test';
import { ZION_DEPLOYMENT, FILM_SETS, FILM_SCENE_BY_ID, filmStepPosition, filmPosition, playerBlocked, type WorldEvent } from '@auto_matrix/shared';
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
  let tick = 0, sequence = 0;
  players.possess('deployment-player', 'neo', tick); sandbox.life.begin(world.agents.get('neo')!, tick); sandbox.state.neoLife!.chapter = 1;
  const command = (target: string) => players.sandboxAction('deployment-player', { kind: 'life', target: `film:${target}` }, ++tick);
  command('continue');
  Object.assign(sandbox.life.film.state!, { scene: 'm3_logos_plan', actor: 'neo', step: 5,
    completed: ['m3_oracle_absorbed', 'm3_bane_questions', 'm3_logos_plan'], reflections: {} });
  world.agents.get('lock')!.health = 47; const next = command('next');
  assert.equal(sandbox.life.film.state!.scene, 'm3_zion_prepare', next);
  const actor = () => players.getAgent('deployment-player') ?? world.agents.get('lock')!;
  const frames = (seconds: number, running = true) => {
    for (let i = 0; i < Math.ceil(seconds / .05); i++) {
      players.receiveInput('deployment-player', { x: 0, z: 0, yaw: actor().rotation, location: actor().currentLocation, sequence: ++sequence });
      players.step(.05, running, ++tick); if (running) sandbox.tick(tick);
    }
  };
  const near = (step: number) => { actor().position = filmStepPosition(FILM_SCENE_BY_ID.m3_zion_prepare, FILM_SCENE_BY_ID.m3_zion_prepare.steps[step], sandbox.life.film.state); };
  return { world, sandbox, players, get state() { return sandbox.life.film.state!; }, command, actor, frames, near, tick: () => tick };
}

test('the early council deployment cannot be completed by the old short interaction timer', () => {
  const h = setup(); h.near(0); h.frames(.1); h.command('act'); h.frames(3);
  assert.ok(h.state.step < 2, 'Lock must report the risk and answer the councillors before allocating troops');
  assert.equal(h.state.zionDeployment?.phase, 'reporting');
});

function report(h: ReturnType<typeof setup>) {
  h.near(0); h.frames(.1); assert.equal(h.state.step, 1); h.command('act');
  h.frames(ZION_DEPLOYMENT.reportLines.length * ZION_DEPLOYMENT.lineSeconds + .1);
  assert.equal(h.state.zionDeployment!.phase, 'question'); h.frames(4);
  assert.equal(h.state.step, 1, 'waiting cannot answer the force question');
  h.command('act'); h.frames(ZION_DEPLOYMENT.forceLines.length * ZION_DEPLOYMENT.lineSeconds + .1);
  assert.equal(h.state.step, 2); assert.equal(h.state.zionDeployment!.phase, 'review');
}

test('allocation requires three explicit correct decisions before a separate hope exchange and one judgment', () => {
  const h = setup(), life = h.sandbox.state.neoLife!; report(h);
  const before = structuredClone(life.philosophy); h.command('reflect:care'); assert.deepEqual(life.philosophy, before);
  h.command('act'); assert.equal(h.state.zionDeployment!.phase, 'review', 'Lock must walk to the plan');
  h.near(2); h.command('act'); assert.equal(h.state.zionDeployment!.phase, 'allocating');
  assert.match(h.command('allocation:dock:incorrect'), /钻机/); assert.equal(h.state.zionDeployment!.mistakes, 1);
  h.command('allocation:dock:apu_half'); h.command('allocation:dock:apu_half');
  assert.deepEqual(h.state.zionDeployment!.confirmed, ['dock']); h.frames(8); h.command('next'); assert.equal(h.state.step, 2);
  h.command('allocation:temple:fallback'); h.command('allocation:people:volunteers'); assert.equal(h.state.step, 3);
  assert.equal(life.choices.zion_deployment_dock, 'apu_half'); assert.equal(life.choices.zion_deployment_people, 'volunteers');
  h.command('reflect:care'); assert.deepEqual(life.philosophy, before, 'Hamann’s exchange is required');
  h.near(3); h.command('act'); h.frames(ZION_DEPLOYMENT.hopeLines.length * ZION_DEPLOYMENT.lineSeconds + .1);
  h.command('reflect:care'); h.command('reflect:agency'); assert.equal(life.philosophy.care, before.care + 1);
  assert.equal(life.philosophy.agency, before.agency); assert.equal(h.state.zionDeployment!.reply, 'care');
  h.frames(ZION_DEPLOYMENT.lineSeconds + .1); h.command('next'); assert.equal(h.state.scene, 'm3_zion_prepare');
  h.near(4); h.frames(.1); assert.equal(h.state.zionDeployment!.phase, 'done'); assert.equal(h.state.step, 5);
  assert.ok(h.state.completed.includes('m3_zion_prepare'));
  const health = h.actor().health; h.command('next'); assert.equal(h.state.scene, 'm3_maggie_discovery');
  assert.equal(h.world.agents.get('lock')!.health, health);
  assert.equal(h.world.agents.get('maggie')!.status, 'alive', 'her fate belongs to the following discovery');
  assert.ok(!h.sandbox.state.structures.some(item => item.id.startsWith('film:zion-deployment:')));
});

test('a released or paused council preserves the report clock and restores its cast without refilling supplies', () => {
  const h = setup(); h.near(0); h.frames(.1); h.command('act'); h.frames(6.7);
  const state = structuredClone(h.state.zionDeployment), poses = ZION_DEPLOYMENT.cast.map(id => structuredClone(h.world.agents.get(id)!.currentAction));
  const inventory = structuredClone(h.sandbox.state.profiles.lock.inventory), health = h.actor().health;
  h.frames(8, false); assert.deepEqual(h.state.zionDeployment, state);
  h.players.release('deployment-player', h.tick()); h.frames(8); assert.deepEqual(h.state.zionDeployment, state);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); h.players.possess('deployment-player', 'lock', h.tick());
  assert.deepEqual(JSON.parse(JSON.stringify(h.state.zionDeployment)), JSON.parse(JSON.stringify(state)));
  assert.deepEqual(ZION_DEPLOYMENT.cast.map(id => h.world.agents.get(id)!.currentAction), poses);
  assert.deepEqual(h.sandbox.state.profiles.lock.inventory, inventory); assert.equal(h.actor().health, health);
  h.frames(.5); assert.ok(h.state.zionDeployment!.elapsed > state!.elapsed);
});

test('partial allocation and error feedback survive saving and cannot silently settle a judgment', () => {
  const h = setup(); report(h); h.near(2); h.command('act'); h.command('allocation:dock:apu_half');
  h.command('allocation:temple:incorrect'); const philosophy = structuredClone(h.sandbox.state.neoLife!.philosophy);
  h.players.release('deployment-player', h.tick()); h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  h.players.possess('deployment-player', 'lock', h.tick());
  assert.deepEqual(h.state.zionDeployment!.confirmed, ['dock']); assert.equal(h.state.zionDeployment!.mistakes, 1);
  assert.match(h.state.lastText, /备用防线/); h.command('reflect:trust'); assert.deepEqual(h.sandbox.state.neoLife!.philosophy, philosophy);
  h.command('allocation:temple:fallback'); assert.deepEqual(h.state.zionDeployment!.confirmed, ['dock', 'temple']);
});

test('occupied or dead councillors stop the saved clock without being moved, stolen or healed', () => {
  const h = setup(); h.near(0); h.frames(.1); h.command('act'); h.frames(4);
  const west = h.world.agents.get('west')!, elapsed = h.state.zionDeployment!.elapsed;
  west.controller = 'other-player'; west.position = { x: 3, y: 2, z: 1 }; west.health = 17;
  h.frames(8); h.command('act'); assert.equal(h.state.zionDeployment!.elapsed, elapsed);
  assert.deepEqual(west.position, { x: 3, y: 2, z: 1 }); assert.equal(west.health, 17); assert.equal(west.controller, 'other-player');
  west.controller = null; west.status = 'dead'; west.health = 0; h.frames(8); h.command('retry');
  assert.equal(h.state.zionDeployment!.elapsed, elapsed); assert.equal(west.status, 'dead'); assert.equal(west.health, 0);
  assert.deepEqual(west.position, { x: 3, y: 2, z: 1 });
});

test('retry restores only the injured reporting actor’s checkpoint, keeping council and equipment state', () => {
  const h = setup(); assert.equal(h.actor().health, 47); h.near(0); h.frames(.1); h.command('act'); h.frames(3.7);
  const clock = h.state.zionDeployment!.elapsed, checkpointHealth = h.state.zionDeployment!.checkpointHealth;
  const inventory = structuredClone(h.sandbox.state.profiles.lock.inventory); h.world.agents.get('dillard')!.health = 19;
  h.actor().status = 'dead'; h.actor().health = 0; h.frames(8); assert.equal(h.state.zionDeployment!.elapsed, clock);
  h.command('retry'); assert.equal(h.actor().status, 'alive'); assert.equal(h.actor().health, checkpointHealth);
  assert.equal(h.world.agents.get('dillard')!.health, 19); assert.deepEqual(h.sandbox.state.profiles.lock.inventory, inventory);
  assert.equal(h.state.zionDeployment!.elapsed, clock);
});

test('legacy hall saves migrate once, including an already confirmed report without inventing new decisions', () => {
  const h = setup(), old = FILM_SETS.film_zion_council;
  delete h.state.zionDeployment; h.state.step = 0;
  h.actor().position = filmPosition(old.id, 0, old.depth * .32); h.actor().currentLocation = old.id; h.state.checkpoint = { ...h.actor().position };
  h.sandbox.life.film.zionDeployment.frame(h.actor(), 0, h.tick());
  assert.deepEqual(h.actor().position, filmPosition(FILM_SCENE_BY_ID.m3_zion_prepare.set, 0, 10)); assert.equal(h.actor().rotation, Math.PI);
  delete h.state.zionDeployment; h.state.step = 1; h.actor().position = filmPosition(old.id, 8, -18); h.actor().currentLocation = old.id;
  h.actor().rotation = .42; h.state.checkpoint = { ...h.actor().position };
  h.sandbox.life.film.zionDeployment.frame(h.actor(), 0, h.tick());
  assert.equal(h.state.step, 2); assert.equal(h.state.zionDeployment!.phase, 'review'); assert.equal(h.actor().rotation, .42);
  assert.deepEqual(h.state.zionDeployment!.confirmed, []); assert.equal(h.sandbox.state.neoLife!.choices.zion_deployment_dock, undefined);
  const position = { ...h.actor().position }; h.sandbox.life.film.zionDeployment.frame(h.actor(), 0, h.tick()); assert.deepEqual(h.actor().position, position);
});

test('council seats, plan stand and walls have physical collision while the report and inspection paths stay clear', () => {
  const h = setup(), set = FILM_SCENE_BY_ID.m3_zion_prepare.set;
  for (const point of [ZION_DEPLOYMENT.entry, ZION_DEPLOYMENT.report, ZION_DEPLOYMENT.inspection, ZION_DEPLOYMENT.exit])
    assert.equal(playerBlocked(filmPosition(set, point.x, point.z), false, 1.1, h.sandbox.state.structures), false);
  for (const point of [ZION_DEPLOYMENT.map, ...Object.values(ZION_DEPLOYMENT.roots), ZION_DEPLOYMENT.walls[0]])
    assert.equal(playerBlocked(filmPosition(set, point.x, point.z), false, 1.1, h.sandbox.state.structures), true);
});

test('the early council discusses twelve hours and a fallback without starting the later temple retreat', () => {
  const scene = FILM_SCENE_BY_ID.m3_zion_prepare;
  assert.match(scene.context, /十二小时|12 小时/);
  assert.doesNotMatch(scene.context, /两小时|2 小时/);
  assert.deepEqual(scene.cast, ['hamann', 'west', 'dillard']);
  assert.doesNotMatch(scene.steps.map(step => step.text ?? '').join(' '), /居民撤向神庙/);
});
