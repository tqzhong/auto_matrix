import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { HeroModels } from '../packages/client/src/agents/HeroModel.js';
import { advanceMotion, newMotion } from '../packages/client/src/agents/CharacterMotion.js';
import { prepareIrisRefraction, type IrisRefractionEye } from '../packages/client/src/agents/IrisRefraction.js';

const data: IrisRefractionEye = { mesh: 'test-optical-eye', bone: 'head', texture: 3,
  planePoint: [0,0,.02], planeNormal: [0,0,1], planeRight: [1,0,0], planeUp: [0,1,0], lookupExtent: .04, ior: 1.4 };
function opticalMesh(bone: THREE.Bone) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,.03,0,0,0,.03,0,0,0,.03],3));
  g.setAttribute('normal',new THREE.Float32BufferAttribute([0,0,1,0,0,1,0,0,1,0,0,1],3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute([.2,.7,.3,.7,.2,.8,.3,.8],2));
  g.setAttribute('_eye_lens',new THREE.Float32BufferAttribute([1,1,1,1],1));
  g.setAttribute('_eye_cornea_normal',g.attributes.normal.clone());
  g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(new Uint16Array(16),4));
  g.setAttribute('skinWeight',new THREE.Float32BufferAttribute([1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],4));
  g.setIndex([0,1,2,0,3,1]);
  const m = new THREE.MeshPhysicalMaterial({ map: new THREE.Texture(), specularIntensity: 0 }); m.name = 'Eyes';
  const mesh = new THREE.SkinnedMesh(g,m); mesh.name = data.mesh;
  mesh.bind(new THREE.Skeleton([bone])); return mesh;
}
function compile(mesh: THREE.SkinnedMesh) {
  const shader = { uniforms: THREE.UniformsUtils.clone(THREE.ShaderLib.physical.uniforms), vertexShader: THREE.ShaderLib.physical.vertexShader, fragmentShader: THREE.ShaderLib.physical.fragmentShader };
  (mesh.material as THREE.Material).onBeforeCompile(shader,{} as THREE.WebGLRenderer); return shader;
}
function beforeDraw(mesh: THREE.SkinnedMesh,camera: THREE.Camera) {
  mesh.onBeforeRender({} as THREE.WebGLRenderer,new THREE.Scene(),camera,mesh.geometry,mesh.material as THREE.Material,{} as never);
}

test('the eye camera follows actual rigid skinning through head/gaze, root scale and each view', () => {
  const root = new THREE.Group(),bone = new THREE.Bone();bone.name = 'head';root.add(bone);root.updateMatrixWorld(true);
  const mesh = opticalMesh(bone);root.add(mesh); const texture = new THREE.Texture();prepareIrisRefraction(mesh,data,texture);const shader = compile(mesh);
  const camera = new THREE.PerspectiveCamera(),positions = mesh.geometry.attributes.position.array.slice();
  for(const yaw of [-.6,0,.6])for(const view of [-1.3,0,1.3]){
    root.position.set(.4,-.2,.7);root.rotation.set(.1,.2,-.1);root.scale.set(.8,1.1,.9);bone.position.set(.03,.2,.1);bone.rotation.set(.2,yaw,-.1);root.updateMatrixWorld(true);mesh.skeleton.update();
    camera.position.set(Math.sin(view)*2,.6,Math.cos(view)*2);camera.updateMatrixWorld(true);beforeDraw(mesh,camera);
    // Build an independent affine frame from Three's CPU-skinned vertices.
    const points=[0,1,2,3].map(i=>mesh.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld)),origin=points[0];
    const basis=new THREE.Matrix4().makeBasis(points[1].clone().sub(origin).divideScalar(.03),points[2].clone().sub(origin).divideScalar(.03),points[3].clone().sub(origin).divideScalar(.03)).setPosition(origin);
    const expected=camera.position.clone().applyMatrix4(basis.invert());assert.ok(shader.uniforms.eyeCameraBind.value.distanceTo(expected)<1e-6);
  }
  assert.deepEqual(mesh.geometry.attributes.position.array,positions,'view-dependent optics must not move the shared geometry');
  assert.equal((mesh.material as THREE.MeshPhysicalMaterial).transmission,0,'local iris sampling does not allocate a scene transmission pass');
  (mesh.material as THREE.Material).dispose();mesh.geometry.dispose();texture.dispose();
});

test('local refraction composes with the existing material shader and retains the original eye atlas', () => {
  const bone=new THREE.Bone();bone.name='head';bone.updateMatrixWorld();const mesh=opticalMesh(bone),material=mesh.material as THREE.MeshPhysicalMaterial,atlas=material.map,old={value:.4},lookup=new THREE.Texture();
  material.onBeforeCompile=shader=>{shader.uniforms.priorEye=old;shader.fragmentShader+='\n// original eye response';};material.customProgramCacheKey=()=> 'original-eye';
  prepareIrisRefraction(mesh,data,lookup);const shader=compile(mesh);assert.equal(shader.uniforms.priorEye,old);assert.equal(shader.uniforms.eyeLookup.value,lookup);assert.equal(material.map,atlas);assert.match(shader.fragmentShader,/original eye response/);assert.equal(material.customProgramCacheKey(),'original-eye-local-iris-refraction-v1');
  material.dispose();mesh.geometry.dispose();lookup.dispose();atlas!.dispose();
});

test('optional iris pigment responses stay independent between eyes without replacing their atlas or geometry', () => {
  const bone=new THREE.Bone();bone.name='head';bone.updateMatrixWorld();
  const meshes=[opticalMesh(bone),opticalMesh(bone)],lookup=new THREE.Texture();
  const pigments=[{center:[.293,.706] as [number,number],pupil:[.037,.049] as [number,number],limbus:[.103,.117] as [number,number],gain:4},
    {center:[.706,.297] as [number,number],pupil:[.035,.047] as [number,number],limbus:[.101,.115] as [number,number],gain:2}];
  const atlases=meshes.map(mesh=>(mesh.material as THREE.MeshPhysicalMaterial).map),positions=meshes.map(mesh=>mesh.geometry.attributes.position.array.slice());
  meshes.forEach((mesh,i)=>prepareIrisRefraction(mesh,{...data,irisPigment:pigments[i]},lookup));
  const shaders=meshes.map(compile);
  shaders.forEach((shader,i)=>{
    assert.deepEqual(shader.uniforms.eyeIrisPigmentCenter.value.toArray(),pigments[i].center);
    assert.deepEqual(shader.uniforms.eyeIrisPigmentRanges.value.toArray(),[...pigments[i].pupil,...pigments[i].limbus]);
    assert.equal(shader.uniforms.eyeIrisPigmentGain.value,pigments[i].gain);
    assert.equal((meshes[i].material as THREE.MeshPhysicalMaterial).map,atlases[i]);
    assert.deepEqual(meshes[i].geometry.attributes.position.array,positions[i]);
  });
  assert.equal((meshes[0].material as THREE.Material).customProgramCacheKey(),(meshes[1].material as THREE.Material).customProgramCacheKey(),'different eye values share a uniform-based shader, not different hard-coded GLSL');
  shaders[0].uniforms.eyeIrisPigmentCenter.value.set(0,0);shaders[0].uniforms.eyeIrisPigmentGain.value=1;
  assert.deepEqual(shaders[1].uniforms.eyeIrisPigmentCenter.value.toArray(),pigments[1].center);
  assert.equal(shaders[1].uniforms.eyeIrisPigmentGain.value,2);
  meshes.forEach(mesh=>{(mesh.material as THREE.Material).dispose();mesh.geometry.dispose();});lookup.dispose();atlases.forEach(map=>map!.dispose());
});

async function heroFixture(getLookup: () => Promise<THREE.Texture>) {
  const bytes=await readFile(new URL('../packages/client/public/assets/characters/smith.glb',import.meta.url)),n=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+n).toString());
  for(const m of doc.materials){delete m.pbrMetallicRoughness.baseColorTexture;delete m.normalTexture;}doc.images=[];doc.textures=[];
  const json=Buffer.from(JSON.stringify(doc)),padded=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(padded);const bin=bytes.subarray(20+n),out=Buffer.alloc(20+padded.length+bin.length);out.writeUInt32LE(0x46546c67);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(padded.length,12);out.writeUInt32LE(0x4e4f534a,16);padded.copy(out,20);bin.copy(out,20+padded.length);
  const asset=await new GLTFLoader().parseAsync(out.buffer.slice(out.byteOffset,out.byteOffset+out.byteLength),'');
  const bone=asset.scene.getObjectByName('head') as THREE.Bone,mesh=opticalMesh(bone),donor=asset.scene.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  const headIndex=donor.skeleton.bones.indexOf(bone);for(let i=0;i<4;i++)mesh.geometry.attributes.skinIndex.setX(i,headIndex);mesh.bind(donor.skeleton,donor.bindMatrix.clone());asset.scene.add(mesh);asset.scene.updateMatrixWorld(true);asset.parser.json.extras.irisRefraction={version:1,eyes:[data]};
  asset.parser.getDependency=async(kind:string,index:number)=>{assert.equal(kind,'texture');assert.equal(index,data.texture);return getLookup();};
  const models=new HeroModels(new THREE.Texture(),new THREE.Texture());models['load']=async()=>asset;return{models,asset,source:mesh};
}

test('actual HeroModels clones keep independent optical cameras and restore eye hiding', async t => {
  const lookup=new THREE.Texture(),h=await heroFixture(async()=>lookup);t.after(()=>h.models.dispose());const a=(await h.models.create('smith'))!,b=(await h.models.create('smith'))!;
  const meshes=[a,b].map(r=>r.root.getObjectByName(data.mesh)as THREE.SkinnedMesh),shaders=meshes.map(compile);assert.notEqual(shaders[0].uniforms.eyeCameraBind,shaders[1].uniforms.eyeCameraBind);assert.notEqual(meshes[0].material,meshes[1].material);assert.equal(shaders[0].uniforms.eyeLookup.value,lookup);
  a.root.position.x=1;b.root.position.x=-2;for(const r of[a,b])r.root.updateMatrixWorld(true);const camera=new THREE.PerspectiveCamera();camera.position.set(0,3,2);camera.updateMatrixWorld(true);beforeDraw(meshes[0],camera);const first=shaders[0].uniforms.eyeCameraBind.value.clone();beforeDraw(meshes[1],camera);assert.deepEqual(shaders[0].uniforms.eyeCameraBind.value,first);assert.notDeepEqual(shaders[1].uniforms.eyeCameraBind.value,first);
  const state=newMotion();for(const firstPerson of[false,true,false]){const input={speed:0,grounded:true,verticalVelocity:0,turn:0,firstPerson,armed:true,weaponStyle:'hel_pistol'};h.models.animate(a,advanceMotion(state,input,0),state,input,0);assert.equal(meshes[0].visible,!firstPerson);}
  assert.equal((h.source.material as THREE.Material).onBeforeCompile,THREE.Material.prototype.onBeforeCompile,'instance shaders must not alter the cached GLTF material');
});

test('an optical lookup arriving after disposal is released and never returns a live rig', async t => {
  let complete!:(texture:THREE.Texture)=>void,requested!:()=>void;const requestedPromise=new Promise<void>(resolve=>{requested=resolve;}),pending=new Promise<THREE.Texture>(resolve=>{complete=resolve;});
  const h=await heroFixture(()=>{requested();return pending;}),lookup=new THREE.Texture();let disposed=0;lookup.addEventListener('dispose',()=>disposed++);t.after(()=>h.models.dispose());const creating=h.models.create('smith');await requestedPromise;h.models.dispose();complete(lookup);assert.equal(await creating,undefined);assert.equal(disposed,1);
});
