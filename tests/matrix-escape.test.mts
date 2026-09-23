import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FILM_SCENE_BY_ID,
  MATRIX_ESCAPE,
  filmEntry,
  filmPosition,
  filmStepPosition,
  matrixEscapeLocked,
  matrixEscapePose,
  matrixEscapeRoot,
  type CombatImpact,
  type MatrixEscapeEncounter,
  type WorldEvent,
} from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

function setup(sceneId: 'm1_subway' | 'm1_city_chase') {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 61); const impacts: CombatImpact[] = [];
  sandbox.onImpact = impact => impacts.push(impact);
  const conversations = { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine;
  const actions = { execute() {} } as unknown as ActionExecutor;
  const players = new PlayerController(world, conversations, actions, dynamics, sandbox);
  const neo = world.agents.get('neo')!; players.possess('escape-player', 'neo', 0); sandbox.life.begin(neo, 0);
  const scene = FILM_SCENE_BY_ID[sceneId];
  sandbox.state.neoLife!.journey = {
    version: 1, scene: scene.id, step: 0, actor: 'neo', completed: [], enteredAt: 0,
    checkpoint: filmEntry(scene), reflections: {}, lastText: scene.context,
    matrixEscape: sceneId === 'm1_subway'
      ? { kind: 'subway', phase: 'ready', elapsed: 0, attempt: 0, checkpoint: 'duel', hits: 0, dodges: 0, pursuit: 0, segment: 0, possessions: 0, resolved: [] }
      : { kind: 'city', phase: 'ready', elapsed: 0, attempt: 0, checkpoint: 'street', hits: 0, dodges: 0, pursuit: 0, segment: 0, possessions: 0, resolved: [] },
  };
  neo.currentLocation = scene.set; neo.isInMatrix = true; neo.position = filmEntry(scene); neo.isAwakened = true;
  let tick = 0; let sequence = 0;
  const command = (target: string) => players.sandboxAction('escape-player', { kind: 'life', target: `film:${target}` }, ++tick);
  const frames = (seconds: number, input: { x?: number; z?: number; sprint?: boolean } = {}, running = true) => {
    for (let i = 0; i < Math.ceil(seconds * 10); i++) {
      players.receiveInput('escape-player', { x: input.x ?? 0, z: input.z ?? 0, yaw: neo.rotation, jump: false,
        sprint: input.sprint ?? false, sequence: ++sequence });
      players.step(.1, running, ++tick);
    }
  };
  return { world, sandbox, players, actor: neo, scene, command, frames, impacts, tick: () => tick };
}

function finishSubwayDuel(h: ReturnType<typeof setup>) {
  const state = h.sandbox.life.film.state!; const encounter = state.matrixEscape!;
  const threat = h.sandbox.state.threats.find(candidate => candidate.scene === 'm1_subway')!;
  threat.attackAt = h.tick() + 2; threat.stunUntil = 0;
  h.players.act('escape-player', 'dodge', h.tick());
  assert.equal(encounter.dodges, 1);
  for (let hit = 0; hit < MATRIX_ESCAPE.subway.requiredHits; hit++) {
    threat.position = { ...h.actor.position, x: h.actor.position.x, z: h.actor.position.z - 2.2 };
    h.actor.rotation = Math.PI;
    assert.match(h.sandbox.attack(h.actor, h.tick() + hit + 1, hit % 3) ?? '', /命中|Smith|站台/);
  }
  assert.equal(encounter.phase, 'wall_break');
}

test('the subway escape starts with the destroyed phone and requires real hits plus a telegraphed dodge', () => {
  const h = setup('m1_subway'); const state = h.sandbox.life.film.state!; const encounter = state.matrixEscape!;
  assert.match(h.command('act'), /电话|Smith/); assert.equal(encounter.phase, 'phone_shot'); assert.equal(matrixEscapeLocked(state), true);
  h.frames(MATRIX_ESCAPE.subway.phoneShot + MATRIX_ESCAPE.subway.stance + .3);
  assert.equal(encounter.phase, 'duel'); assert.equal(matrixEscapeLocked(state), false);
  const threat = h.sandbox.state.threats.find(candidate => candidate.scene === 'm1_subway');
  assert.equal(threat?.kind, 'smith'); assert.equal(threat?.character, 'smith');
  const originalHealth = threat!.health;
  finishSubwayDuel(h);
  assert.equal(threat!.health, originalHealth, 'the authored duel ends through saved exchanges instead of deleting Smith as an ordinary mob');
  assert.ok(h.impacts.filter(impact => impact.source === 'neo').length >= MATRIX_ESCAPE.subway.requiredHits);
});

test('train timing fails explicitly, then retry resumes at the tracks and Smith changes bodies after impact', () => {
  const h = setup('m1_subway'); const state = h.sandbox.life.film.state!;
  h.command('act'); h.frames(MATRIX_ESCAPE.subway.phoneShot + MATRIX_ESCAPE.subway.stance + .3); finishSubwayDuel(h);
  h.frames(MATRIX_ESCAPE.subway.wallBreak + MATRIX_ESCAPE.subway.tracks + .3);
  assert.equal(state.step, 1); assert.equal(state.matrixEscape!.phase, 'train_window'); assert.equal(state.matrixEscape!.checkpoint, 'tracks');
  const bystanderRoot = matrixEscapeRoot(state.matrixEscape!, 'citizen_13');
  assert.deepEqual(h.world.agents.get('citizen_13')!.position, filmPosition(h.scene.set, bystanderRoot.x, bystanderRoot.z),
    'the future Smith host must wait off the train camera until the body swap');
  const saved = structuredClone(h.sandbox.state); const elapsed = state.matrixEscape!.elapsed;
  h.frames(1, {}, false); assert.equal(state.matrixEscape!.elapsed, elapsed, 'pause freezes the train at the saved rail position');
  h.sandbox.restore(saved); h.frames(MATRIX_ESCAPE.subway.trainDuration + .2);
  assert.equal(h.sandbox.life.film.state!.matrixEscape!.phase, 'failed'); assert.equal(h.actor.status, 'dead');
  assert.match(h.command('retry'), /轨道|重试/); assert.equal(h.actor.status, 'alive');
  const resumed = h.sandbox.life.film.state!; assert.equal(resumed.matrixEscape!.phase, 'tracks');
  assert.equal(resumed.step, 1); assert.equal(resumed.matrixEscape!.attempt, 1);
  h.frames(MATRIX_ESCAPE.subway.tracks + .1);
  h.frames(MATRIX_ESCAPE.subway.trainBeat - resumed.matrixEscape!.elapsed);
  assert.match(h.players.act('escape-player', 'dodge', h.tick()), /列车|翻上/); assert.equal(resumed.matrixEscape!.phase, 'train_escape');
  h.frames(MATRIX_ESCAPE.subway.escape + MATRIX_ESCAPE.subway.bodySwap + .4);
  assert.equal(resumed.matrixEscape!.phase, 'done'); assert.ok(resumed.completed.includes('m1_subway'));
  assert.equal(resumed.matrixEscape!.possessions, 1); assert.equal(resumed.matrixEscape!.host, 'citizen_13');
  assert.ok(h.impacts.some(impact => impact.source === 'subway-train' && impact.target === 'smith' && impact.downed));
});

test('Tank route is a moving pursuit with a failed phone, garbage-truck evade, two possessions and room 303 exit', () => {
  const h = setup('m1_city_chase'); const state = h.sandbox.life.film.state!; const encounter = state.matrixEscape!;
  assert.match(h.command('act'), /Tank|耳机/); assert.equal(encounter.phase, 'briefing');
  h.frames(MATRIX_ESCAPE.city.briefing + .2); assert.equal(encounter.phase, 'running');
  assert.ok(h.sandbox.state.threats.some(threat => threat.scene === 'm1_city_chase' && threat.kind === 'smith'));
  h.frames(1.2); const pressure = encounter.pursuit;
  h.frames(1.2, { z: -1, sprint: true }); assert.ok(encounter.pursuit < pressure, 'sprinting the route creates distance from the pursuing body');

  h.actor.position = filmStepPosition(h.scene, h.scene.steps[0]); h.frames(.2);
  assert.equal(encounter.phase, 'phone_failure'); h.frames(MATRIX_ESCAPE.city.phoneFailure + .2);
  assert.equal(state.step, 1); assert.equal(encounter.phase, 'running'); assert.equal(encounter.possessions, 1); assert.equal(encounter.host, 'citizen_13');

  h.actor.position = filmStepPosition(h.scene, h.scene.steps[1]); h.frames(.2);
  assert.equal(encounter.phase, 'truck_warning'); h.frames(MATRIX_ESCAPE.city.truckWarning + .1);
  assert.equal(encounter.phase, 'truck_window'); h.frames(MATRIX_ESCAPE.city.truckBeat - encounter.elapsed);
  assert.match(h.players.act('escape-player', 'dodge', h.tick()), /垃圾车|侧翻/); assert.equal(encounter.phase, 'possession');
  h.frames(MATRIX_ESCAPE.city.possession + .2);
  assert.equal(state.step, 2); assert.equal(encounter.phase, 'running'); assert.equal(encounter.possessions, 2); assert.equal(encounter.host, 'citizen_14');

  h.actor.position = filmStepPosition(h.scene, h.scene.steps[2]); h.frames(.2);
  assert.equal(encounter.phase, 'door_ready'); assert.match(h.command('act'), /303|楼梯/); assert.equal(encounter.phase, 'door');
  h.frames(MATRIX_ESCAPE.city.door + .2);
  assert.equal(encounter.phase, 'done'); assert.ok(state.completed.includes('m1_city_chase')); assert.equal(state.step, h.scene.steps.length);
});

test('city pursuit and truck impact each fail at a saved street checkpoint', () => {
  const pressure = setup('m1_city_chase'); pressure.command('act'); pressure.frames(MATRIX_ESCAPE.city.briefing + .2);
  pressure.sandbox.life.film.state!.matrixEscape!.pursuit = .99; pressure.frames(.2);
  assert.equal(pressure.sandbox.life.film.state!.matrixEscape!.phase, 'failed'); assert.equal(pressure.actor.status, 'dead');
  assert.match(pressure.command('retry'), /街巷|重试/); assert.equal(pressure.sandbox.life.film.state!.matrixEscape!.phase, 'running');

  const truck = setup('m1_city_chase'); const state = truck.sandbox.life.film.state!;
  truck.command('act'); truck.frames(MATRIX_ESCAPE.city.briefing + .2); truck.actor.position = filmStepPosition(truck.scene, truck.scene.steps[0]); truck.frames(.2);
  truck.frames(MATRIX_ESCAPE.city.phoneFailure + .2); truck.actor.position = filmStepPosition(truck.scene, truck.scene.steps[1]); truck.frames(.2);
  truck.frames(MATRIX_ESCAPE.city.truckWarning + MATRIX_ESCAPE.city.truckDuration + .3);
  assert.equal(state.matrixEscape!.phase, 'failed'); assert.equal(truck.actor.status, 'dead');
  truck.command('retry'); assert.equal(state.step, 1); assert.equal(state.matrixEscape!.phase, 'running'); assert.equal(state.matrixEscape!.segment, 1);
});

test('escape poses distinguish phone fire, wall impact, rail struggle, code possession and door entry', () => {
  const base: MatrixEscapeEncounter = { kind: 'subway', phase: 'phone_shot', elapsed: 1, attempt: 0, checkpoint: 'duel', hits: 0, dodges: 0,
    pursuit: 0, segment: 0, possessions: 0, resolved: [] };
  assert.ok(matrixEscapePose({ ...base, role: 'smith' }).aim > .7);
  assert.ok(matrixEscapePose({ ...base, phase: 'wall_break', elapsed: 1.2, role: 'neo' }).strike > .5);
  assert.ok(matrixEscapePose({ ...base, phase: 'tracks', elapsed: .8, role: 'smith' }).grapple > .5);
  const city: MatrixEscapeEncounter = { ...base, kind: 'city', phase: 'possession', host: 'citizen_14', elapsed: 1.1 };
  assert.ok(matrixEscapePose({ ...city, role: 'citizen_14' }).transform > .5);
  assert.ok(matrixEscapePose({ ...city, phase: 'door', elapsed: 1, role: 'neo' }).door > .4);
});

test('another player cannot take Smith or a possession host during the authored escape', () => {
  const h = setup('m1_subway'); h.command('act'); h.frames(.4);
  assert.match(h.players.possess('other', 'smith', h.tick()).error!, /地铁|追逐|片段/);
  const city = setup('m1_city_chase'); city.command('act'); city.frames(MATRIX_ESCAPE.city.briefing + .2);
  assert.match(city.players.possess('other', 'citizen_13', city.tick()).error!, /地铁|追逐|片段/);
});
