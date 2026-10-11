import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { LOGOS_COCKPIT, FILM_SETS, newLogosFlight, stepLogosFlight, logosShipPose, logosShipPoint, logosCrewRoot, type LogosFlight, type LogosPilotGesture } from '@auto_matrix/shared';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { LogosFlightRenderer } from '../packages/client/src/engine/LogosFlightRenderer.js';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

async function geometry(id: string) {
  const glb = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
  const length = glb.readUInt32LE(12), document = JSON.parse(glb.subarray(20, 20 + length).toString());
  for (const material of document.materials) { delete material.pbrMetallicRoughness?.baseColorTexture; delete material.normalTexture; }
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = glb.subarray(20 + length), result = Buffer.alloc(20 + padded.length + bin.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); bin.copy(result, 20 + padded.length);
  return new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
}

async function setup(t: test.TestContext) {
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking', 'trinity', 'trinity-club', 'morpheus'].map(async id => [`${id}.glb`, await geometry(id)] as const)));
  t.mock.method(GLTFLoader.prototype, 'loadAsync', (url: string) => assets.has(url.split('/').at(-1)!) ? Promise.resolve(assets.get(url.split('/').at(-1)!)) : new Promise(() => {}));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const old = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, stroke() {}, ellipse() {}, fill() {}, createImageData: (w: number,h: number) => ({ data: new Uint8ClampedArray(w*h*4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  const roles = ['trinity', 'neo'] as const, rigs = Object.fromEntries(roles.map(role => [role, models.create(world.agents.get(role)!)]));
  const pose = (role: LogosPilotGesture['role'], flight: LogosFlight, delta = 0) => {
    const rig = rigs[role], point = logosCrewRoot(flight, role), ship = logosShipPose(flight);
    const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(ship.pitch, ship.yaw, ship.roll, 'YXZ'));
    rig.root.position.set(point.x, point.y, point.z).add(new THREE.Vector3(0, -1, 0).applyQuaternion(rotation));
    rig.root.rotation.set(-ship.pitch, point.yaw, -ship.roll, 'YXZ');
    models.animate(rig, delta, { speed: flight.speed, grounded: true, verticalVelocity: 0, turn: flight.lateral, realWorld: true,
      farewellOutfit: role, seated: true, riding: true, logosPilot: { role, flight, waiting: false } }, 0);
    rig.root.updateMatrixWorld(true); rig.root.traverse(object => { if (object instanceof THREE.SkinnedMesh) object.skeleton.update(); }); return rig;
  };
  t.after(() => { models.dispose(); globalThis.document = old; });
  for (let i = 0; i < 2; i++) { roles.forEach(role => pose(role, newLogosFlight('defense'))); await new Promise(resolve => setImmediate(resolve)); }
  return { world, models, rigs, roles, pose };
}

test('the actual Neo and Trinity bodies stay on their banked seats and deck, clear the cabin, and touch the controls', async t => {
  const h = await setup(t), root = new THREE.Group(), renderer = new LogosFlightRenderer(root, 'defense');
  root.position.y = -1;
  t.after(() => renderer.dispose());
  const flights = [-17, 0, 17].flatMap(lateral => [-15, 15].map(vertical => ({ ...newLogosFlight('defense'), lateral, vertical, elapsed: 5.3 })));
  flights.push({ ...newLogosFlight('sun'), stage: 'stall', vertical: -20, elapsed: 8.4 });
  let crashing = newLogosFlight('sun');
  for (let frame = 0; frame < 600 && !crashing.crash; frame++) crashing = stepLogosFlight(crashing,
    { throttle: crashing.stage === 'clouds' ? 1 : 0, steer: .1, brake: false }, .05,
    crashing.stage === 'stall' && (crashing.ignition?.pump ?? 0) < 1.3);
  assert.ok(crashing.crash);
  for (const elapsed of [0, crashing.crash.approach - .1, crashing.crash.approach + .2, crashing.crash.approach + 2.6])
    flights.push({ ...crashing, crash: { ...crashing.crash, elapsed } });
  for (const flight of flights) {
    renderer.update(flight, 80); root.updateMatrixWorld(true);
    const cockpit = root.getObjectByName('logos-flight-cockpit')!, inverse = cockpit.matrixWorld.clone().invert();
    for (const role of h.roles) {
      const rig = h.pose(role, flight), hero = rig.hero; assert.ok(hero, `${role}: requires the shipped model`);
      const seat = root.getObjectByName(`${role}-logos-seat`)!;
      const solids = ['logos-seat-cushion', 'logos-seat-back'].map(name => {
        const object = seat.getObjectByName(name) as THREE.Mesh; object.geometry.computeBoundingBox();
        return { inverse: object.matrixWorld.clone().invert(), bounds: object.geometry.boundingBox!.clone().expandByScalar(-.015), name };
      });
      let lowest = Infinity, samples = 0;
      rig.root.traverseVisible(object => { if (object instanceof THREE.Mesh) for (let i = 0; i < object.geometry.attributes.position.count; i++) {
        const world = object.localToWorld(object.getVertexPosition(i, new THREE.Vector3())), point = world.clone().applyMatrix4(inverse);
        assert.ok(point.toArray().every(Number.isFinite)); lowest = Math.min(lowest, point.y); samples++;
        assert.ok(point.y < 3.14 && Math.abs(point.x) < 3.15 && point.z < .65 && point.z > -9.6, `${role}: body crosses cabin at ${point.toArray()}`);
        for (const solid of solids) assert.equal(solid.bounds.containsPoint(world.clone().applyMatrix4(solid.inverse)), false,
          `${role}/${flight.lateral}/${flight.vertical}: ${object.name} penetrates ${solid.name} at ${world.clone().applyMatrix4(solid.inverse).toArray()}`);
      } });
      assert.ok(samples > 5000); assert.ok(lowest >= LOGOS_COCKPIT.floor - .05 && lowest < LOGOS_COCKPIT.floor + .12, `${role}: soles at ${lowest}`);
      for (let i = 0; i < 2; i++) {
        const wrist = hero.bones.get(i ? 'wrist_L' : 'wrist_R')!;
        const palm = wrist.localToWorld(new THREE.Vector3(i ? -.13 : .13, -.18, .02));
        const grip = seat.getObjectByName(`${role}-logos-grip-${i ? 1 : -1}`)!.getWorldPosition(new THREE.Vector3());
        assert.ok(palm.distanceTo(grip) < .085, `${role}: palm floats from grip by ${palm.distanceTo(grip)}`);
      }
      assert.equal(rig.root.getObjectByName('neo-farewell-eye-band')?.visible, role === 'neo' ? true : undefined);
    }
  }
});

test('the live agent renderer and film set agree on banked crew contacts in world coordinates', async t => {
  const h = await setup(t), scene = new THREE.Scene(), root = new THREE.Group(); scene.add(root);
  const center = FILM_SETS.film_machine_defense.center;
  root.position.set(center.x, center.y - 1, center.z);
  const cockpit = new LogosFlightRenderer(root, 'defense'), agents = new AgentRenderer(scene);
  t.after(() => { agents.dispose(); cockpit.dispose(); }); agents.setWorld(false);
  const flight = { ...newLogosFlight('defense'), lateral: 12, vertical: 15, elapsed: 3.2 };
  for (const role of h.roles) {
    const state = h.world.agents.get(role)!, point = logosCrewRoot(flight, role);
    state.position = { x: center.x + point.x, y: center.y + point.y, z: center.z + point.z };
    state.rotation = point.yaw; state.isInMatrix = false; state.currentLocation = 'film_machine_defense';
    state.currentAction = { type: 'idle', parameters: { seated: true, logosPilot: { role, flight, waiting: false } }, startedAt: 1, duration: 1e9, progress: 0 };
    agents.updateAgent(role, state);
  }
  cockpit.update(flight, 0);
  for (let i = 0; i < 3; i++) { agents.update(0); await new Promise(resolve => setImmediate(resolve)); }
  scene.updateMatrixWorld(true);
  for (const role of h.roles) for (let i = 0; i < 2; i++) {
    const wrist = agents.getAgentBody(role)!.getObjectByName(i ? 'wrist_L' : 'wrist_R'); assert.ok(wrist);
    const palm = wrist.localToWorld(new THREE.Vector3(i ? -.13 : .13, -.18, .02));
    const grip = root.getObjectByName(`${role}-logos-grip-${i ? 1 : -1}`)!.getWorldPosition(new THREE.Vector3());
    assert.ok(palm.distanceTo(grip) < .085, `${role}: world-space palm is ${palm.distanceTo(grip)} from its control`);
  }
});

test('Trinity grips the physical overhead igniter throughout its stroke and keeps her left hand on the flight control', async t => {
  const h = await setup(t), root = new THREE.Group(), renderer = new LogosFlightRenderer(root, 'sun');
  root.position.y = -1; t.after(() => renderer.dispose());
  for (const stroke of [0, .25, .5, .75, 1]) for (const lateral of [-5, 5]) {
    const flight: LogosFlight = { ...newLogosFlight('sun'), stage: 'stall', stageElapsed: 1, vertical: -16, lateral,
      ignition: { phase: 'pumping', elapsed: .8, pump: .8, stroke, held: true, attempts: 0 } };
    renderer.update(flight, 0); root.updateMatrixWorld(true);
    const rig = h.pose('trinity', flight), hero = rig.hero!;
    const lever = root.getObjectByName('logos-igniter-grip'); assert.ok(lever, 'requires a physical igniter');
    for (const [side, local, target] of [
      ['R', new THREE.Vector3(.13, -.18, .02), lever],
      ['L', new THREE.Vector3(-.13, -.18, .02), root.getObjectByName('trinity-logos-grip-1')!],
    ] as const) {
      const palm = hero.bones.get(`wrist_${side}`)!.localToWorld(local);
      assert.ok(palm.distanceTo(target.getWorldPosition(new THREE.Vector3())) < .085, `${side}: hand misses ${target.name}`);
    }
    const inverse = root.getObjectByName('logos-flight-cockpit')!.matrixWorld.clone().invert();
    rig.root.traverseVisible(object => { if (object instanceof THREE.Mesh) for (let i = 0; i < object.geometry.attributes.position.count; i++) {
      const p = object.localToWorld(object.getVertexPosition(i, new THREE.Vector3())).applyMatrix4(inverse);
      assert.ok(p.y < 3.14 && Math.abs(p.x) < 3.15, `body crosses the cabin at ${p.toArray()}`);
    } });
  }
});

test('looking down in the Logos cockpit keeps visible hands without rendering inside the pilot face', async t => {
  const h = await setup(t), flight = newLogosFlight('defense');
  for (const role of h.roles) {
    const rig = h.pose(role, flight);
    h.models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, firstPerson: true,
      farewellOutfit: role, logosPilot: { role, flight, waiting: true } }, 0);
    const skin = rig.hero!.trackingSkin!.mesh, geometry = skin.geometry;
    let face = 0, hands = 0;
    for (let i = 0; i < geometry.index!.count; i++) {
      const vertex = geometry.index!.getX(i);
      for (let j = 0; j < 4; j++) if (geometry.attributes.skinWeight.getComponent(vertex, j) > .05) {
        const joint = skin.skeleton.bones[geometry.attributes.skinIndex.getComponent(vertex, j)].name;
        if (/^(head|neck)$/.test(joint)) face++;
        if (/^(wrist|finger)/.test(joint)) hands++;
      }
    }
    assert.equal(face, 0, `${role}: face triangles obstruct the camera when looking down`);
    assert.ok(hands > 100, `${role}: steering hands must remain visible`);
    h.models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true,
      farewellOutfit: role, logosPilot: { role, flight, waiting: true } }, 0);
    assert.ok(skin.geometry.index!.count > geometry.index!.count, `${role}: third person restores the face`);
  }
});

test('Logos poses freeze on saved flight time and clear their roll and costume when leaving', async t => {
  const h = await setup(t), flight = { ...newLogosFlight('defense'), lateral: 12, vertical: 9, elapsed: 4.5 };
  for (const role of h.roles) {
    const rig = h.pose(role, flight), joints = [...rig.hero!.bones.values()];
    const before = joints.map(joint => joint.matrixWorld.elements.slice()); h.pose(role, structuredClone(flight), 12);
    assert.deepEqual(joints.map(joint => joint.matrixWorld.elements.slice()), before);
  }
  h.models.animate(h.rigs.neo, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: false }, 0);
  assert.equal(h.rigs.neo.root.getObjectByName('neo-farewell-eye-band')!.visible, false);
  const renderer = new AgentRenderer(new THREE.Scene()); t.after(() => renderer.dispose()); renderer.setWorld(false);
  const state = h.world.agents.get('trinity')!; state.isInMatrix = false; state.currentLocation = 'film_machine_defense';
  state.currentAction = { type: 'idle', parameters: { seated: true, logosPilot: { role: 'trinity', flight, waiting: false } }, startedAt: 1, duration: 1e9, progress: 0 };
  renderer.updateAgent(state.id, state); renderer.update(0); assert.ok(Math.abs(renderer.getAgentBody(state.id)!.rotation.z) > .2);
  state.currentAction = null; state.currentLocation = 'film_logos_wreck'; renderer.updateAgent(state.id, state); renderer.update(0);
  assert.ok(Math.abs(renderer.getAgentBody(state.id)!.rotation.z) < .001);
  assert.ok(renderer.getAgentBody(state.id)!.position.distanceTo(new THREE.Vector3(0, -1, 0)) < .001);
});

test('Logos first-person view follows real eye position, pitch and bank without losing free look', async t => {
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  let controls: PlayerControls | undefined;
  t.after(() => { controls?.dispose(); ['window', 'document'].forEach((key,i) => previous[i] ? Object.defineProperty(globalThis,key,previous[i]!) : Reflect.deleteProperty(globalThis,key)); });
  const h = await setup(t), target = { addEventListener() {}, removeEventListener() {} };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: target });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: target });
  const camera = new THREE.PerspectiveCamera(48,16/9,.5,5000);
  controls = new PlayerControls(target as unknown as HTMLCanvasElement,camera,()=>{},()=>{});
  const state = h.world.agents.get('trinity')!, center = FILM_SETS.film_machine_defense.center, group = new THREE.Group();
  const place = (lateral: number, vertical: number) => {
    const flight = { ...newLogosFlight('defense'), lateral, vertical }, point = logosCrewRoot(flight,'trinity'), ship = logosShipPose(flight);
    state.position = {x:center.x+point.x,y:center.y+point.y,z:center.z+point.z}; state.rotation = point.yaw;
    state.currentLocation = 'film_machine_defense'; state.isInMatrix = false;
    state.currentAction = {type:'idle',parameters:{riding:true,seated:true,logosPilot:{role:'trinity',flight,waiting:false}},startedAt:1,duration:1e9,progress:0};
    h.rigs.trinity.root.removeFromParent(); const rig = h.pose('trinity',flight);
    group.position.set(state.position.x,state.position.y,state.position.z); group.add(rig.root);
    rig.root.position.set(0,-1,0).applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(ship.pitch,ship.yaw,ship.roll,'YXZ')));
    group.updateMatrixWorld(true); return rig;
  };
  let rig=place(0,0); controls.possess(state); controls.firstPerson=true; controls.update(.1,state,group,false); controls.syncLogosCamera(group);
  const before=camera.getWorldDirection(new THREE.Vector3());
  rig=place(12,15); controls.update(.1,state,group,false); controls.syncLogosCamera(group);
  const head=rig.hero!.bones.get('head')!, eye=head.localToWorld((head.userData.cameraEye as THREE.Vector3).clone());
  assert.ok(camera.position.distanceTo(eye)<.001);
  assert.ok(camera.getWorldDirection(new THREE.Vector3()).y>before.y+.2,'climbing must raise the view, not point it at the ground');
  const ship = logosShipPose({ ...newLogosFlight('defense'), lateral: 12, vertical: 15 });
  const up = new THREE.Vector3(0,1,0).applyEuler(new THREE.Euler(ship.pitch,ship.yaw,ship.roll,'YXZ'));
  assert.ok(camera.up.distanceTo(up)<.001); assert.ok(camera.up.distanceTo(new THREE.Vector3(0,1,0))>.2);
  const view=controls as unknown as {yaw:number}; view.yaw+=.45;
  const turned=camera.getWorldDirection(new THREE.Vector3()); controls.update(.1,state,group,false); controls.syncLogosCamera(group);
  assert.ok(camera.getWorldDirection(new THREE.Vector3()).distanceTo(turned)>.3);
  const looking = camera.getWorldDirection(new THREE.Vector3());
  for (let i = 0; i < 8; i++) {
    // Engine.syncSandbox refreshes the generic performance flag on each world snapshot.
    if (i % 2 === 0) controls.performing = false;
    controls.update(.1,state,group,false); controls.syncLogosCamera(group);
  }
  assert.ok(camera.getWorldDirection(new THREE.Vector3()).distanceTo(looking)<.001, 'a world snapshot must not reset cockpit free look');
});
