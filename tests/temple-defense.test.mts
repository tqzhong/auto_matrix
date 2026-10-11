import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SCENES, FILM_SCENE_BY_ID, TEMPLE_DEFENSE, filmEntry, filmPosition, filmStepPosition, newTempleDefense, playerBlocked, stepPlayer, type WorldEvent } from '@auto_matrix/shared';
import { ZionHomecomingRenderer } from '../packages/client/src/engine/ZionHomecomingRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

function game(entry = false) {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 81);
  const players = new PlayerController(world, { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine,
    { execute() {} } as unknown as ActionExecutor, dynamics, sandbox);
  players.possess('p', 'neo', 0); sandbox.life.begin(world.agents.get('neo')!, 0); sandbox.state.neoLife!.chapter = 1;
  players.sandboxAction('p', { kind: 'life', target: 'film:start' }, 1);
  const state = sandbox.life.film.state!;
  Object.assign(state, { scene: 'm3_temple_defense', actor: 'zee', step: entry ? 0 : 1, checkpoint: entry ? filmEntry(FILM_SCENE_BY_ID.m3_temple_defense) : filmStepPosition(FILM_SCENE_BY_ID.m3_temple_defense, FILM_SCENE_BY_ID.m3_temple_defense.steps[1]) });
  if (!entry) state.templeSeal = { ...newTempleDefense(2), phase: 'running' };
  players.possess('p', 'zee', 2); const actor = players.getAgent('p')!;
  Object.assign(actor, { position: { ...state.checkpoint }, currentLocation: FILM_SCENE_BY_ID.m3_temple_defense.set, isInMatrix: false });
  let tick = 3, frames = 0, sequence = 0;
  const command = (target: string) => players.sandboxAction('p', { kind: 'life', target: `film:${target}` }, tick);
  const frame = (count: number, focus: boolean, running = true, x = 0) => { for (let i = 0; i < count; i++) {
    players.receiveInput('p', { x, z: 0, yaw: Math.PI, jump: false, sprint: false, focus, sequence: ++sequence });
    players.step(.1, running, tick);
    if (++frames % 5 === 0 && running) sandbox.tick(++tick);
  } };
  return { world, sandbox, players, command, frame, actor, state: () => sandbox.life.film.state! };
}

test('a new temple entry waits for an explicit start through loading, movement input and save restoration', () => {
  const h = game(true), position = { ...h.actor.position };
  h.frame(450, true, true, 1);
  assert.equal(h.actor.status, 'alive', 'loading for longer than the deadline cannot kill Zee');
  assert.equal(h.state().templeSeal!.remaining, TEMPLE_DEFENSE.seconds);
  assert.equal(h.state().templeSeal!.elapsed, 0);
  assert.equal(h.state().step, 0);
  assert.deepEqual(h.actor.position, position, 'waiting cannot be used to walk to the guns before the clock starts');
  h.command('next'); assert.equal(h.state().scene, 'm3_temple_defense');
  h.players.release('p', 100); h.sandbox.restore(structuredClone(h.sandbox.state)); h.players.possess('p', 'zee', 100);
  h.frame(450, false);
  assert.equal(h.state().templeSeal!.remaining, TEMPLE_DEFENSE.seconds);
  h.command('act'); assert.equal(h.state().templeSeal!.phase, 'running');
  h.frame(10, false, true, 1);
  assert.ok(h.state().templeSeal!.remaining < TEMPLE_DEFENSE.seconds);
  assert.notDeepEqual(h.actor.position, position, 'explicit start unlocks the route and its original time pressure');
  const remaining = h.state().templeSeal!.remaining;
  h.command('act'); assert.equal(h.state().templeSeal!.remaining, remaining, 'repeated G cannot refill the clock');
});

test('starting temple preparation waits for occupied companions without consuming or resetting the deadline', () => {
  const h = game(true);
  h.players.possess('other', 'link', 3); h.command('act'); h.frame(450, false);
  assert.equal(h.state().templeSeal!.phase, 'ready'); assert.equal(h.state().templeSeal!.remaining, TEMPLE_DEFENSE.seconds);
  h.players.release('other', 100); h.command('act'); h.frame(10, false);
  const remaining = h.state().templeSeal!.remaining;
  assert.equal(h.state().templeSeal!.phase, 'running'); assert.ok(remaining < TEMPLE_DEFENSE.seconds);
  h.players.release('p', 101); h.sandbox.restore(structuredClone(h.sandbox.state)); h.players.possess('p', 'zee', 101);
  assert.equal(h.state().templeSeal!.phase, 'running'); assert.equal(h.state().templeSeal!.remaining, remaining);
});

test('temple fortification prepares artillery; the city breach follows Trinity’s farewell', () => {
  const preparation = FILM_SCENE_BY_ID.m3_temple_defense;
  assert.match(preparation.steps[1].label, /炮位/);
  assert.ok(preparation.steps.every(step => !/卡榫|闸门/.test(step.label)));
  const ids = FILM_SCENES.map(scene => scene.id), breach = FILM_SCENE_BY_ID.m3_temple_breach;
  assert.ok(breach, 'the final city breach is a playable event');
  assert.equal(breach.actor, 'lock');
  assert.ok(ids.indexOf('m3_farewell') < ids.indexOf(breach.id));
  assert.ok(ids.indexOf(breach.id) < ids.indexOf('m3_deus'));
  assert.ok(breach.cast.includes('link') && breach.cast.includes('zee'));
});

test('standing at a temple mounting wheel cannot finish it without holding G', () => {
  const h = game(); h.command('act'); h.frame(38, false);
  assert.equal(h.state().step, 1, 'automatic interaction timers cannot tighten a mounting wheel');
  h.frame(11, true);
  const saved = structuredClone(h.state().templeSeal);
  assert.ok(saved?.turns?.[0] > 0 && saved.turns[0] < 1);
  h.frame(7, false); assert.deepEqual(h.state().templeSeal?.turns, saved.turns);
  h.frame(7, true, false); assert.deepEqual(h.state().templeSeal?.turns, saved.turns);
  h.players.release('p', 20); h.sandbox.tick(100);
  assert.deepEqual(h.state().templeSeal?.turns, saved.turns);
  const remaining = h.state().templeSeal!.remaining;
  h.sandbox.restore(structuredClone(h.sandbox.state)); h.players.possess('p', 'zee', 100);
  assert.deepEqual(h.state().templeSeal?.turns, saved.turns);
  assert.equal(h.state().templeSeal!.remaining, remaining);
});

test('occupied temple cast freezes fortification and keeps another player’s position', () => {
  const h = game(); const link = h.world.agents.get('link')!;
  h.players.possess('other', 'link', 3); const position = { ...link.position }, controller = link.controller;
  h.command('act'); h.frame(45, true);
  assert.equal(h.state().step, 1);
  assert.deepEqual(h.state().templeSeal?.turns, [0, 0]);
  assert.deepEqual(link.position, position);
  assert.equal(link.controller, controller); assert.equal(h.players.getAgent('other')!.id, 'link');
  h.players.release('other', 20); h.command('act'); h.frame(45, true);
  assert.equal(h.state().step, 2);
});

test('temple artillery replaces the fictional closing door and its breach animation uses saved time', t => {
  const h = game(), journey = h.state(), root = new THREE.Group();
  const renderer = new ZionHomecomingRenderer(root, 'film_zion_temple'); t.after(() => renderer.dispose());
  renderer.update(journey, 0);
  assert.equal(root.getObjectByName('zion-temple-bulkhead'), undefined, 'the temple entrance stays open');
  const wheel = root.getObjectByName('temple-mount-wheel-0'); assert.ok(wheel, 'left artillery has its manual mounting wheel');
  journey.templeSeal!.turns = [.45, 0]; renderer.update(journey, 0);
  const angle = wheel.rotation.z; assert.ok(angle > .5);
  renderer.update(journey, 400); assert.equal(wheel.rotation.z, angle);
  Object.assign(journey, { scene: 'm3_temple_breach', actor: 'lock', step: 1, templeBreach: { phase: 'breach', elapsed: 3.8 } });
  renderer.update(journey, 0);
  const drill = root.getObjectByName('temple-city-digger'); assert.ok(drill);
  const position = drill.position.clone(); renderer.update(journey, 600); assert.ok(position.equals(drill.position));
  const restoredRoot = new THREE.Group(), restored = new ZionHomecomingRenderer(restoredRoot, 'film_zion_temple');
  t.after(() => restored.dispose()); restored.update(structuredClone(journey), 0);
  assert.ok(restoredRoot.getObjectByName('temple-city-digger')!.position.equals(position));
});

test('completed legacy temple saves retain completion without replaying the new fortification', () => {
  const h = game(), state = h.state();
  state.completed.push('m3_temple_defense'); state.step = 3;
  state.templeSeal = { phase: 'sealed', remaining: 8, lastTick: 4, attempts: 2 };
  h.players.release('p', 4); h.players.possess('p', 'zee', 4); h.frame(1, false, false);
  assert.equal(state.step, FILM_SCENE_BY_ID.m3_temple_defense.steps.length);
  assert.equal(state.templeSeal.attempts, 2);
  assert.equal(state.templeSeal.remaining, 8);
  assert.deepEqual(state.templeSeal.turns, [1, 1]);
});

test('breach dust dissipates during the saved wait and cannot remain as frozen clouds during the ceasefire', t => {
  const h = game(), journey = h.state(), root = new THREE.Group();
  const renderer = new ZionHomecomingRenderer(root, 'film_zion_temple'); t.after(() => renderer.dispose());
  Object.assign(journey, { scene: 'm3_temple_breach', actor: 'lock', step: 1, templeBreach: { phase: 'breach', elapsed: 8.2 } });
  renderer.update(journey, 0);
  const dust = root.getObjectByName('temple-breach-dust') as THREE.InstancedMesh;
  const opacity = () => Array.from(dust.geometry.getAttribute('cloudOpacity').array).slice(0, dust.count);
  const transforms = () => Array.from(dust.instanceMatrix.array).slice(0, dust.count * 16);
  const lastBreach = opacity(), matrices = transforms();
  assert.ok(lastBreach.some(value => value > 0), 'the final falling fragments still raise dust');
  journey.templeBreach = { phase: 'waiting', elapsed: 0 }; renderer.update(journey, 0);
  assert.deepEqual(opacity(), lastBreach, 'the phase boundary cannot pop the dust');
  assert.deepEqual(transforms(), matrices);
  journey.templeBreach.elapsed = 2; renderer.update(journey, 0); const midway = opacity(), positions = transforms();
  assert.ok(midway.reduce((sum, value) => sum + value, 0) < lastBreach.reduce((sum, value) => sum + value, 0));
  renderer.update(journey, 300); assert.deepEqual(opacity(), midway); assert.deepEqual(transforms(), positions);
  const restoredRoot = new THREE.Group(), restored = new ZionHomecomingRenderer(restoredRoot, 'film_zion_temple'); t.after(() => restored.dispose());
  restored.update(structuredClone(journey), 0);
  const loaded = restoredRoot.getObjectByName('temple-breach-dust') as THREE.InstancedMesh;
  assert.deepEqual(Array.from(loaded.instanceMatrix.array).slice(0, loaded.count * 16), positions);
  assert.deepEqual(Array.from(loaded.geometry.getAttribute('cloudOpacity').array).slice(0, loaded.count), midway);
  journey.templeBreach = { phase: 'done', elapsed: 0 }; journey.scene = 'm3_ceasefire'; journey.completed.push('m3_temple_breach');
  renderer.update(journey, 0); assert.equal(dust.count, 0, 'the later withdrawal must not inherit frozen breach dust');
});

test('physical artillery and its approach keep the existing podium route traversable', () => {
  const h = game(), scene = FILM_SCENE_BY_ID.m3_temple_defense;
  for (const obstacle of TEMPLE_DEFENSE.obstacles) assert.equal(playerBlocked(filmPosition(scene.set, obstacle.x, obstacle.z), false, 1.1, h.sandbox.state.structures), true);
  for (const step of scene.steps) assert.equal(playerBlocked(filmStepPosition(scene, step), false, 1.1, h.sandbox.state.structures), false, step.label);
  let position = filmStepPosition(scene, scene.steps[1]), velocity = { x: 0, z: 0 };
  const end = filmStepPosition(scene, scene.steps[2]);
  for (let i = 0; i < 240 && Math.hypot(position.x - end.x, position.z - end.z) > .7; i++) {
    const next = stepPlayer(position, 0, { x: 1, z: 0, yaw: Math.PI / 2, sprint: true, jump: false }, .05, false, h.sandbox.state.structures, velocity);
    position = next.position; velocity = next.horizontalVelocity;
  }
  assert.ok(Math.hypot(position.x - end.x, position.z - end.z) < .7, 'the artillery cannot trap the player behind the rostrum');
});

test('both manually secured guns stop the setup deadline; returning to the crowd hands off to Logos', () => {
  const h = game(), state = h.state(), scene = FILM_SCENE_BY_ID.m3_temple_defense;
  state.emp = { firedAt: 1, elapsed: 9 }; state.completed.push('m3_emp', 'm3_shaft_seal');
  h.command('act'); h.frame(43, true); assert.equal(state.step, 2);
  h.actor.position = filmStepPosition(scene, scene.steps[2]); h.command('act'); h.frame(43, true);
  assert.equal(state.step, 3); assert.equal(state.templeSeal!.phase, 'sealed'); assert.deepEqual(state.templeSeal!.turns, [1, 1]);
  const remaining = state.templeSeal!.remaining; h.frame(70, false);
  assert.equal(state.templeSeal!.remaining, remaining); assert.equal(state.step, 3, 'Zee must personally return to the shelter');
  h.actor.position = filmStepPosition(scene, scene.steps[3]); h.frame(40, false);
  assert.ok(state.completed.includes(scene.id)); h.command('next');
  assert.equal(state.scene, 'm3_defense'); assert.equal(state.actor, 'trinity');
  assert.deepEqual(state.templeSeal!.turns, [1, 1]); assert.equal(state.emp!.firedAt, 1);
});

test('a timed preparation failure retries only the temple and preserves the spent EMP and past casualties', () => {
  const h = game(), state = h.state(); state.emp = { firedAt: 1, elapsed: 9 };
  state.completed.push('m3_dock_battle', 'm3_upper_digger', 'm3_shaft_seal');
  const mifune = h.world.agents.get('mifune')!, charra = h.world.agents.get('charra')!;
  mifune.status = charra.status = 'dead'; mifune.health = charra.health = 0;
  h.frame(440, false); assert.equal(state.templeSeal!.phase, 'failed'); assert.equal(h.actor.status, 'dead');
  h.command('retry'); assert.equal(state.step, 0); assert.equal(h.actor.status, 'alive');
  assert.equal(state.templeSeal!.attempts, 1); assert.deepEqual(state.templeSeal!.turns, [0, 0]);
  h.frame(450, false); assert.equal(state.templeSeal!.phase, 'ready'); assert.equal(state.templeSeal!.remaining, TEMPLE_DEFENSE.seconds);
  h.command('act'); assert.equal(state.templeSeal!.phase, 'running');
  assert.equal(state.emp!.firedAt, 1); assert.ok(state.completed.includes('m3_shaft_seal'));
  assert.equal(mifune.status, 'dead'); assert.equal(charra.status, 'dead');
});

test('the final city breach freezes on pause and disconnect and returns control to Neo after Link’s wait', () => {
  const h = game(), state = h.state(); state.completed.push('m3_farewell', 'm3_temple_defense');
  Object.assign(state, { scene: 'm3_farewell', actor: 'neo', step: FILM_SCENE_BY_ID.m3_farewell.steps.length });
  h.players.possess('p', 'neo', 3); h.command('next');
  assert.equal(state.scene, 'm3_temple_breach'); assert.equal(h.players.getAgent('p')!.id, 'lock');
  const lock = h.players.getAgent('p')!, scene = FILM_SCENE_BY_ID.m3_temple_breach;
  lock.position = filmStepPosition(scene, scene.steps[0]); h.frame(1, false); assert.equal(state.step, 1);
  h.command('act'); h.frame(Math.ceil(TEMPLE_DEFENSE.breach.orders * 10) + 14, false); assert.equal(state.templeBreach!.phase, 'breach');
  const saved = structuredClone(state.templeBreach); h.frame(20, false, false); assert.deepEqual(state.templeBreach, saved);
  h.players.release('p', 20); h.sandbox.tick(100); assert.deepEqual(state.templeBreach, saved);
  h.sandbox.restore(structuredClone(h.sandbox.state)); h.players.possess('p', 'lock', 100);
  assert.deepEqual(h.state().templeBreach, saved);
  h.frame(130, false); assert.equal(h.state().templeBreach!.phase, 'done');
  assert.ok(h.state().completed.includes(scene.id)); h.command('next');
  assert.equal(h.state().scene, 'm3_deus'); assert.equal(h.players.getAgent('p')!.id, 'neo');
  assert.equal(h.world.agents.get('trinity')!.status, 'dead');
});
