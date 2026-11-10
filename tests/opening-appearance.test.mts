import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SCENE_BY_ID, filmEntry, type FilmJourney } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import type { CharacterRig } from '../packages/client/src/agents/CharacterModel.js';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { actor } from './helpers/fighting-hand-fixture.mts';

for (const controlled of [false, true]) test(`the ${controlled ? 'controlled' : 'autonomous'} Trinity keeps her opening bare eyes through cold scenes and restores her later sunglasses`, async t => {
  const source = await actor('trinity'), pending: Promise<unknown>[] = [];
  t.mock.method(GLTFLoader.prototype, 'loadAsync', url => {
    const name = String(url).split('/').pop()!.replace('.glb', '');
    const loading = source.models['load'](name); pending.push(loading); return loading;
  });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  class Target extends EventTarget { matches() { return false; } }
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  Object.assign(globalThis, { window: new Target(), document: Object.assign(new Target(), {
    pointerLockElement: null, hidden: false, exitPointerLock() {},
    createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {},
      createRadialGradient: () => ({ addColorStop() {} }),
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }),
  }) });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const trinity = world.agents.get('trinity')!; trinity.isInMatrix = true;
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000);
  const controls = new PlayerControls(new Target() as unknown as HTMLCanvasElement, camera, () => {}, () => {});
  const renderers: AgentRenderer[] = [];
  t.after(() => {
    controls.dispose(); renderers.forEach(renderer => renderer.dispose()); source.models.dispose();
    ['window', 'document'].forEach((key, i) => {
      if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!); else Reflect.deleteProperty(globalThis, key);
    });
  });
  for (const id of ['m1_room303', 'm1_roofs', 'm1_phone_escape']) {
    const film = FILM_SCENE_BY_ID[id]; trinity.position = filmEntry(film); trinity.currentLocation = film.set;
    trinity.rotation = Math.PI; trinity.currentAction = null;
    camera.position.set(trinity.position.x + 5, trinity.position.y + 3, trinity.position.z + 9);
    const journey = { version: 1, scene: id, actor: 'trinity', step: 0, completed: [], enteredAt: 0,
      reflections: {}, lastText: '', checkpoint: { ...trinity.position } } as FilmJourney;
    const renderer = new AgentRenderer(new THREE.Scene()); renderers.push(renderer);
    renderer.updateAgent('trinity', trinity);
    for (let frame = 0; frame < 6; frame++) { await Promise.all(pending); await new Promise(resolve => setImmediate(resolve)); }
    const rig = (renderer as unknown as { agents: Map<string, { rig: CharacterRig }> }).agents.get('trinity')!.rig;
    assert.ok(rig.hero, 'check the delivered Trinity model after a direct cold entry');
    for (const firstPerson of [false, true, false]) {
      if (controlled) {
        controls.possess(trinity); controls.firstPerson = firstPerson;
        controls.update(0, trinity, renderer.getAgent('trinity'), false);
        assert.equal(controls.motion.glasses, false, `${id}: possession must retain the film appearance`);
        renderer.setPlayer('trinity', firstPerson); renderer.setPlayerMotion(controls.motion);
      }
      renderer.update(0, camera, 0, 1, journey);
      assert.equal(rig.hero.glasses.visible, false, `${id}: ${firstPerson ? 'first' : 'third'} person must not add sunglasses`);
    }
    trinity.currentLocation = 'film_government_lobby'; renderer.updateAgent('trinity', trinity);
    if (controlled) {
      controls.update(0, trinity, renderer.getAgent('trinity'), false);
      assert.equal(controls.motion.glasses, true, 'the later Matrix costume keeps its sunglasses');
      renderer.setPlayerMotion(controls.motion);
    }
    renderer.update(0, camera, 0, 1);
    assert.equal(rig.hero.glasses.visible, true, 'the opening exception must clear when leaving the three opening sets');
  }
});
