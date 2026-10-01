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
