import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ZION_DEPLOYMENT, newZionDeployment, type ZionDeploymentGesture, type ZionDeploymentRole } from '@auto_matrix/shared';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { ZionDeploymentRenderer } from '../packages/client/src/engine/ZionDeploymentRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

async function geometry(id: string) {
  const glb = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
  const length = glb.readUInt32LE(12), doc = JSON.parse(glb.subarray(20, 20 + length).toString());
  for (const material of doc.materials) { delete material.pbrMetallicRoughness?.baseColorTexture; delete material.normalTexture; }
  doc.images = []; doc.textures = [];
  const json = Buffer.from(JSON.stringify(doc)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = glb.subarray(20 + length), result = Buffer.alloc(20 + padded.length + bin.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); bin.copy(result, 20 + padded.length);
  return new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
}
async function setup(t: test.TestContext) {
  const assets = new Map(await Promise.all(['lock', ...ZION_DEPLOYMENT.cast].flatMap(role => [`${role}-head`, `${role}-body`]).map(async id => [`${id}.glb`, await geometry(id)] as const)));
  t.mock.method(GLTFLoader.prototype, 'loadAsync', (url: string) => assets.has(url.split('/').at(-1)!) ? Promise.resolve(assets.get(url.split('/').at(-1)!)) : new Promise(() => {}));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const old = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, stroke() {}, ellipse() {}, fill() {}, createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  const roles = ['lock', ...ZION_DEPLOYMENT.cast] as const, rigs = Object.fromEntries(roles.map(role => [role, models.create(world.agents.get(role)!)]));
  const pose = (role: ZionDeploymentRole, phase: ZionDeploymentGesture['phase'] = 'reporting', elapsed = 8.4, delta = 0) => {
    const rig = rigs[role], root = role === 'lock' ? phase === 'allocating' ? ZION_DEPLOYMENT.inspection : ZION_DEPLOYMENT.report : ZION_DEPLOYMENT.roots[role];
    rig.root.position.set(root.x, 0, root.z); rig.root.rotation.y = role === 'lock' ? phase === 'allocating' ? Math.PI / 2 : Math.PI : ZION_DEPLOYMENT.roots[role].yaw;
    models.animate(rig, delta, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true,
      zionDeployment: { ...newZionDeployment(1, 47), role, phase, elapsed } }, 0);
    rig.root.updateMatrixWorld(true); rig.root.traverse(object => { if (object instanceof THREE.SkinnedMesh) object.skeleton.update(); }); return rig;
  };
  t.after(() => { models.dispose(); globalThis.document = old; });
  for (const role of roles) pose(role); await new Promise(resolve => setImmediate(resolve));
  for (const role of roles) pose(role); await new Promise(resolve => setImmediate(resolve));
  return { pose, roles, rigs, models };
}

test('the council has seated positions and a real plan, keeps its report aisle open, and releases geometry', () => {
  const parent = new THREE.Group(), renderer = new ZionDeploymentRenderer(parent); renderer.root.updateMatrixWorld(true);
  for (const role of ZION_DEPLOYMENT.cast) {
    const chair = renderer.root.getObjectByName(`council-seat-${role}`)!;
    assert.ok(chair); const seat = new THREE.Box3().setFromObject(chair.getObjectByName('seat-cushion')!);
    assert.ok(Math.abs(seat.max.y - ZION_DEPLOYMENT.seat.top) < .001);
  }
  const hits = new THREE.Raycaster(new THREE.Vector3(0, 2.8, 17), new THREE.Vector3(0, 0, -1), 0, 21).intersectObject(renderer.root, true);
  assert.equal(hits.length, 0, 'the entry and report aisle cannot be blocked by scenery');
  assert.ok(renderer.root.getObjectByName('physical-zion-deployment-plan'));
  const disposed = new Set<string>(); renderer.root.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.addEventListener('dispose', () => disposed.add(object.geometry.uuid)); });
  renderer.dispose(); assert.equal(parent.children.length, 0); assert.ok(disposed.size > 15);
});

test('the delivered Lock and council rigs plant their shoes, stay apart and retain the saved pose while paused', async t => {
  const h = await setup(t), bounds: THREE.Box3[] = [];
  for (const role of h.roles) {
    assert.ok(h.rigs[role].root.getObjectByName(`${role}-anatomical-head`), `include ${role}’s delivered head`);
    assert.ok(h.rigs[role].root.getObjectByName(`${role}-anatomical-body`), `include ${role}’s delivered body rather than only its fallback`);
  }
  for (const role of h.roles) {
    const rig = h.pose(role); let lowest = Infinity;
    rig.root.traverseVisible(object => { if (object instanceof THREE.Mesh) for (let i = 0; i < object.geometry.attributes.position.count; i++) {
      const point = object.localToWorld(object.getVertexPosition(i, new THREE.Vector3())); assert.ok(point.toArray().every(Number.isFinite)); lowest = Math.min(lowest, point.y);
    } });
    assert.ok(lowest >= -.035 && lowest < .12, `${role}: floating or buried soles ${lowest}`);
    bounds.push(new THREE.Box3().setFromObject(rig.root));
    const joints = [rig.torso, rig.head, ...rig.hips, ...rig.knees, ...rig.ankles, ...rig.shoulders, ...rig.elbows, ...(rig.mobilWrists ?? [])];
    const saved = joints.map(joint => joint.matrixWorld.elements.slice()); h.pose(role, 'reporting', 8.4, .7);
    assert.deepEqual(joints.map(joint => joint.matrixWorld.elements.slice()), saved, `${role}: the saved report drifts with render delta`);
  }
  for (let i = 0; i < bounds.length; i++) for (let j = i + 1; j < bounds.length; j++) assert.equal(bounds[i].intersectsBox(bounds[j]), false);
});

test('sampled council bodies avoid seat backs and armrests, and Lock stays outside the plan stand', async t => {
  const h = await setup(t), renderer = new ZionDeploymentRenderer(new THREE.Group()); renderer.root.updateMatrixWorld(true); t.after(() => renderer.dispose());
  for (const role of h.roles) for (const elapsed of [0, 1.05, 2.1, 4.2, 8.4, 12.6, 16.8]) {
    const rig = h.pose(role, role === 'lock' ? 'allocating' : 'reporting', elapsed);
    const obstacles: THREE.Box3[] = [];
    if (role === 'lock') obstacles.push(new THREE.Box3().setFromObject(renderer.root.getObjectByName('portable-plan-stand')!).expandByScalar(-.02));
    else renderer.root.getObjectByName(`council-seat-${role}`)!.traverse(object => {
      if (object.name === 'seat-back' || object.name === 'seat-armrest') obstacles.push(new THREE.Box3().setFromObject(object).expandByScalar(-.02));
    });
    let hits = 0;
    rig.root.traverseVisible(object => { if (object instanceof THREE.Mesh) for (let i = 0; i < object.geometry.attributes.position.count; i++) {
      const point = object.localToWorld(object.getVertexPosition(i, new THREE.Vector3())); if (obstacles.some(box => box.containsPoint(point))) hits++;
    } });
    assert.equal(hits, 0, `${role} penetrates sampled furniture at ${elapsed}`);
  }
});
