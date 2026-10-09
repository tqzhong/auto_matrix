import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, HEL_GARAGE, helGarageRoot, helGarageHandle, newHelGarage } from '@auto_matrix/shared';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { HelGarageRenderer } from '../packages/client/src/engine/HelGarageRenderer.js';

async function geometry(name: string) {
  const bytes = await readFile(new URL(`../packages/client/public/assets/characters/${name}.glb`, import.meta.url));
  const length = bytes.readUInt32LE(12), source = JSON.parse(bytes.subarray(20, 20 + length).toString());
  for (const m of source.materials) { delete m.pbrMetallicRoughness.baseColorTexture; delete m.normalTexture; }
  source.images = []; source.textures = [];
  const json = Buffer.from(JSON.stringify(source)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const binary = bytes.subarray(20 + length), output = Buffer.alloc(20 + padded.length + binary.length);
  output.writeUInt32LE(0x46546c67, 0); output.writeUInt32LE(2, 4); output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(padded.length, 12); output.writeUInt32LE(0x4e4f534a, 16); padded.copy(output, 20); binary.copy(output, 20 + padded.length);
  const asset = await new GLTFLoader().parseAsync(output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength), '');
  if (name.endsWith('-head')) asset.scene.traverse(object => { if (object instanceof THREE.Mesh) (object.material as THREE.MeshStandardMaterial).map = new THREE.Texture(); });
  return asset;
}
async function setup(t: test.TestContext) {
  const names = ['trinity', 'trinity-club', 'morpheus', 'seraph-head', 'seraph-body'];
  const assets = Object.fromEntries(await Promise.all(names.map(async name => [name, await geometry(name)])));
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async url => assets[String(url).split('/').pop()!.replace('.glb', '')]);
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  t.after(() => { models.dispose(); globalThis.document = previous; }); return { world, models };
}
test('all three shipped rescuers actually reach their paired doorman wrist during a cold disarm', async t => {
  const { world, models } = await setup(t), center = FILM_SETS[HEL_GARAGE.set].center;
  for (const [pair, spot] of HEL_GARAGE.pairs.entries()) {
    const rig = models.create(world.agents.get(spot.role)!); await new Promise(resolve => setImmediate(resolve));
    const state = { ...newHelGarage(), phase: 'disarming' as const, elapsed: .65, age: 8.65 }, root = helGarageRoot(state, spot.role, pair)!;
    rig.root.position.set(center.x + root.x, center.y - 1, center.z + root.z); rig.root.rotation.y = root.yaw;
    const input = { speed: 12, grounded: true, verticalVelocity: 0, turn: .5, helGarage: { ...state, role: spot.role, pair } };
    models.animate(rig, 0, input, 0); rig.root.updateWorldMatrix(true, true);
    const wrist = rig.hero?.bones.get('wrist_L') ?? rig.mobilWrists![1];
    const palm = wrist.localToWorld(new THREE.Vector3(0, rig.hero ? -.19 : -.14, .005));
    const target = new THREE.Vector3(center.x + spot.x - .46, center.y - 1 + 3.05, center.z + spot.z + 1.1);
    assert.ok(palm.distanceTo(target) < .08, `${spot.role} wrist trap must make contact: ${palm.distanceTo(target)}`);
    const guardState = structuredClone(world.agents.get('trinity')!);
    guardState.id = `hel_garage_guard_${pair}`; guardState.faction = 'merovingian';
    const guard = models.create(guardState);
    guard.root.position.set(center.x + spot.x, center.y - 1, center.z + spot.z);
    models.animate(guard, 0, { ...input, speed: 0, helGarage: { ...state, role: 'guard', pair } }, 0);
    guard.root.updateWorldMatrix(true, true);
    const held = guard.mobilWrists![0].localToWorld(new THREE.Vector3(0, -.14, .005));
    assert.ok(palm.distanceTo(held) < .08, `${spot.role} must touch the actual guard hand: ${palm.distanceTo(held)}`);
    const saved = palm.clone(); models.animate(rig, 0, input, 0); rig.root.updateWorldMatrix(true, true);
    assert.ok(wrist.localToWorld(new THREE.Vector3(0, rig.hero ? -.19 : -.14, .005)).distanceTo(saved) < .001);
  }
});
test('Trinity keeps her palm on the moving steel-door handle before releasing it', async t => {
  const { world, models } = await setup(t), center = FILM_SETS[HEL_GARAGE.set].center, rig = models.create(world.agents.get('trinity')!);
  await new Promise(resolve => setImmediate(resolve)); assert.ok(rig.hero);
  for (const door of [0, .05, .1, .2]) {
    const state = { ...newHelGarage(), phase: 'opening' as const, elapsed: door * HEL_GARAGE.doorSeconds, age: 20 + door, door }, root = helGarageRoot(state, 'trinity', 2)!;
    rig.root.position.set(center.x + root.x, center.y - 1, center.z + root.z); rig.root.rotation.y = root.yaw;
    models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, helGarage: { ...state, role: 'trinity', pair: 2 } }, 0); rig.root.updateWorldMatrix(true, true);
    const handle = helGarageHandle(door), target = new THREE.Vector3(center.x + handle.x, center.y - 1 + handle.y, center.z + handle.z);
    const palm = rig.hero!.bones.get('wrist_R')!.localToWorld(new THREE.Vector3(0, -.19, .005));
    assert.ok(palm.distanceTo(target) < .08, `hand through or behind door at ${door}: ${palm.distanceTo(target)}`);
  }
});

test('Trinity lowers her empty hands after releasing the swinging door', async t => {
  const { world, models } = await setup(t), center = FILM_SETS[HEL_GARAGE.set].center, rig = models.create(world.agents.get('trinity')!);
  await new Promise(resolve => setImmediate(resolve));
  const state = { ...newHelGarage(), phase: 'opening' as const, elapsed: .68, age: 20, door: .4 }, root = helGarageRoot(state, 'trinity', 2)!;
  rig.root.position.set(center.x + root.x, center.y - 1, center.z + root.z); rig.root.rotation.y = root.yaw;
  models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, helGarage: { ...state, role: 'trinity', pair: 2 } }, 0);
  rig.root.updateWorldMatrix(true, true);
  for (const side of ['R', 'L']) {
    const palm = rig.hero!.bones.get(`wrist_${side}`)!.localToWorld(new THREE.Vector3(0, -.19, .005));
    assert.ok(palm.y - (center.y - 1) < 2.25, `released ${side} hand is still held up: ${palm.y - (center.y - 1)}`);
  }
});

test('the rendered doormen remain above the concrete surface while falling and after defeat', async t => {
  const { world } = await setup(t), set = new HelGarageRenderer(new THREE.Group(), world.agents.get('trinity')!);
  t.after(() => set.dispose());
  for (const elapsed of Array.from({ length: 16 }, (_, index) => index / 10)) {
    set.update({ ...newHelGarage(), phase: 'falling', elapsed, age: 14 + elapsed, hits: 3 }); set.group.updateMatrixWorld(true);
    for (let pair = 0; pair < 3; pair++) {
      const guard = set.group.getObjectByName(`hel_garage_guard_${pair}`)!;
      let bottom = Infinity;
      guard.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        for (let parent: THREE.Object3D | null = object; parent; parent = parent.parent) if (!parent.visible) return;
        if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
        for (let vertex = 0; vertex < object.geometry.attributes.position.count; vertex++) {
          const point = object.getVertexPosition(vertex, new THREE.Vector3()).applyMatrix4(object.matrixWorld);
          bottom = Math.min(bottom, point.y);
        }
      });
      assert.ok(bottom >= -.025, `guard ${pair} penetrates concrete at ${elapsed}: ${bottom}`);
      if (elapsed === 1.5) assert.ok(bottom < .08, `guard ${pair} floats above the floor after defeat: ${bottom}`);
    }
  }
});

test('a doorman still holds the raised gun when the defence window is missed', async t => {
  const { world, models } = await setup(t), center = FILM_SETS[HEL_GARAGE.set].center, spot = HEL_GARAGE.pairs[2];
  const state = structuredClone(world.agents.get('trinity')!); state.id = 'hel_garage_guard_2'; state.faction = 'merovingian';
  const rig = models.create(state); rig.root.position.set(center.x + spot.x, center.y - 1, center.z + spot.z);
  for (const phase of ['evade', 'failed'] as const) {
    models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0,
      helGarage: { ...newHelGarage(), phase, age: 10, role: 'guard', pair: 2 } }, 0);
    rig.root.updateWorldMatrix(true, true);
    const hand = rig.mobilWrists![0].localToWorld(new THREE.Vector3(0, -.14, .005));
    const gun = new THREE.Vector3(center.x + spot.x - .46, center.y - 1 + 3.05, center.z + spot.z + 1.1);
    assert.ok(hand.distanceTo(gun) < .08, `gun floats outside the hand during ${phase}: ${hand.distanceTo(gun)}`);
  }
});

test('the real garage renderer keeps the translated doormen hands attached to their guns', async t => {
  const { world } = await setup(t), center = FILM_SETS[HEL_GARAGE.set].center, parent = new THREE.Group();
  parent.position.set(center.x, center.y - 1, center.z);
  const set = new HelGarageRenderer(parent, world.agents.get('trinity')!); t.after(() => set.dispose());
  for (const phase of ['evade', 'failed'] as const) {
    set.update({ ...newHelGarage(), phase, age: 10 }); parent.updateMatrixWorld(true);
    for (let pair = 0; pair < 3; pair++) {
      const hand = set.group.getObjectByName(`hel_garage_guard_${pair}`)!.getObjectByName('mobil-palm-R')!.localToWorld(new THREE.Vector3(0, -.14, .005));
      const gun = set.group.getObjectByName(`hel-garage-gun-${pair}`)!.getWorldPosition(new THREE.Vector3());
      assert.ok(hand.distanceTo(gun) < .08, `set guard ${pair} misses the held gun during ${phase}: ${hand.distanceTo(gun)}`);
    }
  }
});

test('the swinging steel door never cuts through the physical lift back wall', async t => {
  const { world } = await setup(t), set = new HelGarageRenderer(new THREE.Group(), world.agents.get('trinity')!);
  t.after(() => set.dispose());
  const back = HEL_GARAGE.walls.find(wall => wall.z < -35)!;
  const wall = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(back.x, back.height / 2, back.z), new THREE.Vector3(back.width, back.height, back.depth));
  for (const door of [0, .25, .5, .75, 1]) {
    set.update({ ...newHelGarage(), phase: 'opening', elapsed: door * HEL_GARAGE.doorSeconds, door });
    set.group.updateMatrixWorld(true);
    assert.equal(new THREE.Box3().setFromObject(set.door).intersectsBox(wall), false, `door enters the back wall at ${door}`);
  }
});
