import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BASEMENT, FILM_SETS, TV_EXIT, WETWALL_SHAFT, basementHatchPoint, basementLifterRoot, type BasementGesture, type WetwallGesture } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { CharacterModels, type CharacterRig } from '../packages/client/src/agents/CharacterModel.js';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';

async function models(t: test.TestContext) {
  const assets = new Map();
  for (const name of ['neo', 'trinity', 'smith', 'morpheus', 'neo-office', 'neo-tracking', 'trinity-club']) {
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
