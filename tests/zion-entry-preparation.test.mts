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
  const compiled = new Set<THREE.Mesh>(), batches: number[] = [], uploads: THREE.Texture[] = [], target = new THREE.WebGLRenderTarget(2, 2);
  let current: THREE.WebGLRenderTarget | null = target, preview: THREE.Scene | undefined, ready = false, uniforms = 0;
  const program = { isReady: () => ready, getUniforms: () => { uniforms++; } }, programs: typeof program[] = [];
  const graphics = { extensions: { has: () => true }, info: { programs }, properties: { get: () => ({}) },
    getRenderTarget: () => current, setRenderTarget: (value: THREE.WebGLRenderTarget | null) => { current = value; },
    initTexture: (texture: THREE.Texture) => { uploads.push(texture); },
    compile(subject: THREE.Group, _camera: THREE.Camera, next: THREE.Scene) {
      preview = next; let count = 0; subject.traverse(object => { if (object instanceof THREE.Mesh) { compiled.add(object); count++; } }); batches.push(count);
      if (!programs.length) programs.push(program);
    } } as unknown as THREE.WebGLRenderer;
  const update = () => sets.update(neo, sandbox, 0, neo.position, camera.position);
  const prepare = (resume = false) => sets.prepareZionHomecoming(graphics, camera, journey, id => cast.get(id), resume);
  const departure = () => { journey.step = 4; journey.reloaded!.phase = 'departure_ready'; update(); };
  update();
  t.after(() => { sets.dispose(); geometry.dispose(); material.dispose(); target.dispose(); });
  return { scene, sets, camera, neo, journey, cast, costumes, unrelated, compiled, batches, uploads, material, target, update, prepare, departure,
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

test('a resumed meeting starts dock texture uploads while the first shader is still linking', t => {
  const h = setup(t), meeting = FILM_SCENE_BY_ID.m2_meeting;
  h.sets.update(undefined, undefined, 0);
  h.journey.step = meeting.steps.length; h.journey.completed.push(meeting.id); h.journey.reloaded!.phase = 'done';
  const texture = new THREE.Texture({ width: 1024, height: 1024, complete: true });
  texture.needsUpdate = true; h.material.map = texture;
  t.after(() => texture.dispose());

  h.prepare(true);
  assert.ok(h.preview?.getObjectByName('zion-docked-nebuchadnezzar'));
  assert.equal(h.uniforms, 0, 'a linking program must remain asynchronous');
  assert.deepEqual(h.uploads, [texture], 'a linking program must not delay the first dock texture upload');
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

test('a completed bedroom save prepares the departure dock before taking control and preserves it across both entries', t => {
  const h = setup(t), bedroom = FILM_SCENE_BY_ID.m2_oracle_message, departure = FILM_SCENE_BY_ID.m2_departure;
  const fill = new THREE.DirectionalLight(); fill.visible = false;
  h.scene.add(new THREE.DirectionalLight(), fill);
  Object.assign(h.journey, { scene: bedroom.id, step: 1 }); delete h.journey.reloaded;
  h.sets.update(undefined, { neoLife: { journey: h.journey } } as SandboxState, 0);
  h.prepare(true);
  assert.equal(h.preview, undefined, 'the landing screen only prepares departure after the disk is stowed');
  h.journey.step = bedroom.steps.length;
  h.journey.completed.push(bedroom.id);
  const saved = JSON.stringify(h.journey);
  const texture = new THREE.Texture({ width: 1024, height: 1024, complete: true });
  texture.needsUpdate = true; h.material.map = texture;
  t.after(() => texture.dispose());
  h.prepare(true);
  assert.deepEqual(h.uploads, [texture], 'the departure textures must prepare while shader compilation is still underway');
  for (let frame = 0; frame < 40; frame++) h.prepare(true);
  const dock = h.preview?.getObjectByName('zion-docked-nebuchadnezzar');
  assert.ok(dock, 'the completed disk save must prepare the dock on the landing screen');
  const lights = h.preview?.children.filter(light => light instanceof THREE.DirectionalLight && light.visible);
  assert.equal(lights?.length, 2, 'the prepared dock must include the fill light that turns on after taking control');
  assert.equal(fill.visible, false);
  assert.equal(h.sets.active, undefined);
  assert.equal(JSON.stringify(h.journey), saved);
  let disposed = 0;
  dock.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.addEventListener('dispose', () => disposed++); });

  Object.assign(h.neo, { position: filmEntry(bedroom), currentLocation: bedroom.set, isInMatrix: false });
  h.update();
  assert.equal(h.sets.active?.id, bedroom.set);
  assert.equal(h.scene.getObjectByName(dock.name), undefined);
  assert.equal(disposed, 0);

  Object.assign(h.journey, { scene: departure.id, step: 0 });
  Object.assign(h.neo, { position: filmEntry(departure), currentLocation: departure.set });
  h.update();
  assert.equal(h.scene.getObjectByName(dock.name), dock);
  assert.equal(disposed, 0);
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

test('the last dock action prepares council shadows, late heads and shared ground shadows before adoption', t => {
  const h = setup(t), lighting = new LightCulling(h.scene), sun = new THREE.DirectionalLight(); sun.castShadow = true; h.scene.add(sun);
  Object.assign(h.journey, { scene: 'm2_dock', step: 2 }); delete h.journey.reloaded;
  h.neo.position = filmPosition('film_zion_hangar', 11, -15); h.neo.currentLocation = 'film_zion_hangar'; h.neo.isInMatrix = false; h.update();
  lighting.minimumPointSlots = 13; lighting.stablePointSlots = true;
  const actor = new THREE.Group(), niobe = new THREE.Group(), geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial();
  const skin = new THREE.SkinnedMesh(geometry, material); skin.name = 'Anatomical_head_and_hands'; skin.castShadow = true; actor.add(skin);
  const shadowMaterial = new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false }), shadow = new THREE.Mesh(geometry, shadowMaterial);
  const compiled = new Set<THREE.Object3D>(), depths = new Set<THREE.MeshDepthMaterial>(), slots = new Set<number>();
  const graphics = { extensions: { has: () => true }, info: { programs: [] }, properties: { get: () => ({}) },
    shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap }, getRenderTarget: () => null, setRenderTarget() {},
    compile(subject: THREE.Object3D, _camera: THREE.Camera, target: THREE.Scene) {
      let points = 0; target.traverseVisible(object => { if (object instanceof THREE.PointLight) points++; });
      subject.traverse(object => {
        compiled.add(object);
        if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshDepthMaterial) { depths.add(object.material); slots.add(points); }
      });
    } } as unknown as THREE.WebGLRenderer;
  const prepare = () => h.sets.prepareZionHomecoming(graphics, h.camera, h.journey, id => id === 'morpheus' ? actor : id === 'niobe' ? niobe : undefined, false, lighting, sun, shadow);
  t.after(() => { lighting.dispose(); geometry.dispose(); material.dispose(); shadowMaterial.dispose(); });
  for (let frame = 0; frame < 100; frame++) prepare();
  assert.ok(depths.size, 'the council must not wait for its first real depth draw');
  assert.deepEqual([...slots].sort((a, b) => a - b), [5, 13]);
  assert.ok(compiled.has(shadow)); assert.ok(compiled.has(h.sets.goalMarker));
  const normals = h.sets.zionEntryNormalMeshes;
  const head = new THREE.Group(); head.name = 'niobe-detailed-head'; head.visible = false; niobe.add(head);
  const late = new THREE.Mesh(geometry, material); late.name = 'niobe-anatomical-head'; late.castShadow = true; head.add(late);
  for (let frame = 0; frame < 20; frame++) prepare();
  assert.ok(compiled.has(late)); assert.ok(h.sets.zionEntryNormalMeshes?.includes(late));
  assert.notEqual(h.sets.zionEntryNormalMeshes, normals); assert.equal(h.journey.step, 2);
  assert.equal(head.visible, false, 'preparing the next world cannot reveal the hidden source variant');
  let released = 0; for (const depth of depths) depth.addEventListener('dispose', () => released++);
  Object.assign(h.journey, { scene: 'm2_lock', actor: 'morpheus', step: 0 });
  const morpheus = { ...h.neo, id: 'morpheus', position: filmEntry(FILM_SCENE_BY_ID.m2_lock), currentLocation: 'film_zion_council' };
  h.sets.update(morpheus, { neoLife: { journey: h.journey } } as SandboxState, 0);
  assert.equal(released, 0);
  h.sets.update(undefined, undefined, 1); assert.equal(released, depths.size);
});

test('the council readies resident depth, normals and fitted Trinity knit without changing the current actors', t => {
  const h = setup(t), lighting = new LightCulling(h.scene), sun = new THREE.DirectionalLight(); sun.castShadow = true; h.scene.add(sun);
  Object.assign(h.journey, { scene: 'm2_lock', actor: 'morpheus', step: 1 }); delete h.journey.reloaded;
  const morpheus = { ...h.neo, id: 'morpheus', position: filmEntry(FILM_SCENE_BY_ID.m2_lock), currentLocation: 'film_zion_council', isInMatrix: false };
  const sandbox = { neoLife: { journey: h.journey } } as SandboxState;
  h.sets.update(morpheus, sandbox, 0); lighting.minimumPointSlots = 5; lighting.stablePointSlots = true;
  const geometry = new THREE.BoxGeometry(), skin = new THREE.SkinnedMesh(geometry, h.material); skin.name = 'Anatomical_head_and_hands'; skin.castShadow = true;
  h.cast.get('neo')!.add(skin);
  const cloth = new THREE.MeshStandardMaterial({ map: new THREE.Texture() }), garment = new THREE.SkinnedMesh(geometry, cloth);
  garment.name = 'trinity-logos-sweater'; garment.castShadow = true;
  const shadowMaterial = new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false }), shadow = new THREE.Mesh(geometry, shadowMaterial);
  const compiled = new Set<THREE.Object3D>(), depths = new Set<THREE.MeshDepthMaterial>(), slots = new Set<number>();
  let wardrobeCalls = 0, releasedCloth = 0; cloth.addEventListener('dispose', () => releasedCloth++);
  const graphics = { extensions: { has: () => true }, info: { programs: [] }, properties: { get: () => ({}) },
    shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap }, getRenderTarget: () => null, setRenderTarget() {},
    compile(subject: THREE.Object3D, _camera: THREE.Camera, target: THREE.Scene) {
      let points = 0; target.traverseVisible(object => { if (object instanceof THREE.PointLight) points++; });
      subject.traverse(object => { compiled.add(object); if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshDepthMaterial) { depths.add(object.material); slots.add(points); } });
    } } as unknown as THREE.WebGLRenderer;
  const before = JSON.stringify(h.journey), visible = h.costumes.map(mesh => mesh.visible);
  const prepare = () => h.sets.prepareZionHomecoming(graphics, h.camera, h.journey, id => h.cast.get(id), false, lighting, sun, shadow,
    id => id === 'trinity' ? { model: h.cast.get(id), garments: () => { wardrobeCalls++; return [garment]; } } : {});
  t.after(() => { lighting.dispose(); geometry.dispose(); shadowMaterial.dispose(); cloth.map!.dispose(); });
  for (let frame = 0; frame < 150; frame++) prepare();
  assert.ok(compiled.has(garment), 'the mapped target knit needs its prepared proxy rather than the current outfit');
  assert.equal(wardrobeCalls, 1, 'each fitted proxy material must be created only once');
  assert.deepEqual([...slots].sort((a, b) => a - b), [5, 15]);
  assert.ok(compiled.has(shadow)); assert.ok(h.sets.zionEntryNormalMeshes?.includes(skin));
  assert.deepEqual(h.costumes.map(mesh => mesh.visible), visible); assert.equal(JSON.stringify(h.journey), before);
  assert.equal(garment.parent, null);
  Object.assign(h.journey, { scene: 'm2_residents', actor: 'neo', step: 0 });
  Object.assign(h.neo, { position: filmEntry(FILM_SCENE_BY_ID.m2_residents), currentLocation: 'film_zion_residences', isInMatrix: false }); h.update();
  assert.equal(releasedCloth, 0, 'adoption must keep the warmed program until the live resident scene has used it');
  h.sets.update(undefined, undefined, 1); assert.equal(releasedCloth, 1);
});

test('the infected exit phone readies engineering depth, both actor normals and the shared ground shadow', t => {
  const h = setup(t), lighting = new LightCulling(h.scene), sun = new THREE.DirectionalLight(); sun.castShadow = true; h.scene.add(sun);
  Object.assign(h.journey, { scene: 'm2_bane_copy', actor: 'bane', step: 3, baneCopy: { progress: 1 } }); delete h.journey.reloaded;
  const bane = { ...h.neo, id: 'bane', position: filmEntry(FILM_SCENE_BY_ID.m2_bane_copy), currentLocation: 'film_industrial_loft', isInMatrix: true };
  h.sets.update(bane, { neoLife: { journey: h.journey } } as SandboxState, 0);
  lighting.stablePointSlots = true; lighting.minimumPointSlots = 7;
  const geometry = new THREE.BoxGeometry(), neoHead = new THREE.SkinnedMesh(geometry, h.material), hamannHead = new THREE.SkinnedMesh(geometry, h.material);
  neoHead.name = 'Anatomical_head_and_hands'; hamannHead.name = 'hamann-anatomical-head'; neoHead.castShadow = hamannHead.castShadow = true;
  h.cast.get('neo')!.add(neoHead); const hamann = new THREE.Group(); hamann.add(hamannHead); hamann.visible = false; h.cast.set('hamann', hamann);
  const shadowMaterial = new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false }), shadow = new THREE.Mesh(geometry, shadowMaterial);
  const compiled = new Set<THREE.Object3D>(), depths = new Set<THREE.MeshDepthMaterial>(), slots = new Set<number>(), passes: string[] = [];
  const graphics = { extensions: { has: () => true }, info: { programs: [] }, properties: { get: () => ({}) },
    shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap }, getRenderTarget: () => null, setRenderTarget() {},
    compile(subject: THREE.Object3D, _camera: THREE.Camera, target: THREE.Scene) {
      let points = 0; target.traverseVisible(object => { if (object instanceof THREE.PointLight) points++; });
      subject.traverse(object => { compiled.add(object); if (object instanceof THREE.Mesh) passes.push(object.material.type); if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshDepthMaterial) { depths.add(object.material); slots.add(points); } });
    } } as unknown as THREE.WebGLRenderer;
  const before = JSON.stringify(h.journey), costumes = h.costumes.map(mesh => mesh.visible);
  t.after(() => { lighting.dispose(); geometry.dispose(); shadowMaterial.dispose(); });
  for (let frame = 0; frame < 180; frame++) h.sets.prepareZionHomecoming(graphics, h.camera, h.journey, id => h.cast.get(id), false, lighting, sun, shadow);
  assert.ok(depths.size > 0, 'the phone lead time must prepare engineering shadow programs');
  assert.ok(passes.indexOf('MeshStandardMaterial') < passes.indexOf('MeshDepthMaterial'), 'the short phone handoff must give visible colors the first preparation frames');
  assert.deepEqual([...slots].sort((a, b) => a - b), [4, 7]);
  assert.ok(compiled.has(shadow)); assert.ok(h.sets.zionEntryNormalMeshes?.includes(neoHead)); assert.ok(h.sets.zionEntryNormalMeshes?.includes(hamannHead));
  assert.equal(JSON.stringify(h.journey), before); assert.equal(hamann.visible, false); assert.deepEqual(h.costumes.map(mesh => mesh.visible), costumes);
  let released = 0; for (const depth of depths) depth.addEventListener('dispose', () => released++);
  Object.assign(h.journey, { scene: 'm2_hamann', actor: 'neo', step: 0 });
  Object.assign(h.neo, { position: filmEntry(FILM_SCENE_BY_ID.m2_hamann), currentLocation: 'film_zion_engineering', isInMatrix: false }); h.update();
  assert.equal(released, 0); h.sets.update(undefined, undefined, 1); assert.equal(released, depths.size);
});
