import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { newSmithFinale, smithEndingPose } from '@auto_matrix/shared';
import { SmithCrowdRenderer } from '../packages/client/src/engine/SmithCrowdRenderer.js';

async function loadCrowd(far = false) {
  const bytes = await readFile(new URL(`../packages/client/public/assets/characters/smith-crowd${far ? '-far' : ''}.glb`, import.meta.url));
  const length = bytes.readUInt32LE(12); const document = JSON.parse(bytes.subarray(20, 20 + length).toString());
  const original = structuredClone(document);
  for (const material of document.materials) delete material.pbrMetallicRoughness.baseColorTexture;
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)); const padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const binary = bytes.subarray(20 + length); const buffer = Buffer.alloc(20 + padded.length + binary.length);
  buffer.writeUInt32LE(0x46546c67, 0); buffer.writeUInt32LE(2, 4); buffer.writeUInt32LE(buffer.length, 8);
  buffer.writeUInt32LE(padded.length, 12); buffer.writeUInt32LE(0x4e4f534a, 16); padded.copy(buffer, 20); binary.copy(buffer, 20 + padded.length);
  const asset = await new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '');
  return { asset, original, bytes: bytes.length, buffer: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) };
}

test('the shipped Smith crowd asset has lowered full arms, hands, separate legs, soles, hair and sunglasses within its geometry budget', async () => {
  const { asset, original, bytes } = await loadCrowd();
  assert.ok(!original.skins && !original.animations, 'crowd spectators need no per-instance skeleton update');
  let triangles = 0; const bounds = new THREE.Box3();
  asset.scene.traverse(mesh => {
    if (!(mesh instanceof THREE.Mesh)) return;
    const geometry = mesh.geometry; geometry.computeBoundingBox(); bounds.union(geometry.boundingBox!);
    triangles += geometry.index!.count / 3;
    assert.ok(geometry.attributes.position.array.every(Number.isFinite));
    assert.equal(geometry.attributes.position.count, geometry.attributes.uv.count, 'preserve the finished texture coordinates');
    assert.ok(!geometry.attributes.skinIndex && !geometry.attributes.skinWeight);
  });
  assert.ok(triangles < 10500 && triangles > 6000, `${triangles} triangles should retain detail at crowd scale`);
  assert.ok(bytes < 450000, `static crowd asset is ${bytes} bytes`);
  assert.ok(Math.abs(bounds.min.y) < 1e-6, 'the actual sole rests on the asset origin');
  assert.ok(bounds.max.y > 4.2 && bounds.max.y < 4.6);
  const joints = original.extras.joints;
  for (const side of ['R', 'L']) {
    assert.ok(joints[`shoulder_${side}`][1] - joints[`wrist_${side}`][1] > 1.1, 'hands hang below shoulders');
    assert.ok(Math.abs(joints[`wrist_${side}`][0]) < 1, 'arms must not retain the source A/T pose');
  }
  for (const name of ['Skin', 'Trousers', 'Charcoal_suit_and_shirt', 'Boot_leather', 'Hair_cards', 'Smith_frames', 'Smith_lenses'])
    assert.ok(asset.scene.getObjectByName(name), `${name} remains a real textured/anatomical surface`);
  const shoes = (asset.scene.getObjectByName('Boot_leather') as THREE.Mesh).geometry.attributes.position;
  for (const side of [-1, 1]) {
    const sole = Array.from({ length: shoes.count }, (_, i) => i).filter(i => shoes.getX(i) * side > .08 && shoes.getY(i) < .015);
    assert.ok(sole.length >= 3, `retain the ${side} shoe's flat ground contact`);
  }
  assert.deepEqual(original.images.map((image: { uri: string }) => image.uri),
    ['smith-albedo.png', 'short04-hair.png', 'smith-eyes.png', 'smith-suit-refined.png']);
});

test('Smith spectators stand in three staggered rows on both curbs facing the open avenue, and retain saved purge state during loading', async t => {
  const { asset } = await loadCrowd(); const distant = await loadCrowd(true);
  let finish!: (value: typeof asset) => void;
  t.mock.method(GLTFLoader.prototype, 'loadAsync', (url: string) => url.endsWith('-far.glb') ? Promise.resolve(distant.asset) : new Promise<typeof asset>(resolve => { finish = resolve; }));
  const root = new THREE.Group(); root.position.set(6300, 1, 6000);
  const crowd = new SmithCrowdRenderer(root);
  const saved = { ...newSmithFinale(), phase: 'purging' as const, elapsed: 5.3, total: 60 };
  crowd.update(saved);
  finish(asset); await crowd.ready;
  assert.equal(crowd.group.scale.y, 1, 'purging must retain full body proportions');
  const material = (crowd.group.children[0] as THREE.Mesh).material as THREE.Material;
  const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
  material.onBeforeCompile(shader as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer);
  assert.equal((shader.uniforms as Record<string, { value: number }>).smithCrowd.value, smithEndingPose(saved).crowd,
    'an async load restores the saved surface-clearing wave, not a fresh uninfected crowd');
  assert.deepEqual((shader.uniforms as Record<string, { value: THREE.Vector3 }>).smithOrigin.value.toArray(), [6300, 1, 6000],
    'dissolve noise must use avenue-local positions instead of losing fragment precision at distant world coordinates');
  crowd.update(newSmithFinale());
  const batches = crowd.group.children as THREE.InstancedMesh[];
  assert.equal(batches.length, 16, 'eight shared surfaces at two detail levels');
  const bodies = batches.filter(mesh => mesh.name.endsWith('-Skin'));
  const matrix = new THREE.Matrix4(), origin = new THREE.Vector3(), forward = new THREE.Vector3(), size = new THREE.Vector3();
  let spectators = 0; const rows = new Set<string>();
  for (const batch of bodies) {
    spectators += batch.count;
    assert.ok(batch.frustumCulled && batch.boundingSphere, 'instanced bounds support all game camera passes');
    for (let i = 0; i < batch.count; i++) {
      batch.getMatrixAt(i, matrix); origin.setFromMatrixPosition(matrix); rows.add(origin.x.toFixed(2));
      assert.ok(Math.abs(origin.x) >= 19.7 && Math.abs(origin.x) < 24.3, 'leave the actors and camera passage open');
      assert.ok(Math.abs(origin.y - (Math.abs(origin.x) < 21 ? .035 : .29)) < 1e-6, 'each sole sits on road or sidewalk');
      forward.set(0, 0, 1).transformDirection(matrix);
      assert.ok(forward.x * origin.x < -19, 'the face points inward across the street');
      matrix.decompose(new THREE.Vector3(), new THREE.Quaternion(), size);
      assert.ok(size.distanceTo(new THREE.Vector3(1, 1, 1)) < 1e-5, 'retain actual hero proportions');
    }
  }
  assert.equal(rows.size, 6); assert.equal(spectators, 323, 'the speaking Smith owns the one vacant front-row place');
  for (const batch of batches) {
    batch.geometry.computeBoundingBox();
    for (let i = 0; i < batch.count; i++) {
      batch.getMatrixAt(i, matrix); origin.setFromMatrixPosition(matrix);
      const bounds = batch.geometry.boundingBox!.clone().applyMatrix4(matrix);
      assert.ok(bounds.min.x > -25.1 && bounds.max.x < 25.1, 'the full body clears the nearest facade columns');
      if (Math.abs(origin.x) < 21) assert.ok(bounds.min.x > -21 && bounds.max.x < 21, 'the road row cannot straddle the raised curb');
      else assert.ok(origin.x > 0 ? bounds.min.x > 21 : bounds.max.x < -21, 'sidewalk bodies clear the curb edge');
    }
  }
  const geometries = new Set(batches.map(mesh => mesh.geometry)); const materials = new Set(batches.map(mesh => mesh.material as THREE.Material));
  assert.equal(geometries.size, 16, 'the crowd shares eight surfaces per near/far level');
  const released = new Set<THREE.BufferGeometry | THREE.Material>();
  for (const resource of [...geometries, ...materials]) resource.addEventListener('dispose', () => released.add(resource));
  let instanceReleases = 0; for (const batch of batches) batch.addEventListener('dispose', () => instanceReleases++);
  crowd.update({ ...newSmithFinale(), phase: 'done' }); assert.equal(crowd.group.visible, false);
  crowd.dispose(); assert.equal(root.children.length, 0); assert.equal(released.size, geometries.size + materials.size);
  assert.equal(instanceReleases, 16, 'release every instance batch as well as the shared asset');
});

test('far Smiths preserve every material/UV surface and silhouette within 2500 triangles', async () => {
  const near = await loadCrowd(), far = await loadCrowd(true);
  assert.deepEqual(far.original.materials, near.original.materials);
  assert.deepEqual(far.original.images, near.original.images);
  assert.deepEqual(far.original.meshes.map((mesh: { name: string }) => mesh.name), near.original.meshes.map((mesh: { name: string }) => mesh.name));
  let triangles = 0;
  far.asset.scene.traverse(mesh => {
    if (!(mesh instanceof THREE.Mesh)) return;
    const geometry = mesh.geometry, detailed = (near.asset.scene.getObjectByName(mesh.name) as THREE.Mesh).geometry;
    triangles += geometry.index!.count / 3;
    geometry.computeBoundingBox(); detailed.computeBoundingBox();
    assert.equal(geometry.attributes.uv.count, geometry.attributes.position.count);
    assert.ok(geometry.index!.count > 0, `${mesh.name} cannot disappear at a distance`);
    assert.ok(geometry.boundingBox!.min.distanceTo(detailed.boundingBox!.min) < .18, `${mesh.name} retains its lower silhouette`);
    assert.ok(geometry.boundingBox!.max.distanceTo(detailed.boundingBox!.max) < .18, `${mesh.name} retains its upper silhouette`);
  });
  assert.ok(triangles <= 2500 && triangles > 1000, `far model has ${triangles} triangles`);
  assert.ok(far.bytes < 120000);
  const shoes = (far.asset.scene.getObjectByName('Boot_leather') as THREE.Mesh).geometry.attributes.position;
  for (const side of [-1, 1]) assert.ok(Array.from({ length: shoes.count }, (_, i) => i).filter(i => shoes.getX(i) * side > .08 && shoes.getY(i) < .015).length >= 3);
});

test('crossing the 50-unit planar distance moves spectators between the existing detail batches', async t => {
  const near = await loadCrowd(), far = await loadCrowd(true);
  t.mock.method(GLTFLoader.prototype, 'loadAsync', (url: string) => Promise.resolve(url.endsWith('-far.glb') ? far.asset : near.asset));
  const root = new THREE.Group(), crowd = new SmithCrowdRenderer(root);
  const sectionZ = -70 + 4 * 2.6 + .84;
  crowd.update(newSmithFinale(), { x: 0, z: sectionZ + 50.01 }); await crowd.ready;
  const bodies = crowd.group.children.filter(mesh => mesh.name.endsWith('-Skin')) as THREE.InstancedMesh[];
  const matrix = new THREE.Matrix4(), point = new THREE.Vector3();
  const firstBody = () => {
    for (const mesh of bodies) for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix); point.setFromMatrixPosition(matrix);
      if (Math.abs(point.x + 19.7) < .001 && point.z === -70) return mesh;
    }
    throw new Error('the first spectator disappeared while changing detail levels');
  };
  const nearGeometry = (near.asset.scene.getObjectByName('Skin') as THREE.Mesh).geometry;
  const farGeometry = (far.asset.scene.getObjectByName('Skin') as THREE.Mesh).geometry;
  const ids = crowd.group.children.map(mesh => mesh.uuid);
  assert.ok(firstBody().geometry === farGeometry, 'the saved player position selects far geometry when loading finishes');
  crowd.update(newSmithFinale(), { x: 0, z: sectionZ + 50 }); assert.ok(firstBody().geometry === nearGeometry);
  crowd.update(newSmithFinale(), { x: 50.01, z: sectionZ }); assert.ok(firstBody().geometry === farGeometry, 'distance includes the player x coordinate');
  crowd.update(newSmithFinale(), { x: 0, z: sectionZ }); assert.ok(firstBody().geometry === nearGeometry);
  assert.deepEqual(crowd.group.children.map(mesh => mesh.uuid), ids, 'reuse the same instance draws');
  const batch = firstBody();
  assert.equal(batch.material, (near.asset.scene.getObjectByName('Skin') as THREE.Mesh).material, 'switch only geometry so textures do not change');
  batch.getMatrixAt(0, matrix);
  for (let vertex = 0; vertex < batch.geometry.attributes.position.count; vertex++) {
    point.fromBufferAttribute(batch.geometry.attributes.position, vertex).applyMatrix4(matrix);
    assert.ok(batch.boundingBox!.containsPoint(point), 'bounds refresh when detailed geometry returns');
  }
  crowd.dispose();
});

test('near spectators are visible while the optional distant geometry is still loading', async t => {
  const near = await loadCrowd(), far = await loadCrowd(true);
  let finish!: (value: typeof far.asset) => void;
  t.mock.method(GLTFLoader.prototype, 'loadAsync', (url: string) => url.endsWith('-far.glb')
    ? new Promise<typeof far.asset>(resolve => { finish = resolve; }) : Promise.resolve(near.asset));
  const crowd = new SmithCrowdRenderer(new THREE.Group());
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(crowd.group.children.length, 16, 'a far-model delay must not leave the avenue empty');
  assert.ok(crowd.group.children.every(mesh => (mesh as THREE.Mesh).geometry), 'keep actual near surfaces until the distant asset arrives');
  finish(far.asset); await crowd.ready;
  assert.equal(crowd.group.children.length, 16, 'installing the distant asset cannot duplicate the spectators');
  crowd.dispose();
});

test('the full audience shares at most two draws per surface without dropping or duplicating a spectator', async t => {
  const near = await loadCrowd(), far = await loadCrowd(true);
  t.mock.method(GLTFLoader.prototype, 'loadAsync', (url: string) => Promise.resolve(url.endsWith('-far.glb') ? far.asset : near.asset));
  const crowd = new SmithCrowdRenderer(new THREE.Group()); await crowd.ready;
  try {
    const batches = crowd.group.children as THREE.InstancedMesh[];
    assert.ok(batches.length <= 16, 'share each of eight materials across near/far spectators');
    const places = new Set<string>(), matrix = new THREE.Matrix4();
    for (const mesh of batches.filter(mesh => mesh.name.endsWith('-Skin'))) for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix); places.add(new THREE.Vector3().setFromMatrixPosition(matrix).toArray().join(','));
    }
    assert.equal(places.size, 323);
    assert.equal(batches.filter(mesh => mesh.name.endsWith('-Skin')).reduce((count, mesh) => count + mesh.count, 0), 323);
  } finally { crowd.dispose(); }
});

test('audience culling preserves bodies visible only in water and restores the full crowd without a camera', async t => {
  const near = await loadCrowd(), far = await loadCrowd(true);
  t.mock.method(GLTFLoader.prototype, 'loadAsync', (url: string) => Promise.resolve(url.endsWith('-far.glb') ? far.asset : near.asset));
  const root = new THREE.Group(); root.position.set(6300, 1, 6000);
  const crowd = new SmithCrowdRenderer(root); await crowd.ready; root.updateMatrixWorld(true);
  const camera = new THREE.PerspectiveCamera(24, 1, .1, 180);
  camera.position.set(6300, 7, 5960); camera.lookAt(6322, -3, 5980); camera.updateMatrixWorld(true);
  const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  const matrices: THREE.Matrix4[] = [], matrix = new THREE.Matrix4();
  for (const mesh of crowd.group.children as THREE.InstancedMesh[]) if (mesh.name.endsWith('-Skin')) for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, matrix); matrices.push(matrix.clone());
  }
  const expected = matrices.filter(matrix => {
    const head = new THREE.Vector3(0, 3, 0).applyMatrix4(matrix).applyMatrix4(root.matrixWorld);
    return !frustum.containsPoint(head) && frustum.containsPoint(head.clone().setY(2.07 - head.y));
  });
  assert.ok(expected.length > 5, 'the fixture looks down into a real reflection-only part of the crowd');
  try {
    crowd.update(newSmithFinale(), { x: 0, z: -40 }, camera, 1.035);
    const bodies = crowd.group.children.filter(mesh => mesh.name.endsWith('-Skin')) as THREE.InstancedMesh[];
    const shown = new Set<string>();
    for (const mesh of bodies) for (let i = 0; i < mesh.count; i++) { mesh.getMatrixAt(i, matrix); shown.add(matrix.elements.join(',')); }
    assert.ok(shown.size < 160, `submit only visible bodies instead of all ${shown.size} spectators`);
    for (const matrix of expected) assert.ok(shown.has(matrix.elements.map(Math.fround).join(',')), 'a reflected spectator must not vanish when its real body is outside the main view');
    const versions = bodies.map(mesh => mesh.instanceMatrix.version);
    crowd.update(newSmithFinale(), { x: 0, z: -40 }, camera, 1.035);
    assert.deepEqual(bodies.map(mesh => mesh.instanceMatrix.version), versions, 'a paused camera needs no instance-buffer upload');
    crowd.update(newSmithFinale(), { x: 0, z: -40 }, undefined);
    assert.equal(bodies.reduce((count, mesh) => count + mesh.count, 0), 323);
    for (const [aspect, height, water, facing] of [[16 / 9, 8, 1.035, 1], [9 / 16, 4, 1.035, -1], [16 / 9, 56, -10.965, 1]]) {
      camera.aspect = aspect; camera.fov = 57; camera.position.set(6300, height, 6000);
      camera.lookAt(6322, 3, 6000 + facing * 42); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
      const visible = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      crowd.update(newSmithFinale(), { x: 0, z: 0 }, camera, water);
      const selected = new Set<string>();
      for (const mesh of bodies) for (let i = 0; i < mesh.count; i++) { mesh.getMatrixAt(i, matrix); selected.add(matrix.elements.join(',')); }
      let checked = 0;
      for (const pose of matrices) {
        let onScreen = false;
        near.asset.scene.traverse(mesh => {
          if (!(mesh instanceof THREE.Mesh)) return;
          const vertices = mesh.geometry.attributes.position;
          for (let i = 0; i < vertices.count; i += 37) {
            const point = new THREE.Vector3().fromBufferAttribute(vertices, i).applyMatrix4(pose).applyMatrix4(root.matrixWorld);
            if (visible.containsPoint(point) || visible.containsPoint(point.setY(2 * water - point.y))) onScreen = true;
          }
        });
        if (onScreen) { checked++; assert.ok(selected.has(pose.elements.join(',')), `${aspect}/${height}/${facing}: sampled body surface disappeared on a turn or aerial view`); }
      }
      assert.ok(checked > 20, `${aspect}/${height}/${facing}: check actual textured body vertices, found ${checked} visible spectators`);
    }
  } finally { crowd.dispose(); }
});

test('leaving the avenue before its crowd finishes loading releases the arriving resources and cannot reattach the crowd', async t => {
  const { asset } = await loadCrowd(); let finish!: (value: typeof asset) => void;
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise<typeof asset>(resolve => { finish = resolve; }));
  const resources = new Set<THREE.BufferGeometry | THREE.Material>();
  asset.scene.traverse(mesh => { if (mesh instanceof THREE.Mesh) { resources.add(mesh.geometry); resources.add(mesh.material as THREE.Material); } });
  let releases = 0; for (const resource of resources) resource.addEventListener('dispose', () => releases++);
  const root = new THREE.Group(), crowd = new SmithCrowdRenderer(root); crowd.dispose(); finish(asset); await crowd.ready;
  assert.equal(root.children.length, 0); assert.equal(crowd.group.children.length, 0); assert.equal(releases, resources.size);
});

test('the far loader shares existing textures and releases late geometry and temporary materials after leaving during its load', async t => {
  const near = await loadCrowd(), far = await loadCrowd(true);
  const resources = new Set<THREE.BufferGeometry | THREE.Material | THREE.Texture>();
  near.asset.scene.traverse(mesh => { if (mesh instanceof THREE.Mesh) { resources.add(mesh.geometry); resources.add(mesh.material as THREE.Material); } });
  const skin = (near.asset.scene.getObjectByName('Skin') as THREE.Mesh).material as THREE.MeshStandardMaterial;
  const texture = new THREE.Texture(); skin.map = skin.normalMap = texture; resources.add(texture);
  const releases = new Map<object, number>();
  for (const resource of resources) resource.addEventListener('dispose', () => releases.set(resource, (releases.get(resource) ?? 0) + 1));
  let finish!: () => void;
  t.mock.method(GLTFLoader.prototype, 'loadAsync', function(this: GLTFLoader, url: string) {
    if (!url.endsWith('-far.glb')) return Promise.resolve(near.asset);
    return new Promise<typeof near.asset>(resolve => {
      finish = () => { void this.parseAsync(far.buffer, '').then(asset => {
        asset.scene.traverse(mesh => {
          if (!(mesh instanceof THREE.Mesh)) return;
          const material = mesh.material as THREE.MeshStandardMaterial;
          const original = (near.asset.scene.getObjectByName(mesh.name) as THREE.Mesh).material as THREE.MeshStandardMaterial;
          assert.ok(material.map === original.map && material.normalMap === original.normalMap, 'the distant loader must reuse existing texture objects');
          if (material !== original) {
            resources.add(material); material.addEventListener('dispose', () => releases.set(material, (releases.get(material) ?? 0) + 1));
          }
          resources.add(mesh.geometry); mesh.geometry.addEventListener('dispose', () => releases.set(mesh.geometry, (releases.get(mesh.geometry) ?? 0) + 1));
        });
        resolve(asset);
      }); };
    });
  });
  const root = new THREE.Group(), crowd = new SmithCrowdRenderer(root);
  await new Promise(resolve => setImmediate(resolve)); crowd.dispose(); finish(); await crowd.ready;
  assert.equal(root.children.length, 0); assert.equal(crowd.group.children.length, 0);
  assert.equal(releases.size, resources.size); assert.ok([...releases.values()].every(count => count === 1));
});
