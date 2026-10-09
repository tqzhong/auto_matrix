import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, filmPosition, newTrilogyEpilogue, type TrilogyEpilogueGesture } from '@auto_matrix/shared';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { ZionHomecomingRenderer } from '../packages/client/src/engine/ZionHomecomingRenderer.js';
import { TrilogyEpilogueRenderer } from '../packages/client/src/engine/TrilogyEpilogueRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

function fixture(t: TestContext) {
  class InputTarget extends EventTarget { matches() { return false; } }
  const window = new InputTarget(), canvas = new InputTarget();
  const document = Object.assign(new InputTarget(), { pointerLockElement: null as unknown, hidden: false, exitPointerLock() {},
    createElement: () => ({ getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {} }) }) });
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key)); Object.assign(globalThis, { window, document });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const state = world.agents.get('kid')!;
  Object.assign(state, { currentLocation: 'film_zion_temple', isInMatrix: false, rotation: Math.PI,
    position: filmPosition('film_zion_temple', 0, -30) });
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000), player = new THREE.Group(); player.add(new THREE.Group());
  const controls = new PlayerControls(canvas as unknown as HTMLCanvasElement, camera, () => {}, () => {});
  const center = FILM_SETS.film_zion_temple.center, root = new THREE.Group(); root.position.set(center.x, center.y - 1, center.z);
  const scenery = new THREE.Group(); root.add(scenery);
  const temple = new ZionHomecomingRenderer(scenery, 'film_zion_temple'), epilogue = new TrilogyEpilogueRenderer(root, 'ceasefire');
  let time = 2000; t.mock.method(performance, 'now', () => time);
  const step = (elapsed: number, phase: TrilogyEpilogueGesture['phase'] = 'retreat') => {
    const gesture: TrilogyEpilogueGesture = { ...newTrilogyEpilogue('ceasefire'), role: 'kid', phase, elapsed, total: elapsed };
    state.currentAction = { type: 'idle', parameters: { epilogue: gesture }, startedAt: 0, duration: 1e9, progress: 0 };
    temple.update({ scene: 'm3_ceasefire', step: 1, completed: [], epilogue: gesture } as any, 0); epilogue.update(gesture, 10000);
    time += 100; controls.update(.1, state, player, false); root.updateMatrixWorld(true); camera.updateMatrixWorld(true);
  };
  const toggle = () => window.dispatchEvent(Object.assign(new Event('keydown'), { code: 'KeyV', repeat: false }));
  controls.possess(state);
  t.after(() => { controls.dispose(); epilogue.dispose(); temple.dispose(); ['window', 'document'].forEach((key, i) => {
    if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!); else Reflect.deleteProperty(globalThis, key);
  }); });
  return { camera, controls, state, root, scenery, player, document, canvas, step, toggle };
}

test('the withdrawal shot keeps all eighteen machines in frame instead of cutting off their ascent, without scenery blocking the central machine', t => {
  const h = fixture(t);
  for (const aspect of [16 / 9, .65]) for (const elapsed of [0, .8, 2.6, 4.9]) {
    h.camera.aspect = aspect; h.camera.updateProjectionMatrix(); h.controls.possess(h.state); h.step(elapsed);
    for (let i = 1; i <= 18; i++) {
      const target = h.root.getObjectByName(`ceasefire-retreating-sentinel-${i}`)!.getWorldPosition(new THREE.Vector3());
      const point = target.clone().project(h.camera);
      assert.ok(Math.abs(point.x) < .94 && Math.abs(point.y) < .82 && point.z > -1 && point.z < 1,
        `${aspect}/${elapsed}/${i}: departing body outside frame ${point.toArray()}`);
    }
    const target = h.root.getObjectByName('ceasefire-retreating-sentinel-3')!.getWorldPosition(new THREE.Vector3()), direction = target.clone().sub(h.camera.position);
    const hits = new THREE.Raycaster(h.camera.position, direction.clone().normalize(), .06, direction.length() - 1.4)
      .intersectObject(h.scenery, true).filter(hit => {
        for (let object: THREE.Object3D | null = hit.object; object; object = object.parent) if (!object.visible) return false;
        return !(hit.object.material as THREE.Material).transparent;
      });
    assert.equal(hits.length, 0, `${aspect}/${elapsed}: scenery blocks the withdrawing swarm: ${hits.map(hit => `${hit.object.name}/${hit.object.parent?.name} at ${hit.point.toArray()}`)}`);
    const matrix = h.camera.matrixWorld.toArray(); h.step(elapsed); assert.deepEqual(h.camera.matrixWorld.toArray(), matrix, 'pause cannot move the shot');
    h.controls.possess(structuredClone(h.state)); h.step(elapsed);
    assert.deepEqual(h.camera.matrixWorld.toArray(), matrix, 'a restored shot must not depend on its previous frame');
  }
});

test('V looks outward and up toward the saved withdrawal, while the player can freely follow the ascent and retain that look', t => {
  const h = fixture(t);
  for (const aspect of [16 / 9, .65]) for (const elapsed of [0, 2.6, 4.9]) {
    h.camera.aspect = aspect; h.camera.updateProjectionMatrix(); h.controls.possess(h.state); h.step(elapsed); h.toggle(); h.step(elapsed);
    const target = h.root.getObjectByName('ceasefire-retreating-sentinel-3')!.getWorldPosition(new THREE.Vector3()), point = target.project(h.camera);
    assert.ok(Math.abs(point.x) < .9 && Math.abs(point.y) < .8 && point.z > -1 && point.z < 1, `${aspect}/${elapsed}: V must face the machines, ${point.toArray()}`);
    h.document.pointerLockElement = h.canvas;
    h.document.dispatchEvent(Object.assign(new Event('mousemove'), { movementX: 160, movementY: -2500 })); h.step(elapsed);
    const direction = h.camera.getWorldDirection(new THREE.Vector3()); assert.ok(direction.y > .8, 'Kid can look above the lintel to follow the machines');
    h.step(elapsed); assert.ok(h.camera.getWorldDirection(new THREE.Vector3()).distanceTo(direction) < 1e-7, 'saved animation must not overwrite a deliberate free look');
    h.document.pointerLockElement = null;
  }
});

test('the report and reunion shot faces the audience and keeps Kid, both pairs and the nearest listeners in wide and narrow frames', t => {
  const h = fixture(t), center = FILM_SETS.film_zion_temple.center;
  h.state.position = filmPosition('film_zion_temple', 0, 14); h.state.rotation = 0;
  for (const aspect of [16 / 9, .65]) for (const phase of ['announcement', 'embrace'] as const) {
    h.camera.aspect = aspect; h.camera.updateProjectionMatrix(); h.controls.possess(h.state); h.step(1.53, phase);
    assert.ok(h.camera.getWorldDirection(new THREE.Vector3()).z > .8, 'the empty entrance must not replace the reacting audience');
    for (const [x, z] of [[0, 14], [-6, 17], [-2.2, 17], [3, 19], [6.5, 19], [-11, 25], [11, 25]]) {
      const head = new THREE.Vector3(center.x + x, center.y - 1 + 4.4, center.z + z).project(h.camera);
      assert.ok(Math.abs(head.x) < .95 && Math.abs(head.y) < .8 && head.z > -1 && head.z < 1,
        `${aspect}/${phase}: report participant ${x},${z} outside the picture ${head.toArray()}`);
    }
    const matrix = h.camera.matrixWorld.toArray(); h.step(1.53, phase); assert.deepEqual(h.camera.matrixWorld.toArray(), matrix);
    h.controls.possess(structuredClone(h.state)); h.step(1.53, phase); assert.deepEqual(h.camera.matrixWorld.toArray(), matrix, 'cold reconnect keeps the saved shot');
  }
});

test('the ceasefire first-person camera uses Kid’s actual head and preserves mouse turning after the report', t => {
  const h = fixture(t); h.state.position = filmPosition('film_zion_temple', 0, 14); h.state.rotation = 0;
  h.player.position.copy(h.state.position); const head = new THREE.Group(); head.name = 'kid-head'; head.position.set(0, 3.4, .02); h.player.add(head);
  h.controls.possess(h.state); h.step(1.53, 'announcement'); h.toggle(); h.step(1.53, 'announcement'); h.controls.syncNeoCarryCamera(h.player);
  assert.ok(h.camera.position.distanceTo(head.localToWorld(new THREE.Vector3(0, 0, .27))) < 1e-7, 'the eye must not remain down at chest level');
  const before = h.camera.getWorldDirection(new THREE.Vector3()); h.document.pointerLockElement = h.canvas;
  h.document.dispatchEvent(Object.assign(new Event('mousemove'), { movementX: 250, movementY: -60 }));
  h.step(1.53, 'announcement'); h.controls.syncNeoCarryCamera(h.player);
  const direction = h.camera.getWorldDirection(new THREE.Vector3()); assert.ok(direction.distanceTo(before) > .3);
  h.step(1.53, 'announcement'); h.controls.syncNeoCarryCamera(h.player);
  assert.ok(h.camera.getWorldDirection(new THREE.Vector3()).distanceTo(direction) < 1e-7); h.document.pointerLockElement = null;
});
