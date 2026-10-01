import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, WETWALL_SHAFT, SIXTH_FIXTURES, sixthPose, bathroomFightRoot, newBathroomFight, type BathroomGesture, type SixthGesture } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { CharacterModels, weaponMuzzle } from '../packages/client/src/agents/CharacterModel.js';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { poseBathroom } from '../packages/client/src/agents/BathroomPerformance.js';
import { SixthFloorRenderer } from '../packages/client/src/engine/SixthFloorRenderer.js';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';

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
    createElement: () => ({ getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
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

test('actual bathroom skeletons keep skin, shoes and clothing above the tiles during landing, breakout and capture', async t => {
  const h = await models(t), center = FILM_SETS.film_ambush_house.center;
  const rigs = { smith: h.characters.create(h.world.agents.get('smith')!), morpheus: h.characters.create(h.world.agents.get('morpheus')!) };
  await new Promise(resolve => setImmediate(resolve));
  let animationMs = 0, samples = 0;
  const poses: [BathroomGesture['phase'], number][] = [['ready', 0], ['pinning', 2], ['breakout', .8], ['breakout', 1.6], ['breakout', 2.2],
    ['faceoff', 1], ['windup', .65], ['opening', .1], ['counter', .325], ['capturing', 1], ['capturing', 1.7], ['capturing', 2.5], ['done', 0]];
  for (const [phase, elapsed] of poses) for (const role of ['smith', 'morpheus'] as const) {
    const input = { ...newBathroomFight(), phase, elapsed, role, evaded: true }, root = bathroomFightRoot(input, role), rig = rigs[role];
    rig.root.position.set(center.x + root.x, center.y - 1 + WETWALL_SHAFT.sixth, center.z + root.z); rig.root.rotation.y = root.yaw;
    const start = performance.now();
    h.characters.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, bathroom: input }, 4);
    animationMs += performance.now() - start; samples++;
    rig.root.updateMatrixWorld(true); const vertex = new THREE.Vector3(); let minimum = Infinity;
    const penetrations = new Set<string>();
    for (const part of rig.hero!.wardrobe) if (part.mesh.visible) for (let i = 0; i < part.mesh.geometry.attributes.position.count; i++) {
      part.mesh.getVertexPosition(i, vertex); part.mesh.localToWorld(vertex); minimum = Math.min(minimum, vertex.y - center.y + 1 - WETWALL_SHAFT.sixth);
      const x = vertex.x - center.x, y = vertex.y - center.y + 1 - WETWALL_SHAFT.sixth, z = vertex.z - center.z;
      for (const [name, fixture] of Object.entries(SIXTH_FIXTURES)) if (y > .025 && y < fixture.height - .025
        && Math.abs(x - fixture.x) < fixture.width / 2 - .025 && Math.abs(z - fixture.z) < fixture.depth / 2 - .025) penetrations.add(name);
    }
    assert.ok(minimum >= -.025, `${role} ${phase}/${elapsed}: visible geometry penetrates the floor by ${minimum}`);
    assert.deepEqual([...penetrations], [], `${role} ${phase}/${elapsed}: the actual body intersects an intact bathroom fixture`);
  }
  t.diagnostic(`Delivered-model animation CPU: ${(animationMs / samples).toFixed(2)} ms/character (${samples} samples; not browser fps).`);
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

test('Morpheus lands over a grounded Smith instead of finishing the breach with both men standing', async t => {
  const h = await models(t), center = FILM_SETS.film_ambush_house.center;
  const rigs = { smith: h.characters.create(h.world.agents.get('smith')!), morpheus: h.characters.create(h.world.agents.get('morpheus')!) };
  await new Promise(resolve => setImmediate(resolve));
  for (const role of ['smith', 'morpheus'] as const) {
    const input = { ...gesture(role, 'done'), elapsed: 2.8 }, root = sixthPose(input), rig = rigs[role];
    rig.root.position.set(center.x + root.x, center.y - 1 + root.y, center.z + root.z); rig.root.rotation.y = root.yaw;
    h.characters.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, sixth: input }, 4);
  }
  const floor = center.y - 1 + WETWALL_SHAFT.sixth;
  const head = rigs.smith.hero!.bones.get('head')!.getWorldPosition(new THREE.Vector3());
  assert.ok(head.y - floor < 1.15, `Smith remains standing after the tackle: ${head.y - floor}`);
  const pelvis = rigs.morpheus.hero!.bones.get('pelvis')!.getWorldPosition(new THREE.Vector3());
  assert.ok(pelvis.y - floor < 1.9, 'Morpheus must be kneeling over the grounded body');
  const neck = rigs.smith.hero!.bones.get('head')!.localToWorld(new THREE.Vector3(0, -.17, .04));
  poseBathroom(rigs.morpheus, { role: 'morpheus', phase: 'ready', elapsed: 0, held: 0, grip: 1, counters: 0, evaded: false, headbutt: false, cooldown: 0,
    contact: { x: neck.x, y: neck.y, z: neck.z } });
  for (const side of ['R', 'L']) {
    const palm = rigs.morpheus.hero!.bones.get(`wrist_${side}`)!.localToWorld(new THREE.Vector3(0, -.19, .035));
    const target = neck.clone().add(new THREE.Vector3(side === 'R' ? .19 : -.19, .02, .06));
    assert.ok(palm.distanceTo(target) < .14, `Morpheus ${side} palm is not actually restraining Smith: ${palm.distanceTo(target)}; palm=${palm.toArray()}; target=${target.toArray()}; pelvis=${pelvis.toArray()}`);
  }
  for (const role of ['smith', 'morpheus'] as const) {
    const rig = rigs[role]; rig.root.updateMatrixWorld(true); const vertex = new THREE.Vector3(); let minimum = Infinity;
    for (const part of rig.hero!.wardrobe) if (part.mesh.visible) for (let i = 0; i < part.mesh.geometry.attributes.position.count; i++) {
      part.mesh.getVertexPosition(i, vertex); part.mesh.localToWorld(vertex); minimum = Math.min(minimum, vertex.y - floor);
    }
    assert.ok(minimum >= -.02, `${role} shoes, clothing or skin penetrate the wet floor: ${minimum}`);
  }
});

test('Morpheus first-person camera follows the actual ground eye and turns toward Smith once the duel begins', async t => {
  const h = await models(t), actor = h.world.agents.get('morpheus')!, rig = h.characters.create(actor), smith = h.characters.create(h.world.agents.get('smith')!); await new Promise(resolve => setImmediate(resolve));
  const center = FILM_SETS.film_ambush_house.center, camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000), group = new THREE.Group();
  group.add(rig.root); rig.root.position.y = -1; actor.currentLocation = 'film_ambush_house';
  const stage = (phase: BathroomGesture['phase'], elapsed = 0) => {
    const bathroom = { ...newBathroomFight(), phase, elapsed, role: 'morpheus' as const }, root = bathroomFightRoot(bathroom, 'morpheus');
    actor.position = { x: center.x + root.x, y: center.y + WETWALL_SHAFT.sixth, z: center.z + root.z }; actor.rotation = root.yaw;
    actor.currentAction = { type: 'idle', parameters: { player: true, resolved: true, bathroom,
      betrayal: { kind: 'bathroom', phase: phase === 'ready' ? 'ready' : 'defending', elapsed, sixth: true } }, startedAt: 0, duration: 1, progress: 0 };
  };
  stage('ready'); const actions: string[] = [], controls = new PlayerControls(h.canvas, camera, () => {}, kind => actions.push(kind));
  try {
    controls.possess(actor); controls.firstPerson = true;
    for (let i = 0; i < 3; i++) { controls.update(.1, actor, group, false); h.characters.animate(rig, 0, controls.motion, 4); }
    controls.update(.1, actor, group, false); group.updateWorldMatrix(true, true);
    const head = rig.hero!.bones.get('head')!.getWorldPosition(new THREE.Vector3()), forward = camera.getWorldDirection(new THREE.Vector3());
    assert.ok(Math.abs(camera.position.clone().sub(head).dot(forward) - .72) < .01, 'the eye must follow the kneeling skeleton and remain outside its face');
    assert.ok(camera.position.y - center.y + 1 - WETWALL_SHAFT.sixth < 2.4, 'the ground view cannot retain the standing eye height');
    const smithInput = { ...newBathroomFight(), role: 'smith' as const }, smithRoot = bathroomFightRoot(smithInput, 'smith');
    smith.root.position.set(center.x + smithRoot.x, center.y - 1 + WETWALL_SHAFT.sixth, center.z + smithRoot.z); smith.root.rotation.y = smithRoot.yaw;
    h.characters.animate(smith, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, bathroom: smithInput }, 4);
    camera.updateWorldMatrix(true, false);
    const face = smith.hero!.bones.get('head')!.getWorldPosition(new THREE.Vector3()).project(camera);
    assert.ok(Math.abs(face.x) < .7 && Math.abs(face.y) < .7 && Math.abs(face.z) < 1, `the ground view looks past the restrained Smith: ${face.toArray()}`);
    stage('breakout', 1.6); controls.update(.1, actor, group, true);
    assert.ok(Math.abs(rig.root.rotation.y - bathroomFightRoot(controls.motion.bathroom!, 'morpheus').yaw) < .01,
      'the turning body must use the same predicted clock as its bathroom position');
    stage('breakout', 2.5); controls.update(.1, actor, group, false); stage('faceoff'); controls.update(.1, actor, group, false);
    assert.ok(camera.getWorldDirection(new THREE.Vector3()).z > .9, 'the first-person view still points behind Morpheus after he turns to face Smith');
    controls.yaw = .4; stage('windup', .65); controls.update(.01, actor, group, true);
    assert.ok(Math.abs(controls.yaw - .4) < .01, 'later phases must retain the player free look');
    assert.equal(controls.triggerCombat('attack'), true); assert.equal(actions.at(-1), 'attack', 'the guided pose must not suppress the actual counter input');
  } finally { controls.dispose(); }
});

test('the narrow bathroom camera shows both heads and the restraint rather than the back of Morpheus coat', async t => {
  const h = await models(t), center = FILM_SETS.film_ambush_house.center;
  const actor = h.world.agents.get('morpheus')!, morph = h.characters.create(actor), smith = h.characters.create(h.world.agents.get('smith')!);
  await new Promise(resolve => setImmediate(resolve)); const floor = center.y - 1 + WETWALL_SHAFT.sixth;
  const bathroom = { ...newBathroomFight(), role: 'morpheus' as const }, root = bathroomFightRoot(bathroom, 'morpheus');
  actor.position = { x: center.x + root.x, y: floor + 1, z: center.z + root.z }; actor.rotation = root.yaw; actor.currentLocation = 'film_ambush_house';
  actor.currentAction = { type: 'idle', parameters: { player: true, resolved: true, bathroom, betrayal: { kind: 'bathroom', phase: 'ready', elapsed: 0, sixth: true } }, startedAt: 0, duration: 1, progress: 0 };
  const smithRoot = bathroomFightRoot(bathroom, 'smith'); smith.root.position.set(center.x + smithRoot.x, floor, center.z + smithRoot.z); smith.root.rotation.y = smithRoot.yaw;
  h.characters.animate(smith, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, bathroom: { ...bathroom, role: 'smith' } }, 4);
  const camera = new THREE.PerspectiveCamera(57, 440 / 670, .5, 5000), group = new THREE.Group(); group.add(morph.root); morph.root.position.y = -1;
  const controls = new PlayerControls(h.canvas, camera, () => {}, () => {});
  try {
    controls.possess(actor);
    for (let i = 0; i < 30; i++) { controls.update(.1, actor, group, false); h.characters.animate(morph, 0, controls.motion, 4); }
    camera.updateWorldMatrix(true, false); const neck = smith.hero!.bones.get('head')!.getWorldPosition(new THREE.Vector3());
    const contact = neck.clone(); contact.y -= .17; poseBathroom(morph, { ...bathroom, contact });
    const sight = camera.position.clone().sub(neck).normalize();
    assert.ok(Math.abs(sight.x) > Math.abs(sight.z), 'the ground camera must see the contact from the side instead of behind Morpheus');
    for (const [label, point] of [['Smith head', neck], ['Morpheus head', morph.hero!.bones.get('head')!.getWorldPosition(new THREE.Vector3())],
      ['left palm', morph.hero!.bones.get('wrist_L')!.localToWorld(new THREE.Vector3(0, -.19, .035))],
      ['right palm', morph.hero!.bones.get('wrist_R')!.localToWorld(new THREE.Vector3(0, -.19, .035))]] as [string, THREE.Vector3][]) {
      const screen = point.clone().project(camera);
      assert.ok(Math.abs(screen.x) < .85 && screen.y > -.35 && screen.y < .7, `${label} is outside the unobscured narrow viewport: ${screen.toArray()}`);
    }
  } finally { controls.dispose(); }
});

test('reconnecting during an upright bathroom counter restores the opponent face instead of the ground pitch', async t => {
  const h = await models(t), center = FILM_SETS.film_ambush_house.center;
  const actor = h.world.agents.get('morpheus')!, rig = h.characters.create(actor), smith = h.characters.create(h.world.agents.get('smith')!);
  await new Promise(resolve => setImmediate(resolve));
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000), group = new THREE.Group(); group.add(rig.root); rig.root.position.y = -1;
  const controls = new PlayerControls(h.canvas, camera, () => {}, () => {});
  const stage = (phase: BathroomGesture['phase'], elapsed: number) => {
    const bathroom = { ...newBathroomFight(), phase, elapsed, counters: 1, role: 'morpheus' as const }, root = bathroomFightRoot(bathroom, 'morpheus');
    actor.position = { x: center.x + root.x, y: center.y + WETWALL_SHAFT.sixth, z: center.z + root.z }; actor.rotation = root.yaw; actor.currentLocation = 'film_ambush_house';
    actor.currentAction = { type: 'idle', parameters: { player: true, resolved: true, bathroom }, startedAt: 0, duration: 1, progress: 0 };
    const smithRoot = bathroomFightRoot(bathroom, 'smith'); smith.root.position.set(center.x + smithRoot.x, actor.position.y - 1, center.z + smithRoot.z); smith.root.rotation.y = smithRoot.yaw;
    h.characters.animate(smith, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, bathroom: { ...bathroom, role: 'smith' } }, 4);
  };
  try {
    stage('ready', 0); controls.possess(actor); controls.update(.1, actor, group, false);
    controls.release(); assert.equal(controls.motion.bathroom, undefined, 'released bodies must not retain a previous bathroom prediction');
    stage('counter', .304); controls.possess(actor); controls.firstPerson = true;
    for (let i = 0; i < 3; i++) { controls.update(.1, actor, group, false); h.characters.animate(rig, 0, controls.motion, 4); }
    controls.update(.1, actor, group, false); camera.updateWorldMatrix(true, false);
    const face = smith.hero!.bones.get('head')!.getWorldPosition(new THREE.Vector3()).project(camera);
    assert.ok(Math.abs(face.x) < .7 && Math.abs(face.y) < .7 && Math.abs(face.z) < 1, `the restored duel view misses Smith face: ${face.toArray()}`);
    for (const y of [-.45, .4]) {
      const edge = smith.hero!.bones.get('head')!.localToWorld(new THREE.Vector3(0, y, .18)).project(camera);
      assert.ok(Math.abs(edge.y) < .9, `the counter camera is too close to show Smith whole face: ${edge.toArray()}`);
    }
    assert.ok(camera.getWorldDirection(new THREE.Vector3()).z > .9, 'upright reconnection must not inherit the ground restraint pitch');
  } finally { controls.dispose(); }
});

test('Morpheus counter palm reaches the delivered Smith chest at the hit peak', async t => {
  const h = await models(t), center = FILM_SETS.film_ambush_house.center;
  const morph = h.characters.create(h.world.agents.get('morpheus')!), smith = h.characters.create(h.world.agents.get('smith')!);
  await new Promise(resolve => setImmediate(resolve));
  const bathroom = { ...newBathroomFight(), phase: 'counter' as const, elapsed: .325, counters: 1, headbutt: true, evaded: true };
  for (const [role, rig] of [['smith', smith], ['morpheus', morph]] as const) {
    const root = bathroomFightRoot(bathroom, role);
    rig.root.position.set(center.x + root.x, center.y - 1 + WETWALL_SHAFT.sixth, center.z + root.z); rig.root.rotation.y = root.yaw;
    h.characters.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, bathroom: { ...bathroom, role } }, 4);
  }
  const chest = smith.hero!.bones.get('chest')!.localToWorld(new THREE.Vector3(0, .08, .23));
  poseBathroom(morph, { ...bathroom, role: 'morpheus', contact: chest.clone() });
  const palm = morph.hero!.bones.get('wrist_L')!.localToWorld(new THREE.Vector3(0, -.19, .035));
  const shoulder = morph.hero!.bones.get('shoulder_L')!.getWorldPosition(new THREE.Vector3());
  assert.ok(palm.distanceTo(chest) < .14, `the counter animation does not contact Smith chest: ${palm.distanceTo(chest)}; palm=${palm.toArray()}; chest=${chest.toArray()}; shoulder=${shoulder.toArray()}`);
  assert.equal(smith.hero!.glasses.visible, false, 'Smith glasses stay off after the headbutt');
});

test('the capture camera can see fallen Morpheus through the actual bathroom door frames in both viewports', async t => {
  const h = await models(t), center = FILM_SETS.film_ambush_house.center, actor = h.world.agents.get('morpheus')!, rig = h.characters.create(actor);
  await new Promise(resolve => setImmediate(resolve));
  const room = new THREE.Group(); room.position.set(center.x, center.y - 1, center.z);
  const material = new THREE.MeshBasicMaterial(), scenery = new SixthFloorRenderer(room, { plaster: material, wood: material, iron: material, trim: material });
  const group = new THREE.Group(); group.add(rig.root); rig.root.position.y = -1;
  try {
    for (const aspect of [16 / 9, 440 / 670]) {
      const camera = new THREE.PerspectiveCamera(57, aspect, .5, 5000), controls = new PlayerControls(h.canvas, camera, () => {}, () => {});
      try {
        const bathroom = { ...newBathroomFight(), phase: 'capturing' as const, elapsed: 2.591, counters: 4, role: 'morpheus' as const }, root = bathroomFightRoot(bathroom, 'morpheus');
        actor.position = { x: center.x + root.x, y: center.y + WETWALL_SHAFT.sixth, z: center.z + root.z }; actor.rotation = root.yaw; actor.currentLocation = 'film_ambush_house';
        actor.currentAction = { type: 'idle', parameters: { player: true, resolved: true, bathroom }, startedAt: 0, duration: 1, progress: 0 };
        controls.possess(actor);
        for (let i = 0; i < 30; i++) { controls.update(.1, actor, group, false); h.characters.animate(rig, 0, controls.motion, 4); }
        camera.updateWorldMatrix(true, false); room.updateMatrixWorld(true);
        const head = rig.hero!.bones.get('head')!.getWorldPosition(new THREE.Vector3()), view = head.clone().project(camera);
        assert.ok(Math.abs(view.x) < .8 && view.y > -.35 && view.y < .7, `the fallen head is outside the unobscured viewport: ${view.toArray()}`);
        const length = head.distanceTo(camera.position), ray = new THREE.Raycaster(camera.position, head.clone().sub(camera.position).normalize(), 0, length - .2);
        assert.equal(ray.intersectObject(room, true).length, 0, 'a rendered bathroom wall or door frame hides fallen Morpheus');
      } finally { controls.dispose(); }
    }
  } finally { scenery.dispose(); material.dispose(); }
});

test('fallen Morpheus rests his torso on the tiles instead of hovering above them', async t => {
  const h = await models(t), actor = h.world.agents.get('morpheus')!, rig = h.characters.create(actor);
  await new Promise(resolve => setImmediate(resolve));
  h.characters.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, bathroom: { ...newBathroomFight(), phase: 'done', role: 'morpheus' } }, 4);
  rig.root.updateMatrixWorld(true); const vertex = new THREE.Vector3(); let torso = Infinity;
  const ranges: object[] = [];
  for (const { mesh } of rig.hero!.wardrobe) if (mesh.visible && mesh instanceof THREE.SkinnedMesh) {
    let minimum = Infinity;
    const index = mesh.geometry.attributes.skinIndex, weight = mesh.geometry.attributes.skinWeight;
    for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
      mesh.getVertexPosition(i, vertex); mesh.localToWorld(vertex); minimum = Math.min(minimum, vertex.y);
      for (let k = 0; k < 4; k++) if (weight.getComponent(i, k) > .5 && ['pelvis', 'spine', 'chest'].includes(mesh.skeleton.bones[index.getComponent(i, k)].name)) torso = Math.min(torso, vertex.y);
    }
    ranges.push({ name: (mesh.material as THREE.Material).name, minimum });
  }
  assert.ok(torso < .3, `the visible fallen torso floats above the floor: ${torso}; parts=${JSON.stringify(ranges)}`);
});

test('observer bathroom bodies freeze without Morpheus control and share the predicted turn clock when he returns', async t => {
  const h = await models(t), center = FILM_SETS.film_ambush_house.center, scene = new THREE.Scene(), renderer = new AgentRenderer(scene);
  const morph = h.world.agents.get('morpheus')!, smith = h.world.agents.get('smith')!;
  const bathroom = { ...newBathroomFight(), phase: 'breakout' as const, elapsed: 1.6 };
  try {
    for (const actor of [morph, smith]) {
      const role = actor.id as BathroomGesture['role'], root = bathroomFightRoot(bathroom, role);
      actor.position = { x: center.x + root.x, y: center.y + WETWALL_SHAFT.sixth, z: center.z + root.z }; actor.rotation = root.yaw; actor.currentLocation = 'film_ambush_house';
      actor.currentAction = { type: 'idle', parameters: { resolved: true, bathroom: { ...bathroom, role }, betrayal: { kind: 'bathroom', phase: 'defending', elapsed: 4, sixth: true } }, startedAt: 0, duration: 1, progress: 0 };
      renderer.updateAgent(actor.id, actor);
    }
    await new Promise(resolve => setImmediate(resolve)); renderer.update(.35, undefined, 1);
    for (const actor of [morph, smith]) assert.ok(renderer.getAgent(actor.id)!.position.distanceTo(new THREE.Vector3(actor.position.x, actor.position.y, actor.position.z)) < .01,
      'an unowned bathroom checkpoint must not drift while the rest of the world runs');
    morph.controller = 'bathroom-review'; renderer.updateAgent('morpheus', morph); renderer.updateAgent('smith', smith); renderer.update(.2, undefined, 1);
    const predicted = { ...bathroom, elapsed: 1.8 }, root = bathroomFightRoot(predicted, 'morpheus');
    assert.ok(Math.abs(renderer.getAgent('morpheus')!.position.z - center.z - root.z) < .01);
    const chest = renderer.getAgentBody('morpheus')!.getObjectByName('chest')!;
    assert.ok(Math.abs(chest.rotation.x - .6 * (1 - THREE.MathUtils.smoothstep(1.8, 1.2, 2.6))) < .01,
      'the late contact pass must not restore an older body pose after the predicted root turns');
  } finally { renderer.dispose(); }
});
