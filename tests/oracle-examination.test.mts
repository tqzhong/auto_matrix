import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { FILM_SETS, ORACLE_VISIT, oracleVisitRoot, filmBlocked, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import type { CharacterRig, CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { FilmStorySystem } from '../packages/server/src/story/FilmStorySystem.js';

async function fixture(t: TestContext, delayed = false) {
  const pending: Promise<unknown>[] = [], assets = new Map<string, Promise<any>>();
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; }); if (!delayed) release();
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async url => {
    const name = String(url).split('/').pop()!;
    if (!assets.has(name)) assets.set(name, (async () => {
      await gate;
      const raw = await readFile(new URL(`../packages/client/public/assets/characters/${name}`, import.meta.url)), size = raw.readUInt32LE(12);
      const doc = JSON.parse(raw.subarray(20, 20 + size).toString());
      for (const material of doc.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
      doc.images = []; doc.textures = [];
      const json = Buffer.from(JSON.stringify(doc)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
      const bin = raw.subarray(20 + size), data = Buffer.alloc(20 + padded.length + bin.length);
      data.writeUInt32LE(0x46546c67); data.writeUInt32LE(2, 4); data.writeUInt32LE(data.length, 8);
      data.writeUInt32LE(padded.length, 12); data.writeUInt32LE(0x4e4f534a, 16); padded.copy(data, 20); bin.copy(data, 20 + padded.length);
      return new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '');
    })());
    const promise = assets.get(name)!; pending.push(promise); const asset = await promise; return { ...asset, scene: clone(asset.scene) };
  });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {}, fillRect() {}, strokeRect() {}, fillText() {}, createRadialGradient: () => ({ addColorStop() {} }) }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const scene = new THREE.Scene(); let renderer = new AgentRenderer(scene);
  const journey = { scene: 'm1_oracle', actor: 'neo', step: 1, completed: [], oracle: { consultation: { phase: 'examining', elapsed: 3.5 } } } as FilmJourney;
  world.agents.get('neo')!.controller = 'examination-test';
  const sandbox = { structures: [], threats: [], neoLife: { journey } } as unknown as SandboxState;
  const story = new FilmStorySystem(world, () => sandbox, () => {}, () => {});
  const render = (delta = 0, worldSpeed = 0) => { renderer.update(delta, undefined, worldSpeed, 0, journey); scene.updateMatrixWorld(true); };
  let tick = 10;
  const advance = (dt: number) => {
    story.oracleFrame(world.agents.get('neo')!, true, dt, ++tick);
    for (const role of ['neo', 'oracle']) renderer.updateAgent(role, world.agents.get(role)!);
    render(dt, 1);
  };
  const snapshot = (elapsed: number, reverse = false) => {
    journey.oracle!.consultation = { ...journey.oracle!.consultation, phase: 'examining', elapsed };
    story.oracleFrame(world.agents.get('neo')!, true, 0, 10);
    for (const role of reverse ? ['oracle', 'neo'] as const : ['neo', 'oracle'] as const) {
      renderer.updateAgent(role, world.agents.get(role)!);
    }
    render();
  };
  const settle = async () => {
    release(); for (let i = 0; i < 4; i++) { await Promise.all(pending); await new Promise(resolve => setImmediate(resolve)); render(); }
    assert.ok(rig('oracle').oracleFirstBody && visible(rig('oracle').oracleFirstBody!), 'contact fixtures must use the delivered kitchen body');
    const head = rig('oracle').root.getObjectByName('oracle-first-anatomical-head');
    assert.ok(head && visible(head), 'contact fixtures must use the delivered first-film head');
  };
  const rig = (id: string) => (renderer as unknown as { agents: Map<string, { rig: CharacterRig }> }).agents.get(id)!.rig;
  t.after(() => { renderer.dispose(); globalThis.document = document; });
  const restart = () => { renderer.dispose(); renderer = new AgentRenderer(scene); };
  return { get renderer() { return renderer; }, journey, world, snapshot, render, advance, restart, settle, rig };
}

function visible(object: THREE.Object3D): boolean {
  for (let parent: THREE.Object3D | null = object; parent; parent = parent.parent) if (!parent.visible) return false;
  return true;
}

function headTriangles(rig: CharacterRig): THREE.Triangle[] {
  const skin = rig.hero!.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  const { skinIndex, skinWeight } = skin.geometry.attributes, index = skin.geometry.index!, result: THREE.Triangle[] = [];
  const isHead = (v: number) => [0, 1, 2, 3].some(j => skinWeight.getComponent(v, j) > .99 && skin.skeleton.bones[skinIndex.getComponent(v, j)].name === 'head');
  for (let i = 0; i < index.count; i += 3) {
    const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)]; if (!ids.every(isHead)) continue;
    const triangle = new THREE.Triangle(...ids.map(v => skin.localToWorld(skin.getVertexPosition(v, new THREE.Vector3()))) as [THREE.Vector3, THREE.Vector3, THREE.Vector3]);
    if (triangle.getArea() > 1e-10) result.push(triangle);
  }
  return result;
}

test('both Oracle palms touch the actual Neo cheek mesh during the saved examination', async t => {
  const h = await fixture(t); h.snapshot(3.5); await h.settle();
  for (const elapsed of [2.7, 3.5, 4.2]) {
    h.snapshot(elapsed); const triangles = headTriangles(h.rig('neo')), closest = new THREE.Vector3(), gaps: number[] = [];
    for (const side of ['R', 'L']) {
      let gap = Infinity; const wrist = h.rig('oracle').root.getObjectByName(`oracle-hand-${side}`)!;
      wrist.traverse(object => {
        if (!(object instanceof THREE.Mesh) || !visible(object)) return;
        const attrs = object.geometry.attributes;
        for (let v = 0; v < attrs.position.count; v++) {
          if (object instanceof THREE.SkinnedMesh && ![0, 1, 2, 3].some(j => attrs.skinWeight.getComponent(v, j) > .8 && object.skeleton.bones[attrs.skinIndex.getComponent(v, j)].name === `wrist_${side}`)) continue;
          const point = object.localToWorld(object.getVertexPosition(v, new THREE.Vector3()));
          for (const triangle of triangles) gap = Math.min(gap, triangle.closestPointToPoint(point, closest).distanceTo(point));
        }
      });
      gaps.push(gap);
    }
    assert.ok(gaps.every(gap => gap < .025), `both palms must contact the cheeks at ${elapsed}: ${gaps}`);
  }
});

test('Neo opens his actual jaw before the cookie bite and restores it after the visit', async t => {
  const h = await fixture(t); h.snapshot(10.8); await h.settle();
  const actor = h.world.agents.get('neo')!, skin = h.rig('neo').hero!.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  const index = skin.morphTargetDictionary!.jawOpen;
  assert.notEqual(index, undefined);
  const pose = (elapsed: number) => {
    actor.currentAction!.parameters = { oracleDeparture: { phase: 'biting', elapsed, rise: 3.8, role: 'neo' } };
    h.renderer.updateAgent('neo', actor); h.render(); return skin.morphTargetInfluences![index];
  };
  assert.ok(pose(1.2) > .4, 'the lips must open before the cookie reaches the mouth');
  assert.ok(pose(1.5) < pose(1.2), 'the jaw closes on the first bite');
  assert.ok(pose(2.8) < .001, 'the jaw must be closed when the bite ends');
  actor.currentAction = null; h.renderer.updateAgent('neo', actor); h.render();
  assert.equal(skin.morphTargetInfluences![index], 0, 'leaving the action must not leave an open mouth');
});

test('the examination hands remain outside Neo’s actual head surface', async t => {
  const h = await fixture(t); h.snapshot(3.5); await h.settle();
  for (const elapsed of [2, 2.4, 2.7, 3.5, 4.2, 4.9, 5.4]) {
    h.snapshot(elapsed);
    const triangles = headTriangles(h.rig('neo')), bounds = new THREE.Box3();
    triangles.forEach(face => [face.a, face.b, face.c].forEach(p => bounds.expandByPoint(p)));
    const closest = new THREE.Vector3(), best = new THREE.Vector3(), normal = new THREE.Vector3();
    for (const hand of h.rig('oracle').parkHands!) {
      let worst = 0, worstVertex = -1;
      for (let v = 0; v < hand.skin.geometry.attributes.position.count; v++) {
        const point = hand.skin.localToWorld(hand.skin.getVertexPosition(v, new THREE.Vector3()));
        if (!bounds.containsPoint(point)) continue;
        let distance = Infinity, face: THREE.Triangle | undefined;
        for (const triangle of triangles) {
          triangle.closestPointToPoint(point, closest); const gap = closest.distanceToSquared(point);
          if (gap < distance) { distance = gap; best.copy(closest); face = triangle; }
        }
        const signed = point.clone().sub(best).dot(face!.getNormal(normal));
        if (signed < worst) { worst = signed; worstVertex = v; }
      }
      const attrs = hand.skin.geometry.attributes;
      const driver = worstVertex >= 0 ? [0, 1, 2, 3].map(j => `${hand.skin.skeleton.bones[attrs.skinIndex.getComponent(worstVertex, j)].name}:${attrs.skinWeight.getComponent(worstVertex, j)}`) : [];
      assert.ok(worst > -.003, `${hand.wrist.name} penetrates the face at ${elapsed}: ${worst}, vertex ${worstVertex} ${driver}`);
    }
  }
});

test('the authored approach is continuous, avoids furniture and plants each foot while the other steps', async t => {
  const h = await fixture(t); h.snapshot(0); await h.settle();
  const center = FILM_SETS.film_oracle_home.center;
  let previous = oracleVisitRoot({ phase: 'examining', elapsed: 0 }, 'oracle');
  for (let frame = 0; frame <= 72; frame++) {
    const elapsed = frame / 10, place = oracleVisitRoot({ phase: 'examining', elapsed }, 'oracle');
    assert.ok(Math.abs(place.x - previous.x) < .14, `approach teleports at ${elapsed}`); previous = place;
    assert.equal(filmBlocked({ x: center.x + place.x, y: center.y, z: center.z + place.z }, FILM_SETS.film_oracle_home, .65), false, `the route crosses kitchen furniture at ${elapsed}`);
    h.snapshot(elapsed); const rig = h.rig('oracle'), shoes = rig.oracleFirstBody?.getObjectByName('oracle-first-shoes') as THREE.SkinnedMesh | undefined;
    const soles = rig.ankles.map((ankle, side) => {
      let min = Infinity;
      if (shoes) {
        const attrs = shoes.geometry.attributes;
        for (let v = 0; v < attrs.position.count; v++) {
          if (![0, 1, 2, 3].some(j => attrs.skinWeight.getComponent(v, j) > .5 && shoes.skeleton.bones[attrs.skinIndex.getComponent(v, j)].name === `ankle_${side ? 'L' : 'R'}`)) continue;
          min = Math.min(min, shoes.localToWorld(shoes.getVertexPosition(v, new THREE.Vector3())).y - center.y + 1);
        }
        return min;
      }
      ankle.traverse(object => { if (!(object instanceof THREE.Mesh) || !visible(object)) return;
        for (let v = 0; v < object.geometry.attributes.position.count; v++) min = Math.min(min, object.localToWorld(object.getVertexPosition(v, new THREE.Vector3())).y - center.y + 1);
      }); return min;
    });
    assert.ok(soles.every(y => y >= -.025), `a shoe penetrates the floor at ${elapsed}: ${soles}`);
    assert.ok(Math.min(...soles) < .04, `both feet float at ${elapsed}: ${soles}`);
  }
  for (const elapsed of [0, 7.2, 9.2, 10.8]) assert.equal(oracleVisitRoot({ phase: 'examining', elapsed }, 'oracle').x, ORACLE_VISIT.oracle.x);
});

test('a paused cold snapshot and V toggles reconstruct the same two-hand examination', async t => {
  const h = await fixture(t, true); h.snapshot(3.5, true); await h.settle();
  const wrists = () => h.rig('oracle').parkHands!.map(hand => hand.wrist.matrixWorld.clone());
  const original = wrists();
  for (const firstPerson of [true, false, true, false]) {
    h.renderer.setPlayer('neo', firstPerson);
    h.renderer.setPlayerMotion({ speed: 0, grounded: true, verticalVelocity: 0, turn: 0, firstPerson,
      oracleVisit: { phase: 'examining', elapsed: 3.5, role: 'neo' } });
    h.render(.1);
    wrists().forEach((matrix, i) => matrix.elements.forEach((value, j) => assert.ok(Math.abs(value - original[i].elements[j]) < .001, 'paused/V pose drift')));
  }
  h.renderer.setPlayer(null); h.snapshot(8.65); h.snapshot(3.5);
  wrists().forEach((matrix, i) => matrix.elements.forEach((value, j) => assert.ok(Math.abs(value - original[i].elements[j]) < .001, 'returning from the cookie cannot retain its wrist pose')));
});

test('Oracle holds the cookie between her articulated thumb and index before transferring it to Neo', async t => {
  const h = await fixture(t); h.snapshot(8.65); await h.settle();
  for (const elapsed of [7.8, 8.65, 9.199]) {
    h.snapshot(elapsed); const rig = h.rig('oracle'), hand = rig.parkHands![0], cookie = rig.cookie!;
    assert.equal(hand.bones.length, 5); assert.ok(hand.bones.every(chain => chain.length === 3), 'all five three-joint digits remain in the hand');
    assert.ok(cookie.parent === hand.wrist, 'the cookie must attach to the anatomical wrist');
    const pads = hand.bones.slice(0, 2).map((chain, i) => cookie.worldToLocal(chain[2].localToWorld(hand.pads[i].clone())));
    assert.ok(pads[0].z > .022 && pads[1].z < -.022, `pads do not oppose the cookie: ${pads.map(p => p.toArray())}`);
    pads.forEach(p => assert.ok(Math.abs(p.x + .1) < .025 && Math.abs(p.y) < .025, `pad misses the cookie rim: ${p.toArray()}`));
    const base = cookie.getObjectByName('cookie-whole')!.children[0] as THREE.Mesh, index = base.geometry.index!, triangles: THREE.Triangle[] = [];
    for (let i = 0; i < index.count; i += 3) triangles.push(new THREE.Triangle(...[0, 1, 2].map(j => base.localToWorld(new THREE.Vector3().fromBufferAttribute(base.geometry.attributes.position, index.getX(i + j)))) as [THREE.Vector3, THREE.Vector3, THREE.Vector3]));
    const planes = triangles.filter(face => face.getArea() > 1e-10).map(face => new THREE.Plane().setFromNormalAndCoplanarPoint(face.getNormal(new THREE.Vector3()), face.a));
    const attrs = hand.skin.geometry.attributes, nearest = new THREE.Vector3(), gaps = [Infinity, Infinity];
    for (let v = 0; v < attrs.position.count; v++) for (let j = 0; j < 4; j++) {
      const driver = hand.skin.skeleton.bones[attrs.skinIndex.getComponent(v, j)].name;
      if (attrs.skinWeight.getComponent(v, j) > .5 && /^finger[1-5]-[1-3]_R$/.test(driver)) {
        const vertex = hand.skin.localToWorld(hand.skin.getVertexPosition(v, new THREE.Vector3()));
        const clearance = Math.max(...planes.map(plane => plane.distanceToPoint(vertex)));
        assert.ok(clearance >= -.0002, `${driver} enters the actual convex biscuit at ${elapsed}: ${clearance}`);
      }
      const match = /^finger([12])-3_R$/.exec(driver);
      if (!match || attrs.skinWeight.getComponent(v, j) <= .5) continue;
      const digit = Number(match[1]) - 1, point = hand.skin.localToWorld(hand.skin.getVertexPosition(v, new THREE.Vector3()));
      for (const face of triangles) gaps[digit] = Math.min(gaps[digit], face.closestPointToPoint(point, nearest).distanceTo(point));
      const local = cookie.worldToLocal(point.clone());
      if (local.x < -.09 && local.x > -.12 && Math.abs(local.y) < .03)
        assert.ok(Math.abs(local.z) >= .0123, `finger ${digit + 1} penetrates the biscuit: ${local.toArray()}`);
    }
    assert.ok(gaps.every(gap => gap < .012), `actual articulated finger surfaces float off the biscuit: ${gaps}`);
  }
  const before = h.rig('oracle').cookie!.getWorldPosition(new THREE.Vector3());
  h.snapshot(9.2); const after = h.rig('neo').cookie!.getWorldPosition(new THREE.Vector3());
  assert.ok(before.distanceTo(after) < .025, `the cookie jumps between hands: ${before.distanceTo(after)}, ${before.toArray()} -> ${after.toArray()}`);
  assert.equal(h.rig('oracle').cookie!.visible, false); assert.equal(h.rig('neo').cookie!.visible, true);
});

test('the full fingers close around the cookie and release it without a one-frame snap', async t => {
  const h = await fixture(t); h.snapshot(6.99); await h.settle();
  let maximumStep = 0, maximumFlex = 0;
  const joints = () => { const rig = h.rig('oracle'); return [...rig.shoulders, ...rig.elbows, ...rig.parkHands!.flatMap(hand => [hand.wrist, ...hand.bones.flat()])]; };
  for (const [start, end] of [[1.49, 5.41], [6.99, 9.86]]) {
    h.snapshot(start); let previous = joints().map(bone => bone.quaternion.clone());
    for (let frame = 1; frame <= Math.ceil((end - start) * 100); frame++) {
      const elapsed = start + frame / 100; h.snapshot(elapsed); const bones = joints();
      bones.forEach((bone, i) => {
        const step = previous[i].angleTo(bone.quaternion); maximumStep = Math.max(maximumStep, step);
        assert.ok(step < .15, `${bone.name || i} snaps at ${elapsed}: ${step}`);
      });
      for (const hand of h.rig('oracle').parkHands!) hand.bones.forEach((chain, digit) => chain.forEach((bone, joint) => {
        const axis = (chain[joint + 1]?.position ?? hand.pads[digit]).clone().normalize();
        const flex = axis.angleTo(axis.clone().applyQuaternion(bone.quaternion)); maximumFlex = Math.max(maximumFlex, flex);
        assert.ok(flex < 2.55, `${bone.name} folds back at ${elapsed}: ${flex}`);
      }));
      previous = bones.map(bone => bone.quaternion.clone());
    }
  }
  t.diagnostic(`10 ms sampling: largest joint step=${maximumStep}, largest digit flex=${maximumFlex} radians`);
});

test('every fitted cheek and finger ray lands on the actual delivered Neo head', async t => {
  const h = await fixture(t); h.snapshot(3.5); await h.settle();
  const neo = h.rig('neo'), head = neo.hero!.bones.get('head')!, triangles = headTriangles(neo), nearest = new THREE.Vector3();
  let hits = 0;
  for (const hand of h.rig('oracle').parkHands!) {
    const fit = hand.wrist.userData.oracleExaminationFit as { samples: THREE.Vector3[]; fingers: THREE.Quaternion[][] } | undefined;
    assert.ok(fit && fit.fingers.length === 5, 'a failed side ray must not generate a fictitious origin contact');
    assert.equal(fit.samples.length, 13, 'both palm slopes and both samples for each of five fingers must hit');
    for (const sample of fit.samples) {
      const point = head.localToWorld(sample.clone()); let gap = Infinity;
      for (const face of triangles) gap = Math.min(gap, face.closestPointToPoint(point, nearest).distanceTo(point));
      assert.ok(gap < .00001, `a cached contour sample is not on the head: ${gap}`); hits++;
    }
  }
  t.diagnostic(`${hits} actual head surface hits; 0 missing rays`);
});

test('leaving the cookie bite does not overwrite a following meal’s mouth performance', async t => {
  const h = await fixture(t); h.snapshot(10.8); await h.settle(); const rig = h.rig('neo');
  const models = (h.renderer as unknown as { models: CharacterModels }).models;
  const neutral = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 };
  models.animate(rig, 0, { ...neutral, oracleDeparture: { phase: 'biting', elapsed: 1.2, rise: 3.8, role: 'neo' } }, 4);
  models.animate(rig, 0, { ...neutral, interlude: { kind: 'meal', phase: 'accepting', elapsed: 3, role: 'neo', physicalMeal: true } }, 4);
  const skin = rig.hero!.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  assert.ok(skin.morphTargetInfluences![skin.morphTargetDictionary!.jawOpen] > .5, 'the old cookie owner must yield to the active meal mouth');
});

test('the giver keeps her wrist aligned with her forearm throughout the cookie offer', async t => {
  const h = await fixture(t); h.snapshot(8.65); await h.settle(); let minimumAlignment = 1;
  for (let frame = 0; frame <= 285; frame++) {
    const elapsed = 7 + frame / 100; h.snapshot(elapsed); const rig = h.rig('oracle'), hand = rig.parkHands![0];
    const wrist = hand.wrist.getWorldPosition(new THREE.Vector3());
    const forearm = wrist.clone().sub(rig.elbows[0].getWorldPosition(new THREE.Vector3())).normalize();
    const palm = hand.bones[2][0].getWorldPosition(new THREE.Vector3()).sub(wrist).normalize();
    minimumAlignment = Math.min(minimumAlignment, forearm.dot(palm));
    assert.ok(forearm.dot(palm) > .3, `Oracle wrist folds back at ${elapsed}: ${forearm.dot(palm)}`);
  }
  t.diagnostic(`minimum Oracle forearm/palm alignment: ${minimumAlignment}`);
});

test('the cookie appears only after the giver has finished the examination and prepared her grip', async t => {
  const h = await fixture(t); h.snapshot(3.5); await h.settle();
  for (const elapsed of [0, 3.5, 6.9, 7.34, 7.35, 8.65, 9.199, 9.2, 10.8]) {
    h.snapshot(elapsed);
    const held = ['oracle', 'neo'].filter(id => visible(h.rig(id).cookie!));
    assert.deepEqual(held, elapsed < 7.35 ? [] : [elapsed < 9.2 ? 'oracle' : 'neo']);
  }
});


test('a running server return step keeps the Oracle facing Neo instead of turning with her negative velocity', async t => {
  const h = await fixture(t); h.snapshot(0); await h.settle();
  let negativeFrames = 0;
  for (let frame = 1; frame <= 71; frame++) {
    h.advance(.1); const actor = h.world.agents.get('oracle')!;
    if (actor.velocity.x < -.1) negativeFrames++;
    const actual = h.rig('oracle').root.rotation.y, expected = actor.rotation;
    const error = Math.atan2(Math.sin(actual - expected), Math.cos(actual - expected));
    assert.ok(Math.abs(error) < .00001, `saved facing changed at ${h.journey.oracle!.consultation!.elapsed}: yaw ${actual}, saved ${expected}, velocity ${actor.velocity.x}`);
  }
  assert.ok(negativeFrames >= 10, 'the test must traverse the actual server-authored backward step');
});

test('running, paused and fresh clients reconstruct the same saved examination and cookie pose', async t => {
  const h = await fixture(t);
  const approach = { ...ORACLE_VISIT.neo, z: ORACLE_VISIT.neo.z + 1.2 };
  h.journey.oracle!.consultation!.approach = approach;
  h.snapshot(0); await h.settle();
  assert.deepEqual(h.journey.oracle!.consultation!.approach, approach, 'the initial snapshot must preserve the nonzero saved walk');
  const initialPosition = { ...h.world.agents.get('neo')!.position };
  const capture = () => ['oracle', 'neo'].flatMap(id => {
    const rig = h.rig(id);
    const joints = id === 'oracle' ? [rig.root, rig.torso, rig.head, ...rig.shoulders, ...rig.elbows, ...rig.hips, ...rig.knees, ...rig.ankles,
      ...rig.parkHands!.flatMap(hand => [hand.wrist, ...hand.bones.flat()])]
      : [rig.root, ...['head', 'chest', 'shoulder_R', 'shoulder_L', 'elbow_R', 'elbow_L', 'wrist_R', 'wrist_L',
        'hip_R', 'hip_L', 'knee_R', 'knee_L', 'ankle_R', 'ankle_L'].map(name => rig.hero!.bones.get(name)!)];
    if (rig.cookie!.visible) joints.push(rig.cookie!);
    return joints.map((joint, i) => ({ name: `${id}:${joint.name || i}`, matrix: joint.matrixWorld.clone() }));
  });
  const equal = (actual: ReturnType<typeof capture>, expected: ReturnType<typeof capture>, label: string) => {
    assert.equal(actual.length, expected.length, `${label}: visible prop ownership`);
    actual.forEach((pose, i) => {
      const error = Math.max(...pose.matrix.elements.map((v, j) => Math.abs(v - expected[i].matrix.elements[j])));
      assert.ok(error < .00001, `${label}: ${pose.name} differs by ${error}`);
    });
  };
  const saved: { elapsed: number; consultation: string; pose: ReturnType<typeof capture> }[] = [];
  for (const elapsed of [1.2, 2.4, 3.5, 5.8, 6.8, 8.65, 9.2]) {
    while (h.journey.oracle!.consultation!.elapsed < elapsed - 1e-8) h.advance(Math.min(.1, elapsed - h.journey.oracle!.consultation!.elapsed));
    if (elapsed === 1.2) {
      assert.ok(initialPosition.z - h.world.agents.get('neo')!.position.z > 1, 'the real server must advance Neo along the nonzero approach');
      assert.ok(h.rig('neo').motion.speed > .4, 'the actual walking pose must retain a nonzero saved-time gait');
    }
    const running = capture();
    for (let frame = 0; frame < 5; frame++) h.render(.1, 0);
    equal(capture(), running, `running to paused at ${elapsed}`);
    saved.push({ elapsed, consultation: JSON.stringify(h.journey.oracle!.consultation), pose: running });
  }
  for (const { elapsed, consultation, pose } of saved) {
    h.journey.oracle!.consultation = JSON.parse(consultation);
    h.restart(); h.snapshot(elapsed); await h.settle();
    assert.deepEqual(h.journey.oracle!.consultation!.approach, approach, 'cold reconstruction must preserve the serialized approach');
    equal(capture(), pose, `cold saved snapshot at ${elapsed}`);
  }
});
