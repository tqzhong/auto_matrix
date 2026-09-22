import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SETS, FILM_SCENES, FILM_SCENE_BY_ID, FILM_CAST, NEO_CHAPTERS, CHARACTERS, filmReflections, filmStepPosition, filmEntry, playerBlocked, stepPlayer, newFreewayRide, stepFreeway, freewayTraffic, ambushCat, neoSkillUnlocked, type AgentState, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';
import { musicForScene } from '../packages/client/src/engine/Soundtrack.js';
import { HOTEL_ROUTE, HOTEL_DOOR_PROGRESS } from '@auto_matrix/shared';

function setup() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const conversations = { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine;
  const attacked: string[] = [];
  const actions = { execute: (_actor: AgentState, action: { target?: string }) => attacked.push(action.target ?? '') } as unknown as ActionExecutor;
  const players = new PlayerController(world, conversations, actions, dynamics, sandbox);
  players.possess('film-player', 'neo', 0); sandbox.life.begin(world.agents.get('neo')!, 0);
  sandbox.state.neoLife!.chapter = 1;
  let tick = 0;
  const command = (target: string) => players.sandboxAction('film-player', { kind: 'life', target: `film:${target}` }, ++tick);
  const advance = (amount = 1) => { for (let i = 0; i < amount; i++) sandbox.tick(++tick); };
  return { world, sandbox, players, command, advance, attacked, actor: () => players.getAgent('film-player')!, tick: () => tick };
}

test('all trilogy scenes have distinct stable IDs, existing cast, accessible objectives and authored locations', () => {
  assert.equal(new Set(FILM_SCENES.map(s => s.id)).size, FILM_SCENES.length);
  assert.equal(new Set(FILM_SCENES.map(s => s.set)).size, Object.keys(FILM_SETS).length);
  for (const id of FILM_CAST) assert.ok(CHARACTERS[id], `missing cast: ${id}`);
  for (const scene of FILM_SCENES) {
    const set = FILM_SETS[scene.set]; assert.ok(set, scene.id);
    assert.ok(set.film.includes(scene.film), scene.id);
    assert.ok(NEO_CHAPTERS.some(c => c.id === scene.chapter), scene.id);
    assert.ok(!playerBlocked(filmEntry(scene), set.world === 'matrix'), `${scene.id}: entry`);
    for (const step of scene.steps) {
      // These targets are seats inside a solid vehicle, reached by boarding.
      // meeting.test exercises that route and character-asset.test checks the seats.
      const stagedInsideProp = scene.id === 'm1_bug' && scene.steps.indexOf(step) < 2 || scene.id === 'm1_recovery' && scene.steps.indexOf(step) === 0;
      assert.equal(playerBlocked(filmStepPosition(scene, step), set.world === 'matrix'), stagedInsideProp, `${scene.id}: ${step.label}`);
    }
    if (scene.steps.some(s => s.kind === 'reflect') && !['m1_pills', 'm1_ledge'].includes(scene.id)) assert.equal(filmReflections(scene.id).length, 3, `${scene.id}: dialogue must be playable`);
  }
  assert.equal(FILM_SCENE_BY_ID.m1_pills.set, 'film_lafayette');
  assert.equal(FILM_SCENE_BY_ID.m1_dejavu.set, 'film_ambush_house');
  assert.equal(FILM_SCENE_BY_ID.m3_bane.set, 'film_logos_deck');
  assert.equal(FILM_SCENE_BY_ID.m3_dock_battle.actor, 'mifune');
  assert.equal(FILM_SCENE_BY_ID.m3_deus.cast[0], 'deus_ex_machina');
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
  h.command('act'); assert.ok(state.started !== undefined);
  h.actor().position.z += 8; h.advance(10); assert.equal(state.step, 0); assert.equal(state.started, undefined);
});

test('a fight persists through simulation cleanup and can be retried after death without skipping it', () => {
  const h = setup(); h.command('start'); const state = h.sandbox.state.neoLife!.journey!;
  state.step = 1; h.actor().position = filmStepPosition(FILM_SCENES[0], FILM_SCENES[0].steps[1]); state.checkpoint = { ...h.actor().position };
  h.command('act'); h.advance(); assert.equal(h.sandbox.state.threats.length, 2);
  assert.match(h.command('next'), /先完成/);
  h.actor().health = 0; h.actor().status = 'dead';
  h.command('retry'); assert.equal(h.actor().status, 'alive'); assert.equal(state.step, 1); assert.equal(h.sandbox.state.threats.length, 0);
  h.command('act'); assert.equal(h.sandbox.state.threats.length, 2);
});

test('saved scene, active fight, role and completed history restore without restarting the route', () => {
  const h = setup(); h.command('start'); const state = h.sandbox.state.neoLife!.journey!;
  state.step = 1; h.actor().position = filmStepPosition(FILM_SCENES[0], FILM_SCENES[0].steps[1]); h.command('act');
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)); h.sandbox.restore(saved); h.advance();
  assert.equal(h.sandbox.life.film.state!.actor, 'trinity'); assert.equal(h.sandbox.life.film.state!.step, 1);
  assert.equal(h.sandbox.state.threats.length, 2);
  h.players.release('film-player', h.tick()); h.players.possess('film-player', 'trinity', h.tick());
  assert.equal(h.sandbox.life.film.state!.scene, 'm1_room303'); assert.equal(h.sandbox.state.threats.length, 2);
});

test('reconnecting a defeated story actor rebuilds at the scene checkpoint instead of their daily home', () => {
  const h = setup(); h.command('start'); const state = h.sandbox.state.neoLife!.journey!;
  state.step = 1; h.actor().position = filmStepPosition(FILM_SCENES[0], FILM_SCENES[0].steps[1]); state.checkpoint = { ...h.actor().position };
  h.command('act'); h.actor().health = 0; h.actor().status = 'dead';
  assert.equal(h.players.possess('film-player', 'trinity', h.tick(), true).agentId, 'trinity');
  assert.equal(h.actor().currentLocation, FILM_SCENES[0].set);
  assert.deepEqual(h.actor().position, state.checkpoint);
  assert.equal(h.actor().health, h.actor().maxHealth); assert.equal(state.step, 1);
  assert.equal(state.fighting, undefined); assert.equal(h.sandbox.state.threats.length, 0);
  h.command('act'); assert.equal(h.sandbox.state.threats.length, 2);
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
  assert.match(h.command('reflect:agency'), /花瓶/);
  assert.ok(h.sandbox.life.state!.journal.some(entry => entry.text.includes('花瓶')));
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
  h.command('act'); h.advance(10);
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
  const scene = FILM_SCENE_BY_ID.m2_hamann; state.scene = scene.id; state.actor = scene.actor; state.step = 1;
  h.players.possess('film-player', 'neo', h.tick()); h.actor().isInMatrix = false;
  h.actor().position = filmStepPosition(scene, scene.steps[1]);
  assert.match(h.command('reflect:care'), /生活|清水/);
  assert.equal(h.sandbox.life.state!.philosophy.care, 1);
  assert.equal(h.sandbox.life.state!.choices['m2_hamann:1'], 'care');
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  h.command('reflect:care'); assert.equal(h.sandbox.life.state!.philosophy.care, 1);
  assert.ok(h.sandbox.life.state!.journal.some(e => e.title.includes('维持谁的生活')));
  assert.notEqual(filmReflections('m1_oracle')[0].response, filmReflections('m2_architect')[0].response);
});

test('Mobil Avenue loops through space only when Neo actually enters the tunnel', () => {
  const h = setup(); h.command('start'); const state = h.sandbox.life.film.state!;
  const scene = FILM_SCENE_BY_ID.m3_mobil; state.scene = scene.id; state.actor = scene.actor; state.step = 0;
  h.players.possess('film-player', 'neo', h.tick()); h.actor().isInMatrix = true; h.actor().currentLocation = scene.set;
  h.actor().position = filmEntry(scene); h.advance(60); assert.equal(state.step, 0);
  h.actor().position = filmStepPosition(scene, scene.steps[0]); h.advance();
  assert.equal(state.step, 1);
  assert.ok(h.actor().position.z > FILM_SETS[scene.set].center.z + 35, 'the tunnel must return to the other end of the same station');
  assert.match(state.lastText, /同一个站台/);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); h.advance(20);
  assert.equal(h.sandbox.life.film.state!.step, 1);
});

test('touching the mirror is a saved performance that freezes on pause and resumes after reconnect', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: 'm1_pills', actor: 'neo', step: 2 }); h.command('next');
  h.actor().position = filmStepPosition(FILM_SCENE_BY_ID.m1_mirror, FILM_SCENE_BY_ID.m1_mirror.steps[0]);
  h.command('act'); assert.equal(state.awakening?.kind, 'mirror');
  for (let i = 0; i < 30; i++) h.players.step(.1, true, h.tick());
  const position = { ...h.actor().position }; const saved = JSON.parse(JSON.stringify(h.sandbox.state));
  h.players.step(.1, false, h.tick()); assert.equal(state.awakening!.elapsed, saved.neoLife.journey.awakening.elapsed);
  h.sandbox.restore(saved); h.players.release('film-player', h.tick()); h.advance(30);
  assert.equal(h.sandbox.life.film.state!.awakening!.elapsed, saved.neoLife.journey.awakening.elapsed);
  h.players.possess('film-player', 'neo', h.tick());
  h.players.receiveInput('film-player', { x: 1, z: 1, yaw: 0, sprint: true, jump: true, sequence: 1 });
  h.players.step(.1, true, h.tick()); assert.deepEqual(h.actor().position, position, 'the hand remains at the mirror while the camera can look around');
  assert.match(h.players.act('film-player', 'attack', h.tick()), /演出/);
  for (let i = 0; i < 70; i++) h.players.step(.1, true, h.tick());
  assert.equal(h.sandbox.life.film.state!.step, 1);
  assert.equal(h.sandbox.life.film.state!.awakening!.elapsed, 8);
  h.advance(30); assert.equal(h.sandbox.life.film.state!.step, 1, 'the next objective requires a separate choice');
});

test('pod disconnection moves Neo down the drain; rescue must be started in the water and lifts the body', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: 'm1_mirror', actor: 'neo', step: 2 }); h.command('next');
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
  h.command('act'); assert.equal(state.awakening!.started, true);
  for (let i = 0; i < 35; i++) h.players.step(.1, true, h.tick());
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
  assert.equal(h.sandbox.life.film.state!.step, 1); h.command('reflect:agency'); assert.equal(h.sandbox.life.film.state!.step, 2);
  h.command('next'); assert.equal(h.sandbox.life.film.state!.scene, 'm1_desert');
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
      for (let hits = 0; threat.health > 0 && hits < 20; hits++) {
        h.actor().position = { ...threat.position, z: threat.position.z + 2 }; h.actor().rotation = Math.PI;
        h.sandbox.attack(h.actor(), h.tick(), 2);
      }
    }
    h.advance(); assert.equal(state.step, 1); assert.equal(h.world.agents.get(opponent)!.status, 'alive');
    assert.notEqual(h.world.agents.get(opponent)!.currentAction?.parameters.filmDuel, true);
  }
});

test('Smith assimilation is reversible at the ending, without reviving Trinity', () => {
  const h = setup(); h.command('start'); const state = h.sandbox.life.film.state!;
  const playLast = (id: string) => {
    const scene = FILM_SCENE_BY_ID[id]; state.scene = id; state.actor = scene.actor; state.step = scene.steps.length - 1;
    h.players.possess('film-player', scene.actor, h.tick());
    h.actor().isInMatrix = FILM_SETS[scene.set].world === 'matrix'; h.actor().currentLocation = scene.set;
    h.actor().position = filmStepPosition(scene, scene.steps[state.step]);
    h.command(scene.steps[state.step].kind === 'reflect' ? 'reflect:care' : 'act'); h.advance(20);
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

test('the entire film route completes through interactions, driving and real combat, then starts a recorded new life', () => {
  const h = setup(); h.command('start'); const state = h.sandbox.state.neoLife!.journey!;
  let sequence = 0;
  for (const scene of FILM_SCENES) {
    assert.equal(state.scene, scene.id); assert.equal(h.actor().id, scene.actor);
    assert.equal(h.actor().isInMatrix, FILM_SETS[scene.set].world === 'matrix');
    assert.equal(musicForScene({ player: h.actor(), sandbox: h.sandbox.state, time: 7500, matrix: h.actor().isInMatrix, running: true }), scene.music);
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
    for (let index = 0; index < scene.steps.length; index++) {
      const step = scene.steps[index]; const actor = h.actor(); actor.position = filmStepPosition(scene, step);
      if (step.kind === 'reach') h.advance();
      else if (step.kind === 'reflect') {
        h.command(scene.id === 'm1_ledge' ? 'escape:retreat' : scene.id === 'm1_pills' ? 'pill:red' : 'reflect:agency');
        if (scene.id === 'm1_pills') for (let frame = 0; frame < 131; frame++) h.players.step(.1, true, h.tick());
      }
      else if (step.kind === 'interact') {
        h.command('act');
        if (scene.id === 'm1_pills') for (let frame = 0; frame < 51; frame++) h.players.step(.1, true, h.tick());
        else if (scene.id === 'm1_download') for (let frame = 0; frame < 101; frame++) h.players.step(.1, true, h.tick());
        else if (scene.id === 'm1_red_dress') for (let frame = 0; frame < 121; frame++) h.players.step(.1, true, h.tick());
        else if (scene.id === 'm1_bridge') {
          for (let frame = 0; frame < 81; frame++) h.players.step(.1, true, h.tick());
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
        else if (scene.id === 'm1_boss' && index === 1) {
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
        else h.advance((step.seconds ?? 3) * 2);
      }
      else if (step.kind === 'drive') { h.command('act'); rideToExit(h); }
      else {
        h.command('act'); h.advance(); assert.ok(h.sandbox.state.threats.length > 0, scene.id);
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
      assert.equal(state.step, index + 1, `${scene.id}: ${step.label}`);
      if (scene.id === 'm1_jump' && index === 0) {
        h.command('act');
        for (let frame = 0; frame < 41; frame++) h.players.step(.1, true, h.tick());
      }
    }
    assert.ok(state.completed.includes(scene.id)); if (!['m1_bridge', 'm1_bug'].includes(scene.id)) h.command('next');
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
