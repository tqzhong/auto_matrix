import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { FILM_SETS, CREW_MEAL, interludeRoot, type InterludeGesture } from '@auto_matrix/shared';
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
  const rig = models.create(world.agents.get('neo')!), tank = models.create(world.agents.get('tank')!); await Promise.all(pending); await new Promise(resolve => setImmediate(resolve));
  const center = FILM_SETS.film_neb_deck.center, deck = new THREE.Group(); deck.position.set(center.x, center.y - 1, center.z);
  const neb = new NebDeckRenderer(deck);
  const draw = (phase: InterludeGesture['phase'], elapsed: number, firstPerson = false, target = rig) => {
    const interlude: InterludeGesture = { kind: 'meal', phase, elapsed, role: 'neo', physicalMeal: true };
    for (const [role, actor] of [['neo', target], ['tank', tank]] as const) {
      const gesture = { ...interlude, role }, at = interludeRoot('meal', role, gesture);
      actor.root.position.set(center.x + at.x, center.y - 1, center.z + at.z); actor.root.rotation.y = at.yaw;
      models.animate(actor, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, glasses: false, firstPerson: firstPerson && role === 'neo', nebCrew: role, nebCrewEarly: true, interlude: gesture }, 4);
    }
    neb.update({ version: 1, scene: 'm1_meal', actor: 'neo', step: 0, completed: [], enteredAt: 0,
      checkpoint: world.agents.get('neo')!.position, reflections: {}, lastText: '', interlude }, elapsed, undefined, id => id === 'neo' ? target.root : id === 'tank' ? tank.root : undefined);
    target.root.updateMatrixWorld(true); deck.updateMatrixWorld(true);
  };
  t.after(() => { models.dispose(); neb.dispose(); globalThis.document = previous; });
  const settle = async () => { await Promise.all(pending); await new Promise(resolve => setImmediate(resolve)); };
  draw('ready', 0); await settle(); draw('ready', 0);
  return { rig, tank, models, world, neb, deck, draw, settle };
}

test('the six diners sit along a human-scale long metal table, with Neo beside its long edge', async t => {
  const h = await fixture(t); h.draw('ready', 0);
  const table = h.deck.getObjectByName('neb-mess-table')!; const size = new THREE.Box3().setFromObject(table).getSize(new THREE.Vector3());
  assert.ok(size.x < size.z, 'the mess table must run down the room, rather than put Neo at an added seventh end seat');
  assert.ok(Math.abs(new THREE.Box3().setFromObject(table).max.y - (FILM_SETS.film_neb_deck.center.y - 1 + CREW_MEAL.table.height)) < .002);
  const at = interludeRoot('meal', 'neo'); assert.ok(at.z > CREW_MEAL.table.z - CREW_MEAL.table.depth / 2 && at.z < CREW_MEAL.table.z + CREW_MEAL.table.depth / 2);
});

test('Neo owns the real bowl and spoon while eating, with no floating duplicate props', async t => {
  const h = await fixture(t); h.draw('accepting', 3); await h.settle(); h.draw('accepting', 3);
  const spoon = h.rig.root.getObjectByName('meal-held-spoon'), bowl = h.rig.root.getObjectByName('meal-held-bowl');
  assert.ok(spoon?.visible, 'the eating spoon must be attached to the actual player hand');
  assert.ok(bowl?.visible, 'the bowl must be supported by the actual left hand');
  assert.equal(spoon.parent, h.rig.hero!.bones.get('wrist_R')); assert.equal(bowl.parent, h.rig.hero!.bones.get('wrist_L'));
  assert.equal(h.deck.getObjectByName('neb-neo-protein-bowl')!.visible, false);
  assert.equal(h.deck.getObjectByName('neb-neo-spoon')!.visible, false);
  h.draw('accept_ready', 0); assert.equal(spoon.visible, false); assert.equal(bowl.visible, false);
  assert.equal(h.deck.getObjectByName('neb-neo-protein-bowl')!.visible, true);
});

test('the first bite opens Neo’s actual face instead of pushing the spoon through a sealed mouth', async t => {
  const h = await fixture(t); h.draw('accepting', 3); await h.settle(); h.draw('accepting', 3);
  const skin = h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  const jaw = skin.morphTargetDictionary?.jawOpen;
  assert.notEqual(jaw, undefined, 'Neo needs an actual jaw shape on his delivered skin');
  assert.ok(skin.morphTargetInfluences![jaw!] > .5, 'the saved bite clock must open the lips before the food reaches them');
  h.draw('done', 10.9); assert.equal(skin.morphTargetInfluences![jaw!], 0);
});

test('serving, lifting and setting down transfer one bowl or spoon without a position or orientation jump', async t => {
  const h = await fixture(t);
  for (const [owner, heldName, worldName, time, before] of [
    [h.tank, 'meal-serving-bowl', 'neb-neo-protein-bowl', .35, true],
    [h.rig, 'meal-held-bowl', 'neb-neo-protein-bowl', 3.2, false],
    [h.rig, 'meal-held-spoon', 'neb-neo-spoon', 3.4, false],
    [h.rig, 'meal-held-spoon', 'neb-neo-spoon', 8.2, true],
    [h.rig, 'meal-held-bowl', 'neb-neo-protein-bowl', 10, true],
  ] as const) {
    const globalTime = time + (before ? -.00001 : .00001);
    h.draw(globalTime < 2.3 ? 'performing' : 'accepting', globalTime < 2.3 ? globalTime : globalTime - 2.3);
    const held = owner.root.getObjectByName(heldName)!, world = h.deck.getObjectByName(worldName)!;
    assert.equal(held.visible, true); assert.equal(world.visible, false);
    assert.ok(held.getWorldScale(new THREE.Vector3()).distanceTo(world.getWorldScale(new THREE.Vector3())) < 1e-6, `${heldName} changes scale at transfer`);
    assert.ok(held.getWorldPosition(new THREE.Vector3()).distanceTo(world.getWorldPosition(new THREE.Vector3())) < .004, `${heldName} jumps at ${time}`);
    assert.ok(held.getWorldQuaternion(new THREE.Quaternion()).angleTo(world.getWorldQuaternion(new THREE.Quaternion())) < .006, `${heldName} rotates at ${time}`);
    h.draw(time < 2.3 ? 'performing' : 'accepting', (time < 2.3 ? time : time - 2.3) + (before ? .00001 : -.00001));
    assert.equal(held.visible, false); assert.equal(world.visible, true);
  }
});

function handVertices(skin: THREE.SkinnedMesh, side: 'R' | 'L') {
  const a = skin.geometry.attributes, vertices: { v: number; digit?: number }[] = [];
  for (let v = 0; v < a.position.count; v++) {
    const names = [0, 1, 2, 3].filter(j => a.skinWeight.getComponent(v, j) > .2).map(j => skin.skeleton.bones[a.skinIndex.getComponent(v, j)].name);
    if (!names.some(name => new RegExp(`^(wrist|finger[1-5]-[1-3])_${side}$`).test(name))) continue;
    const distal = names.map(name => new RegExp(`^finger([1-5])-3_${side}$`).exec(name)).find(Boolean);
    vertices.push({ v, digit: distal ? Number(distal[1]) : undefined });
  }
  return vertices;
}

test('Neo pinches the thin spoon with three real fingers, without burying the handle or folding his wrist', async t => {
  const h = await fixture(t), skin = h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  const vertices = handVertices(skin, 'R'); let worst = 0, largestBend = 0, largestGap = 0;
  for (let frame = 34; frame < 82; frame++) {
    const time = frame / 10; h.draw('accepting', time - 2.3);
    const spoon = h.rig.root.getObjectByName('meal-held-spoon')!, nearest = [Infinity, Infinity, Infinity];
    for (const { v, digit } of vertices) {
      const p = spoon.worldToLocal(skin.localToWorld(skin.getVertexPosition(v, new THREE.Vector3())));
      // The delivered handle is a radius .013 capsule with a .22 straight section.
      const distance = Math.hypot(p.x, p.z, Math.max(0, Math.abs(p.y) - .11)) - .013;
      worst = Math.min(worst, distance); assert.ok(distance > -.006, `spoon enters the hand at ${time}: ${distance}`);
      if (digit && digit <= 3) nearest[digit - 1] = Math.min(nearest[digit - 1], Math.abs(distance));
    }
    largestGap = Math.max(largestGap, ...nearest);
    assert.ok(nearest.every(gap => gap < .04), `thumb, index and middle finger must meet the spoon at ${time}: ${nearest}`);
    const wrist = h.rig.hero!.bones.get('wrist_R')!, elbow = h.rig.hero!.bones.get('elbow_R')!;
    const bend = wrist.getWorldPosition(new THREE.Vector3()).sub(elbow.getWorldPosition(new THREE.Vector3())).angleTo(new THREE.Vector3(0, -1, 0).transformDirection(wrist.matrixWorld));
    largestBend = Math.max(largestBend, bend); assert.ok(bend < .85, `feeding wrist folds ${bend * 180 / Math.PI} degrees at ${time}`);
  }
  t.diagnostic(JSON.stringify({ spoonSamples: 48, worst, largestGap, largestBend }));
});

test('the hands stay outside the bowl throughout serving, scooping and withdrawal, with contact while carrying', async t => {
  const h = await fixture(t); let largestGap = 0, deepest = 0;
  for (const [actor, side, name, times, contact] of [[h.tank, 'R', 'meal-serving-bowl', Array.from({ length: 19 }, (_, i) => i / 10), true],
    [h.rig, 'L', 'meal-held-bowl', Array.from({ length: 109 }, (_, i) => i / 10), true],
    [h.rig, 'R', 'meal-held-bowl', Array.from({ length: 109 }, (_, i) => i / 10), false]] as const) {
    const skin = actor.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh, vertices = handVertices(skin, side);
    for (const time of times) {
      h.draw(time < 2.3 ? 'performing' : 'accepting', time < 2.3 ? time : time - 2.3);
      const held = actor.root.getObjectByName(name)!, bowl = held.visible ? held : h.deck.getObjectByName('neb-neo-protein-bowl')!, nearest = Array(5).fill(Infinity);
      const shell = bowl.getObjectByName('meal-bowl-shell') as THREE.Mesh<THREE.LatheGeometry>, position = shell.geometry.attributes.position;
      const profile = Array.from({ length: shell.geometry.parameters.points.length }, (_, v) => new THREE.Vector2(Math.hypot(position.getX(v), position.getZ(v)), position.getY(v)));
      const low = Math.min(...profile.map(p => p.y)), high = Math.max(...profile.map(p => p.y));
      for (const { v, digit } of vertices) {
        const p = bowl.worldToLocal(skin.localToWorld(skin.getVertexPosition(v, new THREE.Vector3())));
        if (p.y <= low + .02 || p.y >= high - .01) continue;
        let radius = 0;
        for (let i = 1; i < profile.length; i++) {
          const a = profile[i - 1], b = profile[i];
          if (p.y > Math.min(a.y, b.y) && p.y < Math.max(a.y, b.y)) radius = Math.max(radius, THREE.MathUtils.lerp(a.x, b.x, (p.y - a.y) / (b.y - a.y)));
        }
        const distance = Math.hypot(p.x, p.z) - radius; deepest = Math.min(deepest, distance);
        assert.ok(distance > -.012, `${name}/${side} hand enters the bowl at ${time}: ${distance}, ${p.toArray()}`);
        if (digit) nearest[digit - 1] = Math.min(nearest[digit - 1], Math.abs(distance));
      }
      if (held.visible && contact) {
        largestGap = Math.max(largestGap, ...nearest);
        assert.ok(nearest.every(gap => gap < .04), `${name} fingers float at ${time}: ${nearest}`);
      }
    }
  }
  t.diagnostic(JSON.stringify({ bowlSamples: 237, largestGap, deepest }));
});

test('saved eating instants do not snap the arms or fold back the actual distal finger skin', async t => {
  const h = await fixture(t); let largest = 0, maximumPIP = 0, maximumDIP = 0;
  for (const [actor, role, start, end, sides] of [[h.rig, 'neo', 2.3, 10.9, ['R', 'L']], [h.tank, 'tank', 0, 2.3, ['R']]] as const) {
    const rig = actor.hero!, skin = actor.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh, a = skin.geometry.attributes;
    const names = sides.flatMap(side => [`shoulder_${side}`, `elbow_${side}`, `wrist_${side}`, ...Array.from({ length: 15 }, (_, i) => `finger${Math.floor(i / 3) + 1}-${i % 3 + 1}_${side}`)]);
    const distal = sides.flatMap(side => Array.from({ length: 5 }, (_, i) => {
      const bone = skin.skeleton.bones.indexOf(rig.bones.get(`finger${i + 1}-3_${side}`)!), vertices: number[] = [];
      for (let v = 0; v < a.position.count; v++) if ([0, 1, 2, 3].some(j => a.skinIndex.getComponent(v, j) === bone && a.skinWeight.getComponent(v, j) > .95)) vertices.push(v);
      return { side, digit: i + 1, vertices };
    }));
    let previous: THREE.Quaternion[] | undefined;
    for (let frame = Math.round(start * 100); frame <= Math.round(end * 100); frame++) {
      const time = frame / 100; h.draw(time < 2.3 ? 'performing' : 'accepting', time < 2.3 ? time : time - 2.3);
      const rotations = names.map(name => rig.bones.get(name)!.getWorldQuaternion(new THREE.Quaternion()));
      if (previous) rotations.forEach((rotation, i) => {
        const delta = rotation.angleTo(previous![i]); largest = Math.max(largest, delta);
        assert.ok(delta < .15, `${role}/${time}/${names[i]} snaps ${delta * 180 / Math.PI} degrees in 10ms`);
      });
      previous = rotations;
      if (frame % 5) continue;
      for (const { side, digit, vertices } of distal) {
        const pad = new THREE.Vector3(); for (const v of vertices) pad.add(skin.localToWorld(skin.getVertexPosition(v, new THREE.Vector3()))); pad.divideScalar(vertices.length);
        const points = [1, 2, 3].map(j => rig.bones.get(`finger${digit}-${j}_${side}`)!.getWorldPosition(new THREE.Vector3())); points.push(pad);
        const segments = [0, 1, 2].map(j => points[j + 1].clone().sub(points[j]).normalize()), pip = segments[0].angleTo(segments[1]) * 180 / Math.PI, dip = segments[1].angleTo(segments[2]) * 180 / Math.PI;
        maximumPIP = Math.max(maximumPIP, pip); maximumDIP = Math.max(maximumDIP, dip);
        assert.ok(pip <= (digit === 1 ? 100 : 115), `${role}/${time}/${side}/${digit} folds the middle joint ${pip} degrees`);
        assert.ok(dip <= 90, `${role}/${time}/${side}/${digit} folds the distal joint ${dip} degrees`);
      }
    }
  }
  t.diagnostic(JSON.stringify({ largest, maximumPIP, maximumDIP }));
});

test('cold saves, unrelated gestures and first-person view preserve the same eating anatomy and prop owners', async t => {
  const h = await fixture(t), names = ['meal-held-bowl', 'meal-held-spoon'];
  const snapshot = (actor: typeof h.rig) => {
    const skin = actor.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
    return { props: names.map(name => { const p = actor.root.getObjectByName(name)!; return { visible: p.visible, at: p.getWorldPosition(new THREE.Vector3()), rotation: p.getWorldQuaternion(new THREE.Quaternion()) }; }),
      points: (['R', 'L'] as const).flatMap(side => handVertices(skin, side).filter((_, i) => i % 17 === 0).map(({ v }) => skin.localToWorld(skin.getVertexPosition(v, new THREE.Vector3())))) };
  };
  for (const time of [2.75, 3.2, 4.1, 5.5, 7.99, 8.2, 9.9, 10.4]) {
    h.draw('accepting', time - 2.3); const expected = snapshot(h.rig);
    const fresh = h.models.create(h.world.agents.get('neo')!); await h.settle();
    for (const [actor, firstPerson] of [[fresh, false], [fresh, true], [h.rig, false]] as const) {
      if (actor === h.rig) { h.draw('done', 10.9); h.draw('ready', 0); }
      h.draw('accepting', time - 2.3, firstPerson, actor); await h.settle(); h.draw('accepting', time - 2.3, firstPerson, actor);
      const actual = snapshot(actor);
      for (const [i, prop] of actual.props.entries()) {
        assert.equal(prop.visible, expected.props[i].visible);
        if (!prop.visible) continue;
        assert.ok(prop.at.distanceTo(expected.props[i].at) < 1e-6, `${names[i]} changes position on cold restore/V/history at ${time}`);
        assert.ok(prop.rotation.angleTo(expected.props[i].rotation) < 1e-6, `${names[i]} changes orientation on cold restore/V/history at ${time}`);
      }
      actual.points.forEach((point, i) => assert.ok(point.distanceTo(expected.points[i]) < 1e-6, `finger skin ${i} depends on cold restore/V/history at ${time}`));
      if (firstPerson) {
        const skin = actor.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh, index = new Set(Array.from(skin.geometry.index!.array));
        assert.ok(handVertices(skin, 'R').filter(({ v }) => index.has(v)).length > 1000, 'the anatomical feeding fingers remain rendered in first person');
        assert.equal(actor.root.getObjectByName('neo-teeth-upper')!.visible, false, 'oral meshes cannot surround the first-person camera');
      }
    }
  }
});

test('the full-sized spoonful enters between Neo’s actual lips and teeth without cutting through them', async t => {
  const h = await fixture(t), material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  t.after(() => material.dispose());
  for (const time of [5.25, 5.35, 5.4, 5.45, 5.5, 5.55, 5.6, 5.65, 5.699]) {
    h.draw('accepting', time - 2.3);
    const food = h.rig.root.getObjectByName('meal-spoon-food') as THREE.Mesh;
    assert.equal(food.visible, true);
    assert.ok(food.scale.distanceTo(new THREE.Vector3(1, .36, 1.35)) < 1e-6, 'consuming the porridge cannot shrink the portion to hide a collision');
    const parts = [food, h.rig.root.getObjectByName('meal-held-spoon')!.getObjectByName('meal-spoon-bowl') as THREE.Mesh].map(mesh => ({ mesh,
      points: Array.from({ length: mesh.geometry.attributes.position.count }, (_, v) => mesh.localToWorld(mesh.getVertexPosition(v, new THREE.Vector3()))) }));
    const nearby = new THREE.Box3().setFromPoints(parts.flatMap(part => part.points)).expandByScalar(.015);
    if (time === 5.699) {
      const skin = h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh, positions = skin.geometry.attributes.position, lip = new THREE.Vector3(); let count = 0;
      for (let v = 0; v < positions.count; v++) if (Math.abs(positions.getX(v)) < .018 && positions.getY(v) > 3.93 && positions.getY(v) < 3.96 && positions.getZ(v) > .28) {
        lip.add(skin.localToWorld(skin.getVertexPosition(v, new THREE.Vector3()))); count++;
      }
      assert.ok(count > 0); lip.divideScalar(count);
      const outward = new THREE.Vector3(0, 0, 1).transformDirection(h.rig.hero!.bones.get('head')!.matrixWorld); outward.y = 0; outward.normalize();
      assert.ok(parts[0].points.every(p => p.clone().sub(lip).dot(outward) < 0), 'the full-sized portion must cross the lips before it disappears');
    }
    const surfaces = ['Anatomical_head_and_hands', 'neo-teeth-upper', 'neo-teeth-lower'].map(name => {
      const actual = h.rig.root.getObjectByName(name) as THREE.Mesh, source = actual.geometry, index = source.index!;
      const positions = Array.from({ length: source.attributes.position.count }, (_, v) => actual.localToWorld(actual.getVertexPosition(v, new THREE.Vector3()))), triangles: number[] = [];
      for (let i = 0; i < index.count; i += 3) {
        const triangle = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
        if (!new THREE.Box3().setFromPoints(triangle.map(v => positions[v])).intersectsBox(nearby)) continue;
        triangle.forEach(v => triangles.push(...positions[v].toArray()));
      }
      const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(triangles, 3));
      const mesh = new THREE.Mesh(geometry, material); mesh.name = name; return mesh;
    });
    try {
      for (const { mesh, points } of parts) {
        const edges = new Set<string>(), index = mesh.geometry.index!;
        for (let i = 0; i < index.count; i += 3) for (let edge = 0; edge < 3; edge++) {
          const a = points[index.getX(i + edge)], b = points[index.getX(i + (edge + 1) % 3)];
          const key = [a, b].map(p => p.toArray().map(x => x.toFixed(6)).join(',')).sort().join('/'); if (edges.has(key)) continue; edges.add(key);
          const direction = b.clone().sub(a), length = direction.length(); if (length < .003) continue;
          const hit = new THREE.Raycaster(a, direction.divideScalar(length), .001, length - .001).intersectObjects(surfaces)[0];
          assert.ok(!hit, `${mesh.name} crosses ${hit?.object.name} at ${time}: ${hit?.point.toArray()}`);
        }
      }
    } finally { surfaces.forEach(surface => surface.geometry.dispose()); }
  }
  h.draw('accepting', 5.7 - 2.3); assert.equal(h.rig.root.getObjectByName('meal-spoon-food')!.visible, false);
});
