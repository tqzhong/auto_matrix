import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { bridgeArrivalPose, meetingCarPose, meetingRollRoadTime, type FilmJourney } from '@auto_matrix/shared';
import { MeetingSetRenderer } from '../packages/client/src/engine/MeetingSetRenderer.js';

test('the actual car body uses the same fast pose as its occupants between journey snapshots', t => {
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, fillText() {} }) }) } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const parent = new THREE.Group(); const renderer = new MeetingSetRenderer(parent);
  const journey: FilmJourney = { version: 1, scene: 'm1_bug', step: 2, actor: 'neo', completed: [], reflections: {}, enteredAt: 0, checkpoint: { x: 0, y: 1, z: 0 }, lastText: '',
    meeting: { phase: 'driving', elapsed: 20, bugged: false, approach: { x: 4, z: -12.35, yaw: Math.PI } } };
  try {
    const vehicle = (renderer as unknown as { vehicle: THREE.Group }).vehicle;
    const tailLights = vehicle.children.filter(child => child.name.startsWith('meeting-tail-light-')) as THREE.PointLight[];
    assert.equal(tailLights.length, 2, 'the parked car needs two visible rear lamps against the bridge darkness');
    for (const light of tailLights) {
      assert.ok(light.position.z > 6.5 && light.position.y > 1, 'the rear lamps must sit on the car tail');
      assert.ok(light.color.r > light.color.g * 2 && light.intensity >= 40, 'the wet road needs a readable red spill');
    }
    for (const elapsed of [20, 20.45, 40.5, 42]) {
      const gesture = { phase: 'driving' as const, elapsed, role: 'neo' as const, bugged: false };
      renderer.update(journey, elapsed, gesture);
      const car = meetingCarPose(gesture);
      assert.ok(vehicle.position.distanceTo(new THREE.Vector3(car.x, 0, car.z)) < .001, 'a slow journey snapshot cannot leave the car behind its occupants');
      assert.ok(Math.abs(vehicle.rotation.y - car.yaw) < .001);
    }
    journey.scene = 'm1_bridge'; delete journey.meeting;
    journey.bridgeArrival = { phase: 'approaching', elapsed: 2.35 };
    renderer.update(journey, 2.35);
    const inbound = bridgeArrivalPose(2.35);
    assert.ok(vehicle.position.distanceTo(new THREE.Vector3(inbound.x, 0, inbound.z)) < .001);
    assert.ok(Math.abs(vehicle.rotation.y - inbound.yaw) < .001);
    journey.meeting = { phase: 'rolling', elapsed: 3, roadTime: meetingRollRoadTime(3), bugged: true, approach: { x: 4, z: -12.35, yaw: Math.PI } };
    renderer.update(journey, 3);
    const rolling = meetingCarPose(journey.meeting);
    assert.ok(vehicle.position.distanceTo(new THREE.Vector3(rolling.x, 0, rolling.z)) < .001, 'the rolling car body follows the passenger pose');
    delete journey.meeting; journey.bridgeArrival = { phase: 'parked', elapsed: 7, parkedRoadTime: 3 };
    renderer.update(journey, 15);
    const stopped = meetingCarPose({ phase: 'ready', elapsed: 0, roadTime: 3 });
    assert.ok(vehicle.position.distanceTo(new THREE.Vector3(stopped.x, 0, stopped.z)) < .001, 'the car remains at the new curb after Neo leaves');
    const door = (renderer as unknown as { door: THREE.Group }).door;
    journey.meeting = { phase: 'hesitating', elapsed: 2, roadTime: 3, bugged: true, approach: { x: 4, z: -12.35, yaw: Math.PI } };
    renderer.update(journey, 2); assert.ok(door.rotation.y < -.95, 'the right rear door remains open during Trinity’s appeal');
    journey.meeting.phase = 'reconsidering'; journey.meeting.elapsed = 0;
    renderer.update(journey, 2); assert.ok(door.rotation.y < -.95, 'trust begins with the same open door pose');
    journey.meeting.elapsed = 2;
    renderer.update(journey, 4); assert.ok(Math.abs(door.rotation.y) < .01, 'Neo shuts the door before examination');
  } finally { renderer.dispose(); globalThis.document = document; }
});
