import * as THREE from 'three';
import { prepareSkinnedMaterial } from '../agents/SkinnedPrecision.js';
import { usesOpaqueShadowDepth } from './OpaqueShadowDepth.js';

type Program = NonNullable<THREE.WebGLRenderer['info']['programs']>[number];

/** Keep live material bindings while linking another program on the same material. */
export function preserveProgramBindings(renderer: THREE.WebGLRenderer, meshes: readonly (THREE.Mesh | undefined)[]): () => void {
  const saved: { bindings: object; live: object }[] = [];
  for (const mesh of meshes) {
    if (!mesh || Array.isArray(mesh.material)) continue;
    const bindings = renderer.properties.get(mesh.material) as { currentProgram?: Program };
    if (bindings.currentProgram) saved.push({ bindings, live: { ...bindings } });
  }
  return () => { for (const { bindings, live } of saved) Object.assign(bindings, live); };
}

/** Cache locations after parallel compilation reports completion. */
export function cacheReadyProgramLocations(renderer: THREE.WebGLRenderer, program: Program): void {
  const debug = renderer.debug, checks = debug.checkShaderErrors;
  try {
    if (checks && program.program) {
      const gl = renderer.getContext();
      // Log reads can block even after linking. Failed links still need the original diagnostics.
      if (gl.getProgramParameter(program.program, gl.LINK_STATUS) === true) debug.checkShaderErrors = false;
    }
    program.getUniforms();
  } finally { debug.checkShaderErrors = checks; }
}

/** Match the packed depth variants of the actual casters without moving their meshes. */
export function shadowCasterProxies(meshes: Iterable<THREE.Object3D>, materials: Set<THREE.MeshDepthMaterial>): THREE.Mesh[] {
  const variants = new Map<string, THREE.Mesh>();
  for (const mesh of meshes) {
    if (!(mesh instanceof THREE.Mesh) || !mesh.castShadow || mesh.customDepthMaterial || mesh instanceof THREE.BatchedMesh) continue;
    const surfaces = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const surface of surfaces) {
      if (!(surface instanceof THREE.MeshStandardMaterial || surface instanceof THREE.MeshBasicMaterial) || !surface.visible
        || surface.clipShadows && surface.clippingPlanes?.length || 'displacementMap' in surface && surface.displacementMap) continue;
      const side = surface.shadowSide ?? (surface.side === THREE.FrontSide ? THREE.BackSide : surface.side === THREE.BackSide ? THREE.FrontSide : THREE.DoubleSide);
      const omitMaps = usesOpaqueShadowDepth(mesh) && surface.alphaTest === 0;
      const map = omitMaps ? null : surface.map, alphaMap = omitMaps ? null : surface.alphaMap;
      const skinned = mesh instanceof THREE.SkinnedMesh, instanced = mesh instanceof THREE.InstancedMesh;
      const morph = mesh.geometry.morphAttributes;
      const key = [side, map?.channel ?? -1, alphaMap?.channel ?? -1, surface.alphaTest > 0, skinned, instanced,
        instanced && Boolean(mesh.instanceColor), instanced && Boolean(mesh.morphTexture),
        morph.position?.length ?? -1, morph.normal?.length ?? -1, morph.color?.length ?? -1].join(',');
      if (variants.has(key)) continue;
      const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side, map, alphaMap, alphaTest: surface.alphaTest });
      prepareSkinnedMaterial(depth); materials.add(depth);
      let caster: THREE.Mesh;
      if (instanced) {
        const proxy = new THREE.InstancedMesh(mesh.geometry, depth, 0);
        proxy.instanceColor = mesh.instanceColor; proxy.morphTexture = mesh.morphTexture; caster = proxy;
      } else caster = skinned ? new THREE.SkinnedMesh(mesh.geometry, depth) : new THREE.Mesh(mesh.geometry, depth);
      variants.set(key, caster);
    }
  }
  return [...variants.values()];
}
