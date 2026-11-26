import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SCENE_BY_ID, filmEntry, type FilmJourney } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';

test('the evacuation draws its living crew while earlier casualties and Tank retain their saved state', t => {
  const previous = globalThis.document;
  const context = { fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, fill() {}, ellipse() {},
    createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }),
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  t.after(() => { globalThis.document = previous; });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture({ width: 1, complete: true }));
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  const renderer = new AgentRenderer(new THREE.Scene()), world = new WorldState(); new AgentManager(world).initializeAllAgents();
  t.after(() => renderer.dispose()); t.mock.method(renderer['models'], 'requestHero', () => {}); t.mock.method(renderer['models'], 'animate', () => {});
  const scene = FILM_SCENE_BY_ID.m2_ship_lost, crew = ['neo', ...scene.cast], previousCrew = ['cypher', 'dozer', 'tank'];
  for (const id of [...crew, ...previousCrew]) {
    const actor = world.agents.get(id)!;
    Object.assign(actor, { position: filmEntry(scene), currentLocation: scene.set, isInMatrix: false });
    if (id === 'cypher' || id === 'dozer') Object.assign(actor, { status: 'dead', health: 0 });
    if (id === 'tank') actor.health = 40;
    if (id === 'link') Object.assign(actor, { health: 80, controller: 'another-player' });
    renderer.updateAgent(id, actor);
  }
  renderer.setWorld(false); renderer.setPlayer('neo');
  const journey: FilmJourney = { version: 1, scene: scene.id, actor: 'neo', step: 0, completed: [], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: filmEntry(scene) };
  const saved = JSON.stringify([...world.agents]); renderer.update(.02, undefined, 1, 0, journey);
  for (const id of previousCrew) assert.equal(renderer.getAgent(id)!.visible, false, `${id} is not part of the evacuation shot`);
  for (const id of crew) assert.equal(renderer.getAgent(id)!.visible, true, `${id} must remain in the evacuation`);
  assert.equal(JSON.stringify([...world.agents]), saved);
  journey.visiting = scene.id; renderer.update(.02, undefined, 1, 0, journey);
  for (const id of previousCrew) assert.equal(renderer.getAgent(id)!.visible, true);
  assert.equal(JSON.stringify([...world.agents]), saved);
});
