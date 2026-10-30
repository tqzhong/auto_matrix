import * as THREE from 'three';

export interface EyeSocketVisibilityData {
  version: 1;
  head: string;
  bone: string;
  eyes: { mesh: string; upper: number[]; lower: number[] }[];
  upperWidth: number;
  lowerWidth: number;
  upperStrength: number;
  lowerStrength: number;
}

/** Soft eyelid-shadow estimate from the actual posed margin, in head bind space. */
export function prepareEyeSocketVisibility(root: THREE.Object3D, data?: EyeSocketVisibilityData): void {
  if (!data) return;
  const skin=root.getObjectByName(data.head) as THREE.SkinnedMesh;
  const joint=skin.skeleton.bones.findIndex(bone=>bone.name===data.bone),bone=skin.skeleton.bones[joint];
  for (const eyeData of data.eyes) {
    const eye=root.getObjectByName(eyeData.mesh) as THREE.SkinnedMesh;
    const material=eye.material as THREE.MeshStandardMaterial;
    const compile=material.onBeforeCompile,key=material.customProgramCacheKey(),beforeRender=eye.onBeforeRender;
    const bindToWorld=new THREE.Matrix4();
    const state={
      worldToSocket:{value:new THREE.Matrix4()},
      upper:{value:eyeData.upper.map(()=>new THREE.Vector3())},
      lower:{value:eyeData.lower.map(()=>new THREE.Vector3())},
      shape:{value:new THREE.Vector4(data.upperWidth,data.lowerWidth,data.upperStrength,data.lowerStrength)},
      originalStrength:[data.upperStrength,data.lowerStrength],
    };
    material.userData.eyeSocketVisibility=state;
    eye.onBeforeRender=function(renderer,scene,camera,geometry,renderMaterial,group){
      beforeRender.call(this,renderer,scene,camera,geometry,renderMaterial,group);
      bindToWorld.copy(skin.matrixWorld).multiply(skin.bindMatrixInverse).multiply(bone.matrixWorld)
        .multiply(skin.skeleton.boneInverses[joint]).multiply(skin.bindMatrix);
      state.worldToSocket.value.copy(bindToWorld).invert();
      for (const [rows,points] of [[eyeData.upper,state.upper.value],[eyeData.lower,state.lower.value]] as const) {
        for (let i=0;i<rows.length;i++) skin.getVertexPosition(rows[i],points[i])
          .applyMatrix4(skin.matrixWorld).applyMatrix4(state.worldToSocket.value);
      }
    };
    material.onBeforeCompile=function(shader,renderer){
      compile.call(this,shader,renderer);
      Object.assign(shader.uniforms,{
        eyeWorldToSocket:state.worldToSocket,
        eyeSocketUpper:state.upper,
        eyeSocketLower:state.lower,
        eyeSocketShadowShape:state.shape,
      });
      shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
        uniform mat4 eyeWorldToSocket;
        varying vec3 vEyeSocketPosition;`).replace('#include <skinning_vertex>',`#include <skinning_vertex>
        vEyeSocketPosition=(eyeWorldToSocket * modelMatrix * vec4(transformed,1.0)).xyz;`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
        varying vec3 vEyeSocketPosition;
        uniform vec3 eyeSocketUpper[9];
        uniform vec3 eyeSocketLower[9];
        uniform vec4 eyeSocketShadowShape;
        float socketSegmentDistance(vec3 point,vec3 a,vec3 b){
          vec3 edge=b-a;
          float amount=clamp(dot(point-a,edge)/max(dot(edge,edge),1e-12),0.0,1.0);
          return length(point-a-amount*edge);
        }
        float socketVisibility(vec3 point){
          float upperDistance=1e3,lowerDistance=1e3;
          for(int i=0;i<8;i++){
            upperDistance=min(upperDistance,socketSegmentDistance(point,eyeSocketUpper[i],eyeSocketUpper[i+1]));
            lowerDistance=min(lowerDistance,socketSegmentDistance(point,eyeSocketLower[i],eyeSocketLower[i+1]));
          }
          float upper=1.0-eyeSocketShadowShape.z*(1.0-smoothstep(0.0,eyeSocketShadowShape.x,upperDistance));
          float lower=1.0-eyeSocketShadowShape.w*(1.0-smoothstep(0.0,eyeSocketShadowShape.y,lowerDistance));
          return upper*lower;
        }`).replace('#include <aomap_fragment>',`#include <aomap_fragment>
        float eyeSocketVisibility=socketVisibility(vEyeSocketPosition);
        reflectedLight.directDiffuse *= eyeSocketVisibility;
        reflectedLight.indirectDiffuse *= eyeSocketVisibility;`);
    };
    material.customProgramCacheKey=()=>key+'-socket-visibility-v1';
    material.needsUpdate=true;
  }
}
