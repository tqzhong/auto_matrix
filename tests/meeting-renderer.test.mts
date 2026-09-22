import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { meetingCarPose, type FilmJourney } from '@auto_matrix/shared';
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
    for (const elapsed of [20, 20.45, 40.5, 42]) {
      const gesture = { phase: 'driving' as const, elapsed, role: 'neo' as const, bugged: false };
      renderer.update(journey, elapsed, gesture);
      const car = meetingCarPose(gesture);
      assert.ok(vehicle.position.distanceTo(new THREE.Vector3(car.x, 0, car.z)) < .001, 'a slow journey snapshot cannot leave the car behind its occupants');
      assert.ok(Math.abs(vehicle.rotation.y - car.yaw) < .001);
    }
  } finally { renderer.dispose(); globalThis.document = document; }
});
