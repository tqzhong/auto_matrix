import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SETS, lifeRoomCenter, insideLifeRoom, groundHeight, playerBlocked, filmSetAt } from '@auto_matrix/shared';
import { OFFICE_PATROLS, officeOccluded, metacortexPosition, metacortexLiftPose, type Vector3, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';

function setup() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const sandbox = new SandboxSystem(world, { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics, 42);
  const players = new PlayerController(world, { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine, {} as ActionExecutor, {} as WorldDynamics, sandbox);
  players.possess('commuter', 'neo', 0); const neo = players.getAgent('commuter')!; sandbox.life.begin(neo, 0);
  let tick = 0; let sequence = 0;
  const frames = (seconds: number, running = true) => { for (let i = 0; i < seconds * 20; i++) { players.step(.05, running, ++tick); if (running) sandbox.tick(tick); } };
  const command = (target: string) => players.sandboxAction('commuter', { kind: 'life', target }, ++tick);
  const walk = (target: Vector3) => {
    for (let i = 0; i < 1800; i++) {
      const dx = target.x - neo.position.x, dz = target.z - neo.position.z; const gap = Math.hypot(dx, dz);
      if (gap < .2 && Math.abs(neo.position.y - target.y) < .2) {
        players.receiveInput('commuter', { x: 0, z: 0, yaw: neo.rotation, jump: false, sprint: false, sequence: ++sequence }); frames(.3); return;
      }
      players.receiveInput('commuter', { x: dx / Math.max(.4, gap), z: dz / Math.max(.4, gap), yaw: Math.atan2(dx, dz), jump: false, sprint: false, sequence: ++sequence }); frames(.05);
    }
    assert.fail(`blocked at ${JSON.stringify(neo.position)} on the way to ${JSON.stringify(target)}`);
  };
  return { world, sandbox, players, neo, frames, command, walk };
}

test('the daily company lobby and cinematic office occupy one city building on distinct floors', () => {
  const lobby = lifeRoomCenter('metacortex_office')!;
  const office = FILM_SETS.film_metacortex_floor.center;
  assert.equal(office.x, lobby.x);
  assert.equal(office.z, lobby.z);
  assert.equal(office.y - lobby.y, 65);
  assert.equal(filmSetAt(lobby, true), undefined, 'the lobby must not load the upper floor or snap the player upward');
  assert.equal(groundHeight(lobby, true), 1);
  assert.equal(groundHeight(office, true), office.y);
  assert.equal(insideLifeRoom(office), 'metacortex_office', 'weather and daily-life rules recognize the inhabited upper floor');
  assert.equal(insideLifeRoom({ ...metacortexPosition(0, -29), y: 33.5 }), 'metacortex_office', 'a passenger in the lift is sheltered throughout the ride');
  assert.equal(playerBlocked(lobby, true), false);
  assert.equal(playerBlocked(office, true), false);
  assert.equal(filmSetAt({ x: lobby.x - 35, y: 1, z: lobby.z }, true), undefined, 'the sidewalk is not the high ledge');
});

test('commuting preserves the city walk, rides upward continuously, survives pause and reload, and enters the boss scene on foot', () => {
  const h = setup(); const life = h.sandbox.life.state!;
  h.neo.position = { x: 1210, y: 1, z: 713 };
  life.journey = { version: 1, scene: 'm1_morning', actor: 'neo', step: 3, completed: ['m1_morning'], reflections: {}, enteredAt: 0,
    lastText: '', checkpoint: { ...h.neo.position }, morning: { phase: 'done', elapsed: 0 } };
  const position = { ...h.neo.position }, money = life.money;
  h.command('film:next'); assert.equal(life.journey.scene, 'm1_commute'); assert.deepEqual(h.neo.position, position);
  for (const [x, z] of [[1210, 720], [1200, 720], [1200, 880], [1140, 880], [1140, 851]]) h.walk({ x, y: 1, z });
  assert.equal(life.journey.step, 1); assert.equal(life.money, money);
  assert.match(h.command('film:act'), /电梯前/);
  h.walk(metacortexPosition(0, -22)); assert.match(h.command('film:act'), /走进/);
  h.walk(metacortexPosition(0, -29)); h.command('film:act'); h.frames(4);
  assert.equal(life.lift!.phase, 'travel'); assert.ok(h.neo.position.y > 5 && h.neo.position.y < 60);
  assert.match(h.command('film:act'), /正在运行/, 'repeated interaction explains the ongoing ride');
  const snapshot = structuredClone(life.lift), paused = { ...h.neo.position };
  h.frames(5, false); assert.deepEqual(life.lift, snapshot); assert.deepEqual(h.neo.position, paused);
  h.players.release('commuter', 1); h.frames(5); assert.deepEqual(life.lift, snapshot);
  h.sandbox.restore(structuredClone(h.sandbox.state)); h.players.possess('commuter', 'neo', 1);
  h.command('film:retry'); h.frames(10);
  const restored = h.sandbox.life.state!;
  assert.equal(h.neo.position.y, 66); assert.equal(restored.lift!.phase, 'idle'); assert.equal(restored.journey!.step, 2);
  assert.match(h.command('lift'), /走出电梯/); assert.equal(restored.lift!.phase, 'idle', 'commuting cannot turn around before entering the office');
  assert.equal(restored.money, money); h.walk(metacortexPosition(0, -20, 1));
  assert.ok(restored.journey!.completed.includes('m1_commute'));
  const arrival = { ...h.neo.position }; h.command('film:next'); assert.equal(restored.journey!.scene, 'm1_boss'); assert.deepEqual(h.neo.position, arrival);
});

test('ordinary work takes place upstairs and the same lift returns Neo to the street', () => {
  const h = setup(); h.neo.position = metacortexPosition(0, 24); h.world.timeOfDay = 9000;
  assert.match(h.command('work'), /先到/);
  h.walk(metacortexPosition(0, -29)); h.command('lift'); h.frames(13); assert.equal(h.neo.position.y, 66);
  for (const [x, z] of [[0, 20], [8, 20], [8, 11], [14, 11], [14, 6.7]]) h.walk(metacortexPosition(x, z, 1));
  const money = h.sandbox.life.state!.money; assert.match(h.command('work'), /完成今天/); h.frames(1);
  assert.equal(h.sandbox.life.state!.money, money + 95);
  for (const [x, z] of [[14, 11], [8, 11], [8, 20], [0, 20], [0, -29]]) h.walk(metacortexPosition(x, z, 1));
  h.command('lift'); h.frames(13); assert.equal(h.neo.position.y, 1);
  h.walk(metacortexPosition(0, 40)); assert.equal(groundHeight(h.neo.position, true), 1);
});

test('landing doors seal the absent car, call it back, and do not charge or let travel interrupt a ride', () => {
  const h = setup(); h.neo.position = metacortexPosition(0, -29); h.command('lift'); h.frames(5);
  assert.match(h.command('go:neo_apartment'), /电梯正在运行/);
  assert.equal(playerBlocked(metacortexPosition(0, -25.8), true, 1.1, h.sandbox.state.structures), true);
  h.frames(9); h.neo.position = metacortexPosition(0, -22);
  assert.match(h.command('lift'), /呼叫/); h.frames(5);
  assert.equal(h.neo.position.y, 1, 'an empty returning car does not drag the waiting caller');
  h.frames(9); assert.equal(h.sandbox.life.state!.lift!.floor, 0);
  assert.equal(playerBlocked(metacortexPosition(0, -25.8), true, 1.1, h.sandbox.state.structures), false);
  assert.equal(playerBlocked(metacortexPosition(0, -25.8, 1), true, 1.1, h.sandbox.state.structures), true);
  assert.deepEqual(metacortexLiftPose(h.sandbox.life.state!.lift), { height: 0, door: 1 });
});

test('office patrols enter in front of the lift without spawning inside its walls or a closed landing door', () => {
  const h = setup(); h.frames(.1);
  const eye = (x: number, z: number) => ({ ...metacortexPosition(x, z, 1), y: 68.9 });
  assert.equal(officeOccluded(eye(5, -29), eye(0, -29), FILM_SETS.film_metacortex_floor.center), true, 'guards cannot see through the lift shaft');
  assert.equal(officeOccluded(eye(0, -23), eye(0, -20), FILM_SETS.film_metacortex_floor.center), false);
  for (const [i, route] of OFFICE_PATROLS.entries()) for (const point of route) {
    assert.equal(playerBlocked(metacortexPosition(point.x, point.z, 1), true, 1.1, h.sandbox.state.structures), false, `patrol ${i} at ${point.x},${point.z}`);
  }
});

test('legacy office saves move the office, patrol search, and checkpoint once without resetting pursuit', () => {
  const h = setup(); const life = h.sandbox.life.state!;
  h.neo.position = { x: 5704, y: 1, z: 4116 }; h.neo.currentLocation = 'film_metacortex_floor';
  life.journey = { version: 1, scene: 'm1_office_escape', actor: 'neo', step: 1, completed: [], enteredAt: 0, reflections: {}, lastText: '', checkpoint: { ...h.neo.position },
    office: { alert: 31, waypoints: [0], suspicion: [31], lastTick: 0, guide: '', searches: [{ position: { ...h.neo.position }, remaining: 5, source: 'sight' }] } };
  h.sandbox.state.threats.push(...[0, 1].map(i => ({ id: `office:${i}`, scene: 'm1_office_escape', kind: 'agent' as const, patrol: true,
    position: { x: 5696 + (i ? 3 : 0), y: 1, z: 4096 + (i ? -28 : -10) }, matrix: true,
    health: 80, maxHealth: 100, target: 'neo', stunUntil: 0, lastStrike: -10 })));
  h.sandbox.restore(structuredClone(h.sandbox.state)); const position = metacortexPosition(8, 20, 1);
  assert.deepEqual(h.neo.position, position); assert.deepEqual(h.sandbox.life.film.state!.checkpoint, position);
  assert.deepEqual(h.sandbox.life.film.state!.office!.searches![0]!.position, position);
  assert.deepEqual(h.sandbox.state.threats.find(t => t.id === 'office:0')!.position, metacortexPosition(0, -10, 1), 'unblocked patrol progress survives');
  const moved = h.sandbox.state.threats.find(t => t.id === 'office:1')!;
  assert.equal(playerBlocked(moved.position, true, 1.1, h.sandbox.state.structures), false, 'legacy patrols must not remain trapped in the new shaft');
  assert.equal(moved.health, 80);
  h.sandbox.restore(structuredClone(h.sandbox.state)); assert.deepEqual(h.neo.position, position); assert.equal(h.sandbox.life.film.state!.office!.alert, 31);
});

test('an old workday saved in the former ground-floor room resumes upstairs without losing its activity or salary', () => {
  const h = setup(); const life = h.sandbox.life.state!;
  h.neo.position = { x: 1140, y: 1, z: 847 }; h.neo.currentLocation = 'metacortex_office'; h.world.timeOfDay = 9000;
  life.activity = { id: 'work', position: { ...h.neo.position }, startedAt: 0, endsAt: 10 };
  const money = life.money; h.sandbox.restore(structuredClone(h.sandbox.state));
  const restored = h.sandbox.life.state!;
  assert.deepEqual(h.neo.position, metacortexPosition(14, 6.7, 1));
  assert.deepEqual(restored.activity!.position, h.neo.position); assert.equal(restored.activity!.endsAt, 10);
  assert.equal(restored.lift!.floor, 1); h.frames(1); assert.equal(restored.money, money + 95);
  h.sandbox.restore(structuredClone(h.sandbox.state)); h.frames(1); assert.equal(h.sandbox.life.state!.money, money + 95);
});
