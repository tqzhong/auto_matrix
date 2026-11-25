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

for (const resume of [false, true]) test(`${resume ? 'restoring the flight' : 'the courtyard exit'} prepares Le Vrai passes without changing the saved encounter`, t => {
  canvas(t);
  const scene = new THREE.Scene(), sets = new FilmSetRenderer(scene), camera = new THREE.PerspectiveCamera();
  const source = new THREE.Scene(), lighting = new LightCulling(source); lighting.enabled = false;
  for (let i = 0; i < 11; i++) source.add(new THREE.PointLight());
  const sun = new THREE.DirectionalLight(); sun.castShadow = true; scene.add(sun);
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const neo = world.agents.get('neo')!;
  Object.assign(neo, { position: filmEntry(FILM_SCENE_BY_ID.m2_burly), currentLocation: 'film_oracle_courtyard', isInMatrix: true });
  const journey: FilmJourney = { version: 1, scene: 'm2_burly', actor: 'neo', step: 1, completed: [], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: { ...neo.position },
    burly: { phase: 'flight', elapsed: 1.009, attempt: 4, repelled: 10, staffSwings: 3, assimilation: 0, nextCopyAt: 50, flightFrom: { ...neo.position } } };
  const sandbox = { neoLife: { journey } } as SandboxState; if (!resume) sets.update(neo, sandbox, 0);
  const geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial(), player = new THREE.Group();
  const skin = new THREE.SkinnedMesh(geometry, material); skin.castShadow = true; player.add(skin);
  const guest = new THREE.Group(), body = new THREE.SkinnedMesh(geometry, material); body.castShadow = true; guest.visible = false; guest.add(body);
  const shadowMaterial = new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false }), shadow = new THREE.Mesh(geometry, shadowMaterial);
  const compiled = new Set<THREE.Object3D>(), depths = new Set<THREE.MeshDepthMaterial>(), slots = new Set<number>();
  const graphics = { extensions: { has: () => true }, info: { programs: [] }, properties: { get: () => ({}) },
    getRenderTarget: () => null, setRenderTarget() {}, initTexture() {}, shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap },
    compile(subject: THREE.Object3D, _camera: THREE.Camera, target: THREE.Scene) {
      let points = 0; target.traverseVisible(light => { if (light instanceof THREE.PointLight) points++; });
      subject.traverse(object => { compiled.add(object); if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshDepthMaterial) { depths.add(object.material); slots.add(points); } });
    } } as unknown as THREE.WebGLRenderer;
  t.after(() => { sets.dispose(); lighting.dispose(); geometry.dispose(); material.dispose(); shadowMaterial.dispose(); });
  const before = JSON.stringify(journey);
  for (let frame = 0; frame < 180; frame++) sets.prepareSecondOracle(graphics, camera, journey, id => id === 'neo' ? player : guest,
    resume, undefined, () => ({ shadow }), lighting, sun);
  assert.ok(depths.size, 'the restaurant shadow passes must prepare before the flight cuts to the table');
  assert.equal(slots.has(11), !resume, 'the live exit retains source depth; a landing restore has no source room yet');
  assert.equal(slots.size, resume ? 1 : 2, 'the destination depth prepares in both paths');
  assert.ok(compiled.has(shadow)); assert.ok([skin, body].every(mesh => sets.secondOracleEntryNormalMeshes?.includes(mesh)));
  assert.equal(guest.visible, false); assert.equal(JSON.stringify(journey), before);
  let released = 0, sharedReleased = 0; depths.forEach(depth => depth.addEventListener('dispose', () => released++));
  shadowMaterial.addEventListener('dispose', () => sharedReleased++);
  Object.assign(journey, { scene: 'm2_merovingian', step: 0 });
  Object.assign(neo, { position: filmEntry(FILM_SCENE_BY_ID.m2_merovingian), currentLocation: 'film_le_vrai' });
  sets.update(neo, sandbox, 1); assert.equal(released, 0);
  sets.update(undefined, undefined, 2); assert.equal(released, depths.size); assert.equal(sharedReleased, 0);
});

for (const sceneId of ['m2_merovingian', 'm2_persephone'] as const)
  test(`${sceneId} draws the restaurant occupants while retaining distant actors in their saved rooms`, t => {
    canvas(t); t.mock.method(HeroModels.prototype, 'create', async () => undefined); t.mock.method(CharacterModels.prototype, 'animate', () => {});
    const renderer = new AgentRenderer(new THREE.Scene()), world = new WorldState(); t.after(() => renderer.dispose());
    new AgentManager(world).initializeAllAgents(); const beat = FILM_SCENE_BY_ID[sceneId];
    for (const id of ['neo', 'merovingian', 'mouse']) {
      const at = id === 'mouse' ? FILM_SCENE_BY_ID.m1_dejavu : beat, state = world.agents.get(id)!;
      Object.assign(state, { position: filmEntry(at), currentLocation: at.set, isInMatrix: true }); renderer.updateAgent(id, state);
    }
    const before = JSON.stringify([...world.agents]); renderer.setPlayer('neo');
    const journey: FilmJourney = { version: 1, scene: sceneId, actor: 'neo', step: 0, completed: [], enteredAt: 0,
      checkpoint: filmEntry(beat), reflections: {}, lastText: '' };
    renderer.update(.02, undefined, 1, 0, journey);
    assert.equal(renderer.getAgent('neo')!.visible, true); assert.equal(renderer.getAgent('merovingian')!.visible, true);
    assert.equal(renderer.getAgent('mouse')!.visible, false);
    assert.equal(JSON.stringify([...world.agents]), before);
    renderer.update(.02); assert.equal(renderer.getAgent('mouse')!.visible, true);
  });
