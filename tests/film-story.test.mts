import { RELOADED, RELOADED_FINALE } from '@auto_matrix/shared';
import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SETS, FILM_SCENES, FILM_SCENE_BY_ID, FILM_CAST, NEO_CHAPTERS, CHARACTERS, RESCUE, RESCUE_LOADOUTS, GOVERNMENT_RESCUE, AIR_RESCUE, MATRIX_ESCAPE, THE_ONE, SMITH_FINALE, OPENING_HOTEL, OPENING_ESCAPE, PILL_ROOM, PILL_TIMING, MIRROR_TOUCH, MIRROR_SEAT, MIRROR_TRINITY, MIRROR_TIMING, DOCK_GUNNERY, awakeningPose, mirrorSilver, filmReflections, filmStepActionReady, filmStepPosition, filmEntry, filmPosition, groundHeight, playerBlocked, stepPlayer, newFreewayRide, stepFreeway, freewayTraffic, newGarageEscape, stepGarageEscape, ambushCat, neoSkillUnlocked, type AgentState, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';
import { musicForScene } from '../packages/client/src/engine/Soundtrack.js';
import { HOTEL_ROUTE, HOTEL_DOOR_PROGRESS } from '@auto_matrix/shared';
import { hammerCenter, LOGOS_DEFENSE } from '@auto_matrix/shared';

function setup() {
  const world = new WorldState(); const manager = new AgentManager(world); manager.initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const conversations = { interrupt() {}, isAgentInConversation: () => false, startConversation: () => false } as unknown as ConversationEngine;
  const attacked: string[] = [];
  const actions = { execute: (_actor: AgentState, action: { target?: string }) => attacked.push(action.target ?? '') } as unknown as ActionExecutor;
  const players = new PlayerController(world, conversations, actions, dynamics, sandbox);
  players.possess('film-player', 'neo', 0); sandbox.life.begin(world.agents.get('neo')!, 0);
  sandbox.state.neoLife!.chapter = 1;
  let tick = 0;
  const command = (target: string) => players.sandboxAction('film-player', { kind: 'life', target: `film:${target}` }, ++tick);
  const advance = (amount = 1) => { for (let i = 0; i < amount; i++) sandbox.tick(++tick); };
  return { world, manager, sandbox, players, command, advance, attacked, actor: () => players.getAgent('film-player')!, tick: () => tick };
}

test('all trilogy scenes have distinct stable IDs, existing cast, accessible objectives and authored locations', () => {
  assert.equal(new Set(FILM_SCENES.map(s => s.id)).size, FILM_SCENES.length);
  assert.equal(new Set(FILM_SCENES.map(s => s.set)).size, Object.keys(FILM_SETS).length);
  for (const id of FILM_CAST) assert.ok(CHARACTERS[id], `missing cast: ${id}`);
  for (const scene of FILM_SCENES) {
    const set = FILM_SETS[scene.set]; assert.ok(set, scene.id);
    assert.ok(set.film.includes(scene.film), scene.id);
    assert.ok(NEO_CHAPTERS.some(c => c.id === scene.chapter), scene.id);
    // The second apartment wake begins as a locked bed performance; its first
    // walkable position is the bedside route verified in wake-call.test.
    const stagedEntry = scene.id === 'm1_wake_again';
    assert.equal(playerBlocked(filmEntry(scene), set.world === 'matrix'), stagedEntry, `${scene.id}: entry`);
    for (const step of scene.steps) {
      // These targets are seats inside a solid vehicle, reached by boarding.
      // meeting.test exercises that route and character-asset.test checks the seats.
      const stagedInsideProp = scene.id === 'm1_bug' && scene.steps.indexOf(step) < 2 || scene.id === 'm1_recovery' && scene.steps.indexOf(step) === 0;
      assert.equal(playerBlocked(filmStepPosition(scene, step), set.world === 'matrix'), stagedInsideProp, `${scene.id}: ${step.label}`);
    }
    if (scene.steps.some(s => s.kind === 'reflect') && !['m1_pills', 'm1_ledge', 'm1_wake_up'].includes(scene.id)) assert.equal(filmReflections(scene.id).length, 3, `${scene.id}: dialogue must be playable`);
  }
  assert.equal(FILM_SCENE_BY_ID.m1_pills.set, 'film_lafayette');
  assert.equal(FILM_SCENE_BY_ID.m2_key_door.set, 'film_source_corridor');
  assert.notEqual(FILM_SCENE_BY_ID.m2_key_door.set, FILM_SCENE_BY_ID.m2_backdoors.set);
  assert.match(FILM_SETS.film_source_corridor.name, /工业|施工/);
  assert.equal(FILM_SCENE_BY_ID.m1_dejavu.set, 'film_ambush_house');
  assert.equal(FILM_SCENE_BY_ID.m3_bane.set, 'film_logos_deck');
  assert.equal(FILM_SCENE_BY_ID.m3_dock_battle.actor, 'mifune');
  assert.equal(FILM_SCENE_BY_ID.m3_deus.cast[0], 'deus_ex_machina');
});

test('distant bridge markers guide movement without offering a premature G action', () => {
  const bridge = FILM_SCENE_BY_ID.m1_bridge;
  const [walk, board] = bridge.steps;
  assert.equal(filmStepActionReady(bridge, walk, filmEntry(bridge), true), false);
  assert.equal(filmStepActionReady(bridge, walk, filmStepPosition(bridge, walk), true), false, 'arrival advances a walking step automatically');
  assert.equal(filmStepActionReady(bridge, board, filmEntry(bridge), true), false);
  assert.equal(filmStepActionReady(bridge, board, filmStepPosition(bridge, board), true), true);
  assert.equal(filmStepActionReady(bridge, board, filmStepPosition(bridge, board), false), false);
  const reflection = FILM_SCENE_BY_ID.m1_construct.steps.find(step => step.kind === 'reflect')!;
  assert.equal(filmStepActionReady(FILM_SCENE_BY_ID.m1_construct, reflection,
    filmStepPosition(FILM_SCENE_BY_ID.m1_construct, reflection), true), false, 'a reflection belongs in the journal, not the G button');
});

test('Neo must steer through the city and catch the falling Trinity before impact', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: 'm2_catch', actor: 'neo', step: 0, catch: undefined });
  h.actor().currentLocation = 'film_trinity_roof'; h.actor().position = filmEntry(FILM_SCENE_BY_ID.m2_catch);
  h.sandbox.life.film.catch.frame(h.actor(), { x: 0, z: 0, focus: false }, 0, h.tick());
  assert.equal(state.catch?.phase, 'launch');
  h.command('act'); assert.equal(state.catch?.phase, 'flight');
  for (let i = 0; i < 90; i++) h.players.step(.1, true, h.tick());
  assert.equal(state.catch?.phase, 'failed'); assert.equal(state.step, 1);
  h.command('retry'); assert.equal(state.catch?.phase, 'launch');
  assert.equal(state.catch?.attempt, 1);
  h.command('act');
  let sequence = 0;
  for (let i = 0; i < 70 && state.catch?.phase === 'flight'; i++) {
    const x = i < 6 ? -1 : 0;
    const z = i < 24 ? -1 : 0;
    h.players.receiveInput('film-player', { x, z, yaw: Math.PI, jump: false, sprint: false, focus: false, sequence: ++sequence });
    h.players.step(.1, true, h.tick());
    if (i >= 52 && state.catch?.phase === 'flight') h.command('act');
  }
  assert.equal(state.catch?.phase, 'ascent'); assert.equal(state.step, 2);
  for (let i = 0; i < 32; i++) h.players.step(.1, true, h.tick());
  assert.equal(state.catch?.phase, 'extract_ready');
});

test('Trinity revival needs deliberate code focus and three timed pulses, and survives a saved retry', () => {
  const h = setup(); h.command('continue'); let state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: 'm2_catch', actor: 'neo', step: 2,
    catch: { phase: 'extract_ready', elapsed: 0, attempt: 0, x: 0, z: -15, focus: 0, beats: 0, misses: 0 } });
  h.actor().currentLocation = 'film_trinity_roof'; h.actor().position = filmPosition('film_trinity_roof', 0, -15);
  h.command('act'); assert.equal(state.catch?.phase, 'extracting');
  for (let i = 0; i < 11; i++) h.sandbox.life.film.catch.frame(h.actor(), { x: 0, z: 0, focus: true }, .1, ++state.enteredAt);
  assert.equal(state.catch?.phase, 'extracting'); assert.ok((state.catch?.focus ?? 0) > 1);
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)); h.sandbox.restore(saved);
  state = h.sandbox.life.film.state!;
  for (let i = 0; i < 16; i++) h.sandbox.life.film.catch.frame(h.actor(), { x: 0, z: 0, focus: true }, .1, ++state.enteredAt);
  assert.equal(state.catch?.phase, 'pulse'); assert.equal(state.step, 3);
  for (let i = 0; i < 50; i++) h.sandbox.life.film.catch.frame(h.actor(), { x: 0, z: 0, focus: false }, .1, ++state.enteredAt);
  assert.equal(state.catch?.phase, 'pulse', 'the rhythm keeps looping while the player loads or observes it');
  for (let i = 0; i < 3; i++) h.players.act('film-player', 'attack', ++state.enteredAt);
  assert.equal(state.catch?.phase, 'failed');
  h.manager.updateAllAgents(state.enteredAt + 2); h.manager.updateAllAgents(state.enteredAt + 3);
  assert.equal(h.world.agents.get('trinity')?.currentAction?.parameters.catch?.role, 'trinity', 'Trinity stays on the roof while the pulse checkpoint waits');
  h.command('retry'); assert.equal(state.catch?.phase, 'pulse'); assert.equal(state.step, 3);
  for (let beat = 0; beat < 3; beat++) {
    for (let i = 0; i < 11; i++) h.sandbox.life.film.catch.frame(h.actor(), { x: 0, z: 0, focus: false }, .1, ++state.enteredAt);
    h.players.act('film-player', 'attack', ++state.enteredAt);
  }
  assert.equal(state.catch?.phase, 'done'); assert.ok(state.completed.includes('m2_catch'));
});

test('the bomb begins only after Morpheus orders evacuation, pauses without a player, and retries from the cargo checkpoint', () => {
  const h = setup(); h.command('continue'); let state = h.sandbox.life.film.state!;
  const scene = FILM_SCENE_BY_ID.m2_ship_lost;
  Object.assign(state, { scene: scene.id, actor: 'morpheus', step: 2,
    shipLoss: { phase: 'briefing', remaining: RELOADED_FINALE.evacuationSeconds, lastTick: h.tick(), attempts: 0 } });
  h.players.possess('film-player', 'morpheus', h.tick()); h.actor().currentLocation = scene.set; h.actor().isInMatrix = false;
  h.actor().position = filmStepPosition(scene, scene.steps[2]);
  h.advance(15); assert.equal(state.shipLoss?.remaining, RELOADED_FINALE.evacuationSeconds);
  h.command('act'); assert.equal(state.step, 3); assert.equal(state.shipLoss?.phase, 'evacuating');
  state.completed.push('m1_lobby'); assert.match(h.command('visit:m1_lobby'), /先完成/);
  h.advance(5); const remaining = state.shipLoss!.remaining; assert.ok(remaining < RELOADED_FINALE.evacuationSeconds);
  h.players.release('film-player', h.tick()); h.advance(80); assert.equal(state.shipLoss?.remaining, remaining);
  h.players.possess('film-player', 'morpheus', h.tick());
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); state = h.sandbox.life.film.state!;
  assert.equal(state.shipLoss?.remaining, remaining); h.advance(65);
  assert.equal(state.shipLoss?.phase, 'failed'); assert.equal(state.step, 3);
  h.command('retry'); assert.equal(state.shipLoss?.phase, 'evacuating'); assert.equal(state.shipLoss?.attempts, 1);
  assert.deepEqual(h.actor().position, state.checkpoint);
  h.actor().position = filmStepPosition(scene, scene.steps[3]); h.advance();
  assert.equal(state.shipLoss?.phase, 'escaped'); assert.ok(state.completed.includes(scene.id));
});

test('Neo must face the real Sentinels and hold focus; the signal and pursuit survive a save', () => {
  const h = setup(); h.command('continue'); let state = h.sandbox.life.film.state!;
  const scene = FILM_SCENE_BY_ID.m2_stop_sentinels;
  Object.assign(state, { scene: scene.id, actor: 'neo', step: 0,
    tunnel: { phase: 'running', remaining: RELOADED_FINALE.sentinelSeconds, focus: 0, lastTick: h.tick(), attempts: 0 } });
  h.actor().currentLocation = scene.set; h.actor().isInMatrix = false; h.actor().position = filmStepPosition(scene, scene.steps[0]);
  h.advance(); assert.equal(state.step, 1); assert.equal(state.tunnel?.phase, 'sensing');
  let sequence = 0;
  const focus = (yaw: number, frames: number) => { for (let i = 0; i < frames; i++) {
    h.players.receiveInput('film-player', { x: 0, z: 0, yaw, jump: false, sprint: false, focus: true, sequence: ++sequence });
    h.players.step(.1, true, h.tick());
  } };
  focus(Math.PI, 10); assert.equal(state.tunnel?.focus, 0);
  focus(0, 10); assert.ok((state.tunnel?.focus ?? 0) > .9 && (state.tunnel?.focus ?? 0) < 1.1);
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)); h.sandbox.restore(saved); state = h.sandbox.life.film.state!;
  const before = state.tunnel!.remaining; h.players.release('film-player', h.tick()); h.advance(20);
  assert.equal(state.tunnel?.remaining, before);
  h.players.possess('film-player', 'neo', h.tick()); focus(0, 15);
  assert.equal(state.tunnel?.phase, 'collapsed'); assert.ok(state.completed.includes(scene.id));
  assert.equal(h.actor().health, 1);
});

test('Hammer reveals Neo and Bane on adjacent beds and hands the completed scene to Mobil Ave', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: 'm2_stop_sentinels', actor: 'neo', step: FILM_SCENE_BY_ID.m2_stop_sentinels.steps.length,
    tunnel: { phase: 'collapsed', remaining: 4, focus: RELOADED_FINALE.signalSeconds, lastTick: h.tick(), attempts: 0 } });
  h.command('next'); const medical = FILM_SCENE_BY_ID.m2_medical;
  assert.equal(state.scene, medical.id); assert.equal(h.actor().id, 'trinity');
  assert.equal(h.world.agents.get('neo')?.currentAction?.parameters.finaleComa, true);
  assert.equal(h.world.agents.get('bane')?.currentAction?.parameters.finaleComa, true);
  assert.equal(h.world.agents.get('neo')?.position.x - h.world.agents.get('bane')!.position.x, -20);
  assert.match(h.players.possess('other-player', 'bane', h.tick()).error ?? '', /昏迷/);
  h.actor().position = filmPosition(medical.set, -9, -22.5);
  assert.match(h.players.act('film-player', 'talk', h.tick()), /Maggie/);
  for (const step of medical.steps) { h.actor().position = filmStepPosition(medical, step); h.command('act'); h.advance(6); }
  assert.ok(state.completed.includes(medical.id));
  h.command('next'); assert.equal(state.scene, 'm3_mobil'); assert.equal(h.actor().id, 'neo');
});

test('story role handoffs never take a character away from another player', () => {
  const h = setup(); h.players.possess('other-player', 'trinity', 0);
  assert.match(h.command('start'), /另一位玩家/);
  assert.equal(h.sandbox.state.neoLife!.journey, undefined);
  assert.equal(h.actor().id, 'neo'); assert.equal(h.players.getAgent('other-player')!.id, 'trinity');
  h.players.release('other-player', 1);
  const changed: string[] = []; h.players.onStoryRole = (_socket, id) => changed.push(id);
  h.command('start'); assert.equal(h.actor().id, 'trinity'); assert.deepEqual(changed, ['trinity']);
  assert.equal(h.actor().currentLocation, FILM_SCENES[0].set);
});

test('remote interactions, premature next and unvisited scene jumps cannot advance the plot', () => {
  const h = setup(); h.command('start'); const state = h.sandbox.state.neoLife!.journey!;
  assert.match(h.command('act'), /走近/); assert.equal(state.started, undefined);
  assert.match(h.command('next'), /先完成/); assert.equal(state.scene, FILM_SCENES[0].id);
  assert.match(h.command('visit:m3_dawn'), /完成这个场景/); assert.equal(state.visiting, undefined);
  h.actor().position = filmStepPosition(FILM_SCENES[0], FILM_SCENES[0].steps[0]);
  h.command('act'); assert.equal(state.openingHotel?.phase, 'breach');
  assert.equal(state.step, 1); h.advance(4);
  assert.equal(state.openingHotel?.phase, 'combat'); assert.equal(h.sandbox.state.threats.length, 4);
});

test('a fight persists through simulation cleanup and can be retried after death without skipping it', () => {
  const h = setup(); h.command('start'); const state = h.sandbox.state.neoLife!.journey!;
  state.step = 1; h.actor().position = filmStepPosition(FILM_SCENES[0], FILM_SCENES[0].steps[1]); state.checkpoint = { ...h.actor().position };
  h.command('act'); h.advance(); assert.equal(h.sandbox.state.threats.length, 4);
  assert.match(h.command('next'), /先完成/);
  h.actor().health = 0; h.actor().status = 'dead';
  h.command('retry'); assert.equal(h.actor().status, 'alive'); assert.equal(state.step, 1); assert.equal(h.sandbox.state.threats.length, 4);
  assert.equal(state.openingHotel?.phase, 'combat'); assert.equal(state.openingHotel?.attempts, 1);
});

test('saved scene, active fight, role and completed history restore without restarting the route', () => {
  const h = setup(); h.command('start'); const state = h.sandbox.state.neoLife!.journey!;
  state.step = 1; h.actor().position = filmStepPosition(FILM_SCENES[0], FILM_SCENES[0].steps[1]); h.command('act');
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)); h.sandbox.restore(saved); h.advance();
  assert.equal(h.sandbox.life.film.state!.actor, 'trinity'); assert.equal(h.sandbox.life.film.state!.step, 1);
  assert.equal(h.sandbox.state.threats.length, 4);
  h.players.release('film-player', h.tick()); h.players.possess('film-player', 'trinity', h.tick());
  assert.equal(h.sandbox.life.film.state!.scene, 'm1_room303'); assert.equal(h.sandbox.state.threats.length, 4);
});

test('303 breach saves its timing, then Trinity disarms, shoots and reaches the fire escape in order', () => {
  const h = setup(); h.command('start'); let state = h.sandbox.life.film.state!;
  const actor = h.actor(); const hotel = h.sandbox.life.film.openingHotel;
  assert.equal(state.openingHotel?.phase, 'trace');
  assert.ok(h.sandbox.state.structures.some(structure => structure.id === 'film:hotel303:3'));
  actor.position = filmPosition('film_heart_hotel', OPENING_HOTEL.computer.x, OPENING_HOTEL.computer.z);
  h.command('act'); h.advance(); assert.equal(state.openingHotel?.phase, 'breach');
  assert.equal(state.openingHotel.elapsed, .5);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); state = h.sandbox.life.film.state!;
  h.advance(2); assert.equal(state.openingHotel?.phase, 'combat'); assert.equal(state.step, 1);
  assert.equal(h.sandbox.state.threats.length, 4);
  assert.deepEqual(h.sandbox.state.threats.map(threat => threat.character), ['citizen_4', 'citizen_14', 'citizen_10', 'citizen_13']);
  assert.ok(!h.sandbox.state.structures.some(structure => structure.id === 'film:hotel303:3'));
  const lead = h.sandbox.state.threats[0];
  for (let hit = 0; lead.health > 0 && hit < 6; hit++) {
    actor.position = { ...lead.position, z: lead.position.z + 2 }; actor.rotation = Math.PI;
    h.sandbox.attack(actor, h.tick(), hit % 3);
  }
  assert.equal(lead.health, 0); assert.ok(state.openingHotel?.fallen);
  actor.position = { ...state.openingHotel!.fallen! }; h.command('act');
  assert.equal(state.openingHotel?.disarmed, true); assert.equal(state.openingHotel.ammo, OPENING_HOTEL.magazine);
  actor.position = filmPosition('film_heart_hotel', 0, 0);
  for (const target of [...h.sandbox.state.threats]) {
    for (let shot = 0; target.health > 0 && shot < 3; shot++) {
      const yaw = Math.atan2(target.position.x - actor.position.x, target.position.z - actor.position.z);
      hotel.shoot(actor, yaw, 0, h.tick());
    }
    assert.equal(target.health, 0);
  }
  assert.equal(state.openingHotel!.shots, 6); assert.equal(state.openingHotel!.ammo, 2);
  h.advance(); assert.equal(state.openingHotel?.phase, 'phone'); assert.equal(state.step, 2);
  actor.position = filmPosition('film_heart_hotel', OPENING_HOTEL.phone.x, OPENING_HOTEL.phone.z);
  h.command('act'); assert.equal(state.step, 3); assert.match(state.lastText, /Wells/);
  actor.position = filmStepPosition(FILM_SCENES[0], FILM_SCENES[0].steps[3]); h.advance(); assert.equal(state.step, 4);
  actor.position = filmPosition('film_heart_hotel', OPENING_HOTEL.window.x, OPENING_HOTEL.window.z);
  h.command('act'); assert.equal(state.openingHotel?.phase, 'dive'); h.advance(4);
  assert.equal(state.openingHotel?.phase, 'ladder_ready'); assert.equal(state.step, 5);
  h.command('act'); assert.equal(state.openingHotel?.phase, 'climbing');
  let sequence = 0;
  for (let frame = 0; frame < 40 && state.openingHotel?.phase === 'climbing'; frame++) {
    h.players.receiveInput('film-player', { x: 0, z: 0, yaw: 0, jump: false, sprint: false, climb: 1, sequence: ++sequence });
    h.players.step(.1, true, h.tick());
  }
  assert.equal(state.openingHotel?.phase, 'done'); assert.ok(state.completed.includes('m1_room303'));
});

test('303 fire escape requires upward input and preserves climbing progress through a save and disconnect', () => {
  const h = setup(); h.command('start'); let state = h.sandbox.life.film.state!;
  state.step = 5; state.openingHotel!.phase = 'ladder_ready';
  h.actor().position = filmPosition('film_heart_hotel', 0, -30);
  h.command('act'); assert.equal(state.openingHotel?.phase, 'climbing');
  h.advance(20); assert.equal(state.openingHotel?.climbed, 0, 'waiting cannot climb the fire escape');
  h.players.receiveInput('film-player', { x: 0, z: 0, yaw: 0, jump: false, sprint: false, climb: 1, sequence: 1 });
  for (let frame = 0; frame < 10; frame++) h.players.step(.1, true, h.tick());
  const progress = state.openingHotel!.climbed!; assert.ok(progress > 1);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); state = h.sandbox.life.film.state!;
  h.advance(20); assert.equal(state.openingHotel?.climbed, progress);
  h.players.release('film-player', h.tick()); h.advance(20);
  assert.equal(state.openingHotel?.climbed, progress);
  h.players.possess('film-player', 'trinity', h.tick());
  h.players.receiveInput('film-player', { x: 0, z: 0, yaw: 0, jump: false, sprint: false, climb: 1, sequence: 2 });
  for (let frame = 0; frame < 50 && state.openingHotel?.phase === 'climbing'; frame++) h.players.step(.1, true, h.tick());
  assert.ok(state.completed.includes('m1_room303'));
});

test('303 combat can fail and retry, while disconnect freezes the breached-door sequence', () => {
  const h = setup(); h.command('start'); const state = h.sandbox.life.film.state!;
  h.actor().position = filmStepPosition(FILM_SCENES[0], FILM_SCENES[0].steps[0]);
  h.command('act'); h.advance(); const elapsed = state.openingHotel!.elapsed;
  h.players.release('film-player', h.tick()); h.advance(20);
  assert.equal(state.openingHotel!.elapsed, elapsed);
  h.players.possess('film-player', 'trinity', h.tick()); h.advance(2);
  assert.equal(state.openingHotel?.phase, 'combat');
  h.actor().position = filmPosition('film_heart_hotel', 0, -5);
  const before = h.actor().health; h.advance(30);
  assert.ok(h.actor().health < before, 'police fire must threaten a stationary player');
  h.actor().health = 0; h.actor().status = 'dead';
  h.command('retry'); assert.equal(state.openingHotel?.phase, 'combat'); assert.equal(state.openingHotel?.attempts, 1);
  assert.equal(h.actor().health, h.actor().maxHealth); assert.equal(h.sandbox.state.threats.length, 4);
});

test('303 door blocks movement before the breach and the same player controls can cross afterward', () => {
  const h = setup(); h.command('start'); const center = FILM_SETS.film_heart_hotel.center;
  const actor = h.actor(); let sequence = 0;
  const walk = (x: number, z: number, frames = 100) => {
    const target = filmPosition('film_heart_hotel', x, z);
    for (let frame = 0; frame < frames; frame++) {
      const dx = target.x - actor.position.x; const dz = target.z - actor.position.z; const length = Math.hypot(dx, dz);
      if (length < 1.1) break;
      h.players.receiveInput('film-player', { x: dx / length, z: dz / length, yaw: Math.atan2(dx, dz), jump: false, sprint: false, sequence: ++sequence });
      h.players.step(.1, true, h.tick());
    }
  };
  walk(0, -5); assert.ok(actor.position.z - center.z > OPENING_HOTEL.doorZ, 'closed door should stop the player');
  actor.position = filmPosition('film_heart_hotel', OPENING_HOTEL.computer.x, OPENING_HOTEL.computer.z);
  h.command('act'); h.advance(4); assert.equal(h.sandbox.life.film.state?.openingHotel?.phase, 'combat');
  walk(0, 6); walk(0, -5);
  assert.ok(Math.hypot(actor.position.x - center.x, actor.position.z - center.z + 5) < 1.1, 'the open door should be walkable');
  const glass = filmPosition('film_heart_hotel', 0, -26.5);
  assert.equal(playerBlocked(glass, true, 1, h.sandbox.state.structures), true, 'the intact window bars early exit');
  h.sandbox.life.film.state!.openingHotel!.phase = 'dive'; h.sandbox.life.film.openingHotel.sync();
  assert.equal(playerBlocked(glass, true, 1, h.sandbox.state.structures), false, 'the broken window opens the exterior platform');
});

test('Trinity must answer the Wells phone before the truck arrives; the countdown saves and retries', () => {
  const h = setup(); h.command('start'); let state = h.sandbox.life.film.state!;
  const scene = FILM_SCENE_BY_ID.m1_phone_escape;
  Object.assign(state, { scene: scene.id, step: 0, checkpoint: filmEntry(scene) });
  h.actor().currentLocation = scene.set; h.actor().position = filmEntry(scene);
  h.advance(2);
  assert.equal(state.openingPhone?.phase, 'running');
  const before = state.openingPhone!.remaining;
  h.players.release('film-player', h.tick()); h.advance(20);
  assert.equal(state.openingPhone!.remaining, before, 'disconnect pauses the approaching truck');
  h.players.possess('film-player', 'trinity', h.tick());
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); state = h.sandbox.life.film.state!;
  assert.equal(state.openingPhone!.remaining, before);
  h.advance(35);
  assert.equal(state.openingPhone?.phase, 'failed');
  assert.equal(state.step, 0); assert.match(h.command('next'), /先完成/);
  h.command('retry');
  assert.equal(state.openingPhone?.phase, 'running'); assert.equal(state.openingPhone?.attempts, 1);
  assert.deepEqual(h.actor().position, filmEntry(scene));
  h.actor().position = filmStepPosition(scene, scene.steps[0]); h.advance();
  assert.equal(state.step, 1);
  h.command('act');
  assert.equal(state.openingPhone?.phase, 'connected');
  assert.equal(h.sandbox.life.film.performing(h.actor()), true, 'the disconnected caller cannot walk into the truck impact');
  const exitedAt = { ...h.actor().position };
  h.players.receiveInput('film-player', { x: 1, z: 0, yaw: 0, jump: false, sprint: true, focus: false, sequence: 1 });
  h.players.step(.1, true, h.tick());
  assert.deepEqual(h.actor().position, exitedAt, 'movement input cannot move the disconnected caller');
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); state = h.sandbox.life.film.state!;
  assert.equal(h.sandbox.life.film.performing(h.actor()), true, 'the exit lock survives a save');
  h.advance(4); assert.equal(state.openingPhone?.phase, 'done');
  assert.equal(h.sandbox.life.film.performing(h.actor()), true, 'movement remains locked until the next scene');
  assert.ok(state.completed.includes(scene.id), 'answering immediately connects without a two-second wait');
});

test('Brown pursues Trinity across a real rooftop gap and a fall or capture restores the route', () => {
  const h = setup(); h.command('start'); const state = h.sandbox.life.film.state!;
  const scene = FILM_SCENE_BY_ID.m1_roofs;
  Object.assign(state, { scene: scene.id, step: 0, checkpoint: filmEntry(scene) });
  h.actor().currentLocation = scene.set; h.actor().position = filmEntry(scene);
  const brown = h.world.agents.get('agent_brown')!;
  brown.currentLocation = scene.set; brown.position = filmPosition(scene.set, 0, 43);
  assert.ok(groundHeight(filmPosition(scene.set, 0, -4), true) < filmEntry(scene).y - 10);
  const startZ = brown.position.z;
  h.advance(10);
  assert.ok(brown.position.z < startZ - 1, 'Brown leaves his staging mark');
  assert.equal(state.openingRoof?.phase, 'failed', 'standing still lets Brown catch the player');
  h.command('retry'); assert.equal(state.openingRoof?.phase, 'running');
  assert.equal(state.openingRoof?.attempts, 1); assert.equal(state.step, 0);
  h.actor().position = { ...filmPosition(scene.set, 0, -4), y: FILM_SETS[scene.set].center.y - 8 };
  h.advance(); assert.equal(state.openingRoof?.phase, 'failed', 'falling between roofs can fail the chase');
});

test('Brown leaps across the roof gap instead of running through empty air, and the leap survives a save', () => {
  const h = setup(); h.command('start'); let state = h.sandbox.life.film.state!;
  const roofs = FILM_SCENE_BY_ID.m1_roofs; const center = FILM_SETS[roofs.set].center;
  Object.assign(state, { scene: roofs.id, step: 1, checkpoint: filmEntry(roofs), openingRoof: { phase: 'running', lastTick: h.tick(), attempts: 0 } });
  h.actor().currentLocation = roofs.set; h.actor().position = filmPosition(roofs.set, 0, -20);
  const brown = h.world.agents.get('agent_brown')!;
  brown.currentLocation = roofs.set; brown.position = filmPosition(roofs.set, 0, 0);
  h.advance();
  assert.ok(brown.position.z - center.z < OPENING_ESCAPE.roofGapNear && brown.position.z - center.z > OPENING_ESCAPE.roofGapFar);
  assert.ok(brown.position.y > center.y + 1, 'Brown must be visibly airborne over the void');
  assert.ok(state.openingRoof?.leap && brown.currentAction?.parameters.openingRoofLeap);
  const elapsed = state.openingRoof!.leap!.elapsed;
  h.players.release('film-player', h.tick()); h.advance(20);
  assert.equal(state.openingRoof?.leap?.elapsed, elapsed, 'disconnect pauses the crossing');
  h.players.possess('film-player', 'trinity', h.tick());
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); state = h.sandbox.life.film.state!;
  assert.equal(state.openingRoof?.leap?.elapsed, elapsed);
  h.advance(3);
  assert.equal(state.openingRoof?.crossed, true);
  assert.equal(state.openingRoof?.leap, undefined);
  assert.ok(brown.position.z - center.z < OPENING_ESCAPE.roofGapFar && Math.abs(brown.position.y - center.y) < .01);
  assert.equal(state.openingRoof?.phase, 'running');
});

test('Trinity can walk from 303 through the roof gap and answer the phone without a player-position shortcut', () => {
  const h = setup(); h.command('start'); const state = h.sandbox.life.film.state!;
  const room = FILM_SCENE_BY_ID.m1_room303; const roofs = FILM_SCENE_BY_ID.m1_roofs; const phone = FILM_SCENE_BY_ID.m1_phone_escape;
  let sequence = 0; let jumped = false;
  const move = (x: number, z: number, jump = false) => {
    h.players.receiveInput('film-player', { x, z, yaw: Math.atan2(x, z), jump, sprint: true, sequence: ++sequence });
    h.players.step(.1, true, h.tick());
    if (sequence % 5 === 0) h.advance();
  };
  const walkTo = (set: string, x: number, z: number, frames = 100) => {
    const target = filmPosition(set, x, z);
    for (let frame = 0; frame < frames && Math.hypot(target.x - h.actor().position.x, target.z - h.actor().position.z) > 2.5; frame++) {
      const dx = target.x - h.actor().position.x; const dz = target.z - h.actor().position.z;
      const length = Math.hypot(dx, dz); move(dx / length, dz / length);
    }
    assert.ok(Math.hypot(target.x - h.actor().position.x, target.z - h.actor().position.z) <= 2.5, `cannot reach ${set}: ${x}, ${z}`);
  };
  walkTo(room.set, OPENING_HOTEL.computer.x, OPENING_HOTEL.computer.z);
  h.command('act'); h.advance(4); assert.equal(state.openingHotel?.phase, 'combat');
  const lead = h.sandbox.state.threats[0];
  for (let strike = 0; lead.health > 0 && strike < 6; strike++) {
    walkTo(room.set, lead.position.x - FILM_SETS[room.set].center.x, lead.position.z - FILM_SETS[room.set].center.z + 2);
    h.actor().rotation = Math.atan2(lead.position.x - h.actor().position.x, lead.position.z - h.actor().position.z);
    h.sandbox.attack(h.actor(), h.tick(), strike % 3);
  }
  assert.equal(lead.health, 0);
  const fallen = state.openingHotel!.fallen!;
  walkTo(room.set, fallen.x - FILM_SETS[room.set].center.x, fallen.z - FILM_SETS[room.set].center.z);
  h.command('act'); assert.equal(state.openingHotel?.disarmed, true);
  walkTo(room.set, 0, 0);
  for (const target of [...h.sandbox.state.threats]) for (let shot = 0; target.health > 0 && shot < 3; shot++) {
    h.sandbox.life.film.openingHotel.shoot(h.actor(), Math.atan2(target.position.x - h.actor().position.x, target.position.z - h.actor().position.z), 0, h.tick());
  }
  h.advance(); assert.equal(state.step, 2);
  walkTo(room.set, 0, 6); walkTo(room.set, -8, 18);
  h.command('act'); assert.equal(state.step, 3);
  walkTo(room.set, 0, 6); walkTo(room.set, 0, -18);
  h.advance(); assert.equal(state.step, 4);
  walkTo(room.set, OPENING_HOTEL.window.x, OPENING_HOTEL.window.z);
  h.command('act'); h.advance(4); assert.equal(state.openingHotel?.phase, 'ladder_ready');
  h.command('act');
  for (let frame = 0; frame < 50 && state.openingHotel?.phase === 'climbing'; frame++) {
    h.players.receiveInput('film-player', { x: 0, z: 0, yaw: 0, jump: false, sprint: false, climb: 1, sequence: ++sequence });
    h.players.step(.1, true, h.tick());
  }
  assert.ok(state.completed.includes(room.id));
  h.command('next'); assert.equal(state.scene, roofs.id);
  for (let frame = 0; frame < 150 && state.openingRoof?.phase === 'running' && state.step < 2; frame++) {
    const localX = h.actor().position.x - FILM_SETS[roofs.set].center.x;
    const localZ = h.actor().position.z - FILM_SETS[roofs.set].center.z;
    const target = state.step === 0 ? { x: -7, z: 12 } : localZ > 2 ? { x: 7, z: 2 } : { x: 7, z: -14 };
    const dx = target.x - localX; const dz = target.z - localZ; const length = Math.hypot(dx, dz);
    const jump = state.step === 1 && !jumped && localZ < -.4 && localZ > -2;
    if (jump) jumped = true;
    move(dx / Math.max(.01, length), dz / Math.max(.01, length), jump);
  }
  assert.equal(state.openingRoof?.phase, 'running', state.lastText);
  assert.equal(state.step, 2, `rooftop route stopped at step ${state.step}`);
  assert.ok(jumped);
  for (let frame = 0; frame < 60 && state.openingRoof?.phase === 'running'; frame++) {
    const target = filmStepPosition(roofs, roofs.steps[2]);
    const dx = target.x - h.actor().position.x; const dz = target.z - h.actor().position.z;
    const length = Math.hypot(dx, dz); move(dx / Math.max(.01, length), dz / Math.max(.01, length));
    if (length <= 3) break;
  }
  assert.equal(state.openingRoof?.phase, 'running', state.lastText);
  h.command('act'); h.advance(6);
  assert.ok(state.completed.includes(roofs.id), state.lastText);
  h.command('next'); assert.equal(state.scene, phone.id);
  for (let frame = 0; frame < 115 && state.openingPhone?.phase === 'running' && state.step === 0; frame++) move(0, -1);
  assert.equal(state.step, 1, state.lastText);
  h.command('act'); assert.equal(state.openingPhone?.phase, 'connected');
  h.advance(4); assert.equal(state.openingPhone?.phase, 'done');
  h.command('next'); assert.equal(state.scene, 'm1_wake_up');
});

test('reconnecting a defeated story actor rebuilds at the scene checkpoint instead of their daily home', () => {
  const h = setup(); h.command('start'); const state = h.sandbox.state.neoLife!.journey!;
  state.step = 1; h.actor().position = filmStepPosition(FILM_SCENES[0], FILM_SCENES[0].steps[1]); state.checkpoint = { ...h.actor().position };
  h.command('act'); h.actor().health = 0; h.actor().status = 'dead';
  assert.equal(h.players.possess('film-player', 'trinity', h.tick(), true).agentId, 'trinity');
  assert.equal(h.actor().currentLocation, FILM_SCENES[0].set);
  assert.deepEqual(h.actor().position, state.checkpoint);
  assert.equal(h.actor().health, h.actor().maxHealth); assert.equal(state.step, 1);
  assert.equal(state.fighting, true); assert.equal(h.sandbox.state.threats.length, 4);
});

test('melee outside a scripted fight cannot kill the film cast', () => {
  const h = setup(); h.command('start');
  const actor = h.actor(); const cypher = h.world.agents.get('cypher')!;
  actor.rotation = Math.PI; cypher.position = { ...actor.position, z: actor.position.z - 1 }; cypher.isInMatrix = true;
  h.players.act('film-player', 'attack', h.tick());
  for (let i = 0; i < 10; i++) h.players.step(.1, true, h.tick());
  assert.deepEqual(h.attacked, []);
});

test('the spoon responds to held focus, relaxes on release, and never completes from a timed interaction', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  const scene = FILM_SCENE_BY_ID.m1_spoon; Object.assign(state, { scene: scene.id, actor: 'neo', step: 0 });
  h.actor().position = filmStepPosition(scene, scene.steps[0]); h.actor().currentLocation = scene.set;
  h.command('act'); assert.equal(state.started, undefined); assert.equal(state.oracle?.spoon, 0);
  h.advance(20); assert.equal(state.step, 0, 'waiting alone cannot bend the spoon');
  let sequence = 10;
  const focus = (seconds: number, held = true, running = true) => {
    for (let i = 0; i < seconds * 10; i++) {
      h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, jump: false, sprint: false, focus: held, sequence: sequence++ });
      h.players.step(.1, running, h.tick());
    }
  };
  focus(2); const bent = state.oracle!.spoon!; assert.ok(bent > .3 && bent < 1);
  focus(1, false); assert.ok(state.oracle!.spoon! < bent, 'releasing attention visibly relaxes the metal');
  focus(1); const paused = state.oracle!.spoon; focus(1, true, false); assert.equal(state.oracle!.spoon, paused);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); assert.equal(h.sandbox.life.film.state!.oracle!.spoon, paused);
  focus(6); assert.equal(h.sandbox.life.film.state!.step, 1);
  assert.equal(h.sandbox.life.state!.choices.spoon, 'bent');
});

test('the Oracle vase falls once, pauses and restores mid-fall, then leaves a persistent result for the conversation', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  const scene = FILM_SCENE_BY_ID.m1_oracle; Object.assign(state, { scene: scene.id, actor: 'neo', step: 0 });
  h.actor().position = filmStepPosition(scene, scene.steps[0]); h.actor().currentLocation = scene.set;
  h.command('act'); assert.equal(state.started, undefined); assert.equal(state.oracle!.vase, 0);
  const position = { ...h.actor().position };
  h.players.receiveInput('film-player', { x: 1, z: 0, yaw: 0, jump: true, sprint: true, sequence: 10 });
  assert.match(h.players.act('film-player', 'attack', h.tick())!, /演出/);
  for (let i = 0; i < 15; i++) h.players.step(.1, true, h.tick());
  assert.deepEqual(h.actor().position, position, 'turning toward the vase cannot be interrupted by a run or jump');
  const time = state.oracle!.vase!; assert.ok(time >= 1.4 && time < 2);
  h.players.step(.1, false, h.tick()); assert.equal(state.oracle!.vase, time);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  h.players.release('film-player', h.tick()); h.advance(12); assert.equal(h.sandbox.life.film.state!.oracle!.vase, time);
  h.players.possess('film-player', 'neo', h.tick());
  for (let i = 0; i < 45; i++) h.players.step(.1, true, h.tick());
  assert.equal(h.sandbox.life.film.state!.step, 1); assert.equal(h.sandbox.life.state!.choices.oracle_vase, 'broken');
  h.actor().position = filmStepPosition(scene, scene.steps[1]);
  assert.match(h.command('reflect:agency'), /花瓶|检查/);
  assert.equal(h.sandbox.life.state!.choices['m1_oracle:1'], undefined, 'a reflection cannot bypass the in-person consultation');
});

test('the Oracle examines Neo and offers a cookie before waiting for his explicit answer', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  const scene = FILM_SCENE_BY_ID.m1_oracle; Object.assign(state, { scene: scene.id, actor: 'neo', step: 0 });
  h.actor().position = filmStepPosition(scene, scene.steps[0]); h.actor().currentLocation = scene.set;
  h.command('act');
  for (let frame = 0; frame < 46; frame++) h.players.step(.1, true, h.tick());
  const consultation = () => (h.sandbox.life.film.state!.oracle as { consultation?: { phase: string; elapsed: number; answer?: string } })?.consultation;
  assert.equal(state.step, 1); assert.equal(consultation()?.phase, 'waiting');
  for (let frame = 0; frame < 100; frame++) h.players.step(.1, true, h.tick());
  assert.equal(consultation()?.phase, 'waiting', 'time alone cannot start the consultation');

  h.actor().position = filmStepPosition(scene, scene.steps[1]);
  h.players.possess('oracle-player', 'oracle', h.tick());
  assert.match(h.command('act'), /另一位玩家/); assert.equal(consultation()?.phase, 'waiting');
  h.players.release('oracle-player', h.tick()); h.command('act');
  assert.equal(consultation()?.phase, 'examining');
  for (let frame = 0; frame < 34; frame++) h.players.step(.1, true, h.tick());
  const elapsed = consultation()!.elapsed; assert.ok(elapsed > 3 && elapsed < 3.5);
  h.players.step(.1, false, h.tick()); assert.equal(consultation()!.elapsed, elapsed);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); assert.equal(consultation()!.elapsed, elapsed);
  h.players.release('film-player', h.tick()); h.advance(20); assert.equal(consultation()!.elapsed, elapsed);
  h.players.possess('film-player', 'neo', h.tick());
  for (let frame = 0; frame < 90; frame++) h.players.step(.1, true, h.tick());
  assert.equal(consultation()?.phase, 'question'); assert.equal(h.sandbox.life.film.state!.step, 1);
  for (let frame = 0; frame < 100; frame++) h.players.step(.1, true, h.tick());
  assert.equal(consultation()?.phase, 'question', 'the Oracle cannot choose an answer for Neo');

  assert.match(h.command('reflect:care'), /具体的人/); assert.equal(consultation()?.phase, 'responding');
  assert.equal(h.sandbox.life.state!.choices.oracle_first, 'rescue');
  assert.ok(h.sandbox.life.state!.journal.some(entry => entry.title.includes('厨房里的预言') && entry.text.includes('具体的人')));
  for (let frame = 0; frame < 50; frame++) h.players.step(.1, true, h.tick());
  assert.equal(consultation()?.phase, 'done'); assert.equal(h.sandbox.life.film.state!.step, 2);
  assert.equal(h.sandbox.life.state!.choices['m1_oracle:1'], 'care');
});

test('the Oracle answer changes later rescue preparation exactly once', () => {
  const outcomes = [
    { answer: 'doubt', item: 'code', amount: 10 },
    { answer: 'rescue', item: 'medkit', amount: 3 },
    { answer: 'observe', item: 'beacon', amount: 1 },
  ] as const;
  for (const outcome of outcomes) {
    const h = setup(); h.command('continue'); const life = h.sandbox.life.state!; const state = h.sandbox.life.film.state!;
    life.choices.oracle_first = outcome.answer;
    Object.assign(state, { scene: 'm1_unplugged', actor: 'neo', step: FILM_SCENE_BY_ID.m1_unplugged.steps.length });
    const inventory = h.sandbox.state.profiles.neo.inventory; const before = inventory[outcome.item];
    h.command('next'); assert.equal(state.scene, 'm1_rescue_decision');
    assert.equal(inventory[outcome.item], before + outcome.amount); assert.equal(life.choices.oracle_prepared, outcome.answer);
    Object.assign(state, { scene: 'm1_unplugged', actor: 'neo', step: FILM_SCENE_BY_ID.m1_unplugged.steps.length });
    h.command('next'); assert.equal(inventory[outcome.item], before + outcome.amount, 're-entering cannot duplicate the preparation');
  }
});

test('Neo turns the rescue decision into a saved three-person briefing before entering the Construct', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  const scene = FILM_SCENE_BY_ID.m1_rescue_decision;
  Object.assign(state, { scene: scene.id, actor: 'neo', step: 0, rescue: undefined, checkpoint: filmEntry(scene) });
  h.actor().currentLocation = scene.set; h.actor().isInMatrix = false;
  h.actor().position = filmStepPosition(scene, scene.steps[0]); h.command('reflect:care');
  assert.equal(state.step, 1); assert.equal(state.rescue, undefined, 'the reflection does not silently start the physical briefing');

  h.actor().position = filmStepPosition(scene, scene.steps[1]);
  h.players.possess('other-player', 'tank', h.tick());
  assert.match(h.command('act'), /另一位玩家/); assert.equal(state.rescue?.phase, 'briefing_ready');
  h.players.release('other-player', h.tick()); h.command('act');
  assert.equal(state.rescue?.phase, 'briefing');
  assert.ok(h.world.agents.get('trinity')!.currentAction?.parameters.rescue);
  assert.ok(h.world.agents.get('tank')!.currentAction?.parameters.rescue);
  assert.match(h.players.possess('other-player', 'trinity', h.tick()).error!, /营救准备/);

  for (let frame = 0; frame < 31; frame++) h.players.step(.1, true, h.tick());
  const elapsed = state.rescue!.elapsed; h.players.step(.5, false, h.tick()); assert.equal(state.rescue!.elapsed, elapsed);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  assert.equal(h.sandbox.life.film.state!.rescue!.elapsed, elapsed);
  h.players.release('film-player', h.tick()); h.advance(20);
  assert.equal(h.sandbox.life.film.state!.rescue!.elapsed, elapsed, 'disconnecting cannot finish the briefing');
  h.players.possess('film-player', 'neo', h.tick());
  for (let frame = 0; frame < 70 && h.sandbox.life.film.state!.step === 1; frame++) h.players.step(.1, true, h.tick());
  assert.equal(h.sandbox.life.film.state!.rescue?.phase, 'briefing_done');
  assert.equal(h.sandbox.life.film.state!.step, scene.steps.length); assert.ok(h.sandbox.life.film.state!.completed.includes(scene.id));
});

test('the Construct waits for Neo to load racks, saves the selected physical loadout and carries its rules into the lobby', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  const scene = FILM_SCENE_BY_ID.m1_guns;
  Object.assign(state, { scene: scene.id, actor: 'neo', step: 0, rescue: undefined, checkpoint: filmEntry(scene) });
  h.actor().currentLocation = scene.set; h.actor().isInMatrix = true; h.actor().position = filmStepPosition(scene, scene.steps[0]);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  assert.equal(h.sandbox.life.film.state!.rescue?.phase, 'racks_ready');
  h.advance(20); assert.equal(h.sandbox.life.film.state!.rescue?.elapsed, 0, 'the racks do not arrive until Neo requests them');

  h.players.possess('other-player', 'trinity', h.tick()); assert.match(h.command('act'), /另一位玩家/);
  h.players.release('other-player', h.tick()); h.command('act');
  assert.equal(h.sandbox.life.film.state!.rescue?.phase, 'racks_arriving');
  for (let frame = 0; frame < 25; frame++) h.players.step(.1, true, h.tick());
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)); h.sandbox.restore(saved);
  assert.ok(h.sandbox.life.film.state!.rescue!.elapsed > 2.4);
  for (let frame = 0; frame < 30; frame++) h.players.step(.1, true, h.tick());
  assert.equal(h.sandbox.life.film.state!.rescue?.phase, 'selecting');
  const nearestDistance = Math.min(...Object.values(RESCUE.loadoutRoots).map(root => {
    const position = filmPosition(scene.set, root.x, root.z); return Math.hypot(h.actor().position.x - position.x, h.actor().position.z - position.z);
  }));
  assert.ok(nearestDistance > 4, 'the rack reveal must return Neo to a neutral viewing point instead of preselecting the middle weapon');
  assert.match(h.command('act'), /走近/); assert.equal(h.sandbox.life.film.state!.rescue?.phase, 'selecting');
  h.advance(30); assert.equal(h.sandbox.life.film.state!.rescue?.phase, 'selecting', 'waiting cannot pick a weapon for the player');

  const compact = RESCUE.loadoutRoots.compact;
  h.actor().position = filmPosition(scene.set, compact.x, compact.z); h.command('act');
  assert.equal(h.sandbox.life.film.state!.rescue?.phase, 'equipping'); assert.equal(h.sandbox.life.film.state!.rescue?.loadout, 'compact');
  for (let frame = 0; frame < 60 && h.sandbox.life.film.state!.step === 0; frame++) h.players.step(.1, true, h.tick());
  assert.equal(h.sandbox.life.film.state!.rescue?.phase, 'equipped'); assert.equal(h.sandbox.life.state!.choices.rescue_loadout, 'compact');
  assert.equal(h.sandbox.life.film.state!.step, 1);

  h.actor().position = filmStepPosition(scene, scene.steps[1]); h.advance();
  assert.ok(h.sandbox.life.film.state!.completed.includes(scene.id)); h.command('next');
  assert.equal(h.sandbox.life.film.state!.scene, 'm1_lobby');
  assert.equal(h.sandbox.life.film.state!.lobby?.loadout, 'compact');
  assert.equal(h.sandbox.life.film.state!.lobby?.ammo, RESCUE_LOADOUTS.compact.magazine);
  assert.equal(h.world.agents.get('trinity')!.rotation, Math.PI, 'Trinity faces the checkpoint before the breach');
  assert.equal(h.world.agents.get('citizen_12')!.rotation, 0, 'the guard faces the approaching players');
});

test('legacy rescue checkpoints migrate to a non-replaying rifle loadout', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!; const scene = FILM_SCENE_BY_ID.m1_guns;
  Object.assign(state, { scene: scene.id, actor: 'neo', step: 1, rescue: undefined, checkpoint: filmStepPosition(scene, scene.steps[1]) });
  h.actor().currentLocation = scene.set; h.actor().isInMatrix = true; h.actor().position = { ...state.checkpoint };
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  assert.deepEqual(h.sandbox.life.film.state!.rescue, { phase: 'equipped', elapsed: 0, loadout: 'rifle' });
  assert.equal(h.actor().currentAction?.parameters.rescue, undefined, 'a migrated save remains walkable instead of replaying the equip animation');
});

test('Morpheus must actively hold the bathroom line before choosing the sacrificial tackle', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  const scene = FILM_SCENE_BY_ID.m1_bathroom;
  Object.assign(state, { scene: scene.id, actor: 'morpheus', step: 0, betrayal: undefined });
  h.players.release('film-player', h.tick()); h.players.possess('film-player', 'morpheus', h.tick());
  h.actor().position = filmStepPosition(scene, scene.steps[0]); h.actor().currentLocation = scene.set; h.actor().isInMatrix = true;
  h.command('act');
  const encounter = () => h.sandbox.life.film.state!.betrayal!;
  assert.equal(encounter().kind, 'bathroom'); assert.equal(encounter().phase, 'defending');
  assert.match(h.players.possess('other-player', 'neo', h.tick()).error!, /背叛片段/, 'the escaping crew stays reserved once the holdout starts');
  const smith = () => h.sandbox.state.threats.find(threat => threat.scene === scene.id && threat.character === 'smith')!;
  assert.ok(smith()); smith().stunUntil = Number.MAX_SAFE_INTEGER;

  for (let frame = 0; frame < 130; frame++) h.players.step(.1, true, h.tick());
  assert.equal(encounter().elapsed, 12); assert.equal(state.step, 0, 'waiting out the timer cannot replace defending the crew');
  for (const combo of [0, 1, 2]) {
    smith().position = { ...h.actor().position, z: h.actor().position.z - 2 }; h.actor().rotation = Math.PI;
    h.sandbox.attack(h.actor(), h.tick(), combo);
  }
  h.players.step(.1, true, h.tick());
  assert.equal(encounter().repels, 3); assert.equal(encounter().phase, 'sacrifice_ready'); assert.equal(state.step, 1);

  assert.match(h.players.possess('other-player', 'smith', h.tick()).error!, /背叛片段/);
  h.command('act'); assert.equal(encounter().phase, 'sacrifice');
  for (let frame = 0; frame < 24; frame++) h.players.step(.1, true, h.tick());
  const elapsed = encounter().elapsed; h.players.step(.1, false, h.tick()); assert.equal(encounter().elapsed, elapsed);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  h.players.release('film-player', h.tick()); h.advance(20); assert.equal(encounter().elapsed, elapsed);
  h.players.possess('film-player', 'morpheus', h.tick());
  for (let frame = 0; frame < 70; frame++) h.players.step(.1, true, h.tick());
  assert.equal(encounter().phase, 'done'); assert.equal(h.sandbox.life.film.state!.step, 2); assert.ok(h.sandbox.life.film.state!.completed.includes(scene.id));
  assert.equal(h.sandbox.life.state!.choices.morpheus_captured, 'sacrifice');
});

test('legacy betrayal checkpoints migrate without replaying cleared or completed beats', () => {
  const bathroom = setup(); bathroom.command('continue');
  const bathroomState = bathroom.sandbox.life.film.state!; const bathroomScene = FILM_SCENE_BY_ID.m1_bathroom;
  Object.assign(bathroomState, { scene: bathroomScene.id, actor: 'morpheus', step: 1, betrayal: undefined,
    checkpoint: filmStepPosition(bathroomScene, bathroomScene.steps[1]) });
  bathroom.players.release('film-player', bathroom.tick()); bathroom.players.possess('film-player', 'morpheus', bathroom.tick());
  bathroom.actor().currentLocation = bathroomScene.set; bathroom.actor().isInMatrix = true;
  bathroom.sandbox.restore(JSON.parse(JSON.stringify(bathroom.sandbox.state)));
  assert.equal(bathroom.sandbox.life.film.state!.betrayal?.phase, 'sacrifice_ready', 'an old cleared fight resumes at the sacrificial choice');
  assert.equal(bathroom.sandbox.state.threats.length, 0);

  const unplugged = setup(); unplugged.command('continue');
  const unpluggedState = unplugged.sandbox.life.film.state!; const unpluggedScene = FILM_SCENE_BY_ID.m1_unplugged;
  Object.assign(unpluggedState, { scene: unpluggedScene.id, actor: 'tank', step: unpluggedScene.steps.length, betrayal: undefined,
    completed: [...new Set([...unpluggedState.completed, unpluggedScene.id])], checkpoint: filmStepPosition(unpluggedScene, unpluggedScene.steps[1]) });
  unplugged.players.release('film-player', unplugged.tick()); unplugged.players.possess('film-player', 'tank', unplugged.tick());
  unplugged.actor().currentLocation = unpluggedScene.set; unplugged.actor().isInMatrix = false;
  unplugged.sandbox.restore(JSON.parse(JSON.stringify(unplugged.sandbox.state)));
  assert.equal(unplugged.sandbox.life.film.state!.betrayal?.phase, 'done', 'a completed old checkpoint remains complete');
  assert.equal(unplugged.actor().currentAction?.parameters.betrayal, undefined, 'a completed checkpoint must not lock Tank in a finished pose');
  assert.match(unplugged.command('next'), /仍然选择去救他/);
});

test('Tank can fail and retry Cypher aim, then explicitly reconnect both surviving signals', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  const scene = FILM_SCENE_BY_ID.m1_unplugged;
  Object.assign(state, { scene: scene.id, actor: 'tank', step: 0, betrayal: undefined });
  h.players.release('film-player', h.tick()); h.players.possess('film-player', 'tank', h.tick());
  assert.equal(h.actor().currentAction?.parameters.betrayal, undefined, 'Tank must remain free to walk to the backup console');
  h.actor().position = filmStepPosition(scene, scene.steps[0]); h.actor().currentLocation = scene.set; h.actor().isInMatrix = false;
  h.advance(); assert.equal(state.step, 1);
  const encounter = () => h.sandbox.life.film.state!.betrayal!;
  h.players.possess('other-player', 'cypher', h.tick());
  assert.match(h.command('act'), /另一位玩家/);
  h.players.release('other-player', h.tick()); h.command('act');
  assert.equal(encounter().kind, 'unplugged'); assert.equal(encounter().phase, 'unplugging');
  for (let frame = 0; frame < 130 && h.actor().status === 'alive'; frame++) h.players.step(.1, true, h.tick());
  assert.equal(encounter().phase, 'failed'); assert.equal(h.actor().status, 'dead'); assert.equal(state.step, 1);

  h.command('retry'); assert.equal(h.actor().status, 'alive'); assert.equal(encounter().phase, 'ready');
  h.command('act');
  for (let frame = 0; frame < 100 && encounter().phase !== 'window'; frame++) h.players.step(.1, true, h.tick());
  assert.equal(encounter().phase, 'window');
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)); h.sandbox.restore(saved);
  assert.equal(encounter().phase, 'window'); h.command('act'); assert.equal(encounter().phase, 'countering');
  for (let frame = 0; frame < 70 && encounter().phase !== 'reconnect'; frame++) h.players.step(.1, true, h.tick());
  assert.equal(encounter().phase, 'reconnect');
  h.command('act'); assert.equal(encounter().rescued, 1); assert.equal(state.step, 1);
  h.command('act'); assert.equal(encounter().rescued, 2); assert.equal(encounter().phase, 'done');
  assert.equal(h.sandbox.life.film.state!.step, 2); assert.ok(h.sandbox.life.film.state!.completed.includes(scene.id));
  for (const id of ['cypher', 'dozer', 'apoc', 'switch']) assert.equal(h.world.agents.get(id)!.status, 'dead', id);
  for (const id of ['neo', 'trinity', 'tank']) assert.equal(h.world.agents.get(id)!.status, 'alive', id);
});

test('the repeated cat seals the old exit, leaves the service passage open and preserves the changed space after reconnect', () => {
  for (const time of [.5, 1.5, 2, 3]) assert.deepEqual(ambushCat(time), ambushCat(time + 4.5), 'the second cat repeats the same path and movement');
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  const scene = FILM_SCENE_BY_ID.m1_dejavu; Object.assign(state, { scene: scene.id, actor: 'neo', step: 0 });
  h.actor().position = filmStepPosition(scene, scene.steps[0]); h.actor().currentLocation = scene.set;
  const door = { ...FILM_SETS[scene.set].center, z: FILM_SETS[scene.set].center.z - 21 };
  assert.equal(playerBlocked(door, true, 1.1, h.sandbox.state.structures), false);
  h.command('act'); assert.equal(state.started, undefined);
  for (let i = 0; i < 40; i++) h.players.step(.1, true, h.tick());
  const firstPass = state.ambush!.elapsed; assert.ok(firstPass > 3.9 && firstPass < 4.1);
  h.players.step(.1, false, h.tick()); assert.equal(state.ambush!.elapsed, firstPass);
  h.players.release('film-player', h.tick()); h.advance(20); assert.equal(state.ambush!.elapsed, firstPass);
  h.players.possess('film-player', 'neo', h.tick());
  for (let i = 0; i < 60; i++) h.players.step(.1, true, h.tick());
  assert.equal(state.step, 1);
  assert.equal(playerBlocked(door, true, 1.1, h.sandbox.state.structures), true, 'the visible brickwork must block the original door');
  const passage = { ...door, x: door.x - 17, z: door.z + 5 };
  assert.equal(playerBlocked(passage, true, 1.1, h.sandbox.state.structures), false);
  const barriers = h.sandbox.state.structures.filter(s => s.film?.scene === 'm1_dejavu'); assert.equal(barriers.length, 2);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  h.command('retry'); assert.equal(playerBlocked(door, true, 1.1, h.sandbox.state.structures), true);
  assert.equal(h.sandbox.state.structures.filter(s => s.film).length, 2, 'loading and retry cannot duplicate the sealed windows');
  h.sandbox.life.begin(h.world.agents.get('neo')!, h.tick(), true);
  assert.equal(h.sandbox.state.structures.filter(s => s.film).length, 0, 'a new cycle restores the original building');
});

test('ambush enemies can approach beside the sealed door without trying to dismantle the building', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!; const scene = FILM_SCENE_BY_ID.m1_dejavu;
  Object.assign(state, { scene: scene.id, actor: 'neo', step: 0 });
  h.actor().position = filmStepPosition(scene, scene.steps[0]); h.actor().currentLocation = scene.set;
  h.command('act'); for (let frame = 0; frame < 100; frame++) h.players.step(.1, true, h.tick());
  assert.equal(h.sandbox.state.structures.filter(s => s.film).length, 2);
  h.command('act'); h.advance();
  const center = FILM_SETS[scene.set].center;
  h.actor().position = { ...center, z: center.z - 18 };
  h.sandbox.state.threats.forEach((threat, i) => { threat.position = { ...center, x: center.x + i, z: center.z - 10 }; threat.stunUntil = 0; });
  h.advance(6);
  assert.ok(h.sandbox.state.threats.every(threat => Math.hypot(threat.position.x - h.actor().position.x, threat.position.z - h.actor().position.z) < 3.4), 'nearby film brickwork must not stop enemies several metres from the player');
  assert.ok(h.sandbox.state.structures.every(s => !s.film || s.health === 1));
});

test('canonical losses persist across scene transitions, loading and character selection', () => {
  const h = setup(); h.command('start'); const state = h.sandbox.life.film.state!;
  const scene = FILM_SCENE_BY_ID.m1_unplugged;
  state.scene = scene.id; state.actor = scene.actor; state.step = 1;
  h.players.possess('film-player', scene.actor, h.tick());
  h.actor().isInMatrix = false; h.actor().currentLocation = scene.set;
  h.actor().position = filmStepPosition(scene, scene.steps[1]);
  h.command('act');
  for (let frame = 0; frame < 100 && state.betrayal?.phase !== 'window'; frame++) h.players.step(.1, true, h.tick());
  assert.equal(state.betrayal?.phase, 'window'); h.command('act');
  for (let frame = 0; frame < 70 && state.betrayal?.phase !== 'reconnect'; frame++) h.players.step(.1, true, h.tick());
  h.command('act'); h.command('act');
  for (const id of ['cypher', 'dozer', 'apoc', 'switch']) assert.equal(h.world.agents.get(id)!.status, 'dead', id);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); h.command('next');
  h.sandbox.life.film.releaseCast();
  for (const id of ['cypher', 'dozer', 'apoc', 'switch']) assert.equal(h.world.agents.get(id)!.status, 'dead', id);
  const owner = h.actor().id;
  assert.match(h.players.possess('film-player', 'switch', h.tick()).error!, /本轮/);
  assert.equal(h.actor().id, owner, 'a refused role must retain the current session');
  h.sandbox.life.begin(h.world.agents.get('neo')!, h.tick(), true);
  for (const id of ['cypher', 'dozer', 'apoc', 'switch']) assert.equal(h.world.agents.get(id)!.status, 'alive', id);
});

test('philosophical choices answer the current question and survive loading without duplicate rewards', () => {
  const h = setup(); h.command('start'); const state = h.sandbox.life.film.state!;
  const scene = FILM_SCENE_BY_ID.m2_hamann; state.scene = scene.id; state.actor = scene.actor; state.step = 3;
  h.players.possess('film-player', 'neo', h.tick()); h.actor().isInMatrix = false;
  h.actor().position = filmStepPosition(scene, scene.steps[3]);
  assert.match(h.command('reflect:care'), /生活|清水/);
  assert.equal(h.sandbox.life.state!.philosophy.care, 1);
  assert.equal(h.sandbox.life.state!.choices['m2_hamann:3'], 'care');
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  h.command('reflect:care'); assert.equal(h.sandbox.life.state!.philosophy.care, 1);
  assert.ok(h.sandbox.life.state!.journal.some(e => e.title.includes('维持谁的生活')));
  assert.notEqual(filmReflections('m1_oracle')[0].response, filmReflections('m2_architect')[0].response);
});

test('Mobil Ave plays Sati, her family, Trainman refusal and both tunnel loops in that order', () => {
  const h = setup(); h.command('continue'); let state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: 'm2_medical', actor: 'trinity', step: FILM_SCENE_BY_ID.m2_medical.steps.length });
  h.players.possess('film-player', 'trinity', h.tick()); h.command('next');
  assert.equal(state.scene, 'm3_mobil'); assert.equal(h.actor().id, 'neo');
  assert.match(FILM_SCENE_BY_ID.m3_mobil.steps[0].label, /Sati/);
  assert.match(h.players.act('film-player', 'ability', h.tick()), /Trainman/);
  const center = FILM_SETS.film_mobil_station.center;
  h.actor().position = filmPosition('film_mobil_station', 0, -49); h.advance();
  assert.equal(state.step, 0, 'the loop cannot precede Trainman leaving');
  for (const id of ['m3_mobil', 'm3_family']) {
    const scene = FILM_SCENE_BY_ID[id];
    assert.equal(state.scene, id);
    for (const step of scene.steps) {
      h.actor().position = filmStepPosition(scene, step);
      if (step.kind === 'reach') h.advance();
      else if (step.kind === 'reflect') h.command(`reflect:${filmReflections(id)[0].id}`);
      else { h.command('act'); h.advance(8); }
    }
    h.command('next');
  }
  assert.equal(state.scene, 'm3_trainman');
  const train = FILM_SCENE_BY_ID.m3_trainman;
  h.actor().position = filmStepPosition(train, train.steps[0]); h.command('act'); h.advance(6);
  assert.equal(state.mobil?.phase, 'approaching');
  assert.match(h.players.possess('other-player', 'trainman', h.tick()).error ?? '', /列车片段/);
  const elapsed = state.mobil!.elapsed;
  h.players.release('film-player', h.tick()); h.advance(20);
  assert.equal(state.mobil?.elapsed, elapsed, 'the train must not arrive while its player is disconnected');
  h.players.possess('film-player', 'neo', h.tick());
  h.actor().position = filmStepPosition(train, train.steps[1]); h.advance();
  assert.equal(state.step, 1, 'Neo must wait for the actual train');
  h.advance(12); assert.equal(state.mobil?.phase, 'stopped'); assert.equal(state.step, 2);
  h.actor().position = filmStepPosition(train, train.steps[2]); h.command('act');
  assert.equal(state.mobil?.phase, 'refusing');
  const before = h.actor().health;
  for (let i = 0; i < 28; i++) h.players.step(.1, true, h.tick());
  assert.equal(state.mobil?.phase, 'departing'); assert.ok(h.actor().health < before);
  h.advance(10); assert.equal(state.mobil?.phase, 'gone');
  h.actor().position = filmStepPosition(train, train.steps[3]); h.advance();
  assert.equal(state.step, 4); assert.ok(h.actor().position.z > center.z + 35);
  assert.equal(h.sandbox.life.state?.choices.mobil_loop, 'one_end');
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); state = h.sandbox.life.film.state!;
  h.actor().position = filmStepPosition(train, train.steps[4]); h.advance();
  assert.equal(state.step, train.steps.length); assert.ok(h.actor().position.z < center.z - 35);
  assert.equal(h.sandbox.life.state?.choices.mobil_loop, 'both_ends');
});

test('Seraph loses the subway chase, Trinity crosses Hel garage and the rescue train returns for Neo', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  const oracle = FILM_SCENE_BY_ID.m3_oracle_request;
  Object.assign(state, { scene: oracle.id, actor: oracle.actor, step: oracle.steps.length });
  h.players.possess('film-player', 'trinity', h.tick()); h.command('next');
  assert.equal(state.scene, 'm3_trainman_chase'); assert.equal(h.actor().id, 'seraph');
  const chase = FILM_SCENE_BY_ID.m3_trainman_chase;
  h.actor().position = filmStepPosition(chase, chase.steps[0]); h.command('act'); h.advance(4);
  assert.equal(state.helChase?.phase, 'running');
  assert.ok(h.world.agents.get('trainman')!.position.z < FILM_SETS[chase.set].center.z + 8);
  h.actor().position = filmStepPosition(chase, chase.steps[1]); h.advance();
  h.advance(12); assert.equal(state.helChase?.phase, 'escaped');
  h.actor().position = filmStepPosition(chase, chase.steps[2]); h.command('act'); h.advance(5);
  assert.ok(state.completed.includes(chase.id)); h.command('next');
  assert.equal(state.scene, 'm3_hel_garage'); assert.equal(h.actor().id, 'trinity');
  assert.equal(FILM_SCENE_BY_ID.m3_hel_garage.set, 'film_hel_garage');
  assert.match(FILM_SCENE_BY_ID.m3_hel_entry.steps[0].label, /电梯/);
  assert.match(FILM_SCENE_BY_ID.m3_hel_entry.steps[1].label, /衣帽间/);
  Object.assign(state, { scene: 'm3_hel_bargain', step: FILM_SCENE_BY_ID.m3_hel_bargain.steps.length, actor: 'trinity' });
  h.command('next'); assert.equal(state.scene, 'm3_mobil_release'); assert.equal(h.actor().id, 'neo');
  assert.equal(state.mobil?.phase, 'approaching');
  h.actor().position = filmStepPosition(FILM_SCENE_BY_ID.m3_mobil_release, FILM_SCENE_BY_ID.m3_mobil_release.steps[0]);
  h.advance(); assert.equal(state.step, 0, 'Neo cannot greet Trinity before the rescue train arrives');
  h.advance(12); assert.equal(state.mobil?.phase, 'stopped'); assert.equal(state.step, 1);
  assert.ok(h.world.agents.get('trinity')!.position.x < FILM_SETS.film_mobil_station.center.x + 8);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  assert.equal(h.sandbox.life.film.state!.mobil?.phase, 'stopped');
});

test('Club Hel elevator stays shut through a saved ride and opens only on arrival', () => {
  const h = setup(); h.command('continue'); let state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: 'm3_hel_garage', actor: 'trinity', step: FILM_SCENE_BY_ID.m3_hel_garage.steps.length });
  h.players.possess('film-player', 'trinity', h.tick()); h.command('next');
  state = h.sandbox.life.film.state!;
  assert.equal(state.scene, 'm3_hel_entry');
  const door = filmPosition('film_club_hel', 0, 24.6);
  assert.equal(playerBlocked(door, true, 1.1, h.sandbox.state.structures), true);
  h.actor().position = filmStepPosition(FILM_SCENE_BY_ID.m3_hel_entry, FILM_SCENE_BY_ID.m3_hel_entry.steps[0]);
  h.command('act');
  assert.equal(state.step, 0, 'pressing the button starts the ride rather than completing it');
  assert.equal((state as typeof state & { helElevator?: { phase: string } }).helElevator?.phase, 'descending');
  assert.equal(h.sandbox.life.film.performing(h.actor()), true);
  h.advance(3);
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)); h.sandbox.restore(saved);
  state = h.sandbox.life.film.state!;
  const elapsed = (state as typeof state & { helElevator?: { elapsed: number } }).helElevator!.elapsed;
  h.players.release('film-player', h.tick()); h.advance(8);
  assert.equal((state as typeof state & { helElevator?: { elapsed: number } }).helElevator!.elapsed, elapsed, 'the ride pauses without its player');
  h.players.possess('film-player', 'trinity', h.tick()); h.advance(10);
  assert.equal(state.step, 1);
  assert.equal((state as typeof state & { helElevator?: { phase: string } }).helElevator?.phase, 'open');
  assert.equal(playerBlocked(door, true, 1.1, h.sandbox.state.structures), false);
  assert.equal(h.sandbox.life.film.performing(h.actor()), false);
  delete state.helElevator;
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  h.advance(1);
  assert.equal(h.sandbox.life.film.state!.helElevator?.phase, 'open', 'older saves after the elevator do not replay the descent');
  assert.equal(playerBlocked(door, true, 1.1, h.sandbox.state.structures), false);
});

test('Club Hel bargain requires Trinity to disarm, refuse, dodge, counter, catch the gun and confront Merovingian', () => {
  const h = setup(); h.command('continue'); let state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: 'm3_hel_entry', actor: 'trinity', step: FILM_SCENE_BY_ID.m3_hel_entry.steps.length });
  h.players.possess('film-player', 'trinity', h.tick()); h.command('next'); state = h.sandbox.life.film.state!;
  const scene = FILM_SCENE_BY_ID.m3_hel_bargain;
  assert.equal(state.scene, scene.id);
  assert.equal(h.world.agents.get('merovingian')?.currentLocation, scene.set);
  assert.ok(Math.abs(h.world.agents.get('merovingian')!.position.z - filmPosition(scene.set, 0, -35).z) < .01);
  h.actor().position = filmStepPosition(scene, scene.steps[0]);
  h.command('act'); assert.equal(state.step, 1); assert.equal(state.helBargain?.phase, 'disarmed');
  h.command('act'); assert.equal(state.step, 2); assert.equal(state.helBargain?.phase, 'offered');
  h.command(`reflect:${filmReflections(scene.id)[0].id}`); assert.equal(state.step, 3);
  assert.match(h.command('act'), /冲入人群/); assert.equal(state.helBargain?.phase, 'windup');
  assert.equal(h.command('act').includes('闪避'), true); assert.equal(state.step, 3, 'G cannot replace the dodge');
  h.advance(2); assert.equal(state.helBargain?.phase, 'evade');
  h.players.act('film-player', 'attack', h.tick()); assert.equal(state.step, 3, 'F before X cannot skip the dodge');
  h.players.act('film-player', 'dodge', h.tick()); assert.equal(state.helBargain?.phase, 'counter');
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)); h.sandbox.restore(saved); state = h.sandbox.life.film.state!;
  h.advance(); assert.equal(state.helBargain?.phase, 'counter', 'reloading keeps the remaining counter window');
  h.actor().rotation = Math.PI;
  h.players.act('film-player', 'attack', h.tick()); assert.equal(state.step, 4); assert.equal(state.helBargain?.phase, 'airborne');
  h.command('act'); assert.equal(state.step, 4, 'G before the pistol is within reach cannot catch it');
  h.advance(3); h.command('act'); assert.equal(state.step, 5); assert.equal(state.helBargain?.phase, 'gunpoint');
  h.players.step(.1, true, h.tick());
  assert.equal(h.actor().currentAction?.parameters.weaponStyle, 'hel_pistol', 'the gun remains visible between movement frames');
  h.actor().position = filmStepPosition(scene, scene.steps[5]); h.actor().rotation = 0;
  h.command('act'); assert.equal(state.step, 5, 'the threat needs Trinity to face Merovingian');
  h.actor().rotation = Math.PI; h.command('act');
  assert.equal(state.step, scene.steps.length); assert.equal(state.helBargain?.phase, 'released');
  assert.equal(h.sandbox.life.state?.choices.neo_release, 'trinity_refused_trade');
});

test('Club Hel rush expires, retries from the confrontation and pauses when its player disconnects', () => {
  const h = setup(); h.command('continue'); let state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: 'm3_hel_entry', actor: 'trinity', step: FILM_SCENE_BY_ID.m3_hel_entry.steps.length });
  h.players.possess('film-player', 'trinity', h.tick()); h.command('next'); state = h.sandbox.life.film.state!;
  const scene = FILM_SCENE_BY_ID.m3_hel_bargain;
  h.actor().position = filmStepPosition(scene, scene.steps[0]);
  h.command('act'); h.command('act'); h.command(`reflect:${filmReflections(scene.id)[0].id}`); h.command('act');
  h.advance(2); h.players.release('film-player', h.tick()); h.advance(20);
  assert.equal(state.helBargain?.phase, 'evade');
  h.players.possess('film-player', 'trinity', h.tick()); h.advance(10);
  assert.equal(state.helBargain?.phase, 'failed'); assert.equal(state.step, 3);
  assert.equal(h.command('act').includes('重试'), true);
  h.command('retry'); assert.equal(state.helBargain?.phase, 'ready'); assert.equal(state.helBargain?.attempts, 1);
  assert.equal(state.reflections[`${scene.id}:2`], filmReflections(scene.id)[0].id);
  assert.equal(h.sandbox.life.state?.choices.neo_release, undefined);
});

test('older Club Hel saves keep the refusal and resume at the new confrontation checkpoint', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: 'm3_hel_bargain', actor: 'trinity', step: 2, helBargain: undefined, started: 4 });
  const choice = filmReflections('m3_hel_bargain')[0].id;
  state.reflections['m3_hel_bargain:1'] = choice;
  h.players.possess('film-player', 'trinity', h.tick());
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  const restored = h.sandbox.life.film.state!;
  assert.equal(restored.step, 3); assert.equal(restored.helBargain?.phase, 'ready');
  assert.equal(restored.reflections['m3_hel_bargain:2'], choice);
  assert.equal(restored.started, undefined);
});

test('another player holding Merovingian pauses Trinity’s Club Hel action window', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: 'm3_hel_entry', actor: 'trinity', step: FILM_SCENE_BY_ID.m3_hel_entry.steps.length });
  h.players.possess('film-player', 'trinity', h.tick()); h.command('next');
  const scene = FILM_SCENE_BY_ID.m3_hel_bargain;
  h.actor().position = filmStepPosition(scene, scene.steps[0]);
  h.command('act'); h.command('act'); h.command(`reflect:${filmReflections(scene.id)[0].id}`); h.command('act'); h.advance(2);
  assert.equal(state.helBargain?.phase, 'evade');
  h.players.possess('other', 'merovingian', h.tick()); h.advance(20);
  assert.equal(state.helBargain?.phase, 'evade'); assert.equal(state.helBargain?.elapsed, 0);
  assert.match(h.players.act('film-player', 'dodge', h.tick()), /暂停/);
  h.players.release('other', h.tick()); h.advance(10);
  assert.equal(state.helBargain?.phase, 'failed');
});

test('the tracking room has a walkable doorway and Neo sits before touching the mirror', () => {
  const set = FILM_SETS.film_lafayette;
  const target = filmStepPosition(FILM_SCENE_BY_ID.m1_mirror, FILM_SCENE_BY_ID.m1_mirror.steps[0]);
  assert.equal(playerBlocked(target, true), false, 'the approach marker must be reachable beside the chair');
  assert.equal(playerBlocked(filmPosition(set.id, -6, -11.5), true), false, 'the rear-room doorway stays open');
  assert.equal(playerBlocked(filmPosition(set.id, 2, -11.5), true), true, 'the tracking room is separated from the lounge');
  for (const [x, z] of [[-4.5, -9], [-6, -10], [-6, -11.5], [-6, -13], [-7.1, -14.6]])
    assert.equal(playerBlocked(filmPosition(set.id, x, z), true), false, `Neo can walk through the doorway at ${x}, ${z}`);
  const route = [PILL_ROOM.exit, { x: -5, z: -3.1 }, { x: -5, z: -9.8 }, { x: -6, z: -12.7 }, MIRROR_TOUCH];
  for (let segment = 1; segment < route.length; segment++) {
    const from = route[segment - 1], to = route[segment];
    for (let sample = 0; sample <= 20; sample++) {
      const t = sample / 20;
      const x = from.x + (to.x - from.x) * t, z = from.z + (to.z - from.z) * t;
      assert.equal(playerBlocked(filmPosition(set.id, x, z), true), false, `Neo can walk from the red-pill exit to the tracking chair at ${x}, ${z}`);
    }
  }
  const approach = { x: target.x - set.center.x, z: target.z - set.center.z };
  assert.deepEqual(awakeningPose({ kind: 'mirror', elapsed: 0, approach }), { ...awakeningPose({ kind: 'mirror', elapsed: 0 }), x: approach.x, z: approach.z });
  const seated = awakeningPose({ kind: 'mirror', elapsed: MIRROR_TIMING.wired, approach });
  assert.equal(seated.x, MIRROR_SEAT.x); assert.equal(seated.z, MIRROR_SEAT.z);
  assert.equal(mirrorSilver(MIRROR_TIMING.touch - .1), 0, 'silver appears after the hand touches the glass');
  assert.ok(mirrorSilver(MIRROR_TIMING.touch + .5) > 0);
});

test('an old standing-at-mirror save moves to the reachable chair approach', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: 'm1_mirror', actor: 'neo', step: 0, awakening: undefined });
  h.actor().currentLocation = 'film_lafayette'; h.actor().position = filmPosition('film_lafayette', MIRROR_SEAT.x, MIRROR_SEAT.z);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  assert.deepEqual(h.actor().position, filmStepPosition(FILM_SCENE_BY_ID.m1_mirror, FILM_SCENE_BY_ID.m1_mirror.steps[0]));
});

test('a saved wiring beat restores Trinity to the reachable side of the chair', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: 'm1_pills', actor: 'neo', step: 2 }); h.command('next');
  state.awakening = { kind: 'mirror', elapsed: 2.1, started: false };
  const trinity = h.world.agents.get('trinity')!;
  trinity.position = filmPosition('film_lafayette', -6.4, -16.5);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  assert.deepEqual(trinity.position, filmPosition('film_lafayette', MIRROR_TRINITY.x, MIRROR_TRINITY.z));
  assert.equal(trinity.rotation, MIRROR_TRINITY.yaw);
});

test('touching the mirror is a saved seated performance that freezes on pause and resumes after reconnect', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: 'm1_pills', actor: 'neo', step: 2 }); h.command('next');
  const trinity = h.world.agents.get('trinity')!;
  const seat = filmPosition('film_lafayette', MIRROR_SEAT.x, MIRROR_SEAT.z);
  assert.ok(Math.hypot(trinity.position.x - seat.x, trinity.position.z - seat.z) < 2.05,
    'Trinity must stand close enough to connect the headset instead of reaching from across the room');
  assert.equal(playerBlocked(trinity.position, true, .5), false, 'Trinity must stand beside, not inside, the tracking chair');
  const target = filmStepPosition(FILM_SCENE_BY_ID.m1_mirror, FILM_SCENE_BY_ID.m1_mirror.steps[0]);
  const touch = awakeningPose({ kind: 'mirror', elapsed: 0 });
  assert.deepEqual(target, filmPosition('film_lafayette', touch.x, touch.z), 'the chair interaction begins at the approach marker');
  h.actor().position = { ...target, x: target.x + 2.5 };
  h.command('act'); assert.equal(state.awakening, undefined, 'G cannot begin the touch from across the room');
  h.actor().position = target;
  h.command('act'); assert.equal(state.awakening?.kind, 'mirror');
  assert.deepEqual(h.actor().position, target, 'the performance starts at Neo’s actual position');
  for (let i = 0; i < 30; i++) h.players.step(.1, true, h.tick());
  assert.deepEqual(h.actor().position, filmPosition('film_lafayette', MIRROR_SEAT.x, MIRROR_SEAT.z));
  assert.equal(h.actor().currentAction?.parameters.seated, true);
  assert.equal(h.actor().currentAction?.parameters.mirror, 0);
  const position = { ...h.actor().position }; const saved = JSON.parse(JSON.stringify(h.sandbox.state));
  h.players.step(.1, false, h.tick()); assert.equal(state.awakening!.elapsed, saved.neoLife.journey.awakening.elapsed);
  h.sandbox.restore(saved); h.players.release('film-player', h.tick()); h.advance(30);
  assert.equal(h.sandbox.life.film.state!.awakening!.elapsed, saved.neoLife.journey.awakening.elapsed);
  h.players.possess('film-player', 'neo', h.tick());
  h.players.receiveInput('film-player', { x: 1, z: 1, yaw: 0, sprint: true, jump: true, sequence: 1 });
  h.players.step(.1, true, h.tick()); assert.deepEqual(h.actor().position, position, 'the hand remains at the mirror while the camera can look around');
  assert.match(h.players.act('film-player', 'attack', h.tick()), /演出/);
  for (let i = 0; i < 70; i++) h.players.step(.1, true, h.tick());
  assert.equal(h.sandbox.life.film.state!.scene, 'm1_pod', 'the completed mirror touch enters the pod without another objective');
  assert.equal(h.sandbox.life.film.state!.step, 0);
  assert.equal(h.sandbox.life.film.state!.awakening, undefined);
  assert.ok(h.sandbox.life.film.state!.completed.includes('m1_mirror'));
  assert.equal(h.actor().currentLocation, 'film_power_plant_pods');
  assert.equal(h.actor().isAwakened, true);
  h.advance(30); assert.equal(h.sandbox.life.film.state!.scene, 'm1_pod', 'the pod waits for Neo to inspect the connections');
});

test('Trinity being player-controlled pauses the electrode beat without advancing the mirror', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: 'm1_pills', actor: 'neo', step: 2 }); h.command('next');
  h.actor().position = filmStepPosition(FILM_SCENE_BY_ID.m1_mirror, FILM_SCENE_BY_ID.m1_mirror.steps[0]);
  h.players.possess('other', 'trinity', h.tick());
  assert.match(h.command('act'), /Trinity/);
  assert.equal(state.awakening, undefined);
  h.players.release('other', h.tick()); h.command('act');
  for (let i = 0; i < 17; i++) h.players.step(.1, true, h.tick());
  const elapsed = state.awakening!.elapsed;
  h.players.possess('other', 'trinity', h.tick());
  for (let i = 0; i < 17; i++) h.players.step(.1, true, h.tick());
  assert.equal(state.awakening!.elapsed, elapsed);
  h.players.release('other', h.tick()); h.players.step(.1, true, h.tick());
  assert.ok(state.awakening!.elapsed > elapsed);
});

test('old mirror saves after the touch resume in the pod instead of requiring the removed chair beat', () => {
  for (const legacy of [
    { step: 1, awakening: { kind: 'mirror', elapsed: 8 } },
    { step: 1, awakening: { kind: 'connect', elapsed: 2 } },
    { step: 2, awakening: { kind: 'connect', elapsed: 4 } },
  ]) {
    const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
    Object.assign(state, { scene: 'm1_mirror', actor: 'neo', ...legacy });
    if (legacy.step === 2) state.completed.push('m1_mirror');
    h.actor().currentLocation = 'film_lafayette';
    h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
    assert.equal(h.sandbox.life.film.state!.scene, 'm1_pod');
    assert.equal(h.sandbox.life.film.state!.completed.filter(id => id === 'm1_mirror').length, 1);
    assert.equal(h.actor().currentLocation, 'film_power_plant_pods');
  }
});

test('pod disconnection moves Neo down the drain; rescue must be started in the water and lifts the body', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: 'm1_mirror', actor: 'neo', step: 1 }); h.command('next');
  const start = { ...h.actor().position };
  h.command('act'); assert.equal(state.awakening?.kind, 'disconnect');
  for (let i = 0; i < 100; i++) h.players.step(.1, true, h.tick());
  assert.equal(state.step, 1); assert.ok(h.actor().position.y < start.y - 16);
  assert.ok(h.actor().position.z > start.z + 20); assert.equal(h.actor().health, h.actor().maxHealth);
  const water = { ...h.actor().position }; h.advance(40); h.players.step(.1, true, h.tick());
  assert.deepEqual(h.actor().position, water); assert.equal(state.step, 1);
  h.command('act'); assert.equal(state.awakening?.kind, 'rescue');
  for (let i = 0; i < 60; i++) h.players.step(.1, true, h.tick());
  assert.ok(h.actor().position.y > water.y + 10); assert.equal(state.step, 2);
  h.command('next'); assert.equal(state.scene, 'm1_recovery'); assert.deepEqual(state.awakening, { kind: 'recovery', elapsed: 0, started: false });
});

test('recovery begins on the medical bed, waits for Neo, and resumes its saved performance after pause and reconnect', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: 'm1_pod', actor: 'neo', step: 2 }); h.command('next');
  assert.equal(state.scene, 'm1_recovery');
  assert.deepEqual(state.awakening, { kind: 'recovery', elapsed: 0, started: false });
  const bed = { ...h.actor().position };
  h.players.receiveInput('film-player', { x: 1, z: 1, yaw: 0, sprint: true, jump: true, sequence: 1 });
  for (let i = 0; i < 20; i++) h.players.step(.1, true, h.tick());
  assert.deepEqual(h.actor().position, bed, 'waiting for G cannot slide the weak body off the bed');
  assert.equal(state.awakening!.elapsed, 0, 'waiting does not make the choice for the player');
  assert.equal(h.players.possess('other-player', 'trinity', h.tick()).agentId, 'trinity');
  assert.match(h.command('act'), /Trinity/, 'a player-controlled bedside performer pauses the recovery start');
  assert.equal(state.awakening!.started, false);
  h.players.release('other-player', h.tick());
  h.command('act'); assert.equal(state.awakening!.started, true);
  for (let i = 0; i < 100; i++) h.players.step(.1, true, h.tick());
  const morpheus = h.world.agents.get('morpheus')!, trinity = h.world.agents.get('trinity')!;
  assert.deepEqual(morpheus.currentAction?.parameters.recoveryCrew, { elapsed: state.awakening!.elapsed, role: 'morpheus' });
  assert.deepEqual(trinity.currentAction?.parameters.recoveryCrew, { elapsed: state.awakening!.elapsed, role: 'trinity' });
  assert.ok(Math.hypot(morpheus.position.x - h.actor().position.x, morpheus.position.z - h.actor().position.z) < 4, 'Morpheus moves to Neo’s bedside');
  assert.ok(Math.hypot(trinity.position.x - h.actor().position.x, trinity.position.z - h.actor().position.z) < 4, 'Trinity moves to Neo’s bedside');
  assert.equal(h.players.possess('other-player', 'morpheus', h.tick()).agentId, 'morpheus');
  const held = state.awakening!.elapsed;
  for (let i = 0; i < 5; i++) h.players.step(.1, true, h.tick());
  assert.equal(state.awakening!.elapsed, held, 'taking over a supporting performer freezes both sides of the contact');
  h.players.release('other-player', h.tick());
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)); const elapsed = state.awakening!.elapsed;
  h.players.step(.5, false, h.tick()); assert.equal(state.awakening!.elapsed, elapsed, 'pause freezes the needles and body pose');
  h.sandbox.restore(saved); h.players.release('film-player', h.tick()); h.advance(30);
  assert.equal(h.sandbox.life.film.state!.awakening!.elapsed, elapsed, 'disconnection cannot finish recovery');
  h.players.possess('film-player', 'neo', h.tick());
  assert.match(h.players.act('film-player', 'attack', h.tick()), /演出/);
  for (let i = 0; i < 120 && h.sandbox.life.film.state!.step === 0; i++) h.players.step(.1, true, h.tick());
  assert.equal(h.sandbox.life.film.state!.step, 1);
  assert.equal(h.sandbox.life.film.state!.awakening!.elapsed, 12);
  assert.ok(h.actor().position.x > bed.x + 2.5, 'Neo finishes standing beside the bed rather than inside it');
  h.advance(30); assert.equal(h.sandbox.life.film.state!.step, 1, 'walking to the core remains a separate objective');
});

test('the Construct television and ruined-world lesson wait for Neo and preserve both reveal performances', () => {
  assert.match(awakeningPose({ kind: 'construct', elapsed: 1 }).text, /雪花/);
  assert.match(awakeningPose({ kind: 'construct', elapsed: 10 }).text, /废墟/);
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: 'm1_recovery', actor: 'neo', step: FILM_SCENE_BY_ID.m1_recovery.steps.length, awakening: undefined });
  h.command('next'); assert.equal(state.scene, 'm1_construct');
  assert.deepEqual(state.awakening, { kind: 'construct', elapsed: 0, started: false });
  const chair = { ...h.actor().position }; h.advance(20);
  assert.equal(state.step, 0); assert.deepEqual(h.actor().position, chair, 'the television cannot start itself while Neo waits');
  h.command('act'); for (let frame = 0; frame < 43; frame++) h.players.step(.1, true, h.tick());
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)); const constructElapsed = state.awakening!.elapsed;
  h.players.step(.8, false, h.tick()); assert.equal(state.awakening!.elapsed, constructElapsed);
  h.sandbox.restore(saved); h.players.release('film-player', h.tick()); h.advance(20);
  assert.equal(h.sandbox.life.film.state!.awakening!.elapsed, constructElapsed, 'disconnecting freezes the television lesson');
  h.players.possess('film-player', 'neo', h.tick());
  for (let frame = 0; frame < 120 && h.sandbox.life.film.state!.step === 0; frame++) h.players.step(.1, true, h.tick());
  assert.equal(h.sandbox.life.film.state!.step, 1);
  h.actor().position = filmStepPosition(FILM_SCENE_BY_ID.m1_construct, FILM_SCENE_BY_ID.m1_construct.steps[0]);
  h.players.receiveInput('film-player', { x: 1, z: 0, yaw: 0, sprint: true, jump: true, sequence: 1 });
  h.players.step(.1, true, h.tick());
  assert.deepEqual(h.actor().position, chair, 'Neo remains seated for the on-screen choice after the reveal');
  assert.equal(h.actor().currentAction?.parameters.seated, true);
  h.actor().position = filmStepPosition(FILM_SCENE_BY_ID.m1_construct, FILM_SCENE_BY_ID.m1_construct.steps[0]);
  const agency = h.sandbox.state.neoLife!.philosophy.agency;
  h.command('reflect:agency');
  assert.equal(h.sandbox.life.film.state!.scene, 'm1_desert', 'choosing at the television immediately enters the ruined world');
  assert.equal(h.sandbox.life.film.state!.reflections['m1_construct:1'], 'agency');
  assert.equal(h.sandbox.state.neoLife!.philosophy.agency, agency + 1);
  assert.ok(h.sandbox.life.film.state!.completed.includes('m1_construct'));
  const chosen = JSON.parse(JSON.stringify(h.sandbox.state));
  h.sandbox.restore(chosen);
  assert.equal(h.sandbox.life.film.state!.scene, 'm1_desert', 'reload resumes after the committed choice');
  assert.equal(h.sandbox.state.neoLife!.philosophy.agency, agency + 1, 'reload does not duplicate the reflection');
  const desert = FILM_SCENE_BY_ID.m1_desert; h.actor().position = filmStepPosition(desert, desert.steps[0]); h.advance();
  assert.equal(h.sandbox.life.film.state!.step, 1);
  assert.deepEqual(h.sandbox.life.film.state!.awakening, { kind: 'desert', elapsed: 0, started: false });
  const overlook = { ...h.actor().position }; h.advance(20); assert.deepEqual(h.actor().position, overlook);
  h.command('act');
  for (let frame = 0; frame < 140 && h.sandbox.life.film.state!.step === 1; frame++) h.players.step(.1, true, h.tick());
  assert.equal(h.sandbox.life.film.state!.step, 2); assert.ok(h.sandbox.life.film.state!.completed.includes('m1_desert'));
});

test('old saves at authored reveal checkpoints are upgraded into explicit player-started performances', () => {
  for (const [sceneId, step, kind] of [['m1_recovery', 0, 'recovery'], ['m1_construct', 0, 'construct'], ['m1_desert', 1, 'desert']] as const) {
    const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!; const scene = FILM_SCENE_BY_ID[sceneId];
    Object.assign(state, { scene: sceneId, actor: 'neo', step, checkpoint: filmEntry(scene), awakening: undefined });
    h.actor().currentLocation = scene.set; h.actor().isInMatrix = FILM_SETS[scene.set].world === 'matrix'; h.actor().position = filmEntry(scene);
    h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
    assert.deepEqual(h.sandbox.life.film.state!.awakening, { kind, elapsed: 0, started: false }, sceneId);
    const parameters = h.actor().currentAction?.parameters;
    assert.equal(parameters?.reveal?.kind ?? (parameters?.recovery !== undefined ? 'recovery' : undefined), kind, `${sceneId}: actor pose`);
  }
});

test('training download waits for Neo, pauses with the world, survives reconnect and finishes in the core chair', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  const desert = FILM_SCENE_BY_ID.m1_desert;
  Object.assign(state, { scene: desert.id, actor: 'neo', step: desert.steps.length, awakening: undefined });
  h.command('next');
  assert.equal(state.scene, 'm1_download');
  assert.deepEqual(state.training, { kind: 'download', elapsed: 0, started: false });
  const chair = { ...h.actor().position }; h.advance(20);
  assert.deepEqual(h.actor().position, chair, 'the program cannot load before Neo explicitly starts it');
  h.players.possess('other-player', 'tank', h.tick());
  assert.match(h.command('act'), /Tank|另一位玩家/); assert.equal(state.training!.started, false);
  h.players.release('other-player', h.tick()); h.command('act');
  assert.equal(state.training!.started, true);
  for (let i = 0; i < 34; i++) h.players.step(.1, true, h.tick());
  const elapsed = state.training!.elapsed; const saved = JSON.parse(JSON.stringify(h.sandbox.state));
  h.players.step(.8, false, h.tick()); assert.equal(state.training!.elapsed, elapsed);
  h.sandbox.restore(saved); h.players.release('film-player', h.tick()); h.advance(20);
  assert.equal(h.sandbox.life.film.state!.training!.elapsed, elapsed, 'disconnecting cannot finish a knowledge upload');
  h.players.possess('film-player', 'neo', h.tick());
  for (let i = 0; i < 120 && h.sandbox.life.film.state!.step === 0; i++) h.players.step(.1, true, h.tick());
  assert.equal(h.sandbox.life.film.state!.step, 1);
  assert.equal(h.sandbox.life.film.state!.training!.elapsed, 10);
});

test('the dojo requires reading Morpheus attack, dodging it and landing an ordered three-hit counter', t => {
  let now = 100_000; t.mock.method(Date, 'now', () => now);
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  const download = FILM_SCENE_BY_ID.m1_download;
  Object.assign(state, { scene: download.id, actor: 'neo', step: download.steps.length, training: undefined });
  h.command('next'); assert.equal(state.scene, 'm1_dojo');
  h.actor().position = filmStepPosition(FILM_SCENE_BY_ID.m1_dojo, FILM_SCENE_BY_ID.m1_dojo.steps[0]);
  h.actor().rotation = Math.PI;
  h.command('act'); const threat = h.sandbox.state.threats[0];
  assert.equal(threat.character, 'morpheus'); assert.equal(threat.health, 999);
  const facing = { x: Math.sin(h.actor().rotation), z: Math.cos(h.actor().rotation) };
  assert.ok((threat.position.x - h.actor().position.x) * facing.x + (threat.position.z - h.actor().position.z) * facing.z > 0,
    'the duel opponent starts in front of the player camera');
  h.actor().position = { ...threat.position, z: threat.position.z + 2 }; h.actor().rotation = Math.PI;
  h.sandbox.attack(h.actor(), h.tick(), 2);
  assert.equal(state.dojo?.combo, 0, 'kicks before observing the lesson cannot skip its first stage');
  assert.equal(threat.health, 999, 'Morpheus blocks damage until Neo reads and dodges the lesson');
  threat.stunUntil = h.tick();
  threat.attackAt = h.tick() + 2; threat.lastStrike = h.tick();
  const health = h.actor().health; h.players.act('film-player', 'dodge', h.tick());
  assert.equal(state.dojo?.dodged, true);
  assert.equal(threat.attackAt, undefined, 'pressing dodge during the visible windup cancels the lesson strike immediately');
  h.players.step(.1, true, h.tick());
  const targetYaw = Math.atan2(threat.position.x - h.actor().position.x, threat.position.z - h.actor().position.z);
  assert.ok(Math.abs(Math.atan2(Math.sin(h.actor().rotation - targetYaw), Math.cos(h.actor().rotation - targetYaw))) < .01,
    'the lesson keeps Neo facing Morpheus after the dodge so the counter can connect');
  h.players.step(.1, true, h.tick()); h.players.step(.1, true, h.tick());
  h.advance(20); assert.equal(h.actor().health, health, 'Morpheus holds his guard instead of repeatedly damaging Neo during the counter lesson');
  h.actor().position = { ...threat.position, z: threat.position.z + 2 }; h.actor().rotation = 0;
  h.players.receiveInput('film-player', { x: 0, z: 0, yaw: 0, jump: false, sprint: false, sequence: 1 });
  h.players.act('film-player', 'attack', h.tick());
  h.players.receiveInput('film-player', { x: 0, z: 0, yaw: 0, jump: false, sprint: false, sequence: 2 });
  h.players.step(.1, true, h.tick()); h.players.step(.1, true, h.tick());
  assert.equal(state.dojo?.combo, 1, 'the first real attack input locks back onto Morpheus and lands');
  h.advance(20); assert.equal(h.actor().health, health, 'landing a counter does not release Morpheus from his guard');
  now += 1_600;
  h.actor().position = { ...threat.position, z: threat.position.z + 2 }; h.actor().rotation = 0;
  h.players.receiveInput('film-player', { x: 0, z: 0, yaw: 0, jump: false, sprint: false, sequence: 3 });
  h.players.act('film-player', 'attack', h.tick()); h.players.step(.1, true, h.tick()); h.players.step(.1, true, h.tick());
  assert.equal(state.dojo?.combo, 2, 'the dojo leaves enough time to read the HUD and perform the straight punch');
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)); h.sandbox.restore(saved);
  assert.equal(h.sandbox.life.film.state!.dojo?.combo, 2, 'counter sequence survives a reload');
  h.players.release('film-player', h.tick()); h.players.possess('film-player', 'neo', h.tick()); now += 5_000;
  const restored = h.sandbox.state.threats[0]; h.actor().position = { ...restored.position, z: restored.position.z + 2 }; h.actor().rotation = 0;
  h.players.receiveInput('film-player', { x: 0, z: 0, yaw: 0, jump: false, sprint: false, sequence: 1 });
  h.players.act('film-player', 'attack', h.tick()); h.players.step(.1, true, h.tick()); h.players.step(.1, true, h.tick()); h.players.step(.1, true, h.tick()); h.advance();
  assert.equal(h.sandbox.life.film.state!.step, 1); assert.equal(h.sandbox.state.threats.length, 0);
  assert.equal(h.world.agents.get('morpheus')!.status, 'alive');
  assert.equal(neoSkillUnlocked(h.sandbox.state.neoLife, 0), true, 'the authored dojo unlocks Neo bullet time too');
});

test('Morpheus demonstrates the rooftop jump before Neo can attempt the recoverable gap', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  const dojo = FILM_SCENE_BY_ID.m1_dojo;
  Object.assign(state, { scene: dojo.id, actor: 'neo', step: dojo.steps.length, fighting: undefined, dojo: undefined });
  h.command('next'); const scene = FILM_SCENE_BY_ID.m1_jump; assert.equal(state.scene, scene.id);
  h.actor().position = filmStepPosition(scene, scene.steps[0]); h.advance(); assert.equal(state.step, 1);
  const morpheus = h.world.agents.get('morpheus')!; const before = { ...morpheus.position };
  h.command('act'); assert.deepEqual(state.training, { kind: 'jump', elapsed: 0, started: true });
  for (let i = 0; i < 18; i++) h.players.step(.1, true, h.tick());
  assert.ok(morpheus.position.y > FILM_SETS[scene.set].center.y + 3, 'Morpheus follows a visible arc over the alley');
  const elapsed = state.training!.elapsed; h.players.step(.5, false, h.tick()); assert.equal(state.training!.elapsed, elapsed);
  for (let i = 0; i < 50; i++) h.players.step(.1, true, h.tick());
  assert.equal(state.training!.elapsed, 4); assert.ok(morpheus.position.z < before.z - 18);
  assert.equal(state.step, 1, 'the demonstration does not perform Neo jump for the player');
});

test('the red-dress attention test is player-started, freezes the crowd and replaces a civilian with Smith', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  const jump = FILM_SCENE_BY_ID.m1_jump;
  Object.assign(state, { scene: jump.id, actor: 'neo', step: jump.steps.length, training: undefined });
  h.command('next'); const scene = FILM_SCENE_BY_ID.m1_red_dress; assert.equal(state.scene, scene.id);
  h.actor().position = filmStepPosition(scene, scene.steps[0]); h.advance(); assert.equal(state.step, 1);
  assert.deepEqual(state.training, { kind: 'red_dress', elapsed: 0, started: false });
  const woman = h.world.agents.get('citizen_2')!; const civilian = h.world.agents.get('citizen_1')!; const smith = h.world.agents.get('smith')!;
  assert.equal(woman.status, 'alive'); assert.equal(civilian.status, 'alive'); assert.equal(smith.status, 'disconnected');
  h.advance(20); assert.equal(state.training!.elapsed, 0);
  h.command('act'); for (let i = 0; i < 70; i++) h.players.step(.1, true, h.tick());
  assert.equal(civilian.status, 'disconnected'); assert.equal(smith.status, 'alive');
  assert.ok(h.actor().rotation > -1 && h.actor().rotation < 1, 'Neo is turned back toward the agent reveal');
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)); const elapsed = state.training!.elapsed;
  h.sandbox.restore(saved); h.players.release('film-player', h.tick()); h.advance(20);
  assert.equal(h.sandbox.life.film.state!.training!.elapsed, elapsed);
  h.players.possess('film-player', 'neo', h.tick());
  for (let i = 0; i < 80 && h.sandbox.life.film.state!.step === 1; i++) h.players.step(.1, true, h.tick());
  assert.equal(h.sandbox.life.film.state!.step, 2); assert.ok(h.sandbox.life.film.state!.completed.includes(scene.id));
});

test('the first rooftop jump uses gravity and a recoverable fall rather than a timer', () => {
  const h = setup(); h.command('start'); const state = h.sandbox.life.film.state!;
  const scene = FILM_SCENE_BY_ID.m1_jump; state.scene = scene.id; state.actor = scene.actor; state.step = 0;
  h.players.possess('film-player', 'neo', h.tick()); h.actor().isInMatrix = true; h.actor().currentLocation = scene.set;
  h.actor().position = filmStepPosition(scene, scene.steps[0]); h.advance();
  assert.equal(state.step, 1);
  h.command('act');
  for (let frame = 0; frame < 41; frame++) h.players.step(.1, true, h.tick());
  h.advance(30); assert.equal(state.step, 1, 'watching Morpheus must not complete Neo jump');
  let vy = 0; let falling = false;
  for (let frame = 0; frame < 180 && state.step === 1; frame++) {
    const move = stepPlayer(h.actor().position, vy, { x: 0, z: -1, yaw: Math.PI, sprint: true, jump: frame === 9, sequence: frame }, 1 / 60, true);
    h.actor().position = move.position; vy = move.verticalVelocity;
    falling ||= h.actor().position.y < FILM_SETS[scene.set].center.y - 3;
    if (frame % 30 === 0) h.advance();
  }
  assert.ok(falling, 'the space between roofs must have no invisible floor');
  assert.ok(state.completed.includes(scene.id)); assert.equal(h.actor().status, 'alive');
  assert.match(state.lastText, /第一次|失败/);
  assert.equal(h.actor().position.y, FILM_SETS[scene.set].center.y);
});

test('Morpheus and Seraph take part in their own nonlethal duels without cloning an occupied role', () => {
  for (const id of ['m1_dojo', 'm2_seraph']) {
    const h = setup(); h.command('start'); const state = h.sandbox.life.film.state!; const scene = FILM_SCENE_BY_ID[id];
    state.scene = id; state.actor = 'neo'; state.step = 0; const opponent = id === 'm1_dojo' ? 'morpheus' : 'seraph';
    h.players.possess('film-player', 'neo', h.tick()); h.actor().isInMatrix = true; h.actor().currentLocation = scene.set;
    h.actor().position = filmStepPosition(scene, scene.steps[0]);
    h.players.possess('other-player', opponent, h.tick());
    assert.match(h.command('act'), /另一位玩家/); assert.equal(h.sandbox.state.threats.length, 0);
    h.players.release('other-player', h.tick()); h.command('act');
    assert.equal(h.sandbox.state.threats.length, 1); const threat = h.sandbox.state.threats[0];
    assert.equal(threat.character, opponent);
    if (id === 'm1_dojo') {
      h.sandbox.life.film.trainingDodge(h.actor(), threat, h.tick());
      for (const combo of [0, 1, 2]) {
        h.actor().position = { ...threat.position, z: threat.position.z + 2 }; h.actor().rotation = Math.PI;
        h.sandbox.attack(h.actor(), h.tick(), combo);
      }
    } else {
      for (let exchange = 0; exchange < 2; exchange++) {
        threat.attackAt = h.tick() + 1; threat.stunUntil = 0;
        assert.equal(h.sandbox.life.film.trainingDodge(h.actor(), threat, h.tick()), true);
        h.actor().position = { ...threat.position, z: threat.position.z + 2 }; h.actor().rotation = Math.PI;
        h.sandbox.attack(h.actor(), h.tick(), exchange);
      }
    }
    h.advance(); assert.equal(state.step, 1); assert.equal(h.world.agents.get(opponent)!.status, 'alive');
    assert.notEqual(h.world.agents.get(opponent)!.currentAction?.parameters.filmDuel, true);
  }
});

test('Seraph tests two separately read attacks, blocks reckless blows and resets a failed exchange without killing Neo', () => {
  const h = setup(); h.command('start'); const state = h.sandbox.life.film.state!; const scene = FILM_SCENE_BY_ID.m2_seraph;
  state.scene = scene.id; state.actor = 'neo'; state.step = 0; h.players.possess('film-player', 'neo', h.tick());
  h.actor().isInMatrix = true; h.actor().currentLocation = scene.set; h.actor().position = filmStepPosition(scene, scene.steps[0]);
  h.command('act'); const threat = h.sandbox.state.threats[0]; assert.equal(threat.character, 'seraph');
  h.actor().position = { ...threat.position, z: threat.position.z + 2 }; h.actor().rotation = Math.PI;
  h.sandbox.attack(h.actor(), h.tick(), 2);
  assert.equal(threat.health, threat.maxHealth); assert.equal(state.step, 0); assert.equal(threat.stunUntil < 100, true);
  assert.equal(h.sandbox.life.film.trainingDodge(h.actor(), threat, h.tick()), false, 'a dodge outside a windup does not count');
  delete state.seraph; threat.attackAt = h.tick() + 1;
  h.sandbox.attack(h.actor(), h.tick(), 2);
  assert.equal(threat.attackAt, h.tick() + 1, 'an older save without duel progress must still preserve the windup');
  threat.attackAt = h.tick() + 1; h.sandbox.attack(h.actor(), h.tick(), 2);
  assert.equal(threat.attackAt, h.tick() + 1, 'a parried attack must not cancel Seraph’s windup');
  for (let exchange = 0; exchange < 2; exchange++) {
    threat.attackAt = h.tick() + 1; threat.stunUntil = 0;
    assert.equal(h.sandbox.life.film.trainingDodge(h.actor(), threat, h.tick()), true);
    h.actor().position = { ...threat.position, z: threat.position.z + 2 }; h.actor().rotation = Math.PI;
    h.sandbox.attack(h.actor(), h.tick(), exchange);
    assert.equal(state.seraph?.counters, exchange + 1);
  }
  h.advance(); assert.equal(state.step, 1); assert.equal(h.world.agents.get('seraph')!.status, 'alive');
  h.command('retry'); assert.equal(state.step, 1, 'retry keeps the completed trial');
});

test('Seraph calls off a losing spar and leaves a repeatable checkpoint', () => {
  const h = setup(); h.command('start'); const state = h.sandbox.life.film.state!; const scene = FILM_SCENE_BY_ID.m2_seraph;
  state.scene = scene.id; state.actor = 'neo'; state.step = 0; h.players.possess('film-player', 'neo', h.tick());
  h.actor().isInMatrix = true; h.actor().currentLocation = scene.set; h.actor().position = filmStepPosition(scene, scene.steps[0]);
  h.command('act'); const threat = h.sandbox.state.threats[0];
  threat.position = { ...h.actor().position, z: h.actor().position.z - 2 }; threat.attackAt = h.tick(); threat.stunUntil = 0;
  h.actor().health = 3; h.advance();
  assert.equal(state.seraph?.attempts, 1); assert.equal(state.step, 0); assert.equal(h.actor().health, h.actor().maxHealth);
  assert.equal(h.sandbox.state.threats.length, 0); assert.equal(h.actor().status, 'alive');
  h.command('act'); assert.equal(h.sandbox.state.threats.length, 1);
});

test('the keyed doors must be reached, and the Oracle leaves a saved Keymaker lead with a later consequence', () => {
  const h = setup(); h.command('start'); const state = h.sandbox.life.film.state!; const tea = FILM_SCENE_BY_ID.m2_seraph;
  state.scene = tea.id; state.actor = 'neo'; state.step = tea.steps.length; h.players.possess('film-player', 'neo', h.tick());
  h.actor().isInMatrix = true; h.actor().currentLocation = tea.set; h.actor().position = filmEntry(tea);
  assert.match(h.command('next'), /后门/); assert.equal(state.scene, tea.id);
  h.actor().position = filmStepPosition(tea, tea.steps.at(-1)!); h.command('next');
  assert.equal(state.scene, 'm2_backdoors'); assert.equal(h.actor().currentLocation, FILM_SCENE_BY_ID.m2_backdoors.set);
  const hall = FILM_SCENE_BY_ID.m2_backdoors;
  h.actor().position = filmStepPosition(hall, hall.steps[0]); h.advance();
  h.actor().position = filmStepPosition(hall, hall.steps[1]); h.command('act'); h.advance((hall.steps[1].seconds ?? 3) * 2 + 1);
  assert.equal(state.step, hall.steps.length);
  h.actor().position = filmEntry(hall); assert.match(h.command('next'), /庭院/); assert.equal(state.scene, hall.id);
  h.actor().position = filmStepPosition(hall, hall.steps.at(-1)!); h.command('next');
  assert.equal(state.scene, 'm2_bench');
  const bench = FILM_SCENE_BY_ID.m2_bench;
  h.actor().position = filmStepPosition(bench, bench.steps[0]); h.advance();
  h.actor().position = filmStepPosition(bench, bench.steps[1]); h.command('act'); h.advance((bench.steps[1].seconds ?? 3) * 2 + 1);
  h.actor().position = filmStepPosition(bench, bench.steps[2]); h.command('reflect:agency');
  assert.equal(state.step, 3); assert.equal(h.sandbox.state.neoLife!.choices.oracle_second_lead, undefined);
  h.actor().position = filmStepPosition(bench, bench.steps[3]); h.command('act'); h.advance((bench.steps[3].seconds ?? 3) * 2 + 1);
  assert.equal(h.sandbox.state.neoLife!.choices.oracle_second_lead, 'le_vrai');
  assert.equal(h.world.agents.get('oracle')!.currentAction?.parameters.seated, undefined, 'Oracle stands when she leaves the bench');
  assert.ok(h.world.agents.get('oracle')!.targetPosition, 'Oracle physically departs after giving Neo the address');
  assert.equal(state.reflections['m2_bench:2'], 'agency');
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)); h.sandbox.restore(saved);
  const restored = h.sandbox.life.film.state!;
  assert.equal(restored.step, bench.steps.length); assert.equal(restored.reflections['m2_bench:2'], 'agency');
  assert.equal(h.sandbox.state.neoLife!.choices.oracle_second_lead, 'le_vrai');
  h.command('next'); assert.equal(restored.scene, 'm2_burly');
  assert.notEqual(h.world.agents.get('oracle')!.currentLocation, bench.set, 'the Oracle has left before Smith arrives');
  const oldCode = h.sandbox.state.profiles.neo.inventory.code;
  const burly = FILM_SCENE_BY_ID.m2_burly; restored.step = burly.steps.length; h.actor().currentLocation = burly.set;
  h.command('next'); assert.equal(restored.scene, 'm2_merovingian');
  assert.ok(h.sandbox.state.profiles.neo.inventory.code > oldCode, 'the choice changes real preparation');
  const prepared = h.sandbox.state.profiles.neo.inventory.code;
  h.command('retry'); assert.equal(h.sandbox.state.profiles.neo.inventory.code, prepared, 'loading the checkpoint cannot duplicate the benefit');
});

test('the château fight requires a chosen weapon, timed parry and a climb before the upper guard wave', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  const library = FILM_SCENE_BY_ID.m2_library; const hall = FILM_SCENE_BY_ID.m2_chateau;
  Object.assign(state, { scene: library.id, actor: 'neo', step: library.steps.length });
  h.actor().currentLocation = library.set; h.actor().isInMatrix = true;
  h.command('next'); assert.equal(state.scene, hall.id);
  h.actor().position = filmStepPosition(hall, hall.steps[0]); h.command('act');
  assert.equal((state as any).chateau?.phase, 'duel');
  assert.equal(h.sandbox.state.threats.filter(t => t.scene === hall.id).length, 2);
  const guard = h.sandbox.state.threats.find(t => t.scene === hall.id)!;
  guard.position = { ...h.actor().position, z: h.actor().position.z - 2 };
  h.actor().rotation = Math.PI;
  const before = guard.health; h.sandbox.attack(h.actor(), h.tick(), 0);
  assert.equal(guard.health, before, 'an armed guard blocks an unprepared frontal strike');
  guard.attackAt = h.tick() + 2; guard.stunUntil = 0;
  assert.match(h.players.act('film-player', 'dodge', h.tick()), /格开/);
  assert.equal(guard.attackAt, undefined);
  h.actor().position = filmPosition(hall.set, -29, 17); h.command('act');
  assert.equal((state as any).chateau?.weapon, 'sword');
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  assert.equal((h.sandbox.life.film.state as any).chateau?.weapon, 'sword', 'the selected wall weapon survives reload');
  assert.equal(h.sandbox.state.threats.filter(t => t.scene === hall.id).length, 2);
  const finishWave = () => {
    for (const target of [...h.sandbox.state.threats.filter(t => t.scene === hall.id)]) {
      h.actor().position = { ...target.position, z: target.position.z + 2 }; h.actor().rotation = Math.PI;
      target.attackAt = h.tick() + 2; target.stunUntil = 0;
      h.players.act('film-player', 'dodge', h.tick());
      for (let hit = 0; hit < 3 && target.health > 0; hit++) h.sandbox.attack(h.actor(), h.tick(), 0);
      assert.equal(target.health, 0, `${target.weapon ?? 'disarmed'} guard was not defeated at wave ${h.sandbox.life.film.state?.chateau?.wave}`);
    }
  };
  finishWave(); h.advance();
  assert.equal(h.sandbox.life.film.state?.chateau?.phase, 'landing'); assert.equal(h.sandbox.life.film.state?.step, 0);
  assert.equal(h.sandbox.state.threats.filter(t => t.scene === hall.id).length, 0);
  h.advance(10); assert.equal(h.sandbox.life.film.state?.chateau?.phase, 'landing', 'waiting on the ground does not summon the upper wave');
  h.actor().position = filmStepPosition(hall, hall.steps[1]); h.advance();
  assert.equal(h.sandbox.life.film.state?.chateau?.wave, 2);
  assert.equal(h.sandbox.state.threats.filter(t => t.scene === hall.id).length, 2);
  finishWave(); h.advance(); assert.equal(h.sandbox.life.film.state?.step, 1);
  assert.equal(h.sandbox.life.film.state?.chateau?.phase, 'cleared');
  h.command('retry');
  assert.equal(h.sandbox.life.film.state?.step, 1);
  assert.equal(h.sandbox.life.film.state?.chateau?.phase, 'cleared', 'retry at the exit cannot restart a cleared battle');
});

test('EMP can stagger château guards but cannot bypass their weapon defense', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  const library = FILM_SCENE_BY_ID.m2_library; const hall = FILM_SCENE_BY_ID.m2_chateau;
  Object.assign(state, { scene: library.id, actor: 'neo', step: library.steps.length });
  h.actor().currentLocation = library.set; h.actor().isInMatrix = true; h.command('next');
  h.actor().position = filmStepPosition(hall, hall.steps[0]); h.command('act');
  h.sandbox.state.profiles.neo.inventory.emp = 2;
  const guard = h.sandbox.state.threats.find(t => t.scene === hall.id)!;
  const health = guard.health;
  h.sandbox.command(h.actor(), { kind: 'use', target: 'emp' }, h.tick());
  h.advance(3);
  h.sandbox.command(h.actor(), { kind: 'use', target: 'emp' }, h.tick());
  assert.equal(guard.health, health);
  assert.ok(guard.stunUntil > h.tick());
  assert.equal(state.chateau?.phase, 'duel');
});

test('an older château save restarts its unfinished fight without erasing a cleared exit', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  const library = FILM_SCENE_BY_ID.m2_library; const hall = FILM_SCENE_BY_ID.m2_chateau;
  Object.assign(state, { scene: library.id, actor: 'neo', step: library.steps.length });
  h.actor().currentLocation = library.set; h.actor().isInMatrix = true; h.command('next');
  h.actor().position = filmStepPosition(hall, hall.steps[0]); h.command('act');
  delete state.chateau;
  for (const guard of h.sandbox.state.threats.filter(t => t.scene === hall.id)) delete guard.weapon;
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  assert.equal(h.sandbox.life.film.state?.chateau?.phase, 'ready');
  assert.equal(h.sandbox.state.threats.filter(t => t.scene === hall.id).length, 0);
  h.actor().position = filmStepPosition(hall, hall.steps[0]);
  h.command('act'); assert.equal(h.sandbox.state.threats.filter(t => t.scene === hall.id).length, 2);
  const resumed = h.sandbox.life.film.state!;
  resumed.step = 1; delete resumed.chateau;
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  assert.equal(h.sandbox.life.film.state?.chateau?.phase, 'cleared');
  assert.equal(h.sandbox.life.film.state?.step, 1);
});

test('upper château guards remain on their floor when Neo retreats below the landing', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  const library = FILM_SCENE_BY_ID.m2_library; const hall = FILM_SCENE_BY_ID.m2_chateau;
  Object.assign(state, { scene: library.id, actor: 'neo', step: library.steps.length });
  h.actor().currentLocation = library.set; h.actor().isInMatrix = true; h.command('next');
  h.actor().position = filmStepPosition(hall, hall.steps[0]); h.command('act');
  h.sandbox.state.threats = h.sandbox.state.threats.filter(t => t.scene !== hall.id);
  h.advance(); h.actor().position = filmStepPosition(hall, hall.steps[1]); h.advance();
  h.actor().position = filmPosition(hall.set, -8, -25);
  h.advance(20);
  for (const guard of h.sandbox.state.threats.filter(t => t.scene === hall.id))
    assert.equal(guard.position.y, groundHeight(guard.position, true), 'guard cannot hover across the landing edge');
});

test('the château guard can wound Neo, and a failed attempt retries without losing the chosen weapon', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  const library = FILM_SCENE_BY_ID.m2_library; const hall = FILM_SCENE_BY_ID.m2_chateau;
  Object.assign(state, { scene: library.id, actor: 'neo', step: library.steps.length });
  h.actor().currentLocation = library.set; h.actor().isInMatrix = true; h.command('next');
  h.actor().position = filmStepPosition(hall, hall.steps[0]); h.command('act');
  h.actor().position = filmPosition(hall.set, -29, 17); h.command('act');
  const guard = h.sandbox.state.threats.find(t => t.scene === hall.id)!;
  guard.position = { ...h.actor().position, z: h.actor().position.z - 2 };
  guard.stunUntil = 0; guard.attackAt = h.tick() + 1;
  h.actor().health = 1; h.advance();
  assert.equal(state.chateau?.phase, 'failed'); assert.equal(state.chateau?.wounded, true);
  assert.equal(state.chateau?.weapon, 'sword'); assert.equal(h.actor().status, 'alive');
  assert.equal(h.sandbox.state.threats.filter(t => t.scene === hall.id).length, 0);
  h.command('act'); assert.equal(state.chateau?.phase, 'ready');
  h.actor().position = filmStepPosition(hall, hall.steps[0]); h.command('act');
  assert.equal(state.chateau?.weapon, 'sword'); assert.equal(h.sandbox.state.threats.filter(t => t.scene === hall.id).length, 2);
});

test('Neo must inspect the mountain exit, call Link, then steer a saved flight south before the garage cut', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  const hall = FILM_SCENE_BY_ID.m2_chateau; const mountain = FILM_SCENE_BY_ID.m2_mountain;
  Object.assign(state, { scene: hall.id, actor: 'neo', step: hall.steps.length });
  h.actor().currentLocation = hall.set; h.actor().isInMatrix = true;
  h.command('next'); assert.equal(state.scene, mountain.id);
  assert.equal(state.mountain?.phase, 'ground');
  h.actor().position = filmStepPosition(mountain, mountain.steps[0]); h.command('act'); h.advance(3);
  assert.equal(state.step, 1);
  h.actor().position = filmStepPosition(mountain, mountain.steps[1]); h.command('act'); h.advance(3);
  assert.equal(state.step, 2); assert.equal(state.mountain?.phase, 'ready');
  const flightInput = { x: 0, z: -1, yaw: Math.PI, jump: true, sprint: true, sequence: 1 };
  h.actor().position = filmStepPosition(mountain, mountain.steps[2]);
  h.players.receiveInput('film-player', flightInput); h.players.step(.1, true, h.tick());
  assert.equal(state.mountain?.phase, 'takeoff');
  for (let frame = 0; frame < 30; frame++) h.players.step(.1, true, h.tick());
  assert.ok(state.mountain!.altitude > 20);
  const before = state.mountain!.z;
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  assert.equal(h.sandbox.life.film.state?.mountain?.z, before);
  h.players.receiveInput('film-player', { ...flightInput, jump: false, sequence: 2 });
  for (let frame = 0; frame < 180 && h.sandbox.life.film.state?.step === 2; frame++) h.players.step(.1, true, h.tick());
  assert.equal(h.sandbox.life.film.state?.step, 3);
  assert.equal(h.sandbox.life.film.state?.mountain?.phase, 'arrived');
  h.command('next'); assert.equal(h.sandbox.life.film.state?.scene, 'm2_garage');
});

test('Neo can retry a missed mountain flight without replaying Link’s location call', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  const hall = FILM_SCENE_BY_ID.m2_chateau; const mountain = FILM_SCENE_BY_ID.m2_mountain;
  Object.assign(state, { scene: hall.id, actor: 'neo', step: hall.steps.length });
  h.actor().currentLocation = hall.set; h.actor().isInMatrix = true; h.command('next');
  for (let index = 0; index < 2; index++) {
    h.actor().position = filmStepPosition(mountain, mountain.steps[index]); h.command('act'); h.advance(3);
  }
  h.actor().position = filmStepPosition(mountain, mountain.steps[2]);
  h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, jump: true, sprint: false, sequence: 1 });
  for (let frame = 0; frame < 280; frame++) h.players.step(.1, true, h.tick());
  assert.equal(state.mountain?.phase, 'failed'); assert.equal(state.step, 2);
  h.command('retry'); assert.equal(state.mountain?.phase, 'ready');
  assert.equal(state.step, 2); assert.equal(state.mountain?.attempt, 1);
});

test('Smith assimilation is reversible at the ending, without reviving Trinity', () => {
  const h = setup(); h.command('start'); const state = h.sandbox.life.film.state!;
  const playLast = (id: string) => {
    const scene = FILM_SCENE_BY_ID[id]; state.scene = id; state.actor = scene.actor; state.step = scene.steps.length - 1;
    h.players.possess('film-player', scene.actor, h.tick());
    h.actor().isInMatrix = FILM_SETS[scene.set].world === 'matrix'; h.actor().currentLocation = scene.set;
    h.actor().position = filmStepPosition(scene, scene.steps[state.step]);
    if (id === 'm3_surrender') {
      h.sandbox.state.neoLife!.choices.machine_pact = 'peace'; h.sandbox.state.neoLife!.choices.machine_connection = 'active';
      h.command('act');
      h.players.receiveInput('film-player', { x: 0, z: 0, yaw: 0, jump: false, sprint: false, focus: true, sequence: 1 });
      for (let frame = 0; frame < 100 && state.step < scene.steps.length; frame++) h.players.step(.1, true, h.tick());
    } else { h.command(scene.steps[state.step].kind === 'reflect' ? 'reflect:care' : 'act'); h.advance(20); }
  };
  playLast('m3_oracle_absorbed'); h.command('next');
  assert.equal(h.world.agents.get('oracle')!.status, 'disconnected');
  playLast('m3_farewell');
  assert.equal(h.world.agents.get('trinity')!.status, 'dead');
  playLast('m3_surrender');
  for (const id of ['oracle', 'sati', 'seraph']) assert.equal(h.world.agents.get(id)!.status, 'alive', id);
  assert.equal(h.world.agents.get('trinity')!.status, 'dead');
});

function rideToExit(h: ReturnType<typeof setup>) {
  for (let frame = 0; h.sandbox.life.film.state!.ride?.phase === 'riding' && frame < 6000; frame++) {
    const ride = h.sandbox.life.film.state!.ride!;
    const steer = Math.max(-1, Math.min(1, (10 - ride.x) * .6 - ride.lateral * .25));
    h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, sprint: false, jump: false, drive: { throttle: 1, steer, brake: false }, sequence: frame + 100 });
    h.players.step(1 / 60, true, h.tick());
    if (frame % 30 === 0) h.advance();
  }
  assert.equal(h.sandbox.life.film.state!.ride?.phase, 'arrived'); h.advance();
}

test('highway traffic moves, braking reduces speed and a collision injures the vehicle and passenger once', () => {
  let ride = newFreewayRide();
  for (let i = 0; i < 60; i++) ride = stepFreeway(ride, { throttle: 1, steer: -1, brake: false }, 1 / 60);
  assert.ok(ride.speed > 12); assert.ok(ride.x < 14); assert.ok(ride.z < 660);
  const previous = ride.speed; ride = stepFreeway(ride, { throttle: 1, steer: 0, brake: true }, .1);
  assert.ok(ride.speed < previous);
  const car = freewayTraffic(0).find(c => c.x === 14)!;
  assert.ok(freewayTraffic(1).find(c => c.id === car.id)!.z > car.z);
  ride = { ...newFreewayRide(), x: car.x, z: car.z + 4, speed: 35 };
  ride = stepFreeway(ride, { throttle: 0, steer: 0, brake: false }, .05);
  assert.equal(ride.hits, 1); assert.ok(ride.hull < 100); assert.ok(ride.passenger < 100);
  const health = ride.hull; ride = stepFreeway(ride, { throttle: 0, steer: 0, brake: true }, .05);
  assert.equal(ride.hull, health, 'one collision cannot drain all health over successive frames');
  const parked = { ...newFreewayRide(), x: car.x, z: car.z + 6 };
  const struck = stepFreeway(parked, { throttle: 0, steer: 0, brake: true }, .05);
  assert.ok(struck.hull < 100, 'an oncoming car must damage a stationary motorcycle too');
});

test('garage twins phase through a fast car, while hesitation and wall impacts can defeat the escort', () => {
  let escape = newGarageEscape();
  for (let frame = 0; frame < 160 && escape.phase === 'riding'; frame++) escape = stepGarageEscape(escape, { throttle: 1, steer: 0, brake: false }, .05);
  assert.equal(escape.phase, 'arrived'); assert.equal(escape.twins, 3);
  assert.equal(escape.hits, 0); assert.equal(escape.passenger, 100);
  let slow = newGarageEscape();
  for (let frame = 0; frame < 300 && slow.phase === 'riding'; frame++) slow = stepGarageEscape(slow, { throttle: 0, steer: 0, brake: true }, .05);
  assert.equal(slow.phase, 'wrecked'); assert.ok(slow.elapsed <= 14);
  let barrier = { ...newGarageEscape(), x: 7.8, speed: 20 };
  barrier = stepGarageEscape(barrier, { throttle: 1, steer: 1, brake: false }, .1);
  assert.ok(barrier.hits > 0); assert.ok(barrier.hull < 100);
});

test('Trinity drives the garage escape with companions, saved progress, retry and a clean highway handoff', () => {
  const h = setup(); h.command('start'); let state = h.sandbox.life.film.state!; const scene = FILM_SCENE_BY_ID.m2_garage;
  Object.assign(state, { scene: scene.id, actor: scene.actor, step: 0 });
  h.players.possess('film-player', 'trinity', h.tick()); h.actor().currentLocation = scene.set; h.actor().isInMatrix = true;
  h.actor().position = filmStepPosition(scene, scene.steps[0]); h.advance(); assert.equal(state.step, 1);
  h.actor().position = filmStepPosition(scene, scene.steps[1]);
  h.players.possess('other', 'keymaker', h.tick()); assert.match(h.command('act'), /另一位玩家/); assert.equal(state.garage, undefined);
  h.players.release('other', h.tick()); h.command('act'); assert.equal(state.garage?.phase, 'riding');
  assert.match(h.players.possess('other', 'keymaker', h.tick()).error!, /车/);
  for (let frame = 0; frame < 18; frame++) h.sandbox.life.film.driveFrame(h.actor(), { throttle: 1, steer: 0, brake: false }, .05, h.tick());
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)); const at = { ...h.actor().position };
  h.sandbox.restore(saved); state = h.sandbox.life.film.state!; h.players.release('film-player', h.tick()); h.advance();
  assert.deepEqual(h.sandbox.life.film.state?.garage, saved.neoLife.journey.garage);
  h.players.possess('film-player', 'trinity', h.tick()); assert.deepEqual(h.actor().position, at);
  for (let frame = 0; frame < 160 && h.sandbox.life.film.state?.garage?.phase === 'riding'; frame++)
    h.sandbox.life.film.driveFrame(h.actor(), { throttle: 1, steer: 0, brake: false }, .05, h.tick());
  h.advance(); assert.equal(state.step, 2); assert.equal(h.world.agents.get('keymaker')!.status, 'alive');
  h.command('next'); assert.equal(state.scene, 'm2_freeway'); assert.equal(state.garage, undefined);
  Object.assign(state, { scene: scene.id, actor: scene.actor, step: 1, garage: { ...newGarageEscape(), elapsed: 13.9 } });
  h.actor().currentLocation = scene.set; h.actor().position = filmStepPosition(scene, scene.steps[1]);
  h.sandbox.life.film.driveFrame(h.actor(), { throttle: 0, steer: 0, brake: true }, .1, h.tick());
  assert.equal(h.actor().status, 'dead'); h.command('retry');
  assert.equal(state.step, 1); assert.equal(state.garage, undefined); assert.equal(h.actor().status, 'alive');
});

test('the motorcycle escort requires driving, preserves its position on reconnect, and finishes with a living passenger', () => {
  const h = setup(); h.command('start'); const state = h.sandbox.life.film.state!; const scene = FILM_SCENE_BY_ID.m2_freeway;
  Object.assign(state, { scene: scene.id, actor: scene.actor, step: 1 });
  h.players.possess('film-player', 'trinity', h.tick()); h.actor().currentLocation = scene.set; h.actor().isInMatrix = true;
  h.actor().position = filmStepPosition(scene, scene.steps[1]); state.checkpoint = { ...h.actor().position };
  h.command('act'); h.advance(30); assert.equal(state.step, 1, 'a timer cannot finish the ride');
  for (let i = 0; i < 20; i++) h.sandbox.life.film.driveFrame(h.actor(), { throttle: 1, steer: -1, brake: false }, .05, h.tick());
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)); const position = { ...h.actor().position };
  h.sandbox.restore(saved); h.players.release('film-player', h.tick()); h.advance(20);
  assert.deepEqual(h.sandbox.life.film.state!.ride, saved.neoLife.journey.ride);
  h.players.possess('film-player', 'trinity', h.tick()); assert.deepEqual(h.actor().position, position);
  const beforePause = { ...h.sandbox.life.film.state!.ride };
  h.players.step(.1, false, h.tick()); assert.deepEqual(h.sandbox.life.film.state!.ride, beforePause);
  rideToExit(h); assert.equal(h.sandbox.life.film.state!.step, 2);
  assert.equal(h.world.agents.get('keymaker')!.status, 'alive');
  assert.equal(h.world.agents.get('keymaker')!.currentAction, null);
});

test('a failed escort retries from the motorcycle and never takes another player as passenger', () => {
  const h = setup(); h.command('start'); const state = h.sandbox.life.film.state!; const scene = FILM_SCENE_BY_ID.m2_freeway;
  Object.assign(state, { scene: scene.id, actor: scene.actor, step: 1 });
  h.players.possess('film-player', 'trinity', h.tick()); h.actor().currentLocation = scene.set; h.actor().isInMatrix = true;
  h.actor().position = filmStepPosition(scene, scene.steps[1]); state.checkpoint = { ...h.actor().position };
  h.players.possess('other', 'keymaker', h.tick()); assert.match(h.command('act'), /另一位玩家/); assert.equal(state.ride, undefined);
  h.players.release('other', h.tick()); h.command('act');
  assert.match(h.players.possess('other', 'keymaker', h.tick()).error!, /后座/);
  Object.assign(state.ride!, { hull: 1, speed: 30, x: 26.5 });
  h.sandbox.life.film.driveFrame(h.actor(), { throttle: 1, steer: 1, brake: false }, .1, h.tick());
  assert.equal(h.actor().status, 'dead'); assert.equal(state.step, 1);
  h.command('retry'); assert.equal(state.ride, undefined); assert.deepEqual(h.actor().position, state.checkpoint);
  h.command('act'); assert.equal(state.ride!.hull, 100); assert.equal(state.ride!.passenger, 100);
});

test('the truck duel takes place on a standable trailer and Johnson returns through the driver', () => {
  const h = setup(); h.command('start'); const state = h.sandbox.life.film.state!; const scene = FILM_SCENE_BY_ID.m2_trucks;
  assert.equal(scene.set, 'film_freeway_trucks');
  assert.ok(scene.cast.includes('agent_johnson') && scene.cast.includes('keymaker') && scene.cast.includes('neo'));
  Object.assign(state, { scene: scene.id, actor: scene.actor, step: 0 });
  h.players.possess('film-player', 'morpheus', h.tick()); h.actor().currentLocation = scene.set; h.actor().isInMatrix = true;
  h.actor().position = filmEntry(scene); state.checkpoint = { ...h.actor().position };
  assert.equal(groundHeight(h.actor().position, true), h.actor().position.y);
  assert.equal(playerBlocked(h.actor().position, true), false);
  h.command('act');
  assert.equal(h.sandbox.state.threats.length, 1);
  assert.equal(h.sandbox.state.threats[0].character, 'agent_johnson');
  assert.equal(h.sandbox.state.threats[0].position.y, h.actor().position.y);
  const johnson = h.sandbox.state.threats[0];
  for (let hit = 0; johnson.health > 0 && hit < 12; hit++) {
    h.actor().position = { ...johnson.position, z: johnson.position.z + 2 }; h.actor().rotation = Math.PI;
    h.sandbox.attack(h.actor(), h.tick(), 2);
  }
  assert.equal(johnson.health, 0); h.advance();
  assert.equal(state.step, 1); assert.equal(state.trucks?.phase, 'collision');
  assert.equal(h.world.agents.get('agent_johnson')?.position.z, filmPosition(scene.set, 0, 14).z);
  assert.equal(h.world.agents.get('keymaker')?.status, 'alive');
});

test('truck collision is timed, preserves the rescue across saves and retries after failure', () => {
  const h = setup(); h.command('start'); let state = h.sandbox.life.film.state!; const scene = FILM_SCENE_BY_ID.m2_trucks;
  Object.assign(state, { scene: scene.id, actor: scene.actor, step: 1, trucks: { phase: 'collision', elapsed: 0, lastTick: h.tick(), attempt: 0 } });
  h.players.possess('film-player', 'morpheus', h.tick()); h.actor().currentLocation = scene.set; h.actor().isInMatrix = true;
  h.actor().position = filmEntry(scene); state.checkpoint = { ...h.actor().position };
  h.advance(5);
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)); h.sandbox.restore(saved); state = h.sandbox.life.film.state!;
  assert.equal(state.trucks?.elapsed, saved.neoLife.journey.trucks.elapsed);
  const beforeDisconnect = state.trucks!.elapsed;
  h.actor().controller = undefined; h.advance(8); h.actor().controller = 'film-player'; h.advance();
  assert.ok(state.trucks!.elapsed <= beforeDisconnect + .5, 'disconnection must not consume the collision window');
  h.actor().position = filmStepPosition(scene, scene.steps[1]); h.advance(); assert.equal(state.step, 2);
  h.command('act'); h.actor().controller = undefined; h.advance(6); h.actor().controller = 'film-player';
  assert.ok(state.started !== undefined, 'the held rescue action survives disconnection');
  h.advance(2); assert.equal(state.step, 2);
  h.advance(4);
  assert.equal(state.step, 2, 'the grab must play out before the scene is marked complete');
  assert.equal(state.trucks?.phase, 'rescue');
  const rescueSave = JSON.parse(JSON.stringify(h.sandbox.state)); h.sandbox.restore(rescueSave); state = h.sandbox.life.film.state!;
  assert.equal(state.trucks?.phase, 'rescue');
  for (let frame = 0; frame < 40 && state.trucks?.phase === 'rescue'; frame++) h.players.step(.1, true, h.tick());
  assert.equal(state.step, scene.steps.length); assert.equal(state.trucks?.phase, 'rescued');
  assert.equal(h.actor().position.y, FILM_SETS[scene.set].center.y, 'Morpheus lands on the safe shoulder');
  assert.equal(h.world.agents.get('keymaker')?.status, 'alive');
  h.command('next'); assert.equal(state.scene, FILM_SCENES[FILM_SCENES.indexOf(scene) + 1].id);
  Object.assign(state, { scene: scene.id, actor: scene.actor, step: 1, trucks: { phase: 'collision', elapsed: 9.8, lastTick: h.tick(), attempt: 0 } });
  h.players.possess('film-player', 'morpheus', h.tick());
  h.actor().currentLocation = scene.set; h.actor().position = filmEntry(scene); state.checkpoint = { ...h.actor().position };
  h.advance(3); assert.equal(h.actor().status, 'dead');
  h.command('retry'); assert.equal(h.actor().status, 'alive'); assert.equal(state.step, 1);
  assert.equal(state.trucks?.phase, 'collision'); assert.equal(state.trucks?.elapsed, 0);
  assert.equal(h.actor().position.y, filmEntry(scene).y);
});

test('an older truck checkpoint on the shared freeway moves onto the new trailer without losing progress', () => {
  const h = setup(); h.command('start'); const state = h.sandbox.life.film.state!; const scene = FILM_SCENE_BY_ID.m2_trucks;
  Object.assign(state, { scene: scene.id, actor: scene.actor, step: 1, checkpoint: filmPosition('film_freeway_101', 14, 25) });
  h.players.possess('film-player', 'morpheus', h.tick());
  h.actor().currentLocation = 'film_freeway_101'; h.actor().position = filmPosition('film_freeway_101', 14, 25);
  h.advance();
  assert.equal(h.actor().currentLocation, scene.set);
  assert.deepEqual(h.actor().position, filmEntry(scene));
  assert.deepEqual(state.checkpoint, filmEntry(scene));
  assert.equal(state.step, 1); assert.equal(state.trucks?.phase, 'collision');
});

test('Niobe arms the main station, Vigilant loss requires Trinity, and only both cuts open the 314-second door window', () => {
  const h = setup(); h.command('start'); const state = h.sandbox.life.film.state!;
  const power = FILM_SCENE_BY_ID.m2_power; Object.assign(state, { scene: power.id, actor: 'niobe', step: 1 });
  h.players.possess('film-player', 'niobe', h.tick()); h.actor().currentLocation = power.set; h.actor().isInMatrix = true;
  h.actor().position = filmStepPosition(power, power.steps[1]); h.command('act'); h.advance(12);
  assert.equal(state.step, 2); assert.equal(state.grid?.primary, 'armed');
  assert.equal(state.grid?.emergency, 'online'); assert.equal(state.grid?.phase, 'preparing');

  const vigilant = FILM_SCENE_BY_ID.m2_vigilant; Object.assign(state, { scene: vigilant.id, actor: 'trinity', step: 0 });
  h.players.possess('film-player', 'trinity', h.tick()); h.actor().currentLocation = vigilant.set; h.actor().isInMatrix = false;
  for (const index of [0, 1]) { h.actor().position = filmStepPosition(vigilant, vigilant.steps[index]); h.command('act'); h.advance(6); }
  assert.equal(state.grid?.vigilant, 'lost'); assert.equal(state.grid?.trinity, 'connected');

  const backup = FILM_SCENE_BY_ID.m2_backup; Object.assign(state, { scene: backup.id, step: 1 });
  h.actor().currentLocation = backup.set; h.actor().isInMatrix = true; h.actor().position = filmStepPosition(backup, backup.steps[1]);
  h.command('act'); h.advance(8);
  assert.equal(state.step, 2); assert.equal(state.grid?.primary, 'off'); assert.equal(state.grid?.emergency, 'online');
  assert.equal(state.grid?.phase, 'emergency'); assert.equal(state.grid?.remaining, 314);

  const door = FILM_SCENE_BY_ID.m2_key_door; Object.assign(state, { scene: door.id, actor: 'neo', step: 5,
    keyDoor: { portalOpened: true, keyTaken: true } });
  h.players.possess('film-player', 'neo', h.tick()); h.actor().currentLocation = door.set; h.actor().isInMatrix = true;
  h.actor().position = filmStepPosition(door, door.steps[5]); h.advance(24);
  assert.equal(state.grid?.phase, 'window'); assert.equal(state.grid?.emergency, 'off');
  h.advance(10);
  assert.ok(state.grid!.remaining < 314); h.command('act'); h.advance(6);
  assert.equal(state.grid?.phase, 'opened'); assert.equal(state.step, door.steps.length);
});

test('a missed grid window blocks the key door and reroutes through the surviving crews; pause and save freeze the repair', () => {
  const h = setup(); h.command('start'); let state = h.sandbox.life.film.state!;
  const door = FILM_SCENE_BY_ID.m2_key_door;
  Object.assign(state, { scene: door.id, actor: 'neo', step: 5, keyDoor: { portalOpened: true, keyTaken: true },
    grid: { primary: 'off', emergency: 'off', vigilant: 'lost', trinity: 'connected', phase: 'window', remaining: 1, lastTick: h.tick(), reroute: 0, attempts: 0 } });
  h.players.possess('film-player', 'neo', h.tick());
  h.actor().currentLocation = door.set; h.actor().isInMatrix = true; h.actor().position = filmStepPosition(door, door.steps[5]);
  h.advance(3); assert.equal(state.grid?.phase, 'expired');
  assert.equal(state.step, 5); assert.match(h.command('act'), /改线|重连/); assert.equal(state.grid?.phase, 'rerouting');
  h.advance(4); const elapsed = state.grid!.reroute;
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); state = h.sandbox.life.film.state!;
  assert.equal(state.grid?.reroute, elapsed);
  h.players.release('film-player', h.tick()); h.advance(30); assert.equal(state.grid?.reroute, elapsed);
  h.players.possess('film-player', 'neo', h.tick()); h.advance(8);
  assert.equal(state.grid?.phase, 'window'); assert.equal(state.grid?.attempts, 1);
  h.actor().position = filmStepPosition(door, door.steps[5]); h.command('act'); h.advance(6);
  assert.equal(state.grid?.phase, 'opened'); assert.equal(state.step, door.steps.length);
});

test('an older key-door checkpoint reconstructs the cut grid without replaying Niobe or Vigilant', () => {
  const h = setup(); h.command('start'); const state = h.sandbox.life.film.state!;
  const door = FILM_SCENE_BY_ID.m2_key_door;
  Object.assign(state, { scene: door.id, actor: 'neo', step: 1, grid: undefined });
  h.players.possess('film-player', 'neo', h.tick());
  h.actor().currentLocation = 'film_backdoor_hall'; h.actor().isInMatrix = true;
  h.actor().position = filmPosition('film_backdoor_hall', 0, -38); state.checkpoint = { ...h.actor().position };
  h.advance(); assert.equal(state.step, 3); h.command('act'); assert.equal(state.grid?.primary, 'off'); assert.equal(state.grid?.emergency, 'off');
  assert.equal(state.grid?.phase, 'window');
  assert.equal(h.actor().currentLocation, door.set); assert.deepEqual(h.actor().position, filmPosition(door.set, 0, -38));
  assert.deepEqual(state.checkpoint, filmPosition(door.set, 0, -38));
  h.actor().position = filmPosition('film_backdoor_hall', 0, -38); state.checkpoint = { ...h.actor().position };
  h.advance();
  assert.deepEqual(h.actor().position, filmPosition(door.set, 0, -38));
  assert.deepEqual(state.checkpoint, filmPosition(door.set, 0, -38));
});

test('the Architect reveals both costs before Neo can take the film-left door', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  const scene = FILM_SCENE_BY_ID.m2_architect;
  Object.assign(state, { scene: scene.id, actor: 'neo', step: 0, architect: undefined });
  h.actor().currentLocation = scene.set; h.actor().position = filmEntry(scene);
  assert.ok(scene.steps[2].x > 0, 'Source reset is the right-hand door');
  assert.ok(scene.steps.at(-1)!.x < 0, 'Trinity is behind the left-hand door');
  h.advance();
  assert.equal(state.architect?.phase, 'cycles');
  assert.equal(playerBlocked(filmPosition(scene.set, 8, -28.2), true, 1.1, h.sandbox.state.structures), true);
  assert.equal(playerBlocked(filmPosition(scene.set, -8, -28.2), true, 1.1, h.sandbox.state.structures), true);
  for (let index = 0; index < scene.steps.length; index++) {
    h.actor().position = filmStepPosition(scene, scene.steps[index]);
    if (index === 0) h.advance();
    else if (scene.steps[index].kind === 'reflect') h.command('reflect:agency');
    else { h.command('act'); h.advance((scene.steps[index].seconds ?? 3) * 2 + 1); }
    assert.equal(state.step, index + 1, `Architect beat ${index}`);
    if (index === 2) assert.equal(state.architect?.sourceReviewed, true);
    if (index === 3) assert.equal(state.architect?.trinityReviewed, true);
  }
  assert.equal(state.architect?.door, 'matrix');
  assert.equal(h.sandbox.life.state!.choices.architect_door, 'matrix');
  assert.equal(playerBlocked(filmPosition(scene.set, 8, -28.2), true, 1.1, h.sandbox.state.structures), true);
  assert.equal(playerBlocked(filmPosition(scene.set, -8, -28.2), true, 1.1, h.sandbox.state.structures), false);
  assert.ok(state.completed.includes(scene.id));
});

test('an older Architect save replays the door costs while preserving its philosophical answer', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: 'm2_architect', actor: 'neo', step: 2, architect: undefined });
  state.reflections['m2_architect:1'] = 'agency';
  h.sandbox.life.state!.choices['m2_architect:1'] = 'agency';
  h.actor().currentLocation = FILM_SCENE_BY_ID.m2_architect.set;
  h.advance();
  assert.equal(state.step, 1);
  assert.equal(state.reflections['m2_architect:1'], undefined);
  assert.equal(state.reflections['m2_architect:4'], 'agency');
  assert.equal(h.sandbox.life.state!.choices['m2_architect:4'], 'agency');
  assert.deepEqual(h.world.agents.get('architect')?.position, filmPosition('film_architect_room', 0, -14));
  state.step = 4; h.actor().position = filmStepPosition(FILM_SCENE_BY_ID.m2_architect, FILM_SCENE_BY_ID.m2_architect.steps[4]);
  assert.match(h.command('reflect:care'), /此前存档/); assert.equal(state.step, 4);
});

test('another player holding Architect or Trinity pauses the corresponding reveal', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  const scene = FILM_SCENE_BY_ID.m2_architect;
  Object.assign(state, { scene: scene.id, actor: 'neo', step: 1,
    architect: { phase: 'cycles', sourceReviewed: false, trinityReviewed: false, remaining: 45, lastTick: h.tick(), attempts: 0 } });
  h.actor().currentLocation = scene.set; h.actor().position = filmStepPosition(scene, scene.steps[1]);
  h.players.possess('other-player', 'architect', h.tick());
  assert.match(h.command('act'), /另一位玩家/); assert.equal(state.started, undefined);
  h.players.release('other-player', h.tick());
  state.step = 3; h.actor().position = filmStepPosition(scene, scene.steps[3]);
  h.players.possess('other-player', 'trinity', h.tick());
  assert.match(h.command('act'), /另一位玩家/); assert.equal(state.started, undefined);
  state.step = 5; state.architect!.phase = 'decision'; state.architect!.remaining = 20;
  h.actor().position = filmStepPosition(scene, scene.steps[5]);
  h.advance(10); assert.equal(state.architect!.remaining, 20);
  assert.match(h.command('act'), /另一位玩家/); assert.equal(state.started, undefined);
});

test('the Architect door window pauses on disconnect, restores, fails, and retries without replaying the conversation', () => {
  const h = setup(); h.command('continue'); const scene = FILM_SCENE_BY_ID.m2_architect;
  const state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: scene.id, actor: 'neo', step: scene.steps.length - 1,
    architect: { phase: 'decision', sourceReviewed: true, trinityReviewed: true, remaining: 2, lastTick: h.tick(), attempts: 0 } });
  h.actor().currentLocation = scene.set; h.actor().position = filmStepPosition(scene, scene.steps.at(-1)!);
  h.players.release('film-player', h.tick()); h.advance(20);
  assert.equal(state.architect!.remaining, 2);
  h.players.possess('film-player', 'neo', h.tick());
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  h.advance(5); const restored = h.sandbox.life.film.state!;
  assert.equal(restored.architect?.phase, 'failed'); assert.equal(restored.step, scene.steps.length - 1);
  assert.match(h.command('act'), /重试/);
  assert.match(h.command('retry'), /重试/);
  assert.equal(restored.architect?.phase, 'decision'); assert.equal(restored.architect?.attempts, 1);
  assert.equal(restored.architect?.sourceReviewed, true); assert.equal(restored.architect?.trinityReviewed, true);
  h.actor().position = filmStepPosition(scene, scene.steps.at(-1)!);
  h.command('act'); h.advance((scene.steps.at(-1)!.seconds ?? 3) * 2 + 1);
  assert.equal(restored.architect?.door, 'matrix');
});

test('a completed two-step key-door save remains complete after the corridor moves', () => {
  const h = setup(); h.command('start'); const state = h.sandbox.life.film.state!;
  const door = FILM_SCENE_BY_ID.m2_key_door;
  Object.assign(state, { scene: door.id, actor: 'neo', step: 2, grid: undefined, keyDoor: undefined,
    checkpoint: filmPosition('film_backdoor_hall', 0, -45) });
  h.players.possess('film-player', 'neo', h.tick());
  h.actor().position = filmPosition('film_backdoor_hall', 0, -45); h.actor().currentLocation = 'film_backdoor_hall';
  h.advance();
  assert.equal(state.step, door.steps.length); assert.equal(state.grid?.phase, 'opened');
  assert.equal(state.keyDoor?.portalOpened, true); assert.equal(state.keyDoor?.keyTaken, true);
  assert.deepEqual(state.checkpoint, filmPosition(door.set, 0, -45));
});

test('the backup console cannot open the route before Niobe and Vigilant handoff, and the window freezes without a player', () => {
  const h = setup(); h.command('start'); const state = h.sandbox.life.film.state!;
  const backup = FILM_SCENE_BY_ID.m2_backup;
  Object.assign(state, { scene: backup.id, actor: 'trinity', step: 1,
    grid: { primary: 'online', emergency: 'online', vigilant: 'active', trinity: 'waiting', phase: 'preparing', remaining: 314, lastTick: h.tick(), reroute: 0, attempts: 0 } });
  h.players.possess('film-player', 'trinity', h.tick()); h.actor().currentLocation = backup.set; h.actor().isInMatrix = true;
  h.actor().position = filmStepPosition(backup, backup.steps[1]); h.command('act'); h.advance(8);
  assert.equal(state.step, 1); assert.equal(state.grid?.phase, 'preparing');
  assert.match(state.lastText, /尚未全部完成/);
  Object.assign(state.grid!, { primary: 'armed', vigilant: 'lost', trinity: 'connected' });
  h.command('act'); h.advance(8); assert.equal(state.grid?.phase, 'emergency');
  const remaining = state.grid!.hackRemaining;
  h.players.release('film-player', h.tick()); h.advance(40);
  assert.equal(state.grid!.hackRemaining, remaining);
  h.players.possess('film-player', 'neo', h.tick());
  const door = FILM_SCENE_BY_ID.m2_key_door; Object.assign(state, { scene: door.id, actor: 'neo', step: 1 });
  h.actor().currentLocation = door.set; h.actor().position = filmStepPosition(door, door.steps[1]);
  h.players.possess('other-player', 'trinity', h.tick()); h.advance(4);
  assert.equal(state.grid!.hackRemaining, remaining);
  h.players.release('other-player', h.tick()); h.advance(2);
  assert.equal(state.grid!.hackRemaining, remaining! - 1);
});

test('Neo holds Smith copies, opens the portal, receives the wounded Keymaker’s key, and alone opens the source door', () => {
  const h = setup(); h.command('start'); let state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: 'm2_backup', actor: 'trinity', step: FILM_SCENE_BY_ID.m2_backup.steps.length,
    grid: { primary: 'off', emergency: 'online', vigilant: 'lost', trinity: 'connected', phase: 'emergency',
      remaining: 314, lastTick: h.tick(), reroute: 0, attempts: 0, hackRemaining: 12 } });
  h.players.possess('film-player', 'trinity', h.tick());
  h.command('next'); const door = FILM_SCENE_BY_ID.m2_key_door;
  assert.equal(state.scene, door.id); assert.equal(h.actor().id, 'neo'); assert.equal(door.steps.length, 6);
  assert.equal(state.grid?.phase, 'emergency'); assert.equal(state.grid?.emergency, 'online');
  const portal = filmPosition(door.set, 0, -39);
  assert.equal(playerBlocked(portal, true, 1.1, h.sandbox.state.structures), true, 'the first door blocks the hallway before it opens');
  h.advance(24); assert.equal(state.grid?.phase, 'window'); assert.ok(state.grid!.remaining > 313);

  h.actor().position = filmStepPosition(door, door.steps[0]); h.advance(); assert.equal(state.step, 1);
  h.actor().position = filmStepPosition(door, door.steps[1]); h.command('act'); h.advance();
  assert.equal(h.sandbox.state.threats.filter(threat => threat.scene === door.id).length, 3);
  for (const target of h.sandbox.state.threats.filter(threat => threat.scene === door.id)) {
    for (let hit = 0; target.health > 0 && hit < 30; hit++) {
      h.actor().position = { ...target.position, z: target.position.z + 2 }; h.actor().rotation = Math.PI;
      h.sandbox.attack(h.actor(), h.tick(), 2);
    }
    assert.equal(target.health, 0);
  }
  h.advance(); assert.equal(state.step, 2);
  for (const index of [2, 3, 4, 5]) {
    h.actor().position = filmStepPosition(door, door.steps[index]); h.command('act');
    h.advance((door.steps[index].seconds ?? 3) * 2);
    assert.equal(state.step, index + 1);
    if (index === 3) {
      assert.equal(state.keyDoor?.portalOpened, true);
      assert.equal(playerBlocked(portal, true, 1.1, h.sandbox.state.structures), false, 'the opened portal is walkable');
      assert.equal(playerBlocked(filmPosition(door.set, 8.7, -39), true, 1.1, h.sandbox.state.structures), true, 'the wall beside it remains solid');
    }
    if (index === 4) {
      assert.equal(state.keyDoor?.keyTaken, true); assert.equal(h.world.agents.get('keymaker')?.status, 'dead');
      const remaining = state.grid!.remaining;
      h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); state = h.sandbox.life.film.state!;
      assert.equal(state.step, 5); assert.equal(state.keyDoor?.portalOpened, true); assert.equal(state.keyDoor?.keyTaken, true);
      assert.equal(state.grid?.remaining, remaining); assert.equal(playerBlocked(portal, true, 1.1, h.sandbox.state.structures), false);
    }
  }
  assert.equal(state.grid?.phase, 'opened'); assert.ok(state.completed.includes(door.id));
  assert.equal(h.world.agents.get('morpheus')?.status, 'alive');
});

test('the entire film route completes through interactions, driving and real combat, then starts a recorded new life', () => {
  const h = setup(); h.command('start'); const state = h.sandbox.state.neoLife!.journey!;
  let sequence = 0;
  for (const scene of FILM_SCENES) {
    assert.equal(state.scene, scene.id); assert.equal(h.actor().id, scene.actor);
    if (scene.id === 'm3_gate') assert.equal(h.world.agents.get('mifune')?.status, 'dead');
    assert.equal(h.actor().isInMatrix, scene.id === 'm2_meeting' ? false : FILM_SETS[scene.set].world === 'matrix');
    assert.equal(musicForScene({ player: h.actor(), sandbox: h.sandbox.state, time: 7500, matrix: h.actor().isInMatrix, running: true }), scene.id === 'm2_meeting' ? 'night' : scene.music, `${scene.id}: music follows the active film set at ${h.actor().currentLocation}`);
    if (scene.id === 'm1_mirror' && state.mirrorGuide) {
      for (const [x, z] of [[-5, -3.1], [-5, -9.8], [-6, -12.7], [MIRROR_TOUCH.x, MIRROR_TOUCH.z]]) {
        const target = filmPosition(scene.set, x, z);
        for (let frame = 0; frame < 500; frame++) {
          const actor = h.actor(), dx = target.x - actor.position.x, dz = target.z - actor.position.z;
          const gap = Math.hypot(dx, dz);
          if (gap < .3) break;
          h.players.receiveInput('film-player', { x: dx / Math.max(1, gap), z: dz / Math.max(1, gap), yaw: Math.atan2(dx, dz), jump: false, sprint: false, sequence: ++sequence });
          h.players.step(.05, true, h.tick());
          if (frame % 10 === 0) h.advance();
          assert.ok(frame < 499, `Morpheus route blocked at ${x}, ${z}`);
        }
      }
      h.players.receiveInput('film-player', { x: 0, z: 0, yaw: h.actor().rotation, jump: false, sprint: false, sequence: ++sequence });
      for (let frame = 0; frame < 100 && !state.mirrorGuide.done; frame++) h.advance();
      assert.equal(state.mirrorGuide.done, true, JSON.stringify({ guide: state.mirrorGuide,
        neo: h.actor().position, morpheus: h.world.agents.get('morpheus')?.position }));
    }
    if (scene.id === 'm1_pills' && state.hotel) {
      // Enter the room by walking all stair flights and opening the actual door.
      for (const point of HOTEL_ROUTE.slice(4, -2)) {
        if (point.x === 18 && point.z === 0) {
          for (let frame = 0; frame < 120; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.hotel.progress, HOTEL_DOOR_PROGRESS); h.command('act');
          for (let frame = 0; frame < 25; frame++) h.players.step(.1, true, h.tick());
        }
        const center = FILM_SETS.film_lafayette.center;
        for (let frame = 0; frame < 800; frame++) {
          const actor = h.actor(); const dx = center.x + point.x - actor.position.x; const dz = center.z + point.z - actor.position.z;
          const length = Math.hypot(dx, dz);
          if (length < .3 && Math.abs(actor.position.y - 1 - point.y) < .6) break;
          h.players.receiveInput('film-player', { x: dx / Math.max(1, length), z: dz / Math.max(1, length), yaw: Math.atan2(dx, dz), jump: false, sprint: false, sequence: ++sequence });
          h.players.step(.05, true, h.tick());
          assert.ok(frame < 799, `hotel route blocked at ${JSON.stringify(point)}`);
        }
        h.players.receiveInput('film-player', { x: 0, z: 0, yaw: h.actor().rotation, jump: false, sprint: false, sequence: ++sequence });
      }
      h.players.step(.1, true, h.tick()); assert.equal(state.hotel.entered, true);
      for (let frame = 0; frame < 70; frame++) h.players.step(.1, true, h.tick());
      assert.equal(state.hotel.welcome?.phase, 'ready'); h.command('act');
      for (let frame = 0; frame < 90; frame++) h.players.step(.1, true, h.tick());
      assert.equal(state.hotel.welcome?.phase, 'done');
    }
    if (scene.id === 'm1_wake_again') {
      for (let frame = 0; frame < 61; frame++) h.players.step(.1, true, h.tick());
      assert.equal(state.wakeCall?.phase, 'ringing');
    }
    for (let index = 0; index < scene.steps.length; index++) {
      const step = scene.steps[index]; const actor = h.actor(); actor.position = filmStepPosition(scene, step);
      if (scene.id === 'm3_rain') {
        if (index === 0) h.advance();
        else if (index === 1) {
          h.command('act');
          for (let frame = 0; frame < 12 && state.smithFinale?.phase !== 'ground_dodge'; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.smithFinale?.phase, 'ground_dodge'); h.players.act('film-player', 'dodge', h.tick());
          h.players.act('film-player', 'attack', h.tick());
          for (let frame = 0; frame < 4; frame++) h.players.step(.1, true, h.tick());
          h.players.act('film-player', 'attack', h.tick());
          for (let frame = 0; frame < 30 && state.smithFinale?.phase !== 'air_dodge'; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.smithFinale?.phase, 'air_dodge'); h.players.act('film-player', 'dodge', h.tick()); h.players.act('film-player', 'attack', h.tick());
          for (let frame = 0; frame < 20 && state.smithFinale?.phase !== 'descent'; frame++) h.players.step(.1, true, h.tick());
          h.players.receiveInput('film-player', { x: .25, z: 0, yaw: Math.PI, jump: false, sprint: false, focus: true, sequence: ++sequence });
          for (let frame = 0; frame < 70 && state.step === index; frame++) h.players.step(.1, true, h.tick());
          h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, jump: false, sprint: false, focus: false, sequence: ++sequence });
        } else h.command('reflect:agency');
        assert.equal(state.step, index + 1, `${scene.id}: ${step.label}`); continue;
      }
      if (scene.id === 'm3_surrender') {
        if (index === 0) {
          h.command('act');
          for (let frame = 0; frame < Math.ceil(SMITH_FINALE.assault / .1) + 2 && state.step === index; frame++) h.players.step(.1, true, h.tick());
        } else if (index === 1) h.command('reflect:agency');
        else {
          h.command('act');
          h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, jump: false, sprint: false, focus: true, sequence: ++sequence });
          for (let frame = 0; frame < 100 && state.step === index; frame++) h.players.step(.1, true, h.tick());
          h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, jump: false, sprint: false, focus: false, sequence: ++sequence });
        }
        assert.equal(state.step, index + 1, `${scene.id}: ${step.label}`); continue;
      }
      if (scene.id === 'm3_deus') {
        if (index === 0) h.advance();
        else if (index === 1) {
          h.command('act');
          for (let frame = 0; frame < 120 && state.step === index; frame++) {
            h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, jump: false, sprint: false,
              focus: true, sequence: ++sequence });
            h.players.step(.1, true, h.tick());
          }
        } else if (index === 2) h.command(`reflect:${filmReflections(scene.id)[0].id}`);
        else {
          h.command('act');
          for (let frame = 0; frame < 110 && state.step === index; frame++) {
            h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, jump: false, sprint: false,
              focus: true, sequence: ++sequence });
            h.players.step(.1, true, h.tick());
          }
          h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, jump: false, sprint: false,
            focus: false, sequence: ++sequence });
        }
        assert.equal(state.step, index + 1, `${scene.id}: ${step.label}`); continue;
      }
      if (['m3_ceasefire', 'm3_neo_carried', 'm3_dawn'].includes(scene.id)) {
        if (step.kind === 'reach') h.advance();
        else if (step.kind === 'reflect') h.command(`reflect:${filmReflections(scene.id)[0].id}`);
        else {
          h.command('act');
          for (let frame = 0; frame < 320 && state.step === index; frame++) h.players.step(.1, true, h.tick());
        }
        assert.equal(state.step, index + 1, `${scene.id}: ${step.label}`); continue;
      }
      if (scene.id === 'm1_room303') {
        if (index === 0) { h.command('act'); h.advance(4); assert.equal(state.openingHotel?.phase, 'combat'); }
        else if (index === 1) {
          for (const target of [...h.sandbox.state.threats.filter(threat => threat.scene === scene.id)]) {
            for (let hit = 0; target.health > 0 && hit < 6; hit++) {
              actor.position = { ...target.position, z: target.position.z + 2 }; actor.rotation = Math.PI;
              h.sandbox.attack(actor, h.tick(), hit % 3);
            }
            assert.equal(target.health, 0);
          }
          actor.position = { ...state.openingHotel!.fallen! }; h.command('act'); h.advance();
          assert.equal(state.openingHotel?.disarmed, true);
        } else if (index === 2 || index === 4) { h.command('act'); if (index === 4) h.advance(4); }
        else if (index === 5) {
          h.command('act');
          for (let frame = 0; frame < 50 && state.openingHotel?.phase === 'climbing'; frame++) {
            h.players.receiveInput('film-player', { x: 0, z: 0, yaw: 0, jump: false, sprint: false, climb: 1, sequence: ++sequence });
            h.players.step(.1, true, h.tick());
          }
        }
        else h.advance();
        assert.equal(state.step, index + 1, `${scene.id}: ${step.label}`); continue;
      }
      if (scene.id === 'm3_trainman_chase' && index === 2 || scene.id === 'm3_mobil_release' && index === 0) h.advance(12);
      if (scene.id === 'm3_trainman') {
        if (index === 0) { h.command('act'); h.advance(6); }
        else if (index === 1) h.advance(10);
        else if (index === 2) {
          h.command('act'); for (let frame = 0; frame < 24; frame++) h.players.step(.1, true, h.tick()); h.advance(7);
        } else h.advance();
        assert.equal(state.step, index + 1, `${scene.id}: ${step.label}`); continue;
      }
      if (scene.id === 'm2_key_door' && index === 3) for (let count = 0; state.grid?.phase !== 'window' && count < 30; count++) h.advance();
      if (scene.id === 'm2_dream') {
        if (index === 0) h.players.step(.1, true, h.tick());
        else { h.command('act'); for (let frame = 0; frame < 110 && state.step === index; frame++) h.players.step(.1, true, h.tick()); }
        assert.equal(state.step, index + 1, `${scene.id}: ${step.label}`); continue;
      }
      if (scene.id === 'm2_catch') {
        if (index === 0) h.command('act');
        else if (index === 1) {
          for (let frame = 0; frame < 54; frame++) {
            h.players.receiveInput('film-player', { x: frame < 6 ? -1 : 0, z: frame < 24 ? -1 : 0, yaw: Math.PI, jump: false, sprint: false, focus: false, sequence: ++sequence });
            h.players.step(.1, true, h.tick());
          }
          h.command('act');
        } else if (index === 2) {
          for (let frame = 0; frame < 30; frame++) h.players.step(.1, true, h.tick());
          h.command('act');
          for (let frame = 0; frame < 26 && state.step === 2; frame++) {
            h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, jump: false, sprint: false, focus: true, sequence: ++sequence });
            h.players.step(.1, true, h.tick());
          }
        } else for (let beat = 0; beat < 3; beat++) {
          for (let frame = 0; frame < 11; frame++) h.players.step(.1, true, h.tick());
          h.players.act('film-player', 'attack', h.tick());
        }
        assert.equal(state.step, index + 1, `${scene.id}: ${step.label}`); continue;
      }
      if (scene.id === 'm2_stop_sentinels' && index === 1) {
        h.command('act');
        for (let frame = 0; frame < 25 && state.step === index; frame++) {
          h.players.receiveInput('film-player', { x: 0, z: 0, yaw: 0, jump: false, sprint: false, focus: true, sequence: ++sequence });
          h.players.step(.1, true, h.tick());
        }
        assert.equal(state.step, index + 1, `${scene.id}: ${step.label}`); continue;
      }
      if (scene.id === 'm2_meeting') {
        const frames = (seconds: number) => { for (let frame = 0; frame < Math.ceil(seconds * 10); frame++) h.players.step(.1, true, h.tick()); };
        if (index === 0) { frames(RELOADED.wake + .2); h.command('act'); frames(RELOADED.conversation + .2); h.command('act'); frames(RELOADED.connect + .2); }
        else if (index === 1) { h.command('act'); frames(RELOADED.report + .2); }
        else if (index === 2) { h.command('act'); frames(RELOADED.earpiece + .2); }
        else if (index === 3) {
          h.command('exit:west'); frames(RELOADED.breach + .2);
          for (let hit = 0; hit < 6; hit++) {
            const enemy = h.world.agents.get(RELOADED.agents[state.reloaded!.opponent])!;
            actor.position = { ...enemy.position, z: enemy.position.z + 2.2 }; actor.rotation = Math.PI;
            h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, jump: false, sprint: false, sequence: ++sequence });
            for (let frame = 0; frame < 50 && state.reloaded!.cycle < RELOADED.strike - .3; frame++) frames(.1);
            h.players.act('film-player', 'dodge', h.tick()); frames(.4);
            h.players.act('film-player', 'attack', h.tick()); frames(.3);
            if (hit < 5) { const round = state.reloaded!.round; for (let frame = 0; frame < 40 && state.reloaded!.round === round; frame++) frames(.1); }
          }
          assert.equal(state.reloaded!.phase, 'departure_ready');
        } else { frames(1); h.command('act'); frames(RELOADED.departure + .2); }
        assert.equal(state.step, index + 1, `${scene.id}: ${step.label}`); continue;
      }
      if (scene.id === 'm1_death') {
        if (index === 0) h.players.step(.1, true, h.tick());
        else {
          h.command('act');
          for (let frame = 0; frame < 65 && state.theOne?.phase !== 'listening'; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.theOne?.phase, 'listening');
          for (let frame = 0; frame < 40 && state.theOne?.phase === 'listening'; frame++) {
            h.players.receiveInput('film-player', { x: 0, z: 0, yaw: actor.rotation, jump: false, sprint: false, focus: true, sequence: ++sequence });
            h.players.step(.1, true, h.tick());
          }
          for (let frame = 0; frame < 70 && state.step === index; frame++) h.players.step(.1, true, h.tick());
        }
        assert.equal(state.step, index + 1, `${scene.id}: ${step.label}`); continue;
      }
      if (scene.id === 'm1_return') {
        if (index === 0) {
          h.command('act');
          for (let frame = 0; frame < 30 && state.theOne?.phase !== 'bullet_window'; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.theOne?.phase, 'bullet_window');
          while (state.theOne!.elapsed < THE_ONE.return.bulletBeat) h.players.step(.1, true, h.tick());
          h.players.act('film-player', 'dodge', h.tick());
          for (let frame = 0; frame < 35 && state.step === index; frame++) h.players.step(.1, true, h.tick());
        } else if (index === 1) {
          const target = h.sandbox.state.threats.find(threat => threat.scene === scene.id && threat.character === 'smith')!;
          assert.ok(target); target.attackAt = h.tick() + 2; target.stunUntil = 0; h.players.act('film-player', 'dodge', h.tick());
          for (let hit = 0; hit < THE_ONE.return.requiredHits; hit++) {
            target.position = { ...actor.position, z: actor.position.z - 2.1 }; actor.rotation = Math.PI;
            h.sandbox.attack(actor, h.tick() + hit + 1, hit % 3);
          }
          for (let frame = 0; frame < 55 && state.step === index; frame++) h.players.step(.1, true, h.tick());
        } else {
          h.players.step(.1, true, h.tick()); assert.equal(state.theOne?.phase, 'exit_ready'); h.command('act');
          for (let frame = 0; frame < 50 && state.step === index; frame++) h.players.step(.1, true, h.tick());
        }
        assert.equal(state.step, index + 1, `${scene.id}: ${step.label}`); continue;
      }
      if (scene.id === 'm1_final_call') {
        if (index === 0) { h.command('reflect:agency'); h.players.step(.1, true, h.tick()); }
        else {
          h.command('act');
          for (let frame = 0; frame < 60 && state.theOne?.phase !== 'takeoff_ready'; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.theOne?.phase, 'takeoff_ready');
          h.players.receiveInput('film-player', { x: 0, z: 0, yaw: actor.rotation, jump: true, sprint: false, focus: false, sequence: ++sequence });
          h.players.step(.1, true, h.tick());
          for (let frame = 0; frame < 80 && state.step === index; frame++) {
            h.players.receiveInput('film-player', { x: .35, z: -.5, yaw: actor.rotation, jump: false, sprint: true, focus: false, sequence: ++sequence });
            h.players.step(.1, true, h.tick());
          }
        }
        assert.equal(state.step, index + 1, `${scene.id}: ${step.label}`); continue;
      }
      if (scene.id === 'm1_subway') {
        if (index === 0) {
          h.command('act');
          for (let frame = 0; frame < 45 && state.matrixEscape?.phase !== 'duel'; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.matrixEscape?.phase, 'duel');
          const target = h.sandbox.state.threats.find(threat => threat.scene === scene.id)!;
          target.attackAt = h.tick() + 2; target.stunUntil = 0; h.players.act('film-player', 'dodge', h.tick());
          for (let hit = 0; hit < MATRIX_ESCAPE.subway.requiredHits; hit++) {
            target.position = { ...actor.position, z: actor.position.z - 2.2 }; actor.rotation = Math.PI;
            h.sandbox.attack(actor, h.tick() + hit + 1, hit % 3);
          }
          for (let frame = 0; frame < 35 && state.step === index; frame++) h.players.step(.1, true, h.tick());
        } else {
          for (let frame = 0; frame < 25 && state.matrixEscape?.phase !== 'train_window'; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.matrixEscape?.phase, 'train_window');
          while (state.matrixEscape!.elapsed < MATRIX_ESCAPE.subway.trainBeat) h.players.step(.1, true, h.tick());
          h.players.act('film-player', 'dodge', h.tick());
          for (let frame = 0; frame < 65 && state.step === index; frame++) h.players.step(.1, true, h.tick());
        }
        assert.equal(state.step, index + 1, `${scene.id}: ${step.label}`); continue;
      }
      if (scene.id === 'm1_city_chase') {
        const frame = () => {
          h.players.receiveInput('film-player', { x: 0, z: 0, yaw: actor.rotation, jump: false, sprint: true, sequence: ++sequence });
          h.players.step(.1, true, h.tick());
        };
        if (index === 0) {
          h.command('act'); for (let count = 0; count < 28 && state.matrixEscape?.phase !== 'running'; count++) frame();
          actor.position = filmStepPosition(scene, step); frame();
          for (let count = 0; count < 32 && state.step === index; count++) frame();
        } else if (index === 1) {
          frame(); for (let count = 0; count < 20 && state.matrixEscape?.phase !== 'truck_window'; count++) frame();
          assert.equal(state.matrixEscape?.phase, 'truck_window');
          while (state.matrixEscape!.elapsed < MATRIX_ESCAPE.city.truckBeat) frame();
          h.players.act('film-player', 'dodge', h.tick());
          for (let count = 0; count < 30 && state.step === index; count++) frame();
        } else {
          frame(); assert.equal(state.matrixEscape?.phase, 'door_ready'); h.command('act');
          for (let count = 0; count < 28 && state.step === index; count++) frame();
        }
        assert.equal(state.step, index + 1, `${scene.id}: ${step.label}`); continue;
      }
      if (scene.id === 'm2_library' && index === 4) {
        for (const [x, z] of [[-8, -17], [-8, -10], [-5, -3], [0, 4], [0, 11], [0, 18], [0, 23]]) {
          actor.position = filmPosition(scene.set, x, z);
          for (let frame = 0; frame < 27; frame++) h.players.step(.1, true, h.tick());
        }
        h.advance();
      }
      else if (step.kind === 'reach') h.advance();
      else if (step.kind === 'reflect') {
        if (scene.id === 'm1_oracle') {
          h.command('act');
          for (let frame = 0; frame < 110; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.oracle?.consultation?.phase, 'question'); h.command('reflect:agency');
          for (let frame = 0; frame < 50; frame++) h.players.step(.1, true, h.tick());
        } else h.command(scene.id === 'm1_wake_up' ? 'contact:follow' : scene.id === 'm1_ledge' ? 'escape:retreat' : scene.id === 'm1_pills' ? 'pill:red'
          : ['m3_oracle_request', 'm3_hel_bargain'].includes(scene.id) ? `reflect:${filmReflections(scene.id)[0].id}` : 'reflect:agency');
        if (scene.id === 'm1_smith_question') for (let frame = 0; frame < 130 && state.step === index; frame++) {
          h.players.receiveInput('film-player', { x: 0, z: 0, yaw: h.actor().rotation, jump: false, sprint: false, focus: true, sequence: ++sequence });
          h.players.step(.1, true, h.tick());
        }
        if (scene.id === 'm1_pills') for (let frame = 0; frame < Math.ceil(PILL_TIMING.take / .1) + 1; frame++) h.players.step(.1, true, h.tick());
        if (scene.id === 'm1_club') for (let frame = 0; frame < 61; frame++) h.players.step(.1, true, h.tick());
        if (scene.id === 'm1_cypher_console') for (let frame = 0; frame < 48; frame++) h.players.step(.1, true, h.tick());
      }
      else if (step.kind === 'interact') {
        if (scene.id === 'm3_farewell' && index === 1) {
          h.command('act');
          for (let frame = 0; frame < 500 && state.farewell?.phase !== 'still'; frame++) h.players.step(.05, true, h.tick());
          assert.equal(state.farewell?.phase, 'still');
          assert.equal(state.step, index + 1, `${scene.id}: ${step.label}`); continue;
        }
        if (scene.id === 'm3_bane' && index === 1) {
          h.command('act');
          h.players.receiveInput('film-player', { x: 0, z: 0, yaw: actor.rotation, jump: false, sprint: false, focus: false, sequence: ++sequence });
          for (let frame = 0; frame < 9; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.bane?.phase, 'gun_window'); h.players.act('film-player', 'dodge', h.tick());
          const grapplingBane = h.world.agents.get('bane')!;
          actor.position = { ...grapplingBane.position, x: grapplingBane.position.x - 2 };
          actor.rotation = Math.atan2(grapplingBane.position.x - actor.position.x, grapplingBane.position.z - actor.position.z);
          h.players.act('film-player', 'attack', h.tick());
          for (let frame = 0; frame < 4; frame++) h.players.step(.1, true, h.tick());
          h.players.act('film-player', 'attack', h.tick());
          for (let frame = 0; frame < 16; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.bane?.phase, 'blind');
          h.players.receiveInput('film-player', { x: 0, z: 0, yaw: actor.rotation, jump: false, sprint: false, focus: true, sequence: ++sequence });
          for (let frame = 0; frame < 19; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.bane?.phase, 'pipe_window'); h.players.act('film-player', 'dodge', h.tick());
          const bane = h.world.agents.get('bane')!;
          actor.rotation = Math.atan2(bane.position.x - actor.position.x, bane.position.z - actor.position.z);
          h.players.act('film-player', 'attack', h.tick());
          for (let frame = 0; frame < 4; frame++) h.players.step(.1, true, h.tick());
          actor.rotation = Math.atan2(bane.position.x - actor.position.x, bane.position.z - actor.position.z);
          h.players.act('film-player', 'attack', h.tick());
          assert.equal(state.step, 2); continue;
        }
        if (scene.id === 'm2_mountain' && index === 2) {
          h.players.receiveInput('film-player', { x: 0, z: -1, yaw: Math.PI, jump: true, sprint: true, sequence: ++sequence });
          h.players.step(.1, true, h.tick());
          h.players.receiveInput('film-player', { x: 0, z: -1, yaw: Math.PI, jump: false, sprint: true, sequence: ++sequence });
          for (let frame = 0; frame < 180 && state.step === index; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.step, index + 1); continue;
        }
        if (scene.id === 'm2_persephone' && index === 2) {
          h.command('persephone:memory');
          for (let frame = 0; frame < 30; frame++) h.players.step(.1, true, h.tick());
          h.command('persephone:memory');
          for (let frame = 0; frame < 30; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.step, 3); continue;
        }
        if (scene.id === 'm1_bridge') for (let frame = 0; frame < 80 && state.bridgeArrival?.phase === 'approaching'; frame++) h.players.step(.1, true, h.tick());
        h.command('act');
        if (scene.id === 'm2_burly') {
          for (let frame = 0; frame < 28 && state.scene === scene.id; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.scene, 'm2_merovingian', `${scene.id}: ${step.label}`); continue;
        }
        if (scene.id === 'm1_wake_up') {
          for (let frame = 0; frame < 91; frame++) h.players.step(.1, true, h.tick());
          if (index === 0) { h.command('act'); for (let frame = 0; frame < 41; frame++) h.players.step(.1, true, h.tick()); }
        }
        else if (scene.id === 'm1_club') {
          for (let frame = 0; frame < 81; frame++) h.players.step(.1, true, h.tick());
          h.command('act'); for (let frame = 0; frame < 61; frame++) h.players.step(.1, true, h.tick());
          h.command('act'); for (let frame = 0; frame < 141; frame++) h.players.step(.1, true, h.tick());
        }
        else if (scene.id === 'm1_pills') for (let frame = 0; frame < 51; frame++) h.players.step(.1, true, h.tick());
        else if (scene.id === 'm3_hel_entry' && index === 0) h.advance(10);
        else if (scene.id === 'm3_hel_bargain' && index === 3) {
          h.advance(2); h.players.act('film-player', 'dodge', h.tick());
          actor.rotation = Math.PI; h.players.act('film-player', 'attack', h.tick());
        }
        else if (scene.id === 'm3_hel_bargain' && index === 4) { h.advance(4); h.command('act'); }
        else if (scene.id === 'm3_hel_bargain' && index === 5) { actor.rotation = Math.PI; h.command('act'); }
        else if (scene.id === 'm1_download') for (let frame = 0; frame < 101; frame++) h.players.step(.1, true, h.tick());
        else if (scene.id === 'm1_red_dress') for (let frame = 0; frame < 121; frame++) h.players.step(.1, true, h.tick());
        else if (scene.id === 'm1_bridge') {
          for (let frame = 0; frame < 151; frame++) h.players.step(.1, true, h.tick());
          h.command('meeting:stay'); assert.equal(state.scene, 'm1_bug'); break;
        } else if (scene.id === 'm1_bug') {
          if (index === 0) {
            for (let frame = 0; frame < 200; frame++) {
              h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, jump: false, sprint: false, focus: true, sequence: ++sequence });
              h.players.step(.1, true, h.tick());
            }
          } else {
            for (let frame = 0; frame < 600; frame++) h.players.step(.1, true, h.tick());
            assert.equal(state.meeting?.phase, 'parked'); h.command('act');
            for (let frame = 0; frame < 81; frame++) h.players.step(.1, true, h.tick());
            actor.position = filmStepPosition(scene, step); h.command('act');
            assert.equal(state.scene, 'm1_pills'); break;
          }
        }
        else if (scene.id === 'm1_interrogation') for (let frame = 0; frame < (index === 0 ? 61 : 241); frame++) h.players.step(.1, true, h.tick());
        else if (scene.id === 'm1_wake_again') {
          if (index === 0) {
            for (let frame = 0; frame < 120; frame++) h.players.step(.1, true, h.tick());
            assert.equal(state.wakeCall?.phase, 'decision');
            h.command('act');
            for (let frame = 0; frame < 51; frame++) h.players.step(.1, true, h.tick());
          } else for (let frame = 0; frame < 50 && state.scene === scene.id; frame++) h.players.step(.1, true, h.tick());
        }
        else if (scene.id === 'm1_sentinels') {
          const frames = index === 0 ? 210 : 36;
          for (let frame = 0; frame < frames; frame++) h.players.step(.1, true, h.tick());
        }
        else if (scene.id === 'm1_cypher_console') for (let frame = 0; frame < 86; frame++) h.players.step(.1, true, h.tick());
        else if (scene.id === 'm1_steak') for (let frame = 0; frame < 147; frame++) h.players.step(.1, true, h.tick());
        else if (scene.id === 'm1_meal') for (let frame = 0; frame < 134; frame++) h.players.step(.1, true, h.tick());
        else if (scene.id === 'm1_bathroom') for (let frame = 0; frame < 70 && state.step === index; frame++) h.players.step(.1, true, h.tick());
        else if (scene.id === 'm1_unplugged') {
          for (let frame = 0; frame < 100 && state.betrayal?.phase !== 'window'; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.betrayal?.phase, 'window'); h.command('act');
          for (let frame = 0; frame < 70 && state.betrayal?.phase !== 'reconnect'; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.betrayal?.phase, 'reconnect'); h.command('act'); h.command('act');
        }
        else if (scene.id === 'm1_rescue_decision') {
          for (let frame = 0; frame < 90 && state.step === index; frame++) h.players.step(.1, true, h.tick());
        }
        else if (scene.id === 'm1_guns') {
          for (let frame = 0; frame < 50 && state.rescue?.phase === 'racks_arriving'; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.rescue?.phase, 'selecting');
          const loadout = RESCUE.loadoutRoots.rifle;
          actor.position = filmPosition(scene.set, loadout.x, loadout.z); h.command('act');
          for (let frame = 0; frame < 55 && state.step === index; frame++) h.players.step(.1, true, h.tick());
        }
        else if (scene.id === 'm1_smith_question') for (let frame = 0; frame < 75 && state.step === index; frame++) h.players.step(.1, true, h.tick());
        else if (scene.id === 'm1_bullet_dodge') for (let frame = 0; frame < 55 && state.step === index; frame++) h.players.step(.1, true, h.tick());
        else if (scene.id === 'm1_helicopter') {
          for (let frame = 0; frame < 90 && ['approach', 'firing'].includes(state.airRescue?.phase ?? ''); frame++) {
            h.players.receiveInput('film-player', { x: 0, z: 0, yaw: h.actor().rotation, jump: false, sprint: false, focus: true, sequence: ++sequence });
            h.players.step(.1, true, h.tick());
          }
          assert.equal(state.airRescue?.phase, 'leap_window');
          while (state.airRescue!.elapsed < AIR_RESCUE.office.leapAt) h.players.step(.1, true, h.tick());
          h.players.act('film-player', 'dodge', h.tick());
          for (let frame = 0; frame < 60 && state.step === index; frame++) h.players.step(.1, true, h.tick());
        }
        else if (scene.id === 'm1_rooftop_rescue') {
          for (let frame = 0; frame < 45 && state.airRescue?.phase === 'impact'; frame++) {
            h.players.receiveInput('film-player', { x: 0, z: 0, yaw: h.actor().rotation, jump: false, sprint: false, focus: true, sequence: ++sequence });
            h.players.step(.1, true, h.tick());
          }
          assert.equal(state.airRescue?.phase, 'bracing');
          for (const beat of AIR_RESCUE.roof.beats) {
            while (state.airRescue!.phase === 'bracing' && state.airRescue!.elapsed < beat) {
              h.players.receiveInput('film-player', { x: 0, z: 0, yaw: h.actor().rotation, jump: false, sprint: false, focus: true, sequence: ++sequence });
              h.players.step(.1, true, h.tick());
            }
            if (state.airRescue!.phase === 'bracing') h.players.act('film-player', 'dodge', h.tick());
          }
          for (let frame = 0; frame < 80 && state.step === index; frame++) {
            h.players.receiveInput('film-player', { x: 0, z: 0, yaw: h.actor().rotation, jump: false, sprint: false, focus: true, sequence: ++sequence });
            h.players.step(.1, true, h.tick());
          }
        }
        else if (scene.id === 'm1_boss' && index === 0) {
          for (let frame = 0; frame < 91; frame++) h.players.step(.1, true, h.tick());
          h.command('act');
        } else if (scene.id === 'm1_boss' && index === 1) {
          for (let frame = 0; frame < 111; frame++) h.players.step(.1, true, h.tick());
          h.command('act'); for (let frame = 0; frame < 41; frame++) h.players.step(.1, true, h.tick());
          h.command('act');
          for (let frame = 0; frame < 30; frame++) h.players.step(.1, true, h.tick());
          h.command('act'); for (let frame = 0; frame < 120; frame++) h.players.step(.1, true, h.tick());
        } else if (scene.id === 'm1_office_escape' && index === 2) for (let frame = 0; frame < 40; frame++) h.players.step(.1, true, h.tick());
        else if (state.awakening && ['m1_mirror', 'm1_pod', 'm1_recovery', 'm1_construct', 'm1_desert'].includes(scene.id)) for (let frame = 0; frame < 200 && state.step === index; frame++) h.players.step(.1, true, h.tick());
        else if (index === 0 && ['m1_spoon', 'm1_oracle', 'm1_dejavu'].includes(scene.id)) {
          for (let frame = 0; frame < 110 && state.step === index; frame++) {
            h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, jump: false, sprint: false, focus: true, sequence: ++sequence });
            h.players.step(.1, true, h.tick());
          }
        }
        else if (scene.id === 'm2_trucks' && index === 2) {
          h.advance((step.seconds ?? 3) * 2);
          for (let frame = 0; frame < 40 && state.trucks?.phase === 'rescue'; frame++) h.players.step(.1, true, h.tick());
        } else h.advance((step.seconds ?? 3) * 2);
      }
      else if (step.kind === 'drive') {
        h.command('act');
        if (scene.id === 'm2_garage') {
          for (let frame = 0; state.garage?.phase === 'riding' && frame < 200; frame++) {
            h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, sprint: false, jump: false,
              drive: { throttle: 1, steer: 0, brake: false }, sequence: ++sequence });
            h.players.step(.05, true, h.tick());
          }
          assert.equal(state.garage?.phase, 'arrived'); h.advance();
        } else if (scene.id === 'm3_hammer_tunnels') {
          for (let frame = 0; state.hammer?.phase === 'riding' && frame < 900; frame++) {
            const flight = state.hammer;
            const steer = Math.max(-1, Math.min(1, (hammerCenter(flight.z - 15) - flight.x) * .24 - flight.lateral * .12));
            h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, sprint: false, jump: false,
              drive: { throttle: 1, steer, brake: false }, sequence: ++sequence });
            h.players.step(.05, true, h.tick());
          }
          assert.equal(state.hammer?.phase, 'arrived'); h.advance();
        } else if (scene.id === 'm3_gate') {
          for (let frame = 0; state.apu?.phase === 'riding' && frame < 500; frame++) {
            h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, sprint: false, jump: false,
              drive: { throttle: 1, steer: state.apu.x < 6.6 ? 1 : 0, brake: false }, sequence: ++sequence });
            h.players.step(.05, true, h.tick());
          }
          assert.equal(state.apu?.phase, 'arrived'); h.advance();
        } else if (scene.id === 'm3_defense') {
          for (let frame = 0; state.logos?.phase === 'riding' && frame < 600; frame++) {
            const flight = state.logos;
            const next = LOGOS_DEFENSE.threats.find((threat, threatIndex) => !(flight.resolved & 1 << threatIndex) && threat.z < flight.z + 2);
            const focus = Boolean(next && next.z > flight.z - 22 && next.id % 2 === 0 && flight.neo >= LOGOS_DEFENSE.pulseCost);
            let targetX = 0, targetAltitude = flight.z < -31 ? 41 : 25;
            if (next && !focus && next.z > flight.z - 27) {
              targetX = next.x > 0 ? next.x - 13 : next.x + 13;
              targetAltitude = next.altitude > 27 ? next.altitude - 11 : next.altitude + 11;
            }
            const steer = Math.max(-1, Math.min(1, (targetX - flight.x) * .16 - flight.lateral * .1));
            h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, sprint: false, jump: false, focus,
              drive: { throttle: targetAltitude > flight.altitude + .8 ? 1 : 0, steer, brake: targetAltitude < flight.altitude - .8 }, sequence: ++sequence });
            h.players.step(.05, true, h.tick());
          }
          assert.equal(state.logos?.phase, 'arrived'); h.advance();
        } else if (scene.id === 'm3_sun') {
          for (let frame = 0; state.logos?.phase === 'riding' && frame < 600; frame++) {
            h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, sprint: false, jump: false,
              drive: { throttle: state.logos.stage === 'clouds' ? 1 : 0, steer: 0, brake: false }, sequence: ++sequence });
            h.players.step(.05, true, h.tick());
          }
          assert.equal(state.logos?.phase, 'arrived'); h.advance();
        } else rideToExit(h);
      }
      else {
        if (scene.id === 'm3_dock_battle') {
          h.command('act'); h.advance(26);
          for (const target of state.dockGunnery!.targets) for (let shot = 0; shot < 2; shot++)
            h.sandbox.life.film.dockShoot(actor, Math.atan2(target.x, target.z - DOCK_GUNNERY.apuZ), 0, h.tick());
          h.advance(20); assert.equal(state.step, index + 1, `${scene.id}: ${step.label}`); continue;
        }
        if (scene.id === 'm2_burly') {
          h.command('act');
          for (let frame = 0; frame < 25; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.burly?.phase, 'grapple');
          h.players.act('film-player', 'dodge', h.tick());
          for (const target of h.sandbox.state.threats.slice(0, 2)) {
            for (let hit = 0; target.health > 0 && hit < 10; hit++) {
              actor.position = { ...target.position, z: target.position.z + 2 }; actor.rotation = Math.PI;
              h.sandbox.attack(actor, h.tick(), 2);
            }
          }
          assert.equal(state.burly?.phase, 'staff_ready');
          actor.position = filmPosition(scene.set, 12, -13); h.command('act');
          actor.position = filmStepPosition(scene, step);
          for (let swing = 0; state.step === index && swing < 4; swing++) {
            if (!h.sandbox.state.threats.some(threat => threat.scene === scene.id)) h.advance(6);
            const target = h.sandbox.state.threats.find(threat => threat.scene === scene.id)!;
            target.position = { ...actor.position, z: actor.position.z - 2 }; actor.rotation = Math.PI;
            h.sandbox.attack(actor, h.tick(), 2);
          }
          assert.equal(state.step, 1); continue;
        }
        if (scene.id === 'm2_chateau') {
          h.command('act');
          actor.position = filmPosition(scene.set, -29, 17); h.command('act');
          const fightWave = () => {
            for (const target of [...h.sandbox.state.threats.filter(threat => threat.scene === scene.id)]) {
              actor.position = { ...target.position, z: target.position.z + 2 }; actor.rotation = Math.PI;
              target.attackAt = h.tick() + 2; target.stunUntil = 0;
              h.players.act('film-player', 'dodge', h.tick());
              for (let hit = 0; hit < 3 && target.health > 0; hit++) h.sandbox.attack(actor, h.tick(), 0);
              assert.equal(target.health, 0, scene.id);
            }
          };
          fightWave(); h.advance(); assert.equal(state.chateau?.phase, 'landing');
          actor.position = filmStepPosition(scene, scene.steps[1]); h.advance();
          fightWave(); h.advance(); assert.equal(state.step, 1); continue;
        }
        if (scene.id === 'm1_bullet_dodge') {
          h.command('act');
          for (let frame = 0; frame < 36; frame++) h.players.step(.1, true, h.tick());
          for (const beat of GOVERNMENT_RESCUE.rooftop.beats) {
            while (state.government!.phase === 'bullet_time' && state.government!.elapsed < beat) h.players.step(.1, true, h.tick());
            h.players.act('film-player', 'dodge', h.tick());
          }
          for (let frame = 0; frame < 110 && state.step === index; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.step, index + 1, `${scene.id}: ${step.label}`); continue;
        }
        h.command('act');
        if (scene.id === 'm1_lobby') for (let frame = 0; frame < 80 && !h.sandbox.state.threats.length; frame++) h.players.step(.1, true, h.tick());
        h.advance(); assert.ok(h.sandbox.state.threats.length > 0, scene.id);
        if (scene.id === 'm1_bathroom') {
          const target = h.sandbox.state.threats[0]; target.stunUntil = Number.MAX_SAFE_INTEGER;
          for (let frame = 0; frame < 130; frame++) h.players.step(.1, true, h.tick());
          for (const combo of [0, 1, 2]) {
            target.position = { ...actor.position, z: actor.position.z - 2 }; actor.rotation = Math.PI;
            h.sandbox.attack(actor, h.tick(), combo);
          }
          h.players.step(.1, true, h.tick()); assert.equal(state.betrayal?.phase, 'sacrifice_ready');
          assert.equal(state.step, index + 1, `${scene.id}: ${step.label}`); continue;
        }
        if (scene.id === 'm1_dojo') {
          const target = h.sandbox.state.threats[0];
          h.sandbox.life.film.trainingDodge(actor, target, h.tick());
          for (const combo of [0, 1, 2]) {
            actor.position = { ...target.position, z: target.position.z + 2 }; actor.rotation = Math.PI;
            h.sandbox.attack(actor, h.tick(), combo);
          }
          h.advance();
          assert.equal(target.health, 0, scene.id);
          assert.equal(state.step, index + 1, `${scene.id}: ${step.label}`);
          continue;
        }
        if (scene.id === 'm2_seraph') {
          const target = h.sandbox.state.threats[0];
          for (let exchange = 0; exchange < 2; exchange++) {
            target.attackAt = h.tick() + 1; target.stunUntil = 0;
            assert.equal(h.sandbox.life.film.trainingDodge(actor, target, h.tick()), true);
            actor.position = { ...target.position, z: target.position.z + 2 }; actor.rotation = Math.PI;
            h.sandbox.attack(actor, h.tick(), exchange);
          }
          h.advance(); assert.equal(state.step, index + 1); continue;
        }
        // Exercise the same hit, death and reward path as player melee, not direct removal.
        for (let round = 0; state.step === index && round < 20; round++) {
          for (const target of [...h.sandbox.state.threats]) {
            for (let hits = 0; target.health > 0 && hits < 30; hits++) {
              actor.position = { ...target.position, z: target.position.z + 2 }; actor.rotation = Math.PI;
              h.sandbox.attack(actor, h.tick(), 2);
            }
            assert.equal(target.health, 0, scene.id);
          }
          h.advance();
        }
      }
      if (scene.id === 'm1_pills' && index === scene.steps.length - 1) {
        assert.equal(state.scene, 'm1_mirror', 'the red pill starts the mirror scene without an extra command');
        continue;
      }
      if (scene.id === 'm1_mirror') {
        assert.equal(state.scene, 'm1_pod', 'the mirror covering Neo starts the pod scene without another command');
        continue;
      }
      if (scene.id === 'm1_construct' && index === scene.steps.length - 1) {
        assert.equal(state.scene, 'm1_desert', 'the television choice starts the ruined world without another command');
        continue;
      }
      if (scene.id === 'm1_wake_again' && index === scene.steps.length - 1) {
        assert.equal(state.scene, 'm1_bridge', 'walking out of 101 starts the bridge scene without another command');
        continue;
      }
      assert.equal(state.step, index + 1, `${scene.id}: ${step.label}`);
      if (scene.id === 'm1_jump' && index === 0) {
        h.command('act');
        for (let frame = 0; frame < 41; frame++) h.players.step(.1, true, h.tick());
      }
    }
    assert.ok(state.completed.includes(scene.id));
    if (scene.id === 'm1_phone_escape') h.advance(3); // Hold the connected booth shot through the truck impact.
    if (!['m1_bridge', 'm1_bug', 'm1_pills', 'm1_mirror', 'm1_construct'].includes(scene.id)) h.command('next');
    if (scene.id === 'm1_office_escape' && state.office?.crossing !== undefined) for (let frame = 0; frame < 65; frame++) h.players.step(.1, true, h.tick());
  }
  assert.equal(state.finished, true); assert.equal(state.completed.length, FILM_SCENES.length);
  const reflections = { ...state.reflections };
  const last = { ...h.actor().position }; h.command('visit:m1_lobby'); assert.equal(h.actor().currentLocation, 'film_government_lobby');
  h.command('return'); assert.deepEqual(h.actor().position, last); assert.equal(state.finished, true);
  h.command('cycle'); assert.equal(h.actor().id, 'neo'); assert.equal(h.actor().currentLocation, 'neo_apartment');
  assert.equal(h.sandbox.state.neoLife!.cycle, 2); assert.equal(h.sandbox.state.neoLife!.cycles.length, 1); assert.equal(h.sandbox.state.neoLife!.journey, undefined);
  for (const [key, value] of Object.entries(reflections)) assert.equal(h.sandbox.state.neoLife!.cycles[0].choices[key], value);
  assert.equal(h.world.agents.get('niobe')!.currentLocation, CHARACTERS.niobe.initialLocation);
});
