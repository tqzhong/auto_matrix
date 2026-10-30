import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PLAYER_WALK_SPEED, PLAYER_RUN_SPEED } from '@auto_matrix/shared';
import { HeroModels } from '../packages/client/src/agents/HeroModel.js';
import { advanceMotion, newMotion, type MotionInput } from '../packages/client/src/agents/CharacterMotion.js';

async function model() {
  const raw = await readFile(new URL('../packages/client/public/assets/characters/morpheus.glb', import.meta.url)), length = raw.readUInt32LE(12);
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
  const input: MotionInput = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, ambushWardrobe: 'shirt' };
  models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); rig.root.updateMatrixWorld(true);
  return { models, rig };
}

function intersection(first: THREE.Vector3[], second: THREE.Vector3[]): number {
  const normal = (points: THREE.Vector3[]) => new THREE.Triangle(points[0], points[1], points[2]).getNormal(new THREE.Vector3());
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
interface Face { face: number; ids: number[]; points: THREE.Vector3[]; box: THREE.Box3; arm: number }
function faces(mesh: THREE.SkinnedMesh): Face[] {
  mesh.skeleton.update(); const { position, skinIndex, skinWeight } = mesh.geometry.attributes, index = mesh.geometry.index!;
  const vertices = Array.from({ length: position.count }, (_, i) => mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld));
  const influence = Array.from({ length: position.count }, (_, i) => [0, 1, 2, 3].reduce((sum, n) =>
    sum + (/^(shoulder_|elbow_|wrist_|forearm_twist_)/.test(mesh.skeleton.bones[skinIndex.getComponent(i, n)].name) ? skinWeight.getComponent(i, n) : 0), 0));
  return Array.from({ length: index.count / 3 }, (_, face) => {
    const ids = [0, 1, 2].map(n => index.getX(face*3+n)), points = ids.map(id => vertices[id]);
    return { face, ids, points, box: new THREE.Box3().setFromPoints(points), arm: ids.reduce((sum, id) => sum+influence[id]/3, 0) };
  });
}
function cells(box: THREE.Box3): string[] {
  const result: string[] = [];
  for (let x = Math.floor(box.min.x / .05); x <= Math.floor(box.max.x / .05); x++)
    for (let y = Math.floor(box.min.y / .05); y <= Math.floor(box.max.y / .05); y++)
      for (let z = Math.floor(box.min.z / .05); z <= Math.floor(box.max.z / .05); z++) result.push(`${x},${y},${z}`);
  return result;
}
function crossings(first: Face[], second: Face[], sameMesh = true) {
  const grid = new Map<string, number[]>();
  for (const [id, face] of second.entries()) for (const key of cells(face.box)) {
    let ids = grid.get(key); if (!ids) grid.set(key, ids = []); ids.push(id);
  }
  const contacts = [];
  for (const face of first) for (const id of new Set(cells(face.box).flatMap(key => grid.get(key) ?? []))) {
    const other = second[id];
    if (!face.box.intersectsBox(other.box) || sameMesh && face.ids.filter(v => other.ids.includes(v)).length >= 2) continue;
    const line = intersection(face.points, other.points);
    if (line > 1e-5) contacts.push({ first: face.face, second: other.face, line });
  }
  return { count: contacts.length, examples: contacts.slice().sort((a, b) => b.line-a.line).slice(0, 4) };
}

test('the actual old-building shirt sleeves stay outside its torso at the ordinary saved idle pose', async t => {
  const h = await model(); t.after(() => h.models.dispose());
  const shirt = h.rig.root.getObjectByName('morpheus-ambush-shirt') as THREE.SkinnedMesh;
  assert.equal(shirt.visible, true);
  const all = faces(shirt), sleeves = all.filter(face => face.arm > .8), torso = all.filter(face => face.arm < .2);
  assert.ok(sleeves.length > 1000 && torso.length > 1000, 'check the actual delivered sleeve and torso surfaces');
  const result = crossings(sleeves, torso);
  assert.equal(result.count, 0, `ordinary idle cloth crosses between unambiguous sleeve and torso faces; line lengths are not penetration depths: ${JSON.stringify(result)}`);
});

test('the actual old-building shirt hem stays outside the real fitted trousers through ordinary walking and running', async t => {
  const h = await model(); t.after(() => h.models.dispose());
  const shirt = h.rig.root.getObjectByName('morpheus-ambush-shirt') as THREE.SkinnedMesh;
  const trousers = h.rig.root.getObjectByName('Tailored_trousers') as THREE.SkinnedMesh;
  const results = [];
  for (const [profile, speed] of [['walk', PLAYER_WALK_SPEED], ['run', PLAYER_RUN_SPEED]] as const) {
    const motion = newMotion();
    const input: MotionInput = { speed, grounded: true, verticalVelocity: 0, turn: 0, ambushWardrobe: 'shirt' };
    for (let frame = -59; frame <= 90; frame++) {
      h.models.animate(h.rig, advanceMotion(motion, input, 1 / 60), motion, input, 1 / 60);
      if (frame <= 0 || frame % 30) continue;
      h.rig.root.updateMatrixWorld(true);
      const visible: THREE.Object3D[] = []; h.rig.root.traverseVisible(object => visible.push(object));
      assert.ok(visible.includes(shirt) && visible.includes(trousers), 'retain both complete visible clothing layers');
      results.push({ profile, frame, ...crossings(faces(shirt), faces(trousers), false) });
    }
  }
  assert.ok(results.every(result => result.count === 0), `the actual moving hem enters its real trouser layer: ${JSON.stringify(results)}`);
});
