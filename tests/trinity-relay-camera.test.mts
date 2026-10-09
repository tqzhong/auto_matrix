import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, trinityRelayRoot, type AgentState, type TrinityRelayGesture } from '@auto_matrix/shared';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

test('the saved connection camera frames both bodies and footrests in wide and narrow viewports', t => {
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
  const center = FILM_SETS.film_neb_deck.center;
  t.after(() => { controls.dispose(); ['window', 'document'].forEach((key, i) => {
    if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!); else Reflect.deleteProperty(globalThis, key);
  }); });
  for (const aspect of [16 / 9, .72]) for (const elapsed of [0, 5, 10, 15]) {
    const gesture: TrinityRelayGesture = { phase: 'connecting', elapsed, role: 'trinity' }, root = trinityRelayRoot(gesture);
    actor.position = { x: center.x + root.x, y: center.y, z: center.z + root.z }; actor.rotation = root.yaw;
    actor.isInMatrix = false; actor.currentLocation = 'film_neb_deck';
    actor.currentAction = { type: 'idle', parameters: { trinityRelay: gesture }, startedAt: 1, duration: 1e9, progress: 0 };
    camera.aspect = aspect; controls.possess(actor); controls.update(0, actor, group, false); camera.updateWorldMatrix(true, true);
    for (const role of ['trinity', 'link'] as const) {
      const body = trinityRelayRoot({ ...gesture, role });
      for (const height of role === 'trinity' ? [.22, 2.8] : [1, 3.4]) {
        const point = new THREE.Vector3(center.x + body.x, center.y - 1 + height, center.z + body.z), screen = point.project(camera);
        assert.ok(Math.abs(screen.x) < .9 && Math.abs(screen.y) < .9 && screen.z > -1 && screen.z < 1,
          `${role}/${elapsed}/${height} cropped at aspect ${aspect}: ${screen.toArray()}`);
      }
    }
  }
});
