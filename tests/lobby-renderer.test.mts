import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, filmPosition, type AgentState, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { LobbySetRenderer, LOBBY_POINT_SLOTS } from '../packages/client/src/engine/LobbySetRenderer.js';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import type { GameAudio } from '../packages/client/src/engine/GameAudio.js';
import { GunfireEffects } from '../packages/client/src/engine/GunfireEffects.js';
import { LightCulling } from '../packages/client/src/engine/LightCulling.js';

const canvasDocument = () => ({
  createElement: () => ({ width: 0, height: 0, getContext: () => ({
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {},
    createRadialGradient: () => ({ addColorStop() {} }), fillRect() {},
  }) }),
}) as unknown as Document;

const journey = (): FilmJourney => ({ version: 1, scene: 'm1_lobby', step: 1, actor: 'neo', completed: [], enteredAt: 0,
  checkpoint: filmPosition('film_government_lobby'), reflections: {}, lastText: '', fighting: true,
  lobby: { phase: 'checkpoint', elapsed: 0, ammo: 16, wave: 0, columns: Array(10).fill(0), allyShotAt: -10, shots: 0, kills: 0 } });

test('the lobby checkpoint has physical alarm, console, weapon case and impact aftermath', () => {
  const savedDocument = globalThis.document; globalThis.document = canvasDocument();
  const root = new THREE.Group(); const renderer = new LobbySetRenderer(root, FILM_SETS.film_government_lobby);
  try {
    assert.ok(root.getObjectByName('lobby-security-console')); assert.ok(root.getObjectByName('lobby-security-display'));
    const lid = root.getObjectByName('lobby-weapon-case-lid')!;
    const left = root.getObjectByName('lobby-alarm-left') as THREE.Mesh;
    const state = journey(); renderer.update(state, 1);
    assert.equal((left.material as THREE.MeshStandardMaterial).emissiveIntensity, 0); assert.ok(Math.abs(lid.rotation.x) < .001);
    state.lobby!.elapsed = 2.2; renderer.update(state, 2.2);
    const alarms = ['lobby-alarm-left', 'lobby-alarm-right'].map(name => root.getObjectByName(name) as THREE.Mesh);
    assert.ok(alarms.some(mesh => (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity > 1));
    state.lobby!.elapsed = 4.4; renderer.update(state, 4.4); assert.ok(lid.rotation.x < -.5, 'the saved draw beat opens the physical weapon case');
    const center = FILM_SETS.film_government_lobby.center;
    renderer.impact({ source: 'neo', target: 'lobby-stone', position: { x: center.x + 10, y: center.y + 3, z: center.z + 2 }, direction: { x: 1, y: 0, z: 0 }, damage: 0, combo: 0, matrix: true,
      downed: false, shot: { from: center, surface: 'stone', column: 0 } });
    const debris = root.getObjectByName('lobby-impact-debris')!; const before = debris.children[0].position.clone(); renderer.update(state, 4.5);
    assert.ok(debris.children[0].position.distanceTo(before) > 0, 'stone hits throw physical chips instead of leaving only a flat decal');
  } finally { renderer.dispose(); globalThis.document = savedDocument; }
});

test('the lobby keeps the goal light shader slot through security, combat and the elevator', t => {
  const savedDocument = globalThis.document; globalThis.document = canvasDocument();
  const scene = new THREE.Scene(), renderer = new FilmSetRenderer(scene), culling = new LightCulling(scene);
  t.after(() => { culling.dispose(); renderer.dispose(); globalThis.document = savedDocument; });
  const state = journey(), camera = new THREE.PerspectiveCamera(60, 16 / 9, .1, 200);
  const actor = { id: 'neo', position: filmPosition('film_government_lobby', 0, 22), isInMatrix: true } as AgentState;
  const sandbox = { neoLife: { journey: state } } as SandboxState;
  const marker = scene.children.find(object => object instanceof THREE.PointLight) as THREE.PointLight;
  camera.position.set(actor.position.x, actor.position.y + 4, actor.position.z);
  const lights = () => {
    assert.equal(renderer.update(actor, sandbox, 0, actor.position)?.id, 'film_government_lobby');
    culling.stablePointSlots = renderer.stablePointSlots;
    scene.updateMatrixWorld(); camera.updateMatrixWorld();
    const rendererContext = {} as THREE.WebGLRenderer;
    scene.onBeforeRender(rendererContext, scene, camera, null);
    const points: number[] = [];
    scene.traverseVisible(object => { if (object instanceof THREE.PointLight) points.push(object.id); });
    scene.onAfterRender(rendererContext, scene, camera);
    return points;
  };
  state.fighting = false; state.lobby!.phase = 'ready';
  const ready = lights();
  assert.equal(ready.length, 7);
  assert.equal(marker.intensity, 5);
  state.fighting = true; state.lobby!.phase = 'checkpoint';
  assert.deepEqual(lights(), ready, 'the alarm must not change the light count');
  assert.equal(marker.intensity, 0);
  state.lobby!.phase = 'combat'; camera.rotation.y = Math.PI;
  assert.deepEqual(lights(), ready);
  state.fighting = false; state.lobby!.phase = 'cleared'; state.step = 2;
  assert.deepEqual(lights(), ready);
  assert.equal(marker.intensity, 5);
});

test('the lobby keeps the same shader layout while Neo, Trinity and three guards fire together', t => {
  const savedDocument = globalThis.document; globalThis.document = canvasDocument();
  const scene = new THREE.Scene(), renderer = new FilmSetRenderer(scene), culling = new LightCulling(scene);
  const gunfire = new GunfireEffects(scene, { effects: () => undefined } as unknown as GameAudio);
  t.after(() => { gunfire.dispose(); culling.dispose(); renderer.dispose(); globalThis.document = savedDocument; });
  const actor = { id: 'neo', position: filmPosition('film_government_lobby', 0, 0), isInMatrix: true } as AgentState;
  const state = journey(); Object.assign(state.lobby!, { phase: 'combat', wave: 3 });
  const sandbox = { neoLife: { journey: state } } as SandboxState;
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, .1, 200), graphics = {} as THREE.WebGLRenderer;
  camera.position.set(actor.position.x, actor.position.y + 4, actor.position.z + 6);
  camera.lookAt(actor.position.x, actor.position.y + 2, actor.position.z - 7);
  camera.updateMatrixWorld(true);
  renderer.update(actor, sandbox, 0, actor.position);
  culling.stablePointSlots = renderer.stablePointSlots;
  culling.minimumPointSlots = LOBBY_POINT_SLOTS;
  const activeLights = () => {
    scene.updateMatrixWorld(true);
    scene.onBeforeRender(graphics, scene, camera, null);
    try {
      const lights: number[] = [];
      scene.traverseVisible(object => { if (object instanceof THREE.PointLight) lights.push(object.intensity); });
      return lights;
    } finally { scene.onAfterRender(graphics, scene, camera); }
  };
  const idleSlots = activeLights().length;
  for (const [index, source] of ['neo', 'trinity', 'film:1', 'film:2', 'film:3'].entries()) {
    const from = { x: actor.position.x + index - 2, y: actor.position.y + 2.3, z: actor.position.z - 5 };
    gunfire.shot({ source, target: 'neo', position: { ...from, z: from.z + 5 }, direction: { x: 0, y: 0, z: 1 },
      damage: 0, combo: 0, matrix: true, downed: false, shot: { from, surface: 'body' } });
    const active = activeLights();
    assert.equal(active.filter(energy => energy === 85).length, index + 1, 'each real muzzle light must retain its energy');
    assert.equal(active.length, idleSlots, `${index + 1} overlapping flashes must reuse the prepared slots`);
  }
  gunfire.update(.12);
  const after = activeLights();
  assert.equal(after.filter(energy => energy === 85).length, 0);
  assert.equal(after.length, idleSlots);
});
