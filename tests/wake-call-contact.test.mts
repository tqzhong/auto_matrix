import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, WAKE_CALL, wakeCallRoot, type WakeCall } from '@auto_matrix/shared';
import { HeroModels } from '../packages/client/src/agents/HeroModel.js';
import { advanceMotion, newMotion } from '../packages/client/src/agents/CharacterMotion.js';
import { ApartmentSetRenderer } from '../packages/client/src/engine/ApartmentSetRenderer.js';

async function fixture(t: TestContext) {
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  t.mock.method(models as any, 'load', async (id: string) => {
    const bytes = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
    const length = bytes.readUInt32LE(12), doc = JSON.parse(bytes.subarray(20, 20 + length).toString());
    for (const material of doc.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
    doc.images = []; doc.textures = [];
    const json = Buffer.from(JSON.stringify(doc)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
    const bin = bytes.subarray(20 + length), result = Buffer.alloc(20 + padded.length + bin.length);
    result.writeUInt32LE(0x46546c67); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
    result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); bin.copy(result, 20 + padded.length);
    return new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
  });
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, fillText() {} }) }) } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const set = new THREE.Group(), room = new ApartmentSetRenderer(set), center = FILM_SETS.film_anderson_flat.center;
  set.position.set(center.x, center.y - 1, center.z);
  const rig = (await models.create('neo'))!, motion = newMotion();
  const draw = (phase: WakeCall['phase'], elapsed: number, body = rig) => {
    const call = { phase, elapsed, nightmare: true }, at = wakeCallRoot(call);
    body.root.position.set(center.x + at.x, center.y - 1, center.z + at.z); body.root.rotation.y = at.yaw;
    const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, homeClothes: true, glasses: false, wakeCall: call };
    models.animate(body, advanceMotion(motion, input, 0), motion, input, 0); body.root.updateMatrixWorld(true);
    room.update({ version: 1, scene: 'm1_wake_again', step: 0, actor: 'neo', completed: [], enteredAt: 0,
      reflections: {}, lastText: '', checkpoint: { ...center }, wakeCall: call }); set.updateMatrixWorld(true);
    const held = body.root.getObjectByName('neo-landline-handset')!, cradle = set.getObjectByName('apartment-landline-handset')!;
    assert.notEqual(held.visible, cradle.visible, 'exactly one receiver is visible across the transfer');
    return held.visible ? held : cradle;
  };
  t.after(() => { models.dispose(); room.dispose(); globalThis.document = document; });
  return { rig, draw, models, set };
}

test('Neo wraps his left fingers across the apartment receiver without floating or penetrating its handle', async t => {
  const h = await fixture(t), phone = h.draw('listening', 2), wrist = h.rig.bones.get('wrist_L')!;
  const across = h.rig.bones.get('finger2-1_L')!.getWorldPosition(new THREE.Vector3())
    .sub(h.rig.bones.get('finger5-1_L')!.getWorldPosition(new THREE.Vector3())).normalize();
  assert.ok(new THREE.Vector3(0, 1, 0).transformDirection(phone.matrixWorld).dot(across) > .85,
    'the receiver must cross the left knuckles with its earpiece at the index finger, as in the apartment call');
  assert.ok(wrist.getWorldPosition(new THREE.Vector3()).distanceTo(phone.getWorldPosition(new THREE.Vector3())) < .35,
    'the actual left hand must carry the receiver');
  const skin = h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh; skin.skeleton.update();
  const pads = Array.from({ length: 5 }, () => new THREE.Vector3()), counts = [0, 0, 0, 0, 0];
  const { skinIndex, skinWeight } = skin.geometry.attributes, inverse = phone.matrixWorld.clone().invert();
  for (let v = 0; v < skinIndex.count; v++) for (let j = 0; j < 4; j++) {
    const match = /^finger([1-5])-3_L$/.exec(skin.skeleton.bones[skinIndex.getComponent(v, j)].name);
    if (match && skinWeight.getComponent(v, j) > .95) {
      pads[Number(match[1]) - 1].add(skin.getVertexPosition(v, new THREE.Vector3()).applyMatrix4(skin.matrixWorld).applyMatrix4(inverse));
      counts[Number(match[1]) - 1]++;
    }
  }
  pads.forEach((pad, i) => { assert.ok(counts[i] > 50); pad.divideScalar(counts[i]); });
  const gaps = [Infinity, Infinity, Infinity, Infinity, Infinity], triangle = new THREE.Triangle(), nearest = new THREE.Vector3();
  phone.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const { position } = object.geometry.attributes, indices = object.geometry.index, matrix = inverse.clone().multiply(object.matrixWorld);
    for (let v = 0; v < (indices?.count ?? position.count); v += 3) {
      [triangle.a, triangle.b, triangle.c].forEach((p, j) => p.fromBufferAttribute(position, indices ? indices.getX(v + j) : v + j).applyMatrix4(matrix));
      pads.forEach((pad, j) => { triangle.closestPointToPoint(pad, nearest); gaps[j] = Math.min(gaps[j], nearest.distanceTo(pad)); });
    }
  });
  assert.ok(gaps.every(gap => gap < .045), `actual finger pads must contact the receiver: ${gaps}`);
});

test('the receiver and arm remain continuous through pickup, answering and setting it back in the cradle', async t => {
  const h = await fixture(t); let previous: THREE.Vector3[] | undefined, rotations: THREE.Quaternion[] | undefined, maxStep = 0, maxTurn = 0, at = '';
  const phases = [['ringing', .64, .65], ['pickup', 0, WAKE_CALL.pickup], ['listening', 0, .05],
    ['decision', 0, .05], ['reply', 0, WAKE_CALL.reply], ['done', 0, .05]] as const;
  for (const [phase, start, end] of phases) for (let frame = Math.round(start * 100); frame <= Math.round(end * 100); frame++) {
    const phone = h.draw(phase, frame / 100);
    const bones = ['wrist_L', 'wrist_R', 'elbow_L', 'shoulder_L'].map(name => h.rig.bones.get(name)!);
    const points = [phone.getWorldPosition(new THREE.Vector3()), ...bones.map(bone => bone.getWorldPosition(new THREE.Vector3()))];
    const current = bones.map(bone => bone.getWorldQuaternion(new THREE.Quaternion()));
    if (previous) points.forEach((point, i) => {
      const step = point.distanceTo(previous![i]); if (step > maxStep) { maxStep = step; at = `${phase}/${frame / 100}/${i}`; }
    });
    if (rotations) current.forEach((rotation, i) => { maxTurn = Math.max(maxTurn, rotation.angleTo(rotations![i])); });
    previous = points; rotations = current;
  }
  t.diagnostic(JSON.stringify({ maxStep, maxTurn, at }));
  assert.ok(maxStep < .05, `${at}: a receiver or wrist jumps ${maxStep} world units between adjacent 10ms samples`);
  assert.ok(maxTurn < .2, `the arm snaps ${maxTurn} radians between adjacent 10ms samples`);
});

test('the earpiece rests against the actual head surface without entering it', async t => {
  const h = await fixture(t), phone = h.draw('listening', 2);
  const skin = h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  const { skinIndex, skinWeight } = skin.geometry.attributes; let gap = Infinity, penetration = 0;
  const inverse = phone.matrixWorld.clone().invert(), point = new THREE.Vector3();
  for (let vertex = 0; vertex < skinIndex.count; vertex++) {
    if (![0, 1, 2, 3].some(j => skin.skeleton.bones[skinIndex.getComponent(vertex, j)].name === 'head' && skinWeight.getComponent(vertex, j) > .5)) continue;
    skin.getVertexPosition(vertex, point).applyMatrix4(skin.matrixWorld).applyMatrix4(inverse);
    gap = Math.min(gap, Math.hypot(Math.max(0, Math.hypot(point.x, point.y - .23) - .093), point.z - .124));
    for (const y of [-.23, .23]) {
      penetration = Math.max(penetration, .09 * (1 - Math.hypot(point.x / .12, (point.y - y) / .126, (point.z - .025) / .09)),
        Math.min(.093 - Math.hypot(point.x, point.y - y), point.z - .107, .123 - point.z));
    }
  }
  t.diagnostic(JSON.stringify({ earpieceGap: gap, headPenetration: penetration }));
  assert.ok(gap < .025, `earpiece floats ${gap} away from Neo's actual head`);
  assert.ok(penetration < .003, `receiver enters the head by ${penetration}`);
});

test('the actual hand skin clears the receiver through approach, lift, listening, return and release', async t => {
  const h = await fixture(t), skin = h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  const { skinIndex, skinWeight } = skin.geometry.attributes;
  const hand: number[] = [], head: number[] = [], tips = Array.from({ length: 5 }, () => [] as number[]);
  for (let v = 0; v < skinIndex.count; v++) {
    let weight = 0;
    for (let j = 0; j < 4; j++) {
      const name = skin.skeleton.bones[skinIndex.getComponent(v, j)].name, value = skinWeight.getComponent(v, j);
      if (/^(wrist|finger).*_L$/.test(name)) weight += value;
      if (name === 'head' && value > .5) head.push(v);
      const digit = /^finger([1-5])-3_L$/.exec(name);
      if (digit && value > .95) tips[Number(digit[1]) - 1].push(v);
    }
    if (weight > .5) hand.push(v);
  }
  assert.ok(hand.length > 1000);
  let maximumPenetration = 0, maximumHeadPenetration = 0, maximumBend = 0, maximumJoint = 0, witness = '', bendAt = '';
  for (const [phase, duration] of [['pickup', WAKE_CALL.pickup], ['listening', .1], ['reply', WAKE_CALL.reply]] as const) {
    for (let frame = 0; frame <= Math.round(duration * 60); frame++) {
      const phone = h.draw(phase, frame / 60), inverse = phone.matrixWorld.clone().invert(), point = new THREE.Vector3(); skin.skeleton.update();
      for (const vertex of hand) {
        skin.getVertexPosition(vertex, point).applyMatrix4(skin.matrixWorld).applyMatrix4(inverse);
        const bar = .07 - Math.hypot(point.x, point.z, Math.max(0, Math.abs(point.y) - .15));
        const cups = [-.23, .23].map(y => .09 * (1 - Math.hypot(point.x / .12, (point.y - y) / .126, (point.z - .025) / .09)));
        const depth = Math.max(bar, ...cups);
        if (depth > maximumPenetration) {
          maximumPenetration = depth;
          witness = `${phase}/${frame / 60}/vertex ${vertex}/${skin.skeleton.bones[skinIndex.getX(vertex)].name}/${point.toArray()}`;
        }
      }
      for (const vertex of head) {
        skin.getVertexPosition(vertex, point).applyMatrix4(skin.matrixWorld).applyMatrix4(inverse);
        for (const y of [-.23, .23]) maximumHeadPenetration = Math.max(maximumHeadPenetration,
          .09 * (1 - Math.hypot(point.x / .12, (point.y - y) / .126, (point.z - .025) / .09)),
          Math.min(.093 - Math.hypot(point.x, point.y - y), point.z - .107, .123 - point.z));
      }
      const wrist = h.rig.bones.get('wrist_L')!, elbow = h.rig.bones.get('elbow_L')!;
      const arm = wrist.getWorldPosition(new THREE.Vector3()).sub(elbow.getWorldPosition(new THREE.Vector3())).normalize();
      const palm = wrist.position.clone().normalize().applyQuaternion(wrist.getWorldQuaternion(new THREE.Quaternion()));
      const bend = arm.angleTo(palm) * 180 / Math.PI;
      if (bend > maximumBend) { maximumBend = bend; bendAt = `${phase}/${frame / 60}`; }
      for (let digit = 1; digit <= 5; digit++) {
        const pad = new THREE.Vector3();
        for (const vertex of tips[digit - 1]) pad.add(skin.getVertexPosition(vertex, new THREE.Vector3()).applyMatrix4(skin.matrixWorld));
        pad.divideScalar(tips[digit - 1].length);
        const points = [1, 2, 3].map(j => h.rig.bones.get(`finger${digit}-${j}_L`)!.getWorldPosition(new THREE.Vector3())); points.push(pad);
        const segments = [0, 1, 2].map(j => points[j + 1].clone().sub(points[j]).normalize());
        const pip = segments[0].angleTo(segments[1]) * 180 / Math.PI, dip = segments[1].angleTo(segments[2]) * 180 / Math.PI;
        maximumJoint = Math.max(maximumJoint, pip, dip);
        assert.ok(pip <= (digit === 1 ? 100 : 115) && dip <= 90, `${phase}/${frame / 60}/digit ${digit}: middle ${pip}, distal ${dip}`);
      }
    }
  }
  t.diagnostic(JSON.stringify({ handVertices: hand.length, maximumPenetration, maximumHeadPenetration, witness, maximumBend, bendAt, maximumJoint }));
  assert.ok(maximumPenetration < .003, `${witness}: skin penetrates the real receiver by ${maximumPenetration}`);
  assert.ok(maximumHeadPenetration < .003, `receiver enters the head by ${maximumHeadPenetration} during the transfer`);
  assert.ok(maximumBend < 65, `the wrist bends ${maximumBend} degrees during the call`);
});

test('cradle transfers, the cord endpoint and a cold saved call use the same receiver pose', async t => {
  const h = await fixture(t), cold = (await h.models.create('neo'))!;
  for (const [phase, elapsed] of [['pickup', WAKE_CALL.grasp], ['pickup', 1.32], ['listening', 2], ['reply', 2.51], ['reply', 3.15]] as const) {
    const phone = h.draw(phase, elapsed), cord = h.set.getObjectByName('apartment-landline-cord') as THREE.Line;
    const end = new THREE.Vector3().fromBufferAttribute(cord.geometry.attributes.position, cord.geometry.attributes.position.count - 1).applyMatrix4(cord.matrixWorld);
    assert.ok(end.distanceTo(phone.localToWorld(new THREE.Vector3(0, -.405, .02))) < .005, 'cord must end at the actual receiver socket throughout its travel');
    if (elapsed === WAKE_CALL.grasp || elapsed === 3.15) {
      const held = h.rig.root.getObjectByName('neo-landline-handset')!, cradle = h.set.getObjectByName('apartment-landline-handset')!;
      assert.ok(held.getWorldPosition(new THREE.Vector3()).distanceTo(cradle.getWorldPosition(new THREE.Vector3())) < .005, 'hand-to-cradle ownership must not teleport the prop');
      assert.ok(held.getWorldQuaternion(new THREE.Quaternion()).angleTo(cradle.getWorldQuaternion(new THREE.Quaternion())) < .005, 'ownership must preserve orientation');
      const points = (root: THREE.Object3D) => { const sizes: number[] = []; root.traverse(object => { if (object instanceof THREE.Mesh) sizes.push(...object.geometry.attributes.position.array); }); return sizes; };
      assert.deepEqual(points(held), points(cradle), 'the held receiver cannot change its shape or size');
    }
    const read = (body: typeof cold) => [...body.bones].filter(([name]) => /^(shoulder|elbow|wrist|finger).*_L$/.test(name)).map(([, bone]) => bone.matrixWorld.toArray());
    const saved = read(h.rig); h.draw('reply', WAKE_CALL.reply); h.draw(phase, elapsed); assert.deepEqual(read(h.rig), saved, 're-entering a saved call restores the same joints');
    h.draw(phase, elapsed, cold); assert.deepEqual(read(cold), saved, 'cold loading needs no previous pickup animation');
  }
});
