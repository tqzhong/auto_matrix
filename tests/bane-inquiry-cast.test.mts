import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SCENE_BY_ID, filmEntry, filmPosition, newBaneInquiry, newHammerBriefing, type FilmJourney } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';

for (const sceneId of ['m3_bane_questions', 'm3_logos_plan'] as const) test(`${sceneId} draws its participants while past crews keep their saved fates`, t => {
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
  const scene = FILM_SCENE_BY_ID[sceneId], crew = [scene.actor, ...scene.cast];
  for (const id of crew) Object.assign(world.agents.get(id)!, { position: filmEntry(scene), currentLocation: scene.set, isInMatrix: false });
  const outside = ['neo', 'bane', 'maggie', 'tank', 'cypher', 'lock', 'deus_ex_machina'].filter(id => !crew.includes(id));
  for (const id of outside) Object.assign(world.agents.get(id)!, { position: filmPosition('film_neb_deck'), currentLocation: 'film_neb_deck', isInMatrix: false,
    ...(id === 'cypher' ? { status: 'dead', health: 0 } : id === 'tank' ? { health: 40 } : {}) });
  Object.assign(world.agents.get(sceneId === 'm3_bane_questions' ? 'maggie' : 'niobe')!, { health: 43, controller: 'another-player' });
  for (const [id, actor] of world.agents) renderer.updateAgent(id, actor);
  renderer.setWorld(false); renderer.setPlayer(scene.actor);
  const journey: FilmJourney = { version: 1, scene: scene.id, actor: scene.actor, step: 0, completed: [], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: filmEntry(scene),
    ...(sceneId === 'm3_bane_questions' ? { baneInquiry: newBaneInquiry(0, 100) } : { hammerBriefing: newHammerBriefing(0, 100) }) };
  const saved = JSON.stringify([...world.agents]);
  for (const step of [0, 1, 3, 5]) {
    journey.step = step; renderer.update(.02, undefined, 1, 0, journey);
    for (const id of outside) assert.equal(renderer.getAgent(id)!.visible, false, `${id} is outside ${sceneId} at step ${step}`);
    for (const id of crew) assert.equal(renderer.getAgent(id)!.visible, true, `${id} participates in ${sceneId}`);
    assert.equal(JSON.stringify([...world.agents]), saved);
  }
  journey.visiting = scene.id; renderer.update(.02, undefined, 1, 0, journey);
  for (const id of outside) assert.equal(renderer.getAgent(id)!.visible, true, 'a revisit keeps the wider world');
  delete journey.visiting; renderer.setPlayer(scene.actor === 'neo' ? 'roland' : 'neo'); renderer.update(.02, undefined, 1, 0, journey);
  for (const id of outside) assert.equal(renderer.getAgent(id)!.visible, true, 'another player keeps their own world');
  renderer.setPlayer(scene.actor); renderer.update(.02);
  for (const id of outside) assert.equal(renderer.getAgent(id)!.visible, true, 'the world view keeps other rooms');
  assert.equal(JSON.stringify([...world.agents]), saved);
});
