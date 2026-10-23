import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

function setup(t: TestContext) {
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  const loaded = new Map<string, () => void>();
  t.mock.method(THREE.TextureLoader.prototype, 'load', (url, onLoad) => {
    const texture = new THREE.Texture();
    loaded.set(url, () => { texture.image = { width: 2, height: 2 }; texture.needsUpdate = true; onLoad?.(texture); });
    return texture;
  });
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {},
  }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  t.after(() => { models.dispose(); globalThis.document = previous; });
  const headMaterials = (id: string) => {
    const rig = models.create(world.agents.get(id)!);
    return (rig.head.children.find(object => object instanceof THREE.Mesh) as THREE.Mesh).material as THREE.MeshStandardMaterial[];
  };
  return { models, headMaterials, finish: () => loaded.get('/assets/characters/matrix-faces.png')!() };
}

test('fallback faces keep their skin colour until the shared atlas is loaded, then receive the correct crop', t => {
  const h = setup(t), [face, skin] = h.headMaterials('neo');
  assert.equal(face.map, null, 'do not submit an atlas clone with needsUpdate but no image data');
  assert.equal(skin.map, null); assert.notEqual(face.color.getHex(), 0xffffff); assert.notEqual(skin.color.getHex(), 0xffffff);
  h.finish();
  assert.ok(face.map?.image && skin.map?.image); assert.equal(face.map.image, skin.map.image);
  assert.deepEqual(face.map.repeat.toArray(), [.5, .5]); assert.deepEqual(face.map.offset.toArray(), [0, .5]);
  assert.deepEqual(skin.map.repeat.toArray(), [.12, .025]); assert.deepEqual(skin.map.offset.toArray(), [.19, .52]);
  assert.equal(face.color.getHex(), 0xffffff); assert.equal(skin.color.getHex(), 0xffffff);
  const [readyFace] = h.headMaterials('trinity');
  assert.ok(readyFace.map?.image); assert.deepEqual(readyFace.map.offset.toArray(), [.5, .5]);
});

test('finishing an atlas request after the viewer is disposed cannot attach maps to its old materials', t => {
  const h = setup(t), materials = h.headMaterials('neo');
  h.models.dispose(); h.finish();
  assert.ok(materials.every(material => material.map === null));
});
