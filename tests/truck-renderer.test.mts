import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, TRUCKS, truckRescuePose, type TruckEncounter } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

async function loadGeometry(id = 'neo') {
  const glb = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
  const jsonLength = glb.readUInt32LE(12);
  const document = JSON.parse(glb.subarray(20, 20 + jsonLength).toString());
  // Decode the shipped geometry with the real loader, without a DOM/image
  // decoder. Material/texture appearance is checked in the browser.
  for (const material of document.materials) {
    delete material.pbrMetallicRoughness.baseColorTexture;
    delete material.normalTexture;
  }
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document));
  const padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = glb.subarray(20 + jsonLength);
  const result = Buffer.alloc(20 + padded.length + bin.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16);
  padded.copy(result, 20); bin.copy(result, 20 + padded.length);
  return new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
}

test('the shipped rescue bodies and coat surfaces reconstruct the saved pose without a warm-up frame', async t => {
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking', 'morpheus'].map(async id => [id, await loadGeometry(id)] as const)));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async (path: string) => assets.get(path.split('/').pop()!.replace(/\.glb.*$/, ''))!);
  const document = globalThis.document;
  const context = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const center = FILM_SETS.film_freeway_trucks.center;
  const encounter: TruckEncounter = { phase: 'rescue', elapsed: 10, rescueElapsed: 1.5, lastTick: 0, attempt: 0 };
  const first = new AgentRenderer(new THREE.Scene()), cold = new AgentRenderer(new THREE.Scene());
  const snapshot = (renderer: AgentRenderer) => ['neo', 'morpheus', 'keymaker'].map(id => {
    const body = renderer.getAgentBody(id)!; body.parent!.parent!.updateMatrixWorld(true);
    const points = createHash('sha256');
    body.traverse(object => {
      if (object instanceof THREE.Bone) points.update(JSON.stringify(object.matrixWorld.elements));
      if (object instanceof THREE.Mesh) points.update(Buffer.from(object.geometry.attributes.position.array.buffer));
    });
    return { rotation: body.rotation.toArray(), points: points.digest('hex') };
  });
  try {
    for (const role of ['neo', 'morpheus', 'keymaker'] as const) {
      const actor = world.agents.get(role)!, pose = truckRescuePose(encounter, role);
      actor.position = { x: center.x + pose.x, y: center.y + pose.y, z: center.z + pose.z };
      actor.velocity = { x: 15, y: 20, z: 30 }; actor.rotation = pose.yaw; actor.currentLocation = 'film_freeway_trucks'; actor.isInMatrix = true;
      actor.currentAction = { type: 'move_to', parameters: { truckFlight: role === 'neo', truckPassenger: role !== 'neo',
        truckRescue: { ...encounter, role } }, startedAt: 0, duration: 10, progress: .5 };
      first.updateAgent(role, actor); cold.updateAgent(role, structuredClone(actor));
    }
    await new Promise(resolve => setImmediate(resolve));
    first.update(.016); cold.update(0);
    assert.ok(first.getAgentBody('neo')!.getObjectByName('pelvis'), 'exercise shipped GLB, not a proxy body');
    assert.equal(first.getAgentBody('morpheus')!.rotation.x, Math.PI / 2, 'Morpheus must fly prone');
    assert.equal(first.getAgentBody('keymaker')!.rotation.x, Math.PI / 2, 'Keymaker must fly prone');
    const saved = snapshot(first);
    assert.deepEqual(snapshot(cold), saved, 'a cold frame must have the same bones and clothing');
    first.update(.2); assert.deepEqual(snapshot(first), saved, 'same saved clock must freeze body, grips and cloth');
    for (const time of [0, .1, .2, .35, .6, .9, 1.3, 1.8, 2.6, 2.8, 2.95, 3]) {
      encounter.rescueElapsed = time;
      for (const role of ['neo', 'morpheus', 'keymaker'] as const) {
        const actor = world.agents.get(role)!, pose = truckRescuePose(encounter, role);
        actor.position = { x: center.x + pose.x, y: center.y + pose.y, z: center.z + pose.z };
        actor.rotation = pose.yaw; actor.currentAction!.parameters.truckRescue = { ...encounter, role };
        first.updateAgent(role, actor);
      }
      first.update(0);
      for (const role of ['neo', 'morpheus', 'keymaker']) {
        const body = first.getAgentBody(role)!; body.parent!.parent!.updateMatrixWorld(true);
        let minimum = Infinity;
        body.traverseVisible(object => {
          if (!(object instanceof THREE.Mesh)) return;
          const vertices = object.geometry.getAttribute('position');
          for (let i = 0; i < vertices.count; i++) {
            const point = object.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(object.matrixWorld);
            const x = point.x - center.x, z = point.z - center.z;
            const overRoof = Math.abs(x - TRUCKS.roof.x) < TRUCKS.roof.width / 2 && Math.abs(z - TRUCKS.roof.z) < TRUCKS.roof.depth / 2;
            minimum = Math.min(minimum, point.y - (center.y - 1) - (overRoof ? TRUCKS.roof.height : 0));
          }
        });
        assert.ok(minimum > -.08, `${role} visible body penetrates roof/road by ${minimum} at ${time}s`);
      }
    }
    const approaching = world.agents.get('neo')!;
    approaching.currentAction!.parameters = { truckFlight: true };
    first.updateAgent('neo', approaching); first.update(0);
    assert.equal(first.getAgentBody('neo')!.rotation.x, Math.PI / 2, 'paused approach saves must not stand Neo upright in the air');
  } finally { first.dispose(); cold.dispose(); globalThis.document = document; }
});
