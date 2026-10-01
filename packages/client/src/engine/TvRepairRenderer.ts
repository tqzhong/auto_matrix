import * as THREE from 'three';
import { TV_EXIT, TV_EXIT_OBSTACLES, type FilmJourney } from '@auto_matrix/shared';
import { HardlineHandset } from '../agents/HardlineHandset.js';
import { batchStaticGeometry } from './StaticGeometry.js';

/** A daylight storefront and an actual repair aisle behind a short counter. */
export class TvRepairRenderer {
  readonly root=new THREE.Group();
  private handset=new HardlineHandset();
  private wire:THREE.Line;
  private geometries=new Set<THREE.BufferGeometry>();
  private materials=new Set<THREE.Material>();
  private textures:THREE.Texture[]=[];
  private televisionUnits:THREE.Group[]=[];
  constructor(parent:THREE.Group){
    this.root.name='franklin-erie-tv-repair';parent.add(this.root);
    const plaster=this.mat(0x9ca58c,.96),wood=this.mat(0x63543b,.85),iron=this.mat(0x4d5249,.64,.45),black=this.mat(0x1a211e,.68),beige=this.mat(0x8b8a72,.73);
    const glass=this.mat(0x34433e,.2,.25),greenBoard=this.mat(0x365741,.84),brownBoard=this.mat(0x776646,.84);
    const floor=this.mat(0x797866,.94);floor.map=new THREE.TextureLoader().load('/assets/film-materials/old_wood_floor-color.jpg');floor.map.wrapS=floor.map.wrapT=THREE.RepeatWrapping;floor.map.repeat.set(5,10);floor.map.colorSpace=THREE.SRGBColorSpace;this.textures.push(floor.map);
    this.box(floor,0,-.18,0,36,.36,64);this.box(plaster,0,10.1,0,36,.3,64);
    for(const x of [-18,18])this.box(plaster,x,5,0,.5,10,64);this.box(plaster,0,5,-32,36,10,.5);
    for(const x of [-11.5,11.5]){this.box(wood,x,4.7,32,12.6,9.4,.22);this.box(black,x,4.8,31.82,11.8,7.4,.08);}
    this.box(wood,0,8.9,32,10,2.2,.28);this.box(wood,0,4.05,32,8.5,8.1,.2);
    const window=this.mat(0x93a699,.6);window.emissive.setHex(0x53675c);window.emissiveIntensity=.45;
    for(const x of [-11.5,11.5]){this.box(window,x,4.8,31.75,10.9,6.9,.06);for(const dx of [-5.5,0,5.5])this.box(iron,x+dx,4.8,31.57,.1,7.2,.1);}
    for(const [index,item] of TV_EXIT_OBSTACLES.entries()){
      const frame=new THREE.Group();frame.name=`tv-repair-fixture-${index}`;frame.position.set(item.x,0,item.z);this.root.add(frame);
      if(index===6){this.box(plaster,0,item.height/2,0,item.width,item.height,item.depth,frame);continue;}
      if(index===2||index===3){this.box(wood,0,item.height/2,0,item.width,item.height,item.depth,frame);this.box(beige,0,item.height+.04,0,item.width+.1,.12,item.depth+.1,frame);}
      else{
        for(const x of [-item.width/2+.12,item.width/2-.12])for(const z of [-item.depth/2+.12,item.depth/2-.12])this.box(iron,x,item.height/2,z,.16,item.height,.16,frame);
        for(let y=.45;y<item.height;y+=1.65){this.box(wood,0,y,0,item.width,.12,item.depth,frame);for(let z=-item.depth/2+1;z<item.depth/2-.7;z+=2.7)this.television(0,y+.72,z,index+Math.floor(y*5+z),frame,black,wood,beige,glass);}
      }
    }
    for(const x of [-13,-5,3,11])this.television(x,4,-25,Math.floor(x),this.root,black,wood,beige,glass);
    for(let i=0;i<18;i++){const board=this.box(i%2?greenBoard:brownBoard,-12+i%9*3,3.22,-25+(i%2-.5)*.8,1.35,.1,.65);board.rotation.y=i*.21;for(let part=0;part<3;part++)this.box(iron,board.position.x-.4+part*.35,3.37,board.position.z,.18,.18,.2);}
    for(const z of [-18,0,19]){this.box(wood,0,9.7,z,35,.4,.45);const shade=this.box(beige,0,8.8,z,5,.12,.6);shade.name='';const light=new THREE.PointLight(0xe0e1ba,80,32,2);light.position.set(0,8.4,z);this.root.add(light);}
    const day=new THREE.SpotLight(0xdce5cf,1800,75,.95,.5,2);day.position.set(-9,8,35);day.target.position.set(0,0,-6);day.castShadow=true;day.shadow.mapSize.set(1024,1024);day.shadow.normalBias=.04;this.root.add(day,day.target);
    const phone=TV_EXIT.phone;const base=new THREE.Group();base.name='tv-hardline-base';base.position.set(phone.x,phone.y,phone.z);this.root.add(base);
    this.box(beige,0,0,0,.8,1.12,.2,base);for(let row=0;row<4;row++)for(let col=0;col<3;col++)this.box(black,(col-1)*.14,-.27+row*.14,.12,.09,.09,.05,base);
    for(const y of [-.34,.34])this.box(iron,.26,y,.19,.22,.07,.26,base);
    this.handset.root.position.set(phone.x+.26,phone.y,phone.z+.28);this.root.add(this.handset.root);
    const cable=new THREE.BufferGeometry();cable.setAttribute('position',new THREE.BufferAttribute(new Float32Array(96*3),3));this.geometries.add(cable);
    const cord=new THREE.LineBasicMaterial({color:0x242b22});this.materials.add(cord);this.wire=new THREE.Line(cable,cord);this.wire.name='tv-hardline-cord';this.wire.frustumCulled=false;this.root.add(this.wire);
    this.root.updateWorldMatrix(true,true);
    for(const unit of this.televisionUnits){for(const mesh of [...unit.children])this.root.attach(mesh);unit.removeFromParent();}this.televisionUnits=[];
    const fixedReceiver=new Set<THREE.Mesh>();this.handset.root.traverse(object=>{if(object instanceof THREE.Mesh)fixedReceiver.add(object);});
    for(const geometry of batchStaticGeometry(this.root,fixedReceiver))this.geometries.add(geometry);
    this.update(undefined);
  }
  private mat(color:number,roughness:number,metalness=0){const material=new THREE.MeshStandardMaterial({color,roughness,metalness});this.materials.add(material);return material;}
  private box(material:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number,parent=this.root){const geometry=new THREE.BoxGeometry(w,h,d);this.geometries.add(geometry);const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;}
  private television(x:number,y:number,z:number,index:number,parent:THREE.Group,black:THREE.Material,wood:THREE.Material,beige:THREE.Material,glass:THREE.Material){
    const unit=new THREE.Group();unit.position.set(x,y,z);unit.rotation.y=parent===this.root?0:parent.position.x>0?-Math.PI/2:Math.PI/2;parent.add(unit);this.televisionUnits.push(unit);
    this.box(index%3?wood:beige,0,0,0,1.9,1.4,1.15,unit);this.box(black,-.16,.05,.61,1.4,1.07,.12,unit);
    this.box(glass,-.16,.05,.68,1.25,.94,.04,unit);
    for(const yy of [-.23,.24]){const geometry=new THREE.CylinderGeometry(.1,.1,.08,10);this.geometries.add(geometry);const knob=new THREE.Mesh(geometry,black);knob.rotation.x=Math.PI/2;knob.position.set(.75,yy,.64);unit.add(knob);}
    for(let slit=0;slit<6;slit++)this.box(black,.74,-.54+slit*.045,.615,.17,.016,.02,unit);
  }
  update(journey:FilmJourney|undefined,subject?:THREE.Object3D):void{
    const encounter=(journey?.scene==='m1_tv_exit'||journey?.scene==='m1_unplugged'&&journey.tvExit?.crosscut)&&!journey.visiting?journey.tvExit:undefined;
    const cut=encounter?.crosscut;
    const held=cut ? cut.phase==='phone'&&encounter!.phase==='pickup'&&cut.elapsed>=.8||cut.phase==='assault'||cut.phase==='call'&&(encounter!.phase==='line_dead'||cut.elapsed<6.6)||cut.phase==='trinity_exit'&&cut.elapsed>=2.8||cut.phase==='neo_exit'&&cut.elapsed>=.8 : encounter&&(encounter.phase==='pickup'?encounter.elapsed>=.8:encounter.phase==='line_dead'||encounter.phase==='calling'&&encounter.elapsed<6.6);
    this.handset.root.visible=!held;
    const receiver=held?subject?.getObjectByName('hardline-handset'):undefined;
    this.root.updateWorldMatrix(true,true);const phone=TV_EXIT.phone,from=new THREE.Vector3(phone.x+.3,phone.y-.45,phone.z+.15),to=receiver?this.root.worldToLocal(receiver.getWorldPosition(new THREE.Vector3())):this.handset.root.position.clone();
    const position=this.wire.geometry.attributes.position;
    for(let i=0;i<96;i++){const t=i/95,point=from.clone().lerp(to,t);point.y-=Math.sin(t*Math.PI)*.42;point.x+=Math.sin(t*Math.PI*48)*.035;point.z+=Math.cos(t*Math.PI*48)*.035;position.setXYZ(i,point.x,point.y,point.z);}position.needsUpdate=true;
  }
  dispose(){this.root.removeFromParent();this.handset.dispose();this.geometries.forEach(geometry=>geometry.dispose());this.materials.forEach(material=>material.dispose());this.textures.forEach(texture=>texture.dispose());}
}
