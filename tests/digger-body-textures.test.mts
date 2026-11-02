import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { DiggerBodies } from '../packages/client/src/agents/DiggerBodies.js';
import type { CharacterRig } from '../packages/client/src/agents/CharacterModel.js';

function fixture(t: TestContext, delayed = false) {
  const root = new THREE.Group(), detail = new THREE.Group(), head = new THREE.Group(); root.add(detail); detail.add(head);
  const rig = { root, detail, head } as CharacterRig;
  const imported = new THREE.Texture(), overwritten = new THREE.Texture(), shared = new THREE.Texture();
  const counts = { imported: 0, overwritten: 0, shared: 0 };
  imported.addEventListener('dispose', () => counts.imported++);
  overwritten.addEventListener('dispose', () => counts.overwritten++);
  shared.addEventListener('dispose', () => counts.shared++);
  const wool = new THREE.MeshStandardMaterial({ normalMap: imported, roughnessMap: imported }); wool.name = 'Architect suit wool';
  const skin = new THREE.MeshStandardMaterial({ map: overwritten }); skin.name = 'Skin';
  const vest = new THREE.MeshStandardMaterial({ bumpMap: overwritten }); vest.name = 'Dock woven vest';
  const scene = new THREE.Group(), geometry = new THREE.BoxGeometry();
  for (const material of [wool, wool, skin, vest, vest]) scene.add(new THREE.Mesh(geometry, material));
  const asset = { scene, parser: { json: { extras: { joints: [] } } } } as unknown as GLTF;
  let resolve!: () => void;
  const pending = new Promise<void>(done => { resolve = done; });
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async () => { if (delayed) await pending; return asset; });
  const bodies = new DiggerBodies(), sharedSkin = new THREE.MeshStandardMaterial({ map: shared }), cloth = new THREE.MeshStandardMaterial({ bumpMap: shared });
  bodies.track(rig, 'architect', sharedSkin, cloth, cloth); bodies.update(rig);
  t.after(() => { resolve(); bodies.dispose(); sharedSkin.dispose(); cloth.dispose(); shared.dispose(); });
  return { rig, bodies, counts, vest, shared, release: async () => { resolve(); await new Promise(done => setImmediate(done)); } };
}

test('detailed bodies release imported textures once and preserve shared replacement maps', async t => {
  const h = fixture(t); await h.release();
  assert.ok(h.rig.root.getObjectByName('architect-detailed-body'));
  assert.equal(h.vest.bumpMap, h.shared, 'the existing woven-vest replacement must remain shared');
  assert.deepEqual({ ...h.counts }, { imported: 0, overwritten: 0, shared: 0 });
  h.bodies.dispose(); h.bodies.dispose();
  assert.deepEqual({ ...h.counts }, { imported: 1, overwritten: 1, shared: 0 }, 'both retained and overwritten GLTF textures belong to the body loader');
});

test('body textures arriving after scene disposal are released without attaching the stale model', async t => {
  const h = fixture(t, true); h.bodies.dispose(); await h.release();
  assert.equal(h.rig.root.getObjectByName('architect-detailed-body'), undefined);
  h.bodies.dispose();
  assert.deepEqual({ ...h.counts }, { imported: 1, overwritten: 1, shared: 0 });
});
