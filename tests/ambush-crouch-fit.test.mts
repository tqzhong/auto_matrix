import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PLAYER_WALK_SPEED } from '@auto_matrix/shared';
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

test('the complete old-building crouch outfit and real hands clear actual inner clothes through movement and transitions', async t => {
  const h = await model(); t.after(() => h.models.dispose());
  h.rig.root.position.set(4, 2, -3);
  let samples = 0;
  for (const wardrobe of ['shirt', 'coat'] as const) for (const [profile, speed, turn] of [['idle', 0, 0], ['walk', PLAYER_WALK_SPEED, 0], ['left', PLAYER_WALK_SPEED, -1], ['right', PLAYER_WALK_SPEED, 1], ['transition', PLAYER_WALK_SPEED, 0]] as const) {
    const state = newMotion();
    for (let frame = -59; frame <= 120; frame++) {
      const input: MotionInput = { speed, grounded: true, verticalVelocity: 0, turn, ambushWardrobe: wardrobe,
        crouching: profile === 'transition' ? frame >= 15 && frame < 90 : true };
      h.rig.root.rotation.y = .43 + turn * (frame + 60) / 60;
      h.models.animate(h.rig, advanceMotion(state, input, 1 / 60), state, input, 1 / 60);
      if (frame <= 0 || frame % 10) continue;
      h.rig.root.updateMatrixWorld(true);
      const visible: THREE.Mesh[] = []; h.rig.root.traverseVisible(o => { if (o instanceof THREE.Mesh) visible.push(o); });
      const shirt = h.rig.root.getObjectByName('morpheus-ambush-shirt') as THREE.SkinnedMesh;
      const outer = visible.filter(mesh => ['morpheus-ambush-coat', 'morpheus-ambush-lapels'].includes(mesh.name) || h.rig.panels.some(panel => panel.mesh === mesh));
      const inner = visible.filter(mesh => !outer.includes(mesh)), body = inner.filter(mesh => !mesh.name.startsWith('morpheus-ambush-'));
      for (const mesh of [shirt, ...outer]) if (mesh instanceof THREE.SkinnedMesh) {
        for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
          const point = mesh.getVertexPosition(i, new THREE.Vector3());
          assert.ok(mesh.frustumCulled && mesh.boundingBox!.containsPoint(point) && mesh.boundingSphere!.containsPoint(point), `${wardrobe}/${profile}/${frame}: crouched cloth escapes its skin bounds`);
        }
        assert.ok((mesh.morphTargetInfluences ?? []).every(weight => weight >= 0 && weight <= 1), 'draping stays in the bounded morph range');
      }
      const garment = faces(shirt);
      assert.ok(shirt.visible && garment.length > 22000, 'retain the complete real shirt');
      for (const mesh of body) {
        const result = crossings(garment, faces(mesh), false);
        assert.equal(result.count, 0, `${wardrobe}/${profile}/${frame}: shirt crosses ${mesh.name}: ${JSON.stringify(result)}`);
      }
      const trousers = h.rig.root.getObjectByName('Tailored_trousers') as THREE.SkinnedMesh;
      for (const mesh of body.filter(mesh => /Anatomical/.test(mesh.name))) {
        const result = crossings(faces(mesh), faces(trousers), false);
        assert.equal(result.count, 0, `${wardrobe}/${profile}/${frame}: real hands enter trousers: ${JSON.stringify(result)}`);
      }
      if (wardrobe === 'coat') {
        assert.equal(outer.length, 4);
        assert.equal(h.rig.panels.reduce((n, panel) => n + panel.mesh.geometry.index!.count / 3, 0), 5120);
        const flatten = (meshes: THREE.Mesh[]) => {
          let offset = 0;
          return meshes.flatMap(mesh => { const result = faces(mesh).map(face => ({ ...face, ids: face.ids.map(id => id + offset) })); offset += mesh.geometry.attributes.position.count; return result; });
        };
        const cloth = flatten(outer), beneath = flatten(inner), self = crossings(cloth, cloth, true), contact = crossings(cloth, beneath, false);
        assert.equal(self.count, 0, `${profile}/${frame}: complete crouched coat crosses itself: ${JSON.stringify(self)}`);
        assert.equal(contact.count, 0, `${profile}/${frame}: complete crouched coat crosses actual inner layers: ${JSON.stringify(contact)}`);
        for (const face of cloth) {
          const area = new THREE.Triangle(...face.points as [THREE.Vector3, THREE.Vector3, THREE.Vector3]).getArea();
          assert.ok(Number.isFinite(area) && area > 0, `${profile}/${frame}: a retained crouch face collapses`);
        }
      }
      samples++;
    }
  }
  assert.equal(samples, 120);
});

test('the complete crouched coat stays above the floor without collapsing its hem faces', async t => {
  const h = await model(); t.after(() => h.models.dispose());
  h.rig.root.position.set(4, 2, -3); h.rig.root.rotation.y = .43;
  const state = newMotion();
  for (let frame = 0; frame < 90; frame++) {
    const input: MotionInput = { speed: PLAYER_WALK_SPEED, grounded: true, verticalVelocity: 0, turn: .6, ambushWardrobe: 'coat', crouching: true };
    h.models.animate(h.rig, advanceMotion(state, input, 1 / 60), state, input, 1 / 60); h.rig.root.updateMatrixWorld(true);
    if (frame % 10) continue;
    for (const panel of h.rig.panels) for (const face of faces(panel.mesh)) {
      assert.ok(face.points.every(point => point.y >= 2 - .01), `frame ${frame}: the crouched hem passes through the actual floor`);
      assert.ok(new THREE.Triangle(...face.points as [THREE.Vector3, THREE.Vector3, THREE.Vector3]).getArea() > 1e-8, 'the ground contact keeps every hem face');
    }
  }
});

test('the ground-contacting hem remains continuous while crouching and rising', async t => {
  const h = await model(); t.after(() => h.models.dispose());
  for (const speed of [0, PLAYER_WALK_SPEED]) {
    const state = newMotion(); let previous: THREE.Vector3[][] | undefined;
    for (let frame = -30; frame <= 120; frame++) {
      const input: MotionInput = { speed, grounded: true, verticalVelocity: 0, turn: .4, ambushWardrobe: 'coat', crouching: frame >= 0 && frame < 60 };
      h.models.animate(h.rig, advanceMotion(state, input, 1 / 60), state, input, 1 / 60); h.rig.root.updateMatrixWorld(true);
      const current = h.rig.panels.map(({ mesh }) => Array.from({ length: mesh.geometry.attributes.position.count }, (_, i) => mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld)));
      // Settle the existing standing gait before measuring the complete
      // crouch and rise, including the first crouch frame against standing.
      if (previous && frame >= 0) for (const [panel, points] of current.entries()) {
        const jump = points.reduce((max, point, i) => Math.max(max, point.distanceTo(previous![panel][i])), 0);
        assert.ok(jump < .25, `${speed}/${frame}: a ground-contacting hem point jumps by ${jump}`);
      }
      previous = current;
    }
  }
});
