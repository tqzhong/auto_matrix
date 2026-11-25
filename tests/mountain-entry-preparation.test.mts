import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SCENE_BY_ID, filmEntry, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';

for (const handoff of [true, false]) test(`the mountain snow compiles before the door opens and ${handoff ? 'survives the handoff' : 'releases a cancelled preparation'}`, t => {
  const previous = globalThis.document;
  const context = { fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, fill() {}, ellipse() {},
    createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }),
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  t.after(() => { globalThis.document = previous; });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture({ width: 1, complete: true }));
  const scene = new THREE.Scene(), sets = new FilmSetRenderer(scene), camera = new THREE.PerspectiveCamera();
  t.after(() => sets.dispose());
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const neo = world.agents.get('neo')!;
  Object.assign(neo, { position: filmEntry(FILM_SCENE_BY_ID.m2_chateau), currentLocation: 'film_chateau_hall', isInMatrix: true });
  const journey: FilmJourney = { version: 1, scene: 'm2_chateau', actor: 'neo', step: 1, completed: [], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: { ...neo.position },
    chateau: { phase: 'cleared', wave: 2, parries: 4, disarms: 4, attempts: 2, wounded: true, weapon: 'sword' } };
  const sandbox = { neoLife: { journey } } as SandboxState; sets.update(neo, sandbox, 0);
  const snow = new Set<THREE.Points>();
  const graphics = { extensions: { has: () => true }, info: { programs: [] }, properties: { get: () => ({}) },
    getRenderTarget: () => null, setRenderTarget() {}, initTexture() {},
    compile(subject: THREE.Object3D) { subject.traverse(object => {
      if (object instanceof THREE.Points && object.name === 'mountain-wind-snow') snow.add(object);
    }); } } as unknown as THREE.WebGLRenderer;
  const before = JSON.stringify(journey);
  for (let frame = 0; frame < 160; frame++) sets.prepareSecondOracle(graphics, camera, journey, () => undefined);
  assert.equal(snow.size, 1, 'the first snow draw must not discover a new PointsMaterial program after the door cut');
  assert.equal(JSON.stringify(journey), before, 'preparation cannot change the saved fight or door timer');
  const particles = [...snow][0]; assert.equal(particles.geometry.getAttribute('position').count, 900);
  let geometryReleased = 0, materialReleased = 0;
  particles.geometry.addEventListener('dispose', () => geometryReleased++);
  const material = particles.material as THREE.PointsMaterial; material.addEventListener('dispose', () => materialReleased++);
  if (handoff) {
    journey.scene = 'm2_mountain'; journey.step = 0;
    Object.assign(neo, { position: filmEntry(FILM_SCENE_BY_ID.m2_mountain), currentLocation: 'film_mountain_range' });
    sets.update(neo, sandbox, 1);
    assert.equal(scene.getObjectByName('mountain-wind-snow'), particles, 'adopt the same prepared particles');
    assert.equal(geometryReleased, 0); assert.equal(materialReleased, 0);
    sets.update(undefined, undefined, 2);
  } else sets.prepareSecondOracle(graphics, camera, undefined, () => undefined);
  assert.equal(geometryReleased, 1); assert.equal(materialReleased, 1);
});
