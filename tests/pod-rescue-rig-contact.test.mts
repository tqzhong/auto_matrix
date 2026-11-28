import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, awakeningPose, filmPosition, podRescuePose, type FilmJourney } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { PodSetRenderer } from '../packages/client/src/engine/PodSetRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

async function loadGeometry(id: string) {
  const glb = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
  const jsonLength = glb.readUInt32LE(12), document = JSON.parse(glb.subarray(20, 20 + jsonLength).toString());
  for (const material of document.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = glb.subarray(20 + jsonLength), result = Buffer.alloc(20 + padded.length + bin.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); bin.copy(result, 20 + padded.length);
  return new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
}

test('the rescue arms, housing and support pads clear the shipped patient skin during pickup and release', async t => {
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking'].map(async id => [id, await loadGeometry(id)] as const)));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async (url: string) => assets.get(url.split('/').pop()!.replace(/\.glb.*$/, ''))!);
  const originalDocument = globalThis.document;
  const context = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!; neo.currentLocation = 'film_power_plant_pods'; neo.isInMatrix = false; neo.rotation = Math.PI;
  const scene = new THREE.Scene(), renderer = new AgentRenderer(scene), root = new THREE.Group(); scene.add(root);
  const center = FILM_SETS.film_power_plant_pods.center; root.position.set(center.x, center.y - 1, center.z);
  const set = new PodSetRenderer(root);
  t.after(() => { renderer.dispose(); set.dispose(); globalThis.document = originalDocument; });
  const at = (elapsed: number) => {
    const beat = { kind: 'rescue' as const, elapsed }, pose = awakeningPose(beat), journey = { scene: 'm1_pod', awakening: beat } as FilmJourney;
    neo.position = filmPosition(neo.currentLocation, pose.x, pose.z); neo.position.y += pose.y;
    neo.currentAction = { type: 'idle', parameters: { filmPose: pose.pose, podRescue: elapsed }, startedAt: 0, duration: 1, progress: 0 };
    renderer.updateAgent('neo', neo); renderer.setWorld(false);
    renderer.getAgent('neo')!.position.set(neo.position.x, neo.position.y, neo.position.z);
    renderer.getAgentBody('neo')!.rotation.y = Math.PI;
    renderer.update(0, undefined, 0, 0, journey);
    const body = renderer.getAgentBody('neo')!; set.update(journey, 100, false, body); scene.updateMatrixWorld(true); return body;
  };
  at(0); await new Promise(resolve => setImmediate(resolve)); at(0);
  const failures: unknown[] = [];
  for (const elapsed of [0, 1, 2, 2.7, 3.497, 6.2, 7.2, 8.6, 8.94, 9.4, 9.8, 10.8, 12.8]) {
    const body = at(elapsed), claw = root.getObjectByName('pod-rescue-claw')!;
    const parts: { mesh: THREE.Mesh; box: THREE.Box3 }[] = [];
    claw.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const material = object.material as THREE.Material; material.side = THREE.DoubleSide;
      if (object instanceof THREE.InstancedMesh) {
        for (let i = 0; i < object.count; i++) {
          const matrix = new THREE.Matrix4(); object.getMatrixAt(i, matrix);
          const mesh = new THREE.Mesh(object.geometry, material); mesh.name = `${object.name}:${i}`;
          mesh.matrixAutoUpdate = false; mesh.matrixWorld.copy(object.matrixWorld).multiply(matrix);
          object.geometry.computeBoundingBox(); const box = object.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld);
          parts.push({ mesh, box });
        }
      } else parts.push({ mesh: object, box: new THREE.Box3().setFromObject(object) });
    });
    const pads = parts.filter(part => part.mesh.name.startsWith('pod-rescue-pad-')).map(({ mesh }) => ({
      name: mesh.name, inverse: mesh.matrixWorld.clone().invert(), box: mesh.geometry.boundingBox!, gap: Infinity,
    }));
    const penetrating: { part: string; point: number[]; depth?: number }[] = []; let samples = 0;
    body.traverse(object => {
      if (!(object instanceof THREE.SkinnedMesh) || !object.visible || !(object.userData.patientBody || (object.material as THREE.Material).name === 'Skin')) return;
      object.skeleton.update(); const count = object.geometry.getAttribute('position').count;
      // Check every vertex at the exact paused gameplay pose, and sample the surrounding motion.
      for (let i = 0; i < count; i += elapsed === 8.94 ? 1 : 4) {
        const point = object.localToWorld(object.getVertexPosition(i, new THREE.Vector3())); samples++;
        for (const pad of pads) pad.gap = Math.min(pad.gap, pad.box.distanceToPoint(point.clone().applyMatrix4(pad.inverse)));
        for (const part of parts) {
          if (!part.box.containsPoint(point)) continue;
          const direction = new THREE.Vector3(1, .031, .017).normalize(), hit = new THREE.Raycaster(point, direction, .0001, 3).intersectObject(part.mesh, false)[0];
          if (!hit || hit.distance <= .006) continue;
          const normal = hit.face!.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(part.mesh.matrixWorld));
          if (normal.dot(direction) > .01) {
            const local = part.mesh.worldToLocal(point.clone()), box = part.mesh.geometry.boundingBox!;
            const depth = part.mesh.name.startsWith('pod-rescue-pad-')
              ? Math.min(local.x - box.min.x, box.max.x - local.x, local.y - box.min.y, box.max.y - local.y, local.z - box.min.z, box.max.z - local.z) : undefined;
            penetrating.push({ part: part.mesh.name || part.mesh.parent!.name, point: root.worldToLocal(point.clone()).toArray(), depth });
          }
        }
      }
    });
    assert.ok(samples > 500, 'the contact check must include the delivered skinned patient and face geometry');
    if (penetrating.length) failures.push({ elapsed, count: penetrating.length, maxDepth: Math.max(...penetrating.map(point => point.depth ?? 0)), examples: penetrating.slice(0, 2) });
    const rescue = podRescuePose(elapsed);
    if (rescue.grip === 1 && rescue.release === 0) for (const pad of pads)
      assert.ok(pad.gap < .015, `${pad.name} must still support the actual skin at ${elapsed}s, gap ${pad.gap}`);
  }
  assert.deepEqual(failures, [], `rescue rig penetrates the skin: ${JSON.stringify(failures)}`);
});
