import assert from 'node:assert/strict';
import test from 'node:test';
import { MAGGIE_DISCOVERY, FILM_SETS, FILM_SCENE_BY_ID, filmEntry, filmPosition, filmStepPosition, playerBlocked, type WorldEvent } from '@auto_matrix/shared';
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
  players.possess('discovery-player', 'neo', tick); sandbox.life.begin(world.agents.get('neo')!, tick); sandbox.state.neoLife!.chapter = 1;
  const command = (target: string) => players.sandboxAction('discovery-player', { kind: 'life', target: `film:${target}` }, ++tick);
  command('continue');
  Object.assign(sandbox.life.film.state!, { scene: 'm3_zion_prepare', actor: 'lock', step: 5,
    completed: ['m3_oracle_absorbed', 'm3_bane_questions', 'm3_logos_plan', 'm3_zion_prepare'], reflections: {} });
  players.possess('discovery-player', 'lock', tick);
  world.agents.get('roland')!.health = 47;
  sandbox.state.profiles.roland = { ...sandbox.state.profiles.neo, inventory: { ...sandbox.state.profiles.neo.inventory, medkit: 0 } };
  const next = command('next'); assert.equal(sandbox.life.film.state!.scene, 'm3_maggie_discovery', next);
  const actor = () => players.getAgent('discovery-player') ?? world.agents.get('roland')!;
  const frames = (seconds: number, running = true) => {
    for (let i = 0; i < Math.ceil(seconds / .05); i++) {
      players.receiveInput('discovery-player', { x: 0, z: 0, yaw: actor().rotation, location: actor().currentLocation, sequence: ++sequence });
      players.step(.05, running, ++tick); if (running) sandbox.tick(tick);
    }
  };
  const near = (step: number) => { actor().position = filmStepPosition(FILM_SCENE_BY_ID.m3_maggie_discovery, FILM_SCENE_BY_ID.m3_maggie_discovery.steps[step], sandbox.life.film.state); };
  const walk = (point: { x: number; z: number }) => {
    const target = filmPosition('film_hammer_deck', point.x, point.z);
    for (let i = 0; i < 550 && Math.hypot(actor().position.x - target.x, actor().position.z - target.z) > .35; i++) {
      const dx = target.x - actor().position.x, dz = target.z - actor().position.z, gap = Math.hypot(dx, dz);
      players.receiveInput('discovery-player', { x: dx / Math.max(1, gap), z: dz / Math.max(1, gap), yaw: Math.atan2(dx, dz), location: actor().currentLocation, sequence: ++sequence });
      players.step(.05, true, ++tick); sandbox.tick(tick);
    }
    frames(.1);
    assert.ok(Math.hypot(actor().position.x - target.x, actor().position.z - target.z) < .4, `normal movement cannot reach ${JSON.stringify(point)}: ${JSON.stringify(actor().position)}`);
  };
  return { world, sandbox, players, get state() { return sandbox.life.film.state!; }, command, actor, frames, near, walk, tick: () => tick };
}

test('Maggie discovery begins with an unanswered emergency call, not the old automatic walk-and-timer completion', () => {
  const h = setup(); h.actor().position = filmEntry(FILM_SCENE_BY_ID.m3_maggie_discovery); h.frames(3);
  assert.equal(h.state.step, 0, 'Roland must actively acknowledge AK before approaching the medical bay');
  assert.equal((h.state as any).maggieDiscovery?.phase, 'call');
  assert.equal(h.world.agents.get('maggie')!.status, 'alive', 'the incident must not be committed by a paused entry or unanswered call');
});

test('switching to the discovery perspective preserves Roland’s injury and empty medical inventory', () => {
  const h = setup(); assert.equal(h.actor().health, 47); assert.equal(h.sandbox.state.profiles.roland.inventory.medkit, 0);
});

test('the unanswered Hammer call already places the departed crew on Logos without committing the murder', () => {
  const h = setup(), neo = h.world.agents.get('neo')!, trinity = h.world.agents.get('trinity')!;
  const baneLocation = h.world.agents.get('bane')!.currentLocation;
  for (const member of [neo, trinity]) { member.currentLocation = 'film_hammer_deck'; member.position = filmPosition('film_hammer_deck', 2, 11); }
  neo.health = 43; trinity.health = 37; neo.controller = 'another-player';
  (h.state.maggieDiscovery as any).departed = false; h.frames(.1);
  assert.equal(neo.currentLocation, 'film_hammer_deck'); assert.equal(h.state.maggieDiscovery!.paused, neo.name);
  h.command('act'); assert.equal(h.state.maggieDiscovery!.incident, false);
  delete neo.controller; h.frames(.1);
  assert.equal(neo.currentLocation, 'film_logos_deck'); assert.equal(trinity.currentLocation, 'film_logos_deck');
  assert.equal(neo.health, 43); assert.equal(trinity.health, 37); assert.equal(h.world.agents.get('maggie')!.status, 'alive');
  assert.equal(h.world.agents.get('bane')!.currentLocation, baneLocation);
  const position = { ...neo.position }; neo.position.z -= .5; h.frames(.1);
  assert.equal(neo.position.z, position.z - .5, 'a later frame must not reset a walked Logos position');
});

test('AK reports from Hammer while retaining his injury and another player’s ownership', () => {
  const h = setup(), ak = h.world.agents.get('ak')!;
  ak.currentLocation = 'zion_dock'; ak.health = 62; ak.controller = 'another-player'; h.frames(.1);
  assert.equal(ak.currentLocation, 'zion_dock'); assert.equal(h.state.maggieDiscovery!.paused, ak.name);
  delete ak.controller; h.frames(.1);
  assert.equal(ak.currentLocation, 'film_hammer_deck'); assert.equal(ak.health, 62);
  assert.equal((ak.currentAction!.parameters.maggieDiscovery as any).role, 'ak');
});

test('standing at the former corpse hotspot cannot infer the Logos route or finish the ship search', () => {
  const h = setup(); h.actor().position = { ...filmEntry(FILM_SCENE_BY_ID.m3_maggie_discovery), z: filmEntry(FILM_SCENE_BY_ID.m3_maggie_discovery).z - 46.8 };
  h.command('act'); h.frames(10); h.command('act'); h.frames(10);
  assert.equal(h.sandbox.state.neoLife!.choices.bane_escape_route, undefined);
  assert.ok(!h.state.completed.includes('m3_maggie_discovery'));
});

test('both bedside interaction positions are outside the real bed collision volumes', () => {
  const h = setup();
  for (const point of [MAGGIE_DISCOVERY.inspection, MAGGIE_DISCOVERY.emptyBed])
    assert.equal(playerBlocked(filmPosition('film_hammer_deck', point.x, point.z), false, 1.1, h.sandbox.state.structures), false);
});

function call(h: ReturnType<typeof setup>) {
  h.command('act'); h.frames(MAGGIE_DISCOVERY.call.length * MAGGIE_DISCOVERY.lineSeconds + .1);
  assert.equal(h.state.step, 1); assert.equal(h.state.maggieDiscovery!.phase, 'approach');
}
function inspect(h: ReturnType<typeof setup>) {
  call(h); h.walk(MAGGIE_DISCOVERY.approach); assert.equal(h.state.step, 2);
  h.walk(MAGGIE_DISCOVERY.inspection); h.command('act'); h.frames(MAGGIE_DISCOVERY.bedside.length * MAGGIE_DISCOVERY.lineSeconds + .1);
  assert.equal(h.state.step, 3); h.walk(MAGGIE_DISCOVERY.emptyBed); h.command('act');
  h.frames(MAGGIE_DISCOVERY.berthLines.length * MAGGIE_DISCOVERY.lineSeconds + .1); assert.equal(h.state.step, 4);
}

test('the ordinary walking route separates the body, empty berth, ship search, EMP warning and saved judgment', () => {
  const h = setup(), life = h.sandbox.state.neoLife!, before = structuredClone(life.philosophy);
  call(h); assert.equal(h.world.agents.get('maggie')!.status, 'dead'); assert.equal(life.choices.maggie_incident, 'committed');
  assert.equal(h.world.agents.get('bane')!.currentLocation, 'film_logos_deck'); assert.equal(life.choices.bane_escape_route, undefined);
  h.command('reflect:agency'); assert.deepEqual(life.philosophy, before);
  h.walk(MAGGIE_DISCOVERY.approach); h.command('act'); assert.equal(h.state.maggieDiscovery!.phase, 'ready', 'the aisle is not the bedside');
  h.walk(MAGGIE_DISCOVERY.inspection); h.command('act'); h.frames(1.7);
  assert.ok(h.state.maggieDiscovery!.cover > 0 && h.state.maggieDiscovery!.cover < MAGGIE_DISCOVERY.coverSeconds);
  h.command('act'); h.frames(7); assert.equal(h.state.step, 3); assert.deepEqual(h.state.maggieDiscovery!.evidence, ['maggie']);
  h.walk(MAGGIE_DISCOVERY.emptyBed); h.command('act'); h.frames(8.5);
  assert.deepEqual(h.state.maggieDiscovery!.evidence, ['maggie', 'berth']); assert.equal(life.choices.bane_escape_route, undefined);
  h.walk(MAGGIE_DISCOVERY.report); h.command('act'); h.frames(1.1); assert.ok(h.state.maggieDiscovery!.arrival < MAGGIE_DISCOVERY.arrivalSeconds);
  assert.equal(h.actor().rotation, 0, 'Roland faces the arriving report instead of the rear wall');
  h.frames(15); assert.equal(h.state.maggieDiscovery!.phase, 'return'); assert.equal(life.choices.bane_escape_route, 'logos_suspected');
  assert.deepEqual(h.state.maggieDiscovery!.evidence, ['maggie', 'berth', 'ship']); assert.equal(life.choices.logos_emp_risk, undefined);
  h.command('reflect:agency'); assert.deepEqual(life.philosophy, before); h.command('act'); h.frames(16.9);
  assert.equal(h.state.step, 5); assert.equal(life.choices.logos_emp_risk, 'acknowledged');
  h.command('reflect:care'); const philosophy = structuredClone(life.philosophy); h.command('reflect:agency'); assert.deepEqual(life.philosophy, philosophy);
  h.frames(4.3); assert.equal(h.state.step, 6); h.command('next'); assert.equal(h.state.scene, 'm3_maggie_discovery');
  h.walk(MAGGIE_DISCOVERY.exit); assert.equal(h.state.step, 7); assert.ok(h.state.completed.includes('m3_maggie_discovery'));
  assert.equal(h.actor().health, 47); assert.equal(h.sandbox.state.profiles.roland.inventory.medkit, 0);
  assert.equal(life.journal.filter(item => item.title === 'Hammer 的紧急报告').length, 1);
  assert.equal(life.choices.bane_identity, undefined, 'Roland does not learn Smith’s identity from an empty berth');
  const neo = h.world.agents.get('neo')!, trinity = h.world.agents.get('trinity')!, bane = h.world.agents.get('bane')!;
  neo.health = 43; trinity.health = 37; bane.health = 31; h.sandbox.state.profiles.neo.inventory.medkit = 0;
  h.command('next'); assert.equal(h.state.scene, 'm3_bane'); assert.equal(h.actor().id, 'neo');
  assert.equal(neo.health, 43, 'switching viewpoint must not heal Neo'); assert.equal(trinity.health, 37); assert.equal(bane.health, 31);
  assert.equal(h.sandbox.state.profiles.neo.inventory.medkit, 0); assert.equal(h.world.agents.get('maggie')!.status, 'dead');
});

test('paused, released and restored covering preserves clocks, corpse geometry intent and injured checkpoint', () => {
  const h = setup(); call(h); h.near(1); h.frames(.1); h.near(2); h.command('act'); h.frames(1.7);
  const state = JSON.parse(JSON.stringify(h.state.maggieDiscovery)), actor = h.actor(), position = { ...actor.position };
  const corpse = structuredClone(h.world.agents.get('maggie')!.currentAction), inventory = structuredClone(h.sandbox.state.profiles.roland.inventory);
  h.frames(8, false); assert.deepEqual(JSON.parse(JSON.stringify(h.state.maggieDiscovery)), state); assert.deepEqual(actor.position, position);
  assert.deepEqual(h.world.agents.get('maggie')!.currentAction, corpse);
  h.players.release('discovery-player', h.tick()); h.frames(8); assert.deepEqual(JSON.parse(JSON.stringify(h.state.maggieDiscovery)), state);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); h.players.possess('discovery-player', 'roland', h.tick());
  assert.deepEqual(JSON.parse(JSON.stringify(h.state.maggieDiscovery)), state); assert.equal(h.actor().health, 47);
  assert.deepEqual(h.sandbox.state.profiles.roland.inventory, inventory); assert.equal(h.world.agents.get('maggie')!.status, 'dead');
  h.frames(.4); assert.ok(h.state.maggieDiscovery!.cover > state.cover);
});

test('occupied, unavailable and missing participants stop the clock without takeover, resurrection or relocation', () => {
  const h = setup(); call(h); h.near(1); h.frames(.1); h.near(2); h.command('act'); h.frames(1.7);
  const link = h.world.agents.get('link')!, clock = h.state.maggieDiscovery!.elapsed;
  link.controller = 'other-player'; link.position = { x: 1, y: 2, z: 3 }; link.health = 19;
  h.frames(8); h.command('act'); assert.equal(h.state.maggieDiscovery!.elapsed, clock);
  assert.deepEqual(link.position, { x: 1, y: 2, z: 3 }); assert.equal(link.health, 19); assert.equal(link.controller, 'other-player');
  link.controller = null; link.status = 'dead'; link.health = 0;
  h.frames(8); h.command('retry'); assert.equal(h.state.maggieDiscovery!.elapsed, clock); assert.equal(link.status, 'dead'); assert.equal(link.health, 0);
  assert.deepEqual(link.position, { x: 1, y: 2, z: 3 });
  link.status = 'alive'; link.health = 19; h.world.agents.delete('maggie'); h.frames(8);
  assert.equal(h.state.maggieDiscovery!.unavailable, 'maggie'); assert.equal(h.state.maggieDiscovery!.elapsed, clock);
});

test('explicit retry restores only Roland and keeps the offscreen Bane, casualty and scarce supplies', () => {
  const h = setup(); inspect(h); h.near(4); h.command('act'); h.frames(1.2);
  const clock = structuredClone(h.state.maggieDiscovery), bane = h.world.agents.get('bane')!; bane.health = 31;
  const position = { ...bane.position }, inventory = structuredClone(h.sandbox.state.profiles.roland.inventory);
  h.actor().status = 'dead'; h.actor().health = 0; h.frames(8);
  assert.deepEqual(h.state.maggieDiscovery, clock); h.command('retry');
  assert.equal(h.actor().status, 'alive'); assert.equal(h.actor().health, 47); assert.deepEqual(h.state.maggieDiscovery, clock);
  assert.equal(bane.health, 31); assert.deepEqual(bane.position, position); assert.equal(h.world.agents.get('maggie')!.status, 'dead');
  assert.deepEqual(h.sandbox.state.profiles.roland.inventory, inventory);
});

test('legacy partial and completed investigations migrate without moving a walked checkpoint or adding philosophical answers', () => {
  for (const completed of [false, true]) {
    const h = setup(); delete h.state.maggieDiscovery; h.state.step = completed ? 2 : 1;
    if (completed) { h.state.completed.push('m3_maggie_discovery'); h.sandbox.state.neoLife!.choices.bane_escape_route = 'logos_suspected'; }
    h.actor().position = filmPosition('film_hammer_deck', 0, -10); const position = { ...h.actor().position };
    const philosophy = structuredClone(h.sandbox.state.neoLife!.philosophy); h.frames(.1);
    assert.equal(h.state.step, completed ? 7 : 2); assert.equal(h.state.maggieDiscovery!.legacy, true);
    assert.deepEqual(h.actor().position, position); assert.deepEqual(h.sandbox.state.neoLife!.philosophy, philosophy);
    assert.equal(h.state.reflections['m3_maggie_discovery:5'], undefined); assert.equal(h.actor().health, 47);
  }
});

test('only the untouched old ship entry migrates, including an already initialized unanswered call', () => {
  for (const walked of [false, true]) {
    const h = setup(); h.actor().position = filmPosition('film_hammer_deck', 0, FILM_SETS.film_hammer_deck.depth * .32 + (walked ? -1 : 0));
    h.state.checkpoint = { ...h.actor().position }; h.actor().rotation = .42;
    const position = { ...h.actor().position }; h.sandbox.life.film.maggieDiscovery.frame(h.actor(), 0, h.tick());
    assert.deepEqual(h.actor().position, walked ? position : filmEntry(FILM_SCENE_BY_ID.m3_maggie_discovery));
    assert.equal(h.actor().rotation, walked ? .42 : Math.PI); assert.equal(h.state.maggieDiscovery!.incident, false);
    h.frames(.1); assert.deepEqual(h.actor().position, walked ? position : filmEntry(FILM_SCENE_BY_ID.m3_maggie_discovery));
    assert.equal(h.actor().health, 47);
  }
});

test('monitor equipment has collision while the entry, central aisle and bedside paths stay open', () => {
  const h = setup();
  for (const point of [{ x: -10, z: -27.4 }, { x: 10, z: -18.6 }])
    assert.equal(playerBlocked(filmPosition('film_hammer_deck', point.x, point.z), false, 1.1, h.sandbox.state.structures), true);
  for (const point of [MAGGIE_DISCOVERY.entry, MAGGIE_DISCOVERY.approach, MAGGIE_DISCOVERY.report, MAGGIE_DISCOVERY.exit])
    assert.equal(playerBlocked(filmPosition('film_hammer_deck', point.x, point.z), false, 1.1, h.sandbox.state.structures), false);
});

test('the infirmary doorway blocks entry until the acknowledged call opens it', () => {
  const h = setup(), doorway = filmPosition('film_hammer_deck', 0, 9);
  assert.equal(playerBlocked(doorway, false, 1.1, h.sandbox.state.structures), true);
  h.near(0); h.command('act'); h.frames(.6);
  assert.equal(playerBlocked(doorway, false, 1.1, h.sandbox.state.structures), true);
  h.frames(1);
  assert.equal(playerBlocked(doorway, false, 1.1, h.sandbox.state.structures), false);
});

test('an unavailable or occupied Logos participant keeps the completed investigation at its handoff', () => {
  for (const role of ['neo', 'trinity', 'bane']) for (const occupied of [true, false]) {
    const h = setup(); call(h); h.state.step = 7; h.state.completed.push('m3_maggie_discovery'); h.state.maggieDiscovery!.phase = 'done';
    const participant = h.world.agents.get(role)!, position = { ...participant.position };
    if (occupied) participant.controller = 'another-player'; else { participant.status = 'dead'; participant.health = 0; }
    const health = participant.health, controller = participant.controller; h.command('next');
    assert.equal(h.state.scene, 'm3_maggie_discovery'); assert.equal(h.actor().id, 'roland');
    assert.equal(participant.health, health); assert.deepEqual(participant.position, position);
    assert.equal(participant.status, occupied ? 'alive' : 'dead'); assert.equal(participant.controller, controller);
  }
});
