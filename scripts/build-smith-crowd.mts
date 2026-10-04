// Bake the existing Smith rig in its game idle pose, then reduce static crowd geometry.
// No Blender, image decoding, downloaded assets or new dependencies are required.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SimplifyModifier } from 'three/addons/modifiers/SimplifyModifier.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { HeroModels } from '../packages/client/src/agents/HeroModel.js';
import { advanceMotion, newMotion } from '../packages/client/src/agents/CharacterMotion.js';

const sourcePath = resolve('packages/client/public/assets/characters/smith.glb');
const far = process.argv.includes('--far');
const outputPath = resolve(process.argv.slice(2).find(argument => argument !== '--far') ?? `packages/client/public/assets/characters/smith-crowd${far ? '-far' : ''}.glb`);
const source = await readFile(sourcePath);
const jsonLength = source.readUInt32LE(12);
const original = JSON.parse(source.subarray(20, 20 + jsonLength).toString());
const geometryDocument = structuredClone(original);
for (const material of geometryDocument.materials) {
  delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture;
}
geometryDocument.images = []; geometryDocument.textures = [];

function glb(document: object, binary: Buffer): Buffer {
  const json = Buffer.from(JSON.stringify(document));
  const padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = Buffer.alloc(Math.ceil(binary.length / 4) * 4); binary.copy(bin);
  const result = Buffer.alloc(28 + padded.length + bin.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20);
  result.writeUInt32LE(bin.length, 20 + padded.length); result.writeUInt32LE(0x004e4942, 24 + padded.length);
  bin.copy(result, 28 + padded.length); return result;
}

const input = glb(geometryDocument, source.subarray(28 + jsonLength));
const asset = await new GLTFLoader().parseAsync(input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength), '');
const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
(models as unknown as { load: () => Promise<typeof asset> }).load = async () => asset;
const rig = (await models.create('smith'))!;
const motion = newMotion(); const idle = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 };
models.animate(rig, advanceMotion(motion, idle, 0), motion, idle, 0);
rig.root.updateMatrixWorld(true);

const materials = structuredClone(original.materials);
const glassesMaterials = new Map<THREE.Material, number>();
rig.glasses.traverse(mesh => {
  if (!(mesh instanceof THREE.Mesh)) return;
  const material = mesh.material as THREE.MeshStandardMaterial;
  if (glassesMaterials.has(material)) return;
  // HeroModels clones each mesh's material; group by the two actual finishes.
  const name = material instanceof THREE.MeshPhysicalMaterial ? 'Smith lenses' : 'Smith frames';
  let index = materials.findIndex((item: { name: string }) => item.name === name);
  if (index === -1) {
    index = materials.length;
    materials.push({ name, pbrMetallicRoughness: { baseColorFactor: [...material.color.toArray(), 1],
      roughnessFactor: material.roughness, metallicFactor: material.metalness } });
  }
  glassesMaterials.set(material, index);
});

const surfaces = new Map<number, { name: string; geometries: THREE.BufferGeometry[] }>();
const point = new THREE.Vector3(), normal = new THREE.Vector3(), blend = new THREE.Matrix4(), normalMatrix = new THREE.Matrix3();
rig.root.traverseVisible(mesh => {
  if (!(mesh instanceof THREE.Mesh)) return;
  const material = mesh.material as THREE.Material;
  const materialIndex = glassesMaterials.get(material) ?? materials.findIndex((item: { name: string }) => item.name === material.name);
  if (materialIndex < 0) throw new Error(`Unmapped material: ${material.name}`);
  const geometry = new THREE.BufferGeometry(); const position: number[] = [], normals: number[] = [];
  const sourceGeometry = mesh.geometry;
  if (mesh instanceof THREE.SkinnedMesh) mesh.skeleton.update();
  for (let i = 0; i < sourceGeometry.attributes.position.count; i++) {
    mesh.getVertexPosition(i, point).applyMatrix4(mesh.matrixWorld); position.push(...point.toArray());
    normal.fromBufferAttribute(sourceGeometry.attributes.normal, i);
    if (mesh instanceof THREE.SkinnedMesh) {
      blend.elements.fill(0);
      for (let slot = 0; slot < 4; slot++) {
        const weight = sourceGeometry.attributes.skinWeight.getComponent(i, slot);
        const joint = sourceGeometry.attributes.skinIndex.getComponent(i, slot);
        for (let k = 0; k < 16; k++) blend.elements[k] += mesh.skeleton.boneMatrices[joint * 16 + k] * weight;
      }
      blend.premultiply(mesh.bindMatrixInverse).multiply(mesh.bindMatrix);
      normal.applyMatrix3(normalMatrix.setFromMatrix4(blend));
    }
    normal.applyNormalMatrix(normalMatrix.getNormalMatrix(mesh.matrixWorld)); normals.push(...normal.toArray());
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', sourceGeometry.attributes.uv.clone());
  geometry.setIndex(sourceGeometry.index!.clone());
  const entry = surfaces.get(materialIndex) ?? { name: material.name || materials[materialIndex].name, geometries: [] };
  entry.geometries.push(geometry); surfaces.set(materialIndex, entry);
});

// Vertex budgets preserve complete hands, faces, suit lapels, shoe silhouettes and hair cards.
const budgets: Record<string, number> = far ? { Skin: 750, Trousers: 190, 'Charcoal suit and shirt': 380,
  'Boot leather': 160, Eyes: 40, 'Hair cards': 800, 'Smith frames': 100, 'Smith lenses': 36 } : { Skin: 2600, Trousers: 440, 'Charcoal suit and shirt': 1100,
  'Boot leather': 400, Eyes: 110, 'Hair cards': 1500, 'Smith frames': 180, 'Smith lenses': 64 };
const reduced: { name: string; material: number; geometry: THREE.BufferGeometry }[] = [];
const statistics: { name: string; sourceTriangles: number; triangles: number; vertices: number }[] = [];
for (const [material, surface] of surfaces) {
  const merged = mergeVertices(mergeGeometries(surface.geometries)!);
  const sourceTriangles = merged.index!.count / 3;
  const target = budgets[surface.name]; if (!target) throw new Error(`No simplification budget for ${surface.name}`);
  const geometry = new SimplifyModifier().modify(merged, Math.max(0, merged.attributes.position.count - target));
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  reduced.push({ name: surface.name, material, geometry });
  statistics.push({ name: surface.name, sourceTriangles, triangles: geometry.index!.count / 3, vertices: geometry.attributes.position.count });
  console.log(JSON.stringify(statistics.at(-1)));
}
const bounds = new THREE.Box3();
for (const { geometry } of reduced) bounds.union(geometry.boundingBox!);
// Asset coordinates put the lowest actual sole on y=0, so each instance can use the road/curb height directly.
for (const { geometry } of reduced) geometry.translate(0, -bounds.min.y, 0);
const joints = Object.fromEntries(['shoulder_R', 'shoulder_L', 'wrist_R', 'wrist_L', 'ankle_R', 'ankle_L', 'head'].map(name => {
  const point = rig.bones.get(name)!.getWorldPosition(new THREE.Vector3()); point.y -= bounds.min.y; return [name, point.toArray()];
}));

const chunks: Buffer[] = []; let offset = 0;
const document: any = { asset: { version: '2.0', generator: 'scripts/build-smith-crowd.mts' },
  scene: 0, scenes: [{ nodes: reduced.map((_, i) => i) }], nodes: [], meshes: [], accessors: [], bufferViews: [],
  buffers: [], materials, images: original.images, textures: original.textures, samplers: original.samplers,
  extensionsUsed: original.extensionsUsed,
  extras: { character: `smith-crowd${far ? '-far' : ''}`, source: 'smith.glb', sourceSha256: createHash('sha256').update(source).digest('hex'),
    pose: 'HeroModels idle, arms lowered', forward: '+Z', soleY: 0, joints, statistics } };
function accessor(array: Float32Array | Uint16Array, type: string, size: number): number {
  const bytes = Buffer.from(array.buffer, array.byteOffset, array.byteLength); const padded = Buffer.alloc(Math.ceil(bytes.length / 4) * 4); bytes.copy(padded);
  const view = document.bufferViews.length; document.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length });
  chunks.push(padded); offset += padded.length;
  const item: any = { bufferView: view, componentType: array instanceof Float32Array ? 5126 : 5123, count: array.length / size, type };
  if (type === 'VEC3') {
    item.min = Array.from({ length: size }, (_, axis) => Math.min(...array.filter((_, i) => i % size === axis)));
    item.max = Array.from({ length: size }, (_, axis) => Math.max(...array.filter((_, i) => i % size === axis)));
  }
  document.accessors.push(item); return document.accessors.length - 1;
}
for (const { name, material, geometry } of reduced) {
  const attributes = { POSITION: accessor(geometry.attributes.position.array as Float32Array, 'VEC3', 3),
    NORMAL: accessor(geometry.attributes.normal.array as Float32Array, 'VEC3', 3),
    TEXCOORD_0: accessor(geometry.attributes.uv.array as Float32Array, 'VEC2', 2) };
  const indices = accessor(new Uint16Array(geometry.index!.array), 'SCALAR', 1);
  document.nodes.push({ name, mesh: document.meshes.length }); document.meshes.push({ name, primitives: [{ attributes, indices, material }] });
}
document.buffers.push({ byteLength: offset });
await mkdir(dirname(outputPath), { recursive: true });
const output = glb(document, Buffer.concat(chunks)); await writeFile(outputPath, output);
console.log(JSON.stringify({ output: outputPath, bytes: output.length, triangles: statistics.reduce((n, entry) => n + entry.triangles, 0),
  height: bounds.max.y - bounds.min.y, joints }, null, 2));
models.dispose();
