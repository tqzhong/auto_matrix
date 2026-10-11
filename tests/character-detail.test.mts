import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

function setup(t: TestContext) {
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {},
  }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const models = new CharacterModels();
  t.after(() => { models.dispose(); globalThis.document = previous; });
  return { models, world };
}

const idle = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 };

test('distant characters do not traverse the hidden detailed body each frame', t => {
  const { models, world } = setup(t), rig = models.create(world.agents.get('sati')!);
  const root = t.mock.method(rig.root, 'getObjectByName'), detail = t.mock.method(rig.detail, 'getObjectByName');
  for (let frame = 0; frame < 30; frame++) models.animate(rig, 1 / 60, { ...idle, mobilStation: true }, 101);
  assert.equal(rig.detail.visible, false); assert.equal(rig.distant.visible, true);
  assert.equal(root.mock.callCount() + detail.mock.callCount(), 0,
    'the far representation must avoid full skeleton/wardrobe searches, not merely skip the later animation');
});

test('the first near frame restores current clothes after a distant scene change, including returning to the city', t => {
  const { models, world } = setup(t), state = world.agents.get('sati')!;
  const rig = models.create(state), fresh = models.create(state);
  const clothes = (body: THREE.Group) => {
    const skirt = body.getObjectByName('sati-skirt') as THREE.Mesh;
    const material = skirt.material as THREE.MeshPhysicalMaterial;
    return { color: material.color.getHex(), textured: material.map !== null,
      visibility: ['sati-mobil-jacket', 'sati-mobil-sleeve--1', 'sati-mobil-sleeve-1', 'sati-covered-arm--1', 'sati-covered-arm-1']
        .map(name => body.getObjectByName(name)!.visible) };
  };
  models.animate(rig, 0, idle, 1);
  for (const mobilStation of [true, false, true]) {
    models.animate(rig, 0, { ...idle, mobilStation }, 100);
    assert.equal(rig.distant.visible, true);
    models.animate(rig, 0, { ...idle, mobilStation }, 99.9);
    models.animate(fresh, 0, { ...idle, mobilStation }, 1);
    assert.equal(rig.detail.visible, true); assert.equal(rig.distant.visible, false);
    assert.deepEqual(clothes(rig.detail), clothes(fresh.detail), 'no stale clothes on the first detailed frame');
    assert.equal(clothes(rig.detail).visibility[0], mobilStation);
    assert.equal(clothes(rig.detail).visibility[3], !mobilStation);
    assert.deepEqual(rig.head.rotation.toArray(), fresh.head.rotation.toArray());
    assert.deepEqual(rig.hips.map(hip => hip.position), fresh.hips.map(hip => hip.position));
  }
});

test('the restored Oracle retains her full resting body beyond the normal detail distance', t => {
  const { models, world } = setup(t), rig = models.create(world.agents.get('oracle')!);
  models.animate(rig, 0, { ...idle, oracleRestored: true }, 300);
  assert.equal(rig.detail.visible, true); assert.equal(rig.distant.visible, false);
  rig.root.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3(), point = new THREE.Vector3();
  rig.detail.traverseVisible(object => {
    if (!(object instanceof THREE.Mesh)) return;
    for (let i = 0; i < object.geometry.attributes.position.count; i++) {
      object.getVertexPosition(i, point); bounds.expandByPoint(object.localToWorld(point));
    }
  });
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok(size.y < 1.2 && Math.max(size.x, size.z) > 3, 'retain the horizontal, supported Oracle instead of a distant standing silhouette');
});
