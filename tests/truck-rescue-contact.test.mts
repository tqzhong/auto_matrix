import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CharacterModels, type CharacterRig } from '../packages/client/src/agents/CharacterModel.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { TRUCKS, truckRescuePose, type TruckEncounter, type TruckRescueRole } from '../packages/shared/src/constants/trucks.js';
import { poseTruckRescue } from '../packages/client/src/agents/TruckRescueContact.js';

async function actors(t: test.TestContext) {
  const assets = new Map();
  for (const id of ['neo', 'morpheus', 'neo-office', 'neo-tracking']) {
    const glb = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
    const length = glb.readUInt32LE(12), source = JSON.parse(glb.subarray(20, 20 + length).toString());
    for (const material of source.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
    source.images = []; source.textures = [];
    const json = Buffer.from(JSON.stringify(source)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
    const bin = glb.subarray(20 + length), buffer = Buffer.alloc(20 + padded.length + bin.length);
    buffer.writeUInt32LE(0x46546c67, 0); buffer.writeUInt32LE(2, 4); buffer.writeUInt32LE(buffer.length, 8);
    buffer.writeUInt32LE(padded.length, 12); buffer.writeUInt32LE(0x4e4f534a, 16); padded.copy(buffer, 20); bin.copy(buffer, 20 + padded.length);
    assets.set(id, await new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), ''));
  }
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async (url: string) => assets.get(url.split('/').pop()!.replace('.glb', '')));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {},
  }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  t.after(() => { models.dispose(); globalThis.document = previousDocument; });
  const rigs = Object.fromEntries(['neo', 'morpheus', 'keymaker'].map(id => [id, models.create(world.agents.get(id)!)])) as Record<TruckRescueRole, CharacterRig>;
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(rigs.neo.hero && rigs.morpheus.hero && !rigs.keymaker.hero);
  const groups = Object.fromEntries(Object.entries(rigs).map(([id, rig]) => {
    const group = new THREE.Group(); group.add(rig.root); rig.root.position.y = -1; return [id, group];
  })) as Record<TruckRescueRole, THREE.Group>;
  const draw = (encounter: TruckEncounter) => {
    for (const role of ['neo', 'morpheus', 'keymaker'] as const) {
      const rig = rigs[role], pose = truckRescuePose(encounter, role);
      groups[role].position.set(pose.x, pose.y, pose.z);
      rig.root.rotation.set(Math.PI / 2 * pose.airborne, pose.yaw, pose.tumble);
      models.animate(rig, 0, { speed: 0, grounded: false, verticalVelocity: 0, turn: 0, truckRescue: { ...encounter, role } }, 0);
      (rig.hero?.bones.get('head') ?? rig.head).rotation.x = -1.05 * pose.airborne;
      groups[role].updateMatrixWorld(true);
      rig.root.traverse(object => { if (object instanceof THREE.SkinnedMesh) { object.skeleton.update(); object.computeBoundingBox(); object.computeBoundingSphere(); } });
    }
  };
  return { rigs, draw };
}

function shoulderSurface(rig: CharacterRig, side: number): THREE.Vector3 {
  const chest = rig.hero?.bones.get('chest') ?? rig.torso;
  const start = chest.localToWorld(new THREE.Vector3(side * .32, rig.hero ? .3 : 1.45, -1));
  const direction = new THREE.Vector3(0, 0, 1).transformDirection(chest.matrixWorld);
  const ray = new THREE.Raycaster(start, direction, 0, 1.5);
  const hit = ray.intersectObject(rig.root, true).find(hit => {
    for (let object: THREE.Object3D | null = hit.object; object; object = object.parent) if (!object.visible) return false;
    return hit.object instanceof THREE.Mesh;
  });
  assert.ok(hit, 'the contact ray must meet the delivered shoulder clothing');
  return hit.point;
}

test('Neo holds both actual shoulder surfaces during the truck rescue without stretching his arms', async t => {
  const h = await actors(t), neo = h.rigs.neo.hero!;
  const lengths = Object.fromEntries(['elbow_L', 'elbow_R', 'wrist_L', 'wrist_R'].map(name => [name, neo.bones.get(name)!.position.clone()]));
  for (const rescueElapsed of [1.3, 1.4, 1.6, 1.9, 2.2, 2.59]) {
    const encounter: TruckEncounter = { phase: 'rescue', elapsed: 9.7, rescueElapsed, lastTick: 0, attempt: 0 };
    h.draw(encounter);
    poseTruckRescue(neo, h.rigs.morpheus, h.rigs.keymaker, encounter);
    neo.root.updateMatrixWorld(true);
    for (const [role, side, inside] of [['morpheus', 'L', -1], ['keymaker', 'R', 1]] as const) {
      const target = shoulderSurface(h.rigs[role], inside), wrist = neo.bones.get(`wrist_${side}`)!;
      const palm = wrist.localToWorld(new THREE.Vector3(side === 'R' ? .09 : -.09, -.18, .02));
      assert.ok(palm.distanceTo(target) < .025, `${side}/${rescueElapsed} misses ${role}'s delivered shoulder by ${palm.distanceTo(target)}`);
      let nearest = Infinity, sampled = 0; const point = new THREE.Vector3();
      neo.root.traverseVisible(object => {
        if (!(object instanceof THREE.SkinnedMesh) || (object.material as THREE.Material).name !== 'Skin') return;
        const indices = object.geometry.attributes.skinIndex, weights = object.geometry.attributes.skinWeight;
        for (let v = 0; v < object.geometry.attributes.position.count; v++) {
          if (![0, 1, 2, 3].some(j => weights.getComponent(v, j) > .5 && object.skeleton.bones[indices.getComponent(v, j)]?.name === `wrist_${side}`)) continue;
          sampled++; object.getVertexPosition(v, point); object.localToWorld(point); nearest = Math.min(nearest, point.distanceTo(target));
        }
      });
      assert.ok(sampled > 20 && nearest < .065, `${side}/${rescueElapsed} actual palm skin floats from ${role}'s coat by ${nearest}`);
    }
    for (const [name, position] of Object.entries(lengths)) assert.deepEqual(neo.bones.get(name)!.position, position, 'IK must preserve both anatomical arm lengths');
    const bounds = (['morpheus', 'keymaker'] as const).map(role => {
      const box = new THREE.Box3(), point = new THREE.Vector3();
      h.rigs[role].root.traverseVisible(object => {
        if (!(object instanceof THREE.Mesh)) return;
        for (let v = 0; v < object.geometry.attributes.position.count; v++) {
          object.getVertexPosition(v, point); object.localToWorld(point); box.expandByPoint(point);
        }
      });
      return box;
    });
    assert.ok(bounds[0].min.x - bounds[1].max.x > .08, `${rescueElapsed}: the delivered passenger bodies overlap while carried`);
  }
});

function headSurface(rig: CharacterRig): THREE.Mesh {
  const positions: number[] = [], point = new THREE.Vector3();
  (rig.hero?.root ?? rig.head).traverseVisible(object => {
    if (!(object instanceof THREE.Mesh) || rig.hero && (!(object instanceof THREE.SkinnedMesh) || (object.material as THREE.Material).name !== 'Skin')) return;
    const index = object.geometry.index, count = index?.count ?? object.geometry.attributes.position.count;
    const indices = object.geometry.attributes.skinIndex, weights = object.geometry.attributes.skinWeight;
    const head = object instanceof THREE.SkinnedMesh ? object.skeleton.bones.findIndex(bone => bone.name === 'head') : -1;
    for (let i = 0; i < count; i += 3) {
      const vertices = [0, 1, 2].map(corner => index?.getX(i + corner) ?? i + corner);
      if (rig.hero && !vertices.every(v => [0, 1, 2, 3].some(j => indices.getComponent(v, j) === head && weights.getComponent(v, j) > .5))) continue;
      for (const v of vertices) { object.getVertexPosition(v, point); object.localToWorld(point); positions.push(...point.toArray()); }
    }
  });
  assert.ok(positions.length > 300, 'the head clearance check needs the delivered head triangles');
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.computeBoundingBox();
  return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
}

test('Neo’s visible palms and fingers stay outside both delivered heads while carrying the two passengers', async t => {
  const h = await actors(t), neo = h.rigs.neo.hero!, point = new THREE.Vector3(), ray = new THREE.Raycaster();
  for (const rescueElapsed of [.95, 1.1, 1.2, 1.3, 1.7, 2.3, 2.59, 2.7, 2.9]) {
    const encounter: TruckEncounter = { phase: 'rescue', elapsed: 9.7, rescueElapsed, lastTick: 0, attempt: 0 };
    h.draw(encounter); poseTruckRescue(neo, h.rigs.morpheus, h.rigs.keymaker, encounter); neo.root.updateMatrixWorld(true);
    for (const [role, side] of [['morpheus', 'L'], ['keymaker', 'R']] as const) {
      const head = headSurface(h.rigs[role]), center = head.geometry.boundingBox!.getCenter(new THREE.Vector3()); let sampled = 0;
      neo.root.traverseVisible(object => {
        if (!(object instanceof THREE.SkinnedMesh) || (object.material as THREE.Material).name !== 'Skin') return;
        const indices = object.geometry.attributes.skinIndex, weights = object.geometry.attributes.skinWeight;
        for (let v = 0; v < object.geometry.attributes.position.count; v++) {
          if (![0, 1, 2, 3].some(j => weights.getComponent(v, j) > .5 && new RegExp(`^(wrist|finger\\d-\\d)_${side}$`).test(object.skeleton.bones[indices.getComponent(v, j)]?.name ?? ''))) continue;
          sampled++; object.getVertexPosition(v, point); object.localToWorld(point);
          if (!head.geometry.boundingBox!.containsPoint(point)) continue;
          const distance = point.distanceTo(center); ray.set(center, point.clone().sub(center).normalize()); ray.far = 2;
          const hits = ray.intersectObject(head, false);
          const boundary = Math.max(0, ...hits.map(hit => hit.distance));
          assert.ok(distance >= boundary - .025, `${role}/${rescueElapsed} hand vertex enters the actual head by ${boundary - distance} at ${point.toArray()}`);
        }
      });
      assert.ok(sampled > 100, 'sample the shipped fingers and palm rather than a wrist bone');
      head.geometry.dispose(); (head.material as THREE.Material).dispose();
    }
  }
});

test('the two delivered passengers leave the roof without driving their shoes or clothing through it', async t => {
  const h = await actors(t), point = new THREE.Vector3();
  for (const rescueElapsed of [0, .02, .05, .1, .15, .25, .35]) {
    h.draw({ phase: 'rescue', elapsed: 9.7, rescueElapsed, lastTick: 0, attempt: 0 });
    for (const role of ['morpheus', 'keymaker'] as const) {
      let lowest = Infinity, bodyPart = '', at: number[] = [];
      h.rigs[role].root.traverseVisible(object => {
        if (!(object instanceof THREE.Mesh)) return;
        for (let i = 0; i < object.geometry.attributes.position.count; i++) {
          object.getVertexPosition(i, point); object.localToWorld(point);
          if (Math.abs(point.x - TRUCKS.roof.x) > TRUCKS.roof.width / 2 || Math.abs(point.z - TRUCKS.roof.z) > TRUCKS.roof.depth / 2) continue;
          if (point.y < lowest) { lowest = point.y; bodyPart = object.name; at = point.toArray(); }
        }
      });
      const roof = TRUCKS.roof.height - 1; // Actor roots and scene geometry both use the existing center.y - 1 render offset.
      assert.ok(lowest >= roof - .04, `${role}/${rescueElapsed}/${bodyPart} clips the truck roof by ${roof - lowest} at ${at}`);
    }
  }
});

test('the rescue grip joins and leaves the base arm animation without an elbow pop', async t => {
  const h = await actors(t), neo = h.rigs.neo.hero!;
  for (const boundary of [.9, 3]) {
    const frames = [boundary - .0001, boundary + .0001].map(rescueElapsed => {
      const encounter: TruckEncounter = { phase: 'rescue', elapsed: 9.7, rescueElapsed, lastTick: 0, attempt: 0 };
      h.draw(encounter); poseTruckRescue(neo, h.rigs.morpheus, h.rigs.keymaker, encounter); neo.root.updateMatrixWorld(true);
      return ['elbow_L', 'elbow_R', 'wrist_L', 'wrist_R'].map(name => neo.bones.get(name)!.getWorldPosition(new THREE.Vector3()));
    });
    for (let joint = 0; joint < frames[0].length; joint++) assert.ok(frames[0][joint].distanceTo(frames[1][joint]) < .01,
      `arm joint ${joint} pops by ${frames[0][joint].distanceTo(frames[1][joint])} at ${boundary}`);
  }
});
