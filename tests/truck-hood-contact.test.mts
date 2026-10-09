import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, newTruckHood, truckHoodCar, truckHoodRoot, truckHoodHeight, truckHoodFallSeconds, TRUCK_HOOD, type TruckHoodGesture, type FilmJourney } from '@auto_matrix/shared';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { FreewaySetRenderer } from '../packages/client/src/engine/FreewaySetRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

test('delivered boots and palms follow the actual hood, windshield and steering wheel in warm and cold poses', async t => {
  const assets = new Map();
  for (const id of ['morpheus','smith','trinity','trinity-club','niobe-head','niobe-body']) {
    const glb = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
    const length = glb.readUInt32LE(12), source = JSON.parse(glb.subarray(20,20+length).toString());
    for (const material of source.materials ?? []) { if (material.pbrMetallicRoughness) delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
    source.images = []; source.textures = [];
    const json = Buffer.from(JSON.stringify(source)), padded = Buffer.alloc(Math.ceil(json.length/4)*4,32); json.copy(padded);
    const bin = glb.subarray(20+length), buffer = Buffer.alloc(20+padded.length+bin.length);
    buffer.writeUInt32LE(0x46546c67,0); buffer.writeUInt32LE(2,4); buffer.writeUInt32LE(buffer.length,8);
    buffer.writeUInt32LE(padded.length,12); buffer.writeUInt32LE(0x4e4f534a,16); padded.copy(buffer,20); bin.copy(buffer,20+padded.length);
    assets.set(id, await new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength),''));
  }
  t.mock.method(GLTFLoader.prototype,'loadAsync',async (url: string) => assets.get(url.split('/').pop()!.replace('.glb','')));
  t.mock.method(THREE.TextureLoader.prototype,'load',() => new THREE.Texture());
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number,h: number) => ({data:new Uint8ClampedArray(w*h*4)}), putImageData() {},
    fillRect() {},strokeRect() {},fillText() {},createRadialGradient: () => ({addColorStop() {}}),createLinearGradient: () => ({addColorStop() {}}) }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const center = FILM_SETS.film_freeway_101.center, models = new CharacterModels();
  const roles = ['morpheus','niobe','agent_johnson'] as const;
  for (const role of roles) { world.agents.get(role)!.isInMatrix = true; world.agents.get(role)!.currentLocation = 'film_freeway_101'; }
  const rigs = Object.fromEntries(roles.map(id => [id,models.create(world.agents.get(id)!)])) as Record<typeof roles[number],ReturnType<CharacterModels['create']>>;
  await new Promise(resolve => setImmediate(resolve)); assert.ok(rigs.morpheus.hero && rigs.niobe.hero);
  const groups = Object.fromEntries(roles.map(id => [id,new THREE.Group()])) as Record<typeof roles[number],THREE.Group>;
  for (const role of roles) { groups[role].add(rigs[role].root); rigs[role].root.position.y = -1; }
  const scenery = new THREE.Group(); scenery.position.set(center.x,center.y-1,center.z);
  const renderer = new FreewaySetRenderer(scenery,FILM_SETS.film_freeway_101);
  t.after(() => { models.dispose(); renderer.dispose(); globalThis.document = document; });
  const base = newTruckHood({x:0,y:6.6,z:-3.5,yaw:Math.PI},{x:0,y:6.6,z:-7.5,yaw:0},100,2);
  const truck = { x:14, z:-500 };
  let fallingEye: THREE.Vector3 | undefined;
  let fallingJoints: Record<string,THREE.Vector3> = {};
  for(const fraction of [.5,.85,.95,.9999]) {
    const h={...base,phase:'falling' as const,elapsed:truckHoodFallSeconds()*fraction};h.car=truckHoodCar(h);
    const p=truckHoodRoot(h,'morpheus'),rig=rigs.morpheus,group=groups.morpheus;
    group.position.set(center.x+truck.x+p.x,center.y+p.y,center.z+truck.z+p.z);rig.root.rotation.y=p.yaw;
    models.animate(rig,0,{speed:0,grounded:false,verticalVelocity:0,turn:0,truckHood:{...h,role:'morpheus',truck}},0);group.updateMatrixWorld(true);
    const hits:Record<string,unknown>={};
    rig.root.traverseVisible(mesh=>{if(mesh instanceof THREE.Mesh)for(let i=0;i<mesh.geometry.attributes.position.count;i++){
      const local=mesh.localToWorld(mesh.getVertexPosition(i,new THREE.Vector3())).sub(new THREE.Vector3(center.x+truck.x+h.car.x,center.y-1,center.z+truck.z+h.car.z)).applyAxisAngle(new THREE.Vector3(0,1,0),-h.car.yaw);
      if(Math.abs(local.x)<1.7&&local.z>=-.6&&local.z<=4.5&&local.y<truckHoodHeight(local.z)-.06)hits[mesh.name]??=local.toArray();
    }});
    assert.deepEqual(hits,{},`fall ${fraction}: the actual body/coat cannot pass through the car before the back impact`);
    fallingEye=rig.hero!.bones.get('head')!.getWorldPosition(new THREE.Vector3());
    fallingJoints=Object.fromEntries(['knee_R','knee_L','ankle_R','ankle_L','wrist_R','wrist_L'].map(name=>[name,rig.hero!.bones.get(name)!.getWorldPosition(new THREE.Vector3())]));
  }
  const impact = {...base,phase:'impact',elapsed:.2,total:2.2,glassAge:.2,car:{x:5.3,z:-4.9,yaw:0}} as unknown as TruckHoodGesture;
  const impactJourney = {scene:'m2_trucks',step:0,trucks:{phase:'duel',elapsed:0,attempt:2,road:{truck,elapsed:7,phase:'ready',bridgeZ:-470},hood:impact}} as unknown as FilmJourney;
  renderer.update(impactJourney,0); scenery.updateMatrixWorld(true);
  const cracks = scenery.getObjectByName('niobe-windshield-cracks') as THREE.Mesh;
  assert.ok(cracks?.visible && cracks.geometry.drawRange.count > 0,'a saved back impact must visibly crack the actual windshield');
  const vertices = cracks.geometry.attributes.position;
  for(let i=0;i<vertices.count;i++) {
    const z=vertices.getZ(i); assert.ok(z>=-.65&&z<=1.2 && Math.abs(vertices.getX(i))<=1.73,'fractures must remain on the windshield');
    assert.ok(Math.abs(vertices.getY(i)-truckHoodHeight(z))<.04,'fractures must follow the inclined glass surface');
  }
  for (const elapsed of [0,.2,.55,1,1.5,2.2]) {
    const h={...impact,elapsed}, p=truckHoodRoot(h,'morpheus'), rig=rigs.morpheus, group=groups.morpheus;
    group.position.set(center.x+truck.x+p.x,center.y+p.y,center.z+truck.z+p.z); rig.root.rotation.y=p.yaw;
    models.animate(rig,.05,{speed:0,grounded:false,verticalVelocity:0,turn:0,truckHood:{...h,role:'morpheus',truck}},0);
    group.updateMatrixWorld(true); rig.root.traverse(o=>{if(o instanceof THREE.SkinnedMesh)o.skeleton.update();});
    let closest=Infinity, beneath=0;const hits:Record<string,unknown>={};
    rig.root.traverseVisible(mesh=>{if(mesh instanceof THREE.Mesh)for(let i=0;i<mesh.geometry.attributes.position.count;i++){
      const local=mesh.localToWorld(mesh.getVertexPosition(i,new THREE.Vector3())).sub(new THREE.Vector3(center.x+truck.x+h.car.x,center.y-1,center.z+truck.z+h.car.z));
      if(Math.abs(local.x)>1.7||local.z<-.6||local.z>4.5)continue;
      const gap=local.y-truckHoodHeight(local.z);
      if(gap<-.06){beneath++;hits[mesh.name]??=local.toArray();}
      if(mesh.name.includes('Tailored_coat_upper')&&mesh.geometry.attributes.position.getZ(i)<-.12&&local.z<1.17)closest=Math.min(closest,gap);
    }});
    assert.equal(beneath,0,`impact ${elapsed}: delivered body/coat penetrates the car: ${JSON.stringify(hits)}`);
    if(elapsed<=.55)assert.ok(closest<.27,`impact ${elapsed}: the delivered back must land on the windshield rather than hover above it: gap=${closest}`);
    const eye=rig.hero!.bones.get('head')!.getWorldPosition(new THREE.Vector3());
    if(elapsed===0)assert.ok(eye.distanceTo(fallingEye!)<.12,`back contact cannot teleport the delivered body: eye moves ${eye.distanceTo(fallingEye!)}`);
    if(elapsed===0)for(const [name,point]of Object.entries(fallingJoints))assert.ok(point.distanceTo(rig.hero!.bones.get(name)!.getWorldPosition(new THREE.Vector3()))<.15,`${name} jumps when falling changes to back impact`);
    const cloth=rig.hero!.panels.map(panel=>Array.from(panel.mesh.geometry.attributes.position.array));
    models.animate(rig,0,{speed:0,grounded:false,verticalVelocity:0,turn:0,truckHood:{...h,role:'morpheus',truck}},0);group.updateMatrixWorld(true);
    assert.ok(eye.distanceTo(rig.hero!.bones.get('head')!.getWorldPosition(new THREE.Vector3()))<.01,'saved impact must restore the same head pose');
    assert.deepEqual(rig.hero!.panels.map(panel=>Array.from(panel.mesh.geometry.attributes.position.array)),cloth,'saved impact must restore the complete cloth shape');
  }
  for (const [phase, elapsed] of [['hood',.2],['passing',1.8],['ready',.5],['running',.1],['running',.4],['running',.62]] as const) {
    const h = {...base,phase,elapsed,total:4+elapsed,car:{x:5.3,z:-6.6,yaw:0}};
    h.car = phase === 'passing' ? truckHoodCar(h) : phase === 'ready' || phase === 'running' ? {x:.3,z:20.5,yaw:0} : h.car;
    const journey = {scene:'m2_trucks',step:0,trucks:{phase:'duel',elapsed:0,attempt:2,road:{truck,elapsed:7,phase:'ready',bridgeZ:-470},hood:h}} as unknown as FilmJourney;
    renderer.update(journey,0);
    scenery.updateMatrixWorld(true);
    for (const role of roles) {
      const rig = rigs[role], group = groups[role], p = truckHoodRoot(h,role), gesture = {...h,role,truck} as TruckHoodGesture;
      group.position.set(center.x+truck.x+p.x,center.y+p.y,center.z+truck.z+p.z); rig.root.rotation.y=p.yaw;
      models.animate(rig,.05,{speed:0,grounded:true,verticalVelocity:0,turn:0,truckHood:gesture},0);
      group.updateMatrixWorld(true); rig.root.traverse(o=>{if(o instanceof THREE.SkinnedMesh)o.skeleton.update();});
      const supports: number[]=[];
      for (const side of ['R','L']) {
        const ankle=rig.hero!.bones.get(`ankle_${side}`)!, point=ankle.getWorldPosition(new THREE.Vector3());
        const local=point.clone().sub(new THREE.Vector3(center.x+truck.x+h.car.x,center.y-1,center.z+truck.z+h.car.z)).applyAxisAngle(new THREE.Vector3(0,1,0),-h.car.yaw);
        const floor = role === 'niobe' ? .68 : role === 'agent_johnson' ? 6.6 : truckHoodHeight(local.z);
        const gap = local.y-rig.hero!.footHeight-floor;
        supports.push(gap);
        assert.ok(gap>-.08&&gap<(role === 'morpheus'&&phase === 'running' ? .38 : .08),`${phase} ${elapsed} ${role} ${side}: the delivered boot misses the support by ${gap}`);
      }
      if(role === 'morpheus'&&phase === 'running')assert.ok(Math.min(...supports)<.08&&Math.max(...supports)>.1,'the windshield run needs a planted boot and an alternating lifted boot');
      if (role === 'niobe' || role === 'morpheus' && phase === 'hood') {
        for (const [i,side] of ['R','L'].entries()) {
          const palm = rig.hero!.bones.get(`wrist_${side}`)!.localToWorld(new THREE.Vector3(i ? -.09 : .09,-.18,.02));
          const x=role === 'niobe' ? TRUCK_HOOD.driver.x+(i ? .32 : -.32) : h.balance+(i ? .66 : -.66);
          const z=role === 'niobe' ? TRUCK_HOOD.wheel.z : 3.7, y=role === 'niobe' ? TRUCK_HOOD.wheel.y : truckHoodHeight(z)+.12;
          const expected=new THREE.Vector3(center.x+truck.x+h.car.x+x*Math.cos(h.car.yaw)+z*Math.sin(h.car.yaw),center.y-1+y,center.z+truck.z+h.car.z+z*Math.cos(h.car.yaw)-x*Math.sin(h.car.yaw));
          assert.ok(palm.distanceTo(expected)<.09,`${phase} ${role}: palm misses its actual contact by ${palm.distanceTo(expected)}: actual=${palm.toArray()}, expected=${expected.toArray()}, shoulder=${rig.hero!.bones.get(`shoulder_${side}`)!.getWorldPosition(new THREE.Vector3()).toArray()}`);
        }
      }
      if (role === 'morpheus') {
        let below=0; const intersections: Record<string,unknown> = {};
        rig.root.traverseVisible(mesh=>{if(mesh instanceof THREE.Mesh)for(let i=0;i<mesh.geometry.attributes.position.count;i++){
          const point=mesh.localToWorld(mesh.getVertexPosition(i,new THREE.Vector3()));
          const local=point.sub(new THREE.Vector3(center.x+truck.x+h.car.x,center.y-1,center.z+truck.z+h.car.z)).applyAxisAngle(new THREE.Vector3(0,1,0),-h.car.yaw);
          if(Math.abs(local.x)<1.9&&local.z>-.6&&local.z<4.5&&local.y<truckHoodHeight(local.z)-.07){below++; intersections[mesh.name] ??= {point:local.toArray(),floor:truckHoodHeight(local.z)};}
        }});
        assert.equal(below,0,`${phase} ${elapsed}: sampled delivered body/coat enters the shared car surface: ${JSON.stringify(intersections)}`);
      }
      if (role === 'niobe') {
        let highest=-Infinity;const hits: Record<string,unknown>={};
        rig.root.traverseVisible(mesh=>{if(mesh instanceof THREE.Mesh)for(let i=0;i<mesh.geometry.attributes.position.count;i++){
          const local=mesh.localToWorld(mesh.getVertexPosition(i,new THREE.Vector3())).sub(new THREE.Vector3(center.x+truck.x+h.car.x,center.y-1,center.z+truck.z+h.car.z)).applyAxisAngle(new THREE.Vector3(0,1,0),-h.car.yaw);
          if(Math.abs(local.x)<1.8&&local.z> -2.2&&local.z<-.65){highest=Math.max(highest,local.y);if(local.y>2.925)hits[mesh.name]??=local.toArray();}
        }});
        assert.ok(highest<=2.925,`the driver enters the coupe roof: highest=${highest}, hits=${JSON.stringify(hits)}`);
      }
      const before=rig.hero!.bones.get('head')!.getWorldPosition(new THREE.Vector3());
      models.animate(rig,0,{speed:0,grounded:true,verticalVelocity:0,turn:0,truckHood:gesture},0);group.updateMatrixWorld(true);
      assert.ok(before.distanceTo(rig.hero!.bones.get('head')!.getWorldPosition(new THREE.Vector3()))<.01,'zero-delta saved pose differs');
    }
  }
  const kick = {...base,phase:'flight' as const,elapsed:1.49,total:10.49,kickQueued:true,car:{x:.3,z:20.5,yaw:0}};
  for (const role of ['morpheus','agent_johnson'] as const) {
    const p=truckHoodRoot(kick,role), group=groups[role];
    group.position.set(center.x+truck.x+p.x,center.y+p.y,center.z+truck.z+p.z); rigs[role].root.rotation.y=p.yaw;
    models.animate(rigs[role],.05,{speed:0,grounded:false,verticalVelocity:0,turn:0,truckHood:{...kick,role,truck}},0);
    group.updateMatrixWorld(true); rigs[role].root.traverse(o=>{if(o instanceof THREE.SkinnedMesh)o.skeleton.update();});
  }
  const shoe: THREE.Vector3[] = [];
  rigs.morpheus.root.traverseVisible(mesh=>{
    if(!(mesh instanceof THREE.SkinnedMesh)||!mesh.name.includes('shoes'))return;
    const indices=mesh.geometry.attributes.skinIndex, weights=mesh.geometry.attributes.skinWeight;
    for(let i=0;i<indices.count;i++) {
      const joints=new THREE.Vector4().fromBufferAttribute(indices,i), blend=new THREE.Vector4().fromBufferAttribute(weights,i);
      let right=false;
      for(let k=0;k<4;k++) {
        let bone: THREE.Object3D | null=mesh.skeleton.bones[joints.getComponent(k)];
        if(blend.getComponent(k)<.1)continue;
        while(bone){if(bone.name==='ankle_R')right=true;bone=bone.parent;}
      }
      if(right)shoe.push(mesh.localToWorld(mesh.getVertexPosition(i,new THREE.Vector3())));
    }
  });
  assert.ok(shoe.length>100,'inspect the delivered kicking shoe, including its toe');
  const chest=rigs.agent_johnson.hero!.bones.get('chest')!.getWorldPosition(new THREE.Vector3());
  const bodies: THREE.Object3D[]=[];
  rigs.agent_johnson.root.traverseVisible(mesh=>{if(mesh instanceof THREE.Mesh&&!mesh.name.includes('shoes'))bodies.push(mesh);});
  const toe=shoe.reduce((a,b)=>a.z<b.z?a:b), ray=new THREE.Raycaster(new THREE.Vector3(toe.x,toe.y,chest.z+3),new THREE.Vector3(0,0,-1),0,6);
  const front=ray.intersectObjects(bodies,false)[0];
  assert.ok(front,'the actual kicking toe must meet Johnson\'s torso, not empty space');
  const gap=toe.z-front.point.z;
  assert.ok(gap>=-.04&&gap<.15,`delivered toe/chest contact gap ${gap}: toe=${toe.toArray()}, body=${front.point.toArray()}, ankle=${rigs.morpheus.hero!.bones.get('ankle_R')!.getWorldPosition(new THREE.Vector3()).toArray()}`);
});
