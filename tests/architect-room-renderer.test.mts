import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ArchitectRoomRenderer } from '../packages/client/src/engine/ArchitectRoomRenderer.js';
import { ARCHITECT_ROOM, FILM_SETS, architectDoorAngle, type ArchitectEncounter } from '@auto_matrix/shared';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import type { MotionInput } from '../packages/client/src/agents/CharacterMotion.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

async function shipped(name: string) {
  const bytes = await readFile(new URL(`../packages/client/public/assets/characters/${name}.glb`, import.meta.url));
  const length = bytes.readUInt32LE(12), document = JSON.parse(bytes.subarray(20, 20 + length).toString());
  // Keep actual shipped geometry and skinning; Node has no browser image decoder.
  for (const material of document.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const binary = bytes.subarray(20 + length), output = Buffer.alloc(20 + padded.length + binary.length);
  output.writeUInt32LE(0x46546c67, 0); output.writeUInt32LE(2, 4); output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(padded.length, 12); output.writeUInt32LE(0x4e4f534a, 16); padded.copy(output, 20); binary.copy(output, 20 + padded.length);
  const asset = await new GLTFLoader().parseAsync(output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength), '');
  if (name.endsWith('-head')) asset.scene.traverse(object => { if (object instanceof THREE.Mesh) (object.material as THREE.MeshStandardMaterial).map = new THREE.Texture(); });
  return asset;
}
async function fixture(t: TestContext) {
  const assets = Object.fromEntries(await Promise.all(['architect-head', 'architect-body', 'neo', 'neo-office', 'neo-tracking', 'trinity', 'trinity-club', 'smith', 'morpheus', 'choi', 'dujour'].map(async name => [name, await shipped(name)])));
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async url => assets[String(url).split('/').pop()!.replace('.glb', '')]);
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {},
    createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  const rig = models.create(world.agents.get('architect')!);
  t.after(() => { models.dispose(); globalThis.document = previous; });
  const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, performance: true, seated: true,
    architect: { role: 'architect', phase: 'cycles', elapsed: 3, chairYaw: 0 } } as MotionInput;
  const pose = () => { models.animate(rig, .1, input, 1); rig.root.updateMatrixWorld(true); };
  pose(); await new Promise(resolve => setImmediate(resolve)); for (let i = 0; i < 40; i++) pose();
  return { rig, pose, input, models, world };
}
test('the seated Architect’s actual shoes rest at the room floor and his palms reach the armrests', async t => {
  const { rig } = await fixture(t);
  const body = rig.root.getObjectByName('architect-detailed-body')!; assert.ok(body);
  const shoes: THREE.SkinnedMesh[] = [];
  body.traverse(object => { if (object instanceof THREE.SkinnedMesh && object.name.includes('work-boots')) shoes.push(object); });
  assert.ok(shoes.length); let bottom = Infinity;
  for (const shoe of shoes) {
    shoe.skeleton.update();
    for (let i = 0; i < shoe.geometry.attributes.position.count; i++) bottom = Math.min(bottom, shoe.localToWorld(shoe.getVertexPosition(i, new THREE.Vector3())).y);
  }
  console.log('Actual seated shoe minimum:', bottom);
  // Character root and set root both receive the -1 runtime offset, so the
  // floor is zero in this fixture; the old generic sitting pose was below it.
  assert.ok(bottom >= -.012 && bottom < .035, `shoes float or penetrate the floor: ${bottom}, floor 0`);
  for (let i = 0; i < 2; i++) {
    const palm = rig.elbows[i].localToWorld(new THREE.Vector3(0, -.79, .055));
    const rest = rig.detail.localToWorld(new THREE.Vector3((i ? 1 : -1) * .84, 2.34, .28));
    assert.ok(palm.distanceTo(rest) < .14, `palm ${i} misses the actual armrest: ${palm.distanceTo(rest)}`);
  }
});

test('actual Architect hands sit above the armrest surface instead of sinking into the leather', async t => {
  const h = await fixture(t), body = h.rig.root.getObjectByName('architect-detailed-body')!;
  let minimum = Infinity, count = 0;
  body.traverse(object => {
    if (!(object instanceof THREE.SkinnedMesh) || object.name !== 'architect-anatomical-body') return;
    object.skeleton.update();
    const positions = object.geometry.attributes.position, skin = object.geometry.attributes.skinIndex, weights = object.geometry.attributes.skinWeight;
    for (let i = 0; i < positions.count; i++) {
      const indices = [skin.getX(i), skin.getY(i), skin.getZ(i), skin.getW(i)], values = [weights.getX(i), weights.getY(i), weights.getZ(i), weights.getW(i)];
      if (!indices.some((index, j) => values[j] > .5 && /wrist|finger/.test(object.skeleton.bones[index].name))) continue;
      const v = h.rig.detail.worldToLocal(object.localToWorld(object.getVertexPosition(i, new THREE.Vector3())));
      if (Math.abs(Math.abs(v.x) - .84) < .16 && v.z > -.15 && v.z < .65) { minimum = Math.min(minimum, v.y); count++; }
    }
  });
  console.log('Actual hand surface above leather:', minimum, count);
  assert.ok(count > 20); assert.ok(minimum >= ARCHITECT_ROOM.chair.arm + .0525 - .025, `hand surface enters the armrest: ${minimum}`);
});

test('the physical CRT ring, chair and left hinge agree with the saved room geometry and preserve the closed Source door', async t => {
  const h = await fixture(t), room = new THREE.Group(), renderer = new ArchitectRoomRenderer(room); t.after(() => renderer.dispose());
  const encounter: ArchitectEncounter = { phase: 'decision', sourceReviewed: true, trinityReviewed: true, remaining: 45, lastTick: 0, attempts: 0,
    room: { elapsed: 10, chairYaw: .3, exit: { elapsed: .85, x: -8, z: -26 } } };
  renderer.update(encounter); room.updateMatrixWorld(true);
  assert.equal(renderer.leftDoor.rotation.y, architectDoorAngle(encounter)); assert.equal(renderer.rightDoor.rotation.y, 0);
  assert.equal(renderer.leftDoor.position.x, ARCHITECT_ROOM.doors.matrix.x - ARCHITECT_ROOM.doorWidth / 2);
  assert.equal(renderer.chair.rotation.y, .3);
  const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), quadrants = new Set<number>(); let count = 0;
  for (const screen of renderer.screens) for (let i = 0; i < screen.count; i++) {
    screen.getMatrixAt(i, matrix); position.setFromMatrixPosition(matrix);
    assert.ok(Math.abs(Math.hypot(position.x, position.z - ARCHITECT_ROOM.centerZ) - (ARCHITECT_ROOM.radius - .26)) < .02);
    quadrants.add((position.x > 0 ? 1 : 0) + (position.z > ARCHITECT_ROOM.centerZ ? 2 : 0)); count++;
  }
  assert.equal(quadrants.size, 4); assert.ok(count > 330, `CRT coverage has only ${count} screens`);
  const center = FILM_SETS.film_architect_room.center; room.position.set(center.x, center.y - 1, center.z); room.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(new THREE.Vector3(center.x, center.y + 1, center.z - 8), new THREE.Vector3(0, 0, -1));
  assert.ok(ray.intersectObject(renderer.chair, true).length, 'the shared chair obstacle must correspond to visible furniture');
  const original = renderer.chair.getWorldPosition(new THREE.Vector3()); renderer.dispose(); renderer.dispose();
  assert.equal(room.children.length, 0); assert.ok(original.z === center.z + ARCHITECT_ROOM.chair.z);
});

test('Neo’s real wrist follows the moving door lever without replacing his saved body root', async t => {
  const h = await fixture(t), neo = h.world.agents.get('neo')!; neo.isInMatrix = true; neo.isAwakened = true; neo.currentLocation = 'film_architect_room';
  const rig = h.models.create(neo), room = new THREE.Group(), renderer = new ArchitectRoomRenderer(room); t.after(() => renderer.dispose());
  const c = FILM_SETS.film_architect_room.center; room.position.set(c.x, c.y - 1, c.z);
  const age = .42, encounter: ArchitectEncounter = { phase: 'decision', sourceReviewed: true, trinityReviewed: true, remaining: 45, lastTick: 0, attempts: 0,
    room: { elapsed: 1, chairYaw: 0, exit: { elapsed: age, x: -8, z: -26 } } };
  const { architectExitRoot } = await import('@auto_matrix/shared'), root = architectExitRoot(encounter.room!.exit!);
  rig.root.position.set(c.x + root.x, c.y - 1, c.z + root.z); rig.root.rotation.y = root.yaw;
  const motion = { speed: 0, turn: 0, grounded: true, verticalVelocity: 0,
    architect: { role: 'neo', phase: 'decision', elapsed: 1, chairYaw: 0, opening: age } } as MotionInput;
  h.models.animate(rig, 0, motion, 0); await new Promise(resolve => setImmediate(resolve)); h.models.animate(rig, 0, motion, 0);
  renderer.update(encounter); room.updateMatrixWorld(true); rig.root.updateMatrixWorld(true); assert.ok(rig.hero);
  const palm = rig.hero.bones.get('wrist_R')!.localToWorld(new THREE.Vector3(0, -.19, .035));
  const lever = renderer.leftDoor.localToWorld(new THREE.Vector3(ARCHITECT_ROOM.doorWidth - .66, 3.05, .21));
  assert.ok(palm.distanceTo(lever) < .085, `hand misses the moving lever by ${palm.distanceTo(lever)}`);
  assert.ok(rig.root.position.distanceTo(new THREE.Vector3(c.x + root.x, c.y - 1, c.z + root.z)) < 1e-7);
});

test('losing Trinity’s signal blacks out the feed, and a local retry restores it', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const renderer = new ArchitectRoomRenderer(new THREE.Group()); t.after(() => renderer.dispose());
  const encounter: ArchitectEncounter = { phase: 'reflection', sourceReviewed: true, trinityReviewed: true, remaining: 45, lastTick: 0, attempts: 0 };
  renderer.update(encounter);
  const feed = (renderer.screens[0].material as THREE.MeshBasicMaterial).map;
  encounter.phase = 'failed'; renderer.update(encounter);
  for (const screen of renderer.screens) assert.ok((screen.material as THREE.MeshBasicMaterial).color.getHex() === 0, 'the lost feed must not keep showing Trinity');
  encounter.phase = 'decision'; renderer.update(encounter);
  for (const screen of renderer.screens) { const material = screen.material as THREE.MeshBasicMaterial; assert.equal(material.map, feed); assert.ok(material.color.getHex() > 0); }
});

test('the first-person player can see Neo’s physical opening arm, then returns to normal visibility outside the room', async t => {
  const h = await fixture(t), renderer = new AgentRenderer(new THREE.Scene()); t.after(() => renderer.dispose());
  const neo = h.world.agents.get('neo')!; neo.isInMatrix = true; neo.isAwakened = true; neo.currentLocation = 'film_architect_room';
  renderer.updateAgent('neo', neo); renderer.setPlayer('neo', true);
  const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, firstPerson: true,
    architect: { role: 'neo', phase: 'decision', elapsed: 2, chairYaw: 0, opening: .37 } } as MotionInput;
  renderer.setPlayerMotion(input); renderer.update(0, undefined, 0);
  await new Promise(resolve => setImmediate(resolve)); renderer.update(0, undefined, 0);
  assert.equal(renderer.getAgentBody('neo')!.visible, true, 'the opening hand must not disappear with the entire first-person body');
  input.architect = undefined; renderer.setPlayerMotion(input); renderer.update(0, undefined, 0);
  assert.equal(renderer.getAgentBody('neo')!.visible, false);
  renderer.setPlayer('neo', false); renderer.update(0, undefined, 0);
  assert.equal(renderer.getAgentBody('neo')!.visible, true);
});

test('showing Neo’s first-person opening arm removes his own face and glasses from the eye camera, and V restores them', async t => {
  const h = await fixture(t), neo = h.world.agents.get('neo')!; neo.isInMatrix = true; neo.isAwakened = true; neo.currentLocation = 'film_architect_room';
  const rig = h.models.create(neo), input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, firstPerson: true,
    architect: { role: 'neo', phase: 'decision', elapsed: 2, chairYaw: 0, opening: .37 } } as MotionInput;
  h.models.animate(rig, 0, input, 0); await new Promise(resolve => setImmediate(resolve)); h.models.animate(rig, 0, input, 0);
  assert.ok(rig.hero?.trackingSkin);
  assert.equal(rig.hero.glasses.visible, false, 'the restored body cannot put sunglasses in front of the first-person camera');
  assert.equal(rig.hero.trackingSkin.mesh.geometry, rig.hero.trackingSkin.firstPerson);
  input.firstPerson = false; h.models.animate(rig, 0, input, 0);
  assert.equal(rig.hero.glasses.visible, true); assert.equal(rig.hero.trackingSkin.mesh.geometry, rig.hero.trackingSkin.original);
});
