import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SCENE_BY_ID, filmEntry, newFreewayPickup, newGarageEscape, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { LightCulling } from '../packages/client/src/engine/LightCulling.js';
import { WorldOcclusionPass } from '../packages/client/src/engine/PostProcessing.js';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
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

for (const handoff of [true, false]) test(`the freeway prepares road and rider passes and ${handoff ? 'retains them across entry' : 'releases a cancelled entry'}`, t => {
  canvas(t);
  const scene = new THREE.Scene(), sets = new FilmSetRenderer(scene), camera = new THREE.PerspectiveCamera();
  const source = new THREE.Scene(), lighting = new LightCulling(source); lighting.enabled = false;
  for (let i = 0; i < 9; i++) source.add(new THREE.PointLight());
  const sun = new THREE.DirectionalLight(); sun.castShadow = true; scene.add(sun);
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const trinity = world.agents.get('trinity')!;
  Object.assign(trinity, { position: filmEntry(FILM_SCENE_BY_ID.m2_garage), currentLocation: 'film_chateau_garage', isInMatrix: true });
  const journey: FilmJourney = { version: 1, scene: 'm2_garage', actor: 'trinity', step: 2, completed: ['m2_garage'], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: { ...trinity.position }, garage: { ...newGarageEscape(), phase: 'arrived', z: -40 } };
  const sandbox = { neoLife: { journey } } as SandboxState; sets.update(trinity, sandbox, 0);
  const geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial(), actor = new THREE.Group();
  const skin = new THREE.SkinnedMesh(geometry, material); skin.castShadow = true; actor.add(skin); actor.visible = false;
  const compiled = new Set<THREE.Object3D>(), depths = new Set<THREE.MeshDepthMaterial>(), slots = new Set<number>();
  const graphics = { extensions: { has: () => true }, info: { programs: [] }, properties: { get: () => ({}) },
    getRenderTarget: () => null, setRenderTarget() {}, initTexture() {}, shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap },
    compile(subject: THREE.Object3D, _camera: THREE.Camera, target: THREE.Scene) {
      let points = 0; target.traverseVisible(light => { if (light instanceof THREE.PointLight) points++; });
      subject.traverse(object => { compiled.add(object); if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshDepthMaterial) { depths.add(object.material); slots.add(points); } });
    } } as unknown as THREE.WebGLRenderer;
  t.after(() => { sets.dispose(); lighting.dispose(); geometry.dispose(); material.dispose(); });
  const before = JSON.stringify(journey);
  for (let frame = 0; frame < 320; frame++) sets.prepareSecondOracle(graphics, camera, journey, id => id === 'trinity' ? actor : undefined,
    false, undefined, undefined, lighting, sun);
  assert.ok(depths.size, 'road and rider depth must prepare before leaving the garage');
  assert.ok(slots.has(9) && slots.size === 2, 'compile the preceding and destination shadow layouts');
  assert.ok(compiled.has(skin)); assert.ok(compiled.has(sets.goalMarker));
  const normals = sets.secondOracleEntryNormalMeshes;
  assert.ok(normals?.includes(skin)); assert.ok(normals.some(mesh => mesh instanceof THREE.InstancedMesh));
  assert.ok(normals.some(mesh => !(mesh instanceof THREE.InstancedMesh) && !(mesh instanceof THREE.SkinnedMesh)));
  assert.equal(actor.visible, false); assert.equal(skin.visible, true); assert.equal(skin.parent, actor);
  assert.equal(JSON.stringify(journey), before);
  let released = 0; depths.forEach(depth => depth.addEventListener('dispose', () => released++));
  if (handoff) {
    Object.assign(journey, { scene: 'm2_freeway', step: 0 });
    Object.assign(trinity, { position: filmEntry(FILM_SCENE_BY_ID.m2_freeway), currentLocation: 'film_freeway_101' });
    sets.update(trinity, sandbox, 1); assert.equal(released, 0, 'keep linked depth programs alive for the first draw');
    sets.update(undefined, undefined, 2);
  } else sets.prepareSecondOracle(graphics, camera, undefined, () => undefined);
  assert.equal(released, depths.size);
});

for (const sceneId of ['m2_freeway', 'm2_trucks'] as const) test(`${sceneId} renders its road occupants without drawing actors left in previous scenes`, t => {
  canvas(t);
  const renderer = new AgentRenderer(new THREE.Scene()), world = new WorldState(); new AgentManager(world).initializeAllAgents();
  t.after(() => renderer.dispose()); t.mock.method(renderer['models'], 'requestHero', () => {}); t.mock.method(renderer['models'], 'animate', () => {});
  const beat = FILM_SCENE_BY_ID[sceneId];
  for (const id of ['trinity', 'morpheus', 'keymaker', 'smith']) {
    const at = FILM_SCENE_BY_ID[id === 'smith' ? 'm2_bench' : sceneId], actor = world.agents.get(id)!;
    Object.assign(actor, { position: filmEntry(at), currentLocation: at.set, isInMatrix: true }); renderer.updateAgent(id, actor);
  }
  renderer.setPlayer(beat.actor);
  const journey: FilmJourney = { version: 1, scene: sceneId, actor: beat.actor, step: 0, completed: [], enteredAt: 0,
    checkpoint: filmEntry(beat), reflections: {}, lastText: '' };
  const before = JSON.stringify([...world.agents]); renderer.update(.02, undefined, 1, 0, journey);
  assert.equal(renderer.getAgent('smith')!.visible, false, 'the courtyard Smith cannot enter the freeway color or shadow passes');
  assert.ok(['trinity', 'morpheus', 'keymaker'].every(id => renderer.getAgent(id)?.visible));
  assert.equal(JSON.stringify([...world.agents]), before);
  renderer.update(.02); assert.equal(renderer.getAgent('smith')!.visible, true);
});

for (const sceneId of ['m2_garage', 'm2_freeway'] as const) test(`${sceneId} requests the pursuit driver before he enters the live road`, t => {
  canvas(t);
  const renderer = new AgentRenderer(new THREE.Scene()), world = new WorldState(); new AgentManager(world).initializeAllAgents();
  t.after(() => renderer.dispose());
  const jackson = world.agents.get('agent_jackson')!; renderer.updateAgent(jackson.id, jackson);
  const requested: THREE.Group[] = [];
  t.mock.method(renderer['models'], 'requestHero', rig => requested.push(rig.root));
  const scene = FILM_SCENE_BY_ID[sceneId], before = JSON.stringify(jackson);
  renderer.prepareStoryCast({ version: 1, scene: sceneId, actor: scene.actor, step: 0, completed: [], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: filmEntry(scene) });
  assert.ok(requested.includes(renderer.getAgentBody(jackson.id)!), 'Jackson cannot wait until the first chase frame to load his skin and maps');
  assert.equal(JSON.stringify(jackson), before, 'asset preparation cannot move the offstage actor into the chase');
});

for (const enter of [true, false]) test(`a cold freeway prepares the hidden pursuit driver and ${enter ? 'keeps his passes on entry' : 'releases cancelled passes'}`, t => {
  canvas(t);
  const scene = new THREE.Scene(), sets = new FilmSetRenderer(scene), camera = new THREE.PerspectiveCamera();
  const sun = new THREE.DirectionalLight(); sun.castShadow = true; scene.add(sun);
  const source = new LightCulling(scene); source.enabled = false;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const trinity = world.agents.get('trinity')!;
  Object.assign(trinity, { position: filmEntry(FILM_SCENE_BY_ID.m2_freeway), currentLocation: 'film_freeway_101', isInMatrix: true });
  const journey: FilmJourney = { version: 1, scene: 'm2_freeway', actor: trinity.id, step: 0, completed: [], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: { ...trinity.position }, freewayPickup: { ...newFreewayPickup(), phase: 'launching', elapsed: 1.158, total: 18.3 } };
  const geometry = new THREE.BoxGeometry(), map = new THREE.Texture({ width: 1024, height: 1, complete: true }); map.needsUpdate = true;
  const material = new THREE.MeshStandardMaterial({ map }), driver = new THREE.Group(), skin = new THREE.SkinnedMesh(geometry, material);
  skin.castShadow = true; driver.add(skin); driver.visible = false;
  const occlusion = new WorldOcclusionPass(scene, camera, 1280, 720);
  const compiled = new Set<THREE.Object3D>(), normals = new Set<THREE.Object3D>(), depths = new Set<THREE.MeshDepthMaterial>(), uploaded = new Set<THREE.Texture>();
  const graphics = { extensions: { has: () => true }, info: { programs: [] }, properties: { get: () => ({}) },
    getRenderTarget: () => null, setRenderTarget() {}, initTexture(texture: THREE.Texture) { uploaded.add(texture); },
    shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap },
    compile(subject: THREE.Object3D) { subject.traverse(object => {
      compiled.add(object); if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshDepthMaterial) depths.add(object.material);
      if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshNormalMaterial) normals.add(object);
    }); } } as unknown as THREE.WebGLRenderer;
  t.after(() => { sets.dispose(); source.dispose(); occlusion.dispose(); geometry.dispose(); material.dispose(); map.dispose(); });
  let delivered = false;
  const before = JSON.stringify(journey), prepare = () => {
    sets.prepareSecondOracle(graphics, camera, journey,
      id => delivered && id === 'agent_jackson' ? driver : undefined, true, undefined, undefined, source, sun);
    occlusion.prepareNormals(graphics, sets.root, sets.secondOracleEntryNormalMeshes, true);
  };
  prepare(); delivered = true;
  for (let frame = 0; frame < 180; frame++) prepare();
  assert.ok(compiled.has(skin), 'cold entry prepares Jackson before his first pursuit draw');
  assert.ok(depths.size, 'the first truck shadow must use a prepared depth program');
  assert.ok(uploaded.has(map), 'the first pursuit draw cannot upload the large driver map');
  assert.ok(sets.secondOracleEntryNormalMeshes?.includes(skin));
  assert.ok(normals.has(skin), 'a driver arriving after the empty landing queue must reach the actual AO compiler');
  assert.equal(driver.visible, false); assert.equal(skin.parent, driver); assert.equal(skin.material, material);
  assert.equal(JSON.stringify(journey), before);
  let disposed = 0; depths.forEach(depth => depth.addEventListener('dispose', () => disposed++));
  if (enter) {
    sets.update(trinity, { neoLife: { journey } } as SandboxState, 0);
    assert.equal(disposed, 0, 'entering the live freeway must retain the prepared driver passes');
    assert.ok(sets.secondOracleEntryNormalMeshes?.includes(skin));
    sets.update(undefined, undefined, 1);
  } else sets.prepareSecondOracle(graphics, camera, undefined, () => undefined);
  assert.equal(disposed, depths.size, 'release every prepared depth material once on exit or cancellation');
});
