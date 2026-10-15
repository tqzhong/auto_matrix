import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { FILM_SETS, interludeRoot, type InterludeGesture } from '@auto_matrix/shared';
import { NebDeckRenderer } from '../packages/client/src/engine/NebDeckRenderer.js';

async function fixture(t: TestContext) {
  const assets = new Map<string, Promise<any>>(), pending: Promise<unknown>[] = [];
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async url => {
    const name = String(url).split('/').pop()!;
    if (!assets.has(name)) assets.set(name, (async () => {
      const path = `../packages/client/public/assets/characters/${name}`;
      const raw = await readFile(new URL(path, import.meta.url)), size = raw.readUInt32LE(12);
      const doc = JSON.parse(raw.subarray(20, 20 + size).toString());
      for (const material of doc.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
      doc.images = []; doc.textures = [];
      const json = Buffer.from(JSON.stringify(doc)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
      const bin = raw.subarray(20 + size), data = Buffer.alloc(20 + padded.length + bin.length);
      data.writeUInt32LE(0x46546c67); data.writeUInt32LE(2, 4); data.writeUInt32LE(data.length, 8);
      data.writeUInt32LE(padded.length, 12); data.writeUInt32LE(0x4e4f534a, 16); padded.copy(data, 20); bin.copy(data, 20 + padded.length);
      return new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '');
    })());
    const promise = assets.get(name)!; pending.push(promise); const asset = await promise;
    return { ...asset, scene: clone(asset.scene) };
  });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {}, fillRect() {}, fillText() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  const cypher = models.create(world.agents.get('cypher')!), choi = models.create(world.agents.get('choi')!);
  const settle = async () => { await Promise.all(pending); await new Promise(resolve => setImmediate(resolve)); };
  await settle(); assert.ok(cypher.hero && choi.hero);
  const draw = async (realWorld = true, firstPerson = false) => {
    models.animate(cypher, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld, firstPerson, glasses: false }, 4);
    await settle();
    models.animate(cypher, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld, firstPerson, glasses: false }, 4);
    cypher.root.updateMatrixWorld(true);
  };
  t.after(() => { models.dispose(); globalThis.document = previous; });
  return { cypher, choi, draw, assets, models, world, settle };
}

test('Cypher’s reality appearance replaces the stand-in head and hair while retaining the anatomical five-finger body', async t => {
  const h = await fixture(t); await h.draw();
  const face = h.cypher.root.getObjectByName('cypher-anatomical-head') as THREE.Mesh;
  assert.ok(face?.visible, 'the real-world Cypher must have his own anatomical head');
  assert.ok(face.geometry.attributes.position.count > 15000);
  const skin = h.cypher.hero!.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  assert.ok(skin.visible); assert.ok(skin.geometry.index!.count > 1000, 'retain visible skinned hands and body');
  for (const side of ['R', 'L']) for (let digit = 1; digit <= 5; digit++) for (let joint = 1; joint <= 3; joint++)
    assert.ok(h.cypher.hero!.bones.has(`finger${digit}-${joint}_${side}`));
  const hair = h.cypher.hero!.wardrobe.filter(part => part.hair); assert.ok(hair.length > 0);
  assert.ok(hair.every(part => !part.mesh.visible), 'the borrowed short hair cannot cover Cypher’s bald scalp');
  assert.ok(!h.choi.root.getObjectByName('cypher-anatomical-head'), 'the identity swap belongs only to Cypher');
});

test('reality head eye positions match the existing eye anchor and do not jump the camera', async t => {
  const h = await fixture(t); await h.draw();
  const head = h.cypher.hero!.bones.get('head')!, anchor = head.localToWorld((head.userData.cameraEye as THREE.Vector3).clone());
  const eyes = h.cypher.root.getObjectByName('cypher-eyes')!; assert.ok(eyes);
  const centers = [eyes.children[0], eyes.children[3]].map(eye => eye.getWorldPosition(new THREE.Vector3()));
  const middle = centers[0].clone().add(centers[1]).multiplyScalar(.5);
  assert.ok(middle.distanceTo(anchor) < .005, `new eyes moved ${middle.distanceTo(anchor)} from the existing camera anchor`);
});

test('first person and return to Matrix restore the proper face visibility without changing Choi', async t => {
  const h = await fixture(t), cypherSkin = h.cypher.hero!.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  const choiSkin = h.choi.hero!.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  const original = cypherSkin.geometry, choiOriginal = choiSkin.geometry;
  await h.draw(); assert.notEqual(cypherSkin.geometry, original);
  await h.draw(true, true);
  assert.equal(h.cypher.root.getObjectByName('cypher-detailed-head')!.visible, false);
  assert.notEqual(cypherSkin.geometry, original, 'first person keeps the borrowed face hidden');
  await h.draw(false); assert.equal(cypherSkin.geometry, original, 'the unmade Matrix variant retains its existing appearance');
  assert.equal(h.cypher.root.getObjectByName('cypher-detailed-head')!.visible, false);
  await h.draw(); assert.equal(h.cypher.root.getObjectByName('cypher-detailed-head')!.visible, true);
  assert.equal(choiSkin.geometry, choiOriginal);
});

test('Cypher wears a continuous ship sweater in reality and restores the Matrix suit separately', async t => {
  const h = await fixture(t); await h.draw();
  const sweater = h.cypher.hero!.root.getObjectByName('cypher-reality-sweater') as THREE.SkinnedMesh;
  const collar = h.cypher.hero!.root.getObjectByName('cypher-reality-collar') as THREE.SkinnedMesh;
  assert.ok(sweater?.visible && collar?.visible, 'reality needs the ship costume rather than recolored suit lapels');
  const borrowed = h.cypher.hero!.wardrobe.filter(part => /Tailored.coat.upper|Black.crew.neck/.test(part.mesh.name));
  assert.equal(borrowed.length, 2); assert.ok(borrowed.every(part => !part.mesh.visible));
  await h.draw(false); assert.equal(sweater.visible, false); assert.equal(collar.visible, false);
  assert.ok(borrowed.every(part => part.mesh.visible), 'the existing Matrix costume remains available');
});

test('fitting the new head keeps the authored eyelid deformation at the actual body scale', async t => {
  const h = await fixture(t); await h.draw();
  const asset = await h.assets.get('cypher-head.glb'), source = asset.scene.getObjectByName('cypher-anatomical-head') as THREE.Mesh;
  const face = h.cypher.root.getObjectByName('cypher-anatomical-head') as THREE.SkinnedMesh;
  const target = source.geometry.morphAttributes.position[0]; let vertex = 0, length = 0;
  for (let i = 0; i < target.count; i++) {
    const size = new THREE.Vector3().fromBufferAttribute(target, i).length(); if (size > length) { vertex = i; length = size; }
  }
  assert.ok(length > .01, 'measure the actual eyelid shape, not an empty morph');
  face.morphTargetInfluences![0] = 0; const open = face.localToWorld(face.getVertexPosition(vertex, new THREE.Vector3()));
  face.morphTargetInfluences![0] = 1; const closed = face.localToWorld(face.getVertexPosition(vertex, new THREE.Vector3()));
  const head = h.cypher.hero!.bones.get('head')!, scale = head.userData.cypherEyeHalfWidth / asset.parser.json.extras.eye[0];
  const expected = length * scale * head.getWorldScale(new THREE.Vector3()).x;
  assert.ok(Math.abs(open.distanceTo(closed) - expected) < 1e-6, `eyelid travels ${open.distanceTo(closed)} instead of its fitted ${expected}`);
});

test('saved console gestures rebuild the same face, eyes and garment after a different pose', async t => {
  const h = await fixture(t); await h.draw();
  for (const [phase, elapsed] of [['ready', 0], ['performing', 2.8], ['performing', 5.8], ['responding', 2.1]] as const) {
    const fresh = h.models.create(h.world.agents.get('cypher')!); await h.settle();
    const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, glasses: false,
      seated: true, interlude: { kind: 'console' as const, phase, elapsed, role: 'cypher' as const } };
    for (const rig of [h.cypher, fresh]) {
      rig.motion.seated = 1;
      h.models.animate(rig, 0, input, 4); await h.settle();
      h.models.animate(rig, 0, input, 4); rig.root.updateMatrixWorld(true);
    }
    for (const name of ['cypher-anatomical-head', 'cypher-reality-sweater', 'cypher-reality-collar']) {
      const a = h.cypher.root.getObjectByName(name) as THREE.SkinnedMesh, b = fresh.root.getObjectByName(name) as THREE.SkinnedMesh;
      for (let vertex = 0; vertex < a.geometry.attributes.position.count; vertex += 137) {
        const p = a.localToWorld(a.getVertexPosition(vertex, new THREE.Vector3()));
        const q = b.localToWorld(b.getVertexPosition(vertex, new THREE.Vector3()));
        assert.ok(p.toArray().every(Number.isFinite));
        assert.ok(p.distanceTo(q) < 1e-5, `${name} ${phase}/${elapsed} jumps ${p.distanceTo(q)} on cold reconstruction`);
      }
    }
    const eyes = h.cypher.root.getObjectByName('cypher-eyes')!;
    const midpoint = eyes.children[0].getWorldPosition(new THREE.Vector3()).add(eyes.children[3].getWorldPosition(new THREE.Vector3())).multiplyScalar(.5);
    const head = h.cypher.hero!.bones.get('head')!;
    assert.ok(midpoint.distanceTo(head.localToWorld(head.userData.cameraEye.clone())) < .005);
  }
});

test('the detailed head stays inside its rendering bounds during console gestures and a ship-deck fall', async t => {
  const h = await fixture(t); await h.draw();
  const face = h.cypher.root.getObjectByName('cypher-anatomical-head') as THREE.SkinnedMesh;
  face.computeBoundingSphere();
  const check = (pose: string) => {
    const sphere = face.boundingSphere!.clone().applyMatrix4(face.matrixWorld);
    for (let vertex = 0; vertex < face.geometry.attributes.position.count; vertex += 37) {
      const point = face.localToWorld(face.getVertexPosition(vertex, new THREE.Vector3()));
      assert.ok(sphere.containsPoint(point), `the rendering bounds lose head vertex ${vertex} at ${pose}`);
    }
  };
  for (const [phase, elapsed] of [['ready', 0], ['performing', 2.8], ['performing', 5.8], ['responding', 2.1]] as const) {
    h.cypher.motion.seated = 1;
    h.models.animate(h.cypher, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, glasses: false,
      seated: true, interlude: { kind: 'console', phase, elapsed, role: 'cypher' } }, 4);
    h.cypher.root.updateMatrixWorld(true);
    check(`${phase}/${elapsed}`);
  }
  h.models.animate(h.cypher, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, glasses: false,
    crosscut: { phase: 'call', elapsed: 12, view: 'matrix', attempts: 0, tankHealth: 40, tankHit: true, dozerDead: true,
      apocDead: true, switchDead: false, cypherDead: true, trinityOut: false, neoOut: false, role: 'cypher', fall: 1.4 } }, 4);
  h.cypher.root.updateMatrixWorld(true); check('deck fall');
});

test('Cypher’s actual fingers rest above the rendered keyboard and withdraw without folding before the chair turns', async t => {
  const h = await fixture(t); await h.draw();
  const center = FILM_SETS.film_neb_deck.center, room = new THREE.Group(); room.position.set(center.x, center.y - 1, center.z);
  const renderer = new NebDeckRenderer(room); t.after(() => renderer.dispose());
  const rig = h.cypher, skin = rig.hero!.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh, attrs = skin.geometry.attributes;
  const draw = (phase: InterludeGesture['phase'], elapsed: number) => {
    const gesture: InterludeGesture = { kind: 'console', phase, elapsed, role: 'cypher', physicalConsole: true };
    const point = interludeRoot('console', 'cypher', gesture);
    rig.root.position.set(center.x + point.x, center.y - 1, center.z + point.z); rig.root.rotation.y = point.yaw;
    h.models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, glasses: false, interlude: gesture }, 4);
    rig.root.updateMatrixWorld(true); renderer.update({ scene: 'm1_cypher_console', interlude: gesture } as any, 900); room.updateMatrixWorld(true);
  };
  for (const elapsed of [0, .1, .2]) {
    draw(elapsed ? 'performing' : 'ready', elapsed);
    const keycaps = room.getObjectByName('neb-cypher-keycaps')!; assert.ok(keycaps);
    const bounds = new THREE.Box3().setFromObject(keycaps), nearest = Array(8).fill(Infinity); let inside = 0, worst = '';
    for (let v = 0; v < attrs.position.count; v++) {
      const digits = [0, 1, 2, 3].filter(j => attrs.skinWeight.getComponent(v, j) > .5)
        .map(j => /^finger([2-5])-3_([RL])$/.exec(skin.skeleton.bones[attrs.skinIndex.getComponent(v, j)].name)).filter(Boolean);
      const hand = [0, 1, 2, 3].some(j => attrs.skinWeight.getComponent(v, j) > .2 && /^(wrist|finger[1-5]-[1-3])_[RL]$/.test(skin.skeleton.bones[attrs.skinIndex.getComponent(v, j)].name));
      if (!hand) continue;
      const p = skin.localToWorld(skin.getVertexPosition(v, new THREE.Vector3()));
      if (p.x < bounds.min.x || p.x > bounds.max.x || p.z < bounds.min.z || p.z > bounds.max.z) continue;
      if (p.y - bounds.max.y < inside) {
        inside = p.y - bounds.max.y;
        worst = [0, 1, 2, 3].filter(j => attrs.skinWeight.getComponent(v, j) > .2).map(j => skin.skeleton.bones[attrs.skinIndex.getComponent(v, j)].name).join(',');
      }
      for (const digit of digits) nearest[Number(digit![1]) - 2 + (digit![2] === 'L' ? 4 : 0)] = Math.min(nearest[Number(digit![1]) - 2 + (digit![2] === 'L' ? 4 : 0)], Math.abs(p.y - bounds.max.y));
    }
    assert.ok(inside >= -.012, `hand penetrates keycaps ${inside} at ${elapsed}: ${worst}`);
    assert.ok(nearest.every(gap => gap < .07), `eight typing fingertips miss the keys at ${elapsed}: ${nearest}`);
  }
  for (let sample = 0; sample <= 44; sample++) {
    draw('performing', sample * .05);
    const chair = room.getObjectByName('neb-cypher-operator-chair')!, boxes = chair.children.filter(object => object instanceof THREE.Mesh).map(object => {
      const mesh = object as THREE.Mesh; mesh.geometry.computeBoundingBox();
      return { inverse: mesh.matrixWorld.clone().invert(), box: mesh.geometry.boundingBox!.clone().expandByScalar(-.005) };
    });
    for (let v = 0; v < attrs.position.count; v++) {
      if (![0, 1, 2, 3].some(j => attrs.skinWeight.getComponent(v, j) > .2 && /^(wrist|finger[1-5]-[1-3])_[RL]$/.test(skin.skeleton.bones[attrs.skinIndex.getComponent(v, j)].name))) continue;
      const point = skin.localToWorld(skin.getVertexPosition(v, new THREE.Vector3()));
      for (const { inverse, box } of boxes) assert.equal(box.containsPoint(point.clone().applyMatrix4(inverse)), false, `hand enters chair at ${sample * .05}, vertex ${v}`);
    }
    for (const side of ['R', 'L']) {
      const wrist = rig.hero!.bones.get(`wrist_${side}`)!, elbow = rig.hero!.bones.get(`elbow_${side}`)!;
      const forearm = wrist.getWorldPosition(new THREE.Vector3()).sub(elbow.getWorldPosition(new THREE.Vector3())).normalize();
      const angle = forearm.angleTo(new THREE.Vector3(0, -1, 0).transformDirection(wrist.matrixWorld));
      assert.ok(angle < 1.3, `wrist ${side} folds ${angle * 180 / Math.PI} degrees at ${sample * .05}`);
      const from = elbow.getWorldPosition(new THREE.Vector3()), to = wrist.getWorldPosition(new THREE.Vector3()), direction = to.sub(from);
      assert.equal(new THREE.Raycaster(from, direction.clone().normalize(), .05, direction.length() - .05).intersectObject(chair, true).length, 0, `forearm crosses chair ${side}/${sample}`);
    }
  }
  for (const [phase, elapsed] of [['ready', 0], ['performing', .45], ['performing', 1.45], ['choice', 0]] as const) {
    draw(phase, elapsed);
    const pelvis = rig.hero!.bones.get('pelvis')!.getWorldPosition(new THREE.Vector3()), chair = room.getObjectByName('neb-cypher-operator-chair')!;
    const seat = new THREE.Raycaster(pelvis.clone().add(new THREE.Vector3(0, .4, 0)), new THREE.Vector3(0, -1, 0)).intersectObject(chair, true)[0];
    assert.ok(seat && pelvis.y - seat.point.y > .03 && pelvis.y - seat.point.y < .25, 'the actual pelvis must stay on the cushion');
    let sole = Infinity;
    for (const part of rig.hero!.wardrobe) if (part.mesh.visible && /boot|shoe/i.test(part.mesh.name))
      for (let v = 0; v < part.mesh.geometry.attributes.position.count; v++) sole = Math.min(sole, part.mesh.localToWorld(part.mesh.getVertexPosition(v, new THREE.Vector3())).y);
    const footrest = new THREE.Box3().setFromObject(room.getObjectByName('neb-cypher-operator-chair-footrest')!).max.y;
    assert.ok(sole - footrest >= -.025 && sole - footrest < .05, `shoe/footrest gap ${sole - footrest}`);
    const fresh = h.models.create(h.world.agents.get('cypher')!); await h.settle();
    fresh.root.position.copy(rig.root.position); fresh.root.rotation.copy(rig.root.rotation);
    h.models.animate(fresh, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, glasses: false,
      interlude: { kind: 'console', phase, elapsed, role: 'cypher', physicalConsole: true } }, 4);
    fresh.root.updateMatrixWorld(true);
    for (const side of ['R', 'L']) for (const name of [`ankle_${side}`, `elbow_${side}`, `wrist_${side}`, ...Array.from({ length: 5 }, (_, i) => `finger${i + 1}-3_${side}`)])
      assert.ok(rig.hero!.bones.get(name)!.getWorldPosition(new THREE.Vector3()).distanceTo(fresh.hero!.bones.get(name)!.getWorldPosition(new THREE.Vector3())) < 1e-5, `${phase}/${elapsed} ${name} jumps on cold reconstruction`);
  }
});
