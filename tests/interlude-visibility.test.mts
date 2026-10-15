import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, interludeRoot, type InterludeGesture } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import type { CharacterRig } from '../packages/client/src/agents/CharacterModel.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

for (const kind of ['console', 'meal'] as const) test(`first-person ${kind} retains Neo's prop-bearing body while assets load and restores the ordinary view`, t => {
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {},
    createRadialGradient: () => ({ addColorStop() {} }),
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  t.after(() => { globalThis.document = previous; });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const neo = world.agents.get('neo')!;
  const gesture: InterludeGesture = { kind, phase: 'accepting', elapsed: 3, role: 'neo', physicalConsole: kind === 'console', physicalMeal: kind === 'meal' };
  const at = interludeRoot(kind, 'neo', gesture), center = FILM_SETS.film_neb_deck.center;
  neo.isInMatrix = false; neo.currentLocation = 'film_neb_deck'; neo.rotation = at.yaw;
  neo.position = { x: center.x + at.x, y: center.y, z: center.z + at.z };
  neo.currentAction = { type: 'idle', parameters: { interlude: gesture }, startedAt: 0, duration: 1, progress: 0 };
  const renderer = new AgentRenderer(new THREE.Scene()); t.after(() => renderer.dispose()); renderer.setWorld(false);
  renderer.updateAgent('neo', neo); renderer.setPlayer('neo', true);
  const motion = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 };
  renderer.setPlayerMotion({ ...motion, interlude: gesture }); renderer.update(0, undefined, 0, 0);
  const body = renderer.getAgentBody('neo')!;
  const rig = (renderer as unknown as { agents: Map<string, { rig: CharacterRig }> }).agents.get('neo')!.rig;
  assert.equal(body.visible, true, 'V must retain the body that owns the drinking or eating props');
  assert.equal(rig.head.visible, false, 'the loading fallback head must not cover the first-person lens');
  renderer.setPlayer('neo', false); renderer.update(0, undefined, 0, 0);
  assert.equal(body.visible, true); assert.equal(rig.head.visible, true, 'V restores the complete third-person character');
  renderer.setPlayer('neo', true); renderer.update(0, undefined, 0, 0);
  neo.currentAction = null; renderer.updateAgent('neo', neo); renderer.setPlayerMotion(motion); renderer.update(0, undefined, 0, 0);
  assert.equal(body.visible, false, 'ordinary first person retains its existing visibility after leaving the interaction');
  assert.equal(rig.head.visible, true, 'the temporary head mask must not persist into later poses');
});
