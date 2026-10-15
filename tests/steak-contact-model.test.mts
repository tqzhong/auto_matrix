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
  let nearest = Infinity; const points: THREE.Vector3[] = [];
  const geometry = (food as THREE.Mesh).geometry;
  for (let v = 0; v < geometry.attributes.position.count; v++) {
    const p = food.localToWorld(new THREE.Vector3().fromBufferAttribute(geometry.attributes.position, v)); points.push(p);
    assert.ok(p.clone().sub(mouth).dot(forward) > -.015, 'placing the food centre on a closed lip pushes half the bite through the face');
  }
  const indices = geometry.index;
  for (let i = 0; i < (indices?.count ?? points.length); i += 3) {
    const tri = [0, 1, 2].map(j => points[indices ? indices.getX(i + j) : i + j]);
    nearest = Math.min(nearest, new THREE.Triangle(tri[0], tri[1], tri[2]).closestPointToPoint(mouth, new THREE.Vector3()).distanceTo(mouth));
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

test('the feeding fork keeps the hand below the mouth and turns the narrow edge of the bite into the opening', async t => {
  const h = await fixture(t); h.draw('performing', 8.05);
  const head = h.rig.hero!.bones.get('head')!, fork = h.rig.root.getObjectByName('cypher-held-fork')!;
  const wrist = head.worldToLocal(h.rig.hero!.bones.get('wrist_R')!.getWorldPosition(new THREE.Vector3())), mouth = head.worldToLocal(lip(h.rig));
  assert.ok(wrist.y < mouth.y - .16, `the feeding wrist obscures the face instead of staying below it: ${wrist.y} / ${mouth.y}`);
  const food = fork.getObjectByName('cypher-held-bite') as THREE.Mesh, box = new THREE.Box3();
  for (let v = 0; v < food.geometry.attributes.position.count; v++) box.expandByPoint(head.worldToLocal(food.localToWorld(food.getVertexPosition(v, new THREE.Vector3()))));
  assert.ok(box.max.y - box.min.y < .09, `the bite is too tall for the actual open mouth: ${box.max.y - box.min.y}`);
  const skin = h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh, attrs = skin.geometry.attributes;
  for (let v = 0; v < attrs.position.count; v++) {
    if (![0, 1, 2, 3].some(j => attrs.skinWeight.getComponent(v, j) > .2 && /^(wrist|finger[1-5]-[1-3])_R$/.test(skin.skeleton.bones[attrs.skinIndex.getComponent(v, j)].name))) continue;
    const p = head.worldToLocal(skin.localToWorld(skin.getVertexPosition(v, new THREE.Vector3())));
    assert.ok(p.y < mouth.y + .05, 'the actual hand cannot cover the nose and eyes during feeding');
  }
});

test('the bite enters the mouth at full size instead of shrinking away on the fork', async t => {
  const h = await fixture(t), samples: THREE.Vector3[] = [];
  for (const elapsed of [8.05, 8.3, 8.5]) {
    h.draw('performing', elapsed);
    const food = h.rig.root.getObjectByName('cypher-held-bite') as THREE.Mesh;
    assert.equal(food.visible, true); assert.ok(food.scale.distanceTo(new THREE.Vector3(1, 1, 1)) < .000001, 'eating cannot uniformly shrink the food');
    const mouth = lip(h.rig), head = h.rig.hero!.bones.get('head')!, forward = new THREE.Vector3(0, 0, 1).transformDirection(head.matrixWorld);
    samples.push(new THREE.Vector3(food.getWorldPosition(new THREE.Vector3()).sub(mouth).dot(forward), 0, 0));
  }
  assert.ok(samples[1].x < samples[0].x - .015 && samples[2].x < samples[1].x - .015, 'the same slice must move through the lip opening');
  h.draw('performing', 8.59);
  const food = h.rig.root.getObjectByName('cypher-held-bite') as THREE.Mesh, mouth = lip(h.rig);
  const forward = new THREE.Vector3(0, 0, 1).transformDirection(h.rig.hero!.bones.get('head')!.matrixWorld);
  assert.equal(food.visible, true, 'the full-sized piece remains present until it has entered the mouth');
  for (let v = 0; v < food.geometry.attributes.position.count; v++)
    assert.ok(food.localToWorld(food.getVertexPosition(v, new THREE.Vector3())).sub(mouth).dot(forward) < 0, 'the food cannot disappear while part of it is still outside the lips');
  h.draw('performing', 8.7); assert.equal(h.rig.root.getObjectByName('cypher-held-bite')!.visible, false);
});

test('the feeding slice passes between the delivered lips without cutting through facial skin or teeth', async t => {
  const h = await fixture(t), face = h.rig.root.getObjectByName('cypher-anatomical-head') as THREE.SkinnedMesh;
  const surfaces = [face, ...['cypher-teeth-upper', 'cypher-teeth-lower'].map(name => h.rig.root.getObjectByName(name) as THREE.Mesh)];
  const materials = surfaces.map(mesh => ({ material: mesh.material as THREE.Material, side: (mesh.material as THREE.Material).side }));
  materials.forEach(({ material }) => { material.side = THREE.DoubleSide; });
  t.after(() => { materials.forEach(({ material, side }) => { material.side = side; }); });
  for (const elapsed of [...Array.from({ length: 21 }, (_, i) => 8.05 + i * .025), 8.59]) {
    h.draw('performing', elapsed); face.computeBoundingSphere();
    const food = h.rig.root.getObjectByName('cypher-held-bite') as THREE.Mesh, geometry = food.geometry;
    const points = Array.from({ length: geometry.attributes.position.count }, (_, v) => food.localToWorld(food.getVertexPosition(v, new THREE.Vector3())));
    const index = geometry.index, edges = new Set<string>();
    for (let i = 0; i < (index?.count ?? points.length); i += 3) {
      const tri = [0, 1, 2].map(j => points[index ? index.getX(i + j) : i + j]);
      for (let e = 0; e < 3; e++) {
        const a = tri[e], b = tri[(e + 1) % 3], key = [a, b].map(p => p.toArray().map(x => x.toFixed(6)).join(',')).sort().join('/');
        if (edges.has(key)) continue; edges.add(key);
        const direction = b.clone().sub(a), length = direction.length(); if (length < .006) continue;
        const hits = new THREE.Raycaster(a, direction.divideScalar(length), .003, length - .003).intersectObjects(surfaces);
        const hit = hits[0], rest = (hit?.object as THREE.Mesh | undefined)?.geometry.attributes._head_rest;
        const witness = hit?.face && { target: hit.object.name, point: h.rig.hero!.bones.get('head')!.worldToLocal(hit.point.clone()).toArray(),
          triangle: rest && [hit.face.a, hit.face.b, hit.face.c].map(v => [rest.getX(v), rest.getY(v), rest.getZ(v)]) };
        assert.equal(hits.length, 0, `food edge crosses the actual face at ${elapsed}: ${key}; ${JSON.stringify(witness)}`);
      }
    }
  }
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

test('cutting keeps both actual hands separate instead of pushing fingers through the opposite hand', async t => {
  const h = await fixture(t), skin = h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  const a = skin.geometry.attributes, index = skin.geometry.index!, right: number[] = [], left = new Set<number>();
  const side = (v: number, name: string) => [0, 1, 2, 3].some(j => a.skinWeight.getComponent(v, j) > .2
    && new RegExp(`^(wrist|finger[1-5]-[1-3])_${name}$`).test(skin.skeleton.bones[a.skinIndex.getComponent(v, j)].name));
  for (let v = 0; v < a.position.count; v++) if (side(v, 'R')) right.push(v);
  const triangles: number[] = [];
  for (let i = 0; i < index.count; i += 3) {
    const tri = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
    if (tri.every(v => side(v, 'L'))) { triangles.push(...tri); tri.forEach(v => left.add(v)); }
  }
  const vertices = [...left], remap = new Map(vertices.map((v, i) => [v, i]));
  const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(vertices.length * 3), 3));
  geometry.setIndex(triangles.map(v => remap.get(v)!));
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), mesh = new THREE.Mesh(geometry, material);
  t.after(() => { geometry.dispose(); material.dispose(); });
  const direction = new THREE.Vector3(.997, .041, .067).normalize(); let inspected = 0;
  const distances = (point: THREE.Vector3, ray: THREE.Vector3) => new THREE.Raycaster(point, ray, .0001, 3).intersectObject(mesh)
    .map(hit => hit.distance).filter((distance, i, values) => !i || distance - values[i - 1] > .0001);
  for (let sample = 0; sample <= 35; sample++) {
    const elapsed = sample / 10; h.draw('performing', elapsed); const origin = h.rig.root.getWorldPosition(new THREE.Vector3());
    vertices.forEach((v, i) => { const p = skin.localToWorld(skin.getVertexPosition(v, new THREE.Vector3())).sub(origin); geometry.attributes.position.setXYZ(i, p.x, p.y, p.z); });
    geometry.computeBoundingBox(); geometry.computeBoundingSphere(); mesh.updateMatrixWorld(true);
    const rightBounds = new THREE.Box3();
    for (const v of right) rightBounds.expandByPoint(skin.localToWorld(skin.getVertexPosition(v, new THREE.Vector3())).sub(origin));
    assert.equal(rightBounds.intersectsBox(geometry.boundingBox!), false, `the actual hand bounds overlap at ${elapsed}`);
    for (const v of right) {
      const p = skin.localToWorld(skin.getVertexPosition(v, new THREE.Vector3())).sub(origin);
      if (!geometry.boundingBox!.containsPoint(p)) continue;
      inspected++; const forward = distances(p, direction), backward = distances(p, direction.clone().negate());
      assert.ok(!(forward.length % 2 && backward.length % 2 && Math.min(forward[0], backward[0]) > .007), `right-hand vertex ${v} enters the left hand at ${elapsed}`);
    }
  }
  console.log({ actualHandIntersectionProbes: inspected, savedCuttingPoses: 36 });
});

test('the plated slice belongs to a real cut and transfers the same geometry onto the fork', async t => {
  const h = await fixture(t), steak = h.deck.getObjectByName('cypher-steak')!.children[0] as THREE.Mesh;
  const piece = h.deck.getObjectByName('cypher-steak-cut-piece')!, point = piece.getWorldPosition(new THREE.Vector3());
  const material = steak.material as THREE.Material, before = material.side; material.side = THREE.DoubleSide;
  const cross = (sign: number) => new THREE.Raycaster(point, new THREE.Vector3(sign, 0, 0), .0001, 2).intersectObject(steak)
    .map(hit => hit.distance).filter((value, i, values) => !i || value - values[i - 1] > .0001);
  const inside = cross(1).length % 2 && cross(-1).length % 2; material.side = before;
  assert.equal(Boolean(inside), false, 'a separate bite cannot overlap an unchanged whole steak');
  const mainBounds = new THREE.Box3().setFromObject(steak), sliceBounds = new THREE.Box3().setFromObject(piece);
  assert.ok(Math.abs(mainBounds.min.x - sliceBounds.max.x) < .001, 'both portions must abut the same cut instead of overlapping or leaving a gap');
  const support = new THREE.Box3().setFromObject(h.deck.getObjectByName('cypher-steak-plate')!).max.y;
  assert.ok(Math.abs(mainBounds.min.y - support) < .004 && Math.abs(sliceBounds.min.y - support) < .004, 'both cut portions must rest on the actual plate');
  h.draw('performing', 3.5);
  const plated = piece.children[0] as THREE.Mesh, held = h.rig.root.getObjectByName('cypher-held-bite') as THREE.Mesh;
  assert.equal(plated.geometry.attributes.position.count, held.geometry.attributes.position.count, 'the held bite must retain the cut slice instead of becoming a different blob');
  for (let v = 0; v < plated.geometry.attributes.position.count; v++) {
    const a = plated.localToWorld(new THREE.Vector3().fromBufferAttribute(plated.geometry.attributes.position, v));
    const b = held.localToWorld(new THREE.Vector3().fromBufferAttribute(held.geometry.attributes.position, v));
    assert.ok(a.distanceTo(b) < .003, `the cut slice jumps or changes shape at the fork handoff: ${a.distanceTo(b)}`);
  }
});

test('the actual knife edge follows the cut face and the fork tines stay outside its blade', async t => {
  const h = await fixture(t), body = h.deck.getObjectByName('cypher-steak')!.children[0] as THREE.Mesh, a = body.geometry.attributes;
  const face = new THREE.Box3();
  for (let v = 0; v < a.position.count; v++) if (a.normal.getX(v) < -.99)
    face.expandByPoint(body.localToWorld(new THREE.Vector3().fromBufferAttribute(a.position, v)));
  assert.ok(!face.isEmpty(), 'the remaining steak needs a real exposed cutting face');
  for (let sample = 0; sample <= 35; sample++) {
    const elapsed = sample / 10; h.draw('performing', elapsed);
    const knife = h.rig.root.getObjectByName('cypher-held-knife')!, fork = h.rig.root.getObjectByName('cypher-held-fork')!;
    const blade = knife.getObjectByName('steak-knife-blade') as THREE.Mesh<THREE.ExtrudeGeometry>;
    const shape = blade.geometry.parameters.shapes as THREE.Shape, outline = shape.getPoints(12);
    blade.geometry.computeBoundingBox(); const bounds = blade.geometry.boundingBox!;
    const steel = blade.material as THREE.Material, side = steel.side; steel.side = THREE.DoubleSide;
    const direction = new THREE.Vector3(0, 0, 1).transformDirection(blade.matrixWorld);
    const edge = knife.localToWorld(new THREE.Vector3(-.024, .63, 0));
    assert.ok(Math.abs(edge.x - face.min.x) < .004 && edge.y >= face.min.y - .002 && edge.y <= face.max.y + .002
      && edge.z >= face.min.z - .002 && edge.z <= face.max.z + .002, `the cutting edge misses the actual cut at ${elapsed}`);
    for (const part of fork.children) {
      if (!(part instanceof THREE.Mesh) || part.name === 'cypher-held-bite') continue;
      const vertices = part.geometry.attributes.position;
      for (let v = 0; v < vertices.count; v++) {
        const world = part.localToWorld(new THREE.Vector3().fromBufferAttribute(vertices, v)), p = blade.worldToLocal(world.clone());
        if (bounds.containsPoint(p)) {
          const distances = (sign: number) => new THREE.Raycaster(world, direction.clone().multiplyScalar(sign), .00001, .04).intersectObject(blade)
            .map(hit => hit.distance).filter((value, i, values) => !i || value - values[i - 1] > .00001);
          const forward = distances(1), backward = distances(-1);
          assert.ok(!(forward.length % 2 && backward.length % 2 && Math.min(forward[0], backward[0]) > .0003), `fork metal enters the bevelled blade mesh at ${elapsed}`);
        }
        if (p.z <= bounds.min.z + .0003 || p.z >= bounds.max.z - .0003) continue;
        let inside = false;
        for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
          const a = outline[i], b = outline[j];
          if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
        }
        assert.equal(inside, false, `fork metal enters the actual curved knife blade at ${elapsed}: ${p.toArray()}`);
      }
    }
    steel.side = side;
  }
});
