import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, FILM_SCENE_BY_ID, filmEntry, filmPosition, newReloaded, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { LightCulling } from '../packages/client/src/engine/LightCulling.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';

function setup(t: test.TestContext) {
  const scene = new THREE.Scene(), sets = new FilmSetRenderer(scene), camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000);
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const neo = world.agents.get('neo')!;
  neo.position = filmPosition('film_captains_meeting', 0, -14); neo.currentLocation = 'film_captains_meeting'; neo.isInMatrix = true;
  camera.position.copy(neo.position).add(new THREE.Vector3(0, 4, 10)); camera.lookAt(neo.position.x, neo.position.y + 2, neo.position.z - 10); camera.updateMatrixWorld(true);
  const journey: FilmJourney = { version: 1, scene: 'm2_meeting', actor: 'neo', step: 3, completed: [], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: { ...neo.position }, reloaded: { ...newReloaded('meeting'), phase: 'combat', elapsed: 1.7 } };
  const sandbox = { neoLife: { journey } } as SandboxState;
  const geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial(), cast = new Map<string, THREE.Group>();
  const costumes: THREE.Mesh[] = [], unrelated: THREE.Mesh[] = [];
  for (const id of ['neo', 'kid', 'morpheus', 'trinity', 'link']) {
    const group = new THREE.Group(); group.name = id;
    const body = new THREE.Mesh(geometry, material); body.name = id + '-visible-matrix-body'; group.add(body);
    const costume = new THREE.Mesh(geometry, material); costume.name = id + '-real-world-knit'; costume.userData[id === 'morpheus' ? 'hammerBriefingCostume' : 'logosCostume'] = true; costume.visible = false; group.add(costume); costumes.push(costume);
    const hidden = new THREE.Mesh(geometry, material); hidden.name = id + '-unused-hidden-prop'; hidden.visible = false; group.add(hidden); unrelated.push(hidden);
    cast.set(id, group);
  }
  const compiled = new Set<THREE.Mesh>(), batches: number[] = [], target = new THREE.WebGLRenderTarget(2, 2);
  let current: THREE.WebGLRenderTarget | null = target, preview: THREE.Scene | undefined, ready = false, uniforms = 0;
  const program = { isReady: () => ready, getUniforms: () => { uniforms++; } }, programs: typeof program[] = [];
  const graphics = { extensions: { has: () => true }, info: { programs }, properties: { get: () => ({}) },
    getRenderTarget: () => current, setRenderTarget: (value: THREE.WebGLRenderTarget | null) => { current = value; },
    compile(subject: THREE.Group, _camera: THREE.Camera, next: THREE.Scene) {
      preview = next; let count = 0; subject.traverse(object => { if (object instanceof THREE.Mesh) { compiled.add(object); count++; } }); batches.push(count);
      if (!programs.length) programs.push(program);
    } } as unknown as THREE.WebGLRenderer;
  const update = () => sets.update(neo, sandbox, 0, neo.position, camera.position);
  const prepare = () => sets.prepareZionHomecoming(graphics, camera, journey, id => cast.get(id));
  const departure = () => { journey.step = 4; journey.reloaded!.phase = 'departure_ready'; update(); };
  update();
  t.after(() => { sets.dispose(); geometry.dispose(); material.dispose(); target.dispose(); });
  return { scene, sets, camera, neo, journey, cast, costumes, unrelated, compiled, batches, target, update, prepare, departure,
    get preview() { return preview; }, get current() { return current; }, get uniforms() { return uniforms; }, set ready(value: boolean) { ready = value; } };
}

test('the real meeting departure prepares a detached dock and adopts it at the actual Zion handoff', t => {
  const h = setup(t); h.prepare(); assert.equal(h.preview, undefined, 'the battle must not construct another set');
  h.departure(); const before = JSON.stringify(h.journey); h.prepare();
  const dock = h.preview?.getObjectByName('zion-docked-nebuchadnezzar');
  assert.ok(dock, 'the ready-to-depart meeting must prepare its next dock, rather than waiting for first use');
  assert.equal(h.scene.getObjectByName('zion-docked-nebuchadnezzar'), undefined, 'preparing the dock cannot replace the active meeting');
  assert.equal(h.current === h.target, true, 'offscreen preparation must restore the active render target');
  assert.equal(JSON.stringify(h.journey), before, 'render preparation cannot advance the saved meeting clock or progress');
  let disposed = 0; dock.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.addEventListener('dispose', () => disposed++); });
  Object.assign(h.journey, { scene: 'm2_dock', step: 0 }); delete h.journey.reloaded;
  h.neo.position = filmEntry(FILM_SCENE_BY_ID.m2_dock); h.neo.currentLocation = 'film_zion_hangar'; h.neo.isInMatrix = false;
  h.update();
  assert.ok(h.scene.getObjectByName(dock.name) === dock, 'arrival must keep the exact prepared ship and geometry');
  assert.equal(disposed, 0, 'the adopted dock cannot be disposed during the scene switch');
  assert.equal(h.sets.active?.id, 'film_zion_hangar');
  assert.equal(h.neo.position.y, FILM_SETS.film_zion_hangar.center.y);
});

test('dock preparation covers the real-world costumes and a late actor while leaving the live outfit visibility intact', t => {
  const h = setup(t), kid = h.cast.get('kid')!; kid.visible = false; h.cast.delete('kid'); h.departure();
  for (let frame = 0; frame < 80; frame++) h.prepare();
  h.cast.set('kid', kid);
  for (let frame = 0; frame < 20; frame++) h.prepare();
  assert.ok(h.costumes.every(mesh => h.compiled.has(mesh)), 'the dock must prepare all five future real-world costumes, including the late Kid body');
  assert.ok(h.compiled.has(kid.children[0] as THREE.Mesh), 'a late actor must prepare its detailed LOD even while its scene is hidden');
  assert.equal(kid.visible, false, 'preparation must restore the offscreen LOD visibility');
  assert.ok(h.costumes.every(mesh => !mesh.visible), 'preparation cannot show the real-world outfit in the Matrix');
  assert.ok(h.unrelated.every(mesh => !h.compiled.has(mesh)), 'unrelated hidden props must stay out of the preparation work');
  assert.ok(h.batches.every(count => count <= 4), 'existing per-frame compilation batches remain bounded');
});

test('dock preparation queries only ready programs and disposes the detached set when control leaves the story', t => {
  const h = setup(t); h.departure(); h.prepare();
  const dock = h.preview?.getObjectByName('zion-docked-nebuchadnezzar'); assert.ok(dock);
  assert.equal(h.uniforms, 0, 'a newly linked program cannot force a synchronous first-use query');
  h.prepare(); assert.equal(h.uniforms, 0);
  h.ready = true; h.prepare(); assert.equal(h.uniforms, 1, 'a completed program is warmed on the next frame');
  h.prepare(); assert.equal(h.uniforms, 1, 'a consumed program is not queried repeatedly');
  let disposed = 0; dock.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.addEventListener('dispose', () => disposed++); });
  h.sets.prepareZionHomecoming({} as THREE.WebGLRenderer, h.camera, undefined, () => undefined);
  assert.ok(disposed > 0, 'the abandoned offscreen dock must release its geometry');
  const once = disposed;
  h.sets.prepareZionHomecoming({} as THREE.WebGLRenderer, h.camera, undefined, () => undefined);
  assert.equal(disposed, once, 'abandoning a preparation twice cannot dispose it twice');
  assert.equal(h.scene.getObjectByName('zion-docked-nebuchadnezzar'), undefined);
});

test('the arrival dock keeps thirteen light slots while approaching Kid, turning and finishing the objectives', t => {
  const h = setup(t), culling = new LightCulling(h.scene), graphics = {} as THREE.WebGLRenderer;
  t.after(() => culling.dispose());
  Object.assign(h.journey, { scene: 'm2_dock', step: 0 }); delete h.journey.reloaded;
  h.neo.currentLocation = 'film_zion_hangar'; h.neo.isInMatrix = false;
  const sandbox = { neoLife: { journey: h.journey } } as SandboxState;
  for (const step of [0, 1, 2, 3]) for (const [x, z] of [[0, 44.16], [0, -24.2], [-1.3, -25.1], [8, -16.3]])
    for (const first of [false, true]) for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      h.journey.step = step; h.neo.position = filmPosition('film_zion_hangar', x, z);
      h.camera.position.copy(h.neo.position).add(new THREE.Vector3(first ? 0 : .8, first ? 3.2 : 6, first ? 0 : -Math.cos(yaw) * 10.5));
      h.camera.lookAt(h.neo.position.x + Math.sin(yaw) * 10, h.neo.position.y + 2.6, h.neo.position.z + Math.cos(yaw) * 10);
      h.camera.updateMatrixWorld(true);
      h.sets.update(h.neo, sandbox, 0, h.neo.position, h.camera.position, undefined, first, 12000, h.camera);
      culling.stablePointSlots = h.sets.stablePointSlots; culling.minimumPointSlots = h.sets.minimumPointSlots;
      h.scene.updateMatrixWorld(true);
      const original: { light: THREE.PointLight; intensity: number; visible: boolean; position: THREE.Vector3 }[] = [];
      h.scene.traverseVisible(object => { if (object instanceof THREE.PointLight) original.push({ light: object, intensity: object.intensity, visible: object.visible, position: object.getWorldPosition(new THREE.Vector3()) }); });
      h.scene.onBeforeRender(graphics, h.scene, h.camera, null);
      try {
        let slots = 0; h.scene.traverseVisible(object => { if (object instanceof THREE.PointLight) slots++; });
        assert.equal(slots, 13, `step ${step}, position ${x}/${z}, ${first ? 'eye' : 'follow'}, yaw ${yaw}: turning cannot recompile the dock`);
        for (const x of [-.65, 0, .65]) for (const y of [-.65, 0, .65]) for (const z of [.5, .9, .98, .995]) {
          const point = new THREE.Vector3(x, y, z).unproject(h.camera);
          for (const item of original) if (item.intensity > 0 && (!item.light.distance || point.distanceTo(item.position) < item.light.distance)) {
            assert.equal(item.light.visible, true, 'a light reaching the visible scene cannot be removed');
            assert.equal(item.light.intensity, item.intensity, 'stable slots cannot dim a contributing lamp');
          }
        }
      } finally { h.scene.onAfterRender(graphics, h.scene, h.camera); }
      for (const item of original) {
        assert.equal(item.light.intensity, item.intensity); assert.equal(item.light.visible, item.visible);
        assert.ok(item.light.getWorldPosition(new THREE.Vector3()).equals(item.position));
      }
    }
});
