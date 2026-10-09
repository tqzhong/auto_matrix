import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, TRUCK_ROAD, newTruckRoad, truckRoadRoot, type FilmJourney } from '@auto_matrix/shared';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { FreewaySetRenderer } from '../packages/client/src/engine/FreewaySetRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

test('actual boots, the bridge edge and the trailer share the same saved road clock', async t => {
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
  const roles = ['morpheus','keymaker','agent_johnson','niobe'] as const;
  for (const role of roles) { world.agents.get(role)!.isInMatrix = true; world.agents.get(role)!.currentLocation = 'film_freeway_101'; }
  const rigs = Object.fromEntries(roles.map(id => [id,models.create(world.agents.get(id)!)])) as Record<typeof roles[number],ReturnType<CharacterModels['create']>>;
  await new Promise(resolve => setImmediate(resolve)); assert.ok(rigs.morpheus.hero && rigs.agent_johnson.hero && rigs.niobe.hero);
  const groups = Object.fromEntries(roles.map(id => [id,new THREE.Group()])) as Record<typeof roles[number],THREE.Group>;
  for (const role of roles) { groups[role].add(rigs[role].root); rigs[role].root.position.y = -1; }
  const scenery = new THREE.Group(); scenery.position.set(center.x,center.y-1,center.z);
  const renderer = new FreewaySetRenderer(scenery,FILM_SETS.film_freeway_101);
  t.after(() => { models.dispose(); renderer.dispose(); globalThis.document = document; });
  const road = newTruckRoad({x:14,z:-600},{x:.3,y:6.6,z:-3.5,yaw:Math.PI},{x:1.15,y:6.6,z:-.6,yaw:0},100);
  const journey: FilmJourney = { version:1,scene:'m2_trucks',actor:'morpheus',step:0,completed:[],enteredAt:1,checkpoint:{...center},reflections:{},lastText:'',trucks:{phase:'duel',elapsed:0,lastTick:1,attempt:0,road} };
  const sole = (role: typeof roles[number]) => {
    const rig = rigs[role], points: number[] = [];
    if (rig.hero) for (const side of ['R','L']) points.push(rig.hero.bones.get(`ankle_${side}`)!.getWorldPosition(new THREE.Vector3()).y - rig.hero.footHeight);
    else for (const ankle of rig.ankles) ankle.traverseVisible(object => { if (object instanceof THREE.Mesh) for (let i=0;i<object.geometry.attributes.position.count;i++)
      points.push(object.localToWorld(object.getVertexPosition(i,new THREE.Vector3())).y); });
    return Math.min(...points);
  };
  for (const elapsed of [0,2.95,3.05,3.2,3.6,4.1,TRUCK_ROAD.approach+TRUCK_ROAD.drop+.2,5]) {
    road.elapsed = elapsed; road.truck.z = -600 + elapsed*24;
    road.phase = elapsed<3 ? 'approach' : elapsed<3+TRUCK_ROAD.drop ? 'dropping' : elapsed<3+TRUCK_ROAD.drop+.4 ? 'landing' : 'ready';
    renderer.update(journey,9999); scenery.updateMatrixWorld(true);
    for (const role of roles) {
      const root = role==='morpheus' ? {x:road.truck.x+.3,y:6.6,z:road.truck.z-3.5,yaw:Math.PI}
        : role==='niobe' ? {x:road.truck.x+7,y:.5,z:road.truck.z-9,yaw:Math.PI} : truckRoadRoot(road,role);
      groups[role].position.set(center.x+root.x,center.y+root.y,center.z+root.z); rigs[role].root.rotation.y=root.yaw;
      models.animate(rigs[role],0,{speed:0,grounded:role!=='niobe' && !(role==='agent_johnson' && road.phase==='dropping'),verticalVelocity:0,turn:0,seated:role==='niobe',truckRoad:{...road,role}},0);
      groups[role].updateMatrixWorld(true);
      const foot = sole(role);
      if (role==='morpheus' || role==='keymaker' && (elapsed===0 || elapsed>=3) || role==='agent_johnson' && elapsed>=3+TRUCK_ROAD.drop)
        assert.ok(Math.abs(foot-6.65)<.15, `${role} boots miss actual roof: ${foot} at ${elapsed}`);
      if (role==='agent_johnson') {
        const bridge = scenery.getObjectByName('matrix-freeway-johnson-overpass')!;
        rigs[role].root.traverseVisible(object => {
          if (!(object instanceof THREE.Mesh)) return;
          if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
          for (let i=0;i<object.geometry.attributes.position.count;i++) {
            const point = bridge.worldToLocal(object.localToWorld(object.getVertexPosition(i,new THREE.Vector3())));
            assert.ok(Math.abs(point.z)>7.01 || point.y<15.57 || point.y>=16.52,
              `the real body enters the solid bridge deck: ${elapsed}, ${point.toArray()}`);
          }
        });
      }
      if (role==='niobe') {
        let top = -Infinity; rigs[role].root.traverseVisible(object => { if (object instanceof THREE.Mesh) { if (object instanceof THREE.SkinnedMesh) object.skeleton.update(); for (let i=0;i<object.geometry.attributes.position.count;i++) top = Math.max(top,object.localToWorld(object.getVertexPosition(i,new THREE.Vector3())).y); } });
        assert.ok(top<3.25, `the driver's head must fit under the car roof: ${top}`);
        assert.ok(foot>.5, `the driver's boots must remain inside the cabin: ${foot}`);
      }
    }
    const hero = scenery.getObjectByName('matrix-freeway-handoff-truck')!;
    assert.equal(hero.position.z,road.truck.z); assert.equal(hero.rotation.y,Math.PI);
  }
});
