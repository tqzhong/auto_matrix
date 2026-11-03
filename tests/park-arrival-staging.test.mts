import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { filmPosition, gardenGroundHeight, gardenPose, newTrilogyEpilogue, playerBlocked, stepTrilogyEpilogue, type TrilogyEpilogueEncounter, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { gardenCamera } from '../packages/client/src/player/GardenCamera.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

test('the waiting pair stays outside the park conversation shot, then physically approaches without a phase jump', () => {
  const initial = newTrilogyEpilogue('dawn');
  for (const [phase, elapsed] of [['sitting', .5], ['architect', .7], ['architect', 2.4], ['choice', 0], ['leaving', 2], ['promise', 0]] as const) for (const aspect of [16 / 9, .65]) {
    const state = { ...initial, phase, elapsed }, shot = gardenCamera(state, aspect, { yaw: 0, pitch: 0 });
    const camera = new THREE.PerspectiveCamera(shot.fov, aspect, .1, 500);
    camera.position.copy(shot.ideal); camera.lookAt(shot.focus); camera.updateMatrixWorld(true);
    for (const role of ['sati', 'seraph'] as const) {
      const pose = gardenPose(state, role);
      for (const x of [-1.2, 1.2]) for (const height of [0, role === 'sati' ? 3.3 : 4.9]) {
        const screen = new THREE.Vector3(pose.x + x, gardenGroundHeight(pose.x, pose.z) + height, pose.z).project(camera);
        assert(screen.x < -1.05, `${phase}/${role}: a waiting body enters the normal conversation shot at ${screen.x}`);
      }
      const first = gardenPose({ ...state, phase: 'sati', elapsed: 0 }, role);
      assert.equal(first.x, pose.x); assert.equal(first.z, pose.z, 'the camera must reveal the existing actor instead of spawning one at a different mark');
    }
  }
});

test('new arrivals keep the rendered ground and scenery clear, survive cold reads, and retain active version-two paths', () => {
  const initial = { ...newTrilogyEpilogue('dawn'), phase: 'sati' as const };
  for (let elapsed = 0; elapsed <= 17.3; elapsed += .05) {
    const state = { ...initial, elapsed };
    const positions = ['sati', 'seraph'].map(role => {
      const pose = gardenPose(state, role as 'sati' | 'seraph');
      assert.equal(playerBlocked(filmPosition('film_sunrise_garden', pose.x, pose.z), true, 1.2), false, `${role}/${elapsed}: arrival intersects scenery`);
      assert.deepEqual(gardenPose(JSON.parse(JSON.stringify(state)), role as 'sati' | 'seraph'), pose);
      return pose;
    });
    assert(Math.hypot(positions[0].x - positions[1].x, positions[0].z - positions[1].z) > 2.4, `the pair crosses at ${elapsed}`);
  }
  let clock: TrilogyEpilogueEncounter = initial;
  for (let i = 0; i < 172; i++) clock = stepTrilogyEpilogue(clock, .1);
  assert.equal(clock.phase, 'sati'); clock = stepTrilogyEpilogue(clock, .1); assert.equal(clock.phase, 'sunrise');
  const old: TrilogyEpilogueEncounter = { kind: 'dawn', phase: 'sati', elapsed: 0, total: 15.1, parkArrivalVersion: 2 };
  assert.deepEqual(['sati', 'seraph'].map(role => { const p = gardenPose(old, role as 'sati' | 'seraph'); return [p.x, p.z]; }), [[11, 9], [14, 14]]);
  assert.equal(stepTrilogyEpilogue({ ...old, elapsed: 11.9 }, .1).phase, 'sunrise');
});

test('a fast packet from the previous arrival version cannot overwrite current actors or brighten the sky early', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  const original = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }),
    fillRect() {}, strokeRect() {}, fillText() {}, createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const scene = new THREE.Scene(); scene.background = new THREE.Color(); scene.fog = new THREE.FogExp2();
  const actors = new AgentRenderer(new THREE.Scene()), sets = new FilmSetRenderer(scene);
  t.after(() => { actors.dispose(); sets.dispose(); globalThis.document = original; });
  const saved: TrilogyEpilogueEncounter = { ...newTrilogyEpilogue('dawn'), phase: 'sati', elapsed: 3.328, total: 10 };
  const stale: TrilogyEpilogueEncounter = { ...saved, parkArrivalVersion: 2, phase: 'sunrise', elapsed: 3.1, total: 14 };
  const oracle = world.agents.get('oracle')!, sati = world.agents.get('sati')!, position = filmPosition('film_sunrise_garden', -7, -20);
  Object.assign(oracle, { isInMatrix: true, currentLocation: 'film_sunrise_garden', position, currentAction: {
    type: 'idle', parameters: { epilogue: { ...stale, role: 'oracle' } }, startedAt: 0, duration: 1e9, progress: 0 } });
  const pose = gardenPose(saved, 'sati');
  Object.assign(sati, { isInMatrix: true, currentLocation: 'film_sunrise_garden', position: filmPosition('film_sunrise_garden', pose.x, pose.z), currentAction: {
    type: 'idle', parameters: { epilogue: { ...saved, role: 'sati' } }, startedAt: 0, duration: 1e9, progress: 0 } });
  const journey = { version: 1, scene: 'm3_dawn', actor: 'oracle', step: 3, completed: [], enteredAt: 0, checkpoint: position,
    reflections: {}, lastText: '', epilogue: saved } as FilmJourney;
  const sandbox = { neoLife: { journey } } as SandboxState;
  actors.updateAgent('sati', sati); actors.setPlayer('oracle');
  actors.setPlayerMotion({ speed: 0, grounded: true, verticalVelocity: 0, turn: 0, epilogue: { ...stale, role: 'oracle' } });
  actors.update(0, undefined, 0, 0, journey);
  assert(actors.getAgent('sati')!.position.distanceTo(sati.position) < 1e-7, 'stale version-two actors must not replace current version-three blocking');
  sets.update(oracle, sandbox, 0); sets.atmosphere();
  assert.equal(scene.environmentIntensity, .24, 'an older-version fast sunrise cannot replace the saved arrival');
  const current = { ...stale, parkArrivalVersion: 3 as const };
  oracle.currentAction!.parameters.epilogue = { ...current, role: 'oracle' };
  actors.setPlayerMotion({ speed: 0, grounded: true, verticalVelocity: 0, turn: 0, epilogue: { ...current, role: 'oracle' } });
  actors.update(0, undefined, 0, 0, journey);
  const end = gardenPose(current, 'sati');
  assert(actors.getAgent('sati')!.position.distanceTo(filmPosition('film_sunrise_garden', end.x, end.z)) < 1e-7, 'a matching newer frame must still advance the live actor');
  sets.update(oracle, sandbox, 0); sets.atmosphere();
  assert(Math.abs(scene.environmentIntensity - .19) < 1e-9, 'a matching newer sunrise still reaches lighting');
});
