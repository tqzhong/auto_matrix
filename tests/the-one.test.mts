import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FILM_SCENE_BY_ID,
  THE_ONE,
  filmEntry,
  filmPosition,
  filmStepPosition,
  theOneLocked,
  theOnePose,
  theOneRoot,
  type CombatImpact,
  type TheOneEncounter,
  type WorldEvent,
} from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

type SceneId = 'm1_death' | 'm1_return' | 'm1_final_call';

function setup(sceneId: SceneId) {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 79); const impacts: CombatImpact[] = [];
  sandbox.onImpact = impact => impacts.push(impact);
  const conversations = { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine;
  const actions = { execute() {} } as unknown as ActionExecutor;
  const players = new PlayerController(world, conversations, actions, dynamics, sandbox);
  const neo = world.agents.get('neo')!; players.possess('one-player', 'neo', 0); sandbox.life.begin(neo, 0);
  const scene = FILM_SCENE_BY_ID[sceneId];
  const kind = sceneId === 'm1_death' ? 'death' : sceneId === 'm1_return' ? 'return' : 'flight';
  sandbox.state.neoLife!.journey = {
    version: 1, scene: scene.id, step: 0, actor: 'neo', completed: [], enteredAt: 0,
    checkpoint: filmEntry(scene), reflections: {}, lastText: scene.context,
    theOne: { kind, phase: 'ready', elapsed: 0, attempt: 0, checkpoint: kind === 'death' ? 'door' : kind === 'return' ? 'bullets' : 'phone',
      signal: 0, hits: 0, blocks: 0, deadline: 0, altitude: 0, flightX: 0, flightZ: 0, resolved: [] },
  };
  neo.currentLocation = scene.set; neo.isInMatrix = true; neo.position = filmEntry(scene); neo.isAwakened = true;
  let tick = 0; let sequence = 0;
  const command = (target: string) => players.sandboxAction('one-player', { kind: 'life', target: `film:${target}` }, ++tick);
  const frames = (seconds: number, input: { x?: number; z?: number; sprint?: boolean; jump?: boolean; focus?: boolean } = {}, running = true) => {
    for (let i = 0; i < Math.ceil(seconds * 10); i++) {
      players.receiveInput('one-player', { x: input.x ?? 0, z: input.z ?? 0, yaw: neo.rotation, jump: input.jump ?? false,
        sprint: input.sprint ?? false, focus: input.focus ?? false, sequence: ++sequence });
      players.step(.1, running, ++tick);
    }
  };
  return { world, sandbox, players, actor: neo, scene, command, frames, impacts, tick: () => tick };
}

test('room 303 ambush cuts to the real body and only Trinity voice focus restores Neo', () => {
  const h = setup('m1_death'); const state = h.sandbox.life.film.state!; const encounter = state.theOne!;
  h.actor.position = filmStepPosition(h.scene, h.scene.steps[0]); h.frames(.2);
  assert.equal(state.step, 1); assert.match(h.command('act'), /303|Smith|门/); assert.equal(encounter.phase, 'ambush');
  assert.equal(theOneLocked(state), true);
  h.frames(THE_ONE.death.ambush + THE_ONE.death.gunfire + THE_ONE.death.flatline + .3);
  assert.equal(encounter.phase, 'listening'); assert.equal(h.actor.currentLocation, 'film_neb_deck'); assert.equal(h.actor.isInMatrix, false);
  const still = encounter.signal; h.frames(1.2); assert.equal(encounter.signal, still, 'waiting without focus cannot revive Neo');
  h.frames(1.1, { focus: true }); assert.ok(encounter.signal > .25 && encounter.signal < 1);
  const saved = structuredClone(h.sandbox.state); const signal = encounter.signal;
  h.frames(1, { focus: true }, false); assert.equal(encounter.signal, signal, 'pause freezes the saved connection signal');
  h.sandbox.restore(saved); assert.equal(h.sandbox.life.film.state!.theOne!.signal, signal);
  assert.match(h.players.possess('other', 'trinity', h.tick()).error!, /Trinity|复苏|片段/);
  h.frames(THE_ONE.death.listen + .4, { focus: true });
  h.frames(THE_ONE.death.kiss + THE_ONE.death.revive + .5);
  assert.equal(h.sandbox.life.film.state!.theOne!.phase, 'done');
  assert.ok(h.sandbox.life.film.state!.completed.includes('m1_death')); assert.equal(h.actor.currentLocation, 'film_heart_hotel');
  assert.equal(h.actor.isInMatrix, true); assert.equal(h.actor.health, h.actor.maxHealth);
});

test('code sight stops a timed volley, then a real block and counters destroy Smith', () => {
  const h = setup('m1_return'); const state = h.sandbox.life.film.state!; const encounter = state.theOne!;
  h.actor.position = filmStepPosition(h.scene, h.scene.steps[0]);
  assert.match(h.command('act'), /代码|子弹|看见/); assert.equal(encounter.phase, 'code_reveal');
  h.frames(THE_ONE.return.reveal + .2); assert.equal(encounter.phase, 'bullet_window');
  h.frames(THE_ONE.return.bulletBeat - encounter.elapsed);
  assert.match(h.players.act('one-player', 'dodge', h.tick()), /停住|子弹|弹群/); assert.equal(encounter.phase, 'bullet_stop');
  h.frames(THE_ONE.return.bulletStop + .3); assert.equal(state.step, 1); assert.equal(encounter.phase, 'counter');
  const smith = h.sandbox.state.threats.find(threat => threat.scene === 'm1_return' && threat.character === 'smith')!;
  assert.ok(smith); smith.attackAt = h.tick() + 2; smith.stunUntil = 0;
  assert.match(h.players.act('one-player', 'dodge', h.tick()), /格挡|Smith/); assert.equal(encounter.blocks, 1);
  for (let hit = 0; hit < THE_ONE.return.requiredHits; hit++) {
    smith.position = { ...h.actor.position, z: h.actor.position.z - 2.1 }; h.actor.rotation = Math.PI;
    h.sandbox.attack(h.actor, h.tick() + hit + 1, hit % 3);
  }
  assert.equal(encounter.phase, 'dive');
  h.frames(THE_ONE.return.dive + THE_ONE.return.burst + .4);
  assert.equal(state.step, 2); assert.equal(encounter.phase, 'exit_run'); assert.equal(encounter.smithBurst, true);
  assert.ok(h.impacts.some(impact => impact.source === 'neo-code' && impact.target === 'smith' && impact.downed));
});

test('missing the bullet stop or the exit deadline has explicit saved retries', () => {
  const bullets = setup('m1_return'); const bulletState = bullets.sandbox.life.film.state!;
  bullets.actor.position = filmStepPosition(bullets.scene, bullets.scene.steps[0]); bullets.command('act');
  bullets.frames(THE_ONE.return.reveal + THE_ONE.return.bulletDuration + .4);
  assert.equal(bulletState.theOne!.phase, 'failed'); assert.equal(bullets.actor.status, 'dead');
  assert.match(bullets.command('retry'), /子弹|检查点|重试/); assert.equal(bullets.actor.status, 'alive');
  assert.equal(bulletState.theOne!.phase, 'code_reveal'); assert.equal(bulletState.theOne!.attempt, 1);

  const exit = setup('m1_return'); const exitState = exit.sandbox.life.film.state!; const encounter = exitState.theOne!;
  exitState.step = 2; Object.assign(encounter, { phase: 'exit_run', checkpoint: 'exit', elapsed: 0, deadline: THE_ONE.return.exitDeadline - .1,
    hits: THE_ONE.return.requiredHits, blocks: THE_ONE.return.requiredBlocks, smithBurst: true });
  exit.frames(.3); assert.equal(encounter.phase, 'failed');
  assert.match(exit.command('retry'), /出口|电话|重试/); assert.equal(exitState.theOne!.phase, 'exit_run'); assert.equal(exitState.theOne!.deadline, 0);
});

test('answering the exit lets Morpheus fire EMP only after Neo is out', () => {
  const h = setup('m1_return'); const state = h.sandbox.life.film.state!; const encounter = state.theOne!;
  state.step = 2; Object.assign(encounter, { phase: 'exit_run', checkpoint: 'exit', hits: 3, blocks: 1, smithBurst: true, deadline: 2 });
  h.actor.position = filmStepPosition(h.scene, h.scene.steps[2]); h.frames(.2);
  assert.equal(encounter.phase, 'exit_ready'); assert.match(h.command('act'), /电话|EMP|出口/); assert.equal(encounter.phase, 'exit_phone');
  h.frames(THE_ONE.return.exitPhone + .2); assert.equal(encounter.phase, 'emp'); assert.equal(h.actor.currentLocation, 'film_neb_deck');
  assert.equal(encounter.empFired, undefined);
  h.frames(THE_ONE.return.emp + .3); assert.equal(encounter.empFired, true); assert.equal(encounter.phase, 'done');
  assert.ok(state.completed.includes('m1_return')); assert.equal(h.actor.isInMatrix, false);
});

test('the final call waits for reflection, then Space launches a steerable first flight', () => {
  const h = setup('m1_final_call'); const state = h.sandbox.life.film.state!; const encounter = state.theOne!;
  h.actor.position = filmStepPosition(h.scene, h.scene.steps[0]);
  assert.match(h.command('reflect:agency'), /选择|可能|自由|力量|能力|入口/); assert.equal(state.step, 1);
  h.frames(.1); assert.equal(encounter.phase, 'call_ready');
  h.actor.position = filmStepPosition(h.scene, h.scene.steps[1]); assert.match(h.command('act'), /电话|系统/); assert.equal(encounter.phase, 'call');
  h.frames(THE_ONE.flight.call + .3); assert.equal(encounter.phase, 'takeoff_ready');
  const ground = h.actor.position.y; h.frames(1); assert.equal(encounter.phase, 'takeoff_ready'); assert.equal(h.actor.position.y, ground);
  h.frames(.2, { jump: true }); assert.equal(encounter.phase, 'takeoff');
  h.frames(THE_ONE.flight.takeoff / 2, { x: 1, z: -1, sprint: true }); assert.ok(encounter.altitude > 8); assert.notEqual(encounter.flightX, 0);
  const saved = structuredClone(h.sandbox.state); const altitude = encounter.altitude; h.frames(.5, { jump: true }, false); assert.equal(encounter.altitude, altitude);
  h.sandbox.restore(saved); h.frames(THE_ONE.flight.takeoff + .4, { z: -1, sprint: true });
  assert.equal(h.sandbox.life.film.state!.theOne!.phase, 'done'); assert.ok(h.sandbox.life.film.state!.completed.includes('m1_final_call'));
  assert.ok(h.actor.position.y > filmPosition(h.scene.set).y + 20);
});

test('the One roots and poses distinguish the shooting, kiss, stopped bullets, code dive and flight', () => {
  const death: TheOneEncounter = { kind: 'death', phase: 'gunfire', elapsed: 1, attempt: 0, checkpoint: 'door', signal: 0, hits: 0, blocks: 0,
    deadline: 0, altitude: 0, flightX: 0, flightZ: 0, resolved: [] };
  assert.ok(theOnePose({ ...death, role: 'neo' }).wound > .4);
  const listening = { ...death, phase: 'kiss' as const, elapsed: 1.2 };
  const revived = theOneRoot(listening, 'neo'); const trinity = theOneRoot(listening, 'trinity');
  assert.equal(revived.set, 'film_neb_deck'); assert.ok(Math.hypot(revived.x - trinity.x, revived.z - trinity.z) < 2, 'Trinity must reach Neo for the kiss');
  assert.ok(theOnePose({ ...listening, role: 'trinity' }).kiss > .5);
  const returned: TheOneEncounter = { ...death, kind: 'return', phase: 'bullet_stop', elapsed: 1.1, checkpoint: 'bullets' };
  assert.ok(theOnePose({ ...returned, role: 'neo' }).stop > .5);
  assert.ok(theOnePose({ ...returned, phase: 'dive', elapsed: 1.1, role: 'neo' }).dive > .5);
  const flight: TheOneEncounter = { ...death, kind: 'flight', phase: 'takeoff', elapsed: 3, checkpoint: 'phone', altitude: 12 };
  assert.ok(theOnePose({ ...flight, role: 'neo' }).flight > .3);
});
