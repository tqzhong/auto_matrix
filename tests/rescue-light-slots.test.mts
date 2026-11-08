import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import * as THREE from 'three';
import { filmPosition, type FilmJourney, type RescuePreparation, type SandboxState } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { LightCulling } from '../packages/client/src/engine/LightCulling.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';

function fixture(t: TestContext) {
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({
    fillRect() {}, fillText() {}, beginPath() {}, arc() {}, ellipse() {}, fill() {}, stroke() {},
    createLinearGradient: () => ({ addColorStop() {} }),
  }) }) } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const scene = new THREE.Scene(), film = new FilmSetRenderer(scene), lighting = new LightCulling(scene);
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!; neo.position = filmPosition('film_white_construct', 0, -3.8); neo.isInMatrix = true;
  const journey: FilmJourney = { version: 1, scene: 'm1_guns', actor: 'neo', step: 0, completed: [], enteredAt: 0,
    checkpoint: neo.position, reflections: {}, lastText: '', rescue: { phase: 'racks_ready', elapsed: 0 } };
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, .1, 300), gpu = {} as THREE.WebGLRenderer;
  const view = (yaw: number, minimum?: number) => {
    film.update(neo, { neoLife: { journey } } as SandboxState, 0, neo.position);
    lighting.stablePointSlots = film.stablePointSlots; lighting.minimumPointSlots = minimum ?? film.minimumPointSlots;
    camera.position.set(neo.position.x + 5, neo.position.y + 5, neo.position.z + 5); camera.rotation.set(0, yaw, 0);
    scene.updateMatrixWorld(); camera.updateMatrixWorld(); scene.onBeforeRender(gpu, scene, camera, null);
    const lights: { id: number; energy: number }[] = [];
    scene.traverseVisible(object => { if (object instanceof THREE.PointLight) lights.push({ id: object.id, energy: object.intensity }); });
    scene.onAfterRender(gpu, scene, camera); return lights;
  };
  t.after(() => { film.dispose(); lighting.dispose(); globalThis.document = previous; });
  return { scene, film, neo, journey, view };
}

const beats: RescuePreparation[] = [
  { phase: 'racks_ready', elapsed: 0 },
  ...[0, .7, 2.9, 4.7].map(elapsed => ({ phase: 'racks_arriving' as const, elapsed })),
  { phase: 'selecting', elapsed: 0 },
  ...[.8, 3.2].map(elapsed => ({ phase: 'equipping' as const, elapsed, loadout: 'compact' as const })),
  { phase: 'equipped', elapsed: 0, loadout: 'compact' },
];

test('the armoury retains five shader slots before the racks, weapon lights and exit objective appear', t => {
  const h = fixture(t);
  for (const beat of beats) {
    h.journey.rescue = beat; h.journey.step = beat.phase === 'equipped' ? 1 : 0;
    for (const yaw of [0, .7, -1.4, Math.PI]) {
      assert.equal(h.view(yaw).length, 5, `${beat.phase}/${beat.elapsed}: camera and reveal changes must reuse one point-light program layout`);
    }
  }
  h.film.update(undefined, undefined, 0); assert.equal(h.film.minimumPointSlots, 0, 'leave no armoury reservation in the next scene');
});

test('the armoury reservation preserves every contributing light and restores all actual energies after each pass', t => {
  const h = fixture(t);
  for (const beat of beats) {
    h.journey.rescue = beat; h.journey.step = beat.phase === 'equipped' ? 1 : 0;
    for (const yaw of [0, 1, Math.PI]) {
      const original = h.view(yaw, 0).filter(light => light.energy > 0);
      assert.deepEqual(h.view(yaw).filter(light => light.energy > 0), original, 'zero-energy padding cannot add light or remove a possible contributor');
    }
  }
  const lights: number[] = [];
  h.film.root.traverseVisible(object => { if (object instanceof THREE.PointLight) lights.push(object.intensity); });
  assert.deepEqual(lights.sort((a, b) => a - b), [10, 10, 115, 150]);
});
