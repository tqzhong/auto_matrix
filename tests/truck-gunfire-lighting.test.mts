import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { filmPosition, newTruckRoad, newTruckWeapons, type CombatImpact, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { GunfireEffects } from '../packages/client/src/engine/GunfireEffects.js';
import { LightCulling } from '../packages/client/src/engine/LightCulling.js';
import type { GameAudio } from '../packages/client/src/engine/GameAudio.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';

test('the truck gunfight keeps its light layout as a real muzzle flash appears and fades', t => {
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }),
    putImageData() {}, fillRect() {}, strokeRect() {}, fillText() {},
    createRadialGradient: () => ({ addColorStop() {} }), createLinearGradient: () => ({ addColorStop() {} }),
  }) }) } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const scene = new THREE.Scene(), film = new FilmSetRenderer(scene), culling = new LightCulling(scene);
  const gunfire = new GunfireEffects(scene, { effects: () => undefined } as GameAudio);
  t.after(() => { gunfire.dispose(); culling.dispose(); film.dispose(); globalThis.document = document; });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const actor = world.agents.get('morpheus')!, root = { x: .3, y: 6.6, z: -3.5, yaw: Math.PI };
  const road = newTruckRoad({ x: 13.7, z: 0 }, root, { ...root, x: 1.3, z: -10.2 }, 100);
  road.phase = 'ready'; road.elapsed = 5;
  Object.assign(actor, { currentLocation: 'film_freeway_101', isInMatrix: true,
    position: { ...filmPosition('film_freeway_101', 14, -3.5), y: 7.6 } });
  const journey: FilmJourney = { version: 1, scene: 'm2_trucks', actor: actor.id, step: 0, completed: [], enteredAt: 0,
    checkpoint: { ...actor.position }, reflections: {}, lastText: '', fighting: true,
    trucks: { phase: 'duel', elapsed: 0, lastTick: 0, attempt: 0, road, weapons: newTruckWeapons() } };
  const sandbox = { neoLife: { journey } } as SandboxState;
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, .1, 300), gpu = {} as THREE.WebGLRenderer;
  camera.position.set(actor.position.x + 4, actor.position.y + 4, actor.position.z + 6);
  camera.lookAt(actor.position.x, actor.position.y + 1, actor.position.z);
  const sample = () => {
    film.update(actor, sandbox, 0, actor.position);
    culling.minimumPointSlots = film.minimumPointSlots; culling.stablePointSlots = film.stablePointSlots;
    scene.updateMatrixWorld(); camera.updateMatrixWorld(); scene.onBeforeRender(gpu, scene, camera, null);
    const lights: number[] = [];
    scene.traverseVisible(object => { if (object instanceof THREE.PointLight) lights.push(object.intensity); });
    scene.onAfterRender(gpu, scene, camera);
    return { count: lights.length, energy: lights.reduce((sum, value) => sum + value, 0) };
  };
  const before = sample(), saved = JSON.stringify(journey);
  const hit: CombatImpact = { source: actor.id, target: 'agent_johnson', position: { ...actor.position, z: actor.position.z - 4 },
    direction: { x: 0, y: 0, z: -1 }, damage: 0, combo: 0, matrix: true, downed: false,
    shot: { from: { ...actor.position, y: actor.position.y + 2.6 }, surface: 'stone' } };
  gunfire.shot(hit);
  const flash = sample(); gunfire.update(.11); const faded = sample();
  assert.deepEqual([before.count, flash.count, faded.count], [2, 2, 2], 'the first shot must reuse the pre-shot colour program');
  assert.equal(flash.energy - before.energy, 85, 'the authored muzzle flash keeps its full energy');
  assert.equal(faded.energy, before.energy, 'dark padding cannot add light after the flash');
  assert.equal(JSON.stringify(journey), saved, 'lighting cannot rewrite the armed checkpoint');
  film.update(undefined, undefined, 0); assert.equal(film.minimumPointSlots, 0);
});
