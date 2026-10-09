import assert from 'node:assert/strict';
import test from 'node:test';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import { FILM_SCENE_BY_ID, filmStepPosition, type WorldEvent } from '@auto_matrix/shared';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

function setup() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const conversations = { interrupt() {}, isAgentInConversation: () => false, startConversation: () => false } as unknown as ConversationEngine;
  const players = new PlayerController(world, conversations, { execute() {} } as unknown as ActionExecutor, dynamics, sandbox);
  players.possess('terminal-player', 'neo', 0); sandbox.life.begin(world.agents.get('neo')!, 0); sandbox.state.neoLife!.chapter = 1;
  let tick = 0, sequence = 0;
  const command = (target: string) => players.sandboxAction('terminal-player', { kind: 'life', target: `film:${target}` }, ++tick);
  command('continue'); const journey = sandbox.life.film.state!;
  Object.assign(journey, { scene: 'm2_backup', actor: 'trinity', step: 1,
    primaryDemolition: { phase: 'done', installed: ['west', 'east', 'clock'], elapsed: 0, remaining: 20, attempts: 1, blast: { phase: 'done', elapsed: 8 } },
    grid: { primary: 'off', emergency: 'online', vigilant: 'lost', trinity: 'connected', phase: 'emergency', remaining: 314, lastTick: tick, reroute: 0, attempts: 0 } });
  players.possess('terminal-player', 'trinity', tick); const actor = players.getAgent('terminal-player')!;
  actor.currentLocation = FILM_SCENE_BY_ID.m2_backup.set; actor.isInMatrix = true;
  actor.position = filmStepPosition(FILM_SCENE_BY_ID.m2_backup, FILM_SCENE_BY_ID.m2_backup.steps[1], journey);
  world.agents.get('keymaker')!.health = 40; journey.reflections['m2_plan:1'] = 'care';
  for (const id of ['soren', 'axel']) { world.agents.get(id)!.status = 'dead'; world.agents.get(id)!.health = 0; }
  let held = false;
  const input = (focus: boolean) => {
    held = focus;
    players.receiveInput('terminal-player', { x: 0, z: 0, yaw: Math.PI, pitch: 0, focus, jump: false, sequence: ++sequence, location: actor.currentLocation });
  };
  const frames = (seconds: number, running = true) => {
    for (let i = 0; i < seconds * 10; i++) {
      if (running && i % 5 === 4) tick++;
      if (running) input(held);
      players.step(.1, running, tick);
      if (running && i % 5 === 4) sandbox.life.film.tick(tick);
    }
  };
  return { world, sandbox, players, journey, command, actor, input, frames, tick: () => tick, terminal: () => (sandbox.life.film.state! as any).trinityTerminal };
}

test('Trinity reaches human security before the later Agent pursuit', () => {
  assert.equal(FILM_SCENE_BY_ID.m2_backup.steps[0].enemy, 'soldier');
});

test('one timed interaction cannot deploy Trinity’s override', () => {
  const h = setup(); h.command('act'); h.frames(8);
  assert.equal(h.journey.step, 1, 'scanning must not silently submit the override');
  assert.equal(h.journey.grid!.emergency, 'online'); assert.equal(h.terminal().phase, 'selecting');
});

test('the terminal needs a discovered SSH route, held typing and a separate final submission', () => {
  const h = setup(); h.command('act'); h.frames(3.5);
  h.command('terminal:select:ssh'); assert.equal(h.terminal().phase, 'typing');
  h.frames(8); assert.equal(h.terminal().elapsed, 0, 'waiting without keys cannot type the program');
  h.input(true); h.frames(2); const half = h.terminal().elapsed;
  assert.ok(half > 1.5 && half < 2.2); h.input(false); h.frames(3); assert.equal(h.terminal().elapsed, half);
  h.command('act'); assert.equal(h.terminal().phase, 'typing', 'G cannot skip unfinished typing');
  h.input(true); h.frames(3); h.input(false);
  assert.equal(h.terminal().phase, 'armed'); assert.equal(h.journey.step, 1);
  assert.equal(h.journey.grid!.emergency, 'online');
  h.command('act'); assert.equal(h.terminal().phase, 'deployed'); assert.equal(h.journey.step, 2);
  assert.equal(h.journey.grid!.hackRemaining, 12); h.frames(5);
  assert.equal(h.journey.grid!.hackRemaining, 12, 'the crosscut program starts when Neo resumes his corridor');
});

test('a wrong route locks the console and retry preserves the destroyed main grid, casualties and earlier choices', () => {
  const h = setup(); h.command('terminal:select:ssh'); assert.equal(h.terminal().phase, 'ready');
  h.command('act'); h.frames(3.5); h.command('terminal:select:web'); assert.equal(h.terminal().phase, 'failed');
  h.frames(20); assert.equal(h.journey.step, 1); assert.equal(h.journey.grid!.emergency, 'online');
  h.command('retry'); assert.equal(h.terminal().phase, 'ready'); assert.equal(h.terminal().attempts, 1);
  assert.equal(h.journey.grid!.primary, 'off'); assert.equal(h.world.agents.get('keymaker')!.health, 40);
  assert.equal(h.journey.reflections['m2_plan:1'], 'care');
  for (const id of ['soren', 'axel']) assert.equal(h.world.agents.get(id)!.status, 'dead');
});

test('pause, release and restore retain the exact partially typed program', () => {
  const h = setup(); h.command('act'); h.frames(3.5); h.command('terminal:select:ssh'); h.input(true); h.frames(1.5);
  const before = structuredClone(h.terminal()); h.frames(4, false); assert.deepEqual(h.terminal(), before);
  h.players.release('terminal-player', h.tick()); h.frames(8); assert.deepEqual(h.terminal(), before);
  h.sandbox.restore(structuredClone(h.sandbox.state)); h.players.possess('terminal-player', 'trinity', h.tick());
  assert.deepEqual(h.terminal(), before); h.input(true); h.frames(3); h.input(false);
  assert.equal(h.terminal().phase, 'armed'); h.command('act'); const step = h.sandbox.life.film.state!.step;
  h.command('act'); h.frames(5); assert.equal(h.sandbox.life.film.state!.step, step, 'restore must not submit twice');
});

test('the terminal locks combat and rejects remote interaction and invented network services', () => {
  const h = setup(); h.actor.position.z += 8; h.command('act'); assert.equal(h.terminal().phase, 'ready');
  h.actor.position = filmStepPosition(FILM_SCENE_BY_ID.m2_backup, FILM_SCENE_BY_ID.m2_backup.steps[1], h.journey);
  h.command('act'); assert.equal(h.sandbox.life.film.performing(h.actor), true);
  h.frames(3.5); h.command('terminal:select:arbitrary'); assert.equal(h.terminal().phase, 'selecting');
  h.command('terminal:select:ssh'); h.players.act('terminal-player', 'attack', h.tick());
  assert.equal(h.actor.currentAction?.parameters.trinityTerminal !== undefined, true);
});

test('Link’s occupied or dead state stops the console without changing crew history', () => {
  const h = setup(); h.command('act'); const link = h.world.agents.get('link')!;
  link.controller = 'other-player'; h.frames(6); assert.equal(h.terminal().elapsed, 0);
  assert.equal(h.terminal().phase, 'scanning'); assert.equal(link.controller, 'other-player');
  link.controller = undefined; h.frames(3.5); h.command('terminal:select:ssh');
  link.status = 'dead'; link.health = 0; h.input(true); h.frames(8);
  assert.equal(h.terminal().elapsed, 0); h.command('retry');
  assert.equal(link.status, 'dead'); assert.equal(h.journey.step, 1);
});
