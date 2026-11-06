import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { enableSkinnedCulling } from '../packages/client/src/agents/SkinnedBounds.js';

function fixture() {
  const root = new THREE.Group(), first = new THREE.Bone(), second = new THREE.Bone();
  first.add(second); second.position.set(.1, .9, -.2); root.add(first); root.updateMatrixWorld(true);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([.23, .4, -.21, -.32, 1.2, .16, .52, .8, .33], 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1], 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute([.6, .4, 0, 0, .37, .63, 0, 0, .1, .2, .3, .4], 4));
  geometry.setIndex([0, 1, 2]); geometry.morphTargetsRelative = true;
  geometry.morphAttributes.position = [new THREE.Float32BufferAttribute([.03, -.02, .01, -.01, .02, .03, .02, -.01, -.04], 3)];
  const material = new THREE.MeshStandardMaterial(), mesh = new THREE.SkinnedMesh(geometry, material), skeleton = new THREE.Skeleton([first, second]);
  root.add(mesh); mesh.bind(skeleton, new THREE.Matrix4()); mesh.morphTargetInfluences![0] = .7;
  enableSkinnedCulling(root);
  root.position.set(5056, -119.58433726431349, 4430.3104162737045); root.rotation.set(.18, .63, -.11);
  first.rotation.set(.3, -.4, .15); second.rotation.set(-.2, .5, .1); root.updateMatrixWorld(true);
  return { root, first, second, geometry, material, mesh, skeleton,
    dispose: () => { geometry.dispose(); material.dispose(); skeleton.dispose(); } };
}

// Float32 arithmetic on the actual matrices/attributes delivered for this draw.
// The browser readback separately exercises the compiled WebGL shader.
const f = Math.fround;
function multiply(matrix: THREE.Matrix4, point: number[]) {
  return [0, 1, 2, 3].map(row => [0, 1, 2, 3].reduce((sum, column) => f(sum + f(f(matrix.elements[column * 4 + row]) * point[column])), 0));
}
function displayed(mesh: THREE.SkinnedMesh, vertex: number, local: boolean) {
  const a = mesh.geometry.attributes, position = [0, 1, 2].map(k => f(a.position.getComponent(vertex, k) + f(mesh.geometry.morphAttributes.position[0].getComponent(vertex, k) * f(mesh.morphTargetInfluences![0]))));
  const bind = multiply(mesh.bindMatrix, [...position, 1]), result = [0, 0, 0, 0];
  for (let part = 0; part < 4; part++) {
    const weight = a.skinWeight.getComponent(vertex, part), joint = a.skinIndex.getComponent(vertex, part);
    const matrix = new THREE.Matrix4().fromArray(mesh.skeleton.boneMatrices, joint * 16), p = multiply(matrix, bind);
    for (let k = 0; k < 4; k++) result[k] = f(result[k] + f(p[k] * weight));
  }
  if (local) {
    for (let k = 0; k < 3; k++) result[k] = f(result[k] + f(a.skinWeightResidual.getX(vertex) * f(mesh.matrixWorld.elements[12 + k])));
    result[3] = 1;
  }
  return new THREE.Vector3(...multiply(mesh.bindMatrixInverse, result).slice(0, 3));
}
const renderer = {} as THREE.WebGLRenderer, scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(), group = {} as THREE.Group;
function draw(mesh: THREE.SkinnedMesh, material: THREE.Material, shadow = false) {
  const source = mesh.skeleton; source.update();
  if (shadow) mesh.onBeforeShadow(renderer, scene, camera, camera, mesh.geometry, material, group);
  else mesh.onBeforeRender(renderer, scene, camera, mesh.geometry, material, group);
  try {
    if (!mesh.skeleton.boneTexture) mesh.skeleton.computeBoneTexture();
    const shader = { uniforms: {}, vertexShader: '#include <skinning_pars_vertex>\n#include <skinning_vertex>', fragmentShader: '' };
    material.onBeforeCompile(shader as THREE.WebGLProgramParametersWithUniforms, renderer);
    const local = shader.vertexShader.includes('attribute float skinWeightResidual');
    const points = [0, 1, 2].map(vertex => displayed(mesh, vertex, local));
    return { points, shader, skeleton: mesh.skeleton, texture: mesh.skeleton.boneTexture!, inverse: mesh.bindMatrixInverse.clone() };
  } finally {
    if (shadow) mesh.onAfterShadow(renderer, scene, camera, camera, mesh.geometry, material, group);
    else mesh.onAfterRender(renderer, scene, camera, mesh.geometry, material, group);
  }
}

test('far-world skinning follows CPU contact positions without changing source skin, morphs or bones', () => {
  const h = fixture(), original = Object.fromEntries(Object.entries(h.geometry.attributes).filter(([name]) => name !== 'skinWeightResidual').map(([name, a]) => [name, Array.from(a.array)]));
  const pose = h.skeleton.bones.map(bone => bone.matrixWorld.toArray()), inverse = h.mesh.bindMatrixInverse.clone();
  try {
    const expected = [0, 1, 2].map(i => h.mesh.getVertexPosition(i, new THREE.Vector3()));
    const actual = draw(h.mesh, h.material);
    const error = Math.max(...expected.map((p, i) => p.distanceTo(actual.points[i])));
    assert.ok(error < 5e-6, `GPU-bound Float32 skin matrices drift ${error} game units from the contact surface`);
    assert.equal(h.mesh.skeleton, h.skeleton); assert.deepEqual(h.mesh.bindMatrixInverse, inverse);
    assert.deepEqual(h.skeleton.bones.map(bone => bone.matrixWorld.toArray()), pose);
    assert.deepEqual([0, 1, 2].map(i => h.mesh.getVertexPosition(i, new THREE.Vector3())), expected);
    for (const [name, values] of Object.entries(original)) assert.deepEqual(Array.from(h.geometry.attributes[name].array), values);
    assert.deepEqual(Array.from(h.geometry.index!.array), [0, 1, 2]);
  } finally { h.dispose(); }
});

test('colour and shadow callbacks preserve existing hooks and restore CPU bindings before after-hooks', () => {
  const h = fixture(); let compiled = 0, after = 0;
  // Installing on a new mesh chains hooks which already exist on that mesh.
  const mesh = new THREE.SkinnedMesh(h.geometry, h.material); h.root.add(mesh); mesh.bind(h.skeleton, h.mesh.bindMatrix.clone());
  const before = () => assert.equal(mesh.skeleton, h.skeleton);
  mesh.onBeforeRender = before; mesh.onBeforeShadow = before;
  const restored = () => { assert.equal(mesh.skeleton, h.skeleton); after++; };
  mesh.onAfterRender = restored; mesh.onAfterShadow = restored;
  h.material.onBeforeCompile = shader => { shader.uniforms.originalHook = { value: 17 }; compiled++; };
  h.material.customProgramCacheKey = () => 'existing-character-material';
  enableSkinnedCulling(mesh); h.root.updateMatrixWorld(true);
  try {
    const colour = draw(mesh, h.material), depth = draw(mesh, new THREE.MeshDepthMaterial(), true), distance = draw(mesh, new THREE.MeshDistanceMaterial(), true);
    assert.equal((colour.shader.uniforms as any).originalHook.value, 17); assert.equal(compiled, 1); assert.equal(after, 3);
    assert.ok(h.material.customProgramCacheKey().includes('existing-character-material'));
    assert.deepEqual(colour.points, depth.points); assert.deepEqual(colour.points, distance.points);
    assert.ok(depth.shader.vertexShader.includes('skinWeightResidual') && distance.shader.vertexShader.includes('skinWeightResidual'));
    assert.notEqual(colour.skeleton, h.skeleton, 'the GPU bone texture cannot replace the CPU world bone matrices');
    depth.texture.dispose();
  } finally { h.dispose(); }
});

test('a shared skeleton, replaced geometry and detached garment keep their current binding and pose', () => {
  const h = fixture(), second = new THREE.SkinnedMesh(h.geometry.clone(), h.material); second.bind(h.skeleton, new THREE.Matrix4());
  h.root.add(second); second.position.set(.37, -.18, .42); enableSkinnedCulling(second); h.root.updateMatrixWorld(true);
  try {
    for (const mesh of [h.mesh, second, h.mesh]) {
      const expected = [0, 1, 2].map(i => mesh.getVertexPosition(i, new THREE.Vector3())), actual = draw(mesh, h.material);
      assert.ok(Math.max(...expected.map((p, i) => p.distanceTo(actual.points[i]))) < 5e-6);
      assert.equal(mesh.skeleton, h.skeleton);
    }
    const replacement = h.geometry.clone(); replacement.deleteAttribute('skinWeightResidual');
    second.geometry = replacement; h.first.rotation.x += .12; h.root.updateMatrixWorld(true);
    const expected = second.getVertexPosition(1, new THREE.Vector3());
    assert.ok(draw(second, h.material).points[1].distanceTo(expected) < 5e-6, 'the first draw of replaced geometry includes its weight correction');
    const bone = new THREE.Bone(), garment = new THREE.Group(); garment.add(bone); garment.updateMatrixWorld(true);
    const skeleton = new THREE.Skeleton([bone, bone]); garment.add(second); second.bind(skeleton, new THREE.Matrix4());
    garment.position.set(-4012, 23, 2095); garment.updateMatrixWorld(true);
    const detached = second.getVertexPosition(2, new THREE.Vector3());
    assert.ok(draw(second, h.material).points[2].distanceTo(detached) < 5e-6); assert.equal(second.skeleton, skeleton);
    skeleton.dispose(); replacement.dispose();
  } finally { second.geometry.dispose(); h.dispose(); }
});

test('GPU textures are reused between materials and disposed with the source skeleton', () => {
  const h = fixture();
  try {
    const first = draw(h.mesh, h.material), texture = first.texture; let disposed = 0;
    texture.addEventListener('dispose', () => disposed++);
    const second = draw(h.mesh, new THREE.MeshNormalMaterial()); assert.equal(second.texture, texture);
    h.skeleton.dispose(); assert.equal(disposed, 1);
  } finally { h.dispose(); }
});

test('opaque skinned shadows draw depth without binding colour or opacity textures', () => {
  const h = fixture(), map = new THREE.Texture(), alphaMap = new THREE.Texture();
  const depth = new THREE.MeshDepthMaterial({ map, alphaMap, depthPacking: THREE.RGBADepthPacking });
  h.material.map = map;
  const shadowMaps = () => {
    const args = [renderer, scene, camera, camera, h.geometry, depth, group] as const;
    h.mesh.onBeforeShadow(...args);
    try { return [depth.map, depth.alphaMap]; }
    finally { h.mesh.onAfterShadow(...args); }
  };
  try {
    assert.deepEqual(shadowMaps().map(Boolean), [false, false], 'ordinary opaque depth does not use either texture');
    assert.equal(depth.map, map); assert.equal(depth.alphaMap, alphaMap); assert.equal(h.material.map, map);
    depth.alphaTest = .42;
    assert.deepEqual(shadowMaps(), [map, alphaMap], 'masked hair still needs both maps for its shadow silhouette');
    depth.alphaTest = 0; h.mesh.customDepthMaterial = depth;
    assert.deepEqual(shadowMaps(), [map, alphaMap], 'custom shadow shaders keep their inputs');
    h.mesh.customDepthMaterial = undefined; depth.alphaHash = true;
    assert.deepEqual(shadowMaps(), [map, alphaMap], 'hashed shadow cutouts keep their inputs');
  } finally { depth.dispose(); map.dispose(); alphaMap.dispose(); h.dispose(); }
});
