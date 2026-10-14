import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HeroModels } from '../packages/client/src/agents/HeroModel.js';
import { advanceMotion, newMotion } from '../packages/client/src/agents/CharacterMotion.js';

async function loadGeometry(id: string) {
  const bytes = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
  const length = bytes.readUInt32LE(12), document = JSON.parse(bytes.subarray(20, 20 + length).toString());
  for (const material of document.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const binary = bytes.subarray(20 + length), result = Buffer.alloc(20 + padded.length + binary.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); binary.copy(result, 20 + padded.length);
  return new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
}

test('late wrist contact corrections update the forearm in the same frame', async t => {
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture()); t.after(() => models.dispose());
  (models as unknown as { load: typeof loadGeometry }).load = loadGeometry;
  const rig = (await models.create('smith'))!, wrist = rig.bones.get('wrist_R')!;
  const sleeve = rig.wardrobe.find(part => part.mesh.name === 'Tailored_coat_upper')!.mesh as THREE.SkinnedMesh;
  const read = () => { sleeve.skeleton.update(); return Array.from({ length: sleeve.geometry.attributes.position.count }, (_, i) =>
    sleeve.getVertexPosition(i, new THREE.Vector3()).toArray().map(n => Math.round(n * 1e6))); };
  rig.root.updateWorldMatrix(true, true);
  wrist.quaternion.setFromAxisAngle(wrist.position.clone().normalize(), 2.2);
  wrist.updateWorldMatrix(false, true);
  const contact = read(); rig.root.updateWorldMatrix(true, true);
  assert.deepEqual(contact, read(), 'a wrist-only IK update must not leave its sleeve on the previous frame');
});

test('shared hero assets retain neutral geometry, hand targets and independent restored forearms', async t => {
  const assets = new Map<string, Awaited<ReturnType<typeof loadGeometry>>>();
  const load = async (id: string) => { if (!assets.has(id)) assets.set(id, await loadGeometry(id)); return assets.get(id)!; };
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture()), original = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: typeof loadGeometry }).load = load;
  (original as unknown as { load: typeof loadGeometry }).load = load;
  original['forearms'].attach = () => {};
  t.after(() => { models.dispose(); original.dispose(); });
  const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 }, motion = newMotion();
  for (const id of ['neo', 'trinity', 'smith', 'morpheus'] as const) {
    const reference = (await original.create(id))!, playing = (await models.create(id))!, restored = (await models.create(id))!;
    const sample = (rig: typeof playing, angle: number) => {
      models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0);
      for (const side of ['R', 'L']) {
        const wrist = rig.bones.get(`wrist_${side}`)!;
        wrist.quaternion.setFromAxisAngle(wrist.position.clone().normalize(), side === 'R' ? angle : -angle);
        wrist.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), .35));
      }
      rig.root.updateMatrixWorld(true);
      return rig.wardrobe.flatMap(({ mesh }) => {
        if (!(mesh instanceof THREE.SkinnedMesh)) return [];
        mesh.skeleton.update();
        return Array.from({ length: mesh.geometry.attributes.position.count }, (_, i) => mesh.getVertexPosition(i, new THREE.Vector3()).toArray());
      });
    };
    for (const part of playing.wardrobe) {
      const before = reference.wardrobe.find(other => other.mesh.name === part.mesh.name);
      if (!before || !(part.mesh instanceof THREE.SkinnedMesh) || !(before.mesh instanceof THREE.SkinnedMesh)) continue;
      assert.deepEqual(part.mesh.geometry.attributes.position.array, before.mesh.geometry.attributes.position.array, 'no asset reshaping or facial changes');
      part.mesh.skeleton.update(); before.mesh.skeleton.update();
      for (let i = 0; i < part.mesh.geometry.attributes.position.count; i += 7) assert.ok(
        part.mesh.getVertexPosition(i, new THREE.Vector3()).distanceTo(before.mesh.getVertexPosition(i, new THREE.Vector3())) < 1e-6,
        `${id} ${part.mesh.name}: the unrotated body must keep its exact surface`);
    }
    const frozen = sample(playing, 2.2); sample(restored, -1.8);
    assert.deepEqual(sample(playing, 2.2), frozen, 'another actor cannot mutate this actor’s skinning');
    assert.deepEqual(sample(restored, 2.2), frozen, 'the saved pose is independent of the previously played gesture');
    sample(playing, -2.2); assert.deepEqual(sample(playing, 2.2), frozen, 'no accumulated twist after changing poses');
    sample(reference, 2.2);
    for (const [name, bone] of reference.bones) assert.ok(bone.matrixWorld.elements.every((value, i) => Math.abs(value - playing.bones.get(name)!.matrixWorld.elements[i]) < 1e-7),
      `${id} ${name}: adding deformation joints cannot move the original skeleton or its hand targets`);
  }
});

for (const id of ['neo', 'trinity', 'smith', 'morpheus'] as const) {
  test(`${id}: turning the palm preserves the actual forearm and cuff cross-section`, async t => {
    const models = new HeroModels(new THREE.Texture(), new THREE.Texture()); t.after(() => models.dispose());
    (models as unknown as { load: typeof loadGeometry }).load = loadGeometry;
    const rig = (await models.create(id))!, failures: string[] = []; let minimumRadius = 1, sampleCount = 0;
    for (const side of ['R', 'L']) {
      const wrist = rig.bones.get(`wrist_${side}`)!, elbow = rig.bones.get(`elbow_${side}`)!;
      wrist.quaternion.identity(); rig.root.updateMatrixWorld(true);
      const axis = wrist.position.clone().normalize(), point = new THREE.Vector3(), offset = new THREE.Vector3();
      const inverse = elbow.matrixWorld.clone().invert(), samples: { mesh: THREE.SkinnedMesh; vertex: number; radius: number }[] = [];
      for (const { mesh } of rig.wardrobe) {
        if (!(mesh instanceof THREE.SkinnedMesh)) continue;
        const { position, skinIndex, skinWeight } = mesh.geometry.attributes;
        mesh.skeleton.update();
        for (let i = 0; i < position.count; i++) {
          let arm = 0, finger = 0;
          for (let j = 0; j < 4; j++) {
            const name = mesh.skeleton.bones[skinIndex.getComponent(i, j)].name, weight = skinWeight.getComponent(i, j);
            if (name === `elbow_${side}` || name === `wrist_${side}` || name.startsWith(`forearm_twist_${side}_`)) arm += weight;
            if (name.startsWith('finger')) finger += weight;
          }
          if (arm < .99 || finger > .001) continue;
          mesh.getVertexPosition(i, point).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);
          offset.copy(point).sub(wrist.position);
          const along = offset.dot(axis), radius = offset.addScaledVector(axis, -along).length();
          if (along > -.4 && along < .02 && radius > .025) samples.push({ mesh, vertex: i, radius });
        }
      }
      assert.ok(samples.length > 200, `${side}: cover real anatomy and every shipped sleeve, including alternate costumes`);
      sampleCount += samples.length;
      for (const angle of [-2.8, -1.4, 1.4, 2.8]) {
        wrist.quaternion.setFromAxisAngle(axis, angle); rig.root.updateMatrixWorld(true);
        for (const { mesh } of rig.wardrobe) if (mesh instanceof THREE.SkinnedMesh) mesh.skeleton.update();
        let minimum = 1, location = '';
        for (const sample of samples) {
          sample.mesh.getVertexPosition(sample.vertex, point).applyMatrix4(sample.mesh.matrixWorld).applyMatrix4(inverse);
          offset.copy(point).sub(wrist.position); offset.addScaledVector(axis, -offset.dot(axis));
          const ratio = offset.length() / sample.radius;
          if (ratio < minimum) { minimum = ratio; location = `${sample.mesh.name} vertex ${sample.vertex}`; }
        }
        if (minimum < .85) failures.push(`${side}, ${angle}: ${location} collapses to ${minimum} of its original radius`);
        minimumRadius = Math.min(minimumRadius, minimum);
      }
      wrist.quaternion.identity();
    }
    assert.deepEqual(failures, []);
    t.diagnostic(JSON.stringify({ id, sampleCount, minimumRadius }));
  });
}
