import assert from 'node:assert/strict';
import test from 'node:test';
import { HEL_TRIO, FILM_SCENE_BY_ID, FILM_SETS, filmPosition, filmStepPosition, groundHeight } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';

function setup() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const sandbox = new SandboxSystem(world, { record() {} } as unknown as WorldDynamics, 42);
  const neo = world.agents.get('neo')!; sandbox.enter(neo); sandbox.life.begin(neo, 0);
  const trinity = world.agents.get('trinity')!; trinity.controller = 'player'; sandbox.enter(trinity);
  trinity.currentLocation = 'film_club_hel'; trinity.isInMatrix = true;
  trinity.position = filmStepPosition(FILM_SCENE_BY_ID.m3_hel_bargain, FILM_SCENE_BY_ID.m3_hel_bargain.steps[0]);
  trinity.position.y = groundHeight(trinity.position, true); trinity.rotation = Math.PI; trinity.health = 47;
  sandbox.state.neoLife!.journey = { version: 1, scene: 'm3_hel_bargain', step: 0, actor: 'trinity', completed: [], enteredAt: 0,
    checkpoint: { ...trinity.position }, reflections: {}, lastText: '', helBargain: { phase: 'armed', elapsed: 0, lastTick: 0, attempts: 0 } };
  for (const [id, x] of [['morpheus', -3], ['seraph', 3]] as const) {
    const ally = world.agents.get(id)!; ally.position = filmPosition('film_club_hel', x, -26); ally.rotation = Math.PI;
    ally.currentLocation = 'film_club_hel'; ally.isInMatrix = true;
  }
  const players = new PlayerController(world, { interrupt() {}, isAgentInConversation: () => false, startConversation: () => false } as unknown as ConversationEngine,
    { execute() {} } as unknown as ActionExecutor, { record() {} } as unknown as WorldDynamics, sandbox);
  return { world, sandbox, trinity, players, film: sandbox.life.film, state: sandbox.life.film.state! };
}

test('G starts a saved three-person surrender instead of instantly deleting the guns', () => {
  const h = setup(), start = { ...h.trinity.position };
  h.film.command(h.trinity, 'act', 1);
  assert.equal(h.state.step, 0); assert.equal(h.state.helBargain?.phase, 'disarming');
  assert.deepEqual(h.trinity.position, start); assert.equal(h.trinity.health, 47);
  assert.equal(h.trinity.currentAction?.parameters.armed, true);
  for (const id of ['trinity', 'morpheus', 'seraph'])
    assert.equal((h.world.agents.get(id)!.currentAction?.parameters.helDisarm as { role: string }).role, id);
  h.film.command(h.trinity, 'act', 2); assert.equal(h.state.step, 0, 'G cannot skip the physical surrender');
});

test('a held companion prevents surrender without taking over their body', () => {
  const h = setup(), seraph = h.world.agents.get('seraph')!;
  seraph.controller = 'other'; const before = JSON.stringify(seraph);
  h.film.command(h.trinity, 'act', 1);
  assert.equal(h.state.helBargain?.phase, 'armed'); assert.equal(h.state.step, 0);
  assert.equal(JSON.stringify(seraph), before);
});

test('living Trinity keeps her wounds when retrying a failed standoff', () => {
  const h = setup(); h.state.step = 3; h.state.helBargain!.phase = 'failed';
  h.film.command(h.trinity, 'retry', 1);
  assert.equal(h.state.helBargain?.phase, 'ready'); assert.equal(h.trinity.health, 47);
});

test('the Hel VIP platform and every visible tread share the actual floor height', () => {
  const center = FILM_SETS.film_club_hel.center;
  for (const [z, rise] of [[-22, 0], [-24, .4], [-25.6, .8], [-27.2, 1.2], [-28.8, 1.6], [-33, 1.6]]) {
    const point = { x: center.x, y: center.y + rise, z: center.z + z };
    assert.ok(Math.abs(groundHeight(point, true) - point.y) < .001, `wrong tread at ${z}`);
  }
});

test('surrender pauses on release and a cold restore keeps all three physical poses and the saved weapon clock', () => {
  const h = setup(); h.players.possess('hel-player', 'trinity', 0); h.film.command(h.trinity, 'act', 1);
  h.players.receiveInput('hel-player', { x: 1, z: 0, jump: true, yaw: 0, sequence: 1 });
  for (let frame = 0; frame < 25; frame++) h.players.step(.1, true, 1);
  assert.equal(h.state.helBargain!.disarm!.elapsed, 2.500000000000001);
  const position = { ...h.trinity.position }, elapsed = h.state.helBargain!.disarm!.elapsed;
  for (let frame = 0; frame < 10; frame++) h.players.step(.1, false, 1);
  assert.deepEqual(h.trinity.position, position); assert.equal(h.state.helBargain!.disarm!.elapsed, elapsed);
  h.players.release('hel-player', 1); const poses = HEL_TRIO.map(id => JSON.stringify(h.world.agents.get(id)!.currentAction));
  for (let tick = 2; tick < 20; tick++) h.sandbox.tick(tick);
  assert.equal(h.state.helBargain!.disarm!.elapsed, elapsed);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  assert.deepEqual(HEL_TRIO.map(id => JSON.stringify(h.world.agents.get(id)!.currentAction)), poses);
  h.players.possess('hel-player', 'trinity', 20);
  for (let frame = 0; frame < 11; frame++) h.players.step(.1, true, 20);
  assert.equal(h.film.state!.step, 1); assert.equal(h.film.state!.helBargain!.phase, 'disarmed');
  assert.equal(h.film.state!.helBargain!.disarm!.elapsed, 3.5);
});

test('a dead or newly occupied companion pauses the weapon handoff and never gets healed or moved', () => {
  const h = setup(); h.players.possess('hel-player', 'trinity', 0); h.film.command(h.trinity, 'act', 1);
  h.players.step(.5, true, 1); const seraph = h.world.agents.get('seraph')!, age = h.state.helBargain!.disarm!.elapsed;
  seraph.controller = 'other'; const occupied = JSON.stringify(seraph);
  for (let frame = 0; frame < 30; frame++) h.players.step(.1, true, 1);
  assert.equal(h.state.helBargain!.disarm!.elapsed, age); assert.equal(JSON.stringify(seraph), occupied);
  delete seraph.controller; seraph.status = 'dead'; seraph.health = 0; const dead = JSON.stringify(seraph);
  for (let frame = 0; frame < 30; frame++) h.players.step(.1, true, 1);
  assert.equal(h.state.helBargain!.disarm!.elapsed, age); assert.equal(JSON.stringify(seraph), dead);
});

test('entering the confrontation keeps the real coat-check wounds, empty supplies and companion positions', () => {
  const h = setup(); h.state.scene = 'm3_hel_entry'; h.state.step = FILM_SCENE_BY_ID.m3_hel_entry.steps.length;
  h.state.completed = ['m3_hel_entry']; h.sandbox.state.profiles.trinity.inventory.medkit = 0;
  h.trinity.activeEffects = [{ abilityId: 'hel-wound', remainingTicks: 10, visualEffect: '' }];
  const effects = JSON.stringify(h.trinity.activeEffects);
  const morpheus = h.world.agents.get('morpheus')!, seraph = h.world.agents.get('seraph')!;
  morpheus.health = 23; seraph.health = 17;
  const positions = [morpheus, seraph].map(member => ({ ...member.position }));
  h.film.command(h.trinity, 'next', 1);
  assert.equal(h.state.scene, 'm3_hel_bargain'); assert.equal(h.trinity.health, 47);
  assert.equal(morpheus.health, 23); assert.equal(seraph.health, 17);
  assert.equal(h.sandbox.state.profiles.trinity.inventory.medkit, 0);
  assert.equal(JSON.stringify(h.trinity.activeEffects), effects);
  assert.deepEqual([morpheus, seraph].map(member => member.position), positions);
});

test('entering the confrontation waits for living, available cast without reviving or taking over them', () => {
  for (const id of ['morpheus', 'seraph', 'merovingian', 'persephone', 'trainman']) for (const blocked of ['dead', 'occupied']) {
    const h = setup(); h.state.scene = 'm3_hel_entry'; h.state.step = FILM_SCENE_BY_ID.m3_hel_entry.steps.length;
    const member = h.world.agents.get(id)!;
    if (blocked === 'dead') { member.status = 'dead'; member.health = 0; }
    else member.controller = 'other';
    const before = JSON.stringify(member), position = { ...h.trinity.position }, health = h.trinity.health;
    h.film.command(h.trinity, 'next', 1);
    assert.equal(h.state.scene, 'm3_hel_entry', `${id} ${blocked}`);
    assert.equal(JSON.stringify(member), before); assert.deepEqual(h.trinity.position, position);
    assert.equal(h.trinity.health, health);
  }
});

test('entering the confrontation waits for companions to walk from the heavy door to the VIP stairs', () => {
  const h = setup(); h.state.scene = 'm3_hel_entry'; h.state.step = FILM_SCENE_BY_ID.m3_hel_entry.steps.length;
  h.state.helDanceDoor = { phase: 'open', elapsed: 1, lastTick: 0, allyTick: 0 };
  const allies = ['morpheus', 'seraph'].map(id => h.world.agents.get(id)!);
  for (const [index, ally] of allies.entries()) ally.position = filmPosition('film_club_hel', index ? 2.5 : -2.5, 4);
  const positions = allies.map(ally => ({ ...ally.position }));
  h.film.command(h.trinity, 'next', 1);
  assert.equal(h.state.scene, 'm3_hel_entry', 'G must not start a surrender with the companion thirty metres behind');
  assert.deepEqual(allies.map(ally => ally.position), positions);
  for (let tick = 2; tick < 16; tick++) h.sandbox.tick(tick);
  for (const ally of allies) {
    assert.ok(Math.hypot(ally.position.x - h.trinity.position.x, ally.position.z - h.trinity.position.z) <= 8);
    assert.equal(ally.position.y, groundHeight(ally.position, true));
  }
  h.film.command(h.trinity, 'next', 16);
  assert.equal(h.state.scene, 'm3_hel_bargain'); assert.equal(h.trinity.health, 47);
});

test('a pre-terrace VIP save is raised onto its tread without sending the player back to the elevator', () => {
  const h = setup(); h.state.scene = 'm3_hel_entry'; h.state.step = FILM_SCENE_BY_ID.m3_hel_entry.steps.length;
  delete h.trinity.controller;
  h.trinity.position.y = FILM_SETS.film_club_hel.center.y; h.state.checkpoint = { ...h.trinity.position };
  const position = { ...h.trinity.position };
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  h.players.possess('hel-player', 'trinity', 1);
  assert.equal(h.trinity.position.x, position.x); assert.equal(h.trinity.position.z, position.z);
  assert.equal(h.trinity.position.y, groundHeight(h.trinity.position, true));
  assert.equal(h.film.state!.checkpoint.y, h.trinity.position.y); assert.equal(h.trinity.health, 47);
});

test('reconnecting to the paused armed standoff restores all three held guns without advancing the scene', () => {
  const h = setup(); delete h.trinity.controller;
  h.film.restoreHelBargain(1); h.players.possess('hel-player', 'trinity', 1);
  for (const id of HEL_TRIO) assert.equal(h.world.agents.get(id)!.currentAction?.parameters.armed, true, id);
  assert.equal(h.state.step, 0); assert.equal(h.state.helBargain?.phase, 'armed'); assert.equal(h.trinity.health, 47);
});

function breakout() {
  const h = setup(); h.players.possess('hel-player', 'trinity', 0);
  h.state.step = 3; h.state.helBargain!.phase = 'counter';
  h.trinity.position = filmStepPosition(FILM_SCENE_BY_ID.m3_hel_bargain, FILM_SCENE_BY_ID.m3_hel_bargain.steps[3]);
  h.trinity.position.y = groundHeight(h.trinity.position, true);
  h.film.helBargainStrike(h.trinity, 1);
  return h;
}

test('catching the Hel pistol takes a saved hand motion and G cannot skip directly to the threat', t => {
  const h = breakout();
  assert.ok(h.state.helBargain!.breakout, 'the kick must keep its real starting gun and actor positions');
  for (let frame = 0; frame < 31; frame++) h.players.step(.1, true, 1);
  h.film.command(h.trinity, 'act', 1);
  t.diagnostic(JSON.stringify({ phase: h.state.helBargain, position: h.trinity.position, yaw: h.trinity.rotation, text: h.state.lastText }));
  assert.equal(h.state.step, 4); assert.equal(h.state.helBargain!.phase, 'catching');
  h.film.command(h.trinity, 'act', 2); assert.equal(h.state.step, 4, 'G cannot finish the hand movement');
  const point = { ...h.trinity.position }, elapsed = h.state.helBargain!.elapsed;
  h.players.step(.2, false, 2); assert.deepEqual(h.trinity.position, point); assert.equal(h.state.helBargain!.elapsed, elapsed);
  h.players.release('hel-player', 2);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  assert.equal(h.film.state!.helBargain!.phase, 'catching'); assert.equal(h.film.state!.helBargain!.elapsed, elapsed);
  h.players.possess('hel-player', 'trinity', 2);
  for (let frame = 0; frame < 8; frame++) h.players.step(.1, true, 2);
  assert.equal(h.film.state!.step, 5); assert.equal(h.film.state!.helBargain!.phase, 'gunpoint');
  assert.equal(h.trinity.health, 47); assert.equal(h.trinity.currentAction?.parameters.armed, true);
});

test('a paused or unavailable Seraph cannot advance the physical kick and catch window', () => {
  const h = breakout(), seraph = h.world.agents.get('seraph')!;
  h.players.step(.3, true, 1); const elapsed = h.state.helBargain!.elapsed;
  h.players.step(.4, false, 1); assert.equal(h.state.helBargain!.elapsed, elapsed);
  seraph.status = 'dead'; seraph.health = 0; const before = JSON.stringify(seraph);
  for (let frame = 0; frame < 40; frame++) h.players.step(.1, true, 1);
  assert.equal(h.state.helBargain!.elapsed, elapsed); assert.equal(JSON.stringify(seraph), before);
  h.film.command(h.trinity, 'act', 1); assert.equal(h.state.step, 4); assert.equal(h.state.helBargain!.phase, 'airborne');
});

test('the rescue handoff preserves Neo and Trinity wounds, effects and empty medicine', () => {
  const h = setup(); h.players.possess('hel-player', 'trinity', 0);
  h.state.step = FILM_SCENE_BY_ID.m3_hel_bargain.steps.length; h.state.helBargain!.phase = 'released';
  const neo = h.world.agents.get('neo')!; neo.health = 61;
  for (const member of [neo, h.trinity]) {
    member.activeEffects = [{ abilityId: 'hel-wound', remainingTicks: 10, visualEffect: '' }];
    h.sandbox.state.profiles[member.id].inventory.medkit = 0;
  }
  const effects = [neo, h.trinity].map(member => JSON.stringify(member.activeEffects));
  h.film.command(h.trinity, 'next', 1);
  assert.equal(h.state.scene, 'm3_mobil_release'); assert.equal(h.state.actor, 'neo');
  assert.equal(neo.health, 61); assert.equal(h.trinity.health, 47);
  for (const [i, member] of [neo, h.trinity].entries()) {
    assert.equal(JSON.stringify(member.activeEffects), effects[i]); assert.equal(h.sandbox.state.profiles[member.id].inventory.medkit, 0);
  }
});

test('a dead or occupied rescue passenger cannot be revived or taken over by the next scene', () => {
  for (const id of ['neo', 'trainman']) for (const blocked of ['dead', 'occupied']) {
    const h = setup(); h.players.possess('hel-player', 'trinity', 0);
    h.state.step = FILM_SCENE_BY_ID.m3_hel_bargain.steps.length; h.state.helBargain!.phase = 'released';
    const member = h.world.agents.get(id)!;
    if (blocked === 'dead') { member.status = 'dead'; member.health = 0; }
    else member.controller = 'other';
    const before = JSON.stringify(member);
    h.film.command(h.trinity, 'next', 1);
    assert.equal(h.state.scene, 'm3_hel_bargain', `${id} ${blocked}`); assert.equal(JSON.stringify(member), before);
  }
});
