import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, INTERROGATION_ROOM, interrogationRoot, type InterrogationRole } from '@auto_matrix/shared';
import { HeroModels, type HeroRig } from '../packages/client/src/agents/HeroModel.js';
import { advanceMotion, newMotion } from '../packages/client/src/agents/CharacterMotion.js';

async function loadGeometry(id: string) {
  const glb = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
  const length = glb.readUInt32LE(12), document = JSON.parse(glb.subarray(20, 20 + length).toString());
  // Use the delivered GLB skinning; texture appearance is checked in the browser.
  for (const material of document.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = glb.subarray(20 + length), result = Buffer.alloc(20 + padded.length + bin.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); bin.copy(result, 20 + padded.length);
  return new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
}

async function actors() {
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking', 'smith'].map(async id => [id, await loadGeometry(id)] as const)));
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: (id: string) => Promise<NonNullable<ReturnType<typeof assets.get>>> }).load = async id => assets.get(id)!;
  const rigs = new Map<InterrogationRole, HeroRig>();
  for (const role of ['neo', 'smith', 'agent_jones', 'agent_brown'] as const)
    rigs.set(role, (await models.create(role === 'neo' ? 'neo' : 'smith', role.startsWith('agent_') ? role as 'agent_jones' | 'agent_brown' : undefined))!);
  return { models, rigs };
}

const center = FILM_SETS.film_agent_interrogation.center;
const origin = new THREE.Vector3(center.x, center.y - 1, center.z);
function pose(models: HeroModels, rig: HeroRig, role: InterrogationRole, elapsed: number) {
  const gesture = { phase: 'coercion' as const, elapsed, role };
  const root = interrogationRoot({ ...gesture, approach: { x: 5.9, z: 0, yaw: -Math.PI / 2 } }, role);
  rig.root.position.copy(origin).add(new THREE.Vector3(root.x, 0, root.z)); rig.root.rotation.y = root.yaw;
  const motion = newMotion(), input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, officeShirt: role === 'neo', interrogation: gesture };
  models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); rig.root.updateMatrixWorld(true);
}

function visibleVertices(rig: HeroRig, check: (point: THREE.Vector3, label: string) => void) {
  const point = new THREE.Vector3();
  for (const { mesh } of rig.wardrobe) {
    if (!(mesh instanceof THREE.SkinnedMesh)) continue;
    let visible = true;
    for (let node: THREE.Object3D | null = mesh; node; node = node.parent) if (!node.visible) visible = false;
    if (!visible) continue;
    mesh.skeleton.update();
    const indices = mesh.geometry.index;
    const used = indices ? new Set(Array.from(indices.array)) : Array.from({ length: mesh.geometry.attributes.position.count }, (_, i) => i);
    for (const i of used) { mesh.getVertexPosition(i, point); mesh.localToWorld(point); point.sub(origin); check(point, `${mesh.name} vertex ${i}`); }
  }
}

test('Neo is lifted onto the steel table without dragging his visible hands, trousers or shoes through it', async () => {
  const { models, rigs } = await actors(); const rig = rigs.get('neo')!, table = INTERROGATION_ROOM.table;
  try {
    for (const elapsed of [9.8, 10.2, 10.4, 10.6, 10.8, 11, 11.2, 11.5, 11.8, 12, 12.3, 12.7]) {
      pose(models, rig, 'neo', elapsed);
      visibleVertices(rig, (point, label) => {
        const inSteel = Math.abs(point.x) < table.width / 2 - .02 && Math.abs(point.z) < table.depth / 2 - .02
          && point.y > table.height - .16 && point.y < table.height - .025;
        assert.equal(inSteel, false, `${elapsed}s: ${label} inside the tabletop at ${point.toArray()}`);
      });
    }
  } finally { models.dispose(); }
});

test('Smith keeps his visible fingers and clothes outside the steel while reviewing the file and walking to Neo', async () => {
  const { models, rigs } = await actors(); const rig = rigs.get('smith')!, table = INTERROGATION_ROOM.table;
  try {
    for (const elapsed of [0, 6.6, 6.8, 7.1, 7.3, 7.5, 8, 8.5, 9.8, 10, 10.5, 11, 11.5, 12.7, 14]) {
      pose(models, rig, 'smith', elapsed);
      visibleVertices(rig, (point, label) => {
        const inSteel = Math.abs(point.x) < table.width / 2 - .02 && Math.abs(point.z) < table.depth / 2 - .02
          && point.y > table.height - .16 && point.y < table.height - .025;
        assert.equal(inSteel, false, `${elapsed}s: ${label} inside the tabletop at ${point.toArray()}`);
      });
    }
  } finally { models.dispose(); }
});

test('the seated and rising actors keep their actual shoe soles on the floor', async () => {
  const { models, rigs } = await actors();
  try {
    for (const role of ['neo', 'smith'] as const) for (const elapsed of [0, 5.5, 6.6, 7.3, 7.5, 8, 8.3, 8.6]) {
      const rig = rigs.get(role)!; pose(models, rig, role, elapsed);
      let lowest = Infinity;
      visibleVertices(rig, (point, label) => { if (label.startsWith('shoes01 ')) lowest = Math.min(lowest, point.y); });
      assert.ok(lowest >= -.025 && lowest <= .035, `${role} ${elapsed}s: sole at ${lowest}, floating above or through the floor`);
    }
  } finally { models.dispose(); }
});

test('Smith presents an upright tracker and supports the open case on his other palm', async () => {
  const { models, rigs } = await actors(); const rig = rigs.get('smith')!;
  try {
    let held: { position: THREE.Vector3; axis: THREE.Vector3 } | undefined;
    for (const elapsed of [15.3, 16, 17, 17.599, 17.6]) {
      pose(models, rig, 'smith', elapsed);
      const tracker = rig.root.getObjectByName('interrogation-tracker')!;
      const axis = tracker.localToWorld(new THREE.Vector3(0, 0, .18)).sub(tracker.localToWorld(new THREE.Vector3(0, 0, -.18))).normalize();
      assert.ok(axis.y > .98, `${elapsed}s: the vial hangs upright, axis ${axis.toArray()}`);
      const position = tracker.getWorldPosition(new THREE.Vector3());
      if (elapsed === 17.599) held = { position, axis };
      if (elapsed === 17.6) {
        assert.ok(position.distanceTo(held!.position) < .005, 'letting go must not teleport the tracker');
        assert.ok(axis.distanceTo(held!.axis) < .005, 'letting go must not flip the tracker sideways');
      }
      const box = rig.root.getObjectByName('interrogation-device-case')!, palm = rig.bones.get('wrist_L')!.localToWorld(new THREE.Vector3(-.065, -.17, .01));
      const bottom = box.localToWorld(new THREE.Vector3(0, -.035, 0));
      assert.ok(Math.abs(bottom.y - palm.y) < .025 && Math.hypot(bottom.x - palm.x, bottom.z - palm.z) < .025, `${elapsed}s: the case bottom must rest on the palm`);
      assert.ok(box.getWorldPosition(new THREE.Vector3()).y > 3, `${elapsed}s: the case is raised for Smith to take the device`);
    }
  } finally { models.dispose(); }
});
