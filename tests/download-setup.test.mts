import assert from 'node:assert/strict';
import test from 'node:test';
import { CABIN, CABIN_ROUTE, CABIN_ROUTE_LENGTH, cabinGuidePose, downloadRoot, filmPosition, type WorldEvent } from '@auto_matrix/shared';
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
  act('continue'); Object.assign(sandbox.life.film.state!, { scene: 'm1_truth_return', actor: 'neo', step: 3, truthRecovery: undefined }); act('next');
  const frames = (count: number) => { for (let i = 0; i < count; i++) players.step(.1, true, 1); };
  return { world, sandbox, players, act, frames, neo: world.agents.get('neo')!, state: () => sandbox.life.film.state! };
}

test('training starts at the cabin, waits for Neo, and requires reaching the chair before uploading', () => {
  const h = setup(), bed = filmPosition('film_neb_deck', CABIN.bed.x, CABIN.bed.z);
  assert.ok(Math.hypot(h.neo.position.x - bed.x, h.neo.position.z - bed.z) < .1, 'the bedside answer cannot teleport Neo into the download chair');
  assert.equal(h.state().downloadSetup?.phase, 'greeting');
  h.frames(40); h.act('next'); assert.equal(h.state().downloadSetup?.phase, 'greeting');
  h.act(); h.frames(119);
  const doorway = filmPosition('film_neb_deck', CABIN.door.x, CABIN.door.z);
  assert.ok(Math.abs(h.neo.rotation - Math.atan2(doorway.x - h.neo.position.x, doorway.z - h.neo.position.z)) < .01,
    'Neo turns toward Tank and the doorway before walking is released');
  h.frames(2); assert.equal(h.state().downloadSetup?.phase, 'walk');
  h.act(); assert.equal(h.state().training!.started, false, 'remote G cannot start a neural connection');
  const before = h.state().downloadSetup!.progress;
  h.neo.position = filmPosition('film_neb_deck', -16, 38); h.frames(50);
  assert.equal(h.state().downloadSetup!.progress, before, 'Tank waits for Neo');
  for (let i = 0; i < 500 && h.state().downloadSetup!.progress < CABIN_ROUTE_LENGTH; i++) {
    const guide = cabinGuidePose(h.state().downloadSetup!.progress);
    h.neo.position = filmPosition('film_neb_deck', guide.x, guide.z); h.frames(1);
  }
  h.neo.position = filmPosition('film_neb_deck', CABIN.approach.x, CABIN.approach.z); h.act();
  assert.equal(h.state().downloadSetup?.phase, 'connecting'); h.frames(110);
  assert.equal(h.state().downloadSetup?.phase, 'ready'); assert.equal(h.state().training!.started, false);
  h.act(); h.frames(110); assert.equal(h.state().step, 1); assert.equal(h.state().training!.elapsed, 10);
});

test('Tank cannot be stolen and training preparation survives pause, disconnection and reload', () => {
  const h = setup(); h.players.possess('other', 'tank', 1); h.act();
  assert.equal(h.state().downloadSetup?.phase, 'greeting');
  h.players.release('other', 1); h.act(); h.frames(45);
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)), elapsed = h.state().downloadSetup!.elapsed, position = { ...h.neo.position };
  h.players.step(.5, false, 1); assert.equal(h.state().downloadSetup!.elapsed, elapsed);
  h.sandbox.restore(saved); h.players.release('test', 1); h.frames(30); h.players.possess('test', 'neo', 1);
  assert.equal(h.state().downloadSetup!.elapsed, elapsed); assert.deepEqual(h.neo.position, position);
  h.act('retry'); assert.equal(h.state().downloadSetup!.elapsed, elapsed);
  h.players.possess('other', 'tank', 1); h.frames(25); assert.equal(h.state().downloadSetup!.elapsed, elapsed);
});

test('a saved upload already in progress does not replay the new cabin introduction', () => {
  const h = setup(); delete h.state().downloadSetup;
  h.state().training = { kind: 'download', elapsed: 4.5, started: true };
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); h.frames(1);
  assert.equal(h.state().downloadSetup, undefined); assert.ok(h.state().training!.elapsed > 4.5);
});

test('a completed upload holds Neo in the chair until he chooses the dojo, including after loading', () => {
  const h = setup(); h.state().downloadSetup = { phase: 'ready', elapsed: 0, progress: CABIN_ROUTE_LENGTH };
  h.state().training = { kind: 'download', elapsed: 9.95, started: true }; h.frames(1);
  assert.equal(h.state().step, 1); const chair = { ...h.neo.position };
  h.players.receiveInput('test', { x: 0, z: 1, yaw: 0, jump: true, sprint: false, sequence: 1 }); h.frames(15);
  assert.deepEqual(h.neo.position, chair, 'finishing cannot enable walking from inside the chair');
  assert.equal(h.neo.currentAction?.parameters.seated, true, 'the finished pose cannot become a standing body inside the chair');
  delete h.state().downloadSetup;
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); h.frames(1);
  assert.equal(h.neo.currentAction?.parameters.training?.kind, 'download', 'legacy completed uploads retain their seated pose');
  h.act('next'); assert.equal(h.state().scene, 'm1_dojo', 'holding the pose cannot block continuing to the dojo');
});

test('Neo can follow Tank through the physical cabin doorway and sit using ordinary movement', () => {
  const h = setup(); h.act(); h.frames(121); let sequence = 0;
  for (const point of [...CABIN_ROUTE.slice(0, 7), { x: 0, z: -5 }, CABIN.approach]) {
    const target = filmPosition('film_neb_deck', point.x, point.z); let arrived = false;
    for (let frame = 0; frame < 500; frame++) {
      const dx = target.x - h.neo.position.x, dz = target.z - h.neo.position.z, gap = Math.hypot(dx, dz);
      if (gap < .3) { arrived = true; break; }
      h.players.receiveInput('test', { x: dx / Math.max(1, gap), z: dz / Math.max(1, gap), yaw: Math.atan2(dx, dz), jump: false, sprint: false, sequence: ++sequence });
      h.players.step(.05, true, 1);
    }
    assert.ok(arrived, `the walk is blocked before ${point.x}, ${point.z}: ${JSON.stringify(h.neo.position)}`);
  }
  h.players.receiveInput('test', { x: 0, z: 0, yaw: h.neo.rotation, jump: false, sprint: false, sequence: ++sequence });
  h.frames(60); assert.equal(h.state().downloadSetup!.progress, CABIN_ROUTE_LENGTH);
  const tank = downloadRoot(h.state().downloadSetup!, 'tank'); h.act();
  assert.equal(h.state().downloadSetup?.phase, 'connecting');
  const connected = downloadRoot(h.state().downloadSetup!, 'tank');
  assert.ok(Math.hypot(tank.x - connected.x, tank.z - connected.z) < .01, 'Tank cannot snap sideways when Neo sits down');
  h.frames(101); h.act(); h.frames(101); assert.equal(h.state().step, 1);
});
