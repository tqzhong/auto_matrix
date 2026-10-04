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
    for (const rig of [neoRig, trinityRig]) rig.root.traverse(item => { if (item instanceof THREE.SkinnedMesh) item.skeleton.update(); });
  };
  return { root, neoRig, trinityRig, pose, dispose: () => { renderer.dispose(); models.dispose(); } };
}

function lip(rig: HeroRig, role: 'neo' | 'trinity') {
  let skin!: THREE.SkinnedMesh;
  rig.root.traverseVisible(object => { if (object instanceof THREE.SkinnedMesh && (object.material as THREE.Material).name === 'Skin') skin = object; });
  assert.ok(skin, 'use the shipped face surface');
  // build-characters.py registers source lip landmark 474 into this UV1 row.
  const center = role === 'neo' ? [.2495, 1 - .722 * .5] : [.74825, 1 - .719 * .5];
  const uv = skin.geometry.attributes.uv1, positions = skin.geometry.attributes.position;
  const candidates: number[] = [];
  for (let i = 0; i < positions.count; i++) if (Math.abs(uv.getX(i) - center[0]) < .002 && Math.abs(uv.getY(i) - center[1]) < .002 && positions.getZ(i) > .2) candidates.push(i);
  candidates.sort((a, b) => positions.getZ(b) - positions.getZ(a));
  assert.ok(candidates.length, `${role}: registered lip landmark missing`);
  return skin.localToWorld(skin.getVertexPosition(candidates[0], new THREE.Vector3()));
}

function lipPatch(rig: HeroRig, role: 'neo' | 'trinity') {
  let skin!: THREE.SkinnedMesh;
  rig.root.traverseVisible(object => { if (object instanceof THREE.SkinnedMesh && (object.material as THREE.Material).name === 'Skin') skin = object; });
  const center = role === 'neo' ? [.2495, 1 - .722 * .5] : [.74825, 1 - .719 * .5];
  const uv = skin.geometry.attributes.uv1, positions = skin.geometry.attributes.position, points: THREE.Vector3[] = [];
  for (let i = 0; i < positions.count; i++) if (Math.abs(uv.getX(i) - center[0]) < .028 && Math.abs(uv.getY(i) - center[1]) < .006 && positions.getZ(i) > .2)
    points.push(skin.localToWorld(skin.getVertexPosition(i, new THREE.Vector3())));
  return points;
}

test('farewell kiss brings the actual skinned lips into contact from above without moving story roots', async () => {
  const h = await setup();
  try {
    for (const elapsed of [1.5, 1.8, 2, 2.15]) {
      const beat: FarewellEncounter = { phase: 'kiss', elapsed, total: 15.6 + elapsed };
      h.pose(beat);
      const a = lip(h.neoRig, 'neo'), b = lip(h.trinityRig, 'trinity');
      assert.ok(a.distanceTo(b) < .065, `${elapsed}: actual lip gap ${a.distanceTo(b)} (${a.toArray()} / ${b.toArray()})`);
      const neoPatch = lipPatch(h.neoRig, 'neo'), trinityPatch = lipPatch(h.trinityRig, 'trinity');
      let contact = Infinity;
      for (const a of neoPatch) for (const b of trinityPatch) contact = Math.min(contact, a.distanceTo(b));
      assert.ok(contact < .02, `${elapsed}: visible lip surfaces still have a gap ${contact}`);
      const neoHead = h.neoRig.bones.get('head')!, trinityHead = h.trinityRig.bones.get('head')!;
      assert.ok(neoHead.getWorldPosition(new THREE.Vector3()).y > trinityHead.getWorldPosition(new THREE.Vector3()).y + .04, 'Neo approaches from above, rather than folding beneath her face');
      const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(neoHead.getWorldQuaternion(new THREE.Quaternion()));
      const other = new THREE.Vector3(0, 0, 1).applyQuaternion(trinityHead.getWorldQuaternion(new THREE.Quaternion()));
      assert.ok(forward.dot(other) < -.65, `faces must oppose each other (${forward.dot(other)})`);
      const pose = farewellPose(beat);
      for (const [role, rig] of [['neo', h.neoRig], ['trinity', h.trinityRig]] as const)
        assert.deepEqual(rig.root.position.toArray(), [pose[role].x, 0, pose[role].z], 'contact must not teleport a shared root');
    }
  } finally { h.dispose(); }
});

function skinnedFace(rig: HeroRig) {
  let source!: THREE.SkinnedMesh;
  rig.root.traverseVisible(item => { if (item instanceof THREE.SkinnedMesh && (item.material as THREE.Material).name === 'Skin') source = item; });
  const positions = source.geometry.attributes.position, weights = source.geometry.attributes.skinWeight, joints = source.geometry.attributes.skinIndex;
  const values: number[] = [], selected = new Map<number, number>();
  for (let i = 0; i < positions.count; i++) {
    let headWeight = 0;
    for (let k = 0; k < 4; k++) if (/^(head|neck)$/.test(source.skeleton.bones[joints.getComponent(i, k)].name)) headWeight += weights.getComponent(i, k);
    if (headWeight < .7 || positions.getZ(i) < .1) continue;
    selected.set(i, values.length / 3); values.push(...source.localToWorld(source.getVertexPosition(i, new THREE.Vector3())).toArray());
  }
  const indices: number[] = [], original = source.geometry.index!;
  for (let i = 0; i < original.count; i += 3) {
    const triangle = [original.getX(i), original.getX(i + 1), original.getX(i + 2)];
    if (triangle.every(index => selected.has(index))) indices.push(...triangle.map(index => selected.get(index)!));
  }
  assert.ok(indices.length > 0, 'raycast actual posed facial triangles');
  // Spatial buckets retain every triangle but avoid testing the whole dense
  // head for each local penetration ray.
  const buckets = new Map<string, number[]>();
  for (let i = 0; i < indices.length; i += 3) {
    const triangle = indices.slice(i, i + 3).map(index => new THREE.Vector3().fromArray(values, index * 3));
    const center = triangle[0].clone().add(triangle[1]).add(triangle[2]).divideScalar(3);
    const key = center.toArray().map(n => Math.floor(n / .15)).join(':');
    if (!buckets.has(key)) buckets.set(key, []);
    for (const point of triangle) buckets.get(key)!.push(...point.toArray());
  }
  const mesh = new THREE.Group(), material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const geometries: THREE.BufferGeometry[] = [];
  for (const bucket of buckets.values()) {
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(bucket, 3));
    geometries.push(geometry); mesh.add(new THREE.Mesh(geometry, material));
  }
  mesh.updateMatrixWorld(true);
  const points = [...selected.values()].map(index => new THREE.Vector3().fromArray(values, index * 3));
  return { mesh, points, bounds: new THREE.Box3().setFromPoints(points), dispose: () => { geometries.forEach(geometry => geometry.dispose()); material.dispose(); } };

}

test('kiss noses and cheeks do not pass through the other actor’s actual facial skin', async () => {
  const h = await setup();
  try {
    for (const elapsed of [.75, 1.25, 1.5, 2, 2.15, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.79, 2.8]) {
      h.pose({ phase: 'kiss', elapsed, total: 15.6 + elapsed });
      const a = skinnedFace(h.neoRig), b = skinnedFace(h.trinityRig);
      try {
        for (const [role, face, other, otherRig] of [['Neo', a, b, h.trinityRig], ['Trinity', b, a, h.neoRig]] as const) {
          const center = otherRig.bones.get('head')!.getWorldPosition(new THREE.Vector3());
          const penetrations: number[] = [];
          for (const point of face.points) {
            if (!other.bounds.containsPoint(point)) continue;
            const direction = point.clone().sub(center).normalize();
            const hit = new THREE.Raycaster(point, direction, .0001, .35).intersectObject(other.mesh, true)[0];
            // The first crossing pointing outwards is an exit: the original
            // skinned vertex began inside the opposing face, not in open air.
            if (hit && hit.face!.normal.dot(direction) > .001 && hit.distance > .025) penetrations.push(hit.distance);
          }
          assert.equal(penetrations.length, 0, `${elapsed}: ${role} facial vertices penetrate by ${Math.max(...penetrations)} (${penetrations.length} samples)`);
        }
      } finally { a.dispose(); b.dispose(); }
    }
  } finally { h.dispose(); }
});

test('the kiss settles over planted shoes rather than leaning outside their support', async () => {
  const h = await setup();
  const cross = (a: THREE.Vector2, b: THREE.Vector2, c: THREE.Vector2) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  try {
    for (const elapsed of [1.5, 2, 2.15]) {
      h.pose({ phase: 'kiss', elapsed, total: 15.6 + elapsed });
      const points: THREE.Vector2[] = [];
      h.neoRig.root.traverseVisible(object => {
        if (!(object instanceof THREE.Mesh) || !/shoes/i.test(object.name)) return;
        for (let i = 0; i < object.geometry.attributes.position.count; i++) {
          const point = object.localToWorld(object.getVertexPosition(i, new THREE.Vector3()));
          const deck = -Math.tan(.035) * point.x + .35 / Math.cos(.035) - .35;
          if (point.y - deck < .045) points.push(new THREE.Vector2(point.x, point.z));
        }
      });
      assert.ok(points.some(point => point.x < -.7) && points.some(point => point.x > .7), 'both actual soles must be planted');
      points.sort((a, b) => a.x - b.x || a.y - b.y);
      const half = (rows: THREE.Vector2[]) => { const result: THREE.Vector2[] = []; for (const point of rows) { while (result.length > 1 && cross(result.at(-2)!, result.at(-1)!, point) <= 0) result.pop(); result.push(point); } return result; };
      const hull = [...half(points).slice(0, -1), ...half([...points].reverse()).slice(0, -1)];
      // A limited balance check of the supported body, not a rigid-body simulation.
      const pelvis = h.neoRig.bones.get('pelvis')!.getWorldPosition(new THREE.Vector3());
      const chest = h.neoRig.bones.get('chest')!.getWorldPosition(new THREE.Vector3());
      const body = pelvis.clone().lerp(chest, .3), projection = new THREE.Vector2(body.x, body.z);
      assert.ok(hull.every((point, index) => cross(point, hull[(index + 1) % hull.length], projection) >= -.005),
        `${elapsed}: supported-body projection ${projection.toArray()} lies outside the real sole footprint`);
    }
  } finally { h.dispose(); }
});

test('the final release joins stillness continuously in actual world-space roots and joints', async () => {
  const h = await setup();
  try {
    const snapshot = (phase: 'kiss' | 'still', elapsed: number) => {
      h.pose({ phase, elapsed, total: phase === 'kiss' ? 15.6 + elapsed : 18.4 });
      return [h.neoRig, h.trinityRig].flatMap(rig => ['pelvis', 'chest', 'head', 'ankle_L', 'ankle_R'].map(name =>
        rig.bones.get(name)!.getWorldPosition(new THREE.Vector3())));
    };
    const ending = snapshot('kiss', 2.79), still = snapshot('still', 0);
    ending.forEach((point, i) => assert.ok(point.distanceTo(still[i]) < .015, `release joint ${i} jumps ${point.distanceTo(still[i])}`));
    const exactEnd = snapshot('kiss', 2.8);
    exactEnd.forEach((point, i) => assert.ok(point.distanceTo(still[i]) < .00001, `world-space release joint ${i} changes at the phase boundary`));
    assert.ok(Math.abs(farewellPose({ phase: 'kiss', elapsed: 2.8, total: 18.4 }).neo.z - farewellPose({ phase: 'still', elapsed: 0, total: 18.4 }).neo.z) < .00001);
  } finally { h.dispose(); }
});

test('stepping into and out of the kiss always leaves at least one actual shoe on the deck', async () => {
  const h = await setup();
  try {
    for (let frame = 0; frame <= 28; frame++) {
      const elapsed = frame / 10; h.pose({ phase: 'kiss', elapsed, total: 15.6 + elapsed });
      let clearance = Infinity;
      h.neoRig.root.traverseVisible(object => {
        if (!(object instanceof THREE.Mesh) || !/shoes/i.test(object.name)) return;
        for (let i = 0; i < object.geometry.attributes.position.count; i++) {
          const point = object.localToWorld(object.getVertexPosition(i, new THREE.Vector3()));
          const deck = -Math.tan(.035) * point.x + .35 / Math.cos(.035) - .35;
          clearance = Math.min(clearance, point.y - deck);
        }
      });
      assert.ok(clearance >= -.002 && clearance < .045, `${elapsed}: both soles lost the deck (${clearance})`);
    }
  } finally { h.dispose(); }
});
