import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, mobilRefusalPose, type FilmJourney } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';

async function neoGeometry() {
  const glb = await readFile(new URL('../packages/client/public/assets/characters/neo.glb', import.meta.url));
  const length = glb.readUInt32LE(12), document = JSON.parse(glb.subarray(20, 20 + length).toString());
  for (const material of document.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = glb.subarray(20 + length), result = Buffer.alloc(20 + padded.length + bin.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); bin.copy(result, 20 + padded.length);
  return new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
}

test('the delivered Neo body follows the saved Mobil strike, stays above its floor and follows the eye in first person', async t => {
  const asset = await neoGeometry();
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async () => asset);
  const originalDocument = globalThis.document, originalWindow = globalThis.window;
  const context = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {} };
  class InputTarget extends EventTarget { matches() { return false; } }
  const inputWindow = new InputTarget(), canvas = new InputTarget();
  globalThis.window = inputWindow as unknown as Window & typeof globalThis;
  globalThis.document = Object.assign(new InputTarget(), { pointerLockElement: null, hidden: false,
    createElement: () => ({ width: 0, height: 0, getContext: () => context }) }) as unknown as Document;
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000);
  const controls = new PlayerControls(canvas as unknown as HTMLCanvasElement, camera, () => {}, () => {});
  const warm = new AgentRenderer(new THREE.Scene()), cold = new AgentRenderer(new THREE.Scene());
  t.after(() => { controls.dispose(); warm.dispose(); cold.dispose(); globalThis.document = originalDocument; globalThis.window = originalWindow; });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const center = FILM_SETS.film_mobil_station.center, neo = structuredClone(world.agents.get('neo')!);
  neo.currentLocation = 'film_mobil_station'; neo.isInMatrix = true; neo.rotation = Math.PI / 2; neo.velocity = { x: 0, y: 0, z: 0 };
  const save = (renderer: AgentRenderer, elapsed: number, delta: number) => {
    const pose = mobilRefusalPose(elapsed);
    neo.position = { x: center.x + pose.x, y: center.y + pose.y, z: center.z + pose.z };
    neo.currentAction = { type: 'defend', parameters: { player: true, resolved: true, mobilRefusal: { role: 'neo', elapsed } }, startedAt: 42, duration: 4.8, progress: elapsed / 4.8 };
    renderer.updateAgent('neo', neo); renderer.getAgent('neo')!.position.copy(neo.position); renderer.getAgentBody('neo')!.rotation.y = neo.rotation;
    const journey: FilmJourney = { version: 1, scene: 'm3_trainman', actor: 'neo', step: 2, completed: [], enteredAt: 0,
      reflections: {}, lastText: '', checkpoint: neo.position, mobil: { phase: 'refusing', elapsed, lastTick: 42, loops: 0 } };
    renderer.update(delta, undefined, 42, 0, journey); return journey;
  };
  const bones = (renderer: AgentRenderer) => {
    const body = renderer.getAgentBody('neo')!; body.updateWorldMatrix(true, true); const result: Record<string, number[]> = {};
    body.traverse(object => { if (object instanceof THREE.Bone) result[object.name] = object.matrixWorld.elements.map(value => +value.toFixed(6)); });
    assert.ok(result.pelvis); return result;
  };
  save(warm, 0, 0); save(cold, 0, 0); await new Promise(resolve => setImmediate(resolve));
  for (const elapsed of [.55, .9, 1.45, 2.4, 3.5, 4.4]) {
    const journey = save(warm, elapsed, .1); save(cold, elapsed, 0);
    assert.deepEqual(bones(warm), bones(cold), `cold and warm bones differ at ${elapsed}`);
    const paused = bones(warm); warm.update(.3, undefined, 42, 0, journey);
    assert.deepEqual(bones(warm), paused, 'a paused strike must not advance');
    const body = warm.getAgentBody('neo')!;
    if (elapsed >= 1.4) {
      let lowest = Infinity, left = Infinity;
      body.traverseVisible(object => {
        if (!(object instanceof THREE.SkinnedMesh)) return;
        object.skeleton.update();
        for (let i = 0; i < object.geometry.attributes.position.count; i++) {
          const vertex = object.localToWorld(object.getVertexPosition(i, new THREE.Vector3()));
          lowest = Math.min(lowest, vertex.y); left = Math.min(left, vertex.x);
        }
      });
      assert.ok(lowest >= center.y - 1 - .015, `body penetrates the platform at ${elapsed}: ${lowest}`);
      assert.ok(left >= center.x - 16.77, `body penetrates the tiled wall at ${elapsed}: ${left}`);
      if (elapsed === 2.4) assert.ok(lowest < center.y - 1 + .12, 'the fallen body must be supported, without floating');
    }
    controls.possess(neo); inputWindow.dispatchEvent(Object.assign(new Event('keydown'), { code: 'KeyV', repeat: false }));
    inputWindow.dispatchEvent(Object.assign(new Event('keyup'), { code: 'KeyV' })); controls.update(.016, neo, warm.getAgent('neo')!, false);
    controls.syncMobilRefusalCamera(warm.getAgent('neo')!);
    const head = body.getObjectByName('head')!, eye = head.localToWorld((head.userData.cameraEye as THREE.Vector3).clone());
    assert.ok(camera.position.distanceTo(eye) < .001, 'the first-person camera follows the actual posed head');
    if (elapsed === 2.4) assert.ok(camera.getWorldDirection(new THREE.Vector3()).y > .7, 'fallen Neo looks up, rather than retaining a standing eye');
    controls.release();
  }
});
