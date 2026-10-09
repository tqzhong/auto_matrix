import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, type FilmJourney } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

async function geometry(id: string) {
  const glb = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
  const length = glb.readUInt32LE(12), document = JSON.parse(glb.subarray(20, 20 + length).toString());
  for (const material of document.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = glb.subarray(20 + length), result = Buffer.alloc(20 + padded.length + bin.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); bin.copy(result, 20 + padded.length);
  return new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
}

test('paused Hammer patients lie down on their first cold frame and keep their delivered geometry on the mattress', async t => {
  const ids = ['neo', 'neo-office', 'neo-tracking'], assets = await Promise.all(ids.map(geometry));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async (url: string) => assets[ids.indexOf(url.split('/').at(-1)!.replace('.glb', ''))]);
  const originalDocument = globalThis.document;
  const ctx = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const center = FILM_SETS.film_hammer_deck.center;
  const warm = new AgentRenderer(new THREE.Scene()), cold = new AgentRenderer(new THREE.Scene()); warm.setWorld(false); cold.setWorld(false);
  t.after(() => { warm.dispose(); cold.dispose(); globalThis.document = originalDocument; });
  const saved: FilmJourney = { version: 1, scene: 'm2_medical', actor: 'trinity', step: 0, completed: [], enteredAt: 3927, reflections: {}, lastText: '', checkpoint: center };
  for (const id of ['neo', 'bane']) {
    const state = structuredClone(world.agents.get(id)!);
    Object.assign(state, { currentLocation: 'film_hammer_deck', isInMatrix: false, position: { ...center, x: center.x + (id === 'neo' ? -10 : 10), z: center.z - 23 }, rotation: 0,
      currentAction: { type: 'move_to', parameters: { resolved: true, finaleComa: true }, startedAt: 3900, duration: 1e9, progress: .000000031 } });
    warm.updateAgent(id, state); cold.updateAgent(id, structuredClone(state));
  }
  warm.update(0, undefined, 0, 3927, saved); cold.update(0, undefined, 0, 3927, saved);
  await new Promise(resolve => setImmediate(resolve));
  const snapshot = (renderer: AgentRenderer, id: string) => {
    const body = renderer.getAgentBody(id)!; body.updateWorldMatrix(true, true); const transforms: Record<string, number[]> = {};
    body.traverse(object => { if (object instanceof THREE.Bone || object instanceof THREE.Group) transforms[object.uuid === body.uuid ? 'body' : object.name || String(Object.keys(transforms).length)] = object.matrixWorld.elements.map(value => +value.toFixed(6)); });
    return transforms;
  };
  warm.update(.2, undefined, 0, 3927, saved); cold.update(0, undefined, 0, 3927, structuredClone(saved));
  for (const id of ['neo', 'bane']) {
    assert.deepEqual(snapshot(warm, id), snapshot(cold, id), `${id}: a cold patient must not start standing and animate down while paused`);
    const expected = snapshot(cold, id); warm.update(3, undefined, 0, 3927, saved); assert.deepEqual(snapshot(warm, id), expected, `${id}: pause moved patient`);
    const body = warm.getAgentBody(id)!; let lowest = Infinity, highest = -Infinity; const parts: Record<string, number[]> = {};
    body.traverseVisible(object => {
      if (!(object instanceof THREE.Mesh)) return;
      if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
      let bottom = Infinity, top = -Infinity;
      for (let i = 0; i < object.geometry.attributes.position.count; i++) {
        const point = object.localToWorld(object.getVertexPosition(i, new THREE.Vector3()));
        lowest = Math.min(lowest, point.y); highest = Math.max(highest, point.y);
        bottom = Math.min(bottom, point.y); top = Math.max(top, point.y);
      }
      parts[object.name] = [bottom - center.y, top - center.y];
    });
    const joints = ['pelvis', 'head', 'hip_R', 'knee_R', 'ankle_R'].map(name => [name, body.getObjectByName(name)?.getWorldPosition(new THREE.Vector3()).toArray()]);
    assert.ok(highest - lowest < 1.6, `${id}: patient is still upright (${highest - lowest}), ${JSON.stringify({parts,joints})}`);
    assert.ok(Math.abs(lowest - (center.y - 1 + 1.9)) < .03, `${id}: mattress contact ${lowest - center.y}`);
  }
});
