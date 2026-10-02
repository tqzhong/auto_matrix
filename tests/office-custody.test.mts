import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SCENE_BY_ID, OFFICE_AGENT_ROLES, OFFICE_CUSTODY, METACORTEX, metacortexLiftPose, metacortexPosition, officeCustodyStep, filmPosition, filmStepPosition, playerBlocked, type PlayerInput, type Vector3, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';
import { officeNextPoint } from '../packages/server/src/story/OfficeNavigation.js';
import { exitOfficeCustody } from './helpers/office-custody-route.mts';
import { boardOfficeArrest, departOfficeArrest } from './helpers/office-custody-route.mts';
import { ARREST_CAR, arrestCarPoint, arrestCarPose, arrestDoor, arrestPose } from '@auto_matrix/shared';

function setup() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const players = new PlayerController(world, { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine, {} as ActionExecutor, dynamics, sandbox);
  players.possess('neo-player', 'neo', 0); sandbox.life.begin(world.agents.get('neo')!, 0); sandbox.state.neoLife!.chapter = 2;
  let tick = 0, sequence = 0;
  const neo = world.agents.get('neo')!;
  const state = () => sandbox.life.film.state!;
  const command = (target: string) => players.sandboxAction('neo-player', { kind: 'life', target: `film:${target}` }, ++tick);
  const frame = (seconds: number, running = true) => { for (let i = 0; i < Math.round(seconds * 20); i++) players.step(.05, running, tick); };
  const goal = () => { neo.position = filmStepPosition(sandbox.life.film.scene!, sandbox.life.film.step!); };
  command('continue'); goal(); command('act'); frame(10); command('act');
  goal(); command('act'); frame(11); command('act'); frame(4.1);
  goal(); command('act'); frame(3); command('act'); frame(12); command('next');
  assert.equal(state().scene, 'm1_office_escape');
  const capturePoint = filmPosition('film_metacortex_floor', 0, -20);
  neo.position = { ...capturePoint }; neo.rotation = Math.PI;
  for (let i = 0; i < 14 && !state().office?.outcome; i++) sandbox.tick(++tick);
  assert.equal(state().office?.outcome, 'captured');
  const input = (values: Partial<PlayerInput> = {}, running = true) => {
    players.receiveInput('neo-player', { x: 0, z: 0, yaw: neo.rotation, sprint: false, jump: false, ...values, sequence: ++sequence });
    players.step(.05, running, tick);
    if (running && sequence % 10 === 0) sandbox.tick(++tick);
  };
  const walk = (target = filmPosition('film_metacortex_floor', OFFICE_CUSTODY.exit.x, OFFICE_CUSTODY.exit.z)) => {
    for (let i = 0; i < 2400; i++) {
      if (Math.hypot(target.x - neo.position.x, target.z - neo.position.z) < .3) { input(); return; }
      const point = officeNextPoint(neo.position, target, 1.15)!;
      assert.ok(point, 'the office must have a walkable route to the elevator');
      const dx = point.x - neo.position.x, dz = point.z - neo.position.z, length = Math.hypot(dx, dz);
      input({ x: dx / Math.max(1, length), z: dz / Math.max(1, length), yaw: Math.atan2(dx, dz) });
    }
    assert.fail(`escort stalled: ${JSON.stringify({ neo: neo.position, custody: state().office!.custody })}`);
  };
  return { world, sandbox, players, neo, state, command, frame, input, walk, capturePoint, tick: () => tick };
}

test('parking beside an existing injured resident cannot enclose or relocate that body', () => {
  const h = setup(), resident = h.world.agents.get('choi')!;
  resident.position = { x: 1148.7, y: 1, z: 872.9 }; resident.health = 21;
  const before = structuredClone(resident.position);
  exitOfficeCustody(h.neo, h.state, h.input, h.command);
  const car = h.sandbox.state.structures.find(item => item.id === 'film:office:arrest-car')!;
  assert.equal(playerBlocked(resident.position, true, .7, [car]), false, 'the sedan must choose an unoccupied parking footprint');
  assert.deepEqual(resident.position, before); assert.equal(resident.health, 21);
});

test('occupied parking stays empty through pause and recovery until an actual space becomes free', () => {
  const h = setup(), residents = ['choi', 'citizen_1', 'citizen_12'].map(id => h.world.agents.get(id)!);
  residents.forEach((resident, i) => { resident.position = metacortexPosition([13, 25, -40][i], ARREST_CAR.z); resident.health = 21; });
  const before = residents.map(resident => ({ position: { ...resident.position }, health: resident.health }));
  h.walk(); h.command('act');
  assert.equal(h.state().office!.custody!.street!.waitingForParking, true);
  assert.equal(h.sandbox.state.structures.some(item => item.id === 'film:office:arrest-car'), false);
  h.frame(1, false); h.sandbox.restore(structuredClone(h.sandbox.state)); h.frame(1, false);
  assert.equal(h.state().office!.custody!.street!.waitingForParking, true);
  assert.deepEqual(residents.map(resident => ({ position: { ...resident.position }, health: resident.health })), before);
  residents[1].position.z += 20; h.input();
  assert.equal(h.state().office!.custody!.street!.waitingForParking, undefined);
  assert.deepEqual(h.state().office!.custody!.street!.parking, { x: 25, z: ARREST_CAR.z });
  assert.equal(h.sandbox.state.structures.some(item => item.id === 'film:office:arrest-car'), true);
  assert.deepEqual(residents.map(resident => ({ position: { ...resident.position }, health: resident.health })),
    before.map((resident, i) => i === 1 ? { ...resident, position: { ...resident.position, z: resident.position.z + 20 } } : resident));
});

test('capture preserves Neo and the agents at their physical encounter instead of returning to the checkpoint', () => {
  const h = setup();
  assert.deepEqual(h.neo.position, h.capturePoint, 'being caught must not teleport Neo back to his desk');
  for (const role of OFFICE_AGENT_ROLES) {
    const agent = h.world.agents.get(role)!;
    assert.equal(agent.currentLocation, 'film_metacortex_floor');
    assert.ok(agent.currentAction?.parameters.officeCustody, 'the existing role must remain a visible participant in the arrest');
    assert.ok(Math.hypot(agent.position.x - h.neo.position.x, agent.position.z - h.neo.position.z) >= 1.7, 'the arrest cannot begin with the guard inside Neo');
  }
  assert.equal(h.neo.health, 100);
  assert.equal(h.sandbox.state.threats.some(threat => OFFICE_AGENT_ROLES.includes(threat.character as typeof OFFICE_AGENT_ROLES[number])), false, 'there must be one body per role');
});

test('being caught cannot skip the physical escort with next or act', () => {
  const h = setup();
  h.command('next'); assert.equal(h.state().scene, 'm1_office_escape');
  h.command('act'); assert.equal(h.state().scene, 'm1_office_escape');
  h.frame(20);
  assert.equal(h.state().scene, 'm1_office_escape');
  assert.equal(h.state().office?.custody?.phase, 'escorting', 'waiting at the capture point cannot walk Neo to the elevator');
  assert.equal(h.state().completed.includes(FILM_SCENE_BY_ID.m1_interrogation.id), false);
});

test('reaching the elevator starts physical boarding instead of skipping the ride and lobby', () => {
  const h = setup(); h.frame(4);
  const catcher = h.state().office!.custody!.bodies[h.state().office!.custody!.catcher];
  assert.ok((catcher.position.x - h.neo.position.x) * Math.sin(h.neo.rotation) + (catcher.position.z - h.neo.position.z) * Math.cos(h.neo.rotation) <= .11,
    'the captor must approach the upper arm from beside or behind Neo');
  h.walk();
  assert.equal(h.state().office?.custody?.phase, 'ready');
  assert.equal(h.state().scene, 'm1_office_escape', 'reaching the lift still waits for the player');
  const money = h.sandbox.state.neoLife!.money; h.sandbox.state.neoLife!.evidence = ['clock'];
  const before = { ...h.neo.position };
  h.command('act'); assert.equal(h.state().scene, 'm1_office_escape');
  assert.equal(h.state().office!.custody!.phase, 'clearing');
  assert.deepEqual(h.neo.position, before, 'confirming the lift cannot move Neo into it');
  h.command('next'); assert.equal(h.state().scene, 'm1_office_escape');
  assert.equal(h.sandbox.state.neoLife!.money, money); assert.deepEqual(h.sandbox.state.neoLife!.evidence, ['clock']);
});

test('cuff age, participant poses and the capture point survive pause, disconnect, restore and retry', () => {
  const h = setup(); h.frame(1.6);
  const poses = () => ['neo', ...OFFICE_AGENT_ROLES].map(id => {
    const actor = h.world.agents.get(id)!;
    return { position: { ...actor.position }, rotation: actor.rotation, gesture: structuredClone(actor.currentAction?.parameters.officeCustody), status: actor.status, health: actor.health };
  });
  const before = { custody: structuredClone(h.state().office!.custody), poses: poses() };
  h.frame(2, false); assert.deepEqual({ custody: h.state().office!.custody, poses: poses() }, before);
  h.players.release('neo-player', h.tick()); h.frame(3); h.sandbox.tick(h.tick() + 50);
  assert.deepEqual({ custody: h.state().office!.custody, poses: poses() }, before);
  h.sandbox.restore(structuredClone(h.sandbox.state)); h.players.possess('neo-player', 'neo', h.tick());
  assert.deepEqual({ custody: h.state().office!.custody, poses: poses() }, before);
  h.command('retry'); assert.deepEqual({ custody: h.state().office!.custody, poses: poses() }, before);
  h.frame(3); assert.equal(h.state().office!.custody!.phase, 'escorting');
});

test('custody reserves the same actors, and an occupied actor pauses a restored escort', () => {
  const h = setup(); h.frame(1);
  for (const role of OFFICE_AGENT_ROLES) assert.match(h.players.possess('other', role, h.tick()).error!, /拘捕|押送/);
  const saved = structuredClone(h.sandbox.state), brown = h.world.agents.get('agent_brown')!;
  brown.controller = 'other'; brown.position = filmPosition('film_metacortex_floor', 24, 20); brown.health = 43;
  const occupied = { ...brown.position };
  h.sandbox.restore(saved); const bodies = structuredClone(h.state().office!.custody!.bodies), neo = { ...h.neo.position };
  h.frame(10); h.input({ x: 1, z: 1, jump: true, sprint: true }); h.command('next');
  assert.equal(h.state().office!.custody!.elapsed, saved.neoLife!.journey!.office!.custody!.elapsed);
  assert.deepEqual(brown.position, occupied); assert.equal(brown.health, 43); assert.equal(brown.controller, 'other');
  assert.deepEqual(h.state().office!.custody!.bodies, bodies); assert.deepEqual(h.neo.position, neo);
  delete brown.controller; h.frame(4); assert.equal(h.state().office!.custody!.phase, 'escorting');
  assert.equal(brown.health, 43, 'rejoining the escort does not revive or heal the role');
});

test('cuffed Neo cannot sprint, jump, crouch, fight or travel, and prediction preserves body clearance', () => {
  const h = setup(); h.frame(4); const start = { ...h.neo.position };
  for (let i = 0; i < 20; i++) h.input({ x: 1, z: 0, yaw: Math.PI / 2, sprint: true, jump: true, crouch: true });
  assert.equal(h.neo.position.y, start.y);
  assert.ok(Math.hypot(h.neo.position.x - start.x, h.neo.position.z - start.z) <= OFFICE_CUSTODY.speed + .001);
  assert.equal(h.neo.currentAction?.parameters.crouching, false);
  for (const kind of ['attack', 'shoot', 'ability', 'ability2', 'dodge', 'travel']) assert.match(h.players.act('neo-player', kind, h.tick()), /双手/);
  const body: Vector3 = { ...start, x: start.x + 2 };
  assert.deepEqual(officeCustodyStep(start, { ...start, x: start.x + 1 }, [body]), start);
  assert.deepEqual(officeCustodyStep(start, { ...start, x: start.x - 1 }, [body]), { ...start, x: start.x - 1 });
});

test('an escort stays out of solid furniture and keeps separate bodies at every movement frame', () => {
  const h = setup();
  for (let i = 0; i < 400; i++) {
    const previous = OFFICE_AGENT_ROLES.map(role => ({ ...h.world.agents.get(role)!.position }));
    h.input(i > 80 ? { x: 0, z: -1, yaw: Math.PI } : {});
    const actors = [h.neo, ...OFFICE_AGENT_ROLES.map(role => h.world.agents.get(role)!)];
    actors.forEach((actor, j) => {
      assert.equal(playerBlocked(actor.position, true, .7, h.sandbox.state.structures), false);
      for (const other of actors.slice(j + 1)) assert.ok(Math.hypot(actor.position.x - other.position.x, actor.position.z - other.position.z) >= OFFICE_CUSTODY.spacing - .001,
        `body intersection: ${actor.id}, ${other.id}`);
    });
    OFFICE_AGENT_ROLES.forEach((role, j) => assert.ok(Math.hypot(h.world.agents.get(role)!.position.x - previous[j].x, h.world.agents.get(role)!.position.z - previous[j].z) <= .106, 'escort bodies cannot teleport'));
    if (h.state().office!.custody!.phase === 'ready') break;
  }
});

test('the escort routes around Rhineheart using the actual office supervisor role', () => {
  const h = setup(), supervisor = h.world.agents.get('rhineheart')!;
  supervisor.position = filmPosition('film_metacortex_floor', OFFICE_CUSTODY.exit.x, OFFICE_CUSTODY.exit.z);
  supervisor.currentLocation = 'film_metacortex_floor'; supervisor.isInMatrix = true;
  for (let i = 0; i < 240; i++) {
    h.input();
    for (const role of OFFICE_AGENT_ROLES) {
      const body = h.world.agents.get(role)!;
      assert.ok(Math.hypot(body.position.x - supervisor.position.x, body.position.z - supervisor.position.z) >= OFFICE_CUSTODY.spacing - .001,
        'the actual supervisor body must participate in escort navigation');
    }
  }
});

test('the lift prompt closes when Neo walks away, and old captured saves still continue', () => {
  const h = setup(); h.frame(4); h.walk(); assert.equal(h.state().office!.custody!.phase, 'ready');
  h.walk(filmPosition('film_metacortex_floor', 5, -20)); h.command('next');
  assert.equal(h.state().scene, 'm1_office_escape', 'a past visit to the lift cannot authorize advancing from anywhere');
  delete h.state().office!.custody;
  h.command('next'); assert.equal(h.state().scene, 'm1_interrogation', 'already-captured legacy saves retain their old route');
});

test('the cuffed party boards in order, shares the moving car and walks out through the actual lobby', () => {
  const h = setup(), seen = new Set<string>(), money = h.sandbox.life.state!.money;
  h.sandbox.life.state!.evidence = ['clock'];
  let previous = ['neo', ...OFFICE_AGENT_ROLES, 'courier'].map(id => ({ ...h.world.agents.get(id)!.position }));
  let riding = 0;
  exitOfficeCustody(h.neo, h.state, h.input, h.command, () => {
    const custody = h.state().office!.custody!; seen.add(custody.phase);
    const actors = ['neo', ...OFFICE_AGENT_ROLES, 'courier'].map(id => h.world.agents.get(id)!);
    for (let i = 0; i < actors.length; i++) {
      const actor = actors[i];
      assert.ok(Math.hypot(actor.position.x - previous[i].x, actor.position.z - previous[i].z) <= .106, `no horizontal teleport: ${actor.id}`);
      if (custody.phase !== 'riding') assert.equal(playerBlocked(actor.position, true, .7, h.sandbox.state.structures), false, `solid intersection: ${actor.id}`);
      for (const other of actors.slice(i + 1)) if (Math.abs(actor.position.y - other.position.y) < 3) assert.ok(Math.hypot(actor.position.x - other.position.x, actor.position.z - other.position.z) >= OFFICE_CUSTODY.spacing - .001, `body intersection: ${actor.id}/${other.id}`);
    }
    if (custody.phase === 'riding') {
      riding++;
      const height = 1 + metacortexLiftPose(custody.lift).height;
      for (const actor of actors.slice(0, 4)) assert.equal(actor.position.y, height, 'all four feet ride the same physical car');
    }
    previous = actors.map(actor => ({ ...actor.position }));
  });
  for (const phase of ['securing', 'escorting', 'clearing', 'boarding', 'selecting', 'riding', 'lobby', 'outside']) assert.ok(seen.has(phase), `missing physical stage: ${phase}`);
  assert.ok(riding >= (METACORTEX.travelSeconds + METACORTEX.doorSeconds * 2) * 20 - 4, 'the lift must not be advanced by two clocks');
  assert.equal(h.neo.position.y, 1); assert.ok(h.neo.position.z > METACORTEX.center.z + 34);
  assert.equal(h.sandbox.life.state!.money, money); assert.deepEqual(h.sandbox.life.state!.evidence, ['clock']);
  assert.equal(h.state().scene, 'm1_office_escape'); boardOfficeArrest(h.neo, h.state, h.input, h.command); departOfficeArrest(h.state, h.input, h.command); assert.equal(h.state().scene, 'm1_interrogation');
  assert.equal(h.neo.currentAction?.parameters.officeCustody, undefined); assert.equal(h.sandbox.life.state!.lift!.passenger, undefined);
});

test('the shared escorted elevator preserves time, doors and all bodies across pause, disconnect, retry and restore', () => {
  const h = setup();
  let stopped = false;
  exitOfficeCustody(h.neo, h.state, h.input, h.command, () => {
    const custody = h.state().office!.custody!;
    if (stopped || custody.lift?.phase !== 'travel' || custody.lift.elapsed < 3) return;
    stopped = true;
    const snapshot = () => ({ custody: structuredClone(h.state().office!.custody), lift: structuredClone(h.sandbox.life.state!.lift),
      actors: ['neo', ...OFFICE_AGENT_ROLES, 'courier'].map(id => {
        const actor = h.world.agents.get(id)!;
        return { position: { ...actor.position }, yaw: actor.rotation, gesture: structuredClone(actor.currentAction?.parameters.officeCustody), health: actor.health };
      }), doors: structuredClone(h.sandbox.state.structures.filter(s => s.id.startsWith('city:metacortex:door:'))) });
    const before = snapshot();
    h.frame(4, false); assert.deepEqual(snapshot(), before);
    h.players.release('neo-player', h.tick()); h.frame(4); assert.deepEqual(snapshot(), before);
    h.sandbox.restore(structuredClone(h.sandbox.state)); h.players.possess('neo-player', 'neo', h.tick());
    assert.deepEqual(snapshot(), before); h.command('retry'); assert.deepEqual(snapshot(), before);
    h.command('next'); assert.equal(h.state().scene, 'm1_office_escape');
    assert.equal(h.state().office!.custody!.lift!.elapsed, before.custody!.lift!.elapsed);
    for (const floor of [0, 1]) assert.equal(playerBlocked(metacortexPosition(0, METACORTEX.doorZ, floor), true, .7, h.sandbox.state.structures), true);
    const guard = h.world.agents.get('agent_brown')!; guard.controller = 'other'; const external = { ...guard.position, x: guard.position.x + 12 }; guard.position = external; guard.health = 43;
    const lift = structuredClone(h.state().office!.custody!.lift), neo = { ...h.neo.position };
    h.frame(4); assert.deepEqual(h.state().office!.custody!.lift, lift); assert.deepEqual(h.neo.position, neo); assert.deepEqual(guard.position, external); assert.equal(guard.health, 43);
    delete guard.controller; h.sandbox.life.film.custody.frame(h.neo, 0, h.tick()); assert.equal(guard.health, 43);
  });
  assert.ok(stopped); assert.equal(h.state().office!.custody!.phase, 'outside');
});

test('leaving the company must approach and board the sedan before interrogation', () => {
  const h = setup(); exitOfficeCustody(h.neo, h.state, h.input, h.command);
  const before = { ...h.neo.position };
  h.command('act');
  assert.equal(h.state().scene, 'm1_office_escape', 'the street arrest cannot be skipped by the old G transition');
  assert.equal(h.state().office!.custody!.phase, 'street');
  assert.deepEqual(h.neo.position, before, 'starting the street escort cannot teleport Neo into the car');
  h.command('next'); h.frame(20);
  assert.equal(h.state().scene, 'm1_office_escape');
  assert.deepEqual(h.neo.position, before, 'waiting cannot complete the approach on the player’s behalf');
});

test('the street escort boards the same cuffed actors through open doors and records the real lookout', () => {
  const h = setup(); exitOfficeCustody(h.neo, h.state, h.input, h.command);
  const money = h.sandbox.life.state!.money; h.sandbox.life.state!.evidence = ['clock'];
  const trinity = h.world.agents.get('trinity')!; trinity.health = 43;
  const seen = new Set<string>(); let mirror = false;
  let previous = ['neo', ...OFFICE_AGENT_ROLES].map(id => ({ ...h.world.agents.get(id)!.position }));
  boardOfficeArrest(h.neo, h.state, h.input, h.command, () => {
    const custody = h.state().office!.custody!, street = custody.street!; seen.add(street.phase);
    const actors = ['neo', ...OFFICE_AGENT_ROLES].map(id => h.world.agents.get(id)!);
    actors.forEach((actor, i) => {
      assert.ok(Math.hypot(actor.position.x - previous[i].x, actor.position.z - previous[i].z) < .19, `continuous street motion: ${actor.id}`);
      for (const other of actors.slice(i + 1)) assert.ok(Math.hypot(actor.position.x - other.position.x, actor.position.z - other.position.z) >= OFFICE_CUSTODY.spacing - .001, `separate street bodies: ${JSON.stringify({ phase: street.phase, age: street.elapsed, a: actor.id, b: other.id, from: actor.position, to: other.position })}`);
      if (!arrestPose(custody, actor.id as 'neo' | typeof custody.leader)) assert.equal(playerBlocked(actor.position, true, .7, h.sandbox.state.structures), false, `street furniture/car collision: ${actor.id}`);
    });
    if (street.phase === 'entering' && street.elapsed > 1.4 && street.elapsed < 4.6) {
      assert.ok(arrestDoor(street, -1, true) > .99, 'Neo must enter through an open rear door');
      assert.ok(arrestPose(custody, 'neo')!.duck > .9, 'the body must duck before crossing the roof edge');
    }
    if (street.observed) { mirror = true; assert.ok(custody.watcher); assert.ok(trinity.currentAction?.parameters.officeCustody); }
    previous = actors.map(actor => ({ ...actor.position }));
    if (street.phase !== 'done') { h.command('next'); assert.equal(h.state().scene, 'm1_office_escape', 'next cannot bypass an active entry'); }
  });
  for (const phase of ['approaching', 'opening', 'entering', 'rear_approach', 'rear_entering', 'closing', 'done']) assert.ok(seen.has(phase), `missing street stage: ${phase}`);
  assert.ok(mirror); assert.equal(trinity.health, 43, 'the existing lookout is not healed or duplicated');
  assert.equal(h.world.agents.size, 85);
  assert.deepEqual(h.neo.position, arrestCarPoint(ARREST_CAR.seats.neo.x, ARREST_CAR.seats.neo.z, h.state().office!.custody!.street));
  assert.equal(arrestDoor(h.state().office!.custody!.street, 1, true), 0);
  assert.equal(h.sandbox.life.state!.money, money); assert.deepEqual(h.sandbox.life.state!.evidence, ['clock']);
  departOfficeArrest(h.state, h.input, h.command); assert.equal(h.state().scene, 'm1_interrogation');
  assert.equal(h.sandbox.state.structures.some(item => item.id === 'film:office:arrest-car'), false);
  assert.equal(trinity.currentAction?.parameters.officeCustody, undefined, 'finishing the scene releases the lookout');
});

test('street entry, cuffs and the mirror moment survive pause, disconnect, occupied lookout, restore and retry', () => {
  const h = setup(); exitOfficeCustody(h.neo, h.state, h.input, h.command);
  let checked = false;
  boardOfficeArrest(h.neo, h.state, h.input, h.command, () => {
    const custody = h.state().office!.custody!;
    if (checked || custody.street?.phase !== 'entering' || custody.street.elapsed < 3) return;
    checked = true;
    const snapshot = () => ({ custody: structuredClone(h.state().office!.custody), actors: ['neo', ...OFFICE_AGENT_ROLES, 'trinity'].map(id => {
      const actor = h.world.agents.get(id)!;
      return { position: { ...actor.position }, yaw: actor.rotation, gesture: structuredClone(actor.currentAction?.parameters.officeCustody), health: actor.health };
    }) });
    const before = snapshot(); h.frame(3, false); assert.deepEqual(snapshot(), before);
    h.players.release('neo-player', h.tick()); h.frame(3); assert.deepEqual(snapshot(), before);
    h.sandbox.restore(structuredClone(h.sandbox.state)); h.players.possess('neo-player', 'neo', h.tick()); assert.deepEqual(snapshot(), before);
    h.command('retry'); assert.deepEqual(snapshot(), before);
    const trinity = h.world.agents.get('trinity')!; trinity.controller = 'other'; const external = { ...trinity.position, x: trinity.position.x + 20 }; trinity.position = external; trinity.health = 38;
    const age = custody.street!.elapsed, neo = { ...h.neo.position };
    h.frame(3); h.command('act'); assert.equal(h.state().office!.custody!.street!.elapsed, age); assert.deepEqual(h.neo.position, neo);
    assert.deepEqual(trinity.position, external); assert.equal(trinity.health, 38); assert.equal(trinity.controller, 'other');
    delete trinity.controller; h.sandbox.life.film.custody.frame(h.neo, 0, h.tick()); assert.equal(trinity.health, 38);
  });
  assert.ok(checked); assert.equal(h.state().office!.custody!.street!.phase, 'done');
});

test('the closed arrest car must leave with its four seated bodies before interrogation', () => {
  const h = setup(); exitOfficeCustody(h.neo, h.state, h.input, h.command);
  boardOfficeArrest(h.neo, h.state, h.input, h.command);
  const positions = ['neo', ...OFFICE_AGENT_ROLES].map(id => ({ ...h.world.agents.get(id)!.position }));
  h.neo.health = 64;
  const injuries = OFFICE_AGENT_ROLES.map((role, i) => { const actor = h.world.agents.get(role)!; actor.health = 51 + i; return [role, actor.health] as const; });
  const money = h.sandbox.life.state!.money; h.sandbox.life.state!.evidence = ['clock'];
  h.command('act');
  assert.equal(h.state().scene, 'm1_office_escape', 'closing the doors cannot skip the physical departure');
  assert.equal(h.state().office!.custody!.street!.phase, 'departing');
  h.frame(2);
  assert.ok(Math.hypot(h.neo.position.x - positions[0].x, h.neo.position.z - positions[0].z) > 2, 'Neo travels in the same city with the sedan');
  const snapshot = () => ({ custody: structuredClone(h.state().office!.custody), actors: ['neo', ...OFFICE_AGENT_ROLES].map(id => {
    const actor = h.world.agents.get(id)!; return { position: { ...actor.position }, yaw: actor.rotation, health: actor.health };
  }), car: structuredClone(h.sandbox.state.structures.find(item => item.id === 'film:office:arrest-car')) });
  const before = snapshot(); h.frame(3, false); assert.deepEqual(snapshot(), before);
  h.players.release('neo-player', h.tick()); h.frame(3); assert.deepEqual(snapshot(), before);
  h.sandbox.restore(structuredClone(h.sandbox.state)); h.players.possess('neo-player', 'neo', h.tick()); assert.deepEqual(snapshot(), before);
  h.command('next'); assert.equal(h.state().scene, 'm1_office_escape', 'next cannot skip a moving car');
  h.frame(4);
  const turning = snapshot(); h.frame(2, false); assert.deepEqual(snapshot(), turning);
  h.sandbox.restore(structuredClone(h.sandbox.state)); h.command('retry'); assert.deepEqual(snapshot(), turning);
  const car = h.sandbox.state.structures.find(item => item.id === 'film:office:arrest-car')!;
  assert.deepEqual(car.position, arrestCarPoint(0, 0, h.state().office!.custody!.street));
  assert.ok(playerBlocked(h.neo.position, true, 0, [car]), 'the occupied seat remains within the moving collider');
  assert.equal(playerBlocked(arrestCarPoint(0, 0), true, 0, [car]), false, 'the departed car releases its old street space');
  const actors = ['neo', ...OFFICE_AGENT_ROLES].map(id => h.world.agents.get(id)!);
  for (let i = 0; i < actors.length; i++) for (let j = i + 1; j < actors.length; j++) {
    assert.ok(Math.abs(Math.hypot(actors[i].position.x - actors[j].position.x, actors[i].position.z - actors[j].position.z)
      - Math.hypot(positions[i].x - positions[j].x, positions[i].z - positions[j].z)) < .001, 'turning cannot detach any passenger from their seat');
  }
  h.frame(20);
  assert.equal(h.state().scene, 'm1_interrogation', 'the actual departure ends at the interrogation transition');
  for (const [role, health] of injuries) assert.equal(h.world.agents.get(role)!.health, health, 'the agents keep their injuries through the scene cut');
  assert.equal(h.neo.health, 64, 'a live passenger is not healed by the scene cut');
  assert.equal(h.sandbox.life.state!.money, money); assert.deepEqual(h.sandbox.life.state!.evidence, ['clock']);
  assert.equal(h.sandbox.state.structures.some(item => item.id === 'film:office:arrest-car'), false);
});

test('retrying an alive cuffed Neo retains his injury instead of healing a saved performance', () => {
  const h = setup(); h.neo.health = 64; h.frame(1);
  const custody = structuredClone(h.state().office!.custody), position = { ...h.neo.position };
  h.command('retry');
  assert.equal(h.neo.health, 64, 'resuming a live arrest is not a death retry');
  assert.deepEqual(h.neo.position, position); assert.deepEqual(h.state().office!.custody, custody);
});

test('the driver waits for a crossing body and a player barricade without moving or healing them', () => {
  const h = setup(); exitOfficeCustody(h.neo, h.state, h.input, h.command); boardOfficeArrest(h.neo, h.state, h.input, h.command);
  h.command('act'); h.frame(2);
  const street = h.state().office!.custody!.street!, crossing = h.world.agents.get('rhineheart')!;
  crossing.isInMatrix = true; crossing.position = arrestCarPoint(0, -10, street); crossing.health = 51;
  const age = street.elapsed, position = { ...h.neo.position }, pedestrian = { ...crossing.position };
  h.frame(2); assert.equal(street.blocked, true); assert.equal(street.elapsed, age); assert.deepEqual(h.neo.position, position);
  assert.equal(arrestCarPose(street).speed, 0); assert.deepEqual(crossing.position, pedestrian); assert.equal(crossing.health, 51);
  crossing.position = arrestCarPoint(-20, -10, street);
  const barrier = { id: 'player:road', kind: 'barricade' as const, owner: 'neo', matrix: true, health: 100, position: pedestrian };
  h.sandbox.state.structures.push(barrier); h.frame(2);
  assert.equal(street.elapsed, age); assert.deepEqual(h.neo.position, position); assert.equal(barrier.health, 100);
  h.sandbox.state.structures = h.sandbox.state.structures.filter(item => item.id !== barrier.id);
  h.frame(1); assert.equal(street.blocked, false); assert.ok(street.elapsed > age); assert.equal(crossing.health, 51);
});

test('a pedestrian beside the rear bumper does not trap a car that is moving away', () => {
  const h = setup(); exitOfficeCustody(h.neo, h.state, h.input, h.command); boardOfficeArrest(h.neo, h.state, h.input, h.command);
  const choi = h.world.agents.get('choi')!;
  choi.position = arrestCarPoint(-4.2, 4, h.state().office!.custody!.street); choi.health = 21;
  assert.equal(playerBlocked(choi.position, true, .6, h.sandbox.state.structures), false, 'the pedestrian starts outside the actual car');
  const before = { ...choi.position }; h.command('act'); h.frame(1);
  assert.ok(h.state().office!.custody!.street!.elapsed > .9, 'a widening gap behind the car cannot stop departure');
  assert.deepEqual(choi.position, before); assert.equal(choi.health, 21);
});
