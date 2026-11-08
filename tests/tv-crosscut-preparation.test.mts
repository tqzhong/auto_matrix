import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import * as THREE from 'three';
import { filmPosition, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { LightCulling } from '../packages/client/src/engine/LightCulling.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';

function fixture(t: TestContext) {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const scene = new THREE.Scene(), film = new FilmSetRenderer(scene), lighting = new LightCulling(scene);
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!; neo.position = filmPosition('film_tv_repair', -4.6, 46.8); neo.isInMatrix = true;
  const journey = { scene: 'm1_tv_exit', actor: 'neo', step: 0, completed: [], tvExit: { phase: 'emerging', elapsed: 0,
    emerge: { neo: 1, trinity: 1, apoc: 1, switch: .4 }, street: { trinity: 0, apoc: 0, switch: 0 },
    crosscut: { phase: 'phone', elapsed: 0, view: 'matrix', attempts: 0, tankHealth: 100, tankHit: false,
      dozerDead: false, apocDead: false, switchDead: false, cypherDead: false, trinityOut: false, neoOut: false } } } as FilmJourney;
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, .1, 300), gpu = {} as THREE.WebGLRenderer;
  const view = (x: number, z: number, yaw: number, stable?: boolean) => {
    film.update(neo, { neoLife: { journey } } as SandboxState, 0, neo.position);
    lighting.stablePointSlots = stable ?? film.stablePointSlots;
    camera.position.copy(new THREE.Vector3(neo.position.x + x, neo.position.y + 4, neo.position.z + z)); camera.rotation.set(0, yaw, 0);
    scene.updateMatrixWorld(); camera.updateMatrixWorld(); scene.onBeforeRender(gpu, scene, camera, null);
    const lights: { id: number; energy: number }[] = [];
    scene.traverseVisible(object => { if (object instanceof THREE.PointLight) lights.push({ id: object.id, energy: object.intensity }); });
    scene.onAfterRender(gpu, scene, camera); return lights;
  };
  t.after(() => { film.dispose(); lighting.dispose(); });
  return { scene, film, neo, journey, view };
}

test('the last survivor and the storefront objective keep all seven shop light slots across camera turns', t => {
  const h = fixture(t);
  const before = h.view(3.6, -.8, 0).map(light => light.id);
  assert.equal(before.length, 7, 'the dark objective must retain its slot before the final survivor leaves the shaft');
  for (const phase of ['emerging', 'ready'] as const) {
    h.journey.tvExit!.phase = phase; h.journey.tvExit!.emerge!.switch = phase === 'ready' ? 1 : .7;
    for (const [x, z] of [[0, 0], [0, -25], [0, -55]]) for (const yaw of [0, .7, -1.4, Math.PI]) {
      assert.deepEqual(h.view(x, z, yaw).map(light => light.id), before, `${phase} camera changes must reuse the same programs`);
    }
  }
});

test('stable shop slots preserve the original contributing energy, restore the rig and release on departure', t => {
  const h = fixture(t);
  for (const phase of ['emerging', 'ready'] as const) {
    h.journey.tvExit!.phase = phase;
    for (const [x, z, yaw] of [[0, 0, 0], [0, -25, 1], [0, -55, Math.PI]]) {
      const energy = (stable: boolean) => h.view(x, z, yaw, stable).filter(light => light.energy > 0);
      assert.deepEqual(energy(true), energy(false), 'padding cannot add energy or discard a possible contributor');
    }
  }
  const rig: number[] = [];
  h.film.root.traverseVisible(object => { if (object instanceof THREE.PointLight) rig.push(object.intensity); });
  assert.deepEqual(rig.sort((a, b) => a - b), [18, 35, 35, 80, 80, 80]);
  h.film.update(undefined, undefined, 0); assert.equal(h.film.stablePointSlots, false);
});
