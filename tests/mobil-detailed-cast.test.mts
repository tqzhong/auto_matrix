import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { MOBIL_FAMILY, MOBIL_STATION, mobilPassengerPose } from '@auto_matrix/shared';
import { contactMobilFamily } from '../packages/client/src/agents/MobilFamilyPerformance.js';

async function shipped(name: string) {
  const bytes = await readFile(new URL(`../packages/client/public/assets/characters/${name}.glb`, import.meta.url));
  const length = bytes.readUInt32LE(12), document = JSON.parse(bytes.subarray(20, 20 + length).toString());
  // Keep shipped geometry, skinning and UVs. The browser checks the PNG and shader.
  for (const material of document.materials) delete material.pbrMetallicRoughness.baseColorTexture;
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const binary = bytes.subarray(20 + length), output = Buffer.alloc(20 + padded.length + binary.length);
  output.writeUInt32LE(0x46546c67, 0); output.writeUInt32LE(2, 4); output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(padded.length, 12); output.writeUInt32LE(0x4e4f534a, 16); padded.copy(output, 20); binary.copy(output, 20 + padded.length);
  const asset = await new GLTFLoader().parseAsync(output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength), '');
  if (name.endsWith('-head')) asset.scene.traverse(object => { if (object instanceof THREE.Mesh) (object.material as THREE.MeshStandardMaterial).map = new THREE.Texture(); });
  return asset;
}

async function fixture(t: TestContext) {
  const roles = ['rama_kandra', 'kamala', 'trainman'] as const;
  const assets = Object.fromEntries(await Promise.all(roles.flatMap(role => ['head', 'body'].map(async part => [role + '-' + part, await shipped(role + '-' + part)]))));
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async url => {
    const name = String(url).split('/').pop()!.replace('.glb', ''); assert.ok(assets[name], `unexpected asset ${name}`); return assets[name];
  });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  t.after(() => { models.dispose(); globalThis.document = previous; });
  const rigs = Object.fromEntries(roles.map(role => [role, models.create(world.agents.get(role)!)]));
  const pose = () => {
    for (const role of roles) {
      models.animate(rigs[role], 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, seated: role === 'kamala', mobilStation: true }, 1);
      rigs[role].root.updateMatrixWorld(true);
    }
  };
  pose(); await new Promise(resolve => setImmediate(resolve)); pose();
  return { rigs, pose, models };
}

test('Mobil cast renders its own continuous anatomy and registered heads without relocating saved roots', async t => {
  const { rigs, pose } = await fixture(t);
  for (const [role, rig] of Object.entries(rigs)) {
    assert.ok(rig.head.getObjectByName(`${role}-detailed-head`), `${role} still uses its generic face`);
    assert.ok(rig.detail.getObjectByName(`${role}-anatomical-body`), `${role} still uses separate primitive limbs`);
    assert.equal(rig.head.getObjectByName(`${role}-fallback-head`)!.visible, false);
    const saved = rig.root.matrixWorld.clone(); pose(); assert.ok(rig.root.matrixWorld.equals(saved));
  }
});

test('the loaded Kamala costume keeps its visible seated skirt and feet outside the bench seat', async t => {
  const { rigs } = await fixture(t), rig = rigs.kamala;
  rig.root.position.set(MOBIL_FAMILY[1].x, 0, MOBIL_FAMILY[1].z); rig.root.rotation.y = Math.PI / 2; rig.root.updateMatrixWorld(true);
  assert.equal(rig.detail.getObjectByName('kamala-skirt')!.visible, true, 'loading the body must preserve her film skirt');
  let lowest = Infinity; const penetration: string[] = [];
  rig.detail.traverseVisible(object => {
    if (!(object instanceof THREE.Mesh)) return;
    if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
    for (let i = 0; i < object.geometry.attributes.position.count; i++) {
      const point = object.localToWorld(object.getVertexPosition(i, new THREE.Vector3())); lowest = Math.min(lowest, point.y);
      if (Math.abs(point.x - MOBIL_STATION.bench.x) < .82 && Math.abs(point.z - MOBIL_STATION.bench.z) < 3
        && point.y > MOBIL_STATION.bench.seat - .18 && point.y < MOBIL_STATION.bench.seat - .04) penetration.push(`${object.name}:${point.toArray()}`);
    }
  });
  assert.ok(lowest >= -.025 && lowest < .04, `the loaded shoes require platform support: ${lowest}`);
  assert.deepEqual(penetration, [], 'the actual loaded anatomy and clothing must not intersect the solid seat');
});

test('Kamala stands over her planted shoes without sliding them or passing her loaded costume through the bench', async t => {
  const { rigs, models } = await fixture(t), rig = rigs.kamala;
  let planted: THREE.Vector3[] | undefined;
  for (const boarding of [.14, .17, .20, .24, .27, .2948]) {
    const pose = mobilPassengerPose(1, boarding);
    rig.root.position.set(pose.x, 0, pose.z); rig.root.rotation.y = Math.PI / 2;
    models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0,
      seated: pose.seated > .5, mobilStation: true, mobilSeat: pose.seated }, 1);
    rig.root.updateMatrixWorld(true);
    const ankles = rig.ankles.map(ankle => ankle.getWorldPosition(new THREE.Vector3()));
    planted ??= ankles.map(ankle => ankle.clone());
    for (const [i, ankle] of ankles.entries()) assert.ok(Math.hypot(ankle.x - planted[i].x, ankle.z - planted[i].z) < .02,
      `the actual ankle slid during standing at ${boarding}: ${ankle.toArray()}`);
    let lowest = Infinity; const penetrations: string[] = [];
    rig.detail.traverseVisible(object => {
      if (!(object instanceof THREE.Mesh)) return;
      if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
      for (let v = 0; v < object.geometry.attributes.position.count; v++) {
        const p = object.localToWorld(object.getVertexPosition(v, new THREE.Vector3())); lowest = Math.min(lowest, p.y);
        if (Math.abs(p.x - MOBIL_STATION.bench.x) < .82 && Math.abs(p.z - MOBIL_STATION.bench.z) < 3
          && p.y > MOBIL_STATION.bench.seat - .18 && p.y < MOBIL_STATION.bench.seat - .04) penetrations.push(object.name);
      }
    });
    assert.ok(lowest >= -.025 && lowest < .04, `the loaded shoes must stay supported at ${boarding}: ${lowest}`);
    assert.deepEqual(penetrations, [], `the actual costume crosses the seat at ${boarding}`);
  }
});

test('Rama’s suit hem covers the dark trousers around the hips', async t => {
  const { rigs } = await fixture(t), rig = rigs.rama_kandra;
  const jacket = rig.detail.getObjectByName('rama_kandra-jacket-hem') as THREE.SkinnedMesh;
  const trousers = rig.detail.getObjectByName('rama_kandra-work-trousers') as THREE.SkinnedMesh;
  jacket.skeleton.update(); trousers.skeleton.update();
  const exposed: string[] = []; let compared = 0;
  for (const y of [1.65, 1.74, 1.83, 1.92]) for (let i = 0; i < 24; i++) {
    // Sample face interiors: an exact shared edge can miss both adjacent triangles.
    const a = (i + .37) / 24 * Math.PI * 2, origin = rig.detail.localToWorld(new THREE.Vector3(Math.sin(a) * 2, y, Math.cos(a) * 2));
    const direction = new THREE.Vector3(-Math.sin(a), 0, -Math.cos(a)).transformDirection(rig.detail.matrixWorld);
    const ray = new THREE.Raycaster(origin, direction), outer = ray.intersectObject(jacket, false)[0], inner = ray.intersectObject(trousers, false)[0];
    if (outer && inner) { compared++; if (inner.distance < outer.distance - .002) exposed.push(`${y}/${i}:${outer.distance - inner.distance}`); }
  }
  assert.ok(compared > 60, 'compare the shipped inner and outer geometry around the whole waist');
  assert.deepEqual(exposed, [], 'dark trousers form an exposed band through the suit hem');
});

test('family gestures keep the loaded seated costume supported and the parents hands on the lap and child shoulder', async t => {
  const { rigs, models } = await fixture(t), world = new WorldState(); new AgentManager(world).initializeAllAgents();
  // Sati currently uses her procedural body; retain that actual contact rig.
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  const sati = models.create(world.agents.get('sati')!);
  const family = [rigs.rama_kandra, rigs.kamala, sati];
  family.forEach((rig, i) => { rig.root.position.set(MOBIL_FAMILY[i].x, 0, MOBIL_FAMILY[i].z); rig.root.rotation.y = Math.PI / 2; });
  for (const elapsed of [0, .5, 2.2]) {
    for (const [i, rig] of family.entries()) models.animate(rig, .1, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0,
      seated: i === 1, mobilStation: true, mobilFamily: { role: MOBIL_FAMILY[i].id, phase: 'hearing', elapsed, speaker: 'rama_kandra',
        look: { x: -7, y: 4.05, z: -8 } } }, 1);
    contactMobilFamily(rigs.rama_kandra, sati);
    const palm = new THREE.Vector3(0, -.14, -.05);
    const shoulder = sati.shoulders[0].localToWorld(new THREE.Vector3(-.045, .225, .005));
    assert.ok(rigs.rama_kandra.mobilWrists![1].localToWorld(palm.clone()).distanceTo(shoulder) < .025, 'Rama must reach his daughter with the arm beside her');
    rigs.rama_kandra.root.updateMatrixWorld(true); sati.root.updateMatrixWorld(true);
    const body = rigs.rama_kandra.detail.getObjectByName('rama_kandra-anatomical-body') as THREE.SkinnedMesh;
    const sleeve = sati.detail.getObjectByName('sati-mobil-sleeve--1') as THREE.SkinnedMesh;
    body.skeleton.update(); sleeve.skeleton.update();
    const hands = new Set(body.skeleton.bones.map((bone, i) => /^(wrist|finger.*)_L$/.test(bone.name) ? i : -1));
    const skin = body.geometry.attributes.skinIndex, weights = body.geometry.attributes.skinWeight;
    const inside: number[] = []; let samples = 0;
    const direction = new THREE.Vector3(.37, .01, 1).transformDirection(sleeve.matrixWorld);
    for (let v = 0; v < skin.count; v++) {
      let hand = 0;
      for (let axis = 0; axis < 4; axis++) if (hands.has(skin.getComponent(v, axis))) hand += weights.getComponent(v, axis);
      if (hand < .6) continue;
      const point = body.localToWorld(body.getVertexPosition(v, new THREE.Vector3()));
      if (point.distanceTo(shoulder) > .6) continue;
      samples++;
      if (new THREE.Raycaster(point, direction).intersectObject(sleeve, false).length % 2 === 1) inside.push(v);
    }
    assert.ok(samples > 30, 'check the delivered left hand, not only its IK target');
    assert.deepEqual(inside, [], 'Rama’s actual fingers must rest outside Sati’s sleeve');
    for (const side of [0, 1]) {
      const hand = rigs.kamala.mobilWrists![side].localToWorld(palm.clone());
      const skirt = new THREE.Raycaster(hand.clone().add(new THREE.Vector3(0, .2, 0)), new THREE.Vector3(0, -1, 0))
        .intersectObject(rigs.kamala.detail.getObjectByName('kamala-skirt')!, false)[0];
      assert.ok(skirt, 'Kamala must keep both hands above the actual visible lap');
      assert.ok(hand.y >= skirt.point.y && hand.y - skirt.point.y < .08, 'Kamala must rest her hands on the skirt without sinking into it');
      const elbow = rigs.kamala.root.worldToLocal(rigs.kamala.elbows[side].getWorldPosition(new THREE.Vector3()));
      assert.ok(elbow.x * (side ? 1 : -1) > .48, 'the seated upper arms must stay outside her blouse instead of folding through her torso');
    }
    let lowest = Infinity; const penetrations: string[] = [];
    rigs.kamala.detail.traverseVisible(object => {
      if (!(object instanceof THREE.Mesh)) return;
      if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
      for (let v = 0; v < object.geometry.attributes.position.count; v++) {
        const p = object.localToWorld(object.getVertexPosition(v, new THREE.Vector3())); lowest = Math.min(lowest, p.y);
        if (Math.abs(p.x - MOBIL_STATION.bench.x) < .82 && Math.abs(p.z - MOBIL_STATION.bench.z) < 3
          && p.y > MOBIL_STATION.bench.seat - .18 && p.y < MOBIL_STATION.bench.seat - .04) penetrations.push(object.name);
      }
    });
    assert.ok(lowest >= -.025 && lowest < .04); assert.deepEqual(penetrations, [], 'the actual loaded gesture cannot push sleeves or hands through the bench');
  }
});
