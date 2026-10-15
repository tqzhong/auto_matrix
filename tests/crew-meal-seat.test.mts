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
  const actors = new Map(Object.keys(CREW_MEAL.seats).map(id => [id, models.create(world.agents.get(id)!)])); await Promise.all(pending); await new Promise(resolve => setImmediate(resolve));
  const center = FILM_SETS.film_neb_deck.center, deck = new THREE.Group(); deck.position.set(center.x, center.y - 1, center.z);
  const neb = new NebDeckRenderer(deck);
  const draw = (age: number) => {
    for (const [id, actor] of actors) {
      const role = id as keyof typeof CREW_MEAL.seats;
      const gesture: InterludeGesture = { kind: 'meal', phase: age < CREW_MEAL.receive ? 'performing' : 'accepting',
        elapsed: age < CREW_MEAL.receive ? age : age - CREW_MEAL.receive, physicalMeal: true, role };
      const at = interludeRoot('meal', role, gesture);
      actor.root.position.set(center.x + at.x, center.y - 1, center.z + at.z); actor.root.rotation.y = at.yaw;
      models.animate(actor, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, glasses: false, nebCrew: role, nebCrewEarly: true, interlude: gesture }, 4);
      actor.root.updateMatrixWorld(true);
    }
    deck.updateMatrixWorld(true);
  };
  t.after(() => { models.dispose(); neb.dispose(); globalThis.document = previous; });
  const settle = async () => { await Promise.all(pending); await new Promise(resolve => setImmediate(resolve)); };
  draw(0); await settle(); draw(0);
  return { actors, models, world, neb, deck, draw, settle, center };
}

function visible(object: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = object; p; p = p.parent) if (!p.visible) return false;
  return true;
}
function lowerBody(actor: ReturnType<CharacterModels['create']>) {
  const points: THREE.Vector3[] = [], shoes: THREE.Vector3[] = [];
  const add = (mesh: THREE.Mesh, target: THREE.Vector3[]) => {
    if (!visible(mesh)) return;
    if (mesh instanceof THREE.SkinnedMesh) mesh.skeleton.update();
    for (let i = 0; i < mesh.geometry.attributes.position.count; i++) target.push(mesh.localToWorld(mesh.getVertexPosition(i, new THREE.Vector3())));
  };
  if (actor.hero) actor.root.traverse(object => {
    if (object instanceof THREE.SkinnedMesh && /trouser/i.test(object.name)) add(object, points);
    if (object instanceof THREE.SkinnedMesh && /shoe|boot_sole/i.test(object.name)) add(object, shoes);
  });
  else {
    actor.hips.forEach(hip => hip.traverse(object => { if (object instanceof THREE.Mesh) add(object, points); }));
    actor.ankles.forEach(ankle => ankle.traverse(object => { if (object instanceof THREE.Mesh) add(object, shoes); }));
  }
  assert.ok(points.length && shoes.length, 'check the actual visible lower body and shoe geometry');
  return { points, shoes };
}
function penetration(points: THREE.Vector3[], seat: THREE.Mesh) {
  seat.geometry.computeBoundingBox();
  const box = seat.geometry.boundingBox!, local = new THREE.Vector3();
  return points.filter(point => {
    local.copy(point); seat.worldToLocal(local);
    if (seat.geometry instanceof THREE.CylinderGeometry && Math.hypot(local.x, local.z) > seat.geometry.parameters.radiusTop - .008) return false;
    return local.x > box.min.x + .008 && local.x < box.max.x - .008 && local.z > box.min.z + .008 && local.z < box.max.z - .008
      && local.y > box.min.y + .008 && local.y < box.max.y - .008;
  });
}

test('all six diners rest on their stools with shoes on the floor and no trouser-seat penetration', async t => {
  const h = await fixture(t); h.draw(2.3); const floor = h.center.y - 1;
  for (const [id, actor] of h.actors) {
    if (id === 'mouse') assert.equal(actor.hero?.support, 'mouse', 'measure Mouse’s delivered anatomy, not the loading fallback');
    const seat = h.deck.getObjectByName(`neb-meal-seat-${id}`) as THREE.Mesh, { points, shoes } = lowerBody(actor);
    const bounds = new THREE.Box3().setFromObject(seat), center = seat.getWorldPosition(new THREE.Vector3());
    assert.equal(penetration(points, seat).length, 0, `${id}'s trousers intersect the stool`);
    const contact = points.filter(p => Math.hypot(p.x - center.x, p.z - center.z) < .43 && p.y > bounds.max.y - .1);
    assert.ok(contact.length, `${id} must have a supported seat surface`);
    const gap = Math.min(...contact.map(p => p.y)) - bounds.max.y;
    assert.ok(gap >= -.012 && gap < .045, `${id} seat support gap ${gap}`);
    const sole = Math.min(...shoes.map(p => p.y)) - floor;
    assert.ok(sole > -.015 && sole < .018, `${id}'s shoes float or sink: ${sole}`);
  }
});

test('Neo turns off the stool before rising and finishes clear of the table collision radius', async t => {
  const h = await fixture(t), actor = h.actors.get('neo')!, seat = h.deck.getObjectByName('neb-meal-seat-neo') as THREE.Mesh;
  const fixedSeat = seat.getWorldPosition(new THREE.Vector3());
  for (let frame = 216; frame <= 264; frame++) {
    const age = frame / 20; h.draw(age); const body = lowerBody(actor);
    assert.ok(visible(seat), 'the stool must remain visible throughout standing');
    assert.equal(penetration(body.points, seat).length, 0, `Neo crosses through the stool at ${age}`);
    assert.equal(penetration(body.points, h.deck.getObjectByName('neb-mess-table') as THREE.Mesh).length, 0, `Neo passes through the tabletop at ${age}`);
    const sole = Math.min(...body.shoes.map(p => p.y)) - (h.center.y - 1);
    assert.ok(sole > -.015 && sole < .018, `Neo loses floor contact at ${age}: ${sole}`);
  }
  assert.ok(seat.getWorldPosition(new THREE.Vector3()).distanceTo(fixedSeat) < .001, 'Neo leaves the stool behind');
  assert.ok(actor.root.position.x - h.center.x > CREW_MEAL.table.x + CREW_MEAL.table.width / 2 + 1.1, 'control returns outside the table collision radius');
});

test('Tank approaches and lowers onto his stool without passing his legs through its seat', async t => {
  const h = await fixture(t), actor = h.actors.get('tank')!, seat = h.deck.getObjectByName('neb-meal-seat-tank') as THREE.Mesh;
  for (let frame = 0; frame <= 46; frame++) {
    const age = frame / 20; h.draw(age);
    const body = lowerBody(actor);
    assert.equal(penetration(body.points, seat).length, 0, `Tank passes through his stool at ${age}`);
    assert.equal(penetration(body.points, h.deck.getObjectByName('neb-mess-table') as THREE.Mesh).length, 0, `Tank passes through the tabletop at ${age}`);
  }
});

test('the table trestles reach from its underside to the floor without entering the diners or standing route', async t => {
  const h = await fixture(t), table = new THREE.Box3().setFromObject(h.deck.getObjectByName('neb-mess-table')!);
  const supports: THREE.Mesh[] = [];
  h.deck.traverse(object => { if (object instanceof THREE.Mesh && /^neb-mess-table-(rail|post|foot)-/.test(object.name)) supports.push(object); });
  assert.ok(supports.length >= 6, 'the table must have real floor-supported trestles');
  const floor = h.center.y - 1;
  for (const side of [-1, 1]) {
    const x = h.center.x + CREW_MEAL.table.x, z = h.center.z + CREW_MEAL.table.z + side * (CREW_MEAL.table.depth / 2 - .6);
    const intervals = supports.map(mesh => new THREE.Box3().setFromObject(mesh)).filter(box => x >= box.min.x && x <= box.max.x && z >= box.min.z && z <= box.max.z).sort((a, b) => a.min.y - b.min.y);
    let top = floor;
    for (const box of intervals) {
      assert.ok(box.min.y <= top + .002, 'the support chain must not contain a floating gap'); top = Math.max(top, box.max.y);
      assert.ok(box.min.x >= table.min.x && box.max.x <= table.max.x && box.min.z >= table.min.z && box.max.z <= table.max.z, 'trestles stay inside the tabletop footprint');
    }
    assert.ok(Math.abs(top - table.min.y) < .002, 'both trestles must contact the tabletop underside');
  }
  const traySupports: THREE.Mesh[] = []; h.deck.traverse(object => { if (object instanceof THREE.Mesh && object.name.startsWith('neb-serving-stand-')) traySupports.push(object); });
  for (const age of [0, .5, 1, 1.4, 1.8, 2.3, 10.8, 11.3, 11.8, 12.2, 12.6, 13.2]) {
    h.draw(age);
    for (const [role, actor] of h.actors) {
      const { points, shoes } = lowerBody(actor);
      for (const support of [...supports, ...traySupports]) assert.equal(penetration([...points, ...shoes], support).length, 0, `${role} intersects ${support.name} at ${age}`);
    }
  }
});
