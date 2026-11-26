import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SCENE_BY_ID, filmEntry, filmPosition, type FilmJourney } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';

test('the Hel elevator, coat check and confrontation draw their room without redrawing earlier Matrix scenes or changing their saved actors', t => {
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
  const scene = FILM_SCENE_BY_ID.m3_hel_entry, crew = [scene.actor, ...scene.cast];
  const outside = { neo: 'film_mobil_station', smith: 'film_source_corridor', oracle: 'film_oracle_home',
    merovingian: 'film_le_vrai', keymaker: 'film_source_corridor', agent_jones: 'film_heart_hotel' };
  for (const id of crew) Object.assign(world.agents.get(id)!, { position: filmEntry(scene), currentLocation: scene.set, isInMatrix: true });
  for (const [id, location] of Object.entries(outside)) Object.assign(world.agents.get(id)!, {
    position: filmPosition(location, 0, 0), currentLocation: location, isInMatrix: true,
    ...(id === 'keymaker' ? { status: 'dead', health: 0 } : id === 'neo' ? { health: 91.5 } : {}),
  });
  for (const [id, actor] of world.agents) renderer.updateAgent(id, actor);
  renderer.setWorld(true); renderer.setPlayer('trinity');
  const journey: FilmJourney = { version: 1, scene: scene.id, actor: 'trinity', step: 0, completed: ['m3_hel_garage'], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: filmEntry(scene) };
  const saved = JSON.stringify([...world.agents]);
  for (const step of [0, 1, 3, 4]) {
    journey.step = step; renderer.update(.02, undefined, 1, 0, journey);
    for (const id of Object.keys(outside)) assert.equal(renderer.getAgent(id)!.visible, false, `${id} belongs to an earlier Matrix room at step ${step}`);
    for (const id of crew) assert.equal(renderer.getAgent(id)!.visible, true);
    assert.equal(JSON.stringify([...world.agents]), saved);
  }
  renderer.update(.02);
  for (const id of Object.keys(outside)) assert.equal(renderer.getAgent(id)!.visible, true, 'the world view keeps its other rooms');
  assert.equal(JSON.stringify([...world.agents]), saved);
  const hosts = ['merovingian', 'persephone', 'trainman'];
  for (const id of hosts) {
    const actor = world.agents.get(id)!;
    Object.assign(actor, { position: filmPosition(scene.set, 0, -35), currentLocation: scene.set, isInMatrix: true });
    renderer.updateAgent(id, actor);
  }
  journey.scene = 'm3_hel_bargain'; journey.step = 0;
  const confrontation = JSON.stringify([...world.agents]); renderer.update(.02, undefined, 1, 0, journey);
  for (const id of Object.keys(outside).filter(id => !hosts.includes(id)))
    assert.equal(renderer.getAgent(id)!.visible, false, `${id} stays in the earlier room during the confrontation`);
  for (const id of [...crew, ...hosts]) assert.equal(renderer.getAgent(id)!.visible, true, `${id} is present at the VIP stairs`);
  assert.equal(JSON.stringify([...world.agents]), confrontation);
  renderer.update(.02);
  for (const id of Object.keys(outside)) assert.equal(renderer.getAgent(id)!.visible, true);
  assert.equal(JSON.stringify([...world.agents]), confrontation);
});
