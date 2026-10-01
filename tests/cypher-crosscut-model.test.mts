import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BETRAYAL, FILM_SETS, TV_EXIT, crosscutDeckRoot, type CrosscutGesture } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { CharacterModels, type CharacterRig } from '../packages/client/src/agents/CharacterModel.js';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { NebDeckRenderer } from '../packages/client/src/engine/NebDeckRenderer.js';

async function models(t: test.TestContext) {
  const assets = new Map();
  for (const name of ['neo', 'trinity', 'smith', 'morpheus', 'neo-office', 'neo-tracking', 'trinity-club', 'choi', 'dujour']) {
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

const cut = { phase: 'call', elapsed: 12, view: 'matrix', attempts: 0, tankHealth: 40, tankHit: true, dozerDead: true, apocDead: true, switchDead: false, cypherDead: false, trinityOut: false, neoOut: false } as const;

test('unplugged Matrix bodies collapse on the delivered skin without passing through the shop floor', async t => {
  const h = await models(t);
  for (const role of ['apoc', 'switch', 'dozer', 'cypher'] as const) {
    const actor = h.world.agents.get(role)!; actor.status = 'dead';
    const rig = h.characters.create(actor); await new Promise(resolve => setImmediate(resolve));
    assert.ok(rig.hero);
    for (const fall of [.25, .8, 1.4, 2.2]) {
      const crosscut: CrosscutGesture = { ...cut, role, fall };
      h.characters.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, crosscut, realWorld: role === 'dozer' || role === 'cypher' }, 4);
      const box = bounds(rig);
      assert.ok(box.min.y >= -.025, `${role}/${fall} wardrobe crosses floor ${box.min.y} ${box.lowPart}`);
      if (fall >= 1.4) assert.ok(rig.hero!.bones.get('head')!.getWorldPosition(new THREE.Vector3()).y < 1.3, `${role} still stands after unplugging`);
    }
  }
});

test('the four physical ship bodies fit the existing connection chairs', async t => {
  const h = await models(t);
  for (const role of ['neo', 'trinity', 'apoc', 'switch'] as const) {
    const rig = h.characters.create(h.world.agents.get(role)!); await new Promise(resolve => setImmediate(resolve));
    const root = BETRAYAL.deckRoots[role]; rig.root.position.set(root.x, 0, root.z); rig.root.rotation.y = root.yaw;
    h.characters.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, seated: true, crosscut: { ...cut, role, body: true }, realWorld: true }, 4);
    const pelvis = rig.hero!.bones.get('pelvis')!.getWorldPosition(new THREE.Vector3());
    assert.ok(pelvis.y > 1.25 && pelvis.y < 1.75, `${role} pelvis misses cushion: ${pelvis.y}`);
    const box = bounds(rig); assert.ok(box.min.y >= -.025, `${role} chair clothes/shoes cross deck ${box.min.y}`);
  }
});

test('ship body doubles keep Matrix avatars in place and stay out of selection', async t => {
  const h = await models(t), renderer = new AgentRenderer(new THREE.Scene()); t.after(() => renderer.dispose());
  const ids = ['neo', 'trinity', 'apoc', 'switch', 'tank', 'dozer', 'cypher'];
  for (const id of ids) {
    const state = h.world.agents.get(id)!;
    state.isInMatrix = ['neo', 'trinity', 'apoc', 'switch'].includes(id);
    if (!state.isInMatrix) { const root = BETRAYAL.deckRoots[id as keyof typeof BETRAYAL.deckRoots], center = FILM_SETS.film_neb_deck.center; state.position = { x: center.x + root.x, y: center.y, z: center.z + root.z }; state.rotation = root.yaw; }
    renderer.updateAgent(id, state);
  }
  const matrixPositions = JSON.stringify(ids.slice(0, 4).map(id => h.world.agents.get(id)!.position));
  const journey = { scene: 'm1_tv_exit', actor: 'tank', step: 2, tvExit: { phase: 'calling', elapsed: 8.3, crosscut: { ...cut, elapsed: 8.3, apocDead: false, view: 'ship' } } } as any;
  renderer.setWorld(false); renderer.update(0, undefined, 0, 0, journey); await new Promise(resolve => setImmediate(resolve));
  renderer.update(0, undefined, 0, 0, journey);
  assert.equal(JSON.stringify(ids.slice(0, 4).map(id => h.world.agents.get(id)!.position)), matrixPositions);
  assert.deepEqual(renderer.getAgentIds().sort(), ids.sort());
  for (const role of ['neo', 'trinity', 'apoc', 'switch']) {
    const physical = renderer.getPhysicalBody(role)!; assert.notEqual(physical, renderer.getAgentBody(role));
    assert.equal(physical.parent!.visible, true); assert.equal(renderer.getAgent(role)!.visible, false);
    assert.equal(physical.parent!.children.filter(o => o.visible && (o instanceof THREE.Sprite || o instanceof THREE.Mesh && o.geometry.type === 'RingGeometry')).length, 0);
  }
  renderer.update(0, undefined, 0, 0, undefined);
  for (const role of ['neo', 'trinity', 'apoc', 'switch']) assert.equal(renderer.getPhysicalBody(role)!.parent!.visible, false);
});

test('Cypher reaches the physical neck socket of each connected body before pulling its plug',async t=>{
  const h=await models(t),renderer=new AgentRenderer(new THREE.Scene());t.after(()=>renderer.dispose());
  renderer.setWorld(false);
  for(const [role,elapsed] of [['apoc',8.3],['switch',17.3]] as const) {
    const current={...cut,elapsed,apocDead:role==='switch',view:'ship' as const};
    for(const id of ['neo','trinity','apoc','switch','tank','dozer','cypher'] as const) {
      const actor=h.world.agents.get(id)!,root=crosscutDeckRoot(current,id),center=FILM_SETS.film_neb_deck.center;
      actor.isInMatrix=['neo','trinity','apoc','switch'].includes(id);actor.rotation=root.yaw;
      if(!actor.isInMatrix)actor.position={x:center.x+root.x,y:center.y,z:center.z+root.z};
      actor.currentAction={type:'idle',parameters:{crosscut:{...current,role:id}},startedAt:0,duration:1e9,progress:0};renderer.updateAgent(id,actor);
    }
    const journey={scene:'m1_tv_exit',actor:'tank',step:2,tvExit:{phase:'calling',elapsed,crosscut:current}} as any;
    renderer.update(0,undefined,0,0,journey);await new Promise(resolve=>setImmediate(resolve));
    renderer.update(0,undefined,0,0,journey);renderer.update(0,undefined,0,0,journey);
    const body=renderer.getPhysicalBody(role)!,socket=body.getObjectByName('cervical-interface');assert.ok(socket,'the physical body needs a neck socket');
    const wrist=renderer.getAgentBody('cypher')!.getObjectByName('wrist_R')!,palm=wrist.localToWorld(new THREE.Vector3(0,-.19,.035)),point=socket!.getWorldPosition(new THREE.Vector3());
    assert.ok(palm.distanceTo(point)<.16,`${role} palm misses socket by ${palm.distanceTo(point)}: ${palm.toArray()} / ${point.toArray()}`);
  }
});

test('before pickup the third-person camera follows Neo walking and turning, rather than a fixed film shot',async t=>{
  const h=await models(t),actor=h.world.agents.get('neo')!,rig=h.characters.create(actor);await new Promise(resolve=>setImmediate(resolve));
  const center=FILM_SETS.film_tv_repair.center,camera=new THREE.PerspectiveCamera(57,16/9,.5,5000),group=new THREE.Group();group.add(rig.root);rig.root.position.y=-1;
  actor.position={x:center.x+TV_EXIT.approach.x,y:center.y,z:center.z+TV_EXIT.approach.z};actor.rotation=Math.PI;actor.currentLocation='film_tv_repair';
  actor.currentAction={type:'idle',parameters:{crosscut:{...cut,phase:'phone',elapsed:0,role:'neo',tankHit:false,dozerDead:false,apocDead:false}},startedAt:0,duration:1e9,progress:0};
  const controls=new PlayerControls(h.canvas,camera,()=>{},()=>{});
  try {
    controls.possess(actor);controls.update(.1,actor,group,true);
    const first=camera.position.clone();actor.position.x+=4;actor.rotation=Math.PI/2;controls.possess(actor);controls.update(.1,actor,group,true);
    assert.ok(camera.position.distanceTo(first)>2,'free walking cannot keep the camera fixed at the telephone shot');
    assert.ok(camera.getWorldDirection(new THREE.Vector3()).x>.5,'the follow view must turn with Neo');
    actor.position={x:center.x+TV_EXIT.approach.x,y:center.y,z:center.z+TV_EXIT.approach.z};actor.rotation=Math.PI;
    controls.possess(actor);controls.update(.1,actor,group,true);
    const key=Object.assign(new Event('keydown'),{code:'KeyV',repeat:false});window.dispatchEvent(key);controls.update(.1,actor,group,true);
    const phone=new THREE.Vector3(center.x+TV_EXIT.phone.x+.26,center.y-1+TV_EXIT.phone.y+.2,center.z+TV_EXIT.phone.z+.28);
    assert.ok(camera.getWorldDirection(new THREE.Vector3()).dot(phone.sub(camera.position).normalize())>.9,'the initial eye view must show the receiver below eye level, rather than the column above it');
  } finally {controls.dispose();}
});

test('the ship assault camera has a clear view of Cypher and Tank through the actual deck props',async t=>{
  const h=await models(t),actor=h.world.agents.get('tank')!,rig=h.characters.create(actor);await new Promise(resolve=>setImmediate(resolve));
  const center=FILM_SETS.film_neb_deck.center,root=BETRAYAL.deckRoots.tank,camera=new THREE.PerspectiveCamera(57,16/9,.5,5000),group=new THREE.Group();group.add(rig.root);rig.root.position.y=-1;
  actor.position={x:center.x+root.x,y:center.y,z:center.z+root.z};actor.rotation=root.yaw;actor.currentLocation='film_neb_deck';
  const current={...cut,phase:'assault' as const,elapsed:1,view:'ship' as const,tankHit:false,dozerDead:false,apocDead:false};
  actor.currentAction={type:'idle',parameters:{crosscut:{...current,role:'tank'}},startedAt:0,duration:1e9,progress:0};
  const deck=new THREE.Group();deck.position.set(center.x,center.y-1,center.z);const set=new NebDeckRenderer(deck);
  const controls=new PlayerControls(h.canvas,camera,()=>{},()=>{});
  try {
    controls.possess(actor);controls.update(.1,actor,group,true);set.update({scene:'m1_tv_exit',actor:'tank',tvExit:{phase:'pickup',elapsed:1,crosscut:current}} as any,0);deck.updateMatrixWorld(true);camera.updateMatrixWorld(true);
    const opaque:THREE.Mesh[]=[];deck.traverse(object=>{if(!(object instanceof THREE.Mesh)||!(object.material instanceof THREE.Material)||object.material.transparent)return;for(let p:THREE.Object3D|null=object;p;p=p.parent)if(!p.visible)return;opaque.push(object);});
    for(const role of ['tank','cypher'] as const) {
      const point=crosscutDeckRoot(current,role),target=new THREE.Vector3(center.x+point.x,center.y-1+3.1,center.z+point.z),direction=target.clone().sub(camera.position);
      const ray=new THREE.Raycaster(camera.position,direction.clone().normalize(),camera.near,direction.length()-.2);
      assert.deepEqual(ray.intersectObjects(opaque,false).map(hit=>hit.object.name),[],`${role} is hidden by deck props`);
      const projected=target.project(camera);assert.ok(Math.abs(projected.x)<.92&&Math.abs(projected.y)<.8,`${role} is outside the action frame`);
    }
  } finally {controls.dispose();set.dispose();}
});
