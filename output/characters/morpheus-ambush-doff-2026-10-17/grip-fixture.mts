import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HeroModels } from '../../../packages/client/src/agents/HeroModel.js';
import { advanceMotion, newMotion, type MotionInput } from '../../../packages/client/src/agents/CharacterMotion.js';

export async function makeModel() {
  const raw = await readFile(new URL('../../../packages/client/public/assets/characters/morpheus.glb', import.meta.url)), length = raw.readUInt32LE(12);
  const document = JSON.parse(raw.subarray(20, 20 + length).toString());
  for (const material of document.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = raw.subarray(20 + length), result = Buffer.alloc(20 + padded.length + bin.length);
  result.writeUInt32LE(0x46546c67); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); bin.copy(result, 20 + padded.length);
  const source = await new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: () => Promise<typeof source> }).load = async () => source;
  const rig = (await models.create('morpheus'))!, motion = newMotion();
  const input: MotionInput = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, ambushWardrobe: 'coat' };
  models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); rig.root.updateMatrixWorld(true);
  const scene = new THREE.Scene(); scene.add(rig.root);
  return { models, rig, scene };
}

export function worldPoints(mesh: THREE.Mesh): THREE.Vector3[] {
  if (mesh instanceof THREE.SkinnedMesh) mesh.skeleton.update();
  return Array.from({ length: mesh.geometry.attributes.position.count }, (_, i) => mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld));
}

export function jointAngles(rig: Awaited<ReturnType<typeof makeModel>>['rig']) {
  const result = [];
  for (const side of ['R', 'L']) for (let digit = 1; digit <= 5; digit++) {
    const bones = [1, 2, 3].map(part => rig.bones.get(`finger${digit}-${part}_${side}`)!);
    const points = bones.map(bone => bone.getWorldPosition(new THREE.Vector3()));
    const second = points[1].clone().sub(points[0]), third = points[2].clone().sub(points[1]);
    // The distal pad vector is measured from the delivered surface, not a made-up tip offset.
    const skin = rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
    const { position, skinIndex, skinWeight } = skin.geometry.attributes;
    const bone = skin.skeleton.bones.indexOf(bones[2]), pad = new THREE.Vector3(); let count = 0;
    for (let i = 0; i < position.count; i++) for (let part = 0; part < 4; part++) {
      if (skinIndex.getComponent(i, part) !== bone || skinWeight.getComponent(i, part) < .95) continue;
      pad.add(new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(skin.bindMatrix).applyMatrix4(skin.skeleton.boneInverses[bone])); count++;
    }
    pad.divideScalar(count);
    const end = bones[2].localToWorld(pad.clone()).sub(points[2]);
    result.push({ side, digit, pip: THREE.MathUtils.radToDeg(second.angleTo(third)), dip: THREE.MathUtils.radToDeg(third.angleTo(end)),
      quaternion: bones.map(bone => bone.quaternion.toArray()), pad: points[2].clone().add(end).toArray(), base: points[0].toArray() });
  }
  return result;
}

export function meshSurface(mesh: THREE.Mesh, onlyFaces?: number[]) {
  const attributes = mesh.geometry.attributes, index = mesh.geometry.index!, material = mesh.material as THREE.MeshStandardMaterial;
  const points = worldPoints(mesh);
  return { name: mesh.name, vertices: points.map(point => point.toArray()), indices: onlyFaces ? onlyFaces.flatMap(face => [0, 1, 2].map(i => index.getX(face * 3 + i))) : Array.from(index.array),
    texcoords: Array.from({ length: attributes.position.count }, (_, i) => attributes.uv ? [attributes.uv.getX(i), attributes.uv.getY(i)] : [0, 0]),
    color: material.color.toArray(), vertexColors: null, texture: null, side: material.side, face: null, shadow: false };
}

export function intersection(first: THREE.Vector3[], second: THREE.Vector3[]): number {
  const normal = (p: THREE.Vector3[]) => new THREE.Triangle(p[0], p[1], p[2]).getNormal(new THREE.Vector3());
  const cut = (points: THREE.Vector3[], plane: THREE.Vector3[]) => {
    const n = normal(plane), distances = points.map(point => point.clone().sub(plane[0]).dot(n)), hits: THREE.Vector3[] = [];
    if (Math.min(...distances) >= -1e-8 || Math.max(...distances) <= 1e-8) return hits;
    const add = (point: THREE.Vector3) => { if (!hits.some(hit => hit.distanceTo(point) < 1e-9)) hits.push(point); };
    for (let i = 0; i < 3; i++) {
      const next = (i + 1) % 3;
      if (Math.abs(distances[i]) <= 1e-8) add(points[i].clone());
      if (distances[i] * distances[next] < 0) add(points[i].clone().lerp(points[next], distances[i] / (distances[i] - distances[next])));
    }
    return hits;
  };
  const a = cut(first, second), b = cut(second, first); if (a.length < 2 || b.length < 2) return 0;
  const axis = normal(first).cross(normal(second)).normalize();
  const interval = (points: THREE.Vector3[]) => points.map(point => point.clone().sub(first[0]).dot(axis)).sort((a, b) => a - b);
  const x = interval(a), y = interval(b);
  return Math.max(0, Math.min(x.at(-1)!, y.at(-1)!) - Math.max(x[0], y[0]));
}
function cells(box: THREE.Box3): string[] {
  const result = [];
  for (let x = Math.floor(box.min.x / .15); x <= Math.floor(box.max.x / .15); x++)
    for (let y = Math.floor(box.min.y / .15); y <= Math.floor(box.max.y / .15); y++)
      for (let z = Math.floor(box.min.z / .15); z <= Math.floor(box.max.z / .15); z++) result.push(`${x},${y},${z}`);
  return result;
}
export function handCrossings(skin: THREE.SkinnedMesh, clothes: THREE.Mesh[]) {
  const triangles: { name: string; face: number; points: THREE.Vector3[]; box: THREE.Box3 }[] = [], grid = new Map<string, number[]>();
  for (const mesh of clothes) {
    const vertices = worldPoints(mesh), index = mesh.geometry.index!;
    for (let face = 0; face < index.count / 3; face++) {
      const points = [0, 1, 2].map(k => vertices[index.getX(face * 3 + k)]), box = new THREE.Box3().setFromPoints(points), id = triangles.length;
      triangles.push({ name: mesh.name, face, points, box });
      for (const cell of cells(box)) { let list = grid.get(cell); if (!list) grid.set(cell, list = []); list.push(id); }
    }
  }
  const { skinIndex, skinWeight } = skin.geometry.attributes, vertices = worldPoints(skin), index = skin.geometry.index!, crossings = [];
  let faces = 0, tested = 0;
  for (let face = 0; face < index.count / 3; face++) {
    const ids = [0, 1, 2].map(k => index.getX(face * 3 + k));
    if (!ids.some(id => [0, 1, 2, 3].some(k => /^(wrist|finger)/.test(skin.skeleton.bones[skinIndex.getComponent(id, k)].name) && skinWeight.getComponent(id, k) > .01))) continue;
    faces++;
    const points = ids.map(id => vertices[id]), box = new THREE.Box3().setFromPoints(points);
    for (const id of new Set(cells(box).flatMap(cell => grid.get(cell) ?? []))) {
      const triangle = triangles[id]; if (!box.intersectsBox(triangle.box)) continue; tested++;
      const line = intersection(points, triangle.points);
      if (line > 1e-5) crossings.push({ bodyFace: face, mesh: triangle.name, face: triangle.face, line });
    }
  }
  crossings.sort((a, b) => b.line - a.line);
  return { faces, tested, count: crossings.length, crossings };
}

export function fingerClearance(skin: THREE.SkinnedMesh, clothes: THREE.Mesh[], center: THREE.Vector3) {
  const triangles: { mesh: string; face: number; triangle: THREE.Triangle }[] = [];
  for (const mesh of clothes) {
    const points = worldPoints(mesh), index = mesh.geometry.index!;
    for (let face = 0; face < index.count / 3; face++) {
      const triangle = new THREE.Triangle(...[0, 1, 2].map(k => points[index.getX(face * 3 + k)]) as [THREE.Vector3, THREE.Vector3, THREE.Vector3]);
      const box = new THREE.Box3().setFromPoints([triangle.a, triangle.b, triangle.c]);
      if (box.distanceToPoint(center) < .18) triangles.push({ mesh: mesh.name, face, triangle });
    }
  }
  const points = worldPoints(skin), { skinIndex, skinWeight } = skin.geometry.attributes;
  return [1, 2].map(digit => {
    const bone = skin.skeleton.bones.findIndex(bone => bone.name === `finger${digit}-3_R`), closest = new THREE.Vector3();
    let minimum = Infinity, pair: { vertex: number; mesh: string; face: number; skin: number[]; cloth: number[] } | undefined;
    for (let i = 0; i < points.length; i++) {
      if (![0, 1, 2, 3].some(k => skinIndex.getComponent(i, k) === bone && skinWeight.getComponent(i, k) > .95)) continue;
      for (const { mesh, face, triangle } of triangles) {
        triangle.closestPointToPoint(points[i], closest); const distance = closest.distanceTo(points[i]);
        if (distance < minimum) { minimum = distance; pair = { vertex: i, mesh, face, skin: points[i].toArray(), cloth: closest.toArray() }; }
      }
    }
    return { digit, minimum, pair };
  });
}
