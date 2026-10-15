import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, interludeRoot, type InterludeGesture } from '@auto_matrix/shared';
import { HeroModels, type HeroRig } from '../packages/client/src/agents/HeroModel.js';
import { advanceMotion, newMotion } from '../packages/client/src/agents/CharacterMotion.js';

async function fixture(t: TestContext) {
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture()), assets = new Map<string, Promise<any>>();
  t.mock.method(models as any, 'load', (id: string) => {
    if (!assets.has(id)) assets.set(id, (async () => {
      const raw = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url)), length = raw.readUInt32LE(12);
      const doc = JSON.parse(raw.subarray(20, 20 + length).toString());
      for (const material of doc.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
      doc.images = []; doc.textures = [];
      const json = Buffer.from(JSON.stringify(doc)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
      const bin = raw.subarray(20 + length), data = Buffer.alloc(20 + padded.length + bin.length);
      data.writeUInt32LE(0x46546c67); data.writeUInt32LE(2, 4); data.writeUInt32LE(data.length, 8);
      data.writeUInt32LE(padded.length, 12); data.writeUInt32LE(0x4e4f534a, 16); padded.copy(data, 20); bin.copy(data, 20 + padded.length);
      return new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '');
    })());
    return assets.get(id)!;
  });
  t.after(() => models.dispose());
  const motions = new Map<HeroRig, ReturnType<typeof newMotion>>();
  const actor = async (role: 'neo' | 'cypher') => {
    const rig = (await models.create('neo', undefined, role === 'cypher' ? role : undefined))!; motions.set(rig, newMotion()); return rig;
  };
  const draw = (rig: HeroRig, gesture: InterludeGesture) => {
    const at = interludeRoot(gesture.kind, gesture.role, gesture), center = FILM_SETS[gesture.kind === 'steak' ? 'film_cypher_restaurant' : 'film_neb_deck'].center;
    rig.root.position.set(center.x + at.x, center.y - 1, center.z + at.z); rig.root.rotation.y = at.yaw;
    const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: gesture.kind === 'console', interlude: gesture };
    const motion = motions.get(rig)!;
    models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); rig.root.updateMatrixWorld(true);
  };
  return { actor, draw };
}

const tips = new WeakMap<THREE.SkinnedMesh, Map<string, number[][]>>();
function bends(rig: HeroRig, side: 'R' | 'L') {
  const skin = rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh, a = skin.geometry.attributes;
  if (!tips.has(skin)) tips.set(skin, new Map());
  const groups = tips.get(skin)!;
  if (!groups.has(side)) {
    const vertices = Array.from({ length: 5 }, () => [] as number[]);
    for (let v = 0; v < a.position.count; v++) for (let j = 0; j < 4; j++) {
      const match = new RegExp(`^finger([1-5])-3_${side}$`).exec(skin.skeleton.bones[a.skinIndex.getComponent(v, j)].name);
      if (match && a.skinWeight.getComponent(v, j) > .95) vertices[Number(match[1]) - 1].push(v);
    }
    groups.set(side, vertices);
  }
  return Array.from({ length: 5 }, (_, i) => {
    const joints = [1, 2, 3].map(j => rig.bones.get(`finger${i + 1}-${j}_${side}`)!);
    const pad = new THREE.Vector3(), vertices = groups.get(side)![i], count = vertices.length;
    for (const v of vertices) pad.add(skin.localToWorld(skin.getVertexPosition(v, new THREE.Vector3())));
    assert.ok(count > 10, 'measure the actual bound distal anatomy'); pad.divideScalar(count);
    const p = joints.map(j => j.getWorldPosition(new THREE.Vector3())); p.push(pad);
    const segments = [0, 1, 2].map(j => p[j + 1].clone().sub(p[j]).normalize());
    return { digit: i + 1, PIP: segments[0].angleTo(segments[1]) * 180 / Math.PI,
      DIP: segments[1].angleTo(segments[2]) * 180 / Math.PI,
      curvature: new THREE.Vector3().crossVectors(segments[0], segments[1]).dot(new THREE.Vector3().crossVectors(segments[1], segments[2])), points: p };
  });
}

for (const [label, role, kind, phase, times, sides] of [
  ['cutlery', 'cypher', 'steak', 'performing', [0, 1.6, 3.4, 5.8, 8.05], ['R', 'L']],
  ['wine stem', 'cypher', 'steak', 'performing', [14.5, 16, 20, 24.4], ['L']],
  ['jug handle', 'cypher', 'console', 'performing', [3.3, 4.5, 5.5, 7.5, 8.5], ['L']],
  ['Cypher mug', 'cypher', 'console', 'responding', [1.2, 4.6, 7.5, 9.3], ['R']],
  ['Neo mug', 'neo', 'console', 'sipping', [0, 1.8, 4.6], ['R']],
] as const) {
  test(`${label}: finger joints curl together without folded-back middle or distal segments`, async t => {
    const h = await fixture(t), rig = await h.actor(role); let maximumPIP = 0, maximumDIP = 0;
    for (const elapsed of times) {
      const gesture = { kind, phase, elapsed, role, physicalConsole: true, physicalPour: true, physicalSteak: true };
      h.draw(rig, gesture);
      for (const side of sides) for (const finger of bends(rig, side)) {
        maximumPIP = Math.max(maximumPIP, finger.PIP); maximumDIP = Math.max(maximumDIP, finger.DIP);
        assert.ok(finger.PIP <= (finger.digit === 1 ? 100 : 115), `${label}/${side}/${elapsed}: digit ${finger.digit} folds its middle joint ${finger.PIP} degrees`);
        assert.ok(finger.DIP <= 90, `${label}/${side}/${elapsed}: digit ${finger.digit} folds its distal joint ${finger.DIP} degrees`);
        if (finger.digit > 1) assert.ok(finger.curvature >= -.015, `${label}/${side}/${elapsed}: digit ${finger.digit} reverses its curl between joints`);
      }
    }
    t.diagnostic(JSON.stringify({ maximumPIP, maximumDIP }));
  });
}

test('grasping, carrying and releasing cannot snap finger joints between adjacent saved instants', async t => {
  const h = await fixture(t); let largest = 0, witness = '';
  for (const [role, kind, phase, start, end, sides] of [
    ['cypher', 'steak', 'performing', 0, 26, ['R', 'L']],
    ['cypher', 'console', 'performing', 2.3, 9.6, ['L']],
    ['cypher', 'console', 'responding', 0, 10.8, ['R']],
    ['neo', 'console', 'accepting', 0, 2.2, ['R']],
    ['neo', 'console', 'sipping', 0, 4.8, ['R']],
    ['neo', 'console', 'returning', 0, 3.8, ['R']],
  ] as const) {
    const rig = await h.actor(role), names = sides.flatMap(side => [`shoulder_${side}`, `elbow_${side}`, `wrist_${side}`, ...Array.from({ length: 15 }, (_, i) => `finger${Math.floor(i / 3) + 1}-${i % 3 + 1}_${side}`)]);
    let previous: THREE.Quaternion[] | undefined, previousPositions: THREE.Vector3[] | undefined, maximum = 0, maximumWrist = 0, maximumTravel = 0, where = '';
    let anatomySamples = 0, maximumPIP = 0, maximumDIP = 0;
    for (let frame = Math.round(start * 100); frame <= Math.round(end * 100); frame++) {
      h.draw(rig, { kind, phase, elapsed: frame / 100, role, physicalConsole: true, physicalPour: true, physicalSteak: true });
      const current = names.map(name => rig.bones.get(name)!.getWorldQuaternion(new THREE.Quaternion()));
      const positions = names.map(name => rig.bones.get(name)!.getWorldPosition(new THREE.Vector3()));
      if (frame % 5 === 0) for (const side of sides) for (const finger of bends(rig, side)) {
        anatomySamples++; maximumPIP = Math.max(maximumPIP, finger.PIP); maximumDIP = Math.max(maximumDIP, finger.DIP);
        const label = `${role}/${kind}/${phase}/${frame / 100}/${side}/digit ${finger.digit}`;
        assert.ok(finger.PIP <= (finger.digit === 1 ? 100 : 115), `${label}: middle joint folds ${finger.PIP} degrees during the transition`);
        assert.ok(finger.DIP <= 90, `${label}: distal joint folds ${finger.DIP} degrees during the transition`);
      }
      if (previous) for (let i = 0; i < current.length; i++) {
        const change = current[i].angleTo(previous[i]);
        if (names[i].startsWith('wrist')) maximumWrist = Math.max(maximumWrist, change);
        if (change > maximum) { maximum = change; where = `${role}/${kind}/${phase}/${frame / 100}: ${names[i]}`; }
        if (change > largest) { largest = change; witness = where; }
        const travel = positions[i].distanceTo(previousPositions![i]); maximumTravel = Math.max(maximumTravel, travel);
        assert.ok(travel < .08, `${role}/${kind}/${phase}/${frame / 100}: ${names[i]} teleports ${travel} world units in 10ms`);
      }
      previous = current; previousPositions = positions;
    }
    t.diagnostic(JSON.stringify({ maximum, maximumWrist, maximumTravel, anatomySamples, maximumPIP, maximumDIP, where }));
  }
  t.diagnostic(JSON.stringify({ largestJointStep: largest }));
  assert.ok(largest < .15, `${witness} snaps ${largest * 180 / Math.PI} degrees in 10ms`);
});

test('cold saved grips and releases reproduce the same actual finger skin after unrelated gestures', async t => {
  const h = await fixture(t), warm = { neo: await h.actor('neo'), cypher: await h.actor('cypher') };
  const snapshot = (rig: HeroRig) => ({
    points: ['R', 'L'].flatMap(side => bends(rig, side as 'R' | 'L').flatMap(finger => finger.points)),
    rotations: ['R', 'L'].flatMap(side => [`shoulder_${side}`, `elbow_${side}`, `wrist_${side}`,
      ...Array.from({ length: 15 }, (_, i) => `finger${Math.floor(i / 3) + 1}-${i % 3 + 1}_${side}`)]).map(name => rig.bones.get(name)!.getWorldQuaternion(new THREE.Quaternion())),
  });
  for (const [role, kind, phase, elapsed] of [
    ['cypher', 'steak', 'performing', 4.37], ['cypher', 'steak', 'performing', 8.05],
    ['cypher', 'steak', 'performing', 11.39], ['cypher', 'steak', 'performing', 13.8],
    ['cypher', 'steak', 'performing', 20], ['cypher', 'steak', 'performing', 24.62],
    ['cypher', 'console', 'performing', 2.8], ['cypher', 'console', 'performing', 3.21],
    ['cypher', 'console', 'performing', 5.5], ['cypher', 'console', 'performing', 8.75],
    ['cypher', 'console', 'responding', .65], ['cypher', 'console', 'responding', 4.6],
    ['cypher', 'console', 'responding', 9.54], ['neo', 'console', 'accepting', .77],
    ['neo', 'console', 'sipping', 1.8], ['neo', 'console', 'returning', 2.68],
  ] as const) {
    const saved = { role, kind, phase, elapsed, physicalConsole: true, physicalPour: true, physicalSteak: true };
    const fresh = await h.actor(role); h.draw(fresh, saved); const expected = snapshot(fresh);
    h.draw(warm[role], { ...saved, kind: role === 'neo' ? 'meal' : 'steak', phase: 'performing', elapsed: 20 });
    h.draw(warm[role], { ...saved, kind: 'console', phase: 'sipping', elapsed: 2 });
    h.draw(warm[role], saved);
    const actual = snapshot(warm[role]);
    actual.points.forEach((point, i) => assert.ok(point.distanceTo(expected.points[i]) < 1e-6,
      `${role}/${kind}/${phase}/${elapsed}: actual finger anatomy ${i} depends on loading or gesture history`));
    actual.rotations.forEach((rotation, i) => assert.ok(rotation.angleTo(expected.rotations[i]) < 1e-6,
      `${role}/${kind}/${phase}/${elapsed}: arm/finger orientation ${i} depends on loading or gesture history`));
  }
});
