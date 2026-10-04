import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { FILM_SETS, farewellPose, type FarewellEncounter, type PlayerInput } from '@auto_matrix/shared';

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

async function setup(t: TestContext, heading = .4) {
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking', 'trinity', 'trinity-club'].map(async id => [id, await geometry(id)] as const)));
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async (path: string) => assets.get(path.split('/').pop()!.replace(/\.glb.*$/, ''))!);
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  class InputTarget extends EventTarget { matches() { return false; } }
  const window = new InputTarget(), canvas = new InputTarget();
  const context = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {}, createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} };
  const document = Object.assign(new InputTarget(), { pointerLockElement: null as unknown, hidden: false, exitPointerLock() {}, createElement: () => ({ width: 0, height: 0, getContext: () => context }) });
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key)); Object.assign(globalThis, { window, document });
  let time = 2000; t.mock.method(performance, 'now', () => time);
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const actors = ['neo', 'trinity'].map(id => world.agents.get(id)!);
  const center = FILM_SETS.film_logos_wreck.center, ready = farewellPose({ phase: 'ready', elapsed: 0, total: 0 });
  for (const actor of actors) {
    const pose = ready[actor.id as 'neo' | 'trinity'];
    actor.currentLocation = 'film_logos_wreck'; actor.isInMatrix = false; actor.rotation = actor.id === 'neo' ? heading : pose.yaw;
    actor.position = { x: center.x + pose.x, y: center.y, z: center.z + pose.z };
  }
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000), renderer = new AgentRenderer(new THREE.Scene()); renderer.setWorld(false);
  for (const actor of actors) renderer.updateAgent(actor.id, actor);
  await new Promise(resolve => setImmediate(resolve));
  const group = renderer.getAgent('neo')!, head = group.getObjectByName('head')!;
  assert.ok(head instanceof THREE.Bone, 'follow the real shipped GLB head');
  const sent: PlayerInput[] = [], controls = new PlayerControls(canvas as unknown as HTMLCanvasElement, camera, input => sent.push(input), () => {});
  controls.possess(actors[0]); controls.firstPerson = true;
  const sync = (body = group) => controls.syncFarewellCamera(body);
  const frame = (beat: FarewellEncounter) => {
    const poses = farewellPose(beat), center = FILM_SETS.film_logos_wreck.center;
    for (const actor of actors) {
      const role = actor.id as 'neo' | 'trinity', pose = poses[role];
      actor.position = { x: center.x + pose.x, y: center.y, z: center.z + pose.z }; actor.rotation = pose.yaw;
      actor.currentAction = { type: 'idle', parameters: { floorSeated: role === 'trinity', crouching: role === 'neo', farewell: { ...beat, role } }, startedAt: 0, duration: 1, progress: 0 };
      renderer.updateAgent(actor.id, actor);
    }
    time += 20;
    // Match Engine: controls first, then actual body/contact, then camera eye correction.
    controls.update(.02, structuredClone(actors[0]), group, false); renderer.setPlayer('neo', controls.firstPerson); renderer.setPlayerMotion(controls.motion);
    renderer.update(.02, camera, 0);
    assert.ok(group.position.distanceTo(new THREE.Vector3(actors[0].position.x, actors[0].position.y, actors[0].position.z)) < .0001, `${beat.phase}/${beat.elapsed}: the player root must use the saved body position in the first paused frame`);
    assert.ok(Math.abs(group.children[0].rotation.y - actors[0].rotation) < .0001, 'free look must not rotate the performed body away from its saved heading');
    const before = sent.length; sync(); assert.equal(sent.length, before, 'sampling the posed head must not send another player input');
    return head.localToWorld((head.userData.cameraEye as THREE.Vector3).clone());
  };
  const look = () => { document.pointerLockElement = canvas; document.dispatchEvent(Object.assign(new Event('mousemove'), { movementX: 140, movementY: -50 })); };
  const toggle = () => window.dispatchEvent(Object.assign(new Event('keydown'), { code: 'KeyV', repeat: false }));
  t.after(() => { controls.dispose(); renderer.dispose(); ['window', 'document'].forEach((key, i) => { if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!); else Reflect.deleteProperty(globalThis, key); }); });
  const walk = (location: 'film_logos_wreck' | 'film_machine_core') => {
    const actor = structuredClone(actors[0]); actor.currentLocation = location; actor.currentAction = null;
    if (location === 'film_machine_core') actor.position = { ...FILM_SETS.film_machine_core.center };
    controls.update(.02, actor, group, false);
    const before = group.position.clone();
    window.dispatchEvent(Object.assign(new Event('keydown'), { code: 'KeyW', repeat: false }));
    controls.update(.05, actor, group, true);
    window.dispatchEvent(Object.assign(new Event('keyup'), { code: 'KeyW' }));
    assert.ok(group.position.distanceTo(before) > .001, `${location}: W must move the player outside the farewell performance`);
  };
  return { controls, camera, group, head, frame, sync, look, toggle, walk, trinity: renderer.getAgent('trinity')! };
}

test('the first paused farewell frame follows the current delivered head after posing, including out-of-order saved beats', async t => {
  const h = await setup(t);
  for (const beat of [{ phase: 'kiss', elapsed: 2, total: 17.6 }, { phase: 'reaching', elapsed: .2, total: .2 },
    { phase: 'goodbye', elapsed: 2.1, total: 12.5 }, { phase: 'kiss', elapsed: .75, total: 16.35 }, { phase: 'still', elapsed: 0, total: 18.4 }] as FarewellEncounter[]) {
    const eye = h.frame(beat);
    assert.ok(h.camera.position.distanceTo(eye) < .0001, `${beat.phase}/${beat.elapsed}: first-person eye is detached by ${h.camera.position.distanceTo(eye)}`);
    const paused = h.camera.position.clone(); h.frame(beat);
    assert.ok(h.camera.position.distanceTo(paused) < .0001, 'pause cannot creep toward a previous head frame');
  }
});

test('farewell eye synchronization keeps free look, V switching, loading fallback and unrelated cameras intact', async t => {
  const h = await setup(t), beat = { phase: 'kiss' as const, elapsed: 1.5, total: 17.1 };
  h.frame(beat); const before = h.camera.getWorldDirection(new THREE.Vector3());
  h.look(); const eye = h.frame(beat);
  assert.ok(h.camera.position.distanceTo(eye) < .0001);
  assert.ok(h.camera.getWorldDirection(new THREE.Vector3()).distanceTo(before) > .1, 'head sampling must retain mouse yaw/pitch');
  const pose = h.camera.position.clone(), direction = h.camera.getWorldDirection(new THREE.Vector3());
  h.sync(new THREE.Group()); assert.deepEqual(h.camera.position, pose); assert.deepEqual(h.camera.getWorldDirection(new THREE.Vector3()), direction);
  h.toggle(); assert.equal(h.controls.firstPerson, false); h.frame(beat);
  const third = h.camera.position.clone(); h.sync(); assert.deepEqual(h.camera.position, third);
  h.toggle(); assert.equal(h.controls.firstPerson, true); assert.ok(h.camera.position.distanceTo(h.frame(beat)) < .0001);
  h.look(); h.frame({ phase: 'still', elapsed: 0, total: 18.4 });
  h.walk('film_machine_core'); assert.equal(h.controls.performing, false, 'leaving farewell must unlock control for the next scene');
  assert.equal(h.controls.motion.farewell, undefined); assert.equal(h.camera.near, .5, 'leaving restores the normal near plane');
  const outside = h.camera.position.clone(); h.head.position.y += 2;
  h.sync(); assert.deepEqual(h.camera.position, outside, 'this hook must not change other scenes');
});

test('the ready farewell entrance preserves normal walking before the performance begins', async t => {
  const h = await setup(t); h.walk('film_logos_wreck');
  assert.equal(h.controls.performing, false); assert.equal(h.controls.motion.farewell, undefined);
});

function eyeCenter(group: THREE.Group) {
  group.updateMatrixWorld(true);
  let eyes!: THREE.SkinnedMesh;
  group.traverse(object => { if (object instanceof THREE.SkinnedMesh && (object.material as THREE.Material).name === 'Eyes' && object.skeleton.bones.includes(group.getObjectByName('head') as THREE.Bone)) eyes = object; });
  assert.ok(eyes, 'sample the shipped eyeballs');
  const eye = new THREE.Vector3(); eyes.skeleton.update();
  for (let i = 0; i < eyes.geometry.attributes.position.count; i++) eye.add(eyes.localToWorld(eyes.getVertexPosition(i, new THREE.Vector3())));
  return eye.divideScalar(eyes.geometry.attributes.position.count);
}

function faceSamples(skin: THREE.SkinnedMesh, camera: THREE.PerspectiveCamera) {
  const positions = skin.geometry.attributes.position, weights = skin.geometry.attributes.skinWeight, joints = skin.geometry.attributes.skinIndex;
  const vertices = new Float32Array(positions.count * 3), selected = new Set<number>();
  skin.skeleton.update();
  for (let i = 0; i < positions.count; i++) {
    let headWeight = 0;
    for (let k = 0; k < 4; k++) if (skin.skeleton.bones[joints.getComponent(i, k)].name === 'head') headWeight += weights.getComponent(i, k);
    if (headWeight < .7 || positions.getZ(i) < .1) continue;
    selected.add(i); skin.localToWorld(skin.getVertexPosition(i, new THREE.Vector3())).toArray(vertices, i * 3);
  }
  const triangles: number[] = [], original = skin.geometry.index!;
  for (let i = 0; i < original.count; i += 3) {
    const triangle = [original.getX(i), original.getX(i + 1), original.getX(i + 2)];
    if (triangle.every(index => selected.has(index))) triangles.push(...triangle);
  }
  assert.ok(triangles.length, 'sample actual skinned facial triangles, excluding hands and clothing');
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3)); geometry.setIndex(triangles);
  // Front faces only: an exit hit from inside her head cannot count as visibility.
  const material = new THREE.MeshBasicMaterial({ side: THREE.FrontSide }), mesh = new THREE.Mesh(geometry, material); mesh.updateMatrixWorld(true);
  const visible: { triangle: number; distance: number; z: number }[] = [];
  try {
    for (let x = -3; x <= 3; x++) for (let y = -3; y <= 3; y++) {
      const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(x * .3, y * .3), camera);
      const hit = ray.intersectObject(mesh, false)[0];
      if (!hit) continue;
      const z = hit.point.clone().project(camera).z;
      if (z > -1 && z < 1) visible.push({ triangle: hit.faceIndex!, distance: hit.distance, z });
    }
    return visible;
  } finally { geometry.dispose(); material.dispose(); }
}

test('the real eyes remain outside Trinity’s face and her near facial surface is visible during the kiss', async t => {
  const h = await setup(t, Math.PI);
  for (const elapsed of [1.5, 1.606, 2, 2.15]) {
    h.frame({ phase: 'kiss', elapsed, total: 15.6 + elapsed }); h.camera.updateMatrixWorld(true);
    const actualEyes = eyeCenter(h.group), otherEyes = eyeCenter(h.trinity);
    let skin!: THREE.SkinnedMesh;
    h.trinity.traverseVisible(object => { if (object instanceof THREE.SkinnedMesh && (object.material as THREE.Material).name === 'Skin') skin = object; });
    const toward = otherEyes.clone().sub(h.camera.position).normalize();
    const hit = new THREE.Raycaster(h.camera.position, toward, .0001, 2).intersectObject(skin, false)[0];
    const visible = faceSamples(skin, h.camera);
    const oldNear = h.camera.clone(); oldNear.near = .5; oldNear.updateProjectionMatrix(); oldNear.updateMatrixWorld(true);
    const oldVisible = faceSamples(skin, oldNear);
    t.diagnostic(JSON.stringify({ elapsed, cameraEyeError: h.camera.position.distanceTo(actualEyes), near: h.camera.near,
      otherEyes: otherEyes.clone().project(h.camera).toArray(), skinEntry: hit?.distance, visibleFaceSamples: visible.length, oldNearSamples: oldVisible.length }));
    assert.ok(h.camera.position.distanceTo(actualEyes) < .04, 'camera must stay at the real eyes, not extend into the opposing face');
    assert.ok(hit && hit.distance > .015, 'the opposing facial skin must lie ahead of the eye');
    assert.ok(new Set(visible.map(sample => sample.triangle)).size >= 2, 'current viewport must contain actual front-facing facial triangles beyond the near plane');
    assert.equal(oldVisible.length, 0, 'the old .5 near plane must reproduce the missing close face');
  }
});

test('the saved kiss release joins stillness without a jump in the world root, real head or eye', async t => {
  const h = await setup(t, Math.PI);
  const samples = new Map<number, { root: THREE.Vector3; head: THREE.Vector3; eye: THREE.Vector3 }>();
  for (const elapsed of [2.184, 2.234, 2.284, 2.334, 2.384, 2.434, 2.484, 2.534, 2.584, 2.634, 2.684, 2.734, 2.784, 2.799, 2.8]) {
    h.frame({ phase: 'kiss', elapsed, total: 15.6 + elapsed });
    samples.set(elapsed, { root: h.group.position.clone(), head: h.head.getWorldPosition(new THREE.Vector3()), eye: h.camera.position.clone() });
  }
  const end = samples.get(2.8)!;
  h.frame({ phase: 'still', elapsed: 0, total: 18.4 });
  for (const [name, point] of [['root', h.group.position], ['head', h.head.getWorldPosition(new THREE.Vector3())], ['eye', h.camera.position]] as const)
    assert.ok(end[name].distanceTo(point) < .00001, `kiss → still jumps the actual world ${name} by ${end[name].distanceTo(point)}`);
  let previous = samples.get(2.184)!;
  for (const [elapsed, current] of [...samples].slice(1)) {
    assert.ok(current.root.z >= previous.root.z, 'the existing release clock must continuously withdraw the kiss approach');
    assert.ok(current.root.distanceTo(previous.root) < .023, `${elapsed}: release root moves too far in a 50ms saved-clock step`);
    previous = current;
  }
  // Arbitrary cold saved beats must produce the same pose without integrating render delta.
  for (const elapsed of [2.734, 2.234, 2.799]) {
    h.frame({ phase: 'kiss', elapsed, total: 15.6 + elapsed });
    const saved = samples.get(elapsed)!;
    assert.ok(h.group.position.distanceTo(saved.root) < .00001);
    assert.ok(h.head.getWorldPosition(new THREE.Vector3()).distanceTo(saved.head) < .00001);
    assert.ok(h.camera.position.distanceTo(saved.eye) < .00001);
  }
});
