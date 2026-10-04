import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, SMITH_FINALE, newSmithFinale, smithFinalePose, smithCraterFloor, type SmithFinaleEncounter } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { advanceMotion, newMotion } from '../packages/client/src/agents/CharacterMotion.js';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

const beats: SmithFinaleEncounter[] = [
  { ...newSmithFinale(), phase: 'building', elapsed: .7, total: 7.2, lane: .4 },
  { ...newSmithFinale(), phase: 'ground_counter', elapsed: .16, total: 2.4, hits: 1, lastStrike: 0 },
  { ...newSmithFinale(), phase: 'crater', elapsed: 1.1, total: 12.5, focus: .5 },
  { ...newSmithFinale(), phase: 'air_dodge', elapsed: .4, total: 5.8, lane: -.3 },
  { ...newSmithFinale(), phase: 'surrender', elapsed: .8, total: 20.4, focus: .8 },
];

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

async function setup(t: TestContext) {
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking', 'smith'].map(async id => [id, await geometry(id)] as const)));
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async (path: string) => assets.get(path.split('/').pop()!.replace(/\.glb.*$/, ''))!);
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  class Target extends EventTarget { matches() { return false; } }
  const window = new Target(), canvas = new Target();
  const context = { createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }),
    putImageData() {}, fillRect() {}, strokeRect() {}, fillText() {}, createRadialGradient: () => ({ addColorStop() {} }) };
  const document = Object.assign(new Target(), { pointerLockElement: canvas, hidden: false, exitPointerLock() {},
    createElement: () => ({ width: 0, height: 0, getContext: () => context }) });
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key)); Object.assign(globalThis, { window, document });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const actors = ['neo', 'smith'].map(id => world.agents.get(id)!), center = FILM_SETS.film_smith_avenue.center;
  for (const actor of actors) {
    actor.currentLocation = 'film_smith_avenue'; actor.isInMatrix = true; actor.rotation = .4;
    actor.position = { x: center.x + 1, y: center.y, z: center.z - 15 };
  }
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000), renderer = new AgentRenderer(new THREE.Scene());
  camera.position.set(center.x, center.y + 5, center.z - 22);
  for (const actor of actors) renderer.updateAgent(actor.id, actor);
  await new Promise(resolve => setImmediate(resolve));
  const group = renderer.getAgent('neo')!, head = group.getObjectByName('head')!;
  assert.ok(head instanceof THREE.Bone && head.userData.cameraEye, 'use the delivered GLB head and eye metadata');
  const controls = new PlayerControls(canvas as unknown as HTMLCanvasElement, camera, () => {}, () => {}); controls.possess(actors[0]);
  const setBeat = (beat: SmithFinaleEncounter) => {
    const poses = smithFinalePose(beat);
    for (const actor of actors) {
      const role = actor.id as 'neo' | 'smith', pose = poses[role];
      actor.position = { x: center.x + pose.x, y: center.y + pose.y, z: center.z + pose.z }; actor.rotation = pose.yaw;
      actor.velocity = { x: 0, y: 0, z: 0 };
      actor.currentAction = { type: 'idle', parameters: { smithFinale: { ...beat, role } }, startedAt: 0, duration: 1, progress: 0 };
      renderer.updateAgent(actor.id, actor);
    }
  };
  const sync = (subject = group) => controls.syncSmithFinaleCamera(subject);
  const frame = (beat: SmithFinaleEncounter) => {
    setBeat(beat); controls.update(.02, actors[0], group, false);
    renderer.setPlayer('neo', controls.firstPerson); renderer.setPlayerMotion(controls.motion); renderer.update(.02, camera, 0); sync();
    group.updateWorldMatrix(true, true); camera.updateMatrixWorld();
    return head.localToWorld((head.userData.cameraEye as THREE.Vector3).clone());
  };
  const look = () => document.dispatchEvent(Object.assign(new Event('mousemove'), { movementX: 140, movementY: -50 }));
  const key = (code: string, down = true) => window.dispatchEvent(Object.assign(new Event(down ? 'keydown' : 'keyup'), { code, repeat: false }));
  t.after(() => { controls.dispose(); renderer.dispose(); ['window', 'document'].forEach((key, i) => {
    if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!); else Reflect.deleteProperty(globalThis, key);
  }); });
  return { world, actors, controls, renderer, group, head, camera, frame, setBeat, sync, look, key };
}

test('the first paused finale frame restores both actual bodies and the camera without frame-rate settling', async t => {
  const h = await setup(t);
  for (const beat of [...beats, ...beats.toReversed()]) {
    h.frame(beat);
    for (const actor of h.actors) {
      const root = h.renderer.getAgent(actor.id)!, body = h.renderer.getAgentBody(actor.id)!;
      assert.ok(root.position.distanceTo(new THREE.Vector3(actor.position.x, actor.position.y, actor.position.z)) < .00001,
        `${actor.id}/${beat.phase}: saved root drifted by ${root.position.distanceTo(new THREE.Vector3(actor.position.x, actor.position.y, actor.position.z))}`);
      assert.ok(Math.abs(body.rotation.y - actor.rotation) < .00001, `${actor.id}/${beat.phase}: saved heading is off by ${body.rotation.y - actor.rotation}`);
    }
    const before = { position: h.camera.position.clone(), rotation: h.camera.quaternion.clone(), fov: h.camera.fov };
    h.frame(beat);
    assert.ok(h.camera.position.distanceTo(before.position) < .00001, 'a paused shot cannot creep');
    assert.ok(h.camera.quaternion.angleTo(before.rotation) < .00001, 'a paused shot cannot turn');
    assert.equal(h.camera.fov, before.fov, 'a paused shot cannot zoom');
  }
});

test('saved finale motion replaces prior running, jumping and combat instead of blending them into a cold load', () => {
  for (const role of ['neo', 'smith'] as const) for (const beat of beats) {
    const warm = newMotion();
    for (let frame = 0; frame < 30; frame++) advanceMotion(warm, { speed: 12, grounded: true, verticalVelocity: 0, turn: 2 }, .03);
    advanceMotion(warm, { speed: 6, grounded: false, verticalVelocity: 12, turn: -2, attack: 1, cast: 1, skill: 'dodge' }, .06);
    const input = { speed: 0, grounded: smithFinalePose(beat)[role].y <= 0, verticalVelocity: 0, turn: 0, smithFinale: { ...beat, role } };
    const pose = advanceMotion(warm, input, 0);
    assert.deepEqual(pose, advanceMotion(newMotion(), input, 0), `${role}/${beat.phase}: paused cold loading must reproduce the same limbs`);
    assert.deepEqual(advanceMotion(warm, input, .05), pose, `${role}/${beat.phase}: only saved encounter time may animate the pose`);
  }
});

test('the third-person lens opens continuously as the two fighters start flying', async t => {
  const h = await setup(t);
  const beat: SmithFinaleEncounter = { ...newSmithFinale(), phase: 'shockwave', elapsed: .375, total: 3.375, hits: 2 };
  h.frame(beat); const before = h.camera.position.clone();
  h.frame({ ...beat, elapsed: .376, total: 3.376 });
  assert.ok(h.camera.position.distanceTo(before) < .15,
    `the camera jumps ${h.camera.position.distanceTo(before)} while opening the aerial framing`);
});

test('the crater shot keeps both real bodies above the subtitle area, including Neo lying down', async t => {
  const h = await setup(t);
  for (const aspect of [16 / 9, 4 / 3]) for (const focus of [0, .7, 1.8]) {
    h.camera.aspect = aspect;
    h.frame({ ...newSmithFinale(), phase: 'crater', elapsed: 3, total: 25, focus });
    for (const id of ['neo', 'smith']) for (const name of ['head', 'wrist_R', 'wrist_L', 'ankle_R', 'ankle_L']) {
      const body = h.renderer.getAgentBody(id)!;
      const point = body.getObjectByName(name)!.getWorldPosition(new THREE.Vector3()).project(h.camera);
      assert.ok(Math.abs(point.x) < .82 && point.y > -.48 && point.y < .77,
        `${aspect}/${focus}/${id}/${name}: body cropped or covered by subtitles at ${point.toArray()}`);
    }
  }
});

test('the lying first-person view lifts toward Smith while keeping mouse look available', async t => {
  const h = await setup(t), beat: SmithFinaleEncounter = { ...newSmithFinale(), phase: 'crater', elapsed: 1, total: 15 };
  h.frame(beat); h.key('KeyV'); h.frame(beat);
  const smith = h.renderer.getAgentBody('smith')!.getObjectByName('head')!;
  const point = smith.getWorldPosition(new THREE.Vector3()).project(h.camera);
  assert.ok(point.y > -.5 && point.y < .72, `lying view crops Smith's head at ${point.y}`);
  const before = h.camera.getWorldDirection(new THREE.Vector3());
  h.look(); h.frame(beat);
  assert.ok(h.camera.getWorldDirection(new THREE.Vector3()).distanceTo(before) > .1, 'the resting view cannot lock out mouse look');
});

test('the clearing shot rises out of the pit to show both ranks while retaining a continuous saved camera', async t => {
  const h = await setup(t), center = FILM_SETS.film_smith_avenue.center;
  for (const aspect of [16 / 9, 4 / 3, 9 / 16]) {
    h.camera.aspect = aspect;
    for (const elapsed of [5.3, 6.2, 8]) {
      h.frame({ ...newSmithFinale(), phase: 'purging', elapsed, total: 60 + elapsed });
      assert.ok(h.camera.position.y > center.y + 2, 'the street-wide clearance cannot remain hidden behind the pit walls');
      for (const x of [-20, 20]) {
        const head = new THREE.Vector3(center.x + x, center.y + 4, center.z + 6).project(h.camera);
        assert.ok(Math.abs(head.x) < .95 && Math.abs(head.y) < .75 && head.z < 1, `${aspect}/${elapsed}: audience row ${x} is outside the clearing shot`);
      }
      const before = h.camera.position.clone();
      h.frame({ ...newSmithFinale(), phase: 'purging', elapsed: elapsed + .001, total: 60 + elapsed + .001 });
      assert.ok(h.camera.position.distanceTo(before) < .08, 'the crane movement cannot cut through a sudden camera jump');
    }
    h.frame({ ...newSmithFinale(), phase: 'purging', elapsed: SMITH_FINALE.surrender.purgeSeconds, total: 72 });
    const end = h.camera.position.clone();
    h.frame({ ...newSmithFinale(), phase: 'done', total: 70 });
    assert.ok(h.camera.position.distanceTo(end) < .00001, 'completion must hold the final restoration shot');
  }
});

test('the ending camera returns to the actual restored Oracle without clipping the pit or reverting to vanished Neo eyes', async t => {
  const h = await setup(t), center = FILM_SETS.film_smith_avenue.center, oracle = h.world.agents.get('oracle')!;
  oracle.currentLocation = 'film_smith_avenue'; oracle.isInMatrix = true; oracle.rotation = SMITH_FINALE.oracle.yaw;
  oracle.position = { x: center.x + SMITH_FINALE.oracle.x, y: center.y - SMITH_FINALE.crater.depth + .025, z: center.z + SMITH_FINALE.oracle.z };
  oracle.currentAction = { type: 'idle', parameters: { oracleRestored: true }, startedAt: 0, duration: 100000, progress: 0 };
  h.renderer.updateAgent('oracle', oracle);
  for (const aspect of [16 / 9, 4 / 3, 9 / 16]) for (const firstPerson of [false, true]) {
    h.camera.aspect = aspect; h.controls.firstPerson = firstPerson;
    h.frame({ ...newSmithFinale(), phase: 'purging', elapsed: 11.8, total: 71.8 });
    const body = h.renderer.getAgentBody('oracle')!; body.updateWorldMatrix(true, true);
    const box = new THREE.Box3(); body.traverseVisible(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.updateMatrixWorld(true); if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
      for (let i = 0; i < object.geometry.attributes.position.count; i++) box.expandByPoint(object.localToWorld(object.getVertexPosition(i, new THREE.Vector3())));
    });
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      const corner = new THREE.Vector3(x, y, z), projected = corner.clone().project(h.camera);
      assert.ok(Math.abs(projected.x) < .86 && projected.y > -.48 && projected.y < .82 && projected.z < 1,
        `${aspect}/${firstPerson}: the actual recovered body is cropped or behind the camera at ${projected.toArray()}`);
      for (let sample = 0; sample < 30; sample++) {
        const point = h.camera.position.clone().lerp(corner, sample / 30);
        assert.ok(point.y >= center.y - 1 + smithCraterFloor(point.x - center.x, point.z - center.z), 'the pit wall blocks the restoration shot');
      }
    }
    const previous = h.camera.position.clone(); h.frame({ ...newSmithFinale(), phase: 'done', total: 72 });
    assert.ok(previous.distanceTo(h.camera.position) < .00001, 'completion cannot reset the saved restoration lens');
  }
});

test('real finale GLB head, hands and feet cold-load identically after running and reverse saved-frame seeking', async t => {
  const h = await setup(t);
  for (const actor of h.actors) actor.velocity = { x: 0, y: 0, z: 12 };
  for (let frame = 0; frame < 35; frame++) h.renderer.update(.03, h.camera, 1);
  for (const beat of [...beats, ...beats.toReversed()]) {
    h.setBeat(beat); h.renderer.update(.02, h.camera, 0);
    const cold = new AgentRenderer(new THREE.Scene());
    try {
      for (const actor of h.actors) cold.updateAgent(actor.id, structuredClone(actor));
      await new Promise(resolve => setImmediate(resolve)); cold.update(.02, h.camera, 0);
      for (const actor of h.actors) for (const name of ['head', 'wrist_R', 'wrist_L', 'ankle_R', 'ankle_L']) {
        const warmPoint = h.renderer.getAgentBody(actor.id)!.getObjectByName(name)!.getWorldPosition(new THREE.Vector3());
        const coldPoint = cold.getAgentBody(actor.id)!.getObjectByName(name)!.getWorldPosition(new THREE.Vector3());
        assert.ok(warmPoint.distanceTo(coldPoint) < .00001, `${actor.id}/${beat.phase}/${name}: cold geometry differs by ${warmPoint.distanceTo(coldPoint)}`);
      }
    } finally { cold.dispose(); }
  }
});

test('finale first person follows the currently posed real eyes while keeping free look and V switching', async t => {
  const h = await setup(t); h.controls.firstPerson = true;
  let eyes!: THREE.SkinnedMesh;
  h.group.traverse(object => {
    if (object instanceof THREE.SkinnedMesh && (object.material as THREE.Material).name === 'Eyes'
      && object.skeleton.bones.includes(h.head as THREE.Bone)) eyes = object;
  });
  assert.ok(eyes, 'independently check the camera metadata against the actual skinned eyeballs');
  let maxEyeError = 0;
  for (const beat of [...beats, ...beats.toReversed()]) {
    const eye = h.frame(beat);
    assert.ok(h.camera.position.distanceTo(eye) < .00001, `${beat.phase}: first-person camera is ${h.camera.position.distanceTo(eye)} from the current eyes`);
    h.group.updateMatrixWorld(true); eyes.skeleton.update(); const eyeCenter = new THREE.Vector3();
    for (let i = 0; i < eyes.geometry.attributes.position.count; i++) eyeCenter.add(eyes.localToWorld(eyes.getVertexPosition(i, new THREE.Vector3())));
    eyeCenter.divideScalar(eyes.geometry.attributes.position.count);
    maxEyeError = Math.max(maxEyeError, h.camera.position.distanceTo(eyeCenter));
    assert.ok(h.camera.position.distanceTo(eyeCenter) < .08, `${beat.phase}: eye metadata differs from actual eyeball vertices by ${h.camera.position.distanceTo(eyeCenter)}; camera=${h.camera.position.toArray()}, eyes=${eyeCenter.toArray()}`);
    assert.equal(h.camera.near, .06);
    const paused = h.camera.position.clone(); h.frame(beat);
    assert.ok(h.camera.position.distanceTo(paused) < .00001, 'the first paused eye cannot settle over later frames');
  }
  const before = h.camera.getWorldDirection(new THREE.Vector3()); h.look(); h.frame(beats[0]);
  assert.ok(h.camera.getWorldDirection(new THREE.Vector3()).distanceTo(before) > .1, 'head tracking must retain free look');
  const saved = h.camera.position.clone(); h.sync(new THREE.Group()); assert.deepEqual(h.camera.position, saved);
  h.key('KeyV'); h.key('KeyV', false); h.frame(beats[0]); const third = h.camera.position.clone(); h.sync();
  assert.deepEqual(h.camera.position, third, 'eye correction must preserve third person');
  h.key('KeyV'); h.key('KeyV', false); const eye = h.frame(beats[0]); assert.ok(h.camera.position.distanceTo(eye) < .00001);
  h.actors[0].currentAction = null; h.controls.update(.02, h.actors[0], h.group, false);
  const outside = h.camera.position.clone(); h.sync(); assert.deepEqual(h.camera.position, outside);
  assert.equal(h.controls.performing, false); assert.equal(h.camera.near, .5);
  const position = h.group.position.clone(); h.key('KeyW'); h.controls.update(.05, h.actors[0], h.group, true); h.key('KeyW', false);
  assert.ok(Math.hypot(h.group.position.x - position.x, h.group.position.z - position.z) > .001, 'leaving the finale must release walking');
  t.diagnostic(`Maximum camera distance from the actual skinned eyeball center: ${maxEyeError}`);
});
