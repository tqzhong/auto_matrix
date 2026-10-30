import * as THREE from 'three';
import { MouthContactShadows, type MouthShadowData } from './MouthContactShadows.js';

export interface OralAmbientOcclusionData {
  version: 1;
  sourceMesh: string;
  meshes: string[];
  attribute: string;
  openingPairs: [number, number][];
  openingKnots: number[];
  lightPairs: [number, number][];
  contactShadows: MouthShadowData;
  maskedMeshes?: string[];
  maskAttribute?: string;
}

function oralPoint(face: THREE.Mesh, vertex: number, output: THREE.Vector3): THREE.Vector3 {
  const position = face.geometry.attributes.position, morphs = face.geometry.morphAttributes.position;
  const x = position.getX(vertex), y = position.getY(vertex), z = position.getZ(vertex); let px = x, py = y, pz = z;
  for (const [index, amount] of (face.morphTargetInfluences ?? []).entries()) if (amount) {
    const field = morphs[index], relative = face.geometry.morphTargetsRelative;
    px += amount * (field.getX(vertex) - (relative ? 0 : x)); py += amount * (field.getY(vertex) - (relative ? 0 : y)); pz += amount * (field.getZ(vertex) - (relative ? 0 : z));
  }
  return output.set(px, py, pz);
}

export function oralOpening(face: THREE.Mesh, data: OralAmbientOcclusionData): number {
  const position = face.geometry.attributes.position, morphs = face.geometry.morphAttributes.position;
  const height = (vertex: number) => {
    const base = position.getY(vertex); let value = base;
    for (const [index, amount] of (face.morphTargetInfluences ?? []).entries()) if (amount)
      value += amount * (morphs[index].getY(vertex) - (face.geometry.morphTargetsRelative ? 0 : base));
    return value;
  };
  return data.openingPairs.reduce((sum, [upper, lower]) => sum + Math.max(0, height(upper) - height(lower)), 0) / data.openingPairs.length;
}

export function oralOpeningWeights(opening: number, knots: number[], output: THREE.Vector4): THREE.Vector4 {
  let lower = 0;
  while (lower < knots.length - 2 && opening > knots[lower + 1]) lower++;
  const t = THREE.MathUtils.smootherstep(opening, knots[lower], knots[lower + 1]);
  output.set(0, 0, 0, 0); output.setComponent(lower, 1 - t); output.setComponent(lower + 1, t);
  return output;
}

/** Dental ambient visibility and local mesh shadows follow the posed mouth. */
export function prepareOralAmbientOcclusion(root: THREE.Group, data: OralAmbientOcclusionData): MouthContactShadows {
  const face = root.getObjectByName(data.sourceMesh) as THREE.SkinnedMesh, weights = { value: new THREE.Vector4(1, 0, 0, 0) };
  const upper = { value: data.lightPairs.map(() => new THREE.Vector3()) }, lower = { value: data.lightPairs.map(() => new THREE.Vector3()) }, center = new THREE.Vector3();
  const shadows = new MouthContactShadows(face, data.contactShadows);
  root.traverse(object => {
    if (!(object instanceof THREE.SkinnedMesh) || !data.meshes.includes(object.name) || !object.geometry.hasAttribute(data.attribute)) return;
    const material = object.material as THREE.MeshStandardMaterial, compile = material.onBeforeCompile, key = material.customProgramCacheKey(), beforeRender = object.onBeforeRender;
    if (object.geometry.getAttribute(data.attribute).itemSize !== 4) throw new Error('Four dental ambient fields are required');
    const masked = data.maskedMeshes?.includes(object.name) ?? false;
    if (masked && !object.geometry.hasAttribute(data.maskAttribute!)) throw new Error('Oral tissue shadow mask is missing');
    object.onBeforeRender = function(renderer, scene, camera, geometry, material, group) {
      beforeRender.call(this, renderer, scene, camera, geometry, material, group);
      oralOpeningWeights(oralOpening(face, data), data.openingKnots, weights.value); center.set(0, 0, 0);
      data.lightPairs.forEach(([up, lo], i) => {
        oralPoint(face, up, upper.value[i]); oralPoint(face, lo, lower.value[i]); center.add(upper.value[i]).add(lower.value[i]);
      });
      center.divideScalar(data.lightPairs.length * 2); shadows.update(renderer, scene, camera, object, center);
    };
    material.onBeforeCompile = function(shader, renderer) {
      compile.call(this, shader, renderer); shader.uniforms.oralAmbientWeights = weights;
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 _oral_ao;\nvarying vec4 vOralAmbient;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvOralAmbient = _oral_ao;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec4 vOralAmbient;\nuniform vec4 oralAmbientWeights;')
        .replace('#include <aomap_fragment>', `#include <aomap_fragment>
          float oralAmbientVisibility = clamp(dot(vOralAmbient, oralAmbientWeights), 0.0, 1.0);
          reflectedLight.indirectDiffuse *= oralAmbientVisibility;
          #if defined(USE_ENVMAP) && defined(STANDARD)
            float oralDotNV = saturate(dot(geometryNormal, geometryViewDir));
            reflectedLight.indirectSpecular *= computeSpecularOcclusion(oralDotNV, oralAmbientVisibility, material.roughness);
          #endif
        `);
      if (masked) {
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute float _oral_tissue;\nvarying float vOralTissue;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvOralTissue = _oral_tissue;');
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vOralTissue;');
      }
      shadows.patch(shader, masked ? 'vOralTissue' : undefined);
    };
    material.customProgramCacheKey = () => key + '-oral-ambient-and-mesh-contact-visibility-v3' + (masked ? '-tissue-mask-v1' : ''); material.needsUpdate = true;
    Object.defineProperty(material.userData, 'oralAmbientOcclusion', {
      value: { weights, upper, lower, shadows, data }, configurable: true,
    });
  });
  return shadows;
}
