import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { FILM_SETS, TRINITY_RELAY, trinityRelayRoot, type FilmJourney, type TrinityRelayGesture } from '@auto_matrix/shared';
import { NebDeckRenderer } from '../packages/client/src/engine/NebDeckRenderer.js';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
async function models(t: test.TestContext) {
  const assets = new Map();
  for (const name of ['neo', 'trinity', 'smith', 'morpheus', 'neo-office', 'neo-tracking', 'trinity-club', 'choi', 'dujour']) {
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

test('the real ship shows Trinity clothed, then restores her Matrix leather rather than retaining the knit material', async t => {
  const h = await models(t), rig = h.characters.create(h.world.agents.get('trinity')!);
  await new Promise(resolve => setImmediate(resolve)); assert.ok(rig.hero);
  const jacket = rig.hero.wardrobe.find(part => /Fitted.leather.jacket/i.test(part.mesh.name))!;
  const matrix = (realWorld: boolean) => h.characters.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld }, 0);
  matrix(false); const original = { color: jacket.mesh.material.color.clone(), roughness: jacket.mesh.material.roughness, map: jacket.mesh.material.map };
  matrix(true);
  assert.equal(jacket.mesh.visible, true, 'her only upper garment must remain visible in the real world');
  assert.ok(jacket.mesh.material.roughness > .9, 'the real-world garment must read as cloth');
  assert.ok(jacket.mesh.material.bumpMap?.name.includes('knit'));
  assert.equal(rig.hero.glasses.visible, false);
  matrix(false); assert.equal(jacket.mesh.visible, true);
  assert.equal(jacket.mesh.material.color.getHex(), original.color.getHex());
  assert.equal(jacket.mesh.material.roughness, original.roughness);
  assert.equal(jacket.mesh.material.map, original.map);
});

async function seated(t: test.TestContext, role: 'trinity' | 'link', elapsed: number) {
  const h = await models(t), rig = h.characters.create(h.world.agents.get(role)!);
  await new Promise(resolve => setImmediate(resolve)); assert.ok(rig.hero);
  const center = FILM_SETS.film_neb_deck.center, room = new THREE.Group(); room.position.set(center.x, center.y - 1, center.z);
  const renderer = new NebDeckRenderer(room); t.after(() => renderer.dispose());
  const gesture: TrinityRelayGesture = { phase: 'connecting', elapsed, role }, point = trinityRelayRoot(gesture);
  rig.root.position.set(center.x + point.x, center.y - 1, center.z + point.z); rig.root.rotation.y = point.yaw;
  const pose = () => {
    h.characters.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, trinityRelay: gesture }, 0);
    rig.root.updateMatrixWorld(true); rig.root.traverse(object => { if (object instanceof THREE.SkinnedMesh) object.skeleton.update(); });
  };
  pose();
  const journey = { scene: 'm2_relay', trinityRelay: gesture } as FilmJourney;
  renderer.update(journey, 500, role === 'trinity' ? rig.root : undefined, id => id === role ? rig.root : undefined); room.updateMatrixWorld(true);
  return { ...h, rig, room, renderer, pose };
}

test('Trinity and Link sit on the actual cushions and rest delivered boots on the visible footrests', async t => {
  for (const [role, elapsed] of [['trinity', 15], ['link', 0]] as const) {
    const h = await seated(t, role, elapsed);
    const pelvis = h.rig.hero!.bones.get('pelvis')!.getWorldPosition(new THREE.Vector3());
    const chair = h.room.getObjectByName(role === 'trinity' ? 'neb-core-chair-trinity' : 'neb-core-chair-four')!;
    const hit = new THREE.Raycaster(pelvis.clone().add(new THREE.Vector3(0, .5, 0)), new THREE.Vector3(0, -1, 0)).intersectObject(chair, true)[0];
    assert.ok(hit, `${role} misses the visible chair`);
    const separation = pelvis.y - hit.point.y;
    assert.ok(separation > .03 && separation < .25, `${role} pelvis/cushion separation ${separation}`);
    let low = Infinity;
    for (const part of h.rig.hero!.wardrobe) if (part.mesh.visible && /boot|shoe/i.test(part.mesh.name)) {
      for (let i = 0; i < part.mesh.geometry.attributes.position.count; i++) low = Math.min(low, part.mesh.localToWorld(part.mesh.getVertexPosition(i, new THREE.Vector3())).y);
    }
    const footrest = h.room.getObjectByName(`${chair.name}-footrest`)!;
    const support = new THREE.Box3().setFromObject(footrest).max.y;
    assert.ok(low - support >= -.025 && low - support < .05, `${role} boot/footrest separation ${low - support}`);
    const head = h.rig.hero!.bones.get('head')!.getWorldPosition(new THREE.Vector3());
    h.pose(); assert.ok(head.distanceTo(h.rig.hero!.bones.get('head')!.getWorldPosition(new THREE.Vector3())) < 1e-7, 'the saved clock reconstructs the same seated body');
  }
});

test('Link holds the same rendered plug as it approaches Trinity’s actual neck socket', async t => {
  const h = await seated(t, 'trinity', 15), link = h.characters.create(h.world.agents.get('link')!);
  await new Promise(resolve => setImmediate(resolve)); assert.ok(link.hero);
  const center = FILM_SETS.film_neb_deck.center;
  for (const elapsed of [14.4, 15, 15.8]) {
    const gesture: TrinityRelayGesture = { phase: 'connecting', elapsed, role: 'link' }, point = trinityRelayRoot(gesture);
    link.root.position.set(center.x + point.x, center.y - 1, center.z + point.z); link.root.rotation.y = point.yaw;
    h.characters.animate(link, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, trinityRelay: gesture }, 0);
    h.renderer.update({ scene: 'm2_relay', trinityRelay: gesture } as FilmJourney, 500, h.rig.root, id => id === 'link' ? link.root : h.rig.root);
    const plug = h.room.getObjectByName('neb-first-core-connector')!, palm = link.hero.bones.get('wrist_R')!.localToWorld(new THREE.Vector3(0, -.19, .035));
    assert.ok(palm.distanceTo(plug.getWorldPosition(new THREE.Vector3())) < .05, `palm/plug gap at ${elapsed}: ${palm.distanceTo(plug.getWorldPosition(new THREE.Vector3()))}`);
    const chair = h.room.getObjectByName('neb-core-chair-trinity')!, elbow = link.hero.bones.get('elbow_R')!.getWorldPosition(new THREE.Vector3());
    const arm = palm.clone().sub(elbow);
    const collisions = new THREE.Raycaster(elbow, arm.clone().normalize(), .03, arm.length() - .03).intersectObject(chair, true);
    assert.equal(collisions.length, 0, `Link's forearm crosses the connection chair at ${elapsed}: ${collisions.map(hit => `${hit.object.name || hit.object.parent!.name} ${hit.point.toArray()}`)}`);

  }
});
