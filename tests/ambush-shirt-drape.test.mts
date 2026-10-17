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
interface Face { face: number; ids: number[]; points: THREE.Vector3[]; box: THREE.Box3 }
function faces(mesh: THREE.SkinnedMesh): Face[] {
  mesh.skeleton.update(); const { position } = mesh.geometry.attributes, index = mesh.geometry.index!;
  const vertices = Array.from({ length: position.count }, (_, i) => mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld));
  return Array.from({ length: index.count / 3 }, (_, face) => {
    const ids = [0, 1, 2].map(n => index.getX(face*3+n)), points = ids.map(id => vertices[id]);
    return { face, ids, points, box: new THREE.Box3().setFromPoints(points) };
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

test('the complete shirt clears every visible inner layer through free locomotion and speed transitions', async t => {
  const h = await model(); t.after(() => h.models.dispose());
  const shirt = h.rig.root.getObjectByName('morpheus-ambush-shirt') as THREE.SkinnedMesh;
  const bind = Array.from(shirt.geometry.attributes.position.array), normals = Array.from(shirt.geometry.attributes.normal.array);
  const positionVersion = shirt.geometry.attributes.position.version, normalVersion = shirt.geometry.attributes.normal.version;
  const results = [];
  const inspect = (profile: string, frame: number) => {
    h.rig.root.updateMatrixWorld(true);
    const cloth = faces(shirt), layers = [];
    assert.ok(shirt.visible && cloth.length > 22000 && shirt.frustumCulled && shirt.boundingBox && shirt.boundingSphere, 'retain the full delivered garment and real skinned culling');
    for (let i = 0; i < shirt.geometry.attributes.position.count; i++) {
      const point = shirt.getVertexPosition(i, new THREE.Vector3());
      assert.ok(shirt.boundingBox!.containsPoint(point) && shirt.boundingSphere!.containsPoint(point), `${profile}/${frame}: deformed vertex ${i} escapes its bounds`);
    }
    h.rig.root.traverseVisible(object => {
      if (object instanceof THREE.SkinnedMesh && object !== shirt) layers.push({ name: object.name, ...crossings(cloth, faces(object), false) });
    });
    assert.ok(layers.some(layer => layer.name === 'Tailored_trousers') && layers.some(layer => layer.name === 'morpheus-ambush-tie'), 'check the real trousers and neckwear as part of all visible inner layers');
    results.push({ profile, frame, contacts: layers.filter(layer => layer.count > 0) });
  };
  for (const [profile, speed, turn] of [['idle', 0, 0], ['walk', PLAYER_WALK_SPEED, 0], ['run', PLAYER_RUN_SPEED, 0], ['left', PLAYER_WALK_SPEED, -1], ['right', PLAYER_WALK_SPEED, 1]] as const) {
    const motion = newMotion(), input: MotionInput = { speed, grounded: true, verticalVelocity: 0, turn, ambushWardrobe: 'shirt' };
    for (let frame = -59; frame <= 150; frame++) {
      h.rig.root.rotation.y = turn * (frame + 60) / 60;
      h.models.animate(h.rig, advanceMotion(motion, input, 1 / 60), motion, input, 1 / 60);
      if (frame > 0 && frame % 5 === 0) inspect(profile, frame);
    }
  }
  const motion = newMotion();
  for (let frame = 1; frame <= 210; frame++) {
    const speed = frame < 60 ? PLAYER_RUN_SPEED * frame / 60 : frame <= 120 ? PLAYER_RUN_SPEED : PLAYER_RUN_SPEED * Math.max(0, (180 - frame) / 60);
    const input: MotionInput = { speed, grounded: true, verticalVelocity: 0, turn: Math.sin(frame / 60), ambushWardrobe: 'shirt' };
    h.rig.root.rotation.y = frame / 120;
    h.models.animate(h.rig, advanceMotion(motion, input, 1 / 60), motion, input, 1 / 60);
    if (frame % 7 === 0) inspect('accelerate-sprint-stop', frame);
  }
  assert.equal(results.length, 180);
  const failed = results.filter(result => result.contacts.length > 0);
  assert.deepEqual(failed, [], `the complete moving shirt crosses its actual visible inner layers: ${JSON.stringify(failed.slice(0, 10))}`);
  assert.deepEqual(Array.from(shirt.geometry.attributes.position.array), bind);
  assert.deepEqual(Array.from(shirt.geometry.attributes.normal.array), normals);
  assert.equal(shirt.geometry.attributes.position.version, positionVersion, 'gaits do not upload rewritten position buffers');
  assert.equal(shirt.geometry.attributes.normal.version, normalVersion, 'gaits do not upload rewritten normal buffers');
});

test('raised-thigh cloth restores from saved motion, remains paused and leaves the covered garment unchanged', async t => {
  const h = await model(), cold = await model(); t.after(() => { h.models.dispose(); cold.models.dispose(); });
  const input: MotionInput = { speed: PLAYER_RUN_SPEED, grounded: true, verticalVelocity: 0, turn: .4, ambushWardrobe: 'shirt' };
  h.rig.root.position.set(4, 2, -3); h.rig.root.rotation.y = .43;
  cold.rig.root.position.copy(h.rig.root.position); cold.rig.root.rotation.copy(h.rig.root.rotation);
  const state = newMotion();
  for (let frame = -59; frame <= 30; frame++) h.models.animate(h.rig, advanceMotion(state, input, 1 / 60), state, input, 1 / 60);
  h.rig.root.updateMatrixWorld(true);
  const shirt = h.rig.root.getObjectByName('morpheus-ambush-shirt') as THREE.SkinnedMesh;
  const points = (mesh: THREE.SkinnedMesh) => Array.from({ length: mesh.geometry.attributes.position.count }, (_, i) => mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld));
  const before = points(shirt), saved = JSON.parse(JSON.stringify(state));
  for (let frame = 0; frame < 10; frame++) h.models.animate(h.rig, advanceMotion(state, input, 0), state, input, 0);
  h.rig.root.updateMatrixWorld(true);
  assert.ok(points(shirt).every((point, i) => point.distanceTo(before[i]) < 1e-6), 'paused display updates retain the entire actual surface');
  cold.models.animate(cold.rig, advanceMotion(saved, input, 0), saved, input, 0); cold.rig.root.updateMatrixWorld(true);
  const restored = cold.rig.root.getObjectByName('morpheus-ambush-shirt') as THREE.SkinnedMesh;
  assert.ok(points(restored).every((point, i) => point.distanceTo(before[i]) < 1e-6), 'a new asset and saved motion recreate the actual raised-thigh cloth');
  const covered = { ...input, ambushWardrobe: 'coat' as const };
  h.models.animate(h.rig, advanceMotion(state, covered, 0), state, covered, 0); h.rig.root.updateMatrixWorld(true);
  for (let i = 0; i < shirt.geometry.attributes.position.count; i++) {
    const original = shirt.applyBoneTransform(i, new THREE.Vector3().fromBufferAttribute(shirt.geometry.attributes.position, i));
    assert.ok(shirt.getVertexPosition(i, new THREE.Vector3()).distanceTo(original) < 1e-8, `covered vertex ${i} retains its original surface`);
  }
});

test('occupied hands and the actual ground-level escort gait also keep the full shirt clear', async t => {
  const h = await model(); t.after(() => h.models.dispose());
  const shirt = h.rig.root.getObjectByName('morpheus-ambush-shirt') as THREE.SkinnedMesh;
  const results = [];
  for (const escort of [false, true]) {
    const state = newMotion();
    for (let frame = -59; frame <= 120; frame++) {
      const input: MotionInput = { speed: PLAYER_RUN_SPEED, grounded: true, verticalVelocity: 0, turn: 0, armed: true, ambushWardrobe: 'shirt',
        ambushEscort: escort ? { role: 'morpheus', progress: (frame + 60) * PLAYER_RUN_SPEED / 60, watching: false, retreat: true } : undefined };
      h.models.animate(h.rig, advanceMotion(state, input, 1 / 60), state, input, 1 / 60);
      if (frame <= 0 || frame % 10) continue;
      h.rig.root.updateMatrixWorld(true);
      const cloth = faces(shirt), contacts = [];
      assert.ok(shirt.visible && cloth.length > 22000);
      h.rig.root.traverseVisible(object => {
        if (object instanceof THREE.SkinnedMesh && object !== shirt) {
          const result = crossings(cloth, faces(object), false); if (result.count) contacts.push({ name: object.name, ...result });
        }
      });
      results.push({ escort, frame, contacts });
    }
  }
  assert.equal(results.length, 24);
  assert.deepEqual(results.filter(result => result.contacts.length), [], 'the same leg-driven cloth must work while the arms retain their occupied pose');
});
