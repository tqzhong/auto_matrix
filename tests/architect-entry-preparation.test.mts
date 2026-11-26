import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SCENE_BY_ID, filmEntry, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
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

for (const resume of [false, true]) test(`${resume ? 'cold' : 'live'} source corridor prepares the late Architect's plain morphed head normal program`, t => {
  canvas(t);
  const scene = new THREE.Scene(), film = new FilmSetRenderer(scene), camera = new THREE.PerspectiveCamera();
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const actor = world.agents.get('neo')!;
  Object.assign(actor, { position: filmEntry(FILM_SCENE_BY_ID.m2_key_door), currentLocation: 'film_source_corridor', isInMatrix: true });
  const journey: FilmJourney = { version: 1, scene: 'm2_key_door', actor: actor.id, step: 6, completed: ['m2_key_door'], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: { ...actor.position } };
  if (!resume) film.update(actor, { neoLife: { journey } } as SandboxState, 0);
  const geometry = new THREE.BoxGeometry(), headGeometry = geometry.clone(), material = new THREE.MeshStandardMaterial();
  headGeometry.setAttribute('uv1', headGeometry.getAttribute('uv').clone());
  headGeometry.setAttribute('_face_weight', new THREE.Float32BufferAttribute(new Float32Array(headGeometry.getAttribute('position').count), 1));
  headGeometry.morphAttributes.position = [headGeometry.getAttribute('position').clone()]; headGeometry.morphTargetsRelative = true;
  const neo = new THREE.Group(), architect = new THREE.Group(), headRoot = new THREE.Group(), bodyRoot = new THREE.Group();
  headRoot.name = 'architect-detailed-head'; bodyRoot.name = 'architect-detailed-body'; architect.visible = false;
  const head = new THREE.Mesh(headGeometry, material); head.name = 'architect-anatomical-head'; head.updateMorphTargets(); headRoot.add(head);
  bodyRoot.add(new THREE.SkinnedMesh(geometry, material)); architect.add(headRoot, bodyRoot); neo.add(new THREE.SkinnedMesh(geometry, material));
  const normals = new Set<THREE.Object3D>(), colors = new Set<THREE.Object3D>(), lights = new LightCulling(new THREE.Scene());
  const graphics = { extensions: { has: () => true }, info: { programs: [] }, properties: { get: () => ({}) }, shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap },
    getRenderTarget: () => null, setRenderTarget() {}, initTexture() {}, compile(subject: THREE.Object3D) {
      subject.traverse(object => { if (object instanceof THREE.Mesh) { if (object.material instanceof THREE.MeshNormalMaterial) normals.add(object); else colors.add(object); } });
    } } as unknown as THREE.WebGLRenderer;
  const occlusion = new WorldOcclusionPass(scene, camera, 1280, 720), saved = JSON.stringify(journey); let ready = false;
  t.after(() => { film.dispose(); occlusion.dispose(); lights.dispose(); geometry.dispose(); headGeometry.dispose(); material.dispose(); });
  const prepare = () => {
    film.prepareSecondOracle(graphics, camera, journey, id => id === 'neo' ? neo : ready && id === 'architect' ? architect : undefined, resume,
      undefined, undefined, lights, new THREE.DirectionalLight());
    occlusion.prepareNormals(graphics, film.root, film.secondOracleEntryNormalMeshes, true);
  };
  for (let frame = 0; frame < 150; frame++) prepare(); ready = true;
  for (let frame = 0; frame < 350; frame++) prepare();
  assert.ok(colors.has(head)); assert.ok(normals.has(head), 'the delivered head is a plain Mesh with one morph target, not a SkinnedMesh');
  assert.equal(architect.visible, false); assert.equal(head.visible, true); assert.equal(JSON.stringify(journey), saved);
});

test('the Architect room draws Neo and the Architect while Jones stays in his saved office', t => {
  canvas(t);
  const renderer = new AgentRenderer(new THREE.Scene()), world = new WorldState(); new AgentManager(world).initializeAllAgents();
  t.after(() => renderer.dispose()); t.mock.method(renderer['models'], 'requestHero', () => {}); t.mock.method(renderer['models'], 'animate', () => {});
  for (const [id, scene] of [['neo', 'm2_architect'], ['architect', 'm2_architect'], ['agent_jones', 'm1_smith_question']]) {
    const beat = FILM_SCENE_BY_ID[scene], actor = world.agents.get(id)!;
    Object.assign(actor, { position: filmEntry(beat), currentLocation: beat.set, isInMatrix: true }); renderer.updateAgent(id, actor);
  }
  renderer.setPlayer('neo'); const journey: FilmJourney = { version: 1, scene: 'm2_architect', actor: 'neo', step: 0, completed: [], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: filmEntry(FILM_SCENE_BY_ID.m2_architect) };
  const saved = JSON.stringify([...world.agents]); renderer.update(.02, undefined, 1, 0, journey);
  assert.equal(renderer.getAgent('agent_jones')!.visible, false);
  assert.equal(renderer.getAgent('neo')!.visible, true); assert.equal(renderer.getAgent('architect')!.visible, true);
  assert.equal(JSON.stringify([...world.agents]), saved);
  renderer.update(.02); assert.equal(renderer.getAgent('agent_jones')!.visible, true);
});
