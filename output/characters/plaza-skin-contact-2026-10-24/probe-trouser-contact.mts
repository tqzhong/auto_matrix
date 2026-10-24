import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { crossings } from '../../../tests/helpers/hand-self-contact.mts';

for (const sex of ['male']) {
  const bytes = await readFile(`${process.argv[2]}/plaza-crowd-${sex}.glb`);
  const length = bytes.readUInt32LE(12), doc = JSON.parse(bytes.subarray(20, 20 + length).toString());
  for (const material of doc.materials) delete material.pbrMetallicRoughness.baseColorTexture;
  doc.images = []; doc.textures = [];
  const json = Buffer.from(JSON.stringify(doc)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = bytes.subarray(20 + length), result = Buffer.alloc(20 + padded.length + bin.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); bin.copy(result, 20 + padded.length);
  const asset = await new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
  const meshes: THREE.Mesh[] = [];asset.scene.traverse(o => { if (o instanceof THREE.Mesh) meshes.push(o); });
  const skin = meshes.find(o=>/skin/i.test(o.name))!, suit=meshes.find(o=>/trousers/i.test(o.name))!;
  function faces(mesh: THREE.Mesh) {
    const index=mesh.geometry.index!, vertices=Array.from({length:mesh.geometry.attributes.position.count},(_,i)=>mesh.getVertexPosition(i,new THREE.Vector3()));
    return Array.from({length:index.count/3},(_,face)=>{const ids=[0,1,2].map(k=>index.getX(face*3+k)),points=ids.map(i=>vertices[i]);return {face,ids,points,box:new THREE.Box3().setFromPoints(points)};});
  }
  for (const phase of [.125]) {
    for (const mesh of meshes) {mesh.morphTargetInfluences!.fill(0);if(phase>=0) {const f=phase*20;mesh.morphTargetInfluences![Math.floor(f)]=1-f%1;mesh.morphTargetInfluences![(Math.floor(f)+1)%20]=f%1;}}
    const a=faces(skin),b=faces(suit),contact=crossings(a,b,false);
    const hands=crossings(a.filter(face=>face.box.max.y<2.7),b,false);
    const handFaces=a.filter(face=>face.box.max.y<2.7),self=crossings(handFaces,handFaces);
    console.log(JSON.stringify({sex,phase,...contact,hands:hands.count,handSelf:self.count,handPoints:hands.examples.map(hit=>({skin:a[hit.first].points.map(p=>p.toArray()),cloth:b[hit.second].points.map(p=>p.toArray())})),points:contact.examples.map(hit=>({skin:a[hit.first].points.map(p=>p.toArray()),cloth:b[hit.second].points.map(p=>p.toArray())}))}));
  }
}
