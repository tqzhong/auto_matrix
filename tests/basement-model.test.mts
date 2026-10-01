import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BASEMENT, BASEMENT_ROLES, FILM_SETS, TV_EXIT, WETWALL, WETWALL_SHAFT, basementDropPose, basementDropRoot, basementGasLaunch, basementLauncherRoot, basementHatchPoint, basementLifterRoot, type BasementGesture, type WetwallGesture, type AgentState } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { CharacterModels, type CharacterRig } from '../packages/client/src/agents/CharacterModel.js';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';

async function models(t: test.TestContext) {
  const assets = new Map();
  for (const name of ['neo', 'trinity', 'smith', 'morpheus', 'neo-office', 'neo-tracking', 'trinity-club', 'choi']) {
    const glb = await readFile(new URL(`../packages/client/public/assets/characters/${name}.glb`, import.meta.url));
    const length = glb.readUInt32LE(12), source = JSON.parse(glb.subarray(20, 20 + length).toString());
    for (const material of source.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
    source.images = []; source.textures = [];
    const json = Buffer.from(JSON.stringify(source)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
    const bin = glb.subarray(20 + length), buffer = Buffer.alloc(20 + padded.length + bin.length);
    buffer.writeUInt32LE(0x46546c67, 0); buffer.writeUInt32LE(2, 4); buffer.writeUInt32LE(buffer.length, 8);
    buffer.writeUInt32LE(padded.length, 12); buffer.writeUInt32LE(0x4e4f534a, 16); padded.copy(buffer, 20); bin.copy(buffer, 20 + padded.length);
    assets.set(name, await new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), ''));
  }
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async (url: string) => assets.get(url.split('/').pop()!.replace('.glb', '')));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  class InputTarget extends EventTarget { matches() { return false; } }
  const previousDocument = globalThis.document, previousWindow = globalThis.window;
  globalThis.window = new InputTarget() as unknown as Window & typeof globalThis;
  globalThis.document = Object.assign(new InputTarget(), { pointerLockElement: null, hidden: false, exitPointerLock() {},
    createElement: () => ({ getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) }) as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const characters = new CharacterModels();
  t.after(() => { characters.dispose(); globalThis.document = previousDocument; globalThis.window = previousWindow; });
  return { world, characters, canvas: new InputTarget() as unknown as HTMLCanvasElement };
}

function bounds(rig: CharacterRig) {
  rig.root.updateMatrixWorld(true); const vertex = new THREE.Vector3(), box = new THREE.Box3(); let lowPart = '';
  for (const { mesh } of rig.hero!.wardrobe) if (mesh.visible) for (let i=0;i<mesh.geometry.attributes.position.count;i++) {
    mesh.getVertexPosition(i,vertex); mesh.localToWorld(vertex); if(vertex.y<box.min.y)lowPart=mesh.name+':'+(mesh.material as THREE.Material).name; box.expandByPoint(vertex);
  }
  return Object.assign(box,{lowPart});
}

test('delivered escape bodies fit the drain without coat, shoes or head crossing floor and ceiling', async t => {
  const h=await models(t);
  for(const role of ['neo','trinity','apoc','switch'] as const) {
    const rig=h.characters.create(h.world.agents.get(role)!); await new Promise(resolve=>setImmediate(resolve));
    assert.ok(rig.hero,`${role} needs the delivered skeleton`);
    for(const elapsed of [0,.3,.8,1.2,1.8,2.4]) {
      const basement:BasementGesture={role,phase:'tunnel',elapsed,hatch:1,crawling:true};
      h.characters.animate(rig,.1,{speed:3.1,grounded:true,verticalVelocity:0,turn:0,basement} as any,4);
      const box=bounds(rig);
      assert.ok(box.min.y>=-.025,`${role} crawl/${elapsed} penetrates floor: ${box.min.y} (${box.lowPart})`);
      assert.ok(box.max.y<=BASEMENT.tunnelHeight-.05,`${role} crawl/${elapsed} pierces ceiling: ${box.max.y}`);
      assert.ok(box.max.x-box.min.x<2.7,`${role} is too wide for the real drain turn`);
    }
  }
});

test('Trinity grips the moving catch-basin handles on her actual skeleton',async t=>{
  const h=await models(t),rig=h.characters.create(h.world.agents.get('trinity')!);await new Promise(resolve=>setImmediate(resolve));
  const center=FILM_SETS.film_ambush_house.center;
  rig.root.position.set(center.x+BASEMENT.waiting.trinity.x,center.y-1+BASEMENT.floor,center.z+BASEMENT.waiting.trinity.z);rig.root.rotation.y=Math.PI/2;
  for(const hatch of [0,.2,.5,.8,1]) {
    const root=basementLifterRoot(hatch);rig.root.position.set(center.x+root.x,center.y-1+root.y,center.z+root.z);
    h.characters.animate(rig,0,{speed:0,grounded:true,verticalVelocity:0,turn:0,basement:{role:'trinity',phase:'lifting',elapsed:BASEMENT.liftSeconds*hatch,hatch}} as any,4);
    const box=bounds(rig);assert.ok(box.min.y>=center.y-1+BASEMENT.floor-.025,`lifting feet/cloth below floor: ${box.min.y} (${box.lowPart})`);
    for(const [i,side] of ['R','L'].entries()) {
      const target=basementHatchPoint(hatch,i),point=new THREE.Vector3(center.x+target.x,center.y-1+target.y,center.z+target.z);
      const palm=rig.hero!.bones.get(`wrist_${side}`)!.localToWorld(new THREE.Vector3(0,-.19,.035));
      assert.ok(palm.distanceTo(point)<.16,`${side} hatch/${hatch} misses real handle: ${palm.distanceTo(point)} palm=${palm.toArray()} target=${point.toArray()} shoulder=${rig.hero!.bones.get(`shoulder_${side}`)!.getWorldPosition(new THREE.Vector3()).toArray()}`);
    }
  }
});

test('Neo keeps both hands and shoes on the physical lower stack throughout the basement descent',async t=>{
  const h=await models(t),rig=h.characters.create(h.world.agents.get('neo')!);await new Promise(resolve=>setImmediate(resolve));
  assert.ok(rig.hero);const center=FILM_SETS.film_ambush_house.center,pipeX=-15.5,pipeZ=WETWALL_SHAFT.pipeZ,pipeRadius=.25;
  const shoes=rig.hero.root.getObjectByName('shoes01') as THREE.SkinnedMesh,vertex=new THREE.Vector3();
  for(const y of [-60,-72,-84,BASEMENT.floor+BASEMENT.ceiling]) {
    rig.root.position.set(center.x+pipeX,center.y-1+y,center.z+WETWALL_SHAFT.bodyZ);rig.root.rotation.y=Math.PI;
    const depth=WETWALL_SHAFT.top-y,wetwall:WetwallGesture={role:'neo',phase:'done',elapsed:0,progress:depth,entry:0,hanging:true,freed:true,continued:true,start:{x:pipeX,y:WETWALL_SHAFT.top,z:WETWALL_SHAFT.bodyZ}};
    h.characters.animate(rig,0,{speed:0,grounded:true,verticalVelocity:0,turn:0,climbing:0,wetwall,
      basement:{role:'neo',phase:'descending',elapsed:depth,hatch:0}} as any,4);rig.root.updateMatrixWorld(true);
    for(const side of ['R','L'] as const) {
      const palm=rig.hero.bones.get(`wrist_${side}`)!.localToWorld(new THREE.Vector3(0,-.19,.035));
      const palmRadius=Math.hypot(palm.x-center.x-pipeX,palm.z-center.z-pipeZ);
      assert.ok(palmRadius>=pipeRadius-.025&&palmRadius<=pipeRadius+.18,`${side} palm leaves the lower pipe at y=${y}: ${palmRadius}`);
      const ankle=rig.hero.bones.get(`ankle_${side}`)!,joint=shoes.skeleton.bones.indexOf(ankle),indices=shoes.geometry.attributes.skinIndex,weights=shoes.geometry.attributes.skinWeight;
      let clearance=Infinity;
      for(let i=0;i<shoes.geometry.attributes.position.count;i++) {
        if(![0,1,2,3].some(slot=>indices.getComponent(i,slot)===joint&&weights.getComponent(i,slot)>.5))continue;
        shoes.getVertexPosition(i,vertex);shoes.localToWorld(vertex);
        clearance=Math.min(clearance,Math.hypot(vertex.x-center.x-pipeX,vertex.z-center.z-pipeZ)-pipeRadius);
      }
      assert.ok(clearance>=-.025&&clearance<=.08,`${side} shoe misses or penetrates the lower pipe at y=${y}: ${clearance}`);
    }
  }
});

test('Neo holds one real receiver through the dead line and returns it before the Tank cut',async t=>{
  const h=await models(t),rig=h.characters.create(h.world.agents.get('neo')!);await new Promise(resolve=>setImmediate(resolve));
  const center=FILM_SETS.film_tv_repair.center;
  rig.root.position.set(center.x+TV_EXIT.approach.x,center.y-1,center.z+TV_EXIT.approach.z);rig.root.rotation.y=Math.PI;
  for(const [phase,elapsed] of [['pickup',.8],['pickup',1],['pickup',3],['line_dead',0],['calling',3]] as const) {
    h.characters.animate(rig,0,{speed:0,grounded:true,verticalVelocity:0,turn:0,tvExit:{role:'neo',phase,elapsed}} as any,4);
    const receiver=rig.root.getObjectByName('hardline-handset');assert.ok(receiver?.visible,`${phase} lacks the physical receiver`);
    const palm=rig.hero!.bones.get('wrist_R')!.localToWorld(new THREE.Vector3(0,-.19,.035));
    assert.ok(receiver!.getWorldPosition(new THREE.Vector3()).distanceTo(palm)<.16,'receiver is floating away from the actual palm');
    if(phase==='pickup'&&elapsed===.8){const phone=TV_EXIT.phone;const base=new THREE.Vector3(center.x+phone.x+.26,center.y-1+phone.y,center.z+phone.z+.28);assert.ok(palm.distanceTo(base)<.16,`actual receiver pickup misses the base: ${palm.distanceTo(base)}`);}
  }
  h.characters.animate(rig,0,{speed:0,grounded:true,verticalVelocity:0,turn:0,tvExit:{role:'neo',phase:'calling',elapsed:6.7}} as any,4);
  assert.equal(rig.root.getObjectByName('hardline-handset')!.visible,false);
});

test('gas-masked launcher bodies hold both grips and fire from the exact shared muzzle',async t=>{
  const h=await models(t),base=h.world.agents.get('neo')!,rig=h.characters.create({...base,id:'film_soldier',faction:'civilians'});
  const center=FILM_SETS.film_ambush_house.center;
  for(const index of [0,1,2]) {
    const root=basementLauncherRoot(index),launch=basementGasLaunch(index);
    rig.root.position.set(center.x+root.x,center.y-1+root.y,center.z+root.z);rig.root.rotation.y=root.yaw;
    for(const offset of [-.1,0,.125,.4]) {
      h.characters.animate(rig,0,{speed:0,grounded:true,verticalVelocity:0,turn:0,armed:true,weaponStyle:'gas_launcher',basementGas:{index,time:launch.at+offset}},4);
      rig.root.updateMatrixWorld(true);const gun=rig.weapons![0];
      const muzzle=gun.localToWorld(new THREE.Vector3(0,-1.455,0)),target=new THREE.Vector3(center.x+launch.muzzle.x,center.y-1+launch.muzzle.y,center.z+launch.muzzle.z);
      assert.ok(muzzle.distanceTo(target)<.071,`launcher ${index} fires away from the physical barrel: ${muzzle.distanceTo(target)}`);
      for(const hand of [0,1]) {
        const grip=gun.localToWorld(new THREE.Vector3(0,hand?-.78:-.08,-.12));
        const palm=rig.elbows[hand].localToWorld(new THREE.Vector3(0,-.79,.055));
        assert.ok(palm.distanceTo(grip)<.1,`launcher ${index}/${hand} has a floating support hand: ${palm.distanceTo(grip)}; shoulder distance ${rig.shoulders[hand].getWorldPosition(new THREE.Vector3()).distanceTo(grip)}, reach ${rig.elbows[hand].position.length()+Math.hypot(.79,.055)}; shoulder ${rig.root.worldToLocal(rig.shoulders[hand].getWorldPosition(new THREE.Vector3())).toArray()}, grip ${rig.root.worldToLocal(grip.clone()).toArray()}`);
      }
    }
  }
});

test('both drain cameras stay below the roof while direction follows the player heading',async t=>{
  const h=await models(t),actor=h.world.agents.get('neo')!,rig=h.characters.create(actor);await new Promise(resolve=>setImmediate(resolve));
  const center=FILM_SETS.film_ambush_house.center,camera=new THREE.PerspectiveCamera(57,16/9,.5,5000),group=new THREE.Group();group.add(rig.root);rig.root.position.y=-1;
  actor.position={x:center.x+9,y:center.y+BASEMENT.tunnelFloor,z:center.z+26};actor.rotation=0;actor.currentLocation='film_ambush_house';
  actor.currentAction={type:'idle',parameters:{resolved:true,basement:{role:'neo',phase:'tunnel',elapsed:2,hatch:1,crawling:true}},startedAt:0,duration:1e9,progress:0};
  const controls=new PlayerControls(h.canvas,camera,()=>{},()=>{});controls.possess(actor);
  try {
    for(const [x,z,yaw] of [[9,26,0],[9,30,-Math.PI/2],[0,30,0]]) for(const firstPerson of [false,true]) {
      actor.position.x=center.x+x;actor.position.z=center.z+z;actor.rotation=yaw;controls.possess(actor);
      controls.firstPerson=firstPerson;controls.update(.1,actor,group,true);h.characters.animate(rig,0,controls.motion,4);group.updateWorldMatrix(true,true);controls.update(.1,actor,group,true);
      assert.ok(camera.position.y<center.y-1+BASEMENT.tunnelFloor+BASEMENT.tunnelHeight-.05,`${firstPerson?'eye':'follow'} camera above roof: ${camera.position.y}`);
      assert.ok(camera.position.y>center.y-1+BASEMENT.tunnelFloor+.3,'camera below the drain floor');
      assert.ok(camera.near<=.08,'near plane must fit the small drain clearance');
      assert.ok(camera.getWorldDirection(new THREE.Vector3()).dot(new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw)))>.6,'camera must follow the actual turn');
      if(!firstPerson){
        if(x===9&&z===26) assert.ok(camera.position.z>center.z+BASEMENT.grate.z-1.35+.2,'the ladder rungs must remain behind the follow camera at the drain entrance');
        const skin=rig.hero!.wardrobe.filter(({mesh})=>mesh.visible).map(({mesh})=>mesh);
        for(const mesh of skin) if(mesh instanceof THREE.SkinnedMesh) mesh.computeBoundingSphere();
        const ray=new THREE.Raycaster(camera.position,camera.getWorldDirection(new THREE.Vector3()),camera.near,5);
        assert.equal(ray.intersectObjects(skin,false).length,0,'the follow camera must show the drain ahead, not shoot through Neo himself');
      }
    }
  } finally {controls.dispose();}
});

test('Neo releases the pipe pose on the boiler-room floor instead of holding an absent street ladder',async t=>{
  const h=await models(t),actor=h.world.agents.get('neo')!,camera=new THREE.PerspectiveCamera(),group=new THREE.Group();
  actor.position={x:FILM_SETS.film_ambush_house.center.x-15.5,y:FILM_SETS.film_ambush_house.center.y+BASEMENT.floor,z:FILM_SETS.film_ambush_house.center.z-29};
  actor.currentAction={type:'idle',parameters:{resolved:true,basement:{role:'neo',phase:'searching',elapsed:0,hatch:0}},startedAt:0,duration:1e9,progress:0};
  const controls=new PlayerControls(h.canvas,camera,()=>{},()=>{});controls.possess(actor);
  try{controls.update(.1,actor,group,false);assert.equal(controls.motion.climbing,undefined,'an absent emerging role cannot match an absent TV-exit role and raise both arms');}
  finally{controls.dispose();}
});

test('the real landing body absorbs contact after falling instead of crouching identically in mid-air',async t=>{
  const h=await models(t),rig=h.characters.create(h.world.agents.get('neo')!);await new Promise(resolve=>setImmediate(resolve));
  const impact=Math.sqrt(BASEMENT.ceiling/12),head=rig.hero!.bones.get('head')!;
  const sample=(age:number)=>{
    rig.root.position.set(0,Math.max(0,BASEMENT.ceiling-12*age*age),0);
    h.characters.animate(rig,0,{speed:0,grounded:age>=impact,verticalVelocity:age<impact?-24*age:0,turn:0,
      basement:{role:'neo',phase:'landing',elapsed:0,hatch:0,drop:age,landing:Math.max(0,age-impact)}} as any,4);
    rig.root.updateMatrixWorld(true);return head.getWorldPosition(new THREE.Vector3()).y-rig.root.position.y;
  };
  const airborne=sample(.3),compressed=sample(impact+.12),recovered=sample(impact+.9);
  assert.ok(airborne-compressed>.45,`impact must visibly absorb weight after the drop: air ${airborne}, impact ${compressed}`);
  assert.ok(recovered-compressed>.45,`the body must stand back up before departing: recovery ${recovered}, impact ${compressed}`);
  for(const age of [impact,impact+.08,impact+.2,impact+.4,impact+.65,impact+.82]){
    sample(age);const box=bounds(rig);assert.ok(box.min.y>=-.025,`landing/${age} penetrates the floor: ${box.min.y} (${box.lowPart})`);
  }
});

test('falling Neo uses the same saved drop clock for his body, eye height and paused recovery',async t=>{
  const h=await models(t),actor=h.world.agents.get('neo')!,rig=h.characters.create(actor);await new Promise(resolve=>setImmediate(resolve));
  const center=FILM_SETS.film_ambush_house.center,camera=new THREE.PerspectiveCamera(57,16/9,.5,5000),group=new THREE.Group();group.add(rig.root);rig.root.position.y=-1;
  const start={x:-15.5,y:BASEMENT.floor+BASEMENT.ceiling,z:WETWALL_SHAFT.bodyZ,yaw:Math.PI},impact=Math.sqrt(BASEMENT.ceiling/12);
  const controls=new PlayerControls(h.canvas,camera,()=>{},()=>{});
  try{
    for(const age of [.3,impact+.12,impact+.75]){
      actor.position={x:center.x+start.x,y:center.y+BASEMENT.floor+Math.max(0,BASEMENT.ceiling-12*age*age),z:center.z+start.z};actor.rotation=Math.PI;
      actor.currentAction={type:'idle',parameters:{resolved:true,basement:{role:'neo',phase:'landing',elapsed:0,hatch:0,drop:age,start,landing:Math.max(0,age-impact),paused:true}},startedAt:0,duration:1e9,progress:0};
      controls.possess(actor);controls.firstPerson=true;controls.climbing=true;group.position.set(actor.position.x,actor.position.y,actor.position.z);rig.root.rotation.y=actor.rotation;
      h.characters.animate(rig,0,{speed:0,grounded:age>=impact,verticalVelocity:0,turn:0,basement:actor.currentAction.parameters.basement} as any,4);
      controls.update(.1,actor,group,false);group.updateMatrixWorld(true);
      assert.equal(controls.motion.climbing,undefined,'the shaft input flag cannot keep a released landing body gripping an absent rung');
      assert.equal(controls.motion.grounded,age>=impact,'a scripted drop must not be classified as grounded merely because movement is locked');
      assert.ok(camera.near<=.08,'the close pipe must not vanish through the first-person near plane after release');
      h.characters.animate(rig,0,controls.motion,4);controls.update(.1,actor,group,false);group.updateMatrixWorld(true);
      if(age>=impact+.65)for(const side of ['R','L'])assert.ok(rig.hero!.bones.get(`wrist_${side}`)!.getWorldPosition(new THREE.Vector3()).y<rig.hero!.bones.get('head')!.getWorldPosition(new THREE.Vector3()).y-.3,'a recovered actor must release the overhead pipe grip');
      const eye=rig.hero!.bones.get('head')!.localToWorld(new THREE.Vector3(0,.1,.32));
      assert.ok(camera.position.distanceTo(eye)<.35,`eye floats away from the real recovering head at ${age}: ${camera.position.distanceTo(eye)}`);
      const pipeClearance=Math.hypot(camera.position.x-center.x-start.x,camera.position.z-center.z-WETWALL_SHAFT.pipeZ)-.25;
      assert.ok(pipeClearance>.08,`the recovering eye enters the real vertical pipe at ${age}: ${pipeClearance}; eye ${camera.position.toArray()}`);
      const before=group.position.clone();for(let i=0;i<8;i++)controls.update(.1,actor,group,false);
      assert.ok(group.position.distanceTo(before)<.001,'pause cannot finish the recovery interpolation');
    }
  }finally{controls.dispose();}
});

test('all five delivered landing bodies plant both shoe soles and recover without crossing concrete or pipes',async t=>{
  const h=await models(t),impact=basementDropPose(0).impact,vertex=new THREE.Vector3();
  for(const role of BASEMENT_ROLES){
    const rig=h.characters.create(h.world.agents.get(role)!);await new Promise(resolve=>setImmediate(resolve));assert.ok(rig.hero,`${role} needs its shipped body`);
    const start={x:WETWALL.lanes[role],y:BASEMENT.floor+BASEMENT.ceiling,z:WETWALL_SHAFT.bodyZ,yaw:Math.PI};
    for(const age of [.03,.3,.6,impact,impact+.08,impact+.2,impact+.4,impact+.65,impact+.82,1.8,2.1,2.4,2.7,2.95]){
      const root=basementDropRoot(role,start,age),pose=basementDropPose(age);rig.root.position.set(root.x,root.y,root.z);rig.root.rotation.y=root.yaw;
      h.characters.animate(rig,.1,{speed:root.speed,grounded:!pose.airborne,verticalVelocity:pose.verticalVelocity,turn:0,
        basement:{role,phase:'landing',elapsed:0,hatch:0,drop:age,landing:pose.landing,start}} as any,4);
      const box=bounds(rig);assert.ok(box.min.y>=BASEMENT.floor-.025,`${role}/${age} skin or cloth crosses concrete: ${box.min.y} (${box.lowPart})`);
      let clearance=Infinity,pipePart='',pipePoint:number[]=[];
      for(const {mesh} of rig.hero!.wardrobe)if(mesh.visible)for(let i=0;i<mesh.geometry.attributes.position.count;i++){
        mesh.getVertexPosition(i,vertex);mesh.localToWorld(vertex);
        if(Math.abs(vertex.z-WETWALL_SHAFT.pipeZ)>.5)continue;
        const distance=Math.hypot(Math.min(...[-20.5,-18,-15.5].map(x=>Math.abs(vertex.x-x))),vertex.z-WETWALL_SHAFT.pipeZ);
        if(distance<clearance){clearance=distance;pipePart=mesh.name;pipePoint=vertex.toArray();}
      }
      assert.ok(clearance>=.225,`${role}/${age}/${pipePart} enters the lower pipe at ${pipePoint}`);
      if(age<=impact+.82){
        const shoes=rig.hero!.root.getObjectByName('shoes01') as THREE.SkinnedMesh,low=[Infinity,Infinity];
        for(let i=0;i<shoes.geometry.attributes.position.count;i++){
          const side=shoes.geometry.attributes.position.getX(i)>0?0:1;shoes.getVertexPosition(i,vertex);shoes.localToWorld(vertex);low[side]=Math.min(low[side],vertex.y);
        }
        for(const [side,y] of low.entries())assert.ok(Math.abs(y-root.y)<.12,`${role}/${age}/${side} sole floats from its shared contact plane: ${y-root.y}; lowest ${box.min.y-root.y} (${box.lowPart}), pelvis ${rig.hero!.bones.get('pelvis')!.position.y}`);
      }
      if(pose.airborne)assert.ok(box.min.x>=-22&&box.max.x<=-13&&box.min.z>=-34&&box.max.z<=-30.5,`${role}/${age} clips the shaft before dropping into the room: ${box.min.toArray()}/${box.max.toArray()}`);
    }
  }
});

test('the companion renderer interpolates fall age with the skin and restores exact contact when paused',async t=>{
  const h=await models(t),actor=h.world.agents.get('trinity')!,center=FILM_SETS.film_ambush_house.center,scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();
  const start={x:WETWALL.lanes.trinity,y:BASEMENT.floor+BASEMENT.ceiling,z:WETWALL_SHAFT.bodyZ,yaw:Math.PI};
  const state=(age:number)=>{const root=basementDropRoot('trinity',start,age);return {...actor,isInMatrix:true,position:{x:center.x+root.x,y:center.y+root.y,z:center.z+root.z},rotation:root.yaw,
    currentAction:{type:'idle',parameters:{resolved:true,basement:{role:'trinity',phase:'landing',elapsed:0,hatch:0,drop:age,start}},startedAt:0,duration:1e9,progress:0}} as AgentState;};
  const renderer=new AgentRenderer(scene);t.after(()=>renderer.dispose());renderer.updateAgent('trinity',state(.3));await new Promise(resolve=>setImmediate(resolve));renderer.update(0,camera,0);
  const age=basementDropPose(0).impact+.12;renderer.updateAgent('trinity',state(age));renderer.update(.1,camera,1);
  const group=renderer.getAgent('trinity')!;
  assert.ok(group.position.y>center.y+BASEMENT.floor+.5,'the body and impact cannot jump to the end while the saved drop clock is interpolating');
  renderer.update(.1,camera,0);assert.ok(Math.abs(group.position.y-center.y-BASEMENT.floor)<.001,'paused contact must restore the authoritative concrete plane');
  const body=renderer.getAgentBody('trinity')!,head=body.getObjectByName('head')!,before=head.getWorldPosition(new THREE.Vector3());
  for(let i=0;i<8;i++)renderer.update(.1,camera,0);assert.ok(head.getWorldPosition(new THREE.Vector3()).distanceTo(before)<.001);
  const restored=new AgentRenderer(new THREE.Scene());t.after(()=>restored.dispose());restored.updateAgent('trinity',state(age));await new Promise(resolve=>setImmediate(resolve));restored.update(0,camera,0);
  assert.ok(restored.getAgentBody('trinity')!.getObjectByName('head')!.getWorldPosition(new THREE.Vector3()).distanceTo(before)<.001,'loading cannot restart the fall or change the compression');
});
