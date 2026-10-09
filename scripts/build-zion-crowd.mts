// Reuse the shipped CC0 bodies; bake arm arcs once instead of updating 90 skeletons per frame.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SimplifyModifier } from 'three/addons/modifiers/SimplifyModifier.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { HeroModels } from '../packages/client/src/agents/HeroModel.js';
import { advanceMotion, newMotion } from '../packages/client/src/agents/CharacterMotion.js';

function glb(document: object, binary: Buffer): Buffer {
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = Buffer.alloc(Math.ceil(binary.length / 4) * 4); binary.copy(bin);
  const result = Buffer.alloc(28 + padded.length + bin.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20);
  result.writeUInt32LE(bin.length, 20 + padded.length); result.writeUInt32LE(0x004e4942, 24 + padded.length);
  bin.copy(result, 28 + padded.length); return result;
}

for (const sex of ['male', 'female'] as const) {
  const source = await readFile(resolve(`packages/client/public/assets/characters/club-${sex}.glb`));
  const length = source.readUInt32LE(12), original = JSON.parse(source.subarray(20, 20 + length).toString());
  const plain = structuredClone(original);
  for (const material of plain.materials) delete material.pbrMetallicRoughness.baseColorTexture;
  plain.images = []; plain.textures = [];
  const input = glb(plain, source.subarray(28 + length));
  const asset = await new GLTFLoader().parseAsync(input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength), '');
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: () => Promise<typeof asset> }).load = async () => asset;
  // This support path builds only the supplied rig, without apartment props or extra outfits.
  const rig = (await models.create('trinity', undefined, 'ghost'))!;
  for (const panel of rig.panels) panel.mesh.removeFromParent();
  rig.glasses.removeFromParent();
  const idle = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, glasses: false };
  function pose(side?: number, raised = 0) {
    const motion = newMotion(), frame = advanceMotion(motion, idle, 0);
    frame.sway = frame.roll = frame.twist = frame.headTurn = frame.lean = frame.lunge = 0;
    for (const arm of frame.arms) { arm.shoulder = -.08; arm.elbow = -.16; arm.grip = 0; }
    if (side !== undefined) Object.assign(frame.arms[side], { shoulder: -.08 - raised * 2.3,
      elbow: -.16 - Math.sin(raised * Math.PI) * .55, outward: (side ? 1 : -1) * (.18 + raised * .72) });
    models.animate(rig, frame, motion, idle, 0); rig.root.updateMatrixWorld(true);
  }
  pose();
  const meshes: THREE.Mesh[] = [];
  rig.root.traverseVisible(object => { if (object instanceof THREE.Mesh && !/Tailored.coat.upper/.test(object.name)) meshes.push(object); });
  const point = new THREE.Vector3(), normal = new THREE.Vector3(), blend = new THREE.Matrix4(), normalMatrix = new THREE.Matrix3();
  function bake(mesh: THREE.Mesh): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry(), positions: number[] = [], normals: number[] = [], sourceGeometry = mesh.geometry;
    if (mesh instanceof THREE.SkinnedMesh) mesh.skeleton.update();
    for (let i = 0; i < sourceGeometry.attributes.position.count; i++) {
      mesh.getVertexPosition(i, point).applyMatrix4(mesh.matrixWorld); positions.push(...point.toArray());
      normal.fromBufferAttribute(sourceGeometry.attributes.normal, i);
      if (mesh instanceof THREE.SkinnedMesh) {
        blend.elements.fill(0);
        for (let slot = 0; slot < 4; slot++) {
          const weight = sourceGeometry.attributes.skinWeight.getComponent(i, slot), joint = sourceGeometry.attributes.skinIndex.getComponent(i, slot);
          for (let k = 0; k < 16; k++) blend.elements[k] += mesh.skeleton.boneMatrices[joint * 16 + k] * weight;
        }
        blend.premultiply(mesh.bindMatrixInverse).multiply(mesh.bindMatrix);
        normal.applyMatrix3(normalMatrix.setFromMatrix4(blend));
      }
      normal.applyNormalMatrix(normalMatrix.getNormalMatrix(mesh.matrixWorld)); normals.push(...normal.toArray());
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', sourceGeometry.attributes.uv.clone()); geometry.setIndex(sourceGeometry.index!.clone());
    return geometry;
  }
  const names = ['Zion skin', 'Zion shirt', 'Zion trousers', 'Zion soles', 'Zion eyes', 'Zion hair'];
  const grouped = names.map((name, index) => ({ name, meshes: meshes.filter(mesh => index === 0 ? /Anatomical/.test(mesh.name)
    : index === 1 ? /Black.crew.neck/.test(mesh.name) : index === 2 ? /Tailored.trousers/.test(mesh.name)
      : index === 3 ? mesh.name === 'shoes01' : index === 4 ? mesh.name === 'high-poly' : mesh.name === 'short04') }));
  if (grouped.some(surface => surface.meshes.length !== 1)) throw Error('Unexpected source surface layout');
  // The stock inner tops were cropped because the source coats covered the waist.
  // Lengthen their lower torso into the trousers, keeping the existing arm weights.
  const shirt = grouped[1].meshes[0], top = bake(shirt), pants = bake(grouped[2].meshes[0]);
  const hem = new THREE.Box3().setFromBufferAttribute(top.attributes.position as THREE.BufferAttribute).min.y;
  const waist = new THREE.Box3().setFromBufferAttribute(pants.attributes.position as THREE.BufferAttribute).max.y;
  shirt.geometry = shirt.geometry.clone();
  const positions = shirt.geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const drape = THREE.MathUtils.clamp((hem + .45 - top.attributes.position.getY(i)) / .45, 0, 1);
    positions.setY(i, positions.getY(i) - (hem - waist + .16) * drape);
    positions.setX(i, positions.getX(i) * (1 + drape * .13)); positions.setZ(i, positions.getZ(i) * (1 + drape * .13));
  }
  shirt.geometry.computeVertexNormals(); top.dispose(); pants.dispose();
  const originalMaterial = ['Skin', 'Trousers', 'Trousers', 'Boot leather', 'Eyes', 'Hair cards'];
  const materials = names.map((name, index) => {
    const material = structuredClone(original.materials.find((entry: { name: string }) => entry.name === originalMaterial[index]));
    material.name = name;
    if (index === 1 || index === 2) {
      material.pbrMetallicRoughness.baseColorFactor = [1, 1, 1, 1]; material.pbrMetallicRoughness.roughnessFactor = 1;
    } else if (index === 3) {
      material.pbrMetallicRoughness.baseColorFactor = [.055, .042, .03, 1]; material.pbrMetallicRoughness.roughnessFactor = .87;
    }
    return material;
  });
  const targets = ['right_half', 'right_raised', 'left_half', 'left_raised'];
  const frames = [grouped.map(surface => mergeGeometries(surface.meshes.map(bake))!)];
  pose();
  const wrists: Record<string, number[][]> = { neutral: ['R', 'L'].map(name => rig.bones.get(`wrist_${name}`)!.getWorldPosition(new THREE.Vector3()).toArray()) };
  for (const [side, raised] of [[0, .5], [0, 1], [1, .5], [1, 1]]) {
    pose(side, raised); frames.push(grouped.map(surface => mergeGeometries(surface.meshes.map(bake))!));
    wrists[targets[frames.length - 2]] = ['R', 'L'].map(name => rig.bones.get(`wrist_${name}`)!.getWorldPosition(new THREE.Vector3()).toArray());
  }
  const budgets = [2100, 660, 640, 340, 90, 900], reduced: THREE.BufferGeometry[] = [], statistics: object[] = [];
  const bounds = new THREE.Box3();
  for (let surface = 0; surface < grouped.length; surface++) {
    const sourceGeometry = frames[0][surface], identities = new Float32Array(sourceGeometry.attributes.position.count * 3);
    // The installed SimplifyModifier retains color without interpolation when collapsing
    // an edge. Carry the surviving vertex ID through it, then recover every pose using
    // that exact vertex. Separate simplification of poses would corrupt morph topology.
    for (let i = 0; i < sourceGeometry.attributes.position.count; i++) identities[i * 3] = i;
    sourceGeometry.setAttribute('color', new THREE.BufferAttribute(identities, 3));
    const geometry = new SimplifyModifier().modify(sourceGeometry, Math.max(0, sourceGeometry.attributes.position.count - budgets[surface]));
    const ids = Array.from({ length: geometry.attributes.position.count }, (_, i) => geometry.attributes.color.getX(i));
    geometry.deleteAttribute('color'); geometry.computeVertexNormals();
    geometry.morphTargetsRelative = true; geometry.morphAttributes.position = []; geometry.morphAttributes.normal = [];
    for (let frame = 1; frame < frames.length; frame++) {
      const posed = geometry.clone(), position = new Float32Array(ids.length * 3);
      for (let i = 0; i < ids.length; i++) for (let axis = 0; axis < 3; axis++)
        position[i * 3 + axis] = frames[frame][surface].attributes.position.getComponent(ids[i], axis);
      posed.setAttribute('position', new THREE.BufferAttribute(position, 3)); posed.computeVertexNormals();
      const deltaPosition = new Float32Array(position.length), deltaNormal = new Float32Array(position.length);
      for (let i = 0; i < position.length; i++) {
        deltaPosition[i] = position[i] - geometry.attributes.position.array[i];
        deltaNormal[i] = posed.attributes.normal.array[i] - geometry.attributes.normal.array[i];
      }
      geometry.morphAttributes.position.push(new THREE.BufferAttribute(deltaPosition, 3));
      geometry.morphAttributes.normal.push(new THREE.BufferAttribute(deltaNormal, 3)); posed.dispose();
    }
    const neutral = new THREE.Box3().setFromBufferAttribute(geometry.attributes.position as THREE.BufferAttribute); bounds.union(neutral);
    reduced.push(geometry); statistics.push({ name: names[surface], vertices: ids.length, triangles: geometry.index!.count / 3 });
  }
  for (const geometry of reduced) geometry.translate(0, -bounds.min.y, 0);
  const chunks: Buffer[] = []; let offset = 0;
  const document: any = { asset: { version: '2.0', generator: 'scripts/build-zion-crowd.mts' },
    scene: 0, scenes: [{ nodes: reduced.map((_, i) => i) }], nodes: [], meshes: [], accessors: [], bufferViews: [], buffers: [],
    materials, images: original.images, textures: original.textures, samplers: original.samplers,
    extras: { source: `club-${sex}.glb`, sourceSha256: createHash('sha256').update(source).digest('hex'),
      sourceRevision: original.extras.sourceRevision, height: bounds.max.y - bounds.min.y, soleY: 0,
      pose: 'lowered arms, two samples per cheering arm', targets, wrists, statistics } };
  function accessor(array: Float32Array | Uint16Array, type: string, size: number): number {
    const bytes = Buffer.from(array.buffer, array.byteOffset, array.byteLength), padded = Buffer.alloc(Math.ceil(bytes.length / 4) * 4); bytes.copy(padded);
    const view = document.bufferViews.length; document.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length }); chunks.push(padded); offset += padded.length;
    const item: any = { bufferView: view, componentType: array instanceof Float32Array ? 5126 : 5123, count: array.length / size, type };
    if (type === 'VEC3') {
      item.min = [0, 1, 2].map(axis => Math.min(...array.filter((_, i) => i % 3 === axis)));
      item.max = [0, 1, 2].map(axis => Math.max(...array.filter((_, i) => i % 3 === axis)));
    }
    document.accessors.push(item); return document.accessors.length - 1;
  }
  for (const [material, geometry] of reduced.entries()) {
    const attributes = { POSITION: accessor(geometry.attributes.position.array as Float32Array, 'VEC3', 3),
      NORMAL: accessor(geometry.attributes.normal.array as Float32Array, 'VEC3', 3), TEXCOORD_0: accessor(geometry.attributes.uv.array as Float32Array, 'VEC2', 2) };
    const morphs = targets.map((_, index) => ({ POSITION: accessor(geometry.morphAttributes.position[index].array as Float32Array, 'VEC3', 3),
      NORMAL: accessor(geometry.morphAttributes.normal[index].array as Float32Array, 'VEC3', 3) }));
    document.nodes.push({ name: names[material], mesh: material });
    document.meshes.push({ name: names[material], weights: targets.map(() => 0), extras: { targetNames: targets },
      primitives: [{ attributes, indices: accessor(new Uint16Array(geometry.index!.array), 'SCALAR', 1), material, targets: morphs }] });
  }
  document.buffers.push({ byteLength: offset });
  const output = glb(document, Buffer.concat(chunks)), path = resolve(`packages/client/public/assets/characters/zion-crowd-${sex}.glb`);
  await writeFile(path, output); console.log(JSON.stringify({ path, bytes: output.length, height: document.extras.height, statistics, wrists }));
  for (const frame of frames) frame.forEach(geometry => geometry.dispose()); reduced.forEach(geometry => geometry.dispose()); models.dispose();
}
