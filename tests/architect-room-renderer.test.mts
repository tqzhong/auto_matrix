import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ArchitectRoomRenderer } from '../packages/client/src/engine/ArchitectRoomRenderer.js';
import { ARCHITECT_ROOM, FILM_SETS, architectDoorAngle, type ArchitectEncounter } from '@auto_matrix/shared';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import type { MotionInput } from '../packages/client/src/agents/CharacterMotion.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { crossings } from './helpers/hand-self-contact.mjs';
import { capsuleTriangleGap } from './helpers/pill-prop-contact.mjs';

async function shipped(name: string) {
  const bytes = await readFile(new URL(`../packages/client/public/assets/characters/${name}.glb`, import.meta.url));
  const length = bytes.readUInt32LE(12), document = JSON.parse(bytes.subarray(20, 20 + length).toString());
  // Keep actual shipped geometry and skinning; Node has no browser image decoder.
  for (const material of document.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const binary = bytes.subarray(20 + length), output = Buffer.alloc(20 + padded.length + binary.length);
  output.writeUInt32LE(0x46546c67, 0); output.writeUInt32LE(2, 4); output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(padded.length, 12); output.writeUInt32LE(0x4e4f534a, 16); padded.copy(output, 20); binary.copy(output, 20 + padded.length);
  const asset = await new GLTFLoader().parseAsync(output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength), '');
  if (name.endsWith('-head')) asset.scene.traverse(object => { if (object instanceof THREE.Mesh) (object.material as THREE.MeshStandardMaterial).map = new THREE.Texture(); });
  return asset;
}
async function fixture(t: TestContext, coatOpening = false) {
  const assets = Object.fromEntries(await Promise.all(['architect-head', 'architect-body', 'neo', 'neo-office', 'neo-tracking', 'trinity', 'trinity-club', 'smith', 'morpheus', 'choi', 'dujour'].map(async name => [name, await shipped(name)])));
  if (coatOpening) {
    for (const name of ['architect-tailored-jacket', 'architect-shirt']) {
      const part = assets['architect-body'].scene.getObjectByName(name) as THREE.SkinnedMesh;
      // Zero displacements isolate the real rig's shared costume driver from fitting.
      part.geometry.morphAttributes.position = [new THREE.BufferAttribute(new Float32Array(part.geometry.attributes.position.count * 3), 3)];
      part.geometry.morphTargetsRelative = true; part.updateMorphTargets(); part.morphTargetDictionary = { 'architect-seated-opening': 0 };
    }
  }
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async url => assets[String(url).split('/').pop()!.replace('.glb', '')]);
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {},
    createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  const rig = models.create(world.agents.get('architect')!);
  t.after(() => { models.dispose(); globalThis.document = previous; });
  const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, performance: true, seated: true,
    architect: { role: 'architect', phase: 'cycles', elapsed: 3, chairYaw: 0 } } as MotionInput;
  const pose = () => { models.animate(rig, .1, input, 1); rig.root.updateMatrixWorld(true); };
  pose(); await new Promise(resolve => setImmediate(resolve)); for (let i = 0; i < 40; i++) pose();
  return { rig, pose, input, models, world };
}
test('the seated Architect’s actual shoes rest at the room floor', async t => {
  const { rig } = await fixture(t);
  const body = rig.root.getObjectByName('architect-detailed-body')!; assert.ok(body);
  const shoes: THREE.SkinnedMesh[] = [];
  body.traverse(object => { if (object instanceof THREE.SkinnedMesh && object.name.includes('work-boots')) shoes.push(object); });
  assert.ok(shoes.length); let bottom = Infinity;
  for (const shoe of shoes) {
    shoe.skeleton.update();
    for (let i = 0; i < shoe.geometry.attributes.position.count; i++) bottom = Math.min(bottom, shoe.localToWorld(shoe.getVertexPosition(i, new THREE.Vector3())).y);
  }
  console.log('Actual seated shoe minimum:', bottom);
  // Character root and set root both receive the -1 runtime offset, so the
  // floor is zero in this fixture; the old generic sitting pose was below it.
  assert.ok(bottom >= -.012 && bottom < .035, `shoes float or penetrate the floor: ${bottom}, floor 0`);
});

test('the coat opening follows both actual thighs through sitting, partial bending, walking and restoration', async t => {
  const h = await fixture(t, true), parts = ['architect-tailored-jacket', 'architect-shirt'].map(name => h.rig.root.getObjectByName(name) as THREE.SkinnedMesh);
  const influence = () => {
    const values = parts.map(part => part.morphTargetInfluences![part.morphTargetDictionary!['architect-seated-opening']]);
    assert.ok(values.every(value => value === values[0]), 'attached costume parts must share the coat opening');
    return values[0];
  };
  assert.equal(influence(), 1, 'the complete sitting pose must open the coat');
  h.rig.hips.forEach(hip => hip.rotation.set(-.8, 0, 0)); h.rig.root.updateMatrixWorld(true);
  assert.ok(influence() > 0 && influence() < 1, 'a partial bend must retain a partial opening');
  h.rig.hips[0].rotation.x = -.2; h.rig.root.updateMatrixWorld(true);
  assert.equal(influence(), 0, 'one raised thigh must not open both front panels');
  for (let frame = 0; frame < 12; frame++) h.pose();
  h.input.architect = undefined; h.input.seated = false; h.input.performance = undefined;
  for (let frame = 0; frame < 12; frame++) { h.pose(); assert.ok(influence() >= 0 && influence() <= 1); }
  assert.equal(influence(), 0, 'the completed exit must release the seated coat shape');
  for (const speed of [0, 2.5]) {
    h.input.speed = speed;
    for (let frame = 0; frame < 24; frame++) { h.pose(); assert.equal(influence(), 0, 'standing or walking retained the seated coat shape'); }
  }
  h.input.speed = 0; h.input.seated = true; h.input.performance = true;
  h.input.architect = { role: 'architect', phase: 'cycles', elapsed: 3, chairYaw: 0 };
  for (let frame = 0; frame < 12; frame++) h.pose();
  assert.equal(influence(), 1, 'restoring the actual sitting pose must restore its coat shape');
});

test('actual Architect hands sit above the armrest surface instead of sinking into the leather', async t => {
  const h = await fixture(t), body = h.rig.root.getObjectByName('architect-detailed-body')!;
  let minimum = Infinity, count = 0;
  body.traverse(object => {
    if (!(object instanceof THREE.SkinnedMesh) || object.name !== 'architect-anatomical-body') return;
    object.skeleton.update();
    const positions = object.geometry.attributes.position, skin = object.geometry.attributes.skinIndex, weights = object.geometry.attributes.skinWeight;
    for (let i = 0; i < positions.count; i++) {
      const indices = [skin.getX(i), skin.getY(i), skin.getZ(i), skin.getW(i)], values = [weights.getX(i), weights.getY(i), weights.getZ(i), weights.getW(i)];
      if (!indices.some((index, j) => values[j] > .5 && /wrist|finger|thumb/.test(object.skeleton.bones[index].name))) continue;
      const v = h.rig.detail.worldToLocal(object.localToWorld(object.getVertexPosition(i, new THREE.Vector3())));
      if (Math.abs(Math.abs(v.x) - .84) < .16 && v.z > -.15 && v.z < .65) { minimum = Math.min(minimum, v.y); count++; }
    }
  });
  console.log('Actual hand surface above leather:', minimum, count);
  assert.ok(count > 20); assert.ok(minimum >= ARCHITECT_ROOM.chair.arm + .0525 - .025, `hand surface enters the armrest: ${minimum}`);
});

test('the Architect rests his real left palm downward on the chair', async t => {
  const h = await fixture(t), skin = h.rig.root.getObjectByName('architect-anatomical-body') as THREE.SkinnedMesh;
  const room = new THREE.Group(), renderer = new ArchitectRoomRenderer(room); t.after(() => renderer.dispose());
  room.position.z = -ARCHITECT_ROOM.chair.z; room.updateMatrixWorld(true);
  const wrist = skin.skeleton.bones.findIndex(bone => bone.name === 'wrist_L');
  const attrs = skin.geometry.attributes, point = new THREE.Vector3(), normal = new THREE.Vector3(), mean = new THREE.Vector3();
  const transform = skin.matrixWorld.clone().multiply(skin.bindMatrixInverse)
    .multiply(skin.skeleton.bones[wrist].matrixWorld).multiply(skin.skeleton.boneInverses[wrist]).multiply(skin.bindMatrix);
  let count = 0, supported = 0, gap = Infinity;
  for (let vertex = 0; vertex < attrs.position.count; vertex++) {
    if (![0, 1, 2, 3].some(part => attrs.skinIndex.getComponent(vertex, part) === wrist && attrs.skinWeight.getComponent(vertex, part) > .99)) continue;
    point.fromBufferAttribute(attrs.position, vertex).applyMatrix4(skin.bindMatrix).applyMatrix4(skin.skeleton.boneInverses[wrist]);
    normal.fromBufferAttribute(attrs.normal, vertex);
    if (Math.abs(point.x) > .065 || point.y < -.14 || point.y > -.04 || normal.z > -.6) continue;
    mean.add(normal.transformDirection(transform)); count++;
    const contact = skin.localToWorld(skin.getVertexPosition(vertex, new THREE.Vector3()));
    const hit = new THREE.Raycaster(contact, new THREE.Vector3(0, -1, 0), 0, .05).intersectObject(renderer.chair, true)[0];
    if (hit) { supported++; gap = Math.min(gap, hit.distance); }
  }
  assert.ok(count > 30, `missing actual palm surface: ${count}`);
  const down = mean.normalize().dot(new THREE.Vector3(0, -1, 0));
  assert.ok(down > .9, `the left palm faces upward or sideways: downward alignment ${down}`);
  assert.ok(supported > 20 && gap < .02, `the real palm floats above the armrest: ${supported} samples, gap ${gap}`);
});

test('the Architect pinches the visible pen between actual thumb and index surfaces without piercing his hand', async t => {
  const h = await fixture(t), skin = h.rig.root.getObjectByName('architect-anatomical-body') as THREE.SkinnedMesh;
  const pen = h.rig.architectPen!, shaft = pen.children.find(object => object instanceof THREE.Mesh && object.geometry instanceof THREE.CylinderGeometry) as THREE.Mesh<THREE.CylinderGeometry>;
  skin.skeleton.update(); const attrs = skin.geometry.attributes, index = skin.geometry.index!, points = new Map<number, THREE.Vector3>();
  const has = (vertex: number, pattern: RegExp) => [0, 1, 2, 3].some(part => attrs.skinWeight.getComponent(vertex, part) > .05 && pattern.test(skin.skeleton.bones[attrs.skinIndex.getComponent(vertex, part)].name));
  const hand = [];
  for (let offset = 0; offset < index.count; offset += 3) {
    const ids = [0, 1, 2].map(part => index.getX(offset + part));
    if (!ids.some(vertex => has(vertex, /^(?:wrist|thumb\w*|finger\w*)_R$/))) continue;
    const triangle = ids.map(vertex => {
      if (!points.has(vertex)) points.set(vertex, skin.localToWorld(skin.getVertexPosition(vertex, new THREE.Vector3())));
      return points.get(vertex)!;
    });
    hand.push({ face: offset / 3, ids, points: triangle, box: new THREE.Box3().setFromPoints(triangle) });
  }
  const penFaces: typeof hand = [];
  pen.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const a = object.geometry.attributes.position, indices = object.geometry.index;
    for (let offset = 0; offset < (indices?.count ?? a.count); offset += 3) {
      const ids = [0, 1, 2].map(part => indices ? indices.getX(offset + part) : offset + part);
      const triangle = ids.map(vertex => object.localToWorld(new THREE.Vector3().fromBufferAttribute(a, vertex)));
      penFaces.push({ face: penFaces.length, ids, points: triangle, box: new THREE.Box3().setFromPoints(triangle) });
    }
  });
  const contact = crossings(penFaces, hand, false);
  assert.equal(contact.count, 0, `pen crosses the actual hand: ${JSON.stringify(contact)}`);
  const weld = new Map<string, number>(), welded = new Map<number, number>();
  for (const vertex of points.keys()) {
    const key = [attrs.position.getX(vertex), attrs.position.getY(vertex), attrs.position.getZ(vertex)].map(value => value.toFixed(6)).join(',');
    if (!weld.has(key)) weld.set(key, weld.size); welded.set(vertex, weld.get(key)!);
  }
  const surface = hand.map(face => ({ ...face, ids: face.ids.map(vertex => welded.get(vertex)!) }));
  const self = crossings(surface, surface);
  assert.equal(self.count, 0, `the pen grip folds the real hand through itself: ${JSON.stringify(self)}`);
  const gaps = { thumb: Infinity, index: Infinity }, radius = shaft.geometry.parameters.radiusTop, length = shaft.geometry.parameters.height;
  for (const face of hand) {
    const triangle = face.points.map(point => shaft.worldToLocal(point.clone())) as [THREE.Vector3, THREE.Vector3, THREE.Vector3];
    const gap = capsuleTriangleGap(triangle, radius, length);
    if (face.ids.some(vertex => has(vertex, /^thumb\w*_R$/))) gaps.thumb = Math.min(gaps.thumb, gap);
    if (face.ids.some(vertex => has(vertex, /^finger3\w*_R$/))) gaps.index = Math.min(gaps.index, gap);
  }
  console.log('Actual pen grip gaps:', gaps);
  for (const [digit, gap] of Object.entries(gaps)) assert.ok(gap >= -.001 && gap < .004, `${digit} misses or penetrates the pen: ${gap}`);
});

test('the complete Architect hands and pen clear the real chair without hand self intersections', async t => {
  const h = await fixture(t), skin = h.rig.root.getObjectByName('architect-anatomical-body') as THREE.SkinnedMesh;
  const room = new THREE.Group(), renderer = new ArchitectRoomRenderer(room); t.after(() => renderer.dispose());
  room.position.z = -ARCHITECT_ROOM.chair.z; room.updateMatrixWorld(true); skin.skeleton.update();
  const attrs = skin.geometry.attributes, indices = skin.geometry.index!, points = new Map<number, THREE.Vector3>();
  const hands = [], weld = new Map<string, number>(), welded = new Map<number, number>();
  for (let offset = 0; offset < indices.count; offset += 3) {
    const ids = [0, 1, 2].map(part => indices.getX(offset + part));
    if (!ids.some(vertex => [0, 1, 2, 3].some(part => attrs.skinWeight.getComponent(vertex, part) > .05 && /^(wrist|thumb\w*|finger\w*)_[RL]$/.test(skin.skeleton.bones[attrs.skinIndex.getComponent(vertex, part)].name)))) continue;
    const triangle = ids.map(vertex => {
      if (!points.has(vertex)) {
        points.set(vertex, skin.localToWorld(skin.getVertexPosition(vertex, new THREE.Vector3())));
        const key = [attrs.position.getX(vertex), attrs.position.getY(vertex), attrs.position.getZ(vertex)].map(value => value.toFixed(6)).join(',');
        if (!weld.has(key)) weld.set(key, weld.size); welded.set(vertex, weld.get(key)!);
      }
      return points.get(vertex)!;
    });
    hands.push({ face: offset / 3, ids, points: triangle, box: new THREE.Box3().setFromPoints(triangle) });
  }
  assert.ok(hands.length > 20000, `the complete hand surfaces are required: ${hands.length}`);
  const surface = hands.map(face => ({ ...face, ids: face.ids.map(vertex => welded.get(vertex)!) }));
  const self = crossings(surface, surface); assert.equal(self.count, 0, JSON.stringify(self));
  const faces = (root: THREE.Object3D) => {
    const result: typeof hands = [];
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const a = object.geometry.attributes.position, index = object.geometry.index;
      for (let offset = 0; offset < (index?.count ?? a.count); offset += 3) {
        const ids = [0, 1, 2].map(part => index ? index.getX(offset + part) : offset + part);
        const triangle = ids.map(vertex => object.localToWorld(new THREE.Vector3().fromBufferAttribute(a, vertex)));
        result.push({ face: result.length, ids, points: triangle, box: new THREE.Box3().setFromPoints(triangle) });
      }
    });
    return result;
  };
  const result = crossings([...hands, ...faces(h.rig.architectPen!)], faces(renderer.chair), false);
  assert.equal(result.count, 0, `hand or pen enters the chair: ${JSON.stringify(result)}`);
});

test('the complete Architect skin and head stay clear through seated head turns and standing', async t => {
  const h = await fixture(t), mesh = h.rig.root.getObjectByName('architect-anatomical-body') as THREE.SkinnedMesh;
  const head = h.rig.root.getObjectByName('architect-anatomical-head') as THREE.Mesh;
  const positions = mesh.geometry.attributes.position;
  assert.ok(Array.from({ length: positions.count }, (_, vertex) => positions.getY(vertex)).filter(y => y > 3.4).length > 400, 'the anatomical neck must remain present');
  const surface = (mesh: THREE.Mesh) => {
    if (mesh instanceof THREE.SkinnedMesh) mesh.skeleton.update();
    const attrs = mesh.geometry.attributes, index = mesh.geometry.index!, weld = new Map<string, number>(), points = new Map<number, THREE.Vector3>(), welded = new Map<number, number>(), faces = [];
    for (let offset = 0; offset < index.count; offset += 3) {
      const ids = [0, 1, 2].map(part => index.getX(offset + part));
      const triangle = ids.map(vertex => {
        if (!points.has(vertex)) {
          points.set(vertex, mesh.localToWorld(mesh.getVertexPosition(vertex, new THREE.Vector3())));
          const key = new THREE.Vector3().fromBufferAttribute(attrs.position, vertex).toArray().map(value => value.toFixed(6)).join(',');
          if (!weld.has(key)) weld.set(key, weld.size); welded.set(vertex, weld.get(key)!);
        }
        return points.get(vertex)!;
      });
      faces.push({ face: offset / 3, ids: ids.map(vertex => welded.get(vertex)!), points: triangle, box: new THREE.Box3().setFromPoints(triangle) });
    }
    return faces;
  };
  const states = [];
  for (const elapsed of [0, 3, 9, undefined]) {
    if (elapsed === undefined) { h.input.architect = undefined; h.input.seated = false; h.input.performance = undefined; for (let frame = 0; frame < 12; frame++) h.pose(); }
    else { h.input.architect!.elapsed = elapsed; h.pose(); }
    const body = surface(mesh), skull = surface(head);
    states.push({ state: elapsed === undefined ? 'standing' : `seated-${elapsed}`, self: crossings(body, body), headBody: crossings(body, skull, false) });
  }
  console.log('Full Architect skin/head contacts:', JSON.stringify(states));
  assert.ok(states.every(state => state.self.count === 0 && state.headBody.count === 0), JSON.stringify(states));
});

test('the saved Architect body and pen restore after walking and reverse story-clock changes', async t => {
  const h = await fixture(t), saved = structuredClone(h.input);
  const snapshot = () => {
    const result: { name: string; positions: number[] }[] = [];
    h.rig.root.updateMatrixWorld(true);
    h.rig.root.getObjectByName('architect-detailed-body')!.traverse(object => {
      if (!(object instanceof THREE.SkinnedMesh)) return;
      object.skeleton.update(); const positions: number[] = [], point = new THREE.Vector3();
      for (let vertex = 0; vertex < object.geometry.attributes.position.count; vertex++)
        positions.push(...object.localToWorld(object.getVertexPosition(vertex, point)).toArray());
      result.push({ name: object.name, positions });
    });
    return { meshes: result, pen: h.rig.architectPen!.matrixWorld.toArray(), visible: h.rig.architectPen!.visible };
  };
  const expected = snapshot();
  h.input.architect = undefined; h.input.seated = false; h.input.performance = undefined; h.input.speed = 2.5;
  for (let frame = 0; frame < 12; frame++) h.pose();
  assert.equal(h.rig.architectPen!.visible, false);
  for (const thumb of h.rig.architectThumbs!) assert.deepEqual(thumb.quaternion.toArray(), [0, 0, 0, 1]);
  Object.assign(h.input, saved);
  for (const elapsed of [9, 0, 6, 3]) { h.input.architect!.elapsed = elapsed; h.pose(); }
  assert.deepEqual(snapshot(), expected, 'the complete body or pen retained a previous pose');
});

test('leaving the Architect encounter restores normal hip placement for standing and walking', async t => {
  const h = await fixture(t), saved = structuredClone(h.input);
  const skin = h.rig.root.getObjectByName('architect-anatomical-body') as THREE.SkinnedMesh;
  const pelvis = skin.skeleton.bones.find(bone => bone.name === 'pelvis')!;
  for (const speed of [0, 2.5]) {
    Object.assign(h.input, saved); h.pose();
    assert.ok(h.rig.hips.every(hip => hip.position.z === -.06), 'exercise the actual seated hip offset');
    h.input.architect = undefined; h.input.seated = false; h.input.performance = undefined; h.input.speed = speed;
    for (let frame = 0; frame < 12; frame++) h.pose();
    assert.ok(h.rig.hips.every(hip => hip.position.z === 0), `speed ${speed}: the seated hip offset survives leaving the encounter`);
    assert.ok(Math.abs(h.rig.detail.worldToLocal(pelvis.getWorldPosition(new THREE.Vector3())).z) < 1e-7,
      `speed ${speed}: the actual body pelvis keeps a different depth from its standing torso`);
  }
});

test('the Architect’s jacket pockets stay on his torso when his forearms move', async t => {
  const h = await fixture(t), body = h.rig.root.getObjectByName('architect-detailed-body')!;
  const pockets = [-1, 1].map(side => body.getObjectByName(`architect-welt-pocket-${side}`) as THREE.SkinnedMesh);
  const surface = () => pockets.map(mesh => {
    assert.ok(mesh instanceof THREE.SkinnedMesh); mesh.skeleton.update();
    return Array.from({ length: mesh.geometry.attributes.position.count }, (_, vertex) =>
      mesh.localToWorld(mesh.getVertexPosition(vertex, new THREE.Vector3())));
  });
  const before = surface();
  h.rig.elbows[0].rotation.x += .45; h.rig.elbows[1].rotation.x -= .35;
  h.rig.root.updateMatrixWorld(true);
  const after = surface(); let maximum = 0;
  for (let side = 0; side < pockets.length; side++) for (let vertex = 0; vertex < before[side].length; vertex++)
    maximum = Math.max(maximum, before[side][vertex].distanceTo(after[side][vertex]));
  assert.ok(maximum < .001, `jacket pockets follow the forearms by ${maximum} instead of staying on the torso`);
});

test('every Architect pocket vertex projects onto the front of the seated jacket', async t => {
  const h = await fixture(t), body = h.rig.root.getObjectByName('architect-detailed-body')!;
  const jacket = body.getObjectByName('architect-tailored-jacket') as THREE.SkinnedMesh;
  jacket.skeleton.update(); const point = new THREE.Vector3(), ray = new THREE.Raycaster();
  for (const side of [-1, 1]) {
    const pocket = body.getObjectByName(`architect-welt-pocket-${side}`) as THREE.SkinnedMesh; pocket.skeleton.update();
    for (let vertex = 0; vertex < pocket.geometry.attributes.position.count; vertex++) {
      pocket.localToWorld(pocket.getVertexPosition(vertex, point));
      ray.set(point.clone().add(new THREE.Vector3(0, 0, .5)), new THREE.Vector3(0, 0, -1)); ray.far = 1;
      const hit = ray.intersectObject(jacket, false)[0];
      assert.ok(hit, `pocket ${side}/${vertex} extends outside the jacket`);
      const clearance = hit.distance - .5;
      assert.ok(clearance > .005 && clearance < .05, `pocket ${side}/${vertex} misses the jacket surface: ${clearance}`);
    }
  }
});

test('the physical CRT ring, chair and left hinge agree with the saved room geometry and preserve the closed Source door', async t => {
  const h = await fixture(t), room = new THREE.Group(), renderer = new ArchitectRoomRenderer(room); t.after(() => renderer.dispose());
  const encounter: ArchitectEncounter = { phase: 'decision', sourceReviewed: true, trinityReviewed: true, remaining: 45, lastTick: 0, attempts: 0,
    room: { elapsed: 10, chairYaw: .3, exit: { elapsed: .85, x: -8, z: -26 } } };
  renderer.update(encounter); room.updateMatrixWorld(true);
  assert.equal(renderer.leftDoor.rotation.y, architectDoorAngle(encounter)); assert.equal(renderer.rightDoor.rotation.y, 0);
  assert.equal(renderer.leftDoor.position.x, ARCHITECT_ROOM.doors.matrix.x - ARCHITECT_ROOM.doorWidth / 2);
  assert.equal(renderer.chair.rotation.y, .3);
  const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), quadrants = new Set<number>(); let count = 0;
  for (const screen of renderer.screens) for (let i = 0; i < screen.count; i++) {
    screen.getMatrixAt(i, matrix); position.setFromMatrixPosition(matrix);
    assert.ok(Math.abs(Math.hypot(position.x, position.z - ARCHITECT_ROOM.centerZ) - (ARCHITECT_ROOM.radius - .26)) < .02);
    quadrants.add((position.x > 0 ? 1 : 0) + (position.z > ARCHITECT_ROOM.centerZ ? 2 : 0)); count++;
  }
  assert.equal(quadrants.size, 4); assert.ok(count > 330, `CRT coverage has only ${count} screens`);
  const center = FILM_SETS.film_architect_room.center; room.position.set(center.x, center.y - 1, center.z); room.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(new THREE.Vector3(center.x, center.y + 1, center.z - 8), new THREE.Vector3(0, 0, -1));
  assert.ok(ray.intersectObject(renderer.chair, true).length, 'the shared chair obstacle must correspond to visible furniture');
  const original = renderer.chair.getWorldPosition(new THREE.Vector3()); renderer.dispose(); renderer.dispose();
  assert.equal(room.children.length, 0); assert.ok(original.z === center.z + ARCHITECT_ROOM.chair.z);
});

test('Neo’s real wrist follows the moving door lever without replacing his saved body root', async t => {
  const h = await fixture(t), neo = h.world.agents.get('neo')!; neo.isInMatrix = true; neo.isAwakened = true; neo.currentLocation = 'film_architect_room';
  const rig = h.models.create(neo), room = new THREE.Group(), renderer = new ArchitectRoomRenderer(room); t.after(() => renderer.dispose());
  const c = FILM_SETS.film_architect_room.center; room.position.set(c.x, c.y - 1, c.z);
  const age = .42, encounter: ArchitectEncounter = { phase: 'decision', sourceReviewed: true, trinityReviewed: true, remaining: 45, lastTick: 0, attempts: 0,
    room: { elapsed: 1, chairYaw: 0, exit: { elapsed: age, x: -8, z: -26 } } };
  const { architectExitRoot } = await import('@auto_matrix/shared'), root = architectExitRoot(encounter.room!.exit!);
  rig.root.position.set(c.x + root.x, c.y - 1, c.z + root.z); rig.root.rotation.y = root.yaw;
  const motion = { speed: 0, turn: 0, grounded: true, verticalVelocity: 0,
    architect: { role: 'neo', phase: 'decision', elapsed: 1, chairYaw: 0, opening: age } } as MotionInput;
  h.models.animate(rig, 0, motion, 0); await new Promise(resolve => setImmediate(resolve)); h.models.animate(rig, 0, motion, 0);
  renderer.update(encounter); room.updateMatrixWorld(true); rig.root.updateMatrixWorld(true); assert.ok(rig.hero);
  const palm = rig.hero.bones.get('wrist_R')!.localToWorld(new THREE.Vector3(0, -.19, .035));
  const lever = renderer.leftDoor.localToWorld(new THREE.Vector3(ARCHITECT_ROOM.doorWidth - .66, 3.05, .21));
  assert.ok(palm.distanceTo(lever) < .085, `hand misses the moving lever by ${palm.distanceTo(lever)}`);
  assert.ok(rig.root.position.distanceTo(new THREE.Vector3(c.x + root.x, c.y - 1, c.z + root.z)) < 1e-7);
});

test('losing Trinity’s signal blacks out the feed, and a local retry restores it', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const renderer = new ArchitectRoomRenderer(new THREE.Group()); t.after(() => renderer.dispose());
  const encounter: ArchitectEncounter = { phase: 'reflection', sourceReviewed: true, trinityReviewed: true, remaining: 45, lastTick: 0, attempts: 0 };
  renderer.update(encounter);
  const feed = (renderer.screens[0].material as THREE.MeshBasicMaterial).map;
  encounter.phase = 'failed'; renderer.update(encounter);
  for (const screen of renderer.screens) assert.ok((screen.material as THREE.MeshBasicMaterial).color.getHex() === 0, 'the lost feed must not keep showing Trinity');
  encounter.phase = 'decision'; renderer.update(encounter);
  for (const screen of renderer.screens) { const material = screen.material as THREE.MeshBasicMaterial; assert.equal(material.map, feed); assert.ok(material.color.getHex() > 0); }
});

test('the first-person player can see Neo’s physical opening arm, then returns to normal visibility outside the room', async t => {
  const h = await fixture(t), renderer = new AgentRenderer(new THREE.Scene()); t.after(() => renderer.dispose());
  const neo = h.world.agents.get('neo')!; neo.isInMatrix = true; neo.isAwakened = true; neo.currentLocation = 'film_architect_room';
  renderer.updateAgent('neo', neo); renderer.setPlayer('neo', true);
  const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, firstPerson: true,
    architect: { role: 'neo', phase: 'decision', elapsed: 2, chairYaw: 0, opening: .37 } } as MotionInput;
  renderer.setPlayerMotion(input); renderer.update(0, undefined, 0);
  await new Promise(resolve => setImmediate(resolve)); renderer.update(0, undefined, 0);
  assert.equal(renderer.getAgentBody('neo')!.visible, true, 'the opening hand must not disappear with the entire first-person body');
  input.architect = undefined; renderer.setPlayerMotion(input); renderer.update(0, undefined, 0);
  assert.equal(renderer.getAgentBody('neo')!.visible, false);
  renderer.setPlayer('neo', false); renderer.update(0, undefined, 0);
  assert.equal(renderer.getAgentBody('neo')!.visible, true);
});

test('showing Neo’s first-person opening arm removes his own face and glasses from the eye camera, and V restores them', async t => {
  const h = await fixture(t), neo = h.world.agents.get('neo')!; neo.isInMatrix = true; neo.isAwakened = true; neo.currentLocation = 'film_architect_room';
  const rig = h.models.create(neo), input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, firstPerson: true,
    architect: { role: 'neo', phase: 'decision', elapsed: 2, chairYaw: 0, opening: .37 } } as MotionInput;
  h.models.animate(rig, 0, input, 0); await new Promise(resolve => setImmediate(resolve)); h.models.animate(rig, 0, input, 0);
  assert.ok(rig.hero?.trackingSkin);
  assert.equal(rig.hero.glasses.visible, false, 'the restored body cannot put sunglasses in front of the first-person camera');
  assert.equal(rig.hero.trackingSkin.mesh.geometry, rig.hero.trackingSkin.firstPerson);
  input.firstPerson = false; h.models.animate(rig, 0, input, 0);
  assert.equal(rig.hero.glasses.visible, true); assert.equal(rig.hero.trackingSkin.mesh.geometry, rig.hero.trackingSkin.original);
});
