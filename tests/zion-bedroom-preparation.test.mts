import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SCENE_BY_ID, filmEntry, filmPosition, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { LightCulling } from '../packages/client/src/engine/LightCulling.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';

function setup(t: test.TestContext) {
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async () => ({ scene: new THREE.Group(), parser: { json: { extras: { height: 4 } } } }));
  const scene = new THREE.Scene(), sets = new FilmSetRenderer(scene), camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000);
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const morpheus = world.agents.get('morpheus')!, neo = world.agents.get('neo')!;
  morpheus.position = filmPosition('film_zion_temple', 0, -35); morpheus.currentLocation = 'film_zion_temple'; morpheus.isInMatrix = false;
  neo.position = filmEntry(FILM_SCENE_BY_ID.m2_room); neo.currentLocation = 'film_zion_bedroom'; neo.isInMatrix = false;
  const journey: FilmJourney = { version: 1, scene: 'm2_temple', actor: 'morpheus', step: 1, completed: [], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: { ...morpheus.position } };
  const sandbox = { neoLife: { journey } } as SandboxState;
  camera.position.copy(morpheus.position).add(new THREE.Vector3(0, 4, 10)); camera.lookAt(morpheus.position.x, morpheus.position.y + 2, morpheus.position.z - 10); camera.updateMatrixWorld(true);
  const geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial(), cast = new Map<string, THREE.Group>(), costumes: THREE.Mesh[] = [];
  for (const id of ['neo', 'trinity']) {
    const group = new THREE.Group(); group.name = id;
    const body = new THREE.Mesh(geometry, material); body.name = id + '-current-body'; group.add(body);
    const costume = new THREE.Mesh(geometry, material); costume.userData.logosCostume = true; costume.visible = false; group.add(costume); costumes.push(costume); cast.set(id, group);
  }
  const compiled = new Set<THREE.Mesh>(), batches: number[] = [];
  let preview: THREE.Scene | undefined, current: THREE.WebGLRenderTarget | null = null;
  const graphics = { extensions: { has: () => true }, info: { programs: [] }, properties: { get: () => ({}) },
    getRenderTarget: () => current, setRenderTarget: (value: THREE.WebGLRenderTarget | null) => { current = value; },
    compile(subject: THREE.Group, _camera: THREE.Camera, next: THREE.Scene) {
      preview = next; let count = 0; subject.traverse(object => { if (object instanceof THREE.Mesh) { compiled.add(object); count++; } }); batches.push(count);
    } } as unknown as THREE.WebGLRenderer;
  const update = () => sets.update(journey.actor === 'morpheus' ? morpheus : neo, sandbox, 0, undefined, camera.position);
  const prepare = () => sets.prepareZionHomecoming(graphics, camera, journey, id => cast.get(id));
  update(); t.after(() => { sets.dispose(); geometry.dispose(); material.dispose(); });
  return { scene, sets, camera, neo, journey, sandbox, cast, costumes, compiled, batches, update, prepare, get preview() { return preview; } };
}

test('the final temple handoff prepares the existing bedroom and adopts the exact set without changing story state', t => {
  const h = setup(t); h.prepare(); assert.equal(h.preview, undefined, 'the speech cannot allocate the next bedroom');
  h.journey.step = 2; h.update(); const before = JSON.stringify(h.journey); h.prepare();
  const door = h.preview?.getObjectByName('zion-bedroom-door');
  assert.ok(door instanceof THREE.Mesh, 'the drum handoff must prepare its next bedroom before first use');
  assert.equal(h.scene.getObjectByName(door.name), undefined); assert.equal(JSON.stringify(h.journey), before);
  let disposed = 0; door.geometry.addEventListener('dispose', () => disposed++);
  Object.assign(h.journey, { scene: 'm2_room', actor: 'neo', step: 0 }); h.update();
  assert.ok(h.scene.getObjectByName(door.name) === door, 'arrival cannot destroy and rebuild the prepared door');
  assert.equal(disposed, 0); assert.equal(h.sets.active?.id, 'film_zion_bedroom');
});

test('bedroom preparation includes both real-world outfits and a late Trinity while cancellation releases the detached room once', t => {
  const h = setup(t), trinity = h.cast.get('trinity')!; trinity.visible = false; h.cast.delete('trinity'); h.journey.step = 2; h.update();
  for (let frame = 0; frame < 40; frame++) h.prepare();
  const door = h.preview?.getObjectByName('zion-bedroom-door'); assert.ok(door instanceof THREE.Mesh, 'the actual handoff must create the detached room');
  h.cast.set('trinity', trinity); for (let frame = 0; frame < 20; frame++) h.prepare();
  assert.ok(h.costumes.every(mesh => h.compiled.has(mesh)), 'both future outfits must compile, including the late detailed body');
  assert.ok(h.compiled.has(trinity.children[0] as THREE.Mesh)); assert.equal(trinity.visible, false);
  assert.ok(h.costumes.every(mesh => !mesh.visible)); assert.ok(h.batches.every(count => count <= 4));
  let disposed = 0; door.geometry.addEventListener('dispose', () => disposed++);
  h.sets.prepareZionHomecoming({} as THREE.WebGLRenderer, h.camera, undefined, () => undefined); assert.equal(disposed, 1);
  h.sets.prepareZionHomecoming({} as THREE.WebGLRenderer, h.camera, undefined, () => undefined); assert.equal(disposed, 1);
  assert.equal(h.scene.getObjectByName(door.name), undefined); assert.equal(h.sets.active?.id, 'film_zion_temple');
});

test('the dream conversation retains three bedroom light slots while walking and turning without losing contributing light energy', t => {
  const h = setup(t), culling = new LightCulling(h.scene), graphics = {} as THREE.WebGLRenderer; t.after(() => culling.dispose());
  Object.assign(h.journey, { scene: 'm2_room', actor: 'neo', step: 0 });
  for (const step of [0, 1, 2, 3]) for (const [x, z] of [[0, 8], [0, 1], [0, -8], [-10, -13], [10, 14]])
    for (const first of [false, true]) for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      h.journey.step = step; h.neo.position = filmPosition('film_zion_bedroom', x, z);
      h.camera.position.copy(h.neo.position).add(new THREE.Vector3(first ? 0 : .8, first ? 3.2 : 6, first ? 0 : -Math.cos(yaw) * 10.5));
      h.camera.lookAt(h.neo.position.x + Math.sin(yaw) * 10, h.neo.position.y + 2.6, h.neo.position.z + Math.cos(yaw) * 10); h.camera.updateMatrixWorld(true);
      h.sets.update(h.neo, h.sandbox, 0, h.neo.position, h.camera.position, undefined, first, 12000, h.camera);
      culling.stablePointSlots = h.sets.stablePointSlots; culling.minimumPointSlots = h.sets.minimumPointSlots; h.scene.updateMatrixWorld(true);
      const lights: { light: THREE.PointLight; intensity: number; visible: boolean; position: THREE.Vector3 }[] = [];
      h.scene.traverseVisible(object => { if (object instanceof THREE.PointLight) lights.push({ light: object, intensity: object.intensity, visible: object.visible, position: object.getWorldPosition(new THREE.Vector3()) }); });
      h.scene.onBeforeRender(graphics, h.scene, h.camera, null);
      try {
        let slots = 0; h.scene.traverseVisible(object => { if (object instanceof THREE.PointLight) slots++; });
        assert.equal(slots, 3, `step ${step}, position ${x}/${z}, first ${first}, yaw ${yaw}: camera turns cannot recompile the bedroom`);
        for (const x of [-.65, 0, .65]) for (const y of [-.65, 0, .65]) for (const z of [.5, .9, .98, .995]) {
          const point = new THREE.Vector3(x, y, z).unproject(h.camera);
          for (const item of lights) if (item.intensity > 0 && (!item.light.distance || point.distanceTo(item.position) < item.light.distance)) {
            assert.equal(item.light.visible, true); assert.equal(item.light.intensity, item.intensity, 'keep any lamp reaching a visible point');
          }
        }
      } finally { h.scene.onAfterRender(graphics, h.scene, h.camera); }
      for (const item of lights) { assert.equal(item.light.visible, item.visible); assert.equal(item.light.intensity, item.intensity); assert.ok(item.light.getWorldPosition(new THREE.Vector3()).equals(item.position)); }
    }
});
