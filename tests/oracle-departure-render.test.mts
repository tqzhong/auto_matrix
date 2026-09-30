import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, ORACLE_DEPARTURE, ORACLE_VISIT, oracleDepartureRoot, type OracleDeparture } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';

test('the farewell keeps the real cookie grip, meets the mouth and grounds Morpheus while he rises', async t => {
  const assets = new Map();
  for (const name of ['neo', 'morpheus']) {
    const glb = await readFile(new URL(`../packages/client/public/assets/characters/${name}.glb`, import.meta.url));
    const length = glb.readUInt32LE(12), source = JSON.parse(glb.subarray(20, 20 + length).toString());
    for (const material of source.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
    source.images = []; source.textures = [];
    const json = Buffer.from(JSON.stringify(source)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
    const bin = glb.subarray(20 + length), buffer = Buffer.alloc(20 + padded.length + bin.length);
    buffer.writeUInt32LE(0x46546c67, 0); buffer.writeUInt32LE(2, 4); buffer.writeUInt32LE(buffer.length, 8);
    buffer.writeUInt32LE(padded.length, 12); buffer.writeUInt32LE(0x4e4f534a, 16); padded.copy(buffer, 20); bin.copy(buffer, 20 + padded.length);
    assets.set(name, await new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), ''));
  }
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async (url: string) => assets.get(url.includes('morpheus') ? 'morpheus' : 'neo'));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const models = new CharacterModels(), neo = models.create(world.agents.get('neo')!), morpheus = models.create(world.agents.get('morpheus')!);
  try {
    await new Promise(resolve => setImmediate(resolve)); assert.ok(neo.hero); assert.ok(morpheus.hero);
    const center = FILM_SETS.film_oracle_home.center, input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, glasses: false };
    neo.root.position.set(center.x + ORACLE_VISIT.neo.x, center.y - 1, center.z + ORACLE_VISIT.neo.z); neo.root.rotation.y = ORACLE_VISIT.neo.yaw;
    models.animate(neo, 0, { ...input, oracleVisit: { phase: 'responding', elapsed: 4.2, role: 'neo' } }, 4); neo.root.updateWorldMatrix(true, true);
    const accepted = neo.cookie!.getWorldPosition(new THREE.Vector3());
    models.animate(neo, 0, { ...input, oracleDeparture: { phase: 'waiting', elapsed: 0, rise: 0, role: 'neo' } }, 4); neo.root.updateWorldMatrix(true, true);
    assert.equal(neo.cookie!.visible, true, 'the cookie must survive the transition back to walking');
    assert.ok(accepted.distanceTo(neo.cookie!.getWorldPosition(new THREE.Vector3())) < .025, 'the accepted cookie cannot jump to another grip');
    neo.root.position.set(center.x + ORACLE_DEPARTURE.neo.x, center.y - 1, center.z + ORACLE_DEPARTURE.neo.z); neo.root.rotation.y = ORACLE_DEPARTURE.neo.yaw;
    for (const rise of [0, .3, .8, 1.4, 2.2, 3, 3.8]) {
      const departure: OracleDeparture = { phase: 'guiding', elapsed: 0, rise }, place = oracleDepartureRoot(departure, 'morpheus');
      morpheus.root.position.set(center.x + place.x, center.y - 1, center.z + place.z); morpheus.root.rotation.y = place.yaw;
      models.animate(morpheus, 0, { ...input, oracleDeparture: { ...departure, role: 'morpheus' } }, 4); morpheus.root.updateWorldMatrix(true, true);
      let sole = Infinity;
      for (const part of morpheus.hero.wardrobe) {
        const mesh = part.mesh; if (!mesh.visible || Array.isArray(mesh.material)) continue;
        const vertex = new THREE.Vector3();
        for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
          mesh.getVertexPosition(i, vertex); mesh.localToWorld(vertex); morpheus.root.worldToLocal(vertex);
          assert.ok(vertex.y >= -.025, `${mesh.name} penetrates the floor while rising at ${rise}: ${vertex.y}`);
          if (mesh.material.name === 'Boot leather') sole = Math.min(sole, vertex.y);
        }
      }
      assert.ok(sole <= .16, `Morpheus shoes must remain grounded while rising at ${rise}: ${sole}`);
    }
    models.animate(neo, 0, { ...input, oracleDeparture: { phase: 'talking', elapsed: 3, rise: 3.8, role: 'neo' } }, 4); neo.root.updateWorldMatrix(true, true);
    const target = neo.hero.bones.get('shoulder_R')!.localToWorld(new THREE.Vector3(0, -.12, .07));
    models.animate(morpheus, 0, { ...input, oracleDeparture: { phase: 'talking', elapsed: 3, rise: 3.8, role: 'morpheus', target } }, 4); morpheus.root.updateWorldMatrix(true, true);
    const palm = morpheus.hero.bones.get('wrist_R')!.localToWorld(new THREE.Vector3(0, -.19, .035));
    assert.ok(palm.distanceTo(target) < .065, `Morpheus must touch Neo actual shoulder: ${palm.distanceTo(target)}`);
    models.animate(neo, 0, { ...input, oracleDeparture: { phase: 'biting', elapsed: 1.5, rise: 3.8, role: 'neo' } }, 4); neo.root.updateWorldMatrix(true, true);
    const mouth = neo.hero.bones.get('head')!.localToWorld(new THREE.Vector3(0, -.12, .24));
    const edge = neo.cookie!.localToWorld(new THREE.Vector3(0, .115, 0));
    assert.ok(edge.distanceTo(mouth) < .07, `the cookie must actually reach the mouth: ${edge.distanceTo(mouth)}`);
    assert.equal(neo.cookie!.getObjectByName('cookie-bitten')!.visible, true, 'the bite removes an actual part of the cookie');
    models.animate(neo, 0, { ...input, oracleDeparture: { phase: 'leaving', elapsed: 0, rise: 3.8, role: 'neo' } }, 4);
    assert.equal(neo.cookie!.visible, true); assert.equal(neo.cookie!.getObjectByName('cookie-bitten')!.visible, true, 'reading a post-bite save preserves the bitten shape');
    models.animate(neo, 0, input, 4); assert.equal(neo.cookie!.visible, false, 'leaving the visit clears the prop');
  } finally { models.dispose(); globalThis.document = document; }
});
