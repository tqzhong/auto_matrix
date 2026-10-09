import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { gardenPose, newTrilogyEpilogue, SUNRISE_GARDEN } from '@auto_matrix/shared';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

async function oracleHead() {
  const bytes = await readFile(new URL('../packages/client/public/assets/characters/oracle-revolutions-head.glb', import.meta.url));
  const length = bytes.readUInt32LE(12), document = JSON.parse(bytes.subarray(20, 20 + length).toString());
  for (const material of document.materials) delete material.pbrMetallicRoughness.baseColorTexture;
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const binary = bytes.subarray(20 + length), output = Buffer.alloc(20 + padded.length + binary.length);
  output.writeUInt32LE(0x46546c67, 0); output.writeUInt32LE(2, 4); output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(padded.length, 12); output.writeUInt32LE(0x4e4f534a, 16); padded.copy(output, 20); binary.copy(output, 20 + padded.length);
  const asset = await new GLTFLoader().parseAsync(output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength), '');
  asset.scene.traverse(object => { if (object instanceof THREE.Mesh) (object.material as THREE.MeshStandardMaterial).map = new THREE.Texture(); });
  return asset;
}

function points(root: THREE.Object3D, sample?: (point: THREE.Vector3, mesh: THREE.Mesh) => void) {
  root.updateWorldMatrix(true, true); const result: THREE.Vector3[] = [];
  root.traverseVisible(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.updateMatrixWorld(true); if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
    const vertices: THREE.Vector3[] = [];
    for (let i = 0; i < object.geometry.attributes.position.count; i++) {
      const point = object.localToWorld(object.getVertexPosition(i, new THREE.Vector3()));
      vertices.push(point); result.push(point); sample?.(point, object);
    }
    if (['oracle-park-skirt', 'oracle-park-coat'].includes(object.name)) {
      const index = object.geometry.index!;
      for (let i = 0; i < index.count; i += 3) {
        const [a, b, c] = [vertices[index.getX(i)], vertices[index.getX(i + 1)], vertices[index.getX(i + 2)]];
        for (const point of [a.clone().lerp(b, .5), b.clone().lerp(c, .5), c.clone().lerp(a, .5), a.clone().add(b).add(c).divideScalar(3)]) {
          result.push(point); sample?.(point, object);
        }
      }
    }
  });
  return result;
}

test('Oracle’s actual body and park clothes clear the wooden seat throughout turning and lowering, including a cold pose', async t => {
  const asset = await oracleHead();
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async () => ({ ...asset, scene: asset.scene.clone(true) }));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  const warm = models.create(world.agents.get('oracle')!);
  const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, parkOutfit: true };
  try {
    models.animate(warm, 0, input, 1); await new Promise(resolve => setImmediate(resolve));
    const b = SUNRISE_GARDEN.bench;
    const samples = [0, .3, .6, .9, 1.05, 1.2, 1.45, 1.7, 2, 2.25, 2.4].map(elapsed => ({ elapsed, parkApproach: undefined as { x: number; z: number; yaw: number } | undefined }));
    for (const parkApproach of [{ x: -6.5, z: -23.15, yaw: -1.45 }, { x: -8.2, z: -22.6, yaw: 2.3 }])
      for (const elapsed of [.6, 1.05, 1.45, 1.9, 2.4]) samples.push({ elapsed, parkApproach });
    for (const { elapsed, parkApproach } of samples) {
      const epilogue = { ...newTrilogyEpilogue('dawn'), parkApproach, phase: 'sitting' as const, elapsed, total: elapsed, role: 'oracle' as const };
      const pose = gardenPose(epilogue, 'oracle');
      const cold = models.create(world.agents.get('oracle')!);
      for (const rig of [warm, cold]) {
        rig.root.position.set(pose.x, 0, pose.z); rig.root.rotation.y = pose.yaw;
        models.animate(rig, rig === warm ? .07 : 0, { ...input, epilogue }, 1);
      }
      await new Promise(resolve => setImmediate(resolve)); models.animate(cold, 0, { ...input, epilogue }, 1);
      const inside = (point: THREE.Vector3) => Math.abs(point.x - b.x) < 3.47 && point.y > b.surface - .11 && point.y < b.surface - .008
        && Array.from({ length: 5 }, (_, slat) => b.z - .65 + slat * .32).some(z => Math.abs(point.z - z) < .10);
      const owners = new Set<string>();
      const visible = points(warm.detail, (point, mesh) => {
        if (inside(point)) owners.add(mesh.name || `${mesh.type}: hip=${warm.hips.indexOf(mesh.parent as THREE.Group)}, elbow=${warm.elbows.indexOf(mesh.parent!)}, material=${(mesh.material as THREE.MeshStandardMaterial).color?.getHexString()}`);
      }), box = new THREE.Box3().setFromPoints(visible), restored = points(cold.detail);
      assert.ok(box.min.y > -.005, `${elapsed}: visible clothing or shoes are below the lawn by ${-box.min.y}`);
      assert.equal(restored.length, visible.length, `${elapsed}: loading a saved pose changes the visible geometry`);
      assert.ok(visible.every((point, vertex) => point.distanceTo(restored[vertex]) < 1e-5), `${elapsed}: loading a saved pose changes the actual body or cloth surface`);
      const embedded = visible.filter(inside);
      assert.equal(embedded.length, 0, `${elapsed}: actual body/cloth cuts through the wooden slats: ${[...owners]} ${JSON.stringify(embedded.slice(0, 4).map(p => p.toArray()))}; joints ${JSON.stringify([warm.hips[0], warm.knees[0], warm.ankles[0]].map(joint => joint.getWorldPosition(new THREE.Vector3()).toArray()))}`);
      const skirt = warm.root.getObjectByName('oracle-park-skirt')!, hem = new THREE.Box3().setFromPoints(points(skirt)).min.y;
      const forward = new THREE.Vector3(0, 0, 1).transformDirection(warm.root.matrixWorld), ray = new THREE.Raycaster();
      const uncovered: number[][] = [];
      for (const hip of warm.hips) for (const mesh of hip.children) if (mesh instanceof THREE.SkinnedMesh) {
        mesh.skeleton.update();
        for (let vertex = 0; vertex < mesh.geometry.attributes.position.count; vertex += 3) {
          const point = mesh.localToWorld(mesh.getVertexPosition(vertex, new THREE.Vector3()));
          if (point.y <= hem + .12 || point.y >= warm.torso.getWorldPosition(new THREE.Vector3()).y - .025) continue;
          ray.set(point, forward);
          if (!ray.intersectObject(skirt, false).length) uncovered.push(point.toArray());
        }
      }
      assert.equal(uncovered.length, 0, `${elapsed}: the actual legs emerge through the front of the dress: ${JSON.stringify(uncovered.slice(0, 4))}`);
      models.animate(warm, .1, { ...input, epilogue }, 1);
      const paused = new THREE.Box3().setFromPoints(points(warm.detail));
      assert.ok(box.min.distanceTo(paused.min) < 1e-5 && box.max.distanceTo(paused.max) < 1e-5, `${elapsed}: paused body/contact drifts with render time`);
    }
  } finally { models.dispose(); globalThis.document = previous; }
});

test('the park handbag stays in the hand before lowering, both palms meet its handles and its base rests on the dressed lap', async t => {
  const asset = await oracleHead();
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async () => ({ ...asset, scene: asset.scene.clone(true) }));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  const rig = models.create(world.agents.get('oracle')!);
  const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, parkOutfit: true };
  try {
    models.animate(rig, 0, input, 1); await new Promise(resolve => setImmediate(resolve)); models.animate(rig, 0, input, 1);
    const bag = rig.root.getObjectByName('oracle-park-handbag')!, body = bag.getObjectByName('oracle-handbag-body') as THREE.Mesh;
    const handles = [-.11, .11].map(z => bag.getObjectByName(`oracle-handbag-handle-${z}`)!);
    const extent = () => body.localToWorld(body.getVertexPosition(0, new THREE.Vector3())).distanceTo(
      body.localToWorld(body.getVertexPosition(Math.floor(body.geometry.attributes.position.count / 3), new THREE.Vector3())));
    rig.root.updateWorldMatrix(true, true); const size = extent();
    for (const elapsed of [0, .35, .7, 1.05, 1.45, 1.9, 2.4]) {
      const epilogue = { ...newTrilogyEpilogue('dawn'), phase: 'sitting' as const, elapsed, total: elapsed, role: 'oracle' as const };
      const pose = gardenPose(epilogue, 'oracle'); rig.root.position.set(pose.x, 0, pose.z); rig.root.rotation.y = pose.yaw;
      models.animate(rig, 0, { ...input, epilogue }, 1); rig.root.updateWorldMatrix(true, true);
      assert.ok(bag.visible && Math.abs(extent() - size) < 1e-5, `${elapsed}: the handbag disappears or grows out of thin air`);
      const handlePoints = handles.flatMap(handle => points(handle));
      for (const side of elapsed < 1.05 ? [-1] : [-1, 1]) {
        const palm = rig.root.getObjectByName(`oracle-palm-${side}`)!;
        const gap = Math.min(...points(palm).map(point => Math.min(...handlePoints.map(handle => point.distanceTo(handle)))));
        assert.ok(gap < .045, `${elapsed} hand ${side}: actual palm misses the handle by ${gap}`);
      }
      if (elapsed === 2.4) {
        const bottom = bag.localToWorld(new THREE.Vector3(0, -.245, 0));
        const hit = new THREE.Raycaster(bottom.clone().add(new THREE.Vector3(0, .08, 0)), new THREE.Vector3(0, -1, 0))
          .intersectObject(rig.root.getObjectByName('oracle-park-skirt')!, false)[0];
        assert.ok(hit, 'the handbag needs an actual dress surface under its base');
        const gap = bottom.y - hit.point.y;
        assert.ok(gap > -.012 && gap < .035, `the bag floats over or penetrates the lap by ${gap}`);
      }
    }
    const chest = () => {
      rig.root.updateWorldMatrix(true, true); const meshes: THREE.Mesh[] = [];
      rig.torso.traverseVisible(object => { if (object instanceof THREE.Mesh) meshes.push(object); });
      const hit = new THREE.Raycaster(rig.torso.localToWorld(new THREE.Vector3(0, 1.22, 1)),
        new THREE.Vector3(0, 0, -1).transformDirection(rig.torso.matrixWorld)).intersectObjects(meshes, false)[0];
      assert.ok(hit, 'the open coat must cover a continuous clothed body');
      return (hit.object as THREE.Mesh).material as THREE.MeshStandardMaterial;
    };
    assert.ok(chest().map instanceof THREE.DataTexture, 'the park exposes the patterned dress through the open coat');
    models.animate(rig, 0, { ...input, epilogue: undefined, parkOutfit: false, oracleRestored: true }, 1);
    assert.equal(chest().map, null, 'the earlier crater body must not retain the park dress');
    models.animate(rig, 0, { ...input, epilogue: undefined, parkOutfit: false }, 1);
    assert.equal(chest().map, null, 'earlier apartment visits must regain their daily clothes');
  } finally { models.dispose(); globalThis.document = previous; }
});
