import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HeroModels, type HeroRig } from '../packages/client/src/agents/HeroModel.js';
import { advanceMotion, newMotion, type MotionInput } from '../packages/client/src/agents/CharacterMotion.js';

async function geometry(id: string) {
  const glb = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
  const length = glb.readUInt32LE(12), document = JSON.parse(glb.subarray(20, 20 + length).toString());
  for (const material of document.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = glb.subarray(20 + length), result = Buffer.alloc(20 + padded.length + bin.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); bin.copy(result, 20 + padded.length);
  return new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
}

async function setup(t: test.TestContext, role: 'neo' | 'trinity') {
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking', 'trinity', 'trinity-club'].map(async id => [id, await geometry(id)] as const)));
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: (id: string) => Promise<unknown> }).load = async id => assets.get(id)!;
  const rig = (await models.create(role))!; t.after(() => models.dispose());
  const update = (options: Partial<MotionInput> = {}) => {
    const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, ...options }, motion = newMotion();
    models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0);
    rig.root.updateMatrixWorld(true);
    rig.root.traverse(object => { if (object instanceof THREE.SkinnedMesh) object.skeleton.update(); });
  };
  const farewell = { realWorld: true, farewell: { phase: 'goodbye' as const, elapsed: 2.1, total: 12.5, role } };
  return { rig, models, update, farewell, metadata: assets.get(role)!.parser.json.extras };
}
const material = (rig: HeroRig, name: RegExp) => rig.wardrobe.find(part => name.test(part.mesh.name))!.mesh.material as THREE.MeshStandardMaterial;

test('healthy Hammer Neo retains his hair without changing the first-film recovery scalp', async t => {
  const h = await setup(t, 'neo'), hair = h.rig.wardrobe.filter(part => part.hair);
  assert.ok(hair.length > 0, 'check the delivered hairstyle');
  h.update({ realWorld: true, nebCrew: 'neo' });
  assert.ok(hair.every(part => part.mesh.visible), 'the later Hammer crew outfit must retain Neo’s grown hair');
  assert.equal(h.rig.glasses.visible, false);
  assert.equal(h.rig.root.getObjectByName('neo-farewell-eye-band')?.visible, false);
  h.update({ realWorld: true, performance: 'pod' });
  assert.ok(hair.every(part => !part.mesh.visible), 'the original pod recovery still uses the shaved appearance');
  h.update({ realWorld: true });
  assert.ok(hair.every(part => !part.mesh.visible), 'early real-world recovery retains the shaved scalp');
  h.update({ realWorld: true, nebCrew: 'neo' });
  assert.ok(hair.every(part => part.mesh.visible), 'the later meeting restores its grown hairstyle');
});

test('Neo enters the wreck in the farewell outfit while retaining normal walking without a performance gesture', async t => {
  const h = await setup(t, 'neo');
  const walking = { speed: 4, grounded: true, verticalVelocity: 0, turn: .2, realWorld: true };
  h.update({ ...walking, farewellOutfit: 'neo' });
  const band = h.rig.root.getObjectByName('neo-farewell-eye-band') as THREE.Mesh;
  assert.ok(band?.visible, 'the eye band must already be present before G starts the goodbye');
  assert.ok(h.rig.wardrobe.filter(part => part.hair).every(part => part.mesh.visible));
  assert.ok(material(h.rig, /Tailored.coat.upper/).roughness >= .94);
  const normal = advanceMotion(newMotion(), walking, .1);
  const dressed = advanceMotion(newMotion(), { ...walking, farewellOutfit: 'neo' }, .1);
  assert.ok(normal.moving > 0); assert.deepEqual(dressed, normal, 'wearing the outfit cannot fake a farewell gesture or stop walking');
  h.update({ ...walking, farewellOutfit: 'trinity' }); assert.equal(band.visible, false, 'the outfit must match the actual rig identity');
  h.update({ ...walking, realWorld: false, farewellOutfit: 'neo' }); assert.equal(band.visible, false);
});

test('Neo keeps his shipped hair and wears matte knit with a fitted eye band, not a bald patient outfit', async t => {
  const h = await setup(t, 'neo'); h.update(h.farewell);
  assert.ok(h.rig.wardrobe.filter(part => part.hair).every(part => part.mesh.visible), 'farewell Neo must keep his actual hair despite the loaded patient body');
  const shirt = material(h.rig, /Tailored.coat.upper/), trousers = material(h.rig, /Tailored.trousers/);
  assert.ok(shirt.roughness >= .94 && shirt.metalness <= .02 && shirt.bumpMap instanceof THREE.DataTexture, 'Neo needs coarse matte cloth');
  assert.ok(shirt.color.r > trousers.color.r && shirt.color.r < .1, 'dark upper cloth must remain distinct from darker trousers');
  const band = h.rig.root.getObjectByName('neo-farewell-eye-band') as THREE.Mesh;
  assert.ok(band?.visible, 'Neo needs the dark cloth eye injury band');
  assert.equal(band.parent, h.rig.bones.get('head')); assert.equal(h.rig.glasses.visible, false);
  const head = h.rig.bones.get('head')!, eye = new THREE.Vector3().fromArray(h.metadata.eye).sub(new THREE.Vector3().fromArray(h.metadata.head));
  band.geometry.computeBoundingBox(); const bounds = band.geometry.boundingBox!;
  assert.ok(bounds.min.y < eye.y - .035 && bounds.max.y > eye.y + .035, 'the strip covers the shipped eye row');
  assert.ok(bounds.min.y > eye.y - .09 && bounds.max.y < eye.y + .1, 'the strip cannot cover Neo’s nose tip, mouth, or scalp');
  const skin = h.rig.wardrobe.filter(part => (part.mesh.material as THREE.Material).name === 'Skin' || (part.mesh.material as THREE.Material).name === 'Eyes').map(part => part.mesh);
  for (let i = 0; i < band.geometry.attributes.position.count; i += 29) {
    const local = new THREE.Vector3().fromBufferAttribute(band.geometry.attributes.position, i);
    const origin = head.localToWorld(new THREE.Vector3(local.x, local.y, local.z).multiply(new THREE.Vector3(4, 1, 4)));
    const center = head.localToWorld(new THREE.Vector3(0, local.y, 0)), direction = center.clone().sub(origin).normalize();
    const hit = new THREE.Raycaster(origin, direction, 0, 3).intersectObjects(skin, false)[0];
    assert.ok(hit, 'sample must strike the real delivered face');
    const clearance = origin.distanceTo(hit.point) - origin.distanceTo(head.localToWorld(local));
    assert.ok(clearance >= .004 && clearance < .04, `eye band pierces or floats from the real face: ${clearance}`);
  }
  for (const side of [-1, 1]) {
    const eyeWorld = head.localToWorld(new THREE.Vector3(side * eye.x, eye.y, eye.z));
    const origin = head.localToWorld(new THREE.Vector3(side * eye.x, eye.y, eye.z + 1));
    const ray = new THREE.Raycaster(origin, eyeWorld.sub(origin).normalize());
    const covered = ray.intersectObject(band, false)[0], face = ray.intersectObjects(skin, false)[0];
    assert.ok(covered && face && covered.distance < face.distance, 'both actual GLB eye centers must be covered by the cloth');
  }
});

test('Trinity wears a light knit upper with darker trousers and restores her Matrix materials', async t => {
  const h = await setup(t, 'trinity'); h.update();
  const shirt = material(h.rig, /Fitted.leather.jacket/), trousers = material(h.rig, /Tailored.trousers/);
  const original = { shirtColor: shirt.color.clone(), trousersColor: trousers.color.clone(), roughness: shirt.roughness, metalness: shirt.metalness, map: shirt.map, bump: shirt.bumpMap };
  h.update(h.farewell);
  assert.ok(shirt.roughness >= .94 && shirt.metalness <= .02 && shirt.bumpMap instanceof THREE.DataTexture, 'Trinity’s upper garment must read as knit, not leather');
  assert.ok(shirt.color.r > .2 && trousers.color.r < shirt.color.r * .35, 'the real-world outfit must not become one pale uniform');
  const weave = shirt.bumpMap;
  for (let i = 0; i < 15; i++) { h.update(); h.update(h.farewell); assert.equal(shirt.bumpMap, weave, 'reuse the weave instead of allocating every frame'); }
  h.update();
  assert.deepEqual({ shirtColor: shirt.color, trousersColor: trousers.color, roughness: shirt.roughness, metalness: shirt.metalness, map: shirt.map, bump: shirt.bumpMap }, original);
  h.update({ ...h.farewell, farewell: { ...h.farewell.farewell, role: 'neo' } });
  assert.equal(shirt.roughness, original.roughness, 'another role’s saved gesture cannot apply this costume');
});

test('the eye band is scoped to the real farewell and disposes its owned geometry, material and texture once', async t => {
  const h = await setup(t, 'neo'); h.update(h.farewell);
  const band = h.rig.root.getObjectByName('neo-farewell-eye-band') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  assert.ok(band?.visible); const geometry = band.geometry, cloth = band.material, weave = cloth.bumpMap!;
  h.update({ ...h.farewell, realWorld: false }); assert.equal(band.visible, false);
  h.update({ realWorld: true, performance: 'pod' }); assert.equal(band.visible, false);
  assert.ok(h.rig.wardrobe.filter(part => part.hair).every(part => !part.mesh.visible), 'normal pod appearance remains unchanged');
  h.update(h.farewell); assert.equal(band.geometry, geometry); assert.equal(band.material, cloth); assert.equal(cloth.bumpMap, weave);
  const counts = { geometry: 0, material: 0, texture: 0 };
  geometry.addEventListener('dispose', () => counts.geometry++); cloth.addEventListener('dispose', () => counts.material++); weave.addEventListener('dispose', () => counts.texture++);
  h.models.dispose(); h.models.dispose();
  assert.deepEqual(counts, { geometry: 1, material: 1, texture: 1 }); assert.equal(band.parent, null);
});

test('paused farewell clothes keep stable material versions and restore original textures when leaving', async t => {
  for (const role of ['neo', 'trinity'] as const) {
    const h = await setup(t, role), diffuse = new THREE.Texture(), bump = new THREE.Texture();
    t.after(() => { diffuse.dispose(); bump.dispose(); });
    const parts = h.rig.wardrobe.filter(part => /Tailored.trousers|Tailored.coat.upper|Black.crew.neck|Fitted.leather.jacket/i.test(part.mesh.name));
    assert.ok(parts.length >= 2, 'exercise both delivered upper clothing and trousers');
    // Texture decoding is omitted in Node; retain non-null original map identities.
    for (const part of parts) { part.map = diffuse; part.bumpMap = bump; }
    h.update();
    const materials = parts.map(part => part.mesh.material as THREE.MeshStandardMaterial);
    const properties = (material: THREE.MeshStandardMaterial) => ({ color: material.color.toArray(), map: material.map,
      bump: material.bumpMap, bumpScale: material.bumpScale, roughness: material.roughness, metalness: material.metalness });
    const original = materials.map(properties);
    for (const input of [h.farewell, { realWorld: true, farewellOutfit: role }]) {
      h.update(input);
      const versions = materials.map(material => material.version), dressed = materials.map(properties);
      assert.ok(materials.every(material => material.map === null && material.bumpMap?.name === `${role}-farewell-knit`));
      for (let frame = 0; frame < 20; frame++) {
        h.update(input);
        assert.deepEqual(materials.map(material => material.version), versions, `${role}: a paused outfit cannot invalidate materials each frame`);
        assert.deepEqual(materials.map(properties), dressed);
      }
      h.update();
      assert.deepEqual(materials.map(properties), original, `${role}: leaving restores the actual original texture references and surface properties`);
      const restoredVersions = materials.map(material => material.version);
      assert.ok(restoredVersions.every((version, i) => version > versions[i]), 'leaving still invalidates the changed material once');
      h.update();
      assert.deepEqual(materials.map(material => material.version), restoredVersions, 'ordinary clothes remain stable after restoring');
    }
  }
});
