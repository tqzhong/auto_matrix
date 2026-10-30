import * as THREE from 'three';

// A painted vertex mask keeps the existing eye/lip details and body atlas.
export function applySkinAlbedo(material: THREE.MeshStandardMaterial, texture: THREE.Texture): void {
  const compile = material.onBeforeCompile, key = material.customProgramCacheKey();
  material.onBeforeCompile = function (shader, renderer) {
    compile.call(this, shader, renderer);
    shader.uniforms.refinedSkinAlbedo = { value: texture };
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
      attribute vec2 _albedo_uv;
      attribute float _albedo_weight;
      varying vec2 vAlbedoUv;
      varying float vAlbedoWeight;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vAlbedoUv = _albedo_uv; vAlbedoWeight = _albedo_weight;`);
    const map = THREE.ShaderChunk.map_fragment.replace('diffuseColor *= sampledDiffuseColor;', `
      sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, texture2D(refinedSkinAlbedo, vAlbedoUv).rgb, vAlbedoWeight);
      diffuseColor *= sampledDiffuseColor;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      uniform sampler2D refinedSkinAlbedo;
      varying vec2 vAlbedoUv;
      varying float vAlbedoWeight;`)
      .replace('#include <map_fragment>', map);
  };
  material.customProgramCacheKey = () => key + '|painted-skin-albedo-v1';
  material.needsUpdate = true;
}

export function applyReferencePigment(material: THREE.MeshStandardMaterial): void {
  const compile = material.onBeforeCompile, key = material.customProgramCacheKey();
  material.onBeforeCompile = function (shader, renderer) {
    compile.call(this, shader, renderer);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
      attribute vec4 _face_pigment;
      varying vec4 vReferencePigment;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vReferencePigment = _face_pigment;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      varying vec4 vReferencePigment;`)
      .replace('#include <color_fragment>', `
        diffuseColor.rgb = mix(diffuseColor.rgb, vReferencePigment.rgb * diffuse, vReferencePigment.a);
        #include <color_fragment>`);
  };
  material.customProgramCacheKey = () => key + '|reference-pigment-v1';
  material.needsUpdate = true;
}

// A local albedo paint layer follows the existing mouth vertices through FACS.
export function applyMouthAlbedo(material: THREE.MeshStandardMaterial): void {
  const compile = material.onBeforeCompile, key = material.customProgramCacheKey();
  material.onBeforeCompile = function (shader, renderer) {
    compile.call(this, shader, renderer);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
      attribute vec4 _mouth_albedo;
      varying vec4 vMouthAlbedo;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vMouthAlbedo = _mouth_albedo;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      varying vec4 vMouthAlbedo;`)
      .replace('#include <color_fragment>', `
        diffuseColor.rgb = mix(diffuseColor.rgb, vMouthAlbedo.rgb * diffuse, vMouthAlbedo.a);
        #include <color_fragment>`);
  };
  material.customProgramCacheKey = () => key + '|mouth-albedo-paint-v1';
  material.needsUpdate = true;
}
