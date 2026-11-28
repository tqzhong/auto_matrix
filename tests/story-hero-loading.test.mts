import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { type FilmJourney } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { HeroModels } from '../packages/client/src/agents/HeroModel.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

test('a saved Oracle entrance only assembles requested heroes, in stages, without changing the stored cast', t => {
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const requested: { id: string; support?: string; staged?: boolean }[] = [];
  t.mock.method(HeroModels.prototype, 'create', (id, _guard, support, staged) => {
    requested.push({ id, support, staged }); return new Promise(() => {});
  });
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {},
    beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, arc() {}, fill() {}, closePath() {},
    createRadialGradient: () => ({ addColorStop() {} }),
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const renderer = new AgentRenderer(new THREE.Scene());
  t.after(() => { renderer.dispose(); globalThis.document = previous; });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const saved = structuredClone([...world.agents.values()]);
  const journey: FilmJourney = { version: 1, scene: 'm1_spoon', actor: 'neo', step: 0, completed: [], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: { ...world.agents.get('neo')!.position } };
  for (const actor of world.agents.values()) renderer.updateAgent(actor.id, actor, journey);
  assert.deepEqual(requested, [], 'reading the world cannot assemble offstage costumes and fighting hands');
  renderer.prepareStoryCast(journey);
  assert.ok(requested.some(actor => actor.id === 'neo' && !actor.support));
  assert.ok(requested.some(actor => actor.id === 'morpheus' && !actor.support));
  assert.ok(requested.every(actor => actor.staged), 'the current and next cast must use the existing assembly queue');
  assert.ok(!requested.some(actor => actor.id === 'smith' && !actor.support), 'Smith is outside this entrance');
  const count = requested.length;
  renderer.prepareStoryCast(journey);
  assert.equal(requested.length, count, 'preparing the same saved cast cannot duplicate assembly');
  renderer.setPlayer('smith');
  assert.ok(requested.some(actor => actor.id === 'smith' && !actor.support && actor.staged), 'free possession still requests a deferred hero');
  assert.deepEqual([...world.agents.values()], saved, 'asset scheduling cannot alter saved actors');
});
