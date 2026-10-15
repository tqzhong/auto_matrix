import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, PILL_ROOM, PILL_TIMING, pillRoot, type PillGesture } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { createLoungeChair } from '../packages/client/src/engine/LoungeChair.js';

async function setup(t: test.TestContext, actorId: 'neo' | 'morpheus' = 'neo') {
  const glb = await readFile(new URL(`../packages/client/public/assets/characters/${actorId}.glb`, import.meta.url));
  const length = glb.readUInt32LE(12), source = JSON.parse(glb.subarray(20, 20 + length).toString());
  for (const material of source.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
  source.images = []; source.textures = [];
  const json = Buffer.from(JSON.stringify(source)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = glb.subarray(20 + length), buffer = Buffer.alloc(20 + padded.length + bin.length);
  buffer.writeUInt32LE(0x46546c67, 0); buffer.writeUInt32LE(2, 4); buffer.writeUInt32LE(buffer.length, 8);
  buffer.writeUInt32LE(padded.length, 12); buffer.writeUInt32LE(0x4e4f534a, 16); padded.copy(buffer, 20); bin.copy(buffer, 20 + padded.length);
  const asset = await new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '');
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async () => asset);
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  class InputTarget extends EventTarget { matches() { return false; } }
  const document = globalThis.document, window = globalThis.window, canvas = new InputTarget();
  const context = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} };
  globalThis.window = new InputTarget() as unknown as Window & typeof globalThis;
  globalThis.document = Object.assign(new InputTarget(), { createElement: () => ({ getContext: () => context }),
    pointerLockElement: null, hidden: false, exitPointerLock() {} }) as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const neo = world.agents.get(actorId)!;
  neo.currentLocation = 'film_lafayette'; neo.isInMatrix = true; neo.isAwakened = actorId === 'morpheus';
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000), renderer = new AgentRenderer(new THREE.Scene());
  renderer.updateAgent(actorId, neo); await new Promise(resolve => setImmediate(resolve));
  const group = renderer.getAgent(actorId)!, body = renderer.getAgentBody(actorId)!, head = group.getObjectByName('head')!;
  assert.ok(head instanceof THREE.Bone, 'the view must use the delivered actor skeleton');
  const controls = new PlayerControls(canvas as unknown as HTMLCanvasElement, camera, () => {}, () => {});
  t.after(() => { controls.dispose(); renderer.dispose(); globalThis.document = document; globalThis.window = window; });
  const draw = (gesture: PillGesture, firstPerson = true) => {
    const root = gesture.role === 'morpheus' ? { x: -PILL_ROOM.seat, z: PILL_ROOM.z, yaw: Math.PI / 2 }
      : pillRoot({ ...gesture, approach: { x: 1.75, z: -6, yaw: -Math.PI / 2 } });
    const center = FILM_SETS.film_lafayette.center;
    neo.position = { x: center.x + root.x, y: center.y, z: center.z + root.z }; neo.rotation = root.yaw;
    neo.currentAction = { type: 'idle', parameters: { pills: gesture }, startedAt: 0, duration: 1, progress: 0 };
    controls.possess(neo); controls.firstPerson = firstPerson;
    for (let frame = 0; frame < 2; frame++) {
      controls.update(.05, neo, group, false); renderer.setPlayer(actorId, firstPerson); renderer.setPlayerMotion(controls.motion);
      renderer.update(0, camera, 0); group.updateWorldMatrix(true, true);
    }
    controls.update(.05, neo, group, false); group.updateMatrixWorld(true); camera.updateMatrixWorld(true);
  };
  return { neo, controls, renderer, group, body, head, camera, draw };
}

test('the console first-person eye follows Neo while he reaches for and drinks from the mug', async t => {
  const h = await setup(t), center = FILM_SETS.film_neb_deck.center;
  h.neo.currentLocation = 'film_neb_deck'; h.neo.isInMatrix = false; h.neo.isAwakened = true;
  h.neo.position = { x: center.x + 3.4, y: center.y, z: center.z + 7.2 }; h.neo.rotation = Math.PI / 2;
  for (const [phase, elapsed] of [['accepting', .9], ['sip_ready', 0], ['sipping', 1.8]] as const) {
    h.neo.currentAction = { type: 'idle', parameters: { interlude: { kind: 'console', phase, elapsed, physicalConsole: true, role: 'neo' } }, startedAt: 0, duration: 1, progress: 0 };
    h.renderer.updateAgent('neo', h.neo); h.controls.possess(h.neo); h.controls.firstPerson = true;
    for (let frame = 0; frame < 3; frame++) {
      h.controls.update(.05, h.neo, h.group, false); h.renderer.setPlayer('neo', true); h.renderer.setPlayerMotion(h.controls.motion);
      h.renderer.update(0, h.camera, 0); h.group.updateMatrixWorld(true);
    }
    const eye = h.head.localToWorld((h.head.userData.cameraEye as THREE.Vector3).clone());
    assert.ok(h.camera.position.distanceTo(eye) < .005, `console eye drifts ${h.camera.position.distanceTo(eye)} at ${phase}/${elapsed}`);
  }
});

test('first-person pill taking retains the actual hands and owned props, including a paused or restored pose', async t => {
  const h = await setup(t);
  for (const choice of ['red', 'blue'] as const) for (const elapsed of [PILL_TIMING.transfer + .1, 5.7, 7.3, 8.4]) {
    const gesture: PillGesture = { phase: 'taking', elapsed, choice, role: 'neo' };
    h.draw(gesture);
    assert.equal(h.body.visible, true, 'hiding the whole player would erase the hands, capsule and glass');
    const name = elapsed < PILL_TIMING.swallow ? `held-${choice}-pill` : 'pill-water-glass';
    const visible: THREE.Object3D[] = []; h.group.traverseVisible(object => { if (object.name === name) visible.push(object); });
    assert.equal(visible.length, 1, `${name} must have one visible owner at ${elapsed}`);
    const contact = visible[0].getWorldPosition(new THREE.Vector3());
    h.draw(JSON.parse(JSON.stringify(gesture)));
    assert.ok(visible[0].getWorldPosition(new THREE.Vector3()).distanceTo(contact) < .001, 'reconnecting at a saved action age cannot jump the held prop');
    h.draw(gesture, false); assert.equal(h.body.visible, true);
    h.draw(gesture); assert.equal(h.body.visible, true);
  }
  delete h.neo.currentAction;
  h.controls.possess(h.neo); h.controls.firstPerson = true; h.controls.update(.05, h.neo, h.group, false);
  h.renderer.setPlayer('neo', true); h.renderer.setPlayerMotion(h.controls.motion); h.renderer.update(0, h.camera, 0);
  assert.equal(h.body.visible, false, 'ordinary first-person movement still follows its own visibility rule');
});

test('possessing Morpheus does not borrow Neo\'s drinking glance', async t => {
  const h = await setup(t, 'morpheus');
  h.draw({ phase: 'choice', elapsed: 0, role: 'morpheus' });
  const waiting = h.camera.getWorldDirection(new THREE.Vector3());
  h.draw({ phase: 'taking', elapsed: 7.3, choice: 'red', role: 'morpheus' });
  assert.ok(waiting.dot(h.camera.getWorldDirection(new THREE.Vector3())) > .999, 'Morpheus is watching Neo, rather than drinking the water himself');
});

for (const role of ['neo', 'morpheus'] as const) test(`the conversation frames ${role} and keeps capsules hidden until the offer`, async t => {
    const h = await setup(t, role);
    for (const aspect of [16 / 9, .65]) for (const elapsed of [1.5, 4.5, 7]) {
      h.camera.aspect = aspect; h.camera.updateProjectionMatrix();
      const gesture: PillGesture = { phase: 'talking', elapsed, role, conversation: { beat: 1, belief: 'agency' } };
      h.draw(gesture, false);
      const visible: string[] = [];
      h.group.traverseVisible(object => { if (/held-.*-pill|pill-water-glass/.test(object.name)) visible.push(object.name); });
      assert.deepEqual(visible, [], 'listening and explaining must not expose the capsules');
      if ((elapsed < 3.3 ? 'neo' : 'morpheus') === role) {
        const head = h.head.getWorldPosition(new THREE.Vector3()).project(h.camera);
        assert.ok(Math.abs(head.x) < .45 && head.y > -.1 && head.y < .6 && Math.abs(head.z) < 1,
          `${role} head leaves the reverse shot at ${aspect}: ${head.toArray()}`);
      }
      const hand = h.group.getObjectByName('wrist_R')!.getWorldPosition(new THREE.Vector3());
      h.draw(JSON.parse(JSON.stringify(gesture)), false);
      assert.ok(hand.distanceTo(h.group.getObjectByName('wrist_R')!.getWorldPosition(new THREE.Vector3())) < .001,
        'a paused/reloaded speaking gesture must have the same hand position');
      h.draw(gesture, true);
      const eye = h.head.localToWorld(new THREE.Vector3(0, .1, .32));
      assert.ok(h.camera.position.distanceTo(eye) < .001, 'V keeps the first-person view at the actual seated eyes');
    }
});

test('first-person pill eyes follow the real seated, leaning and standing head while near hand props clear the clip plane', async t => {
  const h = await setup(t);
  for (const elapsed of [0, 1.9, 3.4, 5.7, 7.3, 8.4, 10.6, 12, 16.5]) {
    h.draw({ phase: 'taking', elapsed, choice: 'red', role: 'neo' });
    const eye = h.head.localToWorld(new THREE.Vector3(0, .1, .32));
    assert.ok(h.camera.position.distanceTo(eye) < .001, `the view leaves Neo's animated eyes at ${elapsed}: ${h.camera.position.distanceTo(eye)}`);
    if (elapsed === 7.3) {
      const cup = h.group.getObjectByName('pill-water-glass')!, sample = cup.localToWorld(new THREE.Vector3(0, -.1, 0));
      const projected = sample.clone().project(h.camera);
      assert.ok(projected.z > -1 && projected.z < 1, `the lower half of the drinking glass is clipped: ${projected.toArray()}`);
      assert.ok(Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1, `the drinking glass must enter the eye view: ${projected.toArray()}`);
      const hand = h.group.getObjectByName('finger3-2_R')!.getWorldPosition(new THREE.Vector3()).project(h.camera);
      assert.ok(Math.abs(hand.x) < 1 && Math.abs(hand.y) < 1 && hand.z > -1 && hand.z < 1, `the gripping fingers must enter the view with the glass: ${hand.toArray()}`);
    }
  }
  h.draw({ phase: 'taking', elapsed: 7.3, choice: 'red', role: 'neo' }, false);
  assert.equal(h.camera.near, .5, 'switching back restores the normal world clip plane');
  delete h.neo.currentAction; h.controls.possess(h.neo); h.controls.firstPerson = true; h.controls.update(.05, h.neo, h.group, false);
  assert.equal(h.camera.near, .5, 'leaving the pill action must restore the normal clip plane');
});

test('the first-person conversation retains the chosen look direction even after a long answer', async t => {
  const h = await setup(t);
  h.draw({ phase: 'talking', elapsed: 10, role: 'neo', conversation: { beat: 3, belief: 'agency' } });
  const controls = h.controls as unknown as { yaw: number; pitch: number };
  controls.yaw += .4; controls.pitch = .1; const yaw = controls.yaw;
  h.controls.update(.05, h.neo, h.group, false);
  assert.equal(controls.yaw, yaw, 'finishing a spoken line must not force the eyes back to the departure heading');
});

for (const role of ['neo', 'morpheus'] as const) test(`the padded chairs clear ${role}'s real eyes and the pill conversation`, async t => {
  const h = await setup(t, role), chairs = new THREE.Group(), leather = new THREE.MeshStandardMaterial();
  const center = FILM_SETS.film_lafayette.center;
  for (const side of [-1, 1]) {
    const chair = createLoungeChair(leather); chair.position.set(center.x + side * PILL_ROOM.seat, center.y - 1, center.z + PILL_ROOM.z);
    chair.rotation.y = -side * Math.PI / 2; chairs.add(chair);
  }
  chairs.updateMatrixWorld(true);
  t.after(() => {
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>([leather]);
    chairs.traverse(object => { if (object instanceof THREE.Mesh) { geometries.add(object.geometry); materials.add(object.material); } });
    geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
  });
  const clear = (target: THREE.Vector3, label: string) => {
    const direction = target.clone().sub(h.camera.position), ray = new THREE.Raycaster(h.camera.position, direction.clone().normalize(), 0, direction.length() - .02);
    assert.equal(ray.intersectObject(chairs, true).length, 0, label);
  };
  for (const aspect of [16 / 9, .65]) {
    h.camera.aspect = aspect; h.camera.updateProjectionMatrix();
    const gesture: PillGesture = { phase: 'talking', elapsed: role === 'neo' ? 1.5 : 4.5, role, conversation: { beat: 1, belief: 'agency' } };
    h.draw(gesture, false); clear(h.head.getWorldPosition(new THREE.Vector3()), 'the chair crown cannot cover the speaking actor');
    h.draw(gesture); clear(h.camera.position.clone().addScaledVector(h.camera.getWorldDirection(new THREE.Vector3()), 3), 'V must look out of the chair from the real seated eyes');
    if (role === 'neo') for (const elapsed of [5.7, 6.6, 7.3, 8.4]) {
      h.draw({ phase: 'taking', elapsed, role, choice: 'red' });
      clear(h.group.getObjectByName('pill-water-glass')!.getWorldPosition(new THREE.Vector3()), 'the carved arms cannot hide the held glass');
    }
  }
});

test('Neo grips the outside of the drinking glass without putting his fingers through the glass and water', async t => {
  const h = await setup(t), vertex = new THREE.Vector3(), failures: string[] = [];
  for (const choice of ['red', 'blue'] as const) for (const elapsed of [PILL_TIMING.liftCup, 5.7, 6.6, 7.3, 8.4, PILL_TIMING.replaceCup - .001]) {
    h.draw({ phase: 'taking', elapsed, choice, role: 'neo' });
    const cup = h.group.getObjectByName('pill-water-glass')!;
    let minimum = Infinity, contact = Infinity, worst = ''; const bounds = new THREE.Box3(); let handVertices = 0;
    const fingers = Array(5).fill(Infinity);
    h.body.traverseVisible(object => {
      if (!(object instanceof THREE.SkinnedMesh) || !object.name.includes('Anatomical')) return;
      object.skeleton.update();
      const indices = object.geometry.getAttribute('skinIndex'), weights = object.geometry.getAttribute('skinWeight');
      for (let i = 0; i < indices.count; i++) {
        let rightHand = 0;
        for (let j = 0; j < 4; j++) if (/^(wrist|finger.*)_R$/.test(object.skeleton.bones[indices.getComponent(i, j)].name)) rightHand += weights.getComponent(i, j);
        if (rightHand < .5) continue;
        object.getVertexPosition(i, vertex); object.localToWorld(vertex); cup.worldToLocal(vertex);
        bounds.expandByPoint(vertex); handVertices++;
        if (vertex.y < -.22 || vertex.y > .22) continue;
        const gap = Math.hypot(vertex.x, vertex.z) - (.104 + (vertex.y + .22) / .44 * .011);
        contact = Math.min(contact, Math.abs(gap));
        for (let j = 0; j < 4; j++) {
          const finger = /^finger([1-5])-/.exec(object.skeleton.bones[indices.getComponent(i, j)].name);
          if (finger && weights.getComponent(i, j) >= .5) fingers[Number(finger[1]) - 1] = Math.min(fingers[Number(finger[1]) - 1], Math.abs(gap));
        }
        if (gap < minimum) { minimum = gap; worst = `${i} at ${vertex.toArray()}, weights=${[0, 1, 2, 3].map(j => `${object.skeleton.bones[indices.getComponent(i, j)].name}:${weights.getComponent(i, j)}`).join(',')}`; }
      }
    });
    if (minimum < -.004) failures.push(`${choice} time=${elapsed} hand enters the glass wall: ${minimum}, vertex ${worst}, bounds=${bounds.min.toArray()} to ${bounds.max.toArray()}`);
    if (contact > .035) failures.push(`${choice} time=${elapsed} hand does not grip the glass: ${contact}, hand vertices=${handVertices}, bounds=${bounds.min.toArray()} to ${bounds.max.toArray()}`);
    if (fingers[0] > .035 || fingers.slice(1).filter(gap => gap <= .035).length < 2) failures.push(`${choice} time=${elapsed} thumb and at least two fingers must support the glass: ${fingers}`);
  }
  assert.deepEqual(failures, [], 'check the delivered skinned hand against the actual glass outer wall');
});

test('Neo pinches either capsule between real thumb and index pads without folding the fingertip back or burying the pill', async t => {
  const h = await setup(t);
  const rest = new Map<string, THREE.Vector3>();
  h.group.traverse(object => { if (object instanceof THREE.Bone && /^finger/.test(object.name)) rest.set(object.name, object.position.clone()); });
  for (const choice of ['red', 'blue'] as const) for (const elapsed of [PILL_TIMING.transfer, 2.5, PILL_TIMING.swallow - .01]) {
    h.draw({ phase: 'taking', elapsed, choice, role: 'neo' }, false);
    const side = choice === 'red' ? 'L' : 'R', inward = side === 'R' ? 1 : -1;
    const pill = h.group.getObjectByName(`held-${choice}-pill`)!;
    const skin = h.group.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
    skin.skeleton.update();
    const { position, skinIndex, skinWeight } = skin.geometry.attributes;
    const pads = [new THREE.Vector3(), new THREE.Vector3()], counts = [0, 0];
    let penetration = 0;
    for (let vertex = 0; vertex < position.count; vertex++) {
      let hand = 0;
      for (let part = 0; part < 4; part++) if (new RegExp(`^(wrist|finger).*_${side}$`).test(skin.skeleton.bones[skinIndex.getComponent(vertex, part)].name)) hand += skinWeight.getComponent(vertex, part);
      if (hand < .5) continue;
      const point = pill.worldToLocal(skin.localToWorld(skin.getVertexPosition(vertex, new THREE.Vector3())));
      penetration = Math.max(penetration, .016 - Math.hypot(point.x, point.z, Math.max(0, Math.abs(point.y) - .02)));
      for (let part = 0; part < 4; part++) {
        const digit = new RegExp(`^finger([12])-3_${side}$`).exec(skin.skeleton.bones[skinIndex.getComponent(vertex, part)].name);
        if (digit && skinWeight.getComponent(vertex, part) > .95) { pads[Number(digit[1]) - 1].add(point); counts[Number(digit[1]) - 1]++; }
      }
    }
    pads.forEach((pad, i) => { assert.ok(counts[i] > 50); pad.divideScalar(counts[i]); });
    assert.ok(penetration < .003, `${choice}/${elapsed}: fingers enter the capsule by ${penetration}`);
    assert.ok(pads[0].x * inward > .025 && pads[1].x * inward < -.025,
      `thumb and index pads must oppose each other across the capsule: ${pads.map(p => p.toArray())}`);
    for (const pad of pads) assert.ok(Math.hypot(pad.x, pad.z, Math.max(0, Math.abs(pad.y) - .02)) - .016 < .035, 'both real pads must touch the capsule');
    const joints = [2, 3].map(segment => h.group.getObjectByName(`finger2-${segment}_${side}`)!);
    const middle = joints[1].getWorldPosition(new THREE.Vector3()).sub(joints[0].getWorldPosition(new THREE.Vector3())).normalize();
    const tip = pill.localToWorld(pads[1].clone()).sub(joints[1].getWorldPosition(new THREE.Vector3())).normalize();
    assert.ok(middle.dot(tip) > -.05, 'the distal index must not fold backwards over its middle joint');
    for (const [name, position] of rest) assert.ok(h.group.getObjectByName(name)!.position.distanceTo(position) < 1e-7, 'grasping cannot move or stretch finger joints');
    const frozen = [1, 2].flatMap(finger => [1, 2, 3].map(segment => h.group.getObjectByName(`finger${finger}-${segment}_${side}`)!))
      .map(bone => ({ bone, rotation: bone.quaternion.clone() }));
    h.draw({ phase: 'taking', elapsed: 7.3, choice: choice === 'red' ? 'blue' : 'red', role: 'neo' }, false);
    h.draw({ phase: 'taking', elapsed, choice, role: 'neo' }, false);
    for (const { bone, rotation } of frozen) assert.ok(bone.quaternion.angleTo(rotation) < 1e-7, 'restoring a saved pinch must not depend on the previous prop or choice');
  }
});

test('reaching for a pill closes the hand continuously instead of snapping into the pinch', async t => {
  const h = await setup(t);
  for (const choice of ['red', 'blue'] as const) {
    const side = choice === 'red' ? 'L' : 'R';
    h.draw({ phase: 'taking', elapsed: .35, choice, role: 'neo' }, false);
    const hand = Array.from({ length: 5 }, (_, digit) => [1, 2, 3].map(segment => h.group.getObjectByName(`finger${digit + 1}-${segment}_${side}`)!)).flat();
    const before = hand.map(bone => bone.quaternion.clone());
    h.draw({ phase: 'taking', elapsed: .3501, choice, role: 'neo' }, false);
    hand.forEach((bone, i) => assert.ok(bone.quaternion.angleTo(before[i]) < .001, `reaching snaps ${bone.name}`));
  }
});

test('Neo wraps all five fingers around the upright glass with opposing thumb support', async t => {
  const h = await setup(t);
  for (const choice of ['red', 'blue'] as const) for (const elapsed of [PILL_TIMING.liftCup, 5.7, 6.6, 7.3, 8.4, PILL_TIMING.replaceCup - .001]) {
    h.draw({ phase: 'taking', elapsed, choice, role: 'neo' }, false);
    const cup = h.group.getObjectByName('pill-water-glass')!;
    const across = h.group.getObjectByName('finger2-1_R')!.getWorldPosition(new THREE.Vector3())
      .sub(h.group.getObjectByName('finger5-1_R')!.getWorldPosition(new THREE.Vector3())).normalize();
    assert.ok(across.dot(new THREE.Vector3(0, 1, 0).transformDirection(cup.matrixWorld)) > .9, 'the four fingers must stack along the glass, not bunch horizontally below it');
    const skin = h.group.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh; skin.skeleton.update();
    const { position, skinIndex, skinWeight } = skin.geometry.attributes;
    const pads = Array.from({ length: 5 }, () => new THREE.Vector3()), counts = [0, 0, 0, 0, 0], gaps = Array(5).fill(Infinity);
    for (let vertex = 0; vertex < position.count; vertex++) for (let part = 0; part < 4; part++) {
      const match = /^finger([1-5])-3_R$/.exec(skin.skeleton.bones[skinIndex.getComponent(vertex, part)].name);
      if (!match || skinWeight.getComponent(vertex, part) < .95) continue;
      const digit = Number(match[1]) - 1, point = cup.worldToLocal(skin.localToWorld(skin.getVertexPosition(vertex, new THREE.Vector3())));
      pads[digit].add(point); counts[digit]++;
      if (Math.abs(point.y) < .22) gaps[digit] = Math.min(gaps[digit], Math.abs(Math.hypot(point.x, point.z) - (.104 + (point.y + .22) / .44 * .011)));
    }
    pads.forEach((pad, i) => {
      assert.ok(counts[i] > 50); pad.divideScalar(counts[i]);
      assert.ok(Math.abs(pad.y) < .2 && gaps[i] < .02, `finger ${i + 1} must contact the glass wall: ${pad.toArray()}, surface gap ${gaps[i]}`);
    });
    assert.ok(pads[1].y > pads[2].y && pads[2].y > pads[3].y && pads[3].y > pads[4].y && pads[1].y - pads[4].y > .12, 'index through little finger must wrap at distinct heights');
    const normal = (pad: THREE.Vector3) => new THREE.Vector3(pad.x, 0, pad.z).normalize();
    for (const digit of [1, 2]) assert.ok(normal(pads[0]).dot(normal(pads[digit])) < .4, 'the thumb must counter the fingers across the glass');
  }
});

test('bringing the glass to the mouth keeps the wrist aligned with the forearm', async t => {
  const h = await setup(t);
  for (const elapsed of Array.from({ length: 67 }, (_, i) => PILL_TIMING.liftCup + i * .05)) {
    h.draw({ phase: 'taking', elapsed, choice: 'red', role: 'neo' }, false);
    const wrist = h.group.getObjectByName('wrist_R')!, point = wrist.getWorldPosition(new THREE.Vector3());
    const forearm = point.clone().sub(h.group.getObjectByName('elbow_R')!.getWorldPosition(new THREE.Vector3())).normalize();
    const hand = wrist.localToWorld(new THREE.Vector3(0, -1, 0)).sub(point).normalize();
    assert.ok(forearm.dot(hand) > .6, `drinking bends the wrist sharply across the forearm at ${elapsed}: ${forearm.dot(hand)}, forearm ${forearm.toArray()}, hand ${hand.toArray()}, body yaw ${h.body.rotation.y}`);
  }
});

test('the cup grasp blends continuously and restores the saved hand after other gestures and view changes', async t => {
  const h = await setup(t);
  const hand: THREE.Object3D[] = [];
  h.group.traverse(object => { if (object instanceof THREE.Bone && /^(wrist|finger).*_R$/.test(object.name)) hand.push(object); });
  const joints = hand.map(bone => bone.position.clone());
  for (const choice of ['red', 'blue'] as const) {
    for (const [from, to] of [[4.1, 4.1001], [9.1999, 9.2]]) {
      h.draw({ phase: 'taking', elapsed: from, choice, role: 'neo' }, false);
      const before = hand.map(bone => bone.quaternion.clone());
      h.draw({ phase: 'taking', elapsed: to, choice, role: 'neo' }, false);
      hand.forEach((bone, i) => assert.ok(bone.quaternion.angleTo(before[i]) < .002, `grasp/release snaps ${bone.name}`));
    }
    for (const elapsed of [5.3, 6.3, 7.3, 8.5]) {
      const saved: PillGesture = { phase: 'taking', elapsed, choice, role: 'neo' };
      h.draw(saved, false);
      const frozen = hand.map(bone => bone.quaternion.clone());
      h.draw({ phase: 'taking', elapsed: 2.5, choice: choice === 'red' ? 'blue' : 'red', role: 'neo' }, false);
      h.draw(JSON.parse(JSON.stringify(saved)), true);
      hand.forEach((bone, i) => {
        assert.ok(bone.quaternion.angleTo(frozen[i]) < 1e-7, 'rebuilding the saved cup grip cannot inherit the last gesture or view');
        assert.ok(bone.position.distanceTo(joints[i]) < 1e-7, 'holding the glass cannot move or stretch finger joints');
      });
    }
  }
});
