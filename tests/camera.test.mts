import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import * as THREE from 'three';
import type { AgentState, PlayerInput } from '@auto_matrix/shared';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { CameraController } from '../packages/client/src/engine/CameraController.js';
import { APARTMENT, newFreewayRide, filmPosition, officeCrossingPose, pillRoot, meetingRoot, meetingCarPose, MEETING_CAR, FILM_SETS, ORACLE_VISIT, RESCUE, airRescueRoot, matrixEscapeRoot, theOneRoot, type TheOneEncounter } from '@auto_matrix/shared';

test('observer camera releases drag and ignores pointer capture while a character controls the view', () => {
  let captures = 0;
  const element = Object.assign(new EventTarget(), { setPointerCapture() { captures++; } });
  const camera = new THREE.PerspectiveCamera();
  const observer = new CameraController(camera, element as unknown as HTMLElement);
  observer.setEnabled(false);
  element.dispatchEvent(Object.assign(new Event('pointerdown'), { pointerId: 1, clientX: 0, clientY: 0, button: 0 }));
  assert.equal(captures, 0);
  observer.setEnabled(true);
  element.dispatchEvent(Object.assign(new Event('pointerdown'), { pointerId: 1, clientX: 0, clientY: 0, button: 0 }));
  assert.equal(captures, 1);
  observer.dispose();
});

test('mouse pitch is included in authoritative player input', t => {
  const game = setup(t); game.controls.firearm = true;
  game.document.pointerLockElement = game.canvas;
  game.event(game.document, 'mousemove', { movementX: 0, movementY: -240 }); game.step(.1);
  assert.ok((game.sent.at(-1)?.pitch ?? 0) < -.15, 'upward camera input must reach server-side ballistics');
});

test('the lobby checkpoint has a readable authored camera and V returns to Neo eye height', t => {
  const game = setup(t, Math.PI); const center = FILM_SETS.film_government_lobby.center;
  game.state.currentLocation = 'film_government_lobby'; game.state.position = filmPosition('film_government_lobby', 1.4, 25.5);
  game.state.currentAction = { type: 'idle', parameters: { lobbyEntry: { phase: 'checkpoint', elapsed: 3.8, role: 'neo' }, armed: true }, startedAt: 0, duration: 1, progress: 0 };
  game.controls.possess(game.state); game.step(.5);
  const guard = new THREE.Vector3(center.x, center.y + 2.8, center.z + 20.8).project(game.camera);
  assert.ok(Math.abs(guard.x) < .85 && Math.abs(guard.y) < .85, 'the alarm shot keeps the checkpoint guard in frame');
  const locked = game.group.position.clone(); game.key('KeyW'); game.step(.35); assert.deepEqual(game.group.position, locked, 'the entry performance owns movement until weapons are drawn');
  game.key('KeyW', false); game.key('KeyV'); game.key('KeyV', false); game.step(.1);
  assert.ok(game.camera.position.distanceTo(new THREE.Vector3(game.state.position.x, game.state.position.y + 2.99, game.state.position.z)) < .06);
});

test('Smith questioning keeps both faces readable and V uses Morpheus seated eye line', t => {
  const game = setup(t, Math.PI); const center = FILM_SETS.film_government_office.center;
  game.camera.aspect = .72; game.camera.updateProjectionMatrix();
  Object.assign(game.state, { id: 'morpheus', name: 'Morpheus', currentLocation: 'film_government_office',
    position: filmPosition('film_government_office', 0, -2.2), rotation: Math.PI });
  game.state.currentAction = { type: 'idle', parameters: { seated: true,
    government: { kind: 'questioning', phase: 'monologue', elapsed: 7.8, attempt: 0, resolve: .55, role: 'morpheus' } }, startedAt: 0, duration: 1, progress: 0 };
  game.controls.possess(game.state); game.step(.5);
  const morpheus = new THREE.Vector3(center.x, center.y + 2.8, center.z - 2.2).project(game.camera);
  const smith = new THREE.Vector3(center.x, center.y + 3, center.z - 6.2).project(game.camera);
  for (const face of [morpheus, smith]) assert.ok(Math.abs(face.x) < .9 && Math.abs(face.y) < .9 && face.z > -1 && face.z < 1);
  assert.ok(game.camera.position.x < center.x - 5, 'the portrait two-shot must clear the serum stand and exterior mullions');
  game.key('KeyV'); game.key('KeyV', false); game.step(.1);
  assert.ok(Math.abs(game.camera.position.y - (game.state.position.y + 2.18)) < .08, 'the chair view cannot float at standing height');
});

test('rooftop bullet time keeps Jones and bent Neo in frame while V follows the lowered body', t => {
  const game = setup(t, Math.PI); const center = FILM_SETS.film_government_roof.center;
  game.camera.aspect = .72; game.camera.updateProjectionMatrix();
  game.state.currentLocation = 'film_government_roof'; game.state.position = filmPosition('film_government_roof', 0, 2.5); game.state.rotation = Math.PI;
  game.state.currentAction = { type: 'idle', parameters: { armed: true,
    government: { kind: 'rooftop', phase: 'bullet_time', elapsed: 2.65, attempt: 0, dodges: 1, wounds: 0, resolved: [0], role: 'neo' } }, startedAt: 0, duration: 1, progress: 0 };
  game.controls.possess(game.state); game.step(.5);
  for (const point of [new THREE.Vector3(center.x, center.y + 2.1, center.z + 2.5), new THREE.Vector3(center.x, center.y + 3, center.z - 8.8)]) {
    const screen = point.project(game.camera); assert.ok(Math.abs(screen.x) < .72 && Math.abs(screen.y) < .9 && screen.z > -1 && screen.z < 1);
  }
  assert.ok(game.camera.position.x > center.x + 15, 'the portrait bullet-time shot keeps both complete bodies away from the crop');
  game.key('KeyV'); game.key('KeyV', false); game.step(.1);
  assert.ok(game.camera.position.y < game.state.position.y + 2.2, 'first person follows Neo under the bullets');
});

test('the portrait Trinity finish keeps the shooter, Jones and fallen Neo inside the action frame', t => {
  const game = setup(t, Math.PI); const center = FILM_SETS.film_government_roof.center;
  game.camera.aspect = .72; game.camera.updateProjectionMatrix();
  game.state.currentLocation = 'film_government_roof'; game.state.position = filmPosition('film_government_roof', 0, 2.5); game.state.rotation = Math.PI;
  game.state.currentAction = { type: 'idle', parameters: { armed: true,
    government: { kind: 'rooftop', phase: 'trinity', elapsed: 2.1, attempt: 0, dodges: 3, wounds: 0, resolved: [0, 1, 2], role: 'neo' } }, startedAt: 0, duration: 1, progress: 0 };
  game.controls.possess(game.state);
  for (const elapsed of [2.1, 2.8, 3.6]) {
    (game.state.currentAction.parameters.government as { elapsed: number }).elapsed = elapsed; game.step(.5);
    for (const point of [new THREE.Vector3(center.x, center.y + 1.6, center.z + 2.5), new THREE.Vector3(center.x - 4.2, center.y + 3, center.z + 5.5), new THREE.Vector3(center.x, center.y + 3, center.z - 8.8)]) {
      const screen = point.project(game.camera); assert.ok(Math.abs(screen.x) < .8 && Math.abs(screen.y) < .82 && screen.z > -1 && screen.z < 1, `portrait finish crop at ${elapsed}s: ${screen.toArray().join(',')}`);
    }
  }
  assert.ok(game.camera.position.distanceTo(new THREE.Vector3(center.x, center.y + 3, center.z - 8.8)) > 16, 'the finish cannot crop the target at Codex sidebar width');
});

test('the B-212 download uses a wide portrait establishing shot instead of filling the view with its hull', t => {
  const game = setup(t, -Math.PI * .75); const center = FILM_SETS.film_government_roof.center;
  game.camera.aspect = .72; game.camera.updateProjectionMatrix();
  game.state.currentLocation = 'film_government_roof'; game.state.position = filmPosition('film_government_roof', 11.5, -15.5);
  game.state.currentAction = { type: 'idle', parameters: { government: { kind: 'rooftop', phase: 'downloading', elapsed: 2.2,
    attempt: 0, dodges: 3, wounds: 0, resolved: [0, 1, 2], role: 'neo' } }, startedAt: 0, duration: 1, progress: 0 };
  game.controls.possess(game.state); game.step(.5);
  const helicopter = new THREE.Vector3(center.x + 7, center.y + 4, center.z - 20); const screen = helicopter.clone().project(game.camera);
  assert.ok(game.camera.position.distanceTo(helicopter) > 25, 'the camera needs enough distance to show the whole aircraft');
  assert.ok(Math.abs(screen.x) < .55 && Math.abs(screen.y) < .65 && screen.z > -1 && screen.z < 1);
  for (const point of [new THREE.Vector3(center.x - 6.4, center.y + 7.3, center.z - 20), new THREE.Vector3(center.x + 20.4, center.y + 7.3, center.z - 20),
    new THREE.Vector3(center.x + 7, center.y + 7.3, center.z - 6.6), new THREE.Vector3(center.x + 7, center.y + 7.3, center.z - 33.4)]) {
    const tip = point.project(game.camera); assert.ok(Math.abs(tip.x) < .72 && Math.abs(tip.y) < .72, `B-212 rotor crop: ${tip.toArray().join(',')}`);
  }
});

test('office air rescue keeps the B-212, broken-window target and both falling men readable in portrait', t => {
  const game = setup(t, Math.PI); const center = FILM_SETS.film_government_office.center;
  game.camera.aspect = .72; game.camera.updateProjectionMatrix(); game.state.currentLocation = 'film_government_office';
  const apply = (phase: 'firing' | 'catching', elapsed: number) => {
    const encounter = { kind: 'office' as const, phase, elapsed, attempt: 0, suppression: 1, bursts: 4 };
    const neo = airRescueRoot(encounter, 'neo'); game.state.position = { x: center.x + neo.x, y: center.y + neo.y, z: center.z + neo.z }; game.state.rotation = neo.yaw;
    game.state.currentAction = { type: 'idle', parameters: { airRescue: { ...encounter, role: 'neo' } }, startedAt: 0, duration: 1, progress: 0 };
    game.controls.possess(game.state); game.step(.5); return encounter;
  };
  apply('firing', 2);
  assert.ok(game.camera.position.z < center.z - 30, 'the fire camera must stay outside the facade instead of filming into the opaque side wall');
  for (const point of [new THREE.Vector3(center.x + 4, center.y + 5.8, center.z - 36), new THREE.Vector3(center.x, center.y + 4.8, center.z - 26.2),
    new THREE.Vector3(center.x, center.y + 2.8, center.z - 22.4)]) {
    const screen = point.project(game.camera); assert.ok(Math.abs(screen.x) < .86 && Math.abs(screen.y) < .88 && screen.z > -1 && screen.z < 1, `office approach crop: ${screen.toArray().join(',')}`);
  }
  game.key('KeyV'); game.key('KeyV', false); game.step(.2);
  assert.ok(game.camera.position.x < center.x - 1.4 && game.camera.position.z > center.z - 35.2,
    'the minigun first-person camera must clear the cabin and rear gun housing');
  const officeTarget = new THREE.Vector3(center.x, center.y + 4.6, center.z - 7).project(game.camera);
  assert.ok(Math.abs(officeTarget.x) < .65 && Math.abs(officeTarget.y) < .72 && officeTarget.z > -1 && officeTarget.z < 1,
    `the broken-window target must remain readable from the minigun view: ${officeTarget.toArray().join(',')}`);
  game.key('KeyV'); game.key('KeyV', false); game.step(.1);
  for (const elapsed of [.8, 2.2, 3.8]) {
    const encounter = apply('catching', elapsed); const neo = airRescueRoot(encounter, 'neo'); const morpheus = airRescueRoot(encounter, 'morpheus');
    for (const actor of [neo, morpheus]) {
      const screen = new THREE.Vector3(center.x + actor.x, center.y + actor.y + 2.2, center.z + actor.z).project(game.camera);
      assert.ok(Math.abs(screen.x) < .84 && Math.abs(screen.y) < .84 && screen.z > -1 && screen.z < 1, `catch crop at ${elapsed}s: ${screen.toArray().join(',')}`);
    }
  }
  const encounter = apply('catching', 1); const morpheus = airRescueRoot(encounter, 'morpheus');
  game.key('KeyV'); game.key('KeyV', false); game.step(.2);
  const target = new THREE.Vector3(center.x + morpheus.x, center.y + morpheus.y + 2.2, center.z + morpheus.z);
  const screen = target.clone().project(game.camera); const towardMorpheus = target.clone().sub(game.camera.position).normalize();
  assert.ok(game.camera.getWorldDirection(new THREE.Vector3()).dot(towardMorpheus) > .75,
    'Neo first person must face the falling Morpheus instead of staring through the office');
  assert.ok(Math.abs(screen.x) < .55 && Math.abs(screen.y) < .7 && screen.z > -1 && screen.z < 1,
    `Morpheus must remain readable in Neo first person: ${screen.toArray().join(',')}`);
});

test('roof rope camera holds Neo and dangling Trinity through shocks, impact and pull-up', t => {
  const game = setup(t, Math.PI); const center = FILM_SETS.film_government_roof.center;
  game.camera.aspect = .72; game.camera.updateProjectionMatrix(); game.state.currentLocation = 'film_government_roof';
  const apply = (phase: 'bracing' | 'pulling', elapsed: number) => {
    const encounter = { kind: 'roof' as const, phase, elapsed, attempt: 0, grip: .72, braces: phase === 'pulling' ? 2 : 1, misses: 0, resolved: [0], ropeCut: phase === 'pulling', crash: phase === 'pulling' };
    const neo = airRescueRoot(encounter, 'neo'); game.state.position = { x: center.x + neo.x, y: center.y + neo.y, z: center.z + neo.z }; game.state.rotation = neo.yaw;
    game.state.currentAction = { type: 'idle', parameters: { airRescue: { ...encounter, role: 'neo' } }, startedAt: 0, duration: 1, progress: 0 };
    game.controls.possess(game.state); game.step(.5); return encounter;
  };
  for (const elapsed of [1.25, 3.35, 5.55]) {
    const encounter = apply('bracing', elapsed); const neo = airRescueRoot(encounter, 'neo'); const trinity = airRescueRoot(encounter, 'trinity');
    assert.ok(game.camera.position.x < center.x - 31, 'the rope camera must stay beyond the west parapet so the roof deck cannot hide Trinity');
    for (const actor of [neo, trinity]) {
      const screen = new THREE.Vector3(center.x + actor.x, center.y + actor.y + 2.2, center.z + actor.z).project(game.camera);
      assert.ok(Math.abs(screen.x) < .82 && Math.abs(screen.y) < .9 && screen.z > -1 && screen.z < 1, `rope shock crop at ${elapsed}s: ${screen.toArray().join(',')}`);
      if (actor === trinity) assert.ok(screen.y > -.3, `Trinity must stay above the action prompt: ${screen.toArray().join(',')}`);
    }
  }
  const hanging = apply('bracing', 3.35); const hangingTrinity = airRescueRoot(hanging, 'trinity');
  game.key('KeyV'); game.key('KeyV', false); game.step(.2);
  assert.ok(game.camera.position.y > center.y + 2.8, 'Neo first person must lean above the west parapet instead of looking into it');
  assert.ok(game.camera.position.x < center.x - 31.1, 'Neo first person must look from beyond the parapet instead of through its concrete');
  const firstPersonTrinity = new THREE.Vector3(center.x + hangingTrinity.x, center.y + hangingTrinity.y + 2.2, center.z + hangingTrinity.z).project(game.camera);
  assert.ok(Math.abs(firstPersonTrinity.x) < .55 && Math.abs(firstPersonTrinity.y) < .7 && firstPersonTrinity.z > -1 && firstPersonTrinity.z < 1,
    `Trinity must remain readable in the roof first person view: ${firstPersonTrinity.toArray().join(',')}`);
  game.key('KeyV'); game.key('KeyV', false); game.step(.1);
  const encounter = apply('pulling', 3.4); const trinity = airRescueRoot(encounter, 'trinity');
  const pullPoints = [new THREE.Vector3(center.x - 28.5, center.y + 2.2, center.z - 22),
    new THREE.Vector3(center.x + trinity.x, center.y + trinity.y + 2.2, center.z + trinity.z),
    new THREE.Vector3(center.x - 3, center.y + 8, center.z - 48)];
  assert.ok(game.camera.position.distanceTo(pullPoints[0]) < 30, 'the crash shot must stay close enough to read Neo pulling Trinity');
  const actorScreens = pullPoints.slice(0, 2).map(point => point.clone().project(game.camera));
  assert.ok(Math.abs(actorScreens[0].x - actorScreens[1].x) > .45, 'Neo and Trinity need distinct silhouettes during the crash shot');
  assert.ok(actorScreens.every(actor => actor.y > -.3), 'the action prompt must not cover Neo or Trinity during the crash shot');
  for (const [index, point] of pullPoints.entries()) {
    const screen = point.project(game.camera); assert.ok(Math.abs(screen.x) < .88 && Math.abs(screen.y) < .9 && screen.z > -1 && screen.z < 1, `roof pull crop: ${screen.toArray().join(',')}`);
    if (index < 2) assert.ok(screen.x > -.65, `Neo and Trinity cannot be reduced to the left edge during the crash: ${screen.toArray().join(',')}`);
  }
});

test('the subway train window owns a readable camera and V looks from Neo toward Smith on the rails', t => {
  const game = setup(t, Math.PI / 2); const center = FILM_SETS.film_subway_platform.center;
  game.camera.aspect = .72; game.camera.updateProjectionMatrix(); game.state.currentLocation = 'film_subway_platform';
  const encounter = { kind: 'subway' as const, phase: 'train_window' as const, elapsed: 2.7, attempt: 0, checkpoint: 'tracks' as const,
    hits: 4, dodges: 1, pursuit: 0, segment: 1, possessions: 0, resolved: [] };
  const neo = matrixEscapeRoot(encounter, 'neo'); const smith = matrixEscapeRoot(encounter, 'smith');
  game.state.position = { ...filmPosition('film_subway_platform', neo.x, neo.z), y: center.y + neo.y };
  game.state.rotation = neo.yaw;
  game.state.currentAction = { type: 'idle', parameters: { matrixEscape: { ...encounter, role: 'neo' } }, startedAt: 0, duration: 1, progress: 0 };
  game.controls.possess(game.state); game.step(.4);
  assert.equal(game.controls.performing, true);
  assert.ok(game.camera.position.x < center.x + 21.8, 'the train camera must stay inside the tiled tunnel wall');
  for (const actor of [neo, smith]) {
    const screen = new THREE.Vector3(center.x + actor.x, center.y + actor.y + 2.1, center.z + actor.z).project(game.camera);
    assert.ok(Math.abs(screen.x) < .85 && Math.abs(screen.y) < .88 && screen.z > -1 && screen.z < 1, `rail actor crop: ${screen.toArray().join(',')}`);
  }
  const locked = game.group.position.clone(); game.key('KeyW'); game.step(.25); game.key('KeyW', false); assert.deepEqual(game.group.position, locked);
  game.key('KeyV'); game.key('KeyV', false); game.step(.1);
  const target = new THREE.Vector3(center.x + smith.x, center.y + smith.y + 2.25, center.z + smith.z);
  assert.ok(game.camera.getWorldDirection(new THREE.Vector3()).dot(target.clone().sub(game.camera.position).normalize()) > .9,
    'Neo first person follows his authored body and faces Smith instead of the global set direction');
});

test('the subway body-swap camera keeps its subject clear of the platform columns', t => {
  const game = setup(t, Math.PI); const center = FILM_SETS.film_subway_platform.center;
  game.state.currentLocation = 'film_subway_platform';
  const encounter = { kind: 'subway' as const, phase: 'body_swap' as const, elapsed: 1.35, attempt: 0, checkpoint: 'tracks' as const,
    hits: 4, dodges: 2, pursuit: 0, segment: 1, possessions: 1, resolved: [], host: 'citizen_13' as const };
  const neo = matrixEscapeRoot(encounter, 'neo'); game.state.position = { ...filmPosition('film_subway_platform', neo.x, neo.z), y: center.y + neo.y };
  game.state.currentAction = { type: 'idle', parameters: { matrixEscape: { ...encounter, role: 'neo' } }, startedAt: 0, duration: 1, progress: 0 };
  game.controls.possess(game.state); game.step(.4);
  const host = matrixEscapeRoot(encounter, 'citizen_13');
  const subject = new THREE.Vector3(center.x + host.x, center.y + host.y + 2.25, center.z + host.z);
  const screen = subject.clone().project(game.camera);
  assert.ok(Math.abs(screen.x) < .75 && Math.abs(screen.y) < .8 && screen.z > -1 && screen.z < 1, 'the changing host stays readable');
  const sight = new THREE.Line3(new THREE.Vector3(game.camera.position.x, 0, game.camera.position.z), new THREE.Vector3(subject.x, 0, subject.z));
  for (const x of [-15.3, 8.2]) for (let z = -46; z <= 46; z += 13) {
    const column = new THREE.Vector3(center.x + x, 0, center.z + z); const closest = new THREE.Vector3();
    sight.closestPointToPoint(column, true, closest);
    assert.ok(closest.distanceTo(column) > 1.1, `body-swap sightline crosses platform column ${x},${z}`);
  }
});

test('the garbage-truck dodge camera stays on the open lane and keeps Neo readable', t => {
  const game = setup(t, Math.PI); const center = FILM_SETS.film_escape_streets.center;
  game.state.currentLocation = 'film_escape_streets';
  const encounter = { kind: 'city' as const, phase: 'truck_window' as const, elapsed: 2.15, attempt: 0, checkpoint: 'street' as const,
    hits: 0, dodges: 1, pursuit: .4, segment: 1, possessions: 1, resolved: [], host: 'citizen_13' as const };
  const neo = matrixEscapeRoot(encounter, 'neo'); game.state.position = { ...filmPosition('film_escape_streets', neo.x, neo.z), y: center.y + neo.y };
  game.state.currentAction = { type: 'idle', parameters: { matrixEscape: { ...encounter, role: 'neo' } }, startedAt: 0, duration: 1, progress: 0 };
  game.controls.possess(game.state); game.step(.4);
  assert.ok(game.camera.position.z < center.z + neo.z - 10, 'the camera must get ahead of Neo and the truck instead of looking through its body');
  assert.ok(game.camera.position.distanceTo(new THREE.Vector3(center.x + neo.x, center.y + neo.y + 2.1, center.z + neo.z)) > 18,
    'the truck shot needs enough distance to show the vehicle instead of filling the frame with its body');
  const screen = new THREE.Vector3(center.x + neo.x, center.y + neo.y + 2.1, center.z + neo.z).project(game.camera);
  assert.ok(Math.abs(screen.x) < .72 && Math.abs(screen.y) < .82 && screen.z > -1 && screen.z < 1, 'Neo stays visible at the dodge line');
});

test('the room 303 entry frames Neo and the pursuing possession in depth', t => {
  const game = setup(t, Math.PI); const center = FILM_SETS.film_escape_streets.center;
  game.state.currentLocation = 'film_escape_streets';
  const encounter = { kind: 'city' as const, phase: 'door' as const, elapsed: .8, attempt: 0, checkpoint: 'street' as const,
    hits: 0, dodges: 2, pursuit: .35, segment: 2, possessions: 2, resolved: [], host: 'citizen_14' as const };
  const neo = matrixEscapeRoot(encounter, 'neo'); game.state.position = { ...filmPosition('film_escape_streets', neo.x, neo.z), y: center.y + neo.y };
  game.state.currentAction = { type: 'idle', parameters: { matrixEscape: { ...encounter, role: 'neo' } }, startedAt: 0, duration: 1, progress: 0 };
  game.controls.possess(game.state); game.step(.4);
  for (const role of ['neo', 'citizen_14'] as const) {
    const root = matrixEscapeRoot(encounter, role);
    const screen = new THREE.Vector3(center.x + root.x, center.y + root.y + 2.1, center.z + root.z).project(game.camera);
    assert.ok(Math.abs(screen.x) < .86 && Math.abs(screen.y) < .85 && screen.z > -1 && screen.z < 1, `${role} is cropped from the 303 entry shot`);
  }
});

for (const phase of ['duel', 'running'] as const) test(`matrix ${phase} keeps V first person tied to the player's live turn`, t => {
  const game = setup(t); game.state.currentLocation = phase === 'duel' ? 'film_subway_platform' : 'film_escape_streets';
  game.state.position = filmPosition(game.state.currentLocation, 0, phase === 'duel' ? 10 : 35);
  game.state.currentAction = { type: 'idle', parameters: { matrixEscape: { kind: phase === 'duel' ? 'subway' : 'city', phase, elapsed: 0, attempt: 0,
    checkpoint: phase === 'duel' ? 'duel' : 'street', hits: 0, dodges: 0, pursuit: .2, segment: 0, possessions: 0, resolved: [], role: 'neo' } }, startedAt: 0, duration: 1, progress: 0 };
  game.controls.possess(game.state); game.key('KeyV'); game.key('KeyV', false); game.document.pointerLockElement = game.canvas;
  game.event(game.document, 'mousemove', { movementX: -560, movementY: 0 }); game.step(.2);
  assert.equal(game.controls.performing, false, 'free combat and chase phases must not lock player locomotion');
  assert.ok(Math.abs(angle(game.yaw(), Math.PI / 2)) < .08, 'V view follows the live mouse turn instead of the set entrance yaw');
  game.key('KeyW'); game.step(.45); game.key('KeyW', false);
  assert.ok(game.group.position.x > game.state.position.x + .6, 'forward movement follows the newly turned first-person view');
  assert.ok(Math.abs(angle(game.group.children[0].rotation.y, Math.PI / 2)) < .12, 'the avatar body follows the same live turn');
});

function setup(t: TestContext, rotation = 0) {
  class InputTarget extends EventTarget { matches() { return false; } }
  const window = new InputTarget(); const canvas = new InputTarget();
  const document = Object.assign(new InputTarget(), { pointerLockElement: null as unknown, hidden: false, exitPointerLock() {} });
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  Object.assign(globalThis, { window, document });
  let time = 2000;
  t.mock.method(performance, 'now', () => time);
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000);
  const group = new THREE.Group(); group.add(new THREE.Group());
  const sent: PlayerInput[] = [];
  const actions: string[] = [];
  const state: AgentState = { id: 'neo', name: 'Neo', faction: 'zion', status: 'alive',
    position: { x: 1120, y: 1, z: 960 }, rotation, velocity: { x: 0, y: 0, z: 0 }, targetPosition: null, currentPath: [],
    health: 100, maxHealth: 100, isAwakened: false, isInMatrix: true, currentLocation: 'downtown',
    currentGoal: '', currentAction: null, mood: '', alertness: 0, abilities: [], activeEffects: [],
    appearance: { bodyColor: '#000', headColor: '#aaa', clothing: 'coat', accessories: [], isAgent: false } };
  const controls = new PlayerControls(canvas as unknown as HTMLCanvasElement, camera, input => sent.push(input), action => actions.push(action));
  controls.possess(state);
  t.after(() => {
    controls.dispose();
    ['window', 'document'].forEach((key, i) => {
      if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!);
      else Reflect.deleteProperty(globalThis, key);
    });
  });
  const event = (target: EventTarget, type: string, values = {}) => target.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), values));
  const key = (code: string, down = true, repeat = false) => event(window, down ? 'keydown' : 'keyup', { code, repeat });
  const step = (seconds: number, dt = 1 / 60, running = true) => {
    for (let i = 0; i < Math.round(seconds / dt); i++) { time += dt * 1000; controls.update(dt, state, group, running); }
  };
  const yaw = () => { const direction = camera.getWorldDirection(new THREE.Vector3()); return Math.atan2(direction.x, direction.z); };
  step(.5);
  return { controls, camera, group, state, document, window, canvas, sent, actions, event, key, step, yaw };
}

const angle = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

test('the club whisper keeps Trinity visible beside Neo and first person can still look around', t => {
  const game = setup(t, Math.PI); const center = FILM_SETS.film_white_rabbit_club.center;
  game.state.currentLocation = 'film_white_rabbit_club'; game.state.position = filmPosition('film_white_rabbit_club', 7, -4);
  game.state.currentAction = { type: 'idle', parameters: { club: { phase: 'question', elapsed: 0, role: 'neo' } }, startedAt: 0, duration: 1, progress: 0 };
  game.controls.possess(game.state);
  for (const aspect of [16 / 9, 426 / 680]) {
    game.camera.aspect = aspect; game.camera.updateProjectionMatrix(); game.step(2);
    const face = new THREE.Vector3(center.x + 6.45, center.y + 2.93, center.z - 4.55);
    const neo = new THREE.Sphere(new THREE.Vector3(center.x + 7, center.y + 3.02, center.z - 4.1), .34);
    const ray = new THREE.Ray(game.camera.position, face.clone().sub(game.camera.position).normalize());
    assert.equal(ray.intersectsSphere(neo), false, 'Neo must not obscure Trinity’s face during her warning');
    const screen = face.project(game.camera); assert.ok(Math.abs(screen.x) < .8 && Math.abs(screen.y) < .8);
  }
  game.camera.aspect = 16 / 9;
  game.key('KeyV'); game.key('KeyV', false); game.step(.2);
  const nearbyTemple = new THREE.Vector3(center.x + 6.7, center.y + 2.95, center.z - 4.48).project(game.camera);
  assert.ok(nearbyTemple.z > -1 && nearbyTemple.z < 1, 'the first-person near plane must not slice through the nearby speaker');
  const initial = game.yaw(); game.event(game.canvas, 'mousedown', { button: 2 });
  game.event(game.document, 'mousemove', { movementX: 80, movementY: 0 }); game.step(.1);
  assert.ok(Math.abs(angle(game.yaw(), initial)) > .08);
  game.state.currentAction = null; game.step(.1); assert.equal(game.controls.performing, false);
});

test('the white-rabbit close-up clears the visitor beside the door and releases control afterwards', t => {
  const game = setup(t); const center = FILM_SETS.film_anderson_flat.center;
  game.state.currentLocation = 'film_anderson_flat'; game.state.position = filmPosition('film_anderson_flat', 0, 10.2);
  game.controls.possess(game.state);
  game.state.currentAction = { type: 'idle', parameters: { contact: { phase: 'inspecting', elapsed: 1, role: 'neo' } }, startedAt: 0, duration: 1, progress: 0 };
  game.step(.5);
  const visitor = new THREE.Box3(new THREE.Vector3(center.x - .75, center.y + 2, center.z + 12.35), new THREE.Vector3(center.x + .75, center.y + 3.6, center.z + 13.65));
  assert.ok(visitor.distanceToPoint(game.camera.position) > game.camera.near, 'the near plane cannot cut into Choi’s head');
  const sightline = new THREE.Ray(game.camera.position, game.camera.getWorldDirection(new THREE.Vector3()));
  assert.equal(sightline.intersectsBox(visitor), false, 'Choi cannot block the shoulder being inspected');
  game.state.currentAction = null; game.step(.1); assert.equal(game.controls.performing, false);
  const start = game.group.position.clone(); game.key('KeyS'); game.step(.3);
  assert.ok(game.group.position.distanceTo(start) > .2, 'finishing the inspection restores walking');
});

test('the apartment wake call frames the bed and the front of Neo at the physical telephone', t => {
  const game = setup(t, APARTMENT.bed.yaw); const center = FILM_SETS.film_anderson_flat.center;
  game.state.currentLocation = 'film_anderson_flat'; game.state.position = filmPosition('film_anderson_flat', APARTMENT.bed.x, APARTMENT.bed.z);
  game.state.rotation = APARTMENT.bed.yaw;
  game.state.currentAction = { type: 'idle', parameters: { wakeCall: { phase: 'waking', elapsed: .5, nightmare: true } }, startedAt: 0, duration: 1, progress: 0 };
  game.controls.possess(game.state); game.step(.5);
  assert.ok(game.camera.position.x > center.x + 13 && game.camera.position.z < center.z - 3.5, 'the opening angle must show Neo across the bed');

  game.state.position = filmPosition('film_anderson_flat', APARTMENT.phone.approachX, APARTMENT.phone.approachZ);
  game.state.rotation = APARTMENT.phone.yaw;
  game.state.currentAction = { type: 'idle', parameters: { wakeCall: { phase: 'decision', elapsed: 1, nightmare: true } }, startedAt: 0, duration: 1, progress: 0 };
  game.controls.possess(game.state); game.step(.5);
  assert.ok(game.camera.position.z < game.state.position.z - 1.5, 'the call shot must see Neo from the front instead of filming the back of his head');
  assert.ok(game.camera.getWorldDirection(new THREE.Vector3()).z > .45);
  const face = new THREE.Vector3(game.state.position.x, game.state.position.y + 3.05, game.state.position.z).project(game.camera);
  assert.ok(Math.abs(face.x) < .7 && Math.abs(face.y) < .75, 'Neo face must remain inside the readable frame');

  game.key('KeyV'); game.key('KeyV', false); game.step(.1);
  assert.ok(game.camera.position.distanceTo(new THREE.Vector3(game.state.position.x, game.state.position.y + 2.99, game.state.position.z)) < .06,
    'first-person call view must start at Neo eyes');
});

test('office conversation and signing frame the performers and restore walking after the response', t => {
  const game = setup(t, -Math.PI / 2); game.state.currentLocation = 'film_metacortex_floor';
  game.state.position = filmPosition('film_metacortex_floor', -17, 27.4); game.controls.possess(game.state);
  game.state.currentAction = { type: 'idle', parameters: { workday: { phase: 'answer', elapsed: 0, role: 'neo' } }, startedAt: 0, duration: 1, progress: 0 };
  game.step(.5); assert.equal(game.controls.performing, true); assert.equal(game.controls.motion.officeShirt, true);
  const center = FILM_SETS.film_metacortex_floor.center;
  assert.ok(game.camera.position.x - center.x < -6.2 && game.camera.position.z - center.z < 32.5, 'the office shot remains inside the glass room');
  const locked = game.group.position.clone(); game.key('KeyW'); game.step(.5); assert.deepEqual(game.group.position, locked);
  game.key('KeyW', false); game.key('KeyV'); game.key('KeyV', false); game.step(.2);
  game.event(game.canvas, 'mousedown', { button: 2 }); game.event(game.document, 'mousemove', { movementX: 80, movementY: 0 }); game.step(.1);
  assert.ok(Math.abs(angle(game.yaw(), -Math.PI / 2)) > .08, 'first-person conversation still allows looking around');
  game.state.currentAction = null; game.step(.1); assert.equal(game.controls.performing, false);
  game.key('KeyD'); game.step(.35); assert.ok(game.group.position.distanceTo(locked) > .2, 'answering gives movement back');
});

test('passenger first-person look follows a car turn while preserving the chosen look offset', t => {
  const game = setup(t, Math.PI); game.state.currentLocation = 'film_extraction_car';
  const pose = (elapsed: number) => {
    const gesture = { phase: 'driving' as const, elapsed, role: 'neo' as const, bugged: false };
    const root = meetingRoot({ ...gesture, approach: { ...MEETING_CAR.approach, yaw: Math.PI } }, 'neo');
    game.state.position = filmPosition('film_extraction_car', root.x, root.z); game.state.rotation = root.yaw;
    game.state.currentAction = { type: 'idle', parameters: { meeting: gesture }, startedAt: 0, duration: 1, progress: 0 };
    return meetingCarPose(gesture).yaw;
  };
  const initial = pose(5); game.controls.possess(game.state); game.step(.1); game.key('KeyV'); game.key('KeyV', false); game.step(.1);
  game.event(game.canvas, 'mousedown', { button: 2 });
  game.event(game.document, 'mousemove', { movementX: 75, movementY: 0 }); game.step(.1);
  const offset = angle(game.yaw(), Math.PI + initial);
  assert.ok(Math.abs(offset) > .05, 'the passenger actually looked away from forward');
  const turned = pose(10); game.step(.5);
  assert.ok(Math.abs(angle(game.yaw(), Math.PI + turned) - offset) < .01, 'the car turn preserves relative free look');
  const dx = game.camera.position.x - game.state.position.x; const dz = game.camera.position.z - game.state.position.z;
  const localX = Math.cos(turned) * dx - Math.sin(turned) * dz;
  const localZ = Math.sin(turned) * dx + Math.cos(turned) * dz;
  assert.ok(localX < -.8 && localX > -1.3, 'the interior view moves toward the gap between the front seats');
  assert.ok(localZ < -.55 && localZ > -1.05, 'the interior view moves forward enough to clear the rear seat back');
  assert.ok(game.camera.position.y > game.state.position.y + 2.7, 'the passenger eye line clears the front seat instead of staring into its back');
});

test('the portrait driving shot keeps the moving car large enough to read', t => {
  const game = setup(t, Math.PI); const gesture = { phase: 'driving' as const, elapsed: 24, role: 'neo' as const, bugged: false };
  const root = meetingRoot({ ...gesture, approach: { ...MEETING_CAR.approach, yaw: Math.PI } }, 'neo');
  game.state.currentLocation = 'film_extraction_car'; game.state.position = filmPosition('film_extraction_car', root.x, root.z); game.state.rotation = root.yaw;
  game.state.currentAction = { type: 'idle', parameters: { meeting: gesture }, startedAt: 0, duration: 1, progress: 0 };
  game.camera.aspect = 426 / 680; game.camera.updateProjectionMatrix(); game.controls.possess(game.state); game.step(.5);
  const car = meetingCarPose(gesture); const center = filmPosition('film_extraction_car', car.x, car.z);
  assert.ok(game.camera.position.distanceTo(new THREE.Vector3(center.x, center.y + 2.1, center.z)) < 20,
    'portrait framing must not reduce the car and four occupants to a distant silhouette');
});

test('Cypher interludes use directed scene cameras while V keeps a freely steerable player view', t => {
  const game = setup(t, Math.PI / 2); const console = filmPosition('film_neb_deck', 3.4, 7.2);
  Object.assign(game.state, { position: console, rotation: Math.PI / 2, isInMatrix: false, currentLocation: 'film_neb_deck',
    currentAction: { type: 'idle', parameters: { seated: false, interlude: { kind: 'console', phase: 'performing', elapsed: 2, role: 'neo' } }, startedAt: 0, duration: 1, progress: 0 } });
  game.controls.possess(game.state); game.step(.5);
  assert.ok(game.camera.position.distanceTo(game.group.position) > 6, 'the console scene uses a readable two-person shot');
  const directed = game.yaw();
  game.key('KeyV'); game.key('KeyV', false); game.step(.1);
  assert.ok(game.camera.position.distanceTo(new THREE.Vector3(console.x, console.y + 3, console.z)) < .06, 'V moves the camera to Neo eyes');
  game.event(game.canvas, 'mousedown', { button: 2 }); game.event(game.document, 'mousemove', { movementX: 90, movementY: 0 }); game.step(.1);
  assert.ok(Math.abs(angle(game.yaw(), directed)) > .08, 'the player view can turn instead of staying fixed forward');
  game.key('KeyV'); game.key('KeyV', false); game.step(.5);
  assert.ok(game.camera.position.distanceTo(game.group.position) > 5, 'V returns to the authored scene angle');

  const seat = filmPosition('film_cypher_restaurant', 0, -8.7);
  Object.assign(game.state, { position: seat, rotation: Math.PI, isInMatrix: true, currentLocation: 'film_cypher_restaurant',
    currentAction: { type: 'idle', parameters: { seated: true, interlude: { kind: 'steak', phase: 'performing', elapsed: 8, role: 'smith' } }, startedAt: 0, duration: 1, progress: 0 } });
  game.controls.possess(game.state); game.step(.5);
  const tablePosition = filmPosition('film_cypher_restaurant', 0, -13);
  const table = new THREE.Vector3(tablePosition.x, tablePosition.y + 2.6, tablePosition.z).project(game.camera);
  assert.ok(Math.abs(table.x) < .8 && Math.abs(table.y) < .8, 'the restaurant reverse angle keeps the physical table in frame');
  game.key('KeyV'); game.key('KeyV', false); game.step(.1);
  assert.ok(game.camera.position.y > tablePosition.y + 2.55, 'the seated Smith view clears the table and chair back');
});

test('the Oracle consultation frames both speakers and V keeps a freely steerable player view', t => {
  const game = setup(t, ORACLE_VISIT.neo.yaw); const center = FILM_SETS.film_oracle_home.center;
  Object.assign(game.state, { position: filmPosition('film_oracle_home', ORACLE_VISIT.neo.x, ORACLE_VISIT.neo.z),
    rotation: ORACLE_VISIT.neo.yaw, currentLocation: 'film_oracle_home',
    currentAction: { type: 'idle', parameters: { oracleVisit: { phase: 'examining', elapsed: 3, role: 'neo' } }, startedAt: 0, duration: 1, progress: 0 } });
  game.controls.possess(game.state); game.step(.5);
  assert.equal(game.controls.performing, true, 'the consultation must lock ordinary movement while the examination plays');
  const neoFace = new THREE.Vector3(center.x + ORACLE_VISIT.neo.x, center.y + 3.03, center.z + ORACLE_VISIT.neo.z).project(game.camera);
  const oracleFace = new THREE.Vector3(center.x + ORACLE_VISIT.oracle.x, center.y + 3.03, center.z + ORACLE_VISIT.oracle.z).project(game.camera);
  for (const face of [neoFace, oracleFace]) assert.ok(Math.abs(face.x) < .88 && Math.abs(face.y) < .82 && face.z > -1 && face.z < 1,
    'the kitchen two-shot must keep both faces readable');
  const locked = game.group.position.clone(); game.key('KeyW'); game.step(.25); game.key('KeyW', false);
  assert.ok(game.group.position.distanceTo(locked) < .01, 'walking cannot pull Neo out of the examination');

  game.key('KeyV'); game.key('KeyV', false); game.step(.1);
  const eye = new THREE.Vector3(game.state.position.x, game.state.position.y + 2.99, game.state.position.z);
  assert.ok(game.camera.position.distanceTo(eye) < .06, 'V places the camera at Neo eyes');
  const initial = game.yaw(); game.event(game.canvas, 'mousedown', { button: 2 });
  game.event(game.document, 'mousemove', { movementX: 85, movementY: 0 }); game.step(.1);
  assert.ok(Math.abs(angle(game.yaw(), initial)) > .08, 'first-person consultation still allows looking around');
  game.state.currentAction = null; game.step(.1); assert.equal(game.controls.performing, false);
});

test('arrival hands back a clear third-person view toward the alley entrance', t => {
  const game = setup(t); game.state.currentLocation = 'film_extraction_car';
  const encounter = { phase: 'outside' as const, elapsed: 0, bugged: false, approach: { ...MEETING_CAR.approach, yaw: Math.PI } };
  const root = meetingRoot(encounter, 'neo');
  game.state.position = filmPosition('film_extraction_car', root.x, root.z); game.state.rotation = root.yaw;
  game.controls.possess(game.state); game.step(.5);
  assert.ok(game.camera.position.distanceTo(game.group.position) > 6, 'the parked car must not squeeze the camera against Neo');
  const doorway = filmPosition('film_extraction_car', 640, 29);
  const targetYaw = Math.atan2(doorway.x - game.state.position.x, doorway.z - game.state.position.z);
  assert.ok(Math.abs(angle(game.yaw(), targetYaw)) < .2, 'the entrance is ahead when control returns');
});

test('crossing a window synchronizes the exit heading and does not fall back to the phone camera between updates', t => {
  const game = setup(t, -Math.PI / 2);
  game.state.position = filmPosition('film_metacortex_floor', -25.25, -27.65); game.state.currentLocation = 'film_metacortex_floor';
  game.controls.possess(game.state); game.controls.performing = true; game.controls.phone = { phase: 'connected', elapsed: 11 };
  for (let frame = 0; frame < 64; frame++) {
    const elapsed = frame / 10; const pose = officeCrossingPose(elapsed);
    game.state.position = { ...filmPosition('film_metacortex_floor', pose.x, pose.z), y: 1 + pose.y }; game.state.rotation = pose.yaw;
    game.state.currentAction = { type: 'idle', parameters: { crossing: elapsed }, startedAt: 0, duration: 1, progress: 0 };
    game.step(.1);
    assert.ok(Math.abs(angle(game.sent.at(-1)!.yaw, pose.yaw)) < .001, 'stale pre-crossing aim must not overwrite the exit orientation');
  }
  game.state.currentLocation = 'film_office_ledge'; game.state.position = filmPosition('film_office_ledge', 0, -27); game.state.rotation = 0; game.state.currentAction = null;
  // Actor updates arrive more frequently than the journey snapshot.
  game.step(.1); assert.equal(game.controls.performing, false);
  game.step(.5);
  assert.ok(Math.abs(angle(game.yaw(), 0)) < .1);
  assert.ok(game.camera.position.distanceTo(game.group.position) < 14, 'the camera stays on the ledge, not at the parcel');
});

test('motorcycle throttle and steering are independent of the view, and opening a panel brakes', t => {
  const game = setup(t, Math.PI); game.controls.ride = newFreewayRide();
  game.key('KeyW'); game.key('KeyD'); game.step(.2);
  assert.deepEqual(game.sent.at(-1)!.drive, { throttle: 1, steer: 1, brake: false });
  game.key('KeyV'); game.document.pointerLockElement = game.canvas;
  game.event(game.document, 'mousemove', { movementX: 450, movementY: 0 }); game.step(.2);
  assert.deepEqual(game.sent.at(-1)!.drive, { throttle: 1, steer: 1, brake: false });
  assert.equal(game.controls.motion.riding, true); assert.equal(game.controls.motion.speed, 0, 'the rider must not run on the saddle');
  game.controls.setEnabled(false); game.step(.1);
  assert.deepEqual(game.sent.at(-1)!.drive, { throttle: 0, steer: 0, brake: true });
});

test('spoon focus is a held input and is released when a panel opens or the window loses focus', t => {
  const game = setup(t);
  game.key('KeyG'); game.step(.2); assert.equal(game.sent.at(-1)!.focus, true);
  game.key('KeyG', false); game.step(.1); assert.equal(game.sent.at(-1)!.focus, false);
  game.key('KeyG'); game.controls.setEnabled(false); game.step(.1); assert.equal(game.sent.at(-1)!.focus, false);
  game.controls.setEnabled(true); game.key('KeyG'); game.event(game.window, 'blur'); game.step(.1);
  assert.equal(game.sent.at(-1)!.focus, false);
});

test('the guided dojo attack turns toward a nearby sparring partner behind the current camera', t => {
  const game = setup(t);
  game.controls.targets = [{ x: game.state.position.x, y: game.state.position.y, z: game.state.position.z - 2 }];
  assert.equal(game.controls.triggerCombat('attack', true), true);
  assert.ok(Math.abs(angle(game.sent.at(-1)!.yaw, Math.PI)) < .01);
  game.step(1.6);
  assert.equal(game.controls.triggerCombat('attack', true), true);
  assert.equal(game.controls.motion.combo, 1, 'the readable dojo timing keeps the second guided strike as a straight punch');
  game.step(3.2);
  assert.equal(game.controls.triggerCombat('attack', true, 2), true);
  assert.equal(game.controls.motion.combo, 2, 'a saved lesson stage restores the correct kick animation after reconnecting');
  assert.deepEqual(game.actions, ['attack', 'attack', 'attack']);
});

test('the pod descent camera stays outside the drain instead of collapsing against an obsolete floor', t => {
  const game = setup(t, Math.PI); const position = filmPosition('film_power_plant_pods', 0, 2); position.y -= 9;
  Object.assign(game.state, { position, isInMatrix: false, currentLocation: 'film_power_plant_pods' });
  game.controls.possess(game.state); game.controls.performing = true; game.step(.5);
  assert.ok(game.camera.position.z > position.z + 8, 'the authored descent needs a clear follow distance below the tank floor');
  assert.ok(game.camera.position.y > position.y + 4);
  game.key('KeyW'); game.key('Space'); game.key('KeyF'); game.step(.5);
  assert.deepEqual(game.group.position.toArray(), [position.x, position.y, position.z]);
  assert.equal(game.actions.length, 0);
});

test('the recovery camera frames the medical bed and first person moves to Neo eyes instead of standing height', t => {
  const game = setup(t, Math.PI); const position = filmPosition('film_neb_deck', -7, -22);
  Object.assign(game.state, { position, isInMatrix: false, currentLocation: 'film_neb_deck',
    currentAction: { type: 'idle', parameters: { filmPose: 'recover', recovery: 0 }, startedAt: 0, duration: 1, progress: 0 } });
  game.controls.possess(game.state); game.controls.performing = true; game.step(.5);
  assert.ok(game.camera.position.x > position.x + 2.5 && game.camera.position.x < position.x + 3.5, 'the third-person shot clears the needle rack at a readable angle');
  assert.ok(game.camera.position.y > position.y + 3.5);
  assert.ok(game.camera.position.z > position.z + 5, 'the opening shot looks diagonally across Neo instead of through the gantry support');
  game.key('KeyV'); game.key('KeyV', false); game.step(.1);
  assert.ok(Math.abs(game.camera.position.y - position.y - 1.7) < .05, 'lying first-person camera sits at Neo actual eye height');
  assert.ok(Math.abs(game.camera.position.z - position.z - 1.78) < .05, 'lying eyes sit at the actual head end of the bed after actor rotation');
  assert.ok(game.camera.getWorldDirection(new THREE.Vector3()).y > .8, 'lying first person looks up at the needle gantry instead of into the mattress');
  game.key('KeyW'); game.key('Space'); game.key('KeyF'); game.step(.3);
  assert.deepEqual(game.group.position.toArray(), [position.x, position.y, position.z]);
  assert.equal(game.actions.length, 0);
});

test('the Construct and desert reveals use authored wide shots while first person remains at Neo eyes', t => {
  const game = setup(t, Math.PI); const construct = filmPosition('film_white_construct', 4.4, -6.2);
  Object.assign(game.state, { position: construct, rotation: Math.PI, isInMatrix: true, currentLocation: 'film_white_construct',
    currentAction: { type: 'idle', parameters: { filmPose: 'construct', seated: true, reveal: { kind: 'construct', elapsed: 0, role: 'neo' } }, startedAt: 0, duration: 1, progress: 0 } });
  game.controls.possess(game.state); game.controls.performing = true; game.step(.5);
  const constructCenter = FILM_SETS.film_white_construct.center;
  assert.ok(game.camera.position.x > constructCenter.x + 10, 'the waiting two-shot starts beside the chairs instead of hiding both actors behind their backs');
  assert.ok(Math.abs(game.camera.getWorldDirection(new THREE.Vector3()).z) < .25, 'the waiting shot sees both seated profiles instead of looking into the chair backs');
  assert.ok(game.camera.position.z < constructCenter.z - 8 && game.camera.position.z > constructCenter.z - 12, 'the side angle keeps the television and seated actors in the same shot');
  game.key('KeyV'); game.key('KeyV', false); game.step(.1);
  assert.ok(Math.abs(game.camera.position.y - construct.y - 2.35) < .05, 'seated first person uses Neo eye height');
  assert.ok(game.camera.getWorldDirection(new THREE.Vector3()).z < -.8, 'Neo initially faces the television');
  game.key('KeyW'); game.key('Space'); game.key('KeyF'); game.step(.3);
  assert.deepEqual(game.group.position.toArray(), [construct.x, construct.y, construct.z]); assert.equal(game.actions.length, 0);

  const desert = filmPosition('film_real_desert', 1.8, -28); Object.assign(game.state, { position: desert, rotation: Math.PI, isInMatrix: false, currentLocation: 'film_real_desert',
    currentAction: { type: 'idle', parameters: { filmPose: 'desert', reveal: { kind: 'desert', elapsed: 6, role: 'neo' } }, startedAt: 0, duration: 1, progress: 0 } });
  game.controls.firstPerson = false; game.controls.performing = true; game.controls.possess(game.state); game.step(.5);
  const desertCenter = FILM_SETS.film_real_desert.center;
  assert.ok(game.camera.position.x > desertCenter.x + 8 && game.camera.position.y > desertCenter.y + 5, 'the ruined skyline starts in a readable wide shot');
  assert.ok(game.camera.getWorldDirection(new THREE.Vector3()).z < -.7, 'the wide shot looks toward the harvesting towers');
});

for (const view of ['third-person', 'first-person']) for (const [key, heading] of [['KeyD', -Math.PI / 2], ['KeyA', Math.PI / 2], ['KeyS', Math.PI]] as const) {
  test(`${view} camera follows ${key} without steering a held direction into circles`, t => {
    const game = setup(t); if (view === 'first-person') game.key('KeyV'); game.key(key);
    game.step(.1);
    assert.ok(Math.abs(angle(game.yaw(), 0)) < Math.abs(heading) / 4, 'camera turns smoothly instead of snapping');
    game.step(1.9);
    assert.ok(Math.abs(angle(game.yaw(), heading)) < .08, 'camera aligns with the movement direction');
    for (const input of game.sent.filter(input => Math.hypot(input.x, input.z) > .1)) {
      assert.ok(Math.abs(angle(Math.atan2(input.x, input.z), heading)) < .001, 'automatic camera movement must not change the movement sent to the server');
    }
    game.key(key, true, true); game.step(.5);
    assert.ok(Math.abs(angle(game.yaw(), heading)) < .08, 'key repeat does not rebase movement');
    game.key(key, false); game.step(.5);
    game.key('KeyW'); game.step(.5);
    const input = game.sent.at(-1)!;
    assert.ok(Math.abs(angle(Math.atan2(input.x, input.z), heading)) < .08, 'the next movement starts relative to the new view');
  });
}

for (const view of ['third-person', 'first-person']) for (const dt of [1 / 30, 1 / 60]) {
  test(`${view} diagonal follow crosses the angle seam by the short route at ${Math.round(1 / dt)} fps`, t => {
    const game = setup(t, Math.PI - .1); if (view === 'first-person') game.key('KeyV'); game.key('KeyW'); game.key('KeyA');
    const heading = Math.PI - .1 + Math.PI / 4;
    let previous = game.yaw(); let totalTurn = 0;
    for (let i = 0; i < 2 / dt; i++) {
      game.step(dt, dt); const next = game.yaw(); totalTurn += Math.abs(angle(next, previous)); previous = next;
    }
    assert.ok(Math.abs(angle(game.yaw(), heading)) < .08);
    assert.ok(totalTurn < 1.1, 'no full spin at the -PI/PI boundary');
  });
}

for (const view of ['third-person', 'first-person']) test(`${view} manual look has priority, then follow resumes while walking and leaves an idle view alone`, t => {
  const game = setup(t); if (view === 'first-person') game.key('KeyV'); game.key('KeyD'); game.step(1);
  game.event(game.canvas, 'mousedown', { button: 2 });
  const beforeLook = game.yaw();
  game.event(game.document, 'mousemove', { movementX: 180, movementY: 0 });
  game.step(1.5);
  assert.ok(Math.abs(angle(game.yaw(), beforeLook - 180 * .0028)) < .08, 'holding right mouse prevents auto-centering');
  game.event(game.window, 'mouseup'); game.step(.5);
  assert.ok(Math.abs(angle(game.yaw(), beforeLook - 180 * .0028)) < .08, 'release leaves time to finish looking around');
  game.step(1);
  assert.ok(Math.abs(angle(game.yaw(), -Math.PI / 2)) < .08, 'follow resumes after releasing the view');
  game.key('KeyD', false); game.step(.5);
  game.document.pointerLockElement = game.canvas;
  game.event(game.document, 'mousemove', { movementX: -150, movementY: 0 });
  game.step(.5); const idleView = game.yaw(); game.step(2);
  assert.ok(Math.abs(angle(game.yaw(), idleView)) < .01, 'standing still preserves free look');
});

test('V switches perspective mid-turn without redirecting a held movement key', t => {
  const game = setup(t); game.key('KeyD'); game.step(.2);
  game.key('KeyV'); game.step(1.8);
  assert.ok(Math.abs(angle(game.yaw(), -Math.PI / 2)) < .08, 'first-person continues the same turn');
  game.key('KeyV'); game.step(2);
  assert.ok(Math.abs(angle(game.yaw(), -Math.PI / 2)) < .08, 'third-person retains the heading');
  for (const input of game.sent.filter(input => Math.hypot(input.x, input.z) > .1)) {
    assert.ok(Math.abs(angle(Math.atan2(input.x, input.z), -Math.PI / 2)) < .001, 'V must not change the path');
  }
});

for (const firstPerson of [false, true]) test(`film scene entry aligns the ${firstPerson ? 'first' : 'third'}-person view with the new entrance`, t => {
  const game = setup(t, .7); if (firstPerson) game.key('KeyV');
  const next = { ...game.state, position: { x: 4416, y: 1, z: 4110 }, rotation: Math.PI, currentLocation: 'film_hotel_roofs' };
  game.controls.update(1 / 60, next, game.group, true);
  assert.ok(Math.abs(angle(game.yaw(), Math.PI)) < .01);
  assert.equal(game.controls.firstPerson, firstPerson);
});

test('first-person mouse steering turns the view and movement together after keyboard follow', t => {
  const game = setup(t); game.key('KeyV'); game.key('KeyD'); game.step(2);
  const beforeLook = game.yaw();
  game.document.pointerLockElement = game.canvas;
  game.event(game.document, 'mousemove', { movementX: 100, movementY: 0 }); game.step(.5);
  assert.ok(Math.abs(angle(game.yaw(), beforeLook - .28)) < .001, 'mouse look has immediate priority');
  const input = game.sent.at(-1)!;
  assert.ok(Math.abs(angle(Math.atan2(input.x, input.z), -.28 - Math.PI / 2)) < .001, 'only the manual turn redirects movement');
  game.step(2);
  assert.ok(Math.abs(angle(game.yaw(), -.28 - Math.PI / 2)) < .08);
});

test('a late attack press buffers one follow-up, while pauses cannot queue attacks or jumps', t => {
  const game = setup(t);
  game.key('KeyF'); game.step(.25); game.key('KeyF');
  assert.deepEqual(game.actions, ['attack']);
  game.step(.2); assert.deepEqual(game.actions, ['attack', 'attack']);
  assert.equal(game.controls.motion.combo, 1);
  game.step(.6); assert.equal(game.actions.length, 2, 'one press cannot loop attacks');
  game.step(.1, 1 / 60, false); game.key('KeyF'); game.key('Space');
  game.step(.1, 1 / 60, false); game.step(.3);
  assert.equal(game.actions.length, 2); assert.equal(game.group.position.y, 1);
});

test('awakening and speed abilities do not turn an ordinary space press into a super jump', t => {
  const game = setup(t); game.state.isAwakened = true;
  game.state.activeEffects = [{ abilityId: 'test-speed', visualEffect: 'speed_blur', remainingTicks: 10 }];
  game.key('Space'); let peak = 1;
  for (let i = 0; i < 60; i++) { game.step(1 / 60); peak = Math.max(peak, game.group.position.y); }
  assert.ok(peak > 2.3 && peak < 2.9); assert.equal(game.group.position.y, 1);
});

test('the bathroom sacrifice owns a readable two-shot and still supports Morpheus first person', t => {
  const game = setup(t, Math.PI); const center = FILM_SETS.film_ambush_house.center;
  game.state.currentLocation = 'film_ambush_house'; game.state.position = filmPosition('film_ambush_house', 0, 0); game.state.rotation = Math.PI;
  game.state.currentAction = { type: 'idle', parameters: { betrayal: { kind: 'bathroom', phase: 'sacrifice', elapsed: 1.2, attempt: 0, role: 'morpheus' } }, startedAt: 0, duration: 1, progress: 0 };
  game.controls.possess(game.state); game.step(.4);
  assert.equal(game.controls.performing, true); assert.ok(game.camera.position.x > center.x + 7, 'the wide shot keeps Morpheus and Smith on the same axis');
  const locked = game.group.position.clone(); game.key('KeyW'); game.step(.25); game.key('KeyW', false); assert.deepEqual(game.group.position, locked);
  game.key('KeyV'); game.key('KeyV', false); game.step(.1);
  assert.ok(game.camera.position.distanceTo(new THREE.Vector3(game.state.position.x, game.state.position.y + 2.99, game.state.position.z)) < .06);
});

test('Tank sees the short Cypher counter window from the deck and from his saved prone viewpoint', t => {
  const game = setup(t); const center = FILM_SETS.film_neb_deck.center;
  game.state.currentLocation = 'film_neb_deck'; game.state.position = filmPosition('film_neb_deck', -7, -14);
  game.state.currentAction = { type: 'idle', parameters: { betrayal: { kind: 'unplugged', phase: 'window', elapsed: .4, attempt: 0, role: 'tank' } }, startedAt: 0, duration: 1, progress: 0 };
  game.controls.possess(game.state); game.step(.4);
  assert.ok(game.camera.position.x < center.x - 8 && game.camera.position.z < center.z - 13, 'the counter angle sees Tank, the rifle and Cypher');
  game.key('KeyV'); game.key('KeyV', false); game.step(.1);
  assert.ok(Math.abs(game.camera.position.y - (game.state.position.y + 1.35)) < .06, 'Tank first person stays at his prone eye height');
  game.key('KeyV'); game.key('KeyV', false);
  game.state.currentAction = { type: 'idle', parameters: { betrayal: { kind: 'unplugged', phase: 'reconnect', elapsed: 0, attempt: 0, rescued: 1, role: 'tank' } }, startedAt: 0, duration: 1, progress: 0 };
  game.step(.5);
  assert.ok(Math.abs(game.camera.position.x - center.x) < 3 && game.camera.position.z < center.z - 16,
    'the reconnect overview looks down the open center aisle instead of sitting behind a console');
  for (const chair of [new THREE.Vector3(center.x + 6.5, center.y + 2.7, center.z - 5), new THREE.Vector3(center.x - 6.5, center.y + 2.7, center.z + 6)]) {
    const screen = chair.project(game.camera); assert.ok(Math.abs(screen.x) < .92 && Math.abs(screen.y) < .92, 'both surviving chairs remain readable');
  }
  game.state.currentAction = null; game.step(.1); assert.equal(game.controls.performing, false);
});

test('the rescue briefing, arriving racks and selected weapon each own a readable camera while V remains playable', t => {
  const game = setup(t); const deck = FILM_SETS.film_neb_deck.center;
  game.state.currentLocation = 'film_neb_deck';
  game.state.position = filmPosition('film_neb_deck', RESCUE.briefingRoots.neo.x, RESCUE.briefingRoots.neo.z);
  game.state.rotation = RESCUE.briefingRoots.neo.yaw;
  game.state.currentAction = { type: 'idle', parameters: { rescue: { phase: 'briefing', elapsed: 2.2, role: 'neo' } }, startedAt: 0, duration: 1, progress: 0 };
  game.controls.possess(game.state); game.step(.4);
  assert.equal(game.controls.performing, true); assert.ok(game.camera.position.x < deck.x - 9 && game.camera.position.z > deck.z + 6,
    'the briefing opens wide enough to read Neo, both partners and the central projection');
  const locked = game.group.position.clone(); game.key('KeyW'); game.step(.25); game.key('KeyW', false); assert.deepEqual(game.group.position, locked);
  game.key('KeyV'); game.key('KeyV', false); game.step(.1);
  assert.ok(game.camera.position.distanceTo(new THREE.Vector3(game.state.position.x, game.state.position.y + 2.99, game.state.position.z)) < .06);

  game.key('KeyV'); game.key('KeyV', false); const construct = FILM_SETS.film_white_construct.center;
  game.state.currentLocation = 'film_white_construct'; game.state.position = filmPosition('film_white_construct', 0, -10.3);
  game.state.currentAction = { type: 'idle', parameters: { rescue: { phase: 'racks_arriving', elapsed: 3.4, role: 'neo' } }, startedAt: 0, duration: 1, progress: 0 };
  game.controls.possess(game.state); game.step(.4);
  assert.ok(game.camera.position.y > construct.y + 3.5 && game.camera.position.z > construct.z,
    'the rack arrival uses an elevated long-axis view instead of clipping into the props');

  const choice = RESCUE.loadoutRoots.compact;
  game.state.position = filmPosition('film_white_construct', choice.x, choice.z + 1.7);
  game.state.currentAction = { type: 'idle', parameters: { weaponStyle: 'compact', armed: true,
    rescue: { phase: 'equipping', elapsed: 3.2, loadout: 'compact', role: 'neo' } }, startedAt: 0, duration: 1, progress: 0 };
  game.controls.possess(game.state); game.step(.4);
  const weapon = new THREE.Vector3(construct.x + choice.x, construct.y + 1.65, construct.z + choice.z + .4).project(game.camera);
  assert.ok(Math.abs(weapon.x) < .72 && Math.abs(weapon.y) < .72, 'the chosen physical weapon stays in the equip frame');
  game.key('KeyV'); game.key('KeyV', false); game.step(.1);
  assert.ok(game.camera.position.distanceTo(new THREE.Vector3(game.state.position.x, game.state.position.y + 2.99, game.state.position.z)) < .06);
});

for (const firstPerson of [false, true]) test(`armed ${firstPerson ? 'first' : 'third'}-person movement strafes without pulling the aim away`, t => {
  const game = setup(t); game.controls.firearm = true; if (firstPerson) game.key('KeyV');
  game.key('KeyD'); game.step(2);
  assert.ok(game.sent.filter(input => input.x < -.1).every(input => Math.abs(input.yaw) < .01));
  game.key('KeyD', false); game.step(.5); // Let the following camera settle at the stopped position.
  assert.ok(Math.abs(game.yaw()) < .01);
  assert.ok(Math.abs(game.group.children[0].rotation.y) < .01);
  game.key('KeyT'); game.step(1); game.key('KeyT', false);
  const shots = game.actions.filter(action => action === 'shoot').length;
  assert.ok(shots >= 4 && shots <= 5);
  game.step(1); assert.equal(game.actions.filter(action => action === 'shoot').length, shots);
  game.key('KeyR'); assert.equal(game.actions.at(-1), 'reload');
  game.controls.setEnabled(false); game.key('KeyT'); game.step(.5);
  assert.equal(game.actions.filter(action => action === 'shoot').length, shots);
});


test('the pill camera supports seated first person and releases movement when the actor finishes before the journey snapshot', t => {
  const game = setup(t, Math.PI);
  game.state.currentLocation = 'film_lafayette'; game.state.position = filmPosition('film_lafayette', 0, -3.3);
  game.controls.possess(game.state);
  const draw = (elapsed: number) => {
    const gesture = { phase: 'taking' as const, elapsed, choice: 'red' as const, role: 'neo' as const };
    const root = pillRoot({ ...gesture, approach: { x: 0, z: -3.3, yaw: Math.PI } });
    game.state.position = filmPosition('film_lafayette', root.x, root.z); game.state.rotation = root.yaw;
    game.state.currentAction = { type: 'idle', parameters: { pills: gesture }, startedAt: 0, duration: 1, progress: 0 }; game.step(.15);
  };
  draw(0); game.key('KeyV'); game.key('KeyV', false); draw(1);
  assert.equal(game.controls.firstPerson, true); assert.ok(Math.abs(angle(game.yaw(), -Math.PI / 2)) < .02);
  assert.ok(Math.abs(game.camera.position.y - game.group.position.y - 2.09) < .02, 'first-person eyes sit at the seated height');
  game.key('KeyV'); game.key('KeyV', false); draw(13);
  game.state.currentAction = null; game.step(.1); assert.equal(game.controls.performing, false);
  assert.equal(game.controls.motion.pills, undefined);
  game.key('KeyW'); game.step(.5); game.key('KeyW', false);
  assert.ok(game.group.position.z > game.state.position.z + .4, 'ordinary movement must resume clear of the chair');
});

const oneEncounter = (kind: TheOneEncounter['kind'], phase: TheOneEncounter['phase'], elapsed: number): TheOneEncounter => ({
  kind, phase, elapsed, attempt: 0, checkpoint: kind === 'death' ? 'door' : kind === 'return' ? 'bullets' : 'phone',
  signal: 0, hits: 0, blocks: 0, deadline: 0, altitude: kind === 'flight' ? 18 : 0, flightX: 2, flightZ: -1, resolved: [],
});

test('room 303 gunfire frames Neo and Smith while V follows Neo toward the shooter', t => {
  const game = setup(t, Math.PI); const center = FILM_SETS.film_heart_hotel.center; const encounter = oneEncounter('death', 'gunfire', 1.15);
  const neo = theOneRoot(encounter, 'neo'); const smith = theOneRoot(encounter, 'smith'); game.state.currentLocation = neo.set;
  game.state.position = { ...filmPosition(neo.set, neo.x, neo.z), y: center.y + neo.y }; game.state.rotation = neo.yaw;
  game.state.currentAction = { type: 'idle', parameters: { theOne: { ...encounter, role: 'neo' } }, startedAt: 0, duration: 1, progress: 0 };
  game.controls.possess(game.state); game.step(.4); assert.equal(game.controls.performing, true);
  assert.ok(Math.abs(game.camera.position.x - center.x) < 6.35, '303 camera must stay inside the corridor walls');
  for (const root of [neo, smith]) {
    const screen = new THREE.Vector3(center.x + root.x, center.y + root.y + 2.1, center.z + root.z).project(game.camera);
    assert.ok(Math.abs(screen.x) < .82 && Math.abs(screen.y) < .86 && screen.z > -1 && screen.z < 1, `303 gunfire crop: ${screen.toArray().join(',')}`);
  }
  game.key('KeyV'); game.key('KeyV', false); game.step(.1);
  const target = new THREE.Vector3(center.x + smith.x, center.y + smith.y + 2.2, center.z + smith.z);
  assert.ok(game.camera.getWorldDirection(new THREE.Vector3()).dot(target.clone().sub(game.camera.position).normalize()) > .88);
});

test('Trinity revival and the EMP each keep the ship crew readable', t => {
  const game = setup(t); const center = FILM_SETS.film_neb_deck.center;
  const apply = (encounter: TheOneEncounter) => {
    const neo = theOneRoot(encounter, 'neo'); game.state.currentLocation = neo.set;
    game.state.position = { ...filmPosition(neo.set, neo.x, neo.z), y: center.y + neo.y }; game.state.rotation = neo.yaw;
    game.state.currentAction = { type: 'idle', parameters: { theOne: { ...encounter, role: 'neo' } }, startedAt: 0, duration: 1, progress: 0 };
    game.controls.possess(game.state); game.step(.4);
  };
  const kiss = oneEncounter('death', 'kiss', 1.45); apply(kiss);
  for (const role of ['neo', 'trinity'] as const) {
    const root = theOneRoot(kiss, role); const screen = new THREE.Vector3(center.x + root.x, center.y + root.y + 1.8, center.z + root.z).project(game.camera);
    assert.ok(Math.abs(screen.x) < .75 && Math.abs(screen.y) < .82 && screen.z > -1 && screen.z < 1, `${role} missing from revival`);
  }
  const emp = oneEncounter('return', 'emp', 1.55); emp.empFired = true; apply(emp);
  assert.ok(Math.abs(game.camera.position.x - center.x) < 8 && game.camera.position.z - center.z > 8,
    'EMP camera must use the open center aisle instead of looking through the operator CRTs');
  for (const role of ['neo', 'trinity', 'morpheus', 'tank'] as const) {
    const root = theOneRoot(emp, role); const screen = new THREE.Vector3(center.x + root.x, center.y + root.y + 2, center.z + root.z).project(game.camera);
    assert.ok(Math.abs(screen.x) < .9 && Math.abs(screen.y) < .9 && screen.z > -1 && screen.z < 1, `${role} missing from EMP`);
  }
});

test('stopped bullets and Smith destruction hold every body in the hotel composition', t => {
  const game = setup(t); const center = FILM_SETS.film_heart_hotel.center;
  const apply = (phase: 'bullet_stop' | 'dive' | 'burst', elapsed: number) => {
    const encounter = oneEncounter('return', phase, elapsed); const neo = theOneRoot(encounter, 'neo'); game.state.currentLocation = neo.set;
    game.state.position = { ...filmPosition(neo.set, neo.x, neo.z), y: center.y + neo.y }; game.state.rotation = neo.yaw;
    game.state.currentAction = { type: 'idle', parameters: { theOne: { ...encounter, role: 'neo' } }, startedAt: 0, duration: 1, progress: 0 };
    game.controls.possess(game.state); game.step(.4);
    assert.ok(Math.abs(game.camera.position.x - center.x) < 6.35, `${phase} camera must stay inside the corridor walls`);
    return encounter;
  };
  const stopped = apply('bullet_stop', 1.2);
  for (const role of ['neo', 'smith', 'agent_brown', 'agent_jones'] as const) {
    const root = theOneRoot(stopped, role); const screen = new THREE.Vector3(center.x + root.x, center.y + root.y + 2.1, center.z + root.z).project(game.camera);
    assert.ok(Math.abs(screen.x) < .9 && Math.abs(screen.y) < .9 && screen.z > -1 && screen.z < 1, `${role} missing from stopped volley`);
  }
  for (const phase of ['dive', 'burst'] as const) {
    const encounter = apply(phase, 1.15); const neo = theOneRoot(encounter, 'neo'); const smith = theOneRoot(encounter, 'smith');
    for (const root of [neo, smith]) {
      const screen = new THREE.Vector3(center.x + root.x, center.y + root.y + 2, center.z + root.z).project(game.camera);
      assert.ok(Math.abs(screen.x) < .88 && Math.abs(screen.y) < .88 && screen.z > -1 && screen.z < 1, `${phase} crop`);
    }
  }
});

test('the final takeoff camera follows Neo above the skyline and V enters the airborne eye line', t => {
  const game = setup(t); const center = FILM_SETS.film_final_phone.center; const encounter = oneEncounter('flight', 'takeoff', 4.3);
  encounter.altitude = 22; encounter.flightX = 5; encounter.flightZ = -2; const neo = theOneRoot(encounter, 'neo'); game.state.currentLocation = neo.set;
  game.state.position = { ...filmPosition(neo.set, neo.x, neo.z), y: center.y + neo.y }; game.state.rotation = neo.yaw;
  game.state.currentAction = { type: 'idle', parameters: { theOne: { ...encounter, role: 'neo' } }, startedAt: 0, duration: 1, progress: 0 };
  game.controls.possess(game.state); game.step(.4); assert.ok(game.camera.position.y > center.y + 20);
  const screen = new THREE.Vector3(game.state.position.x, game.state.position.y + 2, game.state.position.z).project(game.camera);
  assert.ok(Math.abs(screen.x) < .6 && Math.abs(screen.y) < .65 && screen.z > -1 && screen.z < 1);
  game.key('KeyV'); game.key('KeyV', false); game.step(.1);
  assert.ok(game.camera.position.distanceTo(new THREE.Vector3(game.state.position.x, game.state.position.y + 2.35, game.state.position.z)) < .1);
  assert.ok(game.camera.getWorldDirection(new THREE.Vector3()).z < -.7);
});

for (const phase of ['counter', 'exit_run'] as const) test(`the One ${phase} phase keeps V turning and locomotion live`, t => {
  const game = setup(t); const encounter = oneEncounter('return', phase, 0); const neo = theOneRoot(encounter, 'neo');
  game.state.currentLocation = neo.set; game.state.position = filmPosition(neo.set, 0, phase === 'counter' ? -9.5 : 8); game.state.rotation = Math.PI;
  game.state.currentAction = { type: 'idle', parameters: { theOne: { ...encounter, role: 'neo' } }, startedAt: 0, duration: 1, progress: 0 };
  game.controls.possess(game.state); game.key('KeyV'); game.key('KeyV', false); game.document.pointerLockElement = game.canvas;
  game.event(game.document, 'mousemove', { movementX: 560, movementY: 0 }); game.step(.2);
  assert.equal(game.controls.performing, false); assert.ok(Math.abs(angle(game.yaw(), Math.PI / 2)) < .08);
  game.key('KeyW'); game.step(.45); game.key('KeyW', false); assert.ok(game.group.position.x > game.state.position.x + .6);
});
