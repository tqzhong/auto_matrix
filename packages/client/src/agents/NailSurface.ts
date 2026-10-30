import * as THREE from 'three';

// Authored weights follow the existing continuous skin through hand posing.
export function applyNailSurface(material: THREE.MeshStandardMaterial): void {
  const compile = material.onBeforeCompile, key = material.customProgramCacheKey();
  material.onBeforeCompile = function (shader, renderer) {
    compile.call(this, shader, renderer);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
      attribute vec2 _nail_detail;
      varying vec2 vNailDetail;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vNailDetail = _nail_detail;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      varying vec2 vNailDetail;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float nailMask = smoothstep(0.12, 0.88, vNailDetail.x);
        float nailEdge = smoothstep(0.05, 0.75, vNailDetail.y) * nailMask;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.03, 1.0, 0.99) + vec3(0.012, 0.007, 0.006), nailMask * 0.65);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.63, 0.57, 0.50), nailEdge * 0.25);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.34, nailMask);`);
  };
  material.customProgramCacheKey = () => key + '|natural-nail-surface-v1';
  material.needsUpdate = true;
}
