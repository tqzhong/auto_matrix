import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AIR_RESCUE,
  FILM_SCENE_BY_ID,
  airRescueLocked,
  airRescuePose,
  airRescueRoot,
  filmEntry,
  type AgentState,
  type AirRescueEncounter,
  type CombatImpact,
  type WorldEvent,
} from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

function setup(sceneId: 'm1_helicopter' | 'm1_rooftop_rescue') {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 43); const impacts: CombatImpact[] = [];
  sandbox.onImpact = impact => impacts.push(impact);
  const conversations = { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine;
  const actions = { execute() {} } as unknown as ActionExecutor;
  const players = new PlayerController(world, conversations, actions, dynamics, sandbox);
  const neo = world.agents.get('neo')!; players.possess('air-player', 'neo', 0); sandbox.life.begin(neo, 0);
  const scene = FILM_SCENE_BY_ID[sceneId];
  sandbox.state.neoLife!.journey = {
    version: 1, scene: scene.id, step: 0, actor: 'neo', completed: [], enteredAt: 0,
    checkpoint: filmEntry(scene), reflections: {}, lastText: scene.context,
    airRescue: sceneId === 'm1_helicopter'
      ? { kind: 'office', phase: 'ready', elapsed: 0, attempt: 0, suppression: 0 }
      : { kind: 'roof', phase: 'ready', elapsed: 0, attempt: 0, grip: 1, braces: 0, misses: 0, resolved: [] },
  };
  neo.currentLocation = scene.set; neo.isInMatrix = true; neo.position = filmEntry(scene);
  let tick = 0; let sequence = 0;
  const command = (target: string) => players.sandboxAction('air-player', { kind: 'life', target: `film:${target}` }, ++tick);
  const frames = (seconds: number, focus = false, running = true) => {
    for (let i = 0; i < Math.ceil(seconds * 10); i++) {
      players.receiveInput('air-player', { x: 0, z: 0, yaw: neo.rotation, jump: false, sprint: false, focus, sequence: ++sequence });
      players.step(.1, running, ++tick);
    }
  };
  return { world, sandbox, players, actor: neo, scene, command, frames, impacts, tick: () => tick };
}

test('Neo actively suppresses the office and catches Morpheus through a saved leap window', () => {
  assert.equal(FILM_SCENE_BY_ID.m1_helicopter.actor, 'neo');
  const h = setup('m1_helicopter'); const state = h.sandbox.life.film.state!;
  assert.match(h.command('act'), /机枪|救援绳/); assert.equal(state.airRescue!.phase, 'approach');
  h.frames(AIR_RESCUE.office.approach + .2); assert.equal(state.airRescue!.phase, 'firing');
  h.frames(1, false); assert.equal(state.airRescue!.suppression, 0, 'waiting cannot fire the mounted weapon');
  h.frames(1.6, true); const saved = structuredClone(h.sandbox.state); const suppression = state.airRescue!.suppression!;
  h.frames(1, true, false); assert.equal(state.airRescue!.suppression, suppression, 'pause freezes gun and helicopter clocks');
  h.sandbox.restore(saved); h.players.release('air-player', h.tick());
  for (let i = 0; i < 20; i++) h.sandbox.tick(h.tick() + i + 1);
  assert.equal(h.sandbox.life.film.state!.airRescue!.suppression, suppression, 'disconnect cannot finish the rescue');
  assert.deepEqual(h.players.possess('air-player', 'neo', h.tick()), { agentId: 'neo' });
  for (let frame = 0; frame < 50 && h.sandbox.life.film.state!.airRescue!.phase === 'firing'; frame++) h.frames(.1, true);
  assert.equal(h.sandbox.life.film.state!.airRescue!.phase, 'leap_window');
  h.frames(Math.max(0, AIR_RESCUE.office.leapAt - h.sandbox.life.film.state!.airRescue!.elapsed));
  assert.match(h.players.act('air-player', 'dodge', h.tick()), /抓住|跃出/);
  assert.equal(h.sandbox.life.film.state!.airRescue!.phase, 'catching'); h.frames(AIR_RESCUE.office.catching + .2);
  assert.ok(h.sandbox.life.film.state!.completed.includes('m1_helicopter')); assert.equal(h.sandbox.life.film.state!.airRescue!.phase, 'done');
  assert.ok(h.impacts.some(impact => impact.source === 'neo' && impact.target === 'government-glass'), 'mounted fire uses the shared impact renderer');
});

test('missing Morpheus fails explicitly and retry restores the helicopter checkpoint', () => {
  const h = setup('m1_helicopter'); const state = h.sandbox.life.film.state!;
  h.command('act'); h.frames(AIR_RESCUE.office.approach + AIR_RESCUE.office.fire + .5, true);
  assert.equal(state.airRescue!.phase, 'leap_window'); h.frames(AIR_RESCUE.office.leapWindow + .2, true);
  assert.equal(state.airRescue!.phase, 'failed'); assert.equal(h.actor.status, 'dead');
  assert.match(h.command('retry'), /重试/); assert.equal(h.actor.status, 'alive'); assert.equal(state.airRescue!.phase, 'ready');
  assert.equal(state.airRescue!.attempt, 1); assert.equal(state.airRescue!.suppression, 0);
});

test('roof rescue requires a held rope and two of three timed braces before Neo pulls Trinity up', () => {
  const h = setup('m1_rooftop_rescue'); const state = h.sandbox.life.film.state!;
  assert.match(h.command('act'), /绳索|Trinity/); h.frames(AIR_RESCUE.roof.impact + .2, true);
  assert.equal(state.airRescue!.phase, 'bracing'); assert.equal(airRescueLocked(state), true);
  for (let index = 0; index < AIR_RESCUE.roof.beats.length; index++) {
    const encounter = state.airRescue!; const beat = AIR_RESCUE.roof.beats[index];
    h.frames(Math.max(0, beat - encounter.elapsed), true);
    if (index !== 1) assert.match(h.players.act('air-player', 'dodge', h.tick()), /稳住|卸掉/);
    h.frames(AIR_RESCUE.roof.window * 2 + .05, true);
  }
  if (state.airRescue!.phase === 'bracing') h.frames(Math.max(0, AIR_RESCUE.roof.duration - state.airRescue!.elapsed) + .1, true);
  assert.equal(state.airRescue!.braces, 2); assert.equal(state.airRescue!.misses, 1); assert.equal(state.airRescue!.phase, 'pulling');
  h.frames(AIR_RESCUE.roof.pulling + .2, true);
  assert.ok(state.completed.includes('m1_rooftop_rescue')); assert.equal(state.airRescue!.phase, 'done');
  assert.ok(h.impacts.some(impact => impact.source === 'trinity' && impact.target === 'helicopter-rope'), 'Trinity cutting free is a visible saved impact');
  assert.ok(h.impacts.some(impact => impact.source === 'helicopter' && impact.target === 'glass-facade'), 'the crash reaches the shared debris pipeline');
});

test('letting go or missing two roof shocks fails and retry clears the rope state', () => {
  const h = setup('m1_rooftop_rescue'); const state = h.sandbox.life.film.state!;
  h.command('act'); h.frames(AIR_RESCUE.roof.impact + AIR_RESCUE.roof.duration + .5, false);
  assert.equal(state.airRescue!.phase, 'failed'); assert.equal(h.actor.status, 'dead');
  h.command('retry'); assert.equal(state.airRescue!.phase, 'ready'); assert.equal(state.airRescue!.attempt, 1);
  assert.equal(state.airRescue!.grip, 1); assert.equal(state.airRescue!.braces, 0); assert.deepEqual(state.airRescue!.resolved, []);
});

test('air rescue poses preserve the mounted gun, falling catch and roof rope strain', () => {
  const office: AirRescueEncounter = { kind: 'office', phase: 'firing', elapsed: 2, attempt: 0, suppression: .6 };
  const neo = airRescuePose({ ...office, role: 'neo' }); assert.ok(neo.gun > .8 && neo.harness > .4);
  const morpheus = airRescuePose({ ...office, phase: 'catching', elapsed: 2.1, role: 'morpheus' }); assert.ok(morpheus.fall > .6 && morpheus.reach > .6);
  const roof: AirRescueEncounter = { kind: 'roof', phase: 'bracing', elapsed: 3.3, attempt: 0, grip: .7, braces: 1, misses: 0, resolved: [0] };
  const bracing = airRescuePose({ ...roof, role: 'neo' }); assert.ok(bracing.rope > .8 && bracing.strain > .2);
  assert.ok(airRescueRoot(office, 'neo').y > 2, 'Neo remains on the airborne B-212 cabin floor during suppression');
  const rooftopNeo = airRescueRoot(roof, 'neo'); const hanging = airRescueRoot(roof, 'trinity');
  assert.ok(rooftopNeo.x < -26 && rooftopNeo.x > -31, 'Neo braces at the west parapet instead of pulling the rope through the roof deck');
  assert.ok(hanging.y < 0 && hanging.x < -31, 'Trinity hangs beyond the west parapet instead of passing through the roof deck');
  assert.ok(Math.abs(rooftopNeo.x - hanging.x) < 9, 'the visible rope crosses the parapet beside Neo');
  const crashSwing = airRescueRoot({ ...roof, phase: 'pulling', elapsed: 3.4, ropeCut: true, crash: true }, 'trinity');
  assert.ok(crashSwing.x < -34 && crashSwing.y < 0, 'Trinity rises outside the parapet before Neo pulls her across it');
  const landed = airRescueRoot({ ...roof, phase: 'done', elapsed: AIR_RESCUE.roof.pulling }, 'trinity');
  assert.ok(landed.x > -29 && landed.y === 0, 'Trinity crosses the parapet only at the end of the pull');
});

test('office performers stay attached to the moving B-212 controls before the catch', () => {
  const firing: AirRescueEncounter = { kind: 'office', phase: 'firing', elapsed: 1.8, attempt: 0, suppression: .5 };
  const neo = airRescueRoot(firing, 'neo'); const trinity = airRescueRoot(firing, 'trinity');
  assert.ok(Math.hypot(neo.x - -.9, neo.z - -35.6) < .8, 'Neo belongs in the open side doorway behind the minigun, not on top of the hull');
  assert.ok(neo.y > 2 && neo.y < 3, 'Neo feet stay on the cabin floor while his hands meet the gun controls');
  assert.ok(Math.hypot(trinity.x - 5.25, trinity.z - -33.6) < .8, 'Trinity belongs in the cockpit seat');
  const approach: AirRescueEncounter = { ...firing, phase: 'approach', elapsed: 1.3, suppression: 0 };
  assert.ok(airRescueRoot(approach, 'neo').x > airRescueRoot(firing, 'neo').x + 6, 'the gunner follows the aircraft through its approach');
});

test('another player cannot take an actor required by a locked air rescue', () => {
  const h = setup('m1_helicopter'); h.command('act'); h.frames(.5, true);
  assert.match(h.players.possess('other', 'trinity', h.tick()).error!, /直升机|营救/);
  assert.equal(h.world.agents.get('trinity')!.controller, undefined);
});
