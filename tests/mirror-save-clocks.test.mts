import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SCENE_BY_ID, FILM_SETS, filmStepPosition, mirrorTime, type AwakeningBeat, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

function fixture(elapsed: number, kind: AwakeningBeat['kind'] = 'mirror') {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const players = new PlayerController(world, { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine,
    {} as ActionExecutor, dynamics, sandbox);
  players.possess('mirror-player', 'neo', 0); const neo = world.agents.get('neo')!; sandbox.life.begin(neo, 0);
  const scene = FILM_SCENE_BY_ID[kind === 'mirror' ? 'm1_mirror' : kind === 'recovery' ? 'm1_recovery'
    : kind === 'cabin' || kind === 'core' ? 'm1_cabin' : kind === 'construct' ? 'm1_construct' : kind === 'desert' ? 'm1_desert' : 'm1_pod'];
  const beat: AwakeningBeat = kind === 'mirror' ? { kind, elapsed, chairMotion: 'stepping', approach: { x: -6.8, z: -14, yaw: -2.68 } } : { kind, elapsed };
  sandbox.state.neoLife!.journey = { version: 1, scene: scene.id, actor: 'neo', step: 0, enteredAt: 0, completed: [], reflections: {},
    checkpoint: filmStepPosition(scene, scene.steps[0]), lastText: '', awakening: beat };
  neo.currentLocation = scene.set; neo.isInMatrix = FILM_SETS[scene.set].world === 'matrix'; world.simulationTick = 1400;
  sandbox.life.film.awakeningFrame(neo, 0, 1400); players.step(0, false, 1400);
  const crew = kind === 'mirror' ? ['trinity'] : kind === 'rescue' ? ['morpheus', 'trinity'] : kind === 'recovery' ? ['morpheus', 'dozer']
    : ['cabin', 'core', 'construct', 'desert'].includes(kind) ? ['morpheus'] : [];
  const performers = [neo, ...crew.map(id => world.agents.get(id)!)];
  for (const [index, actor] of performers.entries()) { actor.currentAction!.startedAt = 1300 + index; actor.currentAction!.progress = index ? 1 : .37; }
  return { world, sandbox, players, neo, performers, actions: () => performers.map(actor => structuredClone(actor.currentAction)) };
}

test('paused mirror entry and touch retain both performers action clocks through release, restore and re-entry', () => {
  for (const elapsed of [.879, 12]) {
    const h = fixture(elapsed), before = h.actions(), saved = structuredClone(h.sandbox.state);
    h.players.release('mirror-player', 1451);
    assert.deepEqual(h.actions(), before, `${elapsed}: releasing must not restart either saved action`);
    h.sandbox.restore(saved); assert.deepEqual(h.actions(), before);
    h.players.possess('mirror-player', 'neo', 1452); h.players.step(0, false, 1453);
    assert.deepEqual(h.actions(), before, 'paused reconnect and zero-duration frames keep the original clocks');
    assert.deepEqual(h.sandbox.life.film.state!.awakening, saved.neoLife!.journey!.awakening);
    h.players.step(.1, true, 1454);
    assert.ok(h.sandbox.life.film.state!.awakening!.elapsed > elapsed);
    assert.ok(h.actions().every(action => action?.startedAt === 1454 && action.progress === 0), 'live frames still create the next performance actions');
  }
});

test('mirror restore repairs missing or stale actions instead of retaining the wrong saved beat', () => {
  const h = fixture(.879); h.players.release('mirror-player', 1400);
  h.neo.currentAction = null; h.performers[1].currentAction = null;
  h.sandbox.restore(structuredClone(h.sandbox.state));
  assert.equal(h.neo.currentAction?.parameters.mirrorBeat, 0);
  assert.equal(h.performers[1].currentAction?.parameters.mirrorCrew, 0);
  const old = h.actions(); h.sandbox.life.film.state!.awakening!.elapsed = 12;
  h.sandbox.life.film.awakeningFrame(h.neo, 0, 1450);
  const clock = mirrorTime(h.sandbox.life.film.state!.awakening!);
  assert.ok(clock > 0, 'the changed beat must have reached the mirror after the entry footsteps');
  assert.equal(h.neo.currentAction?.parameters.mirrorBeat, clock);
  assert.equal(h.performers[1].currentAction?.parameters.mirrorCrew, clock);
  assert.notDeepEqual(h.actions(), old);
  assert.ok(h.actions().every(action => action?.startedAt === 1450));
});

test('pod, rescue, recovery and reveal actions keep their clocks through paused release, restore and re-entry', () => {
  for (const [kind, elapsed] of [['emerge', 1.3], ['breather', 2.5], ['disconnect', 5.57], ['rescue', 4.5],
    ['recovery', 2.4], ['cabin', 3.2], ['core', 3.2], ['construct', 4.2], ['desert', 2.4]] as const) {
    const h = fixture(elapsed, kind), before = h.actions(), saved = structuredClone(h.sandbox.state);
    h.players.release('mirror-player', 1451); assert.deepEqual(h.actions(), before, kind + ': release keeps all performer clocks');
    h.sandbox.restore(saved); assert.deepEqual(h.actions(), before, kind + ': loading keeps all performer clocks');
    h.players.possess('mirror-player', 'neo', 1452); h.players.step(0, false, 1453);
    assert.deepEqual(h.actions(), before, kind + ': paused re-entry keeps the saved actions');
    assert.deepEqual(h.sandbox.life.film.state!.awakening, saved.neoLife!.journey!.awakening);
    h.sandbox.life.film.awakeningFrame(h.neo, .1, 1454, true);
    assert.ok(h.sandbox.life.film.state!.awakening!.elapsed > elapsed, kind + ': normal playback continues');
    assert.ok(h.actions().every(action => action?.startedAt === 1454 && action.progress === 0), kind + ': live frames still create new actions');
  }
});

test('a paused pod rescue keeps the patient and boarding crew motion through release and re-entry', () => {
  for (const elapsed of [3.65, 8.2]) {
    const h = fixture(elapsed, 'rescue');
    h.players.step(.1, true, 1401);
    const motion = () => h.performers.map(actor => ({ position: actor.position, rotation: actor.rotation, velocity: actor.velocity, action: actor.currentAction }));
    const before = structuredClone(motion()), saved = structuredClone(h.sandbox.state);
    assert.ok(elapsed < 4 ? before[0].velocity.y > 0 : before[0].velocity.y < 0);
    if (elapsed > 8) assert.ok(before.slice(1).every(actor => Math.hypot(actor.velocity.x, actor.velocity.z) > .1));
    h.players.step(0, false, 1401);
    assert.deepEqual(motion(), before, `${elapsed}: pausing retains the current rescue pose and motion`);
    h.players.release('mirror-player', 1401);
    assert.deepEqual(motion(), before, `${elapsed}: releasing keeps the motion from the last live frame`);
    h.sandbox.restore(saved);
    h.players.possess('mirror-player', 'neo', 1401);
    assert.deepEqual(motion(), before, `${elapsed}: restoring the same rescue clock keeps the saved pose and motion`);
    h.players.step(.1, true, 1402);
    assert.ok(h.sandbox.life.film.state!.awakening!.elapsed > saved.neoLife!.journey!.awakening!.elapsed);
    assert.notDeepEqual(h.neo.position, before[0].position);
  }
});

test('awakening restore rebuilds absent or unrelated actions for Neo and the current supporting cast', () => {
  for (const kind of ['disconnect', 'rescue', 'recovery', 'cabin', 'core'] as const) {
    const h = fixture(3.2, kind), expected = h.actions().map(action => action!.parameters);
    for (const actor of h.performers) actor.currentAction = null;
    h.sandbox.life.film.awakeningFrame(h.neo, 0, 1450);
    assert.deepEqual(h.actions().map(action => action!.parameters), expected, kind + ': missing actions are reconstructed');
    for (const actor of h.performers) actor.currentAction!.parameters = { unrelated: true };
    h.sandbox.life.film.awakeningFrame(h.neo, 0, 1451);
    assert.deepEqual(h.actions().map(action => action!.parameters), expected, kind + ': stale actions cannot survive restore');
    assert.ok(h.actions().every(action => action?.startedAt === 1451 && action.progress === 0));
  }
});

test('awakening clock preservation does not retain an unrelated player action or an ordinary daily idle', () => {
  const h = fixture(5.57, 'disconnect'); h.neo.currentAction!.type = 'move_to';
  h.players.release('mirror-player', 1451);
  assert.equal(h.neo.currentAction?.type, 'idle'); assert.equal(h.neo.currentAction?.startedAt, 1451);
  const daily = fixture(5.57, 'disconnect'); delete daily.sandbox.state.neoLife!.journey;
  daily.players.release('mirror-player', 1451); assert.equal(daily.neo.currentAction, null);
});

test('Construct arrival and residual-image actions retain saved metadata across paused reconnects', () => {
  for (const [phase, elapsed] of [['ready', 0], ['image', 3.2]] as const) {
    const h = fixture(0, 'construct'), state = h.sandbox.life.film.state!;
    delete state.awakening; state.constructArrival = { phase, elapsed }; h.sandbox.life.film.awakeningFrame(h.neo, 0, 1400);
    for (const [index, actor] of h.performers.entries()) { actor.currentAction!.startedAt = 1300 + index; actor.currentAction!.progress = index ? 1 : .37; }
    const before = h.actions(), saved = structuredClone(h.sandbox.state);
    h.players.release('mirror-player', 1451); assert.deepEqual(h.actions(), before, phase + ': release preserves both actions');
    h.sandbox.restore(saved); h.players.possess('mirror-player', 'neo', 1452); h.players.step(0, false, 1453);
    assert.deepEqual(h.actions(), before, phase + ': cold re-entry preserves both actions');
    if (phase === 'ready') h.players.sandboxAction('mirror-player', { kind: 'life', target: 'film:act' }, 1454);
    else h.sandbox.life.film.awakeningFrame(h.neo, .1, 1454);
    assert.equal(h.sandbox.life.film.state!.constructArrival!.phase, 'image');
    assert.ok(h.actions().every(action => action?.startedAt === 1454 && action.progress === 0), 'a new phase or live frame still creates current actions');
  }
});

test('Construct arrival rebuilds missing, stale and wrong-role player gestures', () => {
  const h = fixture(0, 'construct'), state = h.sandbox.life.film.state!; delete state.awakening; state.constructArrival = { phase: 'image', elapsed: 3.2 };
  h.sandbox.life.film.awakeningFrame(h.neo, 0, 1400); const expected = structuredClone(h.neo.currentAction!.parameters);
  for (const gesture of [undefined, { role: 'morpheus', phase: 'image', elapsed: 3.2 }, { role: 'neo', phase: 'ready', elapsed: 0 }]) {
    if (gesture) h.neo.currentAction!.parameters = { player: true, resolved: true, seated: false, construct: gesture }; else h.neo.currentAction = null;
    h.sandbox.life.film.awakeningFrame(h.neo, 0, 1450); assert.deepEqual(h.neo.currentAction?.parameters, expected); assert.equal(h.neo.currentAction?.startedAt, 1450);
  }
});
