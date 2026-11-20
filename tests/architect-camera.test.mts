import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import * as THREE from 'three';
import { ARCHITECT_ROOM, FILM_SETS, filmPosition, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { Engine } from '../packages/client/src/engine/Engine.js';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

function setup(t: TestContext) {
  class Target extends EventTarget { matches() { return false; } }
  const window = new Target(), canvas = new Target();
  const document = Object.assign(new Target(), { pointerLockElement: canvas, hidden: false, exitPointerLock() {} });
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  Object.assign(globalThis, { window, document });
  let now = 1000; t.mock.method(performance, 'now', () => now);
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const room = FILM_SETS.film_architect_room;
  const { chair } = ARCHITECT_ROOM;
  const neo = world.agents.get('neo')!, architect = world.agents.get('architect')!;
  Object.assign(neo, { currentLocation: room.id, position: filmPosition(room.id, 0, -10.2), rotation: Math.PI, controller: 'camera-test', isInMatrix: true, isAwakened: true });
  Object.assign(architect, { currentLocation: room.id, position: filmPosition(room.id, chair.x, chair.z), rotation: 0, isInMatrix: true });
  const journey = { scene: 'm2_architect', actor: 'neo', step: 1, started: 11118, completed: [],
    architect: { phase: 'cycles' } } as unknown as FilmJourney;
  const sandbox = { nodes: [], structures: [], threats: [], incidents: [], missions: {}, neoLife: { journey, missions: {} } } as unknown as SandboxState;
  const group = new THREE.Group(); group.add(new THREE.Group());
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000);
  const controls = new PlayerControls(canvas as unknown as HTMLCanvasElement, camera, () => {}, () => {});
  const engine = { playerControls: controls, running: false, sandboxRenderer: { sync() {} }, updateAtmosphere() {} } as unknown as Engine;
  const frame = (running = false, dt = .05) => {
    now += dt * 1000;
    Engine.prototype.setSandbox.call(engine, sandbox, Object.fromEntries(world.agents));
    controls.update(dt, neo, group, running); camera.updateMatrixWorld(true);
  };
  const key = (code: string, down = true) => window.dispatchEvent(Object.assign(new Event(down ? 'keydown' : 'keyup'), { code, repeat: false }));
  const look = () => document.dispatchEvent(Object.assign(new Event('mousemove'), { movementX: 160, movementY: -20 }));
  controls.possess(neo);
  t.after(() => { controls.dispose(); ['window', 'document'].forEach((key, i) => {
    if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!); else Reflect.deleteProperty(globalThis, key);
  }); });
  return { architect, neo, journey, camera, group, controls, frame, key, look, room };
}

test('the default cycles dialogue frames the Architect clear of Neo on wide and narrow screens', t => {
  const h = setup(t);
  for (const aspect of [16 / 9, .65]) for (const x of [0, -1.4, 1.4]) {
    h.camera.aspect = aspect;
    h.neo.position = filmPosition(h.room.id, x, -10.2);
    h.controls.possess(h.neo); h.frame();
    const head = (position: typeof h.neo.position, height: number) => new THREE.Vector3(position.x, position.y + height, position.z);
    const seated = head(h.architect.position, 2.5).project(h.camera);
    const standing = head(h.neo.position, 2.7).project(h.camera);
    for (const subject of [standing, seated]) {
      assert.ok(Math.abs(subject.x) < .88 && Math.abs(subject.y) < .88 && subject.z > -1 && subject.z < 1,
        `${aspect}/${x}: subject outside the composition ${subject.toArray()}`);
    }
    assert.ok(Math.abs(standing.x - seated.x) > .18, `${aspect}/${x}: Neo overlaps the Architect's face and chest`);
    assert.equal(h.controls.performing, false);
  }
});

test('the dialogue leaves first person, free look, walking and other room steps in the player’s control', t => {
  const h = setup(t);
  h.frame(); const dialogue = h.camera.position.clone();
  h.look(); for (let i = 0; i < 4; i++) h.frame();
  assert.ok(dialogue.distanceTo(h.camera.position) > 2, 'manual look leaves the staged camera');
  h.key('KeyV'); h.key('KeyV', false); h.frame();
  const eye = h.camera.position.clone();
  const eyeDirection = h.camera.getWorldDirection(new THREE.Vector3());
  assert.ok(eye.distanceTo(h.group.position) < 3.2, 'V takes the player to Neo’s eyes');
  delete h.journey.started; h.frame();
  assert.ok(h.camera.position.distanceTo(eye) < .001);
  assert.ok(h.camera.getWorldDirection(new THREE.Vector3()).distanceTo(eyeDirection) < .001);

  h.controls.possess(h.neo); h.frame(); const ordinary = h.camera.position.clone();
  h.journey.started = 11118; h.frame(false, .5);
  assert.ok(h.camera.position.distanceTo(ordinary) > 2, 'the composed view starts with the actual dialogue');
  const start = h.group.position.clone(); h.key('KeyW');
  for (let i = 0; i < 5; i++) h.frame(true);
  h.key('KeyW', false);
  assert.ok(h.group.position.z < start.z - .15, 'W continues toward the Architect');
  assert.ok(h.camera.position.distanceTo(dialogue) > 2, 'the follow camera returns during movement');

  h.controls.possess(h.neo); h.journey.visiting = 'm2_architect'; h.frame();
  assert.ok(h.camera.position.distanceTo(ordinary) < .001, 'visits use the ordinary camera');
  delete h.journey.visiting; h.architect.controller = 'another-player'; h.frame(false, .5);
  assert.ok(h.camera.position.distanceTo(ordinary) < .001, 'the composition waits while the Architect is controlled separately');
  delete h.architect.controller; h.journey.step = 2; h.frame(false, .5);
  assert.ok(h.camera.position.distanceTo(ordinary) < .001, 'the right-door explanation uses the ordinary camera');
});
