import * as THREE from 'three';
import { prepareOpaqueShadowDepth } from '../engine/OpaqueShadowDepth.js';

const installed = new WeakSet<THREE.SkinnedMesh>(), materials = new WeakSet<THREE.Material>();
const residuals = new WeakMap<THREE.BufferAttribute | THREE.InterleavedBufferAttribute, { version: number; attribute: THREE.BufferAttribute }>();
interface BoneTexture {
  gpu: THREE.Skeleton;
  revision: number;
  packed: number;
  origin: THREE.Vector3;
}
const textures = new WeakMap<THREE.Skeleton, BoneTexture>();

function geometryWeights(geometry: THREE.BufferGeometry): void {
  const weights = geometry.attributes.skinWeight;
  const version = weights instanceof THREE.InterleavedBufferAttribute ? weights.data.version : weights.version;
  let entry = residuals.get(weights);
  if (!entry || entry.version !== version) {
    const values = new Float32Array(weights.count);
    // Preserve the exact authored Float32 weights. CPU skinning applies the
    // inverse bind to a point (w=1), even when their sum differs slightly from 1.
    for (let i = 0; i < values.length; i++) values[i] = weights.getX(i) + weights.getY(i) + weights.getZ(i) + weights.getW(i) - 1;
    entry = { version, attribute: new THREE.Float32BufferAttribute(values, 1) }; residuals.set(weights, entry);
  }
  geometry.setAttribute('skinWeightResidual', entry.attribute);
}

export function prepareSkinnedMaterial(material: THREE.Material): void {
  if (materials.has(material)) return;
  materials.add(material);
  const compile = material.onBeforeCompile, key = material.customProgramCacheKey();
  material.onBeforeCompile = function(shader, renderer) {
    compile.call(this, shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace('#include <skinning_pars_vertex>', `${THREE.ShaderChunk.skinning_pars_vertex}\n#ifdef USE_SKINNING\nattribute float skinWeightResidual;\n#endif`)
      .replace('#include <skinning_vertex>', THREE.ShaderChunk.skinning_vertex.replace('transformed = ( bindMatrixInverse * skinned ).xyz;',
        'skinned.xyz += skinWeightResidual * modelMatrix[3].xyz;\ntransformed = ( bindMatrixInverse * vec4(skinned.xyz, 1.0) ).xyz;'));
  };
  material.customProgramCacheKey = () => `${key}:actor-local-skin-v1`;
  material.needsUpdate = true;
}

function boneTexture(source: THREE.Skeleton, origin: THREE.Vector3): THREE.Skeleton {
  let entry = textures.get(source);
  if (!entry) {
    const state: BoneTexture = { gpu: new THREE.Skeleton(source.bones, source.boneInverses), revision: 0, packed: -1, origin: new THREE.Vector3() };
    const update = source.update, dispose = source.dispose;
    source.update = function() { update.call(this); state.revision++; };
    source.dispose = function() { state.gpu.dispose(); state.packed = -1; dispose.call(this); };
    textures.set(source, state); entry = state;
  }
  if (entry.packed !== entry.revision || !entry.origin.equals(origin)) {
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < source.bones.length; i++) {
      // Subtract in double precision before packing. Rebasing a previously
      // rounded world-space Float32 texture cannot recover the lost precision.
      matrix.multiplyMatrices(source.bones[i].matrixWorld, source.boneInverses[i]);
      matrix.elements[12] -= origin.x; matrix.elements[13] -= origin.y; matrix.elements[14] -= origin.z;
      matrix.toArray(entry.gpu.boneMatrices, i * 16);
    }
    if (entry.gpu.boneTexture) entry.gpu.boneTexture.needsUpdate = true;
    entry.origin.copy(origin); entry.packed = entry.revision;
  }
  return entry.gpu;
}

/** Keep GPU skinning near each mesh, while CPU contact/bounds retain their
 * original world-space skeleton and bind matrices outside the draw call. */
export function prepareSkinnedPrecision(mesh: THREE.SkinnedMesh): void {
  if (installed.has(mesh)) return;
  installed.add(mesh); geometryWeights(mesh.geometry);
  prepareOpaqueShadowDepth(mesh);
  const update = mesh.updateMatrixWorld;
  mesh.updateMatrixWorld = function(force) { update.call(this, force); geometryWeights(this.geometry); };
  const before = mesh.onBeforeRender, after = mesh.onAfterRender, beforeShadow = mesh.onBeforeShadow, afterShadow = mesh.onAfterShadow;
  const inverse = new THREE.Matrix4(), translation = new THREE.Matrix4(), origin = new THREE.Vector3();
  let source: THREE.Skeleton;
  const begin = (material: THREE.Material) => {
    prepareSkinnedMaterial(material); source = mesh.skeleton; inverse.copy(mesh.bindMatrixInverse);
    origin.setFromMatrixPosition(mesh.matrixWorld);
    mesh.skeleton = boneTexture(source, origin);
    mesh.bindMatrixInverse.multiply(translation.makeTranslation(origin.x, origin.y, origin.z));
  };
  const end = () => { mesh.skeleton = source; mesh.bindMatrixInverse.copy(inverse); };
  mesh.onBeforeRender = function(...args) { before.apply(this, args); begin(args[4]); };
  mesh.onAfterRender = function(...args) { end(); after.apply(this, args); };
  mesh.onBeforeShadow = function(...args) { beforeShadow.apply(this, args); begin(args[5]); };
  mesh.onAfterShadow = function(...args) { end(); afterShadow.apply(this, args); };
}
