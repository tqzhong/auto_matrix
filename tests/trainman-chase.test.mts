import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SCENE_BY_ID, FILM_SETS, TRAINMAN_CHASE, filmEntry, filmStepPosition, filmPosition, groundHeight, trainmanBlocked, type WorldEvent } from '@auto_matrix/shared';
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
  players.possess('chase-player', 'neo', 0); sandbox.life.begin(world.agents.get('neo')!, 0); sandbox.state.neoLife!.chapter = 1;
  let tick = 0;
  const command = (target: string) => players.sandboxAction('chase-player', { kind: 'life', target: `film:${target}` }, ++tick);
  command('continue');
  Object.assign(sandbox.life.film.state!, { scene: 'm3_oracle_request', actor: 'trinity', step: FILM_SCENE_BY_ID.m3_oracle_request.steps.length });
  players.release('chase-player', tick); players.possess('chase-player', 'trinity', tick); command('next');
  const actor = world.agents.get('seraph')!, state = () => sandbox.life.film.state!;
  const frame = (count = 1, running = true) => { for (let i = 0; i < count; i++) players.step(.1, running, ++tick); };
  const slow = (count = 1) => { for (let i = 0; i < count; i++) sandbox.tick(++tick); };
  return { world, sandbox, players, actor, state, command, frame, slow, tick: () => tick };
}

test('the Trainman pursuit uses its own carriage and station instead of the Smith duel platform', () => {
  const scene = FILM_SCENE_BY_ID.m3_trainman_chase;
  assert.notEqual(scene.set, FILM_SCENE_BY_ID.m1_subway.set);
  const h = setup(); assert.deepEqual(h.actor.position, filmEntry(scene));
});

test('Platform 2 cover stays below the ticket hall and a lower-floor player cannot snap onto its overhead deck', () => {
  const center = FILM_SETS[TRAINMAN_CHASE.set].center, cover = filmPosition(TRAINMAN_CHASE.set, TRAINMAN_CHASE.cover.x, TRAINMAN_CHASE.cover.z);
  assert.equal(groundHeight(cover, true), center.y, 'the chase ends on the lower platform, without returning upstairs');
  const below = { x: center.x + 21.1, y: center.y, z: center.z - 23 };
  assert.equal(groundHeight(below, true), center.y, 'an overhead floor must not lift the player through its underside');
  assert.equal(groundHeight({ ...below, y: center.y + TRAINMAN_CHASE.upper }, true), center.y + TRAINMAN_CHASE.upper, 'the same deck supports the upper hall');
});

test('the slow story tick cannot finish the Trainman chase after its player disconnects', () => {
  const h = setup(), scene = FILM_SCENE_BY_ID.m3_trainman_chase;
  h.actor.position = filmStepPosition(scene, scene.steps[0]); h.command('act');
  h.players.release('chase-player', h.tick());
  const saved = structuredClone(h.state().helChase), trainman = { ...h.world.agents.get('trainman')!.position };
  h.slow(100);
  assert.notEqual(h.state().helChase?.phase, 'escaped', 'the scene must wait for the disconnected player');
  assert.equal(h.state().helChase?.elapsed, saved?.elapsed);
  assert.deepEqual(h.world.agents.get('trainman')!.position, trainman);
});

test('an occupied companion or dead Trainman cannot be moved or healed by the pursuit', () => {
  const h = setup(), scene = FILM_SCENE_BY_ID.m3_trainman_chase;
  h.actor.position = filmStepPosition(scene, scene.steps[0]); h.command('act');
  const trainman = h.world.agents.get('trainman')!, morph = h.world.agents.get('morpheus')!;
  morph.health = 47; h.players.possess('companion-player', 'morpheus', h.tick());
  const elapsed = h.state().helChase!.elapsed, before = { ...trainman.position };
  h.frame(30); h.slow(100);
  assert.equal(h.state().helChase!.elapsed, elapsed, 'all three pursuers share the paused encounter');
  assert.deepEqual(trainman.position, before);
  assert.equal(morph.health, 47); assert.equal(h.players.getAgent('companion-player'), morph);
  assert.equal((h.actor.currentAction?.parameters.trainmanChase as { paused?: string }).paused, morph.name, 'the player predictor must receive the occupied companion lock');
  h.players.release('companion-player', h.tick()); trainman.status = 'dead'; trainman.health = 0;
  const corpse = { ...trainman.position }; h.frame(30); h.slow(100);
  assert.deepEqual(trainman.position, corpse, 'the dead body cannot perform an escape');
  assert.equal(trainman.status, 'dead'); assert.equal(trainman.health, 0);
  assert.equal((h.actor.currentAction?.parameters.trainmanChase as { unavailable?: string }).unavailable, trainman.name, 'the same lock must reach the player when the program is unavailable');
});

test('retry discards the failed shot and vault without restoring health or earlier story records', () => {
  const h = setup(), state = h.state().helChase!.performance!;
  Object.assign(state, { phase: 'failed', passedGate: true, routeStage: 5, attempts: 2, dodgeUntil: 999,
    aim: { ...h.actor.position }, shot: { from: { ...h.actor.position }, to: { ...h.actor.position }, age: 0, blocked: false },
    vaultStart: { x: -3, z: -21, yaw: 0 }, playerRoute: 120 });
  h.actor.health = 29;
  const reflections = structuredClone(h.state().reflections), completed = [...h.state().completed];
  h.command('retry'); const retry = h.state().helChase!.performance!;
  for (const key of ['aim', 'shot', 'dodgeUntil', 'vaultStart', 'playerRoute'] as const) assert.equal(retry[key], undefined, key);
  assert.equal(retry.phase, 'running'); assert.equal(retry.passedGate, false); assert.equal(retry.attempts, 3);
  assert.equal(h.actor.health, 29); assert.deepEqual(h.state().reflections, reflections); assert.deepEqual(h.state().completed, completed);
});

test('the escaping Trainman runs from his landing instead of teleporting when the train passes', () => {
  const h = setup(), state = h.state().helChase!.performance!, trainman = h.world.agents.get('trainman')!;
  Object.assign(state, { phase: 'crossing', elapsed: 6.95, passedGate: true, routeStage: 5 });
  h.sandbox.life.film.trainmanChase.frame(h.actor, 0, h.tick()); const before = { ...trainman.position }; h.frame(2);
  assert.ok(Math.hypot(trainman.position.x - before.x, trainman.position.z - before.z) < 1.5, 'escape must keep a continuous root trajectory');
  assert.equal(trainman.currentAction?.parameters.hidden, undefined, 'a visible world body cannot rely on an unsupported hidden flag');
  const center = FILM_SETS[TRAINMAN_CHASE.set].center;
  assert.ok(trainman.position.z - center.z < -60, 'the escaped program must actually leave the visible platform');
  assert.equal(trainmanBlocked(trainman.position.x - center.x, trainman.position.y - center.y, trainman.position.z - center.z, .55), false, 'the exit path must have room for his body');
});

test('normal player movement connects the carriage, stairs, manual vault and cover before the escape', () => {
  const h = setup(), scene = FILM_SCENE_BY_ID.m3_trainman_chase; let sequence = 0;
  const walk = (x: number, z: number) => {
    const destination = filmPosition(scene.set, x, z);
    for (let frame = 0; Math.hypot(h.actor.position.x - destination.x, h.actor.position.z - destination.z) > .4 && frame < 240; frame++) {
      const dx = destination.x - h.actor.position.x, dz = destination.z - h.actor.position.z, length = Math.hypot(dx, dz);
      h.players.receiveInput('chase-player', { x: dx / Math.max(1.5, length), z: dz / Math.max(1.5, length), yaw: Math.atan2(dx, dz), sprint: true, sequence: ++sequence }); h.frame();
      const support = groundHeight(h.actor.position, true, h.sandbox.state.structures);
      assert.ok(h.actor.position.y >= support - .01, `the moving player must stay above each visible tread: ${h.actor.position.y}/${support}`);
      assert.notEqual(h.state().helChase!.performance!.phase, 'failed', `route to ${x}/${z}`);
    }
    assert.ok(Math.hypot(h.actor.position.x - destination.x, h.actor.position.z - destination.z) <= .4, `reachable ${x}/${z}`);
    h.players.receiveInput('chase-player', { x: 0, z: 0, yaw: h.actor.rotation, sequence: ++sequence }); h.frame(2);
  };
  walk(TRAINMAN_CHASE.question.x, TRAINMAN_CHASE.question.z); h.command('act'); h.frame(100);
  assert.equal(h.state().step, 1); assert.equal(h.state().helChase!.performance!.phase, 'running');
  for (const [x, z] of [[-30, 20], [-20.5, 20], [-17, 12], [-17, -3], [-17, -19], [-3.2, -21.5]]) walk(x, z);
  assert.equal(h.state().helChase!.performance!.passedGate, false); h.command('act'); h.frame(14);
  assert.equal(h.state().helChase!.performance!.passedGate, true);
  for (const [x, z] of [[17, -21.5], [17, -3], [23, -3], [23, TRAINMAN_CHASE.cover.z], [TRAINMAN_CHASE.cover.x, TRAINMAN_CHASE.cover.z]]) walk(x, z);
  for (let frame = 0; frame < 300 && h.state().helChase!.performance!.phase === 'running'; frame++) h.frame();
  assert.equal(h.state().step, 2); assert.equal(h.state().helChase!.performance!.phase, 'cover');
  h.frame(190); assert.equal(h.state().helChase!.performance!.phase, 'escaped');
  walk(TRAINMAN_CHASE.exit.x, TRAINMAN_CHASE.exit.z); h.command('act'); assert.equal(h.state().step, 3);
  h.command('next'); assert.equal(h.state().scene, 'm3_hel_garage');
});

test('a saved column intercepts the shot, exposure causes damage, and timed dodging avoids the locked aim', () => {
  const h = setup(), state = h.state().helChase!.performance!, center = FILM_SETS[TRAINMAN_CHASE.set].center;
  Object.assign(state, { phase: 'cover', elapsed: 0 }); h.actor.position = filmPosition(TRAINMAN_CHASE.set, TRAINMAN_CHASE.cover.x, TRAINMAN_CHASE.cover.z);
  const health = h.actor.health; h.frame(12); assert.equal(h.actor.health, health); assert.equal(state.shot?.blocked, true); assert.ok(state.impacts.length);
  state.elapsed = 0; state.aim = undefined; h.actor.position = filmPosition(TRAINMAN_CHASE.set, 17, TRAINMAN_CHASE.cover.z); h.frame(12);
  assert.equal(h.actor.health, health - 9); assert.equal(state.shot?.blocked, false);
  state.elapsed = 0; state.aim = undefined; h.frame(3); h.players.act('chase-player', 'dodge', h.tick()); h.frame(9);
  assert.equal(h.actor.health, health - 9); assert.ok(state.dodgeUntil! < state.age + 1);
  const saved = structuredClone(h.sandbox.state), positions = Object.fromEntries(TRAINMAN_CHASE.cast.map(id => [id, { ...h.world.agents.get(id)!.position }]));
  h.sandbox.restore(saved); h.frame(10, false);
  assert.deepEqual(h.state().helChase!.performance!.shot, state.shot); assert.deepEqual(h.state().helChase!.performance!.impacts, state.impacts);
  for (const id of TRAINMAN_CHASE.cast) assert.deepEqual(h.world.agents.get(id)!.position, positions[id]);
  assert.ok(h.actor.position.x > center.x, 'the restore keeps the second platform');
});
