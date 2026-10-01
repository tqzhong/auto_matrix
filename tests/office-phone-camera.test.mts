import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, OFFICE_CONTACT, type OfficePhone } from '@auto_matrix/shared';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

for (const phase of ['pickup', 'ready', 'answering', 'connected'] as const) {
  test(`V leaves the office ${phase} phone shot for a steerable eye view, including while paused`, t => {
    class InputTarget extends EventTarget { matches() { return false; } }
    const window = new InputTarget(), canvas = new InputTarget();
    const document = Object.assign(new InputTarget(), { pointerLockElement: canvas, hidden: false, exitPointerLock() {} });
    const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key));
    Object.assign(globalThis, { window, document });
    let time = 2000; t.mock.method(performance, 'now', () => time);
    const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000);
    const group = new THREE.Group(); group.add(new THREE.Group());
    const world = new WorldState(); new AgentManager(world).initializeAllAgents();
    const state = world.agents.get('neo')!, center = FILM_SETS.film_metacortex_floor.center;
    state.currentLocation = 'film_metacortex_floor';
    state.position = { x: center.x + OFFICE_CONTACT.x, y: center.y, z: center.z + OFFICE_CONTACT.z };
    state.rotation = Math.PI;
    const phone: OfficePhone = { phase, elapsed: phase === 'pickup' ? 1.4 : phase === 'answering' ? 3 : 0 };
    const controls = new PlayerControls(canvas as unknown as HTMLCanvasElement, camera, () => {}, () => {});
    t.after(() => {
      controls.dispose();
      ['window', 'document'].forEach((key, i) => {
        if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!);
        else Reflect.deleteProperty(globalThis, key);
      });
    });
    controls.possess(state); controls.performing = true; controls.phone = phone;
    const event = (target: EventTarget, type: string, values: object) => target.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), values));
    const toggle = () => { event(window, 'keydown', { code: 'KeyV', repeat: false }); event(window, 'keyup', { code: 'KeyV' }); };
    const step = (running = true) => {
      for (let i = 0; i < 120; i++) { time += 1000 / 60; controls.update(1 / 60, state, group, running); }
    };
    step(); const cinematic = camera.position.clone();
    const eye = new THREE.Vector3(state.position.x, state.position.y + 3, state.position.z);
    assert.ok(cinematic.distanceTo(eye) > .6, `the ordinary phone shot remains outside the eye view: ${cinematic.clone().sub(eye).toArray()}`);
    toggle(); step(false);
    assert.equal(controls.firstPerson, true);
    assert.ok(camera.position.distanceTo(eye) < .6, 'V must place the camera at Neo eyes rather than leave the telephone close-up active');
    assert.ok(camera.fov > 60, 'a first-person phone view must use the wider eye lens rather than the close-up lens');
    assert.equal(controls.motion.inspecting, true, 'the hand and phone must remain rendered in the eye view');
    const direction = camera.getWorldDirection(new THREE.Vector3());
    event(document, 'mousemove', { movementX: -280, movementY: 80 }); step(false);
    assert.ok(camera.getWorldDirection(new THREE.Vector3()).distanceTo(direction) > .5, 'pausing must not disable looking around');
    assert.ok(camera.position.distanceTo(eye) < .6, 'looking around cannot move the player back outside his body');
    assert.deepEqual(group.position.toArray(), [state.position.x, state.position.y, state.position.z]);
    assert.deepEqual(phone, { phase, elapsed: phase === 'pickup' ? 1.4 : phase === 'answering' ? 3 : 0 }, 'camera input must not advance the conversation');
    step(); assert.ok(camera.position.distanceTo(eye) < .6, 'resuming must retain the selected eye view');
    toggle(); step();
    assert.equal(controls.firstPerson, false);
    assert.ok(camera.position.distanceTo(cinematic) < .02, 'V returns to the authored telephone shot');
    assert.ok(camera.fov < 48, 'returning restores the close-up lens');
  });
}
