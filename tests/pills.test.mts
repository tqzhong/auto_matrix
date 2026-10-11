import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SCENE_BY_ID, FILM_SETS, MIRROR_GUIDE_LENGTH, PILL_ROOM, PILL_TIMING, PILL_TALK_SECONDS, filmObstacles, filmStepPosition, filmPosition, mirrorGuidePose, pillRoot, playerBlocked, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

function setup() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (e: Omit<WorldEvent, 'id'>) => world.addWorldEvent(e) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const players = new PlayerController(world, { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine, {} as ActionExecutor, dynamics, sandbox);
  players.possess('player', 'neo', 0); const neo = world.agents.get('neo')!;
  sandbox.life.begin(neo, 0);
  const scene = FILM_SCENE_BY_ID.m1_pills;
  sandbox.state.neoLife!.journey = { version: 1, scene: scene.id, actor: 'neo', step: 0, completed: [], enteredAt: 0, reflections: {}, lastText: '', checkpoint: filmStepPosition(scene, scene.steps[0]) };
  let tick = 0;
  const command = (target: string) => players.sandboxAction('player', { kind: 'life', target: `film:${target}` }, ++tick);
  const frames = (seconds: number, running = true) => { for (let i = 0; i < Math.round(seconds / .05); i++) { players.step(.05, running, tick); if (running && i % 10 === 0) sandbox.tick(++tick); } };
  command('retry');
  const offer = () => {
    command('act'); frames(PILL_TIMING.seat + .1);
    for (const [beat, seconds] of PILL_TALK_SECONDS.entries()) { frames(seconds + .1); command(beat === 0 ? 'pill:belief:agency' : 'act'); }
    frames(PILL_TIMING.offer + .1);
  };
  return { world, sandbox, players, neo, command, frames, offer, state: () => sandbox.life.film.state!, tick: () => tick };
}

test('Neo leaves the chairs facing the open tracking-room doorway', () => {
  const pose = (elapsed: number, choice: 'red' | 'blue' = 'red') => pillRoot({ phase: 'taking', elapsed, choice,
    approach: { x: 0, z: -3.3, yaw: Math.PI } });
  const seated = pose(10.8); const leaving = pose(12.5); const stopped = pose(PILL_TIMING.take);
  assert.ok(Math.abs(seated.x - PILL_ROOM.seat) < .1, 'Neo should rise from his own chair before walking');
  assert.ok(leaving.z > PILL_ROOM.z + 1, 'he should walk in front of the chairs');
  assert.ok(stopped.x < -PILL_ROOM.seat - 1 && stopped.z > PILL_ROOM.z + 2,
    'the last sidestep should clear the route to the rear doorway');
  assert.equal(playerBlocked(filmPosition('film_lafayette', stopped.x, stopped.z), true, 1.1), false);
  const doorYaw = Math.atan2(PILL_ROOM.trackingDoor.x - stopped.x, PILL_ROOM.trackingDoor.z - stopped.z);
  assert.ok(Math.cos(stopped.yaw - doorYaw) > .998, 'Morpheus leads through the rear doorway, not toward a wall');
  assert.ok(Math.cos(pose(PILL_TIMING.take, 'blue').yaw - doorYaw) < .8, 'blue does not follow the tracking-room route');
  const furniture = filmObstacles(FILM_SETS.film_lafayette);
  for (let sample = 1; sample < 100; sample++) {
    const amount = sample / 100;
    const x = stopped.x + (PILL_ROOM.trackingDoor.x - stopped.x) * amount;
    const z = stopped.z + (PILL_ROOM.trackingDoor.z - stopped.z) * amount;
    assert.ok(furniture.slice(0, 3).every(item => Math.abs(x - item.x) > item.width / 2 || Math.abs(z - item.z) > item.depth / 2),
      `furniture blocks the tracking doorway at ${x.toFixed(2)}, ${z.toFixed(2)}`);
  }
});

test('the seated meeting waits for Neo to answer and pursue the explanation before offering pills', () => {
  const h = setup(); h.command('act'); h.frames(2.3);
  assert.equal(h.state().pills?.phase, 'talking', 'sitting begins the conversation instead of immediately revealing the capsules');
  h.frames(30);
  assert.equal(h.state().step, 0, 'waiting cannot skip Neo\'s answer');
  const before = structuredClone(h.state().pills);
  h.command('pill:red'); h.command('blue'); h.command('act');
  assert.deepEqual(h.state().pills, before, 'neither a pill nor a generic continue can answer the question');
  assert.equal(h.sandbox.state.neoLife!.choices.pill, undefined);
});

test('the belief, unfinished question and saved sitting pose survive pause, release, restore and retry', () => {
  const h = setup(); h.command('act'); h.frames(PILL_TIMING.seat + .1);
  h.command('pill:belief:agency'); assert.equal(h.state().pills?.conversation?.belief, undefined, 'an early answer cannot skip the question');
  h.frames(PILL_TALK_SECONDS[0]); const life = h.sandbox.state.neoLife!; const before = life.philosophy.trust;
  h.command('pill:belief:trust'); h.frames(1.7);
  assert.equal(life.philosophy.trust, before + 1); assert.equal(life.choices.pill, undefined);
  assert.equal(life.choices['m1_pills:fate'], 'trust');
  h.command('pill:belief:agency'); assert.equal(h.state().pills?.conversation?.belief, 'trust');
  const saved = structuredClone(h.state().pills), position = { ...h.neo.position }, gesture = structuredClone(h.neo.currentAction!.parameters.pills);
  h.frames(2, false); h.players.release('player', h.tick()); h.frames(2);
  assert.deepEqual(h.state().pills, saved);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); h.players.possess('player', 'neo', h.tick()); h.command('retry');
  assert.deepEqual(h.state().pills, saved); assert.deepEqual(h.neo.position, position); assert.deepEqual(h.neo.currentAction!.parameters.pills, gesture);
  h.frames(20); assert.equal(h.state().pills?.conversation?.beat, 1, 'the next question requires an explicit action');
  h.command('act'); assert.equal(h.state().pills?.conversation?.beat, 2);
  assert.equal(h.sandbox.state.neoLife!.philosophy.trust, before + 1, 'retrying cannot award the same answer twice');
  h.command('pill:red'); assert.equal(h.state().pills?.phase, 'talking');
});

test('existing offering and choice saves continue without inserting a new unanswered conversation', () => {
  for (const phase of ['offering', 'choice'] as const) {
    const h = setup(); h.state().pills = { phase, elapsed: phase === 'offering' ? 3 : 0, approach: { x: 0, z: -3.3, yaw: Math.PI } };
    if (phase === 'choice') h.state().step = 1;
    h.frames(3); assert.equal(h.state().pills?.phase, 'choice'); assert.equal(h.state().pills?.conversation, undefined);
    h.command('pill:red'); h.frames(PILL_TIMING.take + .1);
    assert.equal(h.state().scene, 'm1_mirror'); assert.equal(h.sandbox.state.neoLife!.choices.pill, 'red');
  }
});

test('cold loading restores both pill performers before a player reconnects', () => {
  for (const phase of ['talking', 'taking'] as const) {
    const h = setup();
    if (phase === 'taking') { h.offer(); h.command('pill:red'); }
    else { h.command('act'); h.frames(PILL_TIMING.seat + PILL_TALK_SECONDS[0] + .1); h.command('pill:belief:agency'); }
    h.frames(phase === 'taking' ? 6.6 : 1.3);
    h.players.release('player', h.tick()); h.world.simulationTick = h.tick();
    const saved = structuredClone(h.sandbox.state);
    const performers = ['neo', 'morpheus'].map(id => structuredClone(h.world.agents.get(id)!));
    // Server startup clears transient player actions before restoring the sandbox.
    h.neo.currentAction = null; h.neo.targetPosition = null; h.neo.currentPath = [];
    h.sandbox.restore(saved);
    assert.deepEqual(['neo', 'morpheus'].map(id => h.world.agents.get(id)), performers, `${phase}: unowned bodies must recover the exact saved pose`);
    assert.deepEqual(h.sandbox.state.neoLife, saved.neoLife, 'restoring a pose must not advance the story or award philosophy again');
    h.frames(2); assert.deepEqual(h.state().pills, saved.neoLife.journey.pills, 'the unowned performance stays paused');
  }
});

test('pill pose restoration leaves occupied and dead performers alone', () => {
  for (const reserved of ['neo', 'morpheus'] as const) for (const condition of ['occupied', 'dead'] as const) {
    const h = setup(); h.command('act'); h.frames(PILL_TIMING.seat + .1); h.players.release('player', h.tick());
    const actor = h.world.agents.get(reserved)!;
    if (condition === 'occupied') actor.controller = 'player';
    else actor.status = 'dead';
    h.neo.currentAction = null;
    const before = structuredClone(['neo', 'morpheus'].map(id => h.world.agents.get(id)!));
    const story = structuredClone(h.state()); h.sandbox.life.film.restoreHotelSpace();
    assert.deepEqual(['neo', 'morpheus'].map(id => h.world.agents.get(id)), before);
    assert.deepEqual(h.state(), story);
  }
});

test('Morpheus waits for an explicit pill choice and red completes only after the handoff and drink', () => {
  const h = setup(); h.offer();
  assert.equal(h.state().pills?.phase, 'choice'); assert.equal(h.state().step, 1);
  h.frames(20); assert.equal(h.state().pills?.phase, 'choice');
  h.command('reflect:agency'); assert.equal(h.state().pills?.phase, 'choice');
  h.command('pill:red');
  assert.equal(h.state().step, 1); assert.equal(h.sandbox.state.neoLife!.choices.pill, undefined);
  assert.equal(h.state().pills?.choice, 'red');
  h.frames(3); assert.equal(h.state().step, 1); assert.ok(!h.state().completed.includes('m1_pills'));
  h.command('blue'); assert.equal(h.state().pills?.choice, 'red');
  h.frames(PILL_TIMING.take - 3 + .1); assert.equal(h.state().scene, 'm1_mirror'); assert.equal(h.state().step, 0);
  assert.equal(h.sandbox.state.neoLife!.choices.pill, 'red');
  assert.equal(h.state().completed.filter(id => id === 'm1_pills').length, 1);
  assert.equal(playerBlocked(h.neo.position, true), false, 'Neo must finish clear of the chair');
  const agency = h.sandbox.state.neoLife!.philosophy.agency; h.command('pill:red'); h.frames(1);
  assert.equal(h.sandbox.state.neoLife!.philosophy.agency, agency);
  const beforeMirror = { ...h.neo.position };
  h.frames(1); assert.deepEqual(h.neo.position, beforeMirror, 'the same-room transition must not teleport Neo back to the doorway');
});

test('after the red pill Morpheus leads Neo to the tracking chair instead of appearing there', () => {
  const h = setup(); h.offer(); h.command('pill:red'); h.frames(PILL_TIMING.take + .1);
  const state = h.state(), morpheus = h.world.agents.get('morpheus')!;
  assert.equal(state.scene, 'm1_mirror');
  assert.ok(state.mirrorGuide, 'the room transition must save an escort in progress');
  assert.equal(state.mirrorGuide.rise, .5, 'Morpheus is already starting to stand as Neo finishes the red pill');
  assert.ok(Math.hypot(morpheus.position.x - filmPosition('film_lafayette', -PILL_ROOM.seat, PILL_ROOM.z).x,
    morpheus.position.z - filmPosition('film_lafayette', -PILL_ROOM.seat, PILL_ROOM.z).z) < 2,
    'Morpheus starts at the chair instead of teleporting to the equipment room');
  for (let progress = 2.5; progress < MIRROR_GUIDE_LENGTH; progress += .5) {
    const pose = mirrorGuidePose(progress);
    assert.equal(playerBlocked(filmPosition('film_lafayette', pose.x, pose.z), true), false,
      `Morpheus must not walk through furniture or the rear wall at ${progress.toFixed(1)} m`);
  }
  h.neo.position = filmStepPosition(FILM_SCENE_BY_ID.m1_mirror, FILM_SCENE_BY_ID.m1_mirror.steps[0]);
  assert.match(h.command('act'), /带路/); assert.equal(state.awakening, undefined);
  assert.match(h.players.possess('other', 'morpheus', h.tick()).error!, /追踪室/);
  h.neo.position = { ...morpheus.position }; const beforeStep = state.mirrorGuide!.progress;
  h.frames(.5);
  assert.equal(state.mirrorGuide!.progress, beforeStep, 'Morpheus stands up before stepping away from the chair');
  assert.equal(state.mirrorGuide!.rise, 1);
  assert.equal(morpheus.currentAction?.parameters.seated, false);
  h.frames(.5);
  assert.ok(state.mirrorGuide!.progress - beforeStep > 1.4 && state.mirrorGuide!.progress - beforeStep < 1.8,
    'one server tick advances Morpheus by about 1.6 metres');
  const first = state.mirrorGuide!.progress;
  h.neo.position = filmPosition('film_lafayette', 0, 10);
  h.frames(4); assert.equal(state.mirrorGuide!.progress, first, 'Morpheus waits when Neo falls behind');
  const ahead = mirrorGuidePose(first + 9);
  h.neo.position = filmPosition('film_lafayette', ahead.x, ahead.z);
  h.frames(.5); assert.ok(state.mirrorGuide!.progress > first, 'Morpheus resumes if Neo takes the route ahead');
  const saved = structuredClone(h.sandbox.state); h.sandbox.restore(saved);
  assert.equal(h.state().mirrorGuide!.progress, saved.neoLife.journey.mirrorGuide.progress);
  assert.equal(h.state().mirrorGuide!.done, saved.neoLife.journey.mirrorGuide.done);
  assert.equal(h.state().mirrorGuide!.rise, saved.neoLife.journey.mirrorGuide.rise);
  const legacy = structuredClone(saved); delete legacy.neoLife.journey.mirrorGuide.rise;
  h.sandbox.restore(legacy);
  assert.equal(h.state().mirrorGuide!.rise, undefined, 'old escort saves resume without a new stand-up delay');
  for (let i = 0; i < 50 && !h.state().mirrorGuide!.done; i++) {
    h.neo.position = { ...morpheus.position };
    h.frames(.5);
  }
  assert.equal(h.state().mirrorGuide!.done, true);
  assert.ok(morpheus.position.z < filmPosition('film_lafayette', 0, -11.5).z,
    'Morpheus reaches the tracking room before Neo starts the chair performance');
});

test('blue takes the same physical sequence before preserving the daily-life save', () => {
  const h = setup(); h.offer(); const life = h.sandbox.state.neoLife!;
  life.money = 287; life.evidence = ['clock']; h.command('blue');
  assert.ok(life.journey, 'choosing blue must not immediately remove the encounter');
  h.frames(6); assert.equal(h.neo.currentLocation, 'film_lafayette');
  h.frames(PILL_TIMING.take - 6 + .1); assert.equal(life.journey, undefined); assert.equal(life.chapter, 0);
  assert.equal(life.choices.pill, 'blue'); assert.equal(life.money, 287); assert.deepEqual(life.evidence, ['clock']);
  assert.equal(h.neo.currentLocation, 'neo_apartment');
  assert.equal(h.world.agents.get('morpheus')!.currentAction?.parameters.pills, undefined);
});

test('pill gestures survive pause, disconnection, save restore and retry without changing the chosen color', () => {
  const h = setup(); h.offer(); h.command('pill:red'); h.frames(2.25);
  const beat = structuredClone(h.state().pills); const position = { ...h.neo.position };
  const pose = structuredClone(h.neo.currentAction!.parameters.pills);
  h.frames(4, false); assert.deepEqual(h.state().pills, beat); assert.deepEqual(h.neo.position, position);
  h.players.release('player', h.tick()); h.frames(2);
  assert.deepEqual(h.state().pills, beat); assert.deepEqual(h.neo.currentAction!.parameters.pills, pose);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  h.players.possess('player', 'neo', h.tick());
  assert.deepEqual(h.neo.position, position); assert.deepEqual(h.neo.currentAction!.parameters.pills, pose);
  h.command('retry'); assert.deepEqual(h.state().pills, beat); assert.deepEqual(h.neo.position, position);
  h.frames(PILL_TIMING.take - 2.25 + .1); assert.equal(h.state().scene, 'm1_mirror'); assert.equal(h.state().step, 0);
});

test('a pill performance reserves Morpheus and rejects movement, combat and remote choices', () => {
  const h = setup(); const checkpoint = { ...h.neo.position };
  h.neo.position = filmPosition('film_lafayette', 0, 18);
  h.command('blue'); h.command('pill:red'); assert.equal(h.state().pills, undefined);
  h.neo.position = checkpoint; h.offer(); const position = { ...h.neo.position };
  assert.match(h.players.possess('other', 'morpheus', h.tick()).error!, /递药|交谈/);
  h.players.receiveInput('player', { x: 1, z: 1, yaw: 0, jump: true, sprint: true, sequence: 1 });
  assert.match(h.players.act('player', 'attack', h.tick()), /演出/);
  h.frames(1); assert.deepEqual(h.neo.position, position); assert.equal(h.state().pills?.phase, 'choice');
});

test('an occupied Morpheus is never moved into the pill performance', () => {
  const h = setup(); h.players.possess('other', 'morpheus', h.tick());
  const morpheus = h.world.agents.get('morpheus')!; const position = { ...morpheus.position };
  assert.match(h.command('act'), /另一位玩家/); h.frames(6);
  assert.equal(h.state().pills, undefined); assert.deepEqual(morpheus.position, position);
});
