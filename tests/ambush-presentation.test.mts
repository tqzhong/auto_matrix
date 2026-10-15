import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { FILM_SETS, ambushFloor, ambushRouteRoot, ambushRetreatRoot, type AmbushEscort, type AgentState } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import type { CharacterRig } from '../packages/client/src/agents/CharacterModel.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

// Keep the delivered skinning/geometry. Only images are omitted for offline contact checks.
async function fixture(t: TestContext, role: 'morpheus' | 'trinity', delayed = false) {
  const pending: Promise<unknown>[] = [], assets = new Map<string, Promise<any>>();
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; }); if (!delayed) release();
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async url => {
    const name = String(url).split('/').pop()!;
    if (!assets.has(name)) assets.set(name, (async () => {
      await gate;
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
  const actor = world.agents.get(role)!; actor.currentLocation = 'film_ambush_house'; actor.isInMatrix = true;
  const scene = new THREE.Scene(); let renderer = new AgentRenderer(scene);
  const render = (delta = 0, speed = 0) => { renderer.update(delta, undefined, speed); scene.updateMatrixWorld(true); };
  const snapshot = (progress: number, retreat = false, speed = 4.2, watching = false) => {
    const root = retreat ? ambushRetreatRoot(progress, role) : ambushRouteRoot(progress, role, true);
    const center = FILM_SETS.film_ambush_house.center;
    actor.position = { x: center.x + root.x, y: center.y + root.y, z: center.z + root.z };
    actor.rotation = watching ? -1.2 : root.yaw;
    actor.velocity = { x: Math.sin(root.yaw) * speed, y: 0, z: Math.cos(root.yaw) * speed };
    actor.currentAction = { type: 'idle', parameters: { resolved: true, armed: retreat,
      ambushEscort: { role, progress, watching, retreat: retreat ? true : undefined, stairCat: true } satisfies AmbushEscort }, startedAt: 0, duration: 1, progress: 0 };
    renderer.updateAgent(role, actor);
  };
  const rig = () => (renderer as unknown as { agents: Map<string, { rig: CharacterRig }> }).agents.get(role)!.rig;
  const settle = async () => { release(); await Promise.all(pending); await new Promise(resolve => setImmediate(resolve)); render(); assert.ok(rig().hero); };
  const restart = () => {
    const saved = JSON.parse(JSON.stringify(actor)) as AgentState;
    renderer.dispose(); renderer = new AgentRenderer(scene); renderer.updateAgent(role, saved); render();
  };
  t.after(() => { renderer.dispose(); globalThis.document = document; });
  return { actor, scene, get renderer() { return renderer; }, render, snapshot, settle, rig, restart };
}

function surface(rig: CharacterRig): Map<string, Float64Array> {
  rig.root.updateWorldMatrix(true, false); rig.root.updateMatrixWorld(true);
  const points = new Map<string, Float64Array>(), point = new THREE.Vector3(); let index = 0;
  rig.root.traverseVisible(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const values = new Float64Array(object.geometry.attributes.position.count * 3);
    for (let i = 0; i < values.length / 3; i++) { object.getVertexPosition(i, point); object.localToWorld(point); point.toArray(values, i * 3); }
    points.set(`${index++}:${object.name}`, values);
  });
  return points;
}

function sameSurface(actual: Map<string, Float64Array>, expected: Map<string, Float64Array>, label: string) {
  assert.deepEqual([...actual.keys()], [...expected.keys()], `${label}: visible parts changed`);
  for (const [name, points] of expected) {
    const next = actual.get(name)!; assert.equal(next.length, points.length);
    let largest = 0;
    for (let i = 0; i < points.length; i += 3) largest = Math.max(largest, Math.hypot(next[i] - points[i], next[i + 1] - points[i + 1], next[i + 2] - points[i + 2]));
    assert.ok(largest < .00001, `${label}: ${name} moves ${largest}`);
  }
}

test('a running stair turn freezes its actual body and coat when paused with nonzero RAF delta', async t => {
  const h = await fixture(t, 'morpheus'); h.snapshot(27.7); h.render(); await h.settle();
  h.snapshot(29.8); for (let frame = 0; frame < 5; frame++) h.render(.1, 1);
  assert.ok(h.rig().motion.speed > 3, 'the comparison must begin in a real walking pose');
  const before = surface(h.rig()), yaw = h.rig().root.rotation.y;
  for (let frame = 0; frame < 10; frame++) h.render(.05, 0);
  assert.ok(Math.abs(h.rig().root.rotation.y - yaw) < 1e-9, 'worldSpeed=0 must freeze a turning body as well as its root');
  sameSurface(surface(h.rig()), before, 'paused stair turn');
});

test('actual ascending and armed retreat models restore the same gait and visible coat after a cold load', async t => {
  for (const role of ['morpheus', 'trinity'] as const) await t.test(role, async t => {
    const h = await fixture(t, role);
    for (const [progress, retreat] of [[29.8, false], [53.4, false], [59.1, true], [125.4, true]] as const) {
      h.snapshot(progress - 2.1, retreat); h.render(); await h.settle();
      h.snapshot(progress, retreat); for (let frame = 0; frame < 5; frame++) h.render(.1, 1);
      assert.ok(h.rig().motion.speed > 3);
      const running = surface(h.rig());
      h.restart(); await h.settle();
      sameSurface(surface(h.rig()), running, `${role}, progress=${progress}, retreat=${retreat}`);
      for (let frame = 0; frame < 5; frame++) h.render(.016, 0);
      sameSurface(surface(h.rig()), running, 'paused cold model');
    }
  });
});

test('a late-loading stationary listener has the saved turn, keeps weapons lowered and resumes ordinary animation on exit', async t => {
  const h = await fixture(t, 'morpheus', true); h.snapshot(400, true, 0, true); h.render(.016, 0);
  await h.settle(); const before = surface(h.rig());
  assert.equal(h.rig().root.rotation.y, -1.2); assert.equal(h.rig().motion.speed, 0);
  for (let frame = 0; frame < 12; frame++) h.render(.016, 1);
  sameSurface(surface(h.rig()), before, 'stationary saved listener');
  for (const gun of h.rig().weapons!) {
    const barrel = new THREE.Vector3(0, -1, 0).applyQuaternion(gun.getWorldQuaternion(new THREE.Quaternion()));
    assert.ok(barrel.y < -.45, 'the retreat carries loaded guns toward the floor');
  }
  h.actor.currentAction = null; h.actor.velocity = { x: 3, y: 0, z: 0 }; h.renderer.updateAgent('morpheus', h.actor);
  const phase = h.rig().motion.phase; for (let frame = 0; frame < 5; frame++) h.render(.1, 1);
  assert.ok(h.rig().motion.phase > phase, 'leaving the guide must release its saved pose');
});


test('distance-driven turns keep actual shoes supported at both stair flights and retreat landings', async t => {
  const h = await fixture(t, 'morpheus'); h.snapshot(26); h.render(); await h.settle();
  const center = FILM_SETS.film_ambush_house.center, point = new THREE.Vector3();
  for (const [begin, end, retreat] of [[26, 31, false], [38, 44, false], [53, 58, false], [55, 61, true], [121, 127, true]] as const) {
    for (let progress = begin; progress <= end; progress += .2) {
      h.snapshot(progress, retreat); for (let frame = 0; frame < 5; frame++) h.render(.1, 1);
      const rig = h.rig(), shoe = rig.hero!.root.getObjectByName('shoes01') as THREE.SkinnedMesh;
      const rootY = h.renderer.getAgent('morpheus')!.position.y - center.y;
      let closest = Infinity;
      for (let v = 0; v < shoe.geometry.attributes.position.count; v++) {
        shoe.getVertexPosition(v, point); shoe.localToWorld(point);
        const floor = ambushFloor(point.x - center.x, point.z - center.z, rootY);
        if (floor === undefined) continue;
        closest = Math.min(closest, point.y - (center.y - 1 + floor));
      }
      assert.ok(closest >= -.025 && closest < .16, `turn progress=${progress}, retreat=${retreat}, actual shoe-floor gap=${closest}`);
    }
  }
});

test('a stopped network snapshot finishes the visible stair step before settling into the saved idle pose', async t => {
  const h = await fixture(t, 'morpheus'); h.snapshot(27.7); h.render(); await h.settle();
  const before = h.renderer.getAgent('morpheus')!.position.clone();
  h.snapshot(29.8, false, 0); h.render(.1, 1);
  assert.ok(h.renderer.getAgent('morpheus')!.position.distanceTo(before) > .3, 'the final network interval still moves the body');
  assert.ok(h.rig().motion.speed > 1, 'a moving final interval must not slide with the already-stationary server pose');
  const paused = surface(h.rig()); for (let frame = 0; frame < 5; frame++) h.render(.016, 0);
  sameSurface(surface(h.rig()), paused, 'paused incomplete interpolation');
  for (let frame = 0; frame < 4; frame++) h.render(.1, 1);
  assert.equal(h.rig().motion.speed, 0, 'finishing the interval restores the saved stop');
  const stopped = surface(h.rig()); h.restart(); await h.settle();
  sameSurface(surface(h.rig()), stopped, 'cold saved stop');
});
