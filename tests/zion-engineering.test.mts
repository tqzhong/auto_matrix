import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SCENE_BY_ID, filmPosition, filmStepPosition, playerBlocked, type WorldEvent } from '@auto_matrix/shared';
import { ZionHomecomingRenderer } from '../packages/client/src/engine/ZionHomecomingRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

function game() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 83);
  const conversations = { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine;
  const actions = { execute() {} } as unknown as ActionExecutor, players = new PlayerController(world, conversations, actions, dynamics, sandbox);
  players.possess('p', 'neo', 0); sandbox.life.begin(world.agents.get('neo')!, 0); sandbox.state.neoLife!.chapter = 1;
  players.sandboxAction('p', { kind: 'life', target: 'film:start' }, 1); players.possess('p', 'neo', 2);
  let tick = 2, frames = 0, sequence = 0;
  const command = (target: string) => players.sandboxAction('p', { kind: 'life', target: `film:${target}` }, ++tick);
  Object.assign(sandbox.life.film.state!, { scene: 'm2_bane_copy', actor: 'neo', step: FILM_SCENE_BY_ID.m2_bane_copy.steps.length });
  command('next'); const scene = FILM_SCENE_BY_ID.m2_hamann, actor = () => players.getAgent('p')!;
  const state = () => sandbox.life.film.state!, at = (index: number) => { actor().position = filmStepPosition(scene, scene.steps[index]); };
  const advance = (count: number) => { for (let i = 0; i < count; i++) { world.simulationTick = ++tick; sandbox.tick(tick); } };
  const frame = (count: number, held = false, moving = 0) => {
    for (let i = 0; i < count; i++) {
      players.receiveInput('p', { x: moving, z: 0, yaw: actor().rotation, jump: false, sprint: false, focus: held, sequence: ++sequence });
      players.step(.1, true, tick);
      if (++frames % 5 === 0) advance(1);
    }
  };
  const valve = () => state().engineering?.valve;
  const read = () => { state().step = 1; at(1); command('act'); frame(40); assert.equal(state().step, 2); };
  return { world, sandbox, players, command, actor, state, scene, at, advance, frame, valve, read };
}

test('an old distant reading marker cannot start the new physical control interaction', () => {
  const h = game(); h.state().step = 1; h.actor().position = filmPosition(h.scene.set, -9, -24);
  const answer = h.command('act'); assert.equal(h.state().started, undefined, 'the former four-metre timer must not start away from the control');
  assert.match(answer, /控制台|读数台/);
});

test('a single tap followed by waiting cannot turn the backup valve or award the balanced choice', () => {
  const h = game(); h.read(); h.at(2); h.command('act'); h.advance(14);
  assert.equal(h.state().step, 2, 'the valve requires actual held input rather than the old five-second timer');
  assert.equal(h.valve(), 0); assert.equal(h.sandbox.state.neoLife!.choices.zion_backup_balanced, undefined);
});

test('holding turns the valve, release saves its partial angle, and the same saved angle resumes to one completion', () => {
  const h = game(); h.read(); h.at(2); h.command('act'); h.frame(28, true);
  const partial = h.valve(); assert.ok(partial !== undefined && partial > .2 && partial < 1, 'the actual held turn must save an intermediate angle');
  h.frame(15); assert.equal(h.valve(), partial, 'releasing G leaves the physical valve where it stopped'); assert.equal(h.state().step, 2);
  const saved = structuredClone(h.sandbox.state); h.sandbox.restore(saved); assert.equal(h.valve(), partial);
  h.command('act'); h.frame(50, true); assert.equal(h.valve(), 1); assert.equal(h.state().step, 3);
  assert.equal(h.sandbox.state.neoLife!.choices.zion_backup_balanced, 'yes');
  h.frame(20, true); assert.equal(h.state().step, 3, 'continuing to hold cannot advance the separate reflection');
});

test('paused approach and grip retain complete actor state while movement cancels work and preserves the valve angle', () => {
  const h = game(); h.read(); h.at(2); h.command('act'); h.frame(18, true);
  assert.ok((h.valve() ?? 0) > 0); const before = JSON.stringify(h.actor()), saved = structuredClone(h.sandbox.state);
  h.players.step(.1, false, h.world.simulationTick); assert.equal(JSON.stringify(h.actor()), before);
  h.sandbox.restore(saved); assert.equal(JSON.stringify(h.actor()), before);
  const partial = h.valve(); h.frame(1, true, -1); h.frame(10);
  assert.equal(h.valve(), partial); assert.equal(h.state().step, 2); assert.equal(playerBlocked(h.actor().position, false, 1.1, h.sandbox.state.structures), false);
});

test('leaving the console discards an incomplete reading and a fresh check can finish it', () => {
  const h = game(); h.state().step = 1; h.at(1); h.command('act'); h.frame(17);
  assert.ok(h.state().engineering!.readings > 0 && h.state().engineering!.readings < 1);
  h.frame(1, false, 1); h.frame(45);
  assert.equal(h.state().engineering!.readings, 0); assert.equal(h.state().step, 1);
  h.at(1); h.command('act'); h.frame(40); assert.equal(h.state().step, 2); assert.equal(h.state().engineering!.readings, 1);
});

test('retry discards an unconfirmed reading but preserves confirmed readings, saved valve angle and earlier choices', () => {
  const h = game(); h.state().step = 1; h.at(1); h.command('act'); h.frame(17); h.command('retry');
  assert.equal(h.state().engineering!.readings, 0); assert.equal(h.state().engineering!.operation, undefined);
  h.command('act'); h.frame(40); h.at(2); h.command('act'); h.frame(18, true);
  const partial = h.valve(), choices = structuredClone(h.sandbox.state.neoLife!.choices);
  h.actor().status = 'dead'; h.actor().health = 0; h.command('retry');
  assert.equal(h.actor().status, 'alive'); assert.equal(h.state().engineering!.readings, 1); assert.equal(h.valve(), partial);
  assert.deepEqual(h.sandbox.state.neoLife!.choices, choices); assert.equal(h.state().step, 2);
});

test('an old timer save resumes on the safe side of the rail without healing or running the remaining valve automatically', () => {
  const h = game(); h.advance(20); const neo = h.actor(); h.players.release('p', h.world.simulationTick);
  h.state().step = 2; delete h.state().engineering; h.state().started = h.world.simulationTick - 4;
  neo.position = filmPosition(h.scene.set, -9, -24); neo.health = 37;
  h.sandbox.restore(structuredClone(h.sandbox.state));
  assert.equal(h.state().started, undefined); assert.equal(h.state().step, 2); assert.equal(neo.health, 37);
  assert.equal(neo.position.x, filmPosition(h.scene.set, -5.9, -24).x);
  assert.equal(neo.position.z, filmPosition(h.scene.set, -5.9, -24).z);
  assert.equal(h.valve(), .4); const partial = h.valve(); h.players.possess('p', 'neo', h.world.simulationTick); h.frame(30);
  assert.equal(h.valve(), partial); assert.equal(h.state().step, 2);
});

test('the former idle Hamann staging leaves room for the real console without moving controlled or dead guides', () => {
  for (const mode of ['idle', 'controlled', 'dead'] as const) {
    const h = game(), guide = h.world.agents.get('hamann')!; h.players.release('p', h.world.simulationTick); delete h.state().engineering;
    guide.position = filmPosition(h.scene.set, -7, -23); guide.health = mode === 'dead' ? 0 : 81; guide.status = mode === 'dead' ? 'dead' : 'alive'; guide.currentAction = null;
    if (mode === 'controlled') guide.controller = 'player'; const previous = structuredClone(guide);
    h.sandbox.restore(structuredClone(h.sandbox.state));
    assert.equal(guide.health, previous.health); assert.equal(guide.status, previous.status);
    assert.deepEqual(guide.position, mode === 'idle' ? filmPosition(h.scene.set, -3, -26) : previous.position);
  }
});

test('the accessible console and handwheel stand beside supported, unblocked bridge interaction points', t => {
  const root = new THREE.Group(), renderer = new ZionHomecomingRenderer(root, 'film_zion_engineering'); t.after(() => renderer.dispose()); root.updateMatrixWorld(true);
  for (const [name, index] of [['zion-air-water-console', 1], ['zion-backup-handwheel', 2]] as const) {
    const control = root.getObjectByName(name); assert.ok(control, 'the interaction needs a visible reachable physical control');
    const target = filmStepPosition(FILM_SCENE_BY_ID.m2_hamann, FILM_SCENE_BY_ID.m2_hamann.steps[index]);
    const local = { x: target.x - filmPosition('film_zion_engineering').x, z: target.z - filmPosition('film_zion_engineering').z };
    assert.ok(Math.abs(local.x - control.position.x) < 1.6 && Math.abs(local.z - control.position.z) < .2);
    assert.equal(playerBlocked(target, false, 1.1), false);
  }
});

test('the wheel and delivered readings follow saved progress and stay fixed across renderer clocks and restoration', t => {
  const root = new THREE.Group(), renderer = new ZionHomecomingRenderer(root, 'film_zion_engineering'); t.after(() => renderer.dispose());
  const journey = { scene: 'm2_hamann', step: 2, completed: [], engineering: { readings: 1, valve: .4, elapsed: 1, operation: 'valve' } } as never;
  renderer.update(journey, 0); const wheel = root.getObjectByName('zion-backup-handwheel'), screen = root.getObjectByName('zion-engineering-screen');
  assert.ok(wheel && screen, 'device feedback must exist on the actual set'); const angle = wheel.rotation.x, readings = JSON.stringify(screen.userData.readings);
  assert.ok(angle > .1); assert.match(readings, /air|water|heat/); renderer.update(structuredClone(journey), 300);
  assert.equal(wheel.rotation.x, angle, 'browser uptime cannot keep turning a paused valve'); assert.equal(JSON.stringify(screen.userData.readings), readings);
});
