import assert from 'node:assert/strict';
import test from 'node:test';
import { BANE_INQUIRY, FILM_SCENE_BY_ID, FILM_SETS, filmPosition, filmStepActionReady, filmStepPosition, type WorldEvent } from '@auto_matrix/shared';
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
  let tick = 0, sequence = 0;
  players.possess('inquiry-player', 'neo', tick); sandbox.life.begin(world.agents.get('neo')!, tick); sandbox.state.neoLife!.chapter = 1;
  const command = (target: string) => players.sandboxAction('inquiry-player', { kind: 'life', target: `film:${target}` }, ++tick);
  command('continue');
  const state = sandbox.life.film.state!;
  Object.assign(state, { scene: 'm3_oracle_absorbed', actor: 'oracle', step: FILM_SCENE_BY_ID.m3_oracle_absorbed.steps.length,
    completed: ['m3_oracle_absorbed'], reflections: {} });
  players.possess('inquiry-player', 'oracle', tick);
  const roland = world.agents.get('roland')!; roland.health = 37;
  command('next');
  const actor = () => players.getAgent('inquiry-player') ?? world.agents.get('roland')!;
  const frames = (seconds: number, running = true) => {
    for (let i = 0; i < Math.ceil(seconds / .05); i++) {
      players.receiveInput('inquiry-player', { x: 0, z: 0, yaw: actor().rotation, location: actor().currentLocation, sequence: ++sequence });
      players.step(.05, running, ++tick); if (running) sandbox.tick(tick);
    }
  };
  const near = (step: number) => { actor().position = filmStepPosition(FILM_SCENE_BY_ID.m3_bane_questions, FILM_SCENE_BY_ID.m3_bane_questions.steps[step]); };
  return { world, sandbox, players, get state() { return sandbox.life.film.state!; }, command, actor, frames, near, tick: () => tick };
}

test('the Hammer inquiry entry faces the interview and preserves Roland injuries', () => {
  const h = setup();
  assert.equal(h.state.scene, 'm3_bane_questions'); assert.equal(h.actor().id, 'roland');
  const target = filmStepPosition(FILM_SCENE_BY_ID.m3_bane_questions, FILM_SCENE_BY_ID.m3_bane_questions.steps[0]);
  const yaw = Math.atan2(target.x - h.actor().position.x, target.z - h.actor().position.z);
  assert.ok(Math.cos(h.actor().rotation - yaw) > .99, 'entry faces the target, not the rear wall');
  assert.equal(h.actor().health, 37, 'changing viewpoint must not heal the captain');
});

test('Bane questioning requires an actual saved interview instead of the old short interaction timer', () => {
  const h = setup(); h.near(0); h.frames(.1); assert.equal(h.state.step, 1);
  h.near(1); h.command('act'); h.frames(2);
  assert.equal(h.state.step, 1, 'the cuts are not proved by a two-second generic timer');
  assert.ok(h.state.baneInquiry, 'the sitting and questioning clock must be saved');
  assert.equal(h.sandbox.state.neoLife!.choices.bane_wounds, undefined);
});

test('the shared action prompt accepts the reachable standing position before Roland sits', () => {
  const h = setup(); h.near(0); h.frames(.1);
  assert.equal(h.state.baneInquiry?.phase, 'ready');
  const scene = FILM_SCENE_BY_ID.m3_bane_questions;
  assert.equal(filmStepActionReady(scene, scene.steps[1], h.actor().position, false, h.state), true);
});

function interrogate(h: ReturnType<typeof setup>) {
  h.near(0); h.frames(.1);
  h.command('act'); h.frames(2.4 + 6 * 4.2 + .1); assert.equal(h.state.step, 2);
  h.command('act'); h.frames(4 * 4.2 + .1); assert.equal(h.state.step, 3);
  h.command('act'); h.frames(4 * 4.2 + .1); assert.equal(h.state.baneInquiry?.phase, 'reviewing');
}

test('two examination pages must be correctly reviewed before a judgment, without revealing the later stowaway', () => {
  const h = setup(); interrogate(h); const life = h.sandbox.state.neoLife!, state = h.state.baneInquiry!;
  const before = JSON.stringify(life.philosophy);
  h.command('reflect:agency'); assert.equal(JSON.stringify(life.philosophy), before);
  assert.match(h.command('review:positive'), /不符/); assert.equal(state.mistakes, 1); assert.equal(h.state.step, 3);
  h.command('review:negative'); assert.deepEqual(state.reviewed, ['vdt']);
  assert.match(h.command('review:normal'), /不符/); assert.equal(state.mistakes, 2);
  h.command('review:abnormal'); assert.equal(h.state.step, 4); assert.equal(state.phase, 'reflection');
  h.command('reflect:care'); const philosophy = JSON.stringify(life.philosophy); h.command('reflect:agency');
  assert.equal(JSON.stringify(life.philosophy), philosophy); assert.equal(state.reply, 'care');
  h.frames(7.2); assert.equal(h.state.step, 5); assert.equal(state.phase, 'leaving');
  h.command('next'); assert.equal(h.state.scene, 'm3_bane_questions', 'must actually walk out');
  assert.deepEqual([life.choices.bane_wounds, life.choices.bane_emp_record, life.choices.bane_neural_scan], ['self_inflicted', 'unexplained', 'abnormal']);
  assert.equal(life.choices.bane_escape_route, undefined); assert.equal(h.world.agents.get('maggie')!.status, 'alive');
  h.near(5); h.frames(.1); assert.equal(state.phase, 'done');
  const neo = h.world.agents.get('neo')!; neo.health = 43;
  h.command('next'); assert.equal(h.state.scene, 'm3_logos_plan'); assert.equal(h.actor().id, 'neo'); assert.equal(h.actor().health, 43);
});

test('paused, released and restored interviews retain clock, page, cast pose and inventory', () => {
  const h = setup(); h.near(0); h.frames(.1); h.command('act'); h.frames(8.6);
  const state = structuredClone(h.state.baneInquiry), position = { ...h.actor().position }, cast = ['bane', 'maggie', 'morpheus'].map(id => ({ ...h.world.agents.get(id)!.position }));
  h.frames(9, false); assert.deepEqual(h.state.baneInquiry, state);
  h.players.release('inquiry-player', h.tick()); h.frames(9); assert.deepEqual(h.state.baneInquiry, state);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); h.players.possess('inquiry-player', 'roland', h.tick());
  assert.deepEqual(JSON.parse(JSON.stringify(h.state.baneInquiry)), JSON.parse(JSON.stringify(state)));
  assert.deepEqual(h.actor().position, position); assert.deepEqual(['bane', 'maggie', 'morpheus'].map(id => h.world.agents.get(id)!.position), cast);
  const profile = h.sandbox.state.profiles.roland; profile.inventory.medkit = 0;
  h.command('retry'); assert.equal(profile.inventory.medkit, 0); assert.equal(h.actor().health, 37);
});

test('another player or a missing participant pauses questioning without moving or healing them', () => {
  const h = setup(); h.near(0); h.frames(.1); h.command('act'); h.frames(5);
  const bane = h.world.agents.get('bane')!, elapsed = h.state.baneInquiry!.elapsed;
  bane.controller = 'other-player'; bane.position.x += 3; const position = { ...bane.position }; h.frames(5);
  assert.equal(h.state.baneInquiry!.elapsed, elapsed); assert.deepEqual(bane.position, position); assert.match(h.command('act'), /玩家/);
  bane.controller = null; bane.status = 'dead'; bane.health = 0; h.frames(5); h.command('retry');
  assert.equal(h.state.baneInquiry!.elapsed, elapsed); assert.equal(bane.status, 'dead'); assert.equal(bane.health, 0);
  bane.status = 'alive'; bane.health = 19; h.frames(.1); assert.equal(bane.health, 19);
});

test('retry restores only the injured interviewer and retains saved questioning rather than restarting it', () => {
  const h = setup(); h.near(0); h.frames(.1); h.command('act'); h.frames(4);
  const elapsed = h.state.baneInquiry!.elapsed; h.actor().status = 'dead'; h.actor().health = 0;
  h.frames(5); assert.equal(h.state.baneInquiry!.elapsed, elapsed); h.command('retry');
  assert.equal(h.actor().health, 37); assert.equal(h.actor().status, 'alive'); assert.equal(h.state.baneInquiry!.elapsed, elapsed);
});

test('legacy untouched entry is migrated once; a player who already moved is not teleported', () => {
  for (const moved of [false, true]) {
    const h = setup(); delete h.state.baneInquiry;
    const set = FILM_SETS.film_hammer_deck;
    h.actor().position.z += 3; const position = { ...h.actor().position };
    if (!moved) h.actor().position = filmPosition(set.id, 0, set.depth * .32);
    h.frames(.05, false);
    if (moved) assert.deepEqual(h.actor().position, position);
    else assert.deepEqual(h.actor().position, h.state.checkpoint);
  }
});

test('ordinary walking reaches the interview chair without colliding with its expanded footprint', () => {
  const h = setup(); const target = filmStepPosition(FILM_SCENE_BY_ID.m3_bane_questions, FILM_SCENE_BY_ID.m3_bane_questions.steps[0]);
  for (let frame = 0; frame < 400 && h.state.step === 0; frame++) {
    const dx=target.x-h.actor().position.x,dz=target.z-h.actor().position.z,len=Math.hypot(dx,dz);
    h.players.receiveInput('inquiry-player',{x:dx/len,z:dz/len,yaw:Math.atan2(dx,dz),location:'film_hammer_deck',sequence:frame+1});
    h.players.step(.05,true,h.tick());
  }
  assert.equal(h.state.step,1,`walk blocked at ${JSON.stringify(h.actor().position)}`);
});

test('restoring old interview chairs updates only their collision height to match the rendered seat', () => {
  const h = setup(); h.frames(.05, false);
  const chairs = h.sandbox.state.structures.filter(item => item.id.startsWith('film:bane-inquiry:chair:'));
  assert.equal(chairs.length, 4); chairs.forEach(chair => { chair.film!.height = 1.23; });
  const other = structuredClone(h.sandbox.state.structures.filter(item => !chairs.includes(item)));
  h.frames(.05, false);
  chairs.forEach(chair => assert.equal(chair.film!.height, BANE_INQUIRY.seat.top));
  assert.deepEqual(h.sandbox.state.structures.filter(item => !chairs.includes(item)), other);
});
