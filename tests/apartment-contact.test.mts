import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SCENE_BY_ID, filmStepPosition, filmPosition, lifeRoomCenter, playerBlocked, type WorldEvent } from '@auto_matrix/shared';
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
  for (const [a, b] of [[[0, 1], [-9, -8.8]], [[-9, -8.8], [0, 10.2]], [[0, 10.2], [3, 3]], [[3, 3], [6, 3.4]]]) {
    for (let i = 0; i <= 100; i++) assert.equal(playerBlocked(filmPosition('film_anderson_flat', a[0] + (b[0] - a[0]) * i / 100, a[1] + (b[1] - a[1]) * i / 100), true), false);
  }
});

test('new signals require returning home, while legacy completed apartment scenes do not replay the trade', () => {
  const h = setup(); delete h.sandbox.life.state!.journey; h.sandbox.life.state!.contactSignal = true;
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
