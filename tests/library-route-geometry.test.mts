import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SCENE_BY_ID, filmPosition, playerBlocked, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';

test('the library approach is visually clear wherever its shared route allows the player through', t => {
  const previous = globalThis.document;
  const context = { fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, fill() {}, ellipse() {},
    createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }),
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  t.after(() => { globalThis.document = previous; });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const scene = new THREE.Scene(), sets = new FilmSetRenderer(scene), world = new WorldState();
  new AgentManager(world).initializeAllAgents(); const neo = world.agents.get('neo')!, beat = FILM_SCENE_BY_ID.m2_library;
  Object.assign(neo, { position: filmPosition(beat.set, 0, 24), currentLocation: beat.set, isInMatrix: true });
  const journey: FilmJourney = { version: 1, scene: beat.id, actor: 'neo', step: 0, completed: [], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: { ...neo.position } };
  sets.update(neo, { neoLife: { journey } } as SandboxState, 0); scene.updateMatrixWorld(true);
  t.after(() => sets.dispose());
  for (let z = 24; z >= 7; z--) assert.equal(playerBlocked(filmPosition(beat.set, 0, z), true, 1.1), false);
  const from = new THREE.Vector3(neo.position.x, 4, neo.position.z), ray = new THREE.Raycaster(from, new THREE.Vector3(0, 0, -1), 0, 17);
  const hits = ray.intersectObject(sets.root, true);
  assert.equal(hits.length, 0, 'the player must not walk through a visible panel on the first objective route');
  assert.ok(sets.root.getObjectByName('keymaker-book-door'), 'the actual concealed bookcase door remains');
});
