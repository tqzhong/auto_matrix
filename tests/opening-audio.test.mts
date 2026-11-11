import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SCENE_BY_ID, FILM_SETS, OPENING_HOTEL, OPENING_PHONE, filmEntry, openingBoothCrush, openingTruckPose,
  type AgentState, type FilmJourney, type OpeningHotelEncounter, type OpeningPhoneEncounter, type WorldEvent } from '@auto_matrix/shared';
import { Engine } from '../packages/client/src/engine/Engine.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';

function fixture() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const neo = world.agents.get('neo')!, trinity = world.agents.get('trinity')!;
  sandbox.enter(neo); sandbox.life.begin(neo, 0);
  const sounds: string[] = [];
  const audio = {
    landlineSound: (kind: string) => sounds.push(kind), governmentSound: (kind: string) => sounds.push(kind),
    matrixEscapeSound: (kind: string) => sounds.push(kind), meetingSound: (kind: string) => sounds.push(kind),
    interludeSound: (kind: string) => sounds.push(kind), phoneSound: () => sounds.push('line-cut'),
    windowSound: () => sounds.push('wind'), dialogue: () => sounds.push('dialogue'),
  };
  const engine = Object.assign(Object.create(Engine.prototype), { playerControls: { id: 'trinity' }, audio,
    sandboxRenderer: { sync() {} }, updateAtmosphere() {} });
  let lastTick = 20;
  type Frame = { tick?: number; running?: boolean; owner?: string; y?: number; exit?: number };
  function frame(journey: FilmJourney, { tick = lastTick, running = true, owner = 'trinity', y, exit }: Frame = {}) {
    const scene = FILM_SCENE_BY_ID[journey.scene], entry = filmEntry(scene);
    const actor: AgentState = { ...trinity, currentLocation: scene.set, isInMatrix: true, position: { ...entry, y: y ?? entry.y },
      currentAction: exit === undefined ? null : { type: 'move_to', parameters: { roofExit: { elapsed: exit } }, startedAt: tick, duration: 1, progress: 0 } };
    lastTick = tick; engine.running = running; engine.tick = tick; engine.playerControls.id = owner;
    Engine.prototype.setSandbox.call(engine, { ...sandbox.state, neoLife: { ...sandbox.state.neoLife!, journey } }, { trinity: actor, neo });
    return sounds.splice(0);
  }
  return { frame };
}

function journey(scene: string): FilmJourney {
  return { version: 1, scene, actor: 'trinity', step: 0, completed: [], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: filmEntry(FILM_SCENE_BY_ID[scene]) };
}

test('303 sounds follow the line, door, glass and climb through pauses and retries', () => {
  const h = fixture(), j = journey('m1_room303');
  const hotel = (phase: OpeningHotelEncounter['phase'], elapsed = 0, attempts = 0) =>
    ({ ...j, enteredAt: phase === 'done' ? 27 : j.enteredAt,
      openingHotel: { phase, elapsed, lastTick: 20, attempts, disarmed: true, ammo: 0, shots: 0 } });
  assert.deepEqual(h.frame(hotel('trace')), []);
  assert.deepEqual(h.frame(hotel('breach')), ['hangup']);
  assert.deepEqual(h.frame(hotel('breach', .3)), []);
  assert.deepEqual(h.frame(hotel('breach', .5)), ['door']);
  assert.deepEqual(h.frame(hotel('breach', .6)), []);
  assert.deepEqual(fixture().frame(hotel('breach', .7)), [], 'cold resume after contact does not replay the door');
  assert.deepEqual(h.frame(hotel('combat', 0, 1)), [], 'retry starts after the door has opened');
  assert.deepEqual(h.frame(hotel('phone', 0, 1)), ['ring']);
  assert.deepEqual(h.frame(hotel('phone', 0, 1), { tick: 26 }), []);
  assert.deepEqual(h.frame(hotel('phone', 0, 1), { tick: 27 }), ['ring']);
  const { grasp, release } = OPENING_HOTEL.phone;
  assert.deepEqual(h.frame(hotel('answering', grasp - .02, 1)), []);
  assert.deepEqual(h.frame(hotel('answering', grasp, 1)), ['pickup']);
  assert.deepEqual(h.frame(hotel('answering', 3, 1), { running: false }), []);
  assert.deepEqual(h.frame(hotel('answering', 3, 1)), []);
  assert.deepEqual(h.frame(hotel('answering', release, 1)), ['hangup']);
  assert.deepEqual(h.frame(hotel('corridor', 0, 1)), []);
  assert.deepEqual(fixture().frame(hotel('answering', 3, 1)), [], 'cold recovery must keep the call quiet until the next cue');
  assert.deepEqual(h.frame(hotel('dive', .35, 1)), []);
  assert.deepEqual(h.frame(hotel('dive', .5, 1)), ['glass']);
  assert.deepEqual(h.frame(hotel('dive', 1, 1), { running: false }), []);
  assert.deepEqual(h.frame(hotel('dive', 1, 1)), []);
  assert.deepEqual(h.frame(hotel('dive', 1.59, 1)), []);
  assert.deepEqual(h.frame(hotel('dive', 1.6, 1)), ['body']);
  assert.deepEqual(h.frame(hotel('dive', 1.68, 1), { running: false }), []);
  assert.deepEqual(h.frame(hotel('dive', 1.68, 1)), []);
  assert.deepEqual(h.frame(hotel('ladder_ready', 0, 1)), []);
  assert.deepEqual(h.frame(hotel('climbing', 0, 1)), ['keys']);
  assert.deepEqual(h.frame(hotel('done', 0, 1)), ['keys']);
  assert.deepEqual(h.frame(hotel('done', 0, 1)), []);
});

test('the roof sounds play on landing and at the saved window beat', () => {
  const h = fixture(), j = journey('m1_roofs'), y = FILM_SETS.film_hotel_roofs.center.y;
  const openingRoof = { phase: 'running' as const, attempts: 0, lastTick: 20 };
  h.frame(journey('m1_room303'));
  assert.deepEqual(h.frame({ ...j, openingRoof }), ['wind']);
  assert.deepEqual(h.frame({ ...j, openingRoof }, { y: y + .8 }), []);
  assert.deepEqual(h.frame({ ...j, openingRoof }, { y }), ['body']);
  assert.deepEqual(h.frame({ ...j, openingRoof: { ...openingRoof, leap: { elapsed: .9, fromX: 0, toX: 0 } } }), []);
  assert.deepEqual(h.frame({ ...j, openingRoof: { ...openingRoof, crossed: true } }), ['body']);
  assert.deepEqual(h.frame({ ...j, openingRoof }, { exit: 1.67 }), []);
  assert.deepEqual(h.frame({ ...j, openingRoof }, { exit: 1.68 }), ['glass']);
  assert.deepEqual(h.frame({ ...j, openingRoof: { ...openingRoof, phase: 'escaped' } }), []);
  assert.deepEqual(fixture().frame({ ...j, openingRoof }, { exit: 2 }), [], 'a restored roof pose does not replay the broken window');
});

test('Wells rings until grasp, disconnects on success and sounds the physical booth contact once', () => {
  const h = fixture(), j = journey('m1_phone_escape');
  const running: OpeningPhoneEncounter = { phase: 'running', remaining: 15, lastTick: 20, attempts: 0 };
  const answer = { elapsed: OPENING_PHONE.graspSeconds - .01, origin: { x: -.55, y: 0, z: -28.85 }, yaw: Math.PI };
  const push = (openingPhone: OpeningPhoneEncounter, options?: Parameters<typeof h.frame>[1]) =>
    h.frame({ ...j, enteredAt: openingPhone.phase === 'connected' || openingPhone.phase === 'done' ? 27 : j.enteredAt, openingPhone }, options);
  assert.deepEqual(push(running, { running: false }), []);
  assert.deepEqual(push(running), ['ring']);
  const reaching = { ...running, phase: 'answering' as const, remaining: 7, answer };
  assert.deepEqual(push(reaching), []);
  assert.deepEqual(push({ ...reaching, answer: { ...answer, elapsed: OPENING_PHONE.graspSeconds } }), ['pickup']);
  assert.deepEqual(push({ ...reaching, answer: { ...answer, elapsed: 1.5 } }, { tick: 27 }), []);
  const connected = { ...reaching, phase: 'connected' as const, answer: { ...answer, elapsed: OPENING_PHONE.answerSeconds }, impactElapsed: 0 };
  assert.deepEqual(push(connected), ['line-cut']);
  const samples = Array.from({ length: 135 }, (_, index) => ({ ...connected, impactElapsed: (index + 1) / 100 }));
  const impact = samples.find(phone => openingBoothCrush(openingTruckPose(phone)) > .06)!;
  assert.ok(impact);
  assert.deepEqual(push(impact), ['truck-impact', 'glass']);
  assert.deepEqual(push(impact), []);
  const done = { ...impact, phase: 'done' as const, impactElapsed: 1.35 };
  const aftermath = (elapsed: number) => ({ ...done, aftermath: { elapsed, cast: {} as NonNullable<OpeningPhoneEncounter['aftermath']>['cast'] } });
  assert.deepEqual(push(done), []);
  assert.deepEqual(push(aftermath(.38)), []);
  assert.deepEqual(push(aftermath(.5)), ['door']);
  assert.deepEqual(push(aftermath(3.4)), []);
  assert.deepEqual(push(aftermath(3.45)), ['door']);
  assert.deepEqual(fixture().frame({ ...j, openingPhone: aftermath(9) }), []);
});

test('Wells timeout and body contact follow the new attempt while visits and other players stay quiet', () => {
  const h = fixture(), j = journey('m1_phone_escape');
  const running: OpeningPhoneEncounter = { phase: 'running', remaining: .1, lastTick: 20, attempts: 0 };
  const push = (openingPhone: OpeningPhoneEncounter) => h.frame({ ...j, openingPhone });
  push(running);
  const failed = { ...running, phase: 'failed' as const, remaining: 0, impactElapsed: 0 };
  assert.deepEqual(push(failed), [], 'timeout is earlier than physical contact');
  const hit = { elapsed: .05, at: .2, origin: { x: -.55, y: 0, z: -28.85 }, yaw: 0, direction: { x: 1, z: 0 } };
  assert.deepEqual(push({ ...failed, hit }), ['body']);
  assert.deepEqual(push({ ...failed, hit }), []);
  assert.deepEqual(push({ ...running, remaining: 15, attempts: 1 }), ['ring']);
  assert.deepEqual(h.frame({ ...j, openingPhone: running, visiting: 'm1_phone_escape' }), []);
  assert.deepEqual(h.frame({ ...j, openingPhone: running }, { owner: 'neo' }), []);
  assert.deepEqual(fixture().frame({ ...j, openingPhone: { ...failed, impactElapsed: undefined } }), []);
});
