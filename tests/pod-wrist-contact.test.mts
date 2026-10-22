import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import type { AwakeningBeat } from '@auto_matrix/shared';
import { podPatient } from './helpers/pod-patient.mjs';

function swing(wrist: THREE.Bone): number {
  const axis = wrist.position.clone().normalize(), q = wrist.quaternion;
  const projection = q.x * axis.x + q.y * axis.y + q.z * axis.z;
  const twist = new THREE.Quaternion(axis.x * projection, axis.y * projection, axis.z * projection, q.w).normalize();
  return q.clone().multiply(twist.invert()).angleTo(new THREE.Quaternion()) * 180 / Math.PI;
}

test('Neo grasps and pulls the breather without bending either wrist backwards beyond the grip limit', async t => {
  const h = await podPatient(t);
  const failures: unknown[] = []; let maximum = 0;
  for (const elapsed of [2, 2.05, 2.4, 2.943, 3.2, 3.6, 4, 4.4, 4.55]) {
    h.at(elapsed, 100, true, { kind: 'breather', elapsed, emerged: true });
    for (const side of ['R', 'L']) {
      const angle = swing(h.rig.bones.get(`wrist_${side}`)!); maximum = Math.max(maximum, angle);
      if (angle > 70) failures.push({ elapsed, side, angle });
    }
  }
  t.diagnostic(JSON.stringify({ maximumWristSwing: maximum }));
  assert.deepEqual(failures, [], 'the tube grip must not fold the palm backwards through the forearm');
});

test('Neo supports himself and presses the membrane without a hyperextended wrist', async t => {
  const h = await podPatient(t);
  const failures: unknown[] = [];
  for (const beat of [{ kind: 'breather', elapsed: 0, emerged: true }, ...[.7, 1.1, 1.6, 2.4, 3.3, 4.5, 5.2].map(elapsed => ({ kind: 'emerge' as const, elapsed }))] as AwakeningBeat[]) {
    h.at(beat.elapsed, 100, true, beat);
    for (const side of ['R', 'L']) {
      const angle = swing(h.rig.bones.get(`wrist_${side}`)!);
      if (angle > 70) failures.push({ kind: beat.kind, elapsed: beat.elapsed, side, angle });
    }
  }
  assert.deepEqual(failures, [], 'the membrane and basin supports need reachable anatomical palm orientations');
});

test('the membrane and breather arm paths remain continuous through each reach and release', async t => {
  const h = await podPatient(t), maxima: Record<string, number> = {}, locations: Record<string, unknown> = {}, angles: Record<string, { angle: number; elapsed: number; side: string }> = {};
  for (const kind of ['emerge', 'breather'] as const) {
    let previous: THREE.Vector3[] | undefined;
    for (let frame = 0; frame <= (kind === 'emerge' ? 520 : 550); frame++) {
      const elapsed = frame / 100, beat = kind === 'emerge' ? { kind, elapsed } : { kind, elapsed, emerged: true };
      h.at(elapsed, 100, true, beat);
      for (const side of ['R', 'L']) {
        const angle = swing(h.rig.bones.get(`wrist_${side}`)!);
        if (angle > (angles[kind]?.angle ?? 0)) angles[kind] = { angle, elapsed, side };
        assert.ok(angle <= 70, `${kind}/${side} wrist overbends at ${elapsed}s: ${angle}`);
      }
      const points = ['elbow_R', 'wrist_R', 'elbow_L', 'wrist_L'].map(name => h.rig.bones.get(name)!.getWorldPosition(new THREE.Vector3()));
      if (previous) for (const [i, point] of points.entries()) {
        const step = point.distanceTo(previous[i]);
        if (step > (maxima[kind] ?? 0)) { maxima[kind] = step; locations[kind] = { elapsed, joint: ['elbow_R', 'wrist_R', 'elbow_L', 'wrist_L'][i] }; }
      }
      previous = points;
    }
  }
  t.diagnostic(JSON.stringify({ maximumJointStepPer10ms: maxima, locations, maximumSwing: angles }));
  for (const [kind, step] of Object.entries(maxima)) assert.ok(step < .05, `${kind} flips an arm joint by ${step} units between adjacent 10ms frames`);
});
