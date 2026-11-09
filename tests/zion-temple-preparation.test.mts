import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SCENE_BY_ID, filmEntry, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { ZionHomecomingRenderer } from '../packages/client/src/engine/ZionHomecomingRenderer.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';

async function loadAsset(sex: string) {
  const bytes = await readFile(new URL(`../packages/client/public/assets/characters/zion-crowd-${sex}.glb`, import.meta.url));
  const length = bytes.readUInt32LE(12), document = JSON.parse(bytes.subarray(20, 20 + length).toString());
  for (const material of document.materials) delete material.pbrMetallicRoughness.baseColorTexture;
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const binary = bytes.subarray(20 + length), buffer = Buffer.alloc(20 + padded.length + binary.length);
  buffer.writeUInt32LE(0x46546c67, 0); buffer.writeUInt32LE(2, 4); buffer.writeUInt32LE(buffer.length, 8);
  buffer.writeUInt32LE(padded.length, 12); buffer.writeUInt32LE(0x4e4f534a, 16); padded.copy(buffer, 20); binary.copy(buffer, 20 + padded.length);
  const asset = await new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '');
  const texture = new THREE.DataTexture(new Uint8Array(1024 * 4), 1024, 1); texture.needsUpdate = true;
  asset.scene.traverse(object => { if (object instanceof THREE.Mesh && object.material.name === 'Zion skin') object.material.map = texture; });
  return { asset, texture };
}

async function setup(t: test.TestContext) {
  const assets = await Promise.all(['male', 'female'].map(loadAsset)), pending: (() => void)[] = [];
  t.mock.method(GLTFLoader.prototype, 'loadAsync', (url: string) => new Promise(resolve => {
    pending.push(() => resolve(assets[url.includes('-female.') ? 1 : 0].asset));
  }));
  const scene = new THREE.Scene(), sets = new FilmSetRenderer(scene), camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000);
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!, morpheus = world.agents.get('morpheus')!;
  const journey: FilmJourney = { version: 1, scene: 'm2_residents', actor: 'neo', step: 2, completed: [], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: filmEntry(FILM_SCENE_BY_ID.m2_residents) };
  const sandbox = { neoLife: { journey } } as SandboxState;
  neo.position = filmEntry(FILM_SCENE_BY_ID.m2_residents); neo.currentLocation = 'film_zion_residences'; neo.isInMatrix = false;
  morpheus.position = filmEntry(FILM_SCENE_BY_ID.m2_temple); morpheus.currentLocation = 'film_zion_temple'; morpheus.isInMatrix = false;
  camera.position.copy(neo.position).add(new THREE.Vector3(0, 4, 10)); camera.lookAt(neo.position.x, neo.position.y + 2, neo.position.z - 10); camera.updateMatrixWorld(true);
  const compiled = new Map<THREE.Mesh, number>(), batches: number[] = [], uploaded: THREE.Texture[] = [];
  let preview: THREE.Scene | undefined, current: THREE.WebGLRenderTarget | null = null;
  const graphics = { extensions: { has: () => true }, info: { programs: [] }, properties: { get: () => ({}) },
    getRenderTarget: () => current, setRenderTarget: (value: THREE.WebGLRenderTarget | null) => { current = value; },
    initTexture: (texture: THREE.Texture) => uploaded.push(texture),
    compile(subject: THREE.Group, _camera: THREE.Camera, next: THREE.Scene) {
      preview = next; let count = 0;
      subject.traverse(object => { if (object instanceof THREE.Mesh) { compiled.set(object, (compiled.get(object) ?? 0) + 1); count++; } }); batches.push(count);
    } } as unknown as THREE.WebGLRenderer;
  const update = () => sets.update(journey.actor === 'neo' ? neo : morpheus, sandbox, 0, undefined, camera.position);
  const prepare = () => sets.prepareZionHomecoming(graphics, camera, journey, () => undefined);
  const target = () => (sets as unknown as { preparedZion?: { renderer: ZionHomecomingRenderer } }).preparedZion?.renderer;
  const finish = async () => { pending.splice(0).forEach(resolve => resolve()); await new Promise(resolve => setImmediate(resolve)); };
  update();
  t.after(async () => { sets.dispose(); await finish(); });
  return { scene, sets, journey, compiled, batches, uploaded, assets, update, prepare, target, finish,
    get preview() { return preview; } };
}

function audience(root: THREE.Object3D) {
  const meshes: THREE.InstancedMesh[] = [];
  root.traverse(object => { if (object instanceof THREE.InstancedMesh && object.name.startsWith('zion-crowd-')) meshes.push(object); });
  return meshes;
}

test('the last residential contact prepares the temple without advancing the story and adopts its exact set', async t => {
  const h = await setup(t); h.prepare(); assert.equal(h.target(), undefined, 'earlier resident requests cannot allocate the temple');
  h.journey.step = 3; h.update(); const before = JSON.stringify(h.journey); h.prepare();
  const target = h.target(), rostrum = target?.group.getObjectByName('zion-assembly-rostrum');
  assert.ok(target && rostrum, 'the final contact must prepare the temple before the scene switch');
  assert.equal(h.scene.getObjectByName(rostrum.name), undefined, 'preparation cannot replace the current residence');
  assert.equal(JSON.stringify(h.journey), before, 'preparation cannot advance story state');
  let disposed = 0; (rostrum as THREE.Mesh).geometry.addEventListener('dispose', () => disposed++);
  Object.assign(h.journey, { scene: 'm2_temple', actor: 'morpheus', step: 0 }); h.update();
  assert.ok(h.scene.getObjectByName(rostrum.name) === rostrum, 'arrival must reuse the actual prepared rostrum');
  assert.equal(disposed, 0); await h.finish();
  assert.equal(audience(h.scene).length, 12, 'a crowd finishing after adoption still belongs to the active temple');
});

test('late temple crowd bodies and textures enter bounded preparation even after the static queue has drained', async t => {
  const h = await setup(t); h.journey.step = 3; h.update();
  for (let frame = 0; frame < 100; frame++) h.prepare();
  const target = h.target(); assert.ok(target, 'residential contact must prepare the next temple');
  assert.equal(audience(target.group).length, 0); await h.finish();
  const meshes = audience(target.group); assert.equal(meshes.length, 12);
  for (let frame = 0; frame < 100; frame++) h.prepare();
  assert.ok(meshes.every(mesh => h.compiled.get(mesh) === 1), 'all twelve async crowd surfaces must compile once before arrival');
  assert.ok(h.assets.every(({ texture }) => h.uploaded.filter(value => value === texture).length === 1), 'late face textures must be prepared too');
  assert.ok(h.batches.every(count => count <= 4), 'crowd loading cannot expand the existing per-frame batch');
  assert.equal(audience(target.group).length, 12, 'compilation cannot remove any audience surfaces');
});

test('abandoning temple preparation releases late assets without queuing or reattaching disposed crowd bodies', async t => {
  const h = await setup(t); h.journey.step = 3; h.update(); h.prepare();
  const target = h.target(); assert.ok(target, 'the cancellation test requires an actual detached temple');
  const resources = new Set<THREE.BufferGeometry | THREE.Material | THREE.Texture>(), releases = new Map<object, number>();
  for (const { asset, texture } of h.assets) {
    resources.add(texture); asset.scene.traverse(object => { if (object instanceof THREE.Mesh) { resources.add(object.geometry); resources.add(object.material as THREE.Material); } });
  }
  for (const resource of resources) resource.addEventListener('dispose', () => releases.set(resource, (releases.get(resource) ?? 0) + 1));
  const batches = h.batches.length;
  h.sets.prepareZionHomecoming({} as THREE.WebGLRenderer, new THREE.Camera(), undefined, () => undefined);
  await h.finish();
  assert.equal(h.target(), undefined); assert.equal(audience(target.group).length, 0); assert.equal(h.batches.length, batches);
  assert.equal(releases.size, resources.size); assert.ok([...releases.values()].every(count => count === 1));
  assert.equal(h.scene.getObjectByName('zion-assembly-rostrum'), undefined); assert.equal(h.sets.active?.id, 'film_zion_residences');
});
