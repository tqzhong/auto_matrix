import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
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
  const originals: { mesh: THREE.SkinnedMesh; attributes: Record<string, number[]> }[] = [];
  source.scene.traverse(object => {
    if (!(object instanceof THREE.SkinnedMesh)) return;
    originals.push({ mesh: object, attributes: Object.fromEntries(Object.entries(object.geometry.attributes).map(([name, value]) => [name, Array.from(value.array)])) });
  });
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: () => Promise<typeof source> }).load = async () => source;
  const rig = (await models.create('morpheus'))!, motion = newMotion();
  const input: MotionInput = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, ambushWardrobe: 'coat' };
  models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); rig.root.updateMatrixWorld(true);
  const shirt = rig.root.getObjectByName('morpheus-ambush-shirt') as THREE.SkinnedMesh, coat = rig.root.getObjectByName('morpheus-ambush-coat') as THREE.SkinnedMesh;
  const skin = rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  return { models, rig, shirt, coat, skin, originals };
}
function points(mesh: THREE.SkinnedMesh): Float64Array {
  mesh.skeleton.update();
  const result = new Float64Array(mesh.geometry.attributes.position.count * 3), point = new THREE.Vector3();
  for (let i = 0; i < mesh.geometry.attributes.position.count; i++) mesh.getVertexPosition(i, point).toArray(result, i * 3);
  return result;
}
function maximumDifference(a: Float64Array, b: Float64Array): number {
  assert.equal(a.length, b.length); let maximum = 0;
  for (let i = 0; i < a.length; i += 3) maximum = Math.max(maximum, Math.hypot(a[i] - b[i], a[i + 1] - b[i + 1], a[i + 2] - b[i + 2]));
  return maximum;
}

test('closing the actual fingers moves the hand while leaving the worn shirt and coat cuffs with the wrist', async () => {
  const h = await model();
  try {
    const before = [h.shirt, h.coat, h.skin].map(points);
    const wrists = ['R', 'L'].map(side => h.rig.bones.get(`wrist_${side}`)!.matrixWorld.clone());
    for (const side of ['R', 'L']) for (let digit = 1; digit <= 5; digit++) for (let joint = 1; joint <= 3; joint++) {
      const bone = h.rig.bones.get(`finger${digit}-${joint}_${side}`)!;
      if (digit === 1) bone.rotateZ((side === 'R' ? 1 : -1) * .4); else bone.rotateX(.55);
    }
    h.rig.root.updateMatrixWorld(true);
    assert.ok(maximumDifference(points(h.skin), before[2]) > .02, 'exercise the real moving hand instead of disabling its finger bones');
    for (const [i, side] of ['R', 'L'].entries()) assert.deepEqual(h.rig.bones.get(`wrist_${side}`)!.matrixWorld, wrists[i], 'only digits change in this comparison');
    for (const [i, mesh] of [h.shirt, h.coat].entries()) {
      const change = maximumDifference(points(mesh), before[i]);
      assert.ok(change < 1e-6, `${mesh.name}: finger movement pulls the actual cloth by ${change}`);
    }
  } finally { h.models.dispose(); }
});

test('cloth rebinding preserves the actual bind surface, normalized arm weights and original donor data', async () => {
  const h = await model();
  try {
    for (const mesh of [h.shirt, h.coat]) {
      assert.ok(mesh.skeleton.bones.every(bone => h.rig.bones.get(bone.name) === bone), 'wearing still uses the delivered body bones');
      mesh.skeleton.pose(); h.rig.root.updateMatrixWorld(true); mesh.skeleton.update();
      const { position, skinIndex, skinWeight } = mesh.geometry.attributes, point = new THREE.Vector3(), bind = new THREE.Vector3();
      let wristVertices = 0, maximum = 0;
      for (let i = 0; i < position.count; i++) {
        let total = 0, wrist = 0;
        for (let joint = 0; joint < 4; joint++) {
          const weight = skinWeight.getComponent(i, joint), name = mesh.skeleton.bones[skinIndex.getComponent(i, joint)].name;
          total += weight; if (/^wrist_[RL]$/.test(name)) wrist += weight;
          assert.ok(weight >= 0 && Number.isFinite(weight));
          assert.ok(!/^finger/.test(name) || weight === 0, `${mesh.name}/${i}: a sleeve is still attached to ${name}`);
        }
        assert.ok(Math.abs(total - 1) < 1e-6); if (wrist > .1) wristVertices++;
        bind.fromBufferAttribute(position, i);
        for (const [target, attribute] of (mesh.geometry.morphAttributes.position ?? []).entries()) {
          assert.ok(mesh.geometry.morphTargetsRelative, 'the delivered cloth uses relative fitting and hip targets');
          bind.addScaledVector(new THREE.Vector3().fromBufferAttribute(attribute, i), mesh.morphTargetInfluences![target]);
        }
        maximum = Math.max(maximum, mesh.getVertexPosition(i, point).distanceTo(bind));
      }
      assert.ok(wristVertices > 100, 'the actual sleeves retain hand-off at their wrist');
      assert.ok(maximum < 1e-6, `${mesh.name}: rebinding changes the delivered bind-space surface by ${maximum}`);
    }
    for (const { mesh, attributes } of h.originals) for (const [name, before] of Object.entries(attributes)) {
      assert.deepEqual(Array.from(mesh.geometry.attributes[name].array), before, `${mesh.name}/${name}: original donor data is immutable`);
    }
  } finally { h.models.dispose(); }
});
