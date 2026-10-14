// Actual posed geometry and albedo, exported for offline inspection, not a game capture.
import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HeroModels } from '../../../packages/client/src/agents/HeroModel.js';
import { advanceMotion, newMotion } from '../../../packages/client/src/agents/CharacterMotion.js';

const label = process.argv[2], models = new HeroModels(new THREE.Texture(), new THREE.Texture());
models['load'] = async id => {
  const path = label === 'before' && ['neo', 'trinity', 'smith', 'morpheus'].includes(id)
    ? `./original/${id}.glb` : `../../../packages/client/public/assets/characters/${id}.glb`;
  const bytes = await readFile(new URL(path, import.meta.url));
  const length = bytes.readUInt32LE(12), doc = JSON.parse(bytes.subarray(20, 20 + length).toString()), textures = new Map();
  for (const material of doc.materials) {
    const texture = material.pbrMetallicRoughness.baseColorTexture?.index;
    if (texture !== undefined) textures.set(material.name, doc.images[doc.textures[texture].source].uri);
    delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture;
  }
  doc.images = []; doc.textures = [];
  const json = Buffer.from(JSON.stringify(doc)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const binary = bytes.subarray(20 + length), result = Buffer.alloc(20 + padded.length + binary.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); binary.copy(result, 20 + padded.length);
  const asset = await new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
  asset.scene.traverse(mesh => { if (mesh instanceof THREE.Mesh) mesh.userData.inspectionTexture = textures.get((mesh.material as THREE.Material).name); });
  return asset;
};
const frames = [];
try {
  for (const id of ['neo', 'trinity', 'smith', 'morpheus'] as const) {
    const rig = (await models.create(id))!, motion = newMotion(), input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 };
    for (const [roll, bend] of [[0, 0], [2.8, .65]]) {
      models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0);
      const wrist = rig.bones.get('wrist_R')!;
      wrist.quaternion.setFromAxisAngle(wrist.position.clone().normalize(), roll)
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), bend));
      rig.root.updateMatrixWorld(true); const center = wrist.getWorldPosition(new THREE.Vector3()), surfaces = [];
      for (const { mesh } of rig.wardrobe) {
        if (!(mesh instanceof THREE.SkinnedMesh) || !mesh.visible) continue;
        mesh.skeleton.update();
        const { position, normal, skinIndex, skinWeight, uv } = mesh.geometry.attributes;
        const vertices: number[][] = [], normals: number[][] = [], texcoords: number[][] = [], indices: number[] = [], lookup = new Map<number, number>();
        const transforms = mesh.skeleton.bones.map((bone, i) => new THREE.Matrix3().setFromMatrix4(mesh.matrixWorld.clone().multiply(mesh.bindMatrixInverse).multiply(bone.matrixWorld).multiply(mesh.skeleton.boneInverses[i]).multiply(mesh.bindMatrix)));
        for (let i = 0; i < position.count; i++) {
          let weight = 0;
          for (let j = 0; j < 4; j++) if (/^(elbow_R|wrist_R|finger[1-5]-[1-3]_R|forearm_twist_R_[1-3])$/.test(mesh.skeleton.bones[skinIndex.getComponent(i, j)].name)) weight += skinWeight.getComponent(i, j);
          if (weight < .95) continue;
          lookup.set(i, vertices.length); vertices.push(mesh.localToWorld(mesh.getVertexPosition(i, new THREE.Vector3())).sub(center).toArray());
          const n = new THREE.Vector3();
          for (let j = 0; j < 4; j++) n.addScaledVector(new THREE.Vector3().fromBufferAttribute(normal, i).applyMatrix3(transforms[skinIndex.getComponent(i, j)]), skinWeight.getComponent(i, j));
          normals.push(n.normalize().toArray());
          texcoords.push(uv ? [uv.getX(i), uv.getY(i)] : [0, 0]);
        }
        const source = mesh.geometry.index!;
        for (let i = 0; i < source.count; i += 3) {
          const triangle = [source.getX(i), source.getX(i + 1), source.getX(i + 2)];
          if (triangle.every(vertex => lookup.has(vertex))) indices.push(...triangle.map(vertex => lookup.get(vertex)!));
        }
        const material = mesh.material as THREE.MeshStandardMaterial;
        if (indices.length) surfaces.push({ name: mesh.name, vertices, normals, texcoords, indices, texture: mesh.userData.inspectionTexture, color: material.color.toArray() });
      }
      frames.push({ id, roll, bend, surfaces });
    }
  }
  await writeFile(new URL(`./${label}-arms.json`, import.meta.url), JSON.stringify(frames));
} finally { models.dispose(); }
