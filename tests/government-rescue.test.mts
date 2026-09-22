import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FILM_SCENE_BY_ID,
  GOVERNMENT_RESCUE,
  filmPosition,
  filmStepPosition,
  governmentLocked,
  governmentPose,
  governmentRoot,
  type AgentState,
  type CombatImpact,
  type GovernmentRescueEncounter,
  type WorldEvent,
} from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

function setup(sceneId: 'm1_smith_question' | 'm1_bullet_dodge') {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const impacts: CombatImpact[] = []; sandbox.onImpact = impact => impacts.push(impact);
  const conversations = { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine;
  const actions = { execute() {} } as unknown as ActionExecutor;
  const players = new PlayerController(world, conversations, actions, dynamics, sandbox);
  const neo = world.agents.get('neo')!; players.possess('film-player', 'neo', 0); sandbox.life.begin(neo, 0);
  const scene = FILM_SCENE_BY_ID[sceneId]; const actor = world.agents.get(scene.actor)!;
  sandbox.state.neoLife!.journey = {
    version: 1, scene: scene.id, step: 0, actor: scene.actor, completed: [], enteredAt: 0,
    checkpoint: filmStepPosition(scene, scene.steps[0]), reflections: {}, lastText: scene.context,
    government: { kind: sceneId === 'm1_smith_question' ? 'questioning' : 'rooftop', phase: 'ready', elapsed: 0, attempt: 0,
      resolve: sceneId === 'm1_smith_question' ? 1 : undefined, dodges: sceneId === 'm1_bullet_dodge' ? 0 : undefined,
      wounds: sceneId === 'm1_bullet_dodge' ? 0 : undefined, resolved: sceneId === 'm1_bullet_dodge' ? [] : undefined },
  };
  players.release('film-player', 0); players.possess('film-player', scene.actor, 0);
  actor.currentLocation = scene.set; actor.isInMatrix = true; actor.position = filmStepPosition(scene, scene.steps[0]);
  let tick = 0; let sequence = 0;
  const command = (target: string) => players.sandboxAction('film-player', { kind: 'life', target: `film:${target}` }, ++tick);
  const frames = (seconds: number, focus = false, running = true) => {
    for (let i = 0; i < Math.ceil(seconds * 10); i++) {
      players.receiveInput('film-player', { x: 0, z: 0, yaw: actor.rotation, jump: false, sprint: false, focus, sequence: ++sequence });
      players.step(.1, running, ++tick);
    }
  };
  return { world, sandbox, players, actor, scene, command, frames, impacts, tick: () => tick };
}

test('Smith questioning is a saved resistance performance, not an instant reflection', () => {
  const h = setup('m1_smith_question'); const state = h.sandbox.life.film.state!;
  assert.equal(state.government!.phase, 'ready');
  assert.match(h.command('reflect:agency'), /按住 G/); assert.equal(state.step, 0);
  assert.equal(state.government!.phase, 'monologue'); assert.equal(governmentLocked(state), true);
  h.frames(3, true); const saved = structuredClone(h.sandbox.state); const elapsed = state.government!.elapsed;
  h.frames(1, true, false); assert.equal(state.government!.elapsed, elapsed, 'pause freezes the exact interrogation beat');
  h.sandbox.restore(saved); h.players.release('film-player', h.tick());
  for (let i = 0; i < 20; i++) h.sandbox.tick(h.tick() + i + 1);
  assert.equal(h.sandbox.life.film.state!.government!.elapsed, elapsed, 'disconnecting cannot finish the interrogation');
  h.players.possess('film-player', 'morpheus', h.tick()); h.frames(GOVERNMENT_RESCUE.questioning.monologue, true);
  assert.equal(h.sandbox.life.film.state!.step, 1); assert.equal(h.sandbox.life.film.state!.government!.phase, 'alarm_ready');
  assert.equal(Boolean(h.world.agents.get('morpheus')!.currentAction?.parameters.government), false,
    'the locked interrogation performance is released between the two authored objectives');
});

test('letting Morpheus resistance collapse fails explicitly and retry restores the same checkpoint', () => {
  const h = setup('m1_smith_question'); const state = h.sandbox.life.film.state!;
  h.command('reflect:care'); h.frames(GOVERNMENT_RESCUE.questioning.failure + .5, false);
  assert.equal(state.government!.phase, 'failed'); assert.equal(state.step, 0); assert.equal(h.actor.status, 'dead');
  const checkpoint = { ...state.checkpoint };
  assert.match(h.command('retry'), /重试/); assert.equal(h.actor.status, 'alive'); assert.equal(h.actor.health, h.actor.maxHealth);
  assert.deepEqual(h.actor.position, checkpoint); assert.equal(state.government!.phase, 'ready'); assert.equal(state.government!.attempt, 1);
  assert.equal(state.reflections['m1_smith_question:0'], 'care', 'retry keeps the philosophical answer without awarding it twice');
});

test('alarm, sprinklers and returning agents finish the interrogation only after the player starts them', () => {
  const h = setup('m1_smith_question'); const state = h.sandbox.life.film.state!;
  h.command('reflect:trust'); h.frames(GOVERNMENT_RESCUE.questioning.monologue + .2, true);
  h.frames(10, true); assert.equal(state.step, 1); assert.equal(state.government!.phase, 'alarm_ready');
  h.actor.position = filmStepPosition(h.scene, h.scene.steps[1]); h.command('act');
  assert.equal(state.government!.phase, 'alarm'); assert.equal(governmentLocked(state), true);
  h.frames(GOVERNMENT_RESCUE.questioning.alarm + .2);
  assert.equal(state.step, h.scene.steps.length); assert.ok(state.completed.includes(h.scene.id)); assert.equal(state.government!.phase, 'done');
  for (const id of ['morpheus', 'smith', 'agent_brown', 'agent_jones']) {
    assert.equal(h.world.agents.get(id)!.currentAction?.parameters.government?.phase, 'done', `${id} stays in the resolved composition until the player continues`);
  }
});

test('Neo must hit two of three bullet-time dodge windows before Trinity can finish Jones', () => {
  const h = setup('m1_bullet_dodge'); const state = h.sandbox.life.film.state!;
  assert.match(h.command('act'), /开火/); h.frames(GOVERNMENT_RESCUE.rooftop.opening + .2);
  assert.equal(state.government!.phase, 'bullet_time'); assert.equal(governmentLocked(state), true);
  for (let index = 0; index < GOVERNMENT_RESCUE.rooftop.beats.length; index++) {
    const encounter = state.government!; const beat = GOVERNMENT_RESCUE.rooftop.beats[index];
    h.frames(Math.max(0, beat - encounter.elapsed));
    if (index !== 1) assert.match(h.players.act('film-player', 'dodge', h.tick()), /闪过|贴身掠过/);
    h.frames(GOVERNMENT_RESCUE.rooftop.window * 2 + .05);
  }
  if (state.government!.phase === 'bullet_time') h.frames(Math.max(0, GOVERNMENT_RESCUE.rooftop.finish - state.government!.elapsed) + .1);
  assert.equal(state.government!.dodges, 2); assert.equal(state.government!.wounds, 1);
  assert.equal(state.government!.phase, 'trinity'); assert.ok(h.actor.health < h.actor.maxHealth, 'the missed line leaves a saved graze');
  h.frames(GOVERNMENT_RESCUE.rooftop.trinity + .2);
  assert.equal(state.step, 1); assert.equal(state.government!.phase, 'download_ready');
  assert.equal(h.world.agents.get('agent_jones')!.currentAction, null);
  assert.ok(h.impacts.some(impact => impact.source === 'neo' && impact.target === 'agent_jones'), 'Neo opening fire reaches the shared combat-effects pipeline');
  assert.equal(h.impacts.filter(impact => impact.source === 'agent_jones' && impact.target === 'neo' && impact.damage > 0).length, 1, 'the missed window emits the saved graze');
  assert.equal(h.impacts.filter(impact => impact.source === 'agent_jones' && impact.damage === 0).length, 2, 'successful bends leave two visible miss trajectories');
  assert.ok(h.impacts.some(impact => impact.source === 'trinity' && impact.target === 'agent_jones' && impact.downed), 'Trinity finishing shot is emitted once');
});

test('missing rooftop fire fails, retry clears slow motion, and the pilot download is a separate saved action', () => {
  const h = setup('m1_bullet_dodge'); const state = h.sandbox.life.film.state!;
  h.command('act'); h.frames(GOVERNMENT_RESCUE.rooftop.opening + GOVERNMENT_RESCUE.rooftop.finish + 2);
  assert.equal(state.government!.phase, 'failed'); assert.equal(h.actor.status, 'dead'); assert.equal(state.step, 0);
  h.command('retry'); assert.equal(state.government!.phase, 'ready'); assert.equal(state.government!.attempt, 1);
  assert.ok(!h.actor.activeEffects.some(effect => effect.visualEffect === 'slow_motion'));
  state.step = 1; state.government!.phase = 'download_ready'; state.government!.elapsed = 0;
  h.actor.position = filmStepPosition(h.scene, h.scene.steps[1]); h.command('act');
  assert.equal(state.government!.phase, 'downloading');
  h.frames(2); const saved = structuredClone(h.sandbox.state); h.sandbox.restore(saved); h.frames(GOVERNMENT_RESCUE.rooftop.download + .2);
  assert.equal(h.sandbox.life.film.state!.government!.phase, 'done'); assert.ok(h.sandbox.life.film.state!.completed.includes('m1_bullet_dodge'));
  for (const id of ['neo', 'trinity']) {
    assert.equal(h.world.agents.get(id)!.currentAction?.parameters.government?.phase, 'done', `${id} keeps the B-212 completion shot instead of dropping to a camera inside the hull`);
  }
});

test('government poses keep film roles at authored roots and expose the extreme Neo bend', () => {
  const question: GovernmentRescueEncounter = { kind: 'questioning', phase: 'monologue', elapsed: 8, attempt: 0, resolve: .7 };
  assert.deepEqual(governmentRoot(question, 'morpheus'), GOVERNMENT_RESCUE.questioning.roots.morpheus);
  const restraint = governmentPose({ ...question, role: 'morpheus' }); assert.ok(restraint.restrained > .9); assert.ok(restraint.strain > 0);
  const rooftop: GovernmentRescueEncounter = { kind: 'rooftop', phase: 'bullet_time', elapsed: GOVERNMENT_RESCUE.rooftop.beats[1], attempt: 0, dodges: 1, wounds: 0, resolved: [0] };
  const bend = governmentPose({ ...rooftop, role: 'neo' }); assert.ok(bend.bend > .75); assert.ok(bend.armed > .8);
  const neo = governmentRoot(rooftop, 'neo'); assert.deepEqual(neo, GOVERNMENT_RESCUE.rooftop.roots.neo);
  assert.deepEqual(filmPosition('film_government_roof', neo.x, neo.z), { ...filmPosition('film_government_roof', neo.x, neo.z) });
  const downloading: GovernmentRescueEncounter = { ...rooftop, phase: 'downloading', elapsed: 0 };
  assert.deepEqual(governmentRoot(downloading, 'neo'), { x: 11.5, z: -15.5, yaw: -Math.PI * .75 }, 'Neo starts the download beside the physical cabin instead of teleporting back to the gun line');
  assert.deepEqual(governmentRoot(downloading, 'trinity'), GOVERNMENT_RESCUE.rooftop.roots.trinity, 'Trinity begins from her saved finishing-shot position');
  downloading.elapsed = GOVERNMENT_RESCUE.rooftop.download;
  assert.ok(governmentRoot(downloading, 'neo').z < -16 && governmentRoot(downloading, 'trinity').z < -15, 'both actors finish at the B-212 doors');
});

test('another player cannot take a required government-rescue role during a locked beat', () => {
  const questioning = setup('m1_smith_question'); questioning.command('reflect:agency'); questioning.frames(1, true);
  const elapsed = questioning.sandbox.life.film.state!.government!.elapsed;
  assert.match(questioning.players.possess('other', 'smith', questioning.tick()).error!, /审讯|片段/);
  questioning.frames(1, true); assert.ok(questioning.sandbox.life.film.state!.government!.elapsed > elapsed);

  const roof = setup('m1_bullet_dodge'); roof.command('act'); roof.frames(.5);
  assert.match(roof.players.possess('other', 'trinity', roof.tick()).error!, /屋顶|片段/);
  assert.equal(roof.world.agents.get('trinity')!.controller, undefined);
});
