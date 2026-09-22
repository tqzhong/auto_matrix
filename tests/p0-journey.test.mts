import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FILM_SETS,
  FILM_SCENE_BY_ID,
  HOTEL_DOOR_PROGRESS,
  HOTEL_ROUTE,
  LAFAYETTE,
  MEETING_DRIVE_SECONDS,
  WAKE_CALL,
  filmPosition,
  filmStepPosition,
  type Vector3,
  type WorldEvent,
} from '@auto_matrix/shared';
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
  const players = new PlayerController(world, { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine,
    {} as ActionExecutor, dynamics, sandbox);
  players.possess('player', 'neo', 0); const neo = world.agents.get('neo')!;
  sandbox.life.begin(neo, 0); sandbox.state.neoLife!.chapter = 2;
  let tick = 0; let sequence = 0;
  const state = () => sandbox.life.film.state!;
  const command = (target: string) => players.sandboxAction('player', { kind: 'life', target: `film:${target}` }, ++tick);
  const frame = (input: Partial<{ x: number; z: number; yaw: number; sprint: boolean; crouch: boolean; focus: boolean; climb: number }> = {}, running = true) => {
    players.receiveInput('player', { x: 0, z: 0, yaw: neo.rotation, jump: false, sprint: false, ...input, sequence: ++sequence });
    players.step(.05, running, tick);
    if (running && sequence % 10 === 0) sandbox.tick(++tick);
  };
  const frames = (seconds: number, input: Parameters<typeof frame>[0] = {}, running = true) => {
    for (let i = 0; i < Math.ceil(seconds / .05); i++) frame(input, running);
  };
  const walk = (target: Vector3, options: { crouch?: boolean; sprint?: boolean; stopOnCapture?: boolean } = {}) => {
    for (let i = 0; i < 2400; i++) {
      const dx = target.x - neo.position.x; const dz = target.z - neo.position.z; const gap = Math.hypot(dx, dz);
      if (gap < .3 && Math.abs(target.y - neo.position.y) < .7) return true;
      frame({ x: dx / Math.max(1, gap), z: dz / Math.max(1, gap), yaw: Math.atan2(dx, dz), crouch: options.crouch, sprint: options.sprint });
      if (options.stopOnCapture && state().office?.outcome === 'captured') return false;
    }
    assert.fail(`could not walk from ${JSON.stringify(neo.position)} to ${JSON.stringify(target)}`);
  };
  const walkLocal = (set: keyof typeof FILM_SETS, x: number, z: number, y = FILM_SETS[set].center.y, options?: Parameters<typeof walk>[1]) =>
    walk({ ...filmPosition(set, x, z), y }, options);
  const reload = () => {
    const saved = JSON.parse(JSON.stringify(sandbox.state));
    sandbox.restore(saved); players.release('player', tick); players.possess('player', 'neo', tick);
  };
  command('continue');
  return { world, sandbox, players, neo, state, command, frame, frames, walk, walkLocal, reload, tick: () => tick };
}

type Harness = ReturnType<typeof setup>;

function completeWorkday(h: Harness) {
  assert.equal(h.state().scene, 'm1_boss');
  for (const [x, z] of [[-11, 20.5], [-11, 26], [-17, 27.4]]) h.walkLocal('film_metacortex_floor', x, z);
  h.command('act'); h.frames(10); assert.equal(h.state().workday?.phase, 'answer'); h.command('act');
  for (const [x, z] of [[-11, 26], [-11, 20.5], [0, 20.5], [8, 20.5], [8, 11], [14, 11], [14, 6.7]]) h.walkLocal('film_metacortex_floor', x, z);
  h.command('act'); h.frames(11); assert.equal(h.state().workday?.phase, 'signature');
  h.command('act'); h.frames(4.2); assert.equal(h.state().workday?.phase, 'delivered');
  h.command('act'); h.frames(3); assert.equal(h.state().phone?.phase, 'ready');
  h.command('act'); h.frames(11); assert.equal(h.state().step, 2);
  h.command('next'); assert.equal(h.state().scene, 'm1_office_escape');
}

function answerSecondCall(h: Harness) {
  assert.equal(h.state().scene, 'm1_wake_again');
  h.frames(WAKE_CALL.waking + .2); assert.equal(h.state().wakeCall?.phase, 'ringing');
  h.walk(filmStepPosition(FILM_SCENE_BY_ID.m1_wake_again, FILM_SCENE_BY_ID.m1_wake_again.steps[0]));
  h.command('act'); h.frames(WAKE_CALL.pickup + WAKE_CALL.listening + .4);
  assert.equal(h.state().wakeCall?.phase, 'decision');
  h.reload(); assert.equal(h.state().wakeCall?.phase, 'decision');
  h.command('act'); h.frames(WAKE_CALL.reply + .2); assert.equal(h.state().step, 1);
  h.walk(filmStepPosition(FILM_SCENE_BY_ID.m1_wake_again, FILM_SCENE_BY_ID.m1_wake_again.steps[1]));
  assert.equal(h.state().step, 2); h.command('next'); assert.equal(h.state().scene, 'm1_bridge');
}

function meetAndTravel(h: Harness, tracker: boolean) {
  const bridge = FILM_SCENE_BY_ID.m1_bridge;
  h.walk(filmStepPosition(bridge, bridge.steps[0])); assert.equal(h.state().step, 1);
  h.command('act'); h.frames(9); assert.equal(h.state().meeting?.phase, 'choice');
  h.command('meeting:stay'); assert.equal(h.state().scene, 'm1_bug');
  h.frames(10);
  if (tracker) {
    assert.equal(h.state().meeting?.phase, 'located'); h.frames(14, { focus: true });
  }
  assert.equal(h.state().meeting?.phase, 'done'); assert.equal(h.state().office?.bugged, false);
  h.command('reflect:trust'); assert.equal(h.state().step, 2); h.command('next');
  assert.equal(h.state().meeting?.phase, 'driving'); h.frames(MEETING_DRIVE_SECONDS / 2);
  h.reload(); assert.equal(h.state().meeting?.phase, 'driving'); h.frames(MEETING_DRIVE_SECONDS / 2 + 2);
  assert.equal(h.state().meeting?.phase, 'parked'); h.command('act'); h.frames(9);
  assert.equal(h.state().meeting?.phase, 'outside');
  h.walk(filmStepPosition(FILM_SCENE_BY_ID.m1_bug, FILM_SCENE_BY_ID.m1_bug.steps[2]));
  h.command('act'); assert.equal(h.state().scene, 'm1_pills'); assert.equal(h.state().hotel?.progress, 0);
}

function reachPillChoice(h: Harness) {
  const room = FILM_SETS.film_lafayette; const base = room.center.y - LAFAYETTE.upper;
  for (const point of HOTEL_ROUTE.slice(4, -3)) h.walk({ x: room.center.x + point.x, y: base + point.y, z: room.center.z + point.z });
  h.frames(12); assert.ok(h.state().hotel!.progress >= HOTEL_DOOR_PROGRESS - .01);
  h.command('act'); h.frames(4.6); assert.equal(h.state().hotel?.door, LAFAYETTE.doorSeconds);
  h.walk({ x: room.center.x + 18, y: room.center.y, z: room.center.z }); h.frames(.2);
  assert.equal(h.state().hotel?.welcome?.phase, 'approach'); h.frames(7);
  assert.equal(h.state().hotel?.welcome?.phase, 'ready'); h.command('act'); h.frames(9);
  assert.equal(h.state().hotel?.welcome?.phase, 'done');
  h.walkLocal('film_lafayette', 0, 0); h.walkLocal('film_lafayette', 0, -3.3);
  h.command('act'); h.frames(6); assert.equal(h.state().pills?.phase, 'choice');
}

test('P0 runs continuously from the office phone through a clean escape and the red pill', () => {
  const h = setup(); completeWorkday(h);
  for (const [x, z] of [[-16, 11], [-24, 11], [-24, -13], [-16, -13], [-24, -13], [-24, -27]])
    assert.ok(h.walkLocal('film_metacortex_floor', x, z, undefined, { crouch: true }));
  assert.equal(h.state().step, 2); h.command('act'); h.frames(4); assert.equal(h.state().step, 3);
  h.command('next'); h.frames(6.5); assert.equal(h.state().scene, 'm1_ledge');
  h.walk(filmStepPosition(FILM_SCENE_BY_ID.m1_ledge, FILM_SCENE_BY_ID.m1_ledge.steps[0]));
  assert.equal(h.state().step, 1); h.command('escape:climb'); h.frames(8.5, { climb: 1 });
  assert.equal(h.state().office?.outcome, 'escaped'); h.command('next');
  assert.ok(h.state().skipped?.includes('m1_interrogation')); answerSecondCall(h); meetAndTravel(h, false); reachPillChoice(h);
  h.command('pill:red'); h.frames(14); assert.equal(h.sandbox.state.neoLife!.choices.pill, 'red');
  assert.equal(h.state().step, 2); h.command('next'); assert.equal(h.state().scene, 'm1_mirror');
  assert.deepEqual(h.state().completed.slice(-5), ['m1_ledge', 'm1_wake_again', 'm1_bridge', 'm1_bug', 'm1_pills']);
});

test('P0 runs continuously through capture, interrogation, tracker removal and the blue pill', () => {
  const h = setup(); completeWorkday(h);
  for (const [x, z] of [[-16, 11], [-8, 11], [-8, -13], [-16, -13], [-8, -13], [-8, -24], [-24, -27]]) {
    if (!h.walkLocal('film_metacortex_floor', x, z, undefined, { sprint: true, stopOnCapture: true })) break;
  }
  assert.equal(h.state().office?.outcome, 'captured'); h.command('next'); assert.equal(h.state().scene, 'm1_interrogation');
  h.walk(filmStepPosition(FILM_SCENE_BY_ID.m1_interrogation, FILM_SCENE_BY_ID.m1_interrogation.steps[0]));
  h.command('act'); h.frames(7); assert.equal(h.state().step, 1); h.command('act'); h.frames(25);
  assert.equal(h.state().office?.bugged, true); assert.equal(h.state().step, 2); h.command('next');
  answerSecondCall(h); meetAndTravel(h, true); reachPillChoice(h);
  const life = h.sandbox.state.neoLife!; life.money = 287; life.evidence = ['office_tracker'];
  h.command('blue'); h.frames(14);
  assert.equal(life.journey, undefined); assert.equal(life.chapter, 0); assert.equal(life.choices.pill, 'blue');
  assert.equal(life.money, 287); assert.deepEqual(life.evidence, ['office_tracker']);
  assert.equal(h.neo.currentLocation, 'neo_apartment');
});
