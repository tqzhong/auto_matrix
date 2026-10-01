import * as THREE from 'three';
import { TV_EXIT, TV_EXIT_INTERIOR_OBSTACLES, type FilmJourney } from '@auto_matrix/shared';
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
    const asphalt=this.mat(0x323a39,1),concrete=this.mat(0x8c9184,.98),brick=this.mat(0x725f50,.96),paint=this.mat(0xb8b69d,.9),red=this.mat(0x743b31,.83),rubber=this.mat(0x151918,1);
    const floor=this.mat(0x797866,.94);floor.map=new THREE.TextureLoader().load('/assets/film-materials/old_wood_floor-color.jpg');floor.map.wrapS=floor.map.wrapT=THREE.RepeatWrapping;floor.map.repeat.set(5,10);floor.map.colorSpace=THREE.SRGBColorSpace;this.textures.push(floor.map);
    this.box(floor,0,-.18,0,36,.36,64);this.box(plaster,0,10.1,0,36,.3,64);
    for(const x of [-18,18])this.box(plaster,x,5,0,.5,10,64);this.box(plaster,0,5,-32,36,10,.5);
    this.box(asphalt,0,-.28,49,36,.32,14);this.box(concrete,0,-.12,37,36,.24,10);this.box(concrete,0,.06,42,36,.38,.6);
    for(const x of [-9,9])this.box(paint,x,-.09,50,.16,.04,7.2);
    this.box(brick,0,12.8,31.9,36,5.6,.5);this.box(paint,0,10.65,31.55,17,2.1,.5);
    for(const x of [-11,11]){this.box(wood,x,4.7,32,14,9.4,.22);this.box(black,x,4.8,31.82,13.2,7.4,.08);}
    this.box(wood,0,8.95,32,8,1.7,.28);
    const window=this.mat(0x93a699,.6);window.emissive.setHex(0x53675c);window.emissiveIntensity=.45;
    for(const x of [-11,11]){this.box(window,x,4.8,31.75,12.4,6.9,.06);for(const dx of [-6.3,0,6.3])this.box(iron,x+dx,4.8,31.57,.1,7.2,.1);}
    for(const x of [-3.85,3.85])this.box(iron,x,4.55,31.65,.3,8.2,.35);
    const door=new THREE.Group();door.name='tv-store-open-door';door.position.set(3.7,0,31.65);door.rotation.y=-1.08;this.root.add(door);
    this.box(iron,-1.65,4.3,0,.14,8.1,.18,door);this.box(iron,0,8.25,0,3.4,.14,.18,door);this.box(iron,0,.35,0,3.4,.14,.18,door);this.box(glass,0,4.3,0,3.18,7.7,.06,door);
    for(const x of [-12,-4,4,12]){this.box(black,x,12.9,31.55,4.8,2.4,.12);this.box(window,x,12.9,31.45,4.2,1.8,.05);}
    for(const [index,item] of TV_EXIT_INTERIOR_OBSTACLES.entries()){
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
    const drain=new THREE.Group();drain.name='tv-street-drain';drain.position.set(TV_EXIT.street.drain.x,.02,TV_EXIT.street.drain.z);this.root.add(drain);
    const ringGeometry=new THREE.TorusGeometry(1.18,.13,8,32);this.geometries.add(ringGeometry);const ring=new THREE.Mesh(ringGeometry,iron);ring.rotation.x=Math.PI/2;ring.castShadow=ring.receiveShadow=true;drain.add(ring);
    const shaftGeometry=new THREE.CylinderGeometry(1.03,1.03,.16,32);this.geometries.add(shaftGeometry);const shaft=new THREE.Mesh(shaftGeometry,black);shaft.position.y=-.08;shaft.castShadow=shaft.receiveShadow=true;drain.add(shaft);
    const hatch=new THREE.Group();hatch.name='tv-street-hatch';hatch.position.set(TV_EXIT.street.drain.x+2.2,.14,TV_EXIT.street.drain.z+.25);hatch.rotation.set(.08,0,-.18);this.root.add(hatch);
    const hatchGeometry=new THREE.CylinderGeometry(1.02,1.02,.14,32);this.geometries.add(hatchGeometry);const lid=new THREE.Mesh(hatchGeometry,iron);lid.castShadow=lid.receiveShadow=true;hatch.add(lid);
    for(let groove=-.65;groove<=.65;groove+=.26)this.box(black,groove,.09,0,.045,.035,1.5,hatch);
    const van=new THREE.Group();van.name='tv-street-parked-van';van.position.set(11.8,0,48.5);this.root.add(van);
    this.box(beige,0,1.65,0,5.8,3.15,9.6,van);this.box(black,0,2.45,-4.82,4.7,1.15,.12,van);this.box(black,0,2.45,4.82,4.7,1.15,.12,van);
    for(const x of [-2.55,2.55])for(const z of [-3.1,3.1]){const wheelGeometry=new THREE.CylinderGeometry(.68,.68,.42,16);this.geometries.add(wheelGeometry);const wheel=new THREE.Mesh(wheelGeometry,rubber);wheel.rotation.z=Math.PI/2;wheel.position.set(x,.68,z);wheel.castShadow=true;van.add(wheel);}
    const newsstand=new THREE.Group();newsstand.name='tv-street-newsstand';newsstand.position.set(-15.2,0,38.8);this.root.add(newsstand);
    this.box(red,0,1.02,0,1.3,2.04,1.2,newsstand);this.box(black,0,1.3,-.63,.92,.62,.05,newsstand);this.box(paint,0,2.12,0,1.5,.18,1.4,newsstand);
    for(const x of [-16,16]){const lamp=new THREE.Group();lamp.position.set(x,.1,43);this.root.add(lamp);this.box(iron,0,3.4,0,.18,6.8,.18,lamp);this.box(iron,0,6.85,-.45,.18,.18,1.1,lamp);const bulb=new THREE.PointLight(0xe7e5c5,35,10,2);bulb.position.set(0,6.65,-.85);lamp.add(bulb);}
    for(const x of [-14,-6,3,12]){this.box(brick,x,6.2,55.2,7.4,12.4,.7);this.box(black,x,6.5,54.8,3.4,4.2,.08);this.box(window,x,6.5,54.7,3,3.8,.05);}
    for(const z of [-18,0,19]){this.box(wood,0,9.7,z,35,.4,.45);const shade=this.box(beige,0,8.8,z,5,.12,.6);shade.name='';const light=new THREE.PointLight(0xe0e1ba,80,32,2);light.position.set(0,8.4,z);this.root.add(light);}
    const day=new THREE.SpotLight(0xdce5cf,1800,75,.95,.5,2);day.position.set(-9,8,35);day.target.position.set(0,0,-6);day.castShadow=true;day.shadow.mapSize.set(1024,1024);day.shadow.normalBias=.04;this.root.add(day,day.target);
    const sun=new THREE.DirectionalLight(0xfff4d6,1.4);sun.position.set(-24,38,44);sun.target.position.set(0,0,31);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-24;sun.shadow.camera.right=24;sun.shadow.camera.top=40;sun.shadow.camera.bottom=-12;this.root.add(sun,sun.target);
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
