import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { BOOK_DOOR,FILM_SETS,bookDoorStance,filmPosition,type BookDoorEncounter,type FilmJourney }from '@auto_matrix/shared';
import { AgentRenderer }from '../packages/client/src/agents/AgentRenderer.js';
import { FilmSetRenderer }from '../packages/client/src/engine/FilmSetRenderer.js';
import { PlayerControls }from '../packages/client/src/player/PlayerControls.js';
import { WorldState }from '../packages/server/src/world/WorldState.js';
import { AgentManager }from '../packages/server/src/agents/AgentManager.js';

function setup(t:test.TestContext){
  const previous=['window','document'].map(k=>Object.getOwnPropertyDescriptor(globalThis,k)),gradient={addColorStop(){}},context={createRadialGradient:()=>gradient,createLinearGradient:()=>gradient,fillRect(){},clearRect(){},strokeRect(){},fillText(){},measureText:()=>({width:20}),beginPath(){},closePath(){},moveTo(){},lineTo(){},stroke(){},ellipse(){},arc(){},fill(){},createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}};
  Object.assign(globalThis,{window:new EventTarget(),document:{createElement:()=>({getContext:()=>context})}});t.mock.method(THREE.TextureLoader.prototype,'load',()=>new THREE.Texture());
  const scene=new THREE.Scene(),sets=new FilmSetRenderer(scene),actors=new AgentRenderer(scene),camera=new THREE.PerspectiveCamera(55,16/9,.1,200),world=new WorldState();new AgentManager(world).initializeAllAgents();actors.setWorld(true);
  t.after(()=>{actors.dispose();sets.dispose();['window','document'].forEach((key,i)=>{if(previous[i])Object.defineProperty(globalThis,key,previous[i]!);else Reflect.deleteProperty(globalThis,key);});});
  const state=(door=0):BookDoorEncounter=>({phase:'opening',elapsed:door*BOOK_DOOR.opening,door,book:0,neo:{...BOOK_DOOR.anchor,yaw:Math.PI},persephone:bookDoorStance(door),route:[],cursor:0});
  const pose=(s:BookDoorEncounter,first=false,time=0,speed=1)=>{
    const c=FILM_SETS[BOOK_DOOR.set].center,p=s.persephone,before=bookDoorStance(Math.max(0,s.door-.01)),a=structuredClone(world.agents.get('persephone')!);
    Object.assign(a,{currentLocation:BOOK_DOOR.set,isInMatrix:true,position:filmPosition(BOOK_DOOR.set,p.x,p.z),rotation:p.yaw,velocity:s.phase==='opening'?{x:(p.x-before.x)/.03,y:0,z:(p.z-before.z)/.03}:{x:0,y:0,z:0},currentAction:{type:'idle',parameters:{resolved:true,player:false,bookDoor:{phase:s.phase,elapsed:s.elapsed,book:s.book,door:s.door,persephone:p,role:'persephone'}},startedAt:7,duration:1e9,progress:0}});actors.updateAgent('persephone',a);
    const neo={...world.agents.get('neo')!,currentLocation:BOOK_DOOR.set,isInMatrix:true,position:filmPosition(BOOK_DOOR.set,BOOK_DOOR.anchor.x,BOOK_DOOR.anchor.z)},j={version:1,scene:'m2_library',step:2,actor:'neo',completed:[],bookDoor:s}as unknown as FilmJourney;
    camera.position.set(c.x+BOOK_DOOR.anchor.x+(first?0:2),c.y+(first?3.1:6),c.z+BOOK_DOOR.anchor.z+(first?0:5));camera.lookAt(c.x+p.x,c.y+3,c.z+p.z);camera.updateMatrixWorld(true);sets.update(neo,{neoLife:{journey:j}}as never,time);actors.update(.03,camera,speed,0,j);scene.updateMatrixWorld(true);
  };
  const palm=()=>{const mesh=actors.getAgent('persephone')!.getObjectByName('persephone-palm-R');assert.ok(mesh instanceof THREE.Mesh&&mesh.geometry.type==='SphereGeometry','measure the rendered palm surface');return mesh.localToWorld(new THREE.Vector3(0,0,1));};
  return{state,pose,palm,sets,actors,camera,world};
}

test('the visible palm stays on the real brass shelf during the continuous swing in both views and when paused',t=>{
  const h=setup(t),misses:unknown[]=[];
  for(const first of [false,true])for(const door of [0,.2,.4,.6,.8,1])for(const speed of [0,1]){
    h.pose(h.state(door),first,0,speed);const rail=h.sets.root.getObjectByName('library-book-push-rail')!;assert.ok(rail instanceof THREE.Mesh);
    const target=rail.localToWorld(new THREE.Vector3(BOOK_DOOR.rail.x-BOOK_DOOR.width/2,0,.1)),gap=h.palm().distanceTo(target);if(gap>.06)misses.push({first,door,speed,gap});
  }
  assert.equal(misses.length,0,JSON.stringify(misses.slice(0,12)));
});

test('the real palm pulls the real book spine and browser time cannot advance the saved latch',t=>{
  const h=setup(t),misses:unknown[]=[];
  for(const book of [0,.25,.5,.75,1]){
    const s=h.state();s.phase='unlatching';s.book=book;s.elapsed=book*BOOK_DOOR.unlatching;h.pose(s);const spine=h.sets.root.getObjectByName('library-trigger-book')!;assert.ok(spine instanceof THREE.Mesh);
    const target=spine.localToWorld(new THREE.Vector3(0,BOOK_DOOR.book.grip-BOOK_DOOR.book.height/2,BOOK_DOOR.book.depth/2)),gap=h.palm().distanceTo(target);if(gap>.06)misses.push({book,gap});
    const before=h.palm().toArray();h.pose(structuredClone(s),true,300,0);assert.ok(h.palm().distanceTo(new THREE.Vector3(...before))<1e-8,'saved book contact ignores elapsed browser time');
  }
  assert.equal(misses.length,0,JSON.stringify(misses));
});

test('the library camera keeps the latch and the moving shelf contact clear of Neo and the shelves', t => {
  const h = setup(t), neo = h.world.agents.get('neo')!;
  globalThis.document = Object.assign(new EventTarget(), document, { pointerLockElement: null, hidden: false }) as unknown as Document;
  const canvas = new EventTarget() as HTMLCanvasElement;
  const controls = new PlayerControls(canvas, h.camera, () => {}, () => {});
  const player = new THREE.Group();
  const silhouette = new THREE.Mesh(new THREE.CylinderGeometry(.68, .68, 3.75));
  silhouette.position.y = .875;
  player.add(silhouette);
  silhouette.name = 'Neo’s silhouette';
  let now = 1200;
  t.mock.method(performance, 'now', () => now);
  const latch = { ...h.state(), phase: 'unlatching' as const, book: .5, elapsed: .5 * BOOK_DOOR.unlatching };
  const phases = [latch, ...[.1, .35, .65, .95, 1].map(h.state)];
  const center = FILM_SETS[BOOK_DOOR.set].center;
  try {
    for (const aspect of [16 / 9, .65]) {
      h.camera.aspect = aspect;
      h.camera.updateProjectionMatrix();
      for (const s of phases) {
        h.pose(s);
        const position = filmPosition(BOOK_DOOR.set, s.neo.x, s.neo.z);
        const rotation = Math.atan2(BOOK_DOOR.hinge.x + BOOK_DOOR.book.x - s.neo.x, BOOK_DOOR.hinge.z - s.neo.z);
        Object.assign(neo, { position, rotation, currentLocation: BOOK_DOOR.set, isInMatrix: true, currentAction: { type: 'idle', parameters: {
          player: true, resolved: true, bookDoor: { role: 'neo', phase: s.phase, elapsed: s.elapsed, door: s.door, book: s.book, persephone: s.persephone },
        }, startedAt: 7, duration: 1e9, progress: 0 } });
        player.position.set(position.x, position.y, position.z);
        player.updateMatrixWorld(true);
        controls.possess(neo);
        now += 50;
        controls.update(.05, neo, player, false);
        h.camera.updateMatrixWorld(true);
        const context = `${aspect}/${s.phase}/${s.door}`;
        const hand = h.palm();
        const chest = new THREE.Vector3(center.x + s.persephone.x, center.y + 1.9, center.z + s.persephone.z);
        for (const point of [hand, chest]) {
          const screen = point.clone().project(h.camera);
          assert.ok(Math.max(Math.abs(screen.x), Math.abs(screen.y), Math.abs(screen.z)) < .99, `${context}: off screen ${screen.toArray()}`);
        }
        const ray = hand.clone().sub(h.camera.position);
        const hit = new THREE.Raycaster(h.camera.position, ray.clone().normalize(), .05, ray.length() - .11)
          .intersectObjects([player, h.sets.root], true)[0];
        assert.ok(!hit, `${context}: palm blocked by ${hit?.object.name || hit?.object.type} at ${hit?.point.toArray()}`);
      }
    }
  } finally {
    controls.dispose(); silhouette.geometry.dispose(); silhouette.material.dispose();
  }
});
