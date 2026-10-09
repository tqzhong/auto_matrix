import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EMP_OPERATOR, FILM_SETS, empOperatorPose, type EmpOperator, type FilmJourney } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { RevolutionsPreludeRenderer } from '../packages/client/src/engine/RevolutionsPreludeRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

async function loadGeometry(id: string) {
  const glb = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
  const length = glb.readUInt32LE(12), document = JSON.parse(glb.subarray(20, 20 + length).toString());
  // Retain the delivered geometry and skinning; Node skips texture decoding.
  for (const material of document.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = glb.subarray(20 + length), result = Buffer.alloc(20 + padded.length + bin.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); bin.copy(result, 20 + padded.length);
  return new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
}

test('Link’s shipped body rests on the chair and floor and grasps the rendered crank after cold loading', async t => {
  const asset = await loadGeometry('morpheus');
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async () => asset);
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const doc = globalThis.document;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({
    createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {},
  }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const center = FILM_SETS.film_hammer_deck.center, scene = new THREE.Scene(), renderer = new AgentRenderer(scene);
  renderer.setWorld(false); renderer.setPlayer('link');
  const stage = new THREE.Group(); stage.position.set(center.x, center.y - 1, center.z); scene.add(stage);
  const station = new RevolutionsPreludeRenderer(stage, 'm3_emp');
  t.after(() => { renderer.dispose(); station.dispose(); globalThis.document = doc; });
  const state = structuredClone(world.agents.get('link')!);
  const inspect = async (operator: EmpOperator, firstPerson = false) => {
    const p = empOperatorPose(operator);
    Object.assign(state, { currentLocation: 'film_hammer_deck', isInMatrix: false, rotation: Math.PI,
      position: { x: center.x + p.x, y: center.y, z: center.z + p.z }, velocity: { x: 0, y: 0, z: 0 },
      currentAction: { type: 'idle', parameters: { empOperator: operator }, startedAt: 0, duration: 1e9, progress: 0 } });
    renderer.updateAgent('link', state); renderer.getAgent('link')!.position.copy(state.position); renderer.getAgentBody('link')!.rotation.y = Math.PI;
    renderer.setPlayer('link', firstPerson);
    renderer.setPlayerMotion({ speed: 0, grounded: true, verticalVelocity: 0, turn: 0, empOperator: operator, firstPerson });
    await new Promise(resolve => setImmediate(resolve)); renderer.update(0, undefined, 0);
    station.update({ scene: 'm3_emp', step: 0, completed: [], empOperator: operator } as FilmJourney, 0); scene.updateMatrixWorld(true);
    const body = renderer.getAgentBody('link')!, grip = stage.getObjectByName('emp-crank-grip')!;
    assert.ok(body.visible, 'Link must see his own operating hand in first person');
    assert.ok(body.getObjectByName('pelvis'), 'test the loaded actor, not just the fallback rig');
    let soles = Infinity, handDistance = Infinity, seatGap = Infinity;
    const feet = { L: { sum: new THREE.Vector3(), count: 0 }, R: { sum: new THREE.Vector3(), count: 0 } };
    const panels: { box: THREE.Box3; mesh: THREE.Mesh; inverse: THREE.Matrix4; size: THREE.Vector3 }[] = [];
    stage.getObjectByName('hammer-emp-detonator')!.traverse(object => {
      if (!(object instanceof THREE.Mesh) || !(object.geometry instanceof THREE.BoxGeometry)) return;
      const { width, height, depth } = object.geometry.parameters;
      if (Math.min(width, height, depth) < .12) return;
      panels.push({ box: new THREE.Box3().setFromObject(object).expandByScalar(-.03), mesh: object,
        inverse: object.matrixWorld.clone().invert(), size: new THREE.Vector3(width / 2 - .03, height / 2 - .03, depth / 2 - .03) });
    });
    let penetration: string | undefined;
    const gripWorld = grip.getWorldPosition(new THREE.Vector3());
    body.traverseVisible(object => {
      if (!(object instanceof THREE.SkinnedMesh)) return;
      object.skeleton.update(); const material = (object.material as THREE.Material).name;
      for (let i = 0; i < object.geometry.attributes.position.count; i++) {
        const point = object.localToWorld(object.getVertexPosition(i, new THREE.Vector3()));
        if (!penetration && /^(Skin|Trousers|Coat wool|Coat leather|Boot leather)$/.test(material)) for (const panel of panels) {
          if (!panel.box.containsPoint(point)) continue;
          const local = point.clone().applyMatrix4(panel.inverse);
          if (Math.abs(local.x) < panel.size.x && Math.abs(local.y) < panel.size.y && Math.abs(local.z) < panel.size.z)
            penetration = `${material} inside ${panel.mesh.name || 'chair/console panel'} at ${point.clone().sub(new THREE.Vector3(center.x, center.y - 1, center.z)).toArray()}`;
        }
        if (material === 'Boot leather') {
          soles = Math.min(soles, point.y - center.y + 1);
          const joints = object.geometry.attributes.skinIndex, weights = object.geometry.attributes.skinWeight;
          for (const side of ['L', 'R'] as const) if ([0, 1, 2, 3].some(k => weights.getComponent(i, k) > .5 && object.skeleton.bones[joints.getComponent(i, k)].name === `ankle_${side}`)) {
            feet[side].sum.add(point); feet[side].count++;
          }
        }
        if (material === 'Trousers' && Math.abs(point.x - center.x) < .6 && Math.abs(point.z - center.z + 16) < .5)
          seatGap = Math.min(seatGap, point.y - center.y + 1 - EMP_OPERATOR.seat.y);
        if (material === 'Skin') {
          const ids = object.geometry.attributes.skinIndex, weights = object.geometry.attributes.skinWeight;
          const hand = [0, 1, 2, 3].some(k => weights.getComponent(i, k) > .5 && /wrist_R|finger.*_R/.test(object.skeleton.bones[ids.getComponent(i, k)].name));
          if (hand) handDistance = Math.min(handDistance, point.distanceTo(gripWorld));
        }
      }
    });
    assert.ok(soles >= -.015 && soles < .065, `${operator.phase}/${operator.elapsed}: soles ${soles}`);
    assert.equal(penetration, undefined, `${operator.phase}/${operator.elapsed}: ${penetration}`);
    if (p.seat === 1) assert.ok(seatGap >= -.03 && seatGap < .12, `actual trousers/seat gap ${seatGap}`);
    if (p.engaged === 1) assert.ok(handDistance < .13, `actual hand misses crank by ${handDistance}`);
    const snapshot: Record<string, number[]> = {};
    body.traverse(object => { if (object instanceof THREE.Bone && object.name) snapshot[object.name] = object.matrixWorld.elements.map(v => +v.toFixed(7)); });
    renderer.update(.2, undefined, 0); scene.updateMatrixWorld(true);
    body.traverse(object => { if (object instanceof THREE.Bone && object.name) assert.deepEqual(object.matrixWorld.elements.map(v => +v.toFixed(7)), snapshot[object.name], 'paused body must not drift: ' + object.name); });
    for (const foot of Object.values(feet)) { assert.ok(foot.count > 0); foot.sum.divideScalar(foot.count); }
    return feet;
  };
  for (const [phase, elapsed] of [['seating', 0], ['seating', .4], ['seating', .8], ['seating', 1.1], ['seating', 1.5], ['seating', 1.8], ['seating', 2.1], ['seating', 2.6], ['seating', 3.4], ['ready', 0], ['turning', 1.1], ['turning', 1.8], ['turning', 2.3], ['fired', 0], ['rising', .2], ['rising', .8], ['rising', 1.4], ['rising', 1.8], ['rising', 2.1], ['rising', 2.7]] as const)
    await inspect({ phase, elapsed, approach: { ...EMP_OPERATOR.entry } });
  await inspect({ phase: 'turning', elapsed: 1.4, approach: { ...EMP_OPERATOR.entry } }, true);
  for (const [a, b, support] of [[.2, .3, 'L'], [.5, .65, 'R'], [1, 1.1, 'L']] as const) {
    const from = await inspect({ phase: 'seating', elapsed: a, approach: { ...EMP_OPERATOR.entry } });
    const to = await inspect({ phase: 'seating', elapsed: b, approach: { ...EMP_OPERATOR.entry } });
    const drift = from[support].sum.distanceTo(to[support].sum);
    assert.ok(drift < .025, `${a}-${b}/${support}: planted boot drift ${drift}; ${from[support].sum.toArray()} -> ${to[support].sum.toArray()}`);
  }
});
