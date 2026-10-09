import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, MOBIL_LUGGAGE, mobilLuggagePose, mobilLuggageParent, mobilTrainObstacles, type MobilEncounter, type MobilLuggage } from '@auto_matrix/shared';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { MobilStationRenderer } from '../packages/client/src/engine/MobilStationRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

async function geometry(name: string) {
  const bytes = await readFile(new URL(`../packages/client/public/assets/characters/${name}.glb`, import.meta.url));
  const length = bytes.readUInt32LE(12), source = JSON.parse(bytes.subarray(20, 20 + length).toString());
  for (const material of source.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
  source.images = []; source.textures = [];
  const json = Buffer.from(JSON.stringify(source)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const binary = bytes.subarray(20 + length), result = Buffer.alloc(20 + padded.length + binary.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); binary.copy(result, 20 + padded.length);
  const asset = await new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
  if (name.endsWith('-head')) asset.scene.traverse(object => { if (object instanceof THREE.Mesh) (object.material as THREE.MeshStandardMaterial).map = new THREE.Texture(); });
  return asset;
}

test('the shipped Neo and Rama bodies actually grasp the rendered handle and keep the suitcase outside their clothing', async t => {
  const assets = Object.fromEntries(await Promise.all(['neo', 'neo-office', 'neo-tracking', 'rama_kandra-head', 'rama_kandra-body'].map(async name => [name, await geometry(name)])));
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async url => assets[String(url).split('/').pop()!.replace('.glb', '')]);
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {},
    createRadialGradient: () => ({ addColorStop() {} }), createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const models = new CharacterModels(), root = new THREE.Group(), station = new MobilStationRenderer(root), center = FILM_SETS.film_mobil_station.center;
  root.position.set(center.x, center.y - 1, center.z);
  const neo = models.create(world.agents.get('neo')!), rama = models.create(world.agents.get('rama_kandra')!);
  t.after(() => { models.dispose(); station.dispose(); globalThis.document = previous; });
  models.animate(neo, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 }, 0);
  models.animate(rama, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 }, 0);
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(neo.hero, 'the real Neo GLB must be loaded before checking contact');
  const luggage: MobilLuggage = { phase: 'lifting', elapsed: 0, approach: { x: -10.8, z: -10, yaw: -Math.PI / 2 },
    floor: { x: 5.8, z: -21.5, yaw: Math.PI / 2 }, parentFrom: { x: 5.9, z: -19.5, yaw: Math.PI / 2 } };
  const encounter: MobilEncounter = { phase: 'stopped', elapsed: 1, lastTick: 0, loops: 0, luggage };
  for (const [role, phase, elapsed] of [
    ['neo', 'lifting', .55], ['neo', 'lifting', .8], ['neo', 'lifting', 1.05], ['neo', 'lifting', 1.3], ['neo', 'lifting', 1.6], ['neo', 'lifting', 1.9], ['neo', 'carried', 0],
    ['rama_kandra', 'retrieving', 1.25], ['rama_kandra', 'retrieving', 1.45], ['rama_kandra', 'retrieving', 1.8], ['rama_kandra', 'retrieving', 2.25], ['rama_kandra', 'retrieving', 2.6],
    ['rama_kandra', 'returned', .25], ['rama_kandra', 'returned', .9], ['rama_kandra', 'returned', 1.4], ['rama_kandra', 'returned', 1.6], ['rama_kandra', 'returned', 1.8], ['rama_kandra', 'returned', 2.1], ['rama_kandra', 'returned', 2.4], ['rama_kandra', 'returned', 2.8],
  ] as const) {
    luggage.phase = phase; luggage.elapsed = elapsed;
    const rig = role === 'neo' ? neo : rama, position = role === 'neo' ? { ...luggage.approach!, y: 0 } : mobilLuggageParent(luggage);
    rig.root.position.set(center.x + position.x, center.y - 1, center.z + position.z); rig.root.rotation.y = position.yaw;
    const input = { speed: role === 'rama_kandra' && phase === 'returned' && elapsed < MOBIL_LUGGAGE.return ? 3.9 : 0,
      grounded: true, verticalVelocity: 0, turn: 0, mobilStation: true, mobilLuggage: { role, luggage } };
    models.animate(rig, .1, input, 0); rig.root.updateWorldMatrix(true, true); station.update(encounter, neo.root, rama.root); root.updateMatrixWorld(true);
    const palm = (rig.hero?.bones.get('wrist_R') ?? rig.mobilWrists![0]).localToWorld(new THREE.Vector3(0, role === 'neo' ? -.19 : -.14, role === 'neo' ? .035 : -.05));
    const planned = mobilLuggagePose(luggage, position).grip;
    const target = new THREE.Vector3(center.x + planned.x, center.y - 1 + planned.y, center.z + planned.z);
    assert.ok(palm.distanceTo(target) < .04, `${role}/${phase}/${elapsed}: the real palm cannot reach the lift: ${palm.distanceTo(target)}; palm ${palm.toArray()}; target ${target.toArray()}; shoulder ${(rig.hero?.bones.get('shoulder_R') ?? rig.shoulders[0]).getWorldPosition(new THREE.Vector3()).toArray()}`);
    const handle = station.luggage.getObjectByName('mobil-suitcase-grip')!.getWorldPosition(new THREE.Vector3());
    assert.ok(palm.distanceTo(handle) < .01, 'the rendered handle must follow the actual hand, rather than a separate approximate target');
    const paused = palm.clone(); models.animate(rig, 0, input, 0); rig.root.updateWorldMatrix(true, true);
    const wrist = rig.hero?.bones.get('wrist_R') ?? rig.mobilWrists![0];
    assert.ok(wrist.localToWorld(new THREE.Vector3(0, role === 'neo' ? -.19 : -.14, role === 'neo' ? .035 : -.05)).distanceTo(paused) < .001,
      'a zero-time saved pose must not depend on the animation history');
    let lowest = Infinity; const inside: string[] = [];
    rig.root.traverseVisible(object => {
      if (!(object instanceof THREE.Mesh)) return;
      if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
      for (let v = 0; v < object.geometry.attributes.position.count; v++) {
        const point = object.localToWorld(object.getVertexPosition(v, new THREE.Vector3())); lowest = Math.min(lowest, point.y);
        station.luggage.worldToLocal(point);
        if (Math.abs(point.x) < MOBIL_LUGGAGE.width / 2 - .025 && Math.abs(point.z) < MOBIL_LUGGAGE.depth / 2 - .025
          && point.y > .025 && point.y < MOBIL_LUGGAGE.height - .025) inside.push(`${object.name || (object.material as THREE.Material).name}:${point.toArray()}`);
      }
    });
    assert.ok(lowest >= center.y - 1 - .025, `${role}/${elapsed}: the actual body or clothes penetrate the floor: ${lowest}`);
    assert.deepEqual(inside, [], `${role}/${elapsed}: the actual loaded body or clothes pass through the suitcase`);
    if (role === 'rama_kandra' && phase === 'returned') {
      const bounds = new THREE.Box3().setFromObject(station.luggage);
      for (const obstacle of mobilTrainObstacles(encounter)) {
        const frame = new THREE.Box3(new THREE.Vector3(center.x + obstacle.x - obstacle.width / 2, center.y - 1, center.z + obstacle.z - obstacle.depth / 2),
          new THREE.Vector3(center.x + obstacle.x + obstacle.width / 2, center.y - 1 + obstacle.height, center.z + obstacle.z + obstacle.depth / 2));
        assert.ok(!bounds.intersectsBox(frame), `Rama/${elapsed}: the actual suitcase crosses the train's ${obstacle.id} geometry`);
      }
    }
  }
});
