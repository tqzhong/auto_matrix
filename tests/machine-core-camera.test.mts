import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DEUS_PACT, FILM_SETS, newDeusPact, neoCarryPose, newTrilogyEpilogue, type DeusPactEncounter } from '@auto_matrix/shared';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { MachineCoreRenderer } from '../packages/client/src/engine/MachineCoreRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';

function setup(t: TestContext) {
  class Target extends EventTarget { matches() { return false; } }
  const window = new Target(), canvas = new Target();
  const context = { createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }),
    putImageData() {}, fillRect() {}, strokeRect() {}, fillText() {}, createRadialGradient: () => ({ addColorStop() {} }) };
  const document = Object.assign(new Target(), { pointerLockElement: canvas, hidden: false, exitPointerLock() {},
    createElement: () => ({ width: 0, height: 0, getContext: () => context }) });
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key)); Object.assign(globalThis, { window, document });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const actor = world.agents.get('neo')!, center = FILM_SETS.film_machine_core.center;
  actor.currentLocation = 'film_machine_core'; actor.isInMatrix = false;
  actor.position = { x: center.x + 1.2, y: center.y, z: center.z - 20 }; actor.rotation = .4;
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000), group = new THREE.Group(); group.add(new THREE.Group());
  const controls = new PlayerControls(canvas as unknown as HTMLCanvasElement, camera, () => {}, () => {}); controls.possess(actor);
  const frame = (beat: DeusPactEncounter) => {
    actor.position = { x: center.x + DEUS_PACT.platform.x, y: center.y, z: center.z + DEUS_PACT.platform.z }; actor.rotation = DEUS_PACT.platform.yaw;
    actor.currentAction = { type: 'idle', parameters: { deusPact: { ...beat, role: 'neo' } }, startedAt: 0, duration: 1, progress: 0 };
    controls.update(.02, actor, group, false); camera.updateMatrixWorld();
  };
  const key = (code: string, down = true) => window.dispatchEvent(Object.assign(new Event(down ? 'keydown' : 'keyup'), { code, repeat: false }));
  const look = (movementX = 150, movementY = -40) => document.dispatchEvent(Object.assign(new Event('mousemove'), { movementX, movementY }));
  t.after(() => { controls.dispose(); ['window', 'document'].forEach((key, i) => {
    if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!); else Reflect.deleteProperty(globalThis, key);
  }); });
  return { actor, controls, group, camera, frame, key, look, center };
}
const beats: DeusPactEncounter[] = [
  { ...newDeusPact(), phase: 'cabling', elapsed: 1.4, total: 10.8, resolve: 3 },
  { ...newDeusPact(), phase: 'warning', elapsed: 1.2, total: 6.3, resolve: 3 },
  { ...newDeusPact(), phase: 'seating', elapsed: 1.1, total: 9.3, resolve: 3 },
  { ...newDeusPact(), phase: 'consent', elapsed: 1.1, total: 13.3, resolve: 3, consent: .7 },
];

test('the first paused machine-core frame restores exact saved roots, yaw and camera without frame-rate settling', t => {
  const h = setup(t);
  for (const firstPerson of [false, true]) {
    h.controls.firstPerson = firstPerson;
    for (const beat of [...beats, ...beats.toReversed()]) {
      h.frame(beat);
      assert.ok(h.group.position.distanceTo(new THREE.Vector3(h.actor.position.x, h.actor.position.y, h.actor.position.z)) < .00001, 'the saved root cannot drift toward the stopped platform');
      assert.ok(Math.abs(h.group.children[0].rotation.y - h.actor.rotation) < .00001, 'the performed body must immediately face its saved heading');
      const before = { position: h.camera.position.clone(), rotation: h.camera.quaternion.clone(), fov: h.camera.fov };
      h.frame(beat);
      assert.ok(h.camera.position.distanceTo(before.position) < .00001, 'paused camera position must not creep');
      assert.ok(h.camera.quaternion.angleTo(before.rotation) < .00001, 'paused camera aim must not creep');
      assert.equal(h.camera.fov, before.fov, 'paused FOV must not keep zooming');
    }
  }
  h.controls.firstPerson = false;
  for (const [before, after] of [
    [{ phase: 'pact', elapsed: 0 }, { phase: 'seating', elapsed: .0001 }],
    [{ phase: 'seating', elapsed: DEUS_PACT.seconds.seating - .0001 }, { phase: 'cabling', elapsed: 0 }],
    [{ phase: 'cabling', elapsed: DEUS_PACT.seconds.cabling }, { phase: 'consent', elapsed: 0 }],
  ] as const) {
    h.frame({ ...newDeusPact(), ...before }); const position = h.camera.position.clone(), rotation = h.camera.quaternion.clone();
    h.frame({ ...newDeusPact(), ...after });
    assert.ok(h.camera.position.distanceTo(position) < .0001, `${before.phase}→${after.phase}: the saved camera transition must not jump`);
    assert.ok(h.camera.quaternion.angleTo(rotation) < .0001, `${before.phase}→${after.phase}: the saved aim transition must not jump`);
  }
});

async function geometry(id: string) {
  const glb = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
  const length = glb.readUInt32LE(12), document = JSON.parse(glb.subarray(20, 20 + length).toString());
  for (const material of document.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = glb.subarray(20 + length), result = Buffer.alloc(20 + padded.length + bin.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); bin.copy(result, 20 + padded.length);
  return new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
}

test('machine-core first person samples the current real GLB eyes after posing and keeps the nearby neck probe visible', async t => {
  const h = setup(t);
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking'].map(async id => [id, await geometry(id)] as const)));
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async (path: string) => assets.get(path.split('/').pop()!.replace(/\.glb.*$/, ''))!);
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const renderer = new AgentRenderer(new THREE.Scene()), stage = new THREE.Group(); renderer.setWorld(false);
  stage.position.set(h.center.x, h.center.y - 1, h.center.z);
  const machine = new MachineCoreRenderer(stage); t.after(() => { renderer.dispose(); machine.dispose(); });
  renderer.updateAgent('neo', h.actor); await new Promise(resolve => setImmediate(resolve));
  const group = renderer.getAgent('neo')!, body = renderer.getAgentBody('neo')!, head = body.getObjectByName('head')!;
  assert.ok(head instanceof THREE.Bone && head.userData.cameraEye, 'sample the delivered GLB eye metadata');
  h.controls.firstPerson = true;
  const sync = (subject = group) => h.controls.syncDeusCamera(subject);
  const frame = (beat: DeusPactEncounter) => {
    h.actor.position = { x: h.center.x, y: h.center.y, z: h.center.z + DEUS_PACT.platform.z }; h.actor.rotation = Math.PI;
    h.actor.currentAction = { type: 'idle', parameters: { deusPact: { ...beat, role: 'neo' } }, startedAt: 0, duration: 1, progress: 0 };
    renderer.updateAgent('neo', h.actor);
    h.controls.update(.02, h.actor, group, false);
    renderer.setPlayer('neo', h.controls.firstPerson); renderer.setPlayerMotion(h.controls.motion);
    renderer.update(.02, h.camera, 0); sync();
    group.updateWorldMatrix(true, true);
    const eye = head.localToWorld((head.userData.cameraEye as THREE.Vector3).clone());
    if (h.controls.firstPerson) assert.ok(h.camera.position.distanceTo(eye) < .00001,
      `${beat.phase}: actual camera is ${h.camera.position.distanceTo(eye)} from the current GLB eye`);
    return eye;
  };
  for (const beat of [...beats, ...beats.toReversed()]) {
    frame(beat); const before = h.camera.position.clone(); frame(beat);
    assert.ok(h.camera.position.distanceTo(before) < .00001, 'same paused pose cannot move the eye');
  }
  const connected = { ...newDeusPact(), phase: 'connected' as const, total: 16.8, consent: 1.8 };
  const eye = frame(connected), direction = h.camera.getWorldDirection(new THREE.Vector3());
  h.look(); frame(connected);
  assert.ok(h.camera.getWorldDirection(new THREE.Vector3()).distanceTo(direction) > .1, 'sampling the head must retain free look');
  const beforeMissing = h.camera.position.clone(); sync(new THREE.Group()); assert.deepEqual(h.camera.position, beforeMissing, 'loading fallback cannot reset the camera');
  h.key('KeyV'); h.key('KeyV', false); frame(connected); const third = h.camera.position.clone(); sync();
  assert.deepEqual(h.camera.position, third, 'postpose eye hook cannot replace the third-person composition');
  h.key('KeyV'); h.key('KeyV', false); frame(connected); assert.ok(h.camera.position.distanceTo(eye) < .00001);

  machine.update(connected, 0, true, { x: 0, z: -25 }, body); stage.updateMatrixWorld(true);
  const probe = stage.getObjectByName('machine-core-neck-probe')!;
  let tip!: THREE.Vector3;
  probe.traverse(object => { if (object instanceof THREE.Mesh && object.geometry.type === 'ConeGeometry')
    tip = object.localToWorld(new THREE.Vector3(0, (object.geometry as THREE.ConeGeometry).parameters.height / 2, 0)); });
  assert.ok(tip, 'check the real connected probe');
  const target = tip.clone().sub(eye).normalize(), current = h.camera.getWorldDirection(new THREE.Vector3());
  const turn = Math.atan2(Math.sin(Math.atan2(target.x, target.z) - Math.atan2(current.x, current.z)), Math.cos(Math.atan2(target.x, target.z) - Math.atan2(current.x, current.z)));
  h.look(-turn / .0028, (-Math.asin(target.y) + Math.asin(current.y)) / .002); frame(connected); h.camera.updateMatrixWorld();
  const hits = new THREE.Raycaster(h.camera.position, target, 0, 2).intersectObject(probe, true);
  assert.ok(hits.length, 'the eye-to-probe ray must intersect its actual surface');
  assert.ok(h.camera.near < hits[0].distance, `near=${h.camera.near} clips the neck connector ${hits[0].distance} from the real eye`);
  assert.ok(hits[0].distance > .08, 'the eye cannot be placed inside the connecting hardware');
  const projected = hits[0].point.clone().project(h.camera);
  assert.ok(Math.abs(projected.x) < .9 && Math.abs(projected.y) < .9 && projected.z > -1 && projected.z < 1, `the player can look at the nearby connector: ${projected.toArray()}`);
  let closestProbeDepth = Infinity;
  probe.traverse(object => {
    if (!(object instanceof THREE.Mesh) || object.geometry.type !== 'ConeGeometry') return;
    for (let i = 0; i < object.geometry.attributes.position.count; i++) {
      const point = object.localToWorld(object.getVertexPosition(i, new THREE.Vector3())).applyMatrix4(h.camera.matrixWorldInverse);
      closestProbeDepth = Math.min(closestProbeDepth, -point.z);
    }
  });
  assert.ok(h.camera.near < closestProbeDepth, `the near plane slices the connected probe: near=${h.camera.near}, closest face=${closestProbeDepth}`);
  h.look(.3 / .0028, 0); frame(connected); h.camera.updateMatrixWorld();
  const offCenter = hits[0].point.clone().project(h.camera);
  assert.ok(Math.abs(offCenter.x) < .9 && Math.abs(offCenter.y) < .9 && offCenter.z > -1 && offCenter.z < 1,
    `the nearby connector must remain visible when looking slightly past it: ${offCenter.toArray()}`);
  group.updateMatrixWorld(true);
  let eyes!: THREE.SkinnedMesh;
  body.traverse(object => { if (object instanceof THREE.SkinnedMesh && (object.material as THREE.Material).name === 'Eyes'
    && object.skeleton.bones.includes(head as THREE.Bone)) eyes = object; });
  assert.ok(eyes, 'verify the eye metadata against the independently skinned eyeballs');
  eyes.skeleton.update(); const actualEyes = new THREE.Vector3();
  for (let i = 0; i < eyes.geometry.attributes.position.count; i++) actualEyes.add(eyes.localToWorld(eyes.getVertexPosition(i, new THREE.Vector3())));
  actualEyes.divideScalar(eyes.geometry.attributes.position.count);
  assert.ok(h.camera.position.distanceTo(actualEyes) < .08, `the camera must be at the actual eyes, not inside the torso or the neck hardware: ${h.camera.position.distanceTo(actualEyes)}`);
  t.diagnostic(JSON.stringify({ eyeGeometryError: h.camera.position.distanceTo(actualEyes), probeSurfaceDistance: hits[0].distance,
    probeNdc: projected.toArray(), near: h.camera.near, closestProbeDepth }));
  h.actor.currentAction = null; h.actor.currentLocation = 'film_smith_avenue';
  h.controls.update(.02, h.actor, group, false); const outside = h.camera.position.clone(); sync();
  assert.deepEqual(h.camera.position, outside, 'leaving the machine connection disables the postpose hook');
  assert.equal(h.controls.performing, false);
  assert.equal(h.camera.near, .5, 'leaving restores the ordinary near plane');
});

test('the formed collective still allows mouse looking, V switching, and normal movement after leaving', t => {
  const h = setup(t), beat = beats[1];
  h.frame(beat);
  for (const firstPerson of [true, false]) {
    h.key('KeyV'); h.key('KeyV', false); assert.equal(h.controls.firstPerson, firstPerson);
    h.frame(beat); const before = h.camera.getWorldDirection(new THREE.Vector3()); h.look(); h.frame(beat);
    assert.ok(h.camera.getWorldDirection(new THREE.Vector3()).distanceTo(before) > .05, 'forming a face must not override mouse yaw/pitch');
    assert.equal(h.group.children[0].rotation.y, h.actor.rotation, 'free look cannot rotate the performed body');
  }
  h.actor.currentAction = null; h.actor.currentLocation = 'film_rain_avenue';
  h.controls.update(.02, h.actor, h.group, false);
  assert.equal(h.controls.performing, false); assert.equal(h.controls.motion.deusPact, undefined);
  const before = h.group.position.clone(); h.key('KeyW'); h.controls.update(.05, h.actor, h.group, true); h.key('KeyW', false);
  assert.ok(h.group.position.distanceTo(before) > .001, 'the next scene must release movement');
});

test('the machine-core establishing view frames the actual collective surface together with Neo in wide and portrait windows', t => {
  const h = setup(t), set = new THREE.Group(); set.position.set(h.center.x, h.center.y - 1, h.center.z);
  const renderer = new MachineCoreRenderer(set); t.after(() => renderer.dispose());
  const beat = { ...newDeusPact(), phase: 'terms' as const, elapsed: 0, total: 8.2, resolve: 3 };
  renderer.update(beat, 0, false, { x: 0, z: -25 }); set.updateMatrixWorld(true);
  const face = set.getObjectByName('machine-core-face')!;
  const bounds = new THREE.Box3().setFromObject(face), points: THREE.Vector3[] = [];
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) points.push(new THREE.Vector3(x, y, z));
  for (const aspect of [16 / 9, 9 / 16]) {
    h.camera.aspect = aspect; h.frame(beat);
    for (const world of [...points, new THREE.Vector3(h.actor.position.x, h.actor.position.y, h.actor.position.z),
      new THREE.Vector3(h.actor.position.x, h.actor.position.y + 3.8, h.actor.position.z)]) {
      const projected = world.clone().project(h.camera);
      assert.ok(Math.abs(projected.x) < .94 && Math.abs(projected.y) < .94 && projected.z > -1 && projected.z < 1,
        `Neo and the real formed surface must share ${aspect} frame: ${projected.toArray()}`);
    }
    const feet = new THREE.Vector3(h.actor.position.x, h.actor.position.y, h.actor.position.z).project(h.camera);
    const head = new THREE.Vector3(h.actor.position.x, h.actor.position.y + 3.8, h.actor.position.z).project(h.camera);
    assert.ok(Math.abs(head.y - feet.y) > .16, 'Neo must remain readable in the shared establishing frame');
  }
});

test('the machine-core shared view has clear actual geometry sightlines to Neo and the collective', t => {
  const h = setup(t), set = new THREE.Group(); set.position.set(h.center.x, h.center.y - 1, h.center.z);
  const renderer = new MachineCoreRenderer(set); t.after(() => renderer.dispose());
  const beat = { ...newDeusPact(), phase: 'terms' as const, total: 8.2, resolve: 3 };
  renderer.update(beat, 0, false, { x: 0, z: -25 }); set.updateMatrixWorld(true);
  const plates = set.getObjectByName('machine-core-face-plates') as THREE.InstancedMesh;
  const points: THREE.Vector3[] = [], matrix = new THREE.Matrix4();
  for (let index = 0; index < plates.count; index += Math.floor(plates.count / 36)) {
    plates.getMatrixAt(index, matrix); points.push(plates.localToWorld(new THREE.Vector3().setFromMatrixPosition(matrix)));
  }
  for (const y of [0, 1.8, 3.8]) points.push(new THREE.Vector3(h.center.x, h.center.y + y, h.center.z - 25));
  const tunnel = set.getObjectByName('machine-core-light-tunnel')!;
  for (const aspect of [16 / 9, 9 / 16]) {
    h.camera.aspect = aspect; h.frame(beat);
    const blocked = points.flatMap((point, index) => {
      const ray = point.clone().sub(h.camera.position);
      const hit = new THREE.Raycaster(h.camera.position, ray.clone().normalize(), .06, ray.length() - .15).intersectObject(tunnel, true)[0];
      return hit ? [`${index >= points.length - 3 ? 'Neo' : 'face'} by ${hit.object.name || (hit.object as THREE.Mesh).geometry.type} at ${hit.distance.toFixed(3)}`] : [];
    });
    assert.equal(blocked.length, 0, `${aspect}: actual chamber geometry blocks the shared view: ${blocked.join('; ')}`);
  }
});

test('the close connection shot keeps Neo’s actual head, feet and support above the subtitle area without structural occlusion', async t => {
  const h = setup(t);
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking'].map(async id => [id, await geometry(id)] as const)));
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async (path: string) => assets.get(path.split('/').pop()!.replace(/\.glb.*$/, ''))!);
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const renderer = new AgentRenderer(new THREE.Scene()), stage = new THREE.Group(); renderer.setWorld(false); renderer.setPlayer('neo', false);
  stage.position.set(h.center.x, h.center.y - 1, h.center.z);
  const machine = new MachineCoreRenderer(stage); t.after(() => { renderer.dispose(); machine.dispose(); });
  renderer.updateAgent('neo', h.actor); await new Promise(resolve => setImmediate(resolve));
  const group = renderer.getAgent('neo')!, body = renderer.getAgentBody('neo')!;
  for (const beat of [beats[0], beats[3]]) {
    h.actor.position = { x: h.center.x, y: h.center.y, z: h.center.z + DEUS_PACT.platform.z }; h.actor.rotation = Math.PI;
    h.actor.currentAction = { type: 'idle', parameters: { deusPact: { ...beat, role: 'neo' } }, startedAt: 0, duration: 1, progress: 0 };
    renderer.updateAgent('neo', h.actor); h.controls.update(.02, h.actor, group, false);
    renderer.setPlayerMotion(h.controls.motion); renderer.update(0, h.camera, 0);
    machine.update(beat, 0, false, { x: 0, z: -25 }, body); stage.updateMatrixWorld(true); group.updateMatrixWorld(true);
    const points: THREE.Vector3[] = [];
    body.traverseVisible(object => {
      if (!(object instanceof THREE.SkinnedMesh)) return;
      object.skeleton.update();
      for (let i = 0; i < object.geometry.attributes.position.count; i++) points.push(object.localToWorld(object.getVertexPosition(i, new THREE.Vector3())));
    });
    const targets = ['head', 'ankle_L', 'ankle_R'].map(name => body.getObjectByName(name)!.getWorldPosition(new THREE.Vector3()));
    for (let i = 0; i < 4; i++) {
      const pad = stage.getObjectByName(`machine-support-pad-${i}`)!;
      assert.equal(pad.visible, true); targets.push(pad.getWorldPosition(new THREE.Vector3()));
    }
    points.push(...targets);
    for (const aspect of [16 / 9, 9 / 16]) {
      h.camera.aspect = aspect; h.controls.update(.02, h.actor, group, false); h.camera.updateMatrixWorld();
      const bounds = new THREE.Box3().setFromPoints(points.map(point => point.clone().project(h.camera)));
      t.diagnostic(JSON.stringify({ phase: beat.phase, aspect, bodyNdc: { min: bounds.min.toArray(), max: bounds.max.toArray() } }));
      assert.ok(bounds.min.y >= -.4 && bounds.max.y <= .7 && bounds.min.x > -.86 && bounds.max.x < .86,
        `${beat.phase}/${aspect}: the actual head-to-feet/support silhouette overlaps HUD or leaves the frame: ${bounds.min.toArray()}..${bounds.max.toArray()}`);
      for (const point of targets) {
        const direction = point.clone().sub(h.camera.position);
        const hit = new THREE.Raycaster(h.camera.position, direction.clone().normalize(), .06, direction.length() - .08)
          .intersectObject(stage.getObjectByName('machine-core-light-tunnel')!, true)[0];
        assert.equal(hit, undefined, `an actual chamber structure blocks the connection shot: ${hit?.object.name}`);
      }
    }
  }
});

test('the carried body keeps its saved root and actual eye through waiting, transport, pause and V switching', async t => {
  const h = setup(t), asset = await geometry('neo');
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async () => asset);
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const renderer = new AgentRenderer(new THREE.Scene()); renderer.setWorld(false); t.after(() => renderer.dispose());
  const stage = new THREE.Group(); stage.position.set(h.center.x, h.center.y - 1, h.center.z);
  const machine = new MachineCoreRenderer(stage); t.after(() => machine.dispose());
  renderer.updateAgent('neo', h.actor); await new Promise(resolve => setImmediate(resolve));
  const group = renderer.getAgent('neo')!, head = group.getObjectByName('head')!;
  const frame = (phase: 'ready' | 'transfer' | 'done') => {
    const beat = { ...newTrilogyEpilogue('neo_carried'), phase, elapsed: phase === 'transfer' ? 1.6 : 0, total: 7.5 }, pose = neoCarryPose(beat);
    h.actor.position = { x: h.center.x + (pose.x ?? 0), y: h.center.y + pose.y, z: h.center.z + pose.z }; h.actor.rotation = Math.PI;
    h.actor.currentAction = { type: 'idle', parameters: { finaleComa: true, epilogue: { ...beat, role: 'neo' } }, startedAt: 0, duration: 1, progress: 0 };
    renderer.updateAgent('neo', h.actor); h.controls.update(.02, h.actor, group, false);
    renderer.setPlayer('neo', h.controls.firstPerson); renderer.setPlayerMotion(h.controls.motion); renderer.update(.02, h.camera, 0);
    h.controls.syncNeoCarryCamera(group); h.camera.updateMatrixWorld();
    machine.update(undefined, 0, false, { x: pose.x ?? 0, z: pose.z }, renderer.getAgentBody('neo'), beat); stage.updateMatrixWorld(true);
    if (!h.controls.firstPerson) for (const name of ['head', 'chest', 'pelvis']) {
      const target = group.getObjectByName(name)!.getWorldPosition(new THREE.Vector3()), direction = target.clone().sub(h.camera.position);
      const hits = new THREE.Raycaster(h.camera.position, direction.clone().normalize(), 0, direction.length() - .05).intersectObject(stage, true)
        .filter(hit => { for (let p: THREE.Object3D | null = hit.object; p; p = p.parent) if (!p.visible) return false; return true; });
      assert.equal(hits.length, 0, `${phase}: machine scenery blocks the camera's view of ${name}`);
    }
    assert.ok(group.position.distanceTo(new THREE.Vector3(h.actor.position.x, h.actor.position.y, h.actor.position.z)) < .00001);
    assert.equal(group.children[0].rotation.y, Math.PI, 'observing cannot turn the unresponsive body');
    if (h.controls.firstPerson) assert.ok(h.camera.position.distanceTo(head.localToWorld((head.userData.cameraEye as THREE.Vector3).clone())) < .00001);
  };
  for (const phase of ['ready', 'transfer', 'done'] as const) {
    for (const firstPerson of [false, true]) {
      h.controls.firstPerson = firstPerson; frame(phase);
      const position = h.camera.position.clone(), rotation = h.camera.quaternion.clone(), fov = h.camera.fov;
      frame(phase); assert.ok(h.camera.position.distanceTo(position) < .00001); assert.ok(h.camera.quaternion.angleTo(rotation) < .00001); assert.equal(h.camera.fov, fov);
    }
  }
  const before = h.camera.getWorldDirection(new THREE.Vector3()); h.look(); frame('done');
  assert.ok(h.camera.getWorldDirection(new THREE.Vector3()).distanceTo(before) > .1);
  h.key('KeyV'); h.key('KeyV', false); assert.equal(h.controls.firstPerson, false); frame('done');
});
