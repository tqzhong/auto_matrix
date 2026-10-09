import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { WebGLMaterials } from 'three/src/renderers/webgl/WebGLMaterials.js';
import { DOCK_EVACUATION, SHAFT_SEAL, FILM_SETS, dockEvacuationLift, dockEvacuationRoot, dockEvacuationSoldier, shaftSealLever, type DockEvacuation } from '@auto_matrix/shared';
import { DockEvacuationRenderer } from '../packages/client/src/engine/DockEvacuationRenderer.js';
import { DockEvacuationCrew } from '../packages/client/src/engine/DockEvacuationCrew.js';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

function fixture(t: TestContext, role: string) {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); world.agents.get(role)!.isInMatrix = false;
  const models = new CharacterModels(), rig = models.create(world.agents.get(role)!);
  assert.equal(rig.hero, undefined, 'the currently shipped Kid and operator use their existing joint rigs');
  t.after(() => { models.dispose(); globalThis.document = previous; }); return { rig, models };
}
test('the visible cage, floor opening and last crew share the saved descent without intersecting the shaft walls', () => {
  const root = new THREE.Group(), renderer = new DockEvacuationRenderer(root);
  try {
    for (const elapsed of [0, .8, 2.2, 4.1, 5.5]) {
      const state: DockEvacuation = { phase: 'lowering', elapsed, crewAge: 11, remaining: 10, attempts: 0, delivered: true };
      renderer.update(state); root.updateMatrixWorld(true);
      assert.equal(renderer.lift.position.y, dockEvacuationLift(state)); assert.equal(renderer.gate.position.y, 0);
      for (const role of ['kid', 'colt'] as const) {
        const at = dockEvacuationRoot(state, role); assert.equal(at.y, renderer.lift.position.y);
        assert.ok(Math.abs(at.x) < DOCK_EVACUATION.lift.width / 2 - .8);
        assert.ok(Math.abs(at.z - DOCK_EVACUATION.lift.z) < DOCK_EVACUATION.lift.depth / 2 - .8);
      }
      for (let i = 0; i < 6; i++) {
        const at = dockEvacuationSoldier(state, i); assert.equal(at.y, renderer.lift.position.y);
        assert.ok(Math.abs(at.z + 30) < 3.5 - .8);
      }
      const meshes: THREE.Mesh[] = [];
      root.traverseVisible(object => { if (object instanceof THREE.Mesh && !(object instanceof THREE.InstancedMesh)) meshes.push(object); });
      const at = dockEvacuationRoot(state, 'kid');
      const hit = new THREE.Raycaster(new THREE.Vector3(at.x, at.y + .25, at.z), new THREE.Vector3(0, -1, 0), 0, .5).intersectObjects(meshes, false)[0];
      assert.equal(hit?.object.name, 'evacuation-lift-deck'); assert.ok(Math.abs(hit!.point.y - at.y) < .001);
    }
  } finally { renderer.dispose(); }
});
test('the last crew plant their actual boot soles while running and remain inside the descending cage after a cold pose', () => {
  const root = new THREE.Group(), renderer = new DockEvacuationRenderer(root);
  const matrix = new THREE.Matrix4(), vertex = new THREE.Vector3();
  const boots = root.getObjectByName('evacuation-crew-boots') as THREE.InstancedMesh;
  assert.ok(boots);
  const sole = (index: number) => {
    boots.getMatrixAt(index, matrix); matrix.premultiply(boots.matrixWorld);
    const bounds = new THREE.Box3(), position = boots.geometry.attributes.position;
    for (let i = 0; i < position.count; i++) bounds.expandByPoint(vertex.fromBufferAttribute(position, i).applyMatrix4(matrix));
    return bounds;
  };
  try {
    for (const crewAge of [1.3, 3.7, 6.2, 8.4]) {
      const state: DockEvacuation = { phase: 'running', elapsed: 0, crewAge, remaining: 12, attempts: 0, delivered: true };
      renderer.update(state); root.updateMatrixWorld(true);
      const before = Array.from({ length: 12 }, (_, i) => sole(i));
      renderer.update({ ...state, crewAge: crewAge + .02 }); root.updateMatrixWorld(true);
      for (let i = 0; i < 12; i++) {
        const after = sole(i); assert.ok(after.min.y >= -.015);
        if (before[i].min.y < .005 && after.min.y < .005)
          assert.ok(before[i].getCenter(new THREE.Vector3()).distanceTo(after.getCenter(new THREE.Vector3())) < .015, `soldier ${Math.floor(i / 2)} support foot slides`);
      }
      for (let i = 0; i < 6; i++) assert.ok(Math.min(before[i * 2].min.y, before[i * 2 + 1].min.y) < .01);
    }
    const state: DockEvacuation = { phase: 'lowering', elapsed: 2.2, crewAge: 11, remaining: 12, attempts: 0, delivered: true };
    renderer.update(state); root.updateMatrixWorld(true);
    const saved = boots.instanceMatrix.array.slice();
    renderer.update(structuredClone(state)); assert.deepEqual(boots.instanceMatrix.array, saved);
    for (let i = 0; i < 12; i++) {
      const foot = sole(i); assert.ok(Math.abs(foot.min.y - dockEvacuationLift(state)) < .015);
      assert.ok(foot.min.x > -4.4 && foot.max.x < 4.4 && foot.min.z > -33.5 && foot.max.z < -26.5);
    }
  } finally { renderer.dispose(); }
});
test('Kid palms reach both actual cargo handles while lifting, walking and putting the box down', t => {
  const { models, rig } = fixture(t, 'kid'); rig.root.rotation.y = Math.PI;
  for (const phase of ['lifting', 'carrying', 'depositing'] as const) for (const elapsed of [0, .45, .9, 1.4, 1.8]) {
    const state: DockEvacuation = { phase, elapsed, crewAge: 0, remaining: 26, attempts: 0, delivered: false };
    models.animate(rig, 0, { speed: phase === 'carrying' ? 2 : 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, dockEvacuation: { ...state, role: 'kid' } }, 0);
    for (let i = 0; i < 2; i++) {
      const palm = rig.elbows[i].localToWorld(new THREE.Vector3(0, -.79, .055));
      const grip = rig.dockCargo!.handles[i].getWorldPosition(new THREE.Vector3());
      assert.ok(palm.distanceTo(grip) < .065, `${phase} ${elapsed} hand ${i}: ${palm.distanceTo(grip)}`);
    }
    for (const ankle of rig.ankles) assert.ok(ankle.getWorldPosition(new THREE.Vector3()).y >= .11, 'crouching must keep the boot support above the deck');
  }
});
test('cargo starts and ends on the real racks while moving Kid keeps a planted boot and both grips', t => {
  const { models, rig } = fixture(t, 'kid'); rig.root.rotation.y = Math.PI;
  for (const phase of ['lifting', 'depositing'] as const) {
    const marker = phase === 'lifting' ? DOCK_EVACUATION.pickup : DOCK_EVACUATION.delivery;
    const approach = { x: marker.x + .4, z: marker.z + .35, yaw: Math.PI };
    rig.root.position.set(approach.x, 0, approach.z);
    for (const elapsed of [0, .45, .9, 1.4, 1.8]) {
      const state: DockEvacuation = { phase, elapsed, crewAge: 0, remaining: 26, attempts: 0, delivered: false, approach };
      models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, dockEvacuation: { ...state, role: 'kid' } }, .1);
      const support = rig.ankles.map(ankle => new THREE.Box3().setFromObject(ankle).min.y);
      assert.ok(support.every(y => y >= -.015 && y < .035), `${phase} ${elapsed} soles: ${support}`);
      if (phase === 'lifting' && elapsed === 0 || phase === 'depositing' && elapsed === 1.8) {
        const rest = DOCK_EVACUATION.cargoRest[phase === 'lifting' ? 0 : 1];
        assert.ok(rig.dockCargo!.root.getWorldPosition(new THREE.Vector3()).distanceTo(new THREE.Vector3(rest.x, rest.y, rest.z)) < .001);
      }
    }
  }
  for (let frame = 0; frame < 45; frame++) {
    models.animate(rig, 0, { speed: 2, grounded: true, verticalVelocity: 0, turn: .3, realWorld: true,
      dockEvacuation: { phase: 'carrying', elapsed: 0, crewAge: 0, remaining: 26, attempts: 0, delivered: false, role: 'kid' } }, .1);
    for (let i = 0; i < 2; i++) {
      const palm = rig.elbows[i].localToWorld(new THREE.Vector3(0, -.79, .055));
      assert.ok(palm.distanceTo(rig.dockCargo!.handles[i].getWorldPosition(new THREE.Vector3())) < .065);
    }
    const support = rig.ankles.map(ankle => new THREE.Box3().setFromObject(ankle).min.y);
    assert.ok(support.every(y => y >= -.015) && Math.min(...support) < .045, `walking frame ${frame} soles: ${support}`);
  }
});
test('both operator hands follow the actual lever bar, including a paused halfway throw', t => {
  const { models, rig } = fixture(t, 'citizen_15'), center = FILM_SETS.film_zion_command_bunker.center;
  const root = new THREE.Group(); root.position.set(center.x, center.y - 1, center.z);
  const renderer = new DockEvacuationRenderer(root, true);
  rig.root.position.set(center.x + SHAFT_SEAL.operator.x, center.y - 1, center.z + SHAFT_SEAL.operator.z); rig.root.rotation.y = Math.PI;
  try {
    for (const turn of [0, .2, .45, .75, 1]) {
      const state = { phase: 'throwing', elapsed: 0, turn } as const;
      renderer.update(undefined, state);
      models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, shaftSeal: { ...state, role: 'citizen_15' } }, 0);
      root.updateMatrixWorld(true); const lever = shaftSealLever(state);
      const actual = root.getObjectByName('shaft-seal-grip')!.getWorldPosition(new THREE.Vector3());
      assert.ok(actual.distanceTo(new THREE.Vector3(center.x + lever.x, center.y - 1 + lever.y, center.z + lever.z)) < .001);
      for (let i = 0; i < 2; i++) {
        const target = actual.clone(); target.x += (i ? -1 : 1) * SHAFT_SEAL.lever.grip / 2;
        const palm = rig.elbows[i].localToWorld(new THREE.Vector3(0, -.79, .055));
        assert.ok(palm.distanceTo(target) < .065, `turn ${turn}, hand ${i}: ${palm.distanceTo(target)}`);
      }
      const saved = rig.elbows.map(elbow => elbow.matrixWorld.clone());
      models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, shaftSeal: { ...state, role: 'citizen_15' } }, 0);
      assert.deepEqual(rig.elbows.map(elbow => elbow.matrixWorld.elements), saved.map(matrix => matrix.elements));
    }
  } finally { renderer.dispose(); }
});

test('unfired demolition particles stay out of rendering and every drawn instance has a valid normal transform', () => {
  const renderer = new DockEvacuationRenderer(new THREE.Group(), true), matrix = new THREE.Matrix4();
  const rocks = renderer.group.getObjectByName('shaft-collapse-rock') as THREE.InstancedMesh;
  const dust = renderer.group.getObjectByName('shaft-collapse-dust') as THREE.InstancedMesh;
  try {
    for (const phase of ['ready', 'throwing'] as const) {
      renderer.update(undefined, { phase, elapsed: 0, turn: .5 });
      assert.equal(rocks.visible, false, 'unfired rocks must not enter the color or occlusion pass');
      assert.equal(dust.visible, false, 'unfired dust must not enter the color or occlusion pass');
    }
    for (const elapsed of [0, .1, .7, 2.5, 7.2]) {
      renderer.update(undefined, { phase: 'detonating', elapsed, turn: 1 });
      assert.equal(rocks.visible, true);
      for (const mesh of [rocks, dust]) if (mesh.visible) for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, matrix);
        assert.ok(matrix.determinant() > 1e-9, `${mesh.name} ${elapsed}/${i}: zero scale produces undefined shader normals`);
      }
      if (elapsed === 0) assert.equal(dust.visible, false, 'dust begins after the first explosion, rather than drawing zero-sized instances');
    }
  } finally { renderer.dispose(); }
});

test('demolition dust has a soft silhouette and restores its saved expansion without leaking into the operator room', () => {
  const renderer = new DockEvacuationRenderer(new THREE.Group(), true);
  const cold = new DockEvacuationRenderer(new THREE.Group(), true), matrix = new THREE.Matrix4();
  let disposed = 0;
  try {
    const cloud = renderer.group.getObjectByName('shaft-collapse-dust') as THREE.InstancedMesh;
    assert.ok(cloud.material instanceof THREE.ShaderMaterial, 'opaque polygon faces cannot produce a soft smoke silhouette');
    const material = cloud.material, texture = material.uniforms.cloud.value as THREE.DataTexture;
    texture.addEventListener('dispose', () => disposed++);
    const pixels = texture.image.data as Uint8Array, width = texture.image.width;
    assert.equal(pixels[3], 0, 'the cloud must have transparent outer corners');
    assert.ok(pixels[(Math.floor(width / 2) * width + Math.floor(width / 2)) * 4 + 3] > 160);
    for (const elapsed of [.1, .7, 2.5, 7.2]) {
      const state = { phase: 'detonating', elapsed, turn: 1 } as const;
      renderer.update(undefined, state); cold.update(undefined, structuredClone(state));
      const restored = cold.group.getObjectByName('shaft-collapse-dust') as THREE.InstancedMesh;
      assert.equal(restored.count, cloud.count); assert.deepEqual(restored.instanceMatrix.array, cloud.instanceMatrix.array);
      const opacity = cloud.geometry.getAttribute('cloudOpacity');
      assert.deepEqual(restored.geometry.getAttribute('cloudOpacity').array, opacity.array);
      for (let i = 0; i < cloud.count; i++) {
        cloud.getMatrixAt(i, matrix);
        assert.ok(matrix.determinant() > 1e-9);
        assert.ok(matrix.elements[14] < -8, 'smoke centers stay behind the separating wall');
        assert.ok(opacity.getX(i) > 0 && opacity.getX(i) <= 1, 'fading cannot produce invalid alpha');
      }
    }
  } finally { renderer.dispose(); cold.dispose(); }
  assert.equal(disposed, 1, 'leaving the set releases its cloud texture');
});

test('visible demolition clouds accept the renderer fog updates for both scene fog types', () => {
  const renderer = new DockEvacuationRenderer(new THREE.Group(), true);
  const second = new DockEvacuationRenderer(new THREE.Group(), true);
  const webgl = WebGLMaterials({ getRenderTarget: () => null, outputColorSpace: THREE.LinearSRGBColorSpace }, undefined);
  try {
    renderer.update(undefined, { phase: 'detonating', elapsed: 2.5, turn: 1 });
    const cloud = renderer.group.getObjectByName('shaft-collapse-dust') as THREE.InstancedMesh;
    const uniforms = (cloud.material as THREE.ShaderMaterial).uniforms;
    const linear = new THREE.Fog(0x8b8171, 5, 80), exponential = new THREE.FogExp2(0x676655, .025);
    assert.doesNotThrow(() => webgl.refreshFogUniforms(uniforms, linear), 'the actual Three renderer must not crash when the cloud becomes visible');
    assert.equal(uniforms.fogNear.value, 5); assert.equal(uniforms.fogFar.value, 80);
    webgl.refreshFogUniforms(uniforms, exponential);
    assert.equal(uniforms.fogDensity.value, .025); assert.ok(uniforms.fogColor.value.equals(exponential.color));
    const other = (second.group.getObjectByName('shaft-collapse-dust') as THREE.InstancedMesh).material as THREE.ShaderMaterial;
    assert.notEqual(uniforms.fogColor.value, other.uniforms.fogColor.value, 'separate sets cannot share mutable fog colors');
  } finally { renderer.dispose(); second.dispose(); }
});

test('the inactive sentinel wave is hidden rather than drawing singular instances before the wind warning', () => {
  const renderer = new DockEvacuationRenderer(new THREE.Group()), matrix = new THREE.Matrix4();
  const wave = ['shells', 'eyes', 'tendrils'].map(part => renderer.group.getObjectByName(`evacuation-sentinel-${part}`) as THREE.InstancedMesh);
  try {
    for (const phase of ['supplies', 'carrying', 'wind', 'running'] as const) {
      renderer.update({ phase, elapsed: 0, crewAge: 0, remaining: 26, attempts: 0, delivered: phase !== 'supplies' });
      for (const mesh of wave) {
        assert.equal(mesh.visible, phase === 'wind' || phase === 'running');
        if (mesh.visible) for (let i = 0; i < mesh.count; i++) {
          mesh.getMatrixAt(i, matrix); assert.ok(matrix.determinant() > 0, 'the visible wave needs finite shader normals');
        }
      }
    }
  } finally { renderer.dispose(); }
});

async function crewAsset(name: string) {
  const raw = await readFile(new URL(`../packages/client/public/assets/characters/${name}.glb`, import.meta.url));
  const length = raw.readUInt32LE(12), source = JSON.parse(raw.subarray(20, 20 + length).toString());
  for (const material of source.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
  source.images = []; source.textures = [];
  const json = Buffer.from(JSON.stringify(source)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = raw.subarray(20 + length), buffer = Buffer.alloc(20 + padded.length + bin.length);
  buffer.writeUInt32LE(0x46546c67, 0); buffer.writeUInt32LE(2, 4); buffer.writeUInt32LE(buffer.length, 8);
  buffer.writeUInt32LE(padded.length, 12); buffer.writeUInt32LE(0x4e4f534a, 16); padded.copy(buffer, 20); bin.copy(buffer, 20 + padded.length);
  return new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '');
}
test('the delivered crew meshes keep their supporting soles planted and restore the saved pose after asynchronous loading', async t => {
  const assets = await Promise.all(['club-male', 'club-female'].map(crewAsset));
  t.mock.method(GLTFLoader.prototype, 'loadAsync', (url: string) => Promise.resolve(assets[url.includes('female') ? 1 : 0]));
  const root = new THREE.Group(), crew = new DockEvacuationCrew(root);
  const state: DockEvacuation = { phase: 'running', elapsed: 0, crewAge: 6.2, remaining: 15, attempts: 0, delivered: true };
  crew.update(state); await crew.ready; t.after(() => crew.dispose());
  crew.group.children.forEach((person, i) => {
    const at = dockEvacuationSoldier(state, i);
    assert.ok(person.position.distanceTo(new THREE.Vector3(at.x, at.y, at.z)) < .001, 'asynchronous loading must use the saved crew positions');
  });
  const shoes = (person: THREE.Object3D) => {
    const result = [Infinity, Infinity]; person.updateWorldMatrix(true, true);
    person.traverse(object => {
      if (!(object instanceof THREE.SkinnedMesh) || (object.material as THREE.Material).name !== 'Boot leather') return;
      object.skeleton.update();
      const position = object.geometry.attributes.position, point = new THREE.Vector3();
      for (let i = 0; i < position.count; i++) {
        const side = position.getX(i) < 0 ? 0 : 1; object.getVertexPosition(i, point).applyMatrix4(object.matrixWorld); result[side] = Math.min(result[side], point.y);
      }
    });
    return result;
  };
  for (const crewAge of [1.3, 3.7, 6.2, 8.4, 11]) {
    crew.update({ ...state, crewAge }); root.updateMatrixWorld(true);
    for (const person of crew.group.children) {
      const support = shoes(person);
      assert.ok(support.every(y => y >= -.025) && Math.min(...support) < .045, `${person.name} ${crewAge} actual shoe soles: ${support}`);
      const matrices = ['head', 'ankle_R', 'ankle_L'].map(name => person.getObjectByName(name)!.matrixWorld.elements.slice());
      crew.update({ ...state, crewAge }); root.updateMatrixWorld(true);
      ['head', 'ankle_R', 'ankle_L'].forEach((name, joint) => {
        assert.ok(person.getObjectByName(name)!.matrixWorld.elements.every((value, element) => Math.abs(value - matrices[joint][element]) < 1e-8), 'a repeated saved frame must keep the same head and foot transforms');
      });
    }
  }
  crew.update({ ...state, phase: 'lowering', crewAge: 11, elapsed: 2.2 }); root.updateMatrixWorld(true);
  for (const person of crew.group.children) for (const y of shoes(person)) assert.ok(Math.abs(y - dockEvacuationLift({ ...state, phase: 'lowering', elapsed: 2.2 })) < .045);
});
