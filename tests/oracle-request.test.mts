import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SCENE_BY_ID, FILM_SETS, ORACLE_REQUEST, oracleRequestRoot, filmReflections, filmPosition, playerBlocked, type WorldEvent } from '@auto_matrix/shared';
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
  players.possess('request-player', 'neo', 0); const neo = world.agents.get('neo')!;
  sandbox.life.begin(neo, 0); sandbox.state.neoLife!.chapter = 1;
  let tick = 0;
  const command = (target: string) => players.sandboxAction('request-player', { kind: 'life', target: `film:${target}` }, ++tick);
  command('continue');
  Object.assign(sandbox.life.film.state!, { scene: 'm3_trainman', actor: 'neo', step: FILM_SCENE_BY_ID.m3_trainman.steps.length });
  command('next');
  const actor = world.agents.get('trinity')!, state = () => sandbox.life.film.state!;
  const frame = (count = 1, running = true) => { for (let i = 0; i < count; i++) players.step(.1, running, ++tick); };
  frame(); return { world, sandbox, players, actor, state, command, frame, tick: () => tick };
}

test('Revolutions rescue visitors meet the seated Oracle in the living room, leaving the later kitchen consultation separate', () => {
  const h = setup(), center = FILM_SETS.film_oracle_home.center;
  assert.equal(h.state().scene, 'm3_oracle_request');
  assert.ok(h.world.agents.get('oracle')!.position.z > center.z + 8, 'this visit belongs beside the living-room sofa, not the kitchen');
  assert.ok(FILM_SCENE_BY_ID.m3_oracle_request.steps[0].z > 8, 'the playable question must target the actual visitors');
  assert.ok(FILM_SCENE_BY_ID.m3_oracle_last.steps[0].z < 0, 'Neo returns to the kitchen later');
});

test('an interrupted answer restores its exact clock and does not heal or take over a visitor', () => {
  const h = setup(), morph = h.world.agents.get('morpheus')!, neo = h.world.agents.get('neo')!;
  morph.health = 47; neo.health = 91.05;
  h.actor.position = filmPosition('film_oracle_home', ORACLE_REQUEST.question.x, ORACLE_REQUEST.question.z);
  h.command('act'); h.frame(30);
  const elapsed = h.state().oracleRequest!.elapsed, position = { ...h.actor.position };
  h.frame(100, false); assert.equal(h.state().oracleRequest!.elapsed, elapsed);
  h.players.release('request-player', h.tick()); h.frame(100); assert.equal(h.state().oracleRequest!.elapsed, elapsed);
  h.sandbox.restore(structuredClone(h.sandbox.state));
  assert.equal(h.state().oracleRequest!.elapsed, elapsed); assert.deepEqual(h.actor.position, position);
  h.players.possess('request-player', 'trinity', h.tick());
  h.players.possess('visitor-player', 'morpheus', h.tick()); const otherPosition = { ...morph.position };
  h.frame(100); assert.equal(h.state().oracleRequest!.elapsed, elapsed); assert.deepEqual(morph.position, otherPosition);
  assert.equal(h.players.getAgent('visitor-player'), morph); assert.equal(morph.health, 47); assert.equal(neo.health, 91.05);
  h.players.release('visitor-player', h.tick()); morph.status = 'dead';
  h.frame(100); assert.equal(h.state().oracleRequest!.elapsed, elapsed); assert.equal(morph.status, 'dead');
  assert.match(h.command('retry') as string, /无法参与/);
});

test('two explicit questions, Morpheus’s doubt and a saved reflection precede physical departure through the door', () => {
  const h = setup(), table = ORACLE_REQUEST.table;
  let sequence = 0;
  const walk = (x: number, z: number) => {
    const point = filmPosition('film_oracle_home', x, z);
    for (let i = 0; i < 300; i++) {
      const dx = point.x - h.actor.position.x, dz = point.z - h.actor.position.z, gap = Math.hypot(dx, dz);
      if (gap < .2) { h.players.receiveInput('request-player', { x: 0, z: 0, yaw: h.actor.rotation, sequence: ++sequence }); h.frame(); return; }
      h.players.receiveInput('request-player', { x: dx / gap * Math.min(1, gap / .7), z: dz / gap * Math.min(1, gap / .7), yaw: Math.atan2(dx, dz), sequence: ++sequence }); h.frame();
    }
    assert.fail(`ordinary walking failed at ${JSON.stringify(h.actor.position)} toward ${x},${z}`);
  };
  assert.equal(playerBlocked(filmPosition('film_oracle_home', table.x, table.z), true, 1.1, h.sandbox.state.structures), true, 'the rendered tea table is solid');
  walk(ORACLE_REQUEST.question.x, ORACLE_REQUEST.question.z); h.command('act');
  h.command('next'); assert.equal(h.state().step, 0, 'starting a reply cannot skip it');
  h.frame(100); assert.equal(h.state().step, 1);
  h.frame(250); assert.equal(h.state().step, 1, 'the second question remains an active choice');
  h.command('act'); h.frame(100); assert.match(h.state().lastText, /Morpheus/);
  h.command(`reflect:${filmReflections('m3_oracle_request')[0].id}`); assert.equal(h.state().step, 1);
  h.frame(100); assert.equal(h.state().step, 2);
  h.command(`reflect:${filmReflections('m3_oracle_request')[0].id}`); assert.equal(h.state().step, 3);
  h.frame(100); assert.equal(h.state().oracleRequest!.guide, 0, 'Seraph waits for a distant player');
  walk(0, 21); walk(0, 32); h.frame(120);
  assert.equal(h.state().step, 4, `departure requires the player to cross the actual doorway: ${JSON.stringify({ position: h.actor.position, request: h.state().oracleRequest })}`);
  assert.equal(h.state().oracleRequest!.phase, 'done');
  assert.ok(h.world.agents.get('morpheus')!.position.z > FILM_SETS.film_oracle_home.center.z + 29);
});

test('waiting and the slow story tick cannot answer Trinity’s question without an explicit interaction', () => {
  const h = setup(); h.frame(180);
  assert.equal(h.state().step, 0);
  assert.equal(h.state().oracleRequest?.phase, 'ready');
  h.actor.position = filmPosition('film_oracle_home', -4.6, 12); h.command('act');
  assert.equal(h.state().oracleRequest?.phase, 'answering');
  for (let i = 0; i < 100; i++) h.sandbox.tick(100 + i);
  assert.equal(h.state().step, 0, 'only controlled player frames advance the spoken exchange');
  assert.equal(h.state().oracleRequest?.elapsed, 0);
});

test('an unowned legacy checkpoint reconstructs the living-room cast immediately on restore', () => {
  const h = setup(), oracle = h.world.agents.get('oracle')!;
  h.players.release('request-player', h.tick()); delete h.state().oracleRequest;
  oracle.position = filmPosition('film_oracle_home', -7, -22); oracle.currentAction = null;
  h.sandbox.restore(structuredClone(h.sandbox.state));
  assert.equal(h.state().oracleRequest?.phase, 'ready', 'reading a checkpoint must not require taking over Trinity first');
  assert.ok(oracle.position.z > FILM_SETS.film_oracle_home.center.z + 8);
  assert.equal(h.actor.controller, undefined);
  assert.equal(h.state().step, 0);
});

test('reading a paused request preserves the Oracle’s authored seat instead of pushing her out of solid furniture', () => {
  const h = setup(), oracle = h.world.agents.get('oracle')!;
  h.players.release('request-player', h.tick());
  h.sandbox.life.film.oracleRequest.frame(h.actor, 0, h.tick());
  const position = { ...oracle.position };
  h.sandbox.restore(structuredClone(h.sandbox.state));
  assert.deepEqual(oracle.position, position, 'a seated performer is allowed inside her sofa collision');
  assert.equal(oracle.position.x, FILM_SETS.film_oracle_home.center.x + ORACLE_REQUEST.oracle.x);
});

test('guides fit through the doorway and finish clear of Trinity’s departure marker', () => {
  const h = setup();
  for (const role of ['seraph', 'morpheus'] as const) {
    for (let guide = 0; guide <= ORACLE_REQUEST.guideLength; guide += .1) {
      const root = oracleRequestRoot({ phase: 'guiding', elapsed: 0, guide }, role);
      assert.equal(playerBlocked(filmPosition('film_oracle_home', root.x, root.z), true, .55, h.sandbox.state.structures), false, `${role} cannot walk through a wall or the tea table at ${guide}`);
    }
    const end = oracleRequestRoot({ phase: 'done', elapsed: 0, guide: ORACLE_REQUEST.guideLength }, role);
    assert.ok(Math.hypot(end.x - ORACLE_REQUEST.exit.x, end.z - ORACLE_REQUEST.exit.z) > 1.2, `${role} cannot occupy the player's exact exit`);
  }
});

test('leaving the meeting retains the Oracle’s seated state when the next scene is read back', () => {
  const h = setup(), oracle = h.world.agents.get('oracle')!;
  h.state().step = 4; Object.assign(h.state().oracleRequest!, { phase: 'done', guide: ORACLE_REQUEST.guideLength });
  h.frame(); h.command('next');
  assert.equal(h.state().scene, 'm3_trainman_chase');
  const position = { ...oracle.position };
  assert.equal(oracle.currentAction?.parameters.oracleRequest?.phase, 'done', 'a scene change cannot erase the seated body left in the apartment');
  h.players.release('request-player', h.tick()); h.sandbox.restore(structuredClone(h.sandbox.state));
  assert.deepEqual(oracle.position, position, 'reading the next checkpoint must not move the Oracle out of her sofa');
  assert.equal(h.world.agents.get('morpheus')!.currentAction?.parameters.oracleRequest, undefined, 'the departing guide must no longer use the meeting pose');
});

test('an older departed-party checkpoint recovers the saved Oracle seat without restoring health', () => {
  const h = setup(), oracle = h.world.agents.get('oracle')!;
  h.state().step = 4; Object.assign(h.state().oracleRequest!, { phase: 'done', guide: ORACLE_REQUEST.guideLength });
  h.frame(); h.command('next'); h.players.release('request-player', h.tick());
  oracle.currentAction = null; oracle.position.x = FILM_SETS.film_oracle_home.center.x - 8; oracle.health = 47;
  const undocumentedPosition = { ...oracle.position };
  h.sandbox.restore(structuredClone(h.sandbox.state));
  assert.deepEqual(oracle.position, undocumentedPosition, 'an undocumented meeting cannot relocate the Oracle');
  h.state().completed.push('m3_oracle_request');
  h.sandbox.restore(structuredClone(h.sandbox.state));
  assert.equal(oracle.position.x, FILM_SETS.film_oracle_home.center.x + ORACLE_REQUEST.oracle.x);
  assert.equal(oracle.currentAction?.parameters.oracleRequest?.phase, 'done');
  assert.equal(oracle.health, 47);
});
