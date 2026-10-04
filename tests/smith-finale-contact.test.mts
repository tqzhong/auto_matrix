import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, newSmithFinale, smithFinaleAction, smithFinalePose, stepSmithFinale, SMITH_FINALE, type SmithFinaleEncounter } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

async function geometry(id: string) {
  const glb = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
  const length = glb.readUInt32LE(12), document = JSON.parse(glb.subarray(20, 20 + length).toString());
  for (const material of document.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = glb.subarray(20 + length), result = Buffer.alloc(20 + padded.length + bin.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); bin.copy(result, 20 + padded.length);
  return new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
}

async function setup(t: TestContext) {
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking', 'smith'].map(async id => [id, await geometry(id)] as const)));
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async (path: string) => assets.get(path.split('/').pop()!.replace(/\.glb.*$/, ''))!);
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const context = { createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }),
    putImageData() {}, fillRect() {}, strokeRect() {}, fillText() {}, createRadialGradient: () => ({ addColorStop() {} }) };
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.assign(globalThis, { document: { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const actors = ['neo', 'smith'].map(id => world.agents.get(id)!), center = FILM_SETS.film_smith_avenue.center;
  const renderer = new AgentRenderer(new THREE.Scene());
  for (const actor of actors) {
    actor.currentLocation = 'film_smith_avenue'; actor.isInMatrix = true;
    renderer.updateAgent(actor.id, actor);
  }
  await new Promise(resolve => setImmediate(resolve));
  const save = (beat: SmithFinaleEncounter, target = renderer) => {
    const poses = smithFinalePose(beat);
    for (const actor of actors) {
      const role = actor.id as 'neo' | 'smith', pose = poses[role];
      actor.position = { x: center.x + pose.x, y: center.y + pose.y, z: center.z + pose.z }; actor.rotation = pose.yaw;
      actor.velocity = { x: 0, y: 0, z: 0 };
      actor.currentAction = { type: 'idle', parameters: { smithFinale: { ...beat, role } }, startedAt: 0, duration: 1, progress: 0 };
      target.updateAgent(actor.id, actor);
    }
  };
  const frame = (beat: SmithFinaleEncounter, target = renderer) => {
    save(beat, target); target.update(0, undefined, 0);
    for (const actor of actors) {
      const root = target.getAgent(actor.id)!; root.updateMatrixWorld(true);
      root.traverse(object => { if (object instanceof THREE.SkinnedMesh) object.skeleton.update(); });
    }
  };
  const neo = renderer.getAgentBody('neo')!, smith = renderer.getAgentBody('smith')!;
  assert.ok(neo.getObjectByName('wrist_R') instanceof THREE.Bone && smith.getObjectByName('chest') instanceof THREE.Bone, 'use the actual shipped bodies');
  t.after(() => { renderer.dispose(); if (previous) Object.defineProperty(globalThis, 'document', previous); else Reflect.deleteProperty(globalThis, 'document'); });
  return { renderer, neo, smith, save, frame };
}

function fist(body: THREE.Group, side: 'R' | 'L') {
  const wrist = body.getObjectByName(`wrist_${side}`)!, samples: { local: THREE.Vector3; world: THREE.Vector3 }[] = [];
  body.traverseVisible(object => {
    if (!(object instanceof THREE.SkinnedMesh) || (object.material as THREE.Material).name !== 'Skin') return;
    const joints = object.geometry.attributes.skinIndex, weights = object.geometry.attributes.skinWeight;
    for (let i = 0; i < object.geometry.attributes.position.count; i++) {
      let weight = 0;
      for (let k = 0; k < 4; k++) if (new RegExp(`^finger[2345]-[12]_${side}$`).test(object.skeleton.bones[joints.getComponent(i, k)].name)) weight += weights.getComponent(i, k);
      if (weight < .6) continue;
      const world = object.localToWorld(object.getVertexPosition(i, new THREE.Vector3()));
      samples.push({ world, local: wrist.worldToLocal(world.clone()) });
    }
  });
  assert.ok(samples.length > 1000, 'sample the actual index-to-little-finger skin rather than wrist bones');
  const leading = Math.min(...samples.map(point => point.local.y));
  return samples.filter(point => point.local.y < leading + .025).map(point => point.world);
}

function chest(body: THREE.Group) {
  const bone = body.getObjectByName('chest')!, mesh = body.getObjectByName('Tailored_coat_upper') as THREE.SkinnedMesh;
  assert.ok(mesh instanceof THREE.SkinnedMesh && (mesh.material as THREE.Material).name === 'Charcoal suit and shirt');
  const positions = mesh.geometry.attributes.position, points: THREE.Vector3[] = [];
  for (let i = 0; i < positions.count; i++) points.push(bone.worldToLocal(mesh.localToWorld(mesh.getVertexPosition(i, new THREE.Vector3()))));
  const index = mesh.geometry.index!, triangles: THREE.Triangle[] = [];
  for (let i = 0; i < index.count; i += 3) {
    const vertices = [points[index.getX(i)], points[index.getX(i + 1)], points[index.getX(i + 2)]];
    if (vertices.every(point => Math.abs(point.x) < .7 && point.y > -.3 && point.y < .65 && point.z > .15)) triangles.push(new THREE.Triangle(...vertices as [THREE.Vector3, THREE.Vector3, THREE.Vector3]));
  }
  assert.ok(triangles.length > 100, 'measure the posed suit front, not an approximate chest sphere');
  return { bone, triangles };
}

function contact(neo: THREE.Group, smith: THREE.Group, side: 'R' | 'L') {
  const target = chest(smith), points = fist(neo, side).map(point => target.bone.worldToLocal(point));
  const closest = new THREE.Vector3(), crossing = new THREE.Vector3(), ray = new THREE.Ray();
  let gap = Infinity, penetration = 0;
  for (const point of points) {
    ray.set(new THREE.Vector3(point.x, point.y, 1.5), new THREE.Vector3(0, 0, -1));
    let front = -Infinity;
    for (const triangle of target.triangles) {
      gap = Math.min(gap, point.distanceTo(triangle.closestPointToPoint(point, closest)));
      if (ray.intersectTriangle(triangle.a, triangle.b, triangle.c, false, crossing)) front = Math.max(front, crossing.z);
    }
    penetration = Math.max(penetration, front - point.z);
  }
  return { gap, penetration };
}

const neutral = { focus: false, x: 0, z: 0 };
const counter = () => smithFinaleAction({ ...newSmithFinale(), phase: 'ground_dodge' }, 'dodge');
const advance = (beat: SmithFinaleEncounter, dt: number) => stepSmithFinale(beat, neutral, dt);

test('impact leaves Neo lying in the water while Smith stands, and rising keeps real surfaces above the floor', async t => {
  const h = await setup(t), floor = FILM_SETS.film_smith_avenue.center.y - 1 - SMITH_FINALE.crater.depth + .025;
  let worst = Infinity;
  for (const focus of [0, .3, .65, 1, 1.4, 1.8]) {
    const beat: SmithFinaleEncounter = { ...newSmithFinale(), phase: 'crater', elapsed: 3, total: 23, focus };
    h.frame(beat);
    if (focus === 0) {
      assert.ok(h.neo.getObjectByName('head')!.getWorldPosition(new THREE.Vector3()).y < floor + 1.3, 'Neo should be lying after impact, not hovering in a bent standing pose');
      assert.ok(h.smith.getObjectByName('head')!.getWorldPosition(new THREE.Vector3()).y > floor + 2.8, 'Smith stands over Neo rather than copying his collapse');
      for (const side of ['R', 'L']) assert.ok(h.neo.getObjectByName(`wrist_${side}`)!.getWorldPosition(new THREE.Vector3()).y < floor + .28,
        `the resting ${side} hand cannot hang in the air above the water`);
    }
    for (const [role, body] of [['Neo', h.neo], ['Smith', h.smith]] as const) {
      let lowest = Infinity;
      body.traverseVisible(object => {
        if (!(object instanceof THREE.Mesh)) return;
        for (let i = 0; i < object.geometry.attributes.position.count; i++) {
          const point = object.localToWorld(object.getVertexPosition(i, new THREE.Vector3()));
          lowest = Math.min(lowest, point.y - floor);
        }
      });
      worst = Math.min(worst, lowest);
      assert.ok(lowest >= -.04, `${role}, rise ${focus}: visible body penetrates the bottom by ${-lowest}`);
      assert.ok(lowest < .08, `${role}, rise ${focus}: visible body floats ${lowest} over the bottom`);
    }
  }
  t.diagnostic(`Lowest actual skin/clothing/sole distance from the pit floor: ${worst}`);
});

test('the delivered bodies keep their support and orientation across impact, failure and standing', async t => {
  const h = await setup(t);
  const transitions: SmithFinaleEncounter[] = [
    { ...newSmithFinale(), phase: 'descent', elapsed: SMITH_FINALE.descent.seconds - .00001, total: 23, focus: SMITH_FINALE.descent.braceSeconds },
    { ...newSmithFinale(), phase: 'descent', elapsed: SMITH_FINALE.descent.seconds - .00001, total: 23, focus: 0 },
    { ...newSmithFinale(), phase: 'crater', elapsed: 3, total: 26, focus: SMITH_FINALE.crater.riseSeconds - .00001 },
  ];
  const points = () => [h.neo, h.smith].flatMap(body => ['head', 'wrist_R', 'wrist_L', 'ankle_R', 'ankle_L']
    .map(name => body.getObjectByName(name)!.getWorldPosition(new THREE.Vector3())));
  for (const before of transitions) {
    h.frame(before); const old = points();
    const next = stepSmithFinale(before, { focus: before.focus > 0, x: 0, z: 0 }, .00001);
    h.frame(next);
    points().forEach((point, i) => assert.ok(point.distanceTo(old[i]) < .004,
      `${before.phase} → ${next.phase}: body point ${i} jumps ${point.distanceTo(old[i])}`));
  }
});

test('getting up plants the delivered boots before releasing the supporting hands', async t => {
  const h = await setup(t), floor = FILM_SETS.film_smith_avenue.center.y - 1 - SMITH_FINALE.crater.depth + .025;
  for (const rise of [.35, .5, .65, .8, .95]) {
    h.frame({ ...newSmithFinale(), phase: 'crater', elapsed: 3, total: 23, focus: rise * SMITH_FINALE.crater.riseSeconds });
    const feet = [Infinity, Infinity];
    h.neo.traverseVisible(object => {
      if (!(object instanceof THREE.Mesh) || !/shoes/i.test(object.name)) return;
      const position = object.geometry.attributes.position;
      for (let i = 0; i < position.count; i++) {
        const side = position.getX(i) > 0 ? 1 : 0;
        const point = object.localToWorld(object.getVertexPosition(i, new THREE.Vector3()));
        feet[side] = Math.min(feet[side], point.y - floor);
      }
    });
    assert.ok(Math.min(...feet) < .08, `rise ${rise}: both boots float above the water: ${feet}`);
    assert.ok(Math.min(...feet) >= -.04, `rise ${rise}: a boot penetrates the bottom: ${feet}`);
    if (rise >= .65) assert.ok(Math.max(...feet) < .08, `rise ${rise}: the second foot must land before straightening up: ${feet}`);
  }
});

test('the shockwave reaches the aerial checkpoint without teleporting either actual body', async t => {
  const h = await setup(t);
  for (const lane of [-1, 0, .6]) for (const total of [4, 37]) {
    const beat: SmithFinaleEncounter = { ...newSmithFinale(), phase: 'shockwave', hits: 2, lane,
      elapsed: SMITH_FINALE.shockwave - .00001, total };
    h.frame(beat);
    const points = [h.neo, h.smith].flatMap(body => ['head', 'wrist_R', 'wrist_L', 'ankle_R', 'ankle_L']
      .map(name => body.getObjectByName(name)!.getWorldPosition(new THREE.Vector3())));
    const next = advance(beat, .00001); assert.equal(next.phase, 'air_warning'); h.frame(next);
    const after = [h.neo, h.smith].flatMap(body => ['head', 'wrist_R', 'wrist_L', 'ankle_R', 'ankle_L']
      .map(name => body.getObjectByName(name)!.getWorldPosition(new THREE.Vector3())));
    after.forEach((point, index) => assert.ok(point.distanceTo(points[index]) < .002,
      `lane ${lane}, clock ${total}: body point ${index} jumps ${point.distanceTo(points[index])} at lift-off`));
  }
});

test('the second punch releases its guard continuously into the shockwave flight', async t => {
  const h = await setup(t);
  const first = smithFinaleAction(advance(counter(), 1.2), 'attack');
  const second = smithFinaleAction(advance(first, .4), 'attack');
  h.frame(advance(second, .34 - .00001));
  const hands = [h.neo, h.smith].flatMap(body => ['R', 'L'].map(side => body.getObjectByName(`wrist_${side}`)!.getWorldPosition(new THREE.Vector3())));
  h.frame(advance(second, .34 + .00001));
  const next = [h.neo, h.smith].flatMap(body => ['R', 'L'].map(side => body.getObjectByName(`wrist_${side}`)!.getWorldPosition(new THREE.Vector3())));
  next.forEach((point, index) => assert.ok(point.distanceTo(hands[index]) < .001, `the guard-to-flight hand jumps by ${point.distanceTo(hands[index])}`));
});

function assertContact(neo: THREE.Group, smith: THREE.Group, side: 'R' | 'L', label: string) {
  const measured = contact(neo, smith, side);
  assert.ok(measured.gap < .08, `${label}: actual ${side} knuckle skin misses the actual chest surface by ${measured.gap}`);
  assert.ok(measured.penetration <= .04, `${label}: actual ${side} knuckle skin penetrates the suit by ${measured.penetration}`);
  return measured;
}

test('waiting in the counter window never throws an unrequested punch', async t => {
  const h = await setup(t), waiting = counter();
  const hands: THREE.Vector3[][] = [];
  for (const elapsed of [0, .17, 1.2]) {
    const beat = { ...waiting, elapsed, total: 2 };
    assert.equal(smithFinalePose(beat).strike, 0, `no attack was accepted at ${elapsed}`);
    h.frame(beat);
    hands.push(['R', 'L'].map(side => h.neo.getObjectByName(`wrist_${side}`)!.getWorldPosition(new THREE.Vector3())));
  }
  for (const pose of hands.slice(1)) pose.forEach((point, index) => assert.ok(point.distanceTo(hands[0][index]) < .00001, 'the real guard cannot secretly punch while waiting'));
});

test('a delayed first counter lands the real right knuckles on Smith’s posed suit without penetrating it', async t => {
  const h = await setup(t);
  for (const delay of [1.2, 0, 3.7]) {
    const waiting = advance(counter(), delay); h.frame(waiting);
    const guard = h.neo.getObjectByName('wrist_R')!.getWorldPosition(new THREE.Vector3());
    const accepted = smithFinaleAction(waiting, 'attack');
    assert.equal(accepted.hits, 1); assert.equal(accepted.lastStrike, delay);
    const peak = advance(accepted, .17); h.frame(peak);
    const measured = assertContact(h.neo, h.smith, 'R', `first attack at ${delay}`);
    assert.ok(h.neo.getObjectByName('wrist_R')!.getWorldPosition(new THREE.Vector3()).distanceTo(guard) > .3, 'the actual wrist must move through the rendered attack');
    const guarded = contact(h.neo, h.smith, 'L').gap;
    assert.ok(guarded > .15, `the other hand remains in guard on the first punch; actual skin gap ${guarded}`);
    assert.ok(smithFinalePose(peak).strike > .99, 'peak timing is measured from the accepted input, not entry into the counter window');
    t.diagnostic(`first strike at ${delay}: skin gap ${measured.gap}, penetration ${measured.penetration}`);
  }
});

test('the second accepted counter lands the left fist before the shockwave lifts the fighters', async t => {
  const h = await setup(t);
  for (const delay of [.4, 1.1]) {
    const first = smithFinaleAction(advance(counter(), 1.2), 'attack');
    const second = smithFinaleAction(advance(first, delay), 'attack');
    assert.equal(second.phase, 'shockwave'); assert.equal(second.hits, 2); assert.equal(second.elapsed, 0);
    const peak = advance(second, .17); h.frame(peak);
    const measured = assertContact(h.neo, h.smith, 'L', `second attack after ${delay}`);
    const guarded = contact(h.neo, h.smith, 'R').gap;
    assert.ok(guarded > .15, `the right fist retracts while the left lands; actual skin gap ${guarded}`);
    assert.ok(smithFinalePose(peak).strike > .99);
    assert.equal(smithFinalePose(peak).flight, 0, 'the second fist must land before the bodies fly apart');
    const flight = advance(second, .8); h.frame(flight);
    assert.ok(contact(h.neo, h.smith, 'L').gap > .5, 'the shockwave releases the fist and separates the bodies');
    assert.ok(smithFinalePose(flight).flight > .5);
    assert.equal(advance(second, SMITH_FINALE.shockwave - .001).phase, 'shockwave');
    assert.equal(advance(second, SMITH_FINALE.shockwave).phase, 'air_warning');
    t.diagnostic(`second strike after ${delay}: skin gap ${measured.gap}, penetration ${measured.penetration}`);
  }
});

test('both real fists stay outside Smith’s suit throughout each accepted punch', async t => {
  const h = await setup(t), first = smithFinaleAction(advance(counter(), 1.2), 'attack');
  const second = smithFinaleAction(advance(first, .4), 'attack');
  let deepest = 0;
  for (const [side, accepted] of [['R', first], ['L', second]] as const) {
    for (const age of [0, .08, .12, .15, .17, .20, .24, .28, .34]) {
      h.frame(advance(accepted, age));
      for (const hand of ['R', 'L'] as const) {
        const measured = contact(h.neo, h.smith, hand); deepest = Math.max(deepest, measured.penetration);
        assert.ok(measured.penetration <= .04, `${side} attack at ${age}: ${hand} knuckle skin penetrates the suit by ${measured.penetration}`);
        if (age === .17 && hand === side) assert.ok(measured.gap < .08, `${side} peak: actual knuckle skin gap ${measured.gap}`);
      }
    }
  }
  t.diagnostic(`maximum penetration across both complete punches: ${deepest}`);
});

test('the actual wrists and contact surfaces match after cold loading and reverse seeking each punch peak', async t => {
  const h = await setup(t), first = smithFinaleAction(advance(counter(), 1.2), 'attack');
  const second = smithFinaleAction(advance(first, .4), 'attack');
  const snapshot = (renderer: AgentRenderer, side: 'R' | 'L') => {
    const neo = renderer.getAgentBody('neo')!, smith = renderer.getAgentBody('smith')!, suit = chest(smith);
    return [
      ...[neo, smith].flatMap(body => ['R', 'L'].map(hand => body.getObjectByName(`wrist_${hand}`)!.getWorldPosition(new THREE.Vector3()))),
      ...fist(neo, side),
      ...suit.triangles.flatMap(triangle => [triangle.a, triangle.b, triangle.c].map(point => suit.bone.localToWorld(point.clone()))),
    ];
  };
  const same = (actual: THREE.Vector3[], expected: THREE.Vector3[], label: string) => {
    assert.equal(actual.length, expected.length, `${label}: the sampled skin or suit topology changed`);
    const error = Math.max(...actual.map((point, index) => point.distanceTo(expected[index])));
    assert.ok(error < .00001, `${label}: the real wrist/skin/suit moved ${error}`);
  };
  for (const [side, accepted] of [['R', first], ['L', second]] as const) {
    for (const age of [0, .08, .12, .15, .17]) h.frame(advance(accepted, age));
    const peak = advance(accepted, .17), forward = snapshot(h.renderer, side);
    h.frame(peak); same(snapshot(h.renderer, side), forward, `${side} paused peak`);
    for (const age of [.34, .28, .24, .20, .17]) h.frame(advance(accepted, age));
    same(snapshot(h.renderer, side), forward, `${side} reverse-seek peak`);
    const cold = new AgentRenderer(new THREE.Scene());
    try {
      h.save(peak, cold); await new Promise(resolve => setImmediate(resolve)); h.frame(peak, cold);
      same(snapshot(cold, side), forward, `${side} first cold peak`);
    } finally { cold.dispose(); }
  }
});
