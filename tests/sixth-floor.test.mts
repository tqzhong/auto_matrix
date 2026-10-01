import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SETS, FILM_SCENE_BY_ID, WETWALL, WETWALL_ROLES, WETWALL_SHAFT, wetwallEntry, wetwallRoot, playerBlocked,
  type WetwallEncounter, type FilmJourney, type PlayerInput, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

type Exposure = { phase: string; elapsed: number; shots: number; attempts: number };
function setup() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const impacts: object[] = [], dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const players = new PlayerController(world, { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine,
    { execute() {} } as unknown as ActionExecutor, dynamics, sandbox);
  players.possess('sixth-player', 'neo', 0); const neo = world.agents.get('neo')!;
  sandbox.life.begin(neo, 0); sandbox.state.neoLife!.chapter = 1;
  let tick = 0, sequence = 0;
  const command = (target: string) => players.sandboxAction('sixth-player', { kind: 'life', target: `film:${target}` }, ++tick);
  command('continue');
  const starts = Object.fromEntries(WETWALL_ROLES.map(role => [role, { x: WETWALL.lanes[role], y: WETWALL_SHAFT.top, z: -26.9 }])) as WetwallEncounter['starts'];
  const wall = { phase: 'done', elapsed: 0, freed: true, attempts: 0, starts, progress: {} } as WetwallEncounter;
  for (const role of WETWALL_ROLES) {
    wall.progress[role] = wetwallEntry(wall, role) + (role === 'morpheus' ? 9.4 : role === 'neo' ? 14.8 : role === 'apoc' || role === 'switch' ? 25.8 : 20.2);
    const root = wetwallRoot(wall, role), actor = world.agents.get(role)!, center = FILM_SETS.film_ambush_house.center;
    actor.position = { x: center.x + root.x, y: center.y + root.y, z: center.z + root.z }; actor.rotation = root.yaw;
    actor.isInMatrix = true; actor.currentLocation = 'film_ambush_house';
  }
  wall.checkpoint = { progress: { ...wall.progress }, freed: true };
  const state = () => sandbox.life.film.state! as FilmJourney & { wallExposure?: Exposure };
  Object.assign(state(), { scene: 'm1_wetwall', actor: 'neo', step: 4, wetwall: wall, completed: ['m1_dejavu', 'm1_wetwall'], checkpoint: { ...neo.position } });
  neo.health = 71; world.agents.get('mouse')!.status = 'dead'; world.agents.get('mouse')!.health = 0;
  sandbox.life.film.onImpact = impact => impacts.push(impact);
  const frame = (input: Partial<PlayerInput> = {}, running = true, dt = .1) => {
    players.receiveInput('sixth-player', { x: 0, z: 0, yaw: 0, pitch: 0, jump: false, sprint: false, sequence: ++sequence, ...input });
    players.step(dt, running, ++tick);
  };
  const exposure = () => state().wallExposure!;
  const until = (phase: string, input: Partial<PlayerInput> = {}) => {
    for (let i = 0; i < 500 && exposure().phase !== phase; i++) frame(input);
    assert.equal(exposure().phase, phase);
  };
  const enter = () => { command('next'); assert.equal(state().scene, 'm1_wall_exposed'); };
  return { world, sandbox, players, neo, state, exposure, command, frame, until, enter, impacts, tick: () => tick };
}

test('a completed pipe save continues at room 608 with Neo and the crew at their actual hanging heights', () => {
  const h = setup(), before = WETWALL_ROLES.map(id => ({ ...h.world.agents.get(id)!.position }));
  h.enter();
  assert.equal(h.state().actor, 'neo'); assert.equal(h.neo.health, 71);
  assert.deepEqual(WETWALL_ROLES.map(id => h.world.agents.get(id)!.position), before);
  assert.equal(h.exposure().phase, 'ready'); h.frame(); assert.equal(h.exposure().elapsed, 0);
  h.command('act'); h.until('firing');
  assert.ok(h.world.agents.get('citizen_4')!.position.y < FILM_SETS.film_ambush_house.center.y - 50);
  assert.ok(h.impacts.length > 0, 'the discovered wall must actually receive fire, not only change a caption');
});

test('Neo must return fire toward the searching officer before replacement, grapple and a continuous Morpheus breach', () => {
  const h = setup(); h.enter(); h.command('act'); h.until('firing');
  h.frame({ yaw: Math.PI }); h.players.act('sixth-player', 'shoot', h.tick());
  assert.equal(h.exposure().phase, 'firing', 'a shot into the pipe behind Neo cannot suppress the police officer');
  for (let i = 0; i < 3; i++) h.frame({ yaw: 0 }); h.players.act('sixth-player', 'shoot', h.tick());
  h.until('replacing', { crouch: true });
  const officer = h.world.agents.get('citizen_4')!, smith = h.world.agents.get('smith')!;
  assert.ok(Math.hypot(officer.position.x - smith.position.x, officer.position.z - smith.position.z) < .01,
    'the agent takes the actual officer position instead of spawning in a different room');
  h.until('grapple');
  const morph = h.world.agents.get('morpheus')!, before = { ...morph.position };
  h.until('done');
  assert.ok(Math.abs(morph.position.y - FILM_SETS.film_ambush_house.center.y - WETWALL_SHAFT.sixth) < .01);
  assert.ok(morph.position.z > before.z + 2, 'Morpheus must travel through the physical wall toward Smith');
  assert.equal(h.state().step, FILM_SCENE_BY_ID.m1_wall_exposed.steps.length);
  const landing = { ...morph.position }; h.command('next');
  assert.equal(h.state().scene, 'm1_bathroom'); assert.equal(h.state().actor, 'morpheus');
  assert.deepEqual(morph.position, landing, 'taking his perspective must preserve the sixth-floor landing');
  assert.equal(h.world.agents.get('mouse')!.status, 'dead');
  assert.ok(h.world.agents.get('neo')!.position.y < -50, 'the crew stays in the shaft when the bathroom fight begins');
});

test('incoming fire can fail at the sixth-floor checkpoint; retry preserves Mouse and the completed descent', () => {
  const h = setup(); h.enter(); h.command('act'); h.until('failed');
  assert.equal(h.neo.status, 'dead'); const wall = JSON.stringify(h.state().wetwall);
  h.command('retry'); assert.equal(h.exposure().phase, 'ready'); assert.equal(h.exposure().attempts, 1);
  assert.equal(h.neo.status, 'alive'); assert.equal(JSON.stringify(h.state().wetwall), wall);
  assert.equal(h.neo.position.y, FILM_SETS.film_ambush_house.center.y + WETWALL_SHAFT.sixth);
  assert.equal(h.world.agents.get('mouse')!.status, 'dead');
});

test('holding cover protects Neo but waiting cannot substitute for his return fire', () => {
  const h = setup(); h.enter(); h.command('act'); h.until('firing');
  for (let i = 0; i < 60; i++) h.frame({ crouch: true });
  assert.equal(h.neo.health, 71); assert.equal(h.exposure().phase, 'firing');
  assert.equal(h.exposure().shots, 0);
  h.players.act('sixth-player', 'shoot', h.tick());
  assert.equal(h.exposure().phase, 'firing', 'a concealed shot cannot pass through the solid plaster beside the aperture');
});

test('emptying the pistol into the wrong wall offers a retry instead of leaving a living Neo stuck with zero ammunition', () => {
  const h = setup(); h.enter(); h.command('act'); h.until('firing');
  for (let shot = 0; shot < 12; shot++) {
    h.frame({ yaw: Math.PI }, true, .08); h.players.act('sixth-player', 'shoot', h.tick());
    if (shot < 11) for (let frame = 0; frame < 2; frame++) h.frame({ yaw: Math.PI }, true, .08);
  }
  assert.ok(h.neo.health > 0); assert.equal(h.exposure().phase, 'failed');
  h.command('retry'); assert.equal(h.exposure().phase, 'ready'); assert.equal(h.state().wallExposure!.ammo, 12);
});

test('search, possession and grapple freeze during pause, disconnect, occupied roles and restored saves', () => {
  const h = setup(); h.enter(); h.command('act'); h.until('firing');
  h.players.act('sixth-player', 'shoot', h.tick()); h.until('grapple');
  const snapshot = () => JSON.stringify({ exposure: h.exposure(), cast: WETWALL_ROLES.map(id => h.world.agents.get(id)!.position), smith: h.world.agents.get('smith')!.position });
  const before = snapshot(); h.frame({}, false); assert.equal(snapshot(), before);
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)); h.sandbox.restore(saved); assert.equal(snapshot(), before);
  h.players.release('sixth-player', h.tick()); h.players.step(.1, true, h.tick()); assert.equal(snapshot(), before);
  h.players.possess('sixth-player', 'neo', h.tick());
  h.players.possess('other-player', 'citizen_14', h.tick()); h.frame(); const held = snapshot();
  for (let i = 0; i < 10; i++) h.frame(); assert.equal(snapshot(), held);
  h.players.release('other-player', h.tick()); h.until('done');
});

test('the sixth-floor handoff starts Smith at his actual landing and reserves all five descending companions', () => {
  const h = setup(); h.enter(); h.command('act'); h.until('firing');
  h.players.act('sixth-player', 'shoot', h.tick()); h.until('done'); h.command('next');
  h.players.release('sixth-player', h.tick()); assert.equal(h.players.possess('sixth-player', 'morpheus', h.tick()).error, undefined);
  const smith = h.world.agents.get('smith')!, landing = { ...smith.position };
  h.command('act'); assert.equal(h.state().betrayal!.phase, 'defending');
  const threat = h.sandbox.state.threats.find(item => item.character === 'smith')!;
  assert.deepEqual(threat.position, landing); assert.equal(playerBlocked(threat.position, true), false);
  assert.match(h.players.possess('other-player', 'cypher', h.tick()).error!, /背叛片段/, 'Cypher also occupies the physical pipe during the sixth-floor holdout');
  threat.stunUntil = Number.MAX_SAFE_INTEGER;
  const cypherY = h.world.agents.get('cypher')!.position.y;
  for (let i = 0; i < 30; i++) h.frame();
  assert.ok(h.world.agents.get('cypher')!.position.y < cypherY - 3);
  assert.equal(h.world.agents.get('cypher')!.position.x, FILM_SETS.film_ambush_house.center.x + h.state().wallExposure!.starts.cypher.x);
  assert.equal(h.state().betrayal!.phase, 'defending', 'waiting does not replace the required combat');
  assert.equal(h.world.agents.get('mouse')!.status, 'dead');
});

test('a restored bathroom checkpoint infers its sixth-floor staging from the completed exposure if its encounter is missing', () => {
  const h = setup(); h.enter(); h.command('act'); h.until('firing');
  h.players.act('sixth-player', 'shoot', h.tick()); h.until('done'); h.command('next');
  const morpheus = h.world.agents.get('morpheus')!, before = { ...morpheus.position };
  delete h.state().betrayal;
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  assert.equal(h.state().betrayal!.sixth, true);
  assert.deepEqual(morpheus.position, before);
  assert.ok(h.world.agents.get('neo')!.position.y < FILM_SETS.film_ambush_house.center.y - 50);
});
