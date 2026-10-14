// Actual posed geometry and albedo, exported for offline inspection, not a game capture.
import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HeroModels } from '../../../packages/client/src/agents/HeroModel.js';
import { FILM_SETS, PILL_ROOM, pillRoot } from '@auto_matrix/shared';
import { PillPerformance as OriginalPills } from './original/PillPerformance.mjs';
import { advanceMotion, newMotion } from '../../../packages/client/src/agents/CharacterMotion.js';

const label = process.argv[2], models = new HeroModels(new THREE.Texture(), new THREE.Texture());
models['load'] = async id => {
  const path = `../../../packages/client/public/assets/characters/${id}.glb`;
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
  for (const [id, choice, side] of [['neo','red','L'], ['neo','blue','R'], ['morpheus','red','R'], ['morpheus','blue','L']] as const) {
    const rig = (await models.create(id))!, motion = newMotion(), caseName = `${id}-${choice}-${side}`;
    if (label === 'before') models['pills'].set(rig, new OriginalPills(rig) as any);
    for (const elapsed of id === 'neo' ? [2.71, 2.72] : [2.89, 2.9]) {
      const pills = {phase: id === 'neo' ? 'taking' as const : 'offering' as const, elapsed, choice, role:id};
      const root = id === 'neo' ? pillRoot({...pills, approach:{x:1.75,z:-6,yaw:-Math.PI/2}}) : {x:-PILL_ROOM.seat,z:PILL_ROOM.z,yaw:Math.PI/2}, c = FILM_SETS.film_lafayette.center;
      rig.root.position.set(c.x+root.x,c.y-1,c.z+root.z);rig.root.rotation.y=root.yaw;
      const input = {speed:0,grounded:true,verticalVelocity:0,turn:0,pills};
      models.animate(rig, advanceMotion(motion,input,0),motion,input,0);
      const wrist = rig.bones.get(`wrist_${side}`)!;
      rig.root.updateMatrixWorld(true); const center = wrist.getWorldPosition(new THREE.Vector3()), surfaces = [], rootInverse = rig.root.getWorldQuaternion(new THREE.Quaternion()).invert();
      for (const { mesh } of rig.wardrobe) {
        if (!(mesh instanceof THREE.SkinnedMesh) || !mesh.visible || !/skin/i.test((mesh.material as THREE.Material).name)) continue;
        mesh.skeleton.update();
        const { position, normal, skinIndex, skinWeight, uv } = mesh.geometry.attributes;
        const vertices: number[][] = [], normals: number[][] = [], texcoords: number[][] = [], indices: number[] = [], lookup = new Map<number, number>();
        const transforms = mesh.skeleton.bones.map((bone, i) => new THREE.Matrix3().setFromMatrix4(mesh.matrixWorld.clone().multiply(mesh.bindMatrixInverse).multiply(bone.matrixWorld).multiply(mesh.skeleton.boneInverses[i]).multiply(mesh.bindMatrix)));
        for (let i = 0; i < position.count; i++) {
          if ((side === 'R' ? -1 : 1) * position.getX(i) <= .25 || position.getY(i) >= 2.8) continue;
          lookup.set(i, vertices.length); vertices.push(mesh.localToWorld(mesh.getVertexPosition(i, new THREE.Vector3())).sub(center).applyQuaternion(rootInverse).toArray());
          const n = new THREE.Vector3();
          for (let j = 0; j < 4; j++) n.addScaledVector(new THREE.Vector3().fromBufferAttribute(normal, i).applyMatrix3(transforms[skinIndex.getComponent(i, j)]), skinWeight.getComponent(i, j));
          normals.push(n.applyQuaternion(rootInverse).normalize().toArray());
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
      frames.push({ id: caseName, side, elapsed, surfaces });
    }
  }
  await writeFile(new URL(`./${label}-arms.json`, import.meta.url), JSON.stringify(frames));
} finally { models.dispose(); }
