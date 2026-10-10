import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test, { type TestContext } from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DOCK_BRIEFING, FILM_SETS, dockBriefingGate, dockBriefingLift, dockBriefingRoot, type DockBriefing, type DockBriefingRole } from '@auto_matrix/shared';
import { CharacterModels, type CharacterRig } from '../packages/client/src/agents/CharacterModel.js';
import { DockBriefingRenderer } from '../packages/client/src/engine/DockBriefingRenderer.js';
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

async function fixture(t: TestContext, delayed = false) {
  const names = ['morpheus', 'trinity', ...['niobe', 'lock', 'roland'].flatMap(role => [`${role}-head`, `${role}-body`])];
  const assets = Object.fromEntries(await Promise.all(names.map(async name => [name, await shipped(name)])));
  const pending: (() => void)[] = [];
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async url => {
    const name = String(url).split('/').pop()!.replace('.glb', '');
    if (delayed && name.endsWith('-body')) await new Promise<void>(resolve => pending.push(resolve));
    return assets[name];
  });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  const rigs = Object.fromEntries(DOCK_BRIEFING.cast.map(role => [role, models.create(world.agents.get(role)!)])) as Record<DockBriefingRole, CharacterRig>;
  const center = FILM_SETS.film_zion_personnel.center, root = new THREE.Group(); root.position.set(center.x, center.y - 1, center.z);
  const renderer = new DockBriefingRenderer(root);
  const pose = (state: DockBriefing) => {
    renderer.update(state);
    for (const role of DOCK_BRIEFING.cast) {
      const rig = rigs[role], at = dockBriefingRoot(state, role);
      rig.root.position.set(center.x + at.x, center.y - 1 + at.y, center.z + at.z); rig.root.rotation.y = at.yaw;
      models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, dockBriefing: { ...state, role } }, 0);
    }
    root.updateMatrixWorld(true);
  };
  pose({ phase: 'ready', elapsed: 0, escort: 0 }); await new Promise(resolve => setImmediate(resolve));
  pose({ phase: 'ready', elapsed: 0, escort: 0 });
  assert.ok(!rigs.niobe.hero && rigs.morpheus.hero, 'Niobe uses her own reality body; the existing Morpheus asset is retained');
  if (!delayed) for (const role of ['niobe', 'lock', 'roland']) assert.ok(rigs[role as DockBriefingRole].root.getObjectByName(`${role}-anatomical-body`), `inspect ${role}'s delivered body`);
  t.after(() => { renderer.dispose(); models.dispose(); globalThis.document = previous; });
  return { rigs, root, renderer, center, pose, models, release: async () => { pending.forEach(resolve => resolve()); await new Promise(resolve => setImmediate(resolve)); } };
}

test('the real boots share a visible cage deck through descent and a personnel floor during the saved conversation', async t => {
  const h = await fixture(t);
  for (const state of [{ phase: 'ready', elapsed: 0, escort: 0 }, ...[.6, 1.5, 3.9].map(elapsed => ({ phase: 'lowering', elapsed, escort: 0 })),
    { phase: 'gate', elapsed: 1, escort: 0 }, { phase: 'warning', elapsed: 3.5, escort: 5.6, approach: { x: 0, z: 1.2, yaw: Math.PI } }] as DockBriefing[]) {
    h.pose(state);
    const lifted = ['ready', 'lowering', 'gate'].includes(state.phase), deck = h.root.getObjectByName(lifted ? 'personnel-lift-deck' : 'personnel-floor')!;
    for (const role of lifted ? ['niobe', 'morpheus', 'roland'] as const : DOCK_BRIEFING.cast) {
      const rig = h.rigs[role]; let low = Infinity;
      rig.detail.traverseVisible(object => {
        if (!(object instanceof THREE.Mesh)) return;
        if (object instanceof THREE.SkinnedMesh) {
          if ((object.material as THREE.Material).name !== 'Boot leather' && !object.name.endsWith('-work-boots')) return;
          object.skeleton.update();
          for (let i = 0; i < object.geometry.attributes.position.count; i++) low = Math.min(low, object.localToWorld(object.getVertexPosition(i, new THREE.Vector3())).y);
        } else if (!rig.hero && rig.ankles.some(ankle => { for (let parent: THREE.Object3D | null = object; parent; parent = parent.parent) if (parent === ankle) return true; return false; })) {
          const positions = object.geometry.attributes.position;
          for (let i = 0; i < positions.count; i++) low = Math.min(low, object.localToWorld(new THREE.Vector3().fromBufferAttribute(positions, i)).y);
        }
      });
      const at = dockBriefingRoot(state, role);
      const point = new THREE.Vector3(h.center.x + at.x, low + .1, h.center.z + at.z);
      const hit = new THREE.Raycaster(point, new THREE.Vector3(0, -1, 0), 0, .2).intersectObject(deck)[0];
      assert.ok(hit && low - hit.point.y >= -.025 && low - hit.point.y < .07, `${role}/${state.phase}/${state.elapsed}: boot ${low}, visible support ${hit?.point.y}`);
      if (lifted) assert.ok(Math.abs(hit!.point.y - h.center.y + 1 - dockBriefingLift(state)) < .00001, 'the collision root stays one unit above the actual floor, as elsewhere in this engine');
    }
  }
});

test('the delivered cage bodies clear the gate, shaft walls and ceiling, and retain the same paused pose', async t => {
  const h = await fixture(t);
  for (const elapsed of [0, .8, 2.4, 4.1]) {
    const state: DockBriefing = { phase: 'lowering', elapsed, escort: 0 }; h.pose(state);
    for (const role of ['niobe', 'morpheus', 'roland'] as const) h.rigs[role].detail.traverseVisible(object => {
      if (!(object instanceof THREE.Mesh)) return;
      if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
      const positions = object.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const point = object.localToWorld(object.getVertexPosition(i, new THREE.Vector3())).sub(h.center);
        assert.ok(Math.abs(point.x) < DOCK_BRIEFING.lift.width / 2 - .08 && point.z > DOCK_BRIEFING.lift.gateZ + .15 && point.z < 16.05
          && point.y < dockBriefingLift(state) - 1 + DOCK_BRIEFING.lift.height - .15, `${role}/${elapsed}: body clips the delivered cage at ${point.toArray()}`);
      }
    });
  }
  const state: DockBriefing = { phase: 'warning', elapsed: 2.5, escort: 5.6, approach: { x: .6, z: .8, yaw: Math.PI } }; h.pose(state);
  const snapshots = DOCK_BRIEFING.cast.map(role => {
    const pose: THREE.Matrix4[] = []; h.rigs[role].root.traverse(object => { if (object instanceof THREE.Bone) pose.push(object.matrixWorld.clone()); }); return pose;
  });
  h.pose(structuredClone(state));
  DOCK_BRIEFING.cast.forEach((role, r) => { let i = 0; h.rigs[role].root.traverse(object => {
    if (object instanceof THREE.Bone) assert.ok(object.matrixWorld.equals(snapshots[r][i++]), `${role}: a paused saved line must keep its physical pose`);
  }); });
});

test('cold loading restores the same lift and raised gate and disposing releases owned set resources', () => {
  const root = new THREE.Group(), renderer = new DockBriefingRenderer(root);
  const state: DockBriefing = { phase: 'gate', elapsed: .91, escort: 0 }; renderer.update(state); root.updateMatrixWorld(true);
  const lift = renderer.lift.matrixWorld.clone(), gate = renderer.gate.matrixWorld.clone();
  assert.equal(renderer.gate.position.y, dockBriefingGate(state) * (DOCK_BRIEFING.lift.height + .2));
  const cold = new DockBriefingRenderer(new THREE.Group()); cold.update(structuredClone(state)); cold.group.updateMatrixWorld(true);
  assert.ok(cold.lift.matrixWorld.equals(lift)); assert.ok(cold.gate.matrixWorld.equals(gate)); cold.dispose();
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(); let releasedGeometry = 0, releasedMaterial = 0;
  renderer.group.traverse(object => { if (object instanceof THREE.Mesh) { geometries.add(object.geometry); materials.add(object.material as THREE.Material); } });
  geometries.forEach(g => g.addEventListener('dispose', () => releasedGeometry++)); materials.forEach(m => m.addEventListener('dispose', () => releasedMaterial++));
  renderer.dispose(); assert.equal(releasedGeometry, geometries.size); assert.equal(releasedMaterial, materials.size); assert.equal(root.children.length, 0);
});

test('Morpheus keeps his real-world knit after disembarking, including a cold-loaded conversation, and restores his Matrix coat', async t => {
  const h = await fixture(t), rig = h.rigs.morpheus;
  const sweater = rig.root.getObjectByName('morpheus-hammer-sweater') as THREE.SkinnedMesh;
  const collar = rig.root.getObjectByName('morpheus-hammer-collar') as THREE.SkinnedMesh;
  const old = rig.hero!.wardrobe.filter(part => /Tailored.coat.upper|Black.crew.neck/i.test(part.mesh.name));
  for (const phase of ['ready', 'council', 'warning'] as const) {
    h.pose({ phase, elapsed: 2, escort: 5.6 });
    assert.equal(sweater.visible, true, `${phase}: Morpheus must retain the real-world sweater`);
    assert.equal(collar.visible, true); assert.ok(old.every(part => !part.mesh.visible));
    assert.ok((sweater.material as THREE.MeshStandardMaterial).bumpMap instanceof THREE.DataTexture);
  }
  h.models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: false }, 0);
  assert.equal(sweater.visible, false); assert.equal(collar.visible, false);
  assert.ok(old.every(part => part.mesh.visible), 'scene-specific clothing must not replace his Matrix wardrobe');
});

test('listening captains rest their hands near their thighs and the speaking gesture returns to rest', async t => {
  const h = await fixture(t);
  for (const elapsed of [0, 2.4, 4.8]) {
    h.pose({ phase: 'greeting', elapsed, escort: 5.6, approach: { x: 0, z: 1.2, yaw: Math.PI } });
    for (const role of ['lock', 'roland'] as const) for (const i of [0, 1]) {
      const rig = h.rigs[role], hand = rig.elbows[i].localToWorld(new THREE.Vector3(0, -.79, .055));
      rig.root.worldToLocal(hand);
      const speaking = role === 'lock' && elapsed === 2.4 && i === 0;
      assert.ok(Math.abs(hand.x) < .73 && hand.y < (speaking ? 2.7 : 1.96), `${role}/${elapsed}/${i}: relaxed palm is held away from the thigh at ${hand.toArray()}`);
      if (speaking) assert.ok(hand.z > .25, 'a deliberate single-hand gesture must face the listener');
    }
  }
});

test('Morpheus’s delivered fingers stay outside the real-world sweater while listening to the dock briefing', async t => {
  const h = await fixture(t), rig = h.rigs.morpheus;
  const sweater = rig.root.getObjectByName('morpheus-hammer-sweater') as THREE.SkinnedMesh;
  const skin = rig.hero!.wardrobe.find(part => (part.mesh.material as THREE.Material).name === 'Skin')!.mesh as THREE.SkinnedMesh;
  const joints = skin.geometry.attributes.skinIndex, weights = skin.geometry.attributes.skinWeight, fingers: number[] = [];
  for (let i = 0; i < skin.geometry.attributes.position.count; i++) {
    const hand = [0, 1, 2, 3].reduce((sum, n) => sum + (/^finger/.test(skin.skeleton.bones[joints.getComponent(i, n)].name) ? weights.getComponent(i, n) : 0), 0);
    if (hand > .85) fingers.push(i);
  }
  assert.ok(fingers.length > 100);
  const geometry = new THREE.BufferGeometry(), material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  geometry.setIndex(sweater.geometry.index!.clone());
  const cloth = new THREE.Mesh(geometry, material), ray = new THREE.Raycaster();
  try {
    for (const phase of ['ready', 'council', 'roland', 'warning'] as const) {
      h.pose({ phase, elapsed: 1.335, escort: phase === 'ready' ? 0 : 5.6 });
      sweater.skeleton.update(); skin.skeleton.update();
      const points = new Float32Array(sweater.geometry.attributes.position.count * 3);
      for (let i = 0; i < points.length / 3; i++) points.set(rig.root.worldToLocal(sweater.localToWorld(sweater.getVertexPosition(i, new THREE.Vector3()))).toArray(), i * 3);
      geometry.setAttribute('position', new THREE.BufferAttribute(points, 3)); geometry.computeBoundingSphere();
      for (let n = 0; n < fingers.length; n += Math.ceil(fingers.length / 36)) {
        const point = rig.root.worldToLocal(skin.localToWorld(skin.getVertexPosition(fingers[n], new THREE.Vector3())));
        ray.set(point.clone().add(new THREE.Vector3(0, 0, 2)), new THREE.Vector3(0, 0, -1));
        const distances = ray.intersectObject(cloth, false).map(hit => hit.distance);
        const crossings = distances.filter((distance, i) => distance < 2 - .008 && (i === 0 || distance - distances[i - 1] > 1e-5));
        assert.equal(crossings.length % 2, 0, `${phase}: a delivered finger penetrates the new clothing at ${point.toArray()}`);
      }
    }
  } finally { geometry.dispose(); material.dispose(); }
});

test('late captain body loading retains the saved lift pose and Niobe can change world without drawing two bodies', async t => {
  const h = await fixture(t, true), state: DockBriefing = { phase: 'lowering', elapsed: 1.424, escort: 0 };
  h.pose(state);
  const saved = ['niobe', 'lock', 'roland'].map(role => h.rigs[role as DockBriefingRole].root.matrixWorld.clone());
  await h.release(); h.pose(state);
  for (const [index, role] of ['niobe', 'lock', 'roland'].entries()) {
    const rig = h.rigs[role as DockBriefingRole];
    assert.ok(rig.root.matrixWorld.equals(saved[index]), `${role}: loading moves the saved lift passenger`);
    assert.equal(rig.root.getObjectByName(`${role}-fallback-head`)!.visible, false);
    assert.equal(rig.root.getObjectByName(`${role}-neck`)!.visible, false);
  }
  const rig = h.rigs.niobe, input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 };
  h.models.animate(rig, 0, { ...input, realWorld: false }, 0); rig.root.updateMatrixWorld(true);
  assert.ok(rig.hero); assert.equal(rig.hero.root.visible, true);
  assert.equal(rig.root.getObjectByName('niobe-detailed-body')!.visible, false);
  assert.equal(rig.torso.visible, false);
  h.models.animate(rig, 0, { ...input, realWorld: true, dockBriefing: { ...state, role: 'niobe' } }, 0); rig.root.updateMatrixWorld(true);
  assert.equal(rig.hero, undefined); assert.equal(rig.zionVariant!.hero!.root.visible, false);
  assert.equal(rig.root.getObjectByName('niobe-detailed-body')!.visible, true);
  assert.equal(rig.root.getObjectByName('niobe-fallback-head')!.visible, false);
  assert.equal(rig.torso.visible, true);
  assert.ok(rig.root.matrixWorld.equals(saved[0]), 'changing appearance cannot alter the player position or heading');
});

test('the fitted hair covers the frontal scalp instead of leaving the captains bald above the registered hairline', async t => {
  const h = await fixture(t);
  for (const role of ['niobe', 'lock', 'roland'] as const) {
    const rig = h.rigs[role], face = rig.head.getObjectByName(`${role}-anatomical-head`) as THREE.Mesh;
    const hair = rig.head.getObjectByName(`${role}-hair-scalp`) as THREE.Mesh;
    const origin = rig.head.localToWorld(new THREE.Vector3(0, role === 'roland' ? .225 : .17, 1));
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(rig.head.getWorldQuaternion(new THREE.Quaternion()));
    const hits = new THREE.Raycaster(origin, direction, 0, 2).intersectObjects([face, hair], false);
    assert.equal(hits[0]?.object.name, hair.name, `${role}: the exposed forehead continues past the reference hairline`);
  }
});
