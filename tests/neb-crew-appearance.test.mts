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

test('Neo has his grown hair and unbandaged knit costume at the ship loss, with recovery and Matrix clothing restored on leaving', async t => {
  const ids = ['neo', 'neo-office', 'neo-tracking'], assets = await Promise.all(ids.map(geometry));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async (url: string) => assets[ids.indexOf(url.split('/').at(-1)!.replace('.glb', ''))]);
  const originalDocument = globalThis.document;
  const context = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const renderer = new AgentRenderer(new THREE.Scene());
  t.after(() => { renderer.dispose(); globalThis.document = originalDocument; });
  const neo = world.agents.get('neo')!; neo.currentLocation = 'film_neb_deck'; neo.isInMatrix = false;
  neo.position = { ...FILM_SETS.film_neb_deck.center }; neo.currentAction = null;
  const journey: FilmJourney = { version: 1, scene: 'm2_ship_lost', actor: 'neo', step: 3, completed: [], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: neo.position, shipLoss: { phase: 'evacuating', remaining: 30, lastTick: 0, attempts: 0, age: 2 } };
  renderer.setWorld(false); renderer.updateAgent('neo', neo);
  await new Promise(resolve => setImmediate(resolve));
  const body = renderer.getAgentBody('neo')!, hair: THREE.Mesh[] = [];
  body.traverse(object => { if (object instanceof THREE.Mesh && /Hair|hair|Groom|groom/.test((object.material as THREE.Material).name)) hair.push(object); });
  assert.ok(body.getObjectByName('pelvis'), 'the delivered Neo skeleton must finish loading');
  assert.ok(hair.length >= 2, `use the delivered scalp and hair meshes: ${hair.map(part => part.name).join(', ')}`);
  const shirt = body.getObjectByName('neo-logos-sweater') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  const matrixShirt = body.getObjectByName('Black_crew_neck') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  const originalBump = matrixShirt.material.bumpMap;
  const band = body.getObjectByName('neo-farewell-eye-band')!;
  const coatTail = body.getObjectByName('neo-coat-panel');
  renderer.update(0, undefined, 0, 0, journey);
  assert.ok(hair.every(part => part.visible), 'the second-film ship scene must not inherit the shaved awakening appearance');
  assert.equal(band.visible, false, 'Neo is not yet blind in the second film');
  assert.equal(shirt.material.bumpMap?.name, 'neo-farewell-knit');
  assert.equal(shirt.material.color.getHex(), 0x393c3a);
  assert.equal(shirt.visible, true); assert.equal(matrixShirt.visible, false);
  if (coatTail) assert.equal(coatTail.visible, false);

  journey.scene = 'm1_recovery'; journey.shipLoss = undefined;
  renderer.update(0, undefined, 0, 0, journey);
  assert.ok(hair.every(part => !part.visible), 'the first-film real body remains shaved');
  assert.equal(band.visible, false);
  assert.equal(shirt.visible, false);
  assert.equal(matrixShirt.material.bumpMap, originalBump);

  journey.scene = 'm3_farewell'; neo.currentLocation = 'film_logos_wreck'; renderer.updateAgent('neo', neo);
  renderer.update(0, undefined, 0, 0, journey);
  assert.ok(hair.every(part => part.visible)); assert.equal(band.visible, true, 'the later injury still requires its bandage');

  journey.scene = 'm1_dojo'; neo.currentLocation = 'film_kungfu_dojo'; neo.isInMatrix = true; renderer.setWorld(true); renderer.updateAgent('neo', neo);
  renderer.update(0, undefined, 0, 0, journey);
  assert.ok(hair.every(part => part.visible)); assert.equal(band.visible, false);
  assert.equal(shirt.visible, false); assert.equal(matrixShirt.visible, true);
  assert.equal(matrixShirt.material.bumpMap, originalBump, 'Matrix clothing must retain its original texture');
});

test('the saved first-film cabin and its escort select the actual knit outfits for Neo and Morpheus', async t => {
  const ids = ['neo', 'neo-office', 'neo-tracking', 'morpheus'], assets = await Promise.all(ids.map(geometry));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async (url: string) => assets[ids.indexOf(url.split('/').at(-1)!.replace('.glb', ''))]);
  const originalDocument = globalThis.document;
  const context = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const renderer = new AgentRenderer(new THREE.Scene());
  t.after(() => { renderer.dispose(); globalThis.document = originalDocument; });
  for (const id of ['neo', 'morpheus']) {
    const actor = world.agents.get(id)!;
    actor.currentLocation = 'film_neb_deck'; actor.isInMatrix = false;
    actor.position = { ...FILM_SETS.film_neb_deck.center }; actor.currentAction = null;
    renderer.updateAgent(id, actor);
  }
  renderer.setWorld(false); await new Promise(resolve => setImmediate(resolve));
  const journey: FilmJourney = { version: 1, scene: 'm1_cabin', actor: 'neo', step: 0, completed: [], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: { ...world.agents.get('neo')!.position }, awakening: { kind: 'cabin', elapsed: 6, started: true } };
  for (const firstPerson of [false, true]) for (const step of [0, 1, 2]) {
    journey.step = step; renderer.setPlayer('neo', firstPerson); renderer.update(0, undefined, 0, 0, journey);
    for (const role of ['neo', 'morpheus'] as const) {
      const body = renderer.getAgentBody(role)!, sweater = body.getObjectByName(`${role}-${role === 'neo' ? 'logos' : 'hammer'}-sweater`) as THREE.Mesh;
      assert.equal(sweater.visible, true, `${role}/${step}: the production renderer must choose the knit, not only a direct model fixture`);
      const old: THREE.Mesh[] = [], hair: THREE.Mesh[] = [];
      body.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        if (/Tailored.coat.upper|Black.crew.neck/i.test(object.name)) old.push(object);
        if (/Hair|hair|Groom|groom/.test((object.material as THREE.Material).name)) hair.push(object);
      });
      assert.ok(old.length && old.every(part => !part.visible));
      if (role === 'neo') assert.ok(hair.length && hair.every(part => !part.visible), 'the first-film scalp must not grow the later crew hairstyle');
    }
  }
  journey.scene = 'm2_ship_lost'; journey.awakening = undefined;
  renderer.setPlayer(null); renderer.update(0, undefined, 0, 0, journey);
  const neo = renderer.getAgentBody('neo')!, hair: THREE.Mesh[] = [];
  neo.traverse(object => { if (object instanceof THREE.Mesh && /Hair|hair|Groom|groom/.test((object.material as THREE.Material).name)) hair.push(object); });
  assert.ok(hair.every(part => part.visible), 'the early-film flag must clear in the later crew scene');
});
