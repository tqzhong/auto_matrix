import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SCENE_BY_ID, filmEntry, filmPosition, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { LightCulling } from '../packages/client/src/engine/LightCulling.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';

function setup(t: test.TestContext) {
  const scene = new THREE.Scene(), sets = new FilmSetRenderer(scene), camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000);
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!, bane = world.agents.get('bane')!;
  Object.assign(neo, { position: filmEntry(FILM_SCENE_BY_ID.m2_room), currentLocation: 'film_zion_bedroom', isInMatrix: false });
  Object.assign(bane, { position: filmEntry(FILM_SCENE_BY_ID.m2_bane_copy), currentLocation: 'film_industrial_loft', isInMatrix: true });
  const journey: FilmJourney = { version: 1, scene: 'm2_room', actor: 'neo', step: 0, completed: [], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: { ...neo.position } };
  const sandbox = { neoLife: { journey } } as SandboxState;
  camera.position.copy(neo.position).add(new THREE.Vector3(0, 4, 6)); camera.lookAt(neo.position.x, neo.position.y + 2, neo.position.z - 10); camera.updateMatrixWorld(true);
  const geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial(), cast = new Map<string, THREE.Group>();
  for (const id of ['bane', 'malachi', 'smith']) { const group = new THREE.Group(); group.name = id; group.add(new THREE.Mesh(geometry, material)); cast.set(id, group); }
  const compiled = new Set<THREE.Mesh>(), batches: number[] = []; let preview: THREE.Scene | undefined, current: THREE.WebGLRenderTarget | null = null, ready = false, uniforms = 0;
  const program = { isReady: () => ready, getUniforms: () => { uniforms++; } }, programs: typeof program[] = [];
  const graphics = { extensions: { has: () => true }, info: { programs }, properties: { get: () => ({}) },
    getRenderTarget: () => current, setRenderTarget: (value: THREE.WebGLRenderTarget | null) => { current = value; },
    compile(subject: THREE.Group, _camera: THREE.Camera, next: THREE.Scene) {
      preview = next; let count = 0; subject.traverse(object => { if (object instanceof THREE.Mesh) { compiled.add(object); count++; } }); batches.push(count);
      if (!programs.length) programs.push(program);
    } } as unknown as THREE.WebGLRenderer;
  const update = () => sets.update(journey.actor === 'neo' ? neo : bane, sandbox, 0, undefined, camera.position);
  const prepare = () => sets.prepareZionHomecoming(graphics, camera, journey, id => cast.get(id));
  update(); t.after(() => { sets.dispose(); geometry.dispose(); material.dispose(); });
  return { scene, sets, camera, bane, journey, sandbox, cast, compiled, batches, update, prepare, graphics,
    get preview() { return preview; }, get uniforms() { return uniforms; }, set ready(value: boolean) { ready = value; } };
}

test('the bedroom conversation prepares the original loft and adopts its telephone without advancing the saved story', t => {
  const h = setup(t); h.prepare(); assert.equal(h.preview, undefined, 'entering the bedroom cannot allocate the next Matrix scene');
  h.journey.step = 1; h.update(); const before = JSON.stringify(h.journey); h.prepare();
  const phone = h.preview?.getObjectByName('bane-exit-phone');
  assert.ok(phone instanceof THREE.Mesh, 'the dream conversation must prepare the loft before the Bane handoff');
  assert.equal(h.scene.getObjectByName(phone.name), undefined); assert.equal(JSON.stringify(h.journey), before);
  let disposed = 0; phone.geometry.addEventListener('dispose', () => disposed++);
  Object.assign(h.journey, { scene: 'm2_bane_copy', actor: 'bane', step: 0, baneCopy: { progress: 0 } }); h.update();
  assert.ok(h.scene.getObjectByName(phone.name) === phone, 'arrival must keep the exact prepared phone');
  assert.equal(disposed, 0); assert.equal(h.sets.active?.id, 'film_industrial_loft');
});

test('loft preparation covers hidden detailed actors, a late Malachi and the hidden copy wave, and releases cancelled work once', t => {
  const h = setup(t), bane = h.cast.get('bane')!, malachi = h.cast.get('malachi')!; bane.visible = false; h.cast.delete('malachi'); h.journey.step = 1; h.update();
  for (let frame = 0; frame < 50; frame++) h.prepare();
  const wave = h.preview?.getObjectByName('smith-copy-wave'), phone = h.preview?.getObjectByName('bane-exit-phone');
  assert.ok(wave && phone instanceof THREE.Mesh, 'the conversation must construct the actual loft');
  const liquid: THREE.Mesh[] = []; wave.traverse(object => { if (object instanceof THREE.Mesh) liquid.push(object); });
  assert.ok(liquid.length > 0 && liquid.every(mesh => h.compiled.has(mesh)), 'later infection surfaces must not wait until their first visible frame');
  assert.equal(wave.visible, false, 'preparing cannot display the infection early'); assert.equal(bane.visible, false);
  assert.ok(h.compiled.has(bane.children[0] as THREE.Mesh), 'a hidden non-hero detail must be prepared too');
  h.cast.set('malachi', malachi); for (let frame = 0; frame < 12; frame++) h.prepare();
  assert.ok(h.compiled.has(malachi.children[0] as THREE.Mesh)); assert.ok(h.batches.every(count => count <= 4));
  assert.equal(h.uniforms, 0, 'an unfinished link cannot force synchronous uniforms'); h.ready = true; h.prepare(); assert.equal(h.uniforms, 1);
  let disposed = 0; phone.geometry.addEventListener('dispose', () => disposed++);
  h.sets.prepareZionHomecoming({} as THREE.WebGLRenderer, h.camera, undefined, () => undefined); assert.equal(disposed, 1);
  h.sets.prepareZionHomecoming({} as THREE.WebGLRenderer, h.camera, undefined, () => undefined); assert.equal(disposed, 1);
  assert.equal(h.sets.active?.id, 'film_zion_bedroom'); assert.equal(h.scene.getObjectByName(phone.name), undefined);
});

test('the loft keeps five light slots through escort, infection and completion without removing contributing energy', t => {
  const h = setup(t), culling = new LightCulling(h.scene), graphics = {} as THREE.WebGLRenderer; t.after(() => culling.dispose());
  Object.assign(h.journey, { scene: 'm2_bane_copy', actor: 'bane', step: 0, baneCopy: { progress: 0 } });
  for (const step of [0, 1, 2, 3, 4]) for (const [x, z] of [[0, 34], [0, -23], [0, -29], [-18, -24]])
    for (const first of [false, true]) for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      h.journey.step = step; h.journey.baneCopy!.progress = step >= 2 ? .5 : 0; h.bane.position = filmPosition('film_industrial_loft', x, z);
      h.camera.position.copy(h.bane.position).add(new THREE.Vector3(first ? 0 : .8, first ? 3.2 : 6, first ? 0 : -Math.cos(yaw) * 11.5));
      h.camera.lookAt(h.bane.position.x + Math.sin(yaw) * 10, h.bane.position.y + 2.6, h.bane.position.z + Math.cos(yaw) * 10); h.camera.updateMatrixWorld(true);
      h.sets.update(h.bane, h.sandbox, 0, h.bane.position, h.camera.position, undefined, first, 12000, h.camera);
      culling.stablePointSlots = h.sets.stablePointSlots; culling.minimumPointSlots = h.sets.minimumPointSlots; h.scene.updateMatrixWorld(true);
      const lights: { light: THREE.PointLight; intensity: number; visible: boolean; position: THREE.Vector3 }[] = [];
      h.scene.traverseVisible(object => { if (object instanceof THREE.PointLight) lights.push({ light: object, intensity: object.intensity, visible: object.visible, position: object.getWorldPosition(new THREE.Vector3()) }); });
      h.scene.onBeforeRender(graphics, h.scene, h.camera, null);
      try {
        let slots = 0; h.scene.traverseVisible(object => { if (object instanceof THREE.PointLight) slots++; }); assert.equal(slots, 5, `step ${step}, position ${x}/${z}, first ${first}, yaw ${yaw}`);
        for (const x of [-.65, 0, .65]) for (const y of [-.65, 0, .65]) for (const z of [.5, .9, .98, .995]) {
          const point = new THREE.Vector3(x, y, z).unproject(h.camera);
          for (const item of lights) if (item.intensity > 0 && (!item.light.distance || point.distanceTo(item.position) < item.light.distance)) {
            assert.equal(item.light.visible, true); assert.equal(item.light.intensity, item.intensity);
          }
        }
      } finally { h.scene.onAfterRender(graphics, h.scene, h.camera); }
      for (const item of lights) { assert.equal(item.light.visible, item.visible); assert.equal(item.light.intensity, item.intensity); assert.ok(item.light.getWorldPosition(new THREE.Vector3()).equals(item.position)); }
    }
});
