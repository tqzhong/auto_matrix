import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SCENE_BY_ID, ZION_HOMECOMING, filmEntry, filmPosition, type FilmJourney } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';

for (const id of [...ZION_HOMECOMING, 'm2_oracle_message', 'm2_departure']) test(`${id} draws its own occupants and retains other rooms' saved bodies`, t => {
  const originalDocument = globalThis.document;
  const context = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const renderer = new AgentRenderer(new THREE.Scene());
  t.after(() => { renderer.dispose(); globalThis.document = originalDocument; });
  t.mock.method(renderer['models'], 'requestHero', () => {}); t.mock.method(renderer['models'], 'animate', () => {});
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const scene = FILM_SCENE_BY_ID[id], actor = world.agents.get(scene.actor)!, local = world.agents.get('citizen_1')!;
  const cypher = world.agents.get('cypher')!, tank = world.agents.get('tank')!;
  for (const resident of [actor, local]) Object.assign(resident, { position: filmEntry(scene), currentLocation: scene.set, isInMatrix: false });
  local.position.x += 4;
  for (const remote of [cypher, tank]) Object.assign(remote, { position: filmPosition('film_neb_deck'), currentLocation: 'film_neb_deck', isInMatrix: false });
  cypher.health = 0; cypher.status = 'dead'; tank.health = 40;
  const saved = structuredClone([cypher, tank]);
  for (const resident of [actor, local, cypher, tank]) renderer.updateAgent(resident.id, resident);
  renderer.setPlayer(actor.id); renderer.setWorld(false);
  const journey: FilmJourney = { version: 1, scene: id, actor: actor.id, step: 0, completed: [], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: { ...actor.position } };
  const camera = new THREE.PerspectiveCamera(); camera.position.copy(actor.position);
  renderer.update(.02, camera, 1, 0, journey);
  assert.equal(renderer.getAgent(local.id)?.visible, true, 'nearby occupants of this room remain visible');
  assert.equal(renderer.getAgent('cypher')?.visible, false, 'the dead ship resident must not draw here or cast a shadow here');
  assert.equal(renderer.getAgent('tank')?.visible, false, 'the living ship crew must also stay in their own room');
  assert.deepEqual([cypher, tank], saved, 'visibility cannot move, heal, revive or rewrite an off-room resident');
  renderer.update(.02, camera, 1, 0);
  assert.equal(renderer.getAgent('cypher')?.visible, true, 'leaving the story view restores the ordinary world view');
  assert.equal(renderer.getAgent('tank')?.visible, true);
});
