import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, WETWALL_SHAFT, sixthPose, type SixthGesture } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { CharacterModels, weaponMuzzle } from '../packages/client/src/agents/CharacterModel.js';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';

async function models(t: test.TestContext) {
  const assets = new Map();
  for (const name of ['neo', 'smith', 'morpheus', 'neo-office', 'neo-tracking']) {
    const glb = await readFile(new URL(`../packages/client/public/assets/characters/${name}.glb`, import.meta.url));
    const length = glb.readUInt32LE(12), source = JSON.parse(glb.subarray(20, 20 + length).toString());
    for (const material of source.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
    source.images = []; source.textures = [];
    const json = Buffer.from(JSON.stringify(source)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
    const bin = glb.subarray(20 + length), buffer = Buffer.alloc(20 + padded.length + bin.length);
    buffer.writeUInt32LE(0x46546c67, 0); buffer.writeUInt32LE(2, 4); buffer.writeUInt32LE(buffer.length, 8);
    buffer.writeUInt32LE(padded.length, 12); buffer.writeUInt32LE(0x4e4f534a, 16); padded.copy(buffer, 20); bin.copy(buffer, 20 + padded.length);
    assets.set(name, await new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), ''));
  }
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async (url: string) => assets.get(url.split('/').pop()!.replace('.glb', '')));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  class InputTarget extends EventTarget { matches() { return false; } }
  const previousDocument = globalThis.document, previousWindow = globalThis.window;
  globalThis.window = new InputTarget() as unknown as Window & typeof globalThis;
  globalThis.document = Object.assign(new InputTarget(), { pointerLockElement: null, hidden: false, exitPointerLock() {},
    createElement: () => ({ getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {},
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) }) as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const characters = new CharacterModels();
  t.after(() => { characters.dispose(); globalThis.document = previousDocument; globalThis.window = previousWindow; });
  return { world, characters, canvas: new InputTarget() as unknown as HTMLCanvasElement };
}
function gesture(role: SixthGesture['role'], phase: SixthGesture['phase']): SixthGesture {
  return { role, phase, elapsed: .8, covered: false, cover: 0, aim: 0,
    start: { x: role === 'neo' ? -15.5 : -17.5, y: WETWALL_SHAFT.sixth, z: role === 'neo' ? WETWALL_SHAFT.bodyZ : -20.6, yaw: role === 'neo' ? Math.PI : Math.PI } };
}

test('delivered Neo aims his pistol through the actual wall opening instead of pointing it up the pipe', async t => {
  const h = await models(t), rig = h.characters.create(h.world.agents.get('neo')!); await new Promise(resolve => setImmediate(resolve));
  const input = gesture('neo', 'firing'), root = sixthPose(input), center = FILM_SETS.film_ambush_house.center;
  rig.root.position.set(center.x + root.x, center.y - 1 + root.y, center.z + root.z); rig.root.rotation.y = root.yaw;
  h.characters.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, armed: true, weaponStyle: 'hel_pistol', sixth: input,
    wetwall: { role: 'neo', phase: 'done', elapsed: 0, start: { x: -15.5, y: WETWALL_SHAFT.top, z: -26.9 }, entry: 5.3, progress: 20.1, hanging: true, freed: true } }, 4);
  const gun = rig.weapons![0]; gun.updateWorldMatrix(true, true);
  const muzzle = weaponMuzzle(rig)!, direction = muzzle.clone().sub(gun.localToWorld(new THREE.Vector3()));
  assert.ok(direction.normalize().z > .95, `the gun must face the police: ${direction.toArray()}`);
  assert.ok(muzzle.z > center.z + WETWALL_SHAFT.bodyZ + .9);
  assert.ok(muzzle.y > center.y - 1 + WETWALL_SHAFT.sixth + 1.3 && muzzle.y < center.y - 1 + WETWALL_SHAFT.sixth + 4.3);
});

test('Smith delivered palms actually reach Neo neck at the saved grapple checkpoint', async t => {
  const h = await models(t), neo = h.characters.create(h.world.agents.get('neo')!), smith = h.characters.create(h.world.agents.get('smith')!);
  await new Promise(resolve => setImmediate(resolve)); const center = FILM_SETS.film_ambush_house.center;
  for (const [role, rig] of [['neo', neo], ['smith', smith]] as const) {
    const input = gesture(role, 'grapple'), root = sixthPose(input);
    if (role === 'smith') {
      neo.root.updateWorldMatrix(true, true);
      const contact = neo.hero!.bones.get('head')!.localToWorld(new THREE.Vector3(0, -.17, .04));
      input.contact = { x: contact.x, y: contact.y, z: contact.z };
    }
    rig.root.position.set(center.x + root.x, center.y - 1 + root.y, center.z + root.z); rig.root.rotation.y = root.yaw;
    h.characters.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, sixth: input }, 4);
  }
  neo.root.updateWorldMatrix(true, true);
  const neck = neo.hero!.bones.get('head')!.localToWorld(new THREE.Vector3(0, -.17, .04));
  for (const side of ['R', 'L']) {
    const contact = neck.clone().add(new THREE.Vector3(side === 'R' ? -.16 : .16, 0, .12));
    const palm = smith.hero!.bones.get(`wrist_${side}`)!.localToWorld(new THREE.Vector3(0, -.19, .035));
    assert.ok(palm.distanceTo(contact) < .14, `${side} hand is grabbing empty space: ${palm.distanceTo(contact)}, neck=${neck.toArray()}`);
  }
  const errors: string[] = [], vertex = new THREE.Vector3();
  smith.root.updateWorldMatrix(true, true);
  smith.root.traverse(object => {
    if (!(object instanceof THREE.Mesh) || !object.visible) return;
    for (let parent = object.parent; parent; parent = parent.parent) if (!parent.visible) return;
    for (let i = 0; i < object.geometry.attributes.position.count; i++) {
      object.getVertexPosition(i, vertex); object.localToWorld(vertex);
      const x = vertex.x - center.x, y = vertex.y - center.y + 1 - WETWALL_SHAFT.sixth, z = vertex.z - center.z;
      const inHole = Math.abs(x + 15.5) < .9 && y > 1.3 && y < 4.3;
      if (!inHole && z < WETWALL_SHAFT.front + .12 && x > -20.9 && x < -14.1 && y > 0 && y < 6.1) {
        errors.push(`${object.name || object.geometry.type}: ${[x, y, z]}`); break;
      }
    }
  });
  assert.deepEqual(errors, [], 'Smith feet and clothing must remain in the bathroom while his arms pass through the gunfire hole');
});

test('Neo camera and local body retain the sixth-floor firing position and aim across first-person switching', async t => {
  const h = await models(t), actor = h.world.agents.get('neo')!, rig = h.characters.create(actor); await new Promise(resolve => setImmediate(resolve));
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000), group = new THREE.Group(); group.add(rig.root); rig.root.position.y = -1;
  const input = gesture('neo', 'firing'), root = sixthPose(input), center = FILM_SETS.film_ambush_house.center;
  actor.position = { x: center.x + root.x, y: center.y + root.y, z: center.z + root.z }; actor.rotation = root.yaw; actor.currentLocation = 'film_ambush_house';
  actor.currentAction = { type: 'idle', parameters: { resolved: true, sixth: input }, startedAt: 0, duration: 1, progress: 0 };
  const controls = new PlayerControls(h.canvas, camera, () => {}, () => {});
  try {
    controls.possess(actor); controls.firstPerson = true; controls.update(.1, actor, group, false);
    h.characters.animate(rig, 0, controls.motion, 4); group.updateWorldMatrix(true, true); controls.update(.1, actor, group, false);
    assert.ok(Math.abs(group.position.y - actor.position.y) < .01);
    assert.ok(camera.getWorldDirection(new THREE.Vector3()).z > .95, 'the new police encounter must start facing the wall hole');
    assert.equal(camera.near, .06);
  } finally { controls.dispose(); }
});

test('the first-person replacement camera looks outside instead of through Neo own face while he faces the pipe', async t => {
  const h = await models(t), actor = h.world.agents.get('neo')!, rig = h.characters.create(actor); await new Promise(resolve => setImmediate(resolve));
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000), group = new THREE.Group(); group.add(rig.root); rig.root.position.y = -1;
  const input = gesture('neo', 'replacing'), root = sixthPose(input), center = FILM_SETS.film_ambush_house.center;
  actor.position = { x: center.x + root.x, y: center.y + root.y, z: center.z + root.z }; actor.rotation = root.yaw; actor.currentLocation = 'film_ambush_house';
  actor.currentAction = { type: 'idle', parameters: { resolved: true, sixth: input,
    wetwall: { role: 'neo', phase: 'done', elapsed: 0, start: { x: -15.5, y: WETWALL_SHAFT.top, z: -26.9 }, entry: 5.3, progress: 20.1, hanging: true, freed: true } }, startedAt: 0, duration: 1, progress: 0 };
  const controls = new PlayerControls(h.canvas, camera, () => {}, () => {});
  try {
    controls.possess(actor); controls.firstPerson = true;
    for (let frame = 0; frame < 3; frame++) {
      controls.update(.1, actor, group, false); h.characters.animate(rig, 0, controls.motion, 4); group.updateWorldMatrix(true, true);
    }
    controls.update(.1, actor, group, false); camera.updateWorldMatrix(true, false);
    const head = rig.hero!.bones.get('head')!.getWorldPosition(new THREE.Vector3());
    const ahead = camera.position.clone().sub(head).dot(camera.getWorldDirection(new THREE.Vector3()));
    assert.ok(ahead > .5, `the camera is looking back through Neo head instead of outside: ${ahead}`);
  } finally { controls.dispose(); }
});

test('the third-person grapple camera leaves space for Morpheus to descend beside Neo', async t => {
  const h = await models(t), actor = h.world.agents.get('neo')!, rig = h.characters.create(actor); await new Promise(resolve => setImmediate(resolve));
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000), group = new THREE.Group(); group.add(rig.root); rig.root.position.y = -1;
  const input = gesture('neo', 'grapple'), root = sixthPose(input), center = FILM_SETS.film_ambush_house.center;
  actor.position = { x: center.x + root.x, y: center.y + root.y, z: center.z + root.z }; actor.rotation = root.yaw; actor.currentLocation = 'film_ambush_house';
  actor.currentAction = { type: 'idle', parameters: { resolved: true, sixth: input }, startedAt: 0, duration: 1, progress: 0 };
  const controls = new PlayerControls(h.canvas, camera, () => {}, () => {});
  try {
    controls.possess(actor); controls.update(.1, actor, group, false);
    const morpheus = sixthPose({ ...gesture('morpheus', 'grapple'), start: { x: -18, y: WETWALL_SHAFT.sixth + 5.4, z: WETWALL_SHAFT.bodyZ, yaw: Math.PI } });
    assert.ok(Math.hypot(camera.position.x - center.x - morpheus.x, camera.position.z - center.z - morpheus.z) > 2.3,
      'the camera cannot sit against the descending companion coat at torso height');
  } finally { controls.dispose(); }
});

test('the free sixth-floor holdout camera keeps Morpheus coat away from the center of the combat view', async t => {
  const h = await models(t), actor = h.world.agents.get('morpheus')!, rig = h.characters.create(actor); await new Promise(resolve => setImmediate(resolve));
  const center = FILM_SETS.film_ambush_house.center, camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000), group = new THREE.Group();
  group.add(rig.root); rig.root.position.y = -1;
  actor.position = { x: center.x - 15.5, y: center.y + WETWALL_SHAFT.sixth, z: center.z - 27.2 }; actor.rotation = 0; actor.currentLocation = 'film_ambush_house';
  actor.currentAction = { type: 'idle', parameters: { player: true, resolved: true }, startedAt: 0, duration: 1, progress: 0 };
  const controls = new PlayerControls(h.canvas, camera, () => {}, () => {});
  try {
    controls.possess(actor); controls.update(.1, actor, group, false);
    assert.ok(Math.hypot(camera.position.x - actor.position.x, camera.position.z - actor.position.z) > 3,
      'the wall-clipped camera is too close to Morpheus back to show the incoming opponent');
  } finally { controls.dispose(); }
});
