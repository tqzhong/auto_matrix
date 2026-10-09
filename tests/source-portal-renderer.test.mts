import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { FILM_SETS, TRINITY_TERMINAL, filmPosition, filmObstacles, playerBlocked, type TrinityTerminal } from '@auto_matrix/shared';
import { SourcePortalRenderer } from '../packages/client/src/engine/SourcePortalRenderer.js';
import { sourcePortalRoot, sourcePortalAngle, SOURCE_PORTAL, type SourcePortalGesture } from '@auto_matrix/shared';
import { sourceKeyContact } from '../packages/client/src/agents/SourcePortalPerformance.js';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
async function models(t: test.TestContext) {
  const assets = new Map();
  for (const name of ['neo', 'trinity', 'smith', 'morpheus', 'neo-office', 'neo-tracking', 'trinity-club', 'choi', 'dujour', 'keymaker-head', 'keymaker-body']) {
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
  const cleanups: (() => void)[] = [];
  t.after(() => { cleanups.forEach(cleanup => cleanup()); characters.dispose(); globalThis.document = previousDocument; globalThis.window = previousWindow; });
  return { world, characters, cleanups, canvas: new InputTarget() as unknown as HTMLCanvasElement };
}


async function portalPose(t: test.TestContext, phase: SourcePortalGesture['phase'], elapsed: number) {
  const h = await models(t), center = FILM_SETS.film_source_corridor.center;
  const state = { phase, elapsed, attempts: 0 }, neo = h.characters.create(h.world.agents.get('neo')!), keymaker = h.characters.create(h.world.agents.get('keymaker')!);
  const pose = () => {
    for (const [role, rig] of [['neo', neo], ['keymaker', keymaker]] as const) {
      const p = sourcePortalRoot(state, role); rig.root.position.set(center.x+p.x,center.y-1,center.z+p.z); rig.root.rotation.y = p.yaw;
      h.characters.animate(rig,0,{speed:0,grounded:true,verticalVelocity:0,turn:0,sourcePortal:{...state,role}},0);
      rig.root.updateWorldMatrix(true,true);rig.root.traverseVisible(o=>{if(o instanceof THREE.SkinnedMesh)o.skeleton.update();});
    }
  };
  pose(); await new Promise(resolve=>setImmediate(resolve)); pose();
  assert.ok(neo.hero); assert.ok(keymaker.root.getObjectByName('keymaker-detailed-body'));
  return {...h,neo,keymaker,state,pose};
}
function surfaceFloor(root: THREE.Object3D) {
  let lowest = Infinity; const p = new THREE.Vector3();
  root.traverseVisible(o => { if (!(o instanceof THREE.Mesh)) return;
    for(let i=0;i<o.geometry.attributes.position.count;i++){o.getVertexPosition(i,p);p.applyMatrix4(o.matrixWorld);lowest=Math.min(lowest,p.y);}
  });return lowest;
}

test('the delivered wounded Keymaker stays supported above the floor, including after the key is taken', async t => {
  const h=await portalPose(t,'listening',1);
  for(const phase of ['wounded','listening','offering','key_ready','taking','key_taken'] as const){
    h.state.phase=phase;h.state.elapsed=phase==='taking'?1:0;h.pose();
    const floor=surfaceFloor(h.keymaker.root); assert.ok(floor>=-.04,`${phase} penetrates floor by ${floor}`);assert.ok(floor<.2,`${phase} floats ${floor}`);
    const before=h.keymaker.head.getWorldPosition(new THREE.Vector3());h.pose();assert.ok(before.distanceTo(h.keymaker.head.getWorldPosition(new THREE.Vector3()))<1e-7);
  }
});
test('accepting the last key brings both real hands to the same visible contact',async t=>{
  const h=await portalPose(t,'taking',.9), target=sourceKeyContact();
  const neo=h.neo.hero!.bones.get('wrist_R')!.localToWorld(new THREE.Vector3(0,-.19,.035));
  const keymaker=h.keymaker.elbows[1].localToWorld(new THREE.Vector3(0,-.79,.055));
  assert.ok(neo.distanceTo(target)<.08,`Neo palm gap ${neo.distanceTo(target)}`);
  assert.ok(keymaker.distanceTo(target)<.08,`Keymaker hand gap ${keymaker.distanceTo(target)}`);
  assert.equal(h.neo.sourcePortalProps!.key.visible,true);assert.equal(h.keymaker.sourcePortalProps!.key.visible,false);
});
test('the door rotates on its hinge and the narrow white corridor uses the same blocking walls',async t=>{
  const h=await portalPose(t,'opening',.8),room=new THREE.Group(),center=FILM_SETS.film_source_corridor.center;
  room.position.set(center.x,center.y-1,center.z);const renderer=new SourcePortalRenderer(room);t.after(()=>renderer.dispose());
  const state={portalOpened:false,keyTaken:false,performance:h.state};renderer.update(state);room.updateMatrixWorld(true);
  assert.equal(renderer.portal.rotation.y,sourcePortalAngle(state));assert.equal(renderer.portal.position.x,-SOURCE_PORTAL.door.width/2);
  const handle=renderer.portal.getObjectByName('escape-door-handle')!;const position=handle.getWorldPosition(new THREE.Vector3());
  renderer.update({...state,performance:{...h.state,elapsed:1.7}});room.updateMatrixWorld(true);
  assert.ok(position.distanceTo(handle.getWorldPosition(new THREE.Vector3()))>2,'the leaf cannot slide sideways');
  for(const x of [-5.1,5.1])assert.equal(playerBlocked(filmPosition('film_source_corridor',x,-25),true,1.1),true);
  assert.equal(playerBlocked(filmPosition('film_source_corridor',0,-25),true,1.1),false);
  assert.ok(room.getObjectByName('finished-hall-ceiling'));assert.ok(room.getObjectByName('bare-wall-stud'));
  await new Promise(resolve=>setImmediate(resolve));renderer.update({...state,performance:{...h.state,phase:'cover',elapsed:0}});room.updateMatrixWorld(true);
  const crowd=renderer.group.getObjectByName('smith-volley-line')!;assert.equal(crowd.children.length,12);
  for(const smith of crowd.children){const gun=smith.getObjectByName('smith-volley-pistol')!;assert.ok(gun.visible,'the reused pistol must be visible after its constructor hides props');
    const direction=new THREE.Vector3(0,0,1).applyQuaternion(gun.getWorldQuaternion(new THREE.Quaternion()));assert.ok(direction.z<-.95,'the actual gun points toward the portal');
    assert.ok(surfaceFloor(smith)>=-.04,'posed delivered Smith mesh crosses the floor');
  }
  renderer.update({portalOpened:true,keyTaken:true,performance:{phase:'done',elapsed:0,attempts:0}});room.updateMatrixWorld(true);
  const visible:THREE.Object3D[]=[];renderer.group.traverseVisible(o=>{if(o instanceof THREE.Mesh)visible.push(o);});
  const ray=new THREE.Raycaster(new THREE.Vector3(center.x,center.y-1+2.8,center.z-55.4),new THREE.Vector3(0,0,1),0,2);
  assert.equal(ray.intersectObjects(visible,false).length,0,'white light cannot become an opaque wall behind a player inside the open source door');
});

test('both camera modes observe the portal without putting the third-person camera behind its closed leaf',async t=>{
  const h=await portalPose(t,'failed',0),center=FILM_SETS.film_source_corridor.center;
  const camera=new THREE.PerspectiveCamera(60,16/9,.06,2000),actor=h.world.agents.get('neo')!,root=sourcePortalRoot(h.state,'neo');
  actor.position=filmPosition('film_source_corridor',root.x,root.z);actor.rotation=root.yaw;
  actor.currentAction={type:'idle',parameters:{resolved:true,player:true,sourcePortal:{...h.state,role:'neo'}},startedAt:0,duration:1e9,progress:0};
  const controls=new PlayerControls(h.canvas,camera,()=>{},()=>{});h.cleanups.push(()=>controls.dispose());controls.possess(actor);
  const carrier=new THREE.Group();carrier.position.set(actor.position.x,actor.position.y,actor.position.z);carrier.add(h.neo.root);h.neo.root.position.set(0,-1,0);h.neo.root.rotation.y=root.yaw;
  for(const aspect of [16/9,.65])for(const first of [false,true]){
    camera.aspect=aspect;controls.firstPerson=first;controls.update(0,actor,carrier,true);camera.updateMatrixWorld(true);
    if(!first){assert.ok(camera.position.z>center.z-38.6,`closed door hides the scene: camera ${camera.position.toArray()}`);assert.ok(Math.abs(camera.position.x-center.x)<4,'camera intersects hall wall');}
    else{const heading=camera.getWorldDirection(new THREE.Vector3());(controls as any).yaw+=.3;controls.update(0,actor,carrier,true);assert.ok(heading.distanceTo(camera.getWorldDirection(new THREE.Vector3()))>.2);(controls as any).yaw=root.yaw;}
  }
});

test('Neo’s lowered key-taking pose keeps the delivered coat and feet above the floor',async t=>{
  const h=await portalPose(t,'taking',.9),floor=surfaceFloor(h.neo.root);
  const bad:unknown[]=[];h.neo.root.traverseVisible(o=>{if(o instanceof THREE.Mesh){const y=surfaceFloor(o);if(y<-.04)bad.push({name:o.name,y});}});
  assert.ok(floor>=-.04,`Neo wardrobe crosses the floor at ${floor}: ${JSON.stringify(bad)}`);
});

test('after the key is taken the Keymaker releases both arms instead of retaining a live offering pose', async t => {
  const h = await portalPose(t, 'key_taken', 0), floor = FILM_SETS.film_source_corridor.center.y - 1;
  for (const elbow of h.keymaker.elbows) {
    const hand = elbow.localToWorld(new THREE.Vector3(0, -.79, .055));
    assert.ok(hand.y - floor < .7, `the dead companion still holds a hand in the air at ${hand.y - floor}`);
  }
  assert.equal(h.keymaker.sourcePortalProps!.key.visible, false);
  assert.ok(surfaceFloor(h.keymaker.root) >= floor - .04, 'resting hands cannot pass through the floor');
});
