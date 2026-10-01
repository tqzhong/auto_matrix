import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { BASEMENT, BASEMENT_GAS, TV_EXIT, BASEMENT_TUNNEL_LENGTH, WETWALL_SHAFT, basementGasCanister, basementGasLaunch, basementTunnelRoot, type FilmJourney } from '@auto_matrix/shared';
import { BasementSetRenderer } from '../packages/client/src/engine/BasementSetRenderer.js';
import { TvRepairRenderer } from '../packages/client/src/engine/TvRepairRenderer.js';

function rays(root: THREE.Object3D) {
  const ray=new THREE.Raycaster();
  return (x:number,y:number,z:number,direction:THREE.Vector3,far:number)=>{
    root.updateWorldMatrix(true,true);ray.set(new THREE.Vector3(x,y,z),direction);ray.far=far;
    return ray.intersectObject(root,true).filter(hit=>{
      for(let object:THREE.Object3D|null=hit.object;object;object=object.parent)if(!object.visible)return false;
      return hit.object instanceof THREE.Mesh&&hit.object.castShadow;
    });
  };
}

test('the falling company has a real ceiling aperture and the catch basin opens only with its cover',t=>{
  t.mock.method(THREE.TextureLoader.prototype,'load',()=>new THREE.Texture());
  const root=new THREE.Group(),renderer=new BasementSetRenderer(root),hits=rays(root);
  try {
    assert.equal(hits(-16.4,-64,-32.2,new THREE.Vector3(0,-1,0),25).length,0,'no floor slab may cross the retained pipe height');
    assert.ok(hits(-10,BASEMENT.floor+4,-28,new THREE.Vector3(0,1,0),6).length,'mechanical room still needs a ceiling outside the shaft');
    assert.ok(hits(8.95,BASEMENT.floor+.8,26,new THREE.Vector3(0,-1,0),1).length,'closed grate must actually cover the aperture');
    renderer.update({scene:'m1_basement',basement:{hatch:1,gas:0}} as FilmJourney);
    assert.equal(hits(8.95,BASEMENT.floor+.8,26,new THREE.Vector3(0,-1,0),1).length,0,'opening the cover exposes a physical hole');
    for(const boiler of [0,1,2,3])assert.ok(root.getObjectByName(`basement-boiler-${boiler}`));
  } finally {renderer.dispose();}
});

test('the basement ceiling breaks at the occupied pipe lanes and keeps the unreleased lane intact',t=>{
  t.mock.method(THREE.TextureLoader.prototype,'load',()=>new THREE.Texture());
  const root=new THREE.Group(),renderer=new BasementSetRenderer(root),hits=rays(root),ceiling=BASEMENT.floor+BASEMENT.ceiling;
  const state={phase:'descending',hatch:0,gas:0,landings:{},starts:{neo:{x:-15.5},trinity:{x:-20.5},apoc:{x:-20.5},switch:{x:-15.5},cypher:{x:-18}},heights:{}};
  const journey={scene:'m1_basement',basement:state} as unknown as FilmJourney;
  try {
    renderer.update(journey);
    for(const x of [-20.5,-18,-15.5])assert.ok(hits(x,ceiling+1,-31.45,new THREE.Vector3(0,-1,0),1.5).length,'the lath cannot already be an empty aperture before the company arrives');
    state.landings={apoc:.3,switch:.3};renderer.update(journey);
    for(const x of [-20.5,-15.5])assert.equal(hits(x,ceiling+1,-31.45,new THREE.Vector3(0,-1,0),1.5).length,0,'the broken ceiling must clear the actual falling lane');
    assert.ok(hits(-18,ceiling+1,-31.45,new THREE.Vector3(0,-1,0),1.5).length,'Cypher’s lane cannot break before he arrives');
    const wood=root.getObjectByName('basement-ceiling-splinters') as THREE.InstancedMesh;
    assert.ok(wood?.visible,'broken lath needs actual falling fragments');
    const before=Array.from(wood.instanceMatrix.array);for(let i=0;i<8;i++)renderer.update(journey);
    assert.deepEqual(Array.from(wood.instanceMatrix.array),before,'paused fragments cannot keep falling on a render-only clock');
    const restored=new BasementSetRenderer(new THREE.Group());try{restored.update(structuredClone(journey));assert.deepEqual(Array.from((restored.root.getObjectByName('basement-ceiling-splinters') as THREE.InstancedMesh).instanceMatrix.array),before,'loading must reproduce the same breakage');}finally{restored.dispose();}
    state.landings={};renderer.update(journey);assert.equal(wood.visible,false,'shaft retry must restore the ceiling and clear old fragments');
    assert.ok(hits(-15.5,ceiling+1,-31.45,new THREE.Vector3(0,-1,0),1.5).length);
  }finally{renderer.dispose();}
});

test('intact ceiling lath has a real pipe notch and its shards stay inside the mechanical-room surfaces',t=>{
  t.mock.method(THREE.TextureLoader.prototype,'load',()=>new THREE.Texture());
  const renderer=new BasementSetRenderer(new THREE.Group()),ceiling=BASEMENT.floor+BASEMENT.ceiling;
  const state={phase:'landing',hatch:0,gas:0,landings:{},starts:{neo:{x:-15.5},trinity:{x:-20.5},apoc:{x:-20.5},switch:{x:-15.5},cypher:{x:-18}},heights:{}};
  const journey={scene:'m1_basement',basement:state} as unknown as FilmJourney;
  try{
    renderer.update(journey);renderer.root.updateWorldMatrix(true,true);
    const ray=new THREE.Raycaster(new THREE.Vector3(-15.5,ceiling-.5,WETWALL_SHAFT.pipeZ),new THREE.Vector3(0,1,0),0,1);
    const panel=renderer.root.getObjectsByProperty('name','basement-ceiling-lath')[2];
    assert.equal(ray.intersectObject(panel,true).length,0,'plaster as well as wood must leave the actual pipe hole open');
    const matrix=new THREE.Matrix4(),point=new THREE.Vector3();
    for(let age=0;age<=3;age+=.025){
      state.landings={neo:age,trinity:age,apoc:age,switch:age,cypher:age};renderer.update(journey);
      for(const name of ['basement-ceiling-splinters','basement-ceiling-plaster']){
        const fragments=renderer.root.getObjectByName(name) as THREE.InstancedMesh,positions=fragments.geometry.attributes.position;
        for(let i=0;i<fragments.count;i++){
          fragments.getMatrixAt(i,matrix);
          for(let v=0;v<positions.count;v++){
            point.fromBufferAttribute(positions,v).applyMatrix4(matrix);
            assert.ok(point.y>=BASEMENT.floor-.015,'falling fragments must bounce above the actual floor');
            assert.ok(point.x>=-21.75&&point.x<=21.75&&point.z>=-33.75&&point.z<=33.75,`fragment crosses concrete at ${age}: ${point.toArray()}`);
            const distance=Math.hypot(Math.min(...[-20.5,-18,-15.5].map(x=>Math.abs(point.x-x))),point.z-WETWALL_SHAFT.pipeZ);
            assert.ok(distance>=.225,`fragment crosses a standing pipe at ${age}: ${point.toArray()}`);
          }
        }
      }
    }
  }finally{renderer.dispose();}
});

test('ceiling debris advances between world packets and freezes with the saved paused age',t=>{
  t.mock.method(THREE.TextureLoader.prototype,'load',()=>new THREE.Texture());
  const renderer=new BasementSetRenderer(new THREE.Group());
  const state={phase:'landing',hatch:0,gas:0,paused:false,landings:{apoc:.1},starts:{neo:{x:-15.5},trinity:{x:-20.5},apoc:{x:-20.5},switch:{x:-15.5},cypher:{x:-18}},heights:{}};
  const journey={scene:'m1_basement',basement:state} as unknown as FilmJourney;
  const matrices=()=>['basement-ceiling-splinters','basement-ceiling-plaster','basement-ceiling-dust'].map(name=>Array.from((renderer.root.getObjectByName(name) as THREE.InstancedMesh).instanceMatrix.array));
  try{
    renderer.update(journey,undefined,.1);state.landings.apoc=.6;renderer.update(journey,undefined,.1);
    const moving=matrices();renderer.update(journey,undefined,.1);
    assert.notDeepEqual(matrices(),moving,'the burst must keep moving between server snapshots');
    state.paused=true;renderer.update(journey,undefined,.1);const paused=matrices();
    for(let frame=0;frame<8;frame++)renderer.update(journey,undefined,.25);
    assert.deepEqual(matrices(),paused,'paused debris and dust cannot continue on the browser clock');
    const restored=new BasementSetRenderer(new THREE.Group());
    try{restored.update(structuredClone(journey));for(const [index,name] of ['basement-ceiling-splinters','basement-ceiling-plaster','basement-ceiling-dust'].entries())assert.deepEqual(Array.from((restored.root.getObjectByName(name) as THREE.InstancedMesh).instanceMatrix.array),paused[index]);}finally{restored.dispose();}
    state.landings.apoc=3;renderer.update(journey);
    assert.equal(renderer.root.getObjectByName('basement-ceiling-dust')!.visible,false,'finished bursts must stop drawing empty dust');
  }finally{renderer.dispose();}
});

test('the retained upper pipe chase stays enclosed above the highest hanging crew member',t=>{
  t.mock.method(THREE.TextureLoader.prototype,'load',()=>new THREE.Texture());
  const renderer=new BasementSetRenderer(new THREE.Group()),hits=rays(renderer.root);
  try{
    assert.ok(hits(-16.4,-51,-32.2,new THREE.Vector3(0,1,0),4).length,'a fall camera must not look through the chase into the city sky');
    assert.ok(hits(-16.4,-51,-32.2,new THREE.Vector3(0,0,1),2).length,'the upper chase needs the same front enclosure as its lower section');
  }finally{renderer.dispose();}
});

test('the drain has a roof and exterior walls while both authored turns remain physically open',t=>{
  t.mock.method(THREE.TextureLoader.prototype,'load',()=>new THREE.Texture());
  const root=new THREE.Group(),renderer=new BasementSetRenderer(root),hits=rays(root),floor=BASEMENT.tunnelFloor;
  try {
    for(const [x,z] of [[9,24],[9,29],[5,30],[0,33],[0,43]])assert.ok(hits(x,floor+2,z,new THREE.Vector3(0,1,0),2).length,`roof missing at ${x},${z}`);
    for(const [x,z,d] of [[9,28,new THREE.Vector3(1,0,0)],[0,37,new THREE.Vector3(-1,0,0)],[5,30,new THREE.Vector3(0,0,-1)]] as const)
      assert.ok(hits(x,floor+1.3,z,d,2.5).length,`exterior wall missing at ${x},${z}`);
    for(let progress=.2;progress<BASEMENT_TUNNEL_LENGTH-.2;progress+=.2) {
      const a=basementTunnelRoot(progress),b=basementTunnelRoot(progress+.2),delta=new THREE.Vector3(b.x-a.x,0,b.z-a.z);
      assert.equal(hits(a.x,floor+1.4,a.z,delta.clone().normalize(),delta.length()+.01).length,0,`rendered wall blocks the actual turn at ${progress}`);
    }
  } finally {renderer.dispose();}
});

test('a launched gas canister crosses a real entry before it lands and emits smoke',t=>{
  t.mock.method(THREE.TextureLoader.prototype,'load',()=>new THREE.Texture());
  const root=new THREE.Group(),renderer=new BasementSetRenderer(root),hits=rays(root);
  try {
    renderer.update({scene:'m1_basement',basement:{hatch:0,gas:1,gasShots:[true]}} as any);
    const canister=root.getObjectByName('basement-gas-canister')!;
    assert.ok(canister.visible,'the canister must be visible in flight before the old ground-spawn time');
    assert.ok(canister.position.y>BASEMENT.floor+.8,'the canister must leave the launcher above the floor');
    assert.equal(root.getObjectByName('basement-gas-clouds')!.visible,false,'gas cannot bloom in mid-flight');
    assert.equal(hits(-25,BASEMENT.floor+3.2,-27,new THREE.Vector3(1,0,0),8).length,0,'the launcher cannot shoot through a solid basement wall');
    renderer.update({scene:'m1_basement',basement:{hatch:0,gas:3,gasShots:[true]}} as any);
    assert.ok(Math.abs(canister.position.y-BASEMENT.floor-.16)<.001,'the same canister comes to rest above the concrete');
    assert.ok(root.getObjectByName('basement-gas-clouds')!.visible);
    renderer.update({scene:'m1_basement',basement:{hatch:0,gas:3,gasShots:[false]}} as any);
    assert.equal(canister.visible,false,'a cancelled shot cannot create a canister');
    assert.equal(root.getObjectByName('basement-gas-clouds')!.visible,false,'a cancelled shot cannot create smoke');
  }finally{renderer.dispose();}
});

test('an entering pursuer’s canister waits for the interpolated firing pose and restores the exact paused trajectory',t=>{
  t.mock.method(THREE.TextureLoader.prototype,'load',()=>new THREE.Texture());
  const renderer=new BasementSetRenderer(new THREE.Group()),state={phase:'searching',hatch:0,gas:0,gasEntry:true,gasShots:[] as boolean[]};
  const journey={scene:'m1_basement',basement:state} as unknown as FilmJourney;
  try{
    renderer.update(journey,undefined,.1);state.gas=.6;state.gasShots=[true];renderer.update(journey,undefined,.1);
    const canister=renderer.root.getObjectByName('basement-gas-canister')!;
    assert.equal(canister.visible,false,'the canister must not leave before the smooth body reaches its actual firing age');
    for(let frame=0;frame<4;frame++)renderer.update(journey,undefined,.1);
    assert.equal(canister.visible,true,'the same saved shot becomes visible after the body reaches the barrel release');
    const point=basementGasCanister(0,.6,[true],true)!;assert.ok(canister.position.distanceTo(new THREE.Vector3(point.x,point.y,point.z))<.001);
    state.gas=1.1;renderer.update(journey);const paused=canister.position.clone();
    for(let frame=0;frame<8;frame++)renderer.update(journey);assert.ok(canister.position.distanceTo(paused)<.001);
    const restored=new BasementSetRenderer(new THREE.Group());
    try{restored.update(structuredClone(journey));assert.ok(restored.root.getObjectByName('basement-gas-canister')!.position.distanceTo(paused)<.001,'load cannot move the projectile back to the old muzzle');}finally{restored.dispose();}
  }finally{renderer.dispose();}
});

test('all three gas trajectories clear the authored doors, boilers and ceiling before bouncing on concrete',t=>{
  t.mock.method(THREE.TextureLoader.prototype,'load',()=>new THREE.Texture());
  const root=new THREE.Group(),renderer=new BasementSetRenderer(root),hits=rays(root);
  try {
    for(const entry of [false,true])for(const [index,gas] of BASEMENT_GAS.entries()) {
      let previous=basementGasCanister(index,basementGasLaunch(index,entry).at,[true,true,true],entry)!;
      for(let time=basementGasLaunch(index,entry).at+.025;time<=gas.at+.03;time+=.025) {
        const point=basementGasCanister(index,time,[true,true,true],entry)!,direction=new THREE.Vector3(point.x-previous.x,point.y-previous.y,point.z-previous.z),length=direction.length();
        assert.ok(point.y>=BASEMENT.floor+.159&&point.y<BASEMENT.floor+BASEMENT.ceiling-.2,'the canister must stay within the mechanical-room volume');
        if(length>.001)assert.equal(hits(previous.x,previous.y,previous.z,direction.normalize(),length+.001).length,0,`canister ${index} crosses solid geometry at ${time}`);
        previous=point;
      }
      const rest=basementGasCanister(index,gas.at+1,[true,true,true],entry)!;assert.deepEqual(rest,{x:gas.x,y:BASEMENT.floor+.16,z:gas.z});
    }
  }finally{renderer.dispose();}
});

test('the repair shop leaves the playable counter gap and mounts the receiver beside a real wall',t=>{
  t.mock.method(THREE.TextureLoader.prototype,'load',()=>new THREE.Texture());
  const root=new THREE.Group(),renderer=new TvRepairRenderer(root),hits=rays(root);
  try {
    assert.ok(root.getObjectByName('tv-street-drain'),'the street-side sewer exit must be visible at the playable spawn');
    assert.ok(root.getObjectByName('tv-street-parked-van'),'the exterior must read as a lived-in daylight street');
    assert.equal(hits(0,1.3,39,new THREE.Vector3(0,0,-1),9).length,0,'the open glass door must share the playable entrance gap');
    assert.ok(hits(-11,1.3,39,new THREE.Vector3(0,0,-1),9).length,'the display window must be rendered as a physical facade');
    assert.equal(hits(TV_EXIT.street.drain.x,2,TV_EXIT.street.drain.z,new THREE.Vector3(0,-1,0),3).length,0,'the shaft aperture cannot be capped by the road or a shallow black disc');
    assert.ok(root.getObjectByName('tv-street-shaft'),'the exit needs a deep visible shaft');
    assert.ok(root.getObjectByName('tv-street-shaft-masonry'),'the side-on climb camera needs a physical masonry backing instead of empty sky');
    assert.ok(root.getObjectByName('tv-street-ladder'),'the four bodies need a physical ladder to touch');
    const cutaway=root.getObjectByName('tv-street-cutaway-road')!,rim=root.getObjectByName('tv-street-cutaway-rim')!;renderer.update({scene:'m1_tv_exit',tvExit:{phase:'emerging',elapsed:0,emerge:{neo:.2,trinity:0,apoc:0,switch:0}}} as FilmJourney);assert.equal(cutaway.visible,false,'the camera-side road section opens only for the ladder cutaway');assert.equal(rim.visible,false,'the cutaway rim cannot cross the climber’s chest');
    renderer.update({scene:'m1_tv_exit',tvExit:{phase:'emerging',elapsed:0,emerge:{neo:.84,trinity:0,apoc:0,switch:0}}} as FilmJourney);assert.equal(cutaway.visible,false,'the road stays open while the climber’s torso is still below it');assert.equal(rim.visible,true,'the physical rim returns for the mantle grip');
    renderer.update({scene:'m1_tv_exit',tvExit:{phase:'ready',elapsed:0}} as FilmJourney);assert.equal(cutaway.visible,true,'the complete road returns before ordinary street movement');assert.equal(rim.visible,true);
    assert.ok(hits(TV_EXIT.street.drain.x+1.15,2,TV_EXIT.street.drain.z,new THREE.Vector3(0,-1,0),3).length,'the open aperture still needs a visible load-bearing rim');
    assert.equal(hits(8.5,1.3,5,new THREE.Vector3(0,0,-1),8).length,0,'right counter gap must agree with ordinary movement');
    assert.ok(hits(0,1.3,5,new THREE.Vector3(0,0,-1),8).length,'the rest of the counter remains solid');
    assert.ok(hits(TV_EXIT.phone.x,4,TV_EXIT.phone.z+.3,new THREE.Vector3(0,0,-1),1).length,'wall telephone cannot float in empty space');
    let meshes=0;root.traverse(object=>{if(object instanceof THREE.Mesh)meshes++;});
    assert.ok(meshes<70,`stationary TVs need batching, not ${meshes} separate draws`);
    const fixed=root.getObjectByName('hardline-handset')!;renderer.update({scene:'m1_tv_exit',tvExit:{phase:'pickup',elapsed:.7}} as FilmJourney);assert.equal(fixed.visible,true);
    renderer.update({scene:'m1_tv_exit',tvExit:{phase:'pickup',elapsed:.8}} as FilmJourney);assert.equal(fixed.visible,false);
    renderer.update({scene:'m1_tv_exit',tvExit:{phase:'calling',elapsed:6.7}} as FilmJourney);assert.equal(fixed.visible,true);
  } finally {renderer.dispose();}
});
