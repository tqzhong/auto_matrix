import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { APARTMENT_NETWORK, APARTMENT_ROOM, computerInvestigationStep, computerNetworkPull } from '@auto_matrix/shared';
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
      const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, officeShirt: false, glasses: false, computerCheck: check };
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
    const motion = newMotion(), input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, officeShirt: false, glasses: false };
    models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); rig.root.updateMatrixWorld(true);
    for (const { mesh } of rig.wardrobe) {
      if (!(mesh instanceof THREE.SkinnedMesh)) continue;
      let visible = true; for (let node: THREE.Object3D | null = mesh; node; node = node.parent) if (!node.visible) visible = false;
      if (!visible) continue;
      mesh.skeleton.update(); const indices = mesh.geometry.index;
      const used = indices ? new Set(Array.from(indices.array)) : Array.from({ length: mesh.geometry.attributes.position.count }, (_, i) => i);
      for (const i of used) {
        mesh.getVertexPosition(i, point); mesh.localToWorld(point); point.sub(origin);
        const insideSeat = point.x > -9.98 && point.x < -8.02 && point.y > 1.37 && point.y < 1.63 && point.z > -9.255 && point.z < -7.545;
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
