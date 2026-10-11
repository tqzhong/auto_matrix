import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HeroModels } from '../packages/client/src/agents/HeroModel.js';
import { advanceMotion, newMotion } from '../packages/client/src/agents/CharacterMotion.js';

async function heroAsset(id: string) {
  const glb = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
  const jsonLength = glb.readUInt32LE(12), document = JSON.parse(glb.subarray(20, 20 + jsonLength).toString());
  for (const material of document.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = glb.subarray(20 + jsonLength), result = Buffer.alloc(20 + padded.length + bin.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); bin.copy(result, 20 + padded.length);
  return new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
}

test('silver starts on Neo’s contacting index and middle fingers, then crosses the palm before coating the other fingertips', async t => {
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking'].map(async id => [id, await heroAsset(id)] as const)));
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: (id: string) => Promise<Awaited<ReturnType<typeof heroAsset>>> }).load = async id => assets.get(id)!;
  try {
    const rig = (await models.create('neo'))!, motion = newMotion();
    const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, performance: 'touch' as const, mirrorBeat: 3.85 };
    models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0);
    const mesh = rig.wardrobe.find(part => (part.mesh.material as THREE.Material).name === 'Skin')!.mesh as THREE.SkinnedMesh;
    const { skinIndex, skinWeight, _mirrorArrival: arrival } = mesh.geometry.attributes;
    const region = (name: string) => {
      const joint = mesh.skeleton.bones.indexOf(rig.bones.get(name)!);
      const samples: number[] = [];
      // The thumb knuckle shares its weights with the palm (maximum .751).
      // Sample vertices primarily controlled by each joint, including that seam.
      for (let i = 0; i < arrival.count; i++) if ([0, 1, 2, 3].some(j => skinIndex.getComponent(i, j) === joint && skinWeight.getComponent(i, j) > .5))
        samples.push(arrival.getX(i));
      assert.ok(samples.length > 4, `the shipped skin must represent ${name}, not a synthetic test hand`);
      return { count: samples.length, min: Math.min(...samples), max: Math.max(...samples), mean: samples.reduce((sum, value) => sum + value, 0) / samples.length };
    };
    const fingers = [1, 2, 3, 4, 5].map(finger => ({ finger, base: region(`finger${finger}-1_R`), tip: region(`finger${finger}-3_R`) }));
    const palm = region('wrist_R'); t.diagnostic(JSON.stringify({ fingers, palm }));
    for (const { finger, tip } of fingers.filter(({ finger }) => finger === 2 || finger === 3))
      assert.ok(tip.mean < .09, `contacting finger ${finger} must pick up the first silver`);
    for (const { finger, base, tip } of fingers.filter(({ finger }) => finger !== 2 && finger !== 3)) {
      assert.ok(base.min > .27, `noncontact finger ${finger} cannot develop a separate silver patch before the palm`);
      assert.ok(tip.min > .32, `noncontact fingertip ${finger} must stay bare during the initial touch`);
      assert.ok(tip.mean > base.mean + .035, `silver must travel out from finger ${finger}’s knuckle instead of appearing at its distant tip`);
    }
    assert.ok(palm.mean > .27 && palm.mean < .39, 'the wrist and palm remain the bridge between fingertips and forearm');
  } finally { models.dispose(); }
});
