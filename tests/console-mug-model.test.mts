import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { FILM_SETS, CONSOLE_DRINK, type InterludeGesture } from '@auto_matrix/shared';
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
  const rig = models.create(world.agents.get('neo')!); await Promise.all(pending); await new Promise(resolve => setImmediate(resolve));
  const center = FILM_SETS.film_neb_deck.center, deck = new THREE.Group(); deck.position.set(center.x, center.y - 1, center.z);
  const neb = new NebDeckRenderer(deck); rig.root.position.set(center.x + 3.4, center.y - 1, center.z + 7.2); rig.root.rotation.y = Math.PI / 2;
  const draw = (phase: InterludeGesture['phase'], elapsed: number, firstPerson = false) => {
    const interlude: InterludeGesture = { kind: 'console', phase, elapsed, role: 'neo', physicalConsole: true };
    models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, glasses: false, firstPerson, nebCrew: 'neo', nebCrewEarly: true, interlude }, 4);
    neb.update({ version: 1, scene: 'm1_cypher_console', actor: 'neo', step: 0, completed: [], enteredAt: 0,
      checkpoint: world.agents.get('neo')!.position, reflections: {}, lastText: '', interlude }, elapsed);
    rig.root.updateMatrixWorld(true); deck.updateMatrixWorld(true);
  };
  t.after(() => { models.dispose(); neb.dispose(); globalThis.document = previous; });
  const settle = async () => { await Promise.all(pending); await new Promise(resolve => setImmediate(resolve)); };
  return { rig, models, world, neb, deck, draw, settle };
}

test('Neo holds an opaque, hollow metal mug with a handle, with one owner at handoff and return', async t => {
  const h = await fixture(t); h.draw('accept_ready', 0);
  const cup = h.rig.root.getObjectByName('console-held-mug')!; assert.ok(cup, 'the mug must belong to the actual player hand');
  const tableCup = h.deck.getObjectByName('neb-neo-metal-mug')!; assert.ok(tableCup);
  for (const [phase, elapsed, held] of [['accepting', .89, false], ['accepting', .9, true], ['sip_ready', 0, true],
    ['sipping', 1.8, true], ['returning', 2.39, true], ['returning', 2.4, false], ['choice', 0, false]] as const) {
    h.draw(phase, elapsed); assert.equal(cup.visible, held); assert.equal(tableCup.visible, !held);
  }
  const body = cup.getObjectByName('console-mug-shell') as THREE.Mesh;
  assert.ok(body); assert.ok(cup.getObjectByName('console-mug-handle'));
  const material = body.material as THREE.MeshStandardMaterial;
  assert.equal(material.transparent, false); assert.ok(material.metalness > .7);
  h.draw('accepting', CONSOLE_DRINK.transfer);
  assert.ok(cup.getWorldPosition(new THREE.Vector3()).distanceTo(tableCup.getWorldPosition(new THREE.Vector3())) < .003, `pickup cannot jump: held ${cup.getWorldPosition(new THREE.Vector3()).toArray()}, table ${tableCup.getWorldPosition(new THREE.Vector3()).toArray()}, root ${h.rig.root.position.toArray()}`);
  h.draw('returning', CONSOLE_DRINK.release - .001);
  assert.ok(cup.getWorldPosition(new THREE.Vector3()).distanceTo(tableCup.getWorldPosition(new THREE.Vector3())) < .003, 'release cannot teleport the mug');
});

test('the tilted rim reaches Neo’s actual face surface while the liquid remains level', async t => {
  const h = await fixture(t); h.draw('sipping', 1.8);
  const cup = h.rig.root.getObjectByName('console-held-mug')!; assert.ok(cup);
  const rim = cup.localToWorld(new THREE.Vector3(0, CONSOLE_DRINK.height / 2, -CONSOLE_DRINK.radius));
  const skin = h.rig.hero!.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  const head = h.rig.hero!.bones.get('head')!, direction = new THREE.Vector3(0, 0, -1).transformDirection(head.matrixWorld);
  const hits = new THREE.Raycaster(rim.clone().addScaledVector(direction, -.06), direction, 0, .12).intersectObject(skin);
  assert.ok(hits.some(hit => hit.point.distanceTo(rim) < .025), `rim contact must be on the face: rim ${rim.toArray()}, head ${head.getWorldPosition(new THREE.Vector3()).toArray()}, wrist ${h.rig.hero!.bones.get('wrist_R')!.getWorldPosition(new THREE.Vector3()).toArray()}, hits ${hits.map(hit => hit.point.distanceTo(rim))}`);
  const liquid = cup.getObjectByName('console-mug-liquid')!;
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(liquid.getWorldQuaternion(new THREE.Quaternion()));
  assert.ok(up.dot(new THREE.Vector3(0, 1, 0)) > .999, 'the drink surface stays horizontal while the cup tilts');
});

test('the full hand stays outside the mug wall and five finger pads stay near it', async t => {
  const h = await fixture(t);
  const skin = h.rig.hero!.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  const attrs = skin.geometry.attributes;
  const samples = (['accepting', 'sipping', 'returning'] as const).flatMap(phase =>
    Array.from({ length: (phase === 'accepting' ? 22 : phase === 'sipping' ? 48 : 38) + 1 }, (_, i) => [phase, i / 10] as const));
  for (const [phase, elapsed] of samples) {
    h.draw(phase, elapsed); const held = h.rig.root.getObjectByName('console-held-mug')!;
    const cup = held.visible ? held : h.deck.getObjectByName('neb-neo-metal-mug')!;
    const nearest = [Infinity, Infinity, Infinity, Infinity, Infinity]; let inside = 0;
    for (let vertex = 0; vertex < attrs.position.count; vertex++) {
      const names = [0, 1, 2, 3].filter(j => attrs.skinWeight.getComponent(vertex, j) > .2).map(j => skin.skeleton.bones[attrs.skinIndex.getComponent(vertex, j)].name);
      if (!names.some(name => /^(finger[1-5]-[1-3]|wrist)_R$/.test(name))) continue;
      const p = cup.worldToLocal(skin.localToWorld(skin.getVertexPosition(vertex, new THREE.Vector3())));
      if (Math.abs(p.y) >= CONSOLE_DRINK.height / 2 - .025) continue;
      const radius = Math.hypot(p.x, p.z), distance = radius - CONSOLE_DRINK.radius;
      inside = Math.min(inside, distance);
      for (const name of names) { const digit = /^finger([1-5])-3_R$/.exec(name); if (digit) nearest[Number(digit[1]) - 1] = Math.min(nearest[Number(digit[1]) - 1], Math.abs(distance)); }
    }
    assert.ok(inside >= -.012, `hand penetrates the steel wall ${inside} at ${phase}/${elapsed}`);
    if (held.visible) assert.ok(nearest.every(distance => distance < .035), `five pads must contact the wall at ${phase}/${elapsed}: ${nearest}`);
    const wrist = h.rig.hero!.bones.get('wrist_R')!, elbow = h.rig.hero!.bones.get('elbow_R')!;
    const axis = wrist.getWorldPosition(new THREE.Vector3()).sub(elbow.getWorldPosition(new THREE.Vector3())).normalize();
    const angle = axis.angleTo(new THREE.Vector3(0, -1, 0).transformDirection(wrist.matrixWorld));
    assert.ok(angle < 1.2, `wrist folds ${angle * 180 / Math.PI} degrees at ${phase}/${elapsed}`);
  }
});

test('first person keeps the held mug and rendered fingers while hiding the player’s face', async t => {
  const h = await fixture(t); h.draw('sipping', 1.8, true);
  const skin = h.rig.hero!.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  const indices = new Set(Array.from(skin.geometry.index!.array)), attrs = skin.geometry.attributes;
  const head = skin.skeleton.bones.indexOf(h.rig.hero!.bones.get('head')!);
  let face = 0, fingers = 0;
  for (const v of indices) {
    const point = new THREE.Vector3().fromBufferAttribute(attrs.position, v).applyMatrix4(skin.bindMatrix).applyMatrix4(skin.skeleton.boneInverses[head]);
    const weights = [0, 1, 2, 3].filter(j => attrs.skinWeight.getComponent(v, j) > .9).map(j => skin.skeleton.bones[attrs.skinIndex.getComponent(v, j)].name);
    if (weights.includes('head') && point.y > -.25) face++;
    if (weights.some(name => /^finger[1-5]-[1-3]_R$/.test(name))) fingers++;
  }
  assert.equal(face, 0, 'face triangles cannot wrap around the camera while Neo drinks');
  assert.ok(fingers > 1000, 'the hand geometry must stay in the indexed first-person draw');
  const mugs: THREE.Object3D[] = []; h.rig.root.traverseVisible(object => { if (object.name === 'console-held-mug') mugs.push(object); });
  assert.equal(mugs.length, 1);
});

test('a new model restores saved mug ownership and contact after the world has moved', async t => {
  const h = await fixture(t);
  for (const [phase, elapsed] of [['accepting', 1.2], ['sipping', 1.8], ['returning', 2.399]] as const) {
    h.draw(phase, elapsed);
    const fresh = h.models.create(h.world.agents.get('neo')!); await h.settle(); assert.ok(fresh.hero);
    fresh.root.position.copy(h.rig.root.position); fresh.root.rotation.copy(h.rig.root.rotation);
    h.models.animate(fresh, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, glasses: false,
      nebCrew: 'neo', nebCrewEarly: true, interlude: { kind: 'console', phase, elapsed, physicalConsole: true, role: 'neo' } }, 4);
    fresh.root.updateMatrixWorld(true);
    const a = h.rig.root.getObjectByName('console-held-mug')!, b = fresh.root.getObjectByName('console-held-mug')!;
    assert.equal(b.visible, a.visible); assert.ok(a.getWorldPosition(new THREE.Vector3()).distanceTo(b.getWorldPosition(new THREE.Vector3())) < 1e-5);
    for (let finger = 1; finger <= 5; finger++) for (let joint = 1; joint <= 3; joint++) {
      const name = `finger${finger}-${joint}_R`;
      assert.ok(h.rig.hero!.bones.get(name)!.getWorldPosition(new THREE.Vector3()).distanceTo(fresh.hero!.bones.get(name)!.getWorldPosition(new THREE.Vector3())) < 1e-5);
    }
  }
});
