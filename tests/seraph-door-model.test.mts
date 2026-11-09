import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, SERAPH_DOOR, seraphDoorAnchor, seraphDoorSet, seraphDoorStance, filmPosition, type FilmJourney, type SeraphDoorEncounter } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

async function geometry(id: string) {
  const bytes = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url)), length = bytes.readUInt32LE(12), document = JSON.parse(bytes.subarray(20,20+length).toString());
  for (const material of document.materials) { delete material.pbrMetallicRoughness?.baseColorTexture; delete material.normalTexture; } document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length/4)*4,32); json.copy(padded); const binary = bytes.subarray(20+length), buffer = Buffer.alloc(20+padded.length+binary.length);
  buffer.writeUInt32LE(0x46546c67,0); buffer.writeUInt32LE(2,4); buffer.writeUInt32LE(buffer.length,8); buffer.writeUInt32LE(padded.length,12); buffer.writeUInt32LE(0x4e4f534a,16); padded.copy(buffer,20); binary.copy(buffer,20+padded.length);
  return new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength),'');
}
async function setup(t: test.TestContext) {
  const assets = new Map(await Promise.all(['seraph-head','seraph-body'].map(async id => [id,await geometry(id)] as const)));
  t.mock.method(GLTFLoader.prototype,'loadAsync',(url: string) => Promise.resolve(assets.get(url.split('/').at(-1)!.slice(0,-4))!)); t.mock.method(THREE.TextureLoader.prototype,'load',() => new THREE.Texture());
  const previous = ['window','document'].map(key => Object.getOwnPropertyDescriptor(globalThis,key)), ctx = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, stroke() {}, ellipse() {}, fill() {}, createImageData: (w: number,h: number) => ({ data: new Uint8ClampedArray(w*h*4) }), putImageData() {} };
  Object.assign(globalThis,{ window: new EventTarget(), document: { createElement: () => ({ getContext: () => ctx }) } });
  const scene = new THREE.Scene(), sets = new FilmSetRenderer(scene), actors = new AgentRenderer(scene), camera = new THREE.PerspectiveCamera(55,16/9,.1,200), world = new WorldState(); new AgentManager(world).initializeAllAgents(); actors.setWorld(true);
  const pose = (state: SeraphDoorEncounter, first = false, time = 0, speed = 1) => {
    const set = seraphDoorSet(state.scene), center = FILM_SETS[set].center, anchor = seraphDoorAnchor(state.scene), actor = structuredClone(world.agents.get('seraph')!), before = seraphDoorStance(state.scene,Math.max(0,state.door-.01));
    Object.assign(actor,{ currentLocation: set, isInMatrix: true, position: filmPosition(set,state.seraph.x,state.seraph.z), rotation: state.seraph.yaw, velocity: state.phase === 'opening' ? { x: (state.seraph.x-before.x)/.03,y: 0,z: (state.seraph.z-before.z)/.03 } : { x: 0,y: 0,z: 0 }, currentAction: { type: 'idle',parameters: { resolved: true,player: false,seraphDoor: { ...state,role: 'seraph' } },startedAt: 7,duration: 1e9,progress: 0 } }); actors.updateAgent('seraph',actor);
    const neo = { ...world.agents.get('neo')!,currentLocation: set,isInMatrix: true,position: filmPosition(set,anchor.x,anchor.z) }, journey = { scene: state.scene,step: 1,completed: [],seraphDoor: state } as unknown as FilmJourney;
    camera.position.set(center.x+anchor.x+(first?0:2),center.y+(first?3.1:5),center.z+anchor.z+(first?0:5)); camera.lookAt(center.x+state.seraph.x,center.y+2.5,center.z+state.seraph.z); camera.updateMatrixWorld(true);
    sets.update(neo,{ neoLife: { journey } } as never,time); actors.update(.03,camera,speed,0,journey); scene.updateMatrixWorld(true);
  };
  const state = (place: 'm2_seraph'|'m2_backdoors', door = 0): SeraphDoorEncounter => ({ scene: place,phase: 'opening',elapsed: door*SERAPH_DOOR.opening,door,neo: { ...seraphDoorAnchor(place),yaw: Math.PI },seraph: seraphDoorStance(place,door),route: [],cursor: 0 });
  pose(state('m2_seraph')); for (let i=0;i<12;i++) { await new Promise(resolve => setImmediate(resolve)); actors.update(0,camera,0); }
  const root = actors.getAgent('seraph')!; assert.equal(Boolean(root.getObjectByName('seraph-detailed-body')),true); assert.equal(Boolean(root.getObjectByName('seraph-neck-key')),true);
  t.after(() => { actors.dispose(); sets.dispose(); ['window','document'].forEach((key,i) => { if(previous[i])Object.defineProperty(globalThis,key,previous[i]!);else Reflect.deleteProperty(globalThis,key); }); });
  const palm = () => root.getObjectByName('seraph-detailed-body')!.getObjectByName('wrist_R')!.localToWorld(new THREE.Vector3(0,-.14,0));
  const debug = () => { const wrist = root.getObjectByName('mobil-palm-R')!, elbow = wrist.parent!, shoulder = elbow.parent!; const pos = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3()).toArray(); return { fallbackPalm: wrist.localToWorld(new THREE.Vector3(0,-.14,.005)).toArray(), actualPalm: palm().toArray(), wrist: pos(wrist), shoulder: pos(shoulder), lengths: [elbow.position.length(),wrist.position.length()], scale: shoulder.getWorldScale(new THREE.Vector3()).toArray() }; };
  return { pose,state,root,sets,palm,debug };
}

test('the delivered Seraph palm follows each real swinging door while moving and while paused', async t => {
  const h = await setup(t), misses: unknown[] = [];
  for (const place of ['m2_seraph','m2_backdoors'] as const) for (const first of [false,true]) for (const door of [0,.2,.4,.6,.8,1]) for (const speed of [0,1]) {
    const state = h.state(place,door); h.pose(state,first,0,speed); const handle = h.sets.root.getObjectByName('seraph-door-handle')!, gap = h.palm().distanceTo(handle.localToWorld(new THREE.Vector3(0,0,SERAPH_DOOR.handle.radius)));
    if(gap>=.08)misses.push({ place,first,door,speed,gap,...(misses.length===0?{target:handle.localToWorld(new THREE.Vector3(0,0,SERAPH_DOOR.handle.radius)).toArray(),detail:h.debug()}:{}) });
  }
  assert.equal(misses.length,0,JSON.stringify(misses.slice(0,12)));
});

test('one actual key tip sits in the actual lock throughout the turn and ignores browser time', async t => {
  const h = await setup(t), misses: unknown[] = [];
  for (const place of ['m2_seraph','m2_backdoors'] as const) for (const phase of ['inserting','unlocking','withdrawing'] as const) for (const elapsed of phase==='unlocking'?[0,.35,.7]:[phase==='inserting'?SERAPH_DOOR.inserting:0]) {
    const state = h.state(place); state.phase = phase; state.elapsed = elapsed; h.pose(state); const key = h.root.getObjectByName('seraph-neck-key')!;
    assert.equal(key.visible,true); assert.equal(h.root.getObjectsByProperty('name','seraph-neck-key').length,1);
    const hole = h.sets.root.getObjectByName('seraph-door-keyhole')!, tip = key.localToWorld(new THREE.Vector3(0,-SERAPH_DOOR.keyTip,0)), gap = tip.distanceTo(hole.localToWorld(new THREE.Vector3(0,0,-.01))), hand = h.palm().distanceTo(key.getWorldPosition(new THREE.Vector3()));
    if(gap>.025||hand>.1)misses.push({place,phase,elapsed,gap,hand}); const before=key.getWorldPosition(new THREE.Vector3()).toArray(); h.pose(structuredClone(state),false,300); assert.deepEqual(key.getWorldPosition(new THREE.Vector3()).toArray(),before);
  }
  assert.equal(misses.length,0,JSON.stringify(misses));
});
