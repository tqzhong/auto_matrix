import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SCENE_BY_ID, SOURCE_BRIEFING, filmEntry, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
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

for (const resume of [false, true]) test(`${resume ? 'cold landing' : 'the rescued truck'} prepares the apartment depth, late captain normals and contact shadow`, t => {
  canvas(t);
  const scene = new THREE.Scene(), sets = new FilmSetRenderer(scene), camera = new THREE.PerspectiveCamera();
  const sun = new THREE.DirectionalLight(); sun.castShadow = true; scene.add(sun);
  const source = new THREE.Scene(), lights = new LightCulling(source); lights.enabled = false;
  for (let i = 0; i < 2; i++) source.add(new THREE.PointLight());
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const morpheus = world.agents.get('morpheus')!, previous = FILM_SCENE_BY_ID.m2_trucks;
  Object.assign(morpheus, { position: filmEntry(previous), currentLocation: previous.set, isInMatrix: true });
  const journey: FilmJourney = { version: 1, scene: 'm2_trucks', actor: 'morpheus', step: 3, completed: ['m2_trucks'], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: { ...morpheus.position }, trucks: { phase: 'rescued', elapsed: 10, lastTick: 0, attempt: 9, rescueElapsed: 3 } };
  if (!resume) sets.update(morpheus, { neoLife: { journey } } as SandboxState, 0);
  const geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial(), cast = new Map<string, THREE.Group>();
  const skins: THREE.SkinnedMesh[] = [];
  for (const id of SOURCE_BRIEFING.cast) {
    const group = new THREE.Group(); group.visible = false;
    const skin = new THREE.SkinnedMesh(geometry, material); skin.name = id + '-future-skin'; skin.castShadow = true; skins.push(skin);
    if (id === 'keymaker') {
      for (const part of ['head', 'body']) { const detail = new THREE.Group(); detail.name = 'keymaker-detailed-' + part; group.add(detail); if (part === 'body') detail.add(skin); }
    } else group.add(skin);
    cast.set(id, group);
  }
  const late = cast.get('soren')!; cast.delete('soren');
  const shadowMaterial = new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false }), shadow = new THREE.Mesh(geometry, shadowMaterial);
  const compiled = new Set<THREE.Object3D>(), depths = new Set<THREE.MeshDepthMaterial>(), normals = new Set<THREE.Object3D>(), slots = new Set<number>();
  const graphics = { extensions: { has: () => true }, info: { programs: [] }, properties: { get: () => ({}) },
    shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap }, getRenderTarget: () => null, setRenderTarget() {}, initTexture() {},
    compile(subject: THREE.Object3D, _camera: THREE.Camera, target?: THREE.Scene) {
      let points = 0; target?.traverseVisible(object => { if (object instanceof THREE.PointLight) points++; });
      subject.traverse(object => {
        compiled.add(object);
        if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshDepthMaterial) { depths.add(object.material); slots.add(points); }
        if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshNormalMaterial) normals.add(object);
      });
    } } as unknown as THREE.WebGLRenderer;
  const occlusion = new WorldOcclusionPass(scene, camera, 1280, 720);
  t.after(() => { sets.dispose(); lights.dispose(); occlusion.dispose(); geometry.dispose(); material.dispose(); shadowMaterial.dispose(); });
  const saved = JSON.stringify(journey), prepare = () => {
    sets.prepareSecondOracle(graphics, camera, journey, id => cast.get(id), resume, undefined, id => id === 'neo' ? { shadow } : {}, lights, sun);
    occlusion.prepareNormals(graphics, sets.root, sets.secondOracleEntryNormalMeshes, true);
  };
  for (let frame = 0; frame < 100; frame++) prepare();
  cast.set('soren', late);
  for (let frame = 0; frame < 180; frame++) prepare();
  assert.ok(depths.size, 'the apartment and actors need linked depth passes before Neo enters');
  assert.ok(slots.has(7), 'the destination includes six apartment lights and the objective');
  if (!resume) assert.ok(slots.has(2), 'the live handoff also prepares the preceding truck layout');
  assert.ok(compiled.has(shadow), 'the contact shadow Basic variant differs from the objective');
  assert.ok(skins.every(skin => sets.secondOracleEntryNormalMeshes?.includes(skin) && normals.has(skin)), 'all arriving skins, including late Soren, reach the real AO normal compiler');
  assert.ok([...cast.values()].every(group => !group.visible)); assert.equal(JSON.stringify(journey), saved);
  let released = 0; for (const depth of depths) depth.addEventListener('dispose', () => released++);
  sets.prepareSecondOracle(graphics, camera, undefined, () => undefined);
  assert.equal(released, depths.size, 'cancelling the entry releases its reserved depth materials');
});

test('the source meeting draws its occupants and keeps Smith and Rama in their saved rooms', t => {
  canvas(t);
  const renderer = new AgentRenderer(new THREE.Scene()), world = new WorldState(); new AgentManager(world).initializeAllAgents();
  t.after(() => renderer.dispose()); t.mock.method(renderer['models'], 'requestHero', () => {}); t.mock.method(renderer['models'], 'animate', () => {});
  const beat = FILM_SCENE_BY_ID.m2_plan;
  for (const id of [...SOURCE_BRIEFING.cast, 'smith', 'rama_kandra']) {
    const at = FILM_SCENE_BY_ID[id === 'smith' ? 'm2_bench' : id === 'rama_kandra' ? 'm3_mobil' : 'm2_plan'], actor = world.agents.get(id)!;
    Object.assign(actor, { position: filmEntry(at), currentLocation: at.set, isInMatrix: true }); renderer.updateAgent(id, actor);
  }
  renderer.setPlayer('neo');
  const journey: FilmJourney = { version: 1, scene: 'm2_plan', actor: 'neo', step: 0, completed: [], enteredAt: 0,
    checkpoint: filmEntry(beat), reflections: {}, lastText: '' };
  const saved = JSON.stringify([...world.agents]); renderer.update(.02, undefined, 1, 0, journey);
  for (const id of ['smith', 'rama_kandra']) assert.equal(renderer.getAgent(id)!.visible, false, `${id} cannot enter the apartment color or shadow passes`);
  assert.ok(SOURCE_BRIEFING.cast.every(id => renderer.getAgent(id)?.visible));
  assert.equal(JSON.stringify([...world.agents]), saved);
  renderer.update(.02); assert.equal(renderer.getAgent('smith')!.visible, true); assert.equal(renderer.getAgent('rama_kandra')!.visible, true);
});
