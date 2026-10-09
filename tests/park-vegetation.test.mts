import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SUNRISE_GARDEN, gardenTreeObstacle, gardenTreePlacement, gardenBankTreePlacement, gardenPose, newTrilogyEpilogue } from '@auto_matrix/shared';
import { SunriseGardenRenderer } from '../packages/client/src/engine/SunriseGardenRenderer.js';

async function shipped() {
  const bytes = await readFile(new URL('../packages/client/public/assets/park/waterfront-tree.glb', import.meta.url));
  const length = bytes.readUInt32LE(12), document = JSON.parse(bytes.subarray(20, 20 + length).toString());
  // Preserve the shipped positions, normals and UVs. Native screenshots cover texture decoding.
  for (const material of document.materials) {
    delete material.pbrMetallicRoughness.baseColorTexture; delete material.pbrMetallicRoughness.metallicRoughnessTexture;
    delete material.normalTexture; delete material.occlusionTexture;
  }
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const binary = bytes.subarray(20 + length), output = Buffer.alloc(20 + padded.length + binary.length);
  output.writeUInt32LE(0x46546c67, 0); output.writeUInt32LE(2, 4); output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(padded.length, 12); output.writeUInt32LE(0x4e4f534a, 16); padded.copy(output, 20); binary.copy(output, 20 + padded.length);
  return new GLTFLoader().parseAsync(output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength), '');
}

test('the shipped forest stays within its triangle budget and shared stem collision leaves the saved performers’ routes clear', async t => {
  const asset = await shipped();
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async () => asset);
  const park = new SunriseGardenRenderer(new THREE.Group()); t.after(() => park.dispose()); await park.treesReady;
  const instances: THREE.InstancedMesh[] = []; park.group.traverse(object => { if (object instanceof THREE.InstancedMesh && object.name.startsWith('park-near-') || object instanceof THREE.InstancedMesh && object.name.startsWith('park-background-')) instances.push(object); });
  assert.equal(instances.reduce((count, mesh) => count + mesh.count, 0), 6 * 3 + (SUNRISE_GARDEN.trees.length - 6) * 2, 'every authored tree needs its real mesh surfaces');
  assert.ok(instances.reduce((count, mesh) => count + mesh.geometry.index!.count / 3 * mesh.count, 0) < 720000, 'the whole forest cannot ship millions of triangles per tree');
  const point = new THREE.Vector3(), matrix = new THREE.Matrix4();
  for (const mesh of instances) {
    const start = mesh.name.startsWith('park-near-') ? 0 : 6;
    for (let index = 0; index < mesh.count; index++) {
      const obstacle = gardenTreeObstacle(start + index), placement = gardenTreePlacement(start + index); mesh.getMatrixAt(index, matrix);
      for (let vertex = 0; vertex < mesh.geometry.attributes.position.count; vertex++) {
        point.fromBufferAttribute(mesh.geometry.attributes.position, vertex).applyMatrix4(matrix);
        assert.ok(point.y >= placement.y - .00001, 'a delivered root or leaf cannot fall below its shared terrain placement');
        if (mesh.name.endsWith('_leaves') || point.y > placement.y + 6.6) continue;
        assert.ok(Math.abs(point.x - obstacle.x) <= obstacle.width / 2 + .002 && Math.abs(point.z - obstacle.z) <= obstacle.depth / 2 + .002,
          `tree ${start + index}: visible low wood outside shared collision ${point.toArray()}`);
      }
    }
  }
  for (const phase of ['sitting', 'architect', 'leaving', 'sati'] as const) for (let elapsed = 0; elapsed <= (phase === 'sati' ? 12 : 4.8); elapsed += .2) {
    const encounter = { ...newTrilogyEpilogue('dawn'), phase, elapsed };
    for (const role of ['oracle', 'architect', 'sati', 'seraph'] as const) {
      const pose = gardenPose(encounter, role);
      for (let index = 0; index < SUNRISE_GARDEN.trees.length; index++) {
        const obstacle = gardenTreeObstacle(index);
        assert.ok(Math.abs(pose.x - obstacle.x) > obstacle.width / 2 + 1.2 || Math.abs(pose.z - obstacle.z) > obstacle.depth / 2 + 1.2,
          `${phase}/${elapsed}/${role}: a new tree blocks the saved route`);
      }
    }
  }
  const shore: THREE.InstancedMesh[] = []; park.group.traverse(object => { if (object instanceof THREE.InstancedMesh && object.name.startsWith('park-shore-')) shore.push(object); });
  assert.equal(shore.reduce((count, mesh) => count + mesh.count, 0), SUNRISE_GARDEN.bankTrees * 2, 'the far bank needs real trunk and cutout canopy surfaces');
  assert.ok(shore.reduce((count, mesh) => count + mesh.geometry.index!.count / 3 * mesh.count, 0) < 210000, 'the far bank has its own coarse LOD budget');
  for (const mesh of shore) {
    assert.equal(mesh.castShadow, false, 'inaccessible shore trees do not add another shadow forest');
    assert.ok(mesh.geometry.getAttribute('uv') && mesh.geometry.getAttribute('uv1'), 'the actual source maps need both UV channels');
    for (let index = 0; index < mesh.count; index++) {
      mesh.getMatrixAt(index, matrix); point.setFromMatrixPosition(matrix);
      const placement = gardenBankTreePlacement(index);
      assert.ok(point.distanceTo(new THREE.Vector3(placement.x, placement.y, placement.z)) < .0001, 'shore roots must sit on the opposite bank');
    }
    if (mesh.name.endsWith('_leaves')) {
      const material = mesh.material as THREE.MeshStandardMaterial;
      assert.ok(material.alphaMap); assert.equal(material.transparent, false); assert.equal(material.alphaTest, .4);
    }
  }
});

test('a tree load that finishes after leaving the garden releases the imported resources instead of attaching a hidden forest', async t => {
  const asset = await shipped(); let deliver!: (value: typeof asset) => void, disposed = 0;
  asset.scene.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.addEventListener('dispose', () => disposed++); });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(resolve => { deliver = resolve; }));
  const root = new THREE.Group(), park = new SunriseGardenRenderer(root); park.dispose(); deliver(asset); await park.treesReady;
  assert.equal(root.children.length, 0); assert.equal(park.group.children.length, 0);
  assert.equal(disposed, 7, 'each imported geometry from all three LODs must be released on a late load');
});

test('every shipped tree texture resolves through the real GLTF loader base path to an existing JPEG', async () => {
  const bytes = await readFile(new URL('../packages/client/public/assets/park/waterfront-tree.glb', import.meta.url));
  const document = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  for (const image of document.images) {
    const url = THREE.LoaderUtils.resolveURL(image.uri, '/assets/park/');
    const texture = await readFile(resolve('packages/client/public', url.slice(1)));
    assert.equal(texture.readUInt16BE(0), 0xffd8, `${url}: a missing texture must not silently decode the Vite HTML fallback`);
  }
});

test('visible living grass retains green reflectance instead of multiplying two dark tints', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  const park = new SunriseGardenRenderer(new THREE.Group()); t.after(() => park.dispose());
  const grass = park.group.getObjectByName('park-grass-blades') as THREE.InstancedMesh;
  const material = grass.material as THREE.MeshStandardMaterial, tint = new THREE.Color(), vertex = new THREE.Color();
  const transform = new THREE.Matrix4(), colors = grass.geometry.getAttribute('color'); let mean = 0, count = 0;
  for (let index = 0; index < grass.count; index += 17) {
    grass.getMatrixAt(index, transform); if (!transform.determinant()) continue;
    grass.getColorAt(index, tint);
    for (let point = 0; point < grass.geometry.getAttribute('position').count; point++) {
      vertex.setRGB(1, 1, 1); if (colors) vertex.fromBufferAttribute(colors, point);
      vertex.multiply(tint).multiply(material.color);
      mean += vertex.r * .2126 + vertex.g * .7152 + vertex.b * .0722; count++;
    }
  }
  assert.ok(mean / count > .08, `visible grass albedo is nearly black: ${mean / count}`);
  assert.ok(grass.geometry.index!.count / 3 * grass.count <= 150000, 'grass volume cannot consume a million triangles per pass');
});
