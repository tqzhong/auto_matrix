import { writeFile } from 'node:fs/promises';
import * as THREE from './release/node_modules/three/build/three.module.js';
import { model, crossings } from './release/output/characters/morpheus-upper-coat-2026-10-18/mesh-fixture.mjs';
import { advanceMotion, newMotion } from './release/packages/client/src/agents/CharacterMotion.js';
import { PLAYER_RUN_SPEED } from './release/packages/shared/dist/index.js';
const h = await model(), state = newMotion();
const input = { speed: PLAYER_RUN_SPEED, grounded: true, verticalVelocity: 0, turn: 0, ambushWardrobe: 'coat' as const };
for (let frame = -59; frame <= 12; frame++) h.models.animate(h.rig, advanceMotion(state, input, 1 / 60), state, input, 1 / 60);
h.rig.root.updateMatrixWorld(true);
const pelvis = h.rig.bones.get('pelvis')!, inverse = pelvis.matrixWorld.clone().invert();
const body = h.rig.root.getObjectByName('Tailored_trousers') as THREE.SkinnedMesh;
const all = Array.from({ length: body.geometry.attributes.position.count }, (_,id) => body.getVertexPosition(id,new THREE.Vector3()).applyMatrix4(body.matrixWorld).applyMatrix4(inverse));
const index = body.geometry.index!, edges = new Set<string>();
for(let i=0;i<index.count;i+=3)for(let j=0;j<3;j++){const a=index.getX(i+j),b=index.getX(i+(j+1)%3);edges.add(`${Math.min(a,b)},${Math.max(a,b)}`);}
const pairs = [...edges].map(key=>key.split(',').map(Number));
const diagnostics=[];
for(const [panel,{mesh}] of h.rig.panels.entries()){
 const position=mesh.geometry.attributes.position, local=mesh.matrixWorld.clone().invert().multiply(pelvis.matrixWorld);
 const corrections=new Float64Array(41);
 const pts=Array.from({length:position.count},(_,id)=>mesh.getVertexPosition(id,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse));
 for(let column=0;column<41;column++){
  const a=pts[column],b=pts[column+41],dx=b.x-a.x,dz=b.z-a.z,length2=dx*dx+dz*dz;
  const sections:number[][]=[], candidates:number[]=[];
  for(let face=0;face<index.count;face+=3){
   const cut:number[][]=[];
   for(let k=0;k<3;k++){
    const p=all[index.getX(face+k)],q=all[index.getX(face+(k+1)%3)],dp=(p.x-a.x)*dz-(p.z-a.z)*dx,dq=(q.x-a.x)*dz-(q.z-a.z)*dx;
    if(dp*dq>=0)continue;
    const point=p.clone().lerp(q,dp/(dp-dq)),t=((point.x-a.x)*dx+(point.z-a.z)*dz)/length2;cut.push([t,point.y]);
   }
   if(cut.length!==2)continue;
   cut.sort((p,q)=>p[0]-q[0]);
   if(cut[1][0]<=0||cut[0][0]>=1)continue;
   const [p,q]=cut;
   const y=(t:number)=>p[1]+(q[1]-p[1])*(t-p[0])/(q[0]-p[0]);
   const first=Math.max(0,p[0]),last=Math.min(1,q[0]),section=[first,y(first),last,y(last)];sections.push(section);
   for(const [t,py]of [[first,section[1]],[last,section[3]]])if(t>1e-6){const end=a.y+(py+.004-a.y)/t;if(end>b.y)candidates.push(end);}
  }
  const blocked=(end:number)=>sections.some(([t0,y0,t1,y1])=>(y0-a.y-(end-a.y)*t0)*(y1-a.y-(end-a.y)*t1)<0);
  let required=b.y,limiting:any;
  if(blocked(required)){
   candidates.sort((p,q)=>p-q);
   const next=candidates.at(-1);
   if(next!==undefined){required=next;limiting={candidate:next,sections:sections.length};}
  }
  if(required>b.y){diagnostics.push({panel,column,shift:required-b.y,old:b.y,required,anchor:a.toArray(),limiting}); corrections[column]=required-b.y;}
 }
 for(let column=0;column<41;column++){
  const shift=Math.max(...[column-1,column,column+1].filter(i=>i>=0&&i<41).map(i=>corrections[i]));
  const point=pts[column+41];point.y+=shift;position.setXYZ(column+41,...point.clone().applyMatrix4(local).toArray());
 }
 mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();mesh.geometry.computeVertexNormals();
}
function faces(mesh:THREE.Mesh){
 if((mesh as THREE.SkinnedMesh).isSkinnedMesh)(mesh as THREE.SkinnedMesh).skeleton.update();
 const corrections=new Float64Array(41);
 const pts=Array.from({length:mesh.geometry.attributes.position.count},(_,i)=>mesh.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld));
 const index=mesh.geometry.index!;
 return Array.from({length:index.count/3},(_,face)=>{const ids=[0,1,2].map(k=>index.getX(face*3+k)),points=ids.map(i=>pts[i]);return{face,ids,points,box:new THREE.Box3().setFromPoints(points)};});
}
const contacts=[];
for(const [panel,{mesh}]of h.rig.panels.entries())h.rig.root.traverseVisible(object=>{if(!(object as THREE.Mesh).isMesh||h.rig.panels.some(p=>p.mesh===object))return;const result=crossings(faces(mesh),faces(object as THREE.Mesh),false);if(result.count)contacts.push({panel,mesh:object.name,...result});});
const result={maximumShift:Math.max(...diagnostics.map(d=>d.shift)),diagnostics,contacts};await writeFile('tangent-run12.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));h.models.dispose();
