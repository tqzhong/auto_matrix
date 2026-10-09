import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, freewayPickupBike, freewayPickupRoot, newFreewayPickup, type FreewayPickup, type FilmJourney } from '@auto_matrix/shared';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { FreewaySetRenderer } from '../packages/client/src/engine/FreewaySetRenderer.js';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { FreewayPickupSystem } from '../packages/server/src/story/FreewayPickupSystem.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { freewayRideRoot, type FreewayRide } from '@auto_matrix/shared';

async function setup(t: test.TestContext, driver = false) {
  const assets = new Map();
  for (const id of ['trinity', 'trinity-club', ...(driver ? ['smith'] : [])]) {
    const glb = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
    const length = glb.readUInt32LE(12), source = JSON.parse(glb.subarray(20, 20 + length).toString());
    for (const material of source.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
    source.images = []; source.textures = [];
    const json = Buffer.from(JSON.stringify(source)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
    const bin = glb.subarray(20 + length), buffer = Buffer.alloc(20 + padded.length + bin.length);
    buffer.writeUInt32LE(0x46546c67, 0); buffer.writeUInt32LE(2, 4); buffer.writeUInt32LE(buffer.length, 8);
    buffer.writeUInt32LE(padded.length, 12); buffer.writeUInt32LE(0x4e4f534a, 16); padded.copy(buffer, 20); bin.copy(buffer, 20 + padded.length);
    assets.set(id, await new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), ''));
  }
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async (url: string) => assets.get(url.split('/').pop()!.replace('.glb', '')));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {},
    fillRect() {}, strokeRect() {}, fillText() {}, createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }),
  }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  const rigs = { trinity: models.create(world.agents.get('trinity')!), keymaker: models.create(world.agents.get('keymaker')!) };
  await new Promise(resolve => setImmediate(resolve)); assert.ok(rigs.trinity.hero);
  const groups = { trinity: new THREE.Group(), keymaker: new THREE.Group() };
  for (const role of ['trinity', 'keymaker'] as const) { groups[role].add(rigs[role].root); rigs[role].root.position.y = -1; }
  const center = FILM_SETS.film_freeway_101.center, scenery = new THREE.Group(); scenery.position.set(center.x, center.y - 1, center.z);
  const renderer = new FreewaySetRenderer(scenery, FILM_SETS.film_freeway_101), bike = scenery.getObjectByName('matrix-freeway-motorcycle')!;
  t.after(() => { renderer.dispose(); models.dispose(); globalThis.document = previous; });
  const draw = (state: FreewayPickup, delta = 0, firstPerson = false) => {
    const center = FILM_SETS.film_freeway_101.center;
    for (const role of ['trinity', 'keymaker'] as const) {
      const pose = freewayPickupRoot(state, role), rig = rigs[role];
      groups[role].position.set(center.x + pose.x, center.y + pose.y, center.z + pose.z); rig.root.rotation.y = pose.yaw;
      models.animate(rig, delta, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, firstPerson: firstPerson && role === 'trinity', freewayPickup: { ...state, role } }, 0);
      groups[role].updateMatrixWorld(true);
      rig.root.traverse(object => { if (object instanceof THREE.SkinnedMesh) object.skeleton.update(); });
    }
    renderer.update({ version: 1, scene: 'm2_freeway', actor: 'trinity', step: 0, completed: [], enteredAt: 0,
      checkpoint: center, reflections: {}, lastText: '', freewayPickup: state } as FilmJourney, state.total);
    scenery.updateMatrixWorld(true);
  };
  return { rigs, draw, bike, groups, world, models, scenery, renderer };
}

test('inverse escort keeps delivered palms and soles on the actual motorcycle during turns, braking and cold redraw', async t => {
  const h = await setup(t), actor = h.world.agents.get('trinity')!;
  const dynamics = { record: (event: import('@auto_matrix/shared').WorldEvent) => h.world.addWorldEvent(event) } as unknown as import('../packages/server/src/story/WorldDynamics.js').WorldDynamics;
  const sandbox = new SandboxSystem(h.world, dynamics, 42); sandbox.life.begin(h.world.agents.get('neo')!, 0);
  const journey: FilmJourney = { version: 1, scene: 'm2_freeway', actor: 'trinity', step: 1, completed: [], enteredAt: 0,
    checkpoint: FILM_SETS.film_freeway_101.center, reflections: {}, lastText: '',
    ride: { x: 18, z: 600, speed: 32, lateral: 0, elapsed: 24, hull: 100, passenger: 100, cooldown: 0, hits: 0, phase: 'riding' } };
  sandbox.state.neoLife!.journey = journey; actor.controller = 'player'; actor.isInMatrix = true;
  const draw = () => {
    sandbox.life.film.driveFrame(actor, { throttle: 0, steer: 0, brake: false }, 0, 10);
    for (const role of ['trinity', 'keymaker'] as const) {
      const member = h.world.agents.get(role)!, rig = h.rigs[role];
      h.groups[role].position.set(member.position.x, member.position.y, member.position.z); rig.root.rotation.y = member.rotation;
      h.models.animate(rig, 0, { speed: journey.ride!.speed, grounded: true, verticalVelocity: 0, turn: 0, riding: true,
        freewayRide: member.currentAction?.parameters.freewayRide } as import('../packages/client/src/agents/CharacterMotion.js').MotionInput, 0);
      h.groups[role].updateMatrixWorld(true); rig.root.traverse(o => { if (o instanceof THREE.SkinnedMesh) o.skeleton.update(); });
    }
    h.renderer.update(journey, 100, actor.position); h.scenery.updateMatrixWorld(true);
  };
  for (const lateral of [0, 8, -8]) {
    Object.assign(journey.ride!, { lateral, bank: lateral * .035, braking: lateral < 0 ? 1 : 0 }); draw();
    for (const [side, index] of [['R', 1], ['L', 0]] as const) {
      const grip = h.bike.getObjectByName(`motorcycle-grip-${index}`)!.getWorldPosition(new THREE.Vector3());
      const distance = Math.min(...palmVertices(h.rigs.trinity, side).map(point => point.distanceTo(grip)));
      assert.ok(distance < .075, `${side} real escort palm floats ${distance} from the physical grip at lateral ${lateral}`);
    }
    for (const role of ['trinity', 'keymaker'] as const) for (const [index, side] of ['R', 'L'].entries()) {
      const rig = h.rigs[role], peg = h.bike.getObjectByName(`motorcycle-${role === 'trinity' ? 'rider' : 'passenger'}-peg-${1 - index}`)!;
      const ankle = rig.hero?.bones.get(`ankle_${side}`) ?? rig.ankles[index]; let support = Infinity;
      const sample = (point: THREE.Vector3) => { const local = peg.worldToLocal(point);
        if (Math.abs(local.x) < .3 && Math.abs(local.z) < .11) support = Math.min(support, Math.abs(local.y - .06)); };
      if (rig.hero) rig.hero.root.traverseVisible(object => {
        if (!(object instanceof THREE.SkinnedMesh)) return;
        const ids = object.geometry.attributes.skinIndex, weights = object.geometry.attributes.skinWeight;
        for (let v = 0; v < object.geometry.attributes.position.count; v++)
          if ([0, 1, 2, 3].some(j => weights.getComponent(v, j) > .2 && object.skeleton.bones[ids.getComponent(v, j)]?.name === `ankle_${side}`))
            sample(object.localToWorld(object.getVertexPosition(v, new THREE.Vector3())));
      }); else ankle.traverseVisible(object => {
        if (object instanceof THREE.Mesh) for (let v = 0; v < object.geometry.attributes.position.count; v++)
          sample(object.localToWorld(object.getVertexPosition(v, new THREE.Vector3())));
      });
      assert.ok(support < .035, `${role}/${side} real sole misses its physical peg by ${support}`);
    }
    const garment: THREE.Vector3[] = [], tank = h.bike.getObjectByName('motorcycle-fuel-tank')!; let deepest = 1;
    h.rigs.trinity.hero!.root.traverseVisible(object => {
      if (!(object instanceof THREE.SkinnedMesh) || (object.material as THREE.Material).name !== 'Coat leather') return;
      for (let v = 0; v < object.geometry.attributes.position.count; v++) {
        const point = object.localToWorld(object.getVertexPosition(v, new THREE.Vector3())); garment.push(point.clone());
        deepest = Math.min(deepest, tank.worldToLocal(point).length());
      }
    });
    assert.ok(garment.length > 100 && deepest >= .98, `escort leather enters the tank at bank ${journey.ride!.bank}`);
    for (const elbow of h.rigs.keymaker.elbows) {
      const palm = elbow.localToWorld(new THREE.Vector3(0, -.75, .005));
      assert.ok(Math.min(...garment.map(point => point.distanceTo(palm))) < .075, 'passenger must hold the actual driver waist through braking and bank');
    }
    for (const z of [-2.1, 2.2]) {
      const wheel = h.bike.children.find(o => o instanceof THREE.Mesh && o.geometry instanceof THREE.CylinderGeometry && o.geometry.parameters.radiusTop === .98 && o.position.z === z) as THREE.Mesh;
      const positions = wheel.geometry.attributes.position; let lowest = Infinity;
      for (let v = 0; v < positions.count; v++) lowest = Math.min(lowest, wheel.localToWorld(wheel.getVertexPosition(v, new THREE.Vector3())).y);
      assert.ok(lowest >= FILM_SETS.film_freeway_101.center.y - 1 - 1e-6 && lowest < FILM_SETS.film_freeway_101.center.y - .97, 'banked tires must remain supported by the real road');
    }
    const matrices = ['R', 'L'].map(side => h.rigs.trinity.hero!.bones.get(`wrist_${side}`)!.matrixWorld.clone());
    h.models.animate(h.rigs.trinity, .1, { speed: 10, grounded: true, verticalVelocity: 0, turn: 2 }, 0); draw();
    ['R', 'L'].forEach((side, i) => assert.ok(matrices[i].elements.every((value, j) => Math.abs(value - h.rigs.trinity.hero!.bones.get(`wrist_${side}`)!.matrixWorld.elements[j]) < 1e-7), 'cold escort cannot depend on previous gait'));
  }
});

test('the inverse escort first-person eye clears its own head and glasses while both real palms stay on the grips', async t => {
  const h = await setup(t), rig = h.rigs.trinity, center = FILM_SETS.film_freeway_101.center;
  for (const lateral of [0, 8, -8]) {
    const ride: FreewayRide = { x: 18, z: 600, speed: 32, lateral, elapsed: 24, hull: 100, passenger: 100,
      cooldown: 0, hits: 0, phase: 'riding', bank: lateral * .035, braking: lateral < 0 ? 1 : 0 };
    const pose = freewayRideRoot(ride, 'trinity');
    h.groups.trinity.position.set(center.x + pose.x, center.y + pose.y, center.z + pose.z); rig.root.rotation.y = pose.yaw;
    const motion = { ...ride, role: 'trinity' as const };
    h.models.animate(rig, 0, { speed: ride.speed, grounded: true, verticalVelocity: 0, turn: 0, riding: true, firstPerson: true, freewayRide: motion }, 0);
    h.groups.trinity.updateMatrixWorld(true); rig.root.traverse(o => { if (o instanceof THREE.SkinnedMesh) o.skeleton.update(); });
    h.renderer.update({ version: 1, scene: 'm2_freeway', actor: 'trinity', step: 1, completed: [], enteredAt: 0,
      checkpoint: center, reflections: {}, lastText: '', ride } as FilmJourney, 100); h.scenery.updateMatrixWorld(true);
    const camera = new THREE.PerspectiveCamera(70, 16 / 9, .06, 1000);
    PlayerControls.prototype.syncFreewayPickupCamera.call({ motion: { freewayRide: motion }, firstPerson: true, yaw: pose.yaw, pitch: .03, camera } as unknown as PlayerControls, h.groups.trinity);
    assert.equal(rig.hero!.glasses.visible, false, 'own glasses cannot cover the road from the actual seated eye');
    assert.equal(rig.hero!.trackingSkin!.mesh.geometry, rig.hero!.trackingSkin!.firstPerson, 'own head must be filtered without hiding the arms');
    for (const [side, index] of [['R', 1], ['L', 0]] as const) {
      const palms = palmVertices(rig, side), grip = h.bike.getObjectByName(`motorcycle-grip-${index}`)!.getWorldPosition(new THREE.Vector3());
      assert.ok(palms.length > 20 && Math.min(...palms.map(point => point.distanceTo(grip))) < .075, `${side} real palm must stay visible and on the grip in first person`);
    }
    const ray = new THREE.Raycaster(camera.position, camera.getWorldDirection(new THREE.Vector3()), .06, 10);
    const opaque = ray.intersectObject(h.bike, true).filter(hit => {
      const material = (hit.object as THREE.Mesh).material as THREE.Material;
      return !(material.transparent && material.opacity < .3);
    });
    assert.equal(opaque.length, 0, `bank ${ride.bank}: the opaque motorcycle cannot hide the forward road`);
  }
});

test('the real Jackson driver stays in the turning cab and contacts its physical wheel and pedals on cold redraw', async t => {
  const h = await setup(t, true), actor = h.world.agents.get('trinity')!, driver = h.world.agents.get('agent_jackson')!;
  actor.controller = 'player';
  const rig = h.models.create(driver), group = new THREE.Group(); group.add(rig.root); rig.root.position.y = -1;
  await new Promise(resolve => setImmediate(resolve)); assert.ok(rig.hero, 'test the delivered Smith-family asset rather than a fallback');
  const state: FreewayPickup = { ...newFreewayPickup(), phase: 'merging', total: 20, x: 2.5, z: 780, speed: 32,
    chase: { phase: 'ramming', elapsed: .6, truck: { x: 10, z: 800, speed: 28, yaw: -.127 }, shield: { x: 6, z: 835, speed: 12 } } };
  const journey = { version: 1, scene: 'm2_freeway', actor: 'trinity', step: 0, completed: [], enteredAt: 0,
    checkpoint: FILM_SETS.film_freeway_101.center, reflections: {}, lastText: '', freewayPickup: state } as FilmJourney;
  const sandbox = { neoLife: { journey }, structures: [] } as unknown as import('@auto_matrix/shared').SandboxState;
  new FreewayPickupSystem(h.world, () => sandbox).frame(actor, {}, 0, 0);
  h.draw(state); group.position.set(driver.position.x, driver.position.y, driver.position.z); rig.root.rotation.y = driver.rotation;
  const truck = h.scenery.getObjectByName('matrix-freeway-jackson-truck')!;
  const expected = truck.localToWorld(new THREE.Vector3(-.9, 1.5, -6.2));
  assert.ok(expected.distanceTo(group.position) < 1e-7, 'the saved driver position must rotate with the actual cab');
  const input = { speed: 28, grounded: true, verticalVelocity: 0, turn: 0, riding: true, seated: true, freewayDriver: state };
  const draw = (delta: number) => { h.models.animate(rig, delta, input, 0); group.updateMatrixWorld(true);
    rig.hero!.root.traverse(o => { if (o instanceof THREE.SkinnedMesh) o.skeleton.update(); }); };
  draw(0);
  const wheel = truck.getObjectByName('freeway-jackson-wheel')!;
  assert.ok(wheel, 'the real wheel must be addressable for contact verification');
  for (const [i, side] of ['R', 'L'].entries()) {
    const contact = wheel.localToWorld(new THREE.Vector3(i ? -.3 : .3, 0, 0));
    const palms = palmVertices(rig, side);
    assert.ok(palms.length > 20 && Math.min(...palms.map(p => p.distanceTo(contact))) < .075, `${side} palm misses actual wheel`);
    const pedal = truck.getObjectByName(`freeway-jackson-pedal-${i}`)!; assert.ok(pedal);
    const ankle = rig.hero!.bones.get(`ankle_${side}`)!.getWorldPosition(new THREE.Vector3());
    const expectedAnkle = pedal.localToWorld(new THREE.Vector3(0, .04 + rig.hero!.footHeight, 0));
    assert.ok(ankle.distanceTo(expectedAnkle) < .02, `${side} boot must reach the pedal without protruding below the truck`);
  }
  const head = rig.hero!.bones.get('head')!.getWorldPosition(new THREE.Vector3());
  assert.ok(truck.worldToLocal(head).y < 4.75, 'driver head must stay below the actual roof');
  const wrists = ['R', 'L'].map(side => rig.hero!.bones.get(`wrist_${side}`)!.matrixWorld.clone());
  h.models.animate(rig, .1, { speed: 15, grounded: true, verticalVelocity: 0, turn: 2 }, 0); draw(.1);
  ['R', 'L'].forEach((side, i) => assert.ok(wrists[i].elements.every((n, j) => Math.abs(n - rig.hero!.bones.get(`wrist_${side}`)!.matrixWorld.elements[j]) < 1e-7), 'paused/cold driver contact cannot depend on prior gait'));
});

test('the delivered riding bodies and motorcycle keep their positions and heading across the inverse escort handoff', async t => {
  const h = await setup(t), actor = h.world.agents.get('trinity')!; actor.controller = 'player';
  const journey: FilmJourney = { version: 1, scene: 'm2_freeway', actor: 'trinity', step: 0, completed: [], enteredAt: 0,
    checkpoint: FILM_SETS.film_freeway_101.center, reflections: {}, lastText: '',
    freewayPickup: { ...newFreewayPickup(), phase: 'merging', total: 24, elapsed: 1, x: 18, z: 890, speed: 20, heading: Math.PI - .25,
      chase: { phase: 'crossing', elapsed: 1, impactAt: 23, truck: { x: 8.5, z: 820, speed: 0, yaw: 0 }, shield: { x: 6, z: 833.1, speed: 0 } } } };
  const sandbox = { neoLife: { journey }, structures: [] } as unknown as import('@auto_matrix/shared').SandboxState;
  const system = new FreewayPickupSystem(h.world, () => sandbox); system.onAdvance = () => { journey.step = 1; };
  system.frame(actor, { drive: { throttle: 1, steer: 0, brake: false } }, .05, 12);
  assert.equal(journey.freewayPickup!.phase, 'done'); assert.ok(journey.ride);
  h.draw({ ...journey.freewayPickup!, phase: 'merging' });
  const bones = Object.fromEntries(['trinity', 'keymaker'].map(role => {
    const rig = h.rigs[role as 'trinity' | 'keymaker'];
    return [role, [...(rig.hero ? ['head', 'wrist_R', 'wrist_L', 'ankle_R', 'ankle_L'].map(name => rig.hero!.bones.get(name)!) : [rig.head, ...rig.elbows, ...rig.ankles])].map(bone => bone.getWorldPosition(new THREE.Vector3()))];
  }));
  const bike = h.bike.getWorldPosition(new THREE.Vector3()), orientation = h.bike.getWorldQuaternion(new THREE.Quaternion());
  for (const role of ['trinity', 'keymaker'] as const) {
    const rig = h.rigs[role], member = h.world.agents.get(role)!;
    h.groups[role].position.set(member.position.x, member.position.y, member.position.z); rig.root.rotation.y = member.rotation;
    h.models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, riding: true,
      freewayRide: member.currentAction!.parameters.freewayRide } as import('../packages/client/src/agents/CharacterMotion.js').MotionInput, 0);
    h.groups[role].updateMatrixWorld(true);
    const after = rig.hero ? ['head', 'wrist_R', 'wrist_L', 'ankle_R', 'ankle_L'].map(name => rig.hero!.bones.get(name)!) : [rig.head, ...rig.elbows, ...rig.ankles];
    after.forEach((bone, i) => assert.ok(bone.getWorldPosition(new THREE.Vector3()).distanceTo(bones[role][i]) < 1e-6, `${role} cannot pop into a generic seated pose at the handoff`));
  }
  h.renderer.update(journey, 30, actor.position); h.scenery.updateMatrixWorld(true);
  assert.ok(h.bike.getWorldPosition(new THREE.Vector3()).distanceTo(bike) < 1e-7);
  assert.ok(h.bike.getWorldQuaternion(new THREE.Quaternion()).angleTo(orientation) < 1e-7, 'handoff cannot snap the partially turned bike to a new heading');
});

test('the delivered Trinity palms meet both motorcycle grips while seated without stretching arm bones', async t => {
  const h = await setup(t), hero = h.rigs.trinity.hero!;
  const lengths = ['elbow_R', 'elbow_L', 'wrist_R', 'wrist_L'].map(name => hero.bones.get(name)!.position.clone());
  const state = { ...newFreewayPickup(), phase: 'mounted' as const, total: 12, key: true };
  h.draw(state);
  for (const [side, index] of [['R', 1], ['L', 0]] as const) {
    const target = h.bike.getObjectByName(`motorcycle-grip-${index}`)!.getWorldPosition(new THREE.Vector3());
    let closest = Infinity, sampled = 0; const point = new THREE.Vector3();
    hero.root.traverseVisible(object => {
      if (!(object instanceof THREE.SkinnedMesh) || (object.material as THREE.Material).name !== 'Skin') return;
      const ids = object.geometry.attributes.skinIndex, weights = object.geometry.attributes.skinWeight;
      for (let v = 0; v < object.geometry.attributes.position.count; v++) {
        if (![0, 1, 2, 3].some(j => weights.getComponent(v, j) > .5 && object.skeleton.bones[ids.getComponent(v, j)]?.name === `wrist_${side}`)) continue;
        sampled++; object.getVertexPosition(v, point); object.localToWorld(point); closest = Math.min(closest, point.distanceTo(target));
      }
    });
    assert.ok(sampled > 20 && closest < .075, `${side} actual palm floats ${closest} from the delivered handlebar grip`);
  }
  ['elbow_R', 'elbow_L', 'wrist_R', 'wrist_L'].forEach((name, i) => assert.deepEqual(hero.bones.get(name)!.position, lengths[i]));
});

test('delivered soles stay on actual pegs on the ramp, in flight, through turns and after a saved crash', async t => {
  const h = await setup(t), base = { ...newFreewayPickup(), phase: 'mounted' as const, total: 12, key: true };
  const turning = { ...base, phase: 'merging' as const, total: 14, x: 18, z: 650, heading: Math.PI / 2, speed: 12 };
  const crash = { ...turning, phase: 'failed' as const, failedBike: freewayPickupBike(turning),
    failedRoots: { trinity: freewayPickupRoot(turning, 'trinity'), keymaker: freewayPickupRoot(turning, 'keymaker') } };
  const states: FreewayPickup[] = [base, ...[.25, .9, 1.6].map(elapsed => ({ ...base, phase: 'launching' as const, elapsed, total: 12 + elapsed })), turning, crash];
  for (const state of states) {
    h.draw(JSON.parse(JSON.stringify(state)));
    for (const role of ['trinity', 'keymaker'] as const) for (const [index, side] of ['R', 'L'].entries()) {
      const rig = h.rigs[role], peg = h.bike.getObjectByName(`motorcycle-${role === 'trinity' ? 'rider' : 'passenger'}-peg-${1 - index}`)!;
      const ankle = rig.hero?.bones.get(`ankle_${side}`) ?? rig.ankles[index]; let support = Infinity;
      const sample = (world: THREE.Vector3) => {
        const local = peg.worldToLocal(world);
        if (Math.abs(local.x) < .3 && Math.abs(local.z) < .11) support = Math.min(support, Math.abs(local.y - .06));
      };
      if (rig.hero) rig.hero.root.traverseVisible(object => {
        if (!(object instanceof THREE.SkinnedMesh) || (object.material as THREE.Material).name !== 'Boot leather') return;
        const ids = object.geometry.attributes.skinIndex, weights = object.geometry.attributes.skinWeight;
        for (let v = 0; v < object.geometry.attributes.position.count; v++) {
          if (![0, 1, 2, 3].some(j => weights.getComponent(v, j) > .5 && object.skeleton.bones[ids.getComponent(v, j)] === ankle)) continue;
          const world = object.getVertexPosition(v, new THREE.Vector3()); object.localToWorld(world); sample(world);
        }
      });
      else ankle.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        for (let v = 0; v < object.geometry.attributes.position.count; v++) sample(object.localToWorld(object.getVertexPosition(v, new THREE.Vector3())));
      });
      assert.ok(support < .035, `${state.phase}/${state.elapsed}/${role}/${side}: real sole misses peg by ${support}`);
    }
  }
  h.draw(base); const once = h.rigs.trinity.hero!.bones.get('wrist_R')!.matrixWorld.clone();
  h.draw(crash, .1); h.draw(base, .1);
  assert.ok(once.elements.every((value, i) => Math.abs(value - h.rigs.trinity.hero!.bones.get('wrist_R')!.matrixWorld.elements[i]) < 1e-7), 'cold/saved-clock pose must not depend on the previous rendered frame');
});

test('both delivered riders put their soles on the motorcycle footrests rather than inside the tank', async t => {
  const h = await setup(t), state = { ...newFreewayPickup(), phase: 'mounted' as const, total: 12, key: true };
  h.draw(state); const bike = freewayPickupBike(state), center = FILM_SETS.film_freeway_101.center;
  for (const role of ['trinity', 'keymaker'] as const) for (const [i, side] of ['R', 'L'].entries()) {
    const rig = h.rigs[role], ankle = rig.hero?.bones.get(`ankle_${side}`) ?? rig.ankles[i];
    const point = ankle.getWorldPosition(new THREE.Vector3());
    assert.ok(Math.abs(Math.abs(point.x - center.x - bike.x) - 1.05) < .12, `${role}/${side} cannot leave its foot through the motorcycle center at ${point.toArray()}`);
    assert.ok(point.y - (center.y - 1 + bike.y) > .9 && point.y - (center.y - 1 + bike.y) < 1.35,
      `${role}/${side} ankle does not match the peg and sole height: ${point.y - center.y + 1 - bike.y}`);
  }
});

test('the Keymaker holds the delivered Trinity waist rather than reaching into empty air', async t => {
  const h = await setup(t), state = { ...newFreewayPickup(), phase: 'mounted' as const, total: 12, key: true };
  h.draw(state); const hero = h.rigs.trinity.hero!, garment: THREE.Vector3[] = [];
  hero.root.traverseVisible(object => {
    if (!(object instanceof THREE.SkinnedMesh) || (object.material as THREE.Material).name !== 'Coat leather') return;
    for (let v = 0; v < object.geometry.attributes.position.count; v++) {
      const point = object.getVertexPosition(v, new THREE.Vector3()); object.localToWorld(point); garment.push(point);
    }
  });
  for (const elbow of h.rigs.keymaker.elbows) {
    const palm = elbow.localToWorld(new THREE.Vector3(0, -.75, .005));
    const distance = Math.min(...garment.map(point => point.distanceTo(palm)));
    assert.ok(distance < .07, `passenger palm is ${distance} away from the actual leather waist`);
  }
});

test('the delivered seated leather body does not enter the actual rounded fuel tank', async t => {
  const h = await setup(t), state = { ...newFreewayPickup(), phase: 'mounted' as const, total: 12, key: true };
  h.draw(state); const tank = h.bike.getObjectByName('motorcycle-fuel-tank')!; let sampled = 0, deepest = 1;
  h.rigs.trinity.hero!.root.traverseVisible(object => {
    if (!(object instanceof THREE.SkinnedMesh) || (object.material as THREE.Material).name !== 'Coat leather') return;
    for (let v = 0; v < object.geometry.attributes.position.count; v++) {
      const world = object.getVertexPosition(v, new THREE.Vector3()); object.localToWorld(world);
      sampled++; deepest = Math.min(deepest, tank.worldToLocal(world).length());
    }
  });
  assert.ok(sampled > 100 && deepest >= .98, `actual leather vertices enter the fuel tank by ${1 - deepest} of its radius`);
});

test('the actual seated first-person eye sees the road through the windshield on the saved ramp', async t => {
  const h = await setup(t), base = { ...newFreewayPickup(), phase: 'mounted' as const, total: 12, key: true };
  for (const elapsed of [0, .25, .5]) {
    const state = elapsed ? { ...base, phase: 'launching' as const, elapsed, total: 12 + elapsed } : base;
    h.draw(state); const camera = new THREE.PerspectiveCamera(70, 16 / 9, .06, 1000);
    const controls = { motion: { freewayPickup: state }, firstPerson: true, yaw: 0, pitch: .03, camera };
    PlayerControls.prototype.syncFreewayPickupCamera.call(controls as unknown as PlayerControls, h.groups.trinity);
    const direction = camera.getWorldDirection(new THREE.Vector3()), ray = new THREE.Raycaster(camera.position, direction, .06, 10);
    const opaque = ray.intersectObject(h.bike, true).filter(hit => {
      const material = (hit.object as THREE.Mesh).material as THREE.Material;
      return !(material.transparent && material.opacity < .3);
    });
    assert.equal(opaque.length, 0, `saved ramp ${elapsed}: ${opaque[0]?.object.name || 'opaque fairing'} blocks the actual eye`);
    const center = FILM_SETS.film_freeway_101.center, bike = freewayPickupBike(state);
    const road = new THREE.Vector3(center.x + bike.x, center.y - 1, center.z + bike.z + 60), screen = road.clone().project(camera);
    assert.ok(Math.abs(screen.x) < .9 && Math.abs(screen.y) < .9 && screen.z > -1 && screen.z < 1, 'the landing road must remain inside the real field of view');
    const roadRay = new THREE.Raycaster(camera.position, road.sub(camera.position).normalize(), .06, 10);
    assert.equal(roadRay.intersectObject(h.bike, true).filter(hit => {
      const material = (hit.object as THREE.Mesh).material as THREE.Material;
      return !(material.transparent && material.opacity < .3);
    }).length, 0, 'the front fairing must not hide the road below the horizon');
  }
});

function palmVertices(rig: import('../packages/client/src/agents/CharacterModel.js').CharacterRig, side: 'R' | 'L') {
  const points: THREE.Vector3[] = [];
  if (rig.hero) rig.hero.root.traverseVisible(object => {
    if (!(object instanceof THREE.SkinnedMesh) || (object.material as THREE.Material).name !== 'Skin') return;
    const joints = object.geometry.attributes.skinIndex, weights = object.geometry.attributes.skinWeight;
    for (let v = 0; v < object.geometry.attributes.position.count; v++) {
      if (![0, 1, 2, 3].some(i => weights.getComponent(v, i) > .5 && object.skeleton.bones[joints.getComponent(v, i)]?.name === `wrist_${side}`)) continue;
      points.push(object.localToWorld(object.getVertexPosition(v, new THREE.Vector3())));
    }
  });
  else rig.elbows[side === 'R' ? 0 : 1].traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    for (let v = 0; v < object.geometry.attributes.position.count; v++) points.push(object.localToWorld(object.getVertexPosition(v, new THREE.Vector3())));
  });
  return points;
}

test('one physical key changes hands at actual palm contact without jumping, including a cold paused redraw', async t => {
  const h = await setup(t), base = { ...newFreewayPickup(), phase: 'keyhandoff' as const, total: 12, x: 14, z: 5.8 };
  const positions: THREE.Vector3[] = [];
  for (const [elapsed, key] of [[.849, false], [.85, true]] as const) {
    h.draw({ ...base, elapsed, key });
    const keys: THREE.Object3D[] = [];
    for (const rig of Object.values(h.rigs)) rig.root.traverseVisible(o => { if (o.name === 'freeway-ignition-key') keys.push(o); });
    assert.equal(keys.length, 1, 'one actual key must be visible, owned by the correct hand');
    const holder = key ? h.rigs.trinity : h.rigs.keymaker;
    assert.ok(holder.root.getObjectById(keys[0].id));
    const contact = keys[0].localToWorld(new THREE.Vector3()); positions.push(contact);
    for (const [role, side] of [['trinity', 'L'], ['keymaker', 'R']] as const) {
      const palms = palmVertices(h.rigs[role], side);
      const distance = Math.min(...palms.map(point => point.distanceTo(contact)));
      assert.ok(palms.length > 20 && distance < .08,
        `${elapsed}/${role} actual palm misses key by ${distance}; key at ${contact.toArray()}`);
    }
  }
  assert.ok(positions[0].distanceTo(positions[1]) < .015, 'changing owner cannot teleport the physical key');
  const saved = { ...base, elapsed: .85, key: true };
  h.draw({ ...base, phase: 'mounted', key: true }); h.draw(JSON.parse(JSON.stringify(saved)), .1);
  assert.ok(h.rigs.trinity.root.getObjectByName('freeway-ignition-key')!.getWorldPosition(new THREE.Vector3()).distanceTo(positions[1]) < 1e-7);
});

test('Trinity visibly holds the phone and a single aimed pistol, with actual hand geometry retained in first person', async t => {
  const h = await setup(t), base = { ...newFreewayPickup(), total: 12, x: 14, z: 5.8 };
  h.draw({ ...base, phase: 'key', elapsed: 1.3 });
  const phones: THREE.Object3D[] = []; h.rigs.trinity.root.traverseVisible(o => { if (o.name === 'freeway-call-phone') phones.push(o); });
  assert.equal(phones.length, 1, 'the call must have an actual handset');
  const phone = phones[0], palms = palmVertices(h.rigs.trinity, 'R'), grip = phone.localToWorld(new THREE.Vector3(0, -.09, -.03));
  assert.ok(Math.min(...palms.map(point => point.distanceTo(grip))) < .08, 'phone cannot float beside the hand');
  const shooting = { ...base, phase: 'shooting' as const, elapsed: .5, key: true, chain: false, shotAt: base.total };
  h.draw(shooting, 0, true);
  const guns: THREE.Object3D[] = []; h.rigs.trinity.root.traverseVisible(o => { if (o.name === 'character-hel_pistol') guns.push(o); });
  assert.equal(guns.length, 1, 'the chain shot uses one visible pistol');
  const gun = guns[0], hand = palmVertices(h.rigs.trinity, 'R');
  assert.ok(hand.length > 20, 'the actual right hand must remain visible in first person');
  const gunGrip = gun.localToWorld(new THREE.Vector3(0, -.09, .13));
  assert.ok(Math.min(...hand.map(point => point.distanceTo(gunGrip))) < .08, 'the pistol grip must meet the delivered palm');
  const chain = h.bike.parent!.getObjectByName('matrix-carrier-bike-chain')!.children[0].localToWorld(new THREE.Vector3(-.13, 0, 0));
  const muzzle = gun.localToWorld(new THREE.Vector3(0, -.615, 0)), direction = new THREE.Vector3(0, -1, 0).transformDirection(gun.matrixWorld);
  assert.ok(direction.dot(chain.sub(muzzle).normalize()) > .995, 'the actual barrel must point at the physical chain');
  const skin = h.rigs.trinity.hero!.trackingSkin!;
  assert.ok(skin && skin.mesh.geometry === skin.firstPerson, 'own head geometry must be filtered while keeping arms visible');
});

test('the physical muzzle and shot path clear the actual tank and fairing instead of shooting through the motorcycle', async t => {
  const h = await setup(t), state = { ...newFreewayPickup(), phase: 'shooting' as const, elapsed: .5, total: 12, key: true, chain: false, shotAt: 12 };
  h.draw(state, 0, true); const gun = h.rigs.trinity.weapons![0];
  const muzzle = gun.localToWorld(new THREE.Vector3(0, -.615, 0));
  assert.ok(h.bike.getObjectByName('motorcycle-fuel-tank')!.worldToLocal(muzzle.clone()).length() > 1.01,
    'the delivered muzzle cannot originate inside the actual fuel tank');
  const link = h.bike.parent!.getObjectByName('matrix-carrier-bike-chain')!.children[0];
  const chain = link.localToWorld(new THREE.Vector3(-.13, 0, 0));
  const direction = new THREE.Vector3(0, -1, 0).transformDirection(gun.matrixWorld);
  assert.ok(direction.dot(chain.clone().sub(muzzle).normalize()) > .995, 'the physical barrel must aim at the side anchor');
  const ray = new THREE.Raycaster(muzzle, chain.clone().sub(muzzle).normalize(), .015, muzzle.distanceTo(chain) - .04);
  const hits = ray.intersectObject(h.bike, true);
  assert.equal(hits.length, 0, `a real bike surface stands between muzzle and chain: ${hits.map(hit => `${hit.object.name || hit.object.type} at ${hit.point.toArray()}`)}`);
  ray.far += .1;
  assert.ok(ray.intersectObject(link).length > 0, 'the shot must hit the actual metal ring rather than its empty center');
  const camera = new THREE.PerspectiveCamera(70, 16 / 9, .06, 1000);
  PlayerControls.prototype.syncFreewayPickupCamera.call({ motion: { freewayPickup: state }, firstPerson: true, yaw: -.8, pitch: .55, camera } as unknown as PlayerControls, h.groups.trinity);
  camera.updateMatrixWorld(true);
  const screen = muzzle.clone().project(camera);
  assert.ok(Math.abs(screen.x) < .9 && Math.abs(screen.y) < .9 && screen.z > -1 && screen.z < 1, `the muzzle must be visible ahead of the actual first-person eye: ${screen.toArray()}`);
});
