import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import * as THREE from 'three';
import { cabinBodyPose, downloadRoot, filmPosition, truthRoot, type FilmJourney, type DownloadSetup } from '@auto_matrix/shared';
import { recoveryView } from './helpers/recovery-view.mjs';

async function bedside(t: TestContext) {
  const h = await recoveryView(t);
  const frame = (setup?: DownloadSetup, third = false) => {
    const truth = { role: 'neo' as const, phase: 'question' as const, elapsed: 0 };
    const pose = setup ? downloadRoot(setup, 'neo') : truthRoot(truth, 'neo');
    const waking = setup?.phase === 'greeting' || setup?.phase === 'waking';
    h.neo.position = filmPosition('film_neb_deck', pose.x, pose.z); h.neo.position.y += pose.y; h.neo.rotation = pose.yaw;
    h.neo.currentAction = { type: 'idle', parameters: {
      player: true, resolved: true, filmPose: 'cabin', recovery: waking ? cabinBodyPose(setup.phase === 'greeting' ? 0 : setup.elapsed).clock : 0,
      ...(setup ? { download: { ...setup, role: 'neo' }, cabin: { kind: 'wake', elapsed: setup.phase === 'greeting' ? 0 : setup.elapsed, role: 'neo' } } : { truth }),
    }, startedAt: 0, duration: 1, progress: 0 };
    const state = { ...h.neo, position: { ...h.neo.position } };
    const journey = { scene: setup ? 'm1_download' : 'm1_truth_return', actor: 'neo', step: setup ? 0 : 2 } as FilmJourney;
    h.renderer.updateAgent('neo', state); h.controls.firstPerson = !third;
    h.controls.update(1 / 60, state, h.group, false);
    h.renderer.setPlayer('neo', !third); h.renderer.setPlayerMotion(h.controls.motion);
    h.renderer.update(0, h.camera, 0, 0, journey); h.group.updateMatrixWorld(true);
    h.controls.syncRecoveryCamera(h.group); h.camera.updateMatrixWorld(true);
    return h.rig.bones.get('head')!;
  };
  const look = (x: number, y: number) => h.document.dispatchEvent(Object.assign(new Event('mousemove'), { movementX: x, movementY: y }));
  const nearHits = () => {
    const meshes: THREE.Mesh[] = [];
    h.group.traverseVisible(object => {
      if (!(object instanceof THREE.Mesh)) return;
      if (object instanceof THREE.SkinnedMesh) { object.skeleton.update(); object.computeBoundingBox(); object.computeBoundingSphere(); }
      meshes.push(object);
    });
    const hits: unknown[] = [];
    for (const x of [-.35, 0, .35]) for (const y of [-.2, 0, .2]) {
      const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(x, y), h.camera); ray.near = h.camera.near; ray.far = .6;
      const hit = ray.intersectObjects(meshes, false)[0];
      if (hit) hits.push({ x, y, mesh: hit.object.name, distance: hit.distance });
    }
    return hits;
  };
  return { ...h, frame, look, nearHits };
}

for (const [x, y] of [[580, 600], [0, 0], [300, 400], [-500, 650]]) test(`bedside choice preserves actual first-person gaze into Tank's greeting (${x}/${y})`, async t => {
  const h = await bedside(t), greeting = { phase: 'greeting' as const, elapsed: 0, progress: 0 };
  try {
    h.frame(); h.frame(); h.look(x, y); h.frame();
    const before = h.camera.getWorldDirection(new THREE.Vector3()), beforeRotation = h.camera.quaternion.clone(), beforeHits = h.nearHits();
    const head = h.frame(greeting), after = h.camera.getWorldDirection(new THREE.Vector3()), afterHits = h.nearHits();
    const eye = head.localToWorld((head.userData.patientEye ?? head.userData.cameraEye).clone());
    t.diagnostic(JSON.stringify({ x, y, turn: before.angleTo(after), fullTurn: beforeRotation.angleTo(h.camera.quaternion), before: before.toArray(), after: after.toArray(), beforeHits, afterHits }));
    assert.ok(h.camera.position.distanceTo(eye) < 1e-6, 'the camera must remain at the current delivered eyes');
    assert.ok(before.angleTo(after) < .04, 'the scene boundary reinterpreted the old world gaze as a head-relative angle');
    assert.ok(beforeRotation.angleTo(h.camera.quaternion) < .04, 'the horizon must not roll when the coordinate frame changes');
    assert.equal(afterHits.length, 0, 'the normal bedside sightline cannot be replaced by the player collar or body');
    assert.ok(h.renderer.getAgentBody('neo')!.visible && h.rig.root.getObjectByName('neo-logos-sweater')!.visible, 'retain the actual first-person body and costume');
    const position = h.camera.position.clone(), rotation = h.camera.quaternion.clone();
    for (let i = 0; i < 5; i++) { h.frame(greeting); assert.ok(h.camera.position.distanceTo(position) < 1e-7); assert.ok(h.camera.quaternion.angleTo(rotation) < 1e-7); }
    h.toggle(); h.frame(greeting, true); h.toggle(); h.frame(greeting);
    assert.ok(h.camera.quaternion.angleTo(rotation) < 1e-6, 'V must retain the transferred bedside horizon');
  } finally { h.dispose(); }
});

test('the retained bedside gaze remains steerable while Tank speaks and Neo rises, then hands off continuously to walking', async t => {
  const h = await bedside(t);
  try {
    h.frame(); h.frame(); h.look(580, 600); h.frame(); h.frame({ phase: 'greeting', elapsed: 0, progress: 0 });
    const beforeLook = h.camera.getWorldDirection(new THREE.Vector3()); h.look(-40, -20); h.frame({ phase: 'greeting', elapsed: 0, progress: 0 });
    assert.ok(beforeLook.angleTo(h.camera.getWorldDirection(new THREE.Vector3())) > .05, 'the preserved gaze cannot lock mouse control');
    let previous = h.camera.quaternion.clone(), maximumTurn = 0;
    for (let i = 0; i <= 240; i++) {
      h.frame({ phase: 'waking', elapsed: i / 20, progress: 0 });
      maximumTurn = Math.max(maximumTurn, previous.angleTo(h.camera.quaternion)); previous = h.camera.quaternion.clone();
    }
    const state = { ...h.neo, currentAction: null };
    h.renderer.updateAgent('neo', state); h.controls.update(1 / 60, state, h.group, false);
    h.renderer.setPlayerMotion(h.controls.motion); h.renderer.update(0, h.camera, 0); h.group.updateMatrixWorld(true); h.controls.syncRecoveryCamera(h.group);
    const releaseTurn = previous.angleTo(h.camera.quaternion);
    t.diagnostic(JSON.stringify({ maximumTurn, releaseTurn }));
    assert.ok(maximumTurn < .25 && releaseTurn < .25, 'sitting, turning and movement release cannot flip the view');
  } finally { h.dispose(); }
});

test('cold possession and V toggles use the current waking eyes without replaying a previous bedside view', async t => {
  const h = await bedside(t);
  try {
    h.frame(); h.frame(); h.look(580, 600); h.frame(); h.frame({ phase: 'greeting', elapsed: 0, progress: 0 });
    for (const elapsed of [0, 3, 7, 11.5]) {
      const setup: DownloadSetup = { phase: elapsed ? 'waking' : 'greeting', elapsed, progress: 0 };
      h.frame(setup, true);
      h.controls.release(); h.controls.possess({ ...h.neo, position: { ...h.neo.position } });
      h.toggle(); assert.equal(h.controls.firstPerson, true);
      const head = h.frame(setup), eye = head.localToWorld((head.userData.patientEye ?? head.userData.cameraEye).clone());
      const position = h.camera.position.clone(), rotation = h.camera.quaternion.clone();
      assert.ok(position.distanceTo(eye) < 1e-6);
      assert.ok(h.camera.quaternion.toArray().every(Number.isFinite));
      if (!elapsed) assert.equal(h.nearHits().length, 0, 'a cold greeting must not start inside the collar');
      h.toggle(); assert.equal(h.controls.firstPerson, false); h.frame(setup, true);
      h.toggle(); assert.equal(h.controls.firstPerson, true); h.frame(setup);
      assert.ok(h.camera.position.distanceTo(position) < 1e-6);
      assert.ok(h.camera.quaternion.angleTo(rotation) < 1e-6, 'V must restore the same posed first-person frame');
    }
  } finally { h.dispose(); }
});
