import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { ARREST_CAR, ARREST_BIKE, arrestCarPoint, arrestBikePoint, type OfficeArrest } from '@auto_matrix/shared';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

for (const [phase, elapsed] of [['ready', 0], ['entering', 1.2], ['entering', 3.2], ['done', 0]] as const) {
  test(`V leaves the ${phase}/${elapsed} arrest shot for Neo's steerable eyes while paused`, t => {
    class InputTarget extends EventTarget { matches() { return false; } }
    const window = new InputTarget(), canvas = new InputTarget();
    const document = Object.assign(new InputTarget(), { pointerLockElement: canvas, hidden: false, exitPointerLock() {} });
    const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key));
    Object.assign(globalThis, { window, document });
    let time = 2000; t.mock.method(performance, 'now', () => time);
    const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000), group = new THREE.Group(), body = new THREE.Group(), head = new THREE.Bone();
    head.name = 'head'; head.position.set(0, 2.25, .1); body.add(head); group.add(body);
    const world = new WorldState(); new AgentManager(world).initializeAllAgents();
    const neo = world.agents.get('neo')!; neo.currentLocation = 'metacortex_office'; neo.position = arrestCarPoint(ARREST_CAR.seats.neo.x, ARREST_CAR.seats.neo.z); neo.rotation = ARREST_CAR.yaw + Math.PI;
    const street: OfficeArrest = { phase, elapsed, observed: true };
    neo.currentAction = { type: 'idle', parameters: { officeCustody: { role: 'neo', phase: 'street', elapsed: 3.2, locked: true, street } }, startedAt: 0, duration: 1, progress: 0 };
    const controls = new PlayerControls(canvas as unknown as HTMLCanvasElement, camera, () => {}, () => {});
    t.after(() => {
      controls.dispose(); ['window', 'document'].forEach((key, i) => {
        if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!); else Reflect.deleteProperty(globalThis, key);
      });
    });
    const event = (target: EventTarget, type: string, values: object) => target.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), values));
    const toggle = () => { event(window, 'keydown', { code: 'KeyV', repeat: false }); event(window, 'keyup', { code: 'KeyV' }); };
    const step = () => { for (let i = 0; i < 90; i++) { time += 1000 / 60; controls.update(1 / 60, neo, group, false); } };
    controls.possess(neo); step(); const cinematic = camera.position.clone(), before = structuredClone(street);
    if (phase === 'entering' && elapsed === 3.2) {
      const view = arrestBikePoint(ARREST_BIKE.view.x, ARREST_BIKE.view.z);
      assert.ok(cinematic.distanceTo(new THREE.Vector3(view.x, ARREST_BIKE.view.y, view.z)) < .001, 'the observation shot faces the real motorcycle mirror');
      assert.equal(camera.fov, 38);
    }
    toggle(); step(); assert.equal(controls.firstPerson, true);
    assert.ok(camera.position.distanceTo(head.localToWorld(new THREE.Vector3(0, .1, .32))) < .001, 'Neo eyes must follow the displayed seated/ducking head');
    const direction = camera.getWorldDirection(new THREE.Vector3());
    event(document, 'mousemove', { movementX: -280, movementY: 80 }); step();
    assert.ok(camera.getWorldDirection(new THREE.Vector3()).distanceTo(direction) > .5, 'looking around must also work during a paused arrest');
    assert.deepEqual(group.position.toArray(), [neo.position.x, neo.position.y, neo.position.z]); assert.deepEqual(street, before);
    const looking = camera.getWorldDirection(new THREE.Vector3()); neo.rotation += .6; step();
    assert.ok(camera.getWorldDirection(new THREE.Vector3()).distanceTo(looking.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), .6)) < .001, 'a body turn carries the eye view while retaining the player’s look offset');
    toggle(); step(); assert.equal(controls.firstPerson, false); assert.ok(camera.position.distanceTo(cinematic) < .001);
  });
}
