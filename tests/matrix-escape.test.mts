import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
  FILM_SCENE_BY_ID,
  FILM_SETS,
  MATRIX_ESCAPE,
  filmEntry,
  filmPosition,
  filmStepPosition,
  matrixEscapeLocked,
  matrixEscapePose,
  matrixEscapeRoot,
  type CombatImpact,
  type MatrixEscapeEncounter,
  type PlayerInput,
  type WorldEvent,
} from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { MatrixEscapeRenderer } from '../packages/client/src/engine/MatrixEscapeRenderer.js';

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
  assert.ok((threat!.position.x - h.actor.position.x) * Math.sin(h.actor.rotation)
    + (threat!.position.z - h.actor.position.z) * Math.cos(h.actor.rotation) > 0, 'Neo faces Smith when the stance hands over to live combat');
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

for (const [id, duration, phase] of [
  ['m1_subway', .85, 'phone_shot'],
  ['m1_subway', MATRIX_ESCAPE.subway.phoneShot + MATRIX_ESCAPE.subway.stance + .3, 'duel'],
  ['m1_city_chase', MATRIX_ESCAPE.city.briefing + .3, 'running'],
] as const) test(`disconnect and cold restore retain Neo's paused ${phase} pose`, () => {
  const h = setup(id);
  h.command('act'); h.frames(duration); h.frames(.1, {}, false);
  h.world.simulationTick = h.tick();
  const state = h.sandbox.life.film.state!;
  assert.equal(state.matrixEscape!.phase, phase);
  assert.ok(h.actor.currentAction?.parameters.matrixEscape);
  const action = structuredClone(h.actor.currentAction);
  const position = { ...h.actor.position }, clock = structuredClone(state.matrixEscape);
  h.players.release('escape-player', h.tick());
  assert.deepEqual(h.actor.currentAction, action);
  h.sandbox.restore(structuredClone(h.sandbox.state));
  assert.deepEqual(h.actor.currentAction, action);
  assert.deepEqual(h.players.possess('returned-player', 'neo', h.tick()), { agentId: 'neo' });
  assert.deepEqual(h.actor.currentAction, action);
  assert.deepEqual(h.actor.position, position);
  assert.deepEqual(h.sandbox.life.film.state!.matrixEscape, clock);
});

function browserControls(t: test.TestContext, send: (input: PlayerInput) => void = () => {}) {
  class InputTarget extends EventTarget { matches() { return false; } }
  const oldWindow = globalThis.window, oldDocument = globalThis.document;
  const window = new InputTarget();
  Object.assign(globalThis, { window, document: Object.assign(new InputTarget(), { pointerLockElement: null }) });
  const controls = new PlayerControls(new InputTarget() as unknown as HTMLCanvasElement, new THREE.PerspectiveCamera(), send, () => {});
  t.after(() => { controls.dispose(); Object.assign(globalThis, { window: oldWindow, document: oldDocument }); });
  return { controls, window, group: new THREE.Group() };
}

test('a paused subway crouch drives the local pose without a held key', t => {
  const h = setup('m1_subway');
  h.command('act'); h.frames(MATRIX_ESCAPE.subway.phoneShot + MATRIX_ESCAPE.subway.stance + .3);
  assert.equal(h.sandbox.life.film.state!.matrixEscape!.phase, 'duel');
  h.actor.currentAction!.parameters.crouching = true;
  const { controls, group } = browserControls(t);
  controls.possess(h.actor);
  controls.update(.05, h.actor, group, false);
  assert.equal(controls.motion.crouching, true, 'a freshly loaded, paused avatar shows the saved pose');
  controls.update(.05, h.actor, group, true);
  assert.equal(controls.motion.crouching, false, 'live input takes over when play resumes');
});

test('a late retry acknowledgement keeps the sprint already sent for the same actor', t => {
  const h = setup('m1_city_chase'); h.command('act'); h.frames(MATRIX_ESCAPE.city.briefing + .2);
  let now = 1000;
  t.mock.method(performance, 'now', () => now);
  const sent: PlayerInput[] = [];
  const { controls, window, group } = browserControls(t, input => sent.push(input));
  const frame = (actor = h.actor) => { now += 100; controls.update(.1, actor, group, true); return sent.at(-1)!; };
  const press = (code: string) => window.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { code, repeat: false }));
  controls.possess(h.actor); frame();
  press('ShiftLeft'); press('KeyW');
  const before = frame(); assert(before.sprint && Math.hypot(before.x, before.z) > .99);
  controls.possess(structuredClone(h.actor));
  const after = frame(); assert(after.sprint && Math.hypot(after.x, after.z) > .99, 'the player can continue the held sprint after retry');
  assert(after.sequence > before.sequence);
  const trinity = h.world.agents.get('trinity')!;
  controls.possess(trinity);
  const changed = frame(trinity); assert.equal(changed.sprint, false); assert.equal(Math.hypot(changed.x, changed.z), 0);
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
  const root = matrixEscapeRoot(encounter, 'neo');
  const landing = filmPosition(h.scene.set, root.x, root.z);
  landing.y += root.y;
  h.frames(.5);
  assert.deepEqual(h.actor.position, landing, 'Neo stands on the completed stairwell landing until the next scene is requested');
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

test('the failed city phone leaves Neo outside the actual opaque phone body', t => {
  const h = setup('m1_city_chase'); h.command('act'); h.frames(MATRIX_ESCAPE.city.briefing + .2);
  h.actor.position = filmStepPosition(h.scene, h.scene.steps[0]); h.frames(.2);
  assert.equal(h.sandbox.life.film.state!.matrixEscape!.phase, 'phone_failure');
  const root = new THREE.Group(), center = FILM_SETS.film_escape_streets.center;
  root.position.set(center.x, center.y - 1, center.z);
  const renderer = new MatrixEscapeRenderer(root, 'film_escape_streets'); t.after(() => renderer.dispose());
  root.updateMatrixWorld(true);
  const phone = root.getObjectByName('matrix-city-phone-0')!; assert.ok(phone);
  const body = new THREE.Box3().setFromObject(phone).expandByVector(new THREE.Vector3(.55, 0, .55));
  assert.equal(body.containsPoint(new THREE.Vector3(h.actor.position.x, h.actor.position.y, h.actor.position.z)), false,
    'the phone cinematic must not put Neo inside the visible steel enclosure');
  assert.equal(h.actor.rotation, 0, 'Neo faces the front telephone panel');
});

test('the failed city line is hit on the phone panel instead of on the caller', () => {
  const h = setup('m1_city_chase'); h.command('act'); h.frames(MATRIX_ESCAPE.city.briefing + .2);
  h.actor.position = filmStepPosition(h.scene, h.scene.steps[0]); h.frames(.8);
  const impact = h.impacts.find(impact => impact.target === 'city-phone'); assert.ok(impact);
  const center = FILM_SETS.film_escape_streets.center;
  assert.ok(Math.abs(impact.position.x - center.x + 7) < .02);
  assert.ok(Math.abs(impact.position.y - (center.y - 1 + 3.35)) < .02);
  assert.ok(Math.abs(impact.position.z - center.z - 16.46) < .02);
  assert.ok(Math.hypot(impact.position.x - h.actor.position.x, impact.position.z - h.actor.position.z) > .55,
    'a failed exit phone must not strike Neo in place of its own front panel');
});

test('a paused sprint into the hotel checkpoint retains its complete escape action across release and restore', () => {
  const h = setup('m1_city_chase'); h.command('act'); h.frames(MATRIX_ESCAPE.city.briefing + .2);
  h.actor.position = filmStepPosition(h.scene, h.scene.steps[0]); h.frames(MATRIX_ESCAPE.city.phoneFailure + .4);
  h.actor.position = filmStepPosition(h.scene, h.scene.steps[1]); h.frames(MATRIX_ESCAPE.city.truckWarning + .2);
  const state = h.sandbox.life.film.state!;
  h.frames(MATRIX_ESCAPE.city.truckBeat - state.matrixEscape!.elapsed);
  h.players.act('escape-player', 'dodge', h.tick()); h.frames(MATRIX_ESCAPE.city.possession + .2);
  assert.equal(state.step, 2); assert.equal(state.matrixEscape!.phase, 'running');
  const goal = filmStepPosition(h.scene, h.scene.steps[2]);
  for (let i = 0; i < 100 && state.matrixEscape!.phase === 'running'; i++) {
    const dx = goal.x - h.actor.position.x, dz = goal.z - h.actor.position.z, gap = Math.hypot(dx, dz);
    h.frames(.1, { x: dx / gap, z: dz / gap, sprint: true });
  }
  assert.equal(state.matrixEscape!.phase, 'door_ready'); assert.equal(h.actor.currentAction?.type, 'move_to');
  h.frames(.1, {}, false); h.players.setRunning(false); h.world.simulationTick = h.tick();
  const action = structuredClone(h.actor.currentAction), clock = structuredClone(state.matrixEscape), position = { ...h.actor.position };
  assert.ok(action?.parameters.matrixEscape); assert.equal(action.type, 'move_to');
  h.players.release('escape-player', h.tick());
  assert.deepEqual(h.actor.currentAction, action, 'disconnect must retain the actual saved sprint action');
  h.sandbox.restore(structuredClone(h.sandbox.state));
  assert.deepEqual(h.players.possess('returned-player', 'neo', h.tick()), { agentId: 'neo' });
  assert.deepEqual(h.actor.currentAction, action); assert.deepEqual(h.actor.position, position);
  assert.deepEqual(h.sandbox.life.film.state!.matrixEscape, clock);
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
