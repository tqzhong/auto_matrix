import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, farewellPose, type FarewellEncounter } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import type { MotionInput } from '../packages/client/src/agents/CharacterMotion.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { LogosWreckRenderer } from '../packages/client/src/engine/LogosWreckRenderer.js';

async function loadGeometry(id: string) {
  const glb = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
  const jsonLength = glb.readUInt32LE(12), document = JSON.parse(glb.subarray(20, 20 + jsonLength).toString());
  // Keep the delivered mesh and rig; texture decoding is checked in the browser.
  for (const material of document.materials) {
    delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture;
  }
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = glb.subarray(20 + jsonLength), result = Buffer.alloc(20 + padded.length + bin.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); bin.copy(result, 20 + padded.length);
  return new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
}

async function setup(t: test.TestContext) {
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking', 'trinity', 'trinity-club'].map(async id => [id, await loadGeometry(id)] as const)));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async (path: string) => assets.get(path.split('/').pop()!.replace(/\.glb.*$/, ''))!);
  const document = globalThis.document;
  const context = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const renderers: AgentRenderer[] = [];
  t.after(() => { renderers.forEach(renderer => renderer.dispose()); globalThis.document = document; });
  const create = () => { const renderer = new AgentRenderer(new THREE.Scene()); renderer.setWorld(false); renderers.push(renderer); return renderer; };
  const save = (renderer: AgentRenderer, encounter: FarewellEncounter, roles: ('neo' | 'trinity')[] = ['neo', 'trinity']) => {
    const poses = farewellPose(encounter), center = FILM_SETS.film_logos_wreck.center;
    for (const role of roles) {
      const actor = structuredClone(world.agents.get(role)!), pose = poses[role];
      actor.position = { x: center.x + pose.x, y: center.y, z: center.z + pose.z };
      actor.rotation = pose.yaw; actor.velocity = { x: 0, y: 0, z: 0 }; actor.currentLocation = 'film_logos_wreck'; actor.isInMatrix = false;
      actor.status = role === 'trinity' && encounter.phase === 'still' ? 'dead' : 'alive';
      actor.currentAction = { type: 'idle', parameters: { floorSeated: role === 'trinity', crouching: role === 'neo', farewell: { ...encounter, role } },
        startedAt: 0, duration: 1, progress: 0 };
      renderer.updateAgent(role, actor);
    }
  };
  return { create, save };
}

function snapshot(renderer: AgentRenderer) {
  return ['neo', 'trinity'].map(id => {
    const body = renderer.getAgentBody(id)!; body.parent!.parent!.updateMatrixWorld(true);
    assert.ok(body.getObjectByName('pelvis'), `${id} must use the delivered GLB`);
    const bones = createHash('sha256'), clothes = createHash('sha256');
    body.traverse(object => {
      if (object instanceof THREE.Bone) bones.update(JSON.stringify([object.name, object.matrixWorld.elements]));
      if (object instanceof THREE.Mesh) clothes.update(Buffer.from(object.geometry.attributes.position.array.buffer));
    });
    return { id, root: body.matrixWorld.elements.slice(), bones: bones.digest('hex'), clothes: clothes.digest('hex') };
  });
}

test('Trinity restores her supported recline on the first paused farewell frame', async t => {
  const h = await setup(t), renderer = h.create();
  h.save(renderer, { phase: 'goodbye', elapsed: 2.1, total: 12.5 });
  await new Promise(resolve => setImmediate(resolve));
  renderer.update(0, undefined, 0);
  assert.ok(renderer.getAgentBody('trinity')!.getObjectByName('pelvis'), 'exercise the delivered Trinity GLB');
  assert.equal(renderer.getAgentBody('trinity')!.rotation.x, -.48, 'a cold paused frame must already meet the backrest');
  renderer.update(.2, undefined, 0);
  assert.equal(renderer.getAgentBody('trinity')!.rotation.x, -.48, 'pausing must not keep easing the body toward its support');
  const earlier = renderer.getAgentState('trinity')!;
  earlier.currentAction = undefined; earlier.status = 'dead';
  renderer.updateAgent('trinity', earlier); renderer.update(.2);
  assert.ok(renderer.getAgentBody('trinity')!.rotation.z > .5, 'exercise a cached body lying sideways before restoring the farewell');
  h.save(renderer, { phase: 'goodbye', elapsed: 2.1, total: 12.5 }); renderer.update(0, undefined, 0);
  assert.equal(renderer.getAgentBody('trinity')!.rotation.z, 0, 'a paused restore must remove a cached sideways death pose');
});

test('both farewell bodies and clothes reconstruct the saved beat independent of warm-up, pause and actor order', async t => {
  const h = await setup(t), warm = h.create();
  const beats: FarewellEncounter[] = [
    { phase: 'reaching', elapsed: 1.2, total: 1.2 },
    { phase: 'discovery', elapsed: 1.7, total: 4.1 },
    { phase: 'promise', elapsed: 2.3, total: 8.1 },
    { phase: 'goodbye', elapsed: 2.6, total: 13 },
    { phase: 'kiss', elapsed: 1.8, total: 17.4 },
    { phase: 'still', elapsed: 0, total: 18.4 },
  ];
  for (const beat of beats) {
    const cold = h.create(), reversed = h.create();
    h.save(warm, beat); h.save(cold, beat); h.save(reversed, beat, ['trinity', 'neo']);
    await new Promise(resolve => setImmediate(resolve));
    for (let frame = 0; frame < 3; frame++) warm.update(.016);
    cold.update(0, undefined, 0); reversed.update(0, undefined, 0);
    const saved = snapshot(warm);
    assert.deepEqual(snapshot(reversed), snapshot(cold), `${beat.phase}: cold hand targets must not depend on actor insertion order`);
    assert.deepEqual(snapshot(cold), saved, `${beat.phase}: cold bones and cloth must match the warmed saved frame`);
    warm.update(.2, undefined, 0);
    assert.deepEqual(snapshot(warm), saved, `${beat.phase}: pausing must freeze the entire saved pose`);
  }
});

test('player Neo wears the wreck outfit before any farewell action without losing ordinary walking', async t => {
  const h = await setup(t), warm = h.create(), cold = h.create();
  for (const renderer of [warm, cold]) {
    h.save(renderer, { phase: 'ready', elapsed: 0, total: 0 }, ['neo']);
    const actor = renderer.getAgentState('neo')!; actor.currentAction = undefined;
    renderer.updateAgent('neo', actor); renderer.setPlayer('neo');
    renderer.setPlayerMotion({ speed: 4, grounded: true, verticalVelocity: 0, turn: 0 });
  }
  await new Promise(resolve => setImmediate(resolve));
  const appearance = (renderer: AgentRenderer) => {
    const body = renderer.getAgentBody('neo')!, band = body.getObjectByName('neo-farewell-eye-band');
    assert.ok(body.getObjectByName('pelvis'), 'the ready player must use the delivered Neo GLB');
    assert.ok(band?.visible, 'Neo needs his injury band before the player starts the farewell');
    let hair = 0, upper: THREE.MeshStandardMaterial | undefined;
    body.traverseVisible(object => {
      if (!(object instanceof THREE.Mesh)) return;
      if (/hair|groom/i.test((object.material as THREE.Material).name)) hair++;
      if (object.name === 'neo-logos-sweater') upper = object.material as THREE.MeshStandardMaterial;
    });
    assert.ok(hair > 0, 'the ready player must retain his hair');
    assert.ok(upper && upper.roughness >= .94 && upper.bumpMap?.name === 'neo-farewell-knit', 'the ready player needs his matte knit outfit');
    return { hair, color: upper.color.toArray(), roughness: upper.roughness, weave: upper.bumpMap.name };
  };
  warm.update(.1); cold.update(0, undefined, 0);
  assert.deepEqual(appearance(cold), appearance(warm), 'a cold paused ready frame restores the same outfit');
  const knee = warm.getAgentBody('neo')!.getObjectByName('knee_L')!, before = knee.quaternion.clone();
  warm.update(.1);
  assert.ok(knee.quaternion.angleTo(before) > .01, 'ready Neo must keep animating his normal walking gait');
  assert.equal(warm.getAgentState('neo')!.currentAction, undefined, 'an outfit cannot manufacture a farewell performance');
  const paused = knee.quaternion.clone(), outfit = appearance(warm);
  warm.update(.2, undefined, 0);
  assert.deepEqual(knee.quaternion.toArray(), paused.toArray()); assert.deepEqual(appearance(warm), outfit);
  const actor = warm.getAgentState('neo')!, band = warm.getAgentBody('neo')!.getObjectByName('neo-farewell-eye-band')!;
  actor.currentLocation = 'film_machine_core'; warm.updateAgent('neo', actor); warm.update(0, undefined, 0);
  assert.deepEqual(appearance(warm), outfit, 'Neo must retain his injury band, hair and clothing when continuing to the machine core');
  actor.isInMatrix = true; warm.updateAgent('neo', actor); warm.update(0, undefined, 0);
  assert.equal(band.visible, false, 'returning to the Matrix clears the real-world injury band');
  actor.isInMatrix = false;
  actor.currentLocation = 'film_neb_deck'; warm.updateAgent('neo', actor); warm.update(0, undefined, 0);
  assert.equal(band.visible, false, 'earlier real-world scenes must retain their original appearance');
  actor.currentLocation = 'film_logos_wreck'; actor.isInMatrix = true; warm.updateAgent('neo', actor); warm.update(0, undefined, 0);
  assert.equal(band.visible, false, 'Matrix actors must not inherit the real-world injury band');
});

test('entering the farewell clears prior combat poses before the first paused frame', async t => {
  const h = await setup(t), warm = h.create(), cold = h.create();
  for (const renderer of [warm, cold]) renderer.setPlayer('neo');
  const base = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 };
  const actions: [string, Partial<MotionInput>][] = [
    ['punch', { attack: 1 }], ['kick', { attack: 2, combo: 2 }], ['hit', { hit: 1 }],
    ['dodge', { cast: 1, skill: 'dodge' }], ['guard', { cast: 2, skill: 'iron_guard' }],
    ['cast', { cast: 3, skill: 'force_push' }],
  ];
  for (const [label, action] of actions) {
    h.save(warm, { phase: 'ready', elapsed: 0, total: 0 });
    const actor = warm.getAgentState('neo')!; actor.currentAction = undefined; warm.updateAgent('neo', actor);
    await new Promise(resolve => setImmediate(resolve));
    warm.setPlayerMotion({ ...base, ...action }); warm.update(.1);
    warm.setPlayerMotion({ ...base }); warm.update(.1);
    const beat: FarewellEncounter = { phase: 'reaching', elapsed: .1, total: .1 };
    for (const renderer of [warm, cold]) {
      h.save(renderer, beat);
      // PlayerControls owns the player's root; restore that saved transform too.
      const actor = renderer.getAgentState('neo')!;
      renderer.getAgent('neo')!.position.set(actor.position.x, actor.position.y, actor.position.z);
      renderer.getAgentBody('neo')!.rotation.y = actor.rotation;
      renderer.setPlayerMotion({ ...base, crouching: true, farewell: { ...beat, role: 'neo' } });
    }
    await new Promise(resolve => setImmediate(resolve));
    warm.update(0, undefined, 0); cold.update(0, undefined, 0);
    const saved = snapshot(cold);
    assert.deepEqual(snapshot(warm), saved, `${label}: the saved farewell must not retain the ready combat pose`);
    warm.update(.2, undefined, 0);
    assert.deepEqual(snapshot(warm), saved, `${label}: a paused farewell must not settle out of the old combat pose`);
  }
});

test('Trinity touches Neo with her actual palm while the complete hand stays outside his facial skin', async t => {
  const h = await setup(t), renderer = h.create();
  const wreck = new THREE.Group(), scene = new LogosWreckRenderer(wreck), center = FILM_SETS.film_logos_wreck.center;
  wreck.position.set(center.x, center.y - 1, center.z); wreck.updateMatrixWorld(true);
  const bars: THREE.Line3[] = [];
  wreck.getObjectByName('logos-wreck-rebar')!.traverse(item => {
    if (!(item instanceof THREE.Mesh)) return;
    const height = (item.geometry as THREE.CylinderGeometry).parameters.height;
    bars.push(new THREE.Line3(item.localToWorld(new THREE.Vector3(0, -height / 2, 0)), item.localToWorld(new THREE.Vector3(0, height / 2, 0))));
  });
  assert.equal(bars.length, 3, 'check all three visible shafts');
  t.after(() => scene.dispose());
  for (const beat of [{ phase: 'goodbye', elapsed: 1.5, total: 11.9 }, { phase: 'goodbye', elapsed: 2.6, total: 13 },
    { phase: 'kiss', elapsed: 1.5, total: 17.1 }, { phase: 'kiss', elapsed: 2.15, total: 17.75 },
    { phase: 'kiss', elapsed: 2.4, total: 18 }, { phase: 'kiss', elapsed: 2.6, total: 18.2 }] as FarewellEncounter[]) {
    h.save(renderer, beat); await new Promise(resolve => setImmediate(resolve)); renderer.update(0, undefined, 0);
    const skin = (id: string) => {
      const root = renderer.getAgent(id)!; root.updateMatrixWorld(true);
      let mesh!: THREE.SkinnedMesh;
      root.traverseVisible(object => { if (object instanceof THREE.SkinnedMesh && (object.material as THREE.Material).name === 'Skin') { object.skeleton.update(); mesh = object; } });
      assert.ok(mesh, `${id}: measure the actual visible skin`); return mesh;
    };
    const neo = skin('neo'), hand = skin('trinity'), head = renderer.getAgent('neo')!.getObjectByName('head')!;
    const selected = new Map<number, THREE.Vector3>(), joints = neo.geometry.attributes.skinIndex, weights = neo.geometry.attributes.skinWeight;
    for (let i = 0; i < joints.count; i++) {
      let weight = 0;
      for (let k = 0; k < 4; k++) if (/^(head|neck)$/.test(neo.skeleton.bones[joints.getComponent(i, k)].name)) weight += weights.getComponent(i, k);
      if (weight > .7) selected.set(i, neo.localToWorld(neo.getVertexPosition(i, new THREE.Vector3())));
    }
    const buckets = new Map<string, number[]>(), index = neo.geometry.index!;
    for (let i = 0; i < index.count; i += 3) {
      const points = [0, 1, 2].map(k => selected.get(index.getX(i + k)));
      if (points.some(point => !point)) continue;
      const key = points[0]!.clone().add(points[1]!).add(points[2]!).divideScalar(3).toArray().map(n => Math.floor(n / .15)).join(':');
      if (!buckets.has(key)) buckets.set(key, []);
      for (const point of points) buckets.get(key)!.push(...point!.toArray());
    }
    const face = new THREE.Group(), material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    for (const values of buckets.values()) {
      const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(values, 3));
      face.add(new THREE.Mesh(geometry, material));
    }
    face.updateMatrixWorld(true);
    try {
      const center = head.getWorldPosition(new THREE.Vector3()), wrist = renderer.getAgent('trinity')!.getObjectByName('wrist_L')!;
      const bounds = new THREE.Box3().setFromPoints([...selected.values()]);
      const ids = hand.geometry.attributes.skinIndex, influence = hand.geometry.attributes.skinWeight;
      let penetration = 0, palmGap = Infinity, samples = 0, worst = '';
      for (let i = 0; i < ids.count; i++) {
        let weight = 0, palmWeight = 0;
        for (let k = 0; k < 4; k++) {
          const name = hand.skeleton.bones[ids.getComponent(i, k)].name;
          if (/^(wrist|finger).*_L$/.test(name)) weight += influence.getComponent(i, k);
          if (name === 'wrist_L') palmWeight += influence.getComponent(i, k);
        }
        if (weight < .5) continue;
        samples++;
        const point = hand.localToWorld(hand.getVertexPosition(i, new THREE.Vector3())), outward = point.clone().sub(center).normalize();
        if (bounds.containsPoint(point)) {
          const exit = new THREE.Raycaster(point, outward, .0001, .4).intersectObject(face, true)[0];
          if (exit && exit.face!.normal.dot(outward) > .001 && exit.distance > penetration) {
            penetration = exit.distance; worst = `vertex ${i}, wrist-local ${wrist.worldToLocal(point.clone()).toArray()}`;
          }
        }
        const local = wrist.worldToLocal(point.clone());
        if (palmWeight > .99 && local.y < -.1 && local.y > -.19 && Math.abs(local.z) < .045 && local.x < 0) {
          const hit = new THREE.Raycaster(point, outward.negate(), 0, .15).intersectObject(face, true)[0];
          if (hit && hit.face!.normal.dot(outward) < 0) palmGap = Math.min(palmGap, hit.distance);
        }
      }
      assert.ok(samples > 500, 'sample the complete delivered hand, including all five fingers');
      assert.ok(penetration < .012, `${beat.phase}/${beat.elapsed}: hand penetrates Neo by ${penetration}; ${worst}; palm gap ${palmGap}`);
      if (farewellPose(beat).trinity.reach > .99) {
        assert.ok(palmGap < .035, `${beat.phase}/${beat.elapsed}: actual palm floats ${palmGap} from the face`);
        const finger = renderer.getAgent('trinity')!.getObjectByName('finger3-3_L')!.getWorldPosition(new THREE.Vector3()).sub(wrist.getWorldPosition(new THREE.Vector3())).normalize();
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(head.getWorldQuaternion(new THREE.Quaternion()));
        assert.ok(finger.dot(up) > .92, 'the fingers must follow the turned cheek, instead of pointing vertically past the head');
      }
      t.diagnostic(`${beat.phase}/${beat.elapsed}: ${samples} hand vertices; max penetration ${penetration.toFixed(6)}, palm gap ${palmGap.toFixed(6)}`);
      for (const [role, mesh] of [['neo', neo], ['trinity', hand]] as const) {
        const exposed = new Set<number>(), indices = mesh.geometry.attributes.skinIndex, weights = mesh.geometry.attributes.skinWeight;
        const positions: number[] = [], triangles: number[] = [], index = mesh.geometry.index!;
        for (let i = 0; i < indices.count; i++) {
          positions.push(...mesh.localToWorld(mesh.getVertexPosition(i, new THREE.Vector3())).toArray());
          if (role === 'neo') exposed.add(i);
          else for (let k = 0; k < 4; k++) if (weights.getComponent(i, k) > .25
            && /^(head|neck|wrist_[LR]|finger\d-\d_[LR])$/.test(mesh.skeleton.bones[indices.getComponent(i, k)].name)) exposed.add(i);
        }
        for (let i = 0; i < index.count; i += 3) if ([0, 1, 2].some(k => exposed.has(index.getX(i + k))))
          triangles.push(index.getX(i), index.getX(i + 1), index.getX(i + 2));
        const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(triangles);
        const surface = new THREE.Mesh(geometry, material); surface.updateMatrixWorld(true);
        try {
          for (const [bar, segment] of bars.entries()) {
            const direction = segment.delta(new THREE.Vector3()).normalize(), side = direction.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
            const up = direction.clone().cross(side).normalize();
            for (const offset of [new THREE.Vector3(), side, side.clone().negate(), up, up.clone().negate()]) {
              const hits = new THREE.Raycaster(segment.start.clone().addScaledVector(offset, .085), direction, 0, segment.distance()).intersectObject(surface, false);
              assert.equal(hits.length, 0, `${beat.phase}/${beat.elapsed}: actual renderer ${role} skin crosses shaft ${bar} at ${hits.map(hit => hit.point.toArray())}`);
            }
          }
        } finally { geometry.dispose(); }
      }
    } finally { face.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.dispose(); }); material.dispose(); }
  }
});
