import * as THREE from 'three';

/** Blend a clear, zero-thickness eye surface without copying the opaque scene. */
export function prepareThinCornea(material: THREE.Material): void {
  if (!(material instanceof THREE.MeshPhysicalMaterial) || material.name !== 'Eyes cornea'
    || material.transmission !== 1 || material.thickness !== 0) return;
  const compile = material.onBeforeCompile, key = material.customProgramCacheKey();
  material.transmission = 0; material.transparent = true;
  material.depthWrite = false; material.premultipliedAlpha = true;
  // Diffuse lid visibility is not the visibility of an environment reflection.
  material.aoMap = null;
  material.onBeforeCompile = (shader, renderer) => {
    compile(shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace('vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;', `
      // The authored surface has no refraction distance. Keep the same
      // environment BRDF and composite its reflection over the opaque iris.
      vec3 corneaF = EnvironmentBRDF( geometryNormal, geometryViewDir,
        material.specularColor, material.specularF90, material.roughness );
      diffuseColor.a = clamp( dot( corneaF, vec3( 1.0 / 3.0 ) ), 0.0001, 1.0 );
      vec3 outgoingLight = totalSpecular + totalEmissiveRadiance;
    `).replace('#include <premultiplied_alpha_fragment>', `
      // Specular radiance already includes Fresnel. Dividing before tone mapping
      // and multiplying afterwards would compress bright reflections to alpha.
    `);
  };
  material.customProgramCacheKey = () => key + '-thin-cornea-v2';
  material.needsUpdate = true;
}
