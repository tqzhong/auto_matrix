import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { FILM_SETS, interludeRoot, type InterludeGesture } from '@auto_matrix/shared';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { CypherRestaurantRenderer } from '../packages/client/src/engine/CypherRestaurantRenderer.js';

async function fixture(t: TestContext) {
  const pending: Promise<unknown>[] = [], assets = new Map<string, Promise<any>>();
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async url => {
    const name = String(url).split('/').pop()!;
    if (!assets.has(name)) assets.set(name, (async () => {
      const raw = await readFile(new URL(`../packages/client/public/assets/characters/${name}`, import.meta.url)), length = raw.readUInt32LE(12);
      const doc = JSON.parse(raw.subarray(20, 20 + length).toString());
      for (const material of doc.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
      doc.images = []; doc.textures = [];
      const json = Buffer.from(JSON.stringify(doc)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
      const bin = raw.subarray(20 + length), data = Buffer.alloc(20 + padded.length + bin.length);
      data.writeUInt32LE(0x46546c67); data.writeUInt32LE(2, 4); data.writeUInt32LE(data.length, 8);
      data.writeUInt32LE(padded.length, 12); data.writeUInt32LE(0x4e4f534a, 16); padded.copy(data, 20); bin.copy(data, 20 + padded.length);
      return new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '');
    })());
    const promise = assets.get(name)!; pending.push(promise); const asset = await promise; return { ...asset, scene: clone(asset.scene) };
  });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData() {}, fillRect() {}, fillText() {}, strokeRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  const rig = models.create(world.agents.get('cypher')!); await Promise.all(pending); await new Promise(resolve => setImmediate(resolve));
  const center = FILM_SETS.film_cypher_restaurant.center, deck = new THREE.Group(); deck.position.set(center.x, center.y - 1, center.z);
  const neb = new CypherRestaurantRenderer(deck);
  const draw = (phase: InterludeGesture['phase'], elapsed: number, firstPerson = false, target = rig) => {
    const interlude: InterludeGesture = { kind: 'steak', phase, elapsed, role: 'cypher', physicalSteak: true };
    const at = interludeRoot('steak', 'cypher', interlude); target.root.position.set(center.x + at.x, center.y - 1, center.z + at.z); target.root.rotation.y = at.yaw;
    models.animate(target, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: false, glasses: false, firstPerson, interlude }, 4);
    neb.update({ version: 1, scene: 'm1_steak', actor: 'smith', step: 0, completed: [], enteredAt: 0,
      checkpoint: world.agents.get('cypher')!.position, reflections: {}, lastText: '', interlude }, elapsed, id => id === 'cypher' ? target.root : undefined);
    target.root.updateMatrixWorld(true); deck.updateMatrixWorld(true);
  };
  t.after(() => { models.dispose(); neb.dispose(); globalThis.document = previous; });
  const settle = async () => { await Promise.all(pending); await new Promise(resolve => setImmediate(resolve)); };
  draw('ready', 0); await settle(); draw('ready', 0);
  return { rig, models, world, neb, deck, draw, settle };
}

function lip(rig: ReturnType<CharacterModels['create']>): THREE.Vector3 {
  const face = rig.root.getObjectByName('cypher-anatomical-head') as THREE.SkinnedMesh, a = face.geometry.attributes, p = new THREE.Vector3(); let n = 0;
  for (let v = 0; v < a.position.count; v++) {
    if (Math.abs(a._head_rest.getX(v)) > .015 || a._head_rest.getY(v) < -.211 || a._head_rest.getY(v) > -.193 || a._head_rest.getZ(v) < .23) continue;
    p.add(face.localToWorld(face.getVertexPosition(v, new THREE.Vector3()))); n++;
  }
  assert.ok(n > 0); return p.divideScalar(n);
}

test('restaurant props and seating use the anatomical actor scale', async t => {
  const h = await fixture(t);
  const plate = new THREE.Box3().setFromObject(h.deck.getObjectByName('cypher-steak-plate')!).getSize(new THREE.Vector3());
  assert.ok(plate.x < 1.1 && plate.x > .7, `the plate cannot span the actor torso: ${plate.x}`);
  const smith = interludeRoot('steak', 'smith'), cypher = interludeRoot('steak', 'cypher');
  assert.ok(Math.abs(smith.z - cypher.z) < 4.5, 'diners must share a human-scale table');
});

test('the plate, glass base and cutlery handles rest on the delivered table surface', async t => {
  const h = await fixture(t), table = h.deck.getObjectByName('cypher-window-table')!;
  const targets = [h.deck.getObjectByName('cypher-steak-plate')!, h.deck.getObjectByName('cypher-wine-glass')!.getObjectByName('steak-wine-base')!,
    ...['cypher-steak-fork', 'cypher-steak-knife'].map(name => h.deck.getObjectByName(name)!.getObjectByName('steak-cutlery-handle')!)];
  for (const prop of targets) {
    const bottom = new THREE.Box3().setFromObject(prop).min.y, at = prop.getWorldPosition(new THREE.Vector3()); at.y = bottom;
    const hit = new THREE.Raycaster(at.clone().add(new THREE.Vector3(0, .08, 0)), new THREE.Vector3(0, -1, 0), 0, .16).intersectObject(table, true)[0];
    assert.ok(hit && Math.abs(hit.point.y - bottom) < .004, `${prop.name} must meet the cloth/runner instead of hovering or cutting through it`);
  }
});

test('Cypher holds the fork in his right hand and the food reaches his actual lip', async t => {
  const h = await fixture(t); h.draw('performing', 8.05);
  const fork = h.rig.root.getObjectByName('cypher-held-fork'); assert.ok(fork?.visible, 'the fork needs an anatomical hand owner');
  assert.ok(fork.parent === h.rig.hero!.bones.get('wrist_R'));
  const food = fork.getObjectByName('cypher-held-bite')!; assert.ok(food?.visible);
  const mouth = lip(h.rig), forward = new THREE.Vector3(0, 0, 1).transformDirection(h.rig.hero!.bones.get('head')!.matrixWorld);
  let nearest = Infinity;
  const geometry = (food as THREE.Mesh).geometry;
  for (let v = 0; v < geometry.attributes.position.count; v++) {
    const p = food.localToWorld(new THREE.Vector3().fromBufferAttribute(geometry.attributes.position, v)); nearest = Math.min(nearest, p.distanceTo(mouth));
    assert.ok(p.clone().sub(mouth).dot(forward) > -.015, 'placing the food centre on a closed lip pushes half the bite through the face');
  }
  assert.ok(nearest < .035, 'the food surface must meet the delivered lip');
  assert.equal(h.deck.getObjectByName('cypher-steak-fork')!.visible, false);
  assert.equal(h.deck.getObjectByName('cypher-steak-cut-piece')!.visible, false);
  h.draw('performing', 9.2); assert.equal(food.visible, false, 'the consumed bite cannot grow back when the fork returns');
  h.draw('performing', 3.5);
  const knife = h.rig.root.getObjectByName('cypher-held-knife'); assert.ok(knife?.visible); assert.ok(knife.parent === h.rig.hero!.bones.get('wrist_L'));
});

test('Cypher drinks from a transparent stemmed glass in his left hand', async t => {
  const h = await fixture(t); h.draw('performing', 20);
  const glass = h.rig.root.getObjectByName('cypher-held-wine'); assert.ok(glass?.visible, 'the wine must have an anatomical left-hand owner');
  assert.ok(glass.parent === h.rig.hero!.bones.get('wrist_L'));
  const rim = glass.getObjectByName('steak-wine-rim-contact')!.getWorldPosition(new THREE.Vector3());
  assert.ok(rim.distanceTo(lip(h.rig)) < .035, 'the rim must meet the actual lip');
  assert.equal(h.deck.getObjectByName('cypher-wine-glass')!.visible, false);
});

test('saved dining poses rebuild identically after other gestures and retain one prop owner', async t => {
  const h = await fixture(t), snapshot = () => ['cypher-held-fork', 'cypher-held-knife', 'cypher-held-wine'].map(name => {
    const p = h.rig.root.getObjectByName(name); assert.ok(p); return { visible: p.visible, position: p.getWorldPosition(new THREE.Vector3()).toArray(), quaternion: p.getWorldQuaternion(new THREE.Quaternion()).toArray() };
  });
  for (const elapsed of [0, 3.5, 5.5, 8.05, 11.199, 14.5, 20, 24.499, 26]) {
    h.draw('performing', elapsed); const a = snapshot();
    h.draw('done', 26); h.draw('ready', 0); h.draw('performing', elapsed); const b = snapshot();
    for (let i = 0; i < a.length; i++) {
      assert.equal(b[i].visible, a[i].visible);
      assert.ok(new THREE.Vector3().fromArray(a[i].position).distanceTo(new THREE.Vector3().fromArray(b[i].position)) < 1e-6, `saved prop ${i} depends on the previous gesture at ${elapsed}`);
    }
  }
});

test('a fresh cold-loaded actor reconstructs the saved cutlery and wine in both player views', async t => {
  const h = await fixture(t);
  for (const elapsed of [3.5, 8.05, 20, 24.499]) {
    h.draw('performing', elapsed);
    const expected = ['cypher-held-fork', 'cypher-held-knife', 'cypher-held-wine'].map(name => { const p = h.rig.root.getObjectByName(name)!; return { visible: p.visible, position: p.getWorldPosition(new THREE.Vector3()) }; });
    const fresh = h.models.create(h.world.agents.get('cypher')!); await h.settle();
    h.draw('performing', elapsed, false, fresh); await h.settle(); h.draw('performing', elapsed, false, fresh);
    for (const [i, name] of ['cypher-held-fork', 'cypher-held-knife', 'cypher-held-wine'].entries()) {
      const p = fresh.root.getObjectByName(name)!; assert.equal(p.visible, expected[i].visible);
      if (p.visible) assert.ok(p.getWorldPosition(new THREE.Vector3()).distanceTo(expected[i].position) < 1e-6, `cold ${name} jumps at ${elapsed}`);
    }
    h.draw('performing', elapsed, true, fresh);
    assert.equal(fresh.root.getObjectByName('cypher-detailed-head')!.visible, false);
    for (const [i, name] of ['cypher-held-fork', 'cypher-held-knife', 'cypher-held-wine'].entries()) {
      const p = fresh.root.getObjectByName(name)!; assert.equal(p.visible, expected[i].visible);
      if (p.visible) assert.ok(p.getWorldPosition(new THREE.Vector3()).distanceTo(expected[i].position) < 1e-6, `V moves ${name} at ${elapsed}`);
    }
  }
});

test('the anatomical fingers contact slender handles without entering them or folding the wrist', async t => {
  const h = await fixture(t), skin = h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh, a = skin.geometry.attributes;
  const hands = new Map<'R' | 'L', { v: number; digit?: number }[]>();
  for (const side of ['R', 'L'] as const) {
    const vertices: { v: number; digit?: number }[] = [];
    for (let v = 0; v < a.position.count; v++) {
      const names = [0, 1, 2, 3].filter(j => a.skinWeight.getComponent(v, j) > .2).map(j => skin.skeleton.bones[a.skinIndex.getComponent(v, j)].name);
      if (!names.some(name => new RegExp(`^(wrist|finger[1-5]-[1-3])_${side}$`).test(name))) continue;
      const distal = names.map(name => new RegExp(`^finger([1-5])-3_${side}$`).exec(name)).find(Boolean);
      vertices.push({ v, digit: distal ? Number(distal[1]) : undefined });
    }
    hands.set(side, vertices);
  }
  let worst = 0, largestBend = 0;
  for (let sample = 0; sample <= 104; sample++) {
    const elapsed = sample / 4; h.draw('performing', elapsed);
    for (const [name, side, wine] of [['cypher-held-fork', 'R', false], ['cypher-held-knife', 'L', false], ['cypher-held-wine', 'L', true]] as const) {
      const prop = h.rig.root.getObjectByName(name)!; if (!prop.visible) continue;
      const nearest = Array(5).fill(Infinity);
      for (const { v, digit } of hands.get(side)!) {
        const p = prop.worldToLocal(skin.localToWorld(skin.getVertexPosition(v, new THREE.Vector3()))), lo = wine ? .025 : -.17, hi = wine ? .325 : .17;
        const radial = Math.hypot(p.x, p.z) - (wine ? .014 : .028);
        const axial = Math.max(lo - p.y, p.y - hi), distance = Math.max(radial, axial);
        worst = Math.min(worst, distance);
        assert.ok(distance > -.012, `${name} penetrates the hand at ${elapsed}: ${distance}, ${p.toArray()}`);
        if (digit) nearest[digit - 1] = Math.min(nearest[digit - 1], Math.abs(distance));
      }
      assert.ok(nearest.every(gap => gap < .04), `${name} fingers float at ${elapsed}: ${nearest}`);
      const wrist = h.rig.hero!.bones.get(`wrist_${side}`)!, elbow = h.rig.hero!.bones.get(`elbow_${side}`)!;
      const angle = wrist.getWorldPosition(new THREE.Vector3()).sub(elbow.getWorldPosition(new THREE.Vector3())).angleTo(new THREE.Vector3(0, -1, 0).transformDirection(wrist.matrixWorld));
      largestBend = Math.max(largestBend, angle); assert.ok(angle < .85, `${name} wrist bends ${angle * 180 / Math.PI} degrees at ${elapsed}`);
    }
  }
  console.log({ finiteHandleSamples: 105, worst, largestBendDegrees: largestBend * 180 / Math.PI });
});

test('setting down cutlery and lifting wine transfer one prop at the same physical position', async t => {
  const h = await fixture(t);
  for (const [heldName, worldName, elapsed] of [['cypher-held-fork', 'cypher-steak-fork', 11.1999], ['cypher-held-knife', 'cypher-steak-knife', 4.7999],
    ['cypher-held-wine', 'cypher-wine-glass', 14.5], ['cypher-held-wine', 'cypher-wine-glass', 24.4999]] as const) {
    h.draw('performing', elapsed);
    const held = h.rig.root.getObjectByName(heldName)!, world = h.deck.getObjectByName(worldName)!;
    assert.equal(held.visible, true); assert.equal(world.visible, false);
    assert.ok(held.getWorldPosition(new THREE.Vector3()).distanceTo(world.getWorldPosition(new THREE.Vector3())) < .004, `${heldName} jumps at transfer ${elapsed}`);
    assert.ok(held.getWorldQuaternion(new THREE.Quaternion()).angleTo(world.getWorldQuaternion(new THREE.Quaternion())) < .006, `${heldName} rotates at transfer ${elapsed}`);
  }
});

test('the left hand stays outside the wine bowl and knife blade during approach and withdrawal', async t => {
  const h = await fixture(t), skin = h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh, a = skin.geometry.attributes;
  const vertices: number[] = [];
  for (let v = 0; v < a.position.count; v++) if ([0, 1, 2, 3].some(j => a.skinWeight.getComponent(v, j) > .2 && /^(wrist|finger[1-5]-[1-3])_L$/.test(skin.skeleton.bones[a.skinIndex.getComponent(v, j)].name))) vertices.push(v);
  for (let sample = 0; sample <= 104; sample++) {
    const elapsed = sample / 4; h.draw('performing', elapsed);
    const heldWine = h.rig.root.getObjectByName('cypher-held-wine')!, wine = heldWine.visible ? heldWine : h.deck.getObjectByName('cypher-wine-glass')!;
    const heldKnife = h.rig.root.getObjectByName('cypher-held-knife')!, knife = heldKnife.visible ? heldKnife : h.deck.getObjectByName('cypher-steak-knife')!;
    for (const v of vertices) {
      const world = skin.localToWorld(skin.getVertexPosition(v, new THREE.Vector3())), p = wine.worldToLocal(world.clone());
      const radius = p.y < .43 ? THREE.MathUtils.lerp(.1, .17, (p.y - .35) / .08) : p.y < .52 ? THREE.MathUtils.lerp(.17, .19, (p.y - .43) / .09) : THREE.MathUtils.lerp(.19, .18, (p.y - .52) / .13);
      assert.ok(!(p.y > .36 && p.y < .65 && Math.hypot(p.x, p.z) < radius - .012), `left hand enters the wine bowl at ${elapsed}: ${p.toArray()}`);
      const blade = knife.worldToLocal(world);
      assert.ok(!(blade.y > .20 && blade.y < .64 && blade.x > -.020 && blade.x < .037 && Math.abs(blade.z) < .004), `left hand enters the knife blade at ${elapsed}: ${blade.toArray()}, vertex ${v}`);
    }
  }
});
