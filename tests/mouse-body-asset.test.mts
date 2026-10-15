import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HeroModels } from '../packages/client/src/agents/HeroModel.js';
import { advanceMotion, newMotion } from '../packages/client/src/agents/CharacterMotion.js';

async function asset(name: string) {
  const url = new URL(`../packages/client/public/assets/characters/${name}.glb`, import.meta.url);
  const raw = await readFile(url), length = raw.readUInt32LE(12), doc = JSON.parse(raw.subarray(20, 20 + length).toString());
  const references = doc.images.map((image: { uri: string }) => image.uri);
  for (const material of doc.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
  doc.images = []; doc.textures = [];
  const json = Buffer.from(JSON.stringify(doc)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = raw.subarray(20 + length), result = Buffer.alloc(20 + padded.length + bin.length);
  result.writeUInt32LE(0x46546c67); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); bin.copy(result, 20 + padded.length);
  const loaded = await new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
  loaded.scene.updateMatrixWorld(true);
  return { ...loaded, references, url };
}

test('Mouse has independent anatomy, individually bound fingers and a continuous wrist beneath both cuffs', async () => {
  const model = await asset('mouse'), skin = model.scene.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  assert.ok(skin, 'Mouse needs delivered anatomy instead of the procedural stand-in');
  const metadata = model.parser.json.extras;
  assert.equal(metadata.character, 'mouse'); assert.equal(metadata.targets['macrodetails/asian-male-young'], undefined);
  assert.ok(metadata.mouseBodyVersion >= 1); assert.equal(skin.skeleton.bones.length, 46);
  const attrs = skin.geometry.attributes;
  for (const side of ['L', 'R']) {
    const wrist = model.scene.getObjectByName(`wrist_${side}`)!;
    const center = wrist.getWorldPosition(new THREE.Vector3());
    for (let digit = 1; digit <= 5; digit++) {
      const name = `finger${digit}-3_${side}`, index = skin.skeleton.bones.findIndex(bone => bone.name === name);
      assert.ok(index >= 0, `${name} must remain articulated`);
      let surface = 0;
      for (let v = 0; v < attrs.position.count; v++) for (let j = 0; j < 4; j++)
        if (attrs.skinIndex.getComponent(v, j) === index && attrs.skinWeight.getComponent(v, j) > .5) surface++;
      assert.ok(surface > 15, `${name} must drive actual distal skin`);
    }
    for (const height of [-.06, 0, .06, .12]) {
      let count = 0;
      for (let v = 0; v < attrs.position.count; v++)
        if (Math.abs(attrs.position.getY(v) - center.y - height) < .018 && Math.abs(attrs.position.getX(v) - center.x) < .18) count++;
      assert.ok(count > 10, `${side} needs continuous wrist skin at ${height}`);
    }
  }
});

test('Mouse wardrobes share exact bind matrices and shipwear includes a folded cap and separately shaped collar', async () => {
  const body = await asset('mouse'), ship = await asset('mouse-ship');
  const bodySkin = body.scene.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  const meshes: THREE.SkinnedMesh[] = [];
  ship.scene.traverse(object => { if (object instanceof THREE.SkinnedMesh) meshes.push(object); });
  assert.ok(meshes.some(mesh => mesh.name === 'mouse_ship_shirt'));
  assert.ok(meshes.some(mesh => mesh.name === 'mouse_ship_collar'));
  const cap = meshes.find(mesh => mesh.name === 'mouse_ship_cap'); assert.ok(cap);
  assert.ok(cap.geometry.index!.count > 3000, 'the cloth cap must retain folds and an anatomical crown');
  for (const mesh of meshes) {
    assert.equal(mesh.userData.mouseCostume, true);
    assert.deepEqual(mesh.skeleton.bones.map(bone => bone.name), bodySkin.skeleton.bones.map(bone => bone.name));
    assert.deepEqual(mesh.skeleton.boneInverses.map(matrix => matrix.toArray()), bodySkin.skeleton.boneInverses.map(matrix => matrix.toArray()));
  }
  const boots = body.scene.getObjectByName('shoes01') as THREE.SkinnedMesh; assert.ok(boots);
  boots.geometry.computeBoundingBox(); assert.ok(Math.abs(boots.geometry.boundingBox!.min.y) < .04, 'actual soles must meet ground');
  assert.ok(body.parser.json.extras.mouseHeadAnchors.neckReference);
  for (const model of [body, ship]) for (const reference of model.references)
    assert.ok((await readFile(new URL(reference, model.url))).length > 0, `${reference} must ship with its model`);
});

test('the delivered fingers curl actual skin without detaching hand triangles from the wrist', async () => {
  const model = await asset('mouse'), skin = model.scene.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  const a = skin.geometry.attributes, index = skin.geometry.index!, p = new THREE.Vector3();
  const rest = Array.from({ length: a.position.count }, (_, v) => skin.getVertexPosition(v, new THREE.Vector3()));
  for (const side of ['L', 'R']) {
    const wrist = model.scene.getObjectByName(`wrist_${side}`)!;
    wrist.rotation.x = .35; wrist.rotation.z = side === 'L' ? -.25 : .25;
    for (let digit = 1; digit <= 5; digit++) for (let joint = 1; joint <= 3; joint++) {
      const finger = model.scene.getObjectByName(`finger${digit}-${joint}_${side}`)!;
      finger.rotation.z = (side === 'L' ? -1 : 1) * (digit === 1 ? .18 : [.45, .6, .35][joint - 1]);
    }
  }
  model.scene.updateMatrixWorld(true);
  const posed = rest.map((_, v) => skin.getVertexPosition(v, new THREE.Vector3()));
  for (const side of ['L', 'R']) for (let digit = 1; digit <= 5; digit++) {
    const bone = skin.skeleton.bones.findIndex(item => item.name === `finger${digit}-3_${side}`);
    let moved = 0;
    for (let v = 0; v < rest.length; v++) for (let j = 0; j < 4; j++)
      if (a.skinIndex.getComponent(v, j) === bone && a.skinWeight.getComponent(v, j) > .9)
        moved = Math.max(moved, posed[v].distanceTo(rest[v]));
    assert.ok(moved > .018, `${side} digit ${digit} must articulate its delivered fingertip`);
  }
  for (let i = 0; i < index.count; i += 3) {
    const ids = [0, 1, 2].map(j => index.getX(i + j));
    if (ids.some(v => rest[v].y > 2.5)) continue;
    for (let j = 0; j < 3; j++) {
      const a = ids[j], b = ids[(j + 1) % 3], length = rest[a].distanceTo(rest[b]);
      if (length < .001) continue;
      assert.ok(posed[a].distanceTo(posed[b]) < length * 2.5, 'a mixed finger/wrist influence cannot tear the skin');
      assert.ok(Number.isFinite(p.copy(posed[a]).length()));
    }
  }
});

/** Freeze the delivered neutral skinning for repeatable geometric ray checks. */
function surface(mesh: THREE.SkinnedMesh) {
  const geometry = mesh.geometry.clone(), positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const point = mesh.localToWorld(mesh.getVertexPosition(i, new THREE.Vector3()));
    positions.setXYZ(i, point.x, point.y, point.z);
  }
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
}

async function fittedMouse() {
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: typeof asset }).load = asset;
  const rig = (await models.create('neo', undefined, 'mouse'))!; rig.root.updateMatrixWorld(true);
  return { models, rig };
}

test('the ship shirt covers the actual fitted lower neck and shoulders without exposing a wide chest opening', async () => {
  const { models, rig } = await fittedMouse();
  try {
    for (const meal of [false, true]) {
      if (meal) {
        const motion = newMotion(), input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true,
          interlude: { kind: 'meal' as const, phase: 'accepting' as const, elapsed: 3, role: 'mouse' as const, physicalMeal: true } };
        models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); rig.root.updateMatrixWorld(true);
      }
      const clothes = ['mouse_ship_shirt', 'mouse_ship_collar', 'mouse_ship_collar_left']
        .map(name => surface(rig.root.getObjectByName(name) as THREE.SkinnedMesh));
      const skin = surface(rig.root.getObjectByName('mouse-anatomical-head') as THREE.SkinnedMesh);
      skin.geometry.computeVertexNormals();
      const positions = skin.geometry.attributes.position, rest = skin.geometry.attributes._head_rest, normals = skin.geometry.attributes.normal;
      let inspected = 0;
      for (let i = 0; i < positions.count; i += 7) {
        if (rest.getY(i) < -.49 || rest.getY(i) > -.42) continue;
        const point = new THREE.Vector3().fromBufferAttribute(positions, i), direction = new THREE.Vector3().fromBufferAttribute(normals, i).normalize();
        const ray = new THREE.Raycaster(point.clone().addScaledVector(direction, -.002), direction, 0, .15);
        assert.ok(ray.intersectObjects(clothes).length, `shirt leaves exposed neck/shoulder during ${meal ? 'meal' : 'idle'} at vertex ${i}`); inspected++;
      }
      assert.ok(inspected >= 10, 'check the actual registered neck surface');
    }
  } finally { models.dispose(); }
});

test('the folded ship cap fits the delivered head without excess height or exposed crown patches', async () => {
  const { models, rig } = await fittedMouse();
  try {
    const skin = surface(rig.root.getObjectByName('mouse-anatomical-head') as THREE.SkinnedMesh);
    const cap = surface(rig.root.getObjectByName('mouse_ship_cap') as THREE.SkinnedMesh);
    const band = surface(rig.root.getObjectByName('mouse_cap_folded_band') as THREE.SkinnedMesh);
    const bounds = new THREE.Box3().setFromObject(skin), capBounds = new THREE.Box3().setFromObject(cap);
    assert.ok(capBounds.max.y <= bounds.max.y + .042, 'cap must follow this head, not add the height of a larger donor skull');
    const head = rig.bones.get('head')!, eye = head.localToWorld((head.userData.cameraEye as THREE.Vector3).clone());
    const center = eye.clone().add(new THREE.Vector3(0, .12, -.12)), positions = skin.geometry.attributes.position;
    let samples = 0;
    for (let v = 0; v < positions.count; v += 17) {
      const point = new THREE.Vector3().fromBufferAttribute(positions, v);
      if (point.y < eye.y + .14) continue;
      const direction = point.clone().sub(center).normalize();
      const ray = new THREE.Raycaster(point.clone().addScaledVector(direction, .0001), direction, 0, .15);
      assert.ok(ray.intersectObjects([cap, band]).length, `cap exposes fitted crown vertex ${v}`); samples++;
    }
    assert.ok(samples > 20, 'inspect real forehead/crown/back scalp vertices');
  } finally { models.dispose(); }
});

test('the existing short hair cards fit both temples of the delivered head without disappearing through its skin', async () => {
  const { models, rig } = await fittedMouse();
  try {
    const skin = surface(rig.root.getObjectByName('mouse-anatomical-head') as THREE.SkinnedMesh);
    const hair = surface(rig.root.getObjectByName('short04') as THREE.SkinnedMesh);
    const head = rig.bones.get('head')!, eye = head.localToWorld((head.userData.cameraEye as THREE.Vector3).clone());
    const center = eye.clone().add(new THREE.Vector3(0, .12, -.12)), positions = hair.geometry.attributes.position;
    const points = Array.from({ length: positions.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(positions, i));
    const index = hair.geometry.index!;
    for (let i = 0; i < index.count; i += 3) points.push(new THREE.Vector3()
      .add(points[index.getX(i)]).add(points[index.getX(i + 1)]).add(points[index.getX(i + 2)]).multiplyScalar(1 / 3));
    let inspected = 0;
    for (const [i, point] of points.entries()) {
      if (Math.abs(point.x) < .14 || point.y < eye.y - .04 || point.y > eye.y + .08) continue;
      const direction = point.clone().sub(center).normalize(), ray = new THREE.Raycaster(center, direction, 0, 1);
      const scalp = ray.intersectObject(skin).at(-1); if (!scalp) continue;
      if (point.distanceTo(center) < scalp.distance - .003) {
        // The outer ear can occlude hair that is correctly outside the skull.
        // Solid occupancy distinguishes that gap from an actual skin crossing.
        const outward = new THREE.Raycaster(point.clone().add(new THREE.Vector3(.00001, 0, 0)), new THREE.Vector3(1, 0, 0), 0, 2)
          .intersectObject(skin);
        const unique = outward.filter((hit, j) => j === 0 || hit.distance - outward[j - 1].distance > 1e-5);
        assert.equal(unique.length % 2, 0, `temple hair sample ${i} lies inside solid skin`);
      }
      inspected++;
    }
    assert.ok(inspected > 20, 'inspect the real short04 temple cards');
  } finally { models.dispose(); }
});
