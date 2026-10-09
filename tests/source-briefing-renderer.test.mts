import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test, { type TestContext } from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, SOURCE_BRIEFING, filmPosition, groundHeight, playerBlocked, type SourceBriefing } from '@auto_matrix/shared';
import { SourceBriefingRenderer } from '../packages/client/src/engine/SourceBriefingRenderer.js';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

function room() {
  const center = FILM_SETS.film_operation_room.center, root = new THREE.Group();
  root.position.set(center.x, center.y - 1, center.z);
  const renderer = new SourceBriefingRenderer(root); root.updateMatrixWorld(true);
  return { center, root, renderer };
}

test('the apartment floor and plan table agree with the shared walking and jumping surfaces', () => {
  const h = room();
  try {
    const floor = h.root.getObjectByName('briefing-floor')!, table = h.root.getObjectByName('briefing-plan-table')!;
    for (const route of SOURCE_BRIEFING.routes) {
      const position = filmPosition('film_operation_room', route.x, route.z);
      const hit = new THREE.Raycaster(new THREE.Vector3(position.x, position.y + 3, position.z), new THREE.Vector3(0, -1, 0)).intersectObject(floor)[0];
      assert.ok(hit); assert.ok(Math.abs(hit.point.y - groundHeight(position, true) + 1) < 1e-6, 'the actor root is one unit above its actual soles');
      assert.equal(playerBlocked(position, true), false);
      const paper = h.root.getObjectByName(`briefing-plan-${route.id}`)!;
      const eye = new THREE.Vector3(position.x, position.y + 2.9, position.z), target = new THREE.Vector3(); paper.getWorldPosition(target);
      const ray = new THREE.Raycaster(eye, target.clone().sub(eye).normalize(), 0, eye.distanceTo(target) + .05);
      assert.equal(ray.intersectObjects([paper, table], false)[0]?.object, paper, 'the plan must be visible above the table from its inspection point');
    }
    const point = filmPosition('film_operation_room', SOURCE_BRIEFING.table.x, SOURCE_BRIEFING.table.z);
    const top = new THREE.Box3().setFromObject(table).max.y;
    assert.ok(Math.abs(top - h.center.y + 1 - SOURCE_BRIEFING.table.height) < 1e-6);
    assert.equal(playerBlocked({ ...point, y: top + .95 }, true), true);
    assert.equal(playerBlocked({ ...point, y: top + 1.05 }, true), false, 'the player can clear the visible table rather than an invisible taller box');
  } finally { h.renderer.dispose(); }
});

async function shipped(name: string) {
  const bytes = await readFile(new URL(`../packages/client/public/assets/characters/${name}.glb`, import.meta.url));
  const length = bytes.readUInt32LE(12), document = JSON.parse(bytes.subarray(20, 20 + length).toString());
  // Keep the delivered geometry, skin weights and UVs; browser QA checks pixels.
  for (const material of document.materials) delete material.pbrMetallicRoughness.baseColorTexture;
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const binary = bytes.subarray(20 + length), output = Buffer.alloc(20 + padded.length + binary.length);
  output.writeUInt32LE(0x46546c67, 0); output.writeUInt32LE(2, 4); output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(padded.length, 12); output.writeUInt32LE(0x4e4f534a, 16); padded.copy(output, 20); binary.copy(output, 20 + padded.length);
  const asset = await new GLTFLoader().parseAsync(output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength), '');
  if (name.endsWith('-head')) asset.scene.traverse(object => { if (object instanceof THREE.Mesh) (object.material as THREE.MeshStandardMaterial).map = new THREE.Texture(); });
  return asset;
}

async function keymaker(t: TestContext) {
  const assets = new Map(await Promise.all(['keymaker-head', 'keymaker-body'].map(async name => [name, await shipped(name)] as const)));
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async url => assets.get(String(url).split('/').pop()!.replace('.glb', ''))!);
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const models = new CharacterModels(), rig = models.create(world.agents.get('keymaker')!);
  globalThis.document = previous;
  const h = room(), at = SOURCE_BRIEFING.roots.keymaker;
  rig.root.position.set(h.center.x + at.x, h.center.y - 1 + at.y, h.center.z + at.z);
  const pose = (state: SourceBriefing) => {
    models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, seated: true, sourceBriefing: { ...state, role: 'keymaker' } }, 0);
    rig.root.updateMatrixWorld(true); rig.root.traverseVisible(object => { if (object instanceof THREE.SkinnedMesh) object.skeleton.update(); });
  };
  pose({ phase: 'review', elapsed: 0, reviewed: [] }); await new Promise(resolve => setImmediate(resolve));
  pose({ phase: 'review', elapsed: 0, reviewed: [] });
  assert.ok(rig.root.getObjectByName('keymaker-detailed-body'));
  t.after(() => { h.renderer.dispose(); models.dispose(); globalThis.document = previous; });
  return { ...h, rig, pose };
}

test('the delivered seated Keymaker rests on the visible cushion and keeps his shoes above the apartment floor', async t => {
  const h = await keymaker(t), chair = h.root.getObjectByName('briefing-keymaker-chair')!;
  const floorTop = new THREE.Box3().setFromObject(h.root.getObjectByName('briefing-floor')!).max.y;
  assert.ok(Math.abs(new THREE.Box3().setFromObject(chair).min.y - floorTop) < .005, 'the visible chair legs must also touch the floor');
  for (const elapsed of [0, 1.5, 3.7, 5.4]) {
    h.pose({ phase: 'hearing', selected: 'primary', reviewed: [], elapsed });
    const pelvis = h.rig.torso.getWorldPosition(new THREE.Vector3());
    const cushion = new THREE.Raycaster(pelvis.clone().add(new THREE.Vector3(0, .5, 0)), new THREE.Vector3(0, -1, 0)).intersectObject(chair, true)[0];
    assert.ok(cushion); assert.ok(pelvis.y - cushion.point.y > .025 && pelvis.y - cushion.point.y < .2, `pelvis/cushion separation ${pelvis.y - cushion.point.y}`);
    const boots = h.rig.root.getObjectByName('keymaker-work-boots') as THREE.SkinnedMesh;
    let low = Infinity;
    for (let i = 0; i < boots.geometry.attributes.position.count; i++) low = Math.min(low, boots.localToWorld(boots.getVertexPosition(i, new THREE.Vector3())).y);
    const floor = new THREE.Box3().setFromObject(h.root.getObjectByName('briefing-floor')!).max.y;
    assert.ok(low - floor >= -.025 && low - floor < .1, `shoe/floor separation ${low - floor}`);
    const body = h.rig.root.getObjectByName('keymaker-anatomical-body') as THREE.SkinnedMesh;
    const saved = body.getVertexPosition(177, new THREE.Vector3()); h.pose({ phase: 'hearing', selected: 'primary', reviewed: [], elapsed });
    assert.ok(saved.distanceTo(body.getVertexPosition(177, new THREE.Vector3())) < 1e-7, 'paused/reconstructed gestures use the saved clock');
  }
});

test('changing completed plans preserves paper geometry and leaving the room releases its meshes and materials', () => {
  const h = room(), paper = h.root.getObjectByName('briefing-plan-primary') as THREE.Mesh;
  const before = paper.matrixWorld.clone(); h.renderer.update({ phase: 'question', reviewed: ['primary', 'emergency', 'source'], elapsed: 0 });
  h.root.updateMatrixWorld(true); assert.ok(paper.matrixWorld.equals(before));
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(); let g = 0, m = 0;
  h.root.traverse(object => { if (object instanceof THREE.Mesh) { geometries.add(object.geometry); materials.add(object.material as THREE.Material); } });
  geometries.forEach(value => value.addEventListener('dispose', () => g++)); materials.forEach(value => value.addEventListener('dispose', () => m++));
  h.renderer.dispose(); assert.equal(g, geometries.size); assert.equal(m, materials.size); assert.equal(h.root.children.length, 0);
});
