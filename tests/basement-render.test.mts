import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { BASEMENT, BASEMENT_GAS, TV_EXIT, BASEMENT_TUNNEL_LENGTH, basementGasCanister, basementGasLaunch, basementTunnelRoot, type FilmJourney } from '@auto_matrix/shared';
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

test('all three gas trajectories clear the authored doors, boilers and ceiling before bouncing on concrete',t=>{
  t.mock.method(THREE.TextureLoader.prototype,'load',()=>new THREE.Texture());
  const root=new THREE.Group(),renderer=new BasementSetRenderer(root),hits=rays(root);
  try {
    for(const [index,gas] of BASEMENT_GAS.entries()) {
      let previous=basementGasCanister(index,basementGasLaunch(index).at,[true,true,true])!;
      for(let time=basementGasLaunch(index).at+.025;time<=gas.at+.03;time+=.025) {
        const point=basementGasCanister(index,time,[true,true,true])!,direction=new THREE.Vector3(point.x-previous.x,point.y-previous.y,point.z-previous.z),length=direction.length();
        assert.ok(point.y>=BASEMENT.floor+.159&&point.y<BASEMENT.floor+BASEMENT.ceiling-.2,'the canister must stay within the mechanical-room volume');
        if(length>.001)assert.equal(hits(previous.x,previous.y,previous.z,direction.normalize(),length+.001).length,0,`canister ${index} crosses solid geometry at ${time}`);
        previous=point;
      }
      const rest=basementGasCanister(index,gas.at+1,[true,true,true])!;assert.deepEqual(rest,{x:gas.x,y:BASEMENT.floor+.16,z:gas.z});
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
