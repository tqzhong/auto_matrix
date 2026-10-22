import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HeroModels } from '../packages/client/src/agents/HeroModel.js';
import { advanceMotion, newMotion } from '../packages/client/src/agents/CharacterMotion.js';

async function loadGeometry(id = 'neo') {
  const glb = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
  const jsonLength = glb.readUInt32LE(12);
  const document = JSON.parse(glb.subarray(20, 20 + jsonLength).toString());
  // Decode the shipped geometry with the real loader, without a DOM/image
  // decoder. This checks skin geometry, not in-game materials or lighting.
  for (const material of document.materials) {
    delete material.pbrMetallicRoughness.baseColorTexture;
    delete material.normalTexture;
  }
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document));
  const padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = glb.subarray(20 + jsonLength);
  const result = Buffer.alloc(20 + padded.length + bin.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16);
  padded.copy(result, 20); bin.copy(result, 20 + padded.length);
  return new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
}


for (const id of ['neo', 'trinity', 'smith', 'morpheus'] as const) {
  test(`${id}: a closed fighting hand opposes the thumb against the fingers instead of extending it`, async t => {
    const models = new HeroModels(new THREE.Texture(), new THREE.Texture()); t.after(() => models.dispose());
    (models as unknown as { load: typeof loadGeometry }).load = loadGeometry;
    const rig = (await models.create(id))!, motion = newMotion();
    const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 };
    const pose = advanceMotion(motion, input, 0); pose.arms.forEach(arm => { arm.grip = 1; });
    models.animate(rig, pose, motion, input, 0); rig.root.updateMatrixWorld(true);
    for (const side of ['R', 'L']) {
      const skin = rig.wardrobe.find(part => part.mesh.name === 'Anatomical_head_and_hands')!.mesh as THREE.SkinnedMesh;
      skin.skeleton.update();
      const { position, skinIndex, skinWeight } = skin.geometry.attributes;
      const thumb = new THREE.Vector3(), fingers: THREE.Vector3[] = []; let samples = 0;
      for (let vertex = 0; vertex < position.count; vertex++) {
        let fingerWeight = 0;
        for (let part = 0; part < 4; part++) {
          const weight = skinWeight.getComponent(vertex, part), name = skin.skeleton.bones[skinIndex.getComponent(vertex, part)].name;
          if (name === `finger1-3_${side}` && weight >= .95) { thumb.add(skin.getVertexPosition(vertex, new THREE.Vector3()).applyMatrix4(skin.matrixWorld)); samples++; }
          if (new RegExp(`^finger[23]-[123]_${side}$`).test(name)) fingerWeight += weight;
        }
        // Measure the whole index/middle surface, including skin that spans
        // adjacent phalanges. A knuckle need not belong to a single bone.
        if (fingerWeight >= .95) fingers.push(skin.getVertexPosition(vertex, new THREE.Vector3()).applyMatrix4(skin.matrixWorld));
      }
      assert.ok(samples > 50 && fingers.length > 100, 'measure the actual thumb pad and finger surfaces');
      thumb.divideScalar(samples);
      const gap = Math.min(...fingers.map(point => thumb.distanceTo(point)));
      assert.ok(gap < .07, `${side}: the distal thumb pad stays ${gap} away from the curled fingers`);
      const wrist = rig.bones.get(`wrist_${side}`)!;
      for (let digit = 2; digit <= 5; digit++) {
        const knuckle = wrist.worldToLocal(rig.bones.get(`finger${digit}-1_${side}`)!.getWorldPosition(new THREE.Vector3()));
        const distal = wrist.worldToLocal(rig.bones.get(`finger${digit}-3_${side}`)!.getWorldPosition(new THREE.Vector3()));
        assert.ok(Math.abs(distal.z - knuckle.z) < .018, `${side} digit ${digit}: a closed fist retains ${Math.abs(distal.z - knuckle.z)} of sideways splay`);
      }
    }
  });
}

for (const id of ['neo', 'trinity', 'smith', 'morpheus'] as const) test(`${id}: fingertips do not bury inside another finger while closing the actual skinned hand`, async t => {
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture()); t.after(() => models.dispose());
  (models as unknown as { load: typeof loadGeometry }).load = loadGeometry;
  const rig = (await models.create(id))!, motion = newMotion();
  const skin = rig.wardrobe.find(part => part.mesh.name === 'Anatomical_head_and_hands')!.mesh as THREE.SkinnedMesh;
  const { skinIndex, skinWeight, position } = skin.geometry.attributes;
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }); t.after(() => material.dispose());
  const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 };
  const ray = new THREE.Raycaster(), point = new THREE.Vector3();
  const failures: string[] = [];
  for (const side of ['R', 'L']) {
    const digit = Array.from({ length: position.count }, (_, i) => {
      const weights = [0, 0, 0, 0, 0]; let tip = false;
      for (let j = 0; j < 4; j++) {
        const name = skin.skeleton.bones[skinIndex.getComponent(i, j)].name;
        const match = new RegExp(`^finger([1-5])-([1-3])_${side}$`).exec(name);
        if (!match) continue;
        weights[Number(match[1]) - 1] += skinWeight.getComponent(i, j);
        if (match[2] === '3' && skinWeight.getComponent(i, j) > .9) tip = true;
      }
      const best = Math.max(...weights);
      return { digit: best > .5 ? weights.indexOf(best) : -1, tip };
    });
    const parts = Array.from({ length: 5 }, (_, index) => {
      const geometry = new THREE.BufferGeometry(), indices: number[] = [], original = skin.geometry.index!;
      for (let i = 0; i < original.count; i += 3) {
        const triangle = [original.getX(i), original.getX(i + 1), original.getX(i + 2)];
        if (triangle.every(vertex => digit[vertex].digit === index)) indices.push(...triangle);
      }
      geometry.setIndex(indices); t.after(() => geometry.dispose()); return new THREE.Mesh(geometry, material);
    });
    for (const grip of Array.from({ length: 21 }, (_, i) => i / 20)) {
      const pose = advanceMotion(motion, input, 0); pose.arms.forEach(arm => { arm.grip = grip; });
      models.animate(rig, pose, motion, input, 0); rig.root.updateMatrixWorld(true); skin.skeleton.update();
      const inverse = rig.bones.get(`wrist_${side}`)!.matrixWorld.clone().invert().multiply(skin.matrixWorld);
      const vertices = new Float32Array(position.count * 3);
      for (let i = 0; i < position.count; i++) skin.getVertexPosition(i, point).applyMatrix4(inverse).toArray(vertices, i * 3);
      for (const mesh of parts) { mesh.geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3)); mesh.geometry.computeBoundingBox(); mesh.geometry.computeBoundingSphere(); mesh.updateMatrixWorld(true); }
      let penetration = 0, contact = '';
      for (let i = 0; i < digit.length; i += 5) {
        if (!digit[i].tip) continue;
        point.fromArray(vertices, i * 3);
        for (const [other, mesh] of parts.entries()) {
          if (other === digit[i].digit || !mesh.geometry.boundingBox!.containsPoint(point)) continue;
          const distances = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)].map(direction => {
            ray.set(point, direction); ray.near = .00001; ray.far = .3;
            const hits = ray.intersectObject(mesh, false).filter((hit, j, all) => j === 0 || Math.abs(hit.distance - all[j - 1].distance) > 1e-5);
            return hits.length % 2 ? hits[0].distance : 0;
          });
          if (distances.every(distance => distance > 0) && Math.min(...distances) > penetration) {
            penetration = Math.min(...distances); contact = `${digit[i].digit + 1} into ${other + 1} at ${point.toArray()}`;
          }
        }
      }
      if (penetration >= .006) failures.push(`${side}, grip ${grip}: penetration ${penetration}; ${contact}`);
    }
  }
  assert.deepEqual(failures, []);
});

test('restored hands match animated hands and release to their original pose without carrying over a grip', async t => {
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture()); t.after(() => models.dispose());
  (models as unknown as { load: typeof loadGeometry }).load = loadGeometry;
  for (const id of ['neo', 'trinity', 'smith', 'morpheus'] as const) {
    const playing = (await models.create(id))!, restored = (await models.create(id))!;
    const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 };
    const motion = newMotion();
    const draw = (rig: typeof playing, grip: number) => {
      const pose = advanceMotion(motion, input, 0); pose.arms.forEach(arm => { arm.grip = grip; });
      models.animate(rig, pose, motion, input, 0); rig.root.updateMatrixWorld(true);
      return [...rig.bones].filter(([name]) => /^(finger|wrist)/.test(name)).map(([, bone]) => bone.matrixWorld.toArray());
    };
    const relaxed = draw(playing, 0);
    draw(playing, 1);
    assert.deepEqual(draw(playing, .65), draw(restored, .65), `${id}: loading a half-closed hand must not depend on a prior animation`);
    assert.deepEqual(draw(playing, 0), relaxed, `${id}: releasing the fist must restore the relaxed skin pose`);
    assert.deepEqual(draw(playing, 1), draw(restored, 1), `${id}: closing again must not accumulate bone rotations`);
  }
});
