import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { gardenPose, newTrilogyEpilogue, SUNRISE_GARDEN, type TrilogyEpilogueEncounter } from '@auto_matrix/shared';

async function shipped(name: string) {
  const bytes = await readFile(new URL(`../packages/client/public/assets/characters/${name}.glb`, import.meta.url));
  const length = bytes.readUInt32LE(12), document = JSON.parse(bytes.subarray(20, 20 + length).toString());
  // Node has no browser image decoder. Retain shipped geometry, joints, UVs
  // and material slots; actual texture/shader rendering is checked natively.
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

async function fixture(t: TestContext, delayed = false) {
  const roles = ['architect', 'seraph'] as const;
  const assets = Object.fromEntries(await Promise.all(roles.flatMap(role => ['head', 'body'].map(async part => [role + '-' + part, await shipped(role + '-' + part)]))));
  const pending: (() => void)[] = [];
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async url => {
    const name = String(url).split('/').pop()!.replace('.glb', '');
    if (delayed && name.endsWith('-body')) await new Promise<void>(resolve => pending.push(resolve));
    assert.ok(assets[name], `unexpected character asset ${name}`); return assets[name];
  });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  t.after(() => { models.dispose(); globalThis.document = previous; });
  const rigs = { architect: models.create(world.agents.get('architect')!), seraph: models.create(world.agents.get('seraph')!) };
  const state: TrilogyEpilogueEncounter = { ...newTrilogyEpilogue('dawn'), phase: 'choice', elapsed: 2.1, total: 12.3 };
  const pose = (park = true, gesture = state) => {
    for (const role of roles) {
      models.animate(rigs[role], 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, performance: true,
        parkOutfit: park, epilogue: park ? { ...gesture, role } : undefined }, 1);
      rigs[role].root.updateMatrixWorld(true);
    }
  };
  pose(); await new Promise(resolve => setImmediate(resolve)); pose();
  return { rigs, models, pose, state, release: async () => { pending.forEach(resolve => resolve()); await new Promise(resolve => setImmediate(resolve)); } };
}

test('late program bodies replace generic limbs without moving the saved pose or their independent head', async t => {
  const { rigs, pose, release } = await fixture(t, true);
  const before = Object.values(rigs).map(rig => rig.root.matrixWorld.clone());
  await release(); pose();
  for (const [index, role] of (['architect', 'seraph'] as const).entries()) {
    const rig = rigs[role];
    assert.ok(rig.root.getObjectByName(`${role}-detailed-body`), `${role} still renders the generic body`);
    assert.ok(rig.head.getObjectByName(`${role}-detailed-head`), `${role} still renders the generic face`);
    assert.ok(rig.root.matrixWorld.equals(before[index]), 'asset loading must not relocate a saved character');
    assert.equal(rig.head.getObjectByName(`${role}-fallback-head`)!.visible, false);
    assert.equal(rig.shoulders[0].children.find(object => object instanceof THREE.SkinnedMesh)!.visible, false);
    if (role === 'architect') {
      const beard = rig.head.getObjectByName('architect-fitted-beard') as THREE.Mesh;
      assert.ok(beard, 'the beard requires actual fitted geometry');
      assert.ok((beard.material as THREE.MeshStandardMaterial).map && beard.geometry.attributes.uv1 && beard.geometry.attributes._face_weight,
        'fitted beard must retain registered skin and hair detail instead of an opaque white mask');
    }
  }
});

test('Seraph loads the park costume directly and restores the earlier closed jacket on return', async t => {
  const { rigs, pose } = await fixture(t), rig = rigs.seraph;
  const park = rig.root.getObjectByName('seraph-park-jacket') as THREE.SkinnedMesh;
  const earlier = rig.root.getObjectByName('seraph-traditional-top') as THREE.SkinnedMesh;
  assert.ok(park && earlier, 'open park jacket and closed earlier jacket must both be authored');
  assert.equal(park.visible, true); assert.equal(earlier.visible, false);
  const gray = (park.material as THREE.MeshStandardMaterial).color.clone();
  pose(false);
  assert.equal(park.visible, false); assert.equal(earlier.visible, true);
  assert.ok((earlier.material as THREE.MeshStandardMaterial).color.toArray().some((value, index) => Math.abs(value - gray.toArray()[index]) > .25), 'the earlier costume retains its ivory fabric');
  pose();
  assert.equal(park.visible, true); assert.equal(earlier.visible, false);
  assert.ok((park.material as THREE.MeshStandardMaterial).color.equals(gray), 'returning to the park must not accumulate color changes');
  assert.equal(rig.root.getObjectByName('seraph-park-undershirt')!.visible, true);
  assert.equal(rig.root.getObjectByName('seraph-frog-closure-0')!.visible, false);
});

test('Seraph’s open jacket covers the undershirt at the chest and back instead of exposing dark patches', async t => {
  const { rigs, pose, state } = await fixture(t);
  const rig = rigs.seraph, jacket = rig.root.getObjectByName('seraph-park-jacket') as THREE.SkinnedMesh;
  const shirt = rig.root.getObjectByName('seraph-park-undershirt') as THREE.SkinnedMesh;
  const penetrations: string[] = []; let comparisons = 0;
  for (const phase of ['choice', 'sati', 'belief'] as const) for (const elapsed of [1.1, 3.1]) {
    pose(true, { ...state, phase, elapsed, total: 12 + elapsed });
    jacket.skeleton.update(); shirt.skeleton.update();
    for (const sign of [-1, 1]) for (const x of [-.38, -.30, -.23, .23, .30, .38]) for (const y of [2.75, 2.9, 3.05, 3.18]) {
      const origin = rig.detail.localToWorld(new THREE.Vector3(x, y, sign * 2));
      const direction = new THREE.Vector3(0, 0, -sign).transformDirection(rig.detail.matrixWorld);
      const ray = new THREE.Raycaster(origin, direction), outer = ray.intersectObject(jacket, false)[0], inner = ray.intersectObject(shirt, false)[0];
      if (outer && inner) {
        comparisons++;
        if (inner.distance < outer.distance - .001)
          penetrations.push(`${phase} ${elapsed}, ${x}, ${y}, ${sign}: shirt projects through jacket by ${outer.distance - inner.distance}`);
      }
    }
  }
  assert.ok(comparisons >= 200, 'compare the actual overlapping layers in each sampled pose');
  assert.deepEqual(penetrations, []);
});

test('the fitted lower neck remains a tube instead of collapsing several rings into a flat flange', async () => {
  for (const role of ['architect', 'seraph']) {
    const asset = await shipped(role + '-head'), head = asset.scene.getObjectByName(role + '-anatomical-head') as THREE.Mesh;
    const position = head.geometry.attributes.position, indices = head.geometry.index!;
    let bottom = Infinity; for (let vertex = 0; vertex < position.count; vertex++) bottom = Math.min(bottom, position.getY(vertex));
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(); let flange = 0;
    const edges = new Map<string, { count: number; a: number; b: number }>();
    for (let triangle = 0; triangle < indices.count; triangle += 3) {
      a.fromBufferAttribute(position, indices.getX(triangle)); b.fromBufferAttribute(position, indices.getX(triangle + 1)); c.fromBufferAttribute(position, indices.getX(triangle + 2));
      if ([a, b, c].every(point => Math.abs(point.y - bottom) < 1e-6)
        && new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).length() > 1e-7) flange++;
      const vertices = [0, 1, 2].map(i => indices.getX(triangle + i));
      for (let i = 0; i < 3; i++) {
        const a = vertices[i], b = vertices[(i + 1) % 3], key = [Math.min(a, b), Math.max(a, b)].join(':');
        const edge = edges.get(key); if (edge) edge.count++; else edges.set(key, { count: 1, a, b });
      }
    }
    assert.equal(flange, 0, `${role}: the neck fitting flattened ${flange} triangles into the collar`);
    const openings = [...edges.values()].filter(edge => edge.count === 1
      && Math.min(position.getY(edge.a), position.getY(edge.b)) < -.36
      && Math.max(position.getY(edge.a), position.getY(edge.b)) > bottom + .005);
    assert.equal(openings.length, 0, `${role}: ${openings.length} neck boundary edges expose openings above the collar`);
    asset.scene.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); (object.material as THREE.Material).dispose(); } });
  }
});

test('fitted program necks remain closed while turning, and their saved dialogue geometry does not drift', async t => {
  const { rigs, pose } = await fixture(t);
  for (const role of ['architect', 'seraph'] as const) {
    const rig = rigs[role], body = rig.root.getObjectByName(`${role}-anatomical-body`) as THREE.SkinnedMesh;
    const head = rig.head.getObjectByName(`${role}-anatomical-head`) as THREE.Mesh;
    assert.ok(body && head, 'use the actual continuous body and head assets');
    for (const turn of [-.6, 0, .6]) for (const pitch of [-.18, .15]) {
      pose(); rig.head.rotation.set(pitch, turn, 0); rig.root.updateMatrixWorld(true); body.skeleton.update();
      for (const z of [-.13, -.07]) for (const y of [-.56, -.53, -.50, -.46]) {
        const origin = rig.head.localToWorld(new THREE.Vector3(1, y, z));
        const ray = new THREE.Raycaster(origin, new THREE.Vector3(-1, 0, 0).transformDirection(rig.head.matrixWorld));
        const surfaces: THREE.Mesh[] = [head];
        rig.root.getObjectByName(`${role}-detailed-body`)!.traverseVisible(object => { if (object instanceof THREE.Mesh) surfaces.push(object); });
        assert.ok(ray.intersectObjects(surfaces, false).length, `${role}: visible neck opening at ${turn}, ${pitch}, ${y}, ${z}`);
      }
    }
    pose(); const before: THREE.Vector3[] = [];
    body.skeleton.update();
    for (let vertex = 0; vertex < body.geometry.attributes.position.count; vertex += 97) before.push(body.getVertexPosition(vertex, new THREE.Vector3()));
    pose(); body.skeleton.update();
    for (const [index, point] of before.entries()) assert.ok(point.distanceTo(body.getVertexPosition(index * 97, new THREE.Vector3())) < 1e-7, 'paused geometry must not drift');
  }
});

test('program costumes use low shoes instead of the dock fighters’ high boot shafts', async t => {
  const { rigs, pose } = await fixture(t); pose(false);
  for (const role of ['architect', 'seraph'] as const) {
    const shoes = rigs[role].root.getObjectByName(role + '-work-boots') as THREE.SkinnedMesh;
    assert.ok(shoes); shoes.skeleton.update(); const point = new THREE.Vector3();
    for (const side of [0, 1]) {
      // Measure each shoe along its foot axis; a tilted or lifted foot must
      // not be mistaken for a taller shaft.
      const inverse = rigs[role].ankles[side].matrixWorld.clone().invert(); let low = Infinity, high = -Infinity;
      for (let vertex = 0; vertex < shoes.geometry.attributes.position.count; vertex++) {
        if ((shoes.geometry.attributes.position.getX(vertex) < 0 ? 0 : 1) !== side) continue;
        shoes.getVertexPosition(vertex, point); shoes.localToWorld(point); point.applyMatrix4(inverse);
        low = Math.min(low, point.y); high = Math.max(high, point.y);
      }
      assert.ok(high - low < .32, `${role}: visible shoe height ${high - low} retains a high boot shaft`);
    }
  }
});

test('program clothes and shoes remain finite and outside the ground during their park arrival and departure', async t => {
  const { rigs, pose, state } = await fixture(t), failures: string[] = [];
  for (const phase of ['architect', 'choice', 'leaving', 'sati', 'belief'] as const) for (const elapsed of [.25, 1.1, 2.3, 3.1]) {
    pose(true, { ...state, phase, elapsed, total: 8 + elapsed });
    for (const role of ['architect', 'seraph'] as const) {
      const body = rigs[role].root.getObjectByName(`${role}-detailed-body`); assert.ok(body, 'the shipped body must be present for contact checks');
      body.traverseVisible(object => {
        if (!(object instanceof THREE.SkinnedMesh)) return;
        object.skeleton.update(); const point = new THREE.Vector3();
        for (let vertex = 0; vertex < object.geometry.attributes.position.count; vertex++) {
          object.getVertexPosition(vertex, point); object.localToWorld(point);
          if (!Number.isFinite(point.lengthSq()) || point.y < -.015) { failures.push(`${role} ${phase} ${elapsed}: ${object.name} at ${point.toArray()}`); break; }
        }
      });
    }
  }
  assert.deepEqual(failures, []);
});

test('Seraph approaches in his direction of travel and settles facing the Oracle without spinning backwards', () => {
  const state: TrilogyEpilogueEncounter = { ...newTrilogyEpilogue('dawn'), phase: 'sati' };
  let previous: number | undefined;
  for (let elapsed = 0; elapsed <= 4.8; elapsed += .08) {
    const pose = gardenPose({ ...state, elapsed }, 'seraph');
    const ahead = gardenPose({ ...state, elapsed: elapsed + .01 }, 'seraph');
    if (elapsed < 3.8) {
      const dx = ahead.x - pose.x, dz = ahead.z - pose.z, distance = Math.hypot(dx, dz);
      assert.ok((Math.sin(pose.yaw) * dx + Math.cos(pose.yaw) * dz) / distance > .85,
        `${elapsed}: Seraph walks sideways or backwards on the way to the bench`);
    }
    if (previous !== undefined) assert.ok(Math.abs(Math.atan2(Math.sin(pose.yaw - previous), Math.cos(pose.yaw - previous))) < .15,
      `${elapsed}: Seraph abruptly turns instead of settling into his listening pose`);
    previous = pose.yaw;
  }
  const stopped = gardenPose({ ...state, phase: 'belief' }, 'seraph');
  const oracle = gardenPose({ ...state, phase: 'belief' }, 'oracle');
  const dx = oracle.x - stopped.x, dz = oracle.z - stopped.z;
  assert.ok((Math.sin(stopped.yaw) * dx + Math.cos(stopped.yaw) * dz) / Math.hypot(dx, dz) > .99,
    'Seraph must face the Oracle at the bench rather than the empty waterfront');
  assert.equal(stopped.walk, 0); assert.equal(oracle.x, SUNRISE_GARDEN.bench.x);
});
