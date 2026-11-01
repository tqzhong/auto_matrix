import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mobilReunionRoot, type MobilReunion } from '@auto_matrix/shared';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { poseMobilReunionPair } from '../packages/client/src/agents/MobilReunionPerformance.js';
import { reunionBackContact } from '../packages/client/src/agents/DockReunionPerformance.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { handSurface } from './helpers/hand-surface.mjs';
import { crossings } from './helpers/hand-self-contact.mjs';

const contactTimes = [0, .15, .3, .4, .45, .5, .6, .65, .7, .75, .8, .9, 1.8, 2.8, 3.25, 4.3, 5.2, 5.3, 5.4, 5.5, 5.6, 5.8, 5.9, 6, 6.1, 6.2];

async function geometry(name: string) {
  const bytes = await readFile(new URL(`../packages/client/public/assets/characters/${name}.glb`, import.meta.url));
  const length = bytes.readUInt32LE(12), source = JSON.parse(bytes.subarray(20, 20 + length).toString());
  for (const material of source.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
  source.images = []; source.textures = [];
  const json = Buffer.from(JSON.stringify(source)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const binary = bytes.subarray(20 + length), output = Buffer.alloc(20 + padded.length + binary.length);
  output.writeUInt32LE(0x46546c67, 0); output.writeUInt32LE(2, 4); output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(padded.length, 12); output.writeUInt32LE(0x4e4f534a, 16); padded.copy(output, 20); binary.copy(output, 20 + padded.length);
  return new GLTFLoader().parseAsync(output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength), '');
}

async function setup(t: test.TestContext) {
  const names = ['neo', 'trinity', 'neo-office', 'neo-tracking', 'trinity-club'];
  const assets = Object.fromEntries(await Promise.all(names.map(async name => [name, await geometry(name)])));
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async url => assets[String(url).split('/').pop()!.replace('.glb', '')]);
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  const rigs = { neo: models.create(world.agents.get('neo')!), trinity: models.create(world.agents.get('trinity')!) };
  for (const rig of Object.values(rigs)) models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 }, 0);
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(rigs.neo.hero && rigs.trinity.hero, 'tests must use the two shipped skinned characters');
  const reunion: MobilReunion = { phase: 'embracing', elapsed: 0, neo: { x: 0, z: -22, yaw: Math.PI / 2 }, trinity: { x: 2.2, z: -22, yaw: -Math.PI / 2 } };
  const pose = (elapsed: number, browserTime = 0) => {
    reunion.elapsed = elapsed;
    for (const role of ['neo', 'trinity'] as const) {
      const rig = rigs[role], root = mobilReunionRoot(reunion, role);
      rig.root.position.set(root.x, 0, root.z); rig.root.rotation.y = root.yaw;
      models.animate(rig, browserTime, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, glasses: role !== 'neo',
        mobilStation: true, mobilReunion: { role, reunion } }, 0);
    }
    poseMobilReunionPair(rigs.neo, rigs.trinity, { role: 'neo', reunion });
    for (const rig of Object.values(rigs)) rig.root.updateMatrixWorld(true);
  };
  t.after(() => { models.dispose(); globalThis.document = previous; });
  return { rigs, pose, reunion };
}

test('the shipped reunion boots and body transforms stay above the platform', async t => {
  const h = await setup(t), failures = [];
  for (const elapsed of contactTimes) {
    h.pose(elapsed);
    for (const role of ['neo', 'trinity'] as const) {
      const rig = h.rigs[role];
      for (const side of ['R', 'L']) {
        const ankle = rig.hero!.bones.get('ankle_' + side)!;
        assert.ok(ankle.getWorldPosition(new THREE.Vector3()).y >= rig.hero!.footHeight - .01, 'the planted ankle must stay on the platform');
      }
      const boots = rig.hero!.wardrobe.map(part => part.mesh).filter(mesh => /Boot/i.test((mesh.material as THREE.Material).name));
      assert.ok(boots.length, 'measure the delivered boot surfaces');
      let minimum = Infinity, vertices = 0;
      for (const mesh of boots) {
        if (mesh instanceof THREE.SkinnedMesh) mesh.skeleton.update();
        for (let id = 0; id < mesh.geometry.attributes.position.count; id++) {
          minimum = Math.min(minimum, mesh.getVertexPosition(id, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld).y); vertices++;
        }
      }
      assert.ok(vertices > 1800, 'include the complete two boots');
      if (minimum < -1e-5) failures.push({ role, elapsed, minimum, vertices });
      rig.root.traverse(object => assert.ok(object.matrixWorld.elements.every(Number.isFinite), object.name));
    }
  }
  assert.deepEqual(failures, [], 'an ankle landmark alone cannot accept a boot penetrating the actual platform');
});

test('a saved embrace gives identical shipped bone transforms at different browser times', async t => {
  const h = await setup(t); h.pose(3.25, 0);
  const bones = () => Object.values(h.rigs).flatMap(rig => [...rig.hero!.bones.values()].map(bone => bone.matrixWorld.elements.slice()));
  const before = bones(); h.pose(3.25, 124);
  assert.deepEqual(bones(), before, 'a paused cold frame must not advance the arms or head');
});

test('a fresh loaded embrace matches one reached from earlier saved poses', async t => {
  const warm = await setup(t), cold = await setup(t);
  warm.pose(0); warm.pose(.45); warm.pose(1.8);
  for (const elapsed of [3.25, 5.6, 6.2]) {
    warm.pose(elapsed); cold.pose(elapsed);
    for (const role of ['neo', 'trinity'] as const) for (const [name, bone] of warm.rigs[role].hero!.bones) {
      const actual = cold.rigs[role].hero!.bones.get(name)!.matrixWorld.elements;
      assert.ok(bone.matrixWorld.elements.every((value, i) => Math.abs(value - actual[i]) < 1e-7), `${role}/${name}/${elapsed}`);
    }
  }
});

test('repeated back contacts read a bounded surface patch after the first loaded pose', async t => {
  const h = await setup(t); h.pose(3.25);
  const vertex = THREE.SkinnedMesh.prototype.getVertexPosition;
  let reads = 0;
  t.mock.method(THREE.SkinnedMesh.prototype, 'getVertexPosition', function(this: THREE.SkinnedMesh, ...args) {
    reads++; return vertex.apply(this, args);
  });
  const start = performance.now();
  for (let i = 0; i < 5; i++) poseMobilReunionPair(h.rigs.neo, h.rigs.trinity, { role: 'neo', reunion: h.reunion });
  t.diagnostic(JSON.stringify({ repeats: 5, skinnedVerticesRead: reads, milliseconds: performance.now() - start }));
  assert.ok(reads <= 320, 'holding the same real back contacts must not rescan every sleeve and torso triangle each frame');
});

test('entering and leaving the saved embrace preserves the actual relaxed hand positions', async t => {
  const h = await setup(t);
  const hands = Object.values(h.rigs).map(rig => ({ rig, surfaces: ['R', 'L'].map(side => handSurface(rig.hero!, side)) }));
  const points = () => hands.flatMap(({ rig, surfaces }) => surfaces.flatMap((surface, i) => {
    const wrist = rig.hero!.bones.get(i ? 'wrist_L' : 'wrist_R')!;
    return [...surface.posePoints().values()].map(point => point.applyMatrix4(wrist.matrixWorld));
  }));
  for (const [phase, time] of [['ready', 0], ['together', 6.2]] as const) {
    h.reunion.phase = phase; h.pose(time); const outside = points();
    h.reunion.phase = 'embracing'; h.pose(time); const inside = points();
    const maximum = Math.max(...inside.map((point, i) => point.distanceTo(outside[i])));
    assert.ok(maximum < .04, `${phase}: entering/leaving snaps an actual hand by ${maximum}`);
  }
});

test('the embrace boundaries preserve the complete visible bodies, clothes and boots', async t => {
  const h = await setup(t);
  const points = () => Object.values(h.rigs).flatMap(rig => {
    const result: THREE.Vector3[] = [];
    rig.root.traverseVisible(object => {
      if (!(object instanceof THREE.Mesh)) return;
      if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
      for (let id = 0; id < object.geometry.attributes.position.count; id++)
        result.push(object.localToWorld(object.getVertexPosition(id, new THREE.Vector3())));
    });
    return result;
  });
  const failures = [];
  for (const [phase, time] of [['ready', 0], ['together', 6.2]] as const) {
    h.reunion.phase = phase; h.pose(time); const outside = points();
    h.reunion.phase = 'embracing'; h.pose(time); const inside = points();
    assert.equal(inside.length, outside.length, 'the complete visible wardrobe must remain present');
    assert.ok(inside.length > 100000, 'include the actual delivered surfaces');
    const maximum = inside.reduce((maximum, point, i) => Math.max(maximum, point.distanceTo(outside[i])), 0);
    t.diagnostic(JSON.stringify({ phase, vertices: inside.length, maximum }));
    if (maximum >= .04) failures.push({ phase, maximum });
  }
  assert.deepEqual(failures, [], 'body preparation must not snap the feet or garment when the saved phase changes');
});

test('the reunion bends each delivered elbow about its anatomical hinge', async t => {
  const h = await setup(t), failures = [];
  for (const elapsed of contactTimes) {
    h.pose(elapsed);
    for (const role of ['neo', 'trinity'] as const) for (const side of ['R', 'L']) {
      const rotation = h.rigs[role].hero!.bones.get('elbow_' + side)!.quaternion;
      if (Math.hypot(rotation.y, rotation.z) > 1e-6) failures.push({ role, side, elapsed, rotation: rotation.toArray() });
    }
  }
  assert.deepEqual(failures, [], 'shoulder roll must aim the flexion plane without bending the delivered elbow sideways');
});

test('the actual reunion palm surfaces face and rest on the partner back instead of touching with a wrist landmark', async t => {
  const h = await setup(t), failures: string[] = [];
  for (const elapsed of [.9, 1.8, 2.6, 3.25, 4.5, 5.2]) {
    h.pose(elapsed);
    for (const role of ['neo', 'trinity'] as const) for (const [index, side] of ['R', 'L'].entries()) {
      const rig = h.rigs[role], partner = h.rigs[role === 'neo' ? 'trinity' : 'neo'];
      const skin = rig.hero!.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
      const wrist = rig.hero!.bones.get('wrist_' + side)!, joint = skin.skeleton.bones.indexOf(wrist);
      const { position, skinIndex, skinWeight } = skin.geometry.attributes, faces = skin.geometry.index!;
      const candidates = new Map<number, THREE.Vector3>();
      for (let id = 0; id < position.count; id++) {
        let weight = 0;
        for (let part = 0; part < 4; part++) if (skinIndex.getComponent(id, part) === joint) weight += skinWeight.getComponent(id, part);
        if (weight > .999) candidates.set(id, new THREE.Vector3().fromBufferAttribute(position, id)
          .applyMatrix4(skin.bindMatrix).applyMatrix4(skin.skeleton.boneInverses[joint]));
      }
      const selected: number[][] = [], palmNormal = new THREE.Vector3(index ? -1 : 1, 0, 0);
      for (let face = 0; face < faces.count; face += 3) {
        const ids = [0, 1, 2].map(k => faces.getX(face + k));
        if (!ids.every(id => candidates.has(id))) continue;
        const center = ids.reduce((point, id) => point.add(candidates.get(id)!), new THREE.Vector3()).divideScalar(3);
        const normal = new THREE.Triangle(...ids.map(id => candidates.get(id)!) as [THREE.Vector3, THREE.Vector3, THREE.Vector3]).getNormal(new THREE.Vector3());
        if (center.y >= -.25 && center.y <= -.08 && normal.dot(palmNormal) > .9) selected.push(ids);
      }
      assert.ok(selected.length > 10, 'measure the actual central palm patch, not its thumb-side edge');
      skin.skeleton.update();
      const palms = selected.map(ids => {
        const points = ids.map(id => skin.localToWorld(skin.getVertexPosition(id, new THREE.Vector3())));
        return { point: points.reduce((point, value) => point.add(value), new THREE.Vector3()).divideScalar(3),
          normal: new THREE.Triangle(...points as [THREE.Vector3, THREE.Vector3, THREE.Vector3]).getNormal(new THREE.Vector3()) };
      });
      let gap = Infinity, inward = new THREE.Vector3(), backFaces = 0, outside = 0, facing = 0;
      const outward = new THREE.Vector3(0, 0, -1).transformDirection(partner.root.matrixWorld);
      partner.root.traverseVisible(object => {
        if (!(object instanceof THREE.SkinnedMesh) || !['Tailored_coat_upper', 'Fitted_leather_jacket'].includes(object.name)) return;
        object.skeleton.update();
        const ids = object.geometry.index!, vertices = Array.from({ length: object.geometry.attributes.position.count },
          (_, id) => object.localToWorld(object.getVertexPosition(id, new THREE.Vector3())));
        for (let face = 0; face < ids.count; face += 3) {
          const points = [0, 1, 2].map(k => vertices[ids.getX(face + k)]);
          const triangle = new THREE.Triangle(...points as [THREE.Vector3, THREE.Vector3, THREE.Vector3]);
          const center = partner.root.worldToLocal(triangle.getMidpoint(new THREE.Vector3()));
          const normal = triangle.getNormal(new THREE.Vector3());
          if (Math.abs(center.x) > .5 || center.y < 2.55 || center.y > 3.4 || center.z > 0 || normal.dot(outward) < .15) continue;
          backFaces++;
          for (const palm of palms) {
            const contact = triangle.closestPointToPoint(palm.point, new THREE.Vector3()), distance = contact.distanceTo(palm.point);
            if (distance < gap) {
              gap = distance; inward = normal.clone().negate(); facing = palm.normal.dot(inward);
              outside = palm.point.clone().sub(contact).dot(normal);
            }
          }
        }
      });
      assert.ok(backFaces > 100, 'measure the actual complete back region, independently of the runtime ray target');
      t.diagnostic(JSON.stringify({ role, side, elapsed, facing, gap, outside, palmFaces: palms.length }));
      if (facing < .9 || gap > .035 || outside < 0) failures.push(`${role}/${side}/${elapsed}: facing ${facing}, surface gap ${gap}, outside ${outside}`);
    }
  }
  assert.deepEqual(failures, [], 'both delivered palm surfaces must face and reach the back throughout the held embrace');
});

test('the complete reunion hands do not cross themselves or the partner visible meshes', async t => {
  const h = await setup(t), failures = [];
  const hands = Object.fromEntries((['neo', 'trinity'] as const).map(role => [role, ['R', 'L'].map(side => handSurface(h.rigs[role].hero!, side))]));
  for (const elapsed of contactTimes) {
    h.pose(elapsed);
    for (const role of ['neo', 'trinity'] as const) {
      const rig = h.rigs[role], partner = h.rigs[role === 'neo' ? 'trinity' : 'neo'];
      const body: Parameters<typeof crossings>[0] = [], bodyMeshes: THREE.Mesh[] = [];
      partner.root.traverseVisible(object => {
        if (!(object instanceof THREE.Mesh) || !object.geometry.index) return;
        if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
        const index = object.geometry.index, count = object.geometry.attributes.position.count;
        const points = Array.from({ length: count }, (_, id) => object.localToWorld(object.getVertexPosition(id, new THREE.Vector3())));
        for (let face = 0; face < index.count; face += 3) {
          const ids = [0, 1, 2].map(k => index.getX(face + k)), triangle = ids.map(id => points[id]);
          body.push({ face: body.length, ids, points: triangle, box: new THREE.Box3().setFromPoints(triangle) });
          bodyMeshes.push(object);
        }
      });
      for (const [index, side] of ['R', 'L'].entries()) {
        const surface = hands[role][index], drawn = surface.draw(), wrist = rig.hero!.bones.get('wrist_' + side)!;
        const faces = drawn.faces.map(face => {
          const points = face.points.map(point => point.clone().applyMatrix4(wrist.matrixWorld));
          return { ...face, points, box: new THREE.Box3().setFromPoints(points) };
        });
        assert.equal(faces.length, 12472, 'keep every face of the delivered hand');
        const other = crossings(faces, body, false), row = { role, side, elapsed, handFaces: faces.length,
          partnerFaces: body.length, self: drawn.self.count, body: other.count,
          legacyContact: reunionBackContact(partner, index === 1).toArray(), wrist: wrist.getWorldPosition(new THREE.Vector3()).toArray(),
          examples: other.examples.map(example => {
            const triangle = surface.triangles.find(face => face.face === example.first)!;
            const mesh = bodyMeshes[example.second], ids = body[example.second].ids;
            const joints = mesh instanceof THREE.SkinnedMesh ? [...new Set(ids.flatMap(id => [0, 1, 2, 3].filter(k => mesh.geometry.attributes.skinWeight.getComponent(id, k) > .3)
              .map(k => mesh.skeleton.bones[mesh.geometry.attributes.skinIndex.getComponent(id, k)].name)))] : [];
            return { ...example, mesh: mesh.name, joints, digits: triangle.ids.map(id => surface.group.digits[id]),
              hand: triangle.ids.map(id => drawn.points.get(id)!.toArray()) };
          }) };
        t.diagnostic(JSON.stringify(row));
        if (row.self || row.body) failures.push(row);
      }
    }
  }
  assert.deepEqual(failures, [], 'a palm target alone cannot accept hand or finger penetration');
});

test('the complete reunion hands clear their own clothes and the other hand', async t => {
  const h = await setup(t), failures = [];
  const hands = Object.fromEntries((['neo', 'trinity'] as const).map(role => [role, ['R', 'L'].map(side => handSurface(h.rigs[role].hero!, side))]));
  for (const elapsed of contactTimes) {
    h.pose(elapsed);
    for (const role of ['neo', 'trinity'] as const) {
      const rig = h.rigs[role], clothes = new Set([
        ...rig.hero!.wardrobe.filter(part => !part.hair && !/skin|eyes|teeth|tongue|cornea|iris/i.test((part.mesh.material as THREE.Material).name)).map(part => part.mesh),
        ...rig.hero!.panels.map(part => part.mesh),
      ]);
      const body: Parameters<typeof crossings>[0] = [], names: string[] = [];
      rig.root.traverseVisible(object => {
        if (!(object instanceof THREE.Mesh) || !clothes.has(object) || !object.geometry.index) return;
        if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
        const index = object.geometry.index, vertices = Array.from({ length: object.geometry.attributes.position.count },
          (_, id) => object.localToWorld(object.getVertexPosition(id, new THREE.Vector3())));
        for (let face = 0; face < index.count; face += 3) {
          const ids = [0, 1, 2].map(k => index.getX(face + k)), points = ids.map(id => vertices[id]);
          body.push({ face: body.length, ids, points, box: new THREE.Box3().setFromPoints(points) });
          names.push(object.name);
        }
      });
      const posed = hands[role].map((surface, i) => {
        const wrist = rig.hero!.bones.get(i ? 'wrist_L' : 'wrist_R')!;
        return surface.draw().faces.map(face => {
          const points = face.points.map(point => point.clone().applyMatrix4(wrist.matrixWorld));
          return { ...face, points, box: new THREE.Box3().setFromPoints(points) };
        });
      });
      assert.ok(body.length > 10000, 'check the actual visible wardrobe');
      for (const [index, side] of ['R', 'L'].entries()) {
        assert.equal(posed[index].length, 12472);
        const clothing = crossings(posed[index], body, false), other = crossings(posed[index], posed[1 - index], false);
        const row = { role, side, elapsed, clothes: clothing.count, otherHand: other.count,
          wrist: rig.hero!.bones.get('wrist_' + side)!.quaternion.toArray(),
          examples: clothing.examples.map(example => {
            const surface = hands[role][index], triangle = surface.triangles.find(face => face.face === example.first)!;
            return { ...example, mesh: names[example.second], digits: triangle.ids.map(id => surface.group.digits[id]) };
          }) };
        t.diagnostic(JSON.stringify(row)); if (row.clothes || row.otherHand) failures.push(row);
      }
    }
  }
  assert.deepEqual(failures, [], 'a corrected partner contact must retain the complete own sleeves and hands');
});
