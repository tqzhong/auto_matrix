import assert from 'node:assert/strict';
import test from 'node:test';
import { APARTMENT, FILM_SCENE_BY_ID, filmStepPosition, filmPosition, lifeRoomCenter, playerBlocked, type WorldEvent } from '@auto_matrix/shared';
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
  players.possess('apartment-player', 'neo', 0); const neo = players.getAgent('apartment-player')!;
  sandbox.life.begin(neo, 0); sandbox.life.state!.chapter = 1;
  let tick = 0;
  const command = (target: string) => players.sandboxAction('apartment-player', { kind: 'life', target: `film:${target}` }, ++tick);
  command('continue');
  const near = () => { const state = sandbox.life.film.state!; neo.position = filmStepPosition(FILM_SCENE_BY_ID.m1_wake_up, FILM_SCENE_BY_ID.m1_wake_up.steps[state.step]); };
  const frames = (seconds: number, running = true) => { for (let i = 0; i < seconds * 10; i++) { players.step(.1, running, ++tick); if (running) sandbox.tick(tick); } };
  return { world, sandbox, players, neo, command, near, frames, state: () => sandbox.life.film.state! };
}

test('the computer waits for Neo to try the keyboard; time alone cannot answer or open the apartment door', () => {
  const h = setup(); h.near(); h.command('act'); h.frames(15);
  assert.equal(h.state().step, 0);
  assert.equal(h.state().contact?.phase, 'reply');
  assert.equal(h.state().started, undefined);
  h.command('act'); h.frames(5);
  assert.equal(h.state().step, 1);
  assert.equal(h.state().contact?.phase, 'door');
  h.frames(20);
  assert.equal(h.state().step, 1, 'waiting must not open the door');
  assert.match(h.command('act'), /走近/);
});

function atBook(h: ReturnType<typeof setup>) {
  h.near(); h.command('act'); h.frames(9); h.command('act'); h.frames(5);
  h.near(); h.command('act'); h.frames(3);
  assert.equal(h.state().contact?.phase, 'book');
}
function atInvitation(h: ReturnType<typeof setup>) {
  atBook(h); h.near(); h.command('act'); h.frames(4);
  h.near(); h.command('act'); h.frames(5);
  assert.equal(h.state().contact?.phase, 'invitation');
}

test('approaching the real chair stops ordinary walking while the computer target stays beside it', () => {
  const h = setup();
  assert.equal(playerBlocked(filmPosition('film_anderson_flat', -9, -8.4), true), true, 'the visible seat must be solid in ordinary walking');
  assert.equal(playerBlocked(filmPosition('film_anderson_flat', APARTMENT.computer.x, APARTMENT.computer.z), true), false);
  assert.ok(APARTMENT.computer.x < -11.1, 'the standing computer target must not be inside the chair');
  h.neo.position = filmPosition('film_anderson_flat', -9, -5.5);
  for (let i = 0; i < 40; i++) {
    h.players.receiveInput('apartment-player', { x: 0, z: -1, yaw: Math.PI, sprint: false, jump: false, sequence: i });
    h.players.step(.05, true, i);
  }
  assert.ok(h.neo.position.z >= filmPosition('film_anderson_flat', 0, -6.38).z, 'normal movement cannot pass into the chair back or seat');
});

test('Neo enters and leaves the computer chair continuously before ordinary movement resumes', () => {
  const h = setup(); h.neo.position = filmPosition('film_anderson_flat', -11.6, -8.8);
  const start = { ...h.neo.position }; h.command('act');
  assert.deepEqual(h.neo.position, start, 'reading the CRT cannot teleport from the clear standing point into the seat');
  let previous = { ...h.neo.position };
  for (let i = 0; i < 81; i++) {
    h.frames(.1);
    assert.ok(Math.hypot(h.neo.position.x - previous.x, h.neo.position.z - previous.z) < .4, 'the saved signal clock must drive a continuous entry');
    previous = { ...h.neo.position };
  }
  assert.equal(h.state().contact?.phase, 'reply'); assert.ok(Math.abs(h.neo.position.x - filmPosition('film_anderson_flat', -9).x) < .01);
  h.command('act');
  for (let i = 0; i < 40; i++) {
    h.frames(.1);
    assert.ok(Math.hypot(h.neo.position.x - previous.x, h.neo.position.z - previous.z) < .4, 'he must leave the seat before the knocking performance unlocks');
    previous = { ...h.neo.position };
  }
  assert.equal(h.state().contact?.phase, 'door');
  assert.equal(playerBlocked(h.neo.position, true, 1.1, h.sandbox.state.structures), false);
  const z = h.neo.position.z;
  for (let i = 0; i < 20; i++) {
    h.players.receiveInput('apartment-player', { x: 0, z: 1, yaw: 0, sprint: false, jump: false, sequence: i });
    h.players.step(.05, true, i);
  }
  assert.ok(h.neo.position.z > z + 1, 'the player must be able to walk to 101 after getting up');
});

test('an unfinished chair exit keeps its clock and root through pause, disconnection and save restore', () => {
  const h = setup(); h.near(); h.command('act'); h.frames(9); h.command('act'); h.frames(2.7);
  const contact = structuredClone(h.state().contact), position = { ...h.neo.position };
  h.frames(3, false); assert.deepEqual(h.state().contact, contact); assert.deepEqual(h.neo.position, position);
  h.players.release('apartment-player', 1); h.frames(3); assert.deepEqual(h.state().contact, contact);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); h.players.possess('apartment-player', 'neo', 1);
  assert.deepEqual(h.state().contact, contact); assert.deepEqual(h.neo.position, position);
  h.frames(2); assert.equal(h.state().contact?.phase, 'door');
  assert.equal(playerBlocked(h.neo.position, true, 1.1, h.sandbox.state.structures), false);
});

test('a legacy unlocked actor standing in the chair restores beside it without losing life or replaying contact', () => {
  const h = setup(); h.state().step = 1; h.state().contact = { phase: 'door', elapsed: 0 };
  h.neo.position = filmPosition('film_anderson_flat', -9, -8.8); h.neo.health = 51; h.neo.rotation = .7;
  h.state().checkpoint = { ...h.neo.position };
  const cash = h.sandbox.life.state!.money, other = structuredClone(h.world.agents.get('trinity'));
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  assert.equal(playerBlocked(h.neo.position, true, 1.1, h.sandbox.state.structures), false, 'an old standing body cannot restore trapped in the new solid chair');
  assert.equal(h.state().contact?.phase, 'door'); assert.equal(h.state().step, 1);
  assert.deepEqual(h.state().checkpoint, h.neo.position); assert.equal(h.neo.rotation, .7);
  assert.equal(h.neo.health, 51); assert.equal(h.sandbox.life.state!.money, cash); assert.deepEqual(h.world.agents.get('trinity'), other);
});

test('freeing an old chair position during an apartment revisit preserves the active story checkpoint', () => {
  const h = setup(); h.state().step = 1; h.state().contact = { phase: 'door', elapsed: 0 };
  h.state().visiting = 'm1_wake_up'; h.state().completed = ['m1_wake_up'];
  h.state().checkpoint = filmPosition('film_anderson_flat', 0, 10.2); h.state().returnPosition = { ...h.state().checkpoint };
  const checkpoint = { ...h.state().checkpoint }, returnPosition = { ...h.state().returnPosition };
  h.neo.position = filmPosition('film_anderson_flat', -9, -8.8);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  assert.equal(playerBlocked(h.neo.position, true, 1.1, h.sandbox.state.structures), false);
  assert.deepEqual(h.state().checkpoint, checkpoint); assert.deepEqual(h.state().returnPosition, returnPosition);
  assert.equal(h.state().visiting, 'm1_wake_up'); assert.equal(h.state().step, 1);
});

test('disk trade, rabbit investigation and following the invitation are separate deliberate actions', () => {
  const h = setup(); const cash = h.sandbox.life.state!.money; const items = structuredClone(h.sandbox.state.profiles.neo.inventory);
  atInvitation(h);
  assert.equal(h.sandbox.life.state!.money, cash + 2000);
  h.frames(60); assert.equal(h.state().step, 4); assert.equal(h.state().contact?.phase, 'invitation');
  assert.match(h.command('next'), /先完成/);
  h.near(); h.command('act'); h.frames(4); assert.equal(h.state().contact?.phase, 'noticed');
  h.command('reflect:trust'); assert.equal(h.state().step, 5, 'a generic reflection cannot bypass the invitation');
  h.frames(30); assert.equal(h.state().step, 5);
  h.command('contact:follow'); assert.equal(h.state().contact?.phase, 'accepted');
  assert.ok(h.state().completed.includes('m1_wake_up'));
  h.command('next'); assert.equal(h.state().scene, 'm1_club');
  assert.equal(h.sandbox.life.state!.choices.white_rabbit, 'follow');
  assert.deepEqual(h.sandbox.state.profiles.neo.inventory, items);
  assert.equal(h.sandbox.state.structures.some(s => s.id === 'film:apartment:door'), false);
});

test('declining preserves ordinary life and resumes the invitation without a second payout or replacing history', () => {
  const h = setup(); atInvitation(h); h.near(); h.command('act'); h.frames(4);
  const life = h.sandbox.life.state!; const cash = life.money; const evidence = [...life.evidence];
  const completed = [...h.state().completed];
  h.command('contact:wait');
  assert.equal(life.journey, undefined); assert.equal(h.neo.currentLocation, 'neo_apartment');
  assert.equal(life.deferredContact?.contact?.phase, 'noticed');
  assert.match(h.command('start'), /保留/); assert.equal(life.journey, undefined);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  h.command('continue');
  assert.equal(h.state().contact?.phase, 'noticed'); assert.deepEqual(h.state().completed, completed);
  assert.equal(h.sandbox.life.state!.money, cash); assert.deepEqual(h.sandbox.life.state!.evidence, evidence);
  h.command('act'); h.frames(5); assert.equal(h.sandbox.life.state!.money, cash);
  h.command('contact:follow'); h.command('next'); assert.equal(h.state().scene, 'm1_club');
});

test('each contact performance resumes its exact clock after pause, disconnection, save restore and retry', () => {
  for (const phase of ['signal', 'retrieving', 'handover']) {
    const h = setup();
    if (phase !== 'signal') atBook(h);
    if (phase === 'handover') { h.near(); h.command('act'); h.frames(4); }
    h.near(); h.command('act'); h.frames(1.5);
    const contact = structuredClone(h.state().contact); const position = { ...h.neo.position }; const cash = h.sandbox.life.state!.money;
    assert.equal(contact?.phase, phase);
    h.frames(5, false); assert.deepEqual(h.state().contact, contact);
    h.players.release('apartment-player', 1); h.frames(3); assert.deepEqual(h.state().contact, contact);
    h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
    h.players.possess('apartment-player', 'neo', 1);
    assert.deepEqual(h.state().contact, contact); assert.deepEqual(h.neo.position, position);
    h.neo.status = 'dead'; h.command('retry'); assert.deepEqual(h.state().contact, contact);
    assert.equal(h.sandbox.life.state!.money, cash);
    h.frames(10); assert.equal(h.state().contact?.phase, phase === 'signal' ? 'reply' : phase === 'retrieving' ? 'disk' : 'invitation');
  }
});

test('visitors owned by another player are neither moved nor allowed to advance the transaction', () => {
  const h = setup(); atBook(h); h.near(); h.command('act'); h.frames(4);
  h.players.possess('guest-player', 'choi', 1);
  const choi = h.world.agents.get('choi')!; const position = { ...choi.position }; const cash = h.sandbox.life.state!.money;
  h.near(); assert.match(h.command('act'), /另一位玩家/); h.frames(10);
  assert.deepEqual(choi.position, position); assert.equal(h.state().contact?.phase, 'disk'); assert.equal(h.sandbox.life.state!.money, cash);
  h.players.release('guest-player', 1); h.command('act'); h.frames(5); assert.equal(h.state().contact?.phase, 'invitation');
});

test('the apartment door is solid until opened and the player can walk from each prop to the next', () => {
  const h = setup(); const door = filmPosition('film_anderson_flat', 0, 12);
  assert.equal(playerBlocked(door, true, 1.1, h.sandbox.state.structures), true);
  atBook(h); assert.equal(playerBlocked(door, true, 1.1, h.sandbox.state.structures), false);
  for (const [a, b] of [[[0, 1], [APARTMENT.computer.x, 1]], [[APARTMENT.computer.x, 1], [APARTMENT.computer.x, APARTMENT.computer.z]], [[APARTMENT.computer.x, APARTMENT.computer.z], [APARTMENT.computer.x, 1]], [[APARTMENT.computer.x, 1], [0, 1]], [[0, 1], [0, 10.2]], [[0, 10.2], [3, 3]], [[3, 3], [6, 3.4]]]) {
    for (let i = 0; i <= 100; i++) assert.equal(playerBlocked(filmPosition('film_anderson_flat', a[0] + (b[0] - a[0]) * i / 100, a[1] + (b[1] - a[1]) * i / 100), true), false);
  }
});

test('new signals require returning home, while legacy completed apartment scenes do not replay the trade', () => {
  const h = setup(); delete h.sandbox.life.state!.journey; h.sandbox.life.state!.contactSignal = true;
  h.neo.position = lifeRoomCenter('corner_cafe')!; h.neo.currentLocation = 'corner_cafe';
  assert.match(h.command('continue'), /先回公寓/);
  h.neo.position = lifeRoomCenter('neo_apartment')!; h.neo.currentLocation = 'neo_apartment'; h.command('continue');
  const saved = structuredClone(h.sandbox.state); const journey = saved.neoLife!.journey!;
  delete journey.contact; journey.step = 2; journey.completed.push('m1_wake_up');
  const cash = saved.neoLife!.money; h.sandbox.restore(saved);
  assert.equal(h.state().contact?.phase, 'accepted'); assert.equal(h.state().step, 6);
  h.command('next'); assert.equal(h.state().scene, 'm1_club'); assert.equal(h.sandbox.life.state!.money, cash);
});

test('a discovered anomaly sends an anonymous computer signal, not a premature invitation from Trinity', () => {
  const h = setup(); delete h.sandbox.life.state!.journey;
  const life = h.sandbox.life.state!;
  life.chapter = 0; life.evidence = ['commute', 'clock', 'receipt']; life.doubt = 60; life.contactAfterDay = 1;
  h.sandbox.tick(100);
  assert.equal(life.chapter, 1);
  assert.equal(life.contactSignal, true);
  assert.match(life.journal[0].text, /电脑/);
  assert.doesNotMatch(life.journal[0].text, /Trinity|崔尼蒂/);
});
