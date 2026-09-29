// Export the game's actual posed surfaces for offline costume inspection.
// Texture decoding and the game renderer still need a separate browser check.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HeroModels } from '../packages/client/src/agents/HeroModel.js';
import { advanceMotion, newMotion } from '../packages/client/src/agents/CharacterMotion.js';

const output = process.argv[2];
if (!output) throw new Error('Usage: node --import tsx scripts/export-club-pose.mts <inspection-directory>');
await mkdir(output, { recursive: true });
const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
(models as unknown as { load: (id: string) => Promise<unknown> }).load = async id => {
  const bytes = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
  const length = bytes.readUInt32LE(12); const doc = JSON.parse(bytes.subarray(20, 20 + length).toString());
  for (const material of doc.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
  doc.images = []; doc.textures = [];
  const json = Buffer.from(JSON.stringify(doc)); const padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const binary = bytes.subarray(20 + length); const result = Buffer.alloc(20 + padded.length + binary.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); binary.copy(result, 20 + padded.length);
  return new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
};
try {
  const rig = (await models.create('trinity'))!;
  for (const phase of ['introduction', 'whisper', 'question'] as const) {
    const motion = newMotion(); const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, clubClothes: true, glasses: false,
      club: { role: 'trinity' as const, phase, elapsed: 3 } };
    models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); rig.root.updateMatrixWorld(true);
    const surfaces: Record<string, { positions: number[][]; normals: number[][] }> = {};
    rig.root.traverse(mesh => {
      if (!(mesh instanceof THREE.SkinnedMesh) || !mesh.visible) return;
      mesh.skeleton.update();
      const geometry = mesh.geometry; const positions: number[][] = [], normals: number[][] = [];
      const point = new THREE.Vector3(), normal = new THREE.Vector3(), blend = new THREE.Matrix4(), transform = new THREE.Matrix3();
      for (let i = 0; i < geometry.attributes.position.count; i++) {
        positions.push(mesh.getVertexPosition(i, point).toArray()); blend.elements.fill(0);
        for (let j = 0; j < 4; j++) {
          const weight = geometry.attributes.skinWeight.getComponent(i, j);
          const joint = geometry.attributes.skinIndex.getComponent(i, j);
          for (let k = 0; k < 16; k++) blend.elements[k] += mesh.skeleton.boneMatrices[joint * 16 + k] * weight;
        }
        blend.premultiply(mesh.bindMatrixInverse).multiply(mesh.bindMatrix); transform.setFromMatrix4(blend);
        normals.push(normal.fromBufferAttribute(geometry.attributes.normal, i).applyMatrix3(transform).normalize().toArray());
      }
      surfaces[mesh.name] = { positions, normals };
    });
    const path = resolve(output, `${phase}.json`); await writeFile(path, JSON.stringify({ phase, elapsed: 3, surfaces }));
    console.log(path);
  }
} finally { models.dispose(); }
