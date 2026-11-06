import assert from 'node:assert/strict';
import test from 'node:test';
import { filmStepPosition, filmPosition, OFFICE_DELIVERY_SECONDS, officeCourierRoot, playerBlocked, type OfficePhone, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

function setup() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (e: Omit<WorldEvent, 'id'>) => world.addWorldEvent(e) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const players = new PlayerController(world, { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine, {} as ActionExecutor, dynamics, sandbox);
  players.possess('player', 'neo', 0); const neo = world.agents.get('neo')!;
  sandbox.life.begin(neo, 0); sandbox.state.neoLife!.chapter = 2;
  let tick = 0;
  const act = (target = 'act') => players.sandboxAction('player', { kind: 'life', target: `film:${target}` }, tick);
  act('continue');
  const frame = (seconds: number, running = true) => { for (let i = 0; i < seconds * 10; i++) { players.step(.1, running, tick); if (running && i % 5 === 0) sandbox.tick(++tick); } };
  const goal = () => { neo.position = filmStepPosition(sandbox.life.film.scene!, sandbox.life.film.step!); };
  return { world, sandbox, players, neo, act, frame, goal, state: () => sandbox.life.film.state!, tick: () => tick };
}

test('Rhineheart waits for Anderson to answer and the phone cannot appear before its delivery', () => {
  const h = setup(); h.goal(); h.act(); h.frame(15);
  assert.equal(h.state().step, 0, 'waiting through the lecture does not answer the manager for Neo');
  assert.equal(h.state().workday?.phase, 'answer');
  h.act(); assert.equal(h.state().step, 1);
  h.goal(); h.act(); h.frame(15);
  assert.equal(h.state().phone, undefined, 'a parcel must be signed for before it can be opened');
  assert.equal(h.state().workday?.phase, 'signature');
  h.act(); h.frame(5); assert.equal(h.state().workday?.phase, 'delivered');
  assert.equal(h.state().phone, undefined, 'delivery does not automatically answer Morpheus');
  h.act(); h.frame(3); assert.equal(h.state().phone?.phase, 'ready');
});

for (const phase of ['briefing', 'answer', 'signing'] as const) {
  test(`paused office ${phase} preserves the saved action through disconnect, restore and retry`, () => {
    const h = setup(); h.goal(); h.act();
    if (phase === 'signing') { h.frame(10); h.act(); h.goal(); h.act(); h.frame(11); h.act(); }
    h.frame(phase === 'answer' ? 12 : 1.5);
    assert.equal(h.state().workday?.phase, phase);
    const expected = structuredClone(h.state().workday);
    const motion = () => structuredClone({ action: h.neo.currentAction, position: h.neo.position, rotation: h.neo.rotation, velocity: h.neo.velocity });
    const saved = motion();
    const courier = { ...h.world.agents.get('courier')!.position };
    h.frame(2, false); assert.deepEqual(motion(), saved);
    h.players.release('player', h.tick() + 1);
    assert.deepEqual(motion(), saved, 'disconnect must preserve the saved action at a later world tick');
    h.frame(2); assert.deepEqual(h.state().workday, expected);
    h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
    assert.deepEqual(motion(), saved, 'loading the world must keep the original action');
    h.players.possess('player', 'neo', h.tick() + 2);
    assert.deepEqual(motion(), saved, 're-entry must keep the original action');
    assert.deepEqual(h.state().workday, expected);
    assert.deepEqual(h.world.agents.get('courier')!.position, courier);
    h.neo.status = 'dead'; h.act('retry'); assert.equal(h.neo.status, 'alive');
    assert.deepEqual(h.state().workday, expected); assert.deepEqual(motion(), saved);
    h.neo.currentAction = null;
    h.sandbox.restore(structuredClone(h.sandbox.state));
    assert.deepEqual(motion().action?.parameters.workday, { ...expected, role: 'neo' });
    assert.deepEqual(h.neo.position, saved.position);
    h.frame(12); assert.equal(h.state().workday?.phase, phase === 'signing' ? 'delivered' : 'answer');
    assert.equal(h.state().phone, undefined);
  });
}

test('the workday waits for an occupied actor without taking control of them', () => {
  const h = setup(); h.players.possess('manager-player', 'rhineheart', h.tick());
  const position = { ...h.world.agents.get('rhineheart')!.position };
  h.goal(); h.act(); h.frame(12);
  assert.equal(h.state().workday?.phase, 'waiting'); assert.match(h.state().lastText, /另一位玩家/);
  assert.deepEqual(h.world.agents.get('rhineheart')!.position, position);
  h.players.release('manager-player', h.tick()); h.act(); h.frame(10); h.act();
  h.players.possess('courier-player', 'courier', h.tick()); h.goal(); h.act(); h.frame(12);
  assert.equal(h.state().workday?.phase, 'released'); assert.equal(h.state().phone, undefined);
  h.players.release('courier-player', h.tick()); h.frame(12);
  assert.equal(h.state().workday?.phase, 'signature');
});

test('both authored walking routes avoid all furniture and the manager room has a usable door', () => {
  const points = [{ x: 0, z: 20.5 }, { x: -11, z: 20.5 }, { x: -11, z: 26 }, { x: -17, z: 27.4 }];
  for (let i = 1; i < points.length; i++) for (let f = 0; f <= 100; f++) {
    const a = points[i - 1]; const b = points[i];
    const position = filmPosition('film_metacortex_floor', a.x + (b.x - a.x) * f / 100, a.z + (b.z - a.z) * f / 100);
    assert.equal(playerBlocked(position, true), false, `the manager's door route is blocked at ${JSON.stringify(position)}`);
  }
  for (const phase of ['delivery', 'delivered'] as const) for (let elapsed = 0; elapsed <= OFFICE_DELIVERY_SECONDS; elapsed += .05) {
    const root = officeCourierRoot({ phase, elapsed });
    assert.equal(playerBlocked(filmPosition('film_metacortex_floor', root.x, root.z), true), false, `courier crosses furniture at ${elapsed}s`);
  }
  assert.equal(playerBlocked(filmPosition('film_metacortex_floor', -6.1, 27.4), true), true, 'glass must be solid to movement');
});

test('old delivered-phone saves do not require receiving a second parcel', () => {
  const h = setup(); const saved = structuredClone(h.sandbox.state); const journey = saved.neoLife!.journey!;
  journey.step = 1; delete journey.workday; journey.phone = { phase: 'ready', elapsed: 0 };
  h.sandbox.restore(saved); assert.equal(h.state().workday?.phase, 'delivered');
  h.goal(); h.act(); h.frame(12);
  assert.equal(h.state().phone?.phase, 'connected'); assert.equal(h.state().step, 2);
});

function setupPhone(phase: OfficePhone['phase']) {
  const h = setup(); h.goal(); h.act(); h.frame(10); h.act();
  h.goal(); h.act(); h.frame(11); h.act(); h.frame(4.1); h.act();
  h.frame(phase === 'pickup' ? .8 : 3);
  if (phase === 'answering' || phase === 'connected') { h.act(); h.frame(phase === 'answering' ? 3.3 : 12); }
  assert.equal(h.state().phone?.phase, phase);
  return h;
}

for (const phase of ['pickup', 'ready', 'answering', 'connected'] as const) {
  test(`paused ${phase} phone action and returning courier survive disconnect, restore and re-entry`, () => {
    const h = setupPhone(phase), phone = structuredClone(h.state().phone);
    const snapshot = () => Object.fromEntries(['neo', 'courier', 'rhineheart'].map(id => {
      const actor = h.world.agents.get(id)!;
      return [id, structuredClone({ action: actor.currentAction, position: actor.position, rotation: actor.rotation, velocity: actor.velocity })];
    }));
    const expected = snapshot();
    h.frame(2, false); assert.deepEqual(snapshot(), expected);
    h.players.release('player', h.tick() + 3);
    assert.deepEqual(snapshot(), expected, 'disconnect must retain the handset and saved motion');
    h.frame(2); assert.deepEqual(h.state().phone, phone);
    h.sandbox.restore(structuredClone(h.sandbox.state));
    assert.deepEqual(snapshot(), expected, 'zero-time recovery must not stop the returning courier');
    h.players.possess('player', 'neo', h.tick() + 7);
    assert.deepEqual(snapshot(), expected); assert.deepEqual(h.state().phone, phone);
  });

  test(`legacy ${phase} phone saves reconstruct the missing handset before simulation resumes`, () => {
    const h = setupPhone(phase), phone = structuredClone(h.state().phone), position = { ...h.neo.position };
    h.neo.currentAction = null;
    h.sandbox.restore(structuredClone(h.sandbox.state));
    assert.deepEqual(h.neo.currentAction?.parameters.phone, phone);
    assert.deepEqual(h.state().phone, phone); assert.deepEqual(h.neo.position, position);
    h.players.possess('player', 'neo', h.tick()); h.frame(2, false);
    assert.deepEqual(h.neo.currentAction?.parameters.phone, phone);
    assert.deepEqual(h.state().phone, phone); assert.deepEqual(h.neo.position, position);
  });
}
