import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SCENE_BY_ID, filmEntry, newGarageEscape, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { LightCulling } from '../packages/client/src/engine/LightCulling.js';
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
