import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { filmPosition } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

async function smithAsset() {
  const bytes = await readFile(new URL('../packages/client/public/assets/characters/smith.glb', import.meta.url));
  const length = bytes.readUInt32LE(12), document = JSON.parse(bytes.subarray(20, 20 + length).toString());
  for (const material of document.materials) { delete material.pbrMetallicRoughness?.baseColorTexture; delete material.normalTexture; }
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const binary = bytes.subarray(20 + length), buffer = Buffer.alloc(20 + padded.length + binary.length);
  buffer.writeUInt32LE(0x46546c67, 0); buffer.writeUInt32LE(2, 4); buffer.writeUInt32LE(buffer.length, 8);
  buffer.writeUInt32LE(padded.length, 12); buffer.writeUInt32LE(0x4e4f534a, 16); padded.copy(buffer, 20); binary.copy(buffer, 20 + padded.length);
  return new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '');
}

async function setup(t: test.TestContext, delayed = false) {
  const asset = await smithAsset(); let finish!: () => void;
  const pending = new Promise<typeof asset>(resolve => { finish = () => resolve(asset); });
  t.mock.method(GLTFLoader.prototype, 'loadAsync', (url: string) => url.endsWith('/smith.glb') ? delayed ? pending : Promise.resolve(asset) : new Promise(() => {}));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  const window = new EventTarget(), document = { createElement: () => ({ getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, stroke() {}, ellipse() {}, fill() {}, createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) };
  Object.assign(globalThis, { window, document });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const bane = structuredClone(world.agents.get('bane')!), smith = structuredClone(world.agents.get('smith')!);
  Object.assign(bane, { faction: 'zion', isInMatrix: true, currentLocation: 'film_industrial_loft', position: filmPosition('film_industrial_loft', 0, -23), currentAction: null });
  Object.assign(smith, { isInMatrix: true, currentLocation: 'film_industrial_loft', position: filmPosition('film_industrial_loft', 3, -20), currentAction: null });
  const scene = new THREE.Scene(), renderer = new AgentRenderer(scene); renderer.setWorld(true); renderer.updateAgent('bane', bane); renderer.updateAgent('smith', smith);
  const update = () => { renderer.updateAgent('bane', bane); renderer.update(0); scene.updateMatrixWorld(true); };
  const settle = async () => { for (let i = 0; i < 8; i++) { await new Promise(resolve => setImmediate(resolve)); update(); } };
  t.after(() => { renderer.dispose(); ['window', 'document'].forEach((key, i) => { if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!); else Reflect.deleteProperty(globalThis, key); }); });
  update(); return { scene, renderer, bane, smith, update, settle, finish };
}

test('infected Matrix Bane uses a complete independent Smith while the original Smith and Bane identity remain intact', async t => {
  const h = await setup(t); await h.settle(); assert.equal(h.renderer.getAgentHero('bane'), undefined, 'the human cannot transform before infection');
  const prime = h.renderer.getAgentHero('smith'); assert.ok(prime);
  h.bane.faction = 'machines'; h.update(); await h.settle(); const projection = h.renderer.getAgentHero('bane');
  assert.ok(projection, 'infection must change the visible Matrix projection, not only the faction and skills');
  assert.ok(projection !== prime); assert.ok(h.renderer.getAgentHero('smith') === prime); assert.equal(h.renderer.getAgentState('bane')!.id, 'bane');
  const projectedSkin = projection.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh, originalSkin = prime.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  assert.ok(projectedSkin instanceof THREE.SkinnedMesh && originalSkin instanceof THREE.SkinnedMesh);
  assert.equal(projectedSkin.geometry.attributes.position.count, originalSkin.geometry.attributes.position.count, 'keep the full delivered anatomy');
  assert.ok(projectedSkin.skeleton !== originalSkin.skeleton); assert.ok(projection.getObjectByName('head') !== prime.getObjectByName('head'));
  assert.ok(h.renderer.getAgentDetail('bane')!.children.every(child => child === projection || !child.visible), 'the old body cannot overlap the replacement');
});

test('returning to reality restores the same Bane body and re-entering the Matrix reuses the cached projection', async t => {
  const h = await setup(t); await h.settle(); const body = h.renderer.getAgentBody('bane')!, detail = h.renderer.getAgentDetail('bane')!, fallback = [...detail.children].filter(child => child.visible);
  h.bane.faction = 'machines'; h.update(); await h.settle(); const projection = h.renderer.getAgentHero('bane'); assert.ok(projection);
  h.bane.isInMatrix = false; h.bane.currentLocation = 'film_zion_hangar'; h.bane.position = filmPosition('film_zion_hangar', 5, 20); h.renderer.setWorld(false); h.update();
  assert.equal(h.renderer.getAgentHero('bane'), undefined); assert.ok(h.renderer.getAgentBody('bane') === body); assert.ok(fallback.every(child => child.visible)); assert.equal(h.bane.faction, 'machines');
  h.bane.isInMatrix = true; h.bane.currentLocation = 'film_industrial_loft'; h.bane.position = filmPosition('film_industrial_loft', 0, -23); h.renderer.setWorld(true); h.update();
  assert.ok(h.renderer.getAgentHero('bane') === projection, 'a world round trip cannot allocate another Smith');
  h.renderer.setPlayer('bane', true); h.update(); h.renderer.setPlayer('bane', false); h.update(); assert.ok(h.renderer.getAgentHero('bane') === projection);
});

test('disposal before the shared Smith asset arrives cannot reattach either the original or replacement body', async t => {
  const h = await setup(t, true); h.bane.faction = 'machines'; h.update(); h.renderer.dispose(); h.finish();
  for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.scene.children.length, 0);
});
