import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, TRUCK_WEAPONS, newTruckWeapons, truckWeaponGrip, truckWeaponPairRoot, type TruckWeaponGesture } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';

test('delivered hands hold the gun and katana, paired arms reach the wrist, and released geometry rests above the actual roof', async t => {
  const assets = new Map();
  for (const id of ['morpheus', 'smith', 'trinity', 'trinity-club']) {
    const glb = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
    const length = glb.readUInt32LE(12), source = JSON.parse(glb.subarray(20, 20 + length).toString());
    for (const material of source.materials ?? []) { if (material.pbrMetallicRoughness) delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
    source.images = []; source.textures = [];
    const json = Buffer.from(JSON.stringify(source)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
    const bin = glb.subarray(20 + length), buffer = Buffer.alloc(20 + padded.length + bin.length);
    buffer.writeUInt32LE(0x46546c67, 0); buffer.writeUInt32LE(2, 4); buffer.writeUInt32LE(buffer.length, 8);
    buffer.writeUInt32LE(padded.length, 12); buffer.writeUInt32LE(0x4e4f534a, 16); padded.copy(buffer, 20); bin.copy(buffer, 20 + padded.length);
    assets.set(id, await new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), ''));
  }
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async (url: string) => assets.get(url.split('/').pop()!.replace('.glb', '')));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData() {}, fillRect() {}, strokeRect() {}, fillText() {}, createRadialGradient: () => ({ addColorStop() {} }) }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  const roles = ['morpheus', 'agent_johnson'] as const, center = FILM_SETS.film_freeway_101.center;
  for (const role of roles) { world.agents.get(role)!.isInMatrix = true; world.agents.get(role)!.currentLocation = 'film_freeway_101'; }
  const create = () => Object.fromEntries(roles.map(role => {
    const rig = models.create(world.agents.get(role)!), group = new THREE.Group(); group.add(rig.root); rig.root.position.y = -1;
    return [role, { rig, group }];
  })) as Record<typeof roles[number], { rig: ReturnType<CharacterModels['create']>; group: THREE.Group }>;
  const warm = create(), cold = create(); await new Promise(resolve => setImmediate(resolve));
  assert.ok(warm.morpheus.rig.hero && warm.agent_johnson.rig.hero && cold.morpheus.rig.hero);
  t.after(() => { models.dispose(); globalThis.document = document; });
  const bodies = { morpheus: { x: .3, y: 6.6, z: -3.5, yaw: Math.PI }, agent_johnson: { x: .3, y: 6.6, z: -3.5 - TRUCK_WEAPONS.pairDistance, yaw: 0 } };
  const gesture = (phase: TruckWeaponGesture['phase'], elapsed: number): TruckWeaponGesture => {
    const w: TruckWeaponGesture = { ...newTruckWeapons(), phase, elapsed, total: 4 + elapsed,
      role: 'morpheus', pair: bodies, bodies, truck: { x: 13.7, z: -320 }, shots: 2, slashes: 2, parries: 2 };
    return { ...w, bodies: { ...bodies, agent_johnson: truckWeaponPairRoot(w, 'agent_johnson')! } };
  };
  const draw = (cast: typeof warm, w: TruckWeaponGesture, delta: number) => {
    for (const role of roles) {
      const { rig, group } = cast[role], p = w.bodies[role];
      group.position.set(center.x + w.truck.x + p.x, center.y + p.y, center.z + w.truck.z + p.z); rig.root.rotation.y = p.yaw;
      models.animate(rig, delta, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, truckWeapons: { ...w, role } }, 0);
      group.updateMatrixWorld(true); rig.root.traverse(o => { if (o instanceof THREE.SkinnedMesh) o.skeleton.update(); });
    }
  };
  const palm = (cast: typeof warm, role: typeof roles[number], side: 'R' | 'L') => cast[role].rig.hero!.bones.get(`wrist_${side}`)!
    .localToWorld(new THREE.Vector3(side === 'R' ? .09 : -.09, -.18, .02));
  const grip = (w: TruckWeaponGesture, weapon: 'gun' | 'sword') => {
    const p = truckWeaponGrip(w, w.bodies.morpheus, weapon);
    return new THREE.Vector3(center.x + w.truck.x + p.x, center.y - 1 + p.y, center.z + w.truck.z + p.z);
  };
  const points = (object: THREE.Object3D) => {
    const out: THREE.Vector3[] = [];
    object.traverseVisible(mesh => { if (mesh instanceof THREE.Mesh) for (let i = 0; i < mesh.geometry.attributes.position.count; i++) out.push(mesh.localToWorld(mesh.getVertexPosition(i, new THREE.Vector3()))); });
    return out;
  };
  const samples = [gesture('gun', .1), gesture('gun_disarm', .3), gesture('gun_disarm', .54), ...[0, .05, .15, .33, .5, .6, .64].map(t => gesture('slash', t)),
    gesture('counter', .55), gesture('sword_disarm', .54)];
  for (const w of samples) {
    if (['slash', 'counter', 'sword_disarm'].includes(w.phase)) w.gun = { at: 1, root: truckWeaponGrip(w, bodies.morpheus, 'gun'), pitch: 0 };
    for (let i = 0; i < 3; i++) draw(warm, w, .05); draw(cold, w, 0);
    for (const weapon of ['gun', 'sword'] as const) {
      if (w[weapon]) continue;
      const side = weapon === 'gun' ? 'R' : 'L', actual = palm(warm, 'morpheus', side), expected = grip(w, weapon);
      assert.ok(actual.distanceTo(expected) < .04, `${w.phase} ${weapon} palm misses the saved grip by ${actual.distanceTo(expected)}`);
      assert.ok(actual.distanceTo(palm(cold, 'morpheus', side)) < .015, `${w.phase} ${weapon}: cold pose differs from warm pose`);
      const prop = warm.morpheus.rig.truckProps![weapon]; assert.ok(prop.visible);
      assert.ok(prop.getWorldPosition(new THREE.Vector3()).distanceTo(actual) < .005);
    }
    if (w.phase === 'gun_disarm' || w.phase === 'sword_disarm') {
      const weapon = w.phase === 'gun_disarm' ? 'gun' : 'sword', side = weapon === 'gun' ? 'L' : 'R';
      if (w.elapsed >= .5) assert.ok(palm(warm, 'agent_johnson', side).distanceTo(grip(w, weapon)) < .19, `${w.phase}: the disarming hand misses the held wrist by ${palm(warm, 'agent_johnson', side).distanceTo(grip(w, weapon))}; hand=${palm(warm, 'agent_johnson', side).toArray()}, target=${grip(w, weapon).toArray()}, shoulder=${warm.agent_johnson.rig.hero!.bones.get(`shoulder_${side}`)!.getWorldPosition(new THREE.Vector3()).toArray()}`);
    }
    for (const role of roles) {
      for (const side of ['R', 'L']) {
        const ankle = warm[role].rig.hero!.bones.get(`ankle_${side}`)!, sole = ankle.getWorldPosition(new THREE.Vector3()).y - warm[role].rig.hero!.footHeight;
        assert.ok(Math.abs(sole - 6.6) < .06, `${w.phase} ${role} boot floats or enters the roof: ${sole}`);
      }
      assert.ok(points(warm[role].rig.root).every(p => p.y >= 6.52), `${w.phase} ${role}: a sampled body or weapon vertex enters the roof`);
    }
    if (w.phase === 'slash') {
      const sword = warm.morpheus.rig.truckProps!.sword, start = sword.localToWorld(new THREE.Vector3(0, 0, .37)), tip = sword.localToWorld(new THREE.Vector3(-.15, 0, 2.3));
      const direction = tip.clone().sub(start), ray = new THREE.Raycaster(start, direction.clone().normalize(), .05, direction.length());
      assert.equal(ray.intersectObject(warm.agent_johnson.rig.root, true).length, 0, `the katana enters Johnson's delivered body during his saved dodge at ${w.elapsed}`);
    }
  }
  const release = gesture('sword_disarm', .55), w = { ...release, gun: { at: 1, root: truckWeaponGrip(release, bodies.morpheus, 'gun'), pitch: 0 },
    sword: { at: release.total, root: truckWeaponGrip(release, bodies.morpheus, 'sword'), pitch: -.82 } };
  for (const total of [w.total, w.total + .2, w.total + .5, w.total + 1, w.total + 3]) {
    const saved = { ...w, total }; draw(warm, saved, .05); draw(cold, saved, 0);
    for (const weapon of ['gun', 'sword'] as const) {
      const prop = warm.morpheus.rig.truckProps![weapon], geometry = points(prop);
      assert.ok(Math.min(...geometry.map(p => p.y)) >= 6.595, `${weapon} geometry enters the actual roof at ${total}`);
      assert.ok(prop.getWorldPosition(new THREE.Vector3()).distanceTo(cold.morpheus.rig.truckProps![weapon].getWorldPosition(new THREE.Vector3())) < .001);
    }
  }
  for (const pitch of [.45, -.45]) {
    const saved = { ...gesture('gun', .1), shotPitch: pitch }; draw(warm, saved, 0);
    const yaw = saved.bodies.morpheus.yaw, expected = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    const barrel = new THREE.Vector3(0, 0, 1).applyQuaternion(warm.morpheus.rig.truckProps!.gun.getWorldQuaternion(new THREE.Quaternion()));
    assert.ok(barrel.distanceTo(expected) < .0001, 'the actual rendered barrel must follow camera pitch and the bullet direction');
  }
});
