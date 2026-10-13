import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, SPOON_LESSON, spoonLessonBend, type SpoonLesson } from '@auto_matrix/shared';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

async function setup(t: TestContext) {
  const glb = await readFile(new URL('../packages/client/public/assets/characters/neo.glb', import.meta.url));
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
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {},
  }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const models = new CharacterModels(), rig = models.create(world.agents.get('neo')!), boy = models.create(world.agents.get('spoon_boy')!);
  t.after(() => { models.dispose(); globalThis.document = document; });
  await new Promise(resolve => setImmediate(resolve)); assert.ok(rig.hero);
  const center = FILM_SETS.film_oracle_home.center;
  for (const [body, place] of [[rig, SPOON_LESSON.neo], [boy, SPOON_LESSON.boy]] as const) {
    body.root.position.set(center.x + place.x, center.y - 1, center.z + place.z); body.root.rotation.y = place.yaw;
  }
  const draw = (phase: SpoonLesson['phase'], elapsed: number, bend = 0) => {
    const lesson = { phase, elapsed };
    for (const [body, role] of [[rig, 'neo'], [boy, 'boy']] as const) {
      models.animate(body, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, spoon: spoonLessonBend(lesson, role, bend),
        spoonLesson: { ...lesson, role }, seated: role === 'boy', floorSeated: role === 'boy' }, 4);
      body.root.updateMatrixWorld(true);
    }
  };
  const skin = rig.hero.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  const pads = () => {
    skin.skeleton.update();
    const result = [new THREE.Vector3(), new THREE.Vector3()], counts = [0, 0];
    const { position, skinIndex, skinWeight } = skin.geometry.attributes;
    for (let i = 0; i < position.count; i++) for (let j = 0; j < 4; j++) {
      const match = /^finger([12])-3_R$/.exec(skin.skeleton.bones[skinIndex.getComponent(i, j)].name);
      if (!match || skinWeight.getComponent(i, j) < .95) continue;
      result[Number(match[1]) - 1].add(skin.localToWorld(skin.getVertexPosition(i, new THREE.Vector3()))); counts[Number(match[1]) - 1]++;
    }
    return result.map((pad, i) => pad.divideScalar(counts[i]));
  };
  return { rig, boy, models, draw, pads, skin, neo: world.agents.get('neo')! };
}

test('Neo pinches the spoon with opposing pads in the same grip during transfer, focus and rising', async t => {
  const h = await setup(t);
  for (const [phase, elapsed] of [['receiving', 1.11], ['receiving', 2.4], ['focus', 0], ['understood', 0], ['rising', 1.2]] as const) {
    for (const bend of [0, .5, 1]) {
      h.draw(phase, elapsed, bend);
      const pads = h.pads().map(pad => h.rig.spoon!.root.worldToLocal(pad));
      assert.ok(pads[0].x > .055 && pads[1].x < -.045, `${phase}: pads must oppose the flat handle: ${pads.map(p => p.toArray())}`);
      for (const [i, pad] of pads.entries()) {
        assert.ok(Math.abs(pad.y - .08) < .035 && Math.abs(pad.z) < .035, `${phase}: pad ${i} slips off the gripping point: ${pad.toArray()}`);
      }
    }
  }
});

test('accepting the spoon keeps the same contact, hand and prop orientation across ownership and focus boundaries', async t => {
  const h = await setup(t), bone = (name: string) => h.rig.hero!.bones.get(name)!;
  const snapshot = () => ({
    joints: ['wrist_R', 'finger1-3_R', 'finger2-3_R', 'finger3-3_R'].map(name => bone(name).getWorldPosition(new THREE.Vector3())),
    owner: h.rig.spoon?.root.visible ? h.rig.spoon.root : h.boy.spoon!.root,
  });
  for (const [from, to] of [[['offered', 0], ['receiving', .0001]], [['receiving', 1.0999], ['receiving', 1.1001]],
    [['receiving', 2.4], ['focus', 0]], [['rising', 2.6], ['done', 0]]] as const) {
    h.draw(...from); const a = snapshot(), contact = a.owner.localToWorld(new THREE.Vector3(0, .08, 0));
    const rotation = a.owner.getWorldQuaternion(new THREE.Quaternion());
    h.draw(...to); const b = snapshot();
    assert.ok(contact.distanceTo(b.owner.localToWorld(new THREE.Vector3(0, .08, 0))) < .002, 'ownership must not snap the handle');
    assert.ok(rotation.angleTo(b.owner.getWorldQuaternion(new THREE.Quaternion())) < .01, 'ownership must not rotate the handle');
    a.joints.forEach((point, i) => assert.ok(point.distanceTo(b.joints[i]) < .002, `joint ${i} jumps at ${from}`));
  }
});

test('a saved spoon pose restores after another hand action or a fresh model without stretching finger bones', async t => {
  const h = await setup(t), fresh = h.models.create(h.neo);
  await new Promise(resolve => setImmediate(resolve)); assert.ok(fresh.hero);
  fresh.root.position.copy(h.rig.root.position); fresh.root.quaternion.copy(h.rig.root.quaternion);
  const neutral = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 };
  const names = ['spine', 'shoulder_R', 'elbow_R', 'wrist_R', ...[1, 2, 3, 4, 5].flatMap(f => [1, 2, 3].map(s => `finger${f}-${s}_R`))];
  for (const [phase, elapsed] of [['receiving', .5], ['receiving', 1.2], ['focus', 0], ['rising', 1.5]] as const) {
    h.draw(phase, elapsed, .5);
    const positions = names.map(name => h.rig.hero!.bones.get(name)!.getWorldPosition(new THREE.Vector3()));
    h.models.animate(h.rig, 0, { ...neutral, pills: { phase: 'taking', elapsed: 7.3, choice: 'red', role: 'neo' } }, 4);
    assert.notEqual(h.rig.spoon?.root.visible, true, 'the abandoned prop must hide while using a different hand action');
    h.draw(phase, elapsed, .5);
    const lesson = JSON.parse(JSON.stringify({ phase, elapsed }));
    h.models.animate(fresh, 0, { ...neutral, spoon: spoonLessonBend(lesson, 'neo', .5), spoonLesson: { ...lesson, role: 'neo' } }, 4);
    fresh.root.updateMatrixWorld(true);
    for (const body of [h.rig, fresh]) {
      names.forEach((name, i) => assert.ok(body.hero!.bones.get(name)!.getWorldPosition(new THREE.Vector3()).distanceTo(positions[i]) < .001,
        `${phase}: ${name} depends on the previously displayed action`));
      for (const name of names.filter(name => name.startsWith('finger'))) assert.ok(body.hero!.bones.get(name)!.position.distanceTo(body.hero!.rest.get(name)!) < 1e-8,
        `reaching the prop must not stretch ${name}`);
    }
  }
});

test('the actual fingertip skin touches the metal without entering the straight gripping section', async t => {
  const h = await setup(t), closest = new THREE.Vector3();
  for (const [phase, elapsed] of [['receiving', 1.1], ['receiving', 1.7], ['focus', 0]] as const) for (const bend of [0, .5, 1]) {
    h.draw(phase, elapsed, bend); h.skin.skeleton.update();
    const spoon = h.rig.spoon!.root, mesh = spoon.children[0] as THREE.Mesh, triangles: THREE.Triangle[] = [];
    const positions = mesh.geometry.attributes.position, index = mesh.geometry.index!;
    for (let i = 0; i < index.count; i += 3) {
      const triangle = new THREE.Triangle(...[0, 1, 2].map(j => mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(positions, index.getX(i + j)))) as [THREE.Vector3, THREE.Vector3, THREE.Vector3]);
      if (triangle.getArea() > 1e-10) triangles.push(triangle);
    }
    const gaps = [Infinity, Infinity], { skinIndex, skinWeight } = h.skin.geometry.attributes;
    for (let i = 0; i < skinIndex.count; i++) {
      const joint = [0, 1, 2, 3].find(j => skinWeight.getComponent(i, j) > .5 && /^finger[12]-3_R$/.test(h.skin.skeleton.bones[skinIndex.getComponent(i, j)].name));
      if (joint === undefined) continue;
      const digit = Number(h.skin.skeleton.bones[skinIndex.getComponent(i, joint)].name[6]) - 1;
      const point = h.skin.localToWorld(h.skin.getVertexPosition(i, new THREE.Vector3()));
      for (const triangle of triangles) gaps[digit] = Math.min(gaps[digit], triangle.closestPointToPoint(point, closest).distanceTo(point));
      const local = spoon.worldToLocal(point);
      if (local.y > .005 && local.y < .165) {
        const radius = .045 - .013 * local.y / .65;
        const side = Math.max(...Array.from({ length: 8 }, (_, k) => {
          const angle = (k + .5) * Math.PI / 4;
          return Math.cos(angle) * local.x / radius + Math.sin(angle) * local.z / (radius * .24);
        }));
        assert.ok(side >= Math.cos(Math.PI / 8) - .005, `finger ${digit + 1} penetrates the handle at bend ${bend}: ${local.toArray()}`);
      }
    }
    gaps.forEach((gap, i) => assert.ok(gap < .008, `finger ${i + 1} floats away from the handle: ${gap}`));
  }
});

test('reaching for the spoon does not fold the hand sharply back against the forearm', async t => {
  const h = await setup(t), bone = (name: string) => h.rig.hero!.bones.get(name)!.getWorldPosition(new THREE.Vector3());
  for (let frame = 0; frame <= 48; frame++) {
    h.draw('receiving', frame * .05);
    const wrist = bone('wrist_R'), forearm = wrist.clone().sub(bone('elbow_R')).normalize();
    const hand = bone('finger3-1_R').sub(wrist).normalize();
    assert.ok(hand.dot(forearm) > .6, `wrist folds back at ${frame * .05}: ${hand.dot(forearm)}`);
  }
});
