// Export actual shipped hand surfaces after the game's pose solver.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HeroModels } from '../packages/client/src/agents/HeroModel.js';
import { advanceMotion, newMotion } from '../packages/client/src/agents/CharacterMotion.js';

const output = process.argv[2];
if (!output) throw new Error('Usage: node --import tsx scripts/export-hand-poses.mts <inspection-directory>');
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
  for (const id of ['neo', 'trinity', 'smith', 'morpheus'] as const) {
    const rig = (await models.create(id))!;
    for (const [label, grip] of [['relaxed', 0], ['half', .5], ['closed', 1]] as const) {
      const motion = newMotion(), input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 };
      const pose = advanceMotion(motion, input, 0); pose.arms.forEach(arm => { arm.grip = grip; });
      models.animate(rig, pose, motion, input, 0); rig.root.updateMatrixWorld(true);
      for (const side of ['R', 'L']) {
        const wrist = rig.bones.get(`wrist_${side}`)!, inverse = wrist.matrixWorld.clone().invert();
        const skin = rig.wardrobe.find(part => part.mesh.name === 'Anatomical_head_and_hands')!.mesh as THREE.SkinnedMesh;
        skin.skeleton.update();
        const { position, skinWeight, skinIndex, uv } = skin.geometry.attributes;
        const vertices: number[][] = [], texture: number[][] = [], indices: number[] = [], lookup = new Map<number, number>();
        const point = new THREE.Vector3(), local = inverse.clone().multiply(skin.matrixWorld);
        for (let i = 0; i < position.count; i++) {
          let weight = 0;
          for (let j = 0; j < 4; j++) if (/^(wrist|finger)/.test(skin.skeleton.bones[skinIndex.getComponent(i, j)].name)
            && skin.skeleton.bones[skinIndex.getComponent(i, j)].name.endsWith(`_${side}`)) weight += skinWeight.getComponent(i, j);
          if (weight < .5) continue;
          lookup.set(i, vertices.length); vertices.push(skin.getVertexPosition(i, point).applyMatrix4(local).toArray());
          texture.push([uv.getX(i), uv.getY(i)]);
        }
        const source = skin.geometry.index!;
        for (let i = 0; i < source.count; i += 3) {
          const triangle = [source.getX(i), source.getX(i + 1), source.getX(i + 2)];
          if (triangle.every(vertex => lookup.has(vertex))) indices.push(...triangle.map(vertex => lookup.get(vertex)!));
        }
        const joints = Object.fromEntries([...rig.bones].filter(([name]) => /^(wrist|finger)/.test(name) && name.endsWith(`_${side}`))
          .map(([name, bone]) => [name, bone.getWorldPosition(new THREE.Vector3()).applyMatrix4(inverse).toArray()]));
        await writeFile(`${output}/${id}-${label}-${side}.json`, JSON.stringify({ id, label, grip, side, vertices, texture, indices, joints }));
        if (id === 'neo' && side === 'R') console.log(label, JSON.stringify(joints));
      }
    }
  }
} finally { models.dispose(); }
