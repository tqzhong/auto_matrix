import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { FILM_SETS, CONSOLE_DRINK, interludeRoot, type InterludeGesture } from '@auto_matrix/shared';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { NebDeckRenderer } from '../packages/client/src/engine/NebDeckRenderer.js';

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
  const center = FILM_SETS.film_neb_deck.center, deck = new THREE.Group(); deck.position.set(center.x, center.y - 1, center.z);
  const neb = new NebDeckRenderer(deck); rig.root.position.set(center.x + 3.4, center.y - 1, center.z + 7.2); rig.root.rotation.y = Math.PI / 2;
  const draw = (phase: InterludeGesture['phase'], elapsed: number, firstPerson = false) => {
    const interlude: InterludeGesture = { kind: 'console', phase, elapsed, role: 'cypher', physicalConsole: true, physicalPour: true };
    const at = interludeRoot('console', 'cypher', interlude); rig.root.position.set(center.x + at.x, center.y - 1, center.z + at.z); rig.root.rotation.y = at.yaw;
    models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, glasses: false, firstPerson, interlude }, 4);
    neb.update({ version: 1, scene: 'm1_cypher_console', actor: 'neo', step: 0, completed: [], enteredAt: 0,
      checkpoint: world.agents.get('cypher')!.position, reflections: {}, lastText: '', interlude }, elapsed, undefined, id => id === 'cypher' ? rig.root : undefined);
    rig.root.updateMatrixWorld(true); deck.updateMatrixWorld(true);
  };
  t.after(() => { models.dispose(); neb.dispose(); globalThis.document = previous; });
  const settle = async () => { await Promise.all(pending); await new Promise(resolve => setImmediate(resolve)); };
  draw('ready', 0); await settle(); draw('ready', 0);
  return { rig, models, world, neb, deck, draw, settle };
}

test('the plastic jug has one owner and its actual spout pours into Neo’s separate mug', async t => {
  const h = await fixture(t), table = h.deck.getObjectByName('neb-cypher-liquor-bottle')!;
  const held = h.rig.root.getObjectByName('cypher-held-jug')!; assert.ok(held);
  assert.ok(held.getObjectByName('console-jug-handle'));
  const material = (held.getObjectByName('console-jug-body') as THREE.Mesh).material as THREE.MeshStandardMaterial;
  assert.ok(material.metalness < .1 && material.roughness > .4, 'use a plastic handled jug rather than the old glass bottle');
  for (const [elapsed, holding] of [[3.299, false], [3.3, true], [6, true], [8.599, true], [8.6, false]] as const) {
    h.draw('performing', elapsed); assert.equal(held.visible, holding); assert.equal(table.visible, !holding);
    if (elapsed === 3.3 || elapsed === 8.599) assert.ok(held.getWorldPosition(new THREE.Vector3()).distanceTo(table.getWorldPosition(new THREE.Vector3())) < .004, `jug ownership jumps at ${elapsed}: ${held.getWorldPosition(new THREE.Vector3()).toArray()} / ${table.getWorldPosition(new THREE.Vector3()).toArray()}, scale ${h.rig.hero!.bones.get('wrist_L')!.getWorldScale(new THREE.Vector3()).toArray()}`);
  }
  h.draw('ready', 0); const cup = h.deck.getObjectByName('neb-neo-metal-mug')!, liquid = cup.getObjectByName('console-mug-liquid')!;
  const empty = liquid.position.y; h.draw('performing', 6);
  const spout = held.getObjectByName('console-jug-spout')!.getWorldPosition(new THREE.Vector3()), rim = cup.localToWorld(new THREE.Vector3(0, CONSOLE_DRINK.height / 2, 0));
  assert.ok(Math.hypot(spout.x - rim.x, spout.z - rim.z) < .025, `the spout misses the cup: ${spout.toArray()} / ${rim.toArray()}`);
  assert.ok(spout.y > rim.y + .1 && spout.y < rim.y + .6);
  const stream = h.deck.getObjectByName('neb-cypher-pouring-stream')!; assert.equal(stream.visible, true);
  assert.ok(stream.localToWorld(new THREE.Vector3(0, .5, 0)).distanceTo(spout) < .002);
  assert.ok(stream.localToWorld(new THREE.Vector3(0, -.5, 0)).distanceTo(liquid.getWorldPosition(new THREE.Vector3())) < .002);
  const materials = new Set<THREE.Material>(); held.traverse(object => { if (object instanceof THREE.Mesh) materials.add(object.material as THREE.Material); });
  const sides = [...materials].map(material => material.side); materials.forEach(material => { material.side = THREE.DoubleSide; });
  const down = new THREE.Vector3(0, -1, 0), collisions = new THREE.Raycaster(spout.clone().addScaledVector(down, .02), down, 0, spout.y - liquid.getWorldPosition(new THREE.Vector3()).y - .02).intersectObject(held, true);
  [...materials].forEach((material, i) => { material.side = sides[i]; });
  assert.equal(collisions.length, 0, 'the poured stream cannot pass through the jug neck or body');
  assert.ok(liquid.position.y > empty); h.draw('accept_ready', 0); assert.equal(stream.visible, false); assert.ok(liquid.position.y > empty + .15);
});

test('the jug handle stays outside all five fingers and the wrist keeps a natural bend', async t => {
  const h = await fixture(t), skin = h.rig.hero!.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh, attrs = skin.geometry.attributes;
  const held = h.rig.root.getObjectByName('cypher-held-jug')!, handle = held.getObjectByName('console-jug-handle') as THREE.Mesh<THREE.TubeGeometry>;
  const path = handle.geometry.parameters.path, points = Array.from({ length: 97 }, (_, i) => path.getPointAt(i / 96));
  for (let sample = 46; sample <= 192; sample++) {
    const elapsed = sample / 20; h.draw('performing', elapsed);
    const jug = held.visible ? held : h.deck.getObjectByName('neb-cypher-liquor-bottle')!, nearest = Array(5).fill(Infinity); let inside = 0, worst = '';
    for (let v = 0; v < attrs.position.count; v++) {
      const names = [0, 1, 2, 3].filter(j => attrs.skinWeight.getComponent(v, j) > .2).map(j => skin.skeleton.bones[attrs.skinIndex.getComponent(v, j)].name);
      if (!names.some(name => /^(wrist|finger[1-5]-[1-3])_L$/.test(name))) continue;
      const p = jug.worldToLocal(skin.localToWorld(skin.getVertexPosition(v, new THREE.Vector3())));
      assert.ok(!(p.x > -.29 && p.x < .29 && p.y > .02 && p.y < .8 && Math.abs(p.z) < .22), `hand enters the jug body at ${elapsed}`);
      let radius = Infinity;
      for (let segment = 0; segment < points.length - 1; segment++) {
        const direction = points[segment + 1].clone().sub(points[segment]);
        const amount = THREE.MathUtils.clamp(p.clone().sub(points[segment]).dot(direction) / direction.lengthSq(), 0, 1);
        radius = Math.min(radius, p.distanceTo(points[segment].clone().addScaledVector(direction, amount)));
      }
      const distance = radius - handle.geometry.parameters.radius;
      if (distance < inside) { inside = distance; worst = `${names} / ${p.toArray()} / vertex ${v}`; }
      for (const name of names) { const digit = /^finger([1-5])-3_L$/.exec(name); if (digit) nearest[Number(digit[1]) - 1] = Math.min(nearest[Number(digit[1]) - 1], Math.abs(distance)); }
    }
    assert.ok(inside >= -.012, `hand enters the jug handle by ${inside} at ${elapsed}: ${worst}`);
    if (held.visible) assert.ok(nearest.every(gap => gap < .035), `five pads miss the jug handle at ${elapsed}: ${nearest}`);
    const wrist = h.rig.hero!.bones.get('wrist_L')!, elbow = h.rig.hero!.bones.get('elbow_L')!;
    const forearm = wrist.getWorldPosition(new THREE.Vector3()).sub(elbow.getWorldPosition(new THREE.Vector3())).normalize();
    const angle = forearm.angleTo(new THREE.Vector3(0, -1, 0).transformDirection(wrist.matrixWorld));
    assert.ok(angle < 1.3, `the pouring wrist folds ${angle * 180 / Math.PI} degrees at ${elapsed}`);
  }
});

test('Cypher drinks from his own mug at his actual new face and never takes Neo’s cup', async t => {
  const h = await fixture(t);
  for (const [phase, elapsed] of [['ready', 0], ['performing', 1.4], ['choice', 0]] as const) {
    h.draw(phase, elapsed);
    const base = h.deck.getObjectByName('neb-cypher-metal-mug')!.localToWorld(new THREE.Vector3(0, -CONSOLE_DRINK.height / 2, 0));
    const tray = h.deck.getObjectByName('neb-cypher-cup-tray')!;
    const hit = new THREE.Raycaster(base.clone().add(new THREE.Vector3(0, .1, 0)), new THREE.Vector3(0, -1, 0), 0, .2).intersectObject(tray)[0];
    assert.ok(hit && hit.point.distanceTo(base) < .002, 'the cup must stay supported as the chair turns');
  }
  h.draw('responding', 4);
  const held = h.rig.root.getObjectByName('cypher-held-mug')!, table = h.deck.getObjectByName('neb-cypher-metal-mug')!;
  assert.equal(held.visible, true); assert.equal(table.visible, false); assert.equal(h.deck.getObjectByName('neb-neo-metal-mug')!.visible, true);
  const rim = held.localToWorld(new THREE.Vector3(0, CONSOLE_DRINK.height / 2, -CONSOLE_DRINK.radius));
  const head = h.rig.hero!.bones.get('head')!, face = h.rig.root.getObjectByName('cypher-anatomical-head')!;
  const direction = new THREE.Vector3(0, 0, -1).transformDirection(head.matrixWorld);
  const hits = new THREE.Raycaster(rim.clone().addScaledVector(direction, -.06), direction, 0, .12).intersectObject(face);
  assert.ok(hits.some(hit => hit.point.distanceTo(rim) < .025), 'the rim must meet Cypher’s delivered face rather than the borrowed Choi head');
  const liquid = held.getObjectByName('console-mug-liquid')!;
  assert.ok(new THREE.Vector3(0, 1, 0).applyQuaternion(liquid.getWorldQuaternion(new THREE.Quaternion())).y > .999, 'the drink surface stays level while Cypher tilts his mug');
  for (const elapsed of [.9, 9.399]) {
    h.draw('responding', elapsed); assert.ok(held.getWorldPosition(new THREE.Vector3()).distanceTo(table.getWorldPosition(new THREE.Vector3())) < .004, `own mug jumps at ${elapsed}: ${held.getWorldPosition(new THREE.Vector3()).toArray()} / ${table.getWorldPosition(new THREE.Vector3()).toArray()}, shoulder ${h.rig.hero!.bones.get('shoulder_R')!.getWorldPosition(new THREE.Vector3()).toArray()}, wrist ${h.rig.hero!.bones.get('wrist_R')!.getWorldPosition(new THREE.Vector3()).toArray()}, arm ${h.rig.hero!.bones.get('elbow_R')!.position.length() + h.rig.hero!.bones.get('wrist_R')!.position.length()}`);
  }
  h.draw('responding', 9.4); assert.equal(held.visible, false); assert.equal(table.visible, true);
  h.draw('responding', 4, true); assert.equal(held.visible, true); assert.equal(h.rig.root.getObjectByName('cypher-detailed-head')!.visible, false);
});

test('cold models reconstruct saved jug and own-mug contacts at the same world positions', async t => {
  const h = await fixture(t);
  for (const [phase, elapsed, name] of [['performing', 5.7, 'cypher-held-jug'], ['responding', 4, 'cypher-held-mug'], ['responding', 9.399, 'cypher-held-mug']] as const) {
    h.draw(phase, elapsed); const fresh = h.models.create(h.world.agents.get('cypher')!); await h.settle();
    fresh.root.position.copy(h.rig.root.position); fresh.root.rotation.copy(h.rig.root.rotation);
    const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, glasses: false,
      interlude: { kind: 'console' as const, phase, elapsed, role: 'cypher' as const, physicalConsole: true, physicalPour: true } };
    h.models.animate(fresh, 0, input, 4); await h.settle(); h.models.animate(fresh, 0, input, 4); fresh.root.updateMatrixWorld(true);
    const a = h.rig.root.getObjectByName(name)!, b = fresh.root.getObjectByName(name)!;
    assert.ok(a.getWorldPosition(new THREE.Vector3()).distanceTo(b.getWorldPosition(new THREE.Vector3())) < 1e-5, `${name} jumps on cold reconstruction`);
  }
});

test('Cypher’s full right hand stays outside his mug throughout taking, sipping and returning', async t => {
  const h = await fixture(t), skin = h.rig.hero!.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh, attrs = skin.geometry.attributes;
  for (let sample = 0; sample <= 108; sample++) {
    const elapsed = sample / 10; h.draw('responding', elapsed);
    const held = h.rig.root.getObjectByName('cypher-held-mug')!, cup = held.visible ? held : h.deck.getObjectByName('neb-cypher-metal-mug')!;
    const nearest = Array(5).fill(Infinity); let inside = 0, worst = '';
    for (let v = 0; v < attrs.position.count; v++) {
      const names = [0, 1, 2, 3].filter(j => attrs.skinWeight.getComponent(v, j) > .2).map(j => skin.skeleton.bones[attrs.skinIndex.getComponent(v, j)].name);
      if (!names.some(name => /^(wrist|finger[1-5]-[1-3])_R$/.test(name))) continue;
      const p = cup.worldToLocal(skin.localToWorld(skin.getVertexPosition(v, new THREE.Vector3())));
      if (Math.abs(p.y) > CONSOLE_DRINK.height / 2 - .025) continue;
      const distance = Math.hypot(p.x, p.z) - CONSOLE_DRINK.radius;
      if (distance < inside) { inside = distance; worst = `${names} / ${p.toArray()}`; }
      for (const name of names) { const digit = /^finger([1-5])-3_R$/.exec(name); if (digit) nearest[Number(digit[1]) - 1] = Math.min(nearest[Number(digit[1]) - 1], Math.abs(distance)); }
    }
    assert.ok(inside >= -.012, `hand enters own mug by ${inside} at ${elapsed}: ${worst}`);
    if (held.visible) assert.ok(nearest.every(gap => gap < .035), `five pads miss own mug at ${elapsed}: ${nearest}`);
    const wrist = h.rig.hero!.bones.get('wrist_R')!, elbow = h.rig.hero!.bones.get('elbow_R')!;
    const forearm = wrist.getWorldPosition(new THREE.Vector3()).sub(elbow.getWorldPosition(new THREE.Vector3())).normalize();
    assert.ok(forearm.angleTo(new THREE.Vector3(0, -1, 0).transformDirection(wrist.matrixWorld)) < 1.3, `right wrist overbends at ${elapsed}`);
  }
});
