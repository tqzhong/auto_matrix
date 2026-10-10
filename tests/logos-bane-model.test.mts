import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { LOGOS_BANE, FILM_SETS, filmPosition, logosBaneRoot, type BaneEncounter, type FilmJourney } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { LogosBaneRenderer } from '../packages/client/src/engine/LogosBaneRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
async function geometry(id: string) {
  const glb = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
  const length = glb.readUInt32LE(12), document = JSON.parse(glb.subarray(20, 20 + length).toString());
  for (const material of document.materials) { delete material.pbrMetallicRoughness?.baseColorTexture; delete material.normalTexture; }
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = glb.subarray(20 + length), result = Buffer.alloc(20 + padded.length + bin.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); bin.copy(result, 20 + padded.length);
  return new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
}

async function setup(t: test.TestContext) {
  const ids = ['neo', 'neo-office', 'neo-tracking', 'trinity', 'trinity-club', 'bane-head', 'bane-body', 'smith'];
  const assets = new Map(await Promise.all(ids.map(async id => [id + '.glb', await geometry(id)] as const)));
  t.mock.method(GLTFLoader.prototype, 'loadAsync', (url: string) => assets.has(url.split('/').at(-1)!) ? Promise.resolve(assets.get(url.split('/').at(-1)!)) : new Promise(() => {}));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  class InputTarget extends EventTarget { matches() { return false; } }
  const window = new InputTarget(), canvas = new InputTarget();
  const disposers: (() => void)[] = [];
  const old = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  const document = Object.assign(new InputTarget(), { pointerLockElement: null as unknown, hidden: false, exitPointerLock() {}, createElement: () => ({ getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, stroke() {}, ellipse() {}, fill() {}, createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) });
  Object.assign(globalThis, { window, document });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const scene = new THREE.Scene(), renderer = new AgentRenderer(scene), center = FILM_SETS.film_logos_deck.center;
  renderer.setWorld(false);
  const set = new THREE.Group(); set.position.set(center.x, center.y - 1, center.z); scene.add(set);
  const room = new LogosBaneRenderer(set);
  const encounter: BaneEncounter = { phase: 'ready', elapsed: 0, attempts: 0, checkpoint: 'gun', hits: 0, focus: 0, counters: 0, lastStrike: -1,
    physical: { version: 1, intro: 'hostage', elapsed: 2, known: false, gunOnDeck: false, rescue: 'waiting', rescueElapsed: 0, gunHealth: 43, blindHealth: 25, baneHealth: 80, fall: 0, player: { ...LOGOS_BANE.neo, z: -5.5 } } };
  const pose = (state = encounter, first = false, delta = 0) => {
    const journey = { scene: 'm3_bane', actor: 'neo', step: 1, enteredAt: 10105, completed: [], reflections: {}, checkpoint: center, lastText: '', bane: state } as FilmJourney;
    for (const role of ['neo', 'trinity', 'bane'] as const) {
      const actor = structuredClone(world.agents.get(role)!), point = logosBaneRoot(state, role);
      Object.assign(actor, { status: role === 'bane' && state.phase === 'defeated' ? 'dead' : 'alive', health: role === 'bane' ? 80 : 43, currentLocation: 'film_logos_deck', isInMatrix: false,
        position: filmPosition('film_logos_deck', point.x, point.z), rotation: point.yaw,
        currentAction: { type: 'idle', parameters: { resolved: true, logosBane: { encounter: structuredClone(state), role } }, startedAt: 10105, duration: 1e9, progress: 0 } });
      actor.position.y += point.y; renderer.updateAgent(role, actor);
    }
    renderer.setPlayer('neo', first);
    // PlayerControls owns this transform in the browser. Keep its saved root
    // current here before the other actor's contact solver reads Neo's head.
    const player = renderer.getAgentState('neo')!;
    renderer.getAgent('neo')!.position.set(player.position.x, player.position.y, player.position.z);
    renderer.getAgentBody('neo')!.rotation.y = player.rotation;
    renderer.setPlayerMotion({ speed: 0, turn: 0, grounded: true, verticalVelocity: 0, realWorld: true, firstPerson: first, logosBane: { encounter: state, role: 'neo' } });
    renderer.update(delta, undefined, 0, 10105, journey); room.update(state, 1, 0, id => renderer.getAgentBody(id)); scene.updateMatrixWorld(true);
    scene.traverse(object => { if (object instanceof THREE.SkinnedMesh) object.skeleton.update(); });
  };
  t.after(() => { disposers.forEach(dispose => dispose()); renderer.dispose(); room.dispose(); ['window', 'document'].forEach((key, i) => { if (old[i]) Object.defineProperty(globalThis, key, old[i]!); else Reflect.deleteProperty(globalThis, key); }); });
  await room.ready;
  pose(); await new Promise(resolve => setImmediate(resolve)); pose(); await new Promise(resolve => setImmediate(resolve)); pose();
  return { renderer, room, scene, set, center, encounter, pose, window, canvas, document, disposers };
}
function surfaces(body: THREE.Object3D): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  body.traverseVisible(object => {
    if (!(object instanceof THREE.Mesh)) return;
    if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
    for (let i = 0; i < object.geometry.attributes.position.count; i += 11) points.push(object.localToWorld(object.getVertexPosition(i, new THREE.Vector3())));
  });
  return points;
}

test('Bane uses continuous delivered anatomy only in Logos and retains a deterministic saved hostage pose', async t => {
  const h = await setup(t), body = h.renderer.getAgentBody('bane')!;
  assert.ok(body.getObjectByName('bane-detailed-head')!.visible && body.getObjectByName('bane-detailed-body')!.visible);
  const before = surfaces(body).map(point => point.toArray());
  h.pose(structuredClone(h.encounter), false, 5);
  assert.deepEqual(surfaces(body).map(point => point.toArray()), before, 'paused limbs and anatomy must not drift');
  const actor = structuredClone(h.renderer.getAgentState('bane')!); actor.currentAction = null; actor.currentLocation = 'film_hammer_deck';
  h.renderer.updateAgent('bane', actor); h.renderer.update(0);
  assert.equal(body.getObjectByName('bane-detailed-head')!.visible, false); assert.equal(body.getObjectByName('bane-detailed-body')!.visible, false);
  assert.ok(surfaces(body).length > 0, 'the inquiry fallback must remain visible');
});

test('the hostage grip reaches Trinity’s neck and feet remain on the cargo deck', async t => {
  const h = await setup(t), rig = (h.renderer as any).agents.get('bane').rig;
  const trinity = h.renderer.getAgentBody('trinity')!, head = trinity.getObjectByName('head')!;
  const target = head.localToWorld(new THREE.Vector3(0, -.37, .18)), palm = rig.elbows[1].localToWorld(new THREE.Vector3(0, -.75, .005));
  assert.ok(palm.distanceTo(target) < .09, `hostage hand gap ${palm.distanceTo(target)}: palm ${palm.toArray()}, target ${target.toArray()}`);
  for (const role of ['neo', 'bane', 'trinity']) {
    const points = surfaces(h.renderer.getAgentBody(role)!);
    assert.ok(points.every(p => Number.isFinite(p.x + p.y + p.z)));
    const floor = Math.min(...points.map(p => p.y));
    assert.ok(Math.abs(floor - (h.center.y - 1)) < .14, `${role} floor gap ${floor - h.center.y + 1}`);
  }
});

test('first-person Logos hides the player’s own face while keeping the gun and contact arms visible', async t => {
  const h = await setup(t); h.pose(h.encounter, true);
  const body = h.renderer.getAgentBody('neo')!, head = body.getObjectByName('head')!, eye = head.localToWorld((head.userData.cameraEye as THREE.Vector3).clone());
  const forward = new THREE.Vector3(0, 0, 1), ray = new THREE.Raycaster(eye, forward, .01, 1.6);
  const hit = ray.intersectObject(body, true).filter(hit => { for (let o: THREE.Object3D | null = hit.object; o; o = o.parent) if (!o.visible) return false; return true; });
  assert.equal(hit.length, 0, 'the combined skin mesh must not render the player’s face in front of its eye');
  assert.equal(body.visible, true); assert.ok(h.set.getObjectByName('bane-electric-gun')!.visible);
});

test('first-person free look cannot reveal Neo’s combined face or neck while lowering the gun', async t => {
  const h = await setup(t); h.encounter.physical!.intro = 'lowering'; h.encounter.physical!.elapsed = 1.216; h.pose(h.encounter, true);
  const body = h.renderer.getAgentBody('neo')!, head = body.getObjectByName('head')!, eye = head.localToWorld((head.userData.cameraEye as THREE.Vector3).clone());
  for (const pitch of [-.4, 0, .4]) for (let i = 0; i < 12; i++) {
    const yaw = i * Math.PI / 6, direction = new THREE.Vector3(Math.sin(yaw), pitch, Math.cos(yaw)).normalize();
    const hits = new THREE.Raycaster(eye, direction, .01, 1.2).intersectObject(body, true).filter(hit => {
      for (let o: THREE.Object3D | null = hit.object; o; o = o.parent) if (!o.visible) return false;
      if (!(hit.object instanceof THREE.SkinnedMesh) || (hit.object.material as THREE.Material).name !== 'Skin' || !hit.face) return false;
      const mesh = hit.object, joints = mesh.geometry.attributes.skinIndex, weights = mesh.geometry.attributes.skinWeight;
      return [hit.face.a, hit.face.b, hit.face.c].some(vertex => [0, 1, 2, 3].some(joint =>
        weights.getComponent(vertex, joint) > .05 && /^(head|neck)$/.test(mesh.skeleton.bones[joints.getComponent(vertex, joint)].name)));
    });
    assert.equal(hits.length, 0, `own face/neck obstructs free look at yaw ${yaw}, pitch ${pitch}: ${hits.map(hit => hit.object.name).join(', ')}`);
  }
  assert.equal(body.getObjectByName('cervical-interface')!.visible, false, 'the neck hardware cannot fill the player’s own view');
  assert.ok(surfaces(body).length > 300, 'the contact arms and lower body remain visible');
  h.pose(h.encounter, false);
  assert.equal(body.getObjectByName('cervical-interface')!.visible, true, 'third-person restores the real-world neck interface');
  assert.ok(surfaces(body).some(point => point.y > eye.y), 'third-person restores the full head');
});

test('gold perception uses the delivered Smith anatomy at Bane’s actual saved position', async t => {
  const h = await setup(t); h.encounter.physical!.intro = 'done'; h.encounter.phase = 'counter'; h.encounter.pipeX = 4; h.encounter.pipeZ = -3;
  h.pose();
  const gold = h.set.getObjectByName('bane-gold-perception')!, body = h.set.getObjectByName('logos-gold-smith-body')!;
  assert.ok(gold.visible && body); const points = surfaces(body);
  assert.ok(points.length > 400, 'gold perception needs actual face, clothing and limbs instead of wire spheres');
  assert.ok(points.every(p => Number.isFinite(p.x + p.y + p.z)));
  const height = Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y));
  assert.ok(height > 3.5 && height < 4.8, `Smith body height ${height}`);
  assert.ok(gold.getWorldPosition(new THREE.Vector3()).distanceTo(new THREE.Vector3(h.center.x + 4, h.center.y - 1, h.center.z - 3)) < .001);
});

test('the dying gold form follows Bane onto the deck instead of standing inside Neo’s first-person view', async t => {
  const h = await setup(t), state = h.encounter.physical!;
  state.intro = 'done'; state.player = { x: 2.9815, y: 0, z: -1.3581, yaw: 1.108 };
  h.encounter.phase = 'defeated'; h.encounter.pipeX = 4.1; h.encounter.pipeZ = -.8;
  const gold = h.set.getObjectByName('bane-gold-perception')!, body = h.renderer.getAgentBody('bane')!;
  for (const fall of [.255, .6, .9]) {
    state.fall = fall; h.pose(h.encounter, true);
    const held = body.getWorldQuaternion(new THREE.Quaternion());
    h.pose(h.encounter, true, 5);
    assert.ok(held.angleTo(body.getWorldQuaternion(new THREE.Quaternion())) < .001, 'a paused collapse cannot acquire the generic corpse tilt');
    assert.ok(gold.visible);
    assert.ok(gold.getWorldQuaternion(new THREE.Quaternion()).angleTo(body.getWorldQuaternion(new THREE.Quaternion())) < .001,
      `the dying signal remains upright at saved fall ${fall}`);
    const head = h.renderer.getAgentBody('neo')!.getObjectByName('head')!, eye = head.localToWorld((head.userData.cameraEye as THREE.Vector3).clone());
    const facePoints: THREE.Vector3[] = [];
    gold.traverseVisible(object => {
      if (!(object instanceof THREE.SkinnedMesh)) return;
      const indices = object.geometry.attributes.skinIndex, weights = object.geometry.attributes.skinWeight;
      for (let vertex = 0; vertex < indices.count; vertex++) if ([0, 1, 2, 3].some(i => weights.getComponent(vertex, i) > .5 && object.skeleton.bones[indices.getComponent(vertex, i)].name === 'head'))
        facePoints.push(object.localToWorld(object.getVertexPosition(vertex, new THREE.Vector3())));
    });
    const faceBox = new THREE.Box3().setFromPoints(facePoints);
    // Whole-body bounds include empty space between the bent arms and torso.
    // Use the delivered head vertices to check the actual eye clearance.
    assert.ok(facePoints.length > 500);
    assert.ok(faceBox.distanceToPoint(eye) > .15, `the dying signal's head reaches Neo’s eye at ${fall}`);
  }
});

test('Logos first-person follows the current head and retains mouse look and V switching inside the bay', async t => {
  const h = await setup(t), group = h.renderer.getAgent('neo')!, camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000);
  const controls = new PlayerControls(h.canvas as unknown as HTMLCanvasElement, camera, () => {}, () => {});
  h.disposers.push(() => controls.dispose()); controls.possess(h.renderer.getAgentState('neo')!); controls.firstPerson = true;
  const frame = () => {
    const actor = h.renderer.getAgentState('neo')!;
    controls.update(.02, structuredClone(actor), group, false); h.pose(h.encounter, controls.firstPerson);
    controls.syncTrainmanChaseCamera(group, h.set);
    const head = group.getObjectByName('head')!;
    return head.localToWorld((head.userData.cameraEye as THREE.Vector3).clone());
  };
  frame();
  h.encounter.physical!.intro = 'lowering'; h.encounter.physical!.elapsed = 1.1; h.pose(h.encounter, true);
  assert.ok(camera.position.distanceTo(frame()) < .0001, 'the paused lowered head must be the camera eye');
  const before = camera.getWorldDirection(new THREE.Vector3());
  h.document.pointerLockElement = h.canvas;
  h.document.dispatchEvent(Object.assign(new Event('mousemove'), { movementX: 140, movementY: -50 }));
  frame(); assert.ok(camera.getWorldDirection(new THREE.Vector3()).distanceTo(before) > .1, 'the performance must retain the player’s free look');
  h.window.dispatchEvent(Object.assign(new Event('keydown'), { code: 'KeyV', repeat: false })); frame();
  assert.equal(controls.firstPerson, false);
  assert.ok(Math.abs(camera.position.x - h.center.x) < 5.9 && camera.position.z > h.center.z - 34.25 && camera.position.z < h.center.z + 22.25);
  assert.ok(camera.position.y < h.center.y + 5.55, 'the camera cannot cross the cargo ceiling');
  camera.aspect = .6; frame();
  assert.ok(Math.abs(camera.position.x - h.center.x) < 5.9 && camera.position.y < h.center.y + 5.55, 'the narrow view stays inside the same physical bay');
  h.window.dispatchEvent(Object.assign(new Event('keydown'), { code: 'KeyV', repeat: false })); frame();
  assert.equal(controls.firstPerson, true); assert.ok(camera.position.distanceTo(frame()) < .0001);
});

test('Bane’s final collapse remains above the rendered deck instead of sinking through it', async t => {
  const h = await setup(t); h.encounter.physical!.intro = 'done'; h.encounter.phase = 'defeated';
  for (const fall of [.3, .6, .9, 1.2]) {
    h.encounter.physical!.fall = fall; h.pose(); const points = surfaces(h.renderer.getAgentBody('bane')!), floor = h.center.y - 1;
    assert.ok(Math.min(...points.map(p => p.y)) >= floor - .1, `Bane penetrates the deck at ${fall} by ${floor - Math.min(...points.map(p => p.y))}`);
    if (fall === 1.2) assert.ok(Math.max(...points.map(p => p.y)) < floor + 1.6, 'the defeated body must lie on the deck');
  }
});

test('the delivered hands place and pick up the same electric gun without jumping off the grip', async t => {
  const h = await setup(t), state = h.encounter.physical!, gun = h.set.getObjectByName('bane-electric-gun')!;
  state.gunPoint = { x: state.player.x + .34, y: .26, z: state.player.z + .8 };
  const point = () => gun.getWorldPosition(new THREE.Vector3()).clone();
  state.intro = 'lowering'; state.elapsed = LOGOS_BANE.lowerSeconds * .68 - .000001; state.gunOnDeck = false; h.pose(); const lowering = point();
  state.elapsed += .000002; state.gunOnDeck = true; h.pose();
  assert.ok(lowering.distanceTo(point()) < .1, `the placed gun leaves Neo’s hand by ${lowering.distanceTo(point())}`);
  state.intro = 'taking'; state.elapsed = LOGOS_BANE.takeSeconds - .4 - .000001; h.pose(); const onDeck = point();
  state.elapsed += .000002; state.gunOnDeck = false; h.pose();
  assert.ok(onDeck.distanceTo(point()) < .1, `the picked-up gun jumps to Bane’s hand by ${onDeck.distanceTo(point())}`);
  state.elapsed = LOGOS_BANE.takeSeconds - .000001; h.pose(); const lifted = point();
  state.player = logosBaneRoot(h.encounter, 'neo');
  state.intro = 'recognition_ready'; state.elapsed = 0; h.pose();
  assert.ok(lifted.distanceTo(point()) < .1, `the raised gun jumps on entering recognition by ${lifted.distanceTo(point())}`);
});

test('the gun rolls onto the deck and rises from it without flipping at either handoff', async t => {
  const h = await setup(t), state = h.encounter.physical!, gun = h.set.getObjectByName('bane-electric-gun')!;
  state.gunPoint = { x: state.player.x + .34, y: .26, z: state.player.z + .8 };
  state.intro = 'lowering'; state.elapsed = LOGOS_BANE.lowerSeconds * .68 - .000001; state.gunOnDeck = false; h.pose();
  const lowering = gun.getWorldQuaternion(new THREE.Quaternion());
  state.elapsed += .000002; state.gunOnDeck = true; h.pose();
  assert.ok(lowering.angleTo(gun.getWorldQuaternion(new THREE.Quaternion())) < .02, 'laying the gun down cannot flip it in one frame');
  state.intro = 'taking'; state.elapsed = LOGOS_BANE.takeSeconds - .4 - .000001; h.pose();
  const onDeck = gun.getWorldQuaternion(new THREE.Quaternion());
  state.elapsed += .000002; state.gunOnDeck = false; h.pose();
  assert.ok(onDeck.angleTo(gun.getWorldQuaternion(new THREE.Quaternion())) < .02, 'picking up the gun cannot flip it in one frame');
  state.elapsed = LOGOS_BANE.takeSeconds - .000001; h.pose(); const raised = gun.getWorldQuaternion(new THREE.Quaternion());
  state.player = logosBaneRoot(h.encounter, 'neo');
  state.intro = 'recognition_ready'; state.elapsed = 0; h.pose();
  assert.ok(raised.angleTo(gun.getWorldQuaternion(new THREE.Quaternion())) < .02, 'the raised aim must continue into recognition');
});

test('lowering and picking up the gun keep the delivered feet above the deck', async t => {
  const h = await setup(t), state = h.encounter.physical!, floor = h.center.y - 1;
  state.gunPoint = { x: state.player.x + .34, y: .26, z: state.player.z + .8 };
  for (const [intro, clock] of [['lowering', .7], ['lowering', 1.632], ['lowering', 2], ['taking', 4.8], ['taking', 5], ['taking', 5.4]] as const) {
    state.intro = intro; state.elapsed = clock; state.gunOnDeck = intro === 'taking' ? clock < 5 : clock >= 1.632; h.pose();
    for (const role of ['neo', 'bane']) {
      const points = surfaces(h.renderer.getAgentBody(role)!);
      assert.ok(Math.min(...points.map(p => p.y)) >= floor - .1, `${role} penetrates the deck during ${intro} at ${clock} by ${floor - Math.min(...points.map(p => p.y))}`);
    }
  }
});

test('the burning cable hand reaches Neo’s actual eyes while both delivered bodies retain deck contact', async t => {
  const h = await setup(t), state = h.encounter.physical!;
  state.intro = 'done'; state.gunOnDeck = true; state.known = true;
  state.gunPoint = { x: .34, y: .26, z: -4.7 }; h.encounter.phase = 'grapple';
  const bane = logosBaneRoot(h.encounter, 'bane');
  state.player = { x: bane.x - LOGOS_BANE.burnDistance, y: 0, z: bane.z, yaw: Math.PI / 2 };
  state.burnFrom = state.burnTo = { ...state.player }; h.encounter.phase = 'burning'; h.encounter.elapsed = .6; h.pose();
  const head = h.renderer.getAgentBody('neo')!.getObjectByName('head')!, eyes = head.localToWorld(new THREE.Vector3(0, .01, .18));
  const rig = (h.renderer as any).agents.get('bane').rig;
  const palm = rig.mobilWrists[0].localToWorld(new THREE.Vector3(0, -.1, .005));
  assert.ok(palm.distanceTo(eyes) < .12, `the cable hand misses Neo’s eyes by ${palm.distanceTo(eyes)}`);
  for (const role of ['neo', 'bane']) assert.ok(Math.min(...surfaces(h.renderer.getAgentBody(role)!).map(p => p.y)) >= h.center.y - 1.1, `${role} penetrates the deck during the eye burn`);
  h.pose(h.encounter, true);
  const eye = head.localToWorld((head.userData.cameraEye as THREE.Vector3).clone());
  const face = h.renderer.getAgentBody('bane')!.getObjectByName('bane-anatomical-head')!;
  assert.equal(new THREE.Box3().setFromObject(face, true).containsPoint(eye), false, 'the first-person eye cannot enter Bane’s delivered head');
});
