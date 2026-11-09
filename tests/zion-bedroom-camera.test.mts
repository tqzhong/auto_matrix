import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, filmPosition } from '@auto_matrix/shared';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { ZionHomecomingRenderer } from '../packages/client/src/engine/ZionHomecomingRenderer.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';

test('the actual bedroom rocks cannot cover the player or Trinity when looking toward the saved dream conversation', t => {
  class InputTarget extends EventTarget { matches() { return false; } }
  const window = new InputTarget(), canvas = new InputTarget(), document = Object.assign(new InputTarget(), {
    pointerLockElement: null as unknown, hidden: false, exitPointerLock() {}, createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }) }) });
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key)); Object.assign(globalThis, { window, document });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const state = world.agents.get('neo')!;
  Object.assign(state, { currentLocation: 'film_zion_bedroom', isInMatrix: false, currentAction: null });
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000), group = new THREE.Group(), center = FILM_SETS.film_zion_bedroom.center;
  const root = new THREE.Group(); root.position.set(center.x, center.y - 1, center.z);
  const renderer = new ZionHomecomingRenderer(root, 'film_zion_bedroom', 'm2_room');
  const controls = new PlayerControls(canvas as unknown as HTMLCanvasElement, camera, () => {}, () => {});
  let time = 2000; t.mock.method(performance, 'now', () => time);
  t.after(() => { renderer.dispose(); controls.dispose(); ['window', 'document'].forEach((key, i) => {
    if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!); else Reflect.deleteProperty(globalThis, key);
  }); });
  for (const aspect of [16 / 9, .65]) for (const z of [1.2, -4.25568300244]) for (const first of [false, true]) {
    camera.aspect = aspect; camera.updateProjectionMatrix(); state.position = filmPosition('film_zion_bedroom', 0, z); state.rotation = Math.atan2(2, -8 - z);
    controls.firstPerson = first; controls.possess(state);
    for (let frame = 0; frame < 12; frame++) { time += 50; controls.update(.05, state, group, false); controls.syncTrainmanChaseCamera(group, root); }
    camera.updateMatrixWorld(true); root.updateMatrixWorld(true);
    const points = [new THREE.Vector3(center.x + 2, center.y + 2.2, center.z - 8)];
    if (!first) for (const x of [-.35, 0, .35]) for (const y of [1.4, 2.2, 3.1]) points.push(new THREE.Vector3(center.x + x, center.y + y, center.z + z));
    for (const target of points) {
      const screen = target.clone().project(camera); assert.ok(Math.abs(screen.x) < .98 && Math.abs(screen.y) < .98 && screen.z > -1 && screen.z < 1, `${aspect}/${z}/${first}: conversation outside the frame`);
      const direction = target.clone().sub(camera.position), hits = new THREE.Raycaster(camera.position, direction.clone().normalize(), .1, direction.length() - .15).intersectObject(root, true);
      assert.equal(hits.length, 0, `${aspect}/${z}/${first}: camera ${camera.position.toArray()} target ${target.toArray()} blocked by ${hits.map(hit => `${hit.object.name}/${hit.object.parent?.name} at ${hit.point.toArray()}`)}`);
    }
  }
});
