import * as THREE from 'three';
import { BASEMENT, BASEMENT_BOILERS, BASEMENT_CEILING, BASEMENT_GAS, BASEMENT_GAS_LAUNCH, BASEMENT_ROLES, BASEMENT_TUNNEL_FLOORS, WETWALL_SHAFT, basementCeilingAge, basementCeilingFragment, basementDropPlayback, basementDropPose, basementGasCanister, type BasementDropPlayback, type FilmJourney } from '@auto_matrix/shared';
import { batchStaticGeometry } from './StaticGeometry.js';

/** A ceiling aperture, four boilers and an articulated catch-basin cover. */
export class BasementSetRenderer {
  readonly root = new THREE.Group();
  private cover = new THREE.Group();
  private smoke: THREE.InstancedMesh;
  private grenades: THREE.Mesh[] = [];
  private ceilingPanels: THREE.Group[] = [];
  private ceilingEdges: THREE.Group[] = [];
  private ceilingWood: THREE.InstancedMesh;
  private ceilingPlaster: THREE.InstancedMesh;
  private ceilingDust: THREE.InstancedMesh;
  private ceilingClocks: (BasementDropPlayback | undefined)[] = [];
  private impactClocks: (BasementDropPlayback | undefined)[] = [];
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures: THREE.Texture[] = [];
  constructor(parent: THREE.Group) {
    this.root.name = 'basement-mechanical-room'; parent.add(this.root);
    const concrete = this.pbr('damaged_plaster', 0x777967, 7), iron = this.pbr('metal_plate', 0x4b5049, 3), rust = this.mat(0x574534, .94, .35);
    const pipe = this.mat(0x696f62, .42, .7), brass = this.mat(0x887450, .48, .7), soot = this.mat(0x171c19, .97);
    const floor = BASEMENT.floor, ceiling = floor + BASEMENT.ceiling, grate = BASEMENT.grate, shaftTop = -48.4;
    // Four concrete rectangles leave the catch basin physically open below the cover.
    for (const [x,z,w,d] of [[-7.35,0,29.3,68],[16.35,0,11.3,68],[9,-4.85,3.4,58.3],[9,30.85,3.4,6.3]]) this.box(concrete,x,floor-.2,z,w,.4,d);
    for (const z of [-34,34]) this.box(concrete,0,floor+4.4,z,44,8.8,.55);
    for (const x of [-22,22]) {
      const doors=BASEMENT_GAS.filter((_,index)=>(index===2?22:-22)===x),half=BASEMENT_GAS_LAUNCH.entryWidth/2;let previous=-34;
      for(const door of doors){const start=door.z-half,end=door.z+half;this.box(concrete,x,floor+4.4,(previous+start)/2,.55,8.8,start-previous);previous=end;
        this.box(concrete,x,floor+(BASEMENT_GAS_LAUNCH.entryHeight+8.8)/2,door.z,.55,8.8-BASEMENT_GAS_LAUNCH.entryHeight,half*2);
        const side=Math.sign(x),depth=BASEMENT_GAS_LAUNCH.entryDepth,entry=new THREE.Group();entry.name='basement-gas-entry';this.root.add(entry);
        this.box(concrete,x+side*depth/2,floor-.2,door.z,depth,.4,half*2,entry);
        this.box(concrete,x+side*depth,floor+2.9,door.z,.55,5.8,half*2,entry);
        for(const z of [door.z-half,door.z+half])this.box(concrete,x+side*depth/2,floor+2.9,z,depth,5.8,.55,entry);
        this.box(concrete,x+side*depth/2,floor+5.92,door.z,depth,.24,half*2,entry);
        for(const z of [door.z-half,door.z+half])this.box(iron,x,floor+2.9,z,.65,5.8,.22,entry);
        this.box(iron,x,floor+5.8,door.z,.65,.22,half*2,entry);
        const search=new THREE.SpotLight(0xbfcbb8,430,42,.28,.65,2);search.position.set(x+side*1.8,floor+3.8,door.z);search.target.position.set(door.x,floor+1.2,door.z);entry.add(search,search.target);
      }
      this.box(concrete,x,floor+4.4,(previous+34)/2,.55,8.8,34-previous);
    }
    // The pipe shaft reaches the retained fourth-floor waiting height. No slab crosses the falling bodies.
    this.box(concrete,4.5,ceiling+.2,0,35,.4,68);
    this.box(concrete,-17.5,ceiling+.2,1.6,9,.4,64.8);
    for (const z of [-34.15,-30.65]) this.box(concrete,-17.5,(ceiling+shaftTop)/2,z,9,shaftTop-ceiling,.3);
    for (const x of [-22.15,-12.85]) this.box(concrete,x,(ceiling+shaftTop)/2,-32.4,.3,shaftTop-ceiling,3.8);
    this.box(concrete,-17.5,shaftTop+.15,-32.4,9,.3,3.8);
    for (const x of [-20.5,-18,-15.5]) {
      this.cylinder(pipe,x,(floor-54)/2,WETWALL_SHAFT.pipeZ,.25,-54-floor);
      for (let y=ceiling+2; y<-54; y+=3.7) { this.cylinder(rust,x,y,WETWALL_SHAFT.pipeZ,.29,.18); this.box(iron,x,y,-33.9,.8,.18,.3); }
    }
    const wood=this.pbr('old_wood_floor',0x756349,2);
    for(const x of BASEMENT_CEILING.lanes){
      const panel=new THREE.Group();panel.name='basement-ceiling-lath';this.root.add(panel);this.ceilingPanels.push(panel);
      // The pipe passes through a real notch, rather than through solid lath.
      for(let row=0;row<7;row++){
        const z=-33.76+row*.45;
        if(Math.abs(z-WETWALL_SHAFT.pipeZ)<.4)for(const side of [-1,1])this.box(wood,x+side*.77,ceiling-.035,z,.9,.07,.32,panel);
        else this.box(wood,x,ceiling-.035,z,BASEMENT_CEILING.width,.07,.32,panel);
      }
      for(const side of [-1,1])this.box(concrete,x+side*.78,ceiling-.12,-33.64,.88,.1,.6,panel);
      this.box(concrete,x,ceiling-.12,-31.64,BASEMENT_CEILING.width,.1,1.35,panel);
      for(const side of [-1,1])this.box(wood,x+side*1.19,ceiling+.04,-32.4,.055,.15,BASEMENT_CEILING.depth);
    }
    this.ceilingWood=this.fragments(wood,'basement-ceiling-splinters');
    this.ceilingPlaster=this.fragments(concrete,'basement-ceiling-plaster');
    for(const x of BASEMENT_CEILING.lanes){
      const edge=new THREE.Group();edge.name='basement-ceiling-torn-edge';this.ceilingEdges.push(edge);this.root.add(edge);
      for(const side of [-1,1])for(let i=0;i<7;i++){
        if(side<0&&i===3)continue;
        const z=side<0?-33.66:-31.02,offset=(i-3)*.335;
        const woodEnd=this.mesh(this.ceilingWood.geometry,wood,x+offset,ceiling-.055,z,edge);
        woodEnd.scale.set(.22,.065,.14+(side>0?i%3*.07:0));woodEnd.rotation.y=i%2?Math.PI:0;
        const chip=this.mesh(this.ceilingPlaster.geometry,concrete,x+offset,ceiling-.12,z,edge);
        chip.scale.set(.34,.09,.14+(side>0?i%3*.05:0));chip.rotation.y=i%2?Math.PI:0;
      }
    }
    for (const z of [-26,-4,20]) {
      this.box(iron,0,ceiling-.45,z,43,.8,.4);
      this.cylinder(pipe,0,ceiling-1.1,z,.16,42).rotation.z=Math.PI/2;
      for (const x of [-18,0,18]) this.box(iron,x,ceiling-.65,z,.16,.7,.12);
    }
    for (const [index,boiler] of BASEMENT_BOILERS.entries()) {
      const unit = new THREE.Group(); unit.name = `basement-boiler-${index}`; unit.position.set(boiler.x,floor,boiler.z); this.root.add(unit);
      this.box(iron,0,.26,0,boiler.width,.52,boiler.depth,unit);
      for (const z of [-4.7,4.7]) this.box(rust,0,1,z,5.4,1.3,1.1,unit);
      const shell=this.cylinder(iron,0,3.25,0,2.7,12.2,unit); shell.rotation.x=Math.PI/2;
      for (const z of [-6.05,6.05]) {
        const cap = this.mesh(new THREE.SphereGeometry(2.7,24,14),iron,0,3.25,z,unit); cap.scale.z=.17;
        const band=this.mesh(new THREE.TorusGeometry(2.71,.1,8,28),rust,0,3.25,z,unit);
        for(let bolt=0;bolt<16;bolt++){const angle=bolt/16*Math.PI*2;const rivet=this.cylinder(brass,Math.sin(angle)*2.52,3.25+Math.cos(angle)*2.52,z+(z>0?.14:-.14),.055,.1,unit);rivet.rotation.x=Math.PI/2;}
        band.name='';
      }
      const door=this.cylinder(soot,0,3.1,6.57,1.05,.13,unit);door.rotation.x=Math.PI/2;
      const rim=this.mesh(new THREE.TorusGeometry(1.08,.12,8,20),brass,0,3.1,6.68,unit);
      rim.name='';this.box(iron,0,3.1,6.77,1.35,.15,.14,unit);
      this.cylinder(pipe,0,6.75,-3.8,.35,2.1,unit);
      const dial=this.cylinder(brass,1.25,5.15,6.2,.36,.12,unit);dial.rotation.x=Math.PI/2;
      const face=this.cylinder(this.mat(0xbcbba8,.7),1.25,5.15,6.29,.3,.025,unit);face.rotation.x=Math.PI/2;
      for(let mark=0;mark<9;mark++){const a=mark*.42-.2;this.box(soot,1.25+Math.sin(a)*.23,5.15+Math.cos(a)*.23,6.315,.035,.075,.025,unit).rotation.z=-a;}
      this.box(soot,1.28,5.21,6.33,.027,.32,.025,unit).rotation.z=-.5;
      for (const x of [-1.8,1.8]) { const valve=this.mesh(new THREE.TorusGeometry(.36,.06,8,16),rust,x,4.3,6.5,unit);valve.name='';this.box(brass,x,4.3,6.5,.7,.06,.06,unit); }
    }
    // Catch-basin curb, hinge and ladder share the traversal coordinates.
    for(const x of [grate.x-1.8,grate.x+1.8])this.box(iron,x,floor+.1,grate.z,.18,.24,3.6);
    for(const z of [grate.z-1.8,grate.z+1.8])this.box(iron,grate.x,floor+.1,z,3.6,.24,.18);
    this.cover.name='basement-catch-basin-cover';this.cover.position.set(grate.x,floor+.22,grate.hingeZ);this.root.add(this.cover);
    for(const x of [-1.63,1.63])this.box(iron,x,0,-1.7,.14,.16,3.4,this.cover);
    for(const z of [-3.32,-.08])this.box(iron,0,0,z,3.4,.16,.14,this.cover);
    for(let x=-1.45;x<=1.45;x+=.28)this.box(iron,x,0,-1.7,.075,.11,3.22,this.cover);
    for(const side of [0,1])this.box(brass,-1.25,.06,-1.15-side*.3,.32,.1,.11,this.cover);
    for(let y=floor-5.7;y<floor-.1;y+=.65){const rung=this.cylinder(pipe,grate.x,y,grate.z-1.35,.07,1.8);rung.rotation.z=Math.PI/2;}
    for(const x of [grate.x-.9,grate.x+.9])this.cylinder(pipe,x,floor-2.9,grate.z-1.35,.07,6.4);
    const tunnelFloor=BASEMENT.tunnelFloor;
    for(const surface of BASEMENT_TUNNEL_FLOORS){this.box(concrete,surface.x,tunnelFloor-.15,surface.z,surface.width,.3,surface.depth);
      if(surface.z!==28)this.box(concrete,surface.x,tunnelFloor+BASEMENT.tunnelHeight+.12,surface.z,surface.width,.24,surface.depth);}
    for(const [x,z,w,d] of [[6.7,25.7,.24,4],[9,23.7,4.6,.24],[11.3,28,.24,8.6],[6.8,32.3,9,.24],[2.3,39.65,.24,14.7],[0,47,4.6,.24],[-2.3,37.35,.24,19.3],[2.2,27.7,9,.24]])this.box(concrete,x,tunnelFloor+BASEMENT.tunnelHeight/2,z,w,BASEMENT.tunnelHeight,d);
    // Roof strips surround the ladder aperture; only the real catch-basin opening is uncovered.
    for(const [x,z,w,d] of [[7,26,.6,3.4],[11,26,.6,3.4],[9,24,4.6,.6]])this.box(concrete,x,tunnelFloor+BASEMENT.tunnelHeight+.12,z,w,.24,d);
    // A dark water ribbon and low utility lights disclose the turns without a floating arrow.
    for(const [x,z,w,d] of [[9,28,.45,4],[4.5,30,9,.45],[0,38,.45,16]])this.box(this.mat(0x26392e,.18,.35),x,tunnelFloor+.018,z,w,.028,d);
    for(const z of [30,38,44]){const bulb=new THREE.PointLight(0xacc89e,14,9,2);bulb.position.set(0,tunnelFloor+2.85,z);this.root.add(bulb);}
    for(const z of [-26,2,26]){
      const shade=this.mesh(new THREE.SphereGeometry(.42,12,8),iron,0,ceiling-1.1,z);shade.scale.y=.35;
      const bulb=new THREE.PointLight(z===26?0xc8cf9e:0xe4cea1,95,30,2);bulb.position.set(0,ceiling-1.65,z);this.root.add(bulb);
    }
    for(const gas of BASEMENT_GAS){const grenade=this.cylinder(this.mat(0x42664b,.52,.45),gas.x,floor+.16,gas.z,.12,.35);grenade.name='basement-gas-canister';grenade.rotation.z=Math.PI/2;this.grenades.push(grenade);}
    const pixels=new Uint8Array(32*32*4);
    for(let y=0;y<32;y++)for(let x=0;x<32;x++){const i=(y*32+x)*4,r=Math.hypot((x-15.5)/16,(y-15.5)/16);pixels[i]=pixels[i+1]=pixels[i+2]=210;pixels[i+3]=Math.round(Math.max(0,1-r)**2*200);}
    const map=new THREE.DataTexture(pixels,32,32);map.minFilter=map.magFilter=THREE.LinearFilter;map.needsUpdate=true;this.textures.push(map);
    const fog=new THREE.MeshBasicMaterial({color:0x9ba991,map,transparent:true,opacity:.28,depthWrite:false,side:THREE.DoubleSide});this.materials.add(fog);
    const geometry=new THREE.PlaneGeometry(1,1);this.geometries.add(geometry);this.smoke=new THREE.InstancedMesh(geometry,fog,72);this.smoke.frustumCulled=false;this.smoke.name='basement-gas-clouds';this.root.add(this.smoke);
    const powder=new THREE.MeshBasicMaterial({color:0xb9ab92,map,transparent:true,opacity:.16,depthWrite:false,side:THREE.DoubleSide});this.materials.add(powder);
    this.ceilingDust=new THREE.InstancedMesh(geometry,powder,68);this.ceilingDust.name='basement-ceiling-dust';this.ceilingDust.frustumCulled=false;this.root.add(this.ceilingDust);
    for(const geometry of batchStaticGeometry(this.root,new Set(this.grenades)))this.geometries.add(geometry);
    this.update(undefined);
  }
  private mat(color:number,roughness:number,metalness=0){const material=new THREE.MeshStandardMaterial({color,roughness,metalness});this.materials.add(material);return material;}
  private pbr(id:string,color:number,repeat:number){const material=this.mat(color,.9);for(const [property,suffix] of [['map','color'],['normalMap','normal'],['roughnessMap','roughness']] as const){const texture=new THREE.TextureLoader().load(`/assets/film-materials/${id}-${suffix}.jpg`);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(repeat,repeat);if(suffix==='color')texture.colorSpace=THREE.SRGBColorSpace;this.textures.push(texture);material[property]=texture;}material.normalScale.set(.3,.3);return material;}
  private mesh(geometry:THREE.BufferGeometry,material:THREE.Material,x:number,y:number,z:number,parent=this.root){this.geometries.add(geometry);const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;}
  private box(material:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number,parent=this.root){return this.mesh(new THREE.BoxGeometry(w,h,d),material,x,y,z,parent);}
  private cylinder(material:THREE.Material,x:number,y:number,z:number,r:number,h:number,parent=this.root){return this.mesh(new THREE.CylinderGeometry(r,r,h,16),material,x,y,z,parent);}
  private fragments(material:THREE.Material,name:string):THREE.InstancedMesh {
    const shape=new THREE.Shape();shape.moveTo(-.5,-.5);for(const [x,y] of [[.31,-.5],[.5,-.2],[.38,-.13],[.49,.07],[.26,.15],[.39,.5],[-.5,.5]])shape.lineTo(x,y);shape.closePath();
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:1,bevelEnabled:false,steps:1});geometry.rotateX(Math.PI/2);geometry.translate(0,.5,0);this.geometries.add(geometry);
    const fragments=new THREE.InstancedMesh(geometry,material,BASEMENT_CEILING.lanes.length*BASEMENT_CEILING.fragments);
    fragments.name=name;fragments.castShadow=fragments.receiveShadow=true;fragments.frustumCulled=false;this.root.add(fragments);return fragments;
  }
  update(journey:FilmJourney|undefined,cameraPosition?:{x:number;y:number;z:number},delta=0):void {
    const state=journey?.scene==='m1_basement'&&!journey.visiting?journey.basement:undefined;
    this.cover.rotation.x=-(state?.hatch??0)*BASEMENT.grate.angle;
    const matrix=new THREE.Object3D(),camera=cameraPosition?this.root.worldToLocal(new THREE.Vector3(cameraPosition.x,cameraPosition.y,cameraPosition.z)):new THREE.Vector3(0,BASEMENT.floor+4,0);
    this.updateCeiling(journey,camera,delta,matrix);
    const time=state?.gas??0;this.smoke.visible=BASEMENT_GAS.some((source,index)=>time>source.at&&(!state?.gasShots||state.gasShots[index]));
    for(let i=0;i<72;i++){const source=BASEMENT_GAS[i%3],age=Math.max(0,time-source.at),weight=state?.gasShots&&!state.gasShots[i%3]?0:THREE.MathUtils.smoothstep(age,0,12),radius=(1+i%8)*1.25*Math.min(1,age/15),angle=i*2.399;
      matrix.position.set(source.x+Math.sin(angle+time*.018)*radius,BASEMENT.floor+1.5+(i%5)*.72,source.z+Math.cos(angle+time*.018)*radius);matrix.lookAt(camera);matrix.scale.setScalar(weight*(6+i%4*1.6));matrix.updateMatrix();this.smoke.setMatrixAt(i,matrix.matrix);}
    this.smoke.instanceMatrix.needsUpdate=true;
    this.grenades.forEach((grenade,i)=>{const position=basementGasCanister(i,time,state?.gasShots);grenade.visible=Boolean(position);if(position){grenade.position.set(position.x,position.y,position.z);grenade.rotation.set(0,time<BASEMENT_GAS[i].at?time*11:0,Math.PI/2);}});
  }
  private updateCeiling(journey:FilmJourney|undefined,camera:THREE.Vector3,delta:number,matrix:THREE.Object3D):void {
    const state=journey?.scene==='m1_basement'&&!journey.visiting?journey.basement:undefined;
    const active=Boolean(state?.landings&&state.starts),ages=BASEMENT_CEILING.lanes.map((_,lane)=>{
      const source=active?basementCeilingAge(state!,lane):undefined;
      this.ceilingClocks[lane]=source===undefined?undefined:basementDropPlayback(this.ceilingClocks[lane],source,delta,delta>0&&!state?.paused);
      return this.ceilingClocks[lane]?.age;
    });
    this.ceilingPanels.forEach((panel,lane)=>{panel.visible=active&&ages[lane]===undefined;});
    this.ceilingEdges.forEach((edge,lane)=>{edge.visible=ages[lane]!==undefined;});
    this.ceilingWood.visible=this.ceilingPlaster.visible=ages.some(age=>age!==undefined);
    for(const [lane,age] of ages.entries())for(let i=0;i<BASEMENT_CEILING.fragments;i++)for(const [plaster,mesh] of [[false,this.ceilingWood],[true,this.ceilingPlaster]] as const){
      matrix.scale.set(0,0,0);
      if(age!==undefined){
        const pose=basementCeilingFragment(lane,i,age,plaster);matrix.rotation.set(pose.rotation.x,pose.rotation.y,pose.rotation.z);matrix.scale.set(pose.scale.x,pose.scale.y,pose.scale.z);
        const e=new THREE.Matrix4().makeRotationFromEuler(matrix.rotation).elements;
        const half=Math.abs(e[1])*pose.scale.x/2+Math.abs(e[5])*pose.scale.y/2+Math.abs(e[9])*pose.scale.z/2;
        const halfX=Math.abs(e[0])*pose.scale.x/2+Math.abs(e[4])*pose.scale.y/2+Math.abs(e[8])*pose.scale.z/2;
        const halfZ=Math.abs(e[2])*pose.scale.x/2+Math.abs(e[6])*pose.scale.y/2+Math.abs(e[10])*pose.scale.z/2;
        matrix.position.set(THREE.MathUtils.clamp(pose.x,-21.725+halfX+.008,-13.02-halfX-.008),pose.y+half+.008,Math.max(pose.z,-33.725+halfZ+.008));
      }
      matrix.updateMatrix();mesh.setMatrixAt(lane*BASEMENT_CEILING.fragments+i,matrix.matrix);
    }
    this.ceilingWood.instanceMatrix.needsUpdate=this.ceilingPlaster.instanceMatrix.needsUpdate=true;
    let dust=0;this.ceilingDust.visible=false;
    const cloud=(x:number,y:number,z:number,size:number)=>{matrix.position.set(x,y,z);matrix.lookAt(camera);matrix.scale.setScalar(size);matrix.updateMatrix();this.ceilingDust.setMatrixAt(dust++,matrix.matrix);if(size>0)this.ceilingDust.visible=true;};
    for(const [lane,age] of ages.entries())for(let i=0;i<16;i++){
      const fade=age===undefined||age>=1.7?0:Math.sin(Math.PI*age/1.7);
      cloud(BASEMENT_CEILING.lanes[lane]+Math.sin(i*2.4)*(.45+(age??0)*.5),BASEMENT.floor+BASEMENT.ceiling-.35-(age??0)*1.1-i%3*.2,
        -32.4+Math.cos(i*2.4)*.9,Math.max(0,fade)*(1+(age??0)*1.2));
    }
    for(const [index,role] of BASEMENT_ROLES.entries()){
      const source=active?state!.landings[role]:undefined;this.impactClocks[index]=source===undefined?undefined:basementDropPlayback(this.impactClocks[index],source,delta,delta>0&&!state?.paused);
      const age=this.impactClocks[index]?.age,contact=age===undefined?-1:age-basementDropPose(age).impact;
      const fade=contact<0||contact>=1.6?0:Math.sin(Math.PI*contact/1.6);
      for(let i=0;i<4;i++){const angle=i*Math.PI/2,radius=.5+Math.max(0,contact)*.5;cloud((state?.starts?.[role].x??0)+Math.sin(angle)*radius,BASEMENT.floor+.3+Math.max(0,contact)*.25,-32.2+Math.cos(angle)*radius,Math.max(0,fade)*(1.1+Math.max(0,contact)*1.8));}
    }
    this.ceilingDust.instanceMatrix.needsUpdate=true;
  }
  dispose():void {this.root.removeFromParent();this.geometries.forEach(geometry=>geometry.dispose());this.materials.forEach(material=>material.dispose());this.textures.forEach(texture=>texture.dispose());this.smoke.dispose();this.ceilingWood.dispose();this.ceilingPlaster.dispose();this.ceilingDust.dispose();}
}
