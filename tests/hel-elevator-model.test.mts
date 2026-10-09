import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, HEL_ELEVATOR, helElevatorFloor, helElevatorHandle, helElevatorTrinityRoot, type HelElevatorEncounter } from '@auto_matrix/shared';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

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

test('Trinity touches the real HEL button and moving gate handle, and cold poses stay identical', async t => {
  const { world, models } = await setup(t), center = FILM_SETS.film_club_hel.center, rig = models.create(world.agents.get('trinity')!);
  await new Promise(resolve => setImmediate(resolve)); assert.ok(rig.hero);
  for (const [phase, elapsed] of [['descending', .4], ['descending', .65], ['opening', .2], ['opening', .4], ['opening', .52]] as const) {
    const lift: HelElevatorEncounter = { phase, elapsed: phase === 'descending' ? elapsed : HEL_ELEVATOR.seconds,
      gateElapsed: phase === 'opening' ? elapsed : 0, lastTick: 0, physical: true };
    const root = helElevatorTrinityRoot(lift), floor = helElevatorFloor(lift);
    rig.root.position.set(center.x + root.x, center.y - 1 + floor, center.z + root.z); rig.root.rotation.y = root.yaw;
    const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0,
      helElevator: { role: 'trinity' as const, phase, elapsed: lift.elapsed, gateElapsed: lift.gateElapsed! } };
    models.animate(rig, 0, input, 0); rig.root.updateMatrixWorld(true);
    const contact = phase === 'descending' ? HEL_ELEVATOR.button : helElevatorHandle(lift);
    const target = new THREE.Vector3(center.x + contact.x, center.y - 1 + floor + contact.y, center.z + contact.z);
    const wrist = rig.hero!.bones.get('wrist_L')!, palm = wrist.localToWorld(new THREE.Vector3(0, -.19, .005));
    t.diagnostic(JSON.stringify({ phase, elapsed, root: rig.root.position.toArray(), target: target.toArray(), palm: palm.toArray(), shoulder: rig.hero!.bones.get('shoulder_L')!.getWorldPosition(new THREE.Vector3()).toArray() }));
    assert.ok(palm.distanceTo(target) < .08, `left palm misses ${phase} at ${elapsed}: ${palm.distanceTo(target)}`);
    const saved = palm.clone(); models.animate(rig, 0, input, 0); rig.root.updateWorldMatrix(true, true);
    assert.ok(wrist.localToWorld(new THREE.Vector3(0, -.19, .005)).distanceTo(saved) < .001, 'a paused or cold hand must not drift');
  }
});

test('all three shipped passengers keep visible soles and clothes above the moving floor', async t => {
  const { world, models } = await setup(t), center = FILM_SETS.film_club_hel.center;
  for (const id of ['trinity', 'morpheus', 'seraph'] as const) {
    const rig = models.create(world.agents.get(id)!); await new Promise(resolve => setImmediate(resolve));
    for (const elapsed of [.4, 1.4, 3.8, 6.5, 7.6]) {
      const lift: HelElevatorEncounter = { phase: 'descending', elapsed, gateElapsed: 0, lastTick: 0, physical: true };
      const floor = helElevatorFloor(lift), root = id === 'trinity' ? helElevatorTrinityRoot(lift) : { ...HEL_ELEVATOR.passengers[id], yaw: Math.PI };
      rig.root.position.set(center.x + root.x, center.y - 1 + floor, center.z + root.z); rig.root.rotation.y = root.yaw;
      models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, helElevator: { role: id, phase: lift.phase, elapsed, gateElapsed: 0 } }, 0);
      rig.root.updateMatrixWorld(true); let bottom = Infinity;
      rig.root.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        for (let p: THREE.Object3D | null = object; p; p = p.parent) if (!p.visible) return;
        if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
        for (let i = 0; i < object.geometry.attributes.position.count; i++) bottom = Math.min(bottom, object.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(object.matrixWorld).y);
      });
      assert.ok(bottom >= center.y - 1 + floor - .025, `${id} enters the cage floor at ${elapsed}: ${bottom - (center.y - 1 + floor)}`);
      assert.ok(bottom < center.y - 1 + floor + .08, `${id} is suspended above the cage floor at ${elapsed}: ${bottom - (center.y - 1 + floor)}`);
    }
  }
});

test('first-person HEL pressing cannot render Trinity’s own face between the posed eye and button', async t => {
  const { world, models } = await setup(t), center = FILM_SETS.film_club_hel.center, rig = models.create(world.agents.get('trinity')!);
  await new Promise(resolve => setImmediate(resolve)); assert.ok(rig.hero);
  const lift: HelElevatorEncounter = { phase: 'descending', elapsed: .569, lastTick: 0, physical: true };
  const at = helElevatorTrinityRoot(lift), floor = helElevatorFloor(lift);
  rig.root.position.set(center.x + at.x, center.y - 1 + floor, center.z + at.z); rig.root.rotation.y = at.yaw;
  models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, firstPerson: true,
    helElevator: { role: 'trinity', phase: lift.phase, elapsed: lift.elapsed, gateElapsed: 0 } }, 0);
  rig.root.updateMatrixWorld(true);
  const head = rig.hero!.bones.get('head')!, eye = head.localToWorld(head.userData.cameraEye.clone());
  const button = new THREE.Vector3(center.x + HEL_ELEVATOR.button.x, center.y - 1 + floor + HEL_ELEVATOR.button.y, center.z + HEL_ELEVATOR.button.z);
  const skin = rig.hero!.trackingSkin!.mesh; skin.skeleton.update(); skin.computeBoundingSphere(); skin.computeBoundingBox();
  const direction = button.clone().sub(eye), hits = new THREE.Raycaster(eye, direction.clone().normalize(), .01, direction.length() - .1).intersectObject(skin);
  const ownFace = hits.filter(hit => [hit.face!.a, hit.face!.b, hit.face!.c].some(vertex => [0, 1, 2, 3].some(i =>
    skin.geometry.attributes.skinWeight.getComponent(vertex, i) > .05 && /^(head|neck)$/.test(skin.skeleton.bones[skin.geometry.attributes.skinIndex.getComponent(vertex, i)].name))));
  assert.equal(ownFace.length, 0, 'the full head/neck skin must not obstruct a first-person interaction');
  const palm = rig.hero!.bones.get('wrist_L')!.localToWorld(new THREE.Vector3(0, -.19, .005));
  assert.ok(palm.distanceTo(button) < .08, 'first-person visibility cannot discard the real touching hand');
});
