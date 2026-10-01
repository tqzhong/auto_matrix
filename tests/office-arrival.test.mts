import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SETS, filmStepPosition, officeOccluded, playerBlocked, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

function setup(pickupWait = 3) {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const players = new PlayerController(world, { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine, {} as ActionExecutor, dynamics, sandbox);
  players.possess('neo-player', 'neo', 0); sandbox.life.begin(world.agents.get('neo')!, 0); sandbox.state.neoLife!.chapter = 2;
  let tick = 0;
  const command = (target: string) => players.sandboxAction('neo-player', { kind: 'life', target: `film:${target}` }, ++tick);
  const frame = (seconds: number, running = true) => { for (let i = 0; i < Math.round(seconds * 20); i++) players.step(.05, running, tick); };
  const state = () => sandbox.life.film.state!;
  const neo = world.agents.get('neo')!;
  const goal = () => { neo.position = filmStepPosition(sandbox.life.film.scene!, sandbox.life.film.step!); };
  command('continue'); goal(); command('act'); frame(10); command('act');
  goal(); command('act'); frame(11); command('act'); frame(4.1);
  goal(); command('act'); frame(pickupWait);
  assert.equal(state().phone?.phase, 'ready');
  const guards = () => sandbox.state.threats.filter(threat => threat.id.startsWith('office:'));
  return { world, sandbox, players, command, frame, state, neo, guards, tick: () => tick };
}

test('agents arrive through the elevator during the call, before the escape objective exists', () => {
  const h = setup(); assert.equal(h.guards().length, 0);
  h.command('act'); h.frame(.1);
  const starts = h.guards().map(guard => ({ ...guard.position }));
  assert.equal(starts.length, 3, 'the agents must already be physical bodies during the phone call');
  assert.deepEqual(h.guards().map(guard => guard.character), ['smith', 'agent_brown', 'agent_jones']);
  const center = FILM_SETS.film_metacortex_floor.center;
  assert.ok(starts.every(position => position.z < center.z - 26 && Math.abs(position.x - center.x) < 2), 'they begin inside the elevator, not beside Anderson');
  h.frame(5.9);
  assert.equal(h.state().scene, 'm1_boss'); assert.equal(h.state().step, 1);
  assert.ok(h.guards().every((guard, i) => guard.position.z > starts[i].z + 4), 'the group walks out into the floor');
  assert.ok(h.guards().some(guard => !officeOccluded({ ...h.neo.position, y: h.neo.position.y + 3 }, { ...guard.position, y: guard.position.y + 2.9 }, center)), 'looking towards the elevator reveals an agent');
  assert.equal(h.state().office?.alert, 0, 'the phone-locked player cannot be captured while receiving the instructions');
  assert.equal(h.neo.health, 100);
});

test('arrival keeps its positions across pause, disconnect, save and the start of patrol', () => {
  const h = setup(); h.command('act'); h.frame(4.4);
  assert.equal(h.guards().length, 3);
  const before = structuredClone({ phone: h.state().phone, guards: h.guards(), lift: h.sandbox.state.neoLife!.lift });
  h.frame(2, false);
  assert.deepEqual({ phone: h.state().phone, guards: h.guards(), lift: h.sandbox.state.neoLife!.lift }, before);
  h.players.release('neo-player', h.tick()); h.frame(2); h.sandbox.tick(h.tick() + 50);
  assert.deepEqual({ phone: h.state().phone, guards: h.guards(), lift: h.sandbox.state.neoLife!.lift }, before);
  h.sandbox.restore(structuredClone(h.sandbox.state));
  assert.deepEqual({ phone: h.state().phone, guards: h.guards(), lift: h.sandbox.state.neoLife!.lift }, before, 'restoring must preserve the elevator entrance before a player reconnects');
  h.players.possess('neo-player', 'neo', h.tick());
  assert.deepEqual({ phone: h.state().phone, guards: h.guards(), lift: h.sandbox.state.neoLife!.lift }, before);
  h.frame(8); assert.equal(h.state().phone?.phase, 'connected');
  const positions = h.guards().map(guard => ({ id: guard.id, character: guard.character, position: { ...guard.position }, yaw: guard.yaw }));
  h.command('next'); assert.equal(h.state().scene, 'm1_office_escape');
  assert.deepEqual(h.guards().map(guard => ({ id: guard.id, character: guard.character, position: guard.position, yaw: guard.yaw })), positions, 'starting patrol must not respawn the agents at new positions');
  for (let i = 1; i <= 6; i++) h.sandbox.tick(h.tick() + i);
  assert.equal(h.state().office?.alert, 0); assert.equal(h.state().office?.outcome, undefined);
});

test('another player controlling an arriving agent pauses the call without creating a duplicate', () => {
  const h = setup(); h.players.possess('smith-player', 'smith', h.tick());
  const smith = h.world.agents.get('smith')!; const position = { ...smith.position };
  h.command('act'); h.frame(4);
  assert.equal(h.state().phone?.elapsed, 0, 'the stage cannot advance while a required agent belongs to another player');
  assert.equal(h.guards().length, 0); assert.deepEqual(smith.position, position);
  assert.match(h.state().lastText, /玩家/);
  h.players.release('smith-player', h.tick()); h.frame(3);
  assert.equal(h.guards().length, 3); assert.ok(h.state().phone!.elapsed > 2.9);
  assert.match(h.players.possess('smith-player', 'smith', h.tick()).error!, /剧情/);
});

test('returning to the office checkpoint preserves the call and the arrived agents', () => {
  const h = setup(); h.command('act'); h.frame(6);
  assert.equal(h.guards().length, 3);
  const before = structuredClone({ phone: h.state().phone, guards: h.guards(), lift: h.sandbox.state.neoLife!.lift });
  h.command('retry');
  assert.deepEqual({ phone: h.state().phone, guards: h.guards(), lift: h.sandbox.state.neoLife!.lift }, before);
  h.frame(.5); assert.ok(h.state().phone!.elapsed > before.phone!.elapsed);
});

test('an old phone save without arriving agents resumes at its saved call age', () => {
  const h = setup(); h.command('act'); h.frame(4.4);
  const expected = h.guards().map(guard => ({ ...guard.position }));
  assert.equal(expected.length, 3);
  const saved = structuredClone(h.sandbox.state);
  saved.threats = saved.threats.filter(threat => !threat.id.startsWith('office:'));
  delete saved.neoLife!.journey!.office;
  h.players.release('neo-player', h.tick());
  h.sandbox.restore(saved); h.players.possess('neo-player', 'neo', h.tick());
  assert.deepEqual(h.guards().map(guard => guard.position), expected, 'migration must place the actors at the saved time, rather than replaying the elevator entrance');
  assert.equal(h.state().phone!.elapsed, saved.neoLife!.journey!.phone!.elapsed);
});

test('arrival walks through open doors and stays clear of furniture, shaft walls and other agents', () => {
  for (const pickupWait of [2.25, 3, 15]) {
    const h = setup(pickupWait); h.command('act');
    const center = FILM_SETS.film_metacortex_floor.center;
    let previous = h.guards().map(guard => ({ ...guard.position }));
    assert.equal(previous.length, 3);
    for (let sample = 0; sample < 220; sample++) {
      h.frame(.05);
      const guards = h.guards(); assert.equal(guards.length, 3);
      guards.forEach((guard, i) => {
        assert.equal(playerBlocked(guard.position, true, .7, h.sandbox.state.structures), false, `agent ${i} at phone age ${h.state().phone!.elapsed}`);
        assert.ok(Math.hypot(guard.position.x - previous[i].x, guard.position.z - previous[i].z) <= .106, 'the arrival cannot teleport between frames');
        if (guard.position.z > center.z - 26.5) assert.equal(h.sandbox.state.neoLife!.lift?.phase, 'idle', 'doors must be completely open before a body passes through');
        for (const other of guards.slice(i + 1)) assert.ok(Math.hypot(guard.position.x - other.position.x, guard.position.z - other.position.z) > 1.7,
          `${guard.id} and ${other.id} need separate body space at phone age ${h.state().phone!.elapsed}: ${JSON.stringify([guard.position, other.position])}`);
        const courier = h.world.agents.get('courier')!;
        assert.ok(Math.hypot(guard.position.x - courier.position.x, guard.position.z - courier.position.z) > 1.7, `agent ${i} cannot walk through the departing courier at age ${h.state().phone!.elapsed}`);
      });
      previous = guards.map(guard => ({ ...guard.position }));
    }
  }
});
