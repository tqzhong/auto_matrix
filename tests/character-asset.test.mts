import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HeroModels, type HeroRig } from '../packages/client/src/agents/HeroModel.js';
import { advanceMotion, newMotion } from '../packages/client/src/agents/CharacterMotion.js';

async function loadGeometry(id = 'neo') {
  const glb = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
  const jsonLength = glb.readUInt32LE(12);
  const document = JSON.parse(glb.subarray(20, 20 + jsonLength).toString());
  // Decode the shipped geometry with the real loader, without a DOM/image
  // decoder. Material/texture appearance is checked in the browser.
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

for (const id of ['neo', 'trinity', 'smith', 'morpheus']) {
test(`shipped ${id} mesh has valid skinning and usable anatomical bones`, async () => {
  const asset = await loadGeometry(id); const bones = new Map<string, THREE.Bone>();
  let triangles = 0;
  asset.scene.traverse(object => {
    if (object instanceof THREE.Bone) bones.set(object.name, object);
    if (!(object instanceof THREE.SkinnedMesh)) return;
    const skin = object.geometry.getAttribute('skinWeight'); const joints = object.geometry.getAttribute('skinIndex');
    triangles += object.geometry.index!.count / 3;
    for (let i = 0; i < skin.count; i++) {
      let sum = 0;
      for (let c = 0; c < 4; c++) {
        const weight = skin.array[i * 4 + c]; sum += weight;
        assert.ok(weight >= 0 && Number.isFinite(weight));
        assert.ok(joints.array[i * 4 + c] < object.skeleton.bones.length);
      }
      assert.ok(Math.abs(sum - 1) < .00001);
    }
  });
  for (const name of ['pelvis', 'spine', 'chest', 'head', 'shoulder_L', 'elbow_R', 'ankle_L', 'finger5-3_R']) assert.ok(bones.has(name), name);
  assert.ok(triangles > 25000 && triangles < 160000);
  assert.ok(asset.parser.json.extras.height >= 4.2 && asset.parser.json.extras.height <= 4.6);
});

test(`${id} eyes preserve transparent cornea texels instead of masking the iris`, async () => {
  const asset = await loadGeometry(id);
  const eyes = asset.parser.json.materials.find((material: { name: string }) => material.name === 'Eyes');
  assert.ok(['MASK', 'BLEND'].includes(eyes.alphaMode), 'opaque cornea texels cover both pupils');
});

test(`${id} stays grounded and skin deformation stays finite through running, landing and punches`, async () => {
  const { scene } = await loadGeometry(id);
  const bones = new Map<string, THREE.Bone>(); const rest = new Map<string, THREE.Vector3>();
  scene.traverse(object => {
    if (object instanceof THREE.Bone) { bones.set(object.name, object); rest.set(object.name, object.position.clone()); }
  });
  scene.updateMatrixWorld(true);
  const point = new THREE.Vector3(); const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  const footHeight = point.setFromMatrixPosition(bones.get('ankle_L')!.matrixWorld).y;
  const rig: HeroRig = { root: scene, bones, rest, panels: [], footHeight, glasses: new THREE.Group() };
  const motion = newMotion();
  const idleInput = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 };
  const idle = advanceMotion(motion, idleInput, 1 / 60);
  models.animate(rig, idle, motion, idleInput, 1 / 60); scene.updateMatrixWorld(true);
  const wrist = bones.get('wrist_L')!;
  const openFinger = wrist.worldToLocal(point.setFromMatrixPosition(bones.get('finger3-3_L')!.matrixWorld)).x;
  models.animate(rig, { ...idle, arms: idle.arms.map(arm => ({ ...arm, grip: 1 })) }, motion, idleInput, 1 / 60);
  scene.updateMatrixWorld(true);
  const closedFinger = wrist.worldToLocal(point.setFromMatrixPosition(bones.get('finger3-3_L')!.matrixWorld)).x;
  const fingerLength = bones.get('finger3-2_L')!.position.length() + bones.get('finger3-3_L')!.position.length();
  assert.ok(closedFinger < openFinger - fingerLength * .2, 'fingers curl toward the palm relative to their own length');
  for (let frame = 0; frame < 360; frame++) {
    const input = { speed: frame < 60 ? 0 : 14, grounded: frame < 180 || frame > 220, verticalVelocity: frame < 200 ? 5 : -5,
      turn: Math.sin(frame / 50), attack: frame > 260 ? Math.floor(frame / 50) : undefined };
    const pose = advanceMotion(motion, input, 1 / 60);
    models.animate(rig, pose, motion, input, 1 / 60); scene.updateMatrixWorld(true);
    if (input.grounded) {
      const soles = ['R', 'L'].map(side => point.setFromMatrixPosition(bones.get('ankle_' + side)!.matrixWorld).y - footHeight);
      assert.ok(Math.abs(Math.min(...soles)) < .00001, 'one foot contacts the floor');
    }
    if (frame % 30 === 0) scene.traverse(object => {
      if (!(object instanceof THREE.SkinnedMesh)) return;
      object.skeleton.update();
      for (let v = 0; v < object.geometry.attributes.position.count; v += 19) {
        object.getVertexPosition(v, point);
        assert.ok(point.toArray().every(Number.isFinite));
        assert.ok(point.length() < 8, 'skin cannot explode away from its skeleton');
      }
    });
  }
  models.dispose();
});
}
