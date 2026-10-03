import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { APARTMENT_CHAIR, APARTMENT_NETWORK, APARTMENT_ROOM, apartmentComputerPose, computerInvestigationStep, computerNetworkPull, type ApartmentGesture } from '@auto_matrix/shared';
import { HeroModels } from '../packages/client/src/agents/HeroModel.js';
import { advanceMotion, newMotion } from '../packages/client/src/agents/CharacterMotion.js';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

async function loadGeometry(id: string) {
  const glb = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
  const length = glb.readUInt32LE(12), document = JSON.parse(glb.subarray(20, 20 + length).toString());
  for (const material of document.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = glb.subarray(20 + length), result = Buffer.alloc(20 + padded.length + bin.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); bin.copy(result, 20 + padded.length);
  return new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
}

test('Neo uses his existing plain home shirt consistently while approaching, reading and leaving the computer chair', async () => {
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking'].map(async id => [id, await loadGeometry(id)] as const)));
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: (id: string) => Promise<NonNullable<ReturnType<typeof assets.get>>> }).load = async id => assets.get(id)!;
  const rig = (await models.create('neo'))!;
  try {
    for (const contact of [undefined, { phase: 'reply', elapsed: 0, role: 'neo' } as ApartmentGesture, undefined]) {
      const motion = newMotion(), input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, homeClothes: true, contact };
      models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0);
      assert.ok(rig.wardrobe.some(({ mesh }) => mesh.userData.tracking && mesh.visible), 'the already shipped plain shirt must replace the long coat at home');
      assert.equal(rig.wardrobe.some(part => part.outer && part.mesh.visible), false, 'returning control cannot make the long coat reappear');
    }
  } finally { models.dispose(); }
});

test('the chair approach lifts one real shoe while the supporting ankle stays planted through the saved step', async () => {
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking'].map(async id => [id, await loadGeometry(id)] as const)));
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: (id: string) => Promise<NonNullable<ReturnType<typeof assets.get>>> }).load = async id => assets.get(id)!;
  const rig = (await models.create('neo'))!, origin = new THREE.Vector3(APARTMENT_ROOM.center.x, 0, APARTMENT_ROOM.center.z);
  const frame = (phase: 'signal' | 'knocking', elapsed: number) => {
    const contact = { role: 'neo', phase, elapsed, chairMotion: 'stepping' } as ApartmentGesture, pose = apartmentComputerPose(contact);
    rig.root.position.copy(origin).add(new THREE.Vector3(pose.x, 0, pose.z)); rig.root.rotation.y = pose.yaw;
    const motion = newMotion(), input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, homeClothes: true, contact };
    models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); rig.root.updateMatrixWorld(true);
    return Object.fromEntries(['R', 'L'].map(side => [side, rig.bones.get('ankle_' + side)!.getWorldPosition(new THREE.Vector3())])) as Record<'R' | 'L', THREE.Vector3>;
  };
  try {
    for (const [phase, a, b, support] of [
      ['signal', .22, .3, 'L'], ['signal', .6, .7, 'R'], ['signal', 1, 1.1, 'L'], ['signal', 1.4, 1.5, 'R'],
      ['knocking', 2.35, 2.45, 'R'], ['knocking', 2.75, 2.85, 'L'], ['knocking', 3.15, 3.25, 'R'], ['knocking', 3.55, 3.63, 'L'],
    ] as const) {
      const first = frame(phase, a), second = frame(phase, b);
      const moving = support === 'R' ? 'L' : 'R';
      assert.ok(first[support].distanceTo(second[support]) < .012, `${phase} ${a}: the planted ankle slides ${first[support].distanceTo(second[support])} with the root`);
      assert.ok(second[moving].y - second[support].y > .09, `${phase} ${b}: the moving shoe must lift instead of sliding across the floor`);
      assert.ok(first[moving].distanceTo(second[moving]) > .08, `${phase} ${a}: the swinging foot must travel while the other foot supports the body`);
      const restored = frame(phase, b);
      assert.ok(restored.R.distanceTo(second.R) < .00001 && restored.L.distanceTo(second.L) < .00001, 'reconstructing the same saved clock must reproduce both foot contacts');
    }
    frame('knocking', 3);
    const toe = new THREE.Vector3(0, 0, 1).applyQuaternion(rig.bones.get('ankle_L')!.getWorldQuaternion(new THREE.Quaternion()));
    assert.ok(toe.x < -.9, 'the exit supporting foot must point toward the leftward steps rather than twisting backwards');
  } finally { models.dispose(); }
});

test('the delivered home body stays clear of the chair and workbench while sitting down and getting up', async () => {
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking'].map(async id => [id, await loadGeometry(id)] as const)));
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: (id: string) => Promise<NonNullable<ReturnType<typeof assets.get>>> }).load = async id => assets.get(id)!;
  const rig = (await models.create('neo'))!, origin = new THREE.Vector3(APARTMENT_ROOM.center.x, 0, APARTMENT_ROOM.center.z), point = new THREE.Vector3();
  const samples: ApartmentGesture[] = [
    ...[0, .2, .4, .6, .8, 1, 1.2, 1.4, 2, 4, 7.9].map(elapsed => ({ role: 'neo', phase: 'signal', elapsed } as const)),
    { role: 'neo', phase: 'reply', elapsed: 0 },
    ...[.5, 1, 1.8, 2, 2.2, 2.4, 2.6, 2.8, 3, 3.2, 3.4, 3.8].map(elapsed => ({ role: 'neo', phase: 'knocking', elapsed } as const)),
    ...(['signal', 'knocking'] as const).flatMap(phase => Array.from({ length: 80 }, (_, i) => ({ role: 'neo', phase, elapsed: i * .05, chairMotion: 'stepping' } as const))),
  ];
  try {
    for (const contact of samples) {
      const pose = apartmentComputerPose(contact); rig.root.position.copy(origin).add(new THREE.Vector3(pose.x, 0, pose.z)); rig.root.rotation.y = pose.yaw;
      const motion = newMotion(), input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, homeClothes: true, contact };
      models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); rig.root.updateMatrixWorld(true);
      let shoeFloor = Infinity;
      for (const { mesh } of rig.wardrobe) {
        if (!(mesh instanceof THREE.SkinnedMesh)) continue;
        let visible = true; for (let node: THREE.Object3D | null = mesh; node; node = node.parent) if (!node.visible) visible = false;
        if (!visible) continue;
        mesh.skeleton.update(); const indices = mesh.geometry.index;
        const used = indices ? new Set(Array.from(indices.array)) : Array.from({ length: mesh.geometry.attributes.position.count }, (_, i) => i);
        for (const i of used) {
          mesh.getVertexPosition(i, point); mesh.localToWorld(point); point.sub(origin);
          if (mesh.name === 'shoes01') shoeFloor = Math.min(shoeFloor, point.y);
          const insideSeat = point.x > -9.98 && point.x < -8.02 && Math.abs(point.y - APARTMENT_CHAIR.seatY) < (contact.chairMotion ? .145 : .13) && Math.abs(point.z - APARTMENT_CHAIR.z) < APARTMENT_CHAIR.seatDepth / 2 - .02;
          const insideBack = point.x > -9.94 && point.x < -8.06 && point.y > APARTMENT_CHAIR.height - 1.48 && point.y < APARTMENT_CHAIR.height - .02 && point.z > -7.70 && point.z < -7.50;
          const insideDesk = point.x > -12.98 && point.x < -5.02 && point.z > -13.68 && point.z < -10.32 && point.y > 2.12 && point.y < 2.38;
          assert.equal(insideSeat || insideBack || insideDesk, false, `${contact.phase} ${contact.elapsed}: ${mesh.name} vertex ${i} clips ${insideSeat ? 'seat' : insideBack ? 'back' : 'desk'} at ${point.toArray()}`);
        }
      }
      assert.ok(shoeFloor >= -.015 && shoeFloor < .035, `${contact.phase} ${contact.elapsed}: the actual soles leave the floor at ${shoeFloor}`);
      if (pose.seated === 1) for (const side of ['R', 'L'] as const) {
        const palm = rig.bones.get('wrist_' + side)!.localToWorld(new THREE.Vector3(side === 'R' ? .065 : -.065, -.17, .01)).sub(origin);
        const key = new THREE.Vector3(-9 + (side === 'R' ? .6 : -.6), 2.65 + (contact.phase === 'knocking' && contact.elapsed < .6 ? Math.sin(contact.elapsed * 28) * .025 : 0), -11.03 + 4 * .135);
        assert.ok(palm.distanceTo(key) < .035, `${contact.phase} ${contact.elapsed}: the ${side} hand cannot reach the front keyboard row at ${palm.toArray()}`);
      }
    }
  } finally { models.dispose(); }
});

test('the delivered daily Neo reaches the cable with intact arms and keeps visible hands and clothes above the workbench', async () => {
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking'].map(async id => [id, await loadGeometry(id)] as const)));
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: (id: string) => Promise<NonNullable<ReturnType<typeof assets.get>>> }).load = async id => assets.get(id)!;
  const rig = (await models.create('neo'))!;
  const origin = new THREE.Vector3(APARTMENT_ROOM.center.x, 0, APARTMENT_ROOM.center.z), point = new THREE.Vector3();
  try {
    for (const phase of ['unplugging', 'replugging'] as const) for (const elapsed of [.3, .5, .7, .9, 1.1, 1.4, 1.7]) {
      rig.root.position.copy(origin).add(new THREE.Vector3(APARTMENT_NETWORK.approach.x, 0, APARTMENT_NETWORK.approach.z)); rig.root.rotation.y = Math.PI;
      const check = { phase, elapsed }, motion = newMotion();
      const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, homeClothes: true, officeShirt: false, glasses: false, computerCheck: check };
      models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); rig.root.updateMatrixWorld(true);
      if (elapsed >= .5 && elapsed <= 1.1) {
        const pull = computerNetworkPull(check), plug = new THREE.Vector3(APARTMENT_NETWORK.plug.x, APARTMENT_NETWORK.plug.y - .16 * pull + APARTMENT_NETWORK.gripHeight, APARTMENT_NETWORK.plug.z + .31 * pull).add(origin);
        const palm = rig.bones.get('wrist_R')!.localToWorld(new THREE.Vector3(.065, -.17, .01));
        assert.ok(palm.distanceTo(plug) < .035, `${phase} ${elapsed}: the visible hand cannot reach the real cable, distance ${palm.distanceTo(plug)}`);
      }
      let surfaceGap = Infinity;
      for (const { mesh } of rig.wardrobe) {
        if (!(mesh instanceof THREE.SkinnedMesh)) continue;
        let visible = true; for (let node: THREE.Object3D | null = mesh; node; node = node.parent) if (!node.visible) visible = false;
        if (!visible) continue;
        mesh.skeleton.update(); const indices = mesh.geometry.index;
        const used = indices ? new Set(Array.from(indices.array)) : Array.from({ length: mesh.geometry.attributes.position.count }, (_, i) => i);
        for (const i of used) {
          mesh.getVertexPosition(i, point); mesh.localToWorld(point); point.sub(origin);
          const insideDesk = point.x > -12.98 && point.x < -5.02 && point.z > -13.68 && point.z < -10.32 && point.y > 2.12 && point.y < 2.38;
          assert.equal(insideDesk, false, `${phase} ${elapsed}: ${mesh.name} vertex ${i} inside the workbench at ${point.toArray()}`);
          const pull = computerNetworkPull(check), plugY = APARTMENT_NETWORK.plug.y - .16 * pull, plugZ = APARTMENT_NETWORK.plug.z + .31 * pull;
          const insidePlug = Math.abs(point.x - APARTMENT_NETWORK.plug.x) < .073 && Math.abs(point.y - plugY) < .033 && Math.abs(point.z - plugZ) < .093;
          assert.equal(insidePlug, false, `${phase} ${elapsed}: ${mesh.name} vertex ${i} inside the cable casing at ${point.toArray()}`);
          if (Math.abs(point.x - APARTMENT_NETWORK.plug.x) < .08 && Math.abs(point.z - plugZ) < .10) surfaceGap = Math.min(surfaceGap, Math.abs(point.y - plugY - .04));
        }
      }
      if (elapsed >= .5 && elapsed <= 1.1) assert.ok(surfaceGap < .03, `${phase} ${elapsed}: the delivered skin floats ${surfaceGap} above the casing instead of touching it`);
    }
  } finally { models.dispose(); }
});

test('the standing screen investigation point keeps the delivered daily Neo outside the office chair', async () => {
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking'].map(async id => [id, await loadGeometry(id)] as const)));
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: (id: string) => Promise<NonNullable<ReturnType<typeof assets.get>>> }).load = async id => assets.get(id)!;
  const rig = (await models.create('neo'))!, origin = new THREE.Vector3(APARTMENT_ROOM.center.x, 0, APARTMENT_ROOM.center.z), point = new THREE.Vector3();
  try {
    const step = computerInvestigationStep(); rig.root.position.set(step.position.x, 0, step.position.z); rig.root.rotation.y = Math.PI;
    const motion = newMotion(), input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, homeClothes: true, officeShirt: false, glasses: false };
    models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); rig.root.updateMatrixWorld(true);
    for (const { mesh } of rig.wardrobe) {
      if (!(mesh instanceof THREE.SkinnedMesh)) continue;
      let visible = true; for (let node: THREE.Object3D | null = mesh; node; node = node.parent) if (!node.visible) visible = false;
      if (!visible) continue;
      mesh.skeleton.update(); const indices = mesh.geometry.index;
      const used = indices ? new Set(Array.from(indices.array)) : Array.from({ length: mesh.geometry.attributes.position.count }, (_, i) => i);
      for (const i of used) {
        mesh.getVertexPosition(i, point); mesh.localToWorld(point); point.sub(origin);
        const insideSeat = point.x > -9.98 && point.x < -8.02 && Math.abs(point.y - APARTMENT_CHAIR.seatY) < .13 && point.z > -9.255 && point.z < -7.545;
        assert.equal(insideSeat, false, `${mesh.name} vertex ${i} stands through the chair seat at ${point.toArray()}`);
      }
    }
  } finally { models.dispose(); }
});

test('the real first-person cable camera sees the hand without looking through Neo’s own head or chest', async t => {
  class InputTarget extends EventTarget { matches() { return false; } }
  const window = new InputTarget(), canvas = new InputTarget(), document = Object.assign(new InputTarget(), { pointerLockElement: canvas, hidden: false, exitPointerLock() {} });
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key)); Object.assign(globalThis, { window, document });
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking'].map(async id => [id, await loadGeometry(id)] as const)));
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: (id: string) => Promise<NonNullable<ReturnType<typeof assets.get>>> }).load = async id => assets.get(id)!;
  const rig = (await models.create('neo'))!, group = new THREE.Group(); rig.root.position.y = -1; group.add(rig.root);
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const neo = world.agents.get('neo')!;
  neo.position = { x: APARTMENT_ROOM.center.x + APARTMENT_NETWORK.approach.x, y: 1, z: APARTMENT_ROOM.center.z + APARTMENT_NETWORK.approach.z };
  neo.rotation = Math.PI; neo.currentLocation = 'neo_apartment';
  neo.currentAction = { type: 'idle', parameters: { computerCheck: { phase: 'unplugging', elapsed: .83 } }, startedAt: 0, duration: 1, progress: 0 };
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000), motion = newMotion();
  const controls = new PlayerControls(canvas as unknown as HTMLCanvasElement, camera, () => {}, () => {});
  t.after(() => { controls.dispose(); models.dispose(); ['window', 'document'].forEach((key, i) => {
    if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!); else Reflect.deleteProperty(globalThis, key);
  }); });
  controls.possess(neo); controls.firstPerson = true;
  for (let i = 0; i < 20; i++) {
    controls.update(.05, neo, group, false);
    models.animate(rig, advanceMotion(motion, controls.motion, 0), motion, controls.motion, 0); group.updateMatrixWorld(true);
  }
  const check = controls.motion.computerCheck!, pull = computerNetworkPull(check);
  const grip = new THREE.Vector3(APARTMENT_ROOM.center.x + APARTMENT_NETWORK.plug.x, APARTMENT_NETWORK.plug.y - .16 * pull + APARTMENT_NETWORK.gripHeight, APARTMENT_ROOM.center.z + APARTMENT_NETWORK.plug.z + .31 * pull);
  const ray = new THREE.Raycaster(camera.position, grip.clone().sub(camera.position).normalize(), .01, camera.position.distanceTo(grip) - .3);
  const visible = rig.wardrobe.filter(({mesh}) => {
    for (let node: THREE.Object3D | null = mesh; node; node = node.parent) if (!node.visible) return false;
    return true;
  }).map(({mesh}) => mesh);
  const blocking = ray.intersectObjects(visible, false);
  assert.equal(blocking.length, 0, `the actual head/chest blocks the cable view: ${blocking.map(hit => `${hit.object.name} @ ${hit.distance}`).join(', ')}`);
  const projected = grip.clone().project(camera);
  assert.ok(Math.abs(projected.x) < .7 && Math.abs(projected.y) < .7 && projected.z > -1 && projected.z < 1, `the cable is outside the usable first-person view at ${projected.toArray()}, eye ${camera.position.toArray()}`);
});
