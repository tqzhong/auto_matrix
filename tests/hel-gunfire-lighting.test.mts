import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SCENE_BY_ID, filmEntry, filmPosition, type CombatImpact, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { LightCulling } from '../packages/client/src/engine/LightCulling.js';
import { GunfireEffects } from '../packages/client/src/engine/GunfireEffects.js';
import type { GameAudio } from '../packages/client/src/engine/GameAudio.js';

test('Club Hel keeps one light layout through overlapping real muzzle flashes without dimming the room or gunfire', t => {
  const previous = globalThis.document;
  const context = { fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, fill() {}, ellipse() {},
    createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }),
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ getContext: () => context }) } as unknown as Document;
  t.after(() => { globalThis.document = previous; });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const scene = new THREE.Scene(); scene.background = new THREE.Color(); scene.fog = new THREE.FogExp2();
  const film = new FilmSetRenderer(scene), culling = new LightCulling(scene);
  const shots = new GunfireEffects(scene, { effects: () => undefined } as unknown as GameAudio);
  t.after(() => { shots.dispose(); culling.dispose(); film.dispose(); });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const chapter = FILM_SCENE_BY_ID.m3_hel_entry, actor = world.agents.get('trinity')!;
  Object.assign(actor, { position: filmPosition(chapter.set, 0, 19), currentLocation: chapter.set, isInMatrix: true });
  const journey: FilmJourney = { version: 1, scene: chapter.id, actor: actor.id, step: 1, completed: [], enteredAt: 0,
    checkpoint: filmEntry(chapter), reflections: {}, lastText: '', helElevator: { phase: 'open', elapsed: 7.6, lastTick: 0, physical: true } };
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, .1, 5000);
  camera.position.copy(new THREE.Vector3(actor.position.x, actor.position.y + 4, actor.position.z + 7)); camera.lookAt(actor.position.x, actor.position.y + 2, actor.position.z - 10);
  film.update(actor, { neoLife: { journey }, structures: [] } as unknown as SandboxState, 0, actor.position, camera.position);
  culling.stablePointSlots = film.stablePointSlots; culling.minimumPointSlots = film.minimumPointSlots;
  const fixtures: { light: THREE.PointLight; intensity: number }[] = [];
  scene.traverseVisible(light => { if (light instanceof THREE.PointLight) fixtures.push({ light, intensity: light.intensity }); });
  const counts: number[] = [];
  const sample = () => {
    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
    scene.onBeforeRender({} as THREE.WebGLRenderer, scene, camera, null);
    try {
      let count = 0, flashPower = 0;
      scene.traverseVisible(light => { if (light instanceof THREE.PointLight) { count++; if (!fixtures.some(fixture => fixture.light === light)) flashPower += light.intensity; } });
      counts.push(count);
      for (const fixture of fixtures) assert.equal(fixture.light.intensity, fixture.intensity, 'room fixtures keep their original power');
      return flashPower;
    } finally { scene.onAfterRender({} as THREE.WebGLRenderer, scene, camera); }
  };
  sample();
  const from = { ...actor.position, y: actor.position.y + 2.3 };
  const hit: CombatImpact = { source: actor.id, target: 'hel-counter', position: filmPosition(chapter.set, 0, 8), direction: { x: 0, y: 0, z: -1 },
    damage: 0, combo: 0, matrix: true, downed: false, shot: { from, surface: 'body' } };
  for (let shot = 0; shot < 24; shot++) { shots.shot(hit); assert.ok(sample() > 0, 'real flashes still light the gun line'); }
  shots.update(.2); sample();
  assert.deepEqual(counts, counts.map(() => counts[0]), 'single, overlapping, capped and expired flashes must reuse one program layout');
});
