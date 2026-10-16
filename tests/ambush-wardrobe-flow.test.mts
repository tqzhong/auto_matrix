import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { FILM_SETS, newAmbushEscape, type AgentState, type FilmJourney } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { CharacterModels, type CharacterRig } from '../packages/client/src/agents/CharacterModel.js';
import type { MotionInput } from '../packages/client/src/agents/CharacterMotion.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

function assertClothes(rig: CharacterRig, outfit: 'coat' | 'shirt' | undefined) {
  const hero = rig.hero!;
  const visible = (object: THREE.Object3D) => {
    for (let ancestor: THREE.Object3D | null = object; ancestor; ancestor = ancestor.parent) if (!ancestor.visible) return false;
    return true;
  };
  for (const part of ['shirt', 'collar', 'tie', 'coat', 'lapels']) {
    const mesh = hero.root.getObjectByName(`morpheus-ambush-${part}`);
    assert.ok(mesh instanceof THREE.SkinnedMesh, `${part}: inspect actual skinned garments, not just the delivered input`);
    assert.ok(mesh.geometry.attributes.skinWeight.count > 0);
    assert.equal(visible(mesh), outfit !== undefined && (!['coat', 'lapels'].includes(part) || outfit === 'coat'), `${outfit}/${part}: visible including ancestors`);
  }
  if (!outfit) return;
  for (const name of ['Tailored_coat_upper', 'Black_crew_neck', 'morpheus-hammer-sweater']) {
    const mesh = hero.root.getObjectByName(name); assert.ok(mesh, name);
    assert.equal(visible(mesh), false, `${outfit}: incompatible ${name} must not cover the film clothes`);
  }
  const tails = hero.wardrobe.filter(part => part.outer);
  assert.ok(tails.length, 'inspect the actual pelvis-mounted long coat');
  assert.ok(tails.every(part => visible(part.mesh) === (outfit === 'coat')), `${outfit}: long lower coat visibility`);
}

// Actual actor selection and shipped skinned models; only browser image decoding is omitted.
async function fixture(t: TestContext) {
  const assets = new Map<string, Promise<any>>(), pending: Promise<unknown>[] = [];
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async url => {
    const name = String(url).split('/').pop()!;
    if (!assets.has(name)) assets.set(name, (async () => {
      const raw = await readFile(new URL(`../packages/client/public/assets/characters/${name}`, import.meta.url)), size = raw.readUInt32LE(12);
      const doc = JSON.parse(raw.subarray(20, 20 + size).toString());
      for (const material of doc.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
      doc.images = []; doc.textures = [];
      const json = Buffer.from(JSON.stringify(doc)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
      const bin = raw.subarray(20 + size), data = Buffer.alloc(20 + padded.length + bin.length);
      data.writeUInt32LE(0x46546c67); data.writeUInt32LE(2, 4); data.writeUInt32LE(data.length, 8);
      data.writeUInt32LE(padded.length, 12); data.writeUInt32LE(0x4e4f534a, 16); padded.copy(data, 20); bin.copy(data, 20 + padded.length);
      return new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '');
    })());
    const promise = assets.get(name)!; pending.push(promise); const asset = await promise; return { ...asset, scene: clone(asset.scene) };
  });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const originalDocument = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {}, fillRect() {}, strokeRect() {}, fillText() {}, createRadialGradient: () => ({ addColorStop() {} }) }) }) } as unknown as Document;
  const inputs = new Map<CharacterRig, MotionInput>(), animate = CharacterModels.prototype.animate;
  t.mock.method(CharacterModels.prototype, 'animate', function (rig, dt, input, distance) {
    inputs.set(rig, { ...input }); return animate.call(this, rig, dt, input, distance);
  });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  let actor = world.agents.get('morpheus')!;
  actor.isInMatrix = true; actor.currentLocation = 'film_ambush_house'; actor.currentAction = null;
  actor.position = { ...FILM_SETS.film_ambush_house.center };
  let journey: FilmJourney = { version: 1, scene: 'm1_dejavu', actor: 'neo', step: 0, completed: [], enteredAt: 0,
    checkpoint: { ...actor.position }, reflections: {}, lastText: '' };
  const scene = new THREE.Scene(); let renderer = new AgentRenderer(scene);
  const playerMotion: MotionInput = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 };
  const rig = () => (renderer as unknown as { agents: Map<string, { rig: CharacterRig }> }).agents.get(actor.id)!.rig;
  const frame = (player = false, firstPerson = false, dt = 0) => {
    renderer.updateAgent(actor.id, actor); renderer.setWorld(actor.isInMatrix); renderer.setPlayer(player ? actor.id : null, firstPerson);
    if (player) renderer.setPlayerMotion(playerMotion);
    renderer.update(dt, undefined, dt > 0 ? 1 : 0, 0, journey); scene.updateMatrixWorld(true);
    assert.ok(inputs.has(rig()), 'inspect the input delivered by the actual AgentRenderer');
    return inputs.get(rig())!.ambushWardrobe;
  };
  const settle = async () => { await Promise.all(pending); await new Promise(resolve => setImmediate(resolve)); frame(); assert.ok(rig().hero); };
  const cold = async () => {
    actor = JSON.parse(JSON.stringify(actor)) as AgentState; journey = JSON.parse(JSON.stringify(journey)) as FilmJourney;
    renderer.dispose(); renderer = new AgentRenderer(scene); frame(); await settle();
  };
  t.after(() => { renderer.dispose(); globalThis.document = originalDocument; });
  frame(); await settle();
  return { get actor() { return actor; }, get journey() { return journey; }, playerMotion, frame, cold, rig };
}

test('the persistent old-building phase selects coat before the call and shirt after it without a phone action', async t => {
  const h = await fixture(t);
  assert.equal(h.frame(), 'coat'); assertClothes(h.rig(), 'coat');
  h.journey.ambushEscape = newAmbushEscape();
  for (const phase of ['alarm', 'descending', 'window', 'phone'] as const) {
    h.journey.ambushEscape.phase = phase; assert.equal(h.frame(), 'coat', phase); assertClothes(h.rig(), 'coat');
  }
  for (const phase of ['call', 'forming', 'wetwall', 'done'] as const) {
    h.journey.ambushEscape.phase = phase;
    assert.equal(h.actor.currentAction, null, 'the fixture must not rely on the transient phone gesture');
    assert.equal(h.frame(), 'shirt', phase); assertClothes(h.rig(), 'shirt');
  }
});

test('independent cold saves retain the shirt through the pipe, sixth floor, sacrifice and the crew leaving Morpheus behind', async t => {
  const h = await fixture(t);
  for (const scene of ['m1_wetwall', 'm1_wall_exposed', 'm1_bathroom', 'm1_basement', 'm1_tv_exit', 'm1_unplugged', 'm1_rescue_decision', 'm1_guns', 'm1_lobby']) {
    h.journey.scene = scene; h.journey.completed = []; delete h.journey.ambushEscape;
    assert.equal(h.frame(), 'shirt', `${scene}: no prior client or phone history is required`);
    assertClothes(h.rig(), 'shirt');
    await h.cold(); assert.equal(h.frame(), 'shirt', `${scene}: fresh renderer`); assertClothes(h.rig(), 'shirt');
  }
});

test('failed saves keep the clothes reached during the call, including an unconnected call, until retry restores its checkpoint', async t => {
  const h = await fixture(t);
  const cases = [
    { checkpoint: 'forming', traced: true, started: false, outfit: 'shirt' },
    { checkpoint: 'wetwall', traced: true, started: false, outfit: 'shirt' },
    { checkpoint: 'phone', traced: false, started: true, outfit: 'shirt' },
    { checkpoint: 'phone', traced: true, started: false, outfit: 'shirt' },
    { checkpoint: 'phone', traced: false, started: false, outfit: 'coat' },
    { checkpoint: 'descending', traced: false, started: false, outfit: 'coat' },
  ] as const;
  for (const item of cases) {
    const escape = h.journey.ambushEscape = newAmbushEscape();
    escape.phase = 'failed'; escape.checkpoint.phase = item.checkpoint; escape.traced = item.traced;
    escape.mouseDead = true; escape.caught = .8; escape.elapsed = item.started ? 1.2 : item.traced && item.checkpoint === 'phone' ? 4 : 0;
    escape.checkpoint.traced = ['forming', 'wetwall'].includes(item.checkpoint);
    if (item.started) escape.callStart = { trinityProgress: 400, trinityYaw: -Math.PI / 2, morpheusYaw: Math.PI / 2 };
    else delete escape.callPerformance; // Older calls use traced immediately and have no callStart.
    const saved = structuredClone(escape), label = `${item.checkpoint}/${item.traced}/${item.started}`;
    assert.equal(h.frame(), item.outfit, `${label}: failure cannot put a removed coat back on`);
    assertClothes(h.rig(), item.outfit);
    await h.cold(); assert.equal(h.frame(), item.outfit, `${label}: independent failed save`); assertClothes(h.rig(), item.outfit);
    assert.deepEqual(h.journey.ambushEscape, saved, 'presentation must not change the saved failure or checkpoint');
    // Match the actual retry contract: restore checkpoint.phase/traced and remove callStart.
    const restored = h.journey.ambushEscape!;
    restored.phase = restored.checkpoint.phase; restored.traced = restored.checkpoint.traced; delete restored.callStart;
    assert.equal(h.frame(), ['forming', 'wetwall'].includes(item.checkpoint) ? 'shirt' : 'coat', `${label}: retry restores that checkpoint's clothes`);
  }
});

test('taking control or clearing the action does not change clothes, and leaving the building clears a reused player input', async t => {
  const h = await fixture(t); h.journey.scene = 'm1_wetwall';
  h.actor.controller = 'player'; h.actor.currentAction = null;
  for (const firstPerson of [false, true, false]) assert.equal(h.frame(true, firstPerson, .016), 'shirt');
  assertClothes(h.rig(), 'shirt');
  h.actor.controller = 'other-player'; assert.equal(h.frame(), 'shirt'); assertClothes(h.rig(), 'shirt');
  for (const [location, matrix] of [['film_white_construct', false], ['film_real_desert', false], ['film_kungfu_dojo', false],
    ['film_neb_deck', false], ['film_government_office', true], ['film_government_roof', true]] as const) {
    h.actor.currentLocation = location; h.actor.isInMatrix = matrix; h.actor.position = { ...FILM_SETS[location].center };
    h.playerMotion.ambushWardrobe = 'shirt';
    assert.equal(h.frame(true), undefined, `${location}: old-building clothes must not survive on a reused playerMotion object`);
    assertClothes(h.rig(), undefined);
    if (location === 'film_white_construct' || location === 'film_real_desert') {
      assert.equal(h.rig().hero!.root.getObjectByName('morpheus-construct-tie')!.visible, true, 'restore the actual Construct suit');
    } else if (location === 'film_neb_deck') {
      assert.equal(h.rig().hero!.root.getObjectByName('morpheus-hammer-sweater')!.visible, true, 'restore the actual ship knit');
    }
  }
  h.actor.currentLocation = 'film_ambush_house'; h.actor.position = { ...FILM_SETS.film_ambush_house.center }; h.actor.isInMatrix = false;
  assert.equal(h.frame(true), undefined, 'the actual real-world body is never dressed by Matrix story progress');
});

test('only Morpheus personally visiting the old building changes his outfit to the visited scene', async t => {
  const h = await fixture(t); h.journey.scene = 'm1_bathroom'; h.journey.actor = 'morpheus';
  h.journey.completed = ['m1_dejavu', 'm1_wetwall']; h.journey.ambushEscape = newAmbushEscape(); h.journey.ambushEscape.phase = 'done';
  const escape = structuredClone(h.journey.ambushEscape);
  h.journey.visiting = 'm1_dejavu'; assert.equal(h.frame(true), 'coat', 'a visit starts at the earlier scene entrance, not the saved completed call'); assertClothes(h.rig(), 'coat');
  h.journey.visiting = 'm1_wetwall'; assert.equal(h.frame(true), 'shirt'); assertClothes(h.rig(), 'shirt');
  delete h.journey.visiting; assert.equal(h.frame(true), 'shirt'); assertClothes(h.rig(), 'shirt');
  h.journey.actor = 'neo'; h.journey.visiting = 'm1_dejavu';
  assert.equal(h.frame(), 'shirt', 'Neo visiting another scene does not move or redress Morpheus');
  assert.deepEqual(h.journey.ambushEscape, escape, 'wardrobe selection cannot migrate or rewind the saved encounter');
  await h.cold(); assert.equal(h.frame(), 'shirt'); assertClothes(h.rig(), 'shirt');
});

test('old-building wardrobe never applies to other characters at the same story checkpoint', async t => {
  const h = await fixture(t); h.journey.scene = 'm1_wetwall';
  h.actor.id = 'trinity'; h.actor.name = 'Trinity';
  assert.equal(h.frame(), undefined);
});
