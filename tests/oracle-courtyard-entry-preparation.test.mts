import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SCENE_BY_ID, filmEntry, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { HeroModels } from '../packages/client/src/agents/HeroModel.js';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { LightCulling } from '../packages/client/src/engine/LightCulling.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';

function canvas(t: test.TestContext) {
  const previous = globalThis.document;
  const context = { fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, fill() {}, ellipse() {},
    createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }),
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  t.after(() => { globalThis.document = previous; });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture({ width: 1, complete: true }));
}

function courtyard(t: test.TestContext) {
  canvas(t);
  const scene = new THREE.Scene(), sets = new FilmSetRenderer(scene), camera = new THREE.PerspectiveCamera();
  const source = new THREE.Scene(), lighting = new LightCulling(source); lighting.enabled = false;
  for (let i = 0; i < 11; i++) source.add(new THREE.PointLight());
  const sun = new THREE.DirectionalLight(); sun.castShadow = true; scene.add(sun);
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const neo = world.agents.get('neo')!;
  Object.assign(neo, { position: filmEntry(FILM_SCENE_BY_ID.m2_backdoors), currentLocation: 'film_backdoor_hall', isInMatrix: true });
  const journey: FilmJourney = { version: 1, scene: 'm2_backdoors', actor: 'neo', step: 1, completed: [], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: { ...neo.position } };
  const sandbox = { neoLife: { journey } } as SandboxState; sets.update(neo, sandbox, 0);
  const geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial();
  const player = new THREE.Group(), skin = new THREE.SkinnedMesh(geometry, material); skin.castShadow = true; player.add(skin);
  const oracle = new THREE.Group(), head = new THREE.Group(), body = new THREE.SkinnedMesh(geometry, material);
  head.name = 'oracle-first-detailed-head'; oracle.visible = false; body.castShadow = true;
  const faceGeometry = geometry.clone(); faceGeometry.morphAttributes.position = [geometry.attributes.position.clone()];
  const faceMaterial = new THREE.MeshStandardMaterial({ map: new THREE.Texture() }), face = new THREE.Mesh(faceGeometry, faceMaterial);
  face.castShadow = true; head.add(face); oracle.add(head, body);
  const shadowMaterial = new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false }), shadow = new THREE.Mesh(geometry, shadowMaterial);
  const marker = (sets as unknown as { marker: THREE.Mesh }).marker, sourceProgram = { id: 7 }, arrivalProgram = { id: 8 };
  const bindings = { currentProgram: sourceProgram, __version: 17 }, compiled = new Set<THREE.Object3D>(), depths = new Set<THREE.MeshDepthMaterial>(), slots = new Set<number>();
  const graphics = { extensions: { has: () => true }, info: { programs: [] }, getRenderTarget: () => null, setRenderTarget() {}, initTexture() {},
    properties: { get: (surface: THREE.Material) => surface === marker.material ? bindings : {} },
    shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap },
    compile(subject: THREE.Object3D, _camera: THREE.Camera, target: THREE.Scene) {
      let points = 0; target.traverseVisible(light => { if (light instanceof THREE.PointLight) points++; });
      subject.traverse(object => {
        compiled.add(object);
        if (object === marker) { bindings.currentProgram = arrivalProgram; bindings.__version = 18; }
        if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshDepthMaterial) { depths.add(object.material); slots.add(points); }
      });
    } } as unknown as THREE.WebGLRenderer;
  t.after(() => { sets.dispose(); lighting.dispose(); geometry.dispose(); material.dispose(); faceGeometry.dispose(); faceMaterial.map!.dispose(); faceMaterial.dispose(); shadowMaterial.dispose(); });
  const prepare = () => { for (let i = 0; i < 180; i++) sets.prepareSecondOracle(graphics, camera, journey, id => id === 'neo' ? player : oracle,
    false, undefined, () => ({ shadow }), lighting, sun); };
  return { sets, neo, sandbox, journey, skin, body, oracle, shadow, shadowMaterial, marker, bindings, sourceProgram, compiled, depths, slots, prepare };
}

test('the courtyard prepares source and arrival depth, real actor normals and the shared ground shadow', t => {
  const h = courtyard(t), before = JSON.stringify(h.journey); h.prepare();
  assert.ok(h.depths.size, 'the courtyard shadow passes must not wait for the first actual draw');
  assert.deepEqual([...h.slots].sort((a, b) => a - b), [1, 11]);
  assert.ok(h.compiled.has(h.shadow)); assert.ok([h.skin, h.body].every(mesh => h.sets.secondOracleEntryNormalMeshes?.includes(mesh)));
  assert.equal(h.oracle.visible, false); assert.equal(JSON.stringify(h.journey), before);
  let disposed = 0, sharedDisposed = 0; h.depths.forEach(material => material.addEventListener('dispose', () => disposed++));
  h.shadowMaterial.addEventListener('dispose', () => sharedDisposed++);
  Object.assign(h.journey, { scene: 'm2_bench', step: 0 });
  Object.assign(h.neo, { position: filmEntry(FILM_SCENE_BY_ID.m2_bench), currentLocation: 'film_oracle_courtyard' });
  h.sets.update(h.neo, h.sandbox, 1); assert.equal(disposed, 0);
  h.sets.update(undefined, undefined, 2); assert.equal(disposed, h.depths.size); assert.equal(sharedDisposed, 0);
});

test('preparing the courtyard leaves the live hall objective bound to its current program', t => {
  const h = courtyard(t); h.prepare(); assert.ok(h.compiled.has(h.marker));
  assert.equal(h.bindings.currentProgram, h.sourceProgram, 'linking the next layout must retain the live Basic marker binding');
  assert.equal(h.bindings.__version, 17);
});

for (const [sceneId, local] of [['m2_backdoors', 'seraph'], ['m2_bench', 'oracle'], ['m2_burly', 'smith']] as const)
  test(`${sceneId} renders its real occupants while leaving the old hotel agents offstage`, t => {
    canvas(t); t.mock.method(HeroModels.prototype, 'create', async () => undefined); t.mock.method(CharacterModels.prototype, 'animate', () => {});
    const renderer = new AgentRenderer(new THREE.Scene()), world = new WorldState(); t.after(() => renderer.dispose());
    new AgentManager(world).initializeAllAgents(); const beat = FILM_SCENE_BY_ID[sceneId];
    for (const id of ['neo', local, 'agent_jones']) {
      const at = id === 'agent_jones' ? FILM_SCENE_BY_ID.m1_room303 : beat, state = world.agents.get(id)!;
      Object.assign(state, { position: filmEntry(at), currentLocation: at.set, isInMatrix: true }); renderer.updateAgent(id, state);
    }
    const before = JSON.stringify([...world.agents]); renderer.setPlayer('neo');
    const journey: FilmJourney = { version: 1, scene: sceneId, actor: 'neo', step: 0, completed: [], enteredAt: 0,
      checkpoint: filmEntry(beat), reflections: {}, lastText: '' };
    renderer.update(.02, undefined, 1, 0, journey);
    assert.equal(renderer.getAgent('neo')!.visible, true); assert.equal(renderer.getAgent(local)!.visible, true);
    assert.equal(renderer.getAgent('agent_jones')!.visible, false);
    assert.equal(JSON.stringify([...world.agents]), before, 'visibility must not rewrite saved positions, wounds or identity');
    renderer.update(.02); assert.equal(renderer.getAgent('agent_jones')!.visible, true);
  });
