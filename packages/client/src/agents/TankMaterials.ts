import * as THREE from 'three';

/** Materials for the authored operator mesh; its reference stays out of other actors. */
export function prepareTankMaterials(root: THREE.Group): THREE.Texture[] {
  const size = 128, pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const value = 128 + 58 * Math.cos(x * Math.PI / 4) + 12 * Math.sin(y * Math.PI / 2 + x * .7);
    const i = (y * size + x) * 4; pixels[i] = pixels[i + 1] = pixels[i + 2] = value; pixels[i + 3] = 255;
  }
  const rib = new THREE.DataTexture(pixels, size, size); rib.wrapS = rib.wrapT = THREE.RepeatWrapping;
  rib.magFilter = THREE.LinearFilter; rib.minFilter = THREE.LinearMipmapLinearFilter; rib.generateMipmaps = true;
  rib.repeat.set(5, 5); rib.needsUpdate = true;
  const body = (root.getObjectByName('Anatomical_head_and_hands') as THREE.Mesh).material as THREE.MeshStandardMaterial;
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const material = object.material as THREE.MeshStandardMaterial;
    if (material.name === 'Tank ribbed cotton' || material.name === 'Tank knitted mitts') { material.bumpMap = rib; material.bumpScale = .002; }
    if (material.name === 'Tank short curls') {
      material.onBeforeCompile = shader => {
        shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
          varying vec3 vTankHairPoint; varying vec3 vTankHairNormal;`)
          .replace('#include <begin_vertex>', `#include <begin_vertex>
            vTankHairPoint = position; vTankHairNormal = normal;`);
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
          varying vec3 vTankHairPoint; varying vec3 vTankHairNormal;`)
          .replace('#include <map_pars_fragment>', `#include <map_pars_fragment>
          vec3 tankCurl(vec2 plane) {
            vec2 tile = abs(fract(plane * 5.0) * 2.0 - 1.0);
            return texture2D(map, (vec2(190.0, 150.0) + tile * vec2(235.0, 90.0)) / 1254.0).rgb;
          }`)
          .replace('#include <map_fragment>', `
            vec3 blend = pow(abs(vTankHairNormal), vec3(4.0)); blend /= max(dot(blend, vec3(1.0)), .0001);
            diffuseColor.rgb *= tankCurl(vTankHairPoint.yz) * blend.x
              + tankCurl(vTankHairPoint.xz) * blend.y + tankCurl(vTankHairPoint.xy) * blend.z;`);
      };
      material.customProgramCacheKey = () => 'tank-short-curls-v2';
    }
    if (material.name !== 'Tank face') return;
    material.onBeforeCompile = shader => {
      shader.uniforms.tankBodyMap = { value: body.map }; shader.uniforms.tankBodyColor = { value: body.color };
      shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
        #ifndef USE_UV1
          attribute vec2 uv1;
        #endif
        attribute float _face_weight; attribute vec2 _body_uv; attribute float _neck_fade; attribute float _ear_surface;
        varying vec2 vTankProfile; varying float vTankFace; varying vec3 vTankNormal; varying vec2 vTankBody; varying float vTankNeck; varying float vTankEar;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vTankProfile = uv1; vTankFace = _face_weight; vTankNormal = normal; vTankBody = _body_uv; vTankNeck = _neck_fade; vTankEar = _ear_surface;`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
        uniform sampler2D tankBodyMap; uniform vec3 tankBodyColor;
        varying vec2 vTankProfile; varying float vTankFace; varying vec3 vTankNormal; varying vec2 vTankBody; varying float vTankNeck; varying float vTankEar;`)
        .replace('#include <map_fragment>', `#include <map_fragment>
          vec3 bodySkin = texture2D(tankBodyMap, vTankBody).rgb * tankBodyColor;
          vec3 profile = texture2D(map, vTankProfile).rgb;
          vec2 photo = vTankProfile * 1254.0;
          float earPhoto = 1.0 - smoothstep(.7, 1.2, length((photo - vec2(1070.0, 550.0)) / vec2(70.0, 100.0)));
          float eyePhoto = 1.0 - smoothstep(.7, 1.3, length((photo - vec2(760.0, 470.0)) / vec2(110.0, 95.0)));
          float mouthPhoto = 1.0 - smoothstep(.7, 1.3, length((photo - vec2(700.0, 745.0)) / vec2(95.0, 70.0)));
          float nosePhoto = 1.0 - smoothstep(.7, 1.3, length((photo - vec2(675.0, 625.0)) / vec2(70.0, 55.0)));
          vec3 cheek = texture2D(map, vec2(960.0, 660.0) / 1254.0).rgb;
          profile = mix(profile, cheek, max(earPhoto * (1.0 - vTankEar), max(eyePhoto, max(mouthPhoto, nosePhoto))));
          float skin = smoothstep(0.025, 0.075, profile.r - profile.b);
          float side = smoothstep(0.20, 0.65, abs(vTankNormal.x));
          float behindEar = smoothstep(1030.0, 1135.0, photo.x) * (1.0 - vTankEar);
          float front = smoothstep(0.0, 1.0, vTankFace);
          diffuseColor.rgb = mix(mix(bodySkin, profile, side * skin * (1.0 - behindEar)), diffuseColor.rgb, front);
          diffuseColor.rgb = mix(bodySkin, diffuseColor.rgb, smoothstep(0.0, 1.0, vTankNeck));`);
    };
    material.customProgramCacheKey = () => 'tank-registered-face-v2';
  });
  return [rib];
}
