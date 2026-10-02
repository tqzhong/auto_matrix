import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SCENE_BY_ID, INTERROGATION_ROOM, arrestDriveSeconds, arrestPose, filmPosition, type OfficeCustody, type PlayerInput, type WorldEvent } from '@auto_matrix/shared';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

for (const aspect of [16 / 9, 426 / 680]) for (const firstPerson of [false, true]) {
  test(`the car-to-interrogation cut rejects delayed car input and frames Smith in ${aspect}/${firstPerson ? 'first' : 'third'} person`, t => {
    class InputTarget extends EventTarget { matches() { return false; } }
    const window = new InputTarget(), canvas = new InputTarget();
    const document = Object.assign(new InputTarget(), { pointerLockElement: canvas, hidden: false, exitPointerLock() {} });
    const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key));
    Object.assign(globalThis, { window, document });
    let time = 1000; t.mock.method(performance, 'now', () => time); t.mock.method(Date, 'now', () => 1000);
    const world = new WorldState(); new AgentManager(world).initializeAllAgents();
    const dynamics = { record: (e: Omit<WorldEvent, 'id'>) => world.addWorldEvent(e) } as WorldDynamics;
    const sandbox = new SandboxSystem(world, dynamics, 42);
    const players = new PlayerController(world, { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine, {} as ActionExecutor, dynamics, sandbox);
    const neo = world.agents.get('neo')!; sandbox.life.begin(neo, 0);
    const custody: OfficeCustody = { phase: 'street', elapsed: 3.2, catcher: 'smith', leader: 'agent_brown',
      bodies: { smith: { position: { ...neo.position }, yaw: 0 }, agent_brown: { position: { ...neo.position }, yaw: 0 }, agent_jones: { position: { ...neo.position }, yaw: 0 } },
      street: { phase: 'departing', elapsed: 0, parking: { x: 25, z: 49 } } };
    custody.street!.elapsed = arrestDriveSeconds(custody.street) - .05;
    for (const role of ['neo', 'smith', 'agent_brown', 'agent_jones'] as const) {
      const pose = arrestPose(custody, role)!;
      if (role === 'neo') { neo.position = pose.position; neo.rotation = pose.yaw; }
      else custody.bodies[role] = { position: pose.position, yaw: pose.yaw };
    }
    neo.currentLocation = 'metacortex_office'; neo.health = 67;
    sandbox.state.neoLife!.journey = { version: 1, scene: 'm1_office_escape', actor: 'neo', step: FILM_SCENE_BY_ID.m1_office_escape.steps.length,
      completed: ['m1_boss', 'm1_office_escape'], enteredAt: 0, reflections: {}, lastText: '', checkpoint: { ...neo.position },
      office: { alert: 100, suspicion: [], waypoints: [], lastTick: 0, guide: '', outcome: 'captured', bugged: false, custody } };
    players.possess('player', 'neo', 0);
    const camera = new THREE.PerspectiveCamera(57, aspect, .5, 5000), group = new THREE.Group(), body = new THREE.Group(), head = new THREE.Bone();
    head.name = 'head'; head.position.set(0, 2.25, .1); body.add(head); group.add(body);
    const sent: PlayerInput[] = [];
    const controls = new PlayerControls(canvas as unknown as HTMLCanvasElement, camera, input => sent.push(input), () => {});
    t.after(() => { controls.dispose(); ['window', 'document'].forEach((key, i) => {
      if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!); else Reflect.deleteProperty(globalThis, key);
    }); });
    const event = (target: EventTarget, type: string, values: object) => target.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), values));
    const frames = (state: typeof neo, count = 45) => { for (let i = 0; i < count; i++) { time += 1000 / 60; controls.update(1 / 60, state, group, false); } };
    let snapshot = structuredClone(neo); controls.possess(snapshot); frames(snapshot);
    if (firstPerson) { event(window, 'keydown', { code: 'KeyV', repeat: false }); event(window, 'keyup', { code: 'KeyV' }); }
    event(document, 'mousemove', { movementX: -300, movementY: 540 }); frames(snapshot);
    const carInput = sent.at(-1)!; players.receiveInput('player', carInput); players.step(.1, true, 1);
    assert.equal(sandbox.life.film.state!.scene, 'm1_interrogation');
    const arrival = structuredClone(neo), smith = filmPosition('film_agent_interrogation', -INTERROGATION_ROOM.seat, 0);
    const yaw = Math.atan2(smith.x - arrival.position.x, smith.z - arrival.position.z);
    assert.equal(arrival.rotation, yaw); assert.equal(arrival.health, 67);
    // The client has not received the scene cut yet: both cached and in-flight packets still describe the car.
    players.step(.05, true, 2);
    assert.equal(neo.rotation, yaw, 'cached passenger look must not overwrite the new room heading');
    for (let i = 0; i < 4; i++) { players.receiveInput('player', { ...carInput, x: 1, jump: true, sequence: carInput.sequence + i + 1 }); players.step(.05, true, 3 + i); }
    assert.deepEqual(neo.position, arrival.position, 'delayed movement/jump must not run in a different room'); assert.equal(neo.rotation, yaw);
    snapshot = structuredClone(neo); frames(snapshot);
    const face = new THREE.Vector3(smith.x, smith.y + 3, smith.z).project(camera);
    assert.ok(Math.abs(face.x) < .85 && Math.abs(face.y) < .85 && face.z > -1 && face.z < 1, `Smith must fit after the actual cut: ${face.toArray()}`);
    const direction = camera.getWorldDirection(new THREE.Vector3());
    event(document, 'mousemove', { movementX: 150, movementY: -40 }); frames(snapshot);
    const manual = camera.getWorldDirection(new THREE.Vector3()); assert.ok(manual.distanceTo(direction) > .2);
    snapshot = structuredClone(neo); frames(snapshot);
    assert.ok(camera.getWorldDirection(new THREE.Vector3()).distanceTo(manual) < .001, 'later room snapshots preserve manual looking');
    const roomInput = sent.at(-1)!; players.receiveInput('player', roomInput); players.step(.05, true, 8);
    assert.equal(neo.rotation, roomInput.yaw, 'fresh room input restores normal steering');
    assert.equal(neo.health, 67); assert.equal(sandbox.life.film.state!.step, 0);
  });
}
