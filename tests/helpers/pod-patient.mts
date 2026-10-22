import { readFile } from 'node:fs/promises';
import type { TestContext } from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, awakeningPose, filmPosition, type FilmJourney, type AwakeningBeat } from '@auto_matrix/shared';
import { AgentRenderer } from '../../packages/client/src/agents/AgentRenderer.js';
import { PodSetRenderer } from '../../packages/client/src/engine/PodSetRenderer.js';
import { WorldState } from '../../packages/server/src/world/WorldState.js';
import { AgentManager } from '../../packages/server/src/agents/AgentManager.js';
import type { HeroRig } from '../../packages/client/src/agents/HeroModel.js';

async function loadGeometry(id: string) {
  const glb = await readFile(new URL(`../../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
  const jsonLength = glb.readUInt32LE(12), document = JSON.parse(glb.subarray(20, 20 + jsonLength).toString());
  for (const material of document.materials) {
    delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture;
  }
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = glb.subarray(20 + jsonLength), result = Buffer.alloc(20 + padded.length + bin.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); bin.copy(result, 20 + padded.length);
  return new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
}

export async function podPatient(t: TestContext) {
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking'].map(async id => [id, await loadGeometry(id)] as const)));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async (path: string) => assets.get(path.split('/').pop()!.replace(/\.glb.*$/, ''))!);
  const document = globalThis.document;
  const context = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!; neo.currentLocation = 'film_power_plant_pods'; neo.isInMatrix = false; neo.rotation = Math.PI;
  const scene = new THREE.Scene(), renderer = new AgentRenderer(scene), root = new THREE.Group(); scene.add(root);
  const center = FILM_SETS.film_power_plant_pods.center; root.position.set(center.x, center.y - 1, center.z);
  const set = new PodSetRenderer(root);
  const at = (elapsed: number, wallTime = 100, firstPerson = false, saved?: AwakeningBeat | null) => {
    const awakening = saved === null ? undefined : saved ?? { kind: 'disconnect' as const, elapsed }, pose = awakeningPose(awakening);
    const journey = { scene: 'm1_pod', awakening } as FilmJourney;
    neo.position = filmPosition(neo.currentLocation, pose.x, pose.z); neo.position.y += pose.y;
    neo.currentAction = { type: 'idle', parameters: { filmPose: pose.pose }, startedAt: 0, duration: 1, progress: 0 };
    renderer.updateAgent('neo', neo); renderer.setWorld(false); renderer.setPlayer('neo', firstPerson);
    renderer.getAgent('neo')!.position.set(neo.position.x, neo.position.y, neo.position.z);
    renderer.getAgentBody('neo')!.rotation.y = Math.PI;
    renderer.update(0, undefined, 0, 0, journey);
    const body = renderer.getAgentBody('neo')!;
    set.update(journey, wallTime, firstPerson, body); scene.updateMatrixWorld(true);
    return body;
  };
  at(0); await new Promise(resolve => setImmediate(resolve)); at(0);
  t.after(() => { renderer.dispose(); set.dispose(); globalThis.document = document; });
  const rig = (renderer as unknown as { agents: Map<string, { rig: { hero: HeroRig } }> }).agents.get('neo')!.rig.hero;
  return { root, at, neo, renderer, rig, set };
}
