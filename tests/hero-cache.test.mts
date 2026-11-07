import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { HeroModels } from '../packages/client/src/agents/HeroModel.js';

test('cached heroes release the source parser while retaining geometry, clips and optical lookups', () => {
  const source = `
    import assert from 'node:assert/strict';
    import * as THREE from 'three';
    import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
    import { HeroModels } from './packages/client/src/agents/HeroModel.ts';
    function parserFor(lookup) {
      return { json: { extras: { irisRefraction: { eyes: [{ texture: 7 }] } } },
        binary: new ArrayBuffer(8 * 1024 * 1024),
        getDependency: async (kind, index) => { assert.equal(kind, 'texture'); assert.equal(index, 7); return lookup; } };
    }
    async function prepare() {
      const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
      const scene = new THREE.Group(), geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial();
      material.name = 'Skin'; scene.add(new THREE.Mesh(geometry, material));
      const clip = new THREE.AnimationClip('authored', 1, []), lookup = new THREE.Texture();
      const parser = parserFor(lookup), reference = new WeakRef(parser);
      const asset = { scene, animations: [clip], parser }, original = GLTFLoader.prototype.loadAsync;
      let loads = 0;
      GLTFLoader.prototype.loadAsync = async () => { loads++; return asset; };
      try {
        const first = models['load']('smith'), second = models['load']('smith');
        assert.equal(first, second, 'coalesce the original load');
        const cached = await first;
        assert.equal(await models['load']('smith'), cached);
        assert.equal(loads, 1);
        assert.equal(cached.scene, scene); assert.equal(cached.animations[0], clip);
        assert.equal(await cached.parser.getDependency('texture', 7), lookup);
        return { models, cached, geometry, lookup, reference };
      } finally { GLTFLoader.prototype.loadAsync = original; }
    }
    const state = await prepare();
    for (let i = 0; i < 6; i++) { await new Promise(resolve => setImmediate(resolve)); global.gc(); }
    assert.equal(state.reference.deref(), undefined, 'the runtime cache must not retain the source parser or its raw GLB buffers');
    assert.equal(state.cached.scene.children[0].geometry, state.geometry);
    assert.equal(await state.cached.parser.getDependency('texture', 7), state.lookup);
    state.models.dispose();
  `;
  const result = spawnSync(process.execPath, ['--expose-gc', '--import', 'tsx', '--input-type=module', '--eval', source],
    { encoding: 'utf8', timeout: 20000 });
  assert.equal(result.status, 0, result.stderr || String(result.error));
});

test('an optical lookup completing after disposal is released before a hero can be returned', async t => {
  let requested!: () => void, complete!: (texture: THREE.Texture) => void;
  const arrived = new Promise<void>(resolve => { requested = resolve; });
  const pending = new Promise<THREE.Texture>(resolve => { complete = resolve; });
  const asset = { scene: new THREE.Group(), animations: [], parser: {
    json: { extras: { irisRefraction: { eyes: [{ texture: 7 }] } } },
    getDependency: async (kind: string, index: number) => {
      assert.equal(kind, 'texture'); assert.equal(index, 7); requested(); return pending;
    },
  } } as unknown as GLTF;
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async () => asset);
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture()); t.after(() => models.dispose());
  const lookup = new THREE.Texture(); let released = 0;
  lookup.addEventListener('dispose', () => released++);
  const creating = models.create('smith'); await arrived;
  models.dispose(); complete(lookup);
  assert.equal(await creating, undefined);
  assert.equal(released, 1);
});

test('disposing a retained hero factory releases its cached scenes and geometry buffers', () => {
  const source = `
    import assert from 'node:assert/strict';
    import * as THREE from 'three';
    import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
    import { HeroModels } from './packages/client/src/agents/HeroModel.ts';
    async function prepare() {
      const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
      const buffer = new Float32Array(3 * 1024 * 1024), geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(buffer, 3));
      const scene = new THREE.Group(); scene.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial()));
      const references = [new WeakRef(scene), new WeakRef(geometry), new WeakRef(buffer.buffer)];
      const original = GLTFLoader.prototype.loadAsync;
      GLTFLoader.prototype.loadAsync = async () => ({ scene, animations: [], parser: { json: { extras: {} } } });
      try { await models['load']('smith'); }
      finally { GLTFLoader.prototype.loadAsync = original; }
      return { models, references };
    }
    const state = await prepare();
    for (let i = 0; i < 6; i++) { await new Promise(resolve => setImmediate(resolve)); global.gc(); }
    assert.ok(state.references.every(reference => reference.deref()), 'live factories keep reusable assets');
    state.models.dispose();
    for (let i = 0; i < 6; i++) { await new Promise(resolve => setImmediate(resolve)); global.gc(); }
    assert.ok(state.references.every(reference => !reference.deref()), 'a disposed factory must not retain source scenes or geometry buffers');
    state.models.dispose();
  `;
  const result = spawnSync(process.execPath, ['--expose-gc', '--import', 'tsx', '--input-type=module', '--eval', source],
    { encoding: 'utf8', timeout: 20000 });
  assert.equal(result.status, 0, result.stderr || String(result.error));
});

test('creating a hero after disposal does not request any assets', async t => {
  let requests = 0;
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async () => {
    requests++;
    return { scene: new THREE.Group(), animations: [], parser: { json: { extras: {} } } } as unknown as GLTF;
  });
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  models.dispose();
  assert.equal(await models.create('neo'), undefined);
  assert.equal(await models.create('trinity'), undefined);
  assert.equal(requests, 0, 'late callbacks must not reload disposed character assets');
});
