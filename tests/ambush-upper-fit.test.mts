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

test('the complete old-building outer costume clears itself and all actual inner layers through ordinary movement', async t => {
  const h = await model(); t.after(() => h.models.dispose());
  h.rig.root.position.set(4, 2, -3); h.rig.root.rotation.y = .43;
  let snapshots = 0;
  for (const [profile, pace, turn] of [['idle', 0, 0], ['walk', PLAYER_WALK_SPEED, 0], ['run', PLAYER_RUN_SPEED, 0], ['left', PLAYER_WALK_SPEED, -1], ['right', PLAYER_WALK_SPEED, 1], ['accelerate-stop', 0, 0]] as const) {
    const state = newMotion();
    for (let frame = -59; frame <= 180; frame++) {
      const speed = profile === 'accelerate-stop' ? PLAYER_RUN_SPEED * THREE.MathUtils.clamp(frame < 60 ? frame / 60 : (180 - frame) / 60, 0, 1) : pace;
      const input: MotionInput = { speed, grounded: true, verticalVelocity: 0, turn, ambushWardrobe: 'coat' };
      h.rig.root.rotation.y = .43 + turn * (frame + 60) / 60;
      h.models.animate(h.rig, advanceMotion(state, input, 1 / 60), state, input, 1 / 60);
      if (frame <= 0 || frame % 12) continue;
      h.rig.root.updateMatrixWorld(true);
      const outer: THREE.Mesh[] = [], inner: THREE.Mesh[] = [];
      h.rig.root.traverseVisible(object => {
        if (!(object instanceof THREE.Mesh)) return;
        const isOuter = ['morpheus-ambush-coat', 'morpheus-ambush-lapels'].includes(object.name) || h.rig.panels.some(panel => panel.mesh === object);
        (isOuter ? outer : inner).push(object);
      });
      assert.equal(outer.length, 4, 'retain the whole upper coat, both long tails and both lapels');
      assert.ok(outer.find(mesh => mesh.name === 'morpheus-ambush-coat')!.geometry.index!.count / 3 > 20000, 'retain the actual complete sleeves and torso');
      assert.equal(h.rig.panels.reduce((n, panel) => n + panel.mesh.geometry.index!.count / 3, 0), 5120);
      for (const mesh of outer) if (mesh instanceof THREE.SkinnedMesh) {
        for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
          const point = mesh.getVertexPosition(i, new THREE.Vector3());
          assert.ok(mesh.frustumCulled && mesh.boundingBox!.containsPoint(point) && mesh.boundingSphere!.containsPoint(point), `${profile}/${frame}: actual outer cloth escapes its skin bounds`);
        }
      }
      const flatten = (meshes: THREE.Mesh[]) => {
        let offset = 0;
        return meshes.flatMap(mesh => {
          const surface = faces(mesh).map(face => ({ ...face, ids: face.ids.map(id => id + offset) }));
          offset += mesh.geometry.attributes.position.count; return surface;
        });
      };
      const cloth = flatten(outer), body = flatten(inner);
      const self = crossings(cloth, cloth, true), contact = crossings(cloth, body, false);
      assert.equal(self.count, 0, `${profile}/${frame}: full worn coat crosses itself: ${JSON.stringify(self)}`);
      assert.equal(contact.count, 0, `${profile}/${frame}: full worn coat crosses real inner layers: ${JSON.stringify(contact)}`);
      // The front cut creates positive slivers below 1e-8 even in the
      // original coat. Check actual degeneration without deleting those faces;
      // the regular tail grid retains its separate 1e-8 regression.
      for (const face of cloth) {
        const area = new THREE.Triangle(...face.points as [THREE.Vector3, THREE.Vector3, THREE.Vector3]).getArea();
        assert.ok(Number.isFinite(area) && area > 0, `${profile}/${frame}: a retained face collapses`);
      }
      snapshots++;
    }
  }
  assert.equal(snapshots, 90);
});

test('the complete fitted upper coat keeps its saved shape while paused, rebuilds cold and releases its corrections on leaving', async t => {
  const h = await model(), cold = await model(); t.after(() => { h.models.dispose(); cold.models.dispose(); });
  for (const actor of [h, cold]) { actor.rig.root.position.set(-3, 4, 2); actor.rig.root.rotation.y = -.31; }
  const state = newMotion(), input: MotionInput = { speed: PLAYER_RUN_SPEED, grounded: true, verticalVelocity: 0, turn: -.4, ambushWardrobe: 'coat' };
  for (let frame = 0; frame < 127; frame++) h.models.animate(h.rig, advanceMotion(state, input, 1 / 60), state, input, 1 / 60);
  h.rig.root.updateMatrixWorld(true);
  const coat = h.rig.root.getObjectByName('morpheus-ambush-coat') as THREE.SkinnedMesh, before = points(coat), saved = structuredClone(state);
  const a = coat.geometry.attributes, versions = [a.position.version, a.normal.version, a.skinIndex.version, a.skinWeight.version];
  for (let frame = 0; frame < 10; frame++) h.models.animate(h.rig, advanceMotion(state, input, 0), state, input, 0);
  h.rig.root.updateMatrixWorld(true);
  assert.ok(points(coat).every((point, i) => point.distanceTo(before[i]) < 1e-6));
  assert.deepEqual([a.position.version, a.normal.version, a.skinIndex.version, a.skinWeight.version], versions, 'a paused skin does not upload rewritten surface arrays');
  cold.models.animate(cold.rig, advanceMotion(saved, input, 0), saved, input, 0); cold.rig.root.updateMatrixWorld(true);
  assert.ok(points(cold.rig.root.getObjectByName(coat.name) as THREE.SkinnedMesh).every((point, i) => point.distanceTo(before[i]) < 1e-6));
  const outside = { ...input, realWorld: true, ambushWardrobe: undefined };
  h.models.animate(h.rig, advanceMotion(state, outside, 0), state, outside, 0);
  assert.equal(coat.visible, false);
  assert.ok((coat.morphTargetInfluences ?? []).every(value => value === 0), 'leaving releases every outer drape target');
  const donor = h.rig.root.getObjectByName('morpheus-hammer-sweater') as THREE.SkinnedMesh;
  assert.ok(donor.morphTargetInfluences!.every(value => value === 0), 'the baked outer cut never deforms the ship knit');
});
