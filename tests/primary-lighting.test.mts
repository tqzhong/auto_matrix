import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SCENE_BY_ID, FILM_SETS, PRIMARY_DEMOLITION as P, filmEntry, filmPosition, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { LightCulling } from '../packages/client/src/engine/LightCulling.js';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';

function canvas(t: TestContext) {
  const previous = globalThis.document;
  const context = { fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, fill() {}, ellipse() {},
    createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }),
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  t.after(() => { globalThis.document = previous; });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture({ width: 1, complete: true }));
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
}

test('the station reuses nine authored light slots when leaving the hall, completing evacuation and blacking out', t => {
  canvas(t);
  const scene = new THREE.Scene(), film = new FilmSetRenderer(scene), culling = new LightCulling(scene);
  t.after(() => { film.dispose(); culling.dispose(); });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const actor = world.agents.get('niobe')!, center = FILM_SETS.film_power_station.center;
  Object.assign(actor, { position: { ...filmPosition('film_power_station', 0, 41.55), y: center.y + P.ramp.top }, currentLocation: 'film_power_station', isInMatrix: true });
  const journey: FilmJourney = { version: 1, scene: 'm2_power', actor: actor.id, step: 1, completed: [], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: { ...actor.position },
    primaryDemolition: { phase: 'retreat', installed: ['west', 'east', 'clock'], elapsed: 1.464, remaining: 20, attempts: 1 },
    grid: { primary: 'armed', emergency: 'online', vigilant: 'active', trinity: 'waiting', phase: 'preparing', remaining: 314, lastTick: 0, reroute: 0, attempts: 0 } };
  const sandbox = { neoLife: { journey } } as SandboxState, gpu = {} as THREE.WebGLRenderer;
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000);
  camera.position.set(center.x - .8, center.y + 9.245, center.z + 30.365);
  camera.quaternion.set(0, .9887207214, .1497709418, 0);
  const select = (stable: boolean, minimum: number) => {
    culling.stablePointSlots = stable; culling.minimumPointSlots = minimum;
    scene.updateMatrixWorld(); camera.updateMatrixWorld(); scene.onBeforeRender(gpu, scene, camera, null);
    const intensities: number[] = [];
    scene.traverseVisible(object => { if (object instanceof THREE.PointLight) intensities.push(object.intensity); });
    scene.onAfterRender(gpu, scene, camera);
    return { count: intensities.length, energy: intensities.reduce((sum, value) => sum + value, 0) };
  };
  const samples: number[] = [], sample = () => {
    const saved = JSON.stringify(journey); film.update(actor, sandbox, 0, actor.position);
    const actual = select(film.stablePointSlots, film.minimumPointSlots), legacy = select(false, 0);
    samples.push(actual.count); assert.equal(actual.energy, legacy.energy, 'reserved slots cannot add illumination or change the authored blackout');
    assert.equal(JSON.stringify(journey), saved); return actual;
  };
  sample(); camera.rotateY(Math.PI); sample(); camera.rotateY(Math.PI);
  journey.primaryDemolition!.phase = 'done'; journey.step = 2; journey.completed.push('m2_power'); sample();
  journey.scene = 'm2_blackout'; journey.step = 0; journey.primaryDemolition!.blast = { phase: 'countdown', elapsed: 1.7 }; sample();
  journey.primaryDemolition!.blast = { phase: 'blast', elapsed: .5 }; journey.grid!.primary = 'off'; journey.grid!.phase = 'emergency'; sample();
  journey.primaryDemolition!.blast.elapsed = 3.5; sample();
  journey.primaryDemolition!.blast = { phase: 'done', elapsed: 8 }; journey.step = 1; sample();
  assert.deepEqual(samples, [9, 9, 9, 9, 9, 9, 9], 'six hall lamps, exterior, blast and objective must keep their layout through both scenes');
  film.update(undefined, undefined, 0); assert.equal(film.minimumPointSlots, 0); assert.equal(film.stablePointSlots, false);
});

for (const id of ['m2_power', 'm2_blackout'] as const) test(`${id} draws station occupants without importing the saved Neo and Smith bodies`, t => {
  canvas(t);
  const renderer = new AgentRenderer(new THREE.Scene()), world = new WorldState(); new AgentManager(world).initializeAllAgents();
  t.after(() => renderer.dispose()); t.mock.method(renderer['models'], 'requestHero', () => {}); t.mock.method(renderer['models'], 'animate', () => {});
  const beat = FILM_SCENE_BY_ID[id], local = [beat.actor, ...beat.cast, 'citizen_1'];
  for (const role of [...local, 'neo', 'smith']) {
    const at = FILM_SCENE_BY_ID[role === 'neo' ? 'm2_plan' : role === 'smith' ? 'm2_bench' : id], actor = world.agents.get(role)!;
    Object.assign(actor, { position: filmEntry(at), currentLocation: at.set, isInMatrix: true }); renderer.updateAgent(role, actor);
  }
  renderer.setPlayer(beat.actor);
  const journey: FilmJourney = { version: 1, scene: id, actor: beat.actor, step: 0, completed: [], enteredAt: 0,
    checkpoint: filmEntry(beat), reflections: {}, lastText: '' };
  const saved = JSON.stringify([...world.agents]); renderer.update(.02, undefined, 1, 0, journey);
  for (const role of ['neo', 'smith']) assert.equal(renderer.getAgent(role)!.visible, false, `${role} cannot draw or cast station shadows from another scene`);
  assert.ok(local.every(role => renderer.getAgent(role)?.visible), 'local workers remain visible alongside the story cast');
  assert.equal(JSON.stringify([...world.agents]), saved);
  renderer.update(.02); assert.equal(renderer.getAgent('neo')!.visible, true); assert.equal(renderer.getAgent('smith')!.visible, true);
});
