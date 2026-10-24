import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RedDressCrowd } from '../packages/client/src/engine/RedDressCrowd.js';
import { crossings } from './helpers/hand-self-contact.mjs';

async function asset(name: string) {
  const bytes = await readFile(new URL(`../packages/client/public/assets/characters/${name}.glb`, import.meta.url));
  const length = bytes.readUInt32LE(12), doc = JSON.parse(bytes.subarray(20, 20 + length).toString());
  for (const material of doc.materials) delete material.pbrMetallicRoughness.baseColorTexture;
  doc.images = []; doc.textures = [];
  const json = Buffer.from(JSON.stringify(doc)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = bytes.subarray(20 + length), result = Buffer.alloc(20 + padded.length + bin.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); bin.copy(result, 20 + padded.length);
  return new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
}

function world(t: test.TestContext, install = true) {
  if (install) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
    Object.defineProperty(globalThis, 'document', { value: {}, configurable: true });
    t.after(() => { if (previous) Object.defineProperty(globalThis, 'document', previous); else Reflect.deleteProperty(globalThis, 'document'); });
    t.mock.method(GLTFLoader.prototype, 'loadAsync', (path: string) => asset(path.split('/').pop()!.replace('.glb', '')));
  }
  const root = new THREE.Group(), groups = Array.from({ length: 20 }, (_, i) => {
    const group = new THREE.Group(); group.position.set([0, 16, -6, 22][i % 4], 0, -25 + Math.floor(i / 2) * 6);
    group.scale.setScalar(.86 + i % 3 * .06); group.userData.baseZ = group.position.z; group.add(new THREE.Mesh()); root.add(group); return group;
  });
  const crowd = new RedDressCrowd(groups); t.after(() => crowd.dispose());
  return { root, groups, crowd };
}
function meshes(root: THREE.Object3D) {
  const result: THREE.Mesh[] = []; root.traverseVisible(object => { if (object instanceof THREE.Mesh) result.push(object); });
  return result.sort((a, b) => a.name.localeCompare(b.name));
}

test('every exported pedestrian texture resolves to a shipped asset', async () => {
  for (const sex of ['male', 'female']) {
    const bytes = await readFile(new URL(`../packages/client/public/assets/characters/plaza-crowd-${sex}.glb`, import.meta.url));
    const doc = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
    for (const image of doc.images) assert.ok((await readFile(new URL(`../packages/client/public/assets/characters/${image.uri}`, import.meta.url))).length > 0, image.uri);
  }
});

test('twenty plaza pedestrians share at most twelve surfaces without removing people or their shadows', async t => {
  const { root, crowd } = world(t); await crowd.ready; crowd.update(7.13, true);
  const surfaces = meshes(root);
  assert.ok(surfaces.length <= 12, `twenty background people currently require ${surfaces.length} separate surfaces per pass`);
  const skin = surfaces.filter(mesh => /skin/i.test(mesh.name)) as THREE.InstancedMesh[];
  assert.equal(skin.reduce((sum, mesh) => sum + mesh.count, 0), 20);
  assert.ok(surfaces.every(mesh => mesh instanceof THREE.InstancedMesh && mesh.castShadow && mesh.receiveShadow));
});

test('walking, cold loading, freezing and rewinding retain the same instance poses', async t => {
  const { root, crowd } = world(t); crowd.update(7.13, true); await crowd.ready;
  const snapshot = () => meshes(root).map(mesh => ({ name: mesh.name,
    matrix: Array.from((mesh as THREE.InstancedMesh).instanceMatrix.array),
    morph: Array.from((mesh as THREE.InstancedMesh).morphTexture!.source.data.data) }));
  const frozen = snapshot(); crowd.update(7.13, true); assert.deepEqual(snapshot(), frozen);
  crowd.update(7.18, true); assert.notDeepEqual(snapshot(), frozen);
  crowd.update(7.13, true); assert.deepEqual(snapshot(), frozen);
  const other = world(t, false); other.crowd.update(7.13, true); await other.crowd.ready;
  assert.deepEqual(meshes(other.root).map(mesh => ({ name: mesh.name,
    matrix: Array.from((mesh as THREE.InstancedMesh).instanceMatrix.array),
    morph: Array.from((mesh as THREE.InstancedMesh).morphTexture!.source.data.data) })), frozen);
  crowd.update(7.13, false); assert.notDeepEqual(snapshot(), frozen, 'idle is a separate grounded pose');
  const late = world(t, false); late.crowd.dispose(); await late.crowd.ready;
  assert.equal(meshes(late.root).filter(mesh => mesh instanceof THREE.InstancedMesh).length, 0);
});

test('exported walks keep separate grounded feet, covered waists and complete hand topology', async () => {
  for (const sex of ['male', 'female']) {
    const loaded = await asset(`plaza-crowd-${sex}`), surfaces = meshes(loaded.scene);
    const shoes = surfaces.find(mesh => /soles/i.test(mesh.name))!, skin = surfaces.find(mesh => /skin/i.test(mesh.name))!;
    const jacket = surfaces.find(mesh => /suit/i.test(mesh.name))!, trousers = surfaces.find(mesh => /trousers/i.test(mesh.name))!;
    const point = new THREE.Vector3();
    const bounds = (mesh: THREE.Mesh) => {
      const box = new THREE.Box3();
      for (let i = 0; i < mesh.geometry.attributes.position.count; i++) box.expandByPoint(mesh.getVertexPosition(i, point));
      return box;
    };
    assert.ok(skin.geometry.attributes.position.count >= 8300, 'retain the source face and individual finger vertices');
    for (const mesh of surfaces) {
      assert.equal(mesh.geometry.morphAttributes.position.length, 20);
      assert.equal(mesh.geometry.morphAttributes.normal.length, 20);
      assert.ok(!mesh.geometry.attributes.skinIndex && !mesh.geometry.attributes.skinWeight);
      for (const attribute of [mesh.geometry.attributes.position, mesh.geometry.attributes.normal,
        ...mesh.geometry.morphAttributes.position, ...mesh.geometry.morphAttributes.normal]) {
        assert.equal(attribute.count, mesh.geometry.attributes.position.count);
        assert.ok(attribute.array.every(Number.isFinite));
      }
    }
    const toes = [-1, 1].map(side => Array.from({ length: shoes.geometry.attributes.position.count }, (_, i) => i)
      .filter(i => shoes.geometry.attributes.position.getX(i) * side > .05 && shoes.geometry.attributes.position.getY(i) < .055));
    assert.ok(toes.every(vertices => vertices.length > 8), 'both soles retain an actual contact surface');
    const contacts: number[][] = [[], []];
    for (let sample = 0; sample <= 100; sample++) {
      const phase = sample / 100, frame = Math.floor(phase * 20) % 20, blend = phase * 20 % 1;
      for (const mesh of surfaces) {
        mesh.morphTargetInfluences!.fill(0); mesh.morphTargetInfluences![frame] = 1 - blend;
        mesh.morphTargetInfluences![(frame + 1) % 20] = blend;
      }
      const feet = bounds(shoes);
      assert.ok(feet.min.y >= -.002 && feet.min.y < .035, `${sex} phase ${phase}: sole ${feet.min.y}`);
      assert.ok(bounds(jacket).min.y < bounds(trousers).max.y - .12, `${sex} phase ${phase}: waist uncovered`);
      for (let side = 0; side < 2; side++) {
        const planted = side === 0 ? phase >= .1 && phase <= .45 : phase >= .6 && phase <= .95;
        if (planted) contacts[side].push(toes[side].reduce((sum, vertex) => sum + shoes.getVertexPosition(vertex, point).z, 0) / toes[side].length + phase * 2.8);
      }
    }
    for (const contact of contacts) assert.ok(Math.max(...contact) - Math.min(...contact) < .07,
      `${sex}: planted foot slips ${Math.max(...contact) - Math.min(...contact)} world units`);
  }
});

for (const sex of ['male', 'female']) test(`${sex} pedestrian skin does not pierce the suit during idle or interpolated walking`, async () => {
  const loaded = await asset(`plaza-crowd-${sex}`), surfaces = meshes(loaded.scene);
  const skin = surfaces.find(mesh => /skin/i.test(mesh.name))!, jacket = surfaces.find(mesh => /suit/i.test(mesh.name))!;
  const trousers = surfaces.find(mesh => /trousers/i.test(mesh.name))!;
  const faces = (mesh: THREE.Mesh) => {
    const index = mesh.geometry.index!, vertices = Array.from({ length: mesh.geometry.attributes.position.count }, (_, i) => mesh.getVertexPosition(i, new THREE.Vector3()));
    return Array.from({ length: index.count / 3 }, (_, face) => {
      const ids = [0, 1, 2].map(k => index.getX(face * 3 + k)), points = ids.map(i => vertices[i]);
      return { face, ids, points, box: new THREE.Box3().setFromPoints(points) };
    });
  };
  const hands = faces(skin).filter(face => face.box.max.y < 2.7).map(face => face.ids);
  const topology = { male: '04afe7f9b87c79d2796afb258b4dbd09db75927dc173bbfa1e39b8626f37910f', female: '67190406a070391e9c5f8b2b496d765c1979078016ab522232973236a4fad693' };
  assert.equal(createHash('sha256').update(JSON.stringify(hands)).digest('hex'), topology[sex as keyof typeof topology], 'keep all 6,236 hand triangles from the original asset');
  for (const phase of [-1, ...Array.from({ length: 40 }, (_, i) => i / 40)]) {
    for (const mesh of [skin, jacket, trousers]) {
      mesh.morphTargetInfluences!.fill(0);
      if (phase >= 0) {
        const frame = phase * 20;
        mesh.morphTargetInfluences![Math.floor(frame)] = 1 - frame % 1;
        mesh.morphTargetInfluences![(Math.floor(frame) + 1) % 20] = frame % 1;
      }
    }
    const skinFaces = faces(skin), handFaces = skinFaces.filter(face => face.box.max.y < 2.7);
    assert.equal(crossings(handFaces, handFaces).count, 0, `${sex} phase ${phase}: fingers must not fold through one another`);
    for (const garment of [jacket, trousers]) {
      const contact = crossings(skinFaces, faces(garment), false);
      assert.equal(contact.count, 0, `${sex} phase ${phase}: ${contact.count} skin/${garment.name} crossings; ${JSON.stringify(contact.examples)}`);
    }
  }
});


test('reduced business jackets keep upper-arm and shoulder seams sewn', async () => {
  for (const sex of ['male', 'female']) {
    const loaded = await asset(`plaza-crowd-${sex}`), jacket = meshes(loaded.scene).find(mesh => /suit/i.test(mesh.name))!;
    const geometry = jacket.geometry, index = geometry.index!, point = new THREE.Vector3();
    for (let pose = -1; pose < 20; pose++) {
      jacket.morphTargetInfluences!.fill(0);
      if (pose >= 0) jacket.morphTargetInfluences![pose] = 1;
      const positions = Array.from({ length: geometry.attributes.position.count }, (_, i) =>
        jacket.getVertexPosition(i, point).toArray().map(value => Math.round(value * 1e5) / 1e5));
      const edges = new Map<string, { count: number; middle: number[] }>();
      for (let face = 0; face < index.count; face += 3) for (let side = 0; side < 3; side++) {
        const a = positions[index.getX(face + side)], b = positions[index.getX(face + (side + 1) % 3)];
        const key = [a.join(','), b.join(',')].sort().join('/');
        const edge = edges.get(key) ?? { count: 0, middle: a.map((value, axis) => (value + b[axis]) / 2) };
        edge.count++; edges.set(key, edge);
      }
      const open = [...edges.values()].filter(edge => edge.count === 1 && edge.middle[1] > 3.1 && Math.abs(edge.middle[0]) > .26);
      assert.equal(open.length, 0, `${sex} pose ${pose}: ${open.length} open shoulder/upper-arm edges after reduction`);
    }
  }
});
