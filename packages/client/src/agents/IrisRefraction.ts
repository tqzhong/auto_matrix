import * as THREE from 'three';

export interface IrisRefractionEye {
  mesh: string;
  bone: string;
  texture: number;
  planePoint: [number, number, number];
  planeNormal: [number, number, number];
  planeRight: [number, number, number];
  planeUp: [number, number, number];
  lookupExtent: number;
  ior: number;
  irisPigment?: { center: [number, number]; pupil: [number, number]; limbus: [number, number]; gain: number };
}
export interface IrisRefractionData { version: 1; eyes: IrisRefractionEye[] }

// Refract into the authored iris plane, using its original triangulated atlas.
// The opaque substrate shares the corneal envelope; a separate thin surface
// supplies reflection without a full-scene transmission pass.
export function prepareIrisRefraction(mesh: THREE.SkinnedMesh, data: IrisRefractionEye, lookup: THREE.Texture): void {
  const material=mesh.material as THREE.MeshStandardMaterial,compile=material.onBeforeCompile,key=material.customProgramCacheKey();
  const cameraBind={value:new THREE.Vector3()},normal=new THREE.Vector3().fromArray(data.planeNormal),point=new THREE.Vector3().fromArray(data.planePoint);
  const bindToWorld=new THREE.Matrix4(),worldToBind=new THREE.Matrix4(),boneIndex=mesh.skeleton.bones.findIndex(b=>b.name===data.bone),bone=mesh.skeleton.bones[boneIndex];
  const beforeRender=mesh.onBeforeRender;
  mesh.onBeforeRender=function(renderer,scene,camera,geometry,material,group){
    beforeRender.call(this,renderer,scene,camera,geometry,material,group);
    bindToWorld.copy(mesh.matrixWorld).multiply(mesh.bindMatrixInverse).multiply(bone.matrixWorld).multiply(mesh.skeleton.boneInverses[boneIndex]).multiply(mesh.bindMatrix);
    worldToBind.copy(bindToWorld).invert();cameraBind.value.setFromMatrixPosition(camera.matrixWorld).applyMatrix4(worldToBind);
  };
  material.onBeforeCompile=function(shader,renderer){
    compile.call(this,shader,renderer);
    Object.assign(shader.uniforms,{eyeCameraBind:cameraBind,eyePlanePoint:{value:point},eyePlaneNormal:{value:normal},eyePlaneRight:{value:new THREE.Vector3().fromArray(data.planeRight)},eyePlaneUp:{value:new THREE.Vector3().fromArray(data.planeUp)},eyeLookup:{value:lookup},eyeLookupExtent:{value:data.lookupExtent},eyeRefractionIor:{value:data.ior},eyeMapTransform:{value:material.map!.matrix}});
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
      attribute float _eye_lens;
      attribute vec3 _eye_cornea_normal;
      varying float vEyeLens;
      varying vec3 vEyeBindPosition;
      varying vec3 vEyeCorneaNormal;`).replace('#include <begin_vertex>',`#include <begin_vertex>
      vEyeLens=_eye_lens;vEyeBindPosition=position;vEyeCorneaNormal=_eye_cornea_normal;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      varying float vEyeLens;
      varying vec3 vEyeBindPosition;
      varying vec3 vEyeCorneaNormal;
      uniform vec3 eyeCameraBind;
      uniform vec3 eyePlanePoint;
      uniform vec3 eyePlaneNormal;
      uniform vec3 eyePlaneRight;
      uniform vec3 eyePlaneUp;
      uniform sampler2D eyeLookup;
      uniform float eyeLookupExtent;
      uniform float eyeRefractionIor;
      uniform mat3 eyeMapTransform;`).replace('#include <map_fragment>',`
      #ifdef USE_MAP
        vec2 eyeUv=vMapUv;
        vec3 eyeView=normalize(eyeCameraBind-vEyeBindPosition);
        vec3 eyeRay=refract(-eyeView,normalize(vEyeCorneaNormal),1.0/eyeRefractionIor);
        float eyeDenominator=dot(eyeRay,eyePlaneNormal);
        if(vEyeLens>0.001 && eyeDenominator< -0.00001){
          float eyeDistance=dot(eyePlanePoint-vEyeBindPosition,eyePlaneNormal)/eyeDenominator;
          vec3 eyeHit=vEyeBindPosition+max(eyeDistance,0.0)*eyeRay-eyePlanePoint;
          vec2 eyeLookupUv=vec2(dot(eyeHit,eyePlaneRight),dot(eyeHit,eyePlaneUp))/(2.0*eyeLookupExtent)+0.5;
          if(eyeDistance>=0.0 && all(greaterThanEqual(eyeLookupUv,vec2(0.0))) && all(lessThanEqual(eyeLookupUv,vec2(1.0)))){
            vec4 eyePacked=texture2D(eyeLookup,eyeLookupUv);
            vec2 eyeSourceUv=vec2(dot(eyePacked.rg,vec2(65280.0,255.0)),dot(eyePacked.ba,vec2(65280.0,255.0)))/65535.0;
            if(eyeSourceUv.x+eyeSourceUv.y>0.02) eyeUv=mix(eyeUv,(eyeMapTransform*vec3(eyeSourceUv,1.0)).xy,smoothstep(0.0,1.0,vEyeLens));
          }
        }
        vec4 sampledDiffuseColor=texture2D(map,eyeUv);
        diffuseColor*=sampledDiffuseColor;
      #endif
    `);
    if(data.irisPigment){
      const pigment=data.irisPigment;
      Object.assign(shader.uniforms,{eyeIrisPigmentCenter:{value:new THREE.Vector2().fromArray(pigment.center)},eyeIrisPigmentRanges:{value:new THREE.Vector4(...pigment.pupil,...pigment.limbus)},eyeIrisPigmentGain:{value:pigment.gain}});
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
        uniform vec2 eyeIrisPigmentCenter;
        uniform vec4 eyeIrisPigmentRanges;
        uniform float eyeIrisPigmentGain;`).replace('diffuseColor*=sampledDiffuseColor;',`
        float eyeIrisRadius=distance(eyeUv,eyeIrisPigmentCenter);
        float eyeIrisTissue=smoothstep(eyeIrisPigmentRanges.x,eyeIrisPigmentRanges.y,eyeIrisRadius)
          *(1.0-smoothstep(eyeIrisPigmentRanges.z,eyeIrisPigmentRanges.w,eyeIrisRadius));
        sampledDiffuseColor.rgb*=mix(1.0,eyeIrisPigmentGain,eyeIrisTissue);
        diffuseColor*=sampledDiffuseColor;
      `);
    }
  };
  material.customProgramCacheKey=()=>key+'-local-iris-refraction-v1'+(data.irisPigment?'-iris-pigment-v1':'');material.needsUpdate=true;
}
