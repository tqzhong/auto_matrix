import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { awakeningPose, filmPosition, type AwakeningBeat, type FilmJourney } from '@auto_matrix/shared';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { podPatient } from './helpers/pod-patient.mjs';

async function setup(t: test.TestContext) {
  const h = await podPatient(t);
  class InputTarget extends EventTarget { matches() { return false; } }
  const window = new InputTarget(), canvas = new InputTarget(), document = new InputTarget(), previous = globalThis.window;
  globalThis.window = window as unknown as Window & typeof globalThis;
  Object.assign(globalThis.document, { pointerLockElement: canvas, exitPointerLock() {}, hidden: false,
    addEventListener: document.addEventListener.bind(document), removeEventListener: document.removeEventListener.bind(document) });
  const camera = new THREE.PerspectiveCamera(68, 16 / 9, .5, 5000);
  const controls = new PlayerControls(canvas as unknown as HTMLCanvasElement, camera, () => {}, () => {});
  controls.possess(h.neo);
  const group = h.renderer.getAgent('neo')!;
  const frame = (beat: AwakeningBeat) => {
    const pose = awakeningPose(beat);
    h.neo.position = filmPosition('film_power_plant_pods', pose.x, pose.z); h.neo.position.y += pose.y;
    h.neo.currentAction = { type: 'idle', parameters: { filmPose: pose.pose }, startedAt: 0, duration: 1, progress: 0 };
    h.renderer.updateAgent('neo', h.neo);
    controls.performing = true; camera.fov = 68; camera.updateProjectionMatrix();
    // Exercise the same ordering as Engine: input/camera, actual posed actor, then camera resampling.
    controls.update(1 / 60, h.neo, group, false); h.renderer.setPlayerMotion(controls.motion);
    const body = h.at(beat.elapsed, 100, controls.firstPerson, beat);
    const sync = controls as PlayerControls & { syncPodCamera?: (group: THREE.Group, journey: FilmJourney) => void };
    sync.syncPodCamera?.(group, { scene: 'm1_pod', actor: 'neo', awakening: beat } as FilmJourney);
    camera.updateMatrixWorld(true);
    return body.getObjectByName('head')!;
  };
  const toggle = () => window.dispatchEvent(Object.assign(new Event('keydown'), { code: 'KeyV', repeat: false }));
  const dispose = () => { controls.dispose(); globalThis.window = previous; };
  return { ...h, camera, controls, frame, toggle, document, group, dispose };
}

test('the current posed anatomical eye drives the pod view rather than the preceding animation frame', async t => {
  const h = await setup(t);
  try {
    h.frame({ kind: 'emerge', elapsed: 0 }); h.toggle();
    const frames: AwakeningBeat[] = [
      ...[0, .7, 1.8, 3.1, 4.5, 5.2].map(elapsed => ({ kind: 'emerge' as const, elapsed })),
      ...[4.3, 4.8, 5.2, 6.4, 6.7, 6.85, 7.2, 9].map(elapsed => ({ kind: 'disconnect' as const, elapsed, emerged: true, breatherRemoved: true })),
      ...[0, 4, 7, 10.1, 12].map(elapsed => ({ kind: 'rescue' as const, elapsed })),
    ];
    for (const beat of frames) {
      const head = h.frame(beat), marker = head.userData.cameraEye as THREE.Vector3;
      assert.ok(marker, 'the real delivered head must supply its calibrated eye');
      const eye = head.localToWorld(marker.clone());
      assert.ok(h.camera.position.distanceTo(eye) < 1e-6, `view is ${h.camera.position.distanceTo(eye)} from the current eye at ${beat.kind}/${beat.elapsed}s`);
    }
    h.toggle(); h.frame({ kind: 'emerge', elapsed: 5.2 });
    const third = h.camera.position.clone();
    const sync = h.controls as PlayerControls & { syncPodCamera?: (group: THREE.Group, journey: FilmJourney) => void };
    sync.syncPodCamera?.(h.group, { scene: 'm1_pod', actor: 'neo', awakening: { kind: 'emerge', elapsed: 5.2 } } as FilmJourney);
    assert.ok(h.camera.position.distanceTo(third) < 1e-10, 'eye resampling cannot override the third-person shot');
    assert.equal(h.camera.near, .5);
  } finally { h.dispose(); }
});

test('first-person oral removal frames both actual hands throughout the established grip and lowering', async t => {
  const h = await setup(t), results: unknown[] = [];
  try {
    const beat = { kind: 'breather' as const, elapsed: 2.05, emerged: true };
    h.frame(beat); h.toggle();
    for (const elapsed of [2.05, 2.4, 2.648, 2.943, 3.2, 3.6, 4, 4.4, 4.55]) {
      h.frame({ ...beat, elapsed });
      const skin = h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
      skin.skeleton.update(); const a = skin.geometry.attributes, used = new Set(skin.geometry.index!.array);
      for (const [i, side] of ['R', 'L'].entries()) {
        const wrist = h.rig.bones.get(`wrist_${side}`)!;
        const palm = wrist.localToWorld(new THREE.Vector3(i ? -.2 : .2, -.18, .13)).project(h.camera);
        assert.ok(Math.abs(palm.x) < .8 && Math.abs(palm.y) < .8 && palm.z > -1 && palm.z < 1,
          `the ${side} palm is outside the grasping view at ${elapsed}s: ${palm.toArray()}`);
        let total = 0, shown = 0;
        for (const vertex of used) {
          if (![0, 1, 2, 3].some(k => a.skinWeight.getComponent(vertex, k) > .2
            && new RegExp(`^(wrist_|finger[1-5]-[1-3]_)${side}$`).test(skin.skeleton.bones[a.skinIndex.getComponent(vertex, k)].name))) continue;
          const point = skin.localToWorld(skin.getVertexPosition(vertex, new THREE.Vector3())).project(h.camera); total++;
          if (Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1 && point.z >= -1 && point.z <= 1) shown++;
        }
        assert.ok(total > 100, 'the projection must inspect actual hand skin');
        results.push({ elapsed, side, shown, total });
        assert.ok(shown / total >= .9, `${side} hand is cropped at ${elapsed}s: ${shown}/${total} skin vertices`);
      }
    }
    t.diagnostic(JSON.stringify(results));
  } finally { h.dispose(); }
});

test('paused grip framing is stable and a small mouse input takes over without a camera jump', async t => {
  const h = await setup(t), beat = { kind: 'breather' as const, elapsed: 2.648, emerged: true };
  try {
    h.frame(beat); h.toggle(); h.frame(beat);
    const posed = h.camera.quaternion.clone();
    for (let i = 0; i < 12; i++) { h.frame(beat); assert.ok(h.camera.quaternion.angleTo(posed) < 1e-7, 'paused animation cannot accumulate view drift'); }
    h.document.dispatchEvent(Object.assign(new Event('mousemove'), { movementX: 2, movementY: -1 }));
    h.frame(beat); const changed = h.camera.quaternion.clone(), angle = changed.angleTo(posed);
    assert.ok(angle > .001 && angle < .025, `manual observation jumps ${angle} radians when leaving automatic attention`);
    for (let i = 0; i < 12; i++) { h.frame(beat); assert.ok(h.camera.quaternion.angleTo(changed) < 1e-7, 'the automatic view cannot pull the mouse away again'); }
  } finally { h.dispose(); }
});

test('pod observation can survey the towers above and the supported body below without rotating the patient', async t => {
  const h = await setup(t), beat = { kind: 'breather' as const, elapsed: 2.648, emerged: true };
  try {
    h.frame(beat); h.toggle(); h.frame(beat);
    const body = h.renderer.getAgentBody('neo')!, unchanged = body.quaternion.clone();
    for (const movementY of [-1800, 1800]) {
      h.document.dispatchEvent(Object.assign(new Event('mousemove'), { movementX: 0, movementY }));
      const head = h.frame(beat), local = h.camera.getWorldDirection(new THREE.Vector3()).applyQuaternion(head.getWorldQuaternion(new THREE.Quaternion()).invert());
      const pitch = Math.atan2(-local.y, Math.hypot(local.x, local.z));
      assert.ok(movementY < 0 ? pitch < -1.3 && pitch > -1.55 : pitch > 1.3 && pitch < 1.55,
        `supported observation remains trapped at the standing limit: ${pitch}`);
      assert.ok(body.quaternion.angleTo(unchanged) < 1e-7, 'observation cannot turn the reclined body away from its supports');
    }
  } finally { h.dispose(); }
});

test('the saved oral-removal clock produces a continuous view through approach and release', async t => {
  const h = await setup(t), beat = { kind: 'breather' as const, elapsed: 0, emerged: true };
  try {
    h.frame(beat); h.toggle();
    let previous: THREE.Quaternion | undefined, maximumStep = 0, minimumPitch = Infinity, maximumPitch = -Infinity, maximumPitchAt = 0;
    for (let i = 0; i <= 550; i++) {
      const head = h.frame({ ...beat, elapsed: i / 100 }), rotation = h.camera.quaternion.clone();
      if (previous) maximumStep = Math.max(maximumStep, rotation.angleTo(previous));
      const local = h.camera.getWorldDirection(new THREE.Vector3()).applyQuaternion(head.getWorldQuaternion(new THREE.Quaternion()).invert());
      const pitch = Math.atan2(-local.y, Math.hypot(local.x, local.z)); minimumPitch = Math.min(minimumPitch, pitch);
      if (pitch > maximumPitch) { maximumPitch = pitch; maximumPitchAt = i / 100; }
      previous = rotation;
    }
    t.diagnostic(JSON.stringify({ frames: 551, maximumStepPer10ms: maximumStep, minimumPitch, maximumPitch, maximumPitchAt }));
    assert.ok(maximumStep < .05, `the supported camera jumps ${maximumStep} radians between adjacent 10ms samples`);
  } finally { h.dispose(); }
});

test('the delivered oral coupling has an open airway at both ends and a solid surrounding wall', async t => {
  const h = await podPatient(t);
  h.at(2.648, 100, false, { kind: 'breather', elapsed: 2.648, emerged: true });
  const nozzle = h.root.getObjectByName('pod-oral-nozzle') as THREE.Mesh, frame = nozzle.parent!;
  for (const [from, sign] of [[-.04, 1], [.26, -1]]) {
    const origin = frame.localToWorld(new THREE.Vector3(0, from, 0)), direction = new THREE.Vector3(0, sign, 0).transformDirection(frame.matrixWorld);
    assert.equal(new THREE.Raycaster(origin, direction, 0, .3).intersectObject(nozzle).length, 0, 'an opaque end cap must not seal the centre of the breathing pipe');
  }
  for (const sign of [-1, 1]) {
    const origin = frame.localToWorld(new THREE.Vector3(sign * .16, .11, 0)), direction = new THREE.Vector3(-sign, 0, 0).transformDirection(frame.matrixWorld);
    assert.ok(new THREE.Raycaster(origin, direction, 0, .2).intersectObject(nozzle).length > 0, 'opening the airway must retain the actual rubber wall');
  }
});
