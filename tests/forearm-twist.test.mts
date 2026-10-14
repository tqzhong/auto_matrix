import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, PILL_ROOM, pillRoot } from '@auto_matrix/shared';
import { HeroModels } from '../packages/client/src/agents/HeroModel.js';
import { advanceMotion, newMotion } from '../packages/client/src/agents/CharacterMotion.js';
import type { MotionInput } from '../packages/client/src/agents/CharacterMotion.js';

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

for (const [id, choice] of [['neo', 'red'], ['neo', 'blue'], ['morpheus', 'red']] as const) {
  test(`${id}/${choice}: the saved pill gesture keeps forearm skin continuous through the palm turn`, async t => {
    const models = new HeroModels(new THREE.Texture(), new THREE.Texture()); t.after(() => models.dispose());
    (models as unknown as { load: typeof loadGeometry }).load = loadGeometry;
    const rig = (await models.create(id))!, cold = (await models.create(id))!, motion = newMotion();
    const sides = id === 'neo' ? [choice === 'red' ? 'L' : 'R'] : ['R', 'L'];
    const skin = rig.wardrobe.find(part => part.mesh.userData.wristSkin)!.mesh as THREE.SkinnedMesh;
    const probes: number[] = [], { skinIndex, skinWeight } = skin.geometry.attributes;
    for (let i = 0; i < skinIndex.count; i++) if ([0, 1, 2, 3].some(j => skinWeight.getComponent(i, j) > .05 &&
      sides.some(side => skin.skeleton.bones[skinIndex.getComponent(i, j)].name.startsWith(`forearm_twist_${side}_`)))) probes.push(i);
    assert.ok(probes.length > 200, 'measure actual anatomy influenced by the deforming forearm');
    const pose = (body: typeof rig, phase: 'taking' | 'offering', elapsed: number) => {
      const pills = { phase, elapsed, choice, role: id }, input: MotionInput = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, pills };
      const root = id === 'neo' ? pillRoot({ ...pills, approach: { x: 1.75, z: -6, yaw: -Math.PI / 2 } })
        : { x: -PILL_ROOM.seat, z: PILL_ROOM.z, yaw: Math.PI / 2 }, center = FILM_SETS.film_lafayette.center;
      body.root.position.set(center.x + root.x, center.y - 1, center.z + root.z); body.root.rotation.y = root.yaw;
      models.animate(body, advanceMotion(motion, input, 0), motion, input, 0); body.root.updateMatrixWorld(true);
      const patch = body.wardrobe.find(part => part.mesh.userData.wristSkin)!.mesh as THREE.SkinnedMesh; patch.skeleton.update();
      return probes.map(i => patch.localToWorld(patch.getVertexPosition(i, new THREE.Vector3())));
    };
    let maximumSkinStep = 0, maximumTurn = 0;
    for (const phase of id === 'neo' ? ['taking'] as const : ['offering', 'taking'] as const) {
      let before: THREE.Vector3[] | undefined, rotations: THREE.Quaternion[] | undefined;
      for (let frame = 0; frame <= (phase === 'offering' ? 400 : 435); frame++) {
        const elapsed = frame / 100, points = pose(rig, phase, elapsed);
        const now = sides.flatMap(side => [1, 2, 3].map(part => rig.bones.get(`forearm_twist_${side}_${part}`)!.getWorldQuaternion(new THREE.Quaternion())));
        if (before) {
          maximumSkinStep = Math.max(maximumSkinStep, ...points.map((point, i) => point.distanceTo(before![i])));
          maximumTurn = Math.max(maximumTurn, ...now.map((q, i) => q.angleTo(rotations![i])));
        }
        before = points; rotations = now;
        if ([0, 250, 271, 272, 289, 290, 350, 400, 435].includes(frame)) {
          const restored = pose(cold, phase, elapsed); points.forEach((point, i) =>
            assert.ok(point.distanceTo(restored[i]) < 1e-7, 'cold reconstruction cannot choose a different turn from the earlier motion'));
          for (const side of sides) {
            const wrist = cold.bones.get(`wrist_${side}`)!, q = wrist.quaternion;
            q.set(-q.x, -q.y, -q.z, -q.w); wrist.updateWorldMatrix(false, true);
          }
          const patch = cold.wardrobe.find(part => part.mesh.userData.wristSkin)!.mesh as THREE.SkinnedMesh; patch.skeleton.update();
          probes.forEach((vertex, i) => assert.ok(points[i].distanceTo(patch.localToWorld(patch.getVertexPosition(vertex, new THREE.Vector3()))) < 1e-7,
            'equivalent quaternion signs must deform the saved arm identically'));
        }
      }
    }
    t.diagnostic(JSON.stringify({ id, choice, probes: probes.length, maximumSkinStep, maximumTurn }));
    assert.ok(maximumTurn < .15, `a 10ms pill step flips a forearm joint by ${maximumTurn} radians`);
    assert.ok(maximumSkinStep < .05, `forearm skin teleports by ${maximumSkinStep} world units between neighboring pill frames`);
  });
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
