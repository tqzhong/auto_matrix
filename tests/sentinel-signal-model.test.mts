import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, type FilmJourney, type TunnelEncounter } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';

async function geometry(id: string) {
  const glb = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
  const length = glb.readUInt32LE(12), document = JSON.parse(glb.subarray(20, 20 + length).toString());
  for (const material of document.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = glb.subarray(20 + length), result = Buffer.alloc(20 + padded.length + bin.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); bin.copy(result, 20 + padded.length);
  return new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
}

test('Neo extends a real palm and lowers his delivered body continuously, with identical cold and paused poses', async t => {
  const ids = ['neo', 'neo-office', 'neo-tracking'], assets = await Promise.all(ids.map(geometry));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async (url: string) => assets[ids.indexOf(url.split('/').at(-1)!.replace('.glb', ''))]);
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
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const renderers: AgentRenderer[] = [];
  t.after(() => { controls.dispose(); renderers.forEach(renderer => renderer.dispose()); globalThis.document = originalDocument; globalThis.window = originalWindow; });
  const create = (player: boolean) => {
    const renderer = new AgentRenderer(new THREE.Scene()); renderer.setWorld(false); renderer.setPlayer(player ? 'neo' : null); renderers.push(renderer); return renderer;
  };
  const warm = create(true), cold = create(false), center = FILM_SETS.film_service_tunnels.center;
  const neo = structuredClone(world.agents.get('neo')!); neo.currentLocation = 'film_service_tunnels'; neo.isInMatrix = false;
  neo.position = { ...center, z: center.z - 25 }; neo.velocity = { x: 0, y: 0, z: 0 }; neo.rotation = 0; neo.currentAction = null;
  const save = (renderer: AgentRenderer, tunnel: TunnelEncounter, delta: number) => {
    renderer.updateAgent('neo', neo); renderer.getAgent('neo')!.position.copy(neo.position); renderer.getAgentBody('neo')!.rotation.y = 0;
    const journey: FilmJourney = { version: 1, scene: 'm2_stop_sentinels', actor: 'neo', step: 1, completed: [], enteredAt: 0,
      reflections: {}, lastText: '', checkpoint: neo.position, tunnel };
    renderer.update(delta, undefined, 0, 0, journey); return journey;
  };
  const bones = (renderer: AgentRenderer) => {
    const body = renderer.getAgentBody('neo')!; body.updateWorldMatrix(true, true); const result: Record<string, number[]> = {};
    body.traverse(object => { if (object instanceof THREE.Bone) result[object.name] = object.matrixWorld.elements.map(value => +value.toFixed(6)); });
    assert.ok(result.pelvis); return result;
  };
  const base: TunnelEncounter = { phase: 'stopping', remaining: 11, focus: 2.2, lastTick: 42, attempts: 0, age: 3.2, elapsed: .5 };
  save(warm, base, 0); save(cold, base, 0); await new Promise(resolve => setImmediate(resolve));
  for (const beat of [base, { ...base, phase: 'collapsing' as const, elapsed: 1.2 }, { ...base, phase: 'collapsed' as const, elapsed: 3.4 }]) {
    const journey = save(warm, beat, .1); save(cold, structuredClone(beat), 0);
    const expected = bones(cold); assert.deepEqual(bones(warm), expected, `${beat.phase}: saved pose is independent of player and render delta`);
    warm.update(.25, undefined, 0, 0, journey); assert.deepEqual(bones(warm), expected, 'paused save cannot continue to animate');
    const body = warm.getAgentBody('neo')!, head = body.getObjectByName('head')!.getWorldPosition(new THREE.Vector3()), palm = body.getObjectByName('wrist_R')!.getWorldPosition(new THREE.Vector3());
    if (beat.phase === 'stopping') assert.ok(palm.z - neo.position.z > 1.1, 'right palm must visibly extend toward the approaching machines');
    if (beat.phase === 'stopping') {
      warm.setPlayer('neo', true); warm.setPlayerMotion({ speed: 0, grounded: true, verticalVelocity: 0, turn: 0, signal: beat, realWorld: true });
      save(warm, beat, 0); assert.equal(warm.getAgentBody('neo')!.visible, true, 'first-person signal must retain the raised hand');
      warm.setPlayer('neo', false); save(warm, beat, 0);
    }
    const actor = { ...neo, currentAction: { type: 'move_to' as const, parameters: { resolved: true, signal: beat }, startedAt: 0, duration: 1e9, progress: 0 } };
    controls.possess(actor);
    if (beat.phase === 'collapsed') {
      controls.update(.5, actor, warm.getAgent('neo')!, false); camera.updateMatrixWorld(true);
      for (const name of ['head', 'pelvis', 'ankle_R']) {
        const onScreen = body.getObjectByName(name)!.getWorldPosition(new THREE.Vector3()).project(camera);
        assert.ok(Math.abs(onScreen.x) < .8 && onScreen.y > -.3 && onScreen.y < .6 && onScreen.z > -1 && onScreen.z < 1,
          `the fallen ${name} must remain above the lower HUD in third person: ${onScreen.toArray()}`);
      }
    }
    inputWindow.dispatchEvent(Object.assign(new Event('keydown'), { code: 'KeyV', repeat: false }));
    inputWindow.dispatchEvent(Object.assign(new Event('keyup'), { code: 'KeyV' }));
    controls.update(.016, actor, warm.getAgent('neo')!, false);
    warm.setPlayer('neo', true); warm.setPlayerMotion(controls.motion); save(warm, beat, 0);
    controls.syncSentinelSignalCamera?.(warm.getAgent('neo')!); camera.updateMatrixWorld(true);
    const animatedHead = body.getObjectByName('head')!, localEye = animatedHead.userData.cameraEye as THREE.Vector3 | undefined;
    const eye = animatedHead.localToWorld(localEye?.clone() ?? new THREE.Vector3(0, .1, .32));
    assert.ok(camera.position.distanceTo(eye) < .001, `${beat.phase}: first-person must follow the animated head, including paused V`);
    if (beat.phase === 'stopping') {
      const onScreen = body.getObjectByName('wrist_R')!.getWorldPosition(new THREE.Vector3()).project(camera);
      assert.ok(onScreen.x > .05 && onScreen.x < .9 && Math.abs(onScreen.y) < .65 && onScreen.z > -1 && onScreen.z < 1,
        `the actual right palm must be visible above the lower HUD: ${onScreen.toArray()}, eye ${eye.toArray()}, palm ${body.getObjectByName('wrist_R')!.getWorldPosition(new THREE.Vector3()).toArray()}`);
    }
    if (beat.phase === 'collapsed') assert.ok(camera.getWorldDirection(new THREE.Vector3()).y > .7, 'the fallen eye should face upward rather than remain a standing camera');
    warm.setPlayer('neo', false); save(warm, beat, 0);
    if (beat.phase === 'collapsed') {
      assert.ok(head.y < center.y + 1, `the actual head is still upright at ${head.y - center.y}`);
      let lowest = Infinity;
      body.traverseVisible(object => {
        if (!(object instanceof THREE.SkinnedMesh)) return; object.skeleton.update();
        for (let i = 0; i < object.geometry.attributes.position.count; i++) lowest = Math.min(lowest, object.localToWorld(object.getVertexPosition(i, new THREE.Vector3())).y);
      });
      assert.ok(lowest >= center.y - 1 - .015, `body penetrates the tunnel floor by ${center.y - 1 - lowest}`);
      assert.ok(lowest < center.y - 1 + .12, `body floats ${lowest - (center.y - 1)} above the floor`);
    }
  }
});
