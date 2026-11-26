import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SCENE_BY_ID, filmEntry, newZionDeployment, newMaggieDiscovery, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { LightCulling } from '../packages/client/src/engine/LightCulling.js';
import { WorldOcclusionPass } from '../packages/client/src/engine/PostProcessing.js';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';

function canvas(t: TestContext, assets = new Map()) {
  const previous = globalThis.document;
  const context = { fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, fill() {}, ellipse() {},
    createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }),
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  t.after(() => { globalThis.document = previous; });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture({ width: 1, complete: true }));
  t.mock.method(GLTFLoader.prototype, 'loadAsync', (url: string) => assets.has(url.split('/').at(-1)!) ? Promise.resolve(assets.get(url.split('/').at(-1)!)) : new Promise(() => {}));
}

async function geometry(id: string) {
  const glb = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
  const length = glb.readUInt32LE(12), doc = JSON.parse(glb.subarray(20, 20 + length).toString());
  for (const material of doc.materials) { delete material.pbrMetallicRoughness?.baseColorTexture; delete material.normalTexture; }
  doc.images = []; doc.textures = [];
  const json = Buffer.from(JSON.stringify(doc)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = glb.subarray(20 + length), result = Buffer.alloc(20 + padded.length + bin.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); bin.copy(result, 20 + padded.length);
  return new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
}

test('Colt and Link actually load their delivered discovery heads and bodies while the council is still offstage', async t => {
  const assets = new Map(await Promise.all(['colt-head', 'colt-body', 'link-head', 'link-body'].map(async id => [`${id}.glb`, await geometry(id)] as const)));
  canvas(t, assets);
  const renderer = new AgentRenderer(new THREE.Scene()), world = new WorldState(); new AgentManager(world).initializeAllAgents(); t.after(() => renderer.dispose());
  const source = FILM_SCENE_BY_ID.m3_zion_prepare, next = FILM_SCENE_BY_ID.m3_maggie_discovery;
  Object.assign(world.agents.get('lock')!, { position: filmEntry(source), currentLocation: source.set, isInMatrix: false });
  for (const id of ['colt', 'link']) Object.assign(world.agents.get(id)!, { position: filmEntry(next), currentLocation: next.set, isInMatrix: false });
  for (const [id, actor] of world.agents) renderer.updateAgent(id, actor);
  renderer.setWorld(false); renderer.setPlayer('lock'); const camera = new THREE.PerspectiveCamera(); camera.position.copy(world.agents.get('lock')!.position);
  const journey: FilmJourney = { version: 1, scene: source.id, actor: source.actor, step: 3, completed: [], enteredAt: 0, reflections: {}, lastText: '', checkpoint: filmEntry(source), zionDeployment: newZionDeployment(3, 100) };
  const saved = JSON.stringify([...world.agents]);
  for (let frame = 0; frame < 4; frame++) { renderer.update(0, camera, 0, 0, journey); await new Promise(resolve => setImmediate(resolve)); }
  for (const id of ['colt', 'link']) {
    const detail = renderer.getAgentDetail(id)!;
    assert.ok(detail.getObjectByName(`${id}-anatomical-head`), `${id}: the real head must load before entry`);
    assert.ok(detail.getObjectByName(`${id}-detailed-body`), `${id}: the real body must load before entry`);
    assert.equal(detail.visible, false); assert.equal(renderer.getAgent(id)!.visible, false);
  }
  assert.equal(JSON.stringify([...world.agents]), saved);
});


for (const resume of [false, true]) test(`${resume ? 'saved' : 'live'} Zion deployment prepares the actual infirmary, late bodies and ship clothes before Roland takes over`, t => {
  canvas(t);
  const scene = new THREE.Scene(), sets = new FilmSetRenderer(scene), camera = new THREE.PerspectiveCamera();
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const source = FILM_SCENE_BY_ID.m3_zion_prepare, next = FILM_SCENE_BY_ID.m3_maggie_discovery, lock = world.agents.get('lock')!;
  Object.assign(lock, { position: filmEntry(source), currentLocation: source.set, isInMatrix: false });
  const journey: FilmJourney = { version: 1, scene: source.id, actor: source.actor, step: 2, completed: [], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: { ...lock.position }, zionDeployment: newZionDeployment(2, 100) };
  const sandbox = { neoLife: { journey } } as SandboxState;
  if (!resume) sets.update(lock, sandbox, 0);
  const geometry = new THREE.BoxGeometry(), faceGeometry = geometry.clone(), material = new THREE.MeshStandardMaterial();
  faceGeometry.morphAttributes.position = [faceGeometry.attributes.position.clone()]; faceGeometry.morphTargetsRelative = true;
  const cast = new Map<string, THREE.Group>(), heads: THREE.Mesh[] = [], arriving: { group: THREE.Group; head: THREE.Group; body: THREE.Group; fallback: THREE.Mesh }[] = [];
  for (const id of [next.actor, ...next.cast]) {
    const group = new THREE.Group(), head = new THREE.Mesh(faceGeometry, material), body = new THREE.SkinnedMesh(geometry, material);
    head.name = `${id}-anatomical-head`; head.castShadow = body.castShadow = true; head.updateMorphTargets(); group.visible = false;
    if (['roland', 'maggie', 'colt', 'link'].includes(id)) {
      const headRoot = new THREE.Group(), bodyRoot = new THREE.Group(), fallback = new THREE.Mesh(geometry, material);
      headRoot.name = `${id}-detailed-head`; bodyRoot.name = `${id}-detailed-body`; headRoot.add(head); bodyRoot.add(body); group.add(fallback);
      arriving.push({ group, head: headRoot, body: bodyRoot, fallback });
    } else group.add(head, body);
    cast.set(id, group); heads.push(head);
  }
  const garment = new THREE.SkinnedMesh(faceGeometry, material); garment.name = 'morpheus-ship-garment-proxy'; garment.castShadow = true;
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));
  const colors = new Set<THREE.Object3D>(), normals = new Set<THREE.Object3D>(), depths = new Set<THREE.BufferGeometry>(), layouts = new Set<number>();
  const graphics = { extensions: { has: () => true }, info: { programs: [] }, properties: { get: () => ({}) },
    shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap }, getRenderTarget: () => null, setRenderTarget() {}, initTexture() {},
    compile(subject: THREE.Object3D, _camera: THREE.Camera, target: THREE.Scene) {
      let points = 0; target.traverseVisible(object => { if (object instanceof THREE.PointLight) points++; });
      subject.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        if (object.material instanceof THREE.MeshNormalMaterial) normals.add(object);
        else if (object.material instanceof THREE.MeshDepthMaterial) depths.add(object.geometry);
        else { colors.add(object); layouts.add(points); }
      });
    } } as unknown as THREE.WebGLRenderer;
  const lighting = new LightCulling(scene), occlusion = new WorldOcclusionPass(scene, camera, 1280, 720);
  let heroReady = false;
  const prepare = () => {
    sets.prepareSecondOracle(graphics, camera, journey, id => id === 'morpheus' && !heroReady ? undefined : cast.get(id), resume, undefined,
      id => ({ model: cast.get(id), shadow: id === next.actor ? shadow : undefined, garments: () => id === 'morpheus' ? [garment] : [] }), lighting);
    occlusion.prepareNormals(graphics, sets.root, sets.secondOracleEntryNormalMeshes, true);
  };
  t.after(() => { sets.dispose(); lighting.dispose(); occlusion.dispose(); geometry.dispose(); faceGeometry.dispose(); material.dispose(); shadow.geometry.dispose(); shadow.material.dispose(); });
  prepare(); assert.equal(sets['preparedSecondOracle'], undefined, 'early allocation cannot load the next scene');
  journey.step = 3; const saved = JSON.stringify(journey);
  for (let frame = 0; frame < 100; frame++) prepare();
  assert.ok(sets['preparedSecondOracle']);
  for (const { group } of arriving) assert.equal(sets['preparedSecondOracle']!.colors?.actors.has(group), false, 'fallbacks cannot mark late heads and bodies ready');
  assert.equal(sets['preparedSecondOracle']!.colors?.actors.has(cast.get('morpheus')!), false, 'wait for the actual core hero');
  for (const { group, head, body, fallback } of arriving) { fallback.visible = false; group.add(head, body); }
  heroReady = true;
  for (let frame = 0; frame < 400; frame++) prepare();
  const room = sets['preparedSecondOracle']!.room, infirmary = room.root.getObjectByName('hammer-discovery-infirmary')!;
  assert.ok(infirmary && colors.has(infirmary.getObjectByName('discovery-floor')!));
  assert.ok(colors.has(infirmary.getObjectByName('discovery-intercom-signal')!), 'prepare the actual basic-material intercom');
  assert.ok(heads.every(head => colors.has(head) && normals.has(head)), 'all arriving morphed heads need color and AO');
  assert.ok(colors.has(shadow), 'prepare the shared ground-shadow variant');
  assert.ok(colors.has(garment) && normals.has(garment) && depths.has(garment.geometry), 'prepare actual ship clothes in all passes');
  assert.ok(depths.has(faceGeometry)); assert.ok([...cast.values()].every(group => !group.visible)); assert.equal(JSON.stringify(journey), saved);
  Object.assign(journey, { scene: next.id, actor: next.actor, step: 0, maggieDiscovery: newMaggieDiscovery(0, 100) });
  const roland = world.agents.get('roland')!; Object.assign(roland, { position: filmEntry(next), currentLocation: next.set, isInMatrix: false });
  sets.update(roland, sandbox, 1);
  assert.equal(sets.root.getObjectByName(infirmary.name), infirmary, 'adopt the actual prepared infirmary');
  assert.equal(sets.root.getObjectsByProperty('name', infirmary.name).length, 1); assert.equal(sets.stablePointSlots, true);
  let points = 0; scene.traverseVisible(object => { if (object instanceof THREE.PointLight) points++; }); assert.ok(points > 0 && layouts.has(points));
});

test('the council loads the four distant detailed medical crew and Morpheus without changing the live cast or world', t => {
  canvas(t); const renderer = new AgentRenderer(new THREE.Scene()), world = new WorldState(); new AgentManager(world).initializeAllAgents(); t.after(() => renderer.dispose());
  const source = FILM_SCENE_BY_ID.m3_zion_prepare, next = FILM_SCENE_BY_ID.m3_maggie_discovery;
  Object.assign(world.agents.get('lock')!, { position: filmEntry(source), currentLocation: source.set, isInMatrix: false });
  for (const id of [next.actor, ...next.cast]) Object.assign(world.agents.get(id)!, { position: filmEntry(next), currentLocation: next.set, isInMatrix: false });
  for (const [id, actor] of world.agents) renderer.updateAgent(id, actor);
  const heroes = new Set(); t.mock.method(renderer['models'], 'requestHero', rig => { heroes.add(rig); });
  renderer.setWorld(false); renderer.setPlayer('lock'); const camera = new THREE.PerspectiveCamera(); camera.position.copy(world.agents.get('lock')!.position);
  const requested = new Map<string, { prepare?: boolean; distance: number }>();
  t.mock.method(renderer['models'], 'animate', (rig, _delta, input, distance) => { const id = [...renderer['agents']].find(([, entry]) => entry.rig === rig)![0]; requested.set(id, { prepare: input.prepareDetailedCast, distance }); });
  const journey: FilmJourney = { version: 1, scene: source.id, actor: source.actor, step: 2, completed: [], enteredAt: 0, reflections: {}, lastText: '', checkpoint: filmEntry(source), zionDeployment: newZionDeployment(2, 100) };
  const saved = JSON.stringify([...world.agents]), morpheus = renderer['agents'].get('morpheus')!.rig;
  renderer.update(.02, camera, 1, 0, journey); assert.equal(heroes.has(morpheus), false);
  for (const id of ['roland', 'maggie', 'colt', 'link']) assert.ok(!requested.get(id)?.prepare);
  journey.step = 3; renderer.update(.02, camera, 1, 0, journey); assert.equal(heroes.has(morpheus), true);
  for (const id of ['roland', 'maggie', 'colt', 'link']) { assert.equal(requested.get(id)?.prepare, true, id); assert.ok(requested.get(id)!.distance > 100); assert.equal(renderer.getAgent(id)!.visible, false); }
  heroes.clear(); journey.visiting = source.id; renderer.update(.02, camera, 1, 0, journey); assert.equal(heroes.has(morpheus), false);
  for (const id of ['roland', 'maggie', 'colt', 'link']) assert.ok(!requested.get(id)?.prepare);
  delete journey.visiting; renderer.setPlayer('neo'); heroes.clear(); renderer.update(.02, camera, 1, 0, journey); assert.equal(heroes.has(morpheus), false);
  for (const id of ['roland', 'maggie', 'colt', 'link']) assert.ok(!requested.get(id)?.prepare);
  assert.equal(JSON.stringify([...world.agents]), saved);
});
