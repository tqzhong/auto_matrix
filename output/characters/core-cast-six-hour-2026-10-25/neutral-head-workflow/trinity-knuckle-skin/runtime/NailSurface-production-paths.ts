import * as THREE from 'three';

// Authored weights follow the existing continuous skin through hand posing.
export function applyNailSurface(material: THREE.MeshStandardMaterial, handSurface = false): void {
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
  if (handSurface) {
    const nailCompile = material.onBeforeCompile;
    material.onBeforeCompile = function (shader, renderer) {
      nailCompile.call(this, shader, renderer);
      shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
        attribute vec4 _hand_surface;
        attribute vec4 _hand_fold;
        varying vec4 vHandSurface;
        varying vec4 vHandFold;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vHandSurface = _hand_surface;
          vHandFold = _hand_fold;`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
        varying vec4 vHandSurface;
        varying vec4 vHandFold;
        float handBand(float distance, float width) {
          float filteredWidth = max(width, fwidth(distance) * 0.85);
          return exp(-distance * distance / (filteredWidth * filteredWidth)) * width / filteredWidth;
        }
        float handSurfaceHeight() {
          float dorsal = smoothstep(0.12, 0.78, vHandSurface.z);
          float palmar = smoothstep(0.12, 0.78, -vHandSurface.z);
          float arch = 0.0012 * vHandFold.z * vHandFold.z;
          float pip = vHandFold.x + arch;
          float dip = vHandFold.y + arch * 0.65;
          float dorsalFolds = -0.00020 * handBand(pip, 0.0022)
            -0.00009 * handBand(pip + 0.0055, 0.0014)
            -0.00007 * handBand(pip - 0.0040, 0.0012)
            -0.00013 * handBand(dip, 0.0017);
          float palmarFolds = -0.00025 * handBand(pip, 0.0017)
            -0.00008 * handBand(pip + 0.0040, 0.0013)
            -0.00021 * handBand(dip, 0.0015);
          float palmArea = (1.0 - vHandFold.w) * palmar;
          float transverse = handBand(vHandSurface.x - 0.82 - 0.10 * vHandSurface.y + 0.10 * vHandSurface.y * vHandSurface.y, 0.010);
          float proximal = handBand(vHandSurface.x - 0.53 - 0.15 * vHandSurface.y - 0.09 * vHandSurface.y * vHandSurface.y, 0.009);
          float thumbFold = handBand(vHandSurface.y - 0.34 - 0.90 * (vHandSurface.x - 0.45) * (vHandSurface.x - 0.45), 0.018)
            * smoothstep(0.12, 0.26, vHandSurface.x) * (1.0 - smoothstep(0.72, 0.86, vHandSurface.x));
          float poreFilter = 1.0 - smoothstep(0.0010, 0.0030, max(fwidth(vHandSurface.x), fwidth(vHandSurface.y)));
          float pores = 0.000006 * sin(vHandSurface.x * 2741.0 + sin(vHandSurface.y * 879.0))
            * sin(vHandSurface.y * 2617.0) * poreFilter;
          return ((dorsalFolds * dorsal + palmarFolds * palmar) * vHandFold.w
            -palmArea * (0.00013 * transverse + 0.00010 * proximal + 0.00008 * thumbFold)
            + pores) * vHandSurface.w;
        }
        vec3 handSurfaceNormal(vec3 position, vec3 surfaceNormal, float height, float faceDirection) {
          vec3 dx = dFdx(position), dy = dFdy(position);
          vec3 r1 = cross(dy, surfaceNormal), r2 = cross(surfaceNormal, dx);
          float determinant = dot(dx, r1) * faceDirection;
          vec3 gradient = sign(determinant) * (dFdx(height) * r1 + dFdy(height) * r2);
          return normalize(max(abs(determinant), 1e-20) * surfaceNormal - gradient);
        }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          float handMask = vHandSurface.w * (1.0 - smoothstep(0.12, 0.88, vNailDetail.x));
          float palmTone = smoothstep(0.10, 0.80, -vHandSurface.z);
          vec3 handColour = diffuseColor.rgb * mix(vec3(1.0), vec3(1.035, 0.995, 0.990), palmTone);
          diffuseColor.rgb = mix(diffuseColor.rgb, handColour, handMask);`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          roughnessFactor = mix(roughnessFactor, mix(0.57, 0.68, palmTone), handMask);`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          vec3 retainedHandNormal = normal;
          normal = handSurfaceNormal(-vViewPosition, normal, handSurfaceHeight(), faceDirection);
          normal = mix(retainedHandNormal, normal, handMask);`);
    };
    material.customProgramCacheKey = () => key + '|natural-nail-surface-v1|authored-hand-surface-v1';
  }
  material.needsUpdate = true;
}
