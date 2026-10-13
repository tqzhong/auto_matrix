import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, ORACLE_VISIT } from '@auto_matrix/shared';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import type { MotionInput } from '../packages/client/src/agents/CharacterMotion.js';
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
  const models = new CharacterModels(), rig = models.create(world.agents.get('neo')!);
  t.after(() => { models.dispose(); globalThis.document = document; });
  await new Promise(resolve => setImmediate(resolve)); assert.ok(rig.hero);
  const center = FILM_SETS.film_oracle_home.center;
  rig.root.position.set(center.x + ORACLE_VISIT.neo.x, center.y - 1, center.z + ORACLE_VISIT.neo.z);
  const draw = (input: Partial<MotionInput>, yaw = ORACLE_VISIT.neo.yaw) => {
    rig.root.rotation.y = yaw;
    models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, ...input }, 4);
    rig.root.updateMatrixWorld(true);
  };
  const skin = rig.hero.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  return { rig, models, draw, skin, neo: world.agents.get('neo')! };
}

test('Neo keeps the cookie fixed in his grasp as he turns, carries it and lifts it to bite', async t => {
  const h = await setup(t), wrist = h.rig.hero!.bones.get('wrist_R')!;
  const input = { oracleDeparture: { phase: 'guiding' as const, elapsed: 0, rise: 3.8, role: 'neo' as const } };
  h.draw(input, 0);
  const position = h.rig.cookie!.position.clone(), rotation = h.rig.cookie!.quaternion.clone();
  for (const yaw of [0, .7, Math.PI / 2, Math.PI, -Math.PI / 2]) for (const elapsed of [0, .7, 1.2, 1.5, 2.3, 2.8]) {
    h.draw({ oracleDeparture: { phase: 'biting', elapsed, rise: 3.8, role: 'neo' } }, yaw);
    assert.equal(h.rig.cookie!.parent, wrist);
    assert.ok(h.rig.cookie!.position.distanceTo(position) < .001, 'turning cannot slide the cookie across the fingers');
    assert.ok(h.rig.cookie!.quaternion.angleTo(rotation) < .001, 'the held cookie cannot rotate independently of the gripping hand');
  }
});

test('thumb and index oppose the cookie faces during the handoff and the bite', async t => {
  const h = await setup(t);
  for (const input of [
    { oracleVisit: { phase: 'examining', elapsed: 9.2, role: 'neo' } },
    { oracleVisit: { phase: 'question', elapsed: 0, role: 'neo' } },
    { oracleDeparture: { phase: 'guiding', elapsed: 0, rise: 3.8, role: 'neo' } },
    { oracleDeparture: { phase: 'biting', elapsed: 1.5, rise: 3.8, role: 'neo' } },
  ] satisfies Partial<MotionInput>[]) {
    h.draw(input); h.skin.skeleton.update();
    const pads = [new THREE.Vector3(), new THREE.Vector3()], counts = [0, 0];
    const { position, skinIndex, skinWeight } = h.skin.geometry.attributes;
    for (let i = 0; i < position.count; i++) for (let j = 0; j < 4; j++) {
      const match = /^finger([12])-3_R$/.exec(h.skin.skeleton.bones[skinIndex.getComponent(i, j)].name);
      if (!match || skinWeight.getComponent(i, j) < .95) continue;
      const digit = Number(match[1]) - 1;
      pads[digit].add(h.skin.localToWorld(h.skin.getVertexPosition(i, new THREE.Vector3()))); counts[digit]++;
    }
    pads.forEach((pad, i) => h.rig.cookie!.worldToLocal(pad.divideScalar(counts[i])));
    assert.ok(pads[0].z < -.022 && pads[1].z > .022, `the pads must sit on opposite faces: ${pads.map(p => p.toArray())}`);
    for (const pad of pads) assert.ok(Math.abs(pad.x - .1) < .025 && Math.abs(pad.y) < .025,
      `the pad must contact the held rim, not float next to it: ${pad.toArray()}`);
  }
});

test('taking a bite does not change the thickness or detach the chocolate pieces', async t => {
  const h = await setup(t);
  h.draw({ oracleDeparture: { phase: 'biting', elapsed: 1.3, rise: 3.8, role: 'neo' } });
  const thickness = (name: string) => {
    const group = h.rig.cookie!.getObjectByName(name)!, base = group.children[0] as THREE.Mesh;
    const bounds = new THREE.Box3(), vertex = new THREE.Vector3();
    for (let i = 0; i < base.geometry.attributes.position.count; i++) {
      base.getVertexPosition(i, vertex); base.localToWorld(vertex); h.rig.cookie!.worldToLocal(vertex); bounds.expandByPoint(vertex);
    }
    for (const child of group.children.slice(1)) {
      const mesh = child as THREE.Mesh, chips = new THREE.Box3();
      for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
        mesh.getVertexPosition(i, vertex); mesh.localToWorld(vertex); h.rig.cookie!.worldToLocal(vertex); chips.expandByPoint(vertex);
      }
      assert.ok(chips.min.z <= bounds.max.z + .0001, 'chocolate cannot hover above the cookie');
    }
    return bounds.getSize(new THREE.Vector3()).z;
  };
  const whole = thickness('cookie-whole');
  h.draw({ oracleDeparture: { phase: 'biting', elapsed: 1.5, rise: 3.8, role: 'neo' } });
  assert.ok(Math.abs(thickness('cookie-bitten') - whole) < .0001, 'a bite removes the upper rim without making the cookie thicker');
});

test('the actual thumb and index surfaces touch the biscuit without penetrating it', async t => {
  const h = await setup(t), closest = new THREE.Vector3();
  for (const input of [
    { oracleVisit: { phase: 'examining', elapsed: 9.2, role: 'neo' } },
    { oracleVisit: { phase: 'question', elapsed: 0, role: 'neo' } },
    { oracleDeparture: { phase: 'guiding', elapsed: 0, rise: 3.8, role: 'neo' } },
    { oracleDeparture: { phase: 'biting', elapsed: 1.5, rise: 3.8, role: 'neo' } },
  ] satisfies Partial<MotionInput>[]) {
    h.draw(input); h.skin.skeleton.update();
    const cookie = h.rig.cookie!, group = cookie.children.find(child => child.visible)!;
    const biscuit = group.children[0] as THREE.Mesh, triangles: THREE.Triangle[] = [];
    const position = biscuit.geometry.attributes.position, index = biscuit.geometry.index;
    for (let i = 0; i < (index?.count ?? position.count); i += 3) {
      const triangle = new THREE.Triangle(...[0, 1, 2].map(j => biscuit.localToWorld(new THREE.Vector3()
        .fromBufferAttribute(position, index ? index.getX(i + j) : i + j))) as [THREE.Vector3, THREE.Vector3, THREE.Vector3]);
      if (triangle.getArea() > 1e-10) triangles.push(triangle);
    }
    const gaps = [Infinity, Infinity], { skinIndex, skinWeight } = h.skin.geometry.attributes;
    for (let i = 0; i < skinIndex.count; i++) {
      const joint = [0, 1, 2, 3].find(j => skinWeight.getComponent(i, j) > .5 && /^finger[12]-3_R$/.test(h.skin.skeleton.bones[skinIndex.getComponent(i, j)].name));
      if (joint === undefined) continue;
      const digit = Number(h.skin.skeleton.bones[skinIndex.getComponent(i, joint)].name[6]) - 1;
      const point = h.skin.localToWorld(h.skin.getVertexPosition(i, new THREE.Vector3()));
      for (const triangle of triangles) gaps[digit] = Math.min(gaps[digit], triangle.closestPointToPoint(point, closest).distanceTo(point));
      const local = cookie.worldToLocal(point);
      // This right-hand patch remains solid both before and after the upper bite.
      if (local.x > .065 && local.x < .12 && Math.abs(local.y) < .03)
        assert.ok(Math.abs(local.z) >= .0123, `finger ${digit + 1} penetrates the biscuit: ${local.toArray()}`);
    }
    gaps.forEach((gap, i) => assert.ok(gap < .008, `finger ${i + 1} floats away from the biscuit: ${gap}`));
  }
});

test('cookie gestures restore from saved input after another action or a fresh character', async t => {
  const h = await setup(t), fresh = h.models.create(h.neo);
  await new Promise(resolve => setImmediate(resolve)); assert.ok(fresh.hero);
  fresh.root.position.copy(h.rig.root.position); fresh.root.quaternion.copy(h.rig.root.quaternion);
  const neutral = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 };
  const names = ['shoulder_R', 'elbow_R', 'wrist_R', ...[1, 2, 3, 4, 5].flatMap(f => [1, 2, 3].map(s => `finger${f}-${s}_R`))];
  for (const input of [
    { oracleVisit: { phase: 'examining', elapsed: 8.5, role: 'neo' } },
    { oracleVisit: { phase: 'examining', elapsed: 9.2, role: 'neo' } },
    { oracleDeparture: { phase: 'guiding', elapsed: 0, rise: 3.8, role: 'neo' } },
    { oracleDeparture: { phase: 'biting', elapsed: 1.5, rise: 3.8, role: 'neo' } },
    { oracleDeparture: { phase: 'leaving', elapsed: 0, rise: 3.8, role: 'neo' } },
  ] satisfies Partial<MotionInput>[]) {
    h.draw(input);
    const positions = names.map(name => h.rig.hero!.bones.get(name)!.getWorldPosition(new THREE.Vector3()));
    const prop = h.rig.cookie!.matrixWorld.clone(), bitten = h.rig.cookie!.getObjectByName('cookie-bitten')!.visible;
    h.draw({ pills: { phase: 'taking', elapsed: 7.3, choice: 'red', role: 'neo' } });
    assert.equal(h.rig.cookie!.visible, false, 'changing actions hides the cookie');
    h.draw(input);
    fresh.root.quaternion.copy(h.rig.root.quaternion);
    h.models.animate(fresh, 0, { ...neutral, ...JSON.parse(JSON.stringify(input)) }, 4); fresh.root.updateMatrixWorld(true);
    for (const body of [h.rig, fresh]) {
      names.forEach((name, i) => assert.ok(body.hero!.bones.get(name)!.getWorldPosition(new THREE.Vector3()).distanceTo(positions[i]) < .001,
        `${name} depends on the preceding action (${body === fresh ? 'fresh' : 'restored'}, ${JSON.stringify(input)}): ${body.hero!.bones.get(name)!.getWorldPosition(new THREE.Vector3()).distanceTo(positions[i])}`));
      body.cookie!.matrixWorld.elements.forEach((value, i) => assert.ok(Math.abs(value - prop.elements[i]) < .001));
      assert.equal(body.cookie!.getObjectByName('cookie-bitten')!.visible, bitten);
      for (const name of names.filter(name => name.startsWith('finger'))) assert.ok(body.hero!.bones.get(name)!.position.distanceTo(body.hero!.rest.get(name)!) < 1e-8,
        `gripping must not stretch ${name}`);
    }
  }
});

test('receiving and biting the cookie do not fold the wrist back against the forearm', async t => {
  const h = await setup(t), bone = (name: string) => h.rig.hero!.bones.get(name)!.getWorldPosition(new THREE.Vector3());
  for (const phase of ['receiving', 'biting']) for (let frame = 0; frame <= 60; frame++) {
    const elapsed = phase === 'receiving' ? 7.8 + frame * .05 : frame * .05;
    h.draw(phase === 'receiving' ? { oracleVisit: { phase: 'examining', elapsed, role: 'neo' } }
      : { oracleDeparture: { phase: 'biting', elapsed, rise: 3.8, role: 'neo' } });
    const wrist = bone('wrist_R'), forearm = wrist.clone().sub(bone('elbow_R')).normalize();
    const hand = bone('finger3-1_R').sub(wrist).normalize();
    assert.ok(hand.dot(forearm) > .6, `${phase} folds the wrist at ${elapsed}: ${hand.dot(forearm)}`);
  }
});

test('the raised hand stays outside Neo actual head and neck skin during the bite', async t => {
  const h = await setup(t), { position, skinIndex, skinWeight } = h.skin.geometry.attributes, index = h.skin.geometry.index!;
  const head: boolean[] = [], hands: number[] = [];
  for (let i = 0; i < position.count; i++) {
    let skull = 0, hand = 0;
    for (let j = 0; j < 4; j++) {
      const name = h.skin.skeleton.bones[skinIndex.getComponent(i, j)].name, weight = skinWeight.getComponent(i, j);
      if (/head|neck/.test(name)) skull += weight;
      if (/^(wrist|finger).*_R$/.test(name)) hand += weight;
    }
    head.push(skull > .5); if (hand > .5) hands.push(i);
  }
  for (const elapsed of [.9, 1.2, 1.5, 1.9, 2.2]) {
    h.draw({ oracleDeparture: { phase: 'biting', elapsed, rise: 3.8, role: 'neo' } }); h.skin.skeleton.update();
    const vertices = Array.from({ length: position.count }, (_, i) => h.skin.localToWorld(h.skin.getVertexPosition(i, new THREE.Vector3())));
    const triangles: THREE.Triangle[] = [], bounds = new THREE.Box3();
    for (let i = 0; i < index.count; i += 3) {
      const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
      if (!ids.every(v => head[v])) continue;
      const triangle = new THREE.Triangle(...ids.map(v => vertices[v]) as [THREE.Vector3, THREE.Vector3, THREE.Vector3]);
      if (triangle.getArea() < 1e-10) continue;
      triangles.push(triangle); ids.forEach(v => bounds.expandByPoint(vertices[v]));
    }
    const contact = new THREE.Vector3(), best = new THREE.Vector3(), normal = new THREE.Vector3();
    for (const i of hands) {
      if (!bounds.containsPoint(vertices[i])) continue;
      let distance = Infinity, face: THREE.Triangle | undefined;
      for (const triangle of triangles) {
        triangle.closestPointToPoint(vertices[i], contact); const gap = contact.distanceToSquared(vertices[i]);
        if (gap < distance) { distance = gap; best.copy(contact); face = triangle; }
      }
      const signed = vertices[i].clone().sub(best).dot(face!.getNormal(normal));
      assert.ok(signed >= -.003, `the hand penetrates the head or neck at ${elapsed}: ${signed}`);
    }
  }
});
