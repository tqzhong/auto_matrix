import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FreewaySetRenderer } from '../packages/client/src/engine/FreewaySetRenderer.js';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import type { CharacterRig } from '../packages/client/src/agents/CharacterModel.js';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { FILM_SETS, newTruckRoad, newTruckWeapons, newTruckHood, truckHoodRoot, truckRoadRoot, truckRescuePose, type TruckEncounter, type PlayerInput } from '@auto_matrix/shared';

async function loadGeometry(id = 'neo') {
  const glb = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
  const jsonLength = glb.readUInt32LE(12);
  const document = JSON.parse(glb.subarray(20, 20 + jsonLength).toString());
  // Decode the shipped geometry with the real loader, without a DOM/image
  // decoder. Material/texture appearance is checked in the browser.
  for (const material of document.materials) {
    delete material.pbrMetallicRoughness.baseColorTexture;
    delete material.normalTexture;
  }
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document));
  const padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = glb.subarray(20 + jsonLength);
  const result = Buffer.alloc(20 + padded.length + bin.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16);
  padded.copy(result, 20); bin.copy(result, 20 + padded.length);
  return new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
}


async function setup(t: TestContext) {
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking', 'morpheus', 'smith'].map(async id => [id, await loadGeometry(id)] as const)));
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async (path: string) => assets.get(path.split('/').pop()!.replace(/\.glb.*$/, ''))!);
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  class InputTarget extends EventTarget { matches() { return false; } }
  const window = new InputTarget(), canvas = new InputTarget();
  const context = { createRadialGradient: () => ({ addColorStop() {} }), createLinearGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} };
  const document = Object.assign(new InputTarget(), { pointerLockElement: null as unknown, hidden: false, exitPointerLock() {},
    createElement: () => ({ width: 0, height: 0, getContext: () => context }) });
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  Object.assign(globalThis, { window, document });
  let time = 2000; t.mock.method(performance, 'now', () => time);
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const actors = ['neo', 'morpheus', 'keymaker'].map(id => world.agents.get(id)!);
  const state = actors[1];
  for (const actor of actors) { actor.currentLocation = 'film_freeway_trucks'; actor.isInMatrix = true; }
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000), renderer = new AgentRenderer(new THREE.Scene());
  for (const actor of actors) renderer.updateAgent(actor.id, actor);
  await new Promise(resolve => setImmediate(resolve));
  const group = renderer.getAgent(state.id)!, head = group.getObjectByName('head');
  assert.ok(head instanceof THREE.Bone, 'the camera must follow the shipped GLB head, not a mock position');
  const sent: PlayerInput[] = [];
  const controls = new PlayerControls(canvas as unknown as HTMLCanvasElement, camera, input => sent.push(input), () => {});
  controls.possess(state); controls.firstPerson = true;
  const frame = (elapsed: number, running = false, saved?: TruckEncounter) => {
    const encounter: TruckEncounter = saved ?? { phase: 'rescue', elapsed: 9.7, rescueElapsed: elapsed, lastTick: 0, attempt: 0 };
    const location = encounter.road ? 'film_freeway_101' : 'film_freeway_trucks', center = FILM_SETS[location].center;
    for (const actor of actors) {
      const role = actor.id as 'neo' | 'morpheus' | 'keymaker', pose = truckRescuePose(encounter, role);
      actor.currentLocation = location;
      actor.position = { x: center.x + pose.x, y: center.y + pose.y, z: center.z + pose.z }; actor.rotation = pose.yaw;
      actor.currentAction = { type: 'move_to', parameters: { truckFlight: role === 'neo', truckPassenger: role !== 'neo',
        truckRescue: { ...encounter, role }, truckRoad: encounter.road && { ...encounter.road, role } }, startedAt: 0, duration: 1000, progress: 0 };
      renderer.updateAgent(actor.id, actor);
    }
    time += 20;
    // Engine solves input/camera first, then the actual body; the camera must be corrected before rendering.
    controls.update(.02, state, group, running); renderer.setPlayer(state.id, controls.firstPerson); renderer.setPlayerMotion(controls.motion);
    renderer.update(.02, camera, running ? 1 : 0);
    const inputCount = sent.length;
    controls.syncTruckRescueCamera(group);
    assert.equal(sent.length, inputCount, 'post-pose camera correction must not send player input again');
    return head!.localToWorld(new THREE.Vector3(0, .1, .32));
  };
  const look = () => { document.pointerLockElement = canvas; document.dispatchEvent(Object.assign(new Event('mousemove'), { movementX: 140, movementY: -50 })); };
  t.after(() => { controls.dispose(); renderer.dispose(); ['window', 'document'].forEach((key, i) => {
    if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!); else Reflect.deleteProperty(globalThis, key);
  }); });
  const crewPoints = () => {
    const entries = (renderer as unknown as { agents: Map<string, { rig: CharacterRig }> }).agents;
    return actors.flatMap(actor => {
      const rig = entries.get(actor.id)!.rig; rig.root.updateWorldMatrix(true, true);
      const head = rig.hero?.bones.get('head') ?? rig.head, chest = rig.hero?.bones.get('chest');
      return [{ role: actor.id, part: 'head', point: head.getWorldPosition(new THREE.Vector3()) },
        { role: actor.id, part: 'chest', point: chest ? chest.getWorldPosition(new THREE.Vector3()) : rig.torso.localToWorld(new THREE.Vector3(0, 1.25, 0)) }];
    });
  };
  return { controls, camera, group, frame, look, sent, crewPoints, state, renderer, world };
}

test('a cold-loaded truck first-person camera uses the current GLB pose in the first rendered frame', async t => {
  const h = await setup(t);
  for (const elapsed of [1.7, .1, .35, 2.8, 2.95]) {
    const eye = h.frame(elapsed);
    assert.ok(h.camera.position.distanceTo(eye) < .0001,
      `${elapsed}s camera uses the previous body frame: eye error ${h.camera.position.distanceTo(eye)}`);
  }
});

test('post-pose truck camera preserves pause, free look and the third-person camera', async t => {
  const h = await setup(t); h.frame(1.7);
  const paused = h.camera.position.clone(), beforeLook = h.camera.getWorldDirection(new THREE.Vector3());
  h.frame(1.7); assert.ok(h.camera.position.distanceTo(paused) < .0001, 'a paused rescue camera cannot creep toward an old skeleton pose');
  h.look(); const eye = h.frame(1.7);
  assert.ok(h.camera.position.distanceTo(eye) < .0001);
  assert.ok(h.camera.getWorldDirection(new THREE.Vector3()).distanceTo(beforeLook) > .1, 'the pose correction must preserve mouse yaw and pitch');
  h.controls.firstPerson = false; h.frame(1.7);
  const third = h.camera.position.clone(), direction = h.camera.getWorldDirection(new THREE.Vector3());
  h.controls.syncTruckRescueCamera(h.group);
  assert.deepEqual(h.camera.position, third); assert.deepEqual(h.camera.getWorldDirection(new THREE.Vector3()), direction);
});

for (const aspect of [16 / 9, 9 / 16]) test(`the airborne truck camera frames the real three-person heads and chests at aspect ${aspect}`, async t => {
  const h = await setup(t); h.controls.firstPerson = false; h.camera.aspect = aspect;
  for (const elapsed of [1.6, 1.7, 1.8]) {
    h.frame(elapsed); h.camera.updateMatrixWorld(true);
    for (const { role, part, point } of h.crewPoints()) {
      const screen = point.project(h.camera);
      assert.ok(Math.abs(screen.x) < .72 && Math.abs(screen.y) < .5 && screen.z > -1 && screen.z < 1,
        `${elapsed}s ${role} ${part} is outside the central frame: ${screen.toArray()}`);
    }
  }
});

for (const aspect of [16 / 9,9 / 16]) test(`the bridge cannot block the descending agent in the road entry camera at aspect ${aspect}`, async t => {
  const h = await setup(t), center = FILM_SETS.film_freeway_101.center;
  h.controls.firstPerson = false; h.camera.aspect = aspect;
  const road = newTruckRoad({x:14,z:-600},{x:.3,y:6.6,z:-3.5,yaw:Math.PI},{x:1.15,y:6.6,z:-.6,yaw:0},100);
  const scenery = new THREE.Group(); scenery.position.set(center.x,center.y-1,center.z);
  const renderer = new FreewaySetRenderer(scenery,FILM_SETS.film_freeway_101); t.after(() => renderer.dispose());
  for (const elapsed of [3.6,3.75,4.1]) {
    road.elapsed=elapsed; road.phase='dropping'; road.truck.z=-600+elapsed*24;
    h.state.currentLocation='film_freeway_101'; h.state.position={x:center.x+14.3,y:center.y+6.6,z:center.z+road.truck.z-3.5}; h.state.rotation=Math.PI;
    h.state.currentAction={type:'idle',parameters:{resolved:true,truckRoad:{...road,role:'morpheus'}},startedAt:1,duration:1e9,progress:0};
    h.controls.possess(h.state); h.controls.update(0,h.state,h.group,false); h.camera.updateMatrixWorld(true);
    renderer.update({version:1,scene:'m2_trucks',actor:'morpheus',step:0,completed:[],enteredAt:1,checkpoint:{...h.state.position},reflections:{},lastText:'',trucks:{phase:'duel',elapsed:0,lastTick:1,attempt:0,road}},0); scenery.updateMatrixWorld(true);
    const root=truckRoadRoot(road,'agent_johnson'), point=new THREE.Vector3(center.x+root.x,center.y+root.y+2.99,center.z+root.z);
    const screen=point.clone().project(h.camera);
    assert.ok(Math.abs(screen.x)<.85 && Math.abs(screen.y)<.8 && screen.z<1 && screen.z>-1, `the descending head is clipped at ${elapsed}: ${screen.toArray()}`);
    const direction=point.clone().sub(h.camera.position), ray=new THREE.Raycaster(h.camera.position,direction.clone().normalize(),0,direction.length()-.3);
    assert.equal(ray.intersectObject(scenery.getObjectByName('matrix-freeway-johnson-overpass')!,true).length,0, 'the solid bridge blocks the entry camera');
  }
});

test('the continuous-road rescue clears the real overpass and keeps all three bodies visible after a retry', async t => {
  const h = await setup(t), center = FILM_SETS.film_freeway_101.center;
  h.controls.firstPerson = false;
  const road = newTruckRoad({ x: 13.7, z: 408.50096 }, { x: .3, y: 6.6, z: -3.5, yaw: Math.PI / 2 }, { x: 1.3, y: 6.6, z: -10.2, yaw: Math.PI }, 100);
  road.phase = 'ready'; road.elapsed = 41.109; road.bridgeZ = -471.39624;
  const scenery = new THREE.Group(); scenery.position.set(center.x, center.y - 1, center.z);
  const freeway = new FreewaySetRenderer(scenery, FILM_SETS.film_freeway_101); t.after(() => freeway.dispose());
  const starts = { morpheus: { x: 13.13581844, y: 6.6, z: 401.16015308, yaw: .22131444 },
    keymaker: { x: 15, y: 6.6, z: 398.30096, yaw: 0 }, neo: { x: 13.7, y: 23, z: 491.50096, yaw: Math.PI } };
  for (const aspect of [16 / 9, 9 / 16]) for (const rescueElapsed of [1.3, 1.45, 1.548, 1.7, 1.85, 2, 2.2, 2.7]) {
    h.camera.aspect = aspect; h.camera.updateProjectionMatrix();
    const encounter: TruckEncounter = { phase: 'rescue', elapsed: 10, rescueElapsed, lastTick: 482, attempt: 4, road, starts };
    h.frame(rescueElapsed, false, encounter); h.camera.updateMatrixWorld(true);
    freeway.update({ scene: 'm2_trucks', actor: 'morpheus', step: 2, trucks: encounter } as never, 0); scenery.updateMatrixWorld(true);
    const opaque: THREE.Object3D[] = [];
    scenery.traverseVisible(object => { if (object instanceof THREE.Mesh && object.material instanceof THREE.Material && !object.material.transparent) opaque.push(object); });
    for (const { role, part, point } of h.crewPoints()) {
      const screen = point.clone().project(h.camera), direction = point.clone().sub(h.camera.position);
      assert.ok(Math.abs(screen.x) < .85 && Math.abs(screen.y) < .85 && screen.z > -1 && screen.z < 1, `${role}/${part}/${rescueElapsed} is outside the rescue frame: ${screen.toArray()}`);
      const hits = new THREE.Raycaster(h.camera.position, direction.clone().normalize(), .06, direction.length() - .15).intersectObjects(opaque, false);
      assert.equal(hits.length, 0, `${role}/${part}/${rescueElapsed} is hidden by real highway geometry at ${hits[0]?.point.toArray()}`);
      assert.ok(point.z < center.z + 391 || point.z > center.z + 409 || point.y < center.y - 1 + 15.2 || point.y > center.y - 1 + 18,
        `${role}/${part}/${rescueElapsed} enters the actual bridge deck or girders`);
    }
  }
});

test('truck transport cannot turn a stationary player into a running animation', async t => {
  const h=await setup(t), center=FILM_SETS.film_freeway_101.center;
  const road=newTruckRoad({x:14,z:-600},{x:.3,y:6.6,z:-3.5,yaw:Math.PI},{x:1.15,y:6.6,z:-.6,yaw:0},100);
  road.elapsed=5; road.phase='ready'; h.state.currentLocation='film_freeway_101';
  h.state.position={x:center.x+14.3,y:center.y+6.6,z:center.z-603.5}; h.state.velocity={x:0,y:0,z:0};
  h.state.currentAction={type:'idle',parameters:{resolved:true,truckRoad:{...road,role:'morpheus'}},startedAt:1,duration:1e9,progress:0};
  h.controls.possess(h.state); h.controls.update(.05,h.state,h.group,true);
  const next={...h.state,position:{...h.state.position,z:h.state.position.z+1.2},currentAction:{...h.state.currentAction,parameters:{resolved:true,truckRoad:{...road,truck:{x:14,z:-598.8},role:'morpheus'}}}};
  h.controls.update(.05,next,h.group,true);
  assert.equal(h.controls.motion.speed,0,'animation speed must exclude the moving platform');
});

test('Neo carrying a passenger keeps movement locked when the saved road approach is ready', async t => {
  const h = await setup(t); h.frame(1.7);
  const road = newTruckRoad({x:14,z:-600},{x:.3,y:6.6,z:-3.5,yaw:Math.PI},{x:1.15,y:6.6,z:-.6,yaw:0},100);
  road.elapsed = 5; road.phase = 'ready';
  h.state.currentAction!.parameters.truckRoad = { ...road, role: 'morpheus' };
  h.controls.update(0,h.state,h.group,false);
  assert.equal(h.controls.performing,true,'road metadata cannot unlock a passenger during the flight');
});

test('leaving a truck duel cannot carry weapon poses into another character', async t => {
  const h = await setup(t);
  const weapons = { ...newTruckWeapons(), role: 'morpheus' as const, bodies: {
    morpheus: { x: 0, y: 6.6, z: -3.5, yaw: Math.PI }, agent_johnson: { x: 0, y: 6.6, z: -5.35, yaw: 0 }
  }, truck: { x: 14, z: -600 } };
  h.controls.motion.truckWeapons = weapons;
  h.controls.release();
  assert.equal(h.controls.motion.truckWeapons, undefined);
  h.controls.motion.truckWeapons = weapons;
  h.controls.possess({ ...h.state, id: 'neo', currentAction: null });
  assert.equal(h.controls.motion.truckWeapons, undefined);
});

test('first-person truck combat retains actual hands and weapons while removing the camera-side face', async t => {
  const h = await setup(t), center = FILM_SETS.film_freeway_101.center;
  const body = { x: .3, y: 6.6, z: -3.5, yaw: Math.PI };
  const road = newTruckRoad({ x: 14, z: -600 }, body, { x: 1, y: 6.6, z: -10.2, yaw: 0 }, 100); road.phase = 'ready'; road.elapsed = 5;
  const weapons = { ...newTruckWeapons(), role: 'morpheus' as const, truck: road.truck, bodies: {
    morpheus: body, agent_johnson: { ...body, z: -7.5, yaw: 0 }
  } };
  h.state.currentLocation = 'film_freeway_101'; h.state.position = { x: center.x + 14.3, y: center.y + 6.6, z: center.z - 603.5 };
  h.state.rotation = Math.PI; h.state.currentAction = { type: 'idle', parameters: { resolved: true, truckRoad: { ...road, role: 'morpheus' }, truckWeapons: weapons }, startedAt: 0, duration: 1e9, progress: 0 };
  h.renderer.updateAgent(h.state.id, h.state); h.controls.possess(h.state); h.controls.firstPerson = true;
  h.controls.update(0, h.state, h.group, false); h.renderer.setPlayer(h.state.id, true); h.renderer.setPlayerMotion(h.controls.motion); h.renderer.update(0, h.camera, 0);
  assert.equal(h.renderer.getAgentBody(h.state.id)!.visible, true, 'a hidden body also hides the gun, blade and palms');
  const rig = (h.renderer as unknown as { agents: Map<string, { rig: CharacterRig }> }).agents.get(h.state.id)!.rig;
  const skin = rig.hero!.trackingSkin;
  assert.ok(skin, 'the real Morpheus skin must have a first-person face mask');
  assert.equal(skin.mesh.geometry, skin.firstPerson);
  assert.equal(rig.hero!.glasses.visible, false);
  assert.ok(rig.truckProps!.gun.visible && rig.truckProps!.sword.visible);
  h.controls.firstPerson = false; h.renderer.setPlayer(h.state.id, false); h.controls.update(0, h.state, h.group, false);
  h.renderer.setPlayerMotion(h.controls.motion); h.renderer.update(0, h.camera, 0);
  assert.equal(skin.mesh.geometry, skin.original, 'switching back restores the full character geometry');
  assert.equal(rig.hero!.glasses.visible, true);
});

test('the opponent sidestep uses the player weapon clock when the slow world snapshot is older', async t => {
  const h = await setup(t), center = FILM_SETS.film_freeway_101.center;
  const morpheus = { x: .3, y: 6.6, z: -3.5, yaw: Math.PI }, agent_johnson = { x: .3, y: 6.6, z: -5.35, yaw: 0 };
  const road = newTruckRoad({ x: 14, z: -600 }, morpheus, { x: 1, y: 6.6, z: -10.2, yaw: 0 }, 100); road.phase = 'ready'; road.elapsed = 5;
  const saved = newTruckWeapons(), fast = { ...saved, phase: 'slash' as const, elapsed: .33, total: 4.33, pair: { morpheus, agent_johnson },
    bodies: { morpheus, agent_johnson }, truck: road.truck, role: 'morpheus' as const };
  const johnson = h.world.agents.get('agent_johnson')!;
  johnson.position = { x: center.x + road.truck.x + agent_johnson.x, y: center.y + 6.6, z: center.z + road.truck.z + agent_johnson.z };
  johnson.rotation = 0; johnson.isInMatrix = true; johnson.currentLocation = 'film_freeway_101';
  johnson.currentAction = { type: 'idle', parameters: { resolved: true, truckRoad: { ...road, role: 'agent_johnson' },
    truckWeapons: { ...fast, ...saved, role: 'agent_johnson' } }, startedAt: 0, duration: 1e9, progress: 0 };
  h.renderer.updateAgent(johnson.id, johnson); await new Promise(resolve => setImmediate(resolve)); h.renderer.setPlayer('morpheus', false); h.renderer.setPlayerMotion({ ...h.controls.motion, truckRoad: { ...road, role: 'morpheus' }, truckWeapons: fast });
  h.renderer.update(0, h.camera, 0, 0, { version: 1, scene: 'm2_trucks', actor: 'morpheus', step: 0, completed: [], reflections: {}, enteredAt: 0,
    checkpoint: h.state.position, lastText: '', trucks: { phase: 'duel', elapsed: 0, lastTick: 0, attempt: 0, road, weapons: saved } });
  assert.ok(Math.abs(h.renderer.getAgent(johnson.id)!.position.x - johnson.position.x) > .5, 'the rendered opponent must dodge the current blade instead of waiting for the next slow snapshot');
});

test('paused truck weapon views use the posed GLB eye instead of placing the camera inside the coat', async t => {
  const h = await setup(t), center = FILM_SETS.film_freeway_101.center;
  const morpheus = { x: .3, y: 6.6, z: -3.5, yaw: Math.PI }, agent_johnson = { x: .3, y: 6.6, z: -5.35, yaw: 0 };
  const road = newTruckRoad({ x: 14, z: -600 }, morpheus, { x: 1, y: 6.6, z: -10.2, yaw: 0 }, 100); road.phase = 'ready'; road.elapsed = 5;
  h.state.currentLocation = 'film_freeway_101'; h.state.rotation = Math.PI;
  h.state.position = { x: center.x + 14.3, y: center.y + 6.6, z: center.z - 603.5 };
  for (const phase of ['gun', 'slash', 'sword_disarm'] as const) {
    const weapons = { ...newTruckWeapons(), phase, elapsed: .461, total: 7.461, pair: { morpheus, agent_johnson },
      bodies: { morpheus, agent_johnson }, truck: road.truck, role: 'morpheus' as const };
    h.state.currentAction = { type: 'idle', parameters: { resolved: true, truckRoad: { ...road, role: 'morpheus' }, truckWeapons: weapons }, startedAt: 0, duration: 1e9, progress: 0 };
    h.renderer.updateAgent(h.state.id, h.state); h.controls.possess(h.state); h.controls.firstPerson = true;
    for (let frame = 0; frame < 2; frame++) {
      h.controls.update(0, h.state, h.group, false); h.renderer.setPlayer(h.state.id, true); h.renderer.setPlayerMotion(h.controls.motion);
      h.renderer.update(0, h.camera, 0); h.controls.syncTruckRescueCamera(h.group);
      const head = h.group.getObjectByName('head')!; h.group.updateWorldMatrix(true, true);
      const localEye = head.userData.cameraEye as THREE.Vector3 | undefined;
      const eye = head.localToWorld(localEye?.clone() ?? new THREE.Vector3(0, .1, .32));
      assert.ok(h.camera.position.distanceTo(eye) < .0001, `${phase} camera remains in the coat: eye error ${h.camera.position.distanceTo(eye)}`);
      assert.ok(h.camera.near <= .06, 'the generic near plane cuts away the nearby palms and weapons');
      if (frame === 0) h.look();
    }
    h.controls.firstPerson = false; h.controls.update(0, h.state, h.group, false);
    const third = h.camera.position.clone(); h.controls.syncTruckRescueCamera(h.group);
    assert.deepEqual(h.camera.position, third, 'post-pose correction must leave the third-person view alone');
  }
});

test('the actual client permits F during the saved hood flight and keeps its first-person eye outside the character', async t => {
  const h = await setup(t), hood = newTruckHood({x:0,y:6.6,z:-3.5,yaw:Math.PI},{x:0,y:6.6,z:-7.5,yaw:0},100,2);
  hood.phase = 'flight'; hood.elapsed = 1.2; hood.total = 9; hood.car = {x:.3,z:20.5,yaw:0};
  const road = newTruckRoad({x:14,z:-500},hood.starts.morpheus,{x:1.3,y:6.6,z:-10.2,yaw:0},100);road.phase='ready';road.elapsed=8;
  h.state.currentLocation='film_freeway_101';h.state.currentAction={type:'idle',parameters:{truckRoad:road,truckHood:{...hood,role:'morpheus',truck:road.truck}},startedAt:3,duration:1000,progress:0};
  h.controls.update(.02,h.state,h.group,true);
  assert.equal(h.controls.triggerCombat('attack'),true,'the generic performing guard must not suppress the timed hood flight input');
  h.renderer.setPlayer(h.state.id,true);h.renderer.setPlayerMotion(h.controls.motion);h.renderer.update(.02,h.camera,1);
  h.controls.syncTruckRescueCamera(h.group);
  const head=h.group.getObjectByName('head')!;const eye=head.userData.cameraEye as THREE.Vector3;
  assert.ok(h.camera.position.distanceTo(head.localToWorld(eye.clone()))<.01,'the actual saved hood posture must drive the first-person eye');
});

test('the windshield back impact carries first-person head tilt while preserving mouse look and paused restore', async t => {
  const h=await setup(t),center=FILM_SETS.film_freeway_101.center;
  const hood=newTruckHood({x:0,y:6.6,z:-3.5,yaw:Math.PI},{x:0,y:6.6,z:-7.5,yaw:0},100,2);
  hood.phase='impact';hood.car={x:5.3,z:-4.9,yaw:0};hood.glassAge=.2;
  const road=newTruckRoad({x:14,z:-500},hood.starts.morpheus,{x:1.3,y:6.6,z:-10.2,yaw:0},100);road.phase='ready';road.elapsed=8;
  const draw=(elapsed: number)=>{
    hood.elapsed=elapsed;hood.total=3+elapsed;const p=truckHoodRoot(hood,'morpheus');
    h.state.currentLocation='film_freeway_101';h.state.rotation=p.yaw;h.state.position={x:center.x+14+p.x,y:center.y+p.y,z:center.z-500+p.z};
    h.state.currentAction={type:'idle',parameters:{truckRoad:road,truckHood:{...hood,role:'morpheus',truck:road.truck}},startedAt:3,duration:1000,progress:0};
    h.renderer.updateAgent(h.state.id,h.state);h.controls.update(0,h.state,h.group,false);h.renderer.setPlayer(h.state.id,true);h.renderer.setPlayerMotion(h.controls.motion);h.renderer.update(0,h.camera,0);h.controls.syncTruckRescueCamera(h.group);
    const head=h.group.getObjectByName('head')!,eye=head.localToWorld((head.userData.cameraEye as THREE.Vector3).clone());
    assert.ok(h.camera.position.distanceTo(eye)<.001,'the impact view stays at the actual moving eye');
    return h.camera.getWorldDirection(new THREE.Vector3()).applyQuaternion(head.getWorldQuaternion(new THREE.Quaternion()).invert());
  };
  draw(0);assert.ok(h.camera.getWorldDirection(new THREE.Vector3()).y>.5,'lying on the windshield must tilt the view upward instead of leaving it level with the road');
  h.look();const offset=draw(0),before=h.camera.quaternion.clone();draw(0);
  assert.ok(before.angleTo(h.camera.quaternion)<.001,'paused restoration cannot creep the head view');
  for(const elapsed of [.2,.55,1,1.5,2.2])assert.ok(draw(elapsed).distanceTo(offset)<.01,'recovering head tilt must preserve the independent mouse offset');
});

test('the actual back impact remains readable in the default third-person shot without trailer occlusion', async t => {
  const h=await setup(t),center=FILM_SETS.film_freeway_101.center;
  const hood=newTruckHood({x:0,y:6.6,z:-3.5,yaw:Math.PI},{x:0,y:6.6,z:-7.5,yaw:0},100,2);
  hood.phase='impact';hood.car={x:5.3,z:-4.9,yaw:0};hood.glassAge=.2;
  const road=newTruckRoad({x:14,z:-500},hood.starts.morpheus,{x:1.3,y:6.6,z:-10.2,yaw:0},100);road.phase='ready';road.elapsed=8;
  const scenery=new THREE.Group();scenery.position.set(center.x,center.y-1,center.z);
  const freeway=new FreewaySetRenderer(scenery,FILM_SETS.film_freeway_101);t.after(()=>freeway.dispose());
  for(const aspect of [16/9,.72])for(const elapsed of [0,.2,.55,1.2,2.1]) {
    h.camera.aspect=aspect;h.camera.updateProjectionMatrix();
    hood.elapsed=elapsed;hood.total=3+elapsed;const p=truckHoodRoot(hood,'morpheus');
    h.state.currentLocation='film_freeway_101';h.state.rotation=p.yaw;h.state.position={x:center.x+14+p.x,y:center.y+p.y,z:center.z-500+p.z};
    h.state.currentAction={type:'idle',parameters:{truckRoad:road,truckHood:{...hood,role:'morpheus',truck:road.truck}},startedAt:3,duration:1000,progress:0};
    h.renderer.updateAgent(h.state.id,h.state);h.controls.possess(h.state);h.controls.firstPerson=false;h.controls.update(0,h.state,h.group,false);h.renderer.setPlayer(h.state.id,false);h.renderer.setPlayerMotion(h.controls.motion);h.renderer.update(0,h.camera,0);h.camera.updateMatrixWorld(true);
    freeway.update({scene:'m2_trucks',step:0,trucks:{phase:'duel',elapsed:0,attempt:2,road,hood}} as never,0);scenery.updateMatrixWorld(true);
    const points=['head','wrist_R','wrist_L','ankle_R','ankle_L'].map(name=>h.group.getObjectByName(name)!.getWorldPosition(new THREE.Vector3()));
    const screens=points.map(point=>point.clone().project(h.camera));
    assert.ok(screens.every(point=>Math.abs(point.x)<.85&&Math.abs(point.y)<.85&&point.z<1&&point.z>-1),'head, palms and raised feet must stay in frame');
    const spread=Math.max(Math.max(...screens.map(p=>p.x))-Math.min(...screens.map(p=>p.x)),Math.max(...screens.map(p=>p.y))-Math.min(...screens.map(p=>p.y)));
    assert.ok(spread>.25,`impact ${elapsed}: the body is too small to read the back contact: ${spread}`);
    const opaque:THREE.Object3D[]=[];scenery.traverseVisible(mesh=>{if(mesh instanceof THREE.Mesh&&mesh.material instanceof THREE.Material&&!mesh.material.transparent)opaque.push(mesh);});
    for(const point of points){const direction=point.clone().sub(h.camera.position);assert.equal(new THREE.Raycaster(h.camera.position,direction.clone().normalize(),0,direction.length()-.15).intersectObjects(opaque,false).length,0,'the trailer cannot hide the impact');}
  }
});

test('first-person hood turning carries the free look offset through the turn toward the truck', async t => {
  const h=await setup(t), hood=newTruckHood({x:0,y:6.6,z:-3.5,yaw:Math.PI},{x:0,y:6.6,z:-7.5,yaw:0},100,2), center=FILM_SETS.film_freeway_101.center;
  const road=newTruckRoad({x:14,z:-500},hood.starts.morpheus,{x:1.3,y:6.6,z:-10.2,yaw:0},100);road.phase='ready';road.elapsed=8;
  const draw=(elapsed: number)=>{
    hood.phase='passing';hood.elapsed=elapsed;hood.total=4+elapsed;hood.car={x:5.3,z:1,yaw:0};
    const p=truckHoodRoot(hood,'morpheus');h.state.currentLocation='film_freeway_101';h.state.rotation=p.yaw;h.state.position={x:center.x+14+p.x,y:center.y+p.y,z:center.z-500+p.z};
    h.state.currentAction={type:'idle',parameters:{truckRoad:road,truckHood:{...hood,role:'morpheus',truck:road.truck}},startedAt:3,duration:1000,progress:0};
    h.renderer.updateAgent(h.state.id,h.state);h.controls.update(0,h.state,h.group,false);h.renderer.setPlayer(h.state.id,true);h.renderer.setPlayerMotion(h.controls.motion);h.renderer.update(0,h.camera,0);h.controls.syncTruckRescueCamera(h.group);
    const direction=h.camera.getWorldDirection(new THREE.Vector3());return Math.atan2(direction.x,direction.z)-p.yaw;
  };
  draw(.7);h.look();const offset=draw(.7);
  assert.ok(Math.abs(offset)>.05,'mouse movement must retain independent observation');
  for(const elapsed of [1.05,1.4,2]){
    const error=draw(elapsed)-offset;
    assert.ok(Math.abs(Math.atan2(Math.sin(error),Math.cos(error)))<.01,'the view stays ahead of the car while Morpheus turns toward Johnson');
  }
});

test('the default hood camera sees Morpheus without shooting through the truck trailer', async t => {
  const h = await setup(t), center = FILM_SETS.film_freeway_101.center;
  const hood = newTruckHood({x:0,y:6.6,z:-3.5,yaw:Math.PI},{x:0,y:6.6,z:-7.5,yaw:0},100,2);
  hood.phase='hood';hood.elapsed=.353;hood.total=2.274;hood.car={x:5.3,z:-6.6,yaw:0};
  const road=newTruckRoad({x:14,z:-500},hood.starts.morpheus,{x:1.3,y:6.6,z:-10.2,yaw:0},100);road.phase='ready';road.elapsed=8;
  const p=truckHoodRoot(hood,'morpheus');
  h.state.currentLocation='film_freeway_101';h.state.rotation=p.yaw;h.state.position={x:center.x+14+p.x,y:center.y+p.y,z:center.z-500+p.z};
  h.state.currentAction={type:'idle',parameters:{truckRoad:road,truckHood:{...hood,role:'morpheus',truck:road.truck}},startedAt:3,duration:1000,progress:0};
  h.renderer.updateAgent(h.state.id,h.state);h.controls.possess(h.state);h.controls.firstPerson=false;h.controls.update(0,h.state,h.group,false);
  h.renderer.setPlayer(h.state.id,false);h.renderer.setPlayerMotion(h.controls.motion);h.renderer.update(0,h.camera,0);
  const scenery=new THREE.Group();scenery.position.set(center.x,center.y-1,center.z);
  const freeway=new FreewaySetRenderer(scenery,FILM_SETS.film_freeway_101);t.after(()=>freeway.dispose());
  freeway.update({scene:'m2_trucks',step:0,trucks:{phase:'duel',elapsed:0,attempt:2,road,hood}} as never,0);scenery.updateMatrixWorld(true);
  const head=h.group.getObjectByName('head')!.getWorldPosition(new THREE.Vector3());
  const direction=head.clone().sub(h.camera.position), ray=new THREE.Raycaster(h.camera.position,direction.clone().normalize(),0,direction.length()-.15);
  const opaque: THREE.Object3D[]=[];scenery.traverseVisible(mesh=>{if(mesh instanceof THREE.Mesh&&mesh.material instanceof THREE.Material&&!mesh.material.transparent)opaque.push(mesh);});
  const blocked=ray.intersectObjects(opaque,false);
  assert.equal(blocked.length,0,`the default camera hides Morpheus behind the truck: ${blocked.map(hit=>hit.point.toArray()).join(';')}`);
  h.camera.updateMatrixWorld(true);const screen=head.clone().project(h.camera);
  assert.ok(Math.abs(screen.x)<.8&&Math.abs(screen.y)<.8&&screen.z<1,'the reception must stay inside the default gameplay view');
});
