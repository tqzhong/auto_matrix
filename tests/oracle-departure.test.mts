import assert from 'node:assert/strict';
import test from 'node:test';
import { filmPosition, FILM_SCENE_BY_ID, type AgentState, type WorldEvent } from '@auto_matrix/shared';
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
  players.possess('departure-player', 'neo', 0); sandbox.life.begin(world.agents.get('neo')!, 0);
  sandbox.state.neoLife!.chapter = 1;
  let tick = 0, sequence = 0;
  const command = (target: string) => players.sandboxAction('departure-player', { kind: 'life', target: `film:${target}` }, ++tick);
  command('continue');
  Object.assign(sandbox.life.film.state!, { scene: 'm1_oracle', actor: 'neo', step: 1,
    oracle: { vase: 4.5, consultation: { phase: 'responding', elapsed: 4.1, answer: 'care' }, reception: { phase: 'ready', elapsed: 0, progress: 0 } } });
  const actor = world.agents.get('neo')!;
  actor.currentLocation = 'film_oracle_home'; actor.isInMatrix = true;
  actor.position = filmPosition('film_oracle_home', -4.35, -22); actor.rotation = -Math.PI / 2;
  const frame = (count = 1, running = true) => { for (let i = 0; i < count; i++) players.step(.1, running, ++tick); };
  frame(3);
  const state = () => sandbox.life.film.state!;
  const departure = () => state().oracle!.departure!;
  const move = (x: number, z: number) => {
    players.receiveInput('departure-player', { x, z, yaw: Math.atan2(x, z), jump: false, sprint: false, sequence: ++sequence }); frame();
  };
  return { world, sandbox, players, command, frame, move, actor, state, departure, tick: () => tick };
}

test('answering the Oracle keeps the accepted cookie and requires a physical departure', () => {
  const h = setup();
  assert.equal(h.state().step, 2);
  assert.equal(h.state().completed.includes('m1_oracle'), false, 'answering alone cannot finish the visit');
  assert.equal(h.departure().phase, 'waiting');
  assert.ok(h.actor.currentAction?.parameters.oracleDeparture, 'Neo keeps his accepted cookie when normal movement returns');
  h.command('next'); assert.equal(h.state().scene, 'm1_oracle', 'the journal must not teleport past the farewell');
  const origin = { ...h.actor.position }; h.move(0, 1);
  assert.ok(h.actor.position.z > origin.z, 'Neo walks freely toward the hostess');
});

test('the returning hostess waits for Neo and saves her route through pause, disconnect and occupation', () => {
  const h = setup(); h.actor.position = filmPosition('film_oracle_home', -4.6, -10.2); h.command('act'); h.frame(10);
  assert.equal(h.departure().phase, 'guiding');
  const progress = h.state().oracle!.reception!.progress;
  h.frame(20, false); assert.equal(h.state().oracle!.reception!.progress, progress);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  assert.equal(h.state().oracle!.reception!.progress, progress);
  h.players.release('departure-player', h.tick()); h.frame(20);
  assert.equal(h.state().oracle!.reception!.progress, progress);
  h.players.possess('departure-player', 'neo', h.tick());
  h.players.possess('host-player', 'oracle_priestess', h.tick());
  const hostess = h.world.agents.get('oracle_priestess')!, position = { ...hostess.position };
  h.frame(20); assert.equal(h.state().oracle!.reception!.progress, progress); assert.deepEqual(hostess.position, position);
  h.players.release('host-player', h.tick()); h.actor.position = filmPosition('film_oracle_home', -4, -23);
  h.frame(80); assert.equal(h.state().oracle!.reception!.progress, progress, 'she cannot return to the sofa without Neo');
});

test('Morpheus privacy, the cookie bite and the actual apartment exit all precede the ambush', () => {
  const h = setup(); h.actor.position = filmPosition('film_oracle_home', -4.6, -10.2); h.command('act');
  for (let i = 0; i < 300 && h.departure().phase === 'guiding'; i++) {
    const hostess = h.world.agents.get('oracle_priestess')!;
    h.actor.position = { ...hostess.position, z: hostess.position.z - .5 }; h.frame();
  }
  assert.equal(h.departure().phase, 'ready');
  h.actor.position = filmPosition('film_oracle_home', -6.8, 10.8);
  h.players.possess('morpheus-player', 'morpheus', h.tick()); h.command('act');
  assert.equal(h.departure().phase, 'ready', 'the privacy scene must not steal another player character');
  h.players.release('morpheus-player', h.tick()); h.command('act');
  assert.equal(h.departure().phase, 'talking');
  const original = { ...h.actor.position }; h.move(1, 0); assert.deepEqual(h.actor.position, original);
  h.frame(70); assert.equal(h.departure().phase, 'bite_ready');
  h.command('next'); assert.equal(h.state().scene, 'm1_oracle');
  h.command('act'); assert.equal(h.departure().phase, 'biting'); h.frame(32);
  assert.equal(h.departure().phase, 'leaving');
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)); h.sandbox.restore(saved);
  h.actor.status = 'dead'; h.actor.health = 0; h.command('retry');
  assert.equal(h.departure().phase, 'leaving', 'retry preserves the bite and conversation, rather than repeating their rewards');
  h.command('act'); assert.equal(h.state().completed.includes('m1_oracle'), false, 'an exit interaction from the sofa cannot finish');
  h.actor.position = filmPosition('film_oracle_home', 0, 27); h.command('act');
  assert.equal(h.departure().phase, 'done');
  assert.equal(h.state().step, FILM_SCENE_BY_ID.m1_oracle.steps.length); assert.ok(h.state().completed.includes('m1_oracle'));
  h.command('next'); assert.equal(h.state().scene, 'm1_dejavu');
});

test('ordinary controller input walks the complete kitchen farewell route without teleporting through furniture', () => {
  const h = setup(); let largestStep = 0;
  const steer = (target: { x: number; z: number }, threshold = .7) => {
    const dx = target.x - h.actor.position.x, dz = target.z - h.actor.position.z, gap = Math.hypot(dx, dz), before = { ...h.actor.position };
    h.move(gap > threshold ? dx / gap : 0, gap > threshold ? dz / gap : 0);
    largestStep = Math.max(largestStep, Math.hypot(h.actor.position.x - before.x, h.actor.position.z - before.z));
    return gap;
  };
  const walk = (x: number, z: number) => {
    const target = filmPosition('film_oracle_home', x, z);
    for (let i = 0; i < 400 && steer(target) > .7; i++) {}
    assert.ok(Math.hypot(h.actor.position.x - target.x, h.actor.position.z - target.z) < .9, `the ordinary controller cannot reach ${x}, ${z}`);
    h.move(0, 0);
  };
  walk(-4.6, -10.2); h.command('act'); assert.equal(h.departure().phase, 'guiding');
  for (let i = 0; i < 500 && h.departure().phase === 'guiding'; i++) steer(h.world.agents.get('oracle_priestess')!.position, 1);
  assert.equal(h.departure().phase, 'ready');
  walk(-6.8, 10.8); h.frame(10); h.command('act'); assert.equal(h.departure().phase, 'talking');
  h.frame(70); assert.equal(h.departure().phase, 'bite_ready'); h.command('act'); h.frame(30); assert.equal(h.departure().phase, 'leaving');
  walk(-3, 20); walk(0, 27); h.command('act'); assert.equal(h.departure().phase, 'done');
  assert.ok(largestStep < .9, `a movement sample teleported ${largestStep} metres`);
  assert.ok(h.state().completed.includes('m1_oracle'));
});

test('a current old Oracle ending resumes its missing farewell without reopening earlier completed scenes', () => {
  const h = setup(), saved = JSON.parse(JSON.stringify(h.sandbox.state));
  delete saved.neoLife.journey.oracle.departure; saved.neoLife.journey.completed.push('m1_room303', 'm1_oracle');
  h.sandbox.restore(saved); h.frame();
  assert.equal(h.departure().phase, 'waiting'); assert.equal(h.state().completed.includes('m1_oracle'), false);
  assert.ok(h.state().completed.includes('m1_room303'), 'the departure migration must preserve earlier completed scenes');
  h.command('next'); assert.equal(h.state().scene, 'm1_oracle');
});
