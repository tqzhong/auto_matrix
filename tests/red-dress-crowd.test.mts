import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RedDressCrowd } from '../packages/client/src/engine/RedDressCrowd.js';

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
