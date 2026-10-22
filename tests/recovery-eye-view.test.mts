import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, type FilmJourney } from '@auto_matrix/shared';
import { NebDeckRenderer } from '../packages/client/src/engine/NebDeckRenderer.js';
import { recoveryView, type RecoveryBeat } from './helpers/recovery-view.mjs';

test('medical and cabin first-person views use the current delivered eye through cold, paused and out-of-order saved poses', async t => {
  const h = await recoveryView(t), samples: unknown[] = [];
  try {
    h.frame({ kind: 'recovery', elapsed: 0, started: false }); h.toggle();
    const poses: RecoveryBeat[] = [
      ...[0, 2.2, 4.073, 6.8, 9, 11.9].map(elapsed => ({ kind: 'recovery' as const, elapsed, started: elapsed > 0 })),
      ...[0, 3.2, 7, 1.8, 9.8, 11.2, 12, 0].map(elapsed => ({ kind: 'cabin' as const, elapsed, started: elapsed > 0 })),
    ];
    for (const beat of poses) {
      const head = h.frame(beat), marker = (head.userData.patientEye ?? head.userData.cameraEye) as THREE.Vector3;
      assert.ok(marker, 'inspect the registered exposed-patient eye marker');
      assert.ok(h.group.visible && h.renderer.getAgentBody('neo')!.visible, 'inspect the visible real-world patient, not a hidden unawakened fixture');
      const eye = head.localToWorld(marker.clone()), error = h.camera.position.distanceTo(eye);
      samples.push({ beat, error });
      assert.ok(error < 1e-6, `${beat.kind}/${beat.elapsed}: camera is ${error} from the current registered patient eye`);
      assert.equal(h.camera.near, .06);
    }
    t.diagnostic(JSON.stringify(samples));
  } finally { h.dispose(); }
});

test('the reclined view follows the actual head direction and cranial up rather than keeping a standing horizon', async t => {
  const h = await recoveryView(t);
  try {
    h.frame({ kind: 'recovery', elapsed: 0, started: false }); h.toggle();
    for (const kind of ['recovery', 'cabin'] as const) {
      const head = h.frame({ kind, elapsed: 0, started: false }), rotation = head.getWorldQuaternion(new THREE.Quaternion());
      const localForward = h.camera.getWorldDirection(new THREE.Vector3()).applyQuaternion(rotation.clone().invert());
      const actualUp = new THREE.Vector3(0, 1, 0).applyQuaternion(rotation);
      assert.ok(localForward.z > .9 && Math.abs(localForward.x) < .1 && localForward.y < 0 && localForward.y > -.4,
        `${kind}: the default view is not looking through the supported head: ${localForward.toArray()}`);
      assert.ok(h.camera.up.dot(actualUp) > 1 - 1e-7, 'the horizon must turn with the reclined head, rather than become singular near the ceiling');
    }
  } finally { h.dispose(); }
});

test('medical observation can survey the ceiling and body while preserving the supported actor and paused view', async t => {
  const h = await recoveryView(t), beat = { kind: 'recovery' as const, elapsed: 4.073, started: true };
  try {
    h.frame(beat); h.toggle(); h.frame(beat);
    const body = h.renderer.getAgentBody('neo')!, orientation = body.quaternion.clone();
    const marker = (h.rig.bones.get('head')!.userData.cameraEye as THREE.Vector3).clone();
    for (const movementY of [-1800, 1800]) {
      h.document.dispatchEvent(Object.assign(new Event('mousemove'), { movementX: 0, movementY }));
      const head = h.frame(beat), local = h.camera.getWorldDirection(new THREE.Vector3()).applyQuaternion(head.getWorldQuaternion(new THREE.Quaternion()).invert());
      const pitch = Math.atan2(-local.y, local.z);
      assert.ok(movementY < 0 ? pitch < -1.3 && pitch > -1.55 : pitch > 1.75 && pitch < 1.9, `supported look remains at the standing limit: ${pitch}`);
      assert.ok(body.quaternion.angleTo(orientation) < 1e-7, 'looking around cannot turn the body on the mattress');
    }
    const position = h.camera.position.clone(), rotation = h.camera.quaternion.clone();
    for (let i = 0; i < 12; i++) { h.frame(beat); assert.ok(h.camera.position.distanceTo(position) < 1e-8); assert.ok(h.camera.quaternion.angleTo(rotation) < 1e-7); }
    assert.deepEqual((h.rig.bones.get('head')!.userData.cameraEye as THREE.Vector3).toArray(), marker.toArray());
  } finally { h.dispose(); }
});

test('post-pose medical eye sampling does not replace third-person framing or continue after ordinary movement', async t => {
  const h = await recoveryView(t), beat = { kind: 'cabin' as const, elapsed: 8.8, started: true };
  try {
    h.frame(beat);
    const position = h.camera.position.clone(), rotation = h.camera.quaternion.clone();
    const sync = h.controls as typeof h.controls & { syncRecoveryCamera?: (group: THREE.Group) => void };
    sync.syncRecoveryCamera?.(h.group);
    assert.ok(h.camera.position.distanceTo(position) < 1e-10); assert.ok(h.camera.quaternion.angleTo(rotation) < 1e-7);
    h.toggle(); h.frame(beat);
    h.neo.currentAction = { type: 'idle', parameters: {}, startedAt: 0, duration: 1, progress: 0 };
    h.controls.performing = false; h.controls.update(1 / 60, h.neo, h.group, false);
    const ordinaryPosition = h.camera.position.clone(), ordinaryRotation = h.camera.quaternion.clone();
    sync.syncRecoveryCamera?.(h.group);
    assert.ok(h.camera.position.distanceTo(ordinaryPosition) < 1e-10); assert.ok(h.camera.quaternion.angleTo(ordinaryRotation) < 1e-7);
    assert.equal(h.camera.near, .5, 'ordinary play restores its own clipping plane');
  } finally { h.dispose(); }
});

test('the actual cabin bed exit keeps a continuous eye frame through sitting, turning and standing', async t => {
  const h = await recoveryView(t);
  try {
    h.frame({ kind: 'cabin', elapsed: 0, started: false }); h.toggle();
    let previous: THREE.Vector3 | undefined, rotation: THREE.Quaternion | undefined, maximumStep = 0, maximumTurn = 0;
    for (let i = 0; i <= 120; i++) {
      h.frame({ kind: 'cabin', elapsed: i / 10, started: true });
      if (previous) maximumStep = Math.max(maximumStep, h.camera.position.distanceTo(previous));
      if (rotation) maximumTurn = Math.max(maximumTurn, h.camera.quaternion.angleTo(rotation));
      previous = h.camera.position.clone(); rotation = h.camera.quaternion.clone();
    }
    t.diagnostic(JSON.stringify({ samples: 121, secondsPerSample: .1, maximumStep, maximumTurn }));
    assert.ok(maximumStep < .5, `the supported eye jumps ${maximumStep} units in .1s`);
    assert.ok(maximumTurn < .45, `the supported eye frame flips by ${maximumTurn} radians in .1s`);
  } finally { h.dispose(); }
});

test('the actual medical and cabin scenery stays outside sampled first-person near-plane corner rays', async t => {
  const h = await recoveryView(t), root = new THREE.Group(), center = FILM_SETS.film_neb_deck.center;
  root.position.set(center.x, center.y - 1, center.z);
  const ship = new NebDeckRenderer(root);
  try {
    h.frame({ kind: 'recovery', elapsed: 0, started: false }); h.toggle();
    const poses: RecoveryBeat[] = [
      ...[0, 3.8, 6.8].map(elapsed => ({ kind: 'recovery' as const, elapsed, started: elapsed > 0 })),
      ...[0, 1.8, 4.8, 6.8, 9.8, 11.2].map(elapsed => ({ kind: 'cabin' as const, elapsed, started: elapsed > 0 })),
    ];
    for (const aspect of [16 / 9, .65]) for (const beat of poses) {
      h.camera.aspect = aspect;
      h.frame(beat);
      ship.update({ scene: beat.kind === 'recovery' ? 'm1_recovery' : 'm1_cabin', awakening: beat } as FilmJourney, 0, h.renderer.getAgentBody('neo'));
      root.updateMatrixWorld(true);
      for (const x of [-1, 1]) for (const y of [-1, 1]) {
        const sight = new THREE.Vector3(x, y, -1).unproject(h.camera).sub(h.camera.position);
        const hit = new THREE.Raycaster(h.camera.position, sight.clone().normalize(), .0001, sight.length() + .001).intersectObject(root, true).find(hit => {
          for (let object: THREE.Object3D | null = hit.object; object; object = object.parent) if (!object.visible) return false;
          const mesh = hit.object as THREE.Mesh;
          return mesh.castShadow && !Array.isArray(mesh.material) && !mesh.material.transparent;
        });
        assert.ok(!hit, `${aspect}/${beat.kind}/${beat.elapsed}: near corner ${x}/${y} crosses ${hit?.object.name}`);
      }
    }
  } finally { ship.dispose(); h.dispose(); }
});


test('looking from the medical ceiling down to the body cannot flip the camera at a right angle', async t => {
  const h = await recoveryView(t), beat = { kind: 'recovery' as const, elapsed: 4.073, started: true };
  try {
    h.frame(beat); h.toggle(); h.frame(beat);
    h.document.dispatchEvent(Object.assign(new Event('mousemove'), { movementX: 0, movementY: 600 }));
    h.frame(beat);
    let previous = h.camera.quaternion.clone(), maximumTurn = 0;
    for (let i = 0; i < 24; i++) {
      h.document.dispatchEvent(Object.assign(new Event('mousemove'), { movementX: 0, movementY: 10 }));
      h.frame(beat);
      maximumTurn = Math.max(maximumTurn, h.camera.quaternion.angleTo(previous));
      previous = h.camera.quaternion.clone();
    }
    t.diagnostic(JSON.stringify({ maximumTurn, forward: h.camera.getWorldDirection(new THREE.Vector3()).toArray() }));
    assert.ok(h.camera.getWorldDirection(new THREE.Vector3()).y < -.15, 'the supported view must reach below the body horizon');
    assert.ok(maximumTurn < .08, 'a small mouse movement must not roll the view over at the cranial vertical');
  } finally { h.dispose(); }
});


test('the medical eye stays outside the registered facial skin before first-person head culling', async t => {
  const h = await recoveryView(t);
  try {
    h.frame({ kind: 'recovery', elapsed: 0, started: false }); h.toggle();
    for (const elapsed of [0, 4.073, 6.8]) {
      const head = h.frame({ kind: 'recovery', elapsed, started: elapsed > 0 });
      const skin = h.rig.trackingSkin!, displayed = skin.mesh.geometry;
      try {
        skin.mesh.geometry = skin.original;
        skin.mesh.updateWorldMatrix(true, false); skin.mesh.skeleton.update(); skin.mesh.computeBoundingBox(); skin.mesh.computeBoundingSphere();
        const outward = new THREE.Vector3(0, 0, 1).transformDirection(head.matrixWorld);
        const origin = h.camera.position.clone().addScaledVector(outward, .5);
        const obstruction = new THREE.Raycaster(origin, outward.negate(), 0, .5).intersectObject(skin.mesh)[0];
        assert.ok(!obstruction, 'the registered face cannot lie in front of the eye; hiding its triangles does not correct the camera anchor');
      } finally { skin.mesh.geometry = displayed; }
    }
  } finally { h.dispose(); }
});


test('looking down cannot reveal the world through the exposed first-person neck opening', async t => {
  const h = await recoveryView(t), beat = { kind: 'recovery' as const, elapsed: 0, started: false }, samples: unknown[] = [];
  try {
    h.frame(beat); h.toggle(); h.frame(beat);
    h.document.dispatchEvent(Object.assign(new Event('mousemove'), { movementX: 0, movementY: 1800 }));
    const head = h.rig.trackingSkin!.mesh;
    const body = h.rig.wardrobe.find(part => part.mesh.userData.patientBody)!.mesh as THREE.SkinnedMesh;
    const poses: RecoveryBeat[] = [
      ...[0, 3.8, 6.8].map(elapsed => ({ kind: 'recovery' as const, elapsed, started: elapsed > 0 })),
    ];
    for (const pose of poses) {
      h.frame(pose);
      for (const mesh of [head, body]) { mesh.skeleton.update(); mesh.computeBoundingBox(); mesh.computeBoundingSphere(); }
      assert.ok(h.group.visible && h.renderer.getAgentBody('neo')!.visible && head.visible && body.visible);
      for (const [x, y] of [[0, -.4], [-.04, -.6], [.04, -.6], [0, -.8]]) {
        const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(x, y), h.camera);
        const neck = h.rig.root.getObjectByName('patient-first-person-neck');
        const hit = ray.intersectObjects([head, body, ...(neck?.visible ? [neck] : [])])[0];
        assert.ok(hit && hit.distance < 1.2, `the close neck silhouette is open to the world at ${pose.kind}/${pose.elapsed}/${x}/${y}`);
        samples.push({ pose, ndc: [x, y], name: hit.object.name, distance: hit.distance });
      }
    }
    h.toggle(); h.frame(beat);
    assert.equal(h.rig.root.getObjectByName('patient-first-person-neck')?.visible, false, 'the closure must disappear from the external character view');
    assert.equal(head.geometry, h.rig.trackingSkin!.original, 'third person restores the complete original face surface');
    t.diagnostic(JSON.stringify(samples));
  } finally { h.dispose(); }
});


for (const movementY of [-1800, 1800]) test(`a saved ${movementY < 0 ? 'upward' : 'downward'} medical gaze returns continuously to standing limits when cabin movement is released`, async t => {
  const h = await recoveryView(t);
  try {
    h.frame({ kind: 'recovery', elapsed: 0, started: false }); h.toggle(); h.frame({ kind: 'recovery', elapsed: 0, started: false });
    h.document.dispatchEvent(Object.assign(new Event('mousemove'), { movementX: 0, movementY }));
    let previous: THREE.Quaternion | undefined, maximumTurn = 0;
    for (let i = 0; i <= 120; i++) {
      h.frame({ kind: 'cabin', elapsed: i / 10, started: true });
      if (previous) maximumTurn = Math.max(maximumTurn, h.camera.quaternion.angleTo(previous));
      previous = h.camera.quaternion.clone();
    }
    const before = h.camera.quaternion.clone();
    const state = { ...h.neo, currentAction: { type: 'idle' as const, parameters: {}, startedAt: 0, duration: 1, progress: 0 } };
    h.controls.performing = false; h.renderer.updateAgent('neo', state);
    h.controls.update(1 / 60, state, h.group, false); h.renderer.setPlayerMotion(h.controls.motion);
    h.renderer.update(0, h.camera, 0); h.group.updateMatrixWorld(true);
    const sync = h.controls as typeof h.controls & { syncRecoveryCamera?: (group: THREE.Group) => void };
    sync.syncRecoveryCamera?.(h.group); h.camera.updateMatrixWorld(true);
    const releaseTurn = before.angleTo(h.camera.quaternion), direction = h.camera.getWorldDirection(new THREE.Vector3());
    const pitch = Math.atan2(-direction.y, Math.hypot(direction.x, direction.z));
    t.diagnostic(JSON.stringify({ movementY, maximumTurn, releaseTurn, standingPitch: pitch }));
    assert.ok(maximumTurn < .45 && releaseTurn < .45, 'rising or releasing movement cannot flip the player view');
    assert.ok(pitch >= -.41 && pitch <= 1.11, 'the released view must already be inside normal standing limits before the next mouse event');
  } finally { h.dispose(); }
});
