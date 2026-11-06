import * as THREE from 'three';

/** Skip texture variants of Three's packed depth program for opaque casters. */
export function prepareOpaqueShadowDepth(mesh: THREE.Mesh): void {
  const before = mesh.onBeforeShadow, after = mesh.onAfterShadow;
  let depth: THREE.MeshDepthMaterial | undefined;
  let map: THREE.Texture | null = null, alphaMap: THREE.Texture | null = null;
  mesh.onBeforeShadow = function(...args) {
    before.apply(this, args);
    const material = args[5];
    if (!(material instanceof THREE.MeshDepthMaterial) || material.depthPacking !== THREE.RGBADepthPacking
      || mesh.customDepthMaterial || material.alphaTest !== 0 || material.alphaHash || material.alphaToCoverage
      || !(material.map || material.alphaMap)) return;
    // WebGLShadowMap copies the surface maps onto its shared depth material.
    depth = material; map = material.map; alphaMap = material.alphaMap;
    material.map = material.alphaMap = null;
  };
  mesh.onAfterShadow = function(...args) {
    if (depth) {
      depth.map = map; depth.alphaMap = alphaMap;
      depth = undefined; map = alphaMap = null;
    }
    after.apply(this, args);
  };
}
