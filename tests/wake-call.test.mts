import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { APARTMENT, FILM_SCENE_BY_ID, WAKE_CALL, filmPosition, filmStepPosition, playerBlocked, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import { ApartmentSetRenderer } from '../packages/client/src/engine/ApartmentSetRenderer.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

function setup(outcome: 'captured' | 'escaped') {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const players = new PlayerController(world, { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine,
    {} as ActionExecutor, dynamics, sandbox);
  players.possess('player', 'neo', 0); const neo = world.agents.get('neo')!; sandbox.life.begin(neo, 0);
  const scene = FILM_SCENE_BY_ID[outcome === 'captured' ? 'm1_interrogation' : 'm1_ledge'];
  sandbox.state.neoLife!.journey = { version: 1, scene: scene.id, actor: 'neo', step: scene.steps.length, completed: [scene.id], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: filmPosition(scene.set), office: { alert: outcome === 'captured' ? 100 : 0, suspicion: [], waypoints: [], lastTick: 0,
      guide: '', outcome, bugged: outcome === 'captured' } };
  neo.currentLocation = scene.set; neo.position = filmPosition(scene.set); neo.isInMatrix = true;
  let tick = 0;
  const command = (target: string) => players.sandboxAction('player', { kind: 'life', target: `film:${target}` }, ++tick);
  const frames = (seconds: number, running = true) => { for (let i = 0; i < Math.round(seconds / .05); i++) { players.step(.05, running, tick); if (running && i % 10 === 0) sandbox.tick(++tick); } };
  command('next');
  return { world, sandbox, players, neo, command, frames, tick: () => tick, state: () => sandbox.life.film.state! };
}

function reachDecision(h: ReturnType<typeof setup>) {
  h.frames(WAKE_CALL.waking + .2);
  assert.equal(h.state().wakeCall?.phase, 'ringing');
  h.neo.position = filmStepPosition(FILM_SCENE_BY_ID.m1_wake_again, FILM_SCENE_BY_ID.m1_wake_again.steps[0]);
  h.command('act'); h.frames(WAKE_CALL.pickup + WAKE_CALL.listening + .4);
  assert.equal(h.state().wakeCall?.phase, 'decision');
}

test('captured Neo physically wakes, answers the landline and must personally agree to meet Morpheus', () => {
  const h = setup('captured');
  assert.equal(h.state().scene, 'm1_wake_again'); assert.deepEqual(h.state().wakeCall, { phase: 'waking', elapsed: 0, nightmare: true });
  assert.ok(h.neo.currentAction?.parameters.wakeCall, 'waking starts as a physical performance');
  h.frames(WAKE_CALL.waking + .2); assert.equal(h.state().wakeCall?.phase, 'ringing'); assert.equal(h.state().step, 0);
  assert.equal(h.neo.currentAction?.parameters.wakeCall, undefined, 'Neo regains movement and must walk to the phone');
  assert.match(h.command('act'), /座机/); assert.equal(h.state().wakeCall?.phase, 'ringing');
  h.neo.position = filmStepPosition(FILM_SCENE_BY_ID.m1_wake_again, FILM_SCENE_BY_ID.m1_wake_again.steps[0]);
  h.command('act'); assert.equal(h.state().wakeCall?.phase, 'pickup');
  h.frames(WAKE_CALL.pickup + WAKE_CALL.listening + .4); assert.equal(h.state().wakeCall?.phase, 'decision');
  h.frames(30); assert.equal(h.state().wakeCall?.phase, 'decision'); assert.equal(h.state().step, 0, 'waiting cannot answer Morpheus for Neo');
  h.command('act'); assert.equal(h.state().wakeCall?.phase, 'reply'); h.frames(WAKE_CALL.reply + .2);
  assert.equal(h.state().wakeCall?.phase, 'done'); assert.equal(h.state().step, 1); assert.equal(h.state().office?.bugged, true);
  h.neo.position = filmStepPosition(FILM_SCENE_BY_ID.m1_wake_again, FILM_SCENE_BY_ID.m1_wake_again.steps[1]); h.frames(.2);
  assert.equal(h.state().step, 2); h.command('next'); assert.equal(h.state().scene, 'm1_bridge'); assert.equal(h.state().office?.bugged, true);
});

test('the successful office escape reaches the same call without inventing an interrogation nightmare or tracker', () => {
  const h = setup('escaped');
  assert.equal(h.state().wakeCall?.nightmare, false); reachDecision(h); h.command('act'); h.frames(WAKE_CALL.reply + .2);
  assert.equal(h.state().step, 1); assert.equal(h.state().office?.bugged, false); assert.match(h.state().lastText, /Adams Street/);
});

test('the exact handset beat and body pose survive pause, disconnect, save restore and retry', () => {
  const h = setup('captured'); h.frames(WAKE_CALL.waking + .2);
  h.neo.position = filmStepPosition(FILM_SCENE_BY_ID.m1_wake_again, FILM_SCENE_BY_ID.m1_wake_again.steps[0]); h.command('act'); h.frames(WAKE_CALL.pickup + 2.35);
  const expected = structuredClone(h.state().wakeCall); const position = { ...h.neo.position }; const gesture = structuredClone(h.neo.currentAction?.parameters.wakeCall);
  assert.equal(expected?.phase, 'listening');
  h.frames(2, false); assert.deepEqual(h.state().wakeCall, expected);
  h.players.release('player', h.tick()); h.frames(2); assert.deepEqual(h.state().wakeCall, expected);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); h.players.possess('player', 'neo', h.tick());
  assert.deepEqual(h.state().wakeCall, expected); assert.deepEqual(h.neo.position, position); assert.deepEqual(h.neo.currentAction?.parameters.wakeCall, gesture);
  h.neo.status = 'dead'; h.command('retry'); assert.deepEqual(h.state().wakeCall, expected); assert.deepEqual(h.neo.position, position);
});

test('the bedside-to-landline route is clear and the apartment set owns a visible base, handset and cord', t => {
  for (let i = 0; i <= 100; i++) {
    const x = APARTMENT.bedside.x + (APARTMENT.phone.approachX - APARTMENT.bedside.x) * i / 100;
    const z = APARTMENT.bedside.z + (APARTMENT.phone.approachZ - APARTMENT.bedside.z) * i / 100;
    assert.equal(playerBlocked(filmPosition('film_anderson_flat', x, z), true), false, `phone route blocked at ${x}, ${z}`);
  }
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillStyle: '', shadowColor: '', shadowBlur: 0, font: '', textAlign: '', textBaseline: '', fillRect() {}, fillText() {} }) }) } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const root = new THREE.Group(); const renderer = new ApartmentSetRenderer(root);
  try {
    for (const name of ['apartment-landline-base', 'apartment-landline-handset', 'apartment-landline-cord']) assert.ok(root.getObjectByName(name), name);
    renderer.update({ version: 1, scene: 'm1_wake_again', step: 0, actor: 'neo', completed: [], enteredAt: 0, reflections: {}, lastText: '', checkpoint: filmPosition('film_anderson_flat'),
      wakeCall: { phase: 'ringing', elapsed: .11, nightmare: true } });
    const handset = root.getObjectByName('apartment-landline-handset')!; assert.equal(handset.visible, true);
    assert.ok(Math.abs(handset.rotation.z) > .001, 'the ringing handset must visibly vibrate in its cradle');
    renderer.update({ version: 1, scene: 'm1_wake_again', step: 0, actor: 'neo', completed: [], enteredAt: 0, reflections: {}, lastText: '', checkpoint: filmPosition('film_anderson_flat'),
      wakeCall: { phase: 'listening', elapsed: 2, nightmare: true } });
    assert.equal(handset.visible, false, 'the cradle handset transfers to Neo hand during the call');
  } finally { renderer.dispose(); globalThis.document = document; }
});
