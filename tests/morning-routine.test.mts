import assert from 'node:assert/strict';
import test from 'node:test';
import { APARTMENT, CLUB, FILM_SCENE_BY_ID, filmPosition, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';

function setup() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const players = new PlayerController(world, { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine,
    { execute() {} } as unknown as ActionExecutor, dynamics, sandbox);
  players.possess('morning-player', 'neo', 0); const neo = players.getAgent('morning-player')!;
  sandbox.life.begin(neo, 0); sandbox.life.state!.chapter = 1; sandbox.life.state!.contactSignal = true;
  let tick = 0; let sequence = 0;
  const command = (target: string) => players.sandboxAction('morning-player', { kind: 'life', target: `film:${target}` }, ++tick);
  const frames = (seconds: number, running = true) => { for (let i = 0; i < seconds * 20; i++) { players.step(.05, running, ++tick); if (running) sandbox.tick(tick); } };
  const walk = (x: number, z: number) => {
    const target = filmPosition('film_anderson_flat', x, z);
    for (let i = 0; i < 1000; i++) {
      const dx = target.x - neo.position.x; const dz = target.z - neo.position.z; const distance = Math.hypot(dx, dz);
      if (distance < .2) { players.receiveInput('morning-player', { x: 0, z: 0, yaw: neo.rotation, jump: false, sprint: false, sequence: ++sequence }); frames(.3); return; }
      players.receiveInput('morning-player', { x: dx / distance, z: dz / distance, yaw: Math.atan2(dx, dz), jump: false, sprint: false, sequence: ++sequence }); frames(.05);
    }
    assert.fail(`could not walk to ${x}, ${z}`);
  };
  command('continue');
  let state = sandbox.life.film.state!; state.step = FILM_SCENE_BY_ID.m1_wake_up.steps.length; state.completed.push('m1_wake_up'); command('next');
  state = sandbox.life.film.state!; state.step = FILM_SCENE_BY_ID.m1_club.steps.length; state.completed.push('m1_club');
  state.club = { phase: 'done', elapsed: 0 }; neo.position = filmPosition('film_white_rabbit_club', CLUB.exit.x, CLUB.exit.z);
  return { world, sandbox, players, neo, command, frames, walk, state: () => sandbox.life.film.state! };
}

test('following the rabbit reaches the club at night, then returns to the same home before the office', () => {
  const h = setup(); assert.ok(h.world.timeOfDay >= 20000 && h.world.timeOfDay < 24000);
  const day = h.world.day; h.command('next');
  assert.equal(h.state().scene, 'm1_morning'); assert.equal(h.world.day, day);
  assert.equal(h.neo.currentLocation, 'film_anderson_flat');
  assert.ok(h.world.timeOfDay >= 20000);
  h.frames(30); assert.equal(h.state().morning?.phase, 'home'); assert.equal(h.world.day, day, 'the player chooses when to rest');
  assert.match(h.command('next'), /先完成/);
});

test('bedtime, a saved ringing alarm and deliberate rising lead to a walkable morning commute', () => {
  const h = setup(); h.command('next'); assert.equal(h.state().scene, 'm1_morning');
  assert.match(h.command('act'), /床边/);
  h.walk(APARTMENT.bedside.x, APARTMENT.bedside.z); h.command('act'); h.frames(1);
  const before = structuredClone(h.state().morning); const date = h.world.day; const time = h.world.timeOfDay;
  h.frames(10, false); assert.deepEqual(h.state().morning, before); assert.equal(h.world.timeOfDay, time);
  h.players.release('morning-player', 1); h.frames(10); assert.deepEqual(h.state().morning, before);
  h.sandbox.restore(structuredClone(h.sandbox.state)); h.players.possess('morning-player', 'neo', 1); h.frames(8);
  assert.equal(h.state().morning?.phase, 'alarm'); assert.equal(h.world.day, date + 1); assert.equal(h.world.timeOfDay, 9250);
  assert.equal(h.sandbox.life.state!.day, date + 1); assert.equal(h.sandbox.life.state!.energy, 95);
  const cash = h.sandbox.life.state!.money; h.sandbox.restore(structuredClone(h.sandbox.state));
  h.command('retry'); h.frames(10);
  assert.equal(h.world.day, date + 1); assert.equal(h.world.timeOfDay, 9250); assert.equal(h.state().morning?.phase, 'alarm');
  h.command('act'); h.frames(7); assert.equal(h.state().morning?.phase, 'ready');
  h.walk(0, 2); h.walk(0, 23);
  h.command('act'); assert.ok(h.state().completed.includes('m1_morning'));
  const departure = { ...h.neo.position }; h.command('next'); assert.equal(h.state().scene, 'm1_commute'); assert.equal(h.world.timeOfDay, 9250);
  assert.deepEqual(h.neo.position, departure);
  assert.equal(h.sandbox.life.state!.money, cash);
  h.sandbox.restore(structuredClone(h.sandbox.state)); h.command('retry');
  assert.equal(h.sandbox.life.state!.money, cash, 'a restored commute must not charge a fare');
});

test('sleeping after midnight advances to this morning rather than skipping an extra day', () => {
  const h = setup(); h.world.day = 5; h.world.timeOfDay = 1000; h.command('next');
  assert.equal(h.state().scene, 'm1_morning'); h.walk(APARTMENT.bedside.x, APARTMENT.bedside.z); h.command('act'); h.frames(8);
  assert.equal(h.state().morning?.phase, 'alarm'); assert.equal(h.world.day, 5); assert.equal(h.world.timeOfDay, 9250);
});

test('postponing first contact retains ordinary attendance consequences exactly once per day', () => {
  const h = setup(); const life = h.sandbox.life.state!; delete life.journey;
  const career = life.career; h.world.timeOfDay = 19000; h.sandbox.tick(100); h.sandbox.tick(101);
  assert.equal(life.career, career - 6); assert.equal(life.journal.filter(item => item.title === '今天没有去公司').length, 1);
});

test('a player without bus fare can still commute, with no negative balance or extra charge on retry', () => {
  const h = setup(); h.command('next'); h.walk(APARTMENT.bedside.x, APARTMENT.bedside.z);
  h.command('act'); h.frames(6); h.command('act'); h.frames(7);
  h.walk(0, 2); h.walk(0, 23); h.command('act');
  const life = h.sandbox.life.state!; life.money = 1; const time = h.world.timeOfDay;
  h.command('next'); assert.equal(h.state().scene, 'm1_commute'); assert.equal(life.money, 1);
  assert.equal(h.world.timeOfDay, time, 'the actual walk advances with the world clock, not a menu skip');
  h.command('retry'); assert.equal(life.money, 1);
});

test('returning after the planned alarm never rewinds a world that continued while Neo was away', () => {
  const h = setup(); h.command('next'); h.walk(APARTMENT.bedside.x, APARTMENT.bedside.z);
  h.command('act'); h.frames(2);
  h.players.release('morning-player', 1); h.world.advanceMinutes(1600);
  const date = h.world.day; const time = h.world.timeOfDay;
  h.sandbox.restore(structuredClone(h.sandbox.state)); h.players.possess('morning-player', 'neo', 1); h.frames(8);
  assert.equal(h.state().morning?.phase, 'alarm'); assert.equal(h.world.day, date); assert.equal(h.world.timeOfDay, time);
});

test('a legacy daily save already at the office chapter resumes work without replaying the previous night', () => {
  const h = setup(); const life = h.sandbox.life.state!; delete life.journey;
  life.chapter = 2; const day = h.world.day; const time = h.world.timeOfDay; const money = life.money;
  h.command('continue'); assert.equal(h.state().scene, 'm1_boss');
  assert.equal(h.world.day, day); assert.equal(h.world.timeOfDay, time); assert.equal(life.money, money);
});
