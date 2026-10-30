import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { AMBUSH_DOFF, AMBUSH_WINDOW_PROGRESS, FILM_SETS, ambushRetreatRoot, ambushRetreatShift, newAmbushEscape, type AgentState, type FilmJourney } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import type { CharacterRig } from '../packages/client/src/agents/CharacterModel.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

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
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {}, fillRect() {}, strokeRect() {}, fillText() {}, createRadialGradient: () => ({ addColorStop() {} }) }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  let actor = world.agents.get('morpheus')!;
  const progress = AMBUSH_WINDOW_PROGRESS + ambushRetreatShift('morpheus') - 12.6, root = ambushRetreatRoot(progress, 'morpheus'), center = FILM_SETS.film_ambush_house.center;
  Object.assign(actor, { isInMatrix: true, currentLocation: 'film_ambush_house', position: { x: center.x + root.x, y: center.y + root.y, z: center.z + root.z }, rotation: 0, velocity: { x: 0, y: 0, z: 0 } });
  let journey: FilmJourney = { version: 1, scene: 'm1_dejavu', actor: 'neo', step: 1, completed: [], enteredAt: 0,
    checkpoint: { ...actor.position }, reflections: {}, lastText: '', ambushEscape: newAmbushEscape() };
  journey.ambushEscape!.phase = 'phone'; journey.ambushEscape!.doffPerformance = true; journey.ambushEscape!.progress.morpheus = progress;
  const scene = new THREE.Scene(); let renderer = new AgentRenderer(scene), matrix = true;
  const rig = () => (renderer as unknown as { agents: Map<string, { rig: CharacterRig }> }).agents.get(actor.id)!.rig;
  const frame = (dt = 0, speed = 0) => {
    renderer.updateAgent(actor.id, actor); renderer.setWorld(matrix); renderer.update(dt, undefined, speed, 0, journey); scene.updateMatrixWorld(true);
  };
  const doff = (elapsed: number) => {
    const escape = journey.ambushEscape!;
    escape.doff = { elapsed, progress, yaw: 0 };
    actor.currentAction = { type: 'idle', parameters: { resolved: true, armed: false, ambushEscort: { role: 'morpheus', progress, retreat: true, watching: true }, ambushDoff: { ...escape.doff } }, startedAt: 0, duration: 1, progress: 0 };
    frame();
  };
  const settle = async () => { await Promise.all(pending); await new Promise(resolve => setImmediate(resolve)); frame(); assert.ok(rig().hero); };
  const cold = async () => {
    actor = JSON.parse(JSON.stringify(actor)) as AgentState; journey = JSON.parse(JSON.stringify(journey)) as FilmJourney;
    renderer.dispose(); assert.equal(scene.children.length, 0, 'disposing the renderer must remove its world garment too');
    renderer = new AgentRenderer(scene); frame(); await settle();
  };
  t.after(() => { renderer.dispose(); globalThis.document = document; });
  frame(); await settle();
  const setWorld = (value: boolean) => { matrix = value; renderer.setWorld(value); };
  return { scene, get actor() { return actor; }, get journey() { return journey; }, rig, frame, doff, cold, setWorld };
}

function belongsTo(object: THREE.Object3D, root: THREE.Object3D): boolean {
  for (let parent: THREE.Object3D | null = object; parent; parent = parent.parent) if (parent === root) return true;
  return false;
}
function visible(object: THREE.Object3D): boolean {
  for (let parent: THREE.Object3D | null = object; parent; parent = parent.parent) if (!parent.visible) return false;
  return true;
}
function coat(h: Awaited<ReturnType<typeof fixture>>): THREE.SkinnedMesh {
  const all: THREE.SkinnedMesh[] = [];
  h.scene.traverse(object => { if (object instanceof THREE.SkinnedMesh && object.name === 'morpheus-ambush-coat') all.push(object); });
  assert.equal(all.length, 1, 'wearing, holding and placing must use one delivered coat');
  return all[0];
}
function surface(mesh: THREE.Mesh): Float64Array {
  const result = new Float64Array(mesh.geometry.attributes.position.count * 3), point = new THREE.Vector3();
  if (mesh instanceof THREE.SkinnedMesh) mesh.skeleton.update();
  for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
    mesh.getVertexPosition(i, point).applyMatrix4(mesh.matrixWorld); point.toArray(result, i * 3);
  }
  return result;
}
function pose(h: Awaited<ReturnType<typeof fixture>>) {
  const hero = h.rig().hero!;
  const meshes = ['Anatomical_head_and_hands', 'morpheus-ambush-shirt', 'morpheus-ambush-coat', 'morpheus-ambush-lapels'].map(name => {
    const object = h.scene.getObjectByName(name); assert.ok(object instanceof THREE.Mesh, name); return object;
  });
  meshes.push(...hero.panels.map(panel => panel.mesh));
  return meshes.map(mesh => ({ name: mesh.name, visible: visible(mesh), points: surface(mesh) }));
}
function samePose(actual: ReturnType<typeof pose>, expected: ReturnType<typeof pose>, context: string) {
  assert.equal(actual.length, expected.length, context);
  for (let part = 0; part < actual.length; part++) {
    const a = actual[part], b = expected[part]; assert.equal(a.name, b.name); assert.equal(a.visible, b.visible, `${context}/${a.name}: visibility`);
    assert.equal(a.points.length, b.points.length, `${context}/${a.name}: surface topology`);
    let difference = 0;
    for (let i = 0; i < a.points.length; i++) difference = Math.max(difference, Math.abs(a.points[i] - b.points[i]));
    assert.ok(difference < 1e-6, `${context}/${a.name}: actual world surface changed by ${difference}`);
  }
}

test('nonzero saved removals rebuild the same actual body, hands and single detached garment after cold load', async t => {
  const h = await fixture(t); let original = coat(h);
  for (let i = 0; i < 73; i++) h.frame(1 / 60, 1);
  for (const elapsed of [.6, 2.8, 4.9, 7.6, AMBUSH_DOFF.duration]) {
    h.doff(elapsed);
    const item = coat(h); assert.equal(item, original, 'the coat cannot be replaced by a display duplicate');
    assert.equal(belongsTo(item, h.rig().hero!.root), false, 'the independent garment must leave the body hierarchy');
    assert.equal(visible(item), true);
    const before = pose(h), saved = structuredClone(h.journey.ambushEscape);
    h.frame(.3, 0); samePose(pose(h), before, `paused ${elapsed}`);
    await h.cold();
    assert.equal(belongsTo(coat(h), h.rig().hero!.root), false);
    samePose(pose(h), before, `cold ${elapsed}`);
    assert.deepEqual(h.journey.ambushEscape, saved, 'presentation must not advance the saved clock');
    // Each cold model is a fresh identity; the next saved stage must keep that identity.
    original = coat(h);
  }
});

test('the completed coat stays in the eighth-floor world while Morpheus leaves for the pipe and is controlled elsewhere', async t => {
  const h = await fixture(t); h.doff(AMBUSH_DOFF.duration);
  const item = coat(h); assert.equal(belongsTo(item, h.rig().hero!.root), false);
  const before = surface(item);
  for (const scene of ['m1_wetwall', 'm1_wall_exposed', 'm1_bathroom', 'm1_basement']) {
    h.journey.scene = scene; h.journey.completed = ['m1_dejavu']; h.journey.ambushEscape!.phase = 'done';
    h.actor.currentAction = null; h.actor.controller = 'other-player'; h.actor.position.x += 7;
    if (scene === 'm1_basement') h.actor.currentLocation = 'film_government_office';
    for (let frame = 0; frame < 60; frame++) h.frame(1 / 60, 1);
    assert.equal(coat(h), item); assert.equal(visible(item), true);
    assert.deepEqual(surface(item), before, `${scene}: the placed coat must not follow its former wearer's body or location`);
  }
});

test('clearing a removed coat restores borrowed binding and material while releasing its own garment resources', async t => {
  const h = await fixture(t), item = coat(h), parent = item.parent, skeleton = item.skeleton, geometry = item.geometry, material = item.material as THREE.Material;
  let borrowedDisposed = false; material.addEventListener('dispose', () => { borrowedDisposed = true; });
  h.doff(4);
  assert.equal(coat(h), item); assert.ok(item.skeleton !== skeleton, 'removed cloth needs its own skeleton'); assert.equal(belongsTo(item, h.rig().hero!.root), false);
  const removedSkeleton = item.skeleton, removedGeometry = item.geometry;
  let skeletonDisposed = false, geometryDisposed = false;
  const disposeSkeleton = removedSkeleton.dispose.bind(removedSkeleton);
  t.mock.method(removedSkeleton, 'dispose', () => { skeletonDisposed = true; disposeSkeleton(); });
  if (removedGeometry !== geometry) removedGeometry.addEventListener('dispose', () => { geometryDisposed = true; });
  h.journey.ambushEscape = newAmbushEscape(); h.journey.ambushEscape.phase = 'phone'; h.actor.currentAction = null; h.frame();
  assert.equal(item.parent, parent); assert.equal(item.skeleton, skeleton); assert.equal(item.geometry, geometry);
  assert.equal(belongsTo(item, h.rig().hero!.root), true); assert.equal(visible(item), true);
  assert.equal(skeletonDisposed, true); if (removedGeometry !== geometry) assert.equal(geometryDisposed, true);
  assert.equal(borrowedDisposed, false, 'clearing the world garment cannot dispose the source coat material');
  assert.equal(coat(h), item);
});

test('world changes and visits hide the placed coat and returning reconstructs its saved location without changing the story', async t => {
  const h = await fixture(t); h.doff(AMBUSH_DOFF.duration);
  const item = coat(h); assert.equal(belongsTo(item, h.rig().hero!.root), false);
  const before = surface(item);
  h.setWorld(false); h.frame(.016, 1);
  assert.equal(visible(item), false, 'a Matrix garment cannot appear on the real-world deck');
  h.setWorld(true); h.frame(); assert.equal(visible(item), true); assert.deepEqual(surface(item), before);
  h.journey.scene = 'm1_wetwall'; h.journey.completed = ['m1_dejavu']; h.journey.ambushEscape!.phase = 'done';
  const saved = structuredClone(h.journey.ambushEscape);
  h.journey.visiting = 'm1_dejavu'; h.frame();
  assert.equal(belongsTo(coat(h), h.rig().hero!.root), true, 'a visit cannot create the mainline placed garment');
  assert.equal(visible(coat(h)), false, 'Neo visiting must not redress the distant canonical Morpheus');
  assert.deepEqual(h.journey.ambushEscape, saved);
  delete h.journey.visiting; h.frame();
  assert.equal(coat(h), item); assert.equal(belongsTo(item, h.rig().hero!.root), false); assert.equal(visible(item), true);
  const returned = surface(item); assert.equal(returned.length, before.length);
  let difference = 0; for (let i = 0; i < returned.length; i++) difference = Math.max(difference, Math.abs(returned[i] - before[i]));
  assert.ok(difference < 1e-6, `returning moves the saved coat by ${difference}`);
  assert.deepEqual(h.journey.ambushEscape, saved);
});
