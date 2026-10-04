import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HeroModels, type HeroRig } from '../packages/client/src/agents/HeroModel.js';
import { advanceMotion, newMotion } from '../packages/client/src/agents/CharacterMotion.js';
import { farewellPose, newFarewell, type FarewellEncounter } from '@auto_matrix/shared';
import { LogosWreckRenderer } from '../packages/client/src/engine/LogosWreckRenderer.js';
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

const beats: FarewellEncounter[] = [newFarewell(),
  ...[0, .6, 1.2, 1.8, 2.4].map(elapsed => ({ phase: 'reaching' as const, elapsed, total: elapsed })),
  { phase: 'discovery', elapsed: 1.7, total: 4.1 }, { phase: 'promise', elapsed: 2.3, total: 8.1 },
  ...[0, 1, 2.6, 5.2].map(elapsed => ({ phase: 'goodbye' as const, elapsed, total: 10.4 + elapsed })),
  ...[0, .25, .75, 1.5, 2, 2.5, 2.8].map(elapsed => ({ phase: 'kiss' as const, elapsed, total: 15.6 + elapsed })),
  { phase: 'still', elapsed: 0, total: 18.4 }];

async function setup() {
  const [neo, office, trinity] = await Promise.all([loadGeometry('neo'), loadGeometry('neo-office'), loadGeometry('trinity')]);
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: (id: string) => Promise<typeof neo> }).load = async id => id === 'neo-office' ? office : id === 'trinity' ? trinity : neo;
  const neoRig = (await models.create('neo'))!, trinityRig = (await models.create('trinity'))!;
  const root = new THREE.Group(), renderer = new LogosWreckRenderer(root); root.updateMatrixWorld(true);
  const pose = (encounter: FarewellEncounter) => {
    const body = farewellPose(encounter), neoMotion = newMotion(), trinityMotion = newMotion();
    neoRig.root.position.set(body.neo.x, 0, body.neo.z); neoRig.root.rotation.set(0, body.neo.yaw, 0);
    trinityRig.root.position.set(body.trinity.x, 0, body.trinity.z); trinityRig.root.rotation.set(-.48, body.trinity.yaw, 0);
    const trinityInput = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, floorSeated: true,
      farewell: { ...encounter, role: 'trinity' as const } };
    models.animate(trinityRig, advanceMotion(trinityMotion, trinityInput, 0), trinityMotion, trinityInput, 0); trinityRig.root.updateMatrixWorld(true);
    const handTarget = trinityRig.bones.get('wrist_R')!.localToWorld(new THREE.Vector3(0, -.08, .04));
    const neoInput = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, crouching: true,
      farewell: { ...encounter, role: 'neo' as const, target: handTarget } };
    models.animate(neoRig, advanceMotion(neoMotion, neoInput, 0), neoMotion, neoInput, 0); neoRig.root.updateMatrixWorld(true);
    const faceTarget = neoRig.bones.get('head')!.localToWorld(new THREE.Vector3(0, .1, .08));
    const reaching = { ...trinityInput, farewell: { ...trinityInput.farewell, target: faceTarget } };
    models.animate(trinityRig, advanceMotion(trinityMotion, reaching, 0), trinityMotion, reaching, 0); trinityRig.root.updateMatrixWorld(true);
    for (const rig of [neoRig, trinityRig]) rig.root.traverse(item => {
      if (item instanceof THREE.SkinnedMesh) { item.skeleton.update(); item.computeBoundingBox(); item.computeBoundingSphere(); }
    });
  };
  return { root, neoRig, trinityRig, pose, dispose: () => { renderer.dispose(); models.dispose(); } };
}

function vertices(rig: HeroRig, names: RegExp) {
  const points: THREE.Vector3[] = [];
  rig.root.traverseVisible(object => {
    if (!(object instanceof THREE.Mesh) || !names.test(object.name)) return;
    for (let i = 0; i < object.geometry.attributes.position.count; i++)
      points.push(object.localToWorld(object.getVertexPosition(i, new THREE.Vector3())));
  });
  assert.ok(points.length > 0, 'measure visible shipped surfaces');
  return points;
}

// The deck is a tilted physical box. Its top plane, not an arbitrary y=0,
// determines foot clearance in wreck-local space.
const deckHeight = (x: number) => -Math.tan(.035) * x + .35 / Math.cos(.035) - .35;

test('Trinity has a seat beneath her pelvis and a backrest behind her actual upper back', async () => {
  const h = await setup();
  try {
    const upholstery: THREE.Object3D[] = [];
    h.root.traverse(item => { if (item instanceof THREE.Mesh && item.material instanceof THREE.MeshStandardMaterial && item.material.color.getHex() === 0x0d1517) upholstery.push(item); });
    for (const beat of beats) {
      h.pose(beat);
      const pelvis = h.trinityRig.bones.get('pelvis')!.getWorldPosition(new THREE.Vector3());
      for (const x of [-.18, .18]) {
        const hit = new THREE.Raycaster(pelvis.clone().add(new THREE.Vector3(x, 0, 0)), new THREE.Vector3(0, -1, 0), 0, 3).intersectObjects(upholstery, false)[0];
        assert.ok(hit && hit.distance > .12 && hit.distance < .43, `${beat.phase}: pelvis has no close seat support (${hit?.distance})`);
      }
      const chest = h.trinityRig.bones.get('chest')!.getWorldPosition(new THREE.Vector3());
      const hit = new THREE.Raycaster(chest, new THREE.Vector3(0, 0, -1), 0, 3).intersectObjects(upholstery, false)[0];
      assert.ok(hit && hit.distance > .13 && hit.distance < .38, `${beat.phase}: upper back has no close backrest (${hit?.distance})`);
    }
  } finally { h.dispose(); }
});

test('both farewell actors keep their shipped footwear and trouser knees above the physical deck', async () => {
  const h = await setup();
  try {
    for (const beat of beats) {
      h.pose(beat);
      for (const [role, rig] of [['trinity', h.trinityRig], ['neo', h.neoRig]] as const) {
        const points = vertices(rig, /shoes|trousers/i);
        const low = Math.min(...points.map(point => point.y - deckHeight(point.x)));
        assert.ok(low >= -.002, `${beat.phase}/${beat.elapsed}: ${role} footwear or knee penetrates deck by ${low}`);
        const normal = new THREE.Vector3(Math.sin(.035), Math.cos(.035), 0);
        for (const side of ['R', 'L']) {
          const up = new THREE.Vector3(0, 1, 0).applyQuaternion(rig.bones.get(`ankle_${side}`)!.getWorldQuaternion(new THREE.Quaternion()));
          assert.ok(up.dot(normal) > .9999, `${role}: turning around must not reverse the sole's deck slope`);
        }
      }
    }
  } finally { h.dispose(); }
});

test('the support furniture leaves both visible bodies and the approach to the kiss clear', async () => {
  const h = await setup();
  try {
    const furniture = ['logos-wreck-trinity-seat', 'logos-wreck-trinity-back', 'logos-wreck-chair-mount', 'logos-wreck-console'].map(name => {
      const mesh = h.root.getObjectByName(name) as THREE.Mesh;
      mesh.geometry.computeBoundingBox(); return { mesh, bounds: mesh.geometry.boundingBox!.clone().expandByScalar(-.03) };
    });
    for (const beat of beats) {
      h.pose(beat);
      for (const [role, rig] of [['trinity', h.trinityRig], ['neo', h.neoRig]] as const) {
        const points = vertices(rig, /./);
        for (const { mesh, bounds } of furniture) {
          const collisions = points.filter(point => bounds.containsPoint(mesh.worldToLocal(point.clone())));
          assert.equal(collisions.length, 0, `${beat.phase}/${beat.elapsed}: ${mesh.name} penetrates ${role} at ${collisions.slice(0, 3).map(point => point.toArray())}`);
        }
      }
    }
  } finally { h.dispose(); }
});

test('the shipped seat and back surfaces meet Trinity’s trousers and jacket without a visible support gap', async () => {
  const h = await setup();
  try {
    for (const beat of [beats[0], beats[10], beats[15], beats.at(-1)!]) {
      h.pose(beat);
      const seat = h.root.getObjectByName('logos-wreck-trinity-seat')!, back = h.root.getObjectByName('logos-wreck-trinity-back')!;
      const under = vertices(h.trinityRig, /trousers/i).map(point => seat.worldToLocal(point)).filter(point => Math.abs(point.x) < .55 && Math.abs(point.z) < .35);
      const behind = vertices(h.trinityRig, /Fitted_leather_jacket/).map(point => back.worldToLocal(point)).filter(point => Math.abs(point.x) < .6 && Math.abs(point.y) < .6);
      const seatGap = Math.min(...under.map(point => point.y)) - .15;
      const backGap = Math.min(...behind.map(point => point.z)) - .125;
      assert.ok(seatGap > -.03 && seatGap < .06, `${beat.phase}: actual buttock-to-seat gap ${seatGap}`);
      assert.ok(backGap > -.03 && backGap < .08, `${beat.phase}: actual jacket-to-backrest gap ${backGap}`);
    }
  } finally { h.dispose(); }
});

for (const aspect of [16 / 9, 9 / 16]) test(`the third-person farewell camera keeps both faces and torsos in frame at aspect ${aspect}`, async () => {
  const h = await setup();
  try {
    const camera = new THREE.PerspectiveCamera(57, aspect, .5, 5000);
    for (const beat of beats) {
      h.pose(beat); const neo = farewellPose(beat).neo;
      camera.position.set(neo.x + (aspect < .85 ? 5.8 : 4.8), 5.4, neo.z + 3.2);
      camera.lookAt(neo.x, 2.45, neo.z - .35); camera.updateMatrixWorld(true);
      for (const rig of [h.neoRig, h.trinityRig]) for (const name of ['head', 'chest']) {
        const screen = rig.bones.get(name)!.getWorldPosition(new THREE.Vector3()).project(camera);
        assert.ok(Math.abs(screen.x) < .95 && Math.abs(screen.y) < .95 && screen.z > -1 && screen.z < 1,
          `${beat.phase}: ${name} is cropped at ${screen.toArray()}`);
      }
    }
  } finally { h.dispose(); }
});
