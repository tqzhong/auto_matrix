import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, filmPosition, newAmbushEscape, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { SandboxRenderer } from '../packages/client/src/engine/SandboxRenderer.js';
import type { CharacterRig } from '../packages/client/src/agents/CharacterModel.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { FilmStorySystem } from '../packages/server/src/story/FilmStorySystem.js';

test('room officers keep their support palm on the rifle fore-end while entering and firing', t => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.assign(globalThis, { document: { createElement: () => ({ getContext: () => ({
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {},
    fillRect() {}, strokeRect() {}, fillText() {}, createRadialGradient: () => ({ addColorStop() {} }),
  }) }) } });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!; neo.controller = 'support-hand'; neo.currentLocation = 'film_ambush_house';
  neo.position = filmPosition('film_ambush_house', 11, 31.8);
  const journey = { scene: 'm1_dejavu', actor: 'neo', step: 1, completed: [], ambushEscape: newAmbushEscape() } as FilmJourney;
  const sandbox = { nodes: [], structures: [], threats: [], incidents: [], missions: {}, neoLife: { journey } } as unknown as SandboxState;
  const story = new FilmStorySystem(world, () => sandbox, () => {}, () => {}), renderer = new SandboxRenderer(new THREE.Scene());
  const center = FILM_SETS.film_ambush_house.center, camera = new THREE.PerspectiveCamera(); camera.position.set(center.x - 20, center.y + 5, center.z - 10);
  t.after(() => { renderer.dispose(); if (previous) Object.defineProperty(globalThis, 'document', previous); else Reflect.deleteProperty(globalThis, 'document'); });
  for (const time of [1.75, 2.2, 2.8, 3, 3.04, 3.4, 3.44, 4.2, 4.44]) {
    journey.ambushEscape!.elapsed = time; story.ambushEscapeFrame(neo, 0, 1);
    renderer.sync({ ...sandbox }, Object.fromEntries(world.agents)); renderer.update(.016, camera, true, 1, false);
    const officers = [...(renderer as unknown as { enemies: Map<string, { rig: CharacterRig }> }).enemies.entries()].filter(([id]) => id.startsWith('film:ambush:room:'));
    assert.equal(officers.length, 2);
    for (const [id, { rig }] of officers) {
      const gun = rig.weapons![0], palm = rig.elbows[1].localToWorld(new THREE.Vector3(0, -.75, .06));
      const support = gun.localToWorld(new THREE.Vector3(0, -.55, .07));
      assert.ok(palm.distanceTo(support) < .025, `${id} at ${time}: support palm is ${palm.distanceTo(support)} from the rifle fore-end`);
    }
  }
});
