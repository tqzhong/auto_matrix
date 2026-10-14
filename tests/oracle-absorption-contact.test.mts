import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { FILM_SETS, ORACLE_LAST, newOracleAbsorption, oracleAbsorptionRoot, oracleAbsorptionPlate, type OracleAbsorptionGesture } from '@auto_matrix/shared';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { contactOracleAbsorption } from '../packages/client/src/agents/OracleAbsorptionPerformance.js';
import { OracleSmithAppearance } from '../packages/client/src/agents/OracleSmithAppearance.js';
import { OracleAbsorptionRenderer } from '../packages/client/src/engine/OracleAbsorptionRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

async function geometry() {
  const glb = await readFile(new URL('../packages/client/public/assets/characters/smith.glb', import.meta.url));
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
  const smith = await geometry();
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async (url: string) => url.endsWith('/smith.glb') ? { ...smith, scene: clone(smith.scene) } : new Promise(() => {}));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {},
    createRadialGradient: () => ({ addColorStop() {} }) }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const models = new CharacterModels(), rigs = { oracle: models.create(world.agents.get('oracle')!), smith: models.create(world.agents.get('smith')!) };
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(rigs.smith.hero, 'pose the shipped skinned Smith body');
  const center = FILM_SETS.film_oracle_home.center, origin = new THREE.Vector3(center.x, center.y - 1, center.z);
  const frame = (state: ReturnType<typeof newOracleAbsorption>, delta = 0) => {
    for (const role of ['oracle', 'smith'] as const) {
      const rig = rigs[role], position = oracleAbsorptionRoot(state, role);
      rig.root.position.set(position.x, 0, position.z).add(origin); rig.root.rotation.y = position.yaw;
      models.animate(rig, delta, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, oracleAbsorption: { ...state, role } }, 0);
      if (rig.hero) rig.hero.root.visible = true;
      rig.root.updateWorldMatrix(true, true);
    }
    contactOracleAbsorption(rigs.oracle, rigs.smith, { ...state, role: 'oracle' });
    for (const rig of Object.values(rigs)) { rig.root.updateMatrixWorld(true); rig.root.traverse(object => { if (object instanceof THREE.SkinnedMesh) object.skeleton.update(); }); }
  };
  t.after(() => { models.dispose(); globalThis.document = previous; });
  return { rigs, models, frame, origin, smith: world.agents.get('smith')! };
}

function blouseContact(smith: Awaited<ReturnType<typeof setup>>['rigs']['smith'], blouse: THREE.Mesh) {
  let samples = 0, skinGap = Infinity, penetration = 0;
  smith.hero!.root.traverseVisible(object => {
    if (!(object instanceof THREE.SkinnedMesh) || (object.material as THREE.Material).name !== 'Skin') return;
    const { skinIndex, skinWeight, position } = object.geometry.attributes;
    for (let i = 0; i < position.count; i++) {
      let hand = 0;
      for (let k = 0; k < 4; k++) if (/^(wrist_R|finger[1-5]-[1-3]_R)$/.test(object.skeleton.bones[skinIndex.getComponent(i, k)].name)) hand += skinWeight.getComponent(i, k);
      if (hand < .65) continue;
      const point = object.localToWorld(object.getVertexPosition(i, new THREE.Vector3()));
      const hit = new THREE.Raycaster(point.clone().add(new THREE.Vector3(0, 0, 1)), new THREE.Vector3(0, 0, -1)).intersectObject(blouse, true)[0];
      if (!hit) continue; samples++; skinGap = Math.min(skinGap, point.distanceTo(hit.point)); penetration = Math.max(penetration, hit.point.z - point.z);
    }
  });
  return { samples, skinGap, penetration };
}

test('Smith reaches and withdraws without snapping his wrist at saved phase boundaries', async t => {
  const h = await setup(t), base = { ...newOracleAbsorption(3, 47), invasion: 44 };
  const pairs = [
    [{ ...base, phase: 'consent', elapsed: 0 }, { ...base, phase: 'contact', elapsed: 0 }],
    [{ ...base, phase: 'contact', elapsed: 2.2 }, { ...base, phase: 'coating', elapsed: 0, coating: 0 }],
    [{ ...base, phase: 'coating', elapsed: 5, coating: 1 }, { ...base, phase: 'laughing', elapsed: 0, coating: 1 }],
    [{ ...base, phase: 'laughing', elapsed: 3, coating: 1 }, { ...base, phase: 'done', elapsed: 0, coating: 1 }],
  ] as [ReturnType<typeof newOracleAbsorption>, ReturnType<typeof newOracleAbsorption>][];
  const joints = ['shoulder_R', 'elbow_R', 'wrist_R', ...Array.from({ length: 15 }, (_, i) => `finger${Math.floor(i / 3) + 1}-${i % 3 + 1}_R`)];
  const read = () => joints.map(name => {
    const bone = h.rigs.smith.hero!.bones.get(name)!;
    return { position: bone.getWorldPosition(new THREE.Vector3()), rotation: bone.getWorldQuaternion(new THREE.Quaternion()) };
  });
  for (const [a, b] of pairs) {
    h.frame(a); const before = read(); h.frame(b); const after = read();
    for (let i = 0; i < joints.length; i++) {
      assert.ok(before[i].position.distanceTo(after[i].position) < 1e-5, `${a.phase} → ${b.phase}: ${joints[i]} moves abruptly`);
      assert.ok(before[i].rotation.angleTo(after[i].rotation) < 1e-5, `${a.phase} → ${b.phase}: ${joints[i]} turns abruptly`);
    }
  }
});

test('the delivered Smith palm reaches the cookie plate before it leaves the table', async t => {
  const h = await setup(t), state = newOracleAbsorption(3, 47); state.phase = 'confrontation'; state.invasion = 21.2;
  h.frame(state);
  const palm = h.rigs.smith.hero!.bones.get('wrist_R')!.localToWorld(new THREE.Vector3(0, -.28, -.125));
  const plate = oracleAbsorptionPlate(state), gap = palm.distanceTo(new THREE.Vector3(plate.x, 2.18, plate.z).add(h.origin));
  t.diagnostic(JSON.stringify({ plateGap: gap, palm: palm.clone().sub(h.origin).toArray(), shoulder: h.rigs.smith.hero!.bones.get('shoulder_R')!.getWorldPosition(new THREE.Vector3()).sub(h.origin).toArray(), forearm: h.rigs.smith.hero!.bones.get('wrist_R')!.position.toArray() })); assert.ok(gap < .1, 'the plate cannot fly before the visible hand reaches it');
  const root = new THREE.Group(); root.position.copy(h.origin); const props = new OracleAbsorptionRenderer(root); t.after(() => props.dispose()); props.update(state); root.updateMatrixWorld(true);
  let samples = 0, skinGap = Infinity, penetration = 0;
  h.rigs.smith.hero!.root.traverseVisible(object => {
    if (!(object instanceof THREE.SkinnedMesh) || (object.material as THREE.Material).name !== 'Skin') return;
    const { skinIndex, skinWeight, position } = object.geometry.attributes;
    for (let i = 0; i < position.count; i++) {
      let hand = 0;
      for (let k = 0; k < 4; k++) if (/^(wrist_R|finger[1-5]-[1-3]_R)$/.test(object.skeleton.bones[skinIndex.getComponent(i, k)].name)) hand += skinWeight.getComponent(i, k);
      if (hand < .65) continue;
      const point = object.localToWorld(object.getVertexPosition(i, new THREE.Vector3()));
      const hit = new THREE.Raycaster(point.clone().add(new THREE.Vector3(0, 1, 0)), new THREE.Vector3(0, -1, 0)).intersectObject(props.plate.children[0], true)[0];
      if (!hit) continue; samples++; skinGap = Math.min(skinGap, point.distanceTo(hit.point)); penetration = Math.max(penetration, hit.point.y - point.y);
    }
  });
  t.diagnostic(JSON.stringify({ samples, skinGap, penetration })); assert.ok(samples > 30 && skinGap < .035 && penetration < .01, 'the actual hand skin must contact the ceramic without passing through it');
});

test('contact reaches the seated Oracle blouse and the saved hand pose stays fixed', async t => {
  const h = await setup(t), state = newOracleAbsorption(3, 47); state.phase = 'contact'; state.invasion = 44; state.elapsed = 2;
  h.frame(state);
  const blouse = h.rigs.oracle.root.getObjectByName('oracle-daily-blouse') as THREE.Mesh;
  const wrist = h.rigs.smith.hero!.bones.get('wrist_R')!;
  const { samples, skinGap, penetration } = blouseContact(h.rigs.smith, blouse);
  t.diagnostic(JSON.stringify({ samples, skinGap, penetration })); assert.ok(samples > 30 && skinGap < .015 && penetration < .005, 'the actual palm/finger skin must touch without extending into the blouse');
  const before = wrist.matrixWorld.elements.slice(); h.frame(state, .05); assert.deepEqual(wrist.matrixWorld.elements, before);
});

test('the actual seated Oracle and bending Smith stay outside the solid kitchen table', async t => {
  const h = await setup(t), table = ORACLE_LAST.table;
  for (const invasion of [20.7, 21.2, 21.4, 25.4, 44]) {
    const state = { ...newOracleAbsorption(3, 47), phase: 'confrontation' as const, invasion }; h.frame(state);
    for (const [role, rig] of Object.entries(h.rigs)) {
      let penetration = 0; const parts = new Set<string>();
      rig.root.traverseVisible(object => {
        if (!(object instanceof THREE.Mesh)) return;
        for (let i = 0; i < object.geometry.attributes.position.count; i++) {
          const point = object.localToWorld(object.getVertexPosition(i, new THREE.Vector3())).sub(h.origin);
          const depth = Math.min(table.width / 2 - Math.abs(point.x - table.x), table.depth / 2 - Math.abs(point.z - table.z), table.height - point.y, point.y);
          if (depth > .025) { penetration = Math.max(penetration, depth); parts.add(object.name || (object.material as THREE.Material).name); }
        }
      });
      assert.equal(penetration, 0, `${role} at ${invasion}s enters the kitchen table by ${penetration}m: ${[...parts]}`);
    }
  }
});

test('the assimilated Smith keeps his actual shoes planted during the saved seated-to-standing laugh', async t => {
  const h = await setup(t), state = newOracleAbsorption(4, 47); state.phase = 'laughing';
  h.frame(state); const scene = new THREE.Scene(), appearance = new OracleSmithAppearance(h.rigs.oracle, h.rigs.smith.hero!, scene);
  t.after(() => appearance.dispose());
  for (const elapsed of [0, .3, 1, 2, 3]) {
    state.elapsed = elapsed; h.frame(state); appearance.update({ ...state, role: 'oracle' }, false);
    let lowest = Infinity;
    appearance.replica.traverse(object => {
      if (!(object instanceof THREE.SkinnedMesh) || !/Shoe|Boot/i.test((object.material as THREE.Material).name)) return;
      for (let i = 0; i < object.geometry.attributes.position.count; i++) lowest = Math.min(lowest, object.localToWorld(object.getVertexPosition(i, new THREE.Vector3())).y - h.origin.y);
    });
    t.diagnostic(JSON.stringify({ elapsed, shoeClearance: lowest })); assert.ok(lowest >= -.02 && lowest < .09, 'replacement shoes cannot float or enter the floor');
    const before = appearance.replica.getObjectByName('head')!.matrixWorld.elements.slice();
    appearance.update({ ...state, role: 'oracle' }, false); assert.deepEqual(appearance.replica.getObjectByName('head')!.matrixWorld.elements, before);
  }
  appearance.update({ ...state, role: 'oracle' }, true); assert.equal(appearance.replica.visible, false, 'replacement body must not block its own first-person view');
});

test('the actual Smith hand clears the blouse throughout approach and withdrawal and recovers a saved contact', async t => {
  const h = await setup(t), base = { ...newOracleAbsorption(3, 47), invasion: 44 };
  const states = [
    ...[0, .2, .4, .6, .8, 1.2, 1.6, 2.2].map(elapsed => ({ ...base, phase: 'contact' as const, elapsed })),
    ...[0, .2, .5, .7, .85, 1].map(coating => ({ ...base, phase: 'coating' as const, elapsed: coating * 5, coating })),
  ];
  const blouse = h.rigs.oracle.root.getObjectByName('oracle-daily-blouse') as THREE.Mesh;
  const joints = ['shoulder_R', 'elbow_R', 'wrist_R', ...Array.from({ length: 15 }, (_, i) => `finger${Math.floor(i / 3) + 1}-${i % 3 + 1}_R`)];
  const failures: string[] = [];
  for (const state of states) {
    const cold = h.models.create(h.smith); await new Promise(resolve => setImmediate(resolve));
    assert.ok(cold.hero);
    h.frame(state);
    const contact = blouseContact(h.rigs.smith, blouse);
    t.diagnostic(JSON.stringify({ phase: state.phase, elapsed: state.elapsed, ...contact }));
    if (contact.penetration > .005) failures.push(`${state.phase} ${state.elapsed}: skin penetrates ${contact.penetration}`);
    if ((state.phase === 'contact' && state.elapsed >= 1.6 || state.phase === 'coating' && state.coating <= .7) && contact.skinGap > .015)
      failures.push(`${state.phase} ${state.elapsed}: contact gap ${contact.skinGap}`);
    const expected = joints.map(name => h.rigs.smith.hero!.bones.get(name)!.matrixWorld.elements.slice());
    h.models.animate(h.rigs.smith, .2, { speed: 6, grounded: false, verticalVelocity: 2, turn: .5 }, 0);
    h.frame(state);
    cold.root.position.copy(h.rigs.smith.root.position); cold.root.quaternion.copy(h.rigs.smith.root.quaternion);
    h.models.animate(cold, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, oracleAbsorption: { ...state, role: 'smith' } }, 0);
    contactOracleAbsorption(h.rigs.oracle, cold, { ...state, role: 'oracle' }); cold.root.updateMatrixWorld(true);
    for (const rig of [h.rigs.smith, cold]) for (const [i, name] of joints.entries()) {
      const actual = rig.hero!.bones.get(name)!.matrixWorld.elements;
      assert.ok(actual.every((value, j) => Math.abs(value - expected[i][j]) < 1e-5), `${state.phase} ${state.elapsed}: ${name} retains a previous pose`);
    }
  }
  assert.deepEqual(failures, []);
});

test('Smith keeps his wrist aligned with the forearm through the saved reach and withdrawal', async t => {
  const h = await setup(t), base = { ...newOracleAbsorption(3, 47), invasion: 44 };
  const states = [
    ...Array.from({ length: 56 }, (_, i) => ({ ...base, phase: 'contact' as const, elapsed: i * .04 })),
    ...Array.from({ length: 126 }, (_, i) => ({ ...base, phase: 'coating' as const, elapsed: i * .04, coating: i / 125 })),
  ];
  let bend = 0, jump = 0, previous: THREE.Vector3 | undefined;
  for (const state of states) {
    h.frame(state);
    const wrist = h.rigs.smith.hero!.bones.get('wrist_R')!, position = wrist.getWorldPosition(new THREE.Vector3());
    bend = Math.max(bend, Math.acos(THREE.MathUtils.clamp(new THREE.Vector3(0, -1, 0).applyQuaternion(wrist.quaternion).dot(wrist.position.clone().normalize()), -1, 1)));
    if (previous) jump = Math.max(jump, previous.distanceTo(position));
    previous = position;
  }
  t.diagnostic(JSON.stringify({ maximumWristBend: bend, maximumTravelPer40ms: jump }));
  assert.ok(bend < 1.15, 'the hand folds sharply across the end of the forearm');
  assert.ok(jump < .09, 'the hand snaps between adjacent saved times');
});
