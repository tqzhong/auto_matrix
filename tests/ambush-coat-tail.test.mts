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
function faces(mesh: THREE.Mesh): Face[] {
  if (mesh instanceof THREE.SkinnedMesh) mesh.skeleton.update(); const { position } = mesh.geometry.attributes, index = mesh.geometry.index!;
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

function points(mesh: THREE.Mesh) {
  return Array.from({ length: mesh.geometry.attributes.position.count }, (_, i) => mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld));
}

test('both complete old-building coat tails clear every real inner layer through locomotion, turns and speed transitions', async t => {
  const h = await model(); t.after(() => h.models.dispose());
  h.rig.root.position.set(4, 2, -3); h.rig.root.rotation.y = .43;
  const tails = h.rig.panels.map(panel => panel.mesh), failures = [];
  for (const [profile, pace, turn] of [['idle', 0, 0], ['walk', PLAYER_WALK_SPEED, 0], ['run', PLAYER_RUN_SPEED, 0], ['left', PLAYER_WALK_SPEED, -1], ['right', PLAYER_WALK_SPEED, 1], ['accelerate-stop', 0, 0]] as const) {
    const state = newMotion();
    for (let frame = -59; frame <= 180; frame++) {
      const speed = profile === 'accelerate-stop' ? PLAYER_RUN_SPEED * THREE.MathUtils.clamp(frame < 60 ? frame / 60 : (180 - frame) / 60, 0, 1) : pace;
      const input: MotionInput = { speed, grounded: true, verticalVelocity: 0, turn, ambushWardrobe: 'coat' };
      h.rig.root.rotation.y = .43 + turn * (frame + 60) / 60;
      h.models.animate(h.rig, advanceMotion(state, input, 1 / 60), state, input, 1 / 60);
      if (frame <= 0 || frame % 12) continue;
      h.rig.root.updateMatrixWorld(true);
      const cloth = tails.map(mesh => faces(mesh)), contacts = [];
      assert.equal(cloth.reduce((sum, triangles) => sum + triangles.length, 0), 5120, 'retain both complete original tail panels');
      for (const surface of cloth) for (const face of surface) assert.ok(new THREE.Triangle(...face.points as [THREE.Vector3, THREE.Vector3, THREE.Vector3]).getArea() > 1e-8, `${profile}/${frame}/${face.face}: retained face area ${new THREE.Triangle(...face.points as [THREE.Vector3, THREE.Vector3, THREE.Vector3]).getArea()}, points ${JSON.stringify(face.points.map(p => p.toArray()))}`);
      assert.ok(tails.every(mesh => mesh.visible), 'neither panel can be hidden to avoid contact');
      for (const mesh of tails) for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
        const point = mesh.getVertexPosition(i, new THREE.Vector3());
        assert.ok(mesh.geometry.boundingBox!.containsPoint(point) && mesh.geometry.boundingSphere!.containsPoint(point), `${profile}/${frame}/${i}: actual tail outside box by ${mesh.geometry.boundingBox!.distanceToPoint(point)}, sphere by ${mesh.geometry.boundingSphere!.distanceToPoint(point)}`);
      }
      h.rig.root.traverseVisible(object => {
        if (!(object instanceof THREE.Mesh) || tails.includes(object)) return;
        const inner = faces(object);
        for (const [panel, surface] of cloth.entries()) {
          const result = crossings(surface, inner, false);
          if (result.count) contacts.push({ panel, name: object.name, ...result });
        }
      });
      for (const [panel, surface] of cloth.entries()) {
        const self = crossings(surface, surface, true);
        if (self.count) contacts.push({ panel, name: 'tail self', ...self });
      }
      const between = crossings(cloth[0], cloth[1], false);
      if (between.count) contacts.push({ panel: -1, name: 'between complete tails', ...between });
      if (contacts.length) failures.push({ profile, frame, contacts });
    }
  }
  t.diagnostic(`90 complete-surface snapshots; ${failures.length} fail contact or self-contact`);
  assert.deepEqual(failures, [], `the actual complete tails cross the visible outfit: ${JSON.stringify(failures.slice(0, 3))}`);
});

test('the complete moving coat tails restore from saved motion and stay identical while paused', async t => {
  const h = await model(), cold = await model(); t.after(() => { h.models.dispose(); cold.models.dispose(); });
  for (const actor of [h, cold]) { actor.rig.root.position.set(-3, 4, 2); actor.rig.root.rotation.y = -.31; }
  const state = newMotion(), input: MotionInput = { speed: PLAYER_RUN_SPEED, grounded: true, verticalVelocity: 0, turn: -.4, ambushWardrobe: 'coat' };
  for (let frame = 0; frame < 127; frame++) h.models.animate(h.rig, advanceMotion(state, input, 1 / 60), state, input, 1 / 60);
  h.rig.root.updateMatrixWorld(true);
  const original = h.rig.panels.map(panel => points(panel.mesh)), saved = structuredClone(state);
  const versions = h.rig.panels.map(({ mesh }) => [mesh.geometry.attributes.position.version, mesh.geometry.attributes.normal.version]);
  for (let frame = 0; frame < 10; frame++) h.models.animate(h.rig, advanceMotion(state, input, 0), state, input, 0);
  h.rig.root.updateMatrixWorld(true);
  for (const [i, panel] of h.rig.panels.entries()) assert.ok(points(panel.mesh).every((p, j) => p.distanceTo(original[i][j]) < 1e-6), 'pause retains the entire displayed tail');
  assert.deepEqual(h.rig.panels.map(({ mesh }) => [mesh.geometry.attributes.position.version, mesh.geometry.attributes.normal.version]), versions, 'paused draws do not upload replacement cloth buffers');
  cold.models.animate(cold.rig, advanceMotion(saved, input, 0), saved, input, 0); cold.rig.root.updateMatrixWorld(true);
  let worst = 0;
  for (const [i, panel] of cold.rig.panels.entries()) for (const [j, point] of points(panel.mesh).entries()) worst = Math.max(worst, point.distanceTo(original[i][j]));
  assert.ok(worst < 1e-6, `a fresh real asset restores different coat tails by ${worst}`);
});

test('the complete fitted tails also clear the actual upper coat and lapels at their waist join', async t => {
  const failures = [];
  for (const [profile, speed] of [['idle', 0], ['walk', PLAYER_WALK_SPEED], ['run', PLAYER_RUN_SPEED]] as const) {
    const h = await model(); t.after(() => h.models.dispose());
    const state = newMotion(), input: MotionInput = { speed, grounded: true, verticalVelocity: 0, turn: 0, ambushWardrobe: 'coat' };
    for (let frame = 0; frame < 90; frame++) h.models.animate(h.rig, advanceMotion(state, input, 1 / 60), state, input, 1 / 60);
    h.rig.root.updateMatrixWorld(true);
    for (const [panel, { mesh }] of h.rig.panels.entries()) for (const name of ['morpheus-ambush-coat', 'morpheus-ambush-lapels']) {
      const upper = h.rig.root.getObjectByName(name) as THREE.SkinnedMesh;
      assert.ok(upper.visible, 'the complete upper garment remains visible');
      const result = crossings(faces(mesh), faces(upper), false);
      if (result.count) failures.push({ profile, panel, name, ...result });
    }
  }
  assert.deepEqual(failures, [], `the lower and upper pieces cross at the actual waist: ${JSON.stringify(failures)}`);
});
