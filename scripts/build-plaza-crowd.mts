// Bake the existing CC0 business rigs once; preserve the full head and hand topology.
// Usage: node --import tsx scripts/build-plaza-crowd.mts /absolute/path/to/intermediate-rigs
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SimplifyModifier } from 'three/addons/modifiers/SimplifyModifier.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MeshoptSimplifier } from 'meshoptimizer';
import { HeroModels } from '../packages/client/src/agents/HeroModel.js';
import { advanceMotion, newMotion, footTrajectory } from '../packages/client/src/agents/CharacterMotion.js';
import { reach } from '../packages/client/src/agents/SpoonPerformance.js';

function glb(document: object, binary: Buffer): Buffer {
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = Buffer.alloc(Math.ceil(binary.length / 4) * 4); binary.copy(bin);
  const result = Buffer.alloc(28 + padded.length + bin.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20);
  result.writeUInt32LE(bin.length, 20 + padded.length); result.writeUInt32LE(0x004e4942, 24 + padded.length);
  bin.copy(result, 28 + padded.length); return result;
}

await MeshoptSimplifier.ready;
for (const sex of ['male', 'female'] as const) {
  const source = await readFile(resolve(process.argv[2], `plaza-${sex}-rig.glb`));
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
  const restFeet = ['R', 'L'].map(side => rig.bones.get('ankle_' + side)!.getWorldPosition(new THREE.Vector3()));
  const idle = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, glasses: false };
  function pose(phase = 0, walking = false) {
    const motion = newMotion(); motion.phase = phase; motion.speed = walking ? 2.2 : 0;
    const input = { ...idle, speed: motion.speed };
    const frame = advanceMotion(motion, input, 0);
    // Leave room for the business jacket's hem during the arm swing.
    for (const [i, arm] of frame.arms.entries()) arm.outward = (i ? 1 : -1) * (sex === 'female' ? .4 : .25);
    models.animate(rig, frame, motion, input, 0);
    rig.root.updateMatrixWorld(true);
    if (walking) {
      const legs = ['R', 'L'].map((side, i) => {
        const hip = rig.bones.get('hip_' + side)!, knee = rig.bones.get('knee_' + side)!, ankle = rig.bones.get('ankle_' + side)!;
        const trajectory = footTrajectory(phase + i * .5, .84, .6);
        const target = restFeet[i].clone().add(new THREE.Vector3(0, trajectory.lift * .22, trajectory.z));
        return { hip, knee, ankle, target };
      });
      let drop = 0;
      for (const { hip, knee, ankle, target } of legs) {
        const start = hip.getWorldPosition(new THREE.Vector3()), length = knee.position.length() + ankle.position.length() - .002;
        drop = Math.max(drop, start.y - target.y - Math.sqrt(Math.max(0, length * length - (start.x - target.x) ** 2 - (start.z - target.z) ** 2)));
      }
      rig.bones.get('pelvis')!.position.y -= drop; rig.root.updateMatrixWorld(true);
      for (const { hip, knee, ankle, target } of legs) {
        reach(hip, knee, ankle.position, target, new THREE.Vector3(0, 0, 1));
        ankle.quaternion.copy(knee.getWorldQuaternion(new THREE.Quaternion()).invert());
        ankle.updateWorldMatrix(false, true);
      }
      rig.root.updateMatrixWorld(true);
    }
  }
  pose();
  const meshes: THREE.Mesh[] = [];
  rig.root.traverseVisible(object => { if (object instanceof THREE.Mesh && !/Black.crew.neck/.test(object.name)) meshes.push(object); });
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
    geometry.setAttribute('uv', sourceGeometry.attributes.uv.clone()); geometry.setIndex(mesh === skin ? visible : sourceGeometry.index!.clone());
    return geometry;
  }
  const names = ['Plaza skin', 'Plaza suit', 'Plaza trousers', 'Plaza soles', 'Plaza eyes', 'Plaza hair'];
  const grouped = names.map((name, index) => ({ name, meshes: meshes.filter(mesh => index === 0 ? /Anatomical/.test(mesh.name)
    : index === 1 ? /Tailored.coat.upper/.test(mesh.name) : index === 2 ? /Tailored.trousers/.test(mesh.name)
      : index === 3 ? mesh.name === 'shoes01' : index === 4 ? mesh.name === 'high-poly' : mesh.name === 'short04') }));
  if (grouped.some(surface => surface.meshes.length !== 1)) throw Error('Unexpected source surface layout');
  // This closed shirt covers the source shoulder caps. Retain the continuous
  // neck above the collar and every wrist/finger face, rather than drawing
  // hidden shoulder skin through the simplified jacket.
  const skin = grouped[0].meshes[0] as THREE.SkinnedMesh;
  const skinGeometry = skin.geometry, skinIndex = skinGeometry.index!, skinPosition = skinGeometry.attributes.position;
  const exposed = (vertex: number) => skinPosition.getY(vertex) > original.extras.head[1] - .27
    || [0, 1, 2, 3].some(slot => skinGeometry.attributes.skinWeight.getComponent(vertex, slot) > .5
      && /^(wrist|finger)/.test(skin.skeleton.bones[skinGeometry.attributes.skinIndex.getComponent(vertex, slot)].name));
  const visible: number[] = [];
  for (let i = 0; i < skinIndex.count; i += 3) {
    const triangle = [0, 1, 2].map(k => skinIndex.getX(i + k));
    if (triangle.some(exposed)) visible.push(...triangle);
  }
  // Fit the stock shirt collar around this body's actual neck before baking.
  // A small clearance also leaves room for the simplified collar triangles.
  const jacket = grouped[1].meshes[0] as THREE.SkinnedMesh; jacket.geometry = jacket.geometry.clone();
  // The stock hem inherits thigh weights. A jacket hangs from the waist;
  // following the opposite stepping leg swings it through the passing hand.
  const clothJoints = jacket.geometry.attributes.skinIndex;
  const pelvis = jacket.skeleton.bones.findIndex(bone => bone.name === 'pelvis');
  for (let i = 0; i < clothJoints.count; i++) for (let slot = 0; slot < 4; slot++)
    if (/^(hip|knee|ankle)_/.test(jacket.skeleton.bones[clothJoints.getComponent(i, slot)].name)) clothJoints.setComponent(i, slot, pelvis);
  const cloth = jacket.geometry.attributes.position;
  const reference = new THREE.Mesh(skinGeometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const ray = new THREE.Raycaster(), center = new THREE.Vector3(), direction = new THREE.Vector3();
  for (let i = 0; i < cloth.count; i++) {
    const y = cloth.getY(i); if (y < original.extras.head[1] - .42 || Math.abs(cloth.getX(i)) > .28) continue;
    center.set(0, y, original.extras.head[2]); direction.set(cloth.getX(i), 0, cloth.getZ(i) - center.z);
    const radius = direction.length(); if (radius > .33 || radius < .001) continue;
    ray.set(center, direction.divideScalar(radius));
    const hit = ray.intersectObject(reference)[0];
    if (hit && hit.distance + .025 > radius) {
      const fitted = center.clone().addScaledVector(direction, hit.distance + .025);
      cloth.setXYZ(i, fitted.x, y, fitted.z);
    }
  }
  // Keep the cuff outside the anatomical wrist instead of squeezing the hand.
  for (const side of ['R', 'L']) {
    const joint = skin.skeleton.bones.findIndex(bone => bone.name === `wrist_${side}`);
    const elbowJoint = skin.skeleton.bones.findIndex(bone => bone.name === `elbow_${side}`);
    const wrist = new THREE.Vector3().setFromMatrixPosition(skin.skeleton.boneInverses[joint].clone().invert());
    const elbow = new THREE.Vector3().setFromMatrixPosition(skin.skeleton.boneInverses[elbowJoint].clone().invert());
    const axis = wrist.clone().sub(elbow).normalize();
    for (let i = 0; i < cloth.count; i++) {
      point.fromBufferAttribute(cloth, i); const along = point.clone().sub(wrist).dot(axis);
      if (along < -.18 || along > .18) continue;
      center.copy(wrist).addScaledVector(axis, along); direction.copy(point).sub(center);
      const radius = direction.length(); if (radius > .2 || radius < .001) continue;
      ray.set(center, direction.divideScalar(radius)); let hit = ray.intersectObject(reference)[0];
      // The source hand ends just below the wrist. Extend its proximal section
      // through the cuff so vertices above that open boundary are fitted too.
      if (!hit && along < .08) {
        ray.set(wrist.clone().addScaledVector(axis, .08), direction);
        hit = ray.intersectObject(reference)[0];
      }
      if (hit && hit.distance + .035 > radius && hit.distance < .18) {
        const fitted = center.clone().addScaledVector(direction, hit.distance + .035);
        cloth.setXYZ(i, fitted.x, fitted.y, fitted.z);
      }
    }
  }
  reference.material.dispose(); jacket.geometry.computeVertexNormals();
  const originalMaterial = ['Skin', 'Charcoal suit and shirt', 'Trousers', 'Boot leather', 'Eyes', 'Hair cards'];
  const materials = names.map((name, index) => {
    const material = structuredClone(original.materials.find((entry: { name: string }) => entry.name === originalMaterial[index]));
    material.name = name;
    if (index === 2) material.pbrMetallicRoughness.baseColorFactor = [.15, .16, .17, 1];
    if (index === 1 || index === 2) material.pbrMetallicRoughness.roughnessFactor = .86;
    return material;
  });
  const phases = Array.from({ length: 20 }, (_, i) => i / 20);
  const targets = phases.map((_, i) => `walk_${i}`);
  const frames = [grouped.map(surface => mergeGeometries(surface.meshes.map(bake))!)];
  for (const phase of phases) {
    pose(phase, true); frames.push(grouped.map(surface => mergeGeometries(surface.meshes.map(bake))!));
  }
  // Ground the actual shoe surface, including idle, rather than an estimated ankle.
  for (const frame of frames) {
    const sole = new THREE.Box3().setFromBufferAttribute(frame[3].attributes.position as THREE.BufferAttribute).min.y;
    frame.forEach(geometry => geometry.translate(0, -sole, 0));
  }
  const budgets = [Infinity, 1800, 900, 650, 150, Infinity], reduced: THREE.BufferGeometry[] = [], statistics: object[] = [];
  const bounds = new THREE.Box3();
  for (let surface = 0; surface < grouped.length; surface++) {
    const sourceGeometry = frames[0][surface], identities = new Float32Array(sourceGeometry.attributes.position.count * 3);
    // The installed SimplifyModifier retains color without interpolation when collapsing
    // an edge. Carry the surviving vertex ID through it, then recover every pose using
    // that exact vertex. Separate simplification of poses would corrupt morph topology.
    for (let i = 0; i < sourceGeometry.attributes.position.count; i++) identities[i * 3] = i;
    sourceGeometry.setAttribute('color', new THREE.BufferAttribute(identities, 3));
    let geometry: THREE.BufferGeometry;
    if (surface === 1) {
      // Keep duplicated UV seam vertices together and lock open garment edges.
      // Independent edge collapses in SimplifyModifier tear the shoulder seams.
      const [indices] = MeshoptSimplifier.simplify(new Uint32Array(sourceGeometry.index!.array),
        sourceGeometry.attributes.position.array as Float32Array, 3, 2400 * 3, .004, ['LockBorder']);
      const retained = [...new Set(indices)], remap = new Map(retained.map((id, i) => [id, i]));
      geometry = new THREE.BufferGeometry();
      for (const [name, attribute] of Object.entries(sourceGeometry.attributes)) {
        const values = retained.flatMap(id => Array.from({ length: attribute.itemSize }, (_, axis) => attribute.getComponent(id, axis)));
        geometry.setAttribute(name, new THREE.Float32BufferAttribute(values, attribute.itemSize));
      }
      geometry.setIndex(Array.from(indices, id => remap.get(id)!));
    } else geometry = Number.isFinite(budgets[surface])
      ? new SimplifyModifier().modify(sourceGeometry, Math.max(0, sourceGeometry.attributes.position.count - budgets[surface]))
      : sourceGeometry.clone();
    const ids = Array.from({ length: geometry.attributes.position.count }, (_, i) => geometry.attributes.color.getX(i));
    geometry.deleteAttribute('color'); if (Number.isFinite(budgets[surface])) geometry.computeVertexNormals();
    geometry.morphTargetsRelative = true; geometry.morphAttributes.position = []; geometry.morphAttributes.normal = [];
    for (let frame = 1; frame < frames.length; frame++) {
      const posed = geometry.clone(), position = new Float32Array(ids.length * 3);
      for (let i = 0; i < ids.length; i++) for (let axis = 0; axis < 3; axis++)
        position[i * 3 + axis] = frames[frame][surface].attributes.position.getComponent(ids[i], axis);
      posed.setAttribute('position', new THREE.BufferAttribute(position, 3));
      if (Number.isFinite(budgets[surface])) posed.computeVertexNormals();
      else posed.setAttribute('normal', frames[frame][surface].attributes.normal.clone());
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
  const document: any = { asset: { version: '2.0', generator: 'scripts/build-plaza-crowd.mts' },
    scene: 0, scenes: [{ nodes: reduced.map((_, i) => i) }], nodes: [], meshes: [], accessors: [], bufferViews: [], buffers: [],
    materials, images: original.images, textures: original.textures, samplers: original.samplers,
    extras: { source: `plaza-${sex}-rig.glb`, sourceSha256: createHash('sha256').update(source).digest('hex'),
      sourceRevision: original.extras.sourceRevision, height: bounds.max.y - bounds.min.y, soleY: 0,
      pose: 'grounded idle and one complete walking cycle', cycleDistance: 2.8, phases, targets, statistics } };
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
  const output = glb(document, Buffer.concat(chunks)), path = resolve(`packages/client/public/assets/characters/plaza-crowd-${sex}.glb`);
  await writeFile(path, output); console.log(JSON.stringify({ path, bytes: output.length, height: document.extras.height, statistics }));
  for (const frame of frames) frame.forEach(geometry => geometry.dispose()); reduced.forEach(geometry => geometry.dispose()); models.dispose();
}
