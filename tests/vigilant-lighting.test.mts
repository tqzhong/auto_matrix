import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SCENE_BY_ID, FILM_SETS, filmEntry, filmPosition, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { LightCulling } from '../packages/client/src/engine/LightCulling.js';
import { WorldOcclusionPass } from '../packages/client/src/engine/PostProcessing.js';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';

function canvas(t: TestContext) {
  const previous = globalThis.document;
  const context = { fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, fill() {}, ellipse() {},
    createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }),
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  t.after(() => { globalThis.document = previous; });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture({ width: 1, complete: true }));
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
}

test('Vigilant and relay keep the operator lamp and objective slots through checks, turning and connection', t => {
  canvas(t);
  const scene = new THREE.Scene(), film = new FilmSetRenderer(scene), culling = new LightCulling(scene);
  t.after(() => { film.dispose(); culling.dispose(); });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const actor = world.agents.get('trinity')!, center = FILM_SETS.film_neb_deck.center;
  Object.assign(actor, { position: filmPosition('film_neb_deck', 6.4, 12), currentLocation: 'film_neb_deck', isInMatrix: false });
  const journey: FilmJourney = { version: 1, scene: 'm2_vigilant', actor: actor.id, step: 0, completed: [], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: { ...actor.position } };
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000), gpu = {} as THREE.WebGLRenderer;
  camera.position.set(center.x, center.y + 6, center.z + 27); camera.lookAt(center.x + 6.4, center.y + 2, center.z + 12);
  const select = (minimum: number) => {
    culling.minimumPointSlots = minimum; culling.stablePointSlots = film.stablePointSlots;
    scene.updateMatrixWorld(); camera.updateMatrixWorld(); scene.onBeforeRender(gpu, scene, camera, null);
    const intensities: number[] = []; scene.traverseVisible(o => { if (o instanceof THREE.PointLight) intensities.push(o.intensity); });
    scene.onAfterRender(gpu, scene, camera); return { count: intensities.length, energy: intensities.reduce((sum, n) => sum + n, 0) };
  };
  const counts: number[] = [], sample = () => {
    const saved = JSON.stringify(journey); film.update(actor, { neoLife: { journey } } as SandboxState, 0, actor.position);
    const actual = select(film.minimumPointSlots), legacy = select(0); counts.push(actual.count);
    assert.equal(actual.energy, legacy.energy, 'padding must not change the ship illumination'); assert.equal(JSON.stringify(journey), saved);
  };
  sample(); journey.started = 1; sample(); camera.rotateY(Math.PI); sample(); camera.rotateY(Math.PI);
  delete journey.started; journey.step = 1; sample(); journey.step = 2; journey.completed.push('m2_vigilant'); sample();
  journey.scene = 'm2_relay'; journey.step = 0;
  for (const phase of ['review', 'hearing', 'decision', 'walking', 'connecting', 'connected'] as const) {
    journey.trinityRelay = { phase, elapsed: phase === 'connecting' ? 6 : 0 }; sample();
  }
  assert.ok(counts.every(n => n === 17), `operator checks must retain seventeen slots: ${counts}`);
  film.update(undefined, undefined, 0); assert.equal(film.minimumPointSlots, 0);
});

for (const id of ['m2_vigilant', 'm2_relay'] as const) test(`${id} draws Trinity and Link without first-film crew or off-ship actors`, t => {
  canvas(t);
  const renderer = new AgentRenderer(new THREE.Scene()), world = new WorldState(); new AgentManager(world).initializeAllAgents();
  t.after(() => renderer.dispose()); t.mock.method(renderer['models'], 'requestHero', () => {}); t.mock.method(renderer['models'], 'animate', () => {});
  for (const role of ['trinity', 'link', 'tank', 'cypher', 'dozer', 'zee']) {
    const actor = world.agents.get(role)!, beat = FILM_SCENE_BY_ID[role === 'zee' ? 'm2_departure' : id];
    Object.assign(actor, { position: filmEntry(beat), currentLocation: beat.set, isInMatrix: false });
    if (role === 'cypher' || role === 'dozer') { actor.status = 'dead'; actor.health = 0; }
    if (role === 'tank') actor.health = 40;
    renderer.updateAgent(role, actor);
  }
  renderer.setWorld(false); renderer.setPlayer('trinity');
  const journey: FilmJourney = { version: 1, scene: id, actor: 'trinity', step: 0, completed: [], enteredAt: 0,
    checkpoint: filmEntry(FILM_SCENE_BY_ID[id]), reflections: {}, lastText: '' };
  const saved = JSON.stringify([...world.agents]); renderer.update(.02, undefined, 1, 0, journey);
  for (const role of ['tank', 'cypher', 'dozer', 'zee']) assert.equal(renderer.getAgent(role)!.visible, false, `${role} cannot enter this ship shot`);
  assert.equal(renderer.getAgent('trinity')!.visible, true); assert.equal(renderer.getAgent('link')!.visible, true);
  assert.equal(JSON.stringify([...world.agents]), saved, 'drawing this shot must not rewrite saved fates or placement');
  renderer.update(.02); assert.equal(renderer.getAgent('tank')!.visible, true); assert.equal(renderer.getAgent('cypher')!.visible, true);
});

for (const source of ['m2_power', 'm2_blackout'] as const) for (const resume of [false, true])
test(`${source} ${resume ? 'cold' : 'live'} prepares the real operator deck, late Link and Trinity knit without moving the actors`, t => {
  canvas(t);
  const scene = new THREE.Scene(), film = new FilmSetRenderer(scene), camera = new THREE.PerspectiveCamera();
  const sun = new THREE.DirectionalLight(); sun.castShadow = true; scene.add(sun);
  const previous = new THREE.Scene(), lights = new LightCulling(previous); lights.enabled = false;
  for (let i = 0; i < 9; i++) previous.add(new THREE.PointLight());
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const actor = world.agents.get('niobe')!, beat = FILM_SCENE_BY_ID[source];
  Object.assign(actor, { position: filmEntry(beat), currentLocation: beat.set, isInMatrix: true });
  const journey: FilmJourney = { version: 1, scene: source, actor: actor.id, step: source === 'm2_power' ? 2 : 0, completed: [], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: { ...actor.position } };
  if (!resume) film.update(actor, { neoLife: { journey } } as SandboxState, 0);
  const geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial(), cast = new Map<string, THREE.Group>();
  const skins: THREE.SkinnedMesh[] = [];
  for (const id of ['trinity', 'link']) {
    const group = new THREE.Group(); group.visible = false;
    const mesh = new THREE.SkinnedMesh(geometry, material); mesh.name = id + '-operator-skin'; mesh.castShadow = true; skins.push(mesh); group.add(mesh); cast.set(id, group);
  }
  const knit = new THREE.Mesh(geometry, material.clone()); knit.name = 'trinity-logos-sweater';
  const shadow = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false }));
  const late = cast.get('link')!; cast.delete('link');
  const compiled = new Set<THREE.Object3D>(), depths = new Set<THREE.MeshDepthMaterial>(), slots = new Set<number>(), normals = new Set<THREE.Object3D>();
  const graphics = { extensions: { has: () => true }, info: { programs: [] }, properties: { get: () => ({}) }, shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap },
    getRenderTarget: () => null, setRenderTarget() {}, initTexture() {}, compile(subject: THREE.Object3D, _camera: THREE.Camera, target?: THREE.Scene) {
      let points = 0; target?.traverseVisible(o => { if (o instanceof THREE.PointLight) points++; });
      subject.traverse(o => { compiled.add(o); if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshDepthMaterial) { depths.add(o.material); slots.add(points); }
        if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshNormalMaterial) normals.add(o); });
    } } as unknown as THREE.WebGLRenderer;
  const occlusion = new WorldOcclusionPass(scene, camera, 1280, 720), saved = JSON.stringify(journey);
  t.after(() => { film.dispose(); lights.dispose(); occlusion.dispose(); geometry.dispose(); material.dispose(); shadow.material.dispose(); });
  const prepare = () => {
    film.prepareSecondOracle(graphics, camera, journey, id => cast.get(id), resume, undefined,
      id => id === 'trinity' ? { shadow, garments: () => [knit] } : {}, lights, sun);
    occlusion.prepareNormals(graphics, film.root, film.secondOracleEntryNormalMeshes, true);
  };
  for (let frame = 0; frame < 150; frame++) prepare(); cast.set('link', late);
  for (let frame = 0; frame < 300; frame++) prepare();
  assert.ok(compiled.has(knit), 'the hidden real-world knit must be ready before leaving the Matrix');
  assert.ok(compiled.has(shadow)); assert.ok(depths.size); assert.ok(slots.has(17), 'destination keeps the same seventeen-point layout');
  if (!resume) assert.ok(slots.has(9), 'the live route retains the current station depth layout');
  assert.ok(skins.every(mesh => normals.has(mesh)), 'late Link and Trinity must reach the real normal compiler');
  assert.ok([...cast.values()].every(group => !group.visible)); assert.equal(JSON.stringify(journey), saved);
  const room = film['preparedSecondOracle']!.room, deck = room['neb']; assert.ok(deck, 'prepare the actual NebDeckRenderer');
  let released = 0; for (const depth of depths) depth.addEventListener('dispose', () => released++);
  if (resume) {
    film.prepareSecondOracle(graphics, camera, undefined, () => undefined); assert.equal(released, depths.size);
  } else {
    const next = FILM_SCENE_BY_ID[source === 'm2_power' ? 'm2_vigilant' : 'm2_relay'], trinity = world.agents.get('trinity')!;
    Object.assign(trinity, { position: filmEntry(next), currentLocation: next.set, isInMatrix: false });
    film.update(trinity, { neoLife: { journey: { ...journey, scene: next.id, actor: trinity.id, step: 0 } } } as SandboxState, 0);
    assert.equal(film['neb'], deck, 'handoff must adopt the prepared deck rather than construct another');
    assert.equal(room['neb'], undefined, 'the old owner cannot dispose the adopted deck');
  }
});
