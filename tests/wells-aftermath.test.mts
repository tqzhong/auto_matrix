import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SCENE_BY_ID, FILM_SETS, WELLS_AFTERMATH, filmEntry, filmPosition, type WorldEvent } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';

const scene = FILM_SCENE_BY_ID.m1_phone_escape;
const roles = ['smith', 'agent_jones', 'agent_brown'];

function setup(remaining = 8) {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const conversations = { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const players = new PlayerController(world, conversations, { execute() {} } as unknown as ActionExecutor, dynamics, sandbox);
  const command = (target: string) => players.sandboxAction('caller', { kind: 'life', target: `film:${target}` }, 0);
  players.possess('caller', 'neo', 0); sandbox.life.begin(world.agents.get('neo')!, 0); sandbox.state.neoLife!.chapter = 1;
  command('start');
  const state = () => sandbox.life.film.state!;
  Object.assign(state(), { scene: scene.id, step: 1, actor: 'trinity', checkpoint: filmEntry(scene),
    completed: ['m1_room303', 'm1_roofs'], openingPhone: { phase: 'running', remaining, lastTick: 0, attempts: 0 } });
  const caller = world.agents.get('trinity')!;
  caller.currentLocation = scene.set; caller.isInMatrix = true; caller.position = filmPosition(scene.set, -.55, -28.85); caller.rotation = Math.PI;
  players.possess('caller', 'trinity', 0);
  const phone = () => state().openingPhone!;
  const frame = (count = 1, running = true) => { for (let i = 0; i < count; i++) players.step(.05, running, 0); };
  const cast = () => roles.map(id => world.agents.get(id)!);
  function crash() {
    command('act');
    for (let i = 0; i < 80 && phone().phase !== 'done' && phone().phase !== 'failed'; i++) frame();
  }
  return { state, phone, sandbox, players, caller, command, frame, cast, crash };
}

test('Wells aftermath: watch the inspection and all three agents before taking over Neo', () => {
  const h = setup(), before = structuredClone(h.cast());
  h.command('act'); h.frame(20);
  assert.deepEqual(h.cast(), before, 'the agents stay offstage while Trinity lifts the receiver');
  h.frame(40);
  assert.equal(h.phone().phase, 'done');
  assert.match(h.command('next'), /特工/);
  assert.equal(h.state().scene, scene.id);
  h.frame(120);
  assert.deepEqual(h.cast().map(agent => agent.currentLocation), roles.map(() => scene.set));
  assert.ok(h.cast().every(agent => agent.currentAction?.parameters.wellsAftermath));
  h.frame(160);
  assert.match(h.state().lastText, /Neo/);
  h.command('next');
  assert.equal(h.state().scene, 'm1_wake_up');
  assert.equal(h.players.getAgent('caller')?.id, 'neo');
  assert.equal(h.state().completed.length, 3);
  assert.deepEqual(h.cast(), before, 'leaving the street releases the agents back to their original state');
});

test('Wells aftermath: Neo wakes at the computer and resumes the saved take before trying the keyboard', () => {
  const h = setup(); h.crash(); h.frame(270); h.command('next');
  const neo = h.players.getAgent('caller')!;
  assert.equal(h.state().scene, 'm1_wake_up');
  assert.equal(h.state().contact?.phase, 'arrival');
  assert.deepEqual(neo.position, filmPosition(neo.currentLocation, -9, -8.8));
  h.frame(18);
  const contact = structuredClone(h.state().contact), action = structuredClone(neo.currentAction);
  h.frame(40, false);
  h.players.release('caller', 9);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  h.players.possess('caller', 'neo', 9);
  assert.deepEqual(h.state().contact, contact);
  assert.deepEqual(neo.currentAction, action);
  h.command('act');
  assert.equal(h.state().contact?.phase, 'arrival');
  for (let i = 0; i < 80 && h.state().contact?.phase === 'arrival'; i++) h.frame();
  assert.equal(h.state().contact?.phase, 'signal');
  assert.deepEqual(neo.position, filmPosition(neo.currentLocation, -9, -8.8));
  h.command('act');
  assert.equal(h.state().contact?.phase, 'signal');
  h.frame(180);
  assert.equal(h.state().contact?.phase, 'reply');
  assert.equal(h.state().step, 0);
  h.command('act');
  assert.equal(h.state().contact?.phase, 'knocking');
  h.frame(90);
  assert.equal(h.state().contact?.phase, 'door');
  assert.equal(h.state().step, 1);
});

test('Wells aftermath: a paused or released take cold-restores the current pose and caption', () => {
  const h = setup(); h.crash(); h.frame(100);
  const phone = structuredClone(h.phone()), agents = structuredClone(h.cast()), line = h.state().lastText;
  assert.ok(phone.aftermath && phone.aftermath.elapsed > 0);
  h.frame(40, false);
  assert.deepEqual(h.phone(), phone);
  assert.deepEqual(h.cast(), agents);
  h.players.release('caller', 0); h.frame(40);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  assert.deepEqual(h.phone(), phone);
  assert.deepEqual(h.cast(), agents);
  assert.equal(h.state().lastText, line);
  assert.ok('error' in h.players.possess('observer', 'smith', 0));
  h.players.possess('caller', 'trinity', 0); h.frame();
  assert.ok(h.phone().aftermath!.elapsed > phone.aftermath.elapsed);
});

test('Wells aftermath: an old completed crash starts on resume, without taking a controlled role', () => {
  const h = setup(); h.crash();
  delete h.phone().aftermath;
  const old = structuredClone(h.phone());
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  h.frame(4, false);
  assert.deepEqual(h.phone(), old);
  h.frame();
  assert.ok(h.phone().aftermath, 'the old crash starts the new scene when play resumes');

  const occupied = setup();
  assert.ok('agentId' in occupied.players.possess('observer', 'agent_jones', 0));
  occupied.crash(); occupied.frame(20);
  assert.equal(occupied.phone().aftermath, undefined);
  assert.equal(occupied.players.getAgent('observer')?.id, 'agent_jones');
  assert.match(occupied.command('next'), /特工/);
  occupied.players.release('observer', 0); occupied.frame();
  assert.ok(occupied.phone().aftermath);
});

test('Wells aftermath: a missed pickup stays on the retry branch after impact', () => {
  const h = setup(1.3), before = structuredClone(h.cast());
  h.crash(); h.frame(90);
  assert.equal(h.phone().phase, 'failed');
  assert.equal(h.phone().aftermath, undefined);
  assert.deepEqual(h.cast(), before);
  h.command('retry');
  assert.equal(h.phone().phase, 'running');
  assert.equal(h.phone().attempts, 1);
});

test('Wells aftermath: the saved take moves the cab door and drops the receiver onto the street', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.assign(globalThis, { document: { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }) }) } });
  const h = setup(), renderer = new FilmSetRenderer(new THREE.Scene());
  t.after(() => { renderer.dispose(); if (previous) Object.defineProperty(globalThis, 'document', previous); else Reflect.deleteProperty(globalThis, 'document'); });
  const draw = () => renderer.update(h.caller, h.sandbox.state, 0);
  h.crash(); draw();
  const door = renderer.root.getObjectByName('wells-driver-door')!;
  const receiver = renderer.root.getObjectByName('opening-booth-receiver')!;
  assert.equal(door.rotation.y, 0);
  assert.equal(receiver.visible, false, 'the receiver is out of sight during the crash');
  h.frame(25); draw();
  assert.ok(door.rotation.y < -.9, 'the driver door swings outward during the first shot');
  assert.equal(receiver.visible, true);
  const dropped = receiver.getWorldPosition(new THREE.Vector3()), center = FILM_SETS[scene.set].center;
  const expected = new THREE.Vector3(center.x + WELLS_AFTERMATH.receiver.x, center.y - 1 + WELLS_AFTERMATH.receiver.y, center.z + WELLS_AFTERMATH.receiver.z);
  assert.ok(dropped.distanceTo(expected) < 1e-7);
  assert.ok(Math.abs(new THREE.Box3().setFromObject(receiver).min.y - (center.y - 1)) < .015, 'the receiver rests on the street');
  h.frame(55); draw();
  assert.equal(Math.abs(door.rotation.y), 0);
  assert.ok(receiver.getWorldPosition(new THREE.Vector3()).distanceTo(dropped) < 1e-7);
});
