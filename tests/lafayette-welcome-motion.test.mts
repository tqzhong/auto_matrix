import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, filmPosition, lafayetteWelcomeRoot, type LafayetteWelcomeGesture } from '@auto_matrix/shared';
import { advanceMotion, newMotion, type MotionInput } from '../packages/client/src/agents/CharacterMotion.js';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { actor } from './helpers/fighting-hand-fixture.mts';

const idle = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 };
const frames = [['approach', 1.2], ['approach', 3], ['ready', 0], ['handshake', 1.3], ['departing', 2.5], ['departing', 4.8], ['done', 0]] as const;

test('the complete saved greeting pose is independent of local walking and combat history', () => {
  for (const role of ['morpheus', 'neo', 'trinity'] as const) for (const [phase, elapsed] of frames) {
    const state = newMotion();
    for (let frame = 0; frame < 50; frame++) advanceMotion(state, { ...idle, speed: 5.4, turn: -.8 }, 1 / 60);
    advanceMotion(state, { ...idle, attack: 2, combo: 1, hit: 1 }, .02);
    const command: MotionInput = { ...idle, welcome: { role, phase, elapsed } };
    const warm = advanceMotion(state, command, 0), cold = advanceMotion(newMotion(), command, 0);
    assert.deepEqual(warm, cold, `${role}/${phase}/${elapsed}: rejoining must not restart or inherit a different gait`);
    assert.deepEqual(advanceMotion(state, command, .1), cold, `${role}/${phase}/${elapsed}: render delta must not advance the saved greeting`);
  }
});

function place(root: THREE.Group, gesture: LafayetteWelcomeGesture) {
  const pose = lafayetteWelcomeRoot(gesture, gesture.role), center = FILM_SETS.film_lafayette.center;
  root.position.set(center.x + pose.x, center.y - 1, center.z + pose.z); root.rotation.y = pose.yaw;
}
function surfaceState(root: THREE.Group) {
  root.updateMatrixWorld(true); const result: { name: string; points: string; attributes: Record<string, string>; index: string }[] = [];
  const hash = (bytes: ArrayBufferView) => createHash('sha256').update(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)).digest('hex');
  root.traverseVisible(object => {
    if (!(object instanceof THREE.Mesh)) return;
    if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
    const points = new Float64Array(object.geometry.attributes.position.count * 3), point = new THREE.Vector3();
    for (let id = 0; id < points.length / 3; id++) object.localToWorld(object.getVertexPosition(id, point)).toArray(points, id * 3);
    result.push({ name: object.name, points: hash(points), attributes: Object.fromEntries(Object.entries(object.geometry.attributes).map(([name, attr]) => [name, hash(attr.array)])), index: hash(object.geometry.index!.array) });
  });
  return result;
}

test('all visible greeting surfaces and paused buffers restore exactly on all three actual rigs', async t => {
  for (const role of ['morpheus', 'neo', 'trinity'] as const) {
    const warm = await actor(role), cold = await actor(role); t.after(() => { warm.models.dispose(); cold.models.dispose(); });
    const motion = newMotion();
    for (let frame = 0; frame < 30; frame++) {
      const walking = { ...idle, speed: 4.2, turn: .4 };
      warm.models.animate(warm.rig, advanceMotion(motion, walking, 1 / 60), motion, walking, 1 / 60);
    }
    for (const [phase, elapsed] of frames) {
      const welcome = { role, phase, elapsed }, command = { ...idle, welcome }, fresh = newMotion();
      place(warm.rig.root, welcome); place(cold.rig.root, welcome);
      warm.models.animate(warm.rig, advanceMotion(motion, command, 0), motion, command, 0);
      cold.models.animate(cold.rig, advanceMotion(fresh, command, 0), fresh, command, 0);
      const expected = surfaceState(cold.rig.root), before = surfaceState(warm.rig.root);
      assert.deepEqual(before, expected, `${role}/${phase}/${elapsed}: complete actual visible surfaces differ after a cold join`);
      warm.models.animate(warm.rig, advanceMotion(motion, command, 0), motion, command, 0);
      assert.deepEqual(surfaceState(warm.rig.root), before, `${role}/${phase}: a paused update changes the actual body or clothing`);
      warm.models.animate(warm.rig, advanceMotion(motion, command, .1), motion, command, .1);
      assert.deepEqual(surfaceState(warm.rig.root), before, `${role}/${phase}/${elapsed}: rendering must preserve the saved body and clothing`);
    }
  }
});

test('greeting roots retain saved facing regardless of walking velocity or accumulated turns', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  const document = globalThis.document;
  const context = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ getContext: () => context }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const renderer = new AgentRenderer(new THREE.Scene());
  try {
    for (const role of ['morpheus', 'trinity'] as const) for (const [phase, elapsed] of frames) {
      const gesture = { role, phase, elapsed }, pose = lafayetteWelcomeRoot(gesture, role), state = world.agents.get(role)!;
      state.position = filmPosition('film_lafayette', pose.x, pose.z); state.rotation = pose.yaw; state.isInMatrix = true; state.currentLocation = 'film_lafayette';
      state.currentAction = { type: 'idle', parameters: { resolved: true, welcome: gesture }, startedAt: 0, duration: 1, progress: 0 };
      for (const velocity of [{ x: 3, y: 0, z: .4 }, { x: 0, y: 0, z: 0 }]) for (const turns of [4 * Math.PI, -2 * Math.PI, .37]) {
        state.velocity = velocity; renderer.updateAgent(role, state); renderer.getAgentBody(role)!.rotation.y = pose.yaw + turns;
        renderer.update(1 / 60, undefined, 1);
        assert.equal(renderer.getAgentBody(role)!.rotation.y, pose.yaw, `${role}/${phase}: the saved facing is independent of velocity and turn history`);
      }
    }
  } finally { renderer.dispose(); globalThis.document = document; }
});
