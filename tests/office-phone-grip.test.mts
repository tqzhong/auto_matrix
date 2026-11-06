import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, OFFICE_LADDER, officeCrossingPose } from '@auto_matrix/shared';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import type { MotionInput } from '../packages/client/src/agents/CharacterMotion.js';
import { PHONE_SPEAKER } from '../packages/client/src/agents/PhoneModel.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

async function loadGeometry(id: string) {
  const glb = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
  const length = glb.readUInt32LE(12), document = JSON.parse(glb.subarray(20, 20 + length).toString());
  for (const material of document.materials) {
    delete material.pbrMetallicRoughness.baseColorTexture;
    delete material.normalTexture;
  }
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = glb.subarray(20 + length), result = Buffer.alloc(20 + padded.length + bin.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16);
  padded.copy(result, 20); bin.copy(result, 20 + padded.length);
  return new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
}

function longestSleeveCrossing(mesh: THREE.SkinnedMesh, skin?: THREE.SkinnedMesh): number {
  const elbow = mesh.skeleton.bones.findIndex(bone => bone.name === 'elbow_R');
  const bindElbow = new THREE.Vector3().setFromMatrixPosition(mesh.skeleton.boneInverses[elbow].clone().invert())
    .applyMatrix4(mesh.bindMatrix.clone().invert());
  const facesNearElbow = (part: THREE.SkinnedMesh) => {
    const { position } = part.geometry.attributes, index = part.geometry.index!;
    const rest = Array.from({ length: position.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(position, i));
    const keys = rest.map(vertex => vertex.toArray().map(axis => Math.round(axis * 1e6)).join(','));
    const points = rest.map((_, i) => part.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(part.matrixWorld));
    const faces = [];
    for (let i = 0; i < index.count; i += 3) {
      const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
      // The skin probe also covers the middle of the forearm inside the sleeve.
      if (!ids.some(id => rest[id].distanceTo(bindElbow) < (skin ? .55 : .35))) continue;
      const vertices = ids.map(id => points[id]) as [THREE.Vector3, THREE.Vector3, THREE.Vector3];
      faces.push({ keys: ids.map(id => keys[id]), vertices, bounds: new THREE.Box3().setFromPoints(vertices),
        normal: new THREE.Triangle(...vertices).getNormal(new THREE.Vector3()) });
    }
    return faces;
  };
  const faces = facesNearElbow(mesh), other = skin ? facesNearElbow(skin) : faces;
  const ray = new THREE.Ray(), first = new THREE.Vector3(), hit = new THREE.Vector3();
  let longest = 0;
  for (const [i, a] of faces.entries()) for (let j = 0; j < (skin ? other.length : i); j++) {
    const b = other[j];
    if (!a.bounds.intersectsBox(b.bounds) || !skin && a.keys.some(key => b.keys.includes(key)) || Math.abs(a.normal.dot(b.normal)) > .9995) continue;
    let found = false;
    for (const [from, to] of [[a.vertices, b.vertices], [b.vertices, a.vertices]]) for (let k = 0; k < 3; k++) {
      ray.origin.copy(from[k]);
      const length = ray.direction.subVectors(from[(k + 1) % 3], from[k]).length();
      if (length < 1e-8) continue;
      ray.direction.divideScalar(length);
      if (!ray.intersectTriangle(...to, false, hit) || hit.distanceTo(ray.origin) > length + 1e-7) continue;
      if (found) longest = Math.max(longest, first.distanceTo(hit));
      else { first.copy(hit); found = true; }
    }
  }
  return longest;
}

test('the shipped office hand clears the handset casing while lifting, listening, crouching and crossing the window', async t => {
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking'].map(async id => [id, await loadGeometry(id)] as const)));
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async (url: string) => assets.get(url.split('/').at(-1)!.replace('.glb', ''))!);
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {} }) }) } as unknown as Document;
  const models = new CharacterModels();
  try {
    const world = new WorldState(); new AgentManager(world).initializeAllAgents();
    const rig = models.create(world.agents.get('neo')!);
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.ok(rig.hero, 'the normal character factory must finish loading the shipped skinned body');
    const input: MotionInput = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, officeShirt: true };
    const poses: Partial<MotionInput>[] = [
      ...[.65, 1.1, 1.7, 2.2].map(elapsed => ({ phone: { phase: 'pickup' as const, elapsed } })),
      { phone: { phase: 'ready', elapsed: 0 } },
      ...[.35, .55, .65, .7, .76, .82, .95, 1.1, 1.25, 1.45, 2, 8].map(elapsed => ({ phone: { phase: 'answering' as const, elapsed } })),
      { phone: { phase: 'connected', elapsed: 11 } },
      { speed: 1.6, turn: .6, crouching: true, phone: { phase: 'connected', elapsed: 11 } },
      ...[.8, 1.7, 2.7, 3.5, 5.4].map(crossing => ({ crossing, phone: { phase: 'connected' as const, elapsed: 11 } })),
    ];
    const point = new THREE.Vector3(); let checked = 0;
    const readyHandset = new THREE.Matrix4();
    const sleeve = rig.hero.root.getObjectByName('Office_shirt') as THREE.SkinnedMesh;
    const wristSkin = rig.hero.root.getObjectByName('Anatomical_wrist_skin') as THREE.SkinnedMesh;
    for (const pose of poses) {
      const crossing = pose.crossing === undefined ? undefined : officeCrossingPose(pose.crossing);
      rig.root.position.set(crossing?.x ?? 0, crossing?.y ?? 0, crossing?.z ?? 0); rig.root.rotation.y = crossing?.yaw ?? 0;
      models.animate(rig, .05, { ...input, ...pose }, 0); rig.root.updateMatrixWorld(true);
      assert.ok(rig.phone?.root.visible, 'the normal renderer must attach and show the handset');
      if (pose.phone?.phase === 'ready') readyHandset.copy(rig.phone.root.matrixWorld);
      if (pose.phone?.phase === 'answering') {
        assert.ok(sleeve.visible && sleeve.geometry.index!.count > 18000, 'keep the actual full office shirt');
        const length = longestSleeveCrossing(sleeve);
        assert.ok(length < .08, `the right sleeve crosses itself for ${length} model units at ${pose.phone.elapsed}s`);
        if (pose.phone.elapsed === .35) assert.ok(rig.phone.root.matrixWorld.elements.every((value, i) =>
          Math.abs(value - readyHandset.elements[i]) < 1e-7), 'the lift must start at the existing waiting pose');
        if (pose.phone.elapsed >= 1.45) {
          assert.ok(wristSkin.visible, 'retain the continuous skin below the cuff');
          const exposure = longestSleeveCrossing(sleeve, wristSkin);
          assert.ok(exposure < .025, `the wrist skin crosses the closed sleeve for ${exposure} model units`);
          const speaker = rig.phone.root.localToWorld(PHONE_SPEAKER.clone());
          const ear = rig.hero.bones.get('head')!.localToWorld(new THREE.Vector3(-.213, .11, -.027));
          assert.ok(speaker.distanceTo(ear) < .055, 'the actual speaker grille stays close to the outer ear');
        }
      }
      const indexBase = rig.hero.bones.get('finger2-1_R')!.getWorldPosition(new THREE.Vector3());
      const littleBase = rig.hero.bones.get('finger5-1_R')!.getWorldPosition(new THREE.Vector3());
      const acrossPalm = indexBase.sub(littleBase).normalize();
      const phoneLongAxis = new THREE.Vector3(0, 1, 0).transformDirection(rig.phone!.root.matrixWorld);
      assert.ok(phoneLongAxis.dot(acrossPalm) > .85, 'the handset must lie across the four knuckles, with its earpiece toward the index finger');
      const wrist = rig.hero.bones.get('wrist_R')!;
      for (let digit = 2; digit <= 5; digit++) {
        const base = wrist.worldToLocal(rig.hero.bones.get(`finger${digit}-1_R`)!.getWorldPosition(new THREE.Vector3()));
        const tip = wrist.worldToLocal(rig.hero.bones.get(`finger${digit}-3_R`)!.getWorldPosition(new THREE.Vector3()));
        assert.ok(Math.abs(tip.z - base.z) < .025, `finger ${digit} is bent sideways around the handset: ${Math.abs(tip.z - base.z)}`);
      }
      const pads = Array.from({ length: 5 }, () => new THREE.Vector3()), counts = [0, 0, 0, 0, 0];
      rig.hero.root.traverse(mesh => {
        if (!(mesh instanceof THREE.SkinnedMesh) || !mesh.visible) return;
        mesh.skeleton.update();
        const indices = mesh.geometry.attributes.skinIndex, weights = mesh.geometry.attributes.skinWeight;
        for (let i = 0; i < indices.count; i++) {
          const hand = [0, 1, 2, 3].some(j => weights.getComponent(i, j) > .25 && /^(finger\d-\d_R|wrist_R)$/.test(mesh.skeleton.bones[indices.getComponent(i, j)].name));
          if (!hand) continue;
          checked++;
          mesh.getVertexPosition(i, point); mesh.localToWorld(point); rig.phone!.root.worldToLocal(point);
          for (let j = 0; j < 4; j++) {
            const tip = /^finger([1-5])-3_R$/.exec(mesh.skeleton.bones[indices.getComponent(i, j)].name);
            if (tip && weights.getComponent(i, j) > .95) { pads[Number(tip[1]) - 1].add(point); counts[Number(tip[1]) - 1]++; }
          }
          // A conservative interior of the actual curved casing, excluding its rounded corners.
          const curve = point.y * point.y * .23;
          const depth = Math.min(.061 - Math.abs(point.x), .18 - Math.abs(point.y), point.z - curve + .034, .026 + curve - point.z);
          assert.ok(depth <= .001, `${mesh.name} hand enters the solid handset by ${depth}: ${point.toArray()}, pose ${JSON.stringify(pose)}`);
        }
      });
      pads.forEach((pad, i) => { assert.ok(counts[i] > 50); pad.divideScalar(counts[i]); });
      const gaps = [Infinity, Infinity, Infinity, Infinity, Infinity], triangle = new THREE.Triangle(), nearest = new THREE.Vector3();
      const inverse = rig.phone!.root.matrixWorld.clone().invert();
      rig.phone!.root.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        const geometry = object.geometry, indices = geometry.index, position = geometry.attributes.position;
        const matrix = inverse.clone().multiply(object.matrixWorld);
        for (let i = 0; i < (indices?.count ?? position.count); i += 3) {
          [triangle.a, triangle.b, triangle.c].forEach((vertex, j) => vertex.fromBufferAttribute(position, indices ? indices.getX(i + j) : i + j).applyMatrix4(matrix));
          pads.forEach((pad, j) => { triangle.closestPointToPoint(pad, nearest); gaps[j] = Math.min(gaps[j], nearest.distanceTo(pad)); });
        }
      });
      assert.ok(gaps.every(gap => gap < .04), `finger pads float away from the physical handset: ${gaps}`);
      for (const [name, rest] of rig.hero.rest) if (/^finger\d-\d_R$/.test(name)) {
        assert.ok(rig.hero.bones.get(name)!.position.distanceTo(rest) < 1e-7, 'holding the phone cannot stretch or relocate a finger joint');
      }
    }
    assert.ok(checked > 10000, 'check the actual finger surfaces rather than wrist positions alone');
    const cold = models.create(world.agents.get('neo')!);
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.ok(cold.hero);
    for (const phase of ['ready', 'connected'] as const) {
      const saved = { ...input, phone: { phase, elapsed: 2 } };
      models.animate(rig, 0, saved, 0);
      const fingers = [...rig.hero.bones].filter(([name]) => /^finger\d-\d_R$/.test(name));
      const held = new Map(fingers.map(([name, bone]) => [name, bone.quaternion.clone()]));
      models.animate(rig, 0, saved, 0); models.animate(cold, 0, saved, 0);
      for (const [name, bone] of fingers) {
        assert.ok(bone.quaternion.angleTo(held.get(name)!) < 1e-7, 'a frozen phone pose must not accumulate finger rotation');
        assert.ok(bone.quaternion.angleTo(cold.hero.bones.get(name)!.quaternion) < 1e-7, 'a newly loaded hand must reconstruct the saved grip');
      }
    }
    models.animate(rig, .05, input, 0);
    assert.equal(rig.phone!.root.visible, false, 'putting the phone away restores ordinary hand animation');
    models.animate(cold, .05, input, 0);
    for (const [name, bone] of rig.hero.bones) if (/^finger\d-\d_R$/.test(name))
      assert.ok(bone.quaternion.angleTo(cold.hero.bones.get(name)!.quaternion) < 1e-7, 'putting the phone away must not retain the grip');
  } finally { models.dispose(); globalThis.document = document; }
});

test('Neo keeps three contacts on the office ladder while changing rungs, stopping and reversing', async t => {
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking'].map(async id => [id, await loadGeometry(id)] as const)));
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async (url: string) => assets.get(url.split('/').at(-1)!.replace('.glb', ''))!);
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({
    fillRect() {}, fillText() {}, strokeRect() {},
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {},
  }) }) } as unknown as Document;
  const models = new CharacterModels(), world = new WorldState();
  t.after(() => { models.dispose(); globalThis.document = document; });
  new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!, rig = models.create(neo), restored = models.create(neo);
  const center = FILM_SETS.film_office_ledge.center, floor = center.y - 1;
  const draw = (actor: typeof rig, depth: number, climbing: number, exit?: number) => {
    const step = (exit ?? 0) ** 2 * (3 - 2 * (exit ?? 0));
    actor.root.position.set(center.x + OFFICE_LADDER.x + OFFICE_LADDER.stepOff * step, floor - depth, center.z + OFFICE_LADDER.z);
    actor.root.rotation.y = Math.PI / 2;
    models.animate(actor, 0, { speed: 0, grounded: false, verticalVelocity: 0, turn: 0, officeShirt: true, climbing, officeLadder: { depth, exit } }, 1);
    actor.root.updateMatrixWorld(true);
    const hero = actor.hero;
    if (!hero) return [0, 1].flatMap(i => [
      actor.elbows[i].localToWorld(new THREE.Vector3(0, -.79, .055)),
      actor.ankles[i].localToWorld(new THREE.Vector3(0, -.155, .13)),
    ]);
    return ['R', 'L'].flatMap((side, index) => [
      hero.bones.get('wrist_' + side)!.localToWorld(new THREE.Vector3(index ? -.085 : .085, -.23, 0)),
      hero.bones.get('ankle_' + side)!.localToWorld(new THREE.Vector3(0, -hero.footHeight, .23)),
    ]);
  };
  const rungX = center.x - 2.5, base = floor - OFFICE_LADDER.depth, rungZ = center.z + OFFICE_LADDER.z;
  const supported = (point: THREE.Vector3, hand: boolean) => {
    const y = point.y - (hand ? 0 : .045), rung = base + Math.round((y - base) / .55) * .55;
    if (hand && y > floor && Math.abs(Math.abs(point.z - rungZ) - .82) < .045)
      return y < floor + 4.6 && Math.abs(point.x - rungX + .06) < .025;
    return rung >= base && rung <= floor + 4.6 && Math.abs(y - rung) < .025
      && Math.abs(point.x - rungX + (hand ? .05 : 0)) < .035 && Math.abs(point.z - rungZ) < .825;
  };
  const fallback = draw(rig, 0, 0);
  assert.ok(fallback.filter((point, i) => supported(point, i % 2 === 0)).length >= 3,
    `the procedural body must also hold the ladder while the model loads: ${fallback.map(point => point.toArray())}`);
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.ok(rig.hero && restored.hero);
  for (const start of [0, 1.1, 2.2, 3.3, 4.4, 15, 30.8]) {
    let previous: THREE.Vector3[] | undefined;
    for (let sample = 0; sample <= 29; sample++) {
      const depth = start + sample * .04, points = draw(rig, depth, 1);
      assert.ok(points.filter((point, i) => supported(point, i % 2 === 0)).length >= 3,
        `lost rung contacts at depth ${depth}: ${points.map(point => point.toArray())}`);
      if (previous) for (const [i, point] of points.entries())
        assert.ok(point.distanceTo(previous[i]) < .4, `limb ${i} jumped between rungs at depth ${depth}`);
      previous = points;
    }
  }
  for (const depth of [0, 4.12, 16.31, 31.91]) {
    const down = draw(rig, depth, 1), held = draw(rig, depth, 0), up = draw(restored, depth, -1);
    for (const [i, point] of down.entries()) {
      assert.ok(point.distanceTo(held[i]) < 1e-6, 'releasing the key must keep the same support points');
      assert.ok(point.distanceTo(up[i]) < 1e-6, 'a newly loaded body and the reverse direction use the same support points');
    }
  }
  const onLedge = (point: THREE.Vector3) => point.x >= center.x - 2.4 && Math.abs(point.y - floor) < .025;
  for (const exit of [0, .2, .4, .5, .6, .8, .98]) {
    const points = draw(rig, 0, 0, exit);
    assert.ok([points[1], points[3]].some(foot => onLedge(foot) || supported(foot, false)), `both feet are unsupported during the step off at ${exit}`);
    const loaded = draw(restored, 0, 0, exit);
    points.forEach((point, i) => assert.ok(point.distanceTo(loaded[i]) < 1e-6, 'cold load must retain the partial step off the ladder'));
  }
  const last = draw(rig, 0, 0, .999);
  assert.ok([last[1], last[3]].every(onLedge), 'both shoes must be on the platform before free walking resumes');
});
