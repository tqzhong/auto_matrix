import assert from 'node:assert/strict';
import test from 'node:test';
import { CABIN, CABIN_ROUTE, CABIN_ROUTE_LENGTH, cabinGuidePose, FILM_SCENE_BY_ID, filmPosition, playerBlocked, type WorldEvent } from '@auto_matrix/shared';
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
  const conversations = { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine;
  const players = new PlayerController(world, conversations, {} as ActionExecutor, dynamics, sandbox);
  players.possess('test', 'neo', 0); sandbox.life.begin(world.agents.get('neo')!, 0); sandbox.state.neoLife!.chapter = 1;
  const act = (target = 'act') => players.sandboxAction('test', { kind: 'life', target: `film:${target}` }, 1);
  act('continue'); Object.assign(sandbox.life.film.state!, { scene: 'm1_pod', actor: 'neo', step: 2 }); act('next');
  const frames = (count: number) => { for (let i = 0; i < count; i++) players.step(.1, true, 1); };
  return { world, sandbox, players, act, frames, neo: world.agents.get('neo')!, state: () => sandbox.life.film.state! };
}

test('Dozer operates the recovery equipment and an occupied medic pauses its saved clock', () => {
  const h = setup(); const dozer = h.world.agents.get('dozer')!;
  h.players.possess('other', 'dozer', 1);
  assert.match(h.act(), /Dozer/, 'the equipment cannot start without its operator');
  assert.equal(h.state().awakening?.started, false);
  h.players.release('other', 1); h.act(); h.frames(40);
  assert.ok(Math.abs(Number(dozer.currentAction?.parameters.medical) - 4) < .001);
  assert.ok(Math.hypot(dozer.position.x - h.neo.position.x, dozer.position.z - h.neo.position.z) < 5);
  h.players.possess('other', 'dozer', 1); const elapsed = h.state().awakening!.elapsed;
  h.frames(20); assert.equal(h.state().awakening!.elapsed, elapsed);
});

test('the cabin escort waits for Neo and the core connection requires consent, survives reload, and leads to the Construct', () => {
  const h = setup(); h.act(); h.frames(121); h.act(); h.frames(121);
  const guide = h.world.agents.get('morpheus')!;
  h.neo.position = filmPosition('film_neb_deck', 0, 20);
  const progress = h.state().cabinEscort!.progress; h.frames(100);
  assert.equal(h.state().cabinEscort!.progress, progress, 'waiting elsewhere cannot complete the walk');
  h.neo.position = filmPosition('film_neb_deck', CABIN.approach.x, CABIN.approach.z);
  h.act(); assert.equal(h.state().step, 1, 'pressing G at the chair cannot skip the escort');
  for (let frame = 0; frame < 240 && h.state().cabinEscort!.progress < CABIN_ROUTE_LENGTH; frame++) {
    const root = cabinGuidePose(h.state().cabinEscort!.progress);
    h.neo.position = filmPosition('film_neb_deck', root.x, root.z); h.frames(1);
    assert.equal(playerBlocked(guide.position, false, .55), false, 'the guide follows the physical cabin doorway and core aisle');
    if (frame === 30) {
      const saved = JSON.parse(JSON.stringify(h.sandbox.state)), position = { ...guide.position };
      h.sandbox.restore(saved); h.players.release('test', 1); h.frames(10); h.players.possess('test', 'neo', 1);
      assert.deepEqual(guide.position, position, 'reconnecting cannot teleport Morpheus back to the cabin');
    }
  }
  assert.equal(h.state().cabinEscort!.progress, CABIN_ROUTE_LENGTH);
  h.neo.position = filmPosition('film_neb_deck', 5, -8); h.frames(1);
  assert.equal(h.state().step, 1, 'approaching from the side cannot start a path through the chair');
  assert.match(h.act(), /连接椅正面/, 'the prompt must direct the player to the safe approach, not claim four metres is enough');
  h.neo.position = filmPosition('film_neb_deck', CABIN.approach.x, CABIN.approach.z); h.frames(1);
  assert.equal(h.state().step, 2); assert.equal(h.state().awakening?.started, false);
  h.frames(90); assert.equal(h.state().awakening!.elapsed, 0, 'Morpheus cannot plug Neo in without the player agreeing');
  h.act(); h.frames(41);
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)), elapsed = h.state().awakening!.elapsed;
  h.sandbox.restore(saved); h.players.release('test', 1); h.frames(30); h.players.possess('test', 'neo', 1);
  assert.equal(h.state().awakening!.elapsed, elapsed);
  assert.equal(h.neo.currentAction?.parameters.cabin?.kind, 'core');
  h.frames(50);
  assert.equal(h.state().scene, 'm1_construct');
  assert.ok(h.state().completed.includes('m1_recovery') && h.state().completed.includes('m1_cabin'));
  assert.equal(h.state().constructArrival?.phase, 'ready', 'Neo inspects his image before the television lesson');
  assert.equal(h.state().awakening, undefined);
  assert.equal(h.sandbox.state.structures.some(item => item.id === 'film:cabin:door'), false);
});

test('old completed medical saves can continue through the added cabin without repeating treatment', () => {
  const h = setup(); Object.assign(h.state(), { step: 1, awakening: { kind: 'recovery', elapsed: 12, started: true } });
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  h.act('next'); assert.equal(h.state().scene, 'm1_cabin');
  assert.equal(h.state().awakening?.elapsed, 0);
  assert.equal(FILM_SCENE_BY_ID.m1_cabin.set, 'film_neb_deck');
});

test('medical recovery ends in a separate cabin and waking preserves its paused and disconnected progress', () => {
  const h = setup(); h.act(); h.frames(121);
  assert.equal(h.state().scene, 'm1_cabin', 'rest must precede the core and Construct');
  assert.equal(h.state().awakening?.started, false);
  const bed = { ...h.neo.position }; h.frames(30); assert.deepEqual(h.neo.position, bed);
  h.act(); h.frames(48);
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)), elapsed = h.state().awakening!.elapsed;
  h.players.step(.5, false, 1); assert.equal(h.state().awakening!.elapsed, elapsed);
  h.sandbox.restore(saved); h.players.release('test', 1); h.frames(30);
  assert.equal(h.state().awakening!.elapsed, elapsed);
  h.players.possess('test', 'neo', 1);
  assert.equal(h.neo.currentAction?.parameters.cabin?.kind, 'wake');
  h.frames(90); assert.equal(h.state().step, 1);
  assert.equal(h.neo.isInMatrix, false);
  h.frames(100); assert.equal(h.state().step, 1, 'Neo must walk with Morpheus, not wait to teleport into the program');
});

test('the cabin doorway collision uses the same saved opening time as the visible door', () => {
  const h = setup(); h.act(); h.frames(121); h.act(); h.frames(108);
  const elapsed = h.state().awakening!.elapsed;
  const fraction = Math.max(0, Math.min(1, (elapsed - 10) / 1.6));
  const expected = filmPosition('film_neb_deck', CABIN.door.x, CABIN.door.z - fraction * fraction * (3 - 2 * fraction) * 4.7);
  const door = h.sandbox.state.structures.find(item => item.id === 'film:cabin:door')!;
  assert.deepEqual(door.position, expected, 'the collider cannot lag a frame behind the visible sliding door');
  h.players.step(.5, false, 1); assert.deepEqual(h.sandbox.state.structures.find(item => item.id === door.id)!.position, expected);
});

test('Neo can walk from the cabin bed through the doorway and core aisle using ordinary player movement', () => {
  const h = setup(); h.act(); h.frames(121); h.act(); h.frames(121);
  let sequence = 0;
  const route = [...CABIN_ROUTE.slice(0, 7), { x: 0, z: -5 }, CABIN.approach];
  for (const point of route) {
    const target = filmPosition('film_neb_deck', point.x, point.z);
    let arrived = false;
    for (let frame = 0; frame < 500; frame++) {
      const dx = target.x - h.neo.position.x, dz = target.z - h.neo.position.z, gap = Math.hypot(dx, dz);
      if (gap < .3 || point === CABIN.approach && h.state().step === 2) { arrived = true; break; }
      h.players.receiveInput('test', { x: dx / Math.max(1, gap), z: dz / Math.max(1, gap), yaw: Math.atan2(dx, dz), jump: false, sprint: false, sequence: ++sequence });
      h.players.step(.05, true, 1);
    }
    assert.ok(arrived, `the walk is blocked before ${point.x}, ${point.z}: ${JSON.stringify(h.neo.position)}`);
  }
  h.players.receiveInput('test', { x: 0, z: 0, yaw: h.neo.rotation, jump: false, sprint: false, sequence: ++sequence });
  h.frames(50); assert.equal(h.state().step, 2); assert.equal(h.state().awakening?.started, false);
});
