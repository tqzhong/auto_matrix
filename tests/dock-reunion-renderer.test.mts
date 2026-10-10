import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test, { type TestContext } from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DOCK_REUNION, FILM_SETS, templeCastRoot, dockEmpHullBase, dockDepartureFoot, dockDepartureRoot, dockReunionFoot, dockReunionRoot, type DockDepartureGesture, type DockDepartureRole, type DockReunion, type FilmJourney } from '@auto_matrix/shared';
import { CharacterModels, type CharacterRig } from '../packages/client/src/agents/CharacterModel.js';
import { departureSupportContact, poseDockDeparture, poseDockReunion, reunionBackContact } from '../packages/client/src/agents/DockReunionPerformance.js';
import { DockGateRenderer } from '../packages/client/src/engine/DockGateRenderer.js';
import { poseTempleDefense } from '../packages/client/src/agents/TempleDefensePerformance.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

async function shipped(name: string) {
  const bytes = await readFile(new URL(`../packages/client/public/assets/characters/${name}.glb`, import.meta.url));
  const length = bytes.readUInt32LE(12), document = JSON.parse(bytes.subarray(20, 20 + length).toString());
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

async function fixture(t: TestContext) {
  const assets = Object.fromEntries(await Promise.all(['morpheus', 'trinity', 'zee-head', 'zee-body', 'niobe-head', 'niobe-body', 'roland-head', 'roland-body'].map(async name => [name, await shipped(name)])));
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async url => assets[String(url).split('/').pop()!.replace('.glb', '')]);
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  t.after(() => { models.dispose(); globalThis.document = previous; });
  const rigs = { link: models.create(world.agents.get('link')!), zee: models.create(world.agents.get('zee')!) }, center = FILM_SETS.film_zion_hangar.center;
  const crew = Object.fromEntries(DOCK_REUNION.crew.map(role => [role, models.create(world.agents.get(role)!)])) as Record<DockDepartureRole, CharacterRig>;
  const poseDeparture = (elapsed: number, forward = false) => {
    for (const role of DOCK_REUNION.crew) {
      const gesture: DockDepartureGesture = { role, elapsed, floor: 1, assisted: true, forward }, rig = crew[role], at = dockDepartureRoot(gesture);
      rig.root.position.set(center.x + at.x, center.y - 1 + at.y, center.z + at.z); rig.root.rotation.y = at.yaw;
      models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, dockDeparture: gesture }, 0);
    }
    poseDockDeparture(crew.colt, { role: 'colt', elapsed, floor: 1, assisted: true, forward }, crew.roland);
    poseDockDeparture(crew.roland, { role: 'roland', elapsed, floor: 1, assisted: true, forward }, crew.colt);
  };
  const pose = (state: DockReunion) => {
    for (const role of ['link', 'zee'] as const) {
      const rig = rigs[role], root = dockReunionRoot(state, role);
      rig.root.position.set(center.x + root.x, center.y - 1 + root.y, center.z + root.z); rig.root.rotation.y = root.yaw;
      models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, dockReunion: { ...state, role } }, 0);
    }
    poseDockReunion(rigs.link, { ...state, role: 'link' }, rigs.zee);
    poseDockReunion(rigs.zee, { ...state, role: 'zee' }, rigs.link);
  };
  pose({ phase: 'ready', elapsed: 0, floor: 1 }); poseDeparture(0); await new Promise(resolve => setImmediate(resolve));
  pose({ phase: 'ready', elapsed: 0, floor: 1 });
  assert.ok(rigs.link.hero, 'inspect the delivered skinned Link substitute');
  assert.ok(rigs.zee.root.getObjectByName('zee-anatomical-body'), 'inspect Zee’s continuous delivered body');
  return { rigs, crew, pose, poseDeparture, center, models };
}

for (const forward of [false, true]) test(`the damaged door falls visibly, stays above the dock, and restores at the same saved frame (${forward ? 'forward' : 'legacy'})`, t => {
  const root = new THREE.Group(), metal = new THREE.MeshStandardMaterial(), iron = new THREE.MeshStandardMaterial();
  const renderer = new DockGateRenderer(root, metal, iron); t.after(() => { renderer.dispose(); metal.dispose(); iron.dispose(); });
  const journey = { scene: 'm3_dock_reunion', completed: ['m3_emp'], emp: { firedAt: 1, elapsed: 9 },
    dockReunion: { phase: 'disembarking', elapsed: 0, floor: 1, departure: 0, forward } } as FilmJourney;
  const door = root.getObjectByName('hammer-rear-hatch')!;
  renderer.update(journey);
  assert.ok(Math.abs(door.position.z - (forward ? 20.96 : 55.04)) < 1e-6, 'door must detach from the correct rear opening');
  for (let age = 0; age <= 2.2; age += .025) {
    journey.dockReunion!.departure = age; renderer.update(journey); root.updateMatrixWorld(true);
    assert.equal(door.visible, true, 'the panel must fall rather than simply disappear');
    door.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const positions = object.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) assert.ok(object.localToWorld(new THREE.Vector3().fromBufferAttribute(positions, i)).y >= 1,
        `${age}: delivered hatch geometry penetrates the raised dock`);
    });
  }
  journey.dockReunion!.departure = 1.08; renderer.update(journey); root.updateMatrixWorld(true);
  const matrix = door.matrixWorld.clone(); renderer.update(journey); root.updateMatrixWorld(true); assert.ok(door.matrixWorld.equals(matrix));
  const cold = new DockGateRenderer(new THREE.Group(), metal, iron); t.after(() => cold.dispose()); cold.update(structuredClone(journey)); cold.group.updateMatrixWorld(true);
  assert.ok(cold.group.getObjectByName('hammer-rear-hatch')!.matrixWorld.equals(matrix), 'cold creation restores the real panel transform');
});

for (const forward of [false, true]) test(`the waiting crew and Link stand on a rendered rear deck inside the hull (${forward ? 'forward' : 'legacy'})`, t => {
  const root = new THREE.Group(), metal = new THREE.MeshStandardMaterial(), iron = new THREE.MeshStandardMaterial();
  const renderer = new DockGateRenderer(root, metal, iron); t.after(() => { renderer.dispose(); metal.dispose(); iron.dispose(); });
  renderer.update({ scene: 'm3_dock_reunion', completed: [], emp: { firedAt: 1, elapsed: 9 },
    dockReunion: { phase: 'ready', elapsed: 0, floor: 1, departure: 0, forward } } as FilmJourney); root.updateMatrixWorld(true);
  const deck = root.getObjectByName('hammer-exit-deck'); assert.ok(deck, 'the newly walkable interior needs a visible support surface');
  for (const role of [...DOCK_REUNION.crew, 'link'] as const) for (const left of [false, true]) {
    const foot = role === 'link' ? dockReunionFoot({ phase: 'ready', elapsed: 0, floor: 1, departure: 0, forward }, left)
      : dockDepartureFoot({ role, elapsed: 0, floor: 1, assisted: true, forward }, left);
    const hit = new THREE.Raycaster(new THREE.Vector3(foot.x, foot.y + .5, foot.z), new THREE.Vector3(0, -1, 0), 0, .6).intersectObject(deck)[0];
    assert.ok(hit && Math.abs(hit.point.y - foot.y) < .00001, `${role}/${left}: the saved waiting foot has no rendered deck beneath it`);
  }
});

for (const forward of [false, true]) test(`the delivered crew boots support each descending foot and their bodies fit through the opening (${forward ? 'forward' : 'legacy'})`, async t => {
  const h = await fixture(t), floor = h.center.y, base = dockEmpHullBase(1.2, 1);
  for (const elapsed of [0, 3.2, 6, 8.7, 10.3, 12.2, 15.5, 18.5, 21.5, 24.3, 26.2]) {
    h.poseDeparture(elapsed, forward);
    for (const role of DOCK_REUNION.crew) {
      const rig = h.crew[role];
      const joints = ['L', 'R'].map((side, index) => ({
        hip: rig.hero?.bones.get(`hip_${side}`) ?? rig.hips[index === 0 ? 1 : 0],
        ankle: rig.hero?.bones.get(`ankle_${side}`) ?? rig.ankles[index === 0 ? 1 : 0],
      }));
      const hips = joints.map(joint => rig.root.worldToLocal(joint.hip.getWorldPosition(new THREE.Vector3())).x);
      const ankles = joints.map(joint => rig.root.worldToLocal(joint.ankle.getWorldPosition(new THREE.Vector3())).x);
      assert.ok((hips[0] - hips[1]) * (ankles[0] - ankles[1]) > 0, `${role}/${elapsed}: the real left and right legs cross under the body`);
      for (const side of ['L', 'R'] as const) {
        const foot = dockDepartureFoot({ role, elapsed, floor: 1, assisted: true, forward }, side === 'L'); let low = Infinity;
        if (rig.hero || rig.detail.getObjectByName(`${role}-detailed-body`)) rig.detail.traverseVisible(object => {
          if (!(object instanceof THREE.SkinnedMesh) || !/leather/i.test((object.material as THREE.Material).name) && !object.name.endsWith('-work-boots')) return;
          object.skeleton.update(); const ids = object.geometry.attributes.skinIndex, weights = object.geometry.attributes.skinWeight;
          for (let i = 0; i < ids.count; i++) if ([0, 1, 2, 3].some(k => weights.getComponent(i, k) > .5 && object.skeleton.bones[ids.getComponent(i, k)].name === `ankle_${side}`))
            low = Math.min(low, object.localToWorld(object.getVertexPosition(i, new THREE.Vector3())).y);
        });
        else low = new THREE.Box3().setFromObject(rig.ankles[side === 'L' ? 1 : 0], true).min.y;
        assert.ok(Math.abs(low - (h.center.y - 1 + foot.y + (rig.hero ? .025 : 0))) < .04, `${role}/${elapsed}/${side}: boot sole ${low - floor}, tread ${foot.y - 1}`);
      }
      rig.detail.traverseVisible(object => {
        if (!(object instanceof THREE.Mesh)) return;
        if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
        const positions = object.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
          const p = object.localToWorld(object.getVertexPosition(i, new THREE.Vector3())).sub(h.center).add(new THREE.Vector3(0, 1, 0));
          if (Math.abs(p.z - (forward ? 20.96 : 55.04)) < .13) assert.ok(Math.hypot(p.x - 20, p.y - base) < DOCK_REUNION.hatch.radius - .01,
            `${role}/${elapsed}: delivered body touches the solid hatch rim at ${p.toArray()}`);
        }
      });
    }
  }
});

for (const forward of [false, true]) test(`crew who reach the dock clear the shared landing before the next person arrives (${forward ? 'forward' : 'legacy'})`, () => {
  for (let elapsed = 0; elapsed <= 26.2; elapsed += .1) {
    const points = DOCK_REUNION.crew.map(role => dockDepartureRoot({ role, elapsed, floor: 1, assisted: true, forward }));
    for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++)
      assert.ok(Math.hypot(points[i].x - points[j].x, points[i].z - points[j].z) > .9,
        `${elapsed}: ${DOCK_REUNION.crew[i]} and ${DOCK_REUNION.crew[j]} occupy the same landing`);
  }
});

for (const forward of [false, true]) test(`Roland’s delivered palm reaches Colt’s shoulder and Colt supports the captain’s waist (${forward ? 'forward' : 'legacy'})`, async t => {
  const h = await fixture(t);
  for (const elapsed of [0, 17.2, 22.5]) {
    h.poseDeparture(elapsed, forward);
    for (const [role, other, left] of [['roland', 'colt', false], ['colt', 'roland', true]] as const) {
      const rig = h.crew[role], contact = departureSupportContact(h.crew[other], role === 'roland'), points: THREE.Vector3[] = rig.detail.getObjectByName(`${role}-detailed-body`) ? handPoints(rig, left) : [];
      if (!points.length) rig.elbows[left ? 1 : 0].traverseVisible(object => {
        if (!(object instanceof THREE.Mesh)) return;
        const vertices = object.geometry.attributes.position;
        const elbow = rig.elbows[left ? 1 : 0];
        for (let i = 0; i < vertices.count; i++) {
          const point = object.localToWorld(new THREE.Vector3().fromBufferAttribute(vertices, i)), local = elbow.worldToLocal(point.clone());
          if (local.y < -.66 && local.y > -.94 && Math.abs(local.x) < .19) points.push(point);
        }
      });
      assert.ok(points.length); const distance = Math.min(...points.map(point => point.distanceTo(contact)));
      assert.ok(distance < .075, `${role}/${elapsed}: actual palm misses the clothing by ${distance}`);
    }
  }
});

function handPoints(rig: CharacterRig, left: boolean) {
  const points: THREE.Vector3[] = [];
  rig.detail.traverseVisible(object => {
    if (!(object instanceof THREE.SkinnedMesh)) return;
    object.skeleton.update(); const position = object.geometry.attributes.position;
    const ids = object.geometry.attributes.skinIndex, weights = object.geometry.attributes.skinWeight, side = left ? 'L' : 'R';
    for (let i = 0; i < position.count; i++) {
      const hand = rig.hero ? (object.material as THREE.Material).name === 'Skin' && [0, 1, 2, 3].some(k => weights.getComponent(i, k) > .5 && new RegExp(`wrist_${side}|finger.*_${side}`).test(object.skeleton.bones[ids.getComponent(i, k)].name))
        : object.name.endsWith('-anatomical-body') && position.getY(i) <= 1.79 && position.getY(i) > 1.45 && Math.sign(position.getX(i)) === (left ? 1 : -1);
      if (hand) points.push(object.localToWorld(object.getVertexPosition(i, new THREE.Vector3())));
    }
  });
  assert.ok(points.length); return points;
}

test('the helper waist contact comes from Roland’s visible wrap tunic after the detailed body loads', async t => {
  const h = await fixture(t); h.poseDeparture(17.2);
  const rig = h.crew.roland, point = departureSupportContact(rig, false);
  const direction = new THREE.Vector3(1, 0, 0).applyQuaternion(rig.torso.getWorldQuaternion(new THREE.Quaternion()));
  const cloth = rig.detail.getObjectByName('roland-work-top') as THREE.SkinnedMesh;
  cloth.skeleton.update();
  const hit = new THREE.Raycaster(point.clone().addScaledVector(direction, -.1), direction, 0, .25).intersectObject(cloth)[0];
  const gap = hit?.point.clone().sub(point).dot(direction);
  assert.ok(gap !== undefined && Math.abs(gap - .025) < .01, `the helper must stay outside the captain's delivered tunic: signed gap ${gap}`);
});

for (const forward of [false, true]) test(`the delivered boots descend one real tread at a time and retain the paused support foot (${forward ? 'forward' : 'legacy'})`, async t => {
  const h = await fixture(t), rig = h.rigs.link;
  for (const departure of [undefined, 16]) for (let elapsed = 0; elapsed <= DOCK_REUNION.exitSeconds; elapsed += .2) {
    const state: DockReunion = { phase: 'exiting', elapsed, floor: 1, departure, forward }; h.pose(state);
    for (const side of ['L', 'R'] as const) {
      const target = dockReunionFoot(state, side === 'L'); let low = Infinity;
      rig.detail.traverseVisible(object => {
        if (!(object instanceof THREE.SkinnedMesh) || (object.material as THREE.Material).name !== 'Boot leather') return;
        object.skeleton.update(); const ids = object.geometry.attributes.skinIndex, weights = object.geometry.attributes.skinWeight;
        for (let i = 0; i < ids.count; i++) if ([0, 1, 2, 3].some(k => weights.getComponent(i, k) > .5 && object.skeleton.bones[ids.getComponent(i, k)].name === `ankle_${side}`))
          low = Math.min(low, object.localToWorld(object.getVertexPosition(i, new THREE.Vector3())).y);
      });
      assert.ok(Math.abs(low - (h.center.y - 1 + target.y + .025)) < .04, `${elapsed}/${side}: actual sole is ${low - h.center.y + 1}, required ${target.y + .025}`);
    }
  }
  h.pose({ phase: 'exiting', elapsed: 8, floor: 1 });
  const snapshots: THREE.Matrix4[] = [];
  rig.root.traverse(object => { if (object instanceof THREE.Bone) snapshots.push(object.matrixWorld.clone()); });
  h.pose({ phase: 'exiting', elapsed: 8, floor: 1 }); let index = 0;
  rig.root.traverse(object => { if (object instanceof THREE.Bone) assert.ok(object.matrixWorld.equals(snapshots[index++]), 'paused descent cannot drift'); });
});

test('holding the hatch rail does not teleport the actual palms between posts', async t => {
  const h = await fixture(t);
  for (const boundary of [.4, 1.2, 2, 2.8, 3.6, 4.4, 5.2, 6, 6.8, 7.6]) {
    h.pose({ phase: 'exiting', elapsed: boundary - .001, floor: 1 });
    const before = [false, true].map(left => handPoints(h.rigs.link, left));
    h.pose({ phase: 'exiting', elapsed: boundary + .001, floor: 1 });
    for (const [i, left] of [false, true].entries()) {
      const after = handPoints(h.rigs.link, left);
      const jump = Math.max(...after.map((point, j) => point.distanceTo(before[i][j])));
      assert.ok(jump < .02, `${boundary}/${left}: rendered hand jumps ${jump} between rail posts`);
    }
  }
});

test('both delivered palms actually reach their partner’s clothing during the saved embrace', async t => {
  const h = await fixture(t); h.pose({ phase: 'embrace', elapsed: 2, floor: 1 });
  for (const role of ['link', 'zee'] as const) for (const left of [false, true]) {
    const contact = reunionBackContact(h.rigs[role === 'link' ? 'zee' : 'link'], left);
    const gap = Math.min(...handPoints(h.rigs[role], left).map(point => point.distanceTo(contact)));
    assert.ok(gap < .12, `${role}/${left ? 'L' : 'R'}: actual palm misses the back by ${gap}`);
  }
  h.pose({ phase: 'charm', elapsed: 2, floor: 1 });
  const pendant = h.rigs.link.empCharm!.getObjectByName('zee-pendant')!.getWorldPosition(new THREE.Vector3());
  const gap = Math.min(...handPoints(h.rigs.link, true).map(point => point.distanceTo(pendant)));
  assert.ok(gap < .12, `Link must hold the actual pendant; hand gap ${gap}`);
});

function lip(rig: CharacterRig, role: 'link' | 'zee') {
  let face!: THREE.Mesh;
  rig.detail.traverseVisible(object => {
    if (object instanceof THREE.SkinnedMesh && role === 'link' && (object.material as THREE.Material).name === 'Skin'
      || object instanceof THREE.Mesh && role === 'zee' && object.name === 'zee-anatomical-head') face = object as THREE.Mesh;
  });
  if (face instanceof THREE.SkinnedMesh) face.skeleton.update();
  const positions = face.geometry.attributes.position, uv = face.geometry.attributes[role === 'link' ? 'uv1' : 'uv'];
  const center = role === 'link' ? [(1 + (.375 + .611) / 2) * .5, 1 - (1 + .692) * .5] : [(237 + 392) / 2 / 1254, 424 / 1254];
  const indices: number[] = [];
  for (let i = 0; i < positions.count; i++) if (Math.abs(uv.getX(i) - center[0]) < .002 && Math.abs(uv.getY(i) - center[1]) < .002 && positions.getZ(i) > .15) indices.push(i);
  indices.sort((a, b) => positions.getZ(b) - positions.getZ(a)); assert.ok(indices.length, `${role}: real registered lip missing`);
  return face.localToWorld(face.getVertexPosition(indices[0], new THREE.Vector3()));
}

test('the kiss reaches the delivered lips', async t => {
  const h = await fixture(t);
  for (const elapsed of [1.4, 1.8, 2.1]) {
    h.pose({ phase: 'kiss', elapsed, floor: 1 });
    const a = lip(h.rigs.link, 'link'), b = lip(h.rigs.zee, 'zee');
    assert.ok(a.distanceTo(b) < .065, `${elapsed}: real lip gap ${a.distanceTo(b)}; Link ${h.rigs.link.root.worldToLocal(a.clone()).toArray()}, Zee ${h.rigs.zee.root.worldToLocal(b.clone()).toArray()}`);
  }
});

function faceSurface(rig: CharacterRig, role: 'link' | 'zee') {
  let source!: THREE.Mesh;
  rig.detail.traverseVisible(object => {
    if (object instanceof THREE.SkinnedMesh && role === 'link' && (object.material as THREE.Material).name === 'Skin'
      || object instanceof THREE.Mesh && role === 'zee' && object.name === 'zee-anatomical-head') source = object as THREE.Mesh;
  });
  if (source instanceof THREE.SkinnedMesh) source.skeleton.update();
  const positions = source.geometry.attributes.position, selected = new Map<number, THREE.Vector3>();
  for (let i = 0; i < positions.count; i++) {
    if (positions.getZ(i) < .1) continue;
    if (source instanceof THREE.SkinnedMesh) {
      const weights = source.geometry.attributes.skinWeight, joints = source.geometry.attributes.skinIndex;
      let headWeight = 0;
      for (let k = 0; k < 4; k++) if (/^(head|neck)$/.test(source.skeleton.bones[joints.getComponent(i, k)].name)) headWeight += weights.getComponent(i, k);
      if (headWeight < .7) continue;
    }
    selected.set(i, source.localToWorld(source.getVertexPosition(i, new THREE.Vector3())));
  }
  const buckets = new Map<string, number[]>(), indices = source.geometry.index!;
  for (let i = 0; i < indices.count; i += 3) {
    const triangle = [indices.getX(i), indices.getX(i + 1), indices.getX(i + 2)];
    if (!triangle.every(index => selected.has(index))) continue;
    const points = triangle.map(index => selected.get(index)!);
    const key = points[0].clone().add(points[1]).add(points[2]).divideScalar(3).toArray().map(n => Math.floor(n / .15)).join(':');
    if (!buckets.has(key)) buckets.set(key, []);
    for (const point of points) buckets.get(key)!.push(...point.toArray());
  }
  assert.ok(buckets.size, 'use the actual posed facial triangles');
  const group = new THREE.Group(), material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), geometries: THREE.BufferGeometry[] = [];
  for (const values of buckets.values()) {
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(values, 3));
    geometries.push(geometry); group.add(new THREE.Mesh(geometry, material));
  }
  group.updateMatrixWorld(true);
  const points = [...selected.values()], bounds = new THREE.Box3().setFromPoints(points);
  return { group, points, bounds, dispose: () => { geometries.forEach(geometry => geometry.dispose()); material.dispose(); } };
}

test('the saved reunion kiss keeps the actual noses and cheeks outside the other actor’s face', async t => {
  const h = await fixture(t);
  for (const elapsed of [.75, 1.25, 1.4, 1.8, 2.1, 2.3, 2.5, 2.8]) {
    h.pose({ phase: 'kiss', elapsed, floor: 1 });
    const a = faceSurface(h.rigs.link, 'link'), b = faceSurface(h.rigs.zee, 'zee');
    try {
      for (const [role, face, other, rig] of [['link', a, b, h.rigs.zee], ['zee', b, a, h.rigs.link]] as const) {
        const center = (rig.hero?.bones.get('head') ?? rig.head).getWorldPosition(new THREE.Vector3()), depths: number[] = [];
        for (const point of face.points) {
          if (!other.bounds.containsPoint(point)) continue;
          const direction = point.clone().sub(center).normalize();
          const hit = new THREE.Raycaster(point, direction, .0001, .35).intersectObject(other.group, true)[0];
          if (hit && hit.face!.normal.dot(direction) > .001 && hit.distance > .025) depths.push(hit.distance);
        }
        assert.equal(depths.length, 0, `${elapsed}/${role}: actual facial vertices penetrate by ${Math.max(...depths)} (${depths.length} samples)`);
      }
    } finally { a.dispose(); b.dispose(); }
  }
});

test('the temple huddle keeps both delivered boot soles grounded and faces outside the other actor', async t => {
  const h = await fixture(t), center = FILM_SETS.film_zion_temple.center;
  for (const elapsed of [.1, 1.582, 4.8]) {
    for (const role of ['link', 'zee'] as const) {
      const at = templeCastRoot(role), rig = h.rigs[role];
      rig.root.position.set(center.x + at.x, center.y - 1, center.z + at.z); rig.root.rotation.set(0, at.yaw, 0);
      h.models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true,
        templeDefense: { role, phase: 'waiting', elapsed, turn: 1, grip: 0 } }, 0);
    }
    for (const role of ['link', 'zee'] as const) poseTempleDefense(h.rigs[role], { role, phase: 'waiting', elapsed, turn: 1, grip: 0 }, h.rigs[role === 'link' ? 'zee' : 'link']);
    for (const role of ['link', 'zee'] as const) {
      let low = Infinity;
      h.rigs[role].detail.traverseVisible(object => {
        if (!(object instanceof THREE.SkinnedMesh) || (object.material as THREE.Material).name !== 'Boot leather' && !object.name.endsWith('-work-boots')) return;
        object.skeleton.update(); low = Math.min(low, new THREE.Box3().setFromObject(object, true).min.y);
      });
      assert.ok(Math.abs(low - (center.y - 1)) < .04, `${role}/${elapsed}: actual sole floats or crosses the temple floor by ${low - center.y + 1}`);
    }
    const a = faceSurface(h.rigs.link, 'link'), b = faceSurface(h.rigs.zee, 'zee');
    try {
      for (const [role, face, other, rig] of [['link', a, b, h.rigs.zee], ['zee', b, a, h.rigs.link]] as const) {
        const head = (rig.hero?.bones.get('head') ?? rig.head).getWorldPosition(new THREE.Vector3());
        for (const point of face.points) {
          if (!other.bounds.containsPoint(point)) continue;
          const direction = point.clone().sub(head).normalize(), hit = new THREE.Raycaster(point, direction, .0001, .35).intersectObject(other.group, true)[0];
          assert.ok(!hit || hit.face!.normal.dot(direction) <= .001 || hit.distance <= .025,
            `${elapsed}/${role}: huddle face penetrates the other actor by ${hit?.distance}`);
        }
      }
    } finally { a.dispose(); b.dispose(); }
  }
});


for (const forward of [false, true]) test(`Link's approach keeps anatomical legs on their own side while turning (${forward ? 'forward' : 'legacy'})`, async t => {
  const h = await fixture(t), rig = h.rigs.link;
  const approach = forward ? { x: 32.3, z: 17.2, yaw: 1.1 } : { x: 7.7, z: 58.8, yaw: 1.1 + Math.PI };
  for (const elapsed of [0, .4, 1.2, 2, 2.39]) {
    h.pose({ phase: 'approaching', elapsed, floor: 1, forward, approach });
    const hips = ['L', 'R'].map(side => rig.root.worldToLocal(rig.hero!.bones.get(`hip_${side}`)!.getWorldPosition(new THREE.Vector3())).x);
    const ankles = ['L', 'R'].map(side => rig.root.worldToLocal(rig.hero!.bones.get(`ankle_${side}`)!.getWorldPosition(new THREE.Vector3())).x);
    assert.ok((hips[0] - hips[1]) * (ankles[0] - ankles[1]) > 0, `${elapsed}: Link crosses his legs while turning toward Zee`);
  }
});
