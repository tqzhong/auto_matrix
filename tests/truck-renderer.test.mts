import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, TRUCKS, truckRescuePose, type FilmJourney, type TruckEncounter } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { FreewaySetRenderer } from '../packages/client/src/engine/FreewaySetRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

async function loadGeometry(id = 'neo') {
  const glb = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
  const jsonLength = glb.readUInt32LE(12);
  const document = JSON.parse(glb.subarray(20, 20 + jsonLength).toString());
  // Decode the shipped geometry with the real loader, without a DOM/image
  // decoder. Material/texture appearance is checked in the browser.
  for (const material of document.materials) {
    delete material.pbrMetallicRoughness.baseColorTexture;
    delete material.normalTexture;
  }
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document));
  const padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = glb.subarray(20 + jsonLength);
  const result = Buffer.alloc(20 + padded.length + bin.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16);
  padded.copy(result, 20); bin.copy(result, 20 + padded.length);
  const asset = await new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
  if (id === 'keymaker-head') asset.scene.traverse(object => { if (object instanceof THREE.Mesh) (object.material as THREE.MeshStandardMaterial).map = new THREE.Texture(); });
  return asset;
}

test('the shipped rescue bodies and coat surfaces reconstruct the saved pose without a warm-up frame', async t => {
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking', 'morpheus'].map(async id => [id, await loadGeometry(id)] as const)));
  const loading: Promise<unknown>[] = [];
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async (path: string) => {
    const name = path.split('/').pop()!.replace(/\.glb.*$/, '');
    if (!name.startsWith('keymaker-')) return assets.get(name)!;
    const asset = loadGeometry(name); loading.push(asset); return asset;
  });
  const document = globalThis.document;
  const context = { createRadialGradient: () => ({ addColorStop() {} }), createLinearGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const center = FILM_SETS.film_freeway_trucks.center;
  const encounter: TruckEncounter = { phase: 'rescue', elapsed: 10, rescueElapsed: 1.5, lastTick: 0, attempt: 0 };
  const first = new AgentRenderer(new THREE.Scene()), cold = new AgentRenderer(new THREE.Scene());
  const roadRoot = new THREE.Group(); roadRoot.position.set(center.x, center.y - 1, center.z);
  const freeway = new FreewaySetRenderer(roadRoot, FILM_SETS.film_freeway_trucks);
  const journey: FilmJourney = { version: 1, scene: 'm2_trucks', actor: 'morpheus', step: 2, enteredAt: 0,
    completed: [], checkpoint: { x: center.x, y: center.y, z: center.z }, reflections: {}, lastText: '', trucks: encounter };
  const snapshot = (renderer: AgentRenderer) => ['neo', 'morpheus', 'keymaker'].map(id => {
    const body = renderer.getAgentBody(id)!; body.parent!.parent!.updateMatrixWorld(true);
    const points = createHash('sha256');
    body.traverse(object => {
      if (object instanceof THREE.Bone) points.update(JSON.stringify(object.matrixWorld.elements));
      if (object instanceof THREE.Mesh) points.update(Buffer.from(object.geometry.attributes.position.array.buffer));
    });
    return { rotation: body.rotation.toArray(), points: points.digest('hex') };
  });
  try {
    for (const role of ['neo', 'morpheus', 'keymaker'] as const) {
      const actor = world.agents.get(role)!, pose = truckRescuePose(encounter, role);
      actor.position = { x: center.x + pose.x, y: center.y + pose.y, z: center.z + pose.z };
      actor.velocity = { x: 15, y: 20, z: 30 }; actor.rotation = pose.yaw; actor.currentLocation = 'film_freeway_trucks'; actor.isInMatrix = true;
      actor.currentAction = { type: 'move_to', parameters: { truckFlight: role === 'neo', truckPassenger: role !== 'neo',
        truckRescue: { ...encounter, role } }, startedAt: 0, duration: 10, progress: .5 };
      first.updateAgent(role, actor); cold.updateAgent(role, structuredClone(actor));
    }
    await new Promise(resolve => setImmediate(resolve));
    first.update(.016); cold.update(0);
    await Promise.all(loading); await new Promise(resolve => setImmediate(resolve));
    first.update(0); cold.update(0);
    for (const renderer of [first, cold]) {
      assert.ok(renderer.getAgentBody('keymaker')!.getObjectByName('keymaker-detailed-body'), 'rescue checks must use the delivered Keymaker body');
      assert.ok(renderer.getAgentBody('keymaker')!.getObjectByName('keymaker-detailed-head'), 'rescue checks must use the delivered older head');
    }
    assert.ok(first.getAgentBody('neo')!.getObjectByName('pelvis'), 'exercise shipped GLB, not a proxy body');
    assert.equal(first.getAgentBody('morpheus')!.rotation.x, Math.PI / 2, 'Morpheus must fly prone');
    assert.equal(first.getAgentBody('keymaker')!.rotation.x, Math.PI / 2, 'Keymaker must fly prone');
    const saved = snapshot(first);
    assert.deepEqual(snapshot(cold), saved, 'a cold frame must have the same bones and clothing');
    first.update(.2); assert.deepEqual(snapshot(first), saved, 'same saved clock must freeze body, grips and cloth');
    const clocks = [0, .1, .2, .25, .35, .5, .6, .75, .9, 1.1, 1.3, 1.5, 1.8, 2, 2.3, 2.6, 2.8, 2.95, 3];
    const origins: TruckEncounter['starts'][] = [undefined, {
      morpheus: { x: 14.54971903830483, y: 6.6, z: 32.24859519151869, yaw: .1973955598493478 },
      keymaker: { x: 12.5, y: 6.6, z: 32.5, yaw: Math.PI / 2 },
      neo: { x: 14, y: 12.333333333333334, z: 22.888888888888687, yaw: 0 },
    }, {
      morpheus: { x: 14.59037920924311, y: 6.6, z: 32.45189604621464, yaw: .19739555984970342 },
      keymaker: { x: 12.5, y: 6.6, z: 32.5, yaw: Math.PI / 2 },
      neo: { x: 14, y: 23, z: -58, yaw: -Math.PI / 2 },
    }];
    let grips = 0;
    for (const { time, starts } of origins.flatMap(starts => clocks.map(time => ({ time, starts })))) {
      encounter.starts = starts;
      encounter.rescueElapsed = time;
      freeway.update(journey, time); roadRoot.updateWorldMatrix(true, true);
      for (const role of ['neo', 'morpheus', 'keymaker'] as const) {
        const actor = world.agents.get(role)!, pose = truckRescuePose(encounter, role);
        actor.position = { x: center.x + pose.x, y: center.y + pose.y, z: center.z + pose.z };
        actor.rotation = pose.yaw; actor.currentAction!.parameters.truckRescue = { ...encounter, role };
        first.updateAgent(role, actor);
      }
      first.update(0);
      for (const role of ['neo', 'morpheus', 'keymaker']) {
        const body = first.getAgentBody(role)!; body.parent!.parent!.updateMatrixWorld(true);
        let minimum = Infinity; const underside = new Map<string, THREE.Vector3>();
        body.traverseVisible(object => {
          if (!(object instanceof THREE.Mesh)) return;
          const vertices = object.geometry.getAttribute('position');
          for (let i = 0; i < vertices.count; i++) {
            const point = object.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(object.matrixWorld);
            const x = point.x - center.x, z = point.z - center.z;
            const overRoof = Math.abs(x - TRUCKS.roof.x) < TRUCKS.roof.width / 2 && Math.abs(z - TRUCKS.roof.z) < TRUCKS.roof.depth / 2;
            minimum = Math.min(minimum, point.y - (center.y - 1) - (overRoof ? TRUCKS.roof.height : 0));
            if (Math.abs(x - TRUCKS.roof.x) < 3.3 && z > 15 && z < 41) {
              const key = `${Math.round(x * 4)}:${Math.round(z * 4)}`;
              if (!underside.has(key) || underside.get(key)!.y > point.y) underside.set(key, point);
            }
          }
        });
        assert.ok(minimum > -.08, `${role} visible body penetrates roof/road by ${minimum} at ${time}s`);
        const trailer = roadRoot.getObjectByName('matrix-freeway-hero-truck-trailer')!;
        for (const point of underside.values()) {
          const ray = new THREE.Raycaster(new THREE.Vector3(point.x, center.y + 20, point.z), new THREE.Vector3(0, -1, 0));
          const surface = ray.intersectObject(trailer, true)[0];
          if (surface) assert.ok(point.y >= surface.point.y - .08,
            `${role} real skin/clothing enters the buckled trailer by ${surface.point.y - point.y} at ${time}s`);
        }
      }
      if (!starts && [1.3, 1.5, 1.8, 2.3].includes(time)) {
        const wrist = first.getAgentBody('neo')!.getObjectByName('wrist_R')!;
        const palm = wrist.localToWorld(new THREE.Vector3(.09, -.18, .02));
        const jacket = first.getAgentBody('keymaker')!.getObjectByName('keymaker-work-jacket') as THREE.SkinnedMesh;
        const local = jacket.worldToLocal(palm.clone()), index = jacket.geometry.index!, triangle = new THREE.Triangle();
        let distance = Infinity;
        for (let i = 0; i < index.count; i += 3) {
          jacket.getVertexPosition(index.getX(i), triangle.a); jacket.getVertexPosition(index.getX(i + 1), triangle.b); jacket.getVertexPosition(index.getX(i + 2), triangle.c);
          distance = Math.min(distance, jacket.localToWorld(triangle.closestPointToPoint(local, new THREE.Vector3())).distanceTo(palm));
        }
        grips++;
        assert.ok(distance < .12, `Neo's palm misses the delivered Keymaker jacket by ${distance} at ${time}s`);
      }
    }
    assert.equal(grips, 4, 'sample the actual palm against the delivered coat during the carry');
    const approaching = world.agents.get('neo')!;
    approaching.currentAction!.parameters = { truckFlight: true };
    first.updateAgent('neo', approaching); first.update(0);
    assert.equal(first.getAgentBody('neo')!.rotation.x, Math.PI / 2, 'paused approach saves must not stand Neo upright in the air');
  } finally { first.dispose(); cold.dispose(); freeway.dispose(); globalThis.document = document; }
});
