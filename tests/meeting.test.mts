import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SCENE_BY_ID, FILM_SETS, filmEntry, filmStepPosition, filmPosition, filmSetAt, meetingBoardPoint, meetingCarPose, meetingDrive, meetingPose, meetingRoadContains, playerBlocked, MEETING_DRIVE_SECONDS, MEETING_DESTINATION, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

function setup(bugged = true) {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (e: Omit<WorldEvent, 'id'>) => world.addWorldEvent(e) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const players = new PlayerController(world, { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine, {} as ActionExecutor, dynamics, sandbox);
  players.possess('player', 'neo', 0); const neo = world.agents.get('neo')!; sandbox.life.begin(neo, 0);
  const scene = FILM_SCENE_BY_ID.m1_bridge;
  sandbox.state.neoLife!.journey = { version: 1, scene: scene.id, actor: 'neo', step: 1, completed: [], enteredAt: 0, reflections: {}, lastText: '', checkpoint: filmStepPosition(scene, scene.steps[1]),
    office: { alert: 0, suspicion: [], waypoints: [], lastTick: 0, guide: '', outcome: bugged ? 'captured' : 'escaped', bugged } };
  let tick = 0; let sequence = 0;
  const command = (target: string) => players.sandboxAction('player', { kind: 'life', target: `film:${target}` }, ++tick);
  const frames = (seconds: number, focus = false, running = true) => { for (let i = 0; i < Math.round(seconds / .05); i++) {
    players.receiveInput('player', { x: 0, z: 0, yaw: neo.rotation, jump: false, sprint: false, sequence: ++sequence, focus });
    players.step(.05, running, tick); if (running && i % 10 === 0) sandbox.tick(++tick);
  } };
  command('retry');
  const board = () => { command('act'); frames(15); };
  const state = () => sandbox.life.film.state!;
  const poses = () => ['neo', 'trinity', 'switch', 'apoc'].map(id => {
    const a = world.agents.get(id)!;
    return { position: { ...a.position }, rotation: a.rotation, gesture: structuredClone(a.currentAction?.parameters.meeting) };
  });
  const walkTo = (x: number, z: number) => {
    for (let i = 0; i < 300; i++) {
      const dx = x - neo.position.x; const dz = z - neo.position.z; const length = Math.hypot(dx, dz);
      if (length < .5) return true;
      players.receiveInput('player', { x: dx / length, z: dz / length, yaw: Math.atan2(dx, dz), jump: false, sprint: false, sequence: ++sequence });
      players.step(.05, true, tick); if (i % 10 === 0) sandbox.tick(++tick);
    }
    return false;
  };
  return { world, sandbox, players, neo, command, frames, board, state, poses, walkTo, tick: () => tick };
}

test('boarding uses one car and waits for an explicit decision; accepting keeps all four seats continuous', () => {
  const h = setup(); h.board();
  assert.equal(h.state().meeting?.phase, 'choice');
  h.frames(20); assert.equal(h.state().scene, 'm1_bridge'); assert.equal(h.state().step, 1);
  h.command('next'); assert.equal(h.state().scene, 'm1_bridge');
  const before = h.poses(); assert.ok(before.every(p => p.gesture));
  h.command('meeting:stay');
  assert.equal(h.state().scene, 'm1_bug');
  assert.deepEqual(h.poses().map(p => p.position), before.map(p => p.position));
  assert.deepEqual(FILM_SETS.film_adams_bridge.center, FILM_SETS.film_extraction_car.center);
});

test('after boarding Apoc rolls away from the bridge and stops before Neo can choose', () => {
  const h = setup(); h.command('act'); h.frames(8.1);
  assert.equal(h.state().meeting?.phase, 'rolling');
  const start = { ...h.neo.position }; h.frames(3);
  assert.ok(Math.hypot(h.neo.position.x - start.x, h.neo.position.z - start.z) > 8,
    'the whole cast must travel inside the same car before Switch orders a stop');
  assert.equal(h.state().meeting?.phase, 'rolling');
  h.command('meeting:stay'); assert.equal(h.state().scene, 'm1_bridge', 'the decision is unavailable while the car moves');
  h.frames(3.1); assert.equal(h.state().meeting?.phase, 'choice');
  assert.ok(meetingCarPose(h.state().meeting).speed < .01, 'the car physically stops for Neo to open the door');
});

test('the moving stop and its new door location survive pause, reload and reboarding', () => {
  const h = setup(); h.command('act'); h.frames(10);
  const before = h.poses(); const saved = JSON.parse(JSON.stringify(h.sandbox.state));
  const roadTime = h.state().meeting!.roadTime!;
  h.frames(2, false, false); assert.equal(h.state().meeting?.roadTime, roadTime);
  h.players.release('player', h.tick()); h.frames(2); assert.deepEqual(h.poses(), before);
  h.sandbox.restore(saved); h.players.possess('player', 'neo', h.tick()); h.command('retry');
  assert.deepEqual(h.poses(), before);
  h.frames(5); assert.equal(h.state().meeting?.phase, 'choice');
  h.command('meeting:leave'); h.frames(2); h.command('meeting:depart'); h.frames(9);
  const door = meetingBoardPoint(h.state().bridgeArrival);
  assert.ok(Math.hypot(h.neo.position.x - filmPosition('film_adams_bridge', door.x, door.z).x,
    h.neo.position.z - filmPosition('film_adams_bridge', door.x, door.z).z) < 4);
  const car = h.sandbox.state.structures.find(structure => structure.id === 'film:bridge:car')!;
  const savedStop = JSON.parse(JSON.stringify(h.sandbox.state));
  h.sandbox.restore(savedStop); h.players.possess('player', 'neo', h.tick()); h.command('retry');
  assert.deepEqual(h.sandbox.state.structures.find(structure => structure.id === 'film:bridge:car')!.position, car.position);
  h.command('act'); h.frames(9);
  assert.equal(h.state().meeting?.phase, 'choice', 'reboarding a stopped car does not replay the initial drive');
  assert.equal(h.state().meeting?.roadTime, 3);
});

test('a legacy in-car save without roadTime retains its original route clock', () => {
  const h = setup(false); h.board(); h.command('meeting:stay'); h.frames(9);
  h.command('reflect:trust'); h.command('next'); h.frames(4);
  const encounter = h.state().meeting!;
  encounter.phase = 'driving'; encounter.elapsed = 14; delete encounter.roadTime;
  const saved = JSON.parse(JSON.stringify(h.sandbox.state));
  h.sandbox.restore(saved); h.command('retry'); h.frames(.05);
  assert.equal(h.state().meeting?.roadTime, undefined);
  const car = meetingCarPose(h.state().meeting);
  assert.ok(Math.abs(car.distance - meetingDrive(h.state().meeting!.elapsed).distance) < .001);
});

test('the car resumes during the scan and keeps its road progress through the later journey', () => {
  const h = setup(); h.command('act'); h.frames(15);
  assert.equal(h.state().meeting?.phase, 'choice');
  h.command('meeting:stay'); const stopped = { ...h.neo.position };
  h.frames(5);
  assert.ok(Math.hypot(h.neo.position.x - stopped.x, h.neo.position.z - stopped.z) > 8,
    'the examination must take place in a moving car');
  const scannedRoadTime = h.state().meeting?.roadTime ?? 0;
  h.frames(5); assert.equal(h.state().meeting?.phase, 'located');
  h.frames(12, true); assert.equal(h.state().meeting?.phase, 'done');
  assert.equal(h.state().step, 1);
  h.command('reflect:trust'); h.command('next');
  assert.equal(h.state().meeting?.phase, 'driving');
  assert.ok((h.state().meeting?.roadTime ?? 0) > scannedRoadTime, 'the drive cannot restart at the bridge after extraction');
  const before = { ...h.neo.position }; const beforeRoadTime = h.state().meeting!.roadTime!; h.frames(.5);
  const distance = Math.hypot(h.neo.position.x - before.x, h.neo.position.z - before.z);
  const roadDistance = meetingDrive(h.state().meeting!.roadTime!).distance - meetingDrive(beforeRoadTime).distance;
  assert.ok(distance > 0 && distance <= roadDistance + 1, 'the route remains spatially continuous');
});

test('a positive scan requires holding still and only clears the tracker after physical extraction', () => {
  const h = setup(); h.board(); h.command('meeting:stay'); h.frames(10);
  assert.equal(h.state().meeting?.phase, 'located'); assert.equal(h.state().office?.bugged, true);
  h.frames(20); assert.equal(h.state().meeting?.phase, 'located'); assert.equal(h.state().step, 0);
  h.frames(2, true); const elapsed = h.state().meeting!.elapsed;
  h.frames(3); assert.equal(h.state().meeting!.elapsed, elapsed); assert.equal(h.state().office?.bugged, true);
  h.frames(12, true); assert.equal(h.state().office?.bugged, false); assert.equal(h.state().step, 1);
  assert.equal(h.state().meeting?.phase, 'done');
  h.command('reflect:trust'); h.command('next');
  assert.equal(h.state().meeting?.phase, 'driving');
  h.frames(80); h.command('act'); h.frames(9);
  const goal = filmStepPosition(FILM_SCENE_BY_ID.m1_bug, FILM_SCENE_BY_ID.m1_bug.steps[2]);
  assert.ok(h.walkTo(goal.x, goal.z)); h.command('act');
  assert.equal(h.state().scene, 'm1_pills'); assert.equal(h.neo.currentAction?.parameters.meeting, undefined);
});

test('successful office escape produces a negative scan without inventing a parasite or requiring extraction', () => {
  const h = setup(false); h.board(); h.command('meeting:stay'); h.frames(10);
  assert.equal(h.state().meeting?.bugged, false); assert.equal(h.state().meeting?.phase, 'done');
  assert.equal(h.state().step, 1); assert.equal(h.state().office?.bugged, false);
  assert.match(h.state().lastText, /没有发现/);
});

test('leaving the car returns control outside and permits reentry without erasing the implanted tracker', () => {
  const h = setup(); h.board(); const parked = { ...h.neo.position }; h.command('meeting:leave');
  assert.equal(h.state().meeting?.phase, 'hesitating'); h.frames(2);
  assert.ok(meetingPose({ ...h.state().meeting!, role: 'neo' }).door > .95);
  h.command('meeting:depart'); h.frames(9);
  assert.equal(h.state().meeting, undefined); assert.equal(h.state().step, 1); assert.equal(h.state().scene, 'm1_bridge');
  assert.ok(Math.hypot(h.neo.position.x - parked.x, h.neo.position.z - parked.z) < 5);
  assert.equal(h.state().office?.bugged, true);
  assert.equal(h.state().bridgeArrival?.parkedRoadTime, 3);
  h.board(); assert.equal(h.state().meeting?.phase, 'choice');
});

test('Neo can open the car door, hear Trinity, then close it before consenting to the scan', () => {
  const h = setup(); h.board(); const seated = { ...h.neo.position };
  h.command('meeting:leave'); h.command('meeting:stay');
  assert.equal(h.state().meeting?.phase, 'hesitating', 'Neo must first see the street and hear Trinity before deciding');
  h.frames(2);
  assert.equal(h.state().scene, 'm1_bridge'); assert.equal(h.state().meeting?.phase, 'hesitating');
  assert.deepEqual(h.neo.position, seated); assert.match(h.state().lastText, /Trinity|TRINITY/);
  h.command('meeting:stay'); assert.equal(h.state().meeting?.phase, 'reconsidering');
  h.frames(1); assert.ok(meetingPose({ ...h.state().meeting!, role: 'neo' }).door < .95);
  h.frames(2); assert.equal(h.state().scene, 'm1_bug'); assert.equal(h.state().meeting?.phase, 'scanning');
  assert.equal(h.state().office?.bugged, true);
});

test('the open-door decision survives pause, disconnect and saved recovery without deciding for Neo', () => {
  const h = setup(); h.board(); h.command('meeting:leave'); h.frames(1.1);
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)); const before = h.poses();
  const elapsed = h.state().meeting!.elapsed;
  h.frames(3, false, false); assert.equal(h.state().meeting!.elapsed, elapsed);
  h.players.release('player', h.tick()); h.frames(3);
  assert.equal(h.state().meeting!.phase, 'hesitating'); assert.equal(h.state().meeting!.elapsed, elapsed);
  h.sandbox.restore(saved); h.players.possess('player', 'neo', h.tick()); h.command('retry');
  assert.deepEqual(h.poses(), before); assert.equal(h.state().meeting!.elapsed, elapsed);
  h.frames(2); assert.equal(h.state().meeting?.phase, 'hesitating');
  h.command('meeting:stay'); h.frames(2.1);
  assert.equal(h.state().meeting?.phase, 'scanning'); assert.equal(h.state().scene, 'm1_bug');
});

test('the implanted tracker draws a visible bridge tail; getting caught requires a saved retry', () => {
  const h = setup(); const bridge = FILM_SCENE_BY_ID.m1_bridge;
  h.state().step = 0; h.neo.position = filmEntry(bridge); h.state().checkpoint = { ...h.neo.position };
  h.frames(.5);
  assert.equal(h.state().bridgeTail?.phase, 'tracking');
  const tail = h.sandbox.state.threats.find(threat => threat.id === 'bridge:tail')!;
  assert.equal(tail?.scene, 'm1_bridge'); assert.equal(tail?.patrol, true);
  const first = { ...tail.position }; h.frames(3);
  assert.ok(tail.position.z < first.z, 'the pursuer must physically close from the far side of the underpass');
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)); const gap = Math.hypot(tail.position.x - h.neo.position.x, tail.position.z - h.neo.position.z);
  h.frames(3, false, false); assert.equal(h.state().bridgeTail?.alert, saved.neoLife.journey.bridgeTail.alert);
  h.players.release('player', h.tick()); h.frames(4); assert.deepEqual(tail.position, saved.threats.find((threat: { id: string }) => threat.id === 'bridge:tail').position);
  h.sandbox.restore(saved); h.players.possess('player', 'neo', h.tick()); h.frames(.5);
  const resumed = h.sandbox.state.threats.find(threat => threat.id === 'bridge:tail')!;
  assert.ok(Math.hypot(resumed.position.x - h.neo.position.x, resumed.position.z - h.neo.position.z) >= gap - 2,
    'rejoining cannot skip the pursuer forward across the disconnected interval');
  h.frames(12); assert.equal(h.state().bridgeTail?.phase, 'failed');
  assert.match(h.command('act'), /重试/); assert.equal(h.state().meeting, undefined);
  h.command('retry'); assert.equal(h.state().bridgeTail?.phase, 'tracking'); assert.equal(h.state().bridgeTail?.attempts, 1);
  assert.deepEqual(h.neo.position, filmEntry(bridge));
  assert.ok(h.walkTo(filmStepPosition(bridge, bridge.steps[0]).x, filmStepPosition(bridge, bridge.steps[0]).z));
  h.command('act'); assert.equal(h.state().meeting?.phase, 'boarding');
  assert.equal(h.sandbox.state.threats.some(threat => threat.id === 'bridge:tail'), false);
});

test('a clean office escape has no bridge tail, even if Neo lingers', () => {
  const h = setup(false); h.state().step = 0; h.neo.position = filmEntry(FILM_SCENE_BY_ID.m1_bridge);
  h.frames(25); assert.equal(h.state().bridgeTail, undefined);
  assert.equal(h.sandbox.state.threats.some(threat => threat.id === 'bridge:tail'), false);
});

test('the bridge car approaches with its passengers and waits for a physical stop before boarding', () => {
  const h = setup(false); h.state().step = 0; h.neo.position = filmEntry(FILM_SCENE_BY_ID.m1_bridge);
  h.state().bridgeArrival = { phase: 'approaching', elapsed: 0 };
  const trinity = h.world.agents.get('trinity')!;
  h.frames(.05);
  assert.ok(h.state().bridgeArrival!.elapsed <= .1, 'the car must move on the player frame clock, not jump half a second per story tick');
  assert.equal(playerBlocked(filmPosition('film_adams_bridge', 0, -14), true, 1.1, h.sandbox.state.structures), false);
  assert.equal(playerBlocked(h.sandbox.state.structures.find(structure => structure.id === 'film:bridge:car')!.position,
    true, 1.1, h.sandbox.state.structures), true);
  h.frames(.5);
  const start = { ...trinity.position };
  h.frames(2);
  assert.ok(h.state().bridgeArrival!.elapsed > 1);
  assert.ok(trinity.position.z < start.z);
  h.state().step = 1;
  h.neo.position = filmStepPosition(FILM_SCENE_BY_ID.m1_bridge, FILM_SCENE_BY_ID.m1_bridge.steps[1]);
  assert.match(h.command('act'), /停稳/);
  assert.equal(h.state().meeting, undefined);
});

test('the approaching car keeps its exact position through pause, disconnect and saved recovery', () => {
  const h = setup(false); h.state().bridgeArrival = { phase: 'approaching', elapsed: 0 };
  h.frames(2);
  const elapsed = h.state().bridgeArrival!.elapsed;
  const car = structuredClone(h.sandbox.state.structures.find(structure => structure.id === 'film:bridge:car')!.position);
  const trinity = { ...h.world.agents.get('trinity')!.position };
  h.frames(3, false, false); assert.equal(h.state().bridgeArrival!.elapsed, elapsed);
  h.players.release('player', h.tick()); h.frames(3);
  assert.equal(h.state().bridgeArrival!.elapsed, elapsed);
  assert.deepEqual(h.sandbox.state.structures.find(structure => structure.id === 'film:bridge:car')!.position, car);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); h.players.possess('player', 'neo', h.tick());
  assert.deepEqual(h.world.agents.get('trinity')!.position, trinity);
  h.frames(.05);
  assert.ok(h.state().bridgeArrival!.elapsed > elapsed && h.state().bridgeArrival!.elapsed < elapsed + .1);
  h.frames(6); assert.equal(h.state().bridgeArrival!.phase, 'parked');
  assert.equal(h.sandbox.state.structures.find(structure => structure.id === 'film:bridge:car')?.position.z,
    filmPosition('film_adams_bridge', 0, -14).z);
});

test('older captured saves without a bugged flag still face the bridge tail', () => {
  const h = setup(); delete h.state().office!.bugged;
  h.frames(.5);
  assert.equal(h.state().bridgeTail?.phase, 'tracking');
  assert.equal(h.sandbox.state.threats.some(threat => threat.id === 'bridge:tail'), true);
});

test('losing the pursuer does not remove the implanted tracker', () => {
  const h = setup(); h.frames(.5);
  h.sandbox.state.threats = h.sandbox.state.threats.filter(threat => threat.id !== 'bridge:tail');
  h.frames(.5); assert.equal(h.state().bridgeTail?.phase, 'evaded');
  h.command('act'); assert.equal(h.state().meeting?.bugged, true);
});

test('door, passengers and pump retain the same clock across pause, disconnect, save restore and retry', () => {
  const h = setup(); h.board(); h.command('meeting:stay'); h.frames(10); h.frames(2.4, true);
  const before = h.poses(); const saved = structuredClone(h.state().meeting);
  h.frames(3, true, false); assert.deepEqual(h.poses(), before);
  h.players.release('player', h.tick()); h.frames(3); assert.deepEqual(h.poses(), before);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); h.players.possess('player', 'neo', h.tick());
  h.command('retry'); assert.deepEqual(h.state().meeting, saved); assert.deepEqual(h.poses(), before);
  h.frames(12, true); assert.equal(h.state().step, 1);
});

test('occupied passengers and remote actions cannot start boarding; passengers are reserved during the encounter', () => {
  const h = setup(); const outside = { ...h.neo.position };
  h.neo.position.x += 20; h.command('act'); assert.equal(h.state().meeting, undefined);
  h.neo.position = outside; h.players.possess('other', 'trinity', h.tick());
  assert.match(h.command('act'), /另一位玩家/); assert.equal(h.state().meeting, undefined);
  h.players.release('other', h.tick()); h.board();
  for (const id of ['trinity', 'switch', 'apoc']) assert.match(h.players.possess('other', id, h.tick()).error!, /接头/);
  assert.match(h.players.act('player', 'attack', h.tick()), /演出/);
});

test('leaving the bridge is a moving four-person journey and cannot skip straight into the pill room', () => {
  const h = setup(false); h.board(); h.command('meeting:stay'); h.frames(10); h.command('reflect:trust');
  const before = h.poses(); h.command('next');
  assert.equal(h.state().scene, 'm1_bug'); assert.equal(h.state().meeting?.phase, 'driving');
  assert.deepEqual(h.poses().map(p => p.position), before.map(p => p.position));
  h.frames(3); const moved = h.poses();
  assert.ok(Math.hypot(moved[0].position.x - before[0].position.x, moved[0].position.z - before[0].position.z) > 5);
  const separation = (a: typeof moved[0], b: typeof moved[0]) => Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z);
  assert.ok(Math.abs(separation(moved[0], moved[1]) - separation(before[0], before[1])) < .001);
  h.command('act'); h.command('next'); assert.equal(h.state().scene, 'm1_bug');
  assert.match(h.players.possess('other', 'apoc', h.tick()).error!, /接头/);
});

test('travel survives pause, disconnect and retry without returning the car or passengers to the bridge', () => {
  const h = setup(false); h.board(); h.command('meeting:stay'); h.frames(10); h.command('reflect:trust'); h.command('next'); h.frames(23);
  const before = h.poses(); const saved = structuredClone(h.state().meeting);
  assert.equal(saved?.phase, 'driving');
  h.frames(3, false, false); assert.deepEqual(h.poses(), before);
  h.players.release('player', h.tick()); h.frames(3); assert.deepEqual(h.poses(), before);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); h.players.possess('player', 'neo', h.tick()); h.command('retry');
  assert.deepEqual(h.state().meeting, saved); assert.deepEqual(h.poses(), before);
  h.frames(1); assert.notDeepEqual(h.neo.position, before[0].position);
});

test('arrival waits for the player to get out, then requires walking to the hotel entrance', () => {
  const h = setup(false); h.board(); h.command('meeting:stay'); h.frames(10); h.command('reflect:trust'); h.command('next'); h.frames(80);
  assert.equal(h.state().meeting?.phase, 'parked'); assert.equal(h.state().scene, 'm1_bug');
  const parked = { ...h.neo.position }; h.frames(10); assert.deepEqual(h.neo.position, parked);
  h.command('act'); h.frames(9); assert.equal(h.state().meeting?.phase, 'outside');
  assert.equal(h.neo.currentAction?.parameters.meeting, undefined);
  h.command('act'); h.command('next'); assert.equal(h.state().scene, 'm1_bug', 'cannot enter from the curb');
  const goal = filmStepPosition(FILM_SCENE_BY_ID.m1_bug, FILM_SCENE_BY_ID.m1_bug.steps[2]);
  assert.ok(h.walkTo(goal.x, goal.z), 'the sidewalk route must be physically walkable');
  const trinity = { ...h.world.agents.get('trinity')!.position }; const entrance = { ...h.neo.position };
  h.command('act');
  assert.equal(h.state().scene, 'm1_pills'); assert.equal(h.state().office?.bugged, false);
  assert.equal(h.state().meeting, undefined);
  assert.deepEqual(h.neo.position, entrance, 'entering the hotel cannot move Neo to the chair');
  assert.deepEqual(h.world.agents.get('trinity')!.position, trinity, 'Trinity begins walking where she got out of the car');
});

test('the route uses continuous speed and heading and stays inside its streamed street', () => {
  let before = meetingDrive(0);
  assert.equal(before.speed, 0);
  for (let seconds = .05; seconds <= MEETING_DRIVE_SECONDS; seconds += .05) {
    const car = meetingDrive(seconds);
    assert.ok(Math.hypot(car.x - before.x, car.z - before.z) < 1.5, 'no hidden scene teleport');
    assert.ok(Math.abs(car.speed - before.speed) < .7, 'no discontinuous acceleration at corners');
    assert.ok(Math.abs(Math.atan2(Math.sin(car.yaw - before.yaw), Math.cos(car.yaw - before.yaw))) < .04, 'no snap turn');
    assert.ok(meetingRoadContains(car.x, car.z, 3));
    assert.equal(filmSetAt(filmPosition('film_extraction_car', car.x, car.z), true)?.id, 'film_extraction_car');
    before = car;
  }
  const end = meetingDrive(MEETING_DRIVE_SECONDS); assert.ok(end.speed < .0001);
  assert.equal(FILM_SETS.film_lafayette.center.x - FILM_SETS.film_adams_bridge.center.x, MEETING_DESTINATION.x);
  assert.ok(MEETING_DESTINATION.z > FILM_SETS.film_lafayette.depth / 2);
});
