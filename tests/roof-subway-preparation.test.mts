import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, filmPosition, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { LightCulling } from '../packages/client/src/engine/LightCulling.js';
import { GovernmentSetRenderer } from '../packages/client/src/engine/GovernmentSetRenderer.js';
import { MatrixEscapeRenderer } from '../packages/client/src/engine/MatrixEscapeRenderer.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';

const cases = {
  roof: { scene: 'm1_helicopter', from: 'film_government_office', to: 'film_government_roof', next: 'm1_rooftop_rescue',
    landmark: 'government-roof-deck', points: 4, shadows: 2, body: 'morpheus', late: 'trinity' },
  subway: { scene: 'm1_rooftop_rescue', from: 'film_government_roof', to: 'film_subway_platform', next: 'm1_subway',
    landmark: 'matrix-subway-track', points: 12, shadows: 1, body: 'citizen_13', late: 'trinity' },
  city: { scene: 'm1_subway', from: 'film_subway_platform', to: 'film_escape_streets', next: 'm1_city_chase',
    landmark: 'matrix-city-room-303-door', points: 2, shadows: 2, body: 'smith', late: 'citizen_14' },
  hotel: { scene: 'm1_city_chase', from: 'film_escape_streets', to: 'film_heart_hotel', next: 'm1_death',
    landmark: 'one-room-303-door', points: 8, shadows: 1, body: 'neo', late: 'neo' },
} as const;

function fixture(t: TestContext, mode: keyof typeof cases, withShadows = false) {
  const roof = mode === 'roof', city = mode === 'city', hotel = mode === 'hotel';
  const plan = cases[mode], { landmark } = plan;
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {},
  }) }) } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const scene = new THREE.Scene(), film = new FilmSetRenderer(scene), camera = new THREE.PerspectiveCamera();
  scene.environment = new THREE.Texture(); scene.fog = new THREE.FogExp2();
  const sun = new THREE.DirectionalLight(); sun.castShadow = true; scene.add(sun, new THREE.DirectionalLight(), new THREE.HemisphereLight());
  const sourceLights = withShadows ? new LightCulling(scene) : undefined;
  if (sourceLights) sourceLights.minimumPointSlots = mode === 'subway' ? 4 : mode === 'city' ? 12 : 2;
  Object.assign(film, { current: FILM_SETS[plan.from], currentScene: plan.scene });
  const journey = { scene: plan.scene, actor: 'neo', step: hotel ? 2 : 1,
    airRescue: roof || mode === 'subway' ? { kind: roof ? 'office' : 'roof', phase: roof ? 'catching' : 'pulling', elapsed: 0, attempt: 0 } : undefined,
    matrixEscape: city ? { kind: 'subway', phase: 'body_swap', elapsed: 1, attempt: 0, host: 'citizen_13',
      checkpoint: 'tracks', hits: 0, dodges: 0, pursuit: 0, segment: 1, possessions: 1, resolved: [] }
      : hotel ? { kind: 'city', phase: 'door', elapsed: .65, attempt: 0, checkpoint: 'street', hits: 0,
        dodges: 0, pursuit: 0, segment: 2, possessions: 2, resolved: [] } : undefined,
  } as FilmJourney;
  const parent = new THREE.Group(), hero = new THREE.Group(), body = new THREE.Group(), geometry = new THREE.BoxGeometry();
  parent.visible = false; parent.add(hero, body); scene.add(parent);
  const texture = new THREE.Texture({ width: 2048, height: 2048, complete: true }); texture.needsUpdate = true;
  const material = new THREE.MeshStandardMaterial({ map: texture }), skin = new THREE.SkinnedMesh(geometry, material); skin.visible = false; hero.add(skin);
  const later = new THREE.Mesh(geometry, material); later.userData.reloadedHidden = true; later.visible = false; hero.add(later);
  const coarse = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true })); body.add(coarse);
  const heroes = new Map([['neo', hero]]), bodies = new Map<string, THREE.Group>([[plan.body, body]]), roots = new Set<THREE.Object3D>();
  const work: string[] = [], batches: THREE.Object3D[][] = [], programs: { program: object; isReady(): boolean; getUniforms(): void }[] = [];
  const depthBatches: { points: number; meshes: THREE.Mesh<THREE.BufferGeometry, THREE.MeshDepthMaterial>[] }[] = [];
  let ready = false, target: THREE.WebGLRenderTarget | null = null, uploaded = new WeakMap<THREE.Texture, number>();
  const properties = () => ({ get: (map: THREE.Texture) => ({ __version: uploaded.get(map) }) });
  const gpu = { properties: properties(), info: { programs }, debug: { checkShaderErrors: true }, extensions: { has: () => true },
    shadowMap: withShadows ? { enabled: true, type: THREE.PCFSoftShadowMap } : undefined,
    getContext: () => ({ LINK_STATUS: 0x8b82, getProgramParameter: () => true }), getRenderTarget: () => target, setRenderTarget: (value: typeof target) => { target = value; },
    compile(subject: THREE.Object3D, eye: THREE.Camera, colors: THREE.Scene) {
      assert.notEqual(colors, scene); assert.equal(eye, camera); assert.equal(target?.width, 1);
      let points = 0, shadows = 0; let root: THREE.Object3D | undefined;
      colors.traverseVisible(object => {
        if (object instanceof THREE.PointLight) points++;
        if (object instanceof THREE.DirectionalLight && object.castShadow) shadows++;
        if (object instanceof THREE.Group && object.parent instanceof THREE.Scene && object.getObjectByName(landmark)) root = object;
      });
      const meshes: THREE.Object3D[] = []; subject.traverse(object => meshes.push(object)); assert.ok(meshes.length && meshes.length <= 4);
      const depth = meshes.filter((mesh): mesh is THREE.Mesh<THREE.BufferGeometry, THREE.MeshDepthMaterial> => mesh instanceof THREE.Mesh && mesh.material instanceof THREE.MeshDepthMaterial);
      if (depth.length) {
        assert.equal(depth.length, meshes.length); assert.equal(colors.environment, null); assert.equal(colors.fog, null);
        depthBatches.push({ points, meshes: depth });
      } else {
        assert.equal(colors.environment, scene.environment); assert.equal(colors.fog, scene.fog);
        if (!root && withShadows && (city || mode === 'subway')) assert.equal(points, city ? 12 : 4, 'live source colours use their current light layout');
        else {
          assert.equal(points, plan.points); assert.equal(shadows, plan.shadows); assert.ok(root); roots.add(root);
          assert.equal(scene.children.includes(root), false, 'the future set must stay offstage');
        }
      }
      if (meshes.includes(skin)) assert.match(material.customProgramCacheKey(), /actor-local-skin-v1$/);
      batches.push(meshes); work.push('compile'); programs.push({ program: {}, isReady: () => ready, getUniforms: () => { assert.equal(gpu.debug.checkShaderErrors, false); work.push('bindings'); } });
    },
    initTexture(map: THREE.Texture) { uploaded.set(map, map.version); work.push('texture'); },
  } as unknown as THREE.WebGLRenderer;
  const prepare = () => {
    const count = work.length; if (roof) film.prepareGovernment(gpu, camera, journey, id => bodies.get(id), id => heroes.get(id), sun, sourceLights);
    else film.prepareMatrixEscape(gpu, camera, journey, id => bodies.get(id), id => heroes.get(id), sun, sourceLights);
    const actions = work.slice(count);
    assert.ok(actions.length <= 1 || !roof && actions.length === 2 && actions.every(action => action === 'strip'),
      'prepare one small batch, one ready binding or at most two bitmap strips per frame');
    assert.equal(parent.visible, false); assert.equal(hero.parent, parent); assert.equal(skin.parent, hero); assert.equal(skin.visible, false); assert.equal(later.visible, false); assert.equal(target, null);
  };
  const drain = () => { for (let i = 0; i < 1000; i++) prepare(); };
  t.after(() => { film.dispose(); sourceLights?.dispose(); geometry.dispose(); material.dispose(); (coarse.material as THREE.Material).dispose(); texture.dispose(); scene.environment!.dispose(); globalThis.document = previous; });
  return { target: plan.to, landmark, film, journey, gpu, sun, heroes, bodies, geometry, material, skin, coarse, later, texture, work, batches, depthBatches, roots, prepare, drain,
    ready: () => { ready = true; }, newGpu: () => { uploaded = new WeakMap(); gpu.properties = properties() as THREE.WebGLRenderer['properties']; } };
}

test('the roof prepares hidden crash fire and ripples before they become visible', t => {
  const h = fixture(t, 'subway', true), roof = new GovernmentSetRenderer(h.film.root, 'film_government_roof');
  Object.assign(h.film, { government: roof }); roof.update(h.journey, 0);
  const fire = h.film.root.getObjectByName('air-rescue-crash-fire')!, ripples = h.film.root.getObjectByName('air-rescue-impact-ripples')!;
  const needed: THREE.Mesh[] = [];
  for (const group of [fire, ripples]) group.traverse(object => { if (object instanceof THREE.Mesh) needed.push(object); });
  assert(needed.length > 20); assert.equal(fire.visible, false); assert.equal(ripples.visible, false);
  h.ready(); h.drain();
  assert(needed.every(mesh => h.batches.some(batch => batch.includes(mesh))), 'every hidden crash surface must have its actual source-light program prepared');
  assert.equal(fire.visible, false); assert.equal(ripples.visible, false); assert.equal(h.journey.airRescue!.elapsed, 0);
  const before = h.batches.length; h.newGpu(); h.drain();
  assert(needed.every(mesh => h.batches.slice(before).some(batch => batch.includes(mesh))), 'a new context must prepare the hidden effects again');
});

test('a cold subway pickup prepares both cast models and hidden phone debris before the shot', t => {
  const h = fixture(t, 'city', true), station = new MatrixEscapeRenderer(h.film.root, 'film_subway_platform');
  Object.assign(h.film, { matrixEscape: station }); h.journey.matrixEscape!.phase = 'crew_exit';
  const smith = new THREE.Group(), first = new THREE.Mesh(h.geometry, h.material); first.visible = false; smith.add(first); h.heroes.set('smith', smith);
  const debris = h.film.root.getObjectByName('matrix-subway-phone-debris')!, needed: THREE.Mesh[] = [];
  debris.traverse(object => { if (object instanceof THREE.Mesh) needed.push(object); });
  h.ready(); h.drain();
  for (const mesh of [h.skin, h.coarse, first, ...needed]) assert(h.batches.some(batch => batch.includes(mesh)), 'the current platform needs every arriving actor and phone-fragment program');
  assert.equal(debris.visible, false); assert.equal(h.journey.matrixEscape!.phase, 'crew_exit');
  const count = h.work.length; h.drain(); assert.equal(h.work.length, count);
  const late = new THREE.Mesh(h.geometry, h.material); late.visible = false; smith.add(late);
  const before = h.batches.length; h.drain(); assert(h.batches.slice(before).some(batch => batch.includes(late)), 'later delivery inside the same Smith group must still prepare');
  const uploaded = h.batches.length; h.newGpu(); h.drain(); assert(h.batches.slice(uploaded).some(batch => batch.includes(first)));
});

for (const mode of ['subway', 'city', 'hotel'] as const) test(`${mode} prepares both depth layouts and releases replaced or cancelled materials`, t => {
  const h = fixture(t, mode, true); h.skin.castShadow = h.coarse.castShadow = true; h.ready(); h.drain();
  const source = mode === 'subway' ? 4 : mode === 'city' ? 12 : 2;
  assert.deepEqual([...new Set(h.depthBatches.map(batch => batch.points))], [source, cases[mode].points]);
  for (const points of [source, cases[mode].points]) {
    const meshes = h.depthBatches.filter(batch => batch.points === points).flatMap(batch => batch.meshes);
    assert(meshes.some(mesh => mesh instanceof THREE.SkinnedMesh && mesh.geometry === h.geometry));
    assert(meshes.some(mesh => !(mesh instanceof THREE.SkinnedMesh)), 'equivalent rigid casters share one prepared depth variant');
  }
  const before = new Set(h.depthBatches.flatMap(batch => batch.meshes.map(mesh => mesh.material)));
  let replaced = 0; for (const material of before) material.addEventListener('dispose', () => replaced++);
  h.newGpu(); h.drain(); assert.equal(replaced, before.size);
  const next = new Set(h.depthBatches.flatMap(batch => batch.meshes.map(mesh => mesh.material)).filter(material => !before.has(material)));
  let cancelled = 0; for (const material of next) material.addEventListener('dispose', () => cancelled++);
  h.journey.visiting = h.journey.scene; h.prepare(); assert.equal(cancelled, next.size);
});

for (const mode of ['roof', 'subway', 'city', 'hotel'] as const) {
  test(`${mode} preparation includes hidden and late cast in bounded batches with the next lighting`, t => {
    const h = fixture(t, mode); h.ready();
    if (mode === 'city') {
      h.journey.matrixEscape!.phase = 'train_window'; h.prepare(); assert.equal(h.work.length, 0);
      h.journey.matrixEscape!.phase = 'body_swap';
    }
    if (mode === 'hotel') {
      h.journey.matrixEscape!.phase = 'door_ready'; h.prepare(); assert.equal(h.work.length, 0);
      h.journey.matrixEscape!.phase = 'door';
    }
    h.drain();
    assert.ok(h.batches.flat().includes(h.skin), 'the next scene must prepare the actual skinned actor');
    assert.ok(h.batches.flat().includes(h.coarse)); assert.equal(h.batches.flat().includes(h.later), false);
    assert.equal(h.work.filter(value => value === 'texture').length, 1); assert.equal(h.roots.size, 1);
    const count = h.work.length; h.drain(); assert.equal(h.work.length, count);
    const late = new THREE.Group(), mesh = new THREE.Mesh(h.geometry, h.material); mesh.visible = false; late.add(mesh); h.heroes.set(cases[mode].late, late);
    const before = h.batches.length; h.drain(); assert.ok(h.batches.slice(before).flat().includes(mesh));
    const after = h.batches.length; h.newGpu(); h.drain(); assert.ok(h.batches.length > after); assert.equal(h.roots.size, 1);
  });
  test(`${mode} cancellation and visiting release the future room once`, t => {
    const h = fixture(t, mode); h.journey.visiting = h.journey.scene; h.prepare(); assert.equal(h.work.length, 0); delete h.journey.visiting;
    h.ready(); h.drain(); const root = [...h.roots][0]; assert.ok(root);
    const mesh = root.getObjectByName(h.landmark) as THREE.Mesh;
    let disposed = 0; mesh.geometry.addEventListener('dispose', () => disposed++);
    h.journey.scene = 'm1_guns'; h.prepare(); assert.ok(root.parent === null); assert.equal(disposed, 1); h.prepare(); assert.equal(disposed, 1);
  });
  test(`${mode} entry adopts the same geometry at its authored world position`, t => {
    const h = fixture(t, mode, mode !== 'roof'); h.skin.castShadow = h.coarse.castShadow = true; h.ready(); h.drain(); const root = [...h.roots][0]; assert.ok(root);
    const mesh = root.getObjectByName(h.landmark) as THREE.Mesh;
    const depth = new Set(h.depthBatches.flatMap(batch => batch.meshes.map(mesh => mesh.material)));
    if (mode !== 'roof') assert(depth.size > 0);
    let depthDisposed = 0; for (const material of depth) material.addEventListener('dispose', () => depthDisposed++);
    root.updateMatrixWorld(true); const local = mesh.getWorldPosition(new THREE.Vector3()), center = FILM_SETS[h.target].center;
    let disposed = 0; mesh.geometry.addEventListener('dispose', () => disposed++);
    const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const neo = world.agents.get('neo')!;
    neo.position = filmPosition(h.target); neo.currentLocation = h.target; neo.isInMatrix = true;
    const journey = { ...h.journey, scene: cases[mode].next, step: 0, completed: [],
      airRescue: mode === 'roof' ? { kind: 'roof', phase: 'ready', elapsed: 0, attempt: 0, grip: 1, braces: 0, misses: 0, resolved: [] } : undefined,
      matrixEscape: mode === 'city' ? { ...h.journey.matrixEscape!, kind: 'city', phase: 'ready', elapsed: 0, checkpoint: 'street' } : undefined,
    } as FilmJourney;
    h.film.update(neo, { neoLife: { journey } } as SandboxState, 0); h.film.root.updateMatrixWorld(true);
    assert.ok(h.film.root.getObjectByName(h.landmark) === mesh); assert.equal(disposed, 0);
    assert.equal(depthDisposed, 0, 'the first live frame retains the prepared depth programs');
    assert.deepEqual(mesh.getWorldPosition(new THREE.Vector3()).toArray(), [center.x + local.x, center.y - 1 + local.y, center.z + local.z]);
    h.film.update(undefined, undefined, 0); assert.equal(disposed, 1); assert.equal(depthDisposed, depth.size); h.film.dispose(); assert.equal(disposed, 1); assert.equal(depthDisposed, depth.size);
  });
}

for (const mode of ['roof', 'subway', 'city', 'hotel'] as const) {
  test(`a saved rescue keeps its prepared ${mode} when Neo takes control`, t => {
    const h = fixture(t, mode), plan = cases[mode]; h.ready();
    Object.assign(h.film, { current: undefined });
    h.sun.visible = false;
    const encounter = h.journey.airRescue ?? h.journey.matrixEscape!;
    encounter.phase = 'ready'; h.prepare(); assert.equal(h.work.length, 0);
    encounter.phase = 'done'; h.journey.completed = [plan.scene];
    h.drain();
    assert.equal(h.roots.size, 1, 'prepare the destination under the player lights while on the landing screen');
    const root = [...h.roots][0], landmark = root.getObjectByName(h.landmark) as THREE.Mesh;
    let disposed = 0; landmark.geometry.addEventListener('dispose', () => disposed++);

    const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const neo = world.agents.get('neo')!;
    neo.position = filmPosition(plan.from); neo.currentLocation = plan.from; neo.isInMatrix = true;
    h.sun.visible = true;
    h.film.update(neo, { neoLife: { journey: h.journey } } as SandboxState, 0);
    h.drain(); assert.equal(h.roots.size, 1); assert.equal(disposed, 0);

    neo.position = filmPosition(h.target); neo.currentLocation = h.target;
    const next = { ...h.journey, scene: plan.next, step: 0,
      airRescue: mode === 'roof' ? { kind: 'roof', phase: 'ready', elapsed: 0, attempt: 0, grip: 1, braces: 0, misses: 0, resolved: [] } : undefined,
      matrixEscape: mode === 'city' ? { ...h.journey.matrixEscape!, kind: 'city', phase: 'ready', elapsed: 0, checkpoint: 'street' } : undefined,
    } as FilmJourney;
    h.film.update(neo, { neoLife: { journey: next } } as SandboxState, 0);
    assert.equal(h.film.root.getObjectByName(h.landmark), landmark);
    h.film.update(undefined, undefined, 0); assert.equal(disposed, 1);
  });
}

test('subway preparation bounds bitmap uploads and releases partial allocations when the GPU or scene changes', t => {
  const h = fixture(t, 'subway');
  class Bitmap { width = 2048; height = 2048; }
  const previous = globalThis.ImageBitmap, bitmap = new Bitmap();
  globalThis.ImageBitmap = Bitmap as unknown as typeof ImageBitmap;
  t.after(() => { if (previous) globalThis.ImageBitmap = previous; else Reflect.deleteProperty(globalThis, 'ImageBitmap'); });
  h.texture.image = bitmap; h.texture.flipY = false;
  const source = h.texture.source, rows: number[] = [], disposed: THREE.Texture[] = [];
  let resident = new WeakMap<THREE.Texture, { __webglTexture: object; __version: number }>();
  const properties = () => ({ get: (texture: THREE.Texture) => resident.get(texture) ?? {} });
  Object.assign(h.gpu, {
    capabilities: { maxTextureSize: 4096 }, properties: properties(), state: { bindTexture() {}, unbindTexture() {} },
    getContext: () => ({ LINK_STATUS: 0x8b82, getProgramParameter: () => true, pixelStorei() {},
      texSubImage2D(_target: number, _level: number, _x: number, row: number, width: number, height: number,
        _format: number, _type: number, image: Bitmap) {
        assert.equal(image, bitmap); assert.deepEqual([width, height], [2048, 256]); rows.push(row); h.work.push('strip');
      }, generateMipmap() {} }),
    initTexture(texture: THREE.Texture) {
      resident.set(texture, { __webglTexture: {}, __version: texture.version });
      texture.addEventListener('dispose', () => disposed.push(texture));
    },
  });
  h.prepare();
  assert.deepEqual(rows, [0, 256], 'the station must upload the bitmap in bounded strips');
  assert.equal(resident.has(h.texture), false);
  resident = new WeakMap(); h.gpu.properties = properties() as THREE.WebGLRenderer['properties']; h.prepare();
  assert.equal(disposed.length, 1); assert.deepEqual(rows.slice(2), [0, 256]);
  h.journey.visiting = h.journey.scene; h.prepare();
  assert.equal(disposed.length, 2); assert.equal(h.texture.source, source);
  delete h.journey.visiting;
  for (let frame = 0; frame < 4; frame++) h.prepare();
  assert.deepEqual(rows.slice(4), [0, 256, 512, 768, 1024, 1280, 1536, 1792]);
  assert.ok(resident.has(h.texture)); assert.equal(disposed.length, 3);
  assert.ok(disposed.every(texture => texture !== h.texture));
});

test('subway phone debris is prepared while hidden without changing its physical material or visibility', t => {
  const h = fixture(t, 'subway'); h.ready(); h.drain();
  const root = [...h.roots][0], debris = root.getObjectByName('matrix-subway-phone-debris')!;
  assert.ok(debris); assert.equal(debris.visible, false);
  const shards: THREE.Mesh[] = []; debris.traverse(object => { if (object instanceof THREE.Mesh) shards.push(object); });
  assert.equal(shards.length, 7, 'six glass meshes and one existing opaque batch');
  for (const shard of shards) assert.ok(h.batches.flat().includes(shard), 'the hidden shard must link before its first visible phone impact');
  const glass = shards.filter(shard => shard.material instanceof THREE.MeshPhysicalMaterial);
  assert.equal(glass.length, 6);
  for (const shard of glass) {
    const material = shard.material as THREE.MeshPhysicalMaterial;
    assert.equal(material.side, THREE.DoubleSide); assert.equal(material.forceSinglePass, false);
    assert.equal(material.transmission, .84 - .32); assert.equal(material.thickness, .14);
    assert.equal(shard.visible, true); assert.ok(shard.parent === debris);
  }
  const count = h.work.length; h.drain(); assert.equal(h.work.length, count);
});

test('subway phone debris preparation restarts for a new GPU without duplicating the hidden effect', t => {
  const h = fixture(t, 'subway'); h.ready(); h.drain();
  const root = [...h.roots][0], debris = root.getObjectByName('matrix-subway-phone-debris')!;
  const shard = debris.children.find(object => object instanceof THREE.Mesh)!;
  assert.ok(h.batches.flat().includes(shard));
  const count = h.batches.length; h.newGpu(); h.drain();
  assert.ok(h.batches.slice(count).flat().includes(shard));
  assert.equal(h.roots.size, 1); assert.equal(debris.visible, false); assert.ok(root.getObjectByName(debris.name) === debris);
});

test('subway phone debris preparation cancels and disposes each actual shard once', t => {
  const h = fixture(t, 'subway'); h.ready(); h.drain();
  const root = [...h.roots][0], debris = root.getObjectByName('matrix-subway-phone-debris')!;
  const shard = debris.children.find(object => object instanceof THREE.Mesh) as THREE.Mesh;
  assert.ok(h.batches.flat().includes(shard));
  let disposed = 0; shard.geometry.addEventListener('dispose', () => disposed++);
  h.journey.scene = 'm1_guns'; h.prepare(); h.prepare();
  assert.equal(disposed, 1); assert.equal(root.parent, null);
});

test('Smith’s texture preparation continues from the street to 303 and supports a cold revival', t => {
  const h = fixture(t, 'city');
  h.journey.scene = 'm1_city_chase';
  class Bitmap { width = 2048; height = 2048; }
  const previous = globalThis.ImageBitmap;
  globalThis.ImageBitmap = Bitmap as unknown as typeof ImageBitmap;
  t.after(() => { if (previous) globalThis.ImageBitmap = previous; else Reflect.deleteProperty(globalThis, 'ImageBitmap'); });
  const smith = new THREE.Group();
  const meshes = ['Anatomical_head_and_hands', 'short04', 'Tailored_coat_upper'].map(name => {
    const map = new THREE.Texture(new Bitmap()); map.flipY = false; map.needsUpdate = true;
    const mesh = new THREE.Mesh(h.geometry, new THREE.MeshStandardMaterial({ map })); mesh.name = name; smith.add(mesh);
    t.after(() => { mesh.material.dispose(); map.dispose(); }); return mesh;
  });
  let hero: THREE.Group | undefined;
  const agent = Object.assign(Object.create(AgentRenderer.prototype), { getAgentHero: (id: string) => id === 'smith' ? hero : undefined }) as AgentRenderer;
  const original = meshes.map(mesh => mesh.material.map!), disposals: THREE.Texture[] = [], rows: number[] = [];
  const resident = new WeakMap<THREE.Texture, object>();
  Object.assign(h.gpu, {
    properties: { get: (texture: THREE.Texture) => ({ __webglTexture: resident.get(texture) }) },
    capabilities: { maxTextureSize: 4096 }, state: { bindTexture() {}, unbindTexture() {} },
    getContext: () => ({ pixelStorei() {}, generateMipmap() {},
      texSubImage2D(_target: number, _level: number, _x: number, row: number, width: number, height: number) {
        assert.deepEqual([width, height], [2048, 256]); rows.push(row);
      } }),
    initTexture(texture: THREE.Texture) {
      resident.set(texture, {}); if (!original.includes(texture)) texture.addEventListener('dispose', () => disposals.push(texture));
    },
  });
  const prepare = (active = true) => agent.prepareSmithTextures(h.gpu, active ? h.journey : undefined);
  t.after(() => prepare(false));
  prepare(); assert.deepEqual(rows, []);
  hero = smith; prepare();
  assert.deepEqual(rows, [0], 'the first available Smith map must stage only its first strip');
  assert.equal(resident.has(original[0]), false);
  h.journey.scene = 'm1_death'; prepare();
  assert.deepEqual(rows, [0, 256], '303 can continue the upload begun before the street cut');
  h.journey.visiting = 'm1_death'; prepare();
  assert.equal(disposals.length, 1, 'leaving the main route cancels the partial allocation');
  delete h.journey.visiting;
  h.journey.theOne = { kind: 'death', phase: 'revive', elapsed: 0, attempt: 0, checkpoint: 'door',
    signal: 1, hits: 0, blocks: 0, deadline: 0, altitude: 0, flightX: 0, flightZ: 0, resolved: [] };
  rows.length = 0;
  for (let frame = 0; frame < 32; frame++) prepare();
  const mapRows = [0, 256, 512, 768, 1024, 1280, 1536, 1792];
  assert.deepEqual(rows, [...mapRows, ...mapRows, ...mapRows]);
  assert.ok(original.every(texture => resident.has(texture)));
  assert.equal(disposals.length, 4);
});
