import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, FREEWAY_HANDOFF, freewayHandoffRoot, newFreewayHandoff, newFreewayRide, type AgentState, type FreewayHandoff } from '@auto_matrix/shared';
import { FreewaySetRenderer } from '../packages/client/src/engine/FreewaySetRenderer.js';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

test('the handoff camera frames the three heads from the motorcycle side without the actual trailer blocking the riders', t => {
  class Target extends EventTarget { matches() { return false; } }
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  Object.assign(globalThis, { window: new Target(), document: Object.assign(new Target(), { pointerLockElement: null, hidden: false,
    createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {},
      fillRect() {}, strokeRect() {}, fillText() {}, createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }) }) }) }) });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const actor = world.agents.get('trinity')! as AgentState, group = new THREE.Group(); group.add(new THREE.Group());
  const camera = new THREE.PerspectiveCamera(64, 16 / 9, .06, 5000);
  const controls = new PlayerControls(new Target() as unknown as HTMLCanvasElement, camera, () => {}, () => {});
  const center = FILM_SETS.film_freeway_101.center, scenery = new THREE.Group(); scenery.position.set(center.x, center.y - 1, center.z);
  const renderer = new FreewaySetRenderer(scenery, FILM_SETS.film_freeway_101);
  t.after(() => { controls.dispose(); renderer.dispose(); ['window', 'document'].forEach((key, i) => {
    if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!); else Reflect.deleteProperty(globalThis, key);
  }); });
  const start = newFreewayHandoff({ ...newFreewayRide(), x: FREEWAY_HANDOFF.lane + FREEWAY_HANDOFF.side, z: -660, speed: 30 }); start.truck.z = -654.6;
  const seat = freewayHandoffRoot({ ...start, phase: 'reaching', elapsed: FREEWAY_HANDOFF.reach }, 'keymaker');
  for (const aspect of [16 / 9, .72]) for (const elapsed of [-1, .85, 1.5]) {
    const state: FreewayHandoff = { ...start, phase: elapsed < 0 ? 'approach' : 'lifting', elapsed: Math.max(0, elapsed), passengerStart: elapsed < 0 ? undefined : seat };
    const root = freewayHandoffRoot(state, 'trinity'); actor.position = { x: center.x + root.x, y: center.y + root.y, z: center.z + root.z };
    actor.rotation = root.yaw; actor.currentLocation = 'film_freeway_101';
    actor.currentAction = { type: 'idle', parameters: { freewayHandoff: { ...state, role: 'trinity' }, freewayRide: { ...state.bike, role: 'trinity' } }, startedAt: 1, duration: 1e9, progress: 0 };
    camera.aspect = aspect; controls.possess(actor); controls.update(0, actor, group, false); controls.syncFreewayPickupCamera(group); camera.updateWorldMatrix(true, true);
    renderer.update({ version: 1, scene: 'm2_freeway', actor: 'trinity', step: 2, completed: [], enteredAt: 1, checkpoint: actor.position, reflections: {}, lastText: '', freewayHandoff: state }, 0);
    scenery.updateWorldMatrix(true, true); const truck = scenery.getObjectByName('matrix-freeway-handoff-truck')!;
    for (const role of ['trinity', 'keymaker', 'morpheus'] as const) {
      const body = freewayHandoffRoot(state, role), point = new THREE.Vector3(center.x + body.x, center.y + body.y + (role === 'trinity' ? 2.25 : 2.8), center.z + body.z);
      const screen = point.clone().project(camera), ray = point.clone().sub(camera.position);
      assert.ok(Math.abs(screen.x) < .9 && Math.abs(screen.y) < .9 && screen.z > -1 && screen.z < 1, `${role} is cropped at aspect ${aspect}, lift ${elapsed}: ${screen.toArray()}`);
      const hits = new THREE.Raycaster(camera.position, ray.clone().normalize(), 0, ray.length() - .1).intersectObject(truck, true);
      assert.equal(hits.length, 0, `the real trailer blocks ${role} at aspect ${aspect}, lift ${elapsed}`);
    }
  }
});
