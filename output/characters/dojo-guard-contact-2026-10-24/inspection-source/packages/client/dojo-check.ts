import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { HeroModels } from './src/agents/HeroModel.js';
import { advanceMotion, newMotion } from './src/agents/CharacterMotion.js';
import { MELEE_COMBO } from '@auto_matrix/shared';
const renderer = new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(1);renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;document.body.append(renderer.domElement);
const scene = new THREE.Scene();scene.background=new THREE.Color('#26312c');scene.add(new THREE.HemisphereLight(0xdcecf5,0x6c715e,2.2));const light = new THREE.DirectionalLight(0xffeddb,3);light.position.set(-4,8,6);scene.add(light);const rim=new THREE.DirectionalLight(0xbfdcd5,1.5);rim.position.set(4,4,-4);scene.add(rim);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:0x6d7160,roughness:1}));floor.rotation.x=-Math.PI/2;scene.add(floor);
const camera=new THREE.PerspectiveCamera(38,innerWidth/innerHeight,.05,200);camera.position.set(0,3.4,11);const orbit=new OrbitControls(camera,renderer.domElement);orbit.target.set(0,2.3,0);orbit.update();
const texture=new THREE.DataTexture(new Uint8Array([128,128,128,255]),1,1);texture.needsUpdate=true;
const models=new HeroModels(texture,texture);const ids=['neo','morpheus'] as const;const rigs=await Promise.all(ids.map(id=>models.create(id)));rigs.forEach((r,i)=>{r!.root.position.x=(i-.5)*3.2;scene.add(r!.root);});
let pose='guard';
function draw(){const rows=[];for(const [i,rig] of rigs.entries()){const state=newMotion(),input={speed:0,grounded:true,verticalVelocity:0,turn:0,dojoOutfit:ids[i],dojoSparring:true};state.combo=pose==='cross'?1:pose==='kick'?2:0;state.attackAge=['jab','cross','kick'].includes(pose)?MELEE_COMBO[state.combo].contact:10;if(pose==='dodge'){state.skill='dodge';state.skillAge=.15;}models.animate(rig!,advanceMotion(state,input,0),state,input,0);rig!.root.updateMatrixWorld(true);rows.push({id:ids[i],pose,wrists:['R','L'].map(s=>rig!.bones.get('wrist_'+s)!.getWorldPosition(new THREE.Vector3()).toArray())});}document.querySelector('#report')!.textContent=JSON.stringify(rows);renderer.render(scene,camera);}
for(const b of document.querySelectorAll<HTMLButtonElement>('[data-pose]'))b.onclick=()=>{pose=b.dataset.pose!;draw();};
document.querySelector<HTMLButtonElement>('#front')!.onclick=()=>{camera.position.set(0,3.4,11);orbit.target.set(0,2.3,0);orbit.update();draw();};
document.querySelector<HTMLButtonElement>('#side')!.onclick=()=>{camera.position.set(-8,3.4,3);orbit.target.set(-.5,2.6,0);orbit.update();draw();};
document.querySelector<HTMLButtonElement>('#hands')!.onclick=()=>{camera.position.set(-1.7,3.6,3.2);orbit.target.set(-1.6,3,0);orbit.update();draw();};
orbit.addEventListener('change',()=>renderer.render(scene,camera));addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.render(scene,camera);});draw();
