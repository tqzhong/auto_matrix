import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { FILM_SETS, SPOON_LESSON, spoonLessonBend, type SpoonLesson } from '@auto_matrix/shared';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

async function setup(t: TestContext, deferred = false) {
  const glb = await readFile(new URL('../packages/client/public/assets/characters/neo.glb', import.meta.url));
  const length = glb.readUInt32LE(12), source = JSON.parse(glb.subarray(20, 20 + length).toString());
  for (const material of source.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
  source.images = []; source.textures = [];
  const json = Buffer.from(JSON.stringify(source)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = glb.subarray(20 + length), buffer = Buffer.alloc(20 + padded.length + bin.length);
  buffer.writeUInt32LE(0x46546c67, 0); buffer.writeUInt32LE(2, 4); buffer.writeUInt32LE(buffer.length, 8);
  buffer.writeUInt32LE(padded.length, 12); buffer.writeUInt32LE(0x4e4f534a, 16); padded.copy(buffer, 20); bin.copy(buffer, 20 + padded.length);
  const asset = await new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '');
  const hands = await readFile(new URL('../packages/client/public/assets/characters/oracle-park-hands.glb', import.meta.url));
  const anatomy = await new GLTFLoader().parseAsync(hands.buffer.slice(hands.byteOffset, hands.byteOffset + hands.byteLength), '');
  const deliveries: (() => void)[] = [], delivered: THREE.Group[] = [];
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async url => {
    if (!String(url).endsWith('/oracle-park-hands.glb')) return asset;
    if (deferred) await new Promise<void>(resolve => deliveries.push(resolve));
    const scene = clone(anatomy.scene); delivered.push(scene); return { ...anatomy, scene };
  });
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
  const deliver = async () => { deliveries.splice(0).forEach(resolve => resolve()); await new Promise(resolve => setImmediate(resolve)); };
  return { rig, boy, models, draw, pads, skin, deliver, delivered, anatomy, neo: world.agents.get('neo')!, boyState: world.agents.get('spoon_boy')! };
}

test('receiving the spoon blends the real forearm into and out of the contact solve without snapping its elbow', async t => {
  const h = await setup(t), bones = h.rig.hero!.bones;
  const patch = h.rig.hero!.wardrobe.find(part => part.mesh.userData.wristSkin)!.mesh as THREE.SkinnedMesh;
  const { skinIndex, skinWeight } = patch.geometry.attributes;
  const probes = Array.from({ length: skinIndex.count }, (_, i) => i).filter(i => [0, 1, 2, 3].some(j =>
    skinWeight.getComponent(i, j) > .05 && patch.skeleton.bones[skinIndex.getComponent(i, j)].name.startsWith('forearm_twist_R_')));
  assert.ok(probes.length > 200);
  let before: THREE.Vector3[] | undefined, rotations: THREE.Quaternion[] | undefined, maximumSkinStep = 0, maximumTurn = 0;
  for (let frame = 0; frame <= 240; frame++) {
    h.draw('receiving', frame / 100); patch.skeleton.update();
    const points = probes.map(vertex => patch.localToWorld(patch.getVertexPosition(vertex, new THREE.Vector3())));
    const now = ['elbow_R', 'forearm_twist_R_1', 'forearm_twist_R_2', 'forearm_twist_R_3'].map(name => bones.get(name)!.getWorldQuaternion(new THREE.Quaternion()));
    if (before) {
      maximumSkinStep = Math.max(maximumSkinStep, ...points.map((point, i) => point.distanceTo(before![i])));
      maximumTurn = Math.max(maximumTurn, ...now.map((q, i) => q.angleTo(rotations![i])));
    }
    before = points; rotations = now;
  }
  t.diagnostic(JSON.stringify({ probes: probes.length, maximumSkinStep, maximumTurn }));
  assert.ok(maximumTurn < .1, `starting or releasing the reach flips the forearm by ${maximumTurn} radians`);
  assert.ok(maximumSkinStep < .03, `the actual forearm surface jumps by ${maximumSkinStep} world units`);
});

test('the spoon boy enters and releases the same contact smoothly across his visible arm surfaces', async t => {
  const h = await setup(t), meshes: { mesh: THREE.Mesh; vertex: number }[] = [];
  h.boy.elbows[0].traverseVisible(object => {
    if (!(object instanceof THREE.Mesh)) return;
    for (let i = 0; i < object.geometry.attributes.position.count; i += 3) meshes.push({ mesh: object, vertex: i });
  });
  assert.ok(meshes.length > 100, 'measure the delivered forearm, hand and finger surfaces');
  let maximumSkinStep = 0, maximumTurn = 0, worst = '';
  for (const [phase, seconds] of [['demonstrating', 3.4], ['receiving', 2.4]] as const) {
    let before: THREE.Vector3[] | undefined, rotation: THREE.Quaternion | undefined;
    for (let frame = 0; frame <= seconds * 100; frame++) {
      h.draw(phase, frame / 100);
      const now = h.boy.elbows[0].getWorldQuaternion(new THREE.Quaternion());
      const points = meshes.map(({ mesh, vertex }) => mesh.localToWorld(mesh.getVertexPosition(vertex, new THREE.Vector3())));
      if (before) {
        maximumTurn = Math.max(maximumTurn, now.angleTo(rotation!));
        points.forEach((point, i) => {
          const step = point.distanceTo(before![i]);
          if (step > maximumSkinStep) {
            maximumSkinStep = step;
            const { mesh, vertex } = meshes[i];
            worst = `${phase} ${frame / 100}: ${mesh.name}/${mesh.geometry.type} vertex ${vertex}, parent ${mesh.parent?.name}`;
          }
        });
      }
      before = points; rotation = now;
      if ([0, 110, 132, 175, 240, 320, 340].includes(frame)) {
        const fresh = h.models.create(h.boyState), cold: { mesh: THREE.Mesh; vertex: number }[] = [];
        await new Promise(resolve => setImmediate(resolve));
        fresh.root.position.copy(h.boy.root.position); fresh.root.quaternion.copy(h.boy.root.quaternion);
        fresh.elbows[0].traverseVisible(object => {
          if (object instanceof THREE.Mesh) for (let i = 0; i < object.geometry.attributes.position.count; i += 3) cold.push({ mesh: object, vertex: i });
        });
        const lesson = { phase, elapsed: frame / 100 };
        h.models.animate(fresh, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0,
          spoon: spoonLessonBend(lesson, 'boy', 0), spoonLesson: { ...lesson, role: 'boy' }, seated: true, floorSeated: true }, 4);
        fresh.root.updateMatrixWorld(true); assert.equal(cold.length, meshes.length);
        cold.forEach(({ mesh, vertex }, i) => assert.ok(points[i].distanceTo(mesh.localToWorld(mesh.getVertexPosition(vertex, new THREE.Vector3()))) < 1e-7,
          'a cold boy must reconstruct the same saved grip and withdrawal surface'));
      }
    }
  }
  t.diagnostic(JSON.stringify({ probes: meshes.length, maximumSkinStep, maximumTurn, worst }));
  assert.ok(maximumTurn < .1, `the child's forearm flips by ${maximumTurn} radians when contact starts or ends`);
  assert.ok(maximumSkinStep < .04, `the child's visible skin jumps by ${maximumSkinStep} world units`);
});

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


test('the boy pinches the same straight spoon stem with actual opposing thumb and index skin', async t => {
  const h = await setup(t);
  const skin = h.boy.root.getObjectByName('oracle-hand-skin-R') as THREE.SkinnedMesh | undefined;
  assert.ok(skin instanceof THREE.SkinnedMesh, 'the spoon boy still uses disconnected balls instead of articulated hand skin');
  for (const [phase, elapsed] of [['demonstrating', 0], ['demonstrating', 2.5], ['offered', 0], ['receiving', 1.099]] as const) {
    h.draw(phase, elapsed, 1); skin.skeleton.update();
    const spoon = h.boy.spoon!.root, pads = [new THREE.Vector3(), new THREE.Vector3()], counts = [0, 0];
    const { skinIndex, skinWeight } = skin.geometry.attributes;
    const gaps = [Infinity, Infinity];
    for (let vertex = 0; vertex < skinIndex.count; vertex++) {
      const point = spoon.worldToLocal(skin.localToWorld(skin.getVertexPosition(vertex, new THREE.Vector3())));
      for (let j = 0; j < 4; j++) {
        const match = /^finger([12])-3_R$/.exec(skin.skeleton.bones[skinIndex.getComponent(vertex, j)].name);
        if (!match || skinWeight.getComponent(vertex, j) < .95) continue;
        const digit = Number(match[1]) - 1; pads[digit].add(point); counts[digit]++;
        if (point.y < .005 || point.y > .165) continue;
        const radius = .045 - .013 * point.y / .65;
        const distance = Math.max(...Array.from({ length: 8 }, (_, k) => {
          const angle = (k + .5) * Math.PI / 4;
          return Math.cos(angle) * point.x / radius + Math.sin(angle) * point.z / (radius * .24);
        })) - Math.cos(Math.PI / 8);
        assert.ok(distance > -.005, `${phase}: actual finger ${digit + 1} enters the straight stem: ${point.toArray()}`);
        gaps[digit] = Math.min(gaps[digit], Math.abs(distance) * radius * .55);
      }
    }
    pads.forEach((pad, i) => { assert.ok(counts[i] > 20); pad.divideScalar(counts[i]); });
    assert.ok(pads[0].x * pads[1].x < 0 && pads.every(pad => Math.abs(pad.x) > .04), `${phase}: the boy needs opposed pads around the stem: ${pads.map(p => p.toArray())}`);
    pads.forEach((pad, i) => assert.ok(Math.abs(pad.y - .025) < .04 && Math.abs(pad.z) < .04, `finger ${i + 1} does not hold the lower gripping section`));
    gaps.forEach((gap, i) => assert.ok(gap < .008, `finger ${i + 1} floats ${gap} from the stem`));
  }
});

test('both of the boy’s anatomical hands reconstruct a saved pose without stretched or missing digits', async t => {
  const h = await setup(t), fresh = h.models.create(h.boyState);
  await new Promise(resolve => setImmediate(resolve));
  fresh.root.position.copy(h.boy.root.position); fresh.root.quaternion.copy(h.boy.root.quaternion);
  for (const [phase, elapsed] of [['demonstrating', 2.5], ['receiving', 1.42], ['focus', 0]] as const) {
    h.draw(phase, elapsed);
    const before: THREE.Vector3[] = [], bones: [THREE.Bone, THREE.Vector3][] = [];
    for (const side of ['R', 'L']) {
      const skin = h.boy.root.getObjectByName(`oracle-hand-skin-${side}`) as THREE.SkinnedMesh | undefined;
      assert.ok(skin instanceof THREE.SkinnedMesh, `${side}: no five-digit skinned hand`); skin.skeleton.update();
      for (let digit = 1; digit <= 5; digit++) for (let part = 1; part <= 3; part++) {
        const bone = skin.skeleton.bones.find(b => b.name === `finger${digit}-${part}_${side}`); assert.ok(bone);
        assert.ok(bone.position.length() > .001); bones.push([bone, bone.position.clone()]);
      }
      for (let vertex = 0; vertex < skin.geometry.attributes.position.count; vertex += 13)
        before.push(skin.localToWorld(skin.getVertexPosition(vertex, new THREE.Vector3())));
    }
    h.models.animate(h.boy, .13, { speed: 6, grounded: true, verticalVelocity: 0, turn: .4 }, 4);
    h.draw(phase, elapsed);
    const lesson = JSON.parse(JSON.stringify({ phase, elapsed }));
    h.models.animate(fresh, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0,
      seated: true, floorSeated: true, spoon: spoonLessonBend(lesson, 'boy', 0), spoonLesson: { ...lesson, role: 'boy' } }, 4);
    fresh.root.updateMatrixWorld(true);
    for (const rig of [h.boy, fresh]) {
      const after: THREE.Vector3[] = [];
      for (const side of ['R', 'L']) {
        const skin = rig.root.getObjectByName(`oracle-hand-skin-${side}`) as THREE.SkinnedMesh; skin.skeleton.update();
        for (let vertex = 0; vertex < skin.geometry.attributes.position.count; vertex += 13)
          after.push(skin.localToWorld(skin.getVertexPosition(vertex, new THREE.Vector3())));
      }
      assert.equal(after.length, before.length);
      assert.ok(before.every((point, i) => point.distanceTo(after[i]) < 1e-6), `${phase}: finger surfaces depend on previous motion`);
    }
    bones.forEach(([bone, rest]) => assert.ok(bone.position.distanceTo(rest) < 1e-9, 'do not stretch bones to fake contact'));
  }
});


test('the boy keeps the anatomical wrists straight and joins the actual cut skin inside both cuffs', async t => {
  const h = await setup(t);
  for (const [phase, elapsed] of [['demonstrating', 0], ['demonstrating', 2.5], ['offered', 0], ['receiving', 1.1], ['receiving', 1.42], ['receiving', 1.75], ['focus', 0]] as const) {
    h.draw(phase, elapsed);
    for (const [side, hand] of h.boy.spoonHands!.entries()) {
      hand.skin.skeleton.update(); const connection = hand.connection, columns = connection.edge.length + 1;
      const forearm = hand.wrist.getWorldPosition(new THREE.Vector3()).sub(h.boy.elbows[side].getWorldPosition(new THREE.Vector3())).normalize();
      assert.ok(new THREE.Vector3(0, -1, 0).transformDirection(hand.wrist.matrixWorld).dot(forearm) > .65, `${phase}: hand ${side} folds back`);
      const p = connection.mesh.geometry.attributes.position;
      for (let i = 0; i < columns; i++) {
        const rim = hand.skin.localToWorld(hand.skin.getVertexPosition(connection.edge[i % connection.edge.length], new THREE.Vector3()));
        const join = connection.mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(p, i));
        assert.ok(rim.distanceTo(join) < 1e-6, `${phase}: an exposed wrist hole at ${side}/${i}`);
        const end = new THREE.Vector3().fromBufferAttribute(p, p.count - columns + i);
        assert.ok(Math.abs(end.y + .5) < 1e-6 && Math.hypot(end.x, end.z) < .09, 'the connection must end underneath the cuff');
      }
      for (const value of p.array) assert.ok(Number.isFinite(value), 'the actual wrist skin must remain finite');
    }
  }
});

test('the entire gripping hand clears the straight stem, including triangle interiors', async t => {
  const h = await setup(t); let probes = 0, minimum = Infinity;
  for (const [phase, elapsed] of [['demonstrating', 0], ['demonstrating', .8], ['demonstrating', 1.8], ['demonstrating', 2.5], ['offered', 0], ['receiving', 1.099]] as const) {
    h.draw(phase, elapsed); const skin = h.boy.spoonHands![0].skin, spoon = h.boy.spoon!.root; skin.skeleton.update();
    const vertices = Array.from({ length: skin.geometry.attributes.position.count }, (_, i) =>
      spoon.worldToLocal(skin.localToWorld(skin.getVertexPosition(i, new THREE.Vector3()))));
    const indices = skin.geometry.index!, samples = [...vertices];
    for (let i = 0; i < indices.count; i += 3) samples.push(vertices[indices.getX(i)].clone().add(vertices[indices.getX(i + 1)]).add(vertices[indices.getX(i + 2)]).divideScalar(3));
    for (const p of samples) {
      if (p.y <= 0 || p.y >= .17 || Math.abs(p.x) > .08 || Math.abs(p.z) > .03) continue;
      const radius = .045 - .013 * p.y / .65;
      const margin = Math.max(...Array.from({ length: 8 }, (_, k) => {
        const a = (k + .5) * Math.PI / 4; return Math.cos(a) * p.x / radius + Math.sin(a) * p.z / (radius * .24);
      })) - Math.cos(Math.PI / 8);
      probes++; minimum = Math.min(minimum, margin);
      assert.ok(margin > -.005, `${phase}/${elapsed}: palm or finger enters the stem at ${p.toArray()}`);
    }
  }
  assert.ok(probes > 100); t.diagnostic(JSON.stringify({ probes, minimum }));
});

test('a spoon held before anatomy finishes loading survives the hand swap, and late arrivals release after disposal', async t => {
  const h = await setup(t, true); h.draw('offered', 0);
  assert.equal(h.boy.spoonHands, undefined); const spoon = h.boy.spoon!.root;
  await h.deliver(); h.draw('offered', 0);
  assert.ok(h.boy.spoonHands); assert.equal(h.boy.spoon!.root, spoon); assert.ok(spoon.visible);
  assert.equal(spoon.parent, h.boy.spoonHands[0].wrist);
  const late = h.models.create(h.boyState); h.models.dispose();
  let released = 0;
  h.anatomy.scene.traverse(object => { if (object instanceof THREE.SkinnedMesh) object.geometry.addEventListener('dispose', () => released++); });
  await h.deliver(); assert.equal(late.spoonHands, undefined);
  assert.equal(late.root.getObjectByName('oracle-hand-skin-R'), undefined);
  assert.equal(released, 2, 'both loaded surfaces must release when the model owner is already gone');
});

test('leaving the spoon lesson keeps the exposed wrist rim attached during ordinary movement', async t => {
  const h = await setup(t); h.draw('offered', 0);
  h.models.animate(h.boy, .1, { speed: 5, grounded: true, verticalVelocity: 0, turn: .4 }, 4);
  h.boy.root.updateMatrixWorld(true);
  for (const hand of h.boy.spoonHands!) {
    hand.skin.skeleton.update(); const { mesh, edge } = hand.connection;
    for (let i = 0; i < edge.length; i++) {
      const rim = hand.skin.localToWorld(hand.skin.getVertexPosition(edge[i], new THREE.Vector3()));
      const join = mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, i));
      assert.ok(rim.distanceTo(join) < 1e-6, 'ordinary movement must not leave the wrist connection in the previous bent pose');
    }
  }
  assert.equal(h.boy.spoon!.root.visible, false, 'the transferred prop must stay hidden outside the lesson');
});
