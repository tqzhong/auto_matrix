import * as THREE from 'three';

export function smithCodeUniforms() {
  return { smithOrigin: { value: new THREE.Vector3() }, smithCoating: { value: 0 }, smithReplacement: { value: 0 },
    smithErase: { value: 0 }, smithPulse: { value: 0 }, smithCrowd: { value: 0 } };
}

export type SmithCodeUniforms = ReturnType<typeof smithCodeUniforms>;

/** Opaque skin/cloth coating and fractured white light share the real silhouette. */
export function smithCodeSurface(material: THREE.Material, uniforms: SmithCodeUniforms, replica = false): void {
  const compile = material.onBeforeCompile.bind(material), key = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    compile(shader, renderer); Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSmithPoint; varying float vSmithRow;')
      .replace('#include <project_vertex>', `
        vec4 smithPoint = vec4(transformed, 1.0);
        vSmithRow = 0.0;
        #ifdef USE_INSTANCING
          smithPoint = instanceMatrix * smithPoint;
          vSmithRow = instanceMatrix[3].z;
        #endif
        vSmithPoint = (modelMatrix * smithPoint).xyz;
        #include <project_vertex>`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vSmithPoint; varying float vSmithRow;
      uniform vec3 smithOrigin;
      uniform float smithCoating, smithReplacement, smithErase, smithPulse, smithCrowd;
      float smithNoise(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        vec3 codePoint = vSmithPoint - smithOrigin;
        float codeNoise = smithNoise(floor(codePoint * 34.0));
        float codeDissolve = smithErase, codeLight = smithPulse;
        // Three defines USE_INSTANCING only in the vertex stage. Non-crowd
        // materials keep smithCrowd at zero, so their wave contributes nothing.
        float wave = clamp((smithCrowd - abs(vSmithRow + 38.0) * .003) / .62, 0.0, 1.0);
        codeDissolve = max(codeDissolve, smoothstep(.3, 1.0, wave));
        codeLight = max(codeLight, smoothstep(0.0, .3, wave) * (1.0 - smoothstep(.8, 1.0, wave)));
        if (codeNoise < codeDissolve || ${replica ? 'codeNoise >= smithReplacement' : 'codeNoise < smithReplacement'}) discard;`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        float ridge = sin(codePoint.y * 23.0 + sin(codePoint.x * 17.0)) * sin(codePoint.z * 19.0 + codePoint.x * 11.0);
        float spread = length(codePoint * vec3(1.0, .85, 1.0)) + ridge * .12;
        float oil = smoothstep(spread - .06, spread + .1, smithCoating * 4.8) * step(.001, smithCoating);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.006, .009, .008) + abs(ridge) * .012, oil);
        roughnessFactor = mix(roughnessFactor, .12, oil);
        metalnessFactor = mix(metalnessFactor, .52, oil);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float crack = pow(1.0 - abs(sin(codePoint.x * 13.0 + sin(codePoint.y * 9.0) + codePoint.z * 7.0)), 22.0);
        totalEmissiveRadiance += vec3(.82, .94, 1.0) * codeLight * (crack * 9.0 + codeDissolve * 2.0);`);
  };
  material.customProgramCacheKey = () => `${key}-smith-surface-${replica ? 'replica' : 'body'}-1`;
  material.needsUpdate = true;
}
