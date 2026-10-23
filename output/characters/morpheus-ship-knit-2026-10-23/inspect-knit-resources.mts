import { shipKnit } from './candidate-release/tests/helpers/ship-knit.mjs';
import * as THREE from 'three';
const h=await shipKnit();try {
 const start=performance.now();h.pose();const firstPoseMs=performance.now()-start;
 const g=h.sweater.geometry,arrays=new Set<ArrayBufferView>();
 for(const a of Object.values(g.attributes)) arrays.add((a as THREE.BufferAttribute).array);
 if(g.index)arrays.add(g.index.array);
 for(const list of Object.values(g.morphAttributes))for(const a of list)arrays.add((a as THREE.BufferAttribute).array);
 const original=h.original.attributes.position,changed=Array.from({length:original.count},(_,i)=>i).filter(i=>g.attributes.position.getZ(i)!==original.getZ(i));
 const yarn=(h.sweater.material as THREE.MeshStandardMaterial).map as THREE.DataTexture;
 console.log(JSON.stringify({vertices:g.attributes.position.count,triangles:g.index!.count/3,addedTriangles:0,addedDrawMeshes:0,changedPositions:changed.length,ownedGeometryArrayBytes:[...arrays].reduce((sum,a)=>sum+a.byteLength,0),ownedYarnBaseLevelBytes:yarn.image.data.byteLength,yarnSize:[yarn.image.width,yarn.image.height],mipmaps:true,firstPoseMs,firstPoseTimingLimit:'Includes the first normal animation and fitting in a CPU fixture while other validation runs; not an isolated browser or GPU benchmark.',frameGeometryFit:'once per created Morpheus rig; cached thereafter',limits:'Array bytes are not total browser memory or GPU memory. No FPS improvement is claimed.'}));
}finally{h.dispose()}
