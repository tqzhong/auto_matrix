import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, FREEWAY_HANDOFF, freewayHandoffRoot, newFreewayHandoff, newFreewayRide, type FreewayHandoff } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { poseFreewayTransferContact } from '../packages/client/src/agents/FreewayPickupContact.js';
import { FreewaySetRenderer } from '../packages/client/src/engine/FreewaySetRenderer.js';

test('the delivered Morpheus palms reach the passenger jacket and the truck supports his boots during the lift', async t => {
  const assets = new Map();
  for (const id of ['morpheus', 'trinity', 'trinity-club', 'keymaker-head', 'keymaker-body']) {
    const glb = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
    const length = glb.readUInt32LE(12), source = JSON.parse(glb.subarray(20, 20 + length).toString());
    for (const material of source.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
    source.images = []; source.textures = [];
    const json = Buffer.from(JSON.stringify(source)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
    const bin = glb.subarray(20 + length), buffer = Buffer.alloc(20 + padded.length + bin.length);
    buffer.writeUInt32LE(0x46546c67, 0); buffer.writeUInt32LE(2, 4); buffer.writeUInt32LE(buffer.length, 8);
    buffer.writeUInt32LE(padded.length, 12); buffer.writeUInt32LE(0x4e4f534a, 16); padded.copy(buffer, 20); bin.copy(buffer, 20 + padded.length);
    const asset = await new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '');
    if (id === 'keymaker-head') asset.scene.traverse(object => { if (object instanceof THREE.Mesh) (object.material as THREE.MeshStandardMaterial).map = new THREE.Texture(); });
    assets.set(id, asset);
  }
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async (url: string) => assets.get(url.split('/').pop()!.replace('.glb', '')));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {},
    fillRect() {}, strokeRect() {}, fillText() {}, createRadialGradient: () => ({ addColorStop() {} }), createLinearGradient: () => ({ addColorStop() {} }),
  }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  const roles = ['morpheus', 'keymaker', 'trinity'] as const;
  const rigs = Object.fromEntries(roles.map(id => [id, models.create(world.agents.get(id)!)])) as Record<typeof roles[number], ReturnType<CharacterModels['create']>>;
  await new Promise(resolve => setImmediate(resolve)); assert.ok(rigs.morpheus.hero && rigs.trinity.hero);
  const center = FILM_SETS.film_freeway_101.center, groups = Object.fromEntries(roles.map(id => [id, new THREE.Group()])) as Record<typeof roles[number], THREE.Group>;
  for (const role of roles) { groups[role].add(rigs[role].root); rigs[role].root.position.y = -1; }
  const scenery = new THREE.Group(); scenery.position.set(center.x, center.y - 1, center.z);
  const renderer = new FreewaySetRenderer(scenery, FILM_SETS.film_freeway_101);
  t.after(() => { models.dispose(); renderer.dispose(); globalThis.document = document; });
  const state = newFreewayHandoff({ ...newFreewayRide(), x: FREEWAY_HANDOFF.lane + FREEWAY_HANDOFF.side, z: -660, speed: 30 });
  state.truck.z = -654.6;
  const start = freewayHandoffRoot({ ...state, phase: 'reaching', elapsed: FREEWAY_HANDOFF.reach }, 'keymaker');
  const draw = (gesture: FreewayHandoff, delta = 0) => {
    for (const role of roles) {
      const root = freewayHandoffRoot(gesture, role); groups[role].position.set(center.x + root.x, center.y + root.y, center.z + root.z); rigs[role].root.rotation.y = root.yaw;
      const seated = role === 'trinity' || role === 'keymaker' && gesture.phase === 'approach';
      models.animate(rigs[role], delta, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0,
        freewayHandoff: { ...gesture, role }, ...(seated ? { freewayRide: { ...gesture.bike, role } } : {}) }, 0);
      groups[role].updateMatrixWorld(true);
    }
    poseFreewayTransferContact(rigs.morpheus, rigs.keymaker, gesture);
    renderer.update({ version: 1, scene: 'm2_freeway', actor: 'trinity', step: 2, completed: [], enteredAt: 1, checkpoint: { x: 0, y: 0, z: 0 }, reflections: {}, lastText: '', freewayHandoff: gesture }, 1000);
    scenery.updateMatrixWorld(true);
    for (const role of roles) rigs[role].root.traverse(object => { if (object instanceof THREE.SkinnedMesh) object.skeleton.update(); });
  };
  const cloth = () => rigs.morpheus.hero!.panels.flatMap(panel => Array.from({ length: panel.mesh.geometry.attributes.position.count }, (_, i) =>
    panel.mesh.localToWorld(panel.mesh.getVertexPosition(i, new THREE.Vector3()))));
  draw({ ...state, phase: 'lifting', elapsed: 1, passengerStart: start });
  await new Promise(resolve => setImmediate(resolve));
  draw({ ...state, phase: 'lifting', elapsed: 1, passengerStart: start });
  assert.ok(rigs.keymaker.root.getObjectByName('keymaker-detailed-body'), 'check the delivered passenger instead of his hidden fallback');
  const jacket = [rigs.keymaker.root.getObjectByName('keymaker-work-jacket')] as THREE.SkinnedMesh[];
  assert.ok(jacket.length, 'check the actual jacket surface');
  const surfaceDistance = (palm: THREE.Vector3) => Math.min(...jacket.map(mesh => {
    const local = mesh.worldToLocal(palm.clone()), index = mesh.geometry.index!, triangle = new THREE.Triangle(); let distance = Infinity;
    for (let i = 0; i < index.count; i += 3) {
      mesh.getVertexPosition(index.getX(i), triangle.a); mesh.getVertexPosition(index.getX(i + 1), triangle.b); mesh.getVertexPosition(index.getX(i + 2), triangle.c);
      distance = Math.min(distance, mesh.localToWorld(triangle.closestPointToPoint(local, new THREE.Vector3())).distanceTo(palm));
    }
    return distance;
  }));
  const failures: string[] = [];
  for (const elapsed of [0, .2, .6, 1, 1.5]) {
    const gesture = { ...state, phase: 'lifting' as const, elapsed, passengerStart: start };
    draw(gesture);
    for (const [i, side] of ['R', 'L'].entries()) {
      const wrist = rigs.morpheus.hero!.bones.get(`wrist_${side}`)!;
      const palm = wrist.localToWorld(new THREE.Vector3(side === 'R' ? .09 : -.09, -.18, .02));
      const target = rigs.keymaker.torso.localToWorld(new THREE.Vector3(.32, 1.45, i ? .2215 : -.2215));
      if (palm.distanceTo(target) >= .2) {
        const shoulder = rigs.morpheus.hero!.bones.get(`shoulder_${side}`)!;
        console.log({ elapsed, side, shoulder: shoulder.getWorldPosition(new THREE.Vector3()).toArray(), target: target.toArray(), palm: palm.toArray() });
        failures.push(`lift ${elapsed}s, ${side} palm misses delivered jacket by ${palm.distanceTo(target).toFixed(3)}m`);
      }
      if (surfaceDistance(palm) >= .18) failures.push(`lift ${elapsed}s, ${side} palm is off the actual jacket surface`);
      const ankle = rigs.morpheus.hero!.bones.get(`ankle_${side}`)!;
      const sole = ankle.getWorldPosition(new THREE.Vector3()).y - rigs.morpheus.hero!.footHeight;
      if (Math.abs(sole - 6.6) >= .15) failures.push(`lift ${elapsed}s, ${side} boot is off the actual roof: ${sole}`);
    }
    const truck = scenery.getObjectByName('matrix-freeway-handoff-truck')!;
    assert.ok(truck.visible); assert.equal(truck.position.z, gesture.truck.z);
    assert.equal(truck.rotation.y, Math.PI, 'the vehicle faces toward the motorcycle');
    const points = cloth(), hem = rigs.morpheus.hero!.panels.flatMap(panel => {
      const count = panel.mesh.geometry.attributes.position.count;
      return Array.from({ length: 41 }, (_, i) => panel.mesh.localToWorld(panel.mesh.getVertexPosition(count - 41 + i, new THREE.Vector3())));
    });
    const waist = rigs.morpheus.hero!.panels[0].mesh.getWorldPosition(new THREE.Vector3()).y;
    if (Math.min(...hem.map(point => point.y)) > Math.max(6.78, waist - .4)) failures.push(`lift ${elapsed}s, the coat hem sticks up rigidly above the waist (${waist})`);
    if (points.some(point => Math.abs(point.x - center.x - gesture.truck.x) < 2.75 && point.z > center.z + gesture.truck.z - 13.4
      && point.z < center.z + gesture.truck.z + 6.4 && point.y < 6.58)) failures.push(`lift ${elapsed}s, the delivered coat cuts through the trailer roof`);
  }
  const saved = { ...state, phase: 'lifting' as const, elapsed: .85, passengerStart: start }; draw(saved); const before = cloth();
  draw({ ...saved, elapsed: 1.5 }, .1); draw(JSON.parse(JSON.stringify(saved)));
  const jump = Math.max(...cloth().map((point, i) => point.distanceTo(before[i])));
  if (jump > .00001) failures.push(`the saved coat pose depends on earlier rendered frames (${jump})`);
  const sole = (role: typeof roles[number], side: string) => {
    const rig = rigs[role], ankle = rig.hero?.bones.get(`ankle_${side}`) ?? rig.ankles[side === 'R' ? 0 : 1], points: THREE.Vector3[] = [];
    if (rig.hero) rig.hero.root.traverseVisible(object => {
      if (!(object instanceof THREE.SkinnedMesh) || (object.material as THREE.Material).name !== 'Boot leather') return;
      const ids = object.geometry.attributes.skinIndex, weights = object.geometry.attributes.skinWeight;
      for (let i = 0; i < object.geometry.attributes.position.count; i++) if ([0, 1, 2, 3].some(j => weights.getComponent(i, j) > .5 && object.skeleton.bones[ids.getComponent(i, j)] === ankle))
        points.push(object.localToWorld(object.getVertexPosition(i, new THREE.Vector3())));
    });
    else {
      const shoes = rig.root.getObjectByName('keymaker-work-boots') as THREE.SkinnedMesh;
      const ids = shoes.geometry.attributes.skinIndex, weights = shoes.geometry.attributes.skinWeight;
      for (let i = 0; i < shoes.geometry.attributes.position.count; i++) if ([0, 1, 2, 3].some(j => weights.getComponent(i, j) > .5 && shoes.skeleton.bones[ids.getComponent(i, j)].name === 'ankle_' + side))
        points.push(shoes.localToWorld(shoes.getVertexPosition(i, new THREE.Vector3())));
    }
    const low = Math.min(...points.map(point => point.y)); return points.filter(point => point.y < low + .015);
  };
  draw({ ...state, phase: 'reaching', elapsed: FREEWAY_HANDOFF.reach });
  for (const side of ['R', 'L']) if (Math.abs(Math.min(...sole('keymaker', side).map(point => point.y)) - 2.45) >= .06)
    failures.push(`the standing passenger's ${side} sole cuts through the actual 2.45-high motorcycle seat`);
  for (const phase of ['approach', 'done'] as const) {
    draw({ ...state, phase, elapsed: phase === 'done' ? FREEWAY_HANDOFF.exit : 0, passengerStart: phase === 'done' ? start : undefined });
    for (const role of phase === 'done' ? ['morpheus', 'keymaker'] as const : ['morpheus'] as const) for (const side of ['R', 'L']) {
      const truck = scenery.getObjectByName('matrix-freeway-handoff-truck')!, points = sole(role, side);
      const gap = Math.min(...points.flatMap(point => new THREE.Raycaster(new THREE.Vector3(point.x, 12, point.z), new THREE.Vector3(0, -1, 0), 0, 7)
        .intersectObject(truck, true).map(hit => Math.abs(hit.point.y - point.y))));
      if (gap >= .08) failures.push(`${phase}: ${role}'s delivered ${side} sole misses the physical roof by ${gap}`);
    }
  }
  assert.deepEqual(failures, []);
});
